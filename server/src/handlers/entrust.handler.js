// ============================================================
// Entrust Handler (level-gated feature)
// ============================================================
// Root-cause: `type:"entrust"` had NO server handler, so `getInfo`
// fell through to fallback.handle() -> success({}). The client's
// EntrustSingleton.initData(t._model) reads `e._entrusts._entrusts`
// unguarded — with `t._model` undefined (empty {} response), this
// throws "Cannot read properties of undefined (reading '_entrusts')"
// the moment the level-gated Entrust feature opens (OpenLimit.
// checkEntrustLimit() unlocks it above a level threshold, so this
// was unreachable at level 0 and only surfaced once the player was
// leveled up).

const { success } = require('../utils/response');

function handle(payload) {
  const { action } = payload;

  if (action === 'getInfo') {
    return success({
      _model: {
        _entrusts: { _entrusts: {} },
        _helpedFrieds: [],
        _refreshCount: 0,
        _helpFriendHero: '',
      },
    });
  }

  return success({});
}

module.exports = { handle };
