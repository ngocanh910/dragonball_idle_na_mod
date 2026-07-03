// ============================================================
// Browser Boot â€” Native Bridge Mock for Egret Engine
// ============================================================
//
// This script mocks the Android native bridge (JNI) interface
// that the Egret game client expects when running inside a
// WebView. It allows the game to boot in a standard desktop
// browser (Chrome, Firefox, etc.) without any Android runtime.
//
// Must be loaded BEFORE any Egret engine scripts.
// ============================================================

(function () {
  'use strict';

  // ── Callback registry ────────────────────────────────────
  var _callbacks = {};

  // ── Create egret namespace stub if not yet available ──────
  window.egret = window.egret || {};
  window.egret.ExternalInterface = window.egret.ExternalInterface || {};

  // ── Store original methods so we can patch after engine load
  var _origAddCallback = null;
  var _origCall = null;

  // ── Mock addCallback ────────────────────────────────────â”€
  // The game registers JS functions that the Android side calls.
  // We store them and invoke them ourselves.
  function mockAddCallback(name, fn) {
    _callbacks[name] = fn;
    console.log('[BrowserBoot] Registered callback:', name);
  }

  // ── Mock call ────────────────────────────────────────────
  // The game calls native Android functions through this.
  // We intercept and handle known calls.
  function mockCall(name, data) {
    switch (name) {
      case 'startTsGame':
        // The game calls this to signal readiness.
        // In Android, the Java side would respond by calling
        // the "startTsGame" callback with config JSON.
        // We trigger it ourselves after a short delay.
        console.log('[BrowserBoot] Game requested startTsGame â€” triggering boot');
        triggerGameBoot();
        break;

      case 'sendLog':
        // Analytics/telemetry log â€” safe to ignore
        // console.log('[BrowserBoot] sendLog:', data);
        break;

      case 'peiNative':
        // In-app purchase request â€” simulate instant success
        console.log('[BrowserBoot] Purchase requested:', data);
        simulatePurchase(data);
        break;

      default:
        console.log('[BrowserBoot] Unhandled native call:', name, data);
        break;
    }
  }

  // ── Boot the game engine ────────────────────────────────â”€
  function triggerGameBoot() {
    var payload = JSON.stringify({
      screenSize: { width: 720, height: 1280 },
      versionConfig: { version: '1.0.0' },
      uid: 'local_browser_user',
      autoStart: true,
    });

    setTimeout(function () {
      if (_callbacks.startTsGame) {
        console.log('[BrowserBoot] Invoking startTsGame callback');
        _callbacks.startTsGame(payload);
      } else {
        console.warn('[BrowserBoot] startTsGame callback not registered yet');
      }
    }, 100);
  }

  // ── Simulate in-app purchase ────────────────────────────â”€
  function simulatePurchase(data) {
    try {
      var parsed = JSON.parse(data);
      var shopId = parsed.id || 'unknown';
      console.log('[BrowserBoot] Simulating purchase success for:', shopId);

      setTimeout(function () {
        if (_callbacks.peiDone) {
          _callbacks.peiDone(shopId);
        }
      }, 500);
    } catch (e) {
      console.warn('[BrowserBoot] Failed to parse purchase data:', e);
    }
  }

  // ── Mock top-up / gem purchase (window.paySdk) ───────────
  // ts.payToSdk(data) calls `window[e].apply(window,args)` for
  // e="paySdk" (TSBrowser.excuteFunction) — a native Android
  // JS-bridge object in the real APK, never defined in a browser.
  // The real reward flow is a server-pushed `Notify` socket event
  // with action:"payFinish" sent only after the backend verifies
  // payment with Google Play out-of-band. There's no real payment
  // gateway in this local emulator, so we grant the recharge.json
  // diamond amount (already computed server-side in `prePayRet.data`
  // by server/src/handlers/recharge.handler.js) immediately, via the
  // same `ts.notifyData()` call path the real payFinish push would
  // trigger — see main.min.js TSUIController.prototype.notifyData,
  // action:"payFinish" branch, which calls
  // UIWindowManager.openCongratulationObtain(e._detail).
  window.paySdk = function (data) {
    console.log('[BrowserBoot] Top-up requested, granting instantly:', data);
    try {
      var diamond = (data && data.diamond) || 0;
      // Two gotchas in `_changeInfo._items`, found by tracing
      // TSUIController.openCommonItemGetTips (called from the
      // payFinish handler):
      // 1. It persists via `ItemsCommonSingleton.setItem(Number(f),
      //    _num)` where `f` is the OBJECT KEY itself, not `_id` — the
      //    map must be keyed BY item id (unlike setBackpack's
      //    `totalProps._items`, which is index-keyed and reads `._id`).
      // 2. `_num` is the NEW ABSOLUTE TOTAL, not a delta — it derives
      //    the "+N" popup amount itself via `_num - getItemNum(id)`.
      //    Sending the raw purchased amount would silently overwrite
      //    the balance instead of adding to it.
      var current = window.ItemsCommonSingleton.getInstance().getItemNum(101); // DIAMONDID
      window.ts.notifyData({
        action: 'payFinish',
        _code: 0,
        _detail: {
          _changeInfo: {
            _items: { 101: { _id: 101, _num: current + diamond } },
          },
        },
      });
    } catch (e) {
      console.warn('[BrowserBoot] paySdk mock failed:', e);
    }
  };

  // ── Install mocks immediately ────────────────────────────
  window.egret.ExternalInterface.addCallback = mockAddCallback;
  window.egret.ExternalInterface.call = mockCall;

  // ── Re-apply mocks after Egret engine loads ──────────────
  // The Egret engine overwrites ExternalInterface during init.
  // We use a getter/setter trap to re-apply our mocks.
  var _ei = window.egret.ExternalInterface;

  Object.defineProperty(window.egret, 'ExternalInterface', {
    get: function () { return _ei; },
    set: function (val) {
      _ei = val;
      // Preserve any methods Egret added, but override call/addCallback
      _ei.addCallback = mockAddCallback;
      _ei.call = mockCall;
      // Provide getCallback for direct access
      _ei.getCallback = function (name) { return _callbacks[name] || null; };
      console.log('[BrowserBoot] Re-applied mocks after Egret engine init');
    },
    configurable: true,
  });

  // ── Also mock egret_native if referenced ────────────────â”€
  window.egret_native = window.egret_native || {
    NativeDisplayObject: {
      setSourceToNativeBitmapData: function () {},
    },
  };

  // ── Mock window.getLoginServer ────────────────────────â”€
  // The game calls this to get the server URL for connecting.
  window.getLoginServer = function () {
    var host = window.location.host || 'localhost:8080';
    var url = 'http://' + host;
    console.log('[BrowserBoot] getLoginServer() →', url);
    return url;
  };

  // ── Mock window.getQueryStringByName ────────────────────
  // The game uses this to parse URL query parameters.
  //
  // Language: the game sets ts.language from getQueryStringByName("language")
  // and defaults to "cn" when null (see getLanguage() in main.min.js). We
  // force "en" so it loads default.res-en.json — the full English manifest
  // that includes the ~39 newer heroes absent from the base default.res.json
  // (whose missing RES entries caused recycled cards to show duplicate art),
  // and so all UI text/images resolve to English natively.
  // A real ?language=xx in the URL still overrides this.
  window.getQueryStringByName = function (name) {
    var match = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    if (match) return decodeURIComponent(match[1].replace(/\+/g, ' '));
    if (name === 'language') return 'en';
    return null;
  };

  // ── Mock window.getAppId ────────────────────────────────
  // The game uses this to get the channel/app ID.
  window.getAppId = function () {
    return 'local_browser';
  };

  // ── Mock window.serverList ────────────────────────────â”€
  // The game uses this as a server-name mapping lookup.
  // In the Android app, this is set by the Java bridge.
  window.serverList = {
    1: 'Local Emulator',
  };

  // ── Inject cached server for auto-login ────────────────
  // The game checks egret.localStorage for 'last_game_server'.
  // We inject it so the auto-login flow triggers on boot.
  try {
    if (window.egret && window.egret.localStorage) {
      var cached = window.egret.localStorage.getItem('last_game_server');
      if (!cached) {
        window.egret.localStorage.setItem('last_game_server', JSON.stringify({
          username: 'browser_user',
          password: 'game_origin',
          lastServerID: '1'
        }));
        console.log('[BrowserBoot] Injected cached server for auto-login');
      }
    }
  } catch (e) {
    console.log('[BrowserBoot] Could not set cached server:', e.message);
  }

  // ── Mock loadJsonFunc (synchronous) ────────────────────────â”€
  // The game calls window.loadJsonFunc(key) synchronously to load
  // JSON data from the Egret resource system.
  //
  // Key format: "XXX_json" → URL from _resourceMap (pre-built
  // from default.res.json). The map handles all prefixes:
  //   language-cn_json  → /resource/language/language-cn.json
  //   heroEvolve_json   → /resource/json/heroEvolve.json
  //   1402_tex_json     → /resource/assets/.../1402_tex.json
  //
  // Without _resourceMap, we fall back to guessing the URL.
  var _jsonCache = {};

  function syncFetchJson(key) {
    // Use pre-built map if available
    var map = window._resourceMap || {};
    var url = map[key];

    if (!url) {
      // Strip _json suffix to get base path
      var path = key;
      if (path.slice(-5) === '_json') path = path.slice(0, -5);

      // Try #1: /resource/json/... (game data JSON files â€” 207 of them)
      var urls = [
        '/resource/json/' + path + '.json',
        '/resource/' + path + '.json',
      ];
    } else {
      var urls = [url];
    }

    for (var i = 0; i < urls.length; i++) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', urls[i], false); // synchronous
        xhr.overrideMimeType('application/json');
        xhr.send(null);
        if (xhr.status >= 200 && xhr.status < 300) {
          return JSON.parse(xhr.responseText);
        }
      } catch (e) {
        // Try next URL on failure
      }
    }
    console.warn('[BrowserBoot] loadJsonFunc:', key, 'failed all', urls.length, 'URLs');
    return {}; // empty stub to prevent null-ref crashes
  }

  window.loadJsonFunc = function (key) {
    if (_jsonCache[key] !== undefined) return _jsonCache[key];
    var data = syncFetchJson(key);
    _jsonCache[key] = data;
    return data;
  };

  // ── Pre-cache critical JSON data (async) ──────────────────â”€
  // Hero data is ~1.3MB and takes time to load via sync XHR.
  // Pre-fetch it so it's in cache when the game requests it.
  (function prefetchJson() {
    var keys = ['hero', 'heroWakeUp', 'heroLevelAttr', 'heroQualityParam', 'heroTypeParam', 'heroEvolve', 'constant', 'skill'];
    for (var i = 0; i < keys.length; i++) {
      (function (name) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/resource/json/' + name + '.json', true); // async
        xhr.overrideMimeType('application/json');
        xhr.onload = function () {
          if (xhr.status >= 200 && xhr.status < 300) {
            _jsonCache[name + '_json'] = JSON.parse(xhr.responseText);
            console.log('[BrowserBoot] Pre-cached:', name + '_json');
          }
        };
        xhr.onerror = function () {};
        xhr.send();
      })(keys[i]);
    }
  })();

  // ── Ensure HerosManager always has at least one hero ────â”€
  // We wrap readByData so herosInfo never ends up empty,
  // and poll to catch the initial empty state quickly.
  function injectDefaultHero(mgr) {
    if (!mgr || !mgr.herosInfo) return;
    // Check if herosInfo has entries
    var empty = true;
    for (var k in mgr.herosInfo) { empty = false; break; }
    if (!empty) return;

    // Inject a hero object — hero 1205 has real images (icon, stand, etc.)
    mgr.herosInfo[1] = {
      heroId: 1,
      heroDisplayId: 1205,
      heroStar: 1,
      expeditionMaxLevel: 0,
      heroLocalAttt: {
        typeIcon: 'new_skill_png',
        heroIconLong: 'hero_icon_1205_long_png',
        qualityIconLong: 'new_blue_long_png',
        qualityBar: 'new_blue_long_bar_png',
        qualityStand: 'new_blue_stand_png',
        heroName: 'Tortoise',
        quality: 'blue',
        heroStand: 'hero_stand_1205_png,hero_stand_1205',
        heroBack: 'hero_back_1205_png,hero_back_1205',
        heroPicture: 'hero_picture_1205,hero_picture_1205',
        mainTag: '',
        clientType: 'hero',
      },
      heroBaseAttr: {
        level: 1, exp: 0, power: 100,
        hp: 1000, attack: 50, armor: 25, speed: 10, maxlevel: 120,
      },
      heroClass: 0,
      heroType: 0,
      heroQuality: 5,
      skills: { allSkills: {} },
      // Match HeroDataModel defaults — checkHasLinkOnBattle reads
      // hero.linkTo.indexOf(...) and hero.linkFrom unguarded, so a
      // plain injected hero must carry these or the battle-list
      // refresh crashes with "reading 'indexOf' of undefined".
      linkTo: [],
      linkFrom: '',
    };
    // Also add to heroslist for getHeroList
    if (mgr.heroslist && Array.isArray(mgr.heroslist) && mgr.heroslist.indexOf(1) < 0) {
      mgr.heroslist.push(1);
    }
    console.log('[BrowserBoot] Injected default hero into herosInfo');
  }

  // Poll aggressively
  setInterval(function ensureHero() {
    try {
      var hm = window.egret && window.egret.getDefinitionByName && window.egret.getDefinitionByName('HerosManager');
      if (!hm || !hm.getInstance) return;
      var mgr = hm.getInstance();
      if (!mgr) return;
      // Patch readByData to re-inject hero after it runs
      if (mgr.readByData && !mgr._readByDataPatched) {
        var origRead = mgr.readByData;
        mgr.readByData = function (e) {
          origRead.call(this, e);
          injectDefaultHero(this);
        };
        mgr._readByDataPatched = true;
        console.log('[BrowserBoot] Patched readByData');
      }
      injectDefaultHero(mgr);
    } catch (e) {}
  }, 100);

  console.log('[BrowserBoot] Native bridge mock installed');

  // ── Patch sound methods after game scripts load ──────────
  // The game tries to play MP3 files through the Egret RES
  // module. Most sound resource keys are not registered in
  // default.res.json, so RES.getRes() returns undefined →
  // calling .play() on undefined crashes.
  //
  // We continuously patch all sound-related methods as they
  // get registered by the game scripts.
  function patchAllSound() {
    // 0. Patch addChild to safely handle null (DragonBones fallback)
    if (window.egret && window.egret.DisplayObjectContainer && window.egret.DisplayObjectContainer.prototype) {
      var _origAddChild = window.egret.DisplayObjectContainer.prototype.addChild;
      if (_origAddChild && !_origAddChild.__patched) {
        window.egret.DisplayObjectContainer.prototype.addChild = function (child) {
          if (!child) { return child; }
          return _origAddChild.call(this, child);
        };
        window.egret.DisplayObjectContainer.prototype.addChild.__patched = true;
      }
    }

    // 1a. Patch RES.getResByUrl to handle hero animation frames
    if (window.RES && window.RES.getResByUrl) {
      var origUrl = window.RES.getResByUrl;
      window.RES.getResByUrl = function (url, callback, thisObj, type) {
        // Hero stand animation frames (hero_stand_NNNN.10000 etc) don't exist
        if (typeof url === 'string' && url.match(/hero_stand_\d+\.\d+$/)) {
          var img = new window.egret.Texture();
          if (callback) callback.call(thisObj || this, img);
          return;
        }
        return origUrl.call(this, url, callback, thisObj, type);
      };
    }

    // 1b. Patch RES.getRes to return a safe stub for missing sounds
    if (window.RES && window.RES.getRes) {
      var orig = window.RES.getRes;
      window.RES.getRes = function (key) {
        var res = orig(key);
        if (res) return res;
        if (typeof key === 'string' && key.match(/_(mp3|wav|ogg)$/)) {
          // console.log('[BrowserBoot] RES.getRes stub for:', key);
          return { play: function () { return { volume: 0, once: function () {} }; } };
        }
        return res;
      };
    }
    // 2. No-op sound methods on any loaded class prototype
    for (var key in window) {
      var proto = window[key] && window[key].prototype;
      if (!proto) continue;
      var hasPlaySound = typeof proto.playSound === 'function';
      var hasPlayMusic = typeof proto.PlayMusic === 'function';
      var hasIphoneClick = typeof proto.iphoneClickMusic === 'function';
      if (hasPlaySound || hasPlayMusic || hasIphoneClick) {
        if (hasPlaySound) { proto.playSound = function () {};  }
        if (hasPlayMusic) { proto.PlayMusic = function () {}; }
        if (hasIphoneClick) { proto.iphoneClickMusic = function () {};
       }
      }
    }
  }

  // Run patch immediately and keep running every second
  // (game classes load asynchronously via Egret's require system)
  patchAllSound();
  setInterval(patchAllSound, 1000);

  // ── Patch setAllHeroList via Egret reflection ────────────
  // Ensure HeroList has at least one hero entry.
  setInterval(function patchSetAllHero() {
    try {
      var cls = window.egret && window.egret.getDefinitionByName && window.egret.getDefinitionByName('BattleStartViewData');
      if (!cls || !cls.prototype || cls.prototype.__SetAllHeroPatched) return;
      var orig = cls.prototype.setAllHeroList;
      if (typeof orig !== 'function') return;
      cls.prototype.setAllHeroList = function (e) {
        orig.call(this, e);
        if (!this.HeroList || this.HeroList.length === 0) {
          console.log('[BrowserBoot] HeroList empty after setAllHeroList â€” injecting default');
          this.HeroList = [{ isBattle: false, heroId: 1, lineUp: false, hasLinkOnBattle: false }];
        }
      };
      cls.prototype.__SetAllHeroPatched = true;
      console.log('[BrowserBoot] Patched setAllHeroList');
    } catch (e) {}
  }, 1500);

  // ── Disable ALL guide systems (novice tutorial, weaponCircle,
  //    teamDungeon, soulShop, arena, appraisal, ...) ────────────
  // Every guide path — GuideInfoManager.startGuide()'s own step
  // walk AND the various triggerXxxGuide()/triggerGuideByType()
  // helpers used elsewhere (e.g. Home.initAll's post-setup block)
  // — funnels through TSUIController.prototype.openGuide() to
  // build a TSGuideWindow mask. Neutering that single choke point
  // blocks every guide mask regardless of which system triggers
  // it, instead of chasing each guide type's completion step.
  //
  // (Earlier attempt forced GuideInfoManager.startGuide() itself to
  // return true. That made Home.initAll's `0!=startGuide()` check
  // always pass, which unblocked ITS OWN follow-up block that probes
  // other guide lines — weaponCircle/teamDungeon/soulShop — that we
  // hadn't marked complete, so THEY fired openGuide() and left an
  // untouchable full-screen mask. Patching openGuide directly avoids
  // needing to enumerate every guide line's completion step.)
  setInterval(function patchGuide() {
    try {
      var cls = window.egret && window.egret.getDefinitionByName && window.egret.getDefinitionByName('TSUIController');
      if (!cls || !cls.prototype || cls.prototype.__OpenGuidePatched) return;
      if (typeof cls.prototype.openGuide !== 'function') return;
      cls.prototype.openGuide = function () {};
      cls.prototype.__OpenGuidePatched = true;
      console.log('[BrowserBoot] Guide system disabled (openGuide no-op)');
    } catch (e) {}
  }, 200);

  // ── Patch imageAnimation on any prototype ────────────────
  // heroStand uses "image_png,animBase" format. If animBase
  // is undefined, imageAnimation crashes on .slice().
  // Guard the input parameter.
  setInterval(function patchImageAnim() {
    for (var k in window) {
      var p = window[k] && window[k].prototype;
      if (!p || typeof p.imageAnimation !== "function" || p.__imgAnimPatched) continue;
      (function (orig) {
        p.imageAnimation = function (e, t, n, o, a) {
          if (!e || typeof e !== "string") { return Promise.resolve(); }
          return orig.call(this, e, t, n, o, a);
        };
      })(p.imageAnimation);
      p.__imgAnimPatched = true;
      console.log("[BrowserBoot] Patched imageAnimation");
    }
  }, 2000);

  // ── Patch TSDragonBones.createArmature ────────────────────
  // When a DragonBones ske.json is missing, createArmature
  // returns null → .animation.play() on null crashes.
  // We wrap createArmature to return a dummy sprite.
  setInterval(function patchDragonBones() {
    try {
      var cls = window.egret && window.egret.getDefinitionByName && window.egret.getDefinitionByName('TSDragonBones');
      if (!cls) return;
      var inst = cls.Instance && cls.Instance();
      if (!inst || inst.__createArmPatched) return;
      var origCreate = inst.createArmature;
      if (typeof origCreate !== 'function') return;
      inst.createArmature = function (name, x, y) {
        var result = origCreate.call(this, name, x, y);
        if (result) return result;
        console.log('[BrowserBoot] DB dummy for:', name);
        var dummy = new window.egret.Sprite();
        dummy.animation = { play: function () {}, stop: function () {} };
        dummy.once = function (evt, fn, t) { if (fn) setTimeout(fn.bind(t || this), 100); };
        return dummy;
      };
      inst.__createArmPatched = true;
      console.log('[BrowserBoot] Patched TSDragonBones.createArmature');
    } catch (e) {}
  }, 2000);
})();

