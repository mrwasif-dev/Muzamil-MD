module.exports = {
    name: '!gjid',
    async execute(sock, from, msg) {
        try {
            const groups = await sock.groupFetchAllParticipating();
            const list = Object.entries(groups);
            
            if (list.length === 0) {
                await sock.sendMessage(from, { text: '❌ No groups' });
                return;
            }
            
            let response = `📌 Groups (${list.length}):\n\n`;
            list.slice(0, 10).forEach(([jid, group], i) => {
                response += `${i+1}. ${group.subject || 'Unnamed'}\n   🆔 ${jid}\n\n`;
            });
            
            await sock.sendMessage(from, { text: response });
            console.log(`✅ GJID sent: ${list.length} groups`);
        } catch (error) {
            console.error('❌ GJID error:', error);
        }
    }
};
