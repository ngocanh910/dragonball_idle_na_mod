// ============================================================
// Global Error Handler (must be the last middleware)
// Logs the error and answers with a game-shaped fail response.
// ============================================================

const logStore = require('../services/log-store');
const { fail } = require('../utils/response');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  logStore.error('[Server]', `Unhandled: ${err.message}`, {
    status: 500, error: err,
  });
  res.status(200).json(fail(500, err.message));
}

module.exports = errorHandler;
