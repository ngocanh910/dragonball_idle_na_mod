// ============================================================
// Hero Handler
// ============================================================

const { success } = require('../utils/response');
const gameData = require('../services/game-data');

function handle(payload) {
  const { action } = payload;

  // Hero list
  if (!action || action === 'list' || action === 'getList') {
    const heroData = gameData.get('hero') || {};
    const heros = Object.values(heroData).slice(0, 20).map((h, i) => ({
      ...h,
      userId: 1001,
      level: 50,
      star: 5,
      exp: 0,
      equipment: {},
    }));

    return success({ heros, total: Object.keys(heroData).length });
  }

  // Hero detail
  if (action === 'detail' || action === 'info') {
    const hero = gameData.find('hero', payload.heroId || payload.id);
    return success({ hero: hero || null });
  }

  // Evolve / upgrade
  if (action === 'evolve' || action === 'upgrade') {
    return success({
      success: true,
      newLevel: (payload.currentLevel || 1) + 1,
      newStar: payload.currentStar || 5,
    });
  }

  // Summon / gacha
  if (action === 'summon' || action === 'gacha') {
    return success({
      heroId: 1,
      heroName: 'Goku',
      rarity: 5,
      isNew: true,
    });
  }

  return null;
}

module.exports = { handle };
