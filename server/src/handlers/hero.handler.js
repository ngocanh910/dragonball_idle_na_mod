// ============================================================
// Hero Handler
// Roster comes from the DB (PlayerHero per user), not hardcoded.
// ============================================================

const { success } = require('../utils/response');
const gameData = require('../services/game-data');
const heroStats = require('../services/hero-stats');
const playerState = require('../services/player-state');

async function handle(payload) {
  const { action } = payload;
  const userId = Number(payload.userId) || 1;
  const state = await playerState.getOrCreate(userId);

  // Hero list — from the player's owned heroes (PlayerHero)
  if (!action || action === 'list' || action === 'getList') {
    const heroData = gameData.get('hero') || {};
    const heros = state.heroes.map((h) => ({
      ...(heroData[h.displayId] || heroData[String(h.displayId)] || {}),
      heroId: h.instanceId,
      userId,
      level: h.level,
      star: h.star,
      exp: h.fragment,
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

  // Hero image getAll — discovered hero list for the codex
  if (action === 'getAll') {
    const heros = {};
    for (const h of state.heroes) heros[h.displayId] = { _id: h.displayId, _maxLevel: 50 };
    return success({ _heros: heros });
  }

  // Hero getAttrs — instance id → display id via the player's roster.
  // getAttrsCallBack reads t._attrs[o]/t._baseAttrs[o] positionally and
  // pairs them with getHero(heros[o]) (instance id), so keys must be the
  // request index.
  if (action === 'getAttrs') {
    const heroIds = payload.heros || [];
    const byInstance = new Map(state.heroes.map((h) => [h.instanceId, h]));
    const attrs = {};
    const baseAttrs = {};
    heroIds.forEach((instanceId, i) => {
      const h = byInstance.get(Number(instanceId));
      const displayId = h ? h.displayId : instanceId;
      const s = heroStats.byDisplayId(displayId);
      const power = heroStats.powerOf(s);
      attrs[i] = {
        _hp: s.hp, _attack: s.attack, _armor: s.armor, _speed: s.speed,
        _power: power, _hit: 0, _dodge: 0, _block: 0,
        _damageReduce: 0, _armorBreak: 0, _controlResist: 0,
        _skillDamage: 0, _criticalDamage: 0, _blockEffect: 0,
        _critical: 0, _criticalResist: 0, _trueDamage: 0,
        _energy: 0, _extraArmor: 0, _hpPercent: 0,
        _armorPercent: 0, _attackPercent: 0, _speedPercent: 0,
        _orghp: s.hp, _superDamage: 0, _healPlus: 0,
        _healerPlus: 0, _damageDown: 0, _shielderPlus: 0,
        _damageUp: 0, _exp: 0,
      };
      baseAttrs[i] = {
        _level: h ? h.level : 200, _exp: 0, _power: power,
        _hp: s.hp, _attack: s.attack, _armor: s.armor, _speed: s.speed,
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
