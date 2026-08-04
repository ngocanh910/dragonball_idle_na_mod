// ============================================================
// deep-diff — structural compare of two JSON values.
// VOLATILE_KEYS: keys that legitimately change between sessions
// (timestamps, signatures, random ids) — excluded from comparison.
// Returns { same: boolean, mismatches: [{path, expected, got}] }.
// ============================================================
export const VOLATILE_KEYS = new Set([
  'serverTime', '_lastLoginTime', '_createTime', 'sign', 'ts', 'id', 'seq', 'session', 'token',
]);

export function diffValues(a, b, volatile = VOLATILE_KEYS, path = []) {
  if (typeof a !== typeof b) return { same: false, mismatches: [{ path, expected: a, got: b }] };
  if (a === null || b === null) {
    return a === b ? { same: true, mismatches: [] } : { same: false, mismatches: [{ path, expected: a, got: b }] };
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return { same: false, mismatches: [{ path, expected: a, got: b }] };
    const ms = [];
    for (let i = 0; i < a.length; i++) ms.push(...diffValues(a[i], b[i], volatile, [...path, i]).mismatches);
    return { same: ms.length === 0, mismatches: ms };
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ms = [];
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (volatile.has(k)) continue;
      if (!(k in b) || !(k in a)) { ms.push({ path: [...path, k], expected: a[k], got: b[k] }); continue; }
      ms.push(...diffValues(a[k], b[k], volatile, [...path, k]).mismatches);
    }
    return { same: ms.length === 0, mismatches: ms };
  }
  if (a !== b) return { same: false, mismatches: [{ path, expected: a, got: b }] };
  return { same: true, mismatches: [] };
}
