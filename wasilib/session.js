const { default: makeWASocket, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const { MongoClient } = require('mongodb');
const pino = require('pino');

const crypto = require('crypto');
if (!globalThis.crypto) {
    globalThis.crypto = crypto;
}

const logger = pino({ level: 'silent' });
let mongoClient = null;
let credsCollection = null;

async function getMongoDB() {
    if (!mongoClient && process.env.MONGODB_URL) {
        mongoClient = new MongoClient(process.env.MONGODB_URL);
        await mongoClient.connect();
        const db = mongoClient.db();
        credsCollection = db.collection('whatsapp_sessions');
        console.log('✅ MongoDB connected for session storage');
    }
    return credsCollection;
}

async function useMongoDBAuthState(sessionId) {
    const collection = await getMongoDB();
    
    const writeData = async (data) => {
        if (!collection) return;
        await collection.updateOne(
            { _id: sessionId },
            { $set: { data: data, updatedAt: new Date() } },
            { upsert: true }
        );
    };

    const readData = async () => {
        if (!collection) return null;
        const doc = await collection.findOne({ _id: sessionId });
        return doc ? doc.data : null;
    };

    const state = {
        creds: (await readData())?.creds || null,
        keys: (await readData())?.keys || {}
    };

    const saveCreds = async () => {
        await writeData({ creds: state.creds, keys: state.keys });
        console.log('✅ Session saved to MongoDB');
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
            console.log('✅ Existing session found in MongoDB!');
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
        const collection = await getMongoDB();
        if (collection) {
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
