// ============================================================
// Android Native Config Endpoints
// These mimic the real game server's config endpoints.
//
// IMPORTANT: The game's LaunchActivity reads config .bin
// responses as raw BINARY bytes, then XOR-decrypts them
// with key "DragonBall" before parsing as JSON.
//
// So we XOR-encrypt the JSON payload before sending.
// ============================================================

const config = require('../config');
const logStore = require('../services/log-store');
const { xorEncrypt } = require('../utils/encryption');

// ── XOR key matching game client (LaunchActivity.feedtonight) ──
const XOR_KEY = 'DragonBall';

// ── Setting JSON payload ─────────────────────────────────────
function makeSettingPayload() {
  const baseUrl = `http://${config.host}:${config.port}`;
  return JSON.stringify({
    sdkName: '',
    versionCode: 110,
    noticeList: [],
    maintain: { status: false },
    serverList: [
      {
        sid: 'local',
        name: config.serverName,
        url: baseUrl,
        dungeonurl: baseUrl,
        chaturl: baseUrl,
        status: 'smooth',
        new: true,
        recommend: true,
        serverId: config.defaultServerId,
        offlineReason: '',
        online: true,
      },
    ],
    maxVersionCode: 110,
    minVersionCode: 1,
    updateUrl: '',
    forceUpdate: false,
    review: false,
    loginserver: baseUrl,
    loginServer: baseUrl,
  });
}

function makeSdkPayload() {
  return JSON.stringify({ version: 1, sdkConfig: {} });
}

// ── XorEncrypt payload and send as raw binary ────────────────
function sendXorEncrypted(res, payload) {
  const encrypted = xorEncrypt(payload, XOR_KEY);
  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Length', encrypted.length);
  res.send(encrypted);
}

function register(app) {
  // ── Main entry point .bin endpoints (XOR encrypted) ────────
  // Game format: {EntryPoint}/setting_{sdkName}_Android.bin
  // sdkName can be empty → setting__Android.bin, or "BS" → setting_BS_Android.bin
  // Use wildcard to match all variants
  app.get('/lzceshi/native_setting/Android/setting*Android.bin', (_req, res) => {
    logStore.info('[Config]', 'GET setting .bin (XOR encrypted)', {
      method: 'GET', path: '/lzceshi/.../setting*.bin', status: 200,
    });
    sendXorEncrypted(res, makeSettingPayload());
  });

  // Also handle the BS (Backup Server) endpoints
  app.get('/bs/db/android/setting*Android.bin', (_req, res) => {
    logStore.info('[Config]', 'GET BS setting .bin (XOR encrypted)', {
      method: 'GET', path: '/bs/.../setting*.bin', status: 200,
    });
    sendXorEncrypted(res, makeSettingPayload());
  });

  // ── SDK config .bin endpoints (XOR encrypted) ─────────────
  app.get('/lzceshi/native_setting/Android/*.bin', (_req, res) => {
    logStore.info('[Config]', 'GET SDK .bin (XOR encrypted)', {
      method: 'GET', path: _req.path, status: 200,
    });
    sendXorEncrypted(res, makeSdkPayload());
  });

  app.get('/bs/db/android/*.bin', (_req, res) => {
    logStore.info('[Config]', 'GET BS SDK .bin (XOR encrypted)', {
      method: 'GET', path: _req.path, status: 200,
    });
    sendXorEncrypted(res, makeSdkPayload());
  });

  // ── Login check (plain JSON — no encryption) ───────────────
  app.all('/lzceshi/native_setting/Android/loginchecknative', (req, res) => {
    const params = req.query;
    logStore.info('[Auth]', `loginchecknative os=${params.os || '?'} brand=${params.brand || '?'}`, {
      method: 'ALL', path: '/lzceshi/.../loginchecknative', status: 200,
    });

    res.type('text/plain').send(JSON.stringify({
      code: 0,
      msg: 'success',
      loginServer: `http://${config.host}:${config.port}`,
      serverUrl: `http://${config.host}:${config.port}`,
      socketUrl: `http://${config.host}:${config.port}`,
      teamServerHttpUrl: `http://${config.host}:${config.port}`,
    }));
  });
}

module.exports = { register };
