module.exports = {
    name: '!gjid',
    async execute(sock, from) {
        try {
            const groups = await sock.groupFetchAllParticipating();
            
            let response = "Janu 😁  Your Group Groups List 😌:*\n\n";
            let groupCount = 1;
            
            for (const [jid, group] of Object.entries(groups)) {
                const groupName = group.subject || "Unnamed Group";
                const participantsCount = group.participants ? group.participants.length : 0;
                
                let groupType = "Simple Group";
                if (group.isCommunity) {
                    groupType = "Community";
                } else if (group.isCommunityAnnounce) {
                    groupType = "Community Announcement";
                } else if (group.parentGroup) {
                    groupType = "Subgroup";
                }
                
                response += `${groupCount}. *${groupName}*\n`;
                response += `   👥 Members: ${participantsCount}\n`;
                response += `   🆔: \`${jid}\`\n`;
                response += `   📝 Type: ${groupType}\n`;
                response += `   ──────────────\n\n`;
                
                groupCount++;
            }
            
            if (groupCount === 1) {
                response = "❌ No groups found. You are not in any groups.";
            } else {
                response += `\n*Total Groups: ${groupCount - 1}*`;
            }
            
            await sock.sendMessage(from, { text: response });
            console.log(`GJID command executed. Sent ${groupCount - 1} groups list.`);
            
        } catch (error) {
            console.error('Error fetching groups:', error);
            await sock.sendMessage(from, { 
                text: "❌ Error fetching groups list. Please try again later." 
            });
        }
    }
};
