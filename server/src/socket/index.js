// ============================================================
// Socket.IO Handler
// Manages real-time communication with the game client.
// ============================================================

const { modHooks } = require('../../../mods/api');
const logStore = require('../services/log-store');

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
    socket.on('handler.process', (data, callback) => {
      logStore.stats.totalSocketEvents++;
      const start = Date.now();

      try {
        const modResult = modHooks.emit('socket:handler.process', data);
        const response = modResult || { ret: 0, data: '{}' };
        const dur = Date.now() - start;
        logStore.info('[Socket]', `handler.process OK (${dur}ms)`, {
          method: 'WS', path: 'handler.process', duration: dur,
        });

        if (typeof callback === 'function') {
          callback(response);
        }
      } catch (err) {
        const dur = Date.now() - start;
        logStore.error('[Socket]', `handler.process error: ${err.message}`, {
          method: 'WS', path: 'handler.process', status: 500, duration: dur, error: err,
        });
        if (typeof callback === 'function') {
          callback({ ret: 1, message: err.message });
        }
      }
    });

    // ── Ping keep-alive ─────────────────────────────────────
    socket.on('pong', () => {
      // Game sends pong in response to server ping
    });

    // ── Error ───────────────────────────────────────────────
    socket.on('error', (err) => {
      logStore.error('[Socket]', `Socket error on ${socket.id}: ${err.message}`, {
        method: 'WS', path: socket.id, error: err,
      });
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
