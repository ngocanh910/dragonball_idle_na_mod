// ============================================================
// Fallback Handler
// Returns empty/default data for unimplemented game requests.
// ============================================================

const { success } = require('../utils/response');

const DEFAULT_RESPONSES = {
  expedition: { currentStage: 1, maxStage: 50, progress: {}, rewards: [] },
  quest: { quests: [], completed: [], daily: {} },
  mission: { quests: [], completed: [], daily: {} },
  task: { quests: [], completed: [], daily: {} },
  shop: { items: [], refreshTime: 0 },
  market: { items: [], refreshTime: 0 },
  store: { items: [], refreshTime: 0 },
  activity: { activities: [], rewards: {} },
  arena: { rank: 0, score: 0, opponents: [], history: [] },
  dungeon: { currentFloor: 1, maxFloor: 10, rewards: [] },
  friend: { friends: [], requests: [], total: 0 },
  achievement: { achievements: [], points: 0 },
  collection: { collected: [], progress: {} },
  daily: { completed: [], rewards: [], streak: 0 },
  sign: { signed: false, days: 0, rewards: [] },
};

function handle(payload) {
  const { type, action } = payload;

  const defaultData = DEFAULT_RESPONSES[type];
  if (defaultData) {
    return success(defaultData);
  }

  console.log(`  [Fallback] No handler for type="${type}" action="${action}"`);
  return success({});
}

module.exports = { handle };
