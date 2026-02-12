const mongoose = require('mongoose');

// SCHEMA - ONLY SESSION ID
const wasi_sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now }
});

let isConnected = false;
let SessionModel = null;

// ---------------------------------------------------------------------------
// DB CONNECTION
// ---------------------------------------------------------------------------
async function wasi_connectDatabase(dbUrl) {
    const uri = dbUrl || process.env.MONGODB_URI;

    if (!uri) {
        console.error('❌ No MONGODB_URI found.');
        return false;
    }

    try {
        await mongoose.connect(uri);
        isConnected = true;
        SessionModel = mongoose.models.wasi_sessions || mongoose.model('wasi_sessions', wasi_sessionSchema);
        console.log('✅ Connected to MongoDB successfully!');
        return true;
    } catch (err) {
        console.error('❌ Failed to connect to MongoDB:', err.message);
        return false;
    }
}

// ---------------------------------------------------------------------------
// SESSION MANAGEMENT - ONLY THESE 3 FUNCTIONS
// ---------------------------------------------------------------------------
async function wasi_registerSession(sessionId) {
    if (!isConnected || !SessionModel) return false;
    try {
        await SessionModel.findOneAndUpdate(
            { sessionId },
            { sessionId },
            { upsert: true, new: true }
        );
        console.log(`✅ Session registered: ${sessionId}`);
        return true;
    } catch (e) {
        console.error('DB Error registerSession:', e);
        return false;
    }
}

async function wasi_unregisterSession(sessionId) {
    if (!isConnected || !SessionModel) return false;
    try {
        await SessionModel.findOneAndDelete({ sessionId });
        console.log(`✅ Session unregistered: ${sessionId}`);
        return true;
    } catch (e) {
        console.error('DB Error unregisterSession:', e);
        return false;
    }
}

async function wasi_getAllSessions() {
    if (!isConnected || !SessionModel) return [];
    try {
        const sessions = await SessionModel.find({});
        return sessions.map(s => s.sessionId);
    } catch (e) {
        console.error('DB Error getAllSessions:', e);
        return [];
    }
}

function wasi_isDbConnected() {
    return isConnected;
}

module.exports = {
    wasi_connectDatabase,
    wasi_isDbConnected,
    wasi_registerSession,
    wasi_unregisterSession,
    wasi_getAllSessions
};
