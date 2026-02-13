module.exports = {
    name: '!ping',
    async execute(sock, from, msg) {
        try {
            console.log('🏓 Ping command executing...');
            const start = Date.now();
            
            await sock.sendMessage(from, { text: 'Janu👁️!' });
            
            const end = Date.now();
            const responseTime = end - start;
            
            console.log(`🥳 Love 😘 You 😁${responseTime}ms Time😌`);
        } catch (error) {
            console.error('❌ Ping command error:', error);
            await sock.sendMessage(from, { text: '❌ Error in ping command.' });
        }
    }
};
