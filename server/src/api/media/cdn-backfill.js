// ============================================================
// CDN Backfill Middleware — lazy-fetch real art from the live CDN
//
// When a /resource/... asset isn't already on disk (real-art or
// bundled), fetch it from the CDN, cache it into real-art/resource/
// and serve it. Order: real-art → CDN → placeholder fallback.
//
// Disable with CDN_BACKFILL=false (pure-offline mode).
// ============================================================

const fs = require('fs');
const path = require('path');

const config = require('../../config');
const logStore = require('../../services/log-store');
const { isServeableExt, mimeFor } = require('./lib/mime');
const { candidates } = require('./lib/resource-candidates');

const CDN_BASE = config.cdnBase;
const REAL_ART_DIR = config.realArtDir;
const FETCH_TIMEOUT_MS = 15000;

// In-memory negative cache: paths the CDN already 404'd, so we don't
// hammer it on every re-request for a genuinely-missing asset.
const missing = new Set();

async function fetchFromCdn(cand) {
  const url = `${CDN_BASE}/${cand}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    return buf.length ? buf : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function cacheToDisk(cand, buf) {
  const dest = path.join(REAL_ART_DIR, cand);
  if (!dest.startsWith(REAL_ART_DIR)) return; // traversal guard
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
  } catch (e) {
    logStore.warn('[CDN]', `cache write failed for ${cand}: ${e.message}`);
  }
}

function register(app) {
  if (!config.cdnBackfill) {
    logStore.info('[CDN]', 'Backfill disabled (CDN_BACKFILL=false)');
    return;
  }

  app.use('/resource', async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const ext = path.extname(req.path).toLowerCase();
    if (!isServeableExt(ext)) return next();

    const relPath = decodeURIComponent(req.path.replace(/^\/+/, ''));

    for (const cand of candidates(relPath)) {
      if (missing.has(cand)) continue;
      const buf = await fetchFromCdn(cand);
      if (buf) {
        cacheToDisk(cand, buf);
        logStore.info('[CDN]', `Backfilled: /resource/${relPath} -> ${cand} (${buf.length}B)`);
        res.type(mimeFor(ext));
        return res.send(buf);
      }
      missing.add(cand);
    }
    next(); // CDN had nothing -> fall through to placeholder fallback
  });
}

module.exports = { register };
