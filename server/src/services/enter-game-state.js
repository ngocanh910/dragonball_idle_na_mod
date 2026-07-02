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
    totalProps: { _items: {} },
    backpackLevel: 1,

    // ── HerosManager.readByData: e.heros._heros (for-in) ───────
    heros: {
      // Hero 1001 (Goku) — needed so HerosManager populates hero list
      // for battle lineup selection. The format matches what
      // SetHeroDataToModel expects.
      _heros: {
        1: {
          _heroId: 1,
          _heroDisplayId: 1205, // Must have an entry in heroWakeUp.json + real images
          _heroStar: 1,
          _heroTag: '',
          _fragment: 0,
          _expeditionMaxLevel: 0,
          _superSkillResetCount: 0,
          _potentialResetCount: 0,
          _superSkillLevel: [0, 0, 0],
          _potentialLevel: [0, 0, 0, 0],
          _heroBaseAttr: {
            _level: 1,
            _exp: 0,
            _power: 100,
            _hp: 1000,
            _attack: 50,
            _armor: 25,
            _speed: 10,
            _hit: 0, _dodge: 0, _block: 0,
            _damageReduce: 0, _armorBreak: 0,
            _controlResist: 0, _skillDamage: 0,
            _criticalDamage: 0, _blockEffect: 0,
            _critical: 0, _criticalResist: 0,
            _trueDamage: 0, _energy: 0,
            _extraArmor: 0, _hpPercent: 0,
            _armorPercent: 0, _attackPercent: 0,
            _speedPercent: 0, _orghp: 0,
            _superDamage: 0, _healPlus: 0,
            _healerPlus: 0, _damageDown: 0,
            _shielderPlus: 0, _damageUp: 0,
          },
        },
      },
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
          _team: [{ _heroId: 1001, _position: 0 }],
          _superSkill: [],
        },
      },
    },

    // ── direct scalar reads (safe if absent, provided for clarity)
    currency: {},
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
