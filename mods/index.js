// ============================================================
// Mod Loader
// Scans mods/examples/ and user-provided directories for .js files
// and loads them as active mods.
// ============================================================

const fs = require('fs');
const path = require('path');

const MODS_DIR = __dirname;
const EXAMPLES_DIR = path.join(MODS_DIR, 'examples');
const loaded = [];

/**
 * Load all mods from the examples directory.
 * The server calls this on startup when mods are enabled.
 */
function loadAll() {
  if (!fs.existsSync(EXAMPLES_DIR)) {
    console.log('[Mods]  No examples directory found, skipping');
    return [];
  }

  const files = fs.readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    try {
      const modPath = path.join(EXAMPLES_DIR, file);
      const mod = require(modPath);
      const name = mod.name || path.basename(file, '.js');

      if (typeof mod.enable === 'function') {
        mod.enable();
      }

      loaded.push({ name, file, enabled: true });
      console.log(`[Mods]  Loaded: ${name}`);
    } catch (err) {
      console.error(`[Mods]  Failed to load ${file}: ${err.message}`);
    }
  }

  console.log(`[Mods]  ${loaded.length} mod(s) active`);
  return loaded;
}

/**
 * Unload all mods (call their disable() if available).
 */
function unloadAll() {
  for (const mod of loaded) {
    try {
      const modPath = path.join(EXAMPLES_DIR, mod.file);
      const instance = require(modPath);
      if (typeof instance.disable === 'function') {
        instance.disable();
      }
    } catch {
      // ignore errors during unload
    }
  }
  loaded.length = 0;
  // Clear require cache so mods can be reloaded
  Object.keys(require.cache)
    .filter((k) => k.startsWith(EXAMPLES_DIR))
    .forEach((k) => delete require.cache[k]);
}

/**
 * Return list of loaded mods.
 */
function list() {
  return loaded.map((m) => ({ ...m }));
}

module.exports = { loadAll, unloadAll, list };
