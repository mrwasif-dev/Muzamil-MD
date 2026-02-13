const { default: makeWASocket, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const { useMongoDBAuthState } = require('@whiskeysockets/baileys-mongo');
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');
const pino = require('pino');

const crypto = require('crypto');
if (!globalThis.crypto) {
    globalThis.crypto = crypto;
}

const logger = pino({ level: 'silent' });
let mongoClient = null;

async function getMongoClient() {
    if (!mongoClient && process.env.MONGODB_URL) {
        mongoClient = new MongoClient(process.env.MONGODB_URL);
        await mongoClient.connect();
        console.log('✅ MongoDB connected for auth');
    }
    return mongoClient;
}

async function wasi_connectSession(flag = false, sessionId) {
    try {
        const client = await getMongoClient();
        
        if (client && process.env.MONGODB_URL) {
            console.log(`🔍 Looking for session: ${sessionId} in MongoDB`);
            
            const db = client.db();
            const collection = db.collection('baileys_auth');
            
            const existing = await collection.findOne({ _id: sessionId });
            if (existing) {
                console.log(`✅ Existing session found, restoring...`);
            } else {
                console.log(`📱 No existing session, new QR will be generated`);
            }
            
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
                defaultQueryTimeoutMs: 60000,
                logger
            });

            wasi_sock.ev.on('creds.update', saveCreds);
            return { wasi_sock, saveCreds };
        } else {
            // Fallback to file system
            const sessionDir = path.join(__dirname, '..', 'sessions', sessionId);
            if (!fs.existsSync(sessionDir)) {
                fs.mkdirSync(sessionDir, { recursive: true });
            }

            const { state, saveCreds } = await require('@whiskeysockets/baileys').useMultiFileAuthState(sessionDir);
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
                defaultQueryTimeoutMs: 60000,
                logger
            });

            wasi_sock.ev.on('creds.update', saveCreds);
            return { wasi_sock, saveCreds };
        }
    } catch (error) {
        console.error('❌ Session connection error:', error);
        throw error;
    }
}

async function wasi_clearSession(sessionId) {
    try {
        const client = await getMongoClient();
        if (client && process.env.MONGODB_URL) {
            const db = client.db();
            const collection = db.collection('baileys_auth');
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
