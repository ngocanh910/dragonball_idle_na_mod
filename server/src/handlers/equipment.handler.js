// ============================================================
// Equipment Handler
// ============================================================

const { success } = require('../utils/response');
const gameData = require('../services/game-data');
const playerState = require('../services/player-state');

async function handle(payload) {
  const { action } = payload;
  const userId = Number(payload.userId) || 1;
  const state = await playerState.getOrCreate(userId);

  if (!action || action === 'list' || action === 'getList') {
    const equipData = gameData.get('equip') || {};
    const equips = Object.entries(equipData).slice(0, 20).map(([id, eq]) => ({
      id: parseInt(id, 10),
      level: state.player.level,
      star: 3,
      ...(typeof eq === 'object' ? eq : {}),
    }));
    return success({ equips, total: equips.length });
  }

  if (action === 'equip' || action === 'wear') {
    return success({ equipped: true, heroId: payload.heroId, equipId: payload.equipId });
  }

  if (action === 'unequip') {
    return success({ unequipped: true, equipId: payload.equipId });
  }

  if (action === 'strengthen' || action === 'upgrade') {
    return success({ success: true, newLevel: (payload.level || 0) + 1, newStar: payload.star || 3 });
  }

  return null;
}

module.exports = { handle };
