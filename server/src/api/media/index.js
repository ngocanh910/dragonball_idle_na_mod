// ============================================================
// Media Layer — static/asset serving for the game client
// Ordered so real files win: local config → real-art → CDN
// backfill → placeholder fallback.
// ============================================================

const realArt = require('./real-art');
const cdnBackfill = require('./cdn-backfill');
const resourceConfig = require('./resource-config');
const { createFallbackHandler } = require('./resource-fallback');

function registerAll(app) {
  // Mocked config files (clientversion.json, /json/*, /language/* …)
  resourceConfig.register(app);
  // Genuine art pulled from a device cache
  realArt.register(app);
  // Lazy-fetch still-missing art from the live CDN
  cdnBackfill.register(app);
}

module.exports = { registerAll, createFallbackHandler };
