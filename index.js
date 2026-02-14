require('dotenv').config();

const crypto = require('crypto');
if (!globalThis.crypto) {
    globalThis.crypto = crypto;
}

const { default: makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const { muzamil_connectDatabase } = require('./lib/database');
const { muzamil_connectSession, muzamil_clearSession } = require('./lib/session');
const commands = require('./commands');

const app = express();
const port = process.env.PORT || 3000;
const sessions = new Map();
const configPath = path.join(__dirname, 'config.json');

// Load config
let botConfig = { sourceJids: [], targetJids: [], oldTextRegex: [], newText: '' };
try {
    if (fs.existsSync(configPath)) {
        botConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('✅ Config loaded');
    } else {
        fs.writeFileSync(configPath, JSON.stringify(botConfig, null, 2));
    }
} catch (e) {
    console.error('Config error:', e);
}

const saveConfig = () => {
    try {
        fs.writeFileSync(configPath, JSON.stringify(botConfig, null, 2));
        return true;
    } catch (e) {
        return false;
    }
};

// Auto forward config
const SOURCE_JIDS = process.env.SOURCE_JIDS?.split(',') || botConfig.sourceJids;
const TARGET_JIDS = process.env.TARGET_JIDS?.split(',') || botConfig.targetJids;

const OLD_TEXT_REGEX = process.env.OLD_TEXT_REGEX?.split(',').map(p => {
    try { return new RegExp(p.trim(), 'gu'); } catch { return null; }
}).filter(r => r) || botConfig.oldTextRegex.map(p => new RegExp(p, 'gu'));

const NEW_TEXT = process.env.NEW_TEXT || botConfig.newText || '';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Message cleaning
const cleanForwardedLabel = (msg) => {
    try {
        const cleaned = JSON.parse(JSON.stringify(msg));
        const types = ['extendedTextMessage', 'imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'];
        types.forEach(type => {
            if (cleaned[type]?.contextInfo) {
                cleaned[type].contextInfo.isForwarded = false;
                cleaned[type].contextInfo.forwardingScore = 0;
            }
        });
        delete cleaned.protocolMessage;
        return cleaned;
    } catch {
        return msg;
    }
};

const replaceCaption = (text) => {
    if (!text || !OLD_TEXT_REGEX.length || !NEW_TEXT) return text;
    let result = text;
    OLD_TEXT_REGEX.forEach(regex => result = result.replace(regex, NEW_TEXT));
    return result;
};

const processMessage = (original) => {
    try {
        let msg = cleanForwardedLabel(original);
        const text = msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || '';
        
        if (text) {
            const cleaned = text.replace(/📢|🔔|📰|🗞️|\[NEWSLETTER\]|\[BROADCAST\]|Newsletter:|Broadcast:/gi, '').trim();
            if (msg.conversation) msg.conversation = cleaned;
            else if (msg.extendedTextMessage) msg.extendedTextMessage.text = cleaned;
            else if (msg.imageMessage) msg.imageMessage.caption = replaceCaption(cleaned);
            else if (msg.videoMessage) msg.videoMessage.caption = replaceCaption(cleaned);
        }
        return msg;
    } catch {
        return original;
    }
};

// Command handler
const processCommand = async (sock, msg) => {
    try {
        const from = msg.key.remoteJid;
        let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || 
                   msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '';
        
        if (!text || !text.startsWith('!')) return;
        
        const cmd = text.trim().toLowerCase().split(' ')[0];
        const command = commands.get(cmd);
        
        if (command) {
            console.log(`⚡ Executing: ${cmd}`);
            await command.execute(sock, from, msg);
        }
    } catch (error) {
        console.error('Command error:', error);
    }
};

// Start session
const startSession = async (sessionId) => {
    if (sessions.has(sessionId)) {
        const existing = sessions.get(sessionId);
        if (existing.isConnected) return;
        existing.sock?.end();
        sessions.delete(sessionId);
    }

    console.log(`🚀 Starting: ${sessionId}`);
    const sessionState = { sock: null, isConnected: false, qr: null };
    sessions.set(sessionId, sessionState);

    const { sock, saveCreds } = await muzamil_connectSession(sessionId);
    sessionState.sock = sock;

    sock.ev.on('connection.update', (update) => {
        const { connection, qr, lastDisconnect } = update;
        
        if (qr) {
            sessionState.qr = qr;
            sessionState.isConnected = false;
            console.log('📱 QR Generated');
        }
        
        if (connection === 'open') {
            sessionState.isConnected = true;
            sessionState.qr = null;
            console.log('✅ Connected');
        }
        
        if (connection === 'close') {
            sessionState.isConnected = false;
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code !== 401) setTimeout(() => startSession(sessionId), 5000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        if (text.startsWith('!')) await processCommand(sock, msg);

        if (SOURCE_JIDS.includes(msg.key.remoteJid) && !msg.key.fromMe) {
            try {
                let relay = processMessage(msg.message);
                const isMedia = relay.imageMessage || relay.videoMessage || relay.audioMessage || relay.documentMessage;
                const isEmoji = relay.conversation && /^(\p{Emoji}|\s)+$/u.test(relay.conversation);
                
                if (!isMedia && !isEmoji) return;
                
                for (const target of TARGET_JIDS) {
                    await sock.relayMessage(target, relay, { messageId: sock.generateMessageTag() });
                    console.log(`📦 Forwarded to ${target}`);
                }
            } catch (err) {
                console.error('Forward error:', err.message);
            }
        }
    });
};

// API Routes
app.get('/api/status', (req, res) => {
    const session = sessions.get(process.env.SESSION_ID);
    res.json({
        connected: session?.isConnected || false,
        qr: session?.qr ? QRCode.toDataURL(session.qr) : null
    });
});

app.get('/api/config', (req, res) => res.json(botConfig));

app.post('/api/config', (req, res) => {
    Object.assign(botConfig, req.body);
    res.json({ success: saveConfig() });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Main
const main = async () => {
    const sessionId = process.env.SESSION_ID;
    if (!sessionId) {
        console.error('❌ SESSION_ID required');
        process.exit(1);
    }

    if (process.env.MONGODB_URL) {
        await muzamil_connectDatabase(process.env.MONGODB_URL);
    }

    await startSession(sessionId);
    
    app.listen(port, () => {
        console.log(`🌐 Server running on port ${port}`);
        console.log(`📡 Auto Forward: ${SOURCE_JIDS.length} → ${TARGET_JIDS.length}`);
        console.log(`🤖 Commands: !ping, !jid, !gjid`);
    });
};

main();
