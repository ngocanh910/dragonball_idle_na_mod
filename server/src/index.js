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
const path = require('path');
const fs = require('fs');

const config = require('./config');
const { registerAll } = require('./routes');
const socketHandler = require('./socket');
const gameData = require('./services/game-data');
const logStore = require('./services/log-store');

// ── App Setup ────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// Socket.IO v2 — compatible with game client v2.1.0
const io = require('socket.io')(server, { origins: '*:*' });

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '50mb' }));

// ── Request logging middleware ────────────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith('/api/debug/')) return next(); // don't log debug api calls
  const start = Date.now();
  const origEnd = res.end;
  res.end = function (...args) {
    const dur = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    logStore.stats.totalRequests++;
    logStore.addLog({
      level,
      tag: '[HTTP]',
      message: `${req.method} ${req.path}`,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: dur,
    });
    origEnd.apply(this, args);
  };
  next();
});

// ── Routes ───────────────────────────────────────────────────
registerAll(app);

// ── Socket.IO ────────────────────────────────────────────────
socketHandler.register(io);

// ── Static files (game client and assets) ────────────────────
app.use('/', express.static(config.clientDir));

// Cascade mounts for /js (looks in voyage_extracted first, then game_source)
app.use('/js', express.static(path.join(config.voyageDir, 'js')));
app.use('/js', express.static(path.join(config.gameSourceDir, 'js')));

// Cascade mounts for /resource (looks in voyage_extracted first, then game_source)
app.use('/resource', express.static(path.join(config.voyageDir, 'resource')));
app.use('/resource', express.static(path.join(config.gameSourceDir, 'resource')));

if (fs.existsSync(config.assetsDir)) {
  app.use('/assets', express.static(config.assetsDir));
}

// ── Load mods ────────────────────────────────────────────────
if (config.modsEnabled) {
  try {
    require('../../mods').loadAll();
  } catch (err) {
    logStore.warn('[Mods]', `Could not load mods: ${err.message}`);
  }
}

// ── Global error handler (must be last middleware) ───────────
app.use((err, _req, res, _next) => {
  logStore.error('[Server]', `Unhandled: ${err.message}`, {
    status: 500, error: err,
  });
  const { fail } = require('./utils/response');
  res.status(200).json(fail(500, err.message));
});

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
