// ============================================================
// Game API Route
// All in-game requests hit this endpoint.
// ============================================================

const { dispatch } = require('../handlers');
const { fail } = require('../utils/response');

function register(app) {
  // Main game API
  app.post('/api', (req, res) => {
    const payload = parsePayload(req);
    const type = payload.type || 'unknown';
    const action = payload.action || 'unknown';
    console.log(`[API]  type=${type}  action=${action}`, JSON.stringify(payload).substring(0, 120));

    try {
      const result = dispatch(payload);
      res.json(result);
    } catch (err) {
      console.error(`[API]  Error: type=${type} action=${action}: ${err.message}`);
      res.json(fail(500, err.message));
    }
  });

  // Catch-all for other POST paths the game might use
  app.post('/*', (req, res) => {
    const payload = parsePayload(req);
    const type = payload.type || 'unknown';
    const action = payload.action || 'unknown';
    console.log(`[API:*] ${req.path} type=${type} action=${action}`);

    try {
      const result = dispatch(payload);
      res.json(result);
    } catch (err) {
      console.error(`[API:*] Error: ${err.message}`);
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
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }
  return raw;
}

module.exports = { register };
