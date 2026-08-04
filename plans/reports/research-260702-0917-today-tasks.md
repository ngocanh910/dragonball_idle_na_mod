# Today Tasks — 2026-07-02

## Yesterday Recap

### What Was Done
- Server handler improvements: case-insensitive dispatch (`player.handler.js`, `handlers/index.js`)
- Resource proxy route for VVCC assets (`resource-proxy.routes.js`)
- Socket integration + dispatch via standard handler system (`socket/index.js`)
- Game client boot script with mocks (`browser-boot.js`)
- Playwright E2E test (`login-e2e.test.js`) — ~100% complete
- Smoke tests improved (`smoke.test.js`)
- Config consolidation (`config.routes.js`)

### What Was NOT Done (leftover from "Next Steps")
1. ❌ E2E test was never fully run successfully — `PAGE_ERROR: Cannot read properties of null (reading '201')` blocks login
2. ❌ Resource proxy not verified
3. ❌ Socket communication not verified end-to-end
4. ❌ Auto-login not confirmed working

---

## Critical Bug Analysis

### Bug: `Cannot read properties of null (reading '201')`

**Source:** E2E Playwright log (plans/reports/screenshots/e2e-game-logs.txt)

**Symptoms:**
```
[log] 无渠道登录
[PAGE_ERROR] Cannot read properties of null (reading '201')
```

**Context leading up to crash:**
1. Game boots OK (Egret 5.2.29, DragonBones 5.6.300)
2. `[TEST] Can't find language language-cn_json` (x6) — localization file(s) missing
3. Scene set to 750×1334, assets loaded
4. `无渠道登录` — "No channel login" (the mock returns no channel data)
5. Crash: `Cannot read properties of null (reading '201')`

**Likely Root Cause:**
- The game accesses a channel/config object that wasn't returned by login response or is missing from the bridge mock
- Property '201' suggests a status code or ID lookup on what should be an object but is null
- Could be missing `language-cn_json` → game falls back to a null config object
- `getLoginServer` mock returns HTTP URL but game might expect WS or different format

**Hypotheses:**
| # | Hypothesis | How to Test |
|---|---|---|
| H1 | Language file `language-cn_json` missing → cascade null ref | Add stub JSON or skip language init |
| H2 | Channel login response missing required fields | Check `无渠道登录` handler; add stub channel config |
| H3 | `getLoginServer` returns URL format game doesn't expect | Compare with original Android bridge URL format |
| H4 | Login response missing channel/sdk fields the client expects | Compare fields in `player.handler.js` with real APK response |

---

## Today's Plan

### Phase 1: Investigate & Fix Critical Bug
1. **Find where '201' is accessed** — grep game source for `.201` or `['201']` patterns
2. **Fix language files** — create stub `language-cn_json` or skip missing language gracefully
3. **Fix channel login** — add mock channel config so game doesn't crash at `无渠道登录`
4. **Verify fix** — run game in browser (no Playwright), check console for errors

### Phase 2: Complete Server Integration
1. **Verify resource proxy** serves VVCC assets correctly
2. **Test socket login flow**: browser → getLoginServer → socket connect → dispatch login → enter game
3. **Handle missing game data** the client requests post-login

### Phase 3: Polish & Refs
1. Clean up test artifacts
2. Update docs if needed
3. Consider removing Playwright dependency or flagging it as optional

---

## Testing Approach Today (NO Playwright)

Per user's request: **No Playwright today.** Instead:

| Method | What it covers |
|---|---|
| Manual browser test (Chrome with DevTools) | Visual + console errors + network |
| `node --test` (unit tests) | Server logic, handlers |
| `curl` / direct HTTP | API endpoints, socket not tested |
| Browser JS console | Real-time game client errors |

---

## Completed Fixes (this session)

### ✅ Fix 1: `publicHost` tách biệt khỏi `host` binding
- **Problem:** `config.host = '0.0.0.0'` dùng cho cả server.listen() lẫn URL generation → response URL chứa `http://0.0.0.0:8080` → browser không resolve được.
- **Fix:** Thêm `config.publicHost` (mặc định `'127.0.0.1'`, env `PUBLIC_HOST`). Dùng `config.publicHost` cho URL generation, giữ `config.host` cho server binding.
- **Files affected:** `server/src/config/index.js`, `player.handler.js`, `config.routes.js`

### ✅ Fix 2: `window.loadJsonFunc` mock (Root cause của crash `'201'`)
- **Root cause:** Game code có `readJsonFile()` gọi `window.loadJsonFunc(key)` để load JSON synchronous — nhưng `loadJsonFunc` **không hề được define**. Dẫn đến `readJsonFile()` luôn trả về `null` → mọi JSON data (language, game data tables) đều null → crash `reading '201'` khi code truy cập property trên null.
- **Fix:** Thêm `window.loadJsonFunc` trong `browser-boot.js` dùng synchronous XMLHttpRequest fetch từ server (/resource/XXX.json) + in-memory cache.
- **Mapping:** Key `language-cn_json` → URL `/resource/language-cn.json` (theo pattern từ `default.res.json`)
- **File affected:** `client/browser-boot.js`

## Todo Checklist

- [x] Read game source to find `Cannot read properties of null (reading '201')` — found root cause: `loadJsonFunc` undefined
- [x] Fix `0.0.0.0` in response URLs (config.publicHost)
- [x] Fix `loadJsonFunc` mock (synchronous XHR loader)
- [ ] Verify game loads without page errors in browser ← **next step**
- [ ] Fix socket verify/challenge flow (loginClient has verify=false, mainClient verify=true)
- [ ] Test login flow manually via browser
- [ ] Verify resource proxy works
- [ ] Update docs if needed

---

## Open Questions
1. ~~Where exactly in game source is `['201']` accessed?~~ **Found:** multiple `readJsonFile` calls that return null due to missing `loadJsonFunc`. Crash is property access on null JSON object.
2. ~~Does `language-cn_json` need to be a real file or just a key in a JSON bundle?~~ **Answer:** It IS a real file (`resource/language/language-cn.json`). The problem was the loader not working.
3. Socket verify challenge flow — `loginClient` has `verifyEnable=false` (skips verify), `mainClient` has `verifyEnable=true` (uses verify).
4. **New Q:** Need to check if the game's socket verify (TEA encryption with key "verification") matches our server's verify expectations.
