// ============================================================
// Server — http + socket.io + listen
// ============================================================

const http = require('http');

const config = require('./config');
const { createApp } = require('./app');
const socketHandler = require('./socket');
const gameData = require('./services/game-data');
const logStore = require('./services/log-store');

// ── App Setup ────────────────────────────────────────────────
const app = createApp();
const server = http.createServer(app);

// Socket.IO v2 — compatible with game client v2.1.0
const io = require('socket.io')(server, { origins: '*:*' });
socketHandler.register(io);

// ── Load mods ────────────────────────────────────────────────
if (config.modsEnabled) {
  try {
    require('../../mods').loadAll();
  } catch (err) {
    logStore.warn('[Mods]', `Could not load mods: ${err.message}`);
  }
}

// ── Start ────────────────────────────────────────────────────
// Load the DB-backed game data into memory BEFORE accepting requests,
// so the synchronous get/list/find API is populated for handlers.
async function start() {
  await gameData.init();
  server.listen(config.port, config.host, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║     DRAGON BALL IDLE — Local Emulator Server     ║
╠══════════════════════════════════════════════════╣
║  HTTP     : http://${config.host}:${config.port}               ║
║  Socket.IO: port ${config.port}                                 ║
╠══════════════════════════════════════════════════╣
║  Storage  : SQLite (Prisma) + in-memory index    ║
║  Game data: ${gameData.collections().length} collections         ║
║  Entries : ${gameData.totalEntries().toLocaleString()}                       ║
║  Mods    : ${config.modsEnabled ? 'enabled' : 'disabled'}                     ║
╚══════════════════════════════════════════════════╝`);
  });
}

start().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});

module.exports = { app, server, io };
