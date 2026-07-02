// ============================================================
// Resource Proxy — Asset fallback with VVCC mapping
//
// Serves two things that the game client needs:
//
// 1. Config files (clientversion.json, serversetting.json)
//    These were originally provided by the Android native code
//    via the JNI bridge or the original game server.
//
// 2. Obfuscated game assets (images, etc.)
//    The game requests assets by their logical path. The
//    vvcc.json mapping translates logical → obfuscated paths
//    so we can serve the actual files from assets/game/.
// ============================================================

const fs = require('fs');
const path = require('path');
const vvcc = require('../services/vvcc-loader');
const logStore = require('../services/log-store');

// ── Config ───────────────────────────────────────────────────
const ASSETS_GAME_DIR = path.resolve(__dirname, '..', '..', '..', 'assets', 'game');

// Known obfuscated root directories
const ASSET_ROOTS = [
  'resource/assets',    // vvcc.json maps here (1,944 files, e.g. absorb_sialoid/)
  'resource/assets_ts', // vvcc_tc.json maps here (139 files, e.g. dispute_everyone/)
];

// ── Mock Properties ──────────────────────────────────────────
// These config files were originally provided by the Android
// app's native code or the original game server. We mock them
// with reasonable defaults so the game client can boot.
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

// ── MIME type detection (fallback for unknown extensions) ───
function getMimeType(ext) {
  const mimeMap = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.json': 'application/json',
    '.fnt': 'application/octet-stream',
    '.txt': 'text/plain',
    '.xml': 'application/xml',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
  };
  return mimeMap[ext] || 'application/octet-stream';
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
  const gameJsonDir = path.resolve(__dirname, '..', '..', '..', 'decrypted_assets', 'game_source', 'resource', 'json');
  app.get('/json/*', (req, res) => {
    const fileName = path.basename(req.path);
    const filePath = path.join(gameJsonDir, fileName);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      logStore.warn('[Proxy]', `JSON not found: ${fileName}`);
      res.json({});
    }
  });

  // ── /language/* → serve language files ────────────────────
  const languageDir = path.resolve(__dirname, '..', '..', '..', 'decrypted_assets', 'game_source', 'resource');
  app.get('/language/*', (req, res) => {
    const fileName = path.basename(req.path);
    const filePath = path.join(languageDir, fileName);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      // Try resource/ directory
      const altPath = path.join(languageDir, 'resource', fileName);
      if (fs.existsSync(altPath)) {
        res.sendFile(altPath);
      } else {
        logStore.info('[Proxy]', `Language file not found: ${fileName} — returning empty`);
        res.json({});
      }
    }
  });

  // ── Root resource JSON files (gameEui.json, default.*.json) ──
  const resourceDir = path.resolve(__dirname, '..', '..', '..', 'decrypted_assets', 'game_source', 'resource');
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

  // ── VVCC-mapped asset serving ─────────────────────────────
  // This intercepts 404s from Express static middleware for
  // resource files and tries to serve them via vvcc mapping.
  //
  // Order: this is registered AFTER the static-file middleware,
  // so it only runs when the static middleware already returned 404.

  // Problem: Express static middleware sends 404 directly, it
  // doesn't call next(). So we need a different approach.
  // We use app.use with a specific path pattern to intercept
  // resource/* requests BEFORE the static middleware 404s.
  // But we also don't want to shadow real files.
  //
  // Solution: Try the VVCC lookup first. If it finds a file,
  // serve it. Otherwise, let Express static handle it (or 404).
  //
  // Route for /assets/game/ path
  app.use('/assets/game', (req, res, next) => {
    // Direct assets/game/ access — serve the file
    const filePath = path.join(ASSETS_GAME_DIR, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.type(getMimeType(ext));
      res.sendFile(filePath);
    } else {
      next();
    }
  });
}

// ── Fallback handler (runs after ALL middleware) ──────────────
// Handles VVCC-mapped assets and Egret RES module naming.
// Express static middleware calls next() when it can't find a
// file, so this runs for all non-resolved GET requests.
function createFallbackHandler() {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const reqPath = req.path;

    // ── Try direct VVCC lookup ────────────────────────────
    // Standard resource paths: /resource/assets/image/...
    let obfuscatedPath = vvcc.lookup(reqPath);

    // ── Try Egret RES naming convention (xxx_png → .png) ──
    // When RES module can't resolve URL, it falls back to the
    // resource KEY as the URL (e.g. "denglujiemiannew17_png")
    if (!obfuscatedPath) {
      const egretName = path.basename(reqPath);
      // Convert _ext → .ext (e.g. _png → .png, _jpg → .jpg)
      const extMatch = egretName.match(/^(.+?)_(png|jpg|jpeg|gif|json|fnt)$/);
      if (extMatch) {
        const logicalName = extMatch[1] + '.' + extMatch[2];
        // Try various vvcc path formats
        const vvccPaths = [
          '/image/public/ui/login/' + logicalName,
          '/image/en/ui/login/' + logicalName,
          '/image/zh_cn/ui/login/' + logicalName,
          '/image/public/' + logicalName,
          '/image/en/' + logicalName,
          '/image/' + logicalName,
        ];
        for (const vp of vvccPaths) {
          obfuscatedPath = vvcc.lookup(vp);
          if (obfuscatedPath) break;
        }
      }
    }

    if (obfuscatedPath) {
      const cleanPath = obfuscatedPath.startsWith('/') ? obfuscatedPath.substring(1) : obfuscatedPath;
      for (const root of ASSET_ROOTS) {
        const filePath = path.join(ASSETS_GAME_DIR, root, cleanPath);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          logStore.info('[VVCC]', `Served: ${reqPath} → ${root}/${cleanPath}`);
          res.type(getMimeType(ext));
          return res.sendFile(filePath);
        }
      }
      logStore.warn('[VVCC]', `Mapped file not found on disk: ${cleanPath}`);
    } else {
      // Return a 1×1 transparent PNG for missing images to
      // prevent the Egret renderer from crashing on 404s
      const ext = path.extname(reqPath).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext) ||
          reqPath.match(/_\w+$/) // ends with _ext (Egret RES convention)
      ) {
        logStore.info('[VVCC]', `Placeholder sent for: ${reqPath}`);
        // 1×1 transparent PNG
        const TRANSPARENT_PNG = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64'
        );
        res.type('image/png');
        return res.send(TRANSPARENT_PNG);
      }
    }

    next();
  };
}

module.exports = { register, createFallbackHandler };
