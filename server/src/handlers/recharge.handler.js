// ============================================================
// Recharge Handler (top-up / gem purchase)
// ============================================================
// The client's recharge() sends `type:"recharge",action:"recharge"`
// as a "create prepay order" request, then hands the response's
// `prePayRet.data` to `ts.payToSdk()` — which calls `window.paySdk`
// (a native Android JS-bridge object in the real APK; undefined in
// the browser). The ACTUAL reward-granting flow is a separate
// server-pushed `Notify` socket event with `action:"payFinish"` that
// the real backend sends only after verifying payment with a payment
// provider (Google Play Billing) out-of-band — a round trip this
// emulator has no equivalent for.
//
// Since this is a single-player local emulator with no real payment
// gateway, we skip the verification round trip entirely: this
// handler returns the real `recharge.json` diamond amount (base +
// first-purchase bonus, matching what the client purchase UI already
// advertises) in `prePayRet.data`, and `client/browser-boot.js`
// defines `window.paySdk` to grant it immediately by calling
// `ts.notifyData()` itself — the same call path the real payFinish
// push would trigger, just synthesized client-side instead of
// waiting on a payment provider that doesn't exist here.

const { success } = require('../utils/response');
const gameData = require('../services/game-data');

function handle(payload) {
  const { action, goodsId } = payload;

  if (action === 'recharge') {
    const pkg = gameData.find('recharge', goodsId) || {};
    const diamond = (pkg.diamond || 0) + (pkg.fristPresent || pkg.normalPresent || 0);

    return success({
      prePayRet: {
        errorCode: 0,
        data: { diamond },
      },
    });
  }

  return success({});
}

module.exports = { handle };
