// ============================================================
// Handler Registry
// Dispatches game API requests to the correct domain handler.
// ============================================================

const player = require('./player.handler');
const hero = require('./hero.handler');
const item = require('./item.handler');
const skill = require('./skill.handler');
const equipment = require('./equipment.handler');
const guild = require('./guild.handler');
const hangup = require('./hangup.handler');
const entrust = require('./entrust.handler');
const recharge = require('./recharge.handler');
const vip = require('./vip.handler');
const gift = require('./gift.handler');
const fallback = require('./fallback.handler');

// Domain handler lookup: maps request type → handler module
const HANDLERS = {
  login: player,
  player,
  user: player,
  hero,
  heroImage: hero,   // heroImage/getAll → populates the codex "already gained" list
  backpack: item,
  item,
  bag: item,
  things: item,
  skill,
  equip: equipment,
  equipment,
  weapon: equipment,
  guild,
  guildBoss: guild,
  chat: guild,
  mail: guild,
  hangup,
  entrust,
  recharge,
  vip,
  gift,
};

/**
 * Route a game API request to the appropriate handler.
 * Type matching is case-insensitive ("User" → "user").
 * Async — handlers may persist state to the DB.
 *
 * @param {object} payload - The parsed request body { type, action, … }
 * @returns {Promise<object>} Response object.
 */
async function dispatch(payload) {
  const { type, action } = payload;
  const typeLower = (type || '').toLowerCase();
  const handler = HANDLERS[type] || HANDLERS[typeLower];

  if (handler) {
    const result = await handler.handle(payload);
    if (result) return result;
  }

  // Try fallback
  return fallback.handle(payload);
}

module.exports = { dispatch };
