// ============================================================
// Socket.IO Handler
// Manages real-time communication with the game client.
// ============================================================

const { modHooks } = require('../../../mods/api');

function register(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket]  New connection: ${socket.id}`);

    // ── Verify challenge ────────────────────────────────────
    const challenge = Math.random().toString(36).substring(2, 15);
    socket.emit('verify', challenge);

    // ── Verify response ─────────────────────────────────────
    socket.on('verify', (data, callback) => {
      console.log('[Socket]  Verify received');

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
      console.log('[Socket]  handler.process:', JSON.stringify(data).substring(0, 200));

      // Let mods intercept/mutate the request
      const modResult = modHooks.emit('socket:handler.process', data);
      const response = modResult || { ret: 0, data: '{}' };

      if (typeof callback === 'function') {
        callback(response);
      }
    });

    // ── Ping keep-alive ─────────────────────────────────────
    socket.on('pong', () => {
      // Game sends pong in response to server ping
    });

    // ── Disconnect ──────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket]  Disconnected: ${socket.id}`);
    });
  });

  // Periodic keep-alive ping
  setInterval(() => {
    io.emit('ping', { serverTime: Math.floor(Date.now() / 1000) });
  }, 30000);
}

module.exports = { register };
