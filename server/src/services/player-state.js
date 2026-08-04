// ============================================================
// Player State — DB-backed per-user state
// ============================================================
// Persisted player data (Player, PlayerHero, PlayerItem) with an
// in-memory cache for the synchronous handlers. VIP exp is stored
// as items 105/106/107 (PLAYERVIPEXP/LEVEL/EXPALL) — same scheme the
// game client reads via getItemNum().
//
// Every mutation writes through to SQLite, so progress survives
// restarts and multiple users can play independently.
// ============================================================

const prisma = require('../db/prisma');
const gameData = require('./game-data');

// Item ids (from the game client)
const ITEM_GOLD = 102;         // gold
const ITEM_DIAMOND = 101;      // diamond
const ITEM_PLAYER_LEVEL = 104; // player level
const ITEM_PLAYER_EXP = 103;   // player exp
const ITEM_VIP_EXP = 105;      // PLAYERVIPEXPERIENCEID
const ITEM_VIP_LEVEL = 106;    // PLAYERVIPLEVELID
const ITEM_VIP_EXP_ALL = 107;  // PLAYERVIPEXPALLID

const MAX_VIP_LEVEL = 18;      // vip.json / idleVipPlus go 1..18

// In-memory cache: userId → { player, heroes, items } for sync handlers.
const cache = new Map();

function vipLevelInfo(level) {
  return gameData.find('vipUpgrade', level) || null;
}

/** Highest VIP level reachable with `expAll` total VIP exp. */
function computeVipLevel(expAll) {
  let cum = 0;
  let level = 0;
  for (let l = 0; l < MAX_VIP_LEVEL; l++) {
    const need = vipLevelInfo(l) && vipLevelInfo(l).expNeeded;
    if (!need || expAll < cum + need) break;
    cum += need;
    level = l + 1;
  }
  return level;
}

/** Rewards for reaching a VIP level (vipUpgrade reward1..4). */
function vipRewards(level) {
  const info = vipLevelInfo(level);
  if (!info) return [];
  const out = [];
  for (let i = 1; i <= 4; i++) {
    const id = info['reward' + i];
    const num = info['num' + i];
    if (id && num) out.push({ _id: id, _num: num });
  }
  return out;
}

// ── Cache helpers ─────────────────────────────────────────────
function getCached(userId) {
  return cache.get(userId) || null;
}

function setCached(userId, data) {
  cache.set(userId, data);
}

// ── Read ──────────────────────────────────────────────────────
/** Load (or create) a player + owned heroes + items, cached. */
async function getOrCreate(userId) {
  const cached = getCached(userId);
  if (cached) return cached;

  let player = await prisma.player.findUnique({ where: { id: userId } });
  if (!player) {
    player = await prisma.player.create({ data: { nickname: `Player${userId}` } });
  }
  await prisma.player.update({ where: { id: player.id }, data: { lastLogin: new Date() } });

  const [heroes, items] = await Promise.all([
    prisma.playerHero.findMany({ where: { playerId: player.id }, orderBy: { instanceId: 'asc' } }),
    prisma.playerItem.findMany({ where: { playerId: player.id } }),
  ]);

  const data = { player, heroes, items: items.map((i) => ({ itemId: i.itemId, num: i.num })) };
  setCached(userId, data);
  return data;
}

/** Flatten inventory into { [itemId]: num }. */
function itemMap(state) {
  const m = {};
  for (const i of state.items) m[i.itemId] = i.num;
  return m;
}

/** Get one item's count (default 0). */
function getItem(state, itemId) {
  const i = state.items.find((x) => x.itemId === itemId);
  return i ? i.num : 0;
}

