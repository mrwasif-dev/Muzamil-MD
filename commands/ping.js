module.exports = {
    name: '!ping',
    async execute(sock, from) {
        await sock.sendMessage(from, { text: "Love You 😘" });
        console.log(`Ping command executed for ${from}`);
    }
};
