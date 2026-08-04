// ============================================================
// VIP Service — self-check (assert-based, run with node --test)
// ============================================================
// Verifies VIP level computation, perks lookup, and exp progression
// against the seeded tables and a temporary DB player (no mocks).
//
//   node --test test/vip.test.js   (from server/)
// ============================================================

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const prisma = require('../src/db/prisma');
const gameData = require('../src/services/game-data');
const playerState = require('../src/services/player-state');

let state;
let ps;

before(async () => {
  await gameData.init();
  ps = playerState;
  // Create a scratch player for VIP tests.
  const p = await prisma.player.create({ data: { nickname: 'vip-test' } });
  state = await ps.getOrCreate(p.id);
});

after(async () => {
  const testPlayers = await prisma.player.findMany({ where: { nickname: 'vip-test' } });
  for (const p of testPlayers) {
    await prisma.playerItem.deleteMany({ where: { playerId: p.id } });
    await prisma.playerHero.deleteMany({ where: { playerId: p.id } });
    await prisma.player.delete({ where: { id: p.id } });
  }
  await prisma.$disconnect();
});

describe('VIP levels & tables', () => {
  it('has 18 levels in vipUpgrade (0..17)', () => {
    const levels = gameData.list('vipUpgrade').map((x) => x.id).sort((a, b) => a - b);
    assert.deepStrictEqual(levels, Array.from({ length: 18 }, (_, i) => i));
  });

  it('cumulative exp for level 5 is the sum of expNeeded[0..4]', () => {
    const sum = gameData.list('vipUpgrade').slice(0, 5).reduce((a, x) => a + x.expNeeded, 0);
    assert.strictEqual(ps.cumulativeVipExp(5), sum);
  });

  it('computeLevel maps total exp to the right level', () => {
    // cumulative exp: L1=9, L2=50, L3=150, L4=300.
    assert.strictEqual(ps.computeVipLevel(9), 1);
    assert.strictEqual(ps.computeVipLevel(149), 2);
    assert.strictEqual(ps.computeVipLevel(150), 3);
    assert.strictEqual(ps.computeVipLevel(299), 3);
  });
});

describe('VIP state & progression', () => {
  it('starts at VIP 0 with empty exp', () => {
    assert.strictEqual(ps.getItem(state, ps.ITEM_VIP_LEVEL), 0);
    assert.strictEqual(ps.getItem(state, ps.ITEM_VIP_EXP_ALL), 0);
  });

  it('addVipExp that crosses a threshold levels up with rewards', async () => {
    const res = await ps.addVipExp(state.player.id, state, 100000);
    assert.strictEqual(res.leveledUp, true);
    assert.ok(res.level > 0);
    assert.ok(res.rewards.length > 0);
  });

  it('exp is consistent with cumulative threshold at the new level', () => {
    const exp = ps.getItem(state, ps.ITEM_VIP_EXP);
    const level = ps.getItem(state, ps.ITEM_VIP_LEVEL);
    const expAll = ps.getItem(state, ps.ITEM_VIP_EXP_ALL);
    assert.strictEqual(expAll, ps.cumulativeVipExp(level) + exp);
  });

  it('currencyItems includes the VIP item ids', () => {
    const items = ps.currencyItems(state);
    assert.ok(items[ps.ITEM_VIP_LEVEL]);
    assert.strictEqual(items[ps.ITEM_VIP_LEVEL]._num, ps.getItem(state, ps.ITEM_VIP_LEVEL));
  });
});
