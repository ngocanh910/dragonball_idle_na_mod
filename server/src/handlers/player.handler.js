// ============================================================
// Player / User Handler
// Handles: login, user info, server list, enter game
// ============================================================

const { success } = require('../utils/response');
const config = require('../config');
const { buildEnterGameState } = require('../services/enter-game-state');
const playerState = require('../services/player-state');

async function handle(payload) {
  const { action, type } = payload;
  const actionLower = (action || '').toLowerCase();
  const typeLower = (type || '').toLowerCase();

  // Resolve the acting user (payload.userId, else default to player #1).
  const userId = Number(payload.userId) || 1;
  const state = await playerState.getOrCreate(userId);
  const p = state.player;

  // Build the base URL the browser can reach. Prefer the host from the
  // socket handshake / HTTP request (injected as _clientHost); fall back
  // to config.publicHost. This prevents 127.0.0.1 URLs reaching a remote
  // browser, which breaks the enter-game mainClient socket connection.
  const clientHost = payload._clientHost;
  const baseUrl = clientHost
    ? `http://${clientHost}`
    : `http://${config.publicHost}:${config.port}`;

  // ── Login ────────────────────────────────────────────────────
  if (!action || actionLower === 'login' || actionLower === 'logingame') {
    return success({
      userId,
      serverId: config.defaultServerId,
      serverName: config.serverName,
      sign: 'local_signature',
      nickname: p.nickname,
      level: p.level,
      vip: p.vip,
      gold: playerState.getItem(state, playerState.ITEM_GOLD),
      diamond: playerState.getItem(state, playerState.ITEM_DIAMOND),
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
  // The response is fed to UserDataParser.saveUserData(), which calls a
  // chain of setters that read nested sub-objects unguarded. The full
  // required structure is built by enter-game-state to avoid a client
  // crash on undefined._id / ._curLess / etc.
  if (actionLower === 'entergame') {
    return success(buildEnterGameState(payload, state));
  }

  // ── Player info ──────────────────────────────────────────────
  if (actionLower === 'info' || actionLower === 'getinfo') {
    return success({
      userId,
      nickname: p.nickname,
      level: p.level,
      vip: p.vip,
      gold: playerState.getItem(state, playerState.ITEM_GOLD),
      diamond: playerState.getItem(state, playerState.ITEM_DIAMOND),
      stamina: 120,
      exp: 0,
      fightPower: 50000,
      avatar: p.headImage,
    });
  }

  // ── Update profile ──────────────────────────────────────────
  if (actionLower === 'update' || actionLower === 'setinfo') {
    return success({ updated: true });
  }

  return null; // Let fallback handle it
}

module.exports = { handle };
