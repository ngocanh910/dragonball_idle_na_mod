// ============================================================
// Item / Backpack Handler
// Inventory lives in PlayerItem (DB) keyed by item id. `admin`
// accounts can buy any item free; normal accounts pay diamonds.
// ============================================================

const { success } = require('../utils/response');
const gameData = require('../services/game-data');
const playerState = require('../services/player-state');

async function handle(payload) {
  const { action, type } = payload;
  const userId = Number(payload.userId) || 1;
  const state = await playerState.getOrCreate(userId);
  const isAdmin = state.player.admin;

  // ── Backpack / inventory ──────────────────────────────────
  if (!action || action === 'list' || action === 'getList' || action === 'getBag') {
    const thingsData = gameData.get('thingsID') || {};
    const counts = playerState.itemMap(state);
    const items = Object.keys(thingsData).slice(0, 200).map((id) => {
      const itemId = parseInt(id, 10);
      const meta = thingsData[id];
      return {
        id: itemId,
        count: counts[itemId] || 0,
        ...(typeof meta === 'object' ? meta : { name: meta }),
      };
    });
    return success({ items, total: items.length });
  }

  // ── Use item (deduct one) ─────────────────────────────────
  if (action === 'use') {
    const itemId = Number(payload.itemId);
    const have = playerState.getItem(state, itemId);
    if (have <= 0) return success({ used: false, itemId, reason: 'not_enough' });
    await playerState.addItem(userId, state, itemId, -1);
    return success({ used: true, itemId, effect: {} });
  }

  // ── Buy item ──────────────────────────────────────────────
  if (action === 'buy') {
    const itemId = Number(payload.itemId || payload.goodId);
    const count = Number(payload.count || 1);
    if (!itemId) return success({ bought: false, reason: 'no_item' });

    // Special account: buy any item free.
    if (isAdmin) {
      await playerState.addItem(userId, state, itemId, count);
      return success({ bought: true, itemId, count, free: true });
    }

    // Normal account: pay diamonds (1/item default).
    const cost = count;
    const diamond = playerState.getItem(state, playerState.ITEM_DIAMOND);
    if (diamond < cost) return success({ bought: false, reason: 'no_diamond' });
    await playerState.addItem(userId, state, playerState.ITEM_DIAMOND, -cost);
    await playerState.addItem(userId, state, itemId, count);
    return success({ bought: true, itemId, count, cost });
  }

  // ── Sell item ─────────────────────────────────────────────
  if (action === 'sell') {
    const itemId = Number(payload.itemId);
    const count = Number(payload.count || 1);
    const have = playerState.getItem(state, itemId);
    const sold = Math.min(have, count);
    await playerState.addItem(userId, state, itemId, -sold);
    const gold = sold * 1000;
    await playerState.addItem(userId, state, playerState.ITEM_GOLD, gold);
    return success({ sold: true, itemId, count: sold, gold });
  }

  return null;
}

module.exports = { handle };
