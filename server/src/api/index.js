// ============================================================
// Route Aggregator
// ============================================================

const nativeConfig = require('./native-config.routes');
const gameApi = require('./game.routes');
const debugRoutes = require('./debug.routes');
const media = require('./media');

function registerAll(app) {
  debugRoutes.register(app);     // /debug + /api/debug/*
  media.registerAll(app);        // config files, real art, CDN backfill
  nativeConfig.register(app);    // native config endpoints (.bin, logincheck)
  gameApi.register(app);         // game API

  // Fallback: VVCC asset mapping (catches 404s from static middleware)
  app.use(media.createFallbackHandler());
}

module.exports = { registerAll };
