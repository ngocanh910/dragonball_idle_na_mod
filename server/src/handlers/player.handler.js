// ============================================================
// Player / User Handler
// Handles: login, user info, server list, enter game
// ============================================================

const { success } = require('../utils/response');
const config = require('../config');

function handle(payload) {
  const { action, type } = payload;
  const actionLower = (action || '').toLowerCase();
  const typeLower = (type || '').toLowerCase();

  // ── Login ────────────────────────────────────────────────────
  if (!action || actionLower === 'login' || actionLower === 'logingame') {
    const baseUrl = `http://${config.host}:${config.port}`;
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
      fightPower: 50000,
      sdk: 'game_origin',
      userType: 0,
      channelCode: 'local',
      channelName: 'local',
      language: 'en',
      serverItem: {
        url: baseUrl,
        dungeonurl: baseUrl,
        chaturl: baseUrl,
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

  // ── Get Server List ──────────────────────────────────────────
  // Action variations: GetServerList, getServerList, serverlist, get_server_list
  if (actionLower === 'getserverlist' || actionLower === 'serverlist') {
    const baseUrl = `http://${config.host}:${config.port}`;
    return success({
      history: [],
      serverList: [
        {
          sid: 'local',
          name: config.serverName,
          url: baseUrl,
          dungeonurl: baseUrl,
          chaturl: baseUrl,
          status: 'smooth',
          new: true,
          recommend: true,
          serverId: config.defaultServerId,
          offlineReason: '',
          online: true,
        },
      ],
    });
  }

  // ── Enter Game ──────────────────────────────────────────────
  if (actionLower === 'entergame') {
    return success({
      userId: payload.userId || 1001,
      serverTime: Math.floor(Date.now() / 1000),
      dailyReset: false,
      loginDays: 1,
      lastLoginTime: Math.floor(Date.now() / 1000),
    });
  }

  // ── Player info ──────────────────────────────────────────────
  if (actionLower === 'info' || actionLower === 'getinfo') {
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

  // ── Update profile ──────────────────────────────────────────
  if (actionLower === 'update' || actionLower === 'setinfo') {
    return success({ updated: true });
  }

  return null; // Let fallback handle it
}

module.exports = { handle };
