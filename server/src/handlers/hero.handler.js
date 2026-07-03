// ============================================================
// Hero Handler
// ============================================================

const { success } = require('../utils/response');
const gameData = require('../services/game-data');
const heroRoster = require('../services/hero-roster');

function handle(payload) {
  const { action } = payload;

  // Hero list — locked to the renderable roster (heroes with real art)
  if (!action || action === 'list' || action === 'getList') {
    const heroData = gameData.get('hero') || {};
    const heros = heroRoster.RENDERABLE_HERO_IDS.map((displayId) => ({
      ...(heroData[displayId] || heroData[String(displayId)] || {}),
      heroId: displayId,
      userId: 1001,
      level: 50,
      star: 5,
      exp: 0,
      equipment: {},
    }));

    return success({ heros, total: heros.length });
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

  // Hero image getAll — returns discovered hero list
  if (action === 'getAll') {
    // Format expected: { _heros: { id: { _id: n, _maxLevel: n }, ... } }
    return success({ _heros: heroRoster.buildGetAllHeros() });
  }

  // Hero getAttrs — returns attrs for the sent hero ID list
  if (action === 'getAttrs') {
    // getAttrsCallBack expects t._attrs and t._baseAttrs per hero
    const heroIds = payload.heros || [];
    const attrs = {};
    const baseAttrs = {};
    heroIds.forEach((hid, i) => {
      attrs[i] = {
        _hp: 1000, _attack: 50, _armor: 25, _speed: 10,
        _power: 100, _hit: 0, _dodge: 0, _block: 0,
        _damageReduce: 0, _armorBreak: 0, _controlResist: 0,
        _skillDamage: 0, _criticalDamage: 0, _blockEffect: 0,
        _critical: 0, _criticalResist: 0, _trueDamage: 0,
        _energy: 0, _extraArmor: 0, _hpPercent: 0,
        _armorPercent: 0, _attackPercent: 0, _speedPercent: 0,
        _orghp: 0, _superDamage: 0, _healPlus: 0,
        _healerPlus: 0, _damageDown: 0, _shielderPlus: 0,
        _damageUp: 0, _exp: 0,
      };
      baseAttrs[i] = {
        _level: 1, _exp: 0, _power: 100,
        _hp: 1000, _attack: 50, _armor: 25, _speed: 10,
      };
    });
    return success({ _attrs: attrs, _baseAttrs: baseAttrs });
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
