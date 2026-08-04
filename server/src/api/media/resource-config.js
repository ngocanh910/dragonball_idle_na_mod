// ============================================================
// Resource Config Routes — mocked game config files
// Serves clientversion.json / serversetting.json / /json/* /
// /language/* / root resource json files. The originals were
// provided by the Android native code or the real game server.
// ============================================================

const fs = require('fs');
const path = require('path');

const config = require('../../config');
const logStore = require('../../services/log-store');

function getClientVersion(req) {
  return {
    version: '1.0.0',
    resVersion: 1,
    review: false,
    debug: true,
    hotUpdateUrl: '',
    adv: false,
    serverTime: Math.floor(Date.now() / 1000),
    channelConfig: {},
    appVersion: '1.0.0',
    loginserver: `http://${req.headers.host || 'localhost:8080'}`,
    loginServer: `http://${req.headers.host || 'localhost:8080'}`,
  };
}

function getServerSetting(req) {
  const baseUrl = `http://${req.headers.host || 'localhost:8080'}`;
  return {
    code: 0,
    msg: 'success',
    openIds: [],
    loginserver: baseUrl,
    loginServer: baseUrl,
    serverUrl: baseUrl,
    socketUrl: baseUrl,
    teamServerHttpUrl: baseUrl,
    iosPurchaseUrl: '',
    androidPurchaseUrl: '',
  };
}

function register(app) {
  // ── Properties endpoints (mocked config files) ────────────

  // clientversion.json — requested by game at boot
  app.get('/resource/properties/clientversion.json', (req, res) => {
    logStore.info('[Proxy]', 'clientversion.json (mocked)');
    res.json(getClientVersion(req));
  });
  app.get('/resource/properties/clientversion.json*', (req, res) => {
    logStore.info('[Proxy]', 'clientversion.json (mocked, with query)');
    res.json(getClientVersion(req));
  });

  // serversetting.json — requested by game at boot
  app.get('/resource/properties/serversetting.json', (req, res) => {
    logStore.info('[Proxy]', 'serversetting.json (mocked)');
    res.json(getServerSetting(req));
  });
  app.get('/resource/properties/serversetting.json*', (req, res) => {
    logStore.info('[Proxy]', 'serversetting.json (mocked, with query)');
    res.json(getServerSetting(req));
  });

  // ── /json/* → decrypted_assets/game_source/resource/json/* ──
  // The game loads 434 JSON game data files from /json/ path
  app.get('/json/*', (req, res) => {
    const fileName = path.basename(req.path);
    const filePath = path.join(config.gameDataDir, fileName);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      logStore.warn('[Proxy]', `JSON not found: ${fileName}`);
      res.json({});
    }
  });

  // ── /language/* → serve language files ────────────────────
  app.get('/language/*', (req, res) => {
    const fileName = path.basename(req.path);
    const filePath = path.join(config.gameSourceDir, 'resource', fileName);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      // Try resource/ directory
      const altPath = path.join(config.gameSourceDir, 'resource', 'resource', fileName);
      if (fs.existsSync(altPath)) {
        res.sendFile(altPath);
      } else {
        logStore.info('[Proxy]', `Language file not found: ${fileName} — returning empty`);
        res.json({});
      }
    }
  });

  // ── Root resource JSON files (gameEui.json, default.*.json) ──
  const resourceDir = path.join(config.gameSourceDir, 'resource');
  app.get('/gameEui.json', (req, res) => {
    const filePath = path.join(resourceDir, 'gameEui.json');
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
    res.json({});
  });
  app.get('/default.res.json', (req, res) => {
    res.sendFile(path.join(resourceDir, 'default.res.json'));
  });
  app.get('/default.res-en.json', (req, res) => {
    res.sendFile(path.join(resourceDir, 'default.res-en.json'));
  });
  app.get('/default.thm.json', (req, res) => {
    res.sendFile(path.join(resourceDir, 'default.thm.json'));
  });

  // Catch-all for any other /resource/properties/ files
  app.get('/resource/properties/*', (req, res) => {
    logStore.info('[Proxy]', `${req.path} (mocked empty)`);
    res.json({});
  });

  // ── /assets/game direct file serving ─────────────────────
  app.use('/assets/game', (req, res, next) => {
    const filePath = path.join(config.assetsGameDir, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.type(require('./lib/mime').mimeFor(ext));
      res.sendFile(filePath);
    } else {
      next();
    }
  });
}

module.exports = { register };
