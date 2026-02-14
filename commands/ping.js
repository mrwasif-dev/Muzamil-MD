module.exports = {
    name: '!ping',
    async execute(sock, from, msg) {
        try {
            const start = Date.now();
            await sock.sendMessage(from, { 
                text: '🏓 Pong!', 
                quoted: msg 
            });
            const end = Date.now();
            console.log(`✅ Ping: ${end - start}ms`);
        } catch (error) {
            console.error('❌ Ping error:', error);
        }
    }
};
