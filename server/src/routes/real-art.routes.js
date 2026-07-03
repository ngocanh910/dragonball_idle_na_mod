// ============================================================
// Real Art — serve genuine assets pulled from a device cache
//
// The real hero/UI art is NOT in the APK; it was CDN-downloaded
// (dragonh5cdn.popoh5.com) and cached on a live install. We pulled
// that cache into ../real-art/resource, where each file's on-disk
// path already equals its logical /resource/... path.
//
// This middleware serves those real files, mounted BEFORE the
// resource-proxy fallback so real art wins over the synthetic
// placeholders (empty DragonBones json / 1x1 transparent png).
//
// Locale note: the client requests zh_cn/ paths, but the cache
// stores en/ and public/. We mirror the fallback's proven
// zh_cn -> en -> public rewrite so those requests still resolve.
// ============================================================

const fs = require('fs');
const path = require('path');
const logStore = require('../services/log-store');

const REAL_ART_DIR = path.resolve(__dirname, '..', '..', '..', 'real-art', 'resource');

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

// Build the list of on-disk candidates for a requested /resource path.
// IMPORTANT: for zh_cn requests we prefer en/ then public/ BEFORE the zh_cn
// original, so the UI stays English even when Chinese assets exist on disk.
function candidates(relPath) {
  const variants = relPath.includes('zh_cn')
    ? [
        relPath.replace('zh_cn', 'en'),
        relPath.replace('zh_cn', 'public'),
        relPath, // zh_cn original as last resort
      ]
    : [relPath];
  // DragonBones opening-animation heroes live under an extra segment
  if (relPath.endsWith('.json') && relPath.includes('dragon_animation/')) {
    const seg = 'dragon_animation/kaichangdonghua/kaichangzhandouxiangguan/';
    variants.push(
      relPath.replace('dragon_animation/', seg),
      relPath.replace('zh_cn/dragon_animation/', 'en/' + seg),
      relPath.replace('zh_cn/dragon_animation/', 'public/' + seg),
    );
  }
  // De-dup while preserving order
  return [...new Set(variants)];
}

function register(app) {
  if (!fs.existsSync(REAL_ART_DIR)) {
    logStore.warn('[RealArt]', `Directory missing, skipping: ${REAL_ART_DIR}`);
    return;
  }

  app.use('/resource', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const ext = path.extname(req.path).toLowerCase();
    if (!SERVEABLE_EXT.has(ext)) return next();

    const relPath = decodeURIComponent(req.path.replace(/^\/+/, ''));
    for (const cand of candidates(relPath)) {
      const filePath = path.join(REAL_ART_DIR, cand);
      // Guard against path traversal outside REAL_ART_DIR
      if (!filePath.startsWith(REAL_ART_DIR)) continue;
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        logStore.info('[RealArt]', `Served: /resource/${relPath} -> ${cand}`);
        res.type(MIME[ext] || 'application/octet-stream');
        return res.sendFile(filePath);
      }
    }
    next();
  });
}

module.exports = { register };
