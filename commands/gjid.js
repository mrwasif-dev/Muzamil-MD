module.exports = {
    name: '!gjid',
    async execute(sock, from, msg) {
        try {
            console.log('👥 GJID command executing...');
            
            const groups = await sock.groupFetchAllParticipating();
            const groupList = Object.entries(groups);
            
            if (groupList.length === 0) {
                await sock.sendMessage(from, { text: '❌ You are not in any groups.' });
                return;
            }
            
            let response = `📌 *Groups List (${groupList.length}):*\n\n`;
            let count = 1;
            
            for (const [jid, group] of groupList) {
                const name = group.subject || 'Unnamed Group';
                const members = group.participants?.length || 0;
                
                response += `${count}. *${name}*\n`;
                response += `   👥 Members: ${members}\n`;
                response += `   🆔: \`${jid}\`\n`;
                
                if (group.isCommunity) {
                    response += `   📝 Type: Community\n`;
                } else {
                    response += `   📝 Type: Regular Group\n`;
                }
                
                response += `   ──────────────\n\n`;
                count++;
                
                if (response.length > 4000) {
                    await sock.sendMessage(from, { text: response });
                    response = '';
                }
            }
            
            if (response) {
                await sock.sendMessage(from, { text: response });
            }
            
            console.log(`✅ GJID response sent for ${groupList.length} groups`);
            
        } catch (error) {
            console.error('❌ GJID command error:', error);
            await sock.sendMessage(from, { text: '❌ Error fetching groups.' });
        }
    }
};
