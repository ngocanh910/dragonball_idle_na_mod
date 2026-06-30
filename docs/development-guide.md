# Development Guide

## Quick Start

```bash
# Install dependencies
cd server && npm install

# Start server
npm start

# Start with debug logging
DEBUG=true npm run dev
```

Server sẽ chạy tại `http://0.0.0.0:8080`.

## Project Structure

```
dragonball_idle_na_mod/
│
├── server/                    ★ Main server (Node.js)
│   ├── src/
│   │   ├── index.js           Entry point
│   │   ├── config/            Configuration
│   │   ├── routes/            HTTP routes
│   │   ├── handlers/          Game logic handlers
│   │   ├── socket/            WebSocket handlers
│   │   ├── services/          Services
│   │   └── utils/             Utilities
│   └── package.json
│
├── game-data/                 ★ Game data query API
├── mods/                      ★ Mod system
├── tools/                     ★ Development tools
│
├── assets/                    Original encrypted assets (for APK build)
├── decrypted_assets/          Decrypted game source
├── lib/                       Native .so (for APK build)
├── res/                       Android resources (for APK build)
├── docs/                      Documentation
│
├── AndroidManifest.xml        For APK rebuild
├── apktool.yml                Apktool config
└── debug.keystore             Debug signing key
```

## Thêm Handler Mới

1. Tạo file trong `server/src/handlers/`:

```javascript
// server/src/handlers/arena.handler.js
const { success } = require('../utils/response');

function handle(payload) {
  const { action } = payload;
  
  if (action === 'list') {
    return success({ rank: 1, score: 9999, opponents: [] });
  }
  if (action === 'battle') {
    return success({ result: 'win', reward: { gold: 5000 } });
  }
  
  return null;
}

module.exports = { handle };
```

2. Đăng ký trong `server/src/handlers/index.js`:

```javascript
const arena = require('./arena.handler');

const HANDLERS = {
  // ... existing handlers
  arena,
  pvp: arena,
};
```

## Thêm Route Mới

Tạo file trong `server/src/routes/` và đăng ký trong `index.js`:

```javascript
// server/src/routes/admin.routes.js
function register(app) {
  app.get('/admin/status', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });
}
```

## Tools

### Debug Client

Gửi request test đến server:

```bash
# Preset commands
node tools/debug-client.js login
node tools/debug-client.js "hero list"
node tools/debug-client.js "item list"

# Raw JSON
node tools/debug-client.js --raw '{"type":"arena","action":"battle"}'
```

### Data Explorer

Khám phá 434 game data files:

```bash
# List all collections
node tools/data-explorer.js list

# Show entry counts
node tools/data-explorer.js stats

# Peek at first entries
node tools/data-explorer.js show hero
node tools/data-explorer.js show skill 10

# Find by ID
node tools/data-explorer.js find hero 1
node tools/data-explorer.js find skill 101

# Full-text search
node tools/data-explorer.js search hero Goku
node tools/data-explorer.js search things Dragon

# Filter
node tools/data-explorer.js query equip rarity=5
```

### APK Build

Build mod APK (requires apktool, zipalign, apksigner):

```bash
node tools/apk-build.js build     # Build APK
node tools/apk-build.js sign      # Sign
node tools/apk-build.js install   # Install to device
node tools/apk-build.js all       # Build → sign → install
```

## Testing với Game Thật

1. **Start server:** `cd server && npm start`
2. **Install mod APK** trên điện thoại (cùng WiFi)
3. Game sẽ kết nối đến server local
4. Dùng `debug-client.js` để test API không cần game

## Luồng Xử Lý Request

```
Game App ──POST /api──→ Express ──→ api.routes.js ──→ handlers/index.js
                                                          │
                                              ┌───────────┴──────────┐
                                              ▼                      ▼
                                        Domain handler          Mod hooks
                                        (player, hero,          (intercept &
                                         item, ...)              mutate)
                                              │                      │
                                              └───────────┬──────────┘
                                                          ▼
                                                    JSON response
                                                          │
Game App ←────────────────────────────────────────────────┘
```
