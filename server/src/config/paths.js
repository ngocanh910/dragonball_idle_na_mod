// ============================================================
// Filesystem Paths
// Single source of truth for repo paths. Previously each route
// re-derived these with path.resolve(__dirname, '..', '..', '..').
// ============================================================

const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');

module.exports = {
  repoRoot,

  // Decrypted game assets (regenerable from the APK)
  decryptedDir: path.join(repoRoot, 'decrypted_assets'),
  gameDataDir: path.join(repoRoot, 'decrypted_assets', 'game_source', 'resource', 'json'),
  gameSourceDir: path.join(repoRoot, 'decrypted_assets', 'game_source'),
  voyageDir: path.join(repoRoot, 'decrypted_assets', 'voyage_extracted'),

  // Bundled assets & real art pulled from a device cache
  assetsDir: path.join(repoRoot, 'assets'),
  assetsGameDir: path.join(repoRoot, 'assets', 'game'),
  realArtDir: path.join(repoRoot, 'real-art', 'resource'),

  // Game client (browser)
  clientDir: path.join(repoRoot, 'client'),

  // Mod system
  modsDir: path.join(repoRoot, 'mods'),
};
