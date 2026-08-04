# Phase 1: Fix `syncFetchJson` Fallback URL in `browser-boot.js`

## Overview
Fix the `syncFetchJson()` function's fallback URL construction so game data JSON keys are resolved to the correct `/resource/json/` path instead of the incorrect `/resource/` path.

## The Problem
The current fallback generates:
```
Key: "abilityName_json" → URL: /resource/abilityName.json ❌
```
But the actual file is:
```
Key: "abilityName_json" → URL: /resource/json/abilityName.json ✅
```

## Implementation

### Step 1: Update `syncFetchJson` in `client/browser-boot.js`

Replace the fallback URL logic (lines ~198-203) to handle both types of resources:

**Current code:**
```javascript
if (!url) {
  // Fallback: guess pattern (won't work for most resources)
  var path = key;
  if (path.slice(-5) === '_json') path = path.slice(0, -5);
  url = '/resource/' + path + '.json';
}
```

**New code:**
```javascript
if (!url) {
  // Fallback: try multiple paths
  var path = key;
  if (path.slice(-5) === '_json') path = path.slice(0, -5);

  // Try 1: /resource/json/... (game data JSON files)
  url = '/resource/json/' + path + '.json';
  var fallbackUrl = '/resource/' + path + '.json';
}
```

And update the XHR logic to try the second URL if the first fails:

```javascript
try {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, false);
  xhr.overrideMimeType('application/json');
  xhr.send(null);
  if (xhr.status >= 200 && xhr.status < 300) {
    return JSON.parse(xhr.responseText);
  }
  // Try fallback URL for non-game-data resources
  if (fallbackUrl) {
    xhr.open('GET', fallbackUrl, false);
    xhr.overrideMimeType('application/json');
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) {
      return JSON.parse(xhr.responseText);
    }
  }
  console.warn('[BrowserBoot] loadJsonFunc:', key, 'HTTP', xhr.status);
} catch (e) { ... }
```

### Alternative simpler fix:
If the above is too complex, the simplest fix that will work for 99% of cases is just changing the fallback prefix from `/resource/` to `/resource/json/`:

```javascript
url = '/resource/json/' + path + '.json';  // instead of '/resource/' + path + '.json'
```

This works because 207/209 game data JSONs are in the `json/` subdirectory. The 2 missing ones (`backLoading`, `cellGameTimesBuy`) will be handled in Phase 2.

### Step 2: Update `_resourceMap` check
Also add a second lookup in `_resourceMap` with a `.json` suffix, since some keys in the resource map use `_json` suffix while the game looks them up directly:

```javascript
// Also try the map without _json suffix
if (!url) {
  var baseKey = key.replace('_json', '');
  url = map[baseKey] || null;
}
```

## Success Criteria
- All 207 game data JSON files load successfully when game enters main state
- No "Cannot read properties of null" crashes
- Browser console shows no `loadJsonFunc` warnings for game data
