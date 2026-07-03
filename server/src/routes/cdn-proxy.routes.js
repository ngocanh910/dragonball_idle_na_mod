// ============================================================
// CDN Backfill Proxy — lazy-fetch real art from the live CDN
//
// The original asset CDN (dragonh5cdn.popoh5.com) is STILL ALIVE.
// The config server that injected its URL is dead, but the CDN
// host itself — recovered from a device cache path — still serves
// every asset listed in default.res.json.
//
// When a /resource/... asset isn't already on disk (real-art or
// bundled), this middleware fetches it from the CDN, caches it into
// real-art/resource/<path>, and serves it. Result: art fills in
// lazily as you browse, then works offline forever after.
//
// Order: mounted AFTER the local real-art middleware and BEFORE the
// resource-proxy placeholder fallback, so: local -> CDN -> placeholder.
//
// Disable with CDN_BACKFILL=false (pure-offline mode).
// ============================================================

const fs = require('fs');
const path = require('path');
const logStore = require('../services/log-store');

const CDN_BASE = process.env.CDN_BASE || 'https://dragonh5cdn.popoh5.com/bs/resource';
const REAL_ART_DIR = path.resolve(__dirname, '..', '..', '..', 'real-art', 'resource');
const FETCH_TIMEOUT_MS = 15000;

const SERVEABLE_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.json', '.fnt', '.mp3', '.ogg', '.wav',
]);

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.json': 'application/json',
  '.fnt': 'application/octet-stream', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

// In-memory negative cache: paths the CDN already 404'd, so we don't
// hammer it on every re-request for a genuinely-missing asset.
const missing = new Set();

// Same locale/segment variants the local real-art layer uses, so a
// zh_cn request can resolve against the CDN's en/ + public/ layout.
function candidates(relPath) {
  const variants = [
    relPath,
    relPath.replace('zh_cn', 'en'),
    relPath.replace('zh_cn', 'public'),
  ];
  if (relPath.endsWith('.json') && relPath.includes('dragon_animation/')) {
    const seg = 'dragon_animation/kaichangdonghua/kaichangzhandouxiangguan/';
    variants.push(
      relPath.replace('dragon_animation/', seg),
      relPath.replace('zh_cn/dragon_animation/', 'en/' + seg),
      relPath.replace('zh_cn/dragon_animation/', 'public/' + seg),
    );
  }
  return [...new Set(variants)];
}

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
  if (process.env.CDN_BACKFILL === 'false') {
    logStore.info('[CDN]', 'Backfill disabled (CDN_BACKFILL=false)');
    return;
  }

  app.use('/resource', async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const ext = path.extname(req.path).toLowerCase();
    if (!SERVEABLE_EXT.has(ext)) return next();

    const relPath = decodeURIComponent(req.path.replace(/^\/+/, ''));

    for (const cand of candidates(relPath)) {
      if (missing.has(cand)) continue;
      const buf = await fetchFromCdn(cand);
      if (buf) {
        cacheToDisk(cand, buf);
        logStore.info('[CDN]', `Backfilled: /resource/${relPath} -> ${cand} (${buf.length}B)`);
        res.type(MIME[ext] || 'application/octet-stream');
        return res.send(buf);
      }
      missing.add(cand);
    }
    next(); // CDN had nothing -> fall through to placeholder fallback
  });
}

module.exports = { register };
