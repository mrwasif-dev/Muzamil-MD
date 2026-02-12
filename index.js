require('dotenv').config();

// 🔥 CRITICAL FIX: Heroku Node.js 18+ Crypto Fix
const crypto = require('crypto');
if (!globalThis.crypto) {
    globalThis.crypto = crypto;
}

const {
    DisconnectReason,
    jidNormalizedUser,
    proto
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const fs = require('fs');
const path = require('path');

const { wasi_connectSession, wasi_clearSession } = require('./wasilib/session');
const { 
    wasi_connectDatabase, 
    wasi_isDbConnected,
    wasi_registerSession,    // ✅ FIXED: Imported
    wasi_unregisterSession,  // ✅ FIXED: Imported
    wasi_getAllSessions      // ✅ FIXED: Imported
} = require('./wasilib/database');
const commands = require('./commands');

const wasi_app = express();
const wasi_port = process.env.PORT || 3000;

const QRCode = require('qrcode');

// -----------------------------------------------------------------------------
// CONFIG FILE MANAGEMENT
// -----------------------------------------------------------------------------
const configPath = path.join(__dirname, 'botConfig.json');

let botConfig = {
    sourceJids: [],
    targetJids: [],
    oldTextRegex: [],
    newText: ''
};

try {
    if (fs.existsSync(configPath)) {
        botConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('✅ Config loaded from botConfig.json');
    } else {
        fs.writeFileSync(configPath, JSON.stringify(botConfig, null, 2));
        console.log('✅ Created new botConfig.json');
    }
} catch (e) {
    console.error('Error loading config:', e);
}

function saveConfig() {
    try {
        fs.writeFileSync(configPath, JSON.stringify(botConfig, null, 2));
        return true;
    } catch (e) {
        console.error('Error saving config:', e);
        return false;
    }
}

// -----------------------------------------------------------------------------
// AUTO FORWARD CONFIGURATION
// -----------------------------------------------------------------------------
const SOURCE_JIDS = process.env.SOURCE_JIDS 
    ? process.env.SOURCE_JIDS.split(',') 
    : botConfig.sourceJids;

const TARGET_JIDS = process.env.TARGET_JIDS 
    ? process.env.TARGET_JIDS.split(',') 
    : botConfig.targetJids;

const OLD_TEXT_REGEX = process.env.OLD_TEXT_REGEX
    ? process.env.OLD_TEXT_REGEX.split(',').map(pattern => {
        try {
            return pattern.trim() ? new RegExp(pattern.trim(), 'gu') : null;
        } catch (e) {
            console.error(`Invalid regex pattern: ${pattern}`, e);
            return null;
        }
      }).filter(regex => regex !== null)
    : botConfig.oldTextRegex.map(pattern => {
        try {
            return new RegExp(pattern, 'gu');
        } catch (e) {
            return null;
        }
      }).filter(regex => regex !== null);

const NEW_TEXT = process.env.NEW_TEXT
    ? process.env.NEW_TEXT
    : botConfig.newText || '';

// -----------------------------------------------------------------------------
// SESSION STATE
// -----------------------------------------------------------------------------
const sessions = new Map();

// Middleware
wasi_app.use(express.json());
wasi_app.use(express.static(path.join(__dirname, 'public')));

// Keep-Alive Route
wasi_app.get('/ping', (req, res) => res.status(200).send('pong'));

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS FOR MESSAGE CLEANING
// -----------------------------------------------------------------------------

function cleanForwardedLabel(message) {
    try {
        let cleanedMessage = JSON.parse(JSON.stringify(message));
        
        if (cleanedMessage.extendedTextMessage?.contextInfo) {
            cleanedMessage.extendedTextMessage.contextInfo.isForwarded = false;
            if (cleanedMessage.extendedTextMessage.contextInfo.forwardingScore) {
                cleanedMessage.extendedTextMessage.contextInfo.forwardingScore = 0;
            }
        }
        
        if (cleanedMessage.imageMessage?.contextInfo) {
            cleanedMessage.imageMessage.contextInfo.isForwarded = false;
            if (cleanedMessage.imageMessage.contextInfo.forwardingScore) {
                cleanedMessage.imageMessage.contextInfo.forwardingScore = 0;
            }
        }
        
        if (cleanedMessage.videoMessage?.contextInfo) {
            cleanedMessage.videoMessage.contextInfo.isForwarded = false;
            if (cleanedMessage.videoMessage.contextInfo.forwardingScore) {
                cleanedMessage.videoMessage.contextInfo.forwardingScore = 0;
            }
        }
        
        if (cleanedMessage.audioMessage?.contextInfo) {
            cleanedMessage.audioMessage.contextInfo.isForwarded = false;
            if (cleanedMessage.audioMessage.contextInfo.forwardingScore) {
                cleanedMessage.audioMessage.contextInfo.forwardingScore = 0;
            }
        }
        
        if (cleanedMessage.documentMessage?.contextInfo) {
            cleanedMessage.documentMessage.contextInfo.isForwarded = false;
            if (cleanedMessage.documentMessage.contextInfo.forwardingScore) {
                cleanedMessage.documentMessage.contextInfo.forwardingScore = 0;
            }
        }
        
        return cleanedMessage;
    } catch (error) {
        console.error('Error cleaning forwarded label:', error);
        return message;
    }
}

function cleanNewsletterText(text) {
    if (!text) return text;
    
    const newsletterMarkers = [
        /📢\s*/g,
        /🔔\s*/g,
        /📰\s*/g,
        /🗞️\s*/g,
        /\[NEWSLETTER\]/gi,
        /\[BROADCAST\]/gi,
        /\[ANNOUNCEMENT\]/gi,
        /Newsletter:/gi,
        /Broadcast:/gi,
        /Announcement:/gi,
        /Forwarded many times/gi,
        /Forwarded message/gi,
        /This is a broadcast message/gi
    ];
    
    let cleanedText = text;
    newsletterMarkers.forEach(marker => {
        cleanedText = cleanedText.replace(marker, '');
    });
    
    return cleanedText.trim();
}

function replaceCaption(caption) {
    if (!caption) return caption;
    if (!OLD_TEXT_REGEX.length || !NEW_TEXT) return caption;
    
    let result = caption;
    OLD_TEXT_REGEX.forEach(regex => {
        result = result.replace(regex, NEW_TEXT);
    });
    return result;
}

function processAndCleanMessage(originalMessage) {
    try {
        let cleanedMessage = JSON.parse(JSON.stringify(originalMessage));
        cleanedMessage = cleanForwardedLabel(cleanedMessage);
        
        const text = cleanedMessage.conversation ||
            cleanedMessage.extendedTextMessage?.text ||
            cleanedMessage.imageMessage?.caption ||
            cleanedMessage.videoMessage?.caption ||
            cleanedMessage.documentMessage?.caption || '';
        
        if (text) {
            const cleanedText = cleanNewsletterText(text);
            
            if (cleanedMessage.conversation) {
                cleanedMessage.conversation = cleanedText;
            } else if (cleanedMessage.extendedTextMessage?.text) {
                cleanedMessage.extendedTextMessage.text = cleanedText;
            } else if (cleanedMessage.imageMessage?.caption) {
                cleanedMessage.imageMessage.caption = replaceCaption(cleanedText);
            } else if (cleanedMessage.videoMessage?.caption) {
                cleanedMessage.videoMessage.caption = replaceCaption(cleanedText);
            } else if (cleanedMessage.documentMessage?.caption) {
                cleanedMessage.documentMessage.caption = replaceCaption(cleanedText);
            }
        }
        
        delete cleanedMessage.protocolMessage;
        
        if (cleanedMessage.extendedTextMessage?.contextInfo?.participant) {
            const participant = cleanedMessage.extendedTextMessage.contextInfo.participant;
            if (participant.includes('newsletter') || participant.includes('broadcast')) {
                delete cleanedMessage.extendedTextMessage.contextInfo.participant;
                delete cleanedMessage.extendedTextMessage.contextInfo.stanzaId;
                delete cleanedMessage.extendedTextMessage.contextInfo.remoteJid;
            }
        }
        
        if (cleanedMessage.extendedTextMessage) {
            cleanedMessage.extendedTextMessage.contextInfo = cleanedMessage.extendedTextMessage.contextInfo || {};
            cleanedMessage.extendedTextMessage.contextInfo.isForwarded = false;
            cleanedMessage.extendedTextMessage.contextInfo.forwardingScore = 0;
        }
        
        return cleanedMessage;
    } catch (error) {
        console.error('Error processing message:', error);
        return originalMessage;
    }
}

// -----------------------------------------------------------------------------
// COMMAND HANDLER
// -----------------------------------------------------------------------------
async function processCommand(sock, msg) {
    const from = msg.key.remoteJid;
    const text = msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        "";
    
    if (!text || !text.startsWith('!')) return;
    
    const commandName = text.trim().toLowerCase();
    const command = commands.get(commandName);
    
    if (command) {
        try {
            await command.execute(sock, from, msg);
            console.log(`✅ Command executed: ${commandName}`);
        } catch (error) {
            console.error(`❌ Command ${commandName} failed:`, error);
        }
    }
}

// -----------------------------------------------------------------------------
// SESSION MANAGEMENT
// -----------------------------------------------------------------------------
async function startSession(sessionId) {
    if (sessions.has(sessionId)) {
        const existing = sessions.get(sessionId);
        if (existing.isConnected && existing.sock) {
            console.log(`Session ${sessionId} is already connected.`);
            return;
        }
        if (existing.sock) {
            existing.sock.ev.removeAllListeners('connection.update');
            existing.sock.end(undefined);
            sessions.delete(sessionId);
        }
    }

    console.log(`🚀 Starting session: ${sessionId}`);

    const sessionState = {
        sock: null,
        isConnected: false,
        qr: null,
        reconnectAttempts: 0,
    };
    sessions.set(sessionId, sessionState);

    const { wasi_sock, saveCreds } = await wasi_connectSession(false, sessionId);
    sessionState.sock = wasi_sock;

    wasi_sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            sessionState.qr = qr;
            sessionState.isConnected = false;
            console.log(`📱 QR generated for session: ${sessionId}`);
console.log(`🔐 Scan QR from Web Dashboard or Terminal`);
        }

        if (connection === 'close') {
            sessionState.isConnected = false;
            const statusCode = (lastDisconnect?.error instanceof Boom) ?
                lastDisconnect.error.output.statusCode : 500;

            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 440;

            if (shouldReconnect) {
                console.log(`🔄 Reconnecting session: ${sessionId}...`);
                setTimeout(() => startSession(sessionId), 3000);
            } else {
                console.log(`❌ Session ${sessionId} logged out.`);
                sessions.delete(sessionId);
                await wasi_clearSession(sessionId);
            }
        } else if (connection === 'open') {
            sessionState.isConnected = true;
            sessionState.qr = null;
            console.log(`✅ ${sessionId}: Connected to WhatsApp`);
        }
    });

    wasi_sock.ev.on('creds.update', saveCreds);

    wasi_sock.ev.on('messages.upsert', async wasi_m => {
        const wasi_msg = wasi_m.messages[0];
        if (!wasi_msg.message) return;

        const wasi_origin = wasi_msg.key.remoteJid;
        const wasi_text = wasi_msg.message.conversation ||
            wasi_msg.message.extendedTextMessage?.text ||
            wasi_msg.message.imageMessage?.caption ||
            wasi_msg.message.videoMessage?.caption ||
            wasi_msg.message.documentMessage?.caption || "";

        if (wasi_text.startsWith('!')) {
            await processCommand(wasi_sock, wasi_msg);
        }

        if (SOURCE_JIDS.includes(wasi_origin) && !wasi_msg.key.fromMe) {
            try {
                let relayMsg = processAndCleanMessage(wasi_msg.message);
                if (!relayMsg) return;

                if (relayMsg.viewOnceMessageV2)
                    relayMsg = relayMsg.viewOnceMessageV2.message;
                if (relayMsg.viewOnceMessage)
                    relayMsg = relayMsg.viewOnceMessage.message;

                const isMedia = relayMsg.imageMessage ||
                    relayMsg.videoMessage ||
                    relayMsg.audioMessage ||
                    relayMsg.documentMessage ||
                    relayMsg.stickerMessage;

                let isEmojiOnly = false;
                if (relayMsg.conversation) {
                    const emojiRegex = /^(?:\p{Extended_Pictographic}|\s)+$/u;
                    isEmojiOnly = emojiRegex.test(relayMsg.conversation);
                }

                if (!isMedia && !isEmojiOnly) return;

                if (relayMsg.imageMessage?.caption) {
                    relayMsg.imageMessage.caption = replaceCaption(relayMsg.imageMessage.caption);
                }
                if (relayMsg.videoMessage?.caption) {
                    relayMsg.videoMessage.caption = replaceCaption(relayMsg.videoMessage.caption);
                }
                if (relayMsg.documentMessage?.caption) {
                    relayMsg.documentMessage.caption = replaceCaption(relayMsg.documentMessage.caption);
                }

                console.log(`📦 Forwarding from ${wasi_origin}`);

                for (const targetJid of TARGET_JIDS) {
                    try {
                        await wasi_sock.relayMessage(
                            targetJid,
                            relayMsg,
                            { messageId: wasi_sock.generateMessageTag() }
                        );
                        console.log(`✅ Forwarded to ${targetJid}`);
                    } catch (err) {
                        console.error(`Failed to forward to ${targetJid}:`, err.message);
                    }
                }
            } catch (err) {
                console.error('Auto Forward Error:', err.message);
            }
        }
    });
}

