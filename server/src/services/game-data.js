// ============================================================
// Game Data Service
// Loads and indexes the 434 JSON game-data files so handlers
// and mods can query them without touching the filesystem.
// ============================================================

const fs = require('fs');
const path = require('path');
const config = require('../config');

// ── In-memory store ──────────────────────────────────────────
const store = new Map();   // name → parsed JSON object
let loaded = false;
let loadError = null;

// ── Loader ───────────────────────────────────────────────────

function load() {
  if (loaded) return;
  const dir = config.gameDataDir;

  if (!fs.existsSync(dir)) {
    loadError = `Game data directory not found: ${dir}`;
    console.warn(`[GameData] ${loadError}`);
    return;
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  let ok = 0;

  for (const file of files) {
    try {
      const name = path.basename(file, '.json');
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      store.set(name, JSON.parse(raw));
      ok++;
    } catch (err) {
      console.warn(`[GameData] Skipped ${file}: ${err.message}`);
    }
  }

  loaded = true;
  console.log(`[GameData] Loaded ${ok}/${files.length} files`);
}

// ── Query API ────────────────────────────────────────────────

/**
 * Return the parsed content of a named data file (e.g. 'hero', 'skill').
 */
function get(name) {
  return store.get(name) || null;
}

/**
 * Return all values from a named collection as an array.
 * If the file holds an object { id: entry, … }, returns Object.values().
 * If it already is an array, returns it as-is.
 */
function list(name) {
  const data = store.get(name);
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') return Object.values(data);
  return [];
}

/**
 * Return a single entry by id from a named collection.
 * Supports both { id: entry } and [{ id: … }] shapes.
 */
function find(name, id) {
  const data = store.get(name);
  if (!data) return null;
  if (data[id] !== undefined) return data[id];
  if (Array.isArray(data)) return data.find((e) => e && (e.id === id || e.ID === id)) || null;
  return null;
}

/**
 * Query entries with a predicate function.
 */
function query(name, predicate) {
  return list(name).filter(predicate);
}

/**
 * Return all loaded collection names.
 */
function collections() {
  return Array.from(store.keys());
}

/**
 * Total number of entries across all collections.
 */
function totalEntries() {
  let total = 0;
  for (const v of store.values()) {
    total += typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).length : Array.isArray(v) ? v.length : 1;
  }
  return total;
}

// ── Hot-reload ───────────────────────────────────────────────

function reload() {
  store.clear();
  loaded = false;
  loadError = null;
  load();
}

// ── Init ─────────────────────────────────────────────────────

load();

module.exports = { get, list, find, query, collections, totalEntries, reload };
