// ============================================================
// Route Aggregator
// ============================================================

const configRoutes = require('./config.routes');
const apiRoutes = require('./api.routes');

function registerAll(app) {
  configRoutes.register(app);
  apiRoutes.register(app);
}

module.exports = { registerAll };
