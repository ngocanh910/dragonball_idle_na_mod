// ============================================================
// Enter-Game Player State (mock)
//
// When the client clicks "Enter Game" it emits action:"enterGame"
// to the main-server socket. The response object is fed to the
// client's UserDataParser.saveUserData(e), which calls a chain of
// setters. Several of those setters read nested sub-objects
// UNGUARDED (e.user._id, e.hangup._curLess, e.summon._energy,
// e.totalProps._items, e.heros._heros, e.superSkill.length,
// Object.keys(e.curMainTask)). If any of these sub-objects is
// missing the client throws "Cannot read properties of undefined".
//
// This module builds the minimum game-state object that satisfies
// every unguarded setter so entry stops crashing. Guarded setters
// (equip/weapon/dungeon/imprint/checkin/teamTraining/userGuild/
// heroSkin) are intentionally omitted — they no-op when absent.
// ============================================================

/**
 * Build the mock player state returned by the enterGame handler.
 * @param {object} payload - The enterGame request payload.
 * @returns {object} Game-state object safe for UserDataParser.saveUserData.
 */
function buildEnterGameState(payload) {
  const userId = payload.userId || 1001;
  const now = Math.floor(Date.now() / 1000);

  return {
    // ── setUserInfo: e.user (all fields read unguarded) ────────
    user: {
      _id: userId,
      _pwd: '',
      _nickName: 'Player',
      _headImage: 1,
      _lastLoginTime: now,
      _createTime: now,
      _bulletinVersions: {},
      _oriServerId: 0,
    },

    // ── setOnHook: e.hangup ────────────────────────────────────
    hangup: {
      _curLess: 0,
      _maxPassLesson: 0,
      _haveGotChapterReward: false,
      _maxPassChapter: 0,
      _clickGlobalWarBuffTag: false,
      _buyFund: false,
      _haveGotFundReward: false,
    },

    // ── setSummon: e.summon (for-in over _summonTimes) ─────────
    summon: {
      _energy: 0,
      _wishList: {},
      _wishVersion: 0,
      _canCommonFreeTime: 0,
      _canSuperFreeTime: 0,
      _summonTimes: {},
    },

    // ── setBackpack: e.totalProps._items (for-in) ──────────────
    totalProps: { _items: {} },
    backpackLevel: 1,

    // ── HerosManager.readByData: e.heros._heros (for-in) ───────
    heros: { _heros: {} },

    // ── initSuperSkill: e.superSkill.length ────────────────────
    superSkill: [],

    // ── setMainTask → setMianTask: Object.keys(e.curMainTask) ──
    curMainTask: {},

    // ── direct scalar reads (safe if absent, provided for clarity)
    currency: {},
    channelSpecial: {},

    // ── enter-game bookkeeping ─────────────────────────────────
    userId,
    serverTime: now,
    dailyReset: false,
    loginDays: 1,
    lastLoginTime: now,
  };
}

module.exports = { buildEnterGameState };
