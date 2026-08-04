// ============================================================
// Game Data Service (compat shim)
// ============================================================
// Kept for backward compatibility: handlers/mods still
// `require('../services/game-data')`. The real implementation now lives
// in repositories/game-data.repository.js (DB-backed). init() is awaited
// once at server startup (see src/index.js).
// ============================================================

module.exports = require('../repositories/game-data.repository');
