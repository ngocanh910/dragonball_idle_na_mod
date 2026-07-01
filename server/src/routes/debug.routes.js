// ============================================================
// Debug Dashboard — API routes + HTML page
// ============================================================

const logStore = require('../services/log-store');
const gameData = require('../services/game-data');
const { getDashboardHtml } = require('./debug-page');

function register(app) {
  // ── Dashboard HTML page ────────────────────────
  app.get('/debug', (_req, res) => {
    res.type('html').send(getDashboardHtml());
  });

  // Redirect bare / to /debug
  app.get('/', (_req, res) => {
    res.redirect(302, '/debug');
  });

  // ── API: All-in-one (status + logs) ─────────────
  app.get('/api/debug/all', (_req, res) => {
    const modsLoaded = [];
    try {
      const mods = require('../../../mods');
      const list = mods.list ? mods.list() : [];
      list.forEach((m) => modsLoaded.push(m.name || m.file));
    } catch {}

    res.json({
      status: {
        port: process.env.PORT || 8080,
        host: process.env.HOST || '0.0.0.0',
        node: process.version,
        pid: process.pid,
        modsEnabled: process.env.MODS_ENABLED !== 'false',
        modsLoaded: modsLoaded,
        gameDataCollections: gameData.collections ? gameData.collections().length : 0,
        gameDataEntries: gameData.totalEntries ? gameData.totalEntries() : 0,
      },
      stats: logStore.getStats(),
      logs: logStore.getRecent(100),
    });
  });

  // ── API: Errors only ───────────────────────────
  app.get('/api/debug/errors', (_req, res) => {
    res.json({ errors: logStore.getErrors() });
  });

  // ── API: Reset logs/stats ──────────────────────
  app.post('/api/debug/reset', (_req, res) => {
    logStore.reset();
    res.json({ ok: true, message: 'Logs and stats reset' });
  });
}

module.exports = { register };
