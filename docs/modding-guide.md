# Modding Guide

## Giới thiệu

Mod system cho phép bạn intercept và thay đổi response của server mà không cần sửa code server.  
Mỗi mod là một file JavaScript được load tự động khi server khởi động.

## Mod API

### Hook Events

Mods sử dụng hook system từ `mods/api.js`:

```javascript
const { on } = require('../api');
```

| Event | Args | Description |
|-------|------|-------------|
| `handler:player` | `(payload, response)` | Intercept player/user data |
| `handler:hero` | `(payload, response)` | Intercept hero data |
| `handler:item` | `(payload, response)` | Intercept item/backpack data |
| `socket:handler.process` | `(data)` | Intercept socket RPC |

### Ví dụ 1: Unlimited Diamonds

```javascript
// mods/examples/unlimited-diamonds.js
const { on } = require('../api');

const name = 'Unlimited Diamonds';
let unsub = null;

function enable() {
  unsub = on('handler:player', (_payload, response) => {
    if (response.data) {
      const data = typeof response.data === 'string'
        ? JSON.parse(response.data)
        : response.data;

      data.diamond = 999999999;
      data.gold = 999999999;
      data.stamina = 9999;

      response.data = JSON.stringify(data);
    }
    return [response];
  });
}

function disable() {
  if (unsub) { unsub(); unsub = null; }
}

module.exports = { name, enable, disable };
```

### Ví dụ 2: Unlock All Heroes

```javascript
// mods/examples/unlock-all-heroes.js
const { on } = require('../api');
const gameData = require('../../game-data');

const name = 'Unlock All Heroes';
let unsub = null;

function enable() {
  unsub = on('handler:hero', (_payload, response) => {
    if (response.data) {
      const data = typeof response.data === 'string'
        ? JSON.parse(response.data)
        : response.data;

      if (data.heros) {
        data.heros = gameData.list('hero').map(h => ({
          ...h, userId: 1001, level: 100, star: 7,
        }));
        data.total = data.heros.length;
      }

      response.data = JSON.stringify(data);
    }
    return [response];
  });
}

function disable() { /* ... */ }

module.exports = { name, enable, disable };
```

## Cấu trúc một Mod

Mỗi mod là một CommonJS module với:

```javascript
module.exports = {
  name: 'Tên Mod',           // Tên hiển thị
  enable: function() { },    // Được gọi khi mod được load
  disable: function() { },   // Được gọi khi mod bị unload (tùy chọn)
};
```

- `enable()` — đăng ký hooks, thiết lập state
- `disable()` — dọn dẹp, unsubscribe hooks

## Game Data API

Mods có thể truy xuất game data qua module `game-data`:

```javascript
const gameData = require('../../game-data');

gameData.collection('hero')      // Raw collection object
gameData.list('skill')            // Array of all skills
gameData.find('hero', 1)          // Find by ID
gameData.query('item', e => e.rarity === 5)  // Query with predicate
gameData.stats()                  // Entry counts per collection
gameData.collections()            // All collection names
```

## Tạo Mod Mới

1. Tạo file `.js` trong `mods/examples/`
2. Export `{ name, enable, disable }`
3. Sử dụng `on()` để đăng ký hooks
4. Sử dụng `gameData` API nếu cần

Mods được load tự động khi server start.  
Để disable mod system: `MODS_ENABLED=false npm start`

## Testing Mods

Sử dụng debug client để test mod response:

```bash
# Test player data (với mod unlimited-diamonds)
node tools/debug-client.js login

# Test hero list (với mod unlock-all-heroes)
node tools/debug-client.js hero list
```
