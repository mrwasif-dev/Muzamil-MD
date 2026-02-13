const { default: makeWASocket, Browsers } = require('@whiskeysockets/baileys');
const { MongoClient } = require('mongodb');
const { useMongoDBAuthState } = require('mongo-baileys');
const path = require('path');
const fs = require('fs');

// 🔥 FIX: Import crypto for Node.js 18+
const crypto = require('crypto');

// 🔥 FIX: Set global crypto
if (!globalThis.crypto) {
    globalThis.crypto = crypto;
}

let mongoClient = null;

async function getMongoClient() {
    if (!mongoClient && process.env.MONGODB_URL) {
        mongoClient = new MongoClient(process.env.MONGODB_URL);
        await mongoClient.connect();
        console.log('✅ MongoDB client connected for auth state');
    }
    return mongoClient;
}

async function wasi_connectSession(flag = false, sessionId) {
    try {
        // MongoDB se auth state lo
        const client = await getMongoClient();
        const db = client.db(); // Default database
        const collection = db.collection('whatsapp_sessions');
        
        const { state, saveCreds } = await useMongoDBAuthState(collection, sessionId);
        const { version } = await fetchLatestBaileysVersion();

        const wasi_sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.macOS('Desktop'),
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            shouldIgnoreJid: jid => jid.includes('newsletter'),
            markOnlineOnConnect: false,
            defaultQueryTimeoutMs: 60000
        });

        // Save creds on update
        wasi_sock.ev.on('creds.update', saveCreds);

        return { wasi_sock, saveCreds };
    } catch (error) {
        console.error('❌ Session connection error:', error);
        throw error;
    }
}

async function wasi_clearSession(sessionId) {
    try {
        const client = await getMongoClient();
        if (client) {
            const db = client.db();
            const collection = db.collection('whatsapp_sessions');
            await collection.deleteOne({ _id: sessionId });
            console.log(`✅ Session ${sessionId} cleared from MongoDB`);
        }
    } catch (error) {
        console.error('❌ Error clearing session:', error);
    }
}

module.exports = {
    wasi_connectSession,
    wasi_clearSession
};
