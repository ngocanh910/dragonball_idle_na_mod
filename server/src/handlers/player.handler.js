// ============================================================
// Player / User Handler
// ============================================================

const { success } = require('../utils/response');
const config = require('../config');

function handle(payload) {
  const { action } = payload;

  // Login
  if (!action || action === 'login' || action === 'loginGame') {
    return success({
      userId: payload.userId || 1001,
      serverId: config.defaultServerId,
      serverName: config.serverName,
      sign: 'local_signature',
      nickname: 'Player',
      level: 50,
      vip: 5,
      gold: 999999,
      diamond: 99999,
      stamina: 120,
      exp: 0,
      战斗力: 50000,
      serverItem: {
        url: `http://127.0.0.1:${config.port}`,
        dungeonurl: `http://127.0.0.1:${config.port}`,
        chaturl: `http://127.0.0.1:${config.port}`,
        serverId: config.defaultServerId,
        online: true,
        offlineReason: '',
        worldRoomId: 'room1',
        guildRoomId: 'guild1',
        teamChatRoomId: 'team1',
        teamDungeonChatRoom: 'teamDungeon1',
      },
      serverTime: Math.floor(Date.now() / 1000),
    });
  }

  // Player info
  if (action === 'info' || action === 'getInfo') {
    return success({
      userId: 1001,
      nickname: 'Player',
      level: 50,
      vip: 5,
      gold: 999999,
      diamond: 99999,
      stamina: 120,
      exp: 0,
      fightPower: 50000,
      avatar: 1,
    });
  }

  // Update profile
  if (action === 'update' || action === 'setInfo') {
    return success({ updated: true });
  }

  return null; // Let fallback handle it
}

module.exports = { handle };
