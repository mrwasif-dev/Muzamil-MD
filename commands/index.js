const fs = require('fs');
const path = require('path');

const commands = new Map();

const commandFiles = fs.readdirSync(__dirname).filter(file => 
    file.endsWith('.js') && file !== 'index.js'
);

for (const file of commandFiles) {
    const command = require(`./${file}`);
    commands.set(command.name, command);
    console.log(`✅ Command: ${command.name}`);
}

module.exports = commands;
