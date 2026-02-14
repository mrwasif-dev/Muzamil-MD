const { default: makeWASocket, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const {
    muzamil_loadAuth,
    muzamil_saveAuth
} = require('./database');

const crypto = require('crypto');
if (!globalThis.crypto) {
    globalThis.crypto = crypto;
}

const logger = pino({ level: 'silent' });

const useMuzamilAuthState = async (sessionId) => {
    const savedAuth = await muzamil_loadAuth(sessionId);
    
    // 🔥 FIX: creds null نہیں ہونا چاہیے
    const state = {
        creds: savedAuth?.creds || {
            me: null,
            registered: false,
            deviceId: "temp-" + Date.now(),
            account: null
        },
        keys: savedAuth?.keys || {}
    };

    const saveCreds = async () => {
        // 🔥 FIX: صرف اس وقت save کرو جب me موجود ہو
        if (state.creds?.me) {
            await muzamil_saveAuth(sessionId, state.creds, state.keys);
        }
    };

    return { state, saveCreds };
};

const muzamil_connectSession = async (sessionId) => {
    try {
        console.log(`🔍 Looking for session: ${sessionId}`);
        
        const { state, saveCreds } = await useMuzamilAuthState(sessionId);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.macOS('Desktop'),
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            shouldIgnoreJid: jid => jid.includes('newsletter'),
            markOnlineOnConnect: false,
            defaultQueryTimeoutMs: 60000,
            logger,
            connectTimeoutMs: 30000,
            keepAliveIntervalMs: 30000,
            maxRetries: 2
        });

        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', (update) => {
            const { connection, qr, lastDisconnect } = update;
            
            if (qr) {
                console.log('\n📱 QR CODE GENERATED - SCAN WITH WHATSAPP');
                console.log('🌐 Or use Web Dashboard\n');
            }
            
            if (connection === 'open') {
                console.log('✅ WhatsApp Connected!');
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode !== 401) {
                    console.log('🔄 Reconnecting in 10s...');
                    setTimeout(() => muzamil_connectSession(sessionId), 10000);
                } else {
                    console.log('🚫 Logged out, scan QR again');
                }
            }
        });

        return { sock, saveCreds };
    } catch (error) {
        console.error('❌ Session error:', error);
        throw error;
    }
};

const muzamil_clearSession = async (sessionId) => {
    const { muzamil_deleteAuth } = require('./database');
    await muzamil_deleteAuth(sessionId);
    console.log(`✅ Session cleared: ${sessionId}`);
};

module.exports = {
    muzamil_connectSession,
    muzamil_clearSession
};
