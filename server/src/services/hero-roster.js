// ============================================================
// Hero Roster — single source of truth
// ============================================================
// Only these hero display IDs have real, decrypted art bundled in
// the APK (hero_stand sheet + DragonBones ske/tex + hero_picture).
// All other heroes stream their art from a CDN that is no longer
// reachable, so the roster is locked to the renderable set.
// See: plans/260703-fix-game-boot-and-asset-loading/research/
//      research-vvcc-mapping-reality.md
// ============================================================

// Ordered display IDs. Each is present in hero.json + heroWakeUp.json
// and has hero_stand_<id> + dragon_animation/hero/<id> on disk.
const RENDERABLE_HERO_IDS = [1205, 1206, 1207, 1309];

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

// Map keyed by instance id (1..N), as HerosManager.readByData expects.
// The instance id is what teams reference via _heroId; _heroDisplayId
// selects the art / hero.json row.
function buildHerosMap() {
  const map = {};
  RENDERABLE_HERO_IDS.forEach((displayId, i) => {
    const instanceId = i + 1;
    map[instanceId] = {
      _heroId: instanceId,
      _heroDisplayId: displayId,
      _heroStar: 1,
      _heroTag: '',
      _fragment: 0,
      _expeditionMaxLevel: 0,
      _superSkillResetCount: 0,
      _potentialResetCount: 0,
      _superSkillLevel: [0, 0, 0],
      _potentialLevel: [0, 0, 0, 0],
      _heroBaseAttr: buildBaseAttr(),
    };
  });
  return map;
}

// Instance ids in roster order (e.g. [1,2,3,4]).
function instanceIds() {
  return RENDERABLE_HERO_IDS.map((_, i) => i + 1);
}

// { _heros: { <displayId>: { _id, _maxLevel } } } for hero/getAll.
function buildGetAllHeros() {
  const heros = {};
  RENDERABLE_HERO_IDS.forEach((displayId) => {
    heros[displayId] = { _id: displayId, _maxLevel: 50 };
  });
  return heros;
}

module.exports = {
  RENDERABLE_HERO_IDS,
  buildBaseAttr,
  buildHerosMap,
  instanceIds,
  buildGetAllHeros,
};
