// ============================================================
// Socket.IO Handler
// Manages real-time communication with the game client.
// ============================================================

const modHooks = require('../../../mods/api');
const logStore = require('../services/log-store');
const { dispatch } = require('../handlers');

function register(io) {
  io.on('connection', (socket) => {
    logStore.info('[Socket]', `New connection: ${socket.id}`);

    // ── Verify challenge ────────────────────────────────────
    const challenge = Math.random().toString(36).substring(2, 15);
    socket.emit('verify', challenge);

    // ── Verify response ─────────────────────────────────────
    socket.on('verify', (data, callback) => {
      logStore.info('[Socket]', `Verify received from ${socket.id}`);
      if (typeof callback === 'function') {
        callback({ ret: 0, msg: 'verified' });
      }
      socket.emit('Notify', {
        type: 'verified',
        data: { userId: 1001, serverTime: Math.floor(Date.now() / 1000) },
      });
    });

    // ── handler.process (main RPC) ──────────────────────────
    // The game sends all its API calls through this socket event.
    // Payload format: { type, action, userId, ... }
    socket.on('handler.process', (data, callback) => {
      if (logStore.stats) logStore.stats.totalSocketEvents++;
      const start = Date.now();
      let response;

      try {
        // Try to dispatch via the standard game handler system
        response = dispatch(data || {});
        if (!response) {
          // If no handler matched, try mod hooks
          response = modHooks.emit('socket:handler.process', data) || { ret: 0, data: '{}' };
        }
        const dur = Date.now() - start;
        logStore.info('[Socket]', `handler.process OK ${(data && data.type) || '?'}.${(data && data.action) || '?'} (${dur}ms)`);
      } catch (err) {
        const dur = Date.now() - start;
        logStore.error('[Socket]', `handler.process error: ${err.message}`);
        response = { ret: 1, message: err.message };
      }
      if (typeof callback === 'function') {
        callback(response);
      }
    });

    // ── Ping keep-alive ─────────────────────────────────────
    socket.on('pong', () => {});

    // ── Error ───────────────────────────────────────────────
    socket.on('error', (err) => {
      logStore.error('[Socket]', `Socket error on ${socket.id}: ${err.message}`);
    });

    // ── Disconnect ──────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logStore.info('[Socket]', `Disconnected: ${socket.id} (${reason})`);
    });
  });

  // Periodic keep-alive ping
  setInterval(() => {
    io.emit('ping', { serverTime: Math.floor(Date.now() / 1000) });
  }, 30000);
}

module.exports = { register };
