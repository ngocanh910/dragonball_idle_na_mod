# Development Roadmap

This document outlines the development roadmap, milestones, and phases for the Dragon Ball Idle modding and emulation platform.

## Current Phase: Phase 2 - Web App Unified Development Environment
Status: Complete (2026-07-01)

### Milestones Completed
- Milestone 1: Reverse engineering native decryption logic from Android APK (libgavesec.so). (Complete)
- Milestone 2: Full decryption and extraction of voyage/launcher and game source JS/JSON modules. (Complete)
- Milestone 3: Initial server implementation (Node.js/Express/Socket.IO) serving mock API endpoints. (Complete)
- Milestone 4: Refactoring both components (server + decrypted client assets) into a unified web application. (Complete)
  - Created client/ folder with static index.html and native bridge mock (browser-boot.js).
  - Modified server config and Express router to serve client assets dynamically under cascade routes.
  - Set up root package.json and smoke testing suite.

## Next Phase: Phase 3 - Reverse Engineering & Mocking Advanced Game Mechanics
Status: Pending

### Goals
- Reverse engineer and mock battle logic loop on the server side to allow offline battle simulation.
- Reverse engineer other game modules (dungeons, quests, arena rankings, guilds, gacha summons) and mock their handlers.
- Analyze client-server WebSocket frames for real-time multiplayer mock configurations.

## Future Phase: Phase 4 - Advanced Modding Interface
Status: Pending

### Goals
- Build a web-based mod manager interface on the Express debug dashboard.
- Support runtime activation, deactivation, and configuration of mods.
- Create more complex gameplay mod templates.
