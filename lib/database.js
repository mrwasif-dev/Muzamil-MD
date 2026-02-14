const mongoose = require('mongoose');

const authSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    creds: { type: Object, required: true },
    keys: { type: Object, required: true },
    updatedAt: { type: Date, default: Date.now }
});

let isConnected = false;
let AuthModel = null;

const muzamil_connectDatabase = async (dbUrl) => {
    const uri = dbUrl || process.env.MONGODB_URL;
    if (!uri) {
        console.log('⚠️ No MongoDB URL provided');
        return false;
    }

    try {
        await mongoose.connect(uri);
        isConnected = true;
        AuthModel = mongoose.models.muzamil_auth || mongoose.model('muzamil_auth', authSchema);
        console.log('✅ MongoDB Connected');
        return true;
    } catch (err) {
        console.error('❌ MongoDB Error:', err.message);
        return false;
    }
};

const muzamil_isDbConnected = () => isConnected;

const muzamil_saveAuth = async (sessionId, creds, keys) => {
    if (!isConnected || !AuthModel) return false;
    try {
        await AuthModel.findOneAndUpdate(
            { sessionId },
            { sessionId, creds, keys, updatedAt: new Date() },
            { upsert: true }
        );
        console.log(`✅ Auth saved: ${sessionId}`);
        return true;
    } catch (e) {
        console.error('❌ Save error:', e.message);
        return false;
    }
};

const muzamil_loadAuth = async (sessionId) => {
    if (!isConnected || !AuthModel) return null;
    try {
        const auth = await AuthModel.findOne({ sessionId });
        if (auth) {
            console.log(`✅ Auth loaded: ${sessionId}`);
            return { creds: auth.creds, keys: auth.keys };
        }
        console.log(`📱 No auth found: ${sessionId}`);
        return null;
    } catch (e) {
        console.error('❌ Load error:', e.message);
        return null;
    }
};

const muzamil_deleteAuth = async (sessionId) => {
    if (!isConnected || !AuthModel) return false;
    try {
        await AuthModel.findOneAndDelete({ sessionId });
        console.log(`✅ Auth deleted: ${sessionId}`);
        return true;
    } catch (e) {
        console.error('❌ Delete error:', e.message);
        return false;
    }
};

module.exports = {
    muzamil_connectDatabase,
    muzamil_isDbConnected,
    muzamil_saveAuth,
    muzamil_loadAuth,
    muzamil_deleteAuth
};
