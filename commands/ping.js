module.exports = {
    name: '!ping',
    async execute(sock, from, msg) {
        try {
            await sock.sendMessage(from, { 
                text: '🏓 Pong!',
                quoted: msg
            });
            console.log(`✅ Ping response sent`);
        } catch (error) {
            console.error('❌ Ping command error:', error);
        }
    }
};
