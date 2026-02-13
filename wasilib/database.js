const mongoose = require('mongoose');

// Schema for session tracking
const wasi_sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now }
});

// Schema for Baileys auth data
const baileysAuthSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    creds: { type: Object, required: true },
    keys: { type: Object, required: true },
    updatedAt: { type: Date, default: Date.now }
});

let isConnected = false;
let SessionModel = null;
let AuthModel = null;

// ---------------------------------------------------------------------------
// CONNECTION MANAGEMENT
// ---------------------------------------------------------------------------
async function wasi_connectDatabase(dbUrl) {
    const uri = dbUrl || process.env.MONGODB_URL;
    if (!uri) {
        console.log('⚠️ No MongoDB URL provided');
        return false;
    }

    try {
        await mongoose.connect(uri);
        isConnected = true;
        
        // Initialize models
        SessionModel = mongoose.models.wasi_sessions || mongoose.model('wasi_sessions', wasi_sessionSchema);
        AuthModel = mongoose.models.baileys_auth || mongoose.model('baileys_auth', baileysAuthSchema);
        
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

// ---------------------------------------------------------------------------
// SESSION TRACKING
// ---------------------------------------------------------------------------
async function wasi_registerSession(sessionId) {
    if (!isConnected || !SessionModel) return false;
    try {
        await SessionModel.findOneAndUpdate(
            { sessionId },
            { sessionId, lastActive: new Date() },
            { upsert: true, new: true }
        );
        console.log(`✅ Session registered in DB: ${sessionId}`);
        return true;
    } catch (e) {
        console.error('❌ Error registering session:', e);
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
        console.error('❌ Error unregistering session:', e);
        return false;
    }
}

async function wasi_getAllSessions() {
    if (!isConnected || !SessionModel) return [];
    try {
        const sessions = await SessionModel.find({});
        return sessions.map(s => s.sessionId);
    } catch (e) {
        return [];
    }
}

// ---------------------------------------------------------------------------
// BAILEYS AUTH STORAGE (For session restore)
// ---------------------------------------------------------------------------
async function wasi_saveAuth(sessionId, creds, keys) {
    if (!isConnected || !AuthModel) return false;
    try {
        await AuthModel.findOneAndUpdate(
            { sessionId },
            { sessionId, creds, keys, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        console.log(`✅ Auth data saved for session: ${sessionId}`);
        return true;
    } catch (e) {
        console.error('❌ Error saving auth data:', e);
        return false;
    }
}

async function wasi_loadAuth(sessionId) {
    if (!isConnected || !AuthModel) return null;
    try {
        const auth = await AuthModel.findOne({ sessionId });
        if (auth) {
            console.log(`✅ Auth data loaded for session: ${sessionId}`);
            return {
                creds: auth.creds,
                keys: auth.keys
            };
        }
        console.log(`📱 No auth data found for session: ${sessionId}`);
        return null;
    } catch (e) {
        console.error('❌ Error loading auth data:', e);
        return null;
    }
}

async function wasi_deleteAuth(sessionId) {
    if (!isConnected || !AuthModel) return false;
    try {
        await AuthModel.findOneAndDelete({ sessionId });
        console.log(`✅ Auth data deleted for session: ${sessionId}`);
        return true;
    } catch (e) {
        console.error('❌ Error deleting auth data:', e);
        return false;
    }
}

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------
module.exports = {
    // Connection
    wasi_connectDatabase,
    wasi_isDbConnected,
    
    // Session tracking
    wasi_registerSession,
    wasi_unregisterSession,
    wasi_getAllSessions,
    
    // Auth storage (for session restore)
    wasi_saveAuth,
    wasi_loadAuth,
    wasi_deleteAuth
};
