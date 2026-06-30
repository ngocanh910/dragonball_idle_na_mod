// ============================================================
// Guild / Social Handler
// ============================================================

const { success } = require('../utils/response');

function handle(payload) {
  const { action, type } = payload;

  // ── Guild ──────────────────────────────────────────────────
  if (type === 'guild' || type === 'guildBoss') {
    if (!action || action === 'info') {
      return success({
        guildId: 0,
        name: '',
        level: 1,
        members: [],
        boss: { hp: 1000000, maxHp: 1000000, level: 1 },
      });
    }
    if (action === 'bossAttack') {
      return success({ damage: payload.damage || 10000, bossHpRemaining: 990000, rewards: { gold: 5000 } });
    }
    if (action === 'create') {
      return success({ guildId: Date.now(), name: payload.name || 'New Guild' });
    }
    return success({});
  }

  // ── Chat ───────────────────────────────────────────────────
  if (type === 'chat') {
    return success({ messages: [], channels: {} });
  }

  // ── Mail ───────────────────────────────────────────────────
  if (type === 'mail') {
    return success({ mails: [], unread: 0 });
  }

  return null;
}

module.exports = { handle };
