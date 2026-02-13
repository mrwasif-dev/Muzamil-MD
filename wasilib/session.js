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
    
    const state = {
        creds: savedAuth?.creds || null,
        keys: savedAuth?.keys || {}
    };

    const saveCreds = async () => {
        if (state.creds) {
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
        
        // 🔥 FIX: Connection handler
        wasi_sock.ev.on('connection.update', (update) => {
            const { connection, qr, lastDisconnect } = update;
            
            // 🔥 اگر QR ہے تو دکھاؤ
            if (qr) {
                console.log('📱 QR CODE GENERATED - SCAN WITH WHATSAPP');
                console.log('🌐 Go to Web Dashboard to scan');
                // QR store karo session mein
                const session = sessions.get(sessionId);
                if (session) {
                    session.qr = qr;
                }
                return; // QR مل گیا، reconnect مت کرو
            }
            
            // 🔥 کنیکٹ ہو گیا
            if (connection === 'open') {
                console.log('✅ Connected to WhatsApp - session saved to MongoDB');
                const session = sessions.get(sessionId);
                if (session) {
                    session.isConnected = true;
                    session.qr = null;
                }
                return;
            }
            
            // 🔥 کنیکشن بند ہوا
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`❌ Connection closed with code: ${statusCode}`);
                
                // صرف 401 (logged out) پر ہی reconnect کرو
                if (statusCode === 401) {
                    console.log('🚫 Session logged out, QR needed');
                    const session = sessions.get(sessionId);
                    if (session) {
                        session.isConnected = false;
                    }
                } else {
                    // باقی cases میں reconnect
                    console.log('🔄 Reconnecting in 5 seconds...');
                    setTimeout(() => wasi_connectSession(false, sessionId), 5000);
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
