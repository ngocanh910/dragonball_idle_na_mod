// ============================================================
// Express App — wiring and middleware (no listening)
// ============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const { registerAll } = require('./api');
const requestLogger = require('./middleware/request-logger');
const errorHandler = require('./middleware/error-handler');
const logStore = require('./services/log-store');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json({ limit: '50mb' }));

  // Request logging (source for the debug dashboard)
  app.use(requestLogger);

  // ── Game API + media + config + debug routes ──────────────
  registerAll(app);

  // ── Static files (game client and assets) ────────────────────
  app.use('/', express.static(config.clientDir));

  // Cascade mounts for /js (voyage_extracted first, then game_source)
  app.use('/js', express.static(path.join(config.voyageDir, 'js')));
  app.use('/js', express.static(path.join(config.gameSourceDir, 'js')));

  // Cascade mounts for /resource (voyage_extracted first, then game_source)
  app.use('/resource', express.static(path.join(config.voyageDir, 'resource')));
  app.use('/resource', express.static(path.join(config.gameSourceDir, 'resource')));

  if (fs.existsSync(config.assetsDir)) {
    app.use('/assets', express.static(config.assetsDir));
  }

  // ── Global error handler (must be last) ─────────────────────
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
