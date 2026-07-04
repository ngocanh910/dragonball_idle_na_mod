// ============================================================
// Hero Roster — single source of truth
// ============================================================
// Every collectible hero (the heroBook / codex list) is now OWNED —
// real art for all of them is available (bundled + device-cache +
// live-CDN backfill), so the old "renderable-only" lock is lifted.
//
// - Owned set  = all heroBook heroes (buildHerosMap / getAll / list)
// - Battle team = a small, known-good subset (instanceIds) so the
//   starting formation and home/battle scene stay stable.
// ============================================================

const path = require('path');
const heroStats = require('./hero-stats');
const heroBook = require(
  path.resolve(__dirname, '..', '..', '..', 'decrypted_assets', 'game_source', 'resource', 'json', 'heroBook.json')
);

// Heroes placed in the starting battle team (formation has limited
// slots; these four have long-verified stand + picture art).
const TEAM_HERO_IDS = [1205, 1206, 1207, 1309];

// All collectible hero display ids. Team heroes are ordered FIRST so
// their instance ids are 1..N and instanceIds() maps to them.
const _bookIds = Object.keys(heroBook).map(Number).filter((n) => !Number.isNaN(n));
const ALL_HERO_IDS = [
  ...TEAM_HERO_IDS.filter((id) => _bookIds.includes(id)),
  ..._bookIds.filter((id) => !TEAM_HERO_IDS.includes(id)),
];

// Backward-compat name — the hero list handler uses this, now = full owned set.
const RENDERABLE_HERO_IDS = ALL_HERO_IDS;

function buildBaseAttr() {
  return {
    _level: 1, _exp: 0, _power: 100,
    _hp: 1000, _attack: 50, _armor: 25, _speed: 10,
    _hit: 0, _dodge: 0, _block: 0,
    _damageReduce: 0, _armorBreak: 0,
    _controlResist: 0, _skillDamage: 0,
    _criticalDamage: 0, _blockEffect: 0,
    _critical: 0, _criticalResist: 0,
    _trueDamage: 0, _energy: 0,
    _extraArmor: 0, _hpPercent: 0,
    _armorPercent: 0, _attackPercent: 0,
    _speedPercent: 0, _orghp: 0,
    _superDamage: 0, _healPlus: 0,
    _healerPlus: 0, _damageDown: 0,
    _shielderPlus: 0, _damageUp: 0,
  };
}

// Star each owned hero starts at (its own base star from heroBook, capped).
function heroStar(displayId) {
  const s = heroBook[displayId] && Number(heroBook[displayId].star);
  return s > 0 ? Math.min(s, 7) : 1;
}

// Map keyed by instance id (1..N), as HerosManager.readByData expects.
// The instance id is what teams reference via _heroId; _heroDisplayId
// selects the art / hero.json row.
function buildHerosMap() {
  const map = {};
  ALL_HERO_IDS.forEach((displayId, i) => {
    const instanceId = i + 1;
    const s = heroStats.byDisplayId(displayId);
    const baseAttr = buildBaseAttr();
    baseAttr._level = 200;
    baseAttr._hp = s.hp;
    baseAttr._attack = s.attack;
    baseAttr._armor = s.armor;
    baseAttr._speed = s.speed;
    baseAttr._power = heroStats.powerOf(s);
    map[instanceId] = {
      _heroId: instanceId,
      _heroDisplayId: displayId,
      _heroStar: heroStar(displayId),
      _heroTag: '',
      _fragment: 0,
      _expeditionMaxLevel: 0,
      _superSkillResetCount: 0,
      _potentialResetCount: 0,
      _superSkillLevel: [0, 0, 0],
      _potentialLevel: [0, 0, 0, 0],
      _heroBaseAttr: baseAttr,
    };
  });
  return map;
}

// Instance ids for the starting battle team (first N = TEAM_HERO_IDS).
function instanceIds() {
  return TEAM_HERO_IDS.map((_, i) => i + 1);
}

// display id for a given instance id (1-based), or undefined.
function displayIdForInstance(instanceId) {
  return ALL_HERO_IDS[instanceId - 1];
}

// { _heros: { <displayId>: { _id, _maxLevel } } } for hero/getAll.
function buildGetAllHeros() {
  const heros = {};
  ALL_HERO_IDS.forEach((displayId) => {
    heros[displayId] = { _id: displayId, _maxLevel: 50 };
  });
  return heros;
}

module.exports = {
  RENDERABLE_HERO_IDS,
  ALL_HERO_IDS,
  TEAM_HERO_IDS,
  buildBaseAttr,
  buildHerosMap,
  instanceIds,
  displayIdForInstance,
  buildGetAllHeros,
};
