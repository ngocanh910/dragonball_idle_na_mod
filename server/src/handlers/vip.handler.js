// ============================================================
// VIP Handler — player VIP status + perks
// ============================================================
// VIP state lives in the DB as items 105/106/107 (see
// services/player-state.js). Perks come from the seeded vip table.
// `type:"vip", action:"getInfo"` is provided for completeness.

const { success } = require('../utils/response');
const gameData = require('../services/game-data');
const playerState = require('../services/player-state');

async function handle(payload) {
  const { action } = payload;
  const userId = Number(payload.userId) || 1;

  // VIP info — current level, exp, and per-level perks/rewards
  if (!action || action === 'getInfo' || action === 'info') {
    const state = await playerState.getOrCreate(userId);
    const level = playerState.getItem(state, playerState.ITEM_VIP_LEVEL);
    const exp = playerState.getItem(state, playerState.ITEM_VIP_EXP);
    const expAll = playerState.getItem(state, playerState.ITEM_VIP_EXP_ALL);
    const perks = gameData.find('vip', level) || null;
    const idleBonus = gameData.find('idleVipPlus', level) || null;
    const bagPlus = gameData.find('VIPBag', level) || null;

    return success({
      level,
      exp,
      expAll,
      maxLevel: playerState.MAX_VIP_LEVEL,
      perks,
      idleBonus,
      bagPlus,
      rewards: playerState.vipRewards(level),
      buyBonus: gameData.list('vipBuyBonus'),
    });
  }

  return null;
}

module.exports = { handle };
