// ============================================================
// Hero Stats — real level-200 base attributes
// ============================================================
// Values in data/hero-stats.json were extracted by running the game's
// OWN formula (HeroAttributeCommon.makeHeroBasicAttr → getHeroBookAttr,
// the same code the Illustration uses) at level 200, each hero's
// heroBook star, fully evolved. So they match the Illustration exactly
// (real stats, pre-equipment) instead of the placeholder 8000.
// Re-generate with: node tools/extract-hero-stats.js
// ============================================================

const path = require('path');

let STATS = {};
try {
  STATS = require(path.resolve(__dirname, '..', 'data', 'hero-stats.json'));
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('[HeroStats] hero-stats.json missing — falling back to defaults');
}

const FALLBACK = { hp: 100000, attack: 8000, armor: 8000, speed: 300 };

// Real base stats for a hero display id (e.g. 1206).
function byDisplayId(displayId) {
  const s = STATS[displayId] || STATS[String(displayId)];
  if (!s || s.error) return FALLBACK;
  return {
    hp: Math.round(s.hp || 0) || FALLBACK.hp,
    attack: Math.round(s.attack || 0) || FALLBACK.attack,
    armor: Math.round(s.armor || 0) || FALLBACK.armor,
    speed: Math.round(s.speed || 0) || FALLBACK.speed,
  };
}

// Rough combat power from the base stats (display only).
function powerOf(s) {
  return Math.round(s.attack * 2 + s.armor * 2 + s.hp / 10);
}

module.exports = { byDisplayId, powerOf };
