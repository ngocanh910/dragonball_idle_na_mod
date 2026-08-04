// ============================================================
// Gift Handler — VIP level-up rewards
// ============================================================
// The VIP panel sends `type:"gift", action:"getVipReward",
// giftId: currVipLevel - 1` to claim the reward for reaching a
// VIP level. giftId indexes vipUpgrade.json (0..17).

const { success } = require('../utils/response');
const playerState = require('../services/player-state');

async function handle(payload) {
  const { action, giftId } = payload;
  const userId = Number(payload.userId) || 1;

  if (action === 'getVipReward') {
    const state = await playerState.getOrCreate(userId);
    const level = giftId !== undefined ? Number(giftId) : playerState.getItem(state, playerState.ITEM_VIP_LEVEL) - 1;
    return success({
      vipLevel: level,
      claimed: true,
      rewards: playerState.vipRewards(level),
    });
  }

  return null;
}

module.exports = { handle };
