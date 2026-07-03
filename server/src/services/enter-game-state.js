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
const heroRoster = require('./hero-roster');

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
      _curLess: 10101,  // InitialSection — must match a valid lesson key
      _maxPassLesson: 10101,
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
    // Player level is stored as an item count (PLAYERLEVELID=104), read
    // via ItemsCommonSingleton.getItemNum(104) everywhere the game checks
    // level-gated features. Exp (PLAYEREXPERIENCEID=103) is set to the
    // level-200 threshold (userUpgrade.json expNeeded) so the level/exp
    // pair is internally consistent instead of showing 200 with 0 exp.
    totalProps: {
      _items: {
        1: { _id: 104, _num: 200 }, // PLAYERLEVELID
        2: { _id: 103, _num: 4659000 }, // PLAYEREXPERIENCEID
      },
    },
    backpackLevel: 1,

    // ── HerosManager.readByData: e.heros._heros (for-in) ───────
    // Roster is locked to heroes with real bundled art (see
    // services/hero-roster.js). SetHeroDataToModel reads each entry.
    heros: {
      _heros: heroRoster.buildHerosMap(),
    },

    // ── initSuperSkill: e.superSkill.length ────────────────────
    superSkill: [],

    // ── setMainTask → setMianTask: Object.keys(e.curMainTask) ──
    curMainTask: {},

    // ── AllRefreshCount.getInstance().initData(e.scheduleInfo) ──
    scheduleInfo: {
      // All fields that AllRefreshCount.initData reads
      _marketDiamondRefreshCount: 0,
      _vipMarketDiamondRefreshCount: 0,
      _arenaAttackTimes: 0,
      _arenaBuyTimesCount: 0,
      _snakeResetTimes: 0,
      _snakeSweepCount: 0,
      _cellGameHaveGotReward: true,
      _cellGameHaveTimes: 0,
      _cellgameHaveSetHero: false,
      _strongEnemyTimes: 0,
      _strongEnemyBuyCount: 0,
      _mergeBossBuyCount: 0,
      _dungeonTimes: 0,
      _dungeonBuyTimesCount: 0,
      _karinBattleTimes: 0,
      _karinBuyBattleTimesCount: 0,
      _karinBuyFeetCount: 0,
      _entrustResetTimes: 0,
      _dragonExchangeSSPoolId: 0,
      _dragonExchangeSSSPoolId: 0,
      _teamDugeonUsedRobots: [],
      _timeTrialBuyTimesCount: 0,
      _monthCardHaveGotReward: {},
      _goldBuyCount: 0,
      _likeRank: 0,
      _mahaAttackTimes: 0,
      _mahaBuyTimesCount: 0,
      _mineResetTimes: 0,
      _mineBuyResetTimesCount: 0,
      _mineBuyStepCount: 0,
      _guildCheckInType: 0,
      _treasureTimes: 0,
      _guildBossTimes: 0,
      _guildBossTimesBuyCount: 0,
      _clickTimeGift: false,
      _trainingBuyCount: 0,
      _bossCptTimes: 0,
      _bossCptBuyCount: 0,
      bossFightTime: 0,
      _ballWarBuyCount: 0,
      _topBattleBuyCount: 0,
      _topBattleTimes: 0,
      _spaceTrialBuyCount: 0,
      _gravityTrialBuyTimesCount: 0,
      _hadBuytimes: 0,
      _costMaterialCount: 0,
    },

    // ── lastTeam._lastTeamInfo: required for getLastOnHookTeam ──
    // The game calls firstLoginSetMyTeam(e.lastTeam._lastTeamInfo)
    // to initialise UserInfoSingleton._lastTeamInfo. If missing,
    // getMyTeamByType(9) crashes because _lastTeamInfo is undefined.
    // LAST_TEAM_TYPE.HANGUP = 9, so we provide a basic hangup team.
    lastTeam: {
      _lastTeamInfo: {
        '9': {
          _team: heroRoster.instanceIds().map((id, pos) => ({
            _heroId: id,
            _position: pos,
          })),
          _superSkill: [],
        },
      },
    },

    // ── setGuideInfo(e.guide): novice tutorial (新手引导) state ──
    // getGuideStep(type) reads guide._steps[type]. Marking each line
    // at/past its end threshold (MainGuideEndID=2717, TaskGuideEndID
    // =3102) makes the game treat the tutorial as already finished,
    // so no guide step / dialog / mask ever triggers.
    // GUIDE_TYPE.MAIN = 2, GUIDE_TYPE.TASK = 3.
    guide: {
      _id: userId,
      _steps: { 2: 2717, 3: 3102 },
    },

    // ── e.expedition && ExpeditionManager.setExpeditionModel(e.expedition)
    // ExpeditionModel's constructor defaults machines/passLesson/collection/
    // teams to {}/{}/[]/{}}, and deserialize({}) is a no-op — so an empty
    // object here is enough to make setExpeditionModel actually run.
    // Without ANY expedition field, _expeditionModel is never set at all,
    // and CheckHeroInExpeditionMachine's `for(var n in
    // t._expeditionModel.machines)` throws reading 'machines' of undefined
    // the moment the Hero List screen renders (checkHeroHasRedPoint).
    expedition: {},

    // ── direct scalar reads (safe if absent, provided for clarity)
    // `ts.currency = e.currency` (saveUserData), then used as a
    // currencyDisplay.json lookup KEY (getPriceInfoWithCurrency does
    // `currencyDisplay[ts.currency][language]`). Must be one of the
    // real currency codes ("USD","CNY","KRW","VND",...) — an empty
    // object was truthy (skipping the `!ts.currency` guard) but not a
    // valid key, so `currencyDisplay[{}]` was undefined and reading
    // the language field off it crashed every render frame that shows
    // a priced item.
    currency: 'USD',
    channelSpecial: {},
    // Guarded fields (will be checked with e.xxx && before use)
    // vipLog, cardLog, guide, clickSystem, giftInfo, monthCard,
    // recharge, timesInfo, userDownloadReward, timeMachine, etc.
    _arenaTeam: {},
    _arenaSuper: {},
    karinStartTime: 0,
    karinEndTime: 0,

    // ── enter-game bookkeeping ─────────────────────────────────
    userId,
    serverTime: now,
    dailyReset: false,
    loginDays: 1,
    lastLoginTime: now,
  };
}

module.exports = { buildEnterGameState };
