module.exports = {
    name: '!jid',
    async execute(sock, from) {
        await sock.sendMessage(from, { text: `${from}` });
        console.log(`JID command executed for ${from}`);
    }
};
