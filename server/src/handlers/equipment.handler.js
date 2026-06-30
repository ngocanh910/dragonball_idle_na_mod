// ============================================================
// Equipment Handler
// ============================================================

const { success } = require('../utils/response');
const gameData = require('../services/game-data');

function handle(payload) {
  const { action } = payload;

  if (!action || action === 'list' || action === 'getList') {
    const equipData = gameData.get('equip') || {};
    const equips = Object.entries(equipData).slice(0, 20).map(([id, eq]) => ({
      id: parseInt(id, 10),
      level: 50,
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
