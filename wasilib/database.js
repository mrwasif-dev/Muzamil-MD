const mongoose = require('mongoose');

const wasi_sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now }
});

let isConnected = false;
let SessionModel = null;

async function wasi_connectDatabase(dbUrl) {
    const uri = dbUrl || process.env.MONGODB_URI;
    if (!uri) {
        console.log('⚠️ No MongoDB URL provided');
        return false;
    }

    try {
        await mongoose.connect(uri);
        isConnected = true;
        SessionModel = mongoose.models.wasi_sessions || mongoose.model('wasi_sessions', wasi_sessionSchema);
        console.log('✅ MongoDB Connected Successfully');
        return true;
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
        return false;
    }
}

function wasi_isDbConnected() {
    return isConnected;
}

async function wasi_registerSession(sessionId) {
    if (!isConnected || !SessionModel) {
        console.log('⚠️ Cannot register session: Database not connected');
        return false;
    }
    try {
        await SessionModel.findOneAndUpdate(
            { sessionId },
            { sessionId },
            { upsert: true, new: true }
        );
        console.log(`✅ Session registered in DB: ${sessionId}`);
        return true;
    } catch (e) {
        console.error('❌ Error registering session:', e.message);
        return false;
    }
}

async function wasi_unregisterSession(sessionId) {
    if (!isConnected || !SessionModel) return false;
    try {
        await SessionModel.findOneAndDelete({ sessionId });
        console.log(`✅ Session unregistered from DB: ${sessionId}`);
        return true;
    } catch (e) {
        console.error('❌ Error unregistering session:', e.message);
        return false;
    }
}

async function wasi_getAllSessions() {
    if (!isConnected || !SessionModel) return [];
    try {
        const sessions = await SessionModel.find({});
        return sessions.map(s => s.sessionId);
    } catch (e) {
        console.error('❌ Error getting sessions:', e.message);
        return [];
    }
}

// ✅ FIXED: All functions exported properly
module.exports = {
    wasi_connectDatabase,
    wasi_isDbConnected,
    wasi_registerSession,
    wasi_unregisterSession,
    wasi_getAllSessions
};
