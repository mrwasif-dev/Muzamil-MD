const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

// 🔥 FIX: Import crypto for Node.js 18+ (Heroku Fix)
const crypto = require('crypto');

// 🔥 FIX: Set global crypto (Heroku Fix)
if (!globalThis.crypto) {
    globalThis.crypto = crypto;
}

async function wasi_connectSession(flag = false, sessionId) {
    try {
        const sessionDir = path.join(__dirname, '..', 'sessions', sessionId);
        
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();

        const logger = pino({ level: 'silent' });

        const wasi_sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            browser: Browsers.macOS('Desktop'),
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            shouldIgnoreJid: jid => jid.includes('newsletter'),
            markOnlineOnConnect: false,
            defaultQueryTimeoutMs: 60000,
            logger
        });

        // ✅ FIX: QR Code in Terminal
        wasi_sock.ev.on('connection.update', (update) => {
            const { qr } = update;
            if (qr) {
                console.log('\n🔐 SCAN THIS QR CODE WITH WHATSAPP:\n');
                qrcode.generate(qr, { small: true });
                console.log('\n📱 Or scan from Web Dashboard\n');
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
        const sessionDir = path.join(__dirname, '..', 'sessions', sessionId);
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
            console.log(`✅ Session ${sessionId} cleared`);
        }
    } catch (error) {
        console.error('❌ Error clearing session:', error);
    }
}

module.exports = {
    wasi_connectSession,
    wasi_clearSession
};
