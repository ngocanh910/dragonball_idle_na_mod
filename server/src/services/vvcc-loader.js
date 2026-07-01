// ============================================================
// VVCC Asset Mapping Loader
// Loads the vvcc.json mapping (obfuscated → real asset names)
// which maps logical asset paths to obfuscated file paths.
// ============================================================

const fs = require('fs');
const path = require('path');

let vvcc = null;
let vvccTc = null;

function load() {
  const vvccPath = path.resolve(__dirname, '..', '..', '..', 'decrypted_assets', 'vvcc_fixed.json');
  const vvccTcPath = path.resolve(__dirname, '..', '..', '..', 'decrypted_assets', 'vvcc_tc.json');

  if (fs.existsSync(vvccPath)) {
    try {
      vvcc = JSON.parse(fs.readFileSync(vvccPath, 'utf8'));
    } catch (e) {
      console.warn(`[VVCC] Failed to parse vvcc.json: ${e.message}`);
    }
  }

  if (fs.existsSync(vvccTcPath)) {
    try {
      vvccTc = JSON.parse(fs.readFileSync(vvccTcPath, 'utf8'));
    } catch (e) {
      console.warn(`[VVCC] Failed to parse vvcc_tc.json: ${e.message}`);
    }
  }

  console.log(`[VVCC] Loaded ${vvcc ? Object.keys(vvcc).length : 0} + ${vvccTc ? Object.keys(vvccTc).length : 0} mappings`);
}

/**
 * Look up a logical asset path and return the corresponding obfuscated path.
 * The game requests: /resource/assets/image/public/ui/xxx.png
 * vvcc key:          /image/public/ui/xxx.png
 * So we strip the /resource/assets prefix.
 *
 * Also handles language fallback: zh_cn → en → public
 */
function lookup(requestPath) {
  if (!vvcc) return null;

  // Strip /resource/assets or /assets prefix
  let key = requestPath;
  if (key.startsWith('/resource/assets')) {
    key = key.replace('/resource/assets', '');
  } else if (key.startsWith('/resource/')) {
    key = key.replace('/resource', '');
  } else if (key.startsWith('/assets/')) {
    key = key.replace('/assets', '');
  }

  // Try vvcc_tc.json first (more specific), then vvcc.json
  const directHit = lookupInMaps(key);
  if (directHit) return directHit;

  // Language fallback: zh_cn → en
  const enKey = key.replace('/zh_cn/', '/en/');
  if (enKey !== key) {
    const enHit = lookupInMaps(enKey);
    if (enHit) return enHit;
  }

  // Language fallback: zh_cn → public (for shared assets)
  const publicKey = key.replace('/zh_cn/', '/public/');
  if (publicKey !== key) {
    const publicHit = lookupInMaps(publicKey);
    if (publicHit) return publicHit;
  }

  // Try with /assets prefix (some tools expect this format)
  const altResult = lookupInMaps('/assets' + key);
  if (altResult) return altResult;

  return null;
}

function lookupInMaps(key) {
  if (vvccTc && vvccTc[key]) return vvccTc[key];
  if (vvcc && vvcc[key]) return vvcc[key];
  return null;
}

load();

module.exports = { load, lookup, getMapping: () => vvcc, getTcMapping: () => vvccTc };
