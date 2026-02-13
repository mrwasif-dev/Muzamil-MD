const { default: makeWASocket, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const {
    wasi_loadAuth,
    wasi_saveAuth,
    wasi_registerSession
} = require('./database');

const crypto = require('crypto');
if (!globalThis.crypto) {
    globalThis.crypto = crypto;
}

const logger = pino({ level: 'silent' });

// Custom auth state using MongoDB
async function useMongoDBAuthState(sessionId) {
    // Load existing auth from MongoDB
    const savedAuth = await wasi_loadAuth(sessionId);
    
    const state = {
        creds: savedAuth?.creds || null,
        keys: savedAuth?.keys || {}
    };

    const saveCreds = async () => {
        await wasi_saveAuth(sessionId, state.creds, state.keys);
        await wasi_registerSession(sessionId);
    };

    return { state, saveCreds };
}

async function wasi_connectSession(flag = false, sessionId) {
    try {
        console.log(`🔍 Looking for session: ${sessionId} in MongoDB`);
        
        const { state, saveCreds } = await useMongoDBAuthState(sessionId);
        const { version } = await fetchLatestBaileysVersion();

        const hasSession = state.creds ? true : false;
        
        if (hasSession) {
            console.log('✅ Existing session found in MongoDB! No QR needed.');
        } else {
            console.log('📱 No existing session, new QR will be generated');
        }

        const wasi_sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.macOS('Desktop'),
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            shouldIgnoreJid: jid => jid.includes('newsletter'),
            markOnlineOnConnect: false,
            defaultQueryTimeoutMs: 60000,
            logger
        });

        wasi_sock.ev.on('creds.update', saveCreds);
        
        wasi_sock.ev.on('connection.update', (update) => {
            const { connection, qr, lastDisconnect } = update;
            
            if (qr) {
                console.log('📱 QR generated - scan with WhatsApp');
            }
            
            if (connection === 'open') {
                console.log('✅ Connected to WhatsApp - session saved to MongoDB');
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                if (shouldReconnect) {
                    console.log('🔄 Reconnecting...');
                    setTimeout(() => wasi_connectSession(false, sessionId), 3000);
                }
            }
        });

        return { wasi_sock, saveCreds };
    } catch (error) {
        console.error('❌ Session connection error:', error);
        throw error;
    }
}

async function wasi_clearSession(sessionId) {
    try {
        const { wasi_deleteAuth } = require('./database');
        await wasi_deleteAuth(sessionId);
        console.log(`✅ Session ${sessionId} cleared from MongoDB`);
    } catch (error) {
        console.error('❌ Error clearing session:', error);
    }
}

module.exports = {
    wasi_connectSession,
    wasi_clearSession
};
