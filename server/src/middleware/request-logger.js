// ============================================================
// Request Logger Middleware
// Records every HTTP request into log-store (source for the
// debug dashboard). Debug API calls are skipped to avoid noise.
// ============================================================

const logStore = require('../services/log-store');

function requestLogger(req, res, next) {
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
}

module.exports = requestLogger;
