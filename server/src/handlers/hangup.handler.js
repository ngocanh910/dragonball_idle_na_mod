// ============================================================
// Hangup Handler (idle/battle progression)
// ============================================================
// Root-cause fix: this "hangup" type had NO handler at all, so every
// action fell through to fallback.handle() -> success({}). Two of
// these actions are read unguarded by the client and directly corrupt
// OnHookSingleton state, crashing the NEXT scene construction:
//   - nextChapter: `OnHookSingleton.lastSection = e._curLess` (no
//     guard) — undefined _curLess makes lastSection undefined, so the
//     next Home-scene build does `lesson[undefined].exploreTime` ->
//     TypeError, which looked like "the whole game froze" (in fact
//     the client crashed and stopped responding to input).
//   - checkBattleResult: same lastSection write on a win result, plus
//     getBattleAwardItems(t) reads `t._changeInfo._items` unguarded.
// See: plans/260703-fix-game-boot-and-asset-loading/research/
//      research-hero-assets-and-crashes.md (interaction-blocked bug).

const { success } = require('../utils/response');

// Keep the player parked at the InitialSection lesson. There's no
// server-side session/progress tracking yet, so this doesn't advance
// real progression — it only guarantees `_curLess` is always a valid
// lesson.json key, which is the crash-preventing contract the client
// requires.
const CURRENT_LESSON = 10101;
const CURRENT_CHAPTER = 801;

function handle(payload) {
  const { action } = payload;

  if (action === 'nextChapter') {
    return success({ _curLess: CURRENT_LESSON });
  }

  if (action === 'checkBattleResult') {
    // Always report a win (Phase 3 "battle execution" will replace this
    // with real battle logic) so the summary screen's reward path and
    // the "Back" button's scene rebuild both get valid lesson data.
    return success({
      _battleResult: 0,
      _curLess: CURRENT_LESSON,
      _maxPassLesson: CURRENT_LESSON,
      _maxPassChapter: CURRENT_CHAPTER,
      _changeInfo: { _items: {} },
    });
  }

  if (action === 'gain') {
    return success({ _changeInfo: { _items: {} }, _exCount: 0 });
  }

  // startGeneral / getChapterReward / getLessonFundReward /
  // buyLessonFund / saveGuideTeam: no unguarded field reads found in
  // the client for these: safe to no-op until their features are
  // implemented.
  return success({});
}

module.exports = { handle };
