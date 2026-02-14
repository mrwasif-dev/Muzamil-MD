module.exports = {
    name: '!jid',
    async execute(sock, from, msg) {
        try {
            const jid = msg.key.remoteJid;
            await sock.sendMessage(from, { 
                text: `📱 JID: \`${jid}\``,
                quoted: msg 
            });
            console.log(`✅ JID sent: ${jid}`);
        } catch (error) {
            console.error('❌ JID error:', error);
        }
    }
};
