// ============================================================
// Game Data Module
// Provides a clean API to query all 434 game JSON data files.
// Used by the server and by mods.
// ============================================================

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'decrypted_assets', 'game_source', 'resource', 'json');

// ── In-memory store ──────────────────────────────────────────
const cache = new Map();
let ready = false;

// ── Load all JSON files into memory ──────────────────────────

function load() {
  if (ready) return;

  if (!fs.existsSync(DATA_DIR)) {
    console.warn(`[GameData] Directory not found: ${DATA_DIR}`);
    return;
  }

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  let ok = 0;

  for (const file of files) {
    try {
      const name = path.basename(file, '.json');
      const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
      cache.set(name, JSON.parse(content));
      ok++;
    } catch (err) {
      console.warn(`[GameData] Skipped ${file}: ${err.message}`);
    }
  }

  ready = true;
  console.log(`[GameData] Loaded ${ok}/${files.length} files`);
}

// ── Query API ────────────────────────────────────────────────

/** Get a raw collection by name (e.g. 'hero', 'skill'). */
function collection(name) {
  return cache.get(name) || null;
}

/** Return all entries from a collection as an array. */
function list(name) {
  const data = cache.get(name);
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Object.values(data);
}

/** Find one entry by id. */
function find(name, id) {
  const data = cache.get(name);
  if (!data) return null;
  if (data[id] !== undefined) return data[id];
  if (Array.isArray(data)) return data.find((e) => e && (e.id === id || e.ID === id)) || null;
  return null;
}

/** Query entries with a predicate. */
function query(name, fn) {
  return list(name).filter(fn);
}

/** Return a map of collection-name → entry-count. */
function stats() {
  const result = {};
  for (const [name, data] of cache) {
    result[name] = typeof data === 'object' && !Array.isArray(data)
      ? Object.keys(data).length
      : Array.isArray(data) ? data.length : 1;
  }
  return result;
}

/** All collection names. */
function collections() {
  return Array.from(cache.keys());
}

/** Total entries across all collections. */
function totalEntries() {
  const s = stats();
  return Object.values(s).reduce((a, b) => a + b, 0);
}

// ── Init ─────────────────────────────────────────────────────

load();

module.exports = { collection, list, find, query, stats, collections, totalEntries, load };
