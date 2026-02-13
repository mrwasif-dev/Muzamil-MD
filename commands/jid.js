module.exports = {
    name: '!jid',
    async execute(sock, from, msg) {
        try {
            console.log('🔍 JID command executing...');
            
            const remoteJid = msg.key.remoteJid;
            
            let response = `📱 *JID:* \`${remoteJid}\``;
            
            // یہ لائن کام کرے گی
            await sock.sendMessage(from, { 
                text: response,
                quoted: msg  // یہ ضروری ہے
            });
            
            console.log(`✅ JID response sent`);
            
        } catch (error) {
            console.error('❌ JID command error:', error);
        }
    }
};
