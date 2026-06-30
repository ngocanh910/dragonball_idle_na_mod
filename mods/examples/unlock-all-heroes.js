// ============================================================
// Example Mod: Unlock All Heroes
//
// Intercepts the hero list handler to return every hero
// at max star rating.
// ============================================================

const { on } = require('../api');
const gameData = require('../../game-data');

const name = 'Unlock All Heroes';
let unsub = null;

function enable() {
  unsub = on('handler:hero', (_payload, response) => {
    if (response.data) {
      const data = typeof response.data === 'string'
        ? JSON.parse(response.data)
        : response.data;

      if (data.heros) {
        const allHeroes = gameData.list('hero');
        data.heros = allHeroes.map((h, i) => ({
          ...h,
          userId: 1001,
          level: 100,
          star: 7,
          exp: 0,
          equipment: {},
        }));
        data.total = allHeroes.length;
      }

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
