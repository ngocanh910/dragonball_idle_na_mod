// ============================================================
// Game Data Repository — static RE'd data, DB-backed
// ============================================================
// Loads every GameData row from SQLite ONCE at boot into an in-memory
// index, then serves synchronous get/list/find/query — the same API the
// old services/game-data.js exposed, so handlers/services are unchanged.
// Source of truth is now the DB (seeded from the decrypted JSON), not the
// filesystem. Call init() (async) before the server starts accepting work.
// ============================================================

const prisma = require('../db/prisma');

// collection name → { byKey: Map<key, entry>, values: entry[] }
const store = new Map();
let ready = false;

async function init() {
  if (ready) return;
  const rows = await prisma.gameData.findMany({ select: { collection: true, key: true, data: true } });
  for (const row of rows) {
    let col = store.get(row.collection);
    if (!col) { col = { byKey: new Map(), values: [] }; store.set(row.collection, col); }
    let entry;
    try { entry = JSON.parse(row.data); } catch { entry = row.data; }
    col.byKey.set(row.key, entry);
    col.values.push(entry);
  }
  ready = true;
  console.log(`[GameData] Loaded ${rows.length} entries / ${store.size} collections from DB`);
}

/** Whole collection as an object { key: entry } (mirrors the old get()). */
function get(name) {
  const col = store.get(name);
  if (!col) return null;
  const obj = {};
  for (const [k, v] of col.byKey) obj[k] = v;
  return obj;
}

/** All entries of a collection as an array. */
function list(name) {
  const col = store.get(name);
  return col ? col.values.slice() : [];
}

/** Single entry by id/key; falls back to scanning entry.id for array-shaped data. */
function find(name, id) {
  const col = store.get(name);
  if (!col) return null;
  if (col.byKey.has(String(id))) return col.byKey.get(String(id));
  if (col.byKey.has(id)) return col.byKey.get(id);
  return col.values.find((e) => e && (e.id === id || e.ID === id)) || null;
}

/** Entries matching a predicate. */
function query(name, predicate) {
  return list(name).filter(predicate);
}

function collections() {
  return Array.from(store.keys());
}

function totalEntries() {
  let total = 0;
  for (const col of store.values()) total += col.values.length;
  return total;
}

async function reload() {
  store.clear();
  ready = false;
  await init();
}

module.exports = { init, get, list, find, query, collections, totalEntries, reload, isReady: () => ready };
