// ============================================================
// Recharge Handler (top-up / gem purchase)
// ============================================================
// The client's recharge() sends `type:"recharge",action:"recharge"`
// as a "create prepay order" request, then hands the response's
// `prePayRet.data` to `ts.payToSdk()` — which calls `window.paySdk`
// (defined in client/browser-boot.js) to grant the diamond amount.
//
// This handler persists the diamond grant and the VIP exp earned
// (diamond × vipExpPara) to the DB, and returns the VIP state in
// `prePayRet.data` so browser-boot grants items 105/106/107 to the
// client's ItemsCommonSingleton.
// ============================================================

const { success } = require('../utils/response');
const gameData = require('../services/game-data');
const playerState = require('../services/player-state');

async function handle(payload) {
  const { action, goodsId } = payload;
  const userId = Number(payload.userId) || 1;

  if (action === 'recharge') {
    const state = await playerState.getOrCreate(userId);
    const pkg = gameData.find('recharge', goodsId) || {};
    const diamond = (pkg.diamond || 0) + (pkg.fristPresent || pkg.normalPresent || 0);

    // Persist diamond grant + VIP exp (diamond × vipExpPara).
    await playerState.addItem(userId, state, playerState.ITEM_DIAMOND, diamond);
    const vipResult = await playerState.addVipExp(userId, state, diamond * playerState.vipExpPara());

    return success({
      prePayRet: {
        errorCode: 0,
        data: {
          diamond,
          // VIP state delta — consumed by browser-boot to grant items
          // 105/106/107 and to pop the level-up rewards if any.
          vip: {
            level: vipResult.level,
            exp: vipResult.exp,
            expAll: vipResult.expAll,
            leveledUp: vipResult.leveledUp,
            rewards: vipResult.rewards,
          },
        },
      },
    });
  }

  return success({});
}

module.exports = { handle };
