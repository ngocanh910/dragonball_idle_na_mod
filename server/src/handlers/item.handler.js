// ============================================================
// Item / Backpack Handler
// ============================================================

const { success } = require('../utils/response');
const gameData = require('../services/game-data');

function handle(payload) {
  const { action, type } = payload;

  // Backpack / inventory
  if (!action || action === 'list' || action === 'getList' || action === 'getBag') {
    const thingsData = gameData.get('thingsID') || {};
    const items = Object.entries(thingsData).slice(0, 50).map(([id, item]) => ({
      id: parseInt(id, 10),
      count: 99,
      ...(typeof item === 'object' ? item : { name: item }),
    }));

    return success({ items, total: items.length });
  }

  // Use item
  if (action === 'use') {
    return success({ used: true, itemId: payload.itemId, effect: {} });
  }

  // Buy item
  if (action === 'buy') {
    return success({ bought: true, itemId: payload.itemId, count: payload.count || 1 });
  }

  // Sell item
  if (action === 'sell') {
    return success({ sold: true, itemId: payload.itemId, gold: 1000 });
  }

  return null;
}

module.exports = { handle };
