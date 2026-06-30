// ============================================================
// DRAGON BALL IDLE — Local Emulator Server
// ============================================================
//
// A modular Node.js server that replaces the real game backend,
// enabling local debugging and mod development.
//
// Usage:
//   npm start            # start on port 8080
//   PORT=9090 npm start  # start on custom port
//   DEBUG=true npm start # verbose logging
// ============================================================

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const { registerAll } = require('./routes');
const socketHandler = require('./socket');
const gameData = require('./services/game-data');

// ── App Setup ────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '50mb' }));

// ── Routes ───────────────────────────────────────────────────
registerAll(app);

// ── Socket.IO ────────────────────────────────────────────────
socketHandler.register(io);

// ── Static files (game assets) ───────────────────────────────
if (fs.existsSync(config.assetsDir)) {
  app.use('/assets', express.static(config.assetsDir));
}

// ── Load mods ────────────────────────────────────────────────
if (config.modsEnabled) {
  try {
    require('../../mods').loadAll();
  } catch (err) {
    console.warn(`[Mods]  Could not load mods: ${err.message}`);
  }
}

// ── Start ────────────────────────────────────────────────────
server.listen(config.port, config.host, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║     DRAGON BALL IDLE — Local Emulator Server     ║
╠══════════════════════════════════════════════════╣
║  HTTP     : http://${config.host}:${config.port}               ║
║  Socket.IO: port ${config.port}                                 ║
╠══════════════════════════════════════════════════╣
║  Endpoints                                       ║
║    GET  /lzceshi/.../setting_Android.bin         ║
║    GET  /lzceshi/.../loginchecknative            ║
║    POST /api                                     ║
╠══════════════════════════════════════════════════╣
║  Game data: ${gameData.collections().length} collections         ║
║  Entries : ${gameData.totalEntries().toLocaleString()}                       ║
║  Mods    : ${config.modsEnabled ? 'enabled' : 'disabled'}                     ║
╚══════════════════════════════════════════════════╝`);
});

module.exports = { app, server, io };
