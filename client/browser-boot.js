// ============================================================
// Browser Boot — Native Bridge Mock for Egret Engine
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

  // ── Mock addCallback ─────────────────────────────────────
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
        console.log('[BrowserBoot] Game requested startTsGame — triggering boot');
        triggerGameBoot();
        break;

      case 'sendLog':
        // Analytics/telemetry log — safe to ignore
        // console.log('[BrowserBoot] sendLog:', data);
        break;

      case 'peiNative':
        // In-app purchase request — simulate instant success
        console.log('[BrowserBoot] Purchase requested:', data);
        simulatePurchase(data);
        break;

      default:
        console.log('[BrowserBoot] Unhandled native call:', name, data);
        break;
    }
  }

  // ── Boot the game engine ─────────────────────────────────
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

  // ── Simulate in-app purchase ─────────────────────────────
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

  // ── Also mock egret_native if referenced ─────────────────
  window.egret_native = window.egret_native || {
    NativeDisplayObject: {
      setSourceToNativeBitmapData: function () {},
    },
  };

  // ── Mock window.getLoginServer ─────────────────────────
  // The game calls this to get the server URL for connecting.
  window.getLoginServer = function () {
    var host = window.location.host || 'localhost:8080';
    var url = 'http://' + host;
    console.log('[BrowserBoot] getLoginServer() →', url);
    return url;
  };

  // ── Mock window.getQueryStringByName ────────────────────
  // The game uses this to parse URL query parameters.
  window.getQueryStringByName = function (name) {
    var match = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : null;
  };

  // ── Mock window.getAppId ────────────────────────────────
  // The game uses this to get the channel/app ID.
  window.getAppId = function () {
    return 'local_browser';
  };

  // ── Mock window.serverList ─────────────────────────────
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

  console.log('[BrowserBoot] Native bridge mock installed');
})();
