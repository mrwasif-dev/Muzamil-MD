module.exports = {
    name: '!gjid',
    async execute(sock, from, msg) {
        try {
            const groups = await sock.groupFetchAllParticipating();
            const groupList = Object.entries(groups);
            
            if (groupList.length === 0) {
                await sock.sendMessage(from, { text: '❌ No groups found.' });
                return;
            }
            
            let response = `📌 *Groups List (${groupList.length}):*\n\n`;
            let count = 1;
            
            for (const [jid, group] of groupList.slice(0, 10)) {
                response += `${count}. *${group.subject || 'Unnamed'}*\n`;
                response += `   🆔: \`${jid}\`\n\n`;
                count++;
            }
            
            await sock.sendMessage(from, { text: response });
            console.log(`✅ GJID response sent`);
        } catch (error) {
            console.error('❌ GJID command error:', error);
        }
    }
};
