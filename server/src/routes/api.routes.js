// ============================================================
// Game API Route
// All in-game requests hit this endpoint.
// ============================================================

const { dispatch } = require('../handlers');
const { fail } = require('../utils/response');
const logStore = require('../services/log-store');

function register(app) {
  // Main game API
  app.post('/api', (req, res) => {
    const start = Date.now();
    const payload = parsePayload(req);
    const type = payload.type || 'unknown';
    const action = payload.action || 'unknown';

    try {
      const result = dispatch(payload);
      const dur = Date.now() - start;
      logStore.info('[API]', `${type}.${action}`, {
        method: 'POST', path: '/api', status: 200, duration: dur,
      });
      res.json(result);
    } catch (err) {
      const dur = Date.now() - start;
      logStore.error('[API]', `${type}.${action} — ${err.message}`, {
        method: 'POST', path: '/api', status: 500, duration: dur, error: err,
      });
      res.json(fail(500, err.message));
    }
  });

  // Catch-all for other POST paths the game might use
  app.post('/*', (req, res) => {
    const start = Date.now();
    const payload = parsePayload(req);
    const type = payload.type || 'unknown';
    const action = payload.action || 'unknown';

    try {
      const result = dispatch(payload);
      const dur = Date.now() - start;
      logStore.info('[API:*]', `${type}.${action}`, {
        method: 'POST', path: req.path, status: 200, duration: dur,
      });
      res.json(result);
    } catch (err) {
      const dur = Date.now() - start;
      logStore.error('[API:*]', `${type}.${action} — ${err.message}`, {
        method: 'POST', path: req.path, status: 500, duration: dur, error: err,
      });
      res.json(fail(500, err.message));
    }
  });
}

/**
 * Parse the request body which the game sends as form-urlencoded
 * with a "data={...}" field, or straight JSON.
 */
function parsePayload(req) {
  const raw = req.body.data || req.body;
  let payload;
  if (typeof raw === 'string') {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { raw };
    }
  } else {
    payload = raw;
  }
  // Inject the browser-facing host so handlers generate reachable URLs
  if (payload && typeof payload === 'object' && req.headers.host) {
    payload._clientHost = req.headers.host;
  }
  return payload;
}

module.exports = { register };
