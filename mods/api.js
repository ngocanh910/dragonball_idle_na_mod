// ============================================================
// Mod API — Hooks System
// Allows mods to intercept and extend server behavior.
// ============================================================
//
// Usage in a mod:
//   const { on } = require('../api');
//   on('handler:player', (payload, response) => {
//     response.data.gold = 999999999;  // infinite gold
//     return response;
//   });

const hooks = new Map();

/**
 * Register a hook handler.
 *
 * @param {string} event - Event name (see list below)
 * @param {function} fn - Handler (payload, response) => modifiedResponse
 * @returns {function} Unsubscribe function
 */
function on(event, fn) {
  if (!hooks.has(event)) hooks.set(event, []);
  const list = hooks.get(event);
  list.push(fn);
  return () => {
    const idx = list.indexOf(fn);
    if (idx >= 0) list.splice(idx, 1);
  };
}

/**
 * Emit an event, calling all registered handlers in order.
 * Each handler receives the previous handler's return value.
 *
 * @param {string} event
 * @param  {...any} args
 * @returns {any} Result after all handlers
 */
function emit(event, ...args) {
  const list = hooks.get(event);
  if (!list || list.length === 0) return undefined;
  return list.reduce((acc, fn) => fn(...acc), args);
}

/**
 * Remove all handlers for an event.
 */
function clear(event) {
  if (event) hooks.delete(event);
  else hooks.clear();
}

/** Return a list of registered event names. */
function registered() {
  return Array.from(hooks.keys());
}

// ── Available Hook Events ────────────────────────────────────
//
// HTTP request lifecycle:
//   'request:before'   (payload)        — before dispatch
//   'request:after'    (type, response) — after response built
//
// Handler interception:
//   'handler:player'   (payload, response) — mutate player data
//   'handler:hero'     (payload, response) — mutate hero data
//   'handler:item'     (payload, response) — mutate item data
//
// Socket events:
//   'socket:handler.process' (data) — mutate socket RPC response
//   'socket:verify'   (socket, data) — during verification

module.exports = { on, emit, clear, registered };
