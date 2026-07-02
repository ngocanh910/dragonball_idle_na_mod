// ============================================================
// Server Configuration
// ============================================================

const path = require('path');

const config = {
  port: parseInt(process.env.PORT, 10) || 8080,
  host: process.env.HOST || '0.0.0.0',

  // Public hostname for client-facing URLs (must be resolvable by browser)
  publicHost: process.env.PUBLIC_HOST || '127.0.0.1',

  // Game data paths
  gameDataDir: path.resolve(__dirname, '..', '..', '..', 'decrypted_assets', 'game_source', 'resource', 'json'),
  assetsDir: path.resolve(__dirname, '..', '..', '..', 'assets'),
  clientDir: path.resolve(__dirname, '..', '..', '..', 'client'),
  voyageDir: path.resolve(__dirname, '..', '..', '..', 'decrypted_assets', 'voyage_extracted'),
  gameSourceDir: path.resolve(__dirname, '..', '..', '..', 'decrypted_assets', 'game_source'),

  // Game configuration
  serverName: 'Local Emulator',
  defaultServerId: 1,

  // Mod system
  modsDir: path.resolve(__dirname, '..', '..', '..', 'mods'),
  modsEnabled: process.env.MODS_ENABLED !== 'false',

  // Debug mode
  debug: process.env.DEBUG === 'true',
};

module.exports = config;
