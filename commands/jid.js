module.exports = {
    name: '!jid',
    async execute(sock, from, msg) {
        try {
            console.log('🔍 JID command executing...');
            
            const remoteJid = msg.key.remoteJid;
            const participant = msg.key.participant || '';
            const fromMe = msg.key.fromMe ? 'Yes' : 'No';
            
            let response = `📱 *JID Information:*\n\n`;
            response += `📌 *Chat/Group:* \`${remoteJid}\`\n`;
            
            if (participant) {
                response += `👤 *Participant:* \`${participant}\`\n`;
            }
            
            response += `🔹 *From Me:* ${fromMe}\n`;
            response += `🔹 *Message ID:* \`${msg.key.id}\`\n`;
            
            if (remoteJid.endsWith('@g.us')) {
                response += `\n👥 *Type:* Group Chat\n`;
            } else if (remoteJid.endsWith('@s.whatsapp.net')) {
                response += `\n👤 *Type:* Private Chat\n`;
            } else if (remoteJid.includes('@lid')) {
                response += `\n⚠️ *Type:* LID (Linked Identity Device)\n`;
            }
            
            await sock.sendMessage(from, { text: response });
            console.log(`✅ JID response sent to ${from}`);
            
        } catch (error) {
            console.error('❌ JID command error:', error);
            await sock.sendMessage(from, { text: '❌ Error getting JID information.' });
        }
    }
};
