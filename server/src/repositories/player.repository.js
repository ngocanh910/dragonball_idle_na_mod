// ============================================================
// Player Repository — persisted player state (DB-backed)
// ============================================================
// Loads the default player + owned heroes into memory at boot so the
// (synchronous) enter-game / hero handlers can read them without async
// plumbing. Mutations write through to the DB and update the cache.
// ============================================================

const prisma = require('../db/prisma');

let player = null;             // cached Player row
let ownedHeroes = [];          // cached PlayerHero rows, sorted by instanceId
let ready = false;

async function init() {
  if (ready) return;
  player = await prisma.player.findFirst({ orderBy: { id: 'asc' } });
  if (!player) {
    player = await prisma.player.create({ data: { nickname: 'Player' } });
  }
  ownedHeroes = await prisma.playerHero.findMany({
    where: { playerId: player.id },
    orderBy: { instanceId: 'asc' },
  });
  ready = true;
  console.log(`[Player] Loaded player #${player.id} + ${ownedHeroes.length} heroes from DB`);
}

function getPlayer() { return player; }

/** Owned heroes: [{ displayId, instanceId, star, level, fragment }, …]. */
function getOwnedHeroes() { return ownedHeroes; }

/** Grant currency (persist + update cache). */
async function addCurrency(field, amount) {
  if (!player || !(field in player)) return;
  player = await prisma.player.update({
    where: { id: player.id },
    data: { [field]: { increment: amount } },
  });
  return player;
}

async function reload() {
  ready = false;
  player = null;
  ownedHeroes = [];
  await init();
}

module.exports = { init, getPlayer, getOwnedHeroes, addCurrency, reload, isReady: () => ready };
