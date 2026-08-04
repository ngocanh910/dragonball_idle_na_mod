// ============================================================
// Resource Fallback — runs after ALL middleware
// Resolves still-missing GET/HEAD requests via the VVCC obfuscated
// mapping, language/path fallbacks, and — as a last resort — returns
// a placeholder so the Egret renderer never crashes on a 404.
// ============================================================

const fs = require('fs');
const path = require('path');

const config = require('../../config');
const vvcc = require('../../services/vvcc-loader');
const logStore = require('../../services/log-store');
const { mimeFor } = require('./lib/mime');
const { TRANSPARENT_PNG, SILENT_MP3 } = require('./lib/placeholders');

// Known obfuscated root directories under assets/game/
const ASSET_ROOTS = [
  'resource/assets',    // vvcc.json maps here (1,944 files)
  'resource/assets_ts', // vvcc_tc.json maps here (139 files)
];

// Build lookup variants: zh_cn → en → public, plus DragonBones segment.
function pathVariants(relaPath, ext) {
  const variants = [
    relaPath,
    relaPath.replace('zh_cn', 'en'),
    relaPath.replace('zh_cn', 'public'),
  ];
  if (ext === '.json') {
    const seg = 'dragon_animation/kaichangdonghua/kaichangzhandouxiangguan/';
    variants.push(
      relaPath.replace('dragon_animation/', 'dragon_animation/kaichangdonghua/kaichangzhandouxiangguan/'),
      relaPath.replace('zh_cn/dragon_animation/', 'en/dragon_animation/kaichangdonghua/kaichangzhandouxiangguan/'),
      relaPath.replace('zh_cn/dragon_animation/', 'public/dragon_animation/kaichangdonghua/kaichangzhandouxiangguan/')
    );
  }
  return variants;
}

// Try the Egret RES naming convention (xxx_png → .png) against vvcc.
function egretLookup(reqPath) {
  const egretName = path.basename(reqPath);
  const extMatch = egretName.match(/^(.+?)_(png|jpg|jpeg|gif|json|fnt)$/);
  if (!extMatch) return null;
  const logicalName = extMatch[1] + '.' + extMatch[2];
  const vvccPaths = [
    '/image/public/ui/login/' + logicalName,
    '/image/en/ui/login/' + logicalName,
    '/image/zh_cn/ui/login/' + logicalName,
    '/image/public/' + logicalName,
    '/image/en/' + logicalName,
    '/image/' + logicalName,
  ];
  for (const vp of vvccPaths) {
    const hit = vvcc.lookup(vp);
    if (hit) return hit;
  }
  return null;
}

function serveFileFromRoots(cleanPath, res) {
  for (const root of ASSET_ROOTS) {
    const filePath = path.join(config.assetsGameDir, root, cleanPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.type(mimeFor(ext));
      res.sendFile(filePath);
      return true;
    }
  }
  return false;
}

function createFallbackHandler() {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const reqPath = req.path;

    // ── Hero stand animation frames ────────────────────────
    // The RES module creates URLs from resource keys for frames
    // like "hero_stand_1201.10000". These don't exist in assets.
    if (reqPath.match(/^\/hero_stand_\d+\.\d+$/)) {
      logStore.info('[Proxy]', `Hero stand frame placeholder: ${reqPath}`);
      res.type('image/png');
      return res.send(TRANSPARENT_PNG);
    }

    // ── Try direct VVCC lookup ────────────────────────────
    let obfuscatedPath = vvcc.lookup(reqPath);

    // ── Try Egret RES naming convention (xxx_png → .png) ──
    if (!obfuscatedPath) obfuscatedPath = egretLookup(reqPath);

    if (obfuscatedPath) {
      const cleanPath = obfuscatedPath.startsWith('/') ? obfuscatedPath.substring(1) : obfuscatedPath;
      if (serveFileFromRoots(cleanPath, res)) {
        logStore.info('[VVCC]', `Served: ${reqPath} → ${cleanPath}`);
        return undefined;
      }
      logStore.warn('[VVCC]', `Mapped file not found on disk: ${cleanPath}`);
    } else {
      const ext = path.extname(reqPath).toLowerCase();

      // ── Find missing files via language/path fallback ─────
      if (['.json', '.fnt'].includes(ext)) {
        const gameResDir = path.join(config.gameSourceDir, 'resource');
        const relaPath = reqPath.replace('/resource/', '');

        for (const v of pathVariants(relaPath, ext)) {
          const filePath = path.join(gameResDir, v);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            logStore.info('[Proxy]', `Found at alternate path: ${v}`);
            return res.sendFile(filePath);
          }
        }

        // Last resort for JSON: return empty valid structure for DragonBones
        if (ext === '.json') {
          logStore.warn('[Proxy]', `JSON not found: ${reqPath} — returning empty structure`);
          if (reqPath.endsWith('_ske.json')) return res.json({ version: '5.5', compatibleVersion: '5.5', armature: [] });
          if (reqPath.endsWith('_tex.json')) return res.json({ SubTexture: [], width: 0, height: 0, name: '', imagePath: '' });
          return res.json({});
        }

        // FNT not found anywhere: send the zh_cn version anyway (static mount may 404)
        logStore.warn('[Proxy]', `FNT not found: ${reqPath} — returning empty`);
        return res.type('text/plain').send('');
      }

      // Music: try voyage assets_ts, else a silent MP3 placeholder
      if (['.mp3'].includes(ext)) {
        const musicFilePath = path.join(config.voyageDir, 'resource', 'assets_ts', 'music', path.basename(reqPath));
        if (fs.existsSync(musicFilePath) && fs.statSync(musicFilePath).isFile()) {
          logStore.info('[Proxy]', `Music served from assets_ts: ${path.basename(reqPath)}`);
          return res.sendFile(musicFilePath);
        }
        logStore.info('[Proxy]', `Silent MP3 sent for: ${path.basename(reqPath)}`);
        res.type('audio/mpeg');
        return res.send(SILENT_MP3);
      }

      // Images (and Egret RES convention names) → 1×1 transparent PNG
      if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext) ||
          reqPath.match(/_\w+$/) // ends with _ext (Egret RES convention)
      ) {
        logStore.info('[VVCC]', `Placeholder sent for: ${reqPath}`);
        res.type('image/png');
        return res.send(TRANSPARENT_PNG);
      }
    }

    next();
  };
}

module.exports = { createFallbackHandler };
