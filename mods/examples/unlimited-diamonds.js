// ============================================================
// Example Mod: Unlimited Diamonds
//
// Hooks into the player handler to grant max currency.
// ============================================================

const { on } = require('../api');

const name = 'Unlimited Diamonds';
let unsub = null;

function enable() {
  unsub = on('handler:player', (_payload, response) => {
    if (response.data) {
      const data = typeof response.data === 'string'
        ? JSON.parse(response.data)
        : response.data;

      data.diamond = 999999999;
      data.gold = 999999999;
      data.stamina = 9999;

      response.data = JSON.stringify(data);
    }
    return [response];
  });
}

function disable() {
  if (unsub) {
    unsub();
    unsub = null;
  }
}

module.exports = { name, enable, disable };
