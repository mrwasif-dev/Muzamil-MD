const mongoose = require('mongoose');

let isConnected = false;

async function wasi_connectDatabase(dbUrl) {
    const uri = dbUrl || process.env.MONGODB_URL;
    if (!uri) {
        console.log('⚠️ No MongoDB URL provided');
        return false;
    }

    try {
        await mongoose.connect(uri);
        isConnected = true;
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

module.exports = {
    wasi_connectDatabase,
    wasi_isDbConnected
};
