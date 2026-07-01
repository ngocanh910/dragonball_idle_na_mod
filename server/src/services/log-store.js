// ============================================================
// Log Store — Centralized in-memory log buffer
// Stores recent requests, errors, and server stats for the
// debug dashboard.
// ============================================================

const MAX_ENTRIES = 200;

let logs = [];
let id = 0;

// ── Stats ────────────────────────────────────────────────────
const stats = {
  totalRequests: 0,
  totalErrors: 0,
  totalSocketEvents: 0,
  startTime: Date.now(),
  byType: {},          // e.g. { hero: 42, player: 18 }
  byStatus: {},        // e.g. { "200": 100, "500": 3 }
  responseTimes: [],   // last 100 response times in ms
};

// ── Add a log entry ──────────────────────────────────────────

/**
 * @param {object} entry
 * @param {'info'|'warn'|'error'} entry.level
 * @param {string} entry.tag        e.g. '[API]', '[Config]', '[Socket]'
 * @param {string} entry.message
 * @param {string} [entry.method]   HTTP method
 * @param {string} [entry.path]     Request path
 * @param {number} [entry.status]   HTTP status code
 * @param {number} [entry.duration] Response time in ms
 * @param {object} [entry.error]    Error object
 */
function addLog({ level = 'info', tag = '[Server]', message = '', method, path, status, duration, error }) {
  const entry = {
    id: ++id,
    timestamp: Date.now(),
    level,
    tag,
    message,
    method: method || null,
    path: path || null,
    status: status || null,
    duration: duration || null,
    error: error ? { message: error.message, stack: error.stack } : null,
  };

  logs.unshift(entry);
  if (logs.length > MAX_ENTRIES) {
    logs = logs.slice(0, MAX_ENTRIES);
  }

  // Update stats
  if (status) {
    stats.byStatus[String(status)] = (stats.byStatus[String(status)] || 0) + 1;
  }
  if (duration) {
    stats.responseTimes.push(duration);
    if (stats.responseTimes.length > 100) stats.responseTimes.shift();
  }
  if (level === 'error') {
    stats.totalErrors++;
  }
}

// ── Convenience methods ──────────────────────────────────────

function info(tag, message, extra) {
  addLog({ level: 'info', tag, message, ...extra });
}

function warn(tag, message, extra) {
  addLog({ level: 'warn', tag, message, ...extra });
}

function error(tag, message, extra) {
  addLog({ level: 'error', tag, message, ...extra });
}

// ── Query methods ────────────────────────────────────────────

/** Return last n log entries. */
function getRecent(n = 50) {
  return logs.slice(0, n);
}

/** Return only error entries. */
function getErrors() {
  return logs.filter((e) => e.level === 'error');
}

/** Return aggregated stats. */
function getStats() {
  const uptimeMs = Date.now() - stats.startTime;
  const avgResponse = stats.responseTimes.length > 0
    ? Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length)
    : 0;
  const p95 = stats.responseTimes.length > 0
    ? stats.responseTimes.slice().sort((a, b) => a - b)[Math.floor(stats.responseTimes.length * 0.95)]
    : 0;

  return {
    uptimeMs,
    uptimeFormatted: formatUptime(uptimeMs),
    totalRequests: stats.totalRequests,
    totalErrors: stats.totalErrors,
    totalSocketEvents: stats.totalSocketEvents,
    avgResponseMs: avgResponse,
    p95ResponseMs: p95,
    byType: { ...stats.byType },
    byStatus: { ...stats.byStatus },
  };
}

/** Reset all stats and logs. */
function reset() {
  logs = [];
  id = 0;
  stats.totalRequests = 0;
  stats.totalErrors = 0;
  stats.totalSocketEvents = 0;
  stats.startTime = Date.now();
  stats.byType = {};
  stats.byStatus = {};
  stats.responseTimes = [];
}

// ── Helpers ──────────────────────────────────────────────────

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

module.exports = { addLog, info, warn, error, getRecent, getErrors, getStats, reset, stats };
