// ============================================================
// HTTP Response Helpers
// ============================================================

const LZString = require('lz-string');

/**
 * Build a success response.
 * When compress is true, the data payload is LZ-UTF16 compressed
 * as the original game expects.
 */
function success(data, compress = false) {
  if (compress) {
    const compressed = LZString.compressToUTF16(JSON.stringify(data));
    return { ret: 0, data: compressed, compress: true };
  }
  return { ret: 0, data: JSON.stringify(data) };
}

/**
 * Build an error response.
 * @param {number} retCode - Error code (default 1)
 * @param {string} message - Error description
 */
function fail(retCode = 1, message = 'error') {
  return { ret: retCode, message };
}

module.exports = { success, fail };