// ── Write ─────────────────────────────────────────────────────
/** Add a delta to a coin/gold item and the player's column if mapped. */
async function addItem(userId, state, itemId, delta) {
  const cur = getItem(state, itemId);
  const next = Math.max(0, cur + delta);
  await prisma.playerItem.upsert({
    where: { playerId_itemId: { playerId: userId, itemId } },
    create: { playerId: userId, itemId, num: next },
    update: { num: next },
  });
  const idx = state.items.findIndex((x) => x.itemId === itemId);
  if (idx >= 0) state.items[idx].num = next;
  else state.items.push({ itemId, num: next });

  // Mirror currencies into Player columns so direct DB reads stay sane.
  if (itemId === ITEM_DIAMOND) {
    state.player.diamonds = next;
    await prisma.player.update({ where: { id: userId }, data: { diamonds: next } });
  } else if (itemId === ITEM_GOLD) {
    state.player.coins = next;
    await prisma.player.update({ where: { id: userId }, data: { coins: next } });
  }
  return next;
}

/** Grant an absolute item total (used by VIP rewards / admin buys). */
async function setItem(userId, state, itemId, num) {
  const cur = getItem(state, itemId);
  return addItem(userId, state, itemId, num - cur);
}

/**
 * Add VIP exp (recharged diamonds × vipExpPara), advance VIP level,
 * persist items 105/106/107. Returns updated VIP state + level-up rewards.
 */
async function addVipExp(userId, state, gainExp) {
  const expAll = getItem(state, ITEM_VIP_EXP_ALL) + Math.max(0, gainExp);
  const level = computeVipLevel(expAll);
  const oldLevel = getItem(state, ITEM_VIP_LEVEL);
  const cum = cumulativeVipExp(level);
  const exp = expAll - cum;
  const leveledUp = level > oldLevel;

  await Promise.all([
    setItem(userId, state, ITEM_VIP_EXP, exp),
    setItem(userId, state, ITEM_VIP_LEVEL, level),
    setItem(userId, state, ITEM_VIP_EXP_ALL, expAll),
  ]);
  state.player.vip = level;
  await prisma.player.update({ where: { id: userId }, data: { vip: level } });

  return { level, exp, expAll, leveledUp, rewards: leveledUp ? vipRewards(level) : [] };
}

function cumulativeVipExp(level) {
  let cum = 0;
  for (let l = 0; l < level; l++) {
    const need = vipLevelInfo(l) && vipLevelInfo(l).expNeeded;
    if (!need) break;
    cum += need;
  }
  return cum;
}

/** exp gained per diamond recharged (constant.json vipExpPara). */
function vipExpPara() {
  const constant = gameData.find('constant', 1) || {};
  return constant.vipExpPara || 10;
}

/** Bulit-in currencies + VIP as { _id, _num } map for enterGame._items. */
function currencyItems(state) {
  const num = (id) => getItem(state, id);
  return {
    [ITEM_GOLD]: { _id: ITEM_GOLD, _num: num(ITEM_GOLD) },
    [ITEM_DIAMOND]: { _id: ITEM_DIAMOND, _num: num(ITEM_DIAMOND) },
    [ITEM_PLAYER_LEVEL]: { _id: ITEM_PLAYER_LEVEL, _num: num(ITEM_PLAYER_LEVEL) || 1 },
    [ITEM_PLAYER_EXP]: { _id: ITEM_PLAYER_EXP, _num: num(ITEM_PLAYER_EXP) },
    [ITEM_VIP_EXP]: { _id: ITEM_VIP_EXP, _num: num(ITEM_VIP_EXP) },
    [ITEM_VIP_LEVEL]: { _id: ITEM_VIP_LEVEL, _num: num(ITEM_VIP_LEVEL) },
    [ITEM_VIP_EXP_ALL]: { _id: ITEM_VIP_EXP_ALL, _num: num(ITEM_VIP_EXP_ALL) },
  };
}

module.exports = {
  ITEM_GOLD, ITEM_DIAMOND, ITEM_PLAYER_LEVEL, ITEM_PLAYER_EXP,
  ITEM_VIP_EXP, ITEM_VIP_LEVEL, ITEM_VIP_EXP_ALL, MAX_VIP_LEVEL,
  getOrCreate, getItem, itemMap, addItem, setItem,
  addVipExp, vipExpPara, vipRewards, currencyItems,
  computeVipLevel, cumulativeVipExp,
};
