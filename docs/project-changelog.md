# Project Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-07-01
### Added
- Unified client-server architecture overlay in `/client/` directory.
- `client/index.html` as the main entry point to load the Egret engine and client scripts locally.
- `client/browser-boot.js` mock script implementing a browser-compatible JNI native bridge mock. This mock intercepts ExternalInterface calls (`startTsGame`, `changeView`, `enterGame`, `sendLog`, `peiNative`) and automates the engine initialization payload, enabling gameplay debugging in any web browser without an Android device.
- Root `package.json` with npm scripts for startup (`npm start`, `npm run dev`), inspect/debug mode (`npm run debug`), and smoke test execution.
- Automated smoke testing suite in `test/smoke.test.js` verifying static client asset serving, API endpoints, and JNI config payloads.

### Changed
- `server/src/index.js` modified to mount static routes for the `client/` folder, as well as cascading static directories for `/js` and `/resource` mapping directly to the decrypted game assets folders (`voyage_extracted` and `game_source`).
- `server/src/config/index.js` updated to include directory paths for the unified client (`clientDir`), voyage bootstrapper (`voyageDir`), and game source assets (`gameSourceDir`).
