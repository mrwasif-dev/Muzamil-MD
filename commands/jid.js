module.exports = {
    name: '!jid',
    async execute(sock, from, msg) {
        try {
            const remoteJid = msg.key.remoteJid;
            await sock.sendMessage(from, { 
                text: `📱 *JID:* \`${remoteJid}\``,
                quoted: msg
            });
            console.log(`✅ JID response sent`);
        } catch (error) {
            console.error('❌ JID command error:', error);
        }
    }
};
