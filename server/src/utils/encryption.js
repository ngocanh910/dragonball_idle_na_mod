// ============================================================
// Encryption Utilities
// Mirrors the game's XXTEA / native AES for asset handling.
// ============================================================

const crypto = require('crypto');

/**
 * Simulate XXTEA decryption for game assets.
 * The original game uses a custom XXTEA with key derived from
 * "onepiecedecryptk" XOR'd with additional key material.
 *
 * @param {Buffer} data - Encrypted data
 * @param {string} key - Decryption key
 * @returns {Buffer} Decrypted data
 */
function xxteaDecrypt(data, key) {
  // Placeholder — the actual XXTEA implementation lives in
  // libgavesec.so via JNI.  This wrapper exists so mod tooling
  // can call it uniformly after the native logic is ported.
  throw new Error('XXTEA native decrypt not yet ported to JS');
}

/**
 * MD5 hash helper (used by the game for various checksums).
 */
function md5(input) {
  return crypto.createHash('md5').update(String(input)).digest('hex');
}

/**
 * Simple XOR cipher used in asset name obfuscation.
 */
function xorDecrypt(data, key) {
  const buf = Buffer.from(data, 'binary');
  const keyBytes = Buffer.from(key, 'utf-8');
  for (let i = 0; i < buf.length; i++) {
    buf[i] ^= keyBytes[i % keyBytes.length];
  }
  return buf;
}

module.exports = { xxteaDecrypt, md5, xorDecrypt };
