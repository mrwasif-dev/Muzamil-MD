
# 🤖 Muzamil-MD WhatsApp Bot

<p align="center">
  <img src="https://i.ibb.co/d6bLQ7y/whatsapp-logo.png" alt="Muzamil-MD Logo" width="200"/>
</p>

<p align="center">
  <strong>Advanced WhatsApp Auto Forward Bot with Multi-Device Support</strong>
</p>

<p align="center">
  <a href="https://heroku.com/deploy?template=https://github.com/mrwasif-dev/Muzamil-MD">
    <img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku" width="200"/>
  </a>
</p>

<p align="center">
  <a href="https://github.com/mrwasif-dev/Muzamil-MD/stargazers">
    <img src="https://img.shields.io/github/stars/mrwasif-dev/Muzamil-MD?style=social" alt="GitHub stars"/>
  </a>
  <a href="https://github.com/mrwasif-dev/Muzamil-MD/forks">
    <img src="https://img.shields.io/github/forks/mrwasif-dev/Muzamil-MD?style=social" alt="GitHub forks"/>
  </a>
  <a href="https://github.com/mrwasif-dev/Muzamil-MD/issues">
    <img src="https://img.shields.io/github/issues/mrwasif-dev/Muzamil-MD" alt="GitHub issues"/>
  </a>
  <a href="https://github.com/mrwasif-dev/Muzamil-MD/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/mrwasif-dev/Muzamil-MD" alt="License"/>
  </a>
</p>

---

## ✨ Features

- 📱 **Multi-Device Support** - Works with WhatsApp Multi-Device
- 🔄 **Auto Forward** - Automatically forward media & emoji messages
- 🧹 **Message Cleaning** - Removes forwarded labels & newsletter markers
- ✂️ **Caption Replace** - Replace text in captions using regex
- 🤖 **Bot Commands** - !ping, !jid, !gjid commands
- 🖥️ **Web Dashboard** - QR scan & status monitoring
- 💾 **Session Management** - Persistent sessions with MongoDB
- 🚀 **Heroku Ready** - One-click deploy to Heroku

---

## 🚀 One-Click Deploy to Heroku

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/mrwasif-dev/Muzamil-MD)

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SESSION_ID` | Unique session ID | `muzamil_bot` |
| `SOURCE_JIDS` | JIDs to forward FROM | `1234567890@s.whatsapp.net,0987654321@g.us` |
| `TARGET_JIDS` | JIDs to forward TO | `1111111111@g.us,2222222222@g.us` |

### Optional Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URL` | MongoDB connection URL | `mongodb+srv://user:pass@cluster.mongodb.net` |
| `OLD_TEXT_REGEX` | Regex patterns to replace | `oldtext,anotherpattern` |
| `NEW_TEXT` | Replacement text | `new text here` |
| `PORT` | Server port | `3000` |

---

## 📦 Manual Installation

```bash
# Clone repository
git clone https://github.com/mrwasif-dev/Muzamil-MD.git
cd Muzamil-MD

# Install dependencies
npm install

# Create .env file
echo "SESSION_ID=your_session_id" > .env
echo "SOURCE_JIDS=jid1,jid2" >> .env
echo "TARGET_JIDS=jid3,jid4" >> .env

# Start bot
npm start
```

---

🎯 Bot Commands

Command Description
!ping Check bot response
!jid Get current chat JID
!gjid List all groups with details

---

🧹 Auto Forward Features

· ✅ Media Only - Only forwards images, videos, audio, documents, stickers
· ✅ Emoji Only - Forwards messages containing only emojis
· ✅ Clean Forwarding - Removes "Forwarded" label automatically
· ✅ Newsletter Cleanup - Removes newsletter/broadcast markers
· ✅ Caption Replace - Replace text in media captions

---

📁 Project Structure

```
Muzamil-MD/
├── index.js              # Main application
├── package.json          # Dependencies
├── Procfile             # Heroku process
├── .node-version        # Node version
├── app.json             # Heroku deploy config
├── commands/            # Bot commands
│   ├── index.js
│   ├── ping.js
│   ├── jid.js
│   └── gjid.js
├── wasilib/             # Core libraries
│   ├── session.js       # WhatsApp session
│   └── database.js      # MongoDB connection
└── public/              # Web dashboard
    └── index.html
```

---

⚠️ Important Notes

· 🔒 Never share your SESSION_ID or MONGODB_URL
· 📱 Scan QR from WhatsApp > Linked Devices
· 🔄 Session persists - No need to scan again
· 🆘 Report issues on GitHub

---

📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

🙏 Credits

· @whiskeysockets/baileys
· Heroku
· MongoDB

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/mrwasif-dev">mrwasif-dev</a>
</p>
