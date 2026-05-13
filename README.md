# AutoReel Post by Bittu v3.0
## Facebook Page Reel Automation Tool

---

## 📋 Requirements (MUST INSTALL FIRST)

### 1. Node.js (REQUIRED)
- Download: https://nodejs.org
- **Install the LTS version** (v18 or v20 or v22)
- During installation, check ✅ "Add to PATH"
- After installing, **RESTART your PC**

### How to check if Node.js is already installed:
1. Open CMD (Windows Key + R → type `cmd` → Enter)
2. Type: `node -v`
3. If you see `v18.x.x` or `v20.x.x` or `v22.x.x` → ✅ Already installed
4. If you see error → ❌ Need to install

---

## 🚀 First Time Setup (New PC)

1. Extract the RAR file to any folder (Desktop, Documents, etc.)
2. Open the extracted folder
3. Double-click **`setup.bat`**
4. Wait for it to finish (2-5 minutes, needs internet)
5. Done! ✅

---

## ▶️ How to Start

1. Double-click **`start_autoreel.bat`**
2. Two terminal windows will open (keep them open!)
3. Browser will auto-open to `http://localhost:5173`
4. If browser doesn't open, manually go to: `http://localhost:5173`

---

## ⚠️ Important Rules

- **DO NOT close the terminal windows** while the tool is running
- **Keep your PC awake** — disable sleep mode for uninterrupted posting
- The tool runs **FOREVER** — only your **Facebook Token** needs renewal every 60 days from Settings.
- The tool runs on **localhost only** — no internet server needed

---

## 🔧 Troubleshooting

### "Node.js not found" error
→ Install Node.js from https://nodejs.org and RESTART PC

### "Port 5000 already in use" error
→ Close all terminal windows, wait 10 seconds, try again
→ Or run: `taskkill /f /im node.exe` in CMD, then try again

### Tool not loading in browser
→ Make sure BOTH terminal windows are open and running
→ Try: http://localhost:5173

### Posts are failing
→ Check your Facebook Access Token in Settings
→ Make sure token has `pages_manage_posts` and `pages_read_engagement` permissions
→ Tokens expire! Renew every 60 days

---

## 📁 File Structure (DO NOT DELETE)
```
AutoReel/
├── setup.bat              ← Run this ONCE on new PC
├── start_autoreel.bat     ← Run this to START the app
├── check_system.bat       ← Run this to CHECK your system
├── server.js              ← Backend (don't touch)
├── frontend/              ← UI (don't touch)
├── data/                  ← Database (auto-created)
└── node_modules/          ← Dependencies (auto-installed)
```

---

## 📝 Before Sending to Another PC

1. DELETE `data/automation.sqlite` (contains YOUR page data)
2. DELETE `node_modules/` folder (will be reinstalled by setup.bat)
3. DELETE `frontend/node_modules/` folder
4. RAR the main folder
5. Send via Telegram/USB

The student will:
1. Extract RAR
2. Double-click `setup.bat` (one-time, needs internet)
3. Double-click `start_autoreel.bat` to use

---

Made with ❤️ by Bittu
