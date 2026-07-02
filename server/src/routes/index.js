// ============================================================
// Route Aggregator
// ============================================================

const configRoutes = require('./config.routes');
const apiRoutes = require('./api.routes');
const debugRoutes = require('./debug.routes');
const resourceProxy = require('./resource-proxy.routes');

function registerAll(app) {
  debugRoutes.register(app);       // /debug + /api/debug/*
  resourceProxy.register(app);     // resource proxy (mock configs + VVCC assets)
  configRoutes.register(app);      // native config endpoints
  apiRoutes.register(app);         // game API

  // Fallback: VVCC asset mapping (catches 404s from static middleware)
  app.use(resourceProxy.createFallbackHandler());
}

module.exports = { registerAll };
