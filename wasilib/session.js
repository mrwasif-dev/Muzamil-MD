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
    const savedAuth = await wasi_loadAuth(sessionId);
    
    // 🔥 FIX: Ensure creds is never null
    const state = {
        creds: savedAuth?.creds || {
            me: null,
            registered: false,
            deviceId: "placeholder",
            account: null
        },
        keys: savedAuth?.keys || {}
    };

    const saveCreds = async () => {
        if (state.creds && state.creds.me) {  // Only save if we have valid creds
            await wasi_saveAuth(sessionId, state.creds, state.keys);
            await wasi_registerSession(sessionId);
        }
    };

    return { state, saveCreds };
}

async function wasi_connectSession(flag = false, sessionId) {
    try {
        console.log(`🔍 Looking for session: ${sessionId} in MongoDB`);
        
        const { state, saveCreds } = await useMongoDBAuthState(sessionId);
        const { version } = await fetchLatestBaileysVersion();

        const hasSession = state.creds?.me ? true : false;
        
        if (hasSession) {
            console.log('✅ Existing session found in MongoDB! No QR needed.');
        } else {
            console.log('📱 No existing session, QR will be generated');
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
        
        // 🔥 FIX: Connection handler - sessions map is not available here
        wasi_sock.ev.on('connection.update', (update) => {
            const { connection, qr, lastDisconnect } = update;
            
            // QR is available
            if (qr) {
                console.log('📱 QR CODE GENERATED - SCAN WITH WHATSAPP');
                console.log('🌐 Go to Web Dashboard to scan');
                // Note: QR is stored in the session object in index.js
                return;
            }
            
            // Connected successfully
            if (connection === 'open') {
                console.log('✅ Connected to WhatsApp - session saved to MongoDB');
                return;
            }
            
            // Connection closed
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`❌ Connection closed with code: ${statusCode}`);
                
                // Only reconnect if not logged out
                if (statusCode !== 401) {
                    console.log('🔄 Reconnecting in 5 seconds...');
                    setTimeout(() => wasi_connectSession(false, sessionId), 5000);
                } else {
                    console.log('🚫 Session logged out, QR needed');
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
