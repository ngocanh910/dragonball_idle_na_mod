// ============================================================
// Real Art Middleware — serve genuine assets pulled from a device
// cache (../real-art/resource). Mounted BEFORE the cdn-backfill
// and placeholder fallback so real files always win.
// ============================================================

const fs = require('fs');
const path = require('path');

const config = require('../../config');
const logStore = require('../../services/log-store');
const { isServeableExt, mimeFor } = require('./lib/mime');
const { candidates } = require('./lib/resource-candidates');

const REAL_ART_DIR = config.realArtDir;

function register(app) {
  if (!fs.existsSync(REAL_ART_DIR)) {
    logStore.warn('[RealArt]', `Directory missing, skipping: ${REAL_ART_DIR}`);
    return;
  }

  app.use('/resource', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const ext = path.extname(req.path).toLowerCase();
    if (!isServeableExt(ext)) return next();

    const relPath = decodeURIComponent(req.path.replace(/^\/+/, ''));
    for (const cand of candidates(relPath)) {
      const filePath = path.join(REAL_ART_DIR, cand);
      // Guard against path traversal outside REAL_ART_DIR
      if (!filePath.startsWith(REAL_ART_DIR)) continue;
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        logStore.info('[RealArt]', `Served: /resource/${relPath} -> ${cand}`);
        res.type(mimeFor(ext));
        return res.sendFile(filePath);
      }
    }
    next();
  });
}

module.exports = { register };
