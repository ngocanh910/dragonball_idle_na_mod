# Research Report: Refactoring Game Server and Reverse Engineered Client into a Unified Web Project

## Executive Summary
This report analyzes the feasibility and methodology of refactoring the "Dragon Ball Idle" reverse-engineered codebase (Android/Smali/Dex assets) and its custom Node.js emulator server into a single, unified web-based application project. 

The game client is an HTML5/Canvas application compiled using the Egret Engine. Currently, testing and debugging require patching Smali code, rebuilding the APK, signing, installing onto an Android device, and connecting via local WiFi to the custom Node.js backend. 

We conclude that it is fully feasible to merge both components into a single Node.js/Express project. By serving the decrypted HTML5 game assets statically and mocking the native Android-JS bridge interface in the browser context, developers can run, debug, and test both frontend game logic and backend API endpoints entirely in a standard desktop web browser (e.g., Chrome/Firefox) without compiling any APK.

## Research Methodology
- Sources consulted: Codebase files (20+ server scripts, decrypted JS modules, index.html, apktool assets, smali files, architecture documents).
- Date of research: 2026-07-01
- Key search terms: Egret Engine, JNI external interface, WebView debug, Node.js static routes, Express web server.

## Key Findings

### 1. Technology Overview
The project is split into:
1. **Frontend Game Client**: An Egret HTML5 game compiled into minified/packaged JavaScript (`decrypted_assets/game_source/js/main.min_7eae4d6e.js` (4.5 MB), engine libraries, and 434 JSON configuration files). The original Android app runs this using a WebView component and passes settings/authentication events via JNI using `egret.ExternalInterface`.
2. **Backend Emulator Server**: A Node.js/Express and Socket.IO (v2) server located in `/server`. It processes login, character lists, inventories, and gacha events, and is designed to run in memory using game database JSONs.

### 2. Native Bridge Interception
In the Android app, the Java/Kotlin code communicates with the Egret JS context through `egret.ExternalInterface.call` and `egret.ExternalInterface.addCallback`.
From `voyage_extracted/index.html`:
```javascript
egret.ExternalInterface.addCallback("startTsGame", function (msg) {
    var json = JSON.parse(msg);
    window["screenSize"] = json.screenSize;
    window["versionConfig"] = json.versionConfig;
    window["uid"] = json.uid;
    window["autoStart"] = json.autoStart;
    egret.runEgret({ ... });
});
egret.ExternalInterface.call("startTsGame", "start ts game");
```
When running inside a normal web browser, `egret.ExternalInterface` fails or does not execute the Java bridge. By overriding the `egret.ExternalInterface` JNI bridge at runtime in our web-served `index.html`, we can simulate the JNI callback with mock parameters. This will boot the game engine inside the browser.

### 3. Serving Decrypted Game Assets
The Express server can serve the client's assets using static routing:
- Root files (`index.html`, engine files): `/decrypted_assets/voyage_extracted`
- Game sources (`main.min.js`, resources, language files): `/decrypted_assets/game_source`
- Static game assets (images, audio): `/assets` (which contains images and assets from the APK build)

By consolidating these directories under a single server folder (or mounting multiple static directories in Express), the client will be able to load all scripts, styles, textures, and JSON files directly from the local server.

## Comparative Analysis of Workflows

| Characteristic | Existing Smali/APK Workflow | Proposed Unified Web App Workflow |
|---|---|---|
| **Testing Device** | Android device or emulator | Standard web browser |
| **Feedback Loop** | 3-5 minutes (apktool b -> zipalign -> sign -> adb install) | Immediate (1 second page refresh) |
| **Debugging Tools** | Android Logcat, Toast popups (via smali patches) | Chrome DevTools (Console, Sources, Network, breakpoints) |
| **Networking** | Traced through local WiFi server logs | Network tab in browser, raw Socket.IO frame logs |
| **Automation & Tests** | Manual clicks on physical/virtual screen | standard Jest/Playwright/Cypress end-to-end testing |

## Implementation Recommendations

### Quick Start Guide to Unified Web App
1. **Combine assets into public folder**: Serve `decrypted_assets/voyage_extracted` and `decrypted_assets/game_source` statically on the server.
2. **Modify client bootstrapper**: Edit the server's copy of `index.html` (or inject a script) to intercept `egret.ExternalInterface.call("startTsGame", ...)` and trigger the callback with custom mock parameters:
   ```javascript
   // Faked parameters for web running
   const mockPayload = {
     screenSize: { width: 720, height: 1280 },
     versionConfig: { version: "1.0.0" },
     uid: "test_local_user",
     autoStart: true
   };
   
   // Call the registered callback directly
   setTimeout(() => {
     const callback = window.egret && window.egret.ExternalInterface && window.egret.ExternalInterface.getCallback("startTsGame");
     if (callback) {
       callback(JSON.stringify(mockPayload));
     }
   }, 500);
   ```
3. **Route assets correctly**: Map resource requests targeting remote domain paths to local static endpoints on the Express server.

### Common Pitfalls
- **CORS Policies**: Browser strict CORS could block some requests if assets are served on different ports. Consolidating under a single port (e.g., 8080) fixes this.
- **Minified Client Obfuscation**: The client code `main.min.js` is highly obfuscated. Finding specific game logic might require source-map generation or selective de-obfuscation, but serving it is unaffected.
- **WebSocket Protocol Versioning**: The game uses Socket.IO v2. Compatibility must be maintained on the server.

## Resources & References
- Egret Engine documentation on `ExternalInterface`
- Express `express.static` API specifications
- Chrome DevTools WebView debugging guides

## Appendices

### A. Unresolved Questions
1. Are there any resource files loaded via native Android code (e.g., assets inside `res/` or encrypted with custom `nativeAES` keys) that the web server does not have access to?
2. Does the game client make additional native bridge calls during gameplay (like billing, social login sharing, or network state queries) that will cause crash loops if left un-mocked? We must write a comprehensive Native Bridge Interceptor to catch all calls.
