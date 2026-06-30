// ============================================================
// Skill Handler
// ============================================================

const { success } = require('../utils/response');
const gameData = require('../services/game-data');

function handle(payload) {
  const { action } = payload;

  if (!action || action === 'list' || action === 'getList') {
    const skillData = gameData.get('skill') || {};
    const skills = Object.entries(skillData).slice(0, 50).map(([id, skill]) => ({
      id: parseInt(id, 10),
      level: 5,
      unlocked: true,
      ...(typeof skill === 'object' ? skill : {}),
    }));
    return success({ skills, total: skills.length });
  }

  if (action === 'learn' || action === 'upgrade') {
    return success({ success: true, skillId: payload.skillId, newLevel: (payload.level || 0) + 1 });
  }

  return null;
}

module.exports = { handle };
