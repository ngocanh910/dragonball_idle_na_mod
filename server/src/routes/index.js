// ============================================================
// Route Aggregator
// ============================================================

const configRoutes = require('./config.routes');
const apiRoutes = require('./api.routes');
const debugRoutes = require('./debug.routes');

function registerAll(app) {
  debugRoutes.register(app);   // /debug + /api/debug/*
  configRoutes.register(app);
  apiRoutes.register(app);
}

module.exports = { registerAll };
