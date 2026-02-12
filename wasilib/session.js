const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

// 🔥 FIX: Import crypto for Node.js 18+
const crypto = require('crypto');

// 🔥 FIX: Set global crypto
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

        // ✅ FIX: Terminal QR OFF - صرف Web Dashboard پر QR
        const wasi_sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,  // 🔥 TERMINAL QR BAND
            browser: Browsers.macOS('Desktop'),
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            shouldIgnoreJid: jid => jid.includes('newsletter'),
            markOnlineOnConnect: false,
            defaultQueryTimeoutMs: 60000
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