// -----------------------------------------------------------------------------
// API ROUTES
// -----------------------------------------------------------------------------
wasi_app.get('/api/status', async (req, res) => {
    const sessionId = process.env.SESSION_ID;
    const session = sessions.get(sessionId);

    let qrDataUrl = null;
    let connected = false;

    if (session) {
        connected = session.isConnected;
        if (session.qr) {
            try {
                qrDataUrl = await QRCode.toDataURL(session.qr, { width: 256 });
            } catch (e) { }
        }
    }

    res.json({
        sessionId,
        connected,
        qr: qrDataUrl,
        activeSessions: Array.from(sessions.keys()),
        dbConnected: wasi_isDbConnected ? wasi_isDbConnected() : false
    });
});

wasi_app.get('/api/config', (req, res) => {
    res.json({
        sourceJids: botConfig.sourceJids,
        targetJids: botConfig.targetJids,
        oldTextRegex: botConfig.oldTextRegex,
        newText: botConfig.newText
    });
});

wasi_app.post('/api/config', express.json(), (req, res) => {
    try {
        const { sourceJids, targetJids, oldTextRegex, newText } = req.body;
        
        if (sourceJids !== undefined) botConfig.sourceJids = sourceJids;
        if (targetJids !== undefined) botConfig.targetJids = targetJids;
        if (oldTextRegex !== undefined) botConfig.oldTextRegex = oldTextRegex;
        if (newText !== undefined) botConfig.newText = newText;
        
        const saved = saveConfig();
        
        res.json({
            success: saved,
            message: saved ? 'Configuration saved successfully' : 'Failed to save configuration'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

wasi_app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -----------------------------------------------------------------------------
// SERVER START
// -----------------------------------------------------------------------------
function wasi_startServer() {
    wasi_app.listen(wasi_port, () => {
        console.log(`🌐 Server running on port ${wasi_port}`);
        console.log(`📡 Auto Forward: ${SOURCE_JIDS.length} source(s) → ${TARGET_JIDS.length} target(s)`);
        console.log(`🤖 Bot Commands: !ping, !jid, !gjid`);
    });
}

// -----------------------------------------------------------------------------
// MAIN STARTUP - FIXED
// -----------------------------------------------------------------------------
async function main() {
    // Connect to MongoDB
    if (process.env.MONGODB_URL) {
        const dbResult = await wasi_connectDatabase(process.env.MONGODB_URL);
        if (dbResult) {
            console.log('✅ Database connected');
        }
    } else {
        console.log('⚠️ MONGODB_URL not set, running without database');
    }

    // Check SESSION_ID
    const sessionId = process.env.SESSION_ID;
    if (!sessionId) {
        console.error('❌ SESSION_ID is required! Please set SESSION_ID environment variable.');
        process.exit(1);
    }
    
    // ✅ FIXED: Register session in database (check if function exists)
    if (typeof wasi_registerSession === 'function' && wasi_isDbConnected()) {
        await wasi_registerSession(sessionId);
        console.log(`✅ Session registered in DB: ${sessionId}`);
    }
    
    // Start WhatsApp session
    await startSession(sessionId);
    wasi_startServer();
}

main();
