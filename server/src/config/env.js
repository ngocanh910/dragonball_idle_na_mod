// ============================================================
// Environment Configuration
// Loads server/.env via Node's native .env loader (no dotenv dep),
// then exposes typed runtime config. Real env vars already set in
// the process take precedence (Node does not override them).
// ============================================================

const fs = require('fs');
const path = require('path');

const envFile = path.resolve(__dirname, '..', '..', '.env');
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 8080,
  host: process.env.HOST || '0.0.0.0',

  // Public hostname for client-facing URLs (must be resolvable by browser)
  publicHost: process.env.PUBLIC_HOST || '127.0.0.1',

  // Game configuration
  serverName: process.env.SERVER_NAME || 'Local Emulator',
  defaultServerId: parseInt(process.env.DEFAULT_SERVER_ID, 10) || 1,

  // Mod system
  modsEnabled: process.env.MODS_ENABLED !== 'false',

  // Debug mode
  debug: process.env.DEBUG === 'true',

  // CDN backfill for missing art (media/cdn-backfill.js)
  cdnBase: process.env.CDN_BASE || 'https://dragonh5cdn.popoh5.com/bs/resource',
  cdnBackfill: process.env.CDN_BACKFILL !== 'false',
};
