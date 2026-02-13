module.exports = {
    name: '!ping',
    async execute(sock, from, msg) {
        try {
            console.log('🏓 Ping command executing...');
            
            // یہ لائن کام کرے گی
            await sock.sendMessage(from, { 
                text: '🏓 Pong!',
                quoted: msg  // یہ ضروری ہے
            });
            
            console.log(`✅ Ping response sent`);
            
        } catch (error) {
            console.error('❌ Ping command error:', error);
        }
    }
};
