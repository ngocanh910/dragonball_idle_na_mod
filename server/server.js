const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// ============================================================
// DRAGON BALL IDLE - LOCAL EMULATOR SERVER
// ============================================================

const PORT = 8080;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '50mb' }));

// ---------- HELPERS ----------

const LZString = require('lz-string');

function successResponse(data, compress = false) {
    if (compress) {
        const compressed = LZString.compressToUTF16(JSON.stringify(data));
        return { ret: 0, data: compressed, compress: true };
    }
    return { ret: 0, data: JSON.stringify(data) };
}

function errorResponse(retCode = 1, msg = 'error') {
    return { ret: retCode, message: msg };
}

// ---------- LOAD GAME DATA ----------
const gameDataDir = path.join(__dirname, '..', 'decrypted_assets', 'game_source', 'resource', 'json');
let gameData = {};
let gameDataLoaded = false;

function loadGameData() {
    if (!fs.existsSync(gameDataDir)) {
        console.log('WARN: Game data directory not found:', gameDataDir);
        return;
    }
    const files = fs.readdirSync(gameDataDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
        try {
            const name = path.basename(file, '.json');
            const data = JSON.parse(fs.readFileSync(path.join(gameDataDir, file), 'utf-8'));
            gameData[name] = data;
            gameDataLoaded = true;
            console.log(`  Loaded: ${file} (${Object.keys(data).length} keys)`);
        } catch (e) {
            console.log(`  Skipped: ${file} (parse error)`);
        }
    }
    console.log(`  Total: ${files.length} files, ${Object.keys(gameData).length} loaded`);
}

console.log('\n--- Loading Game Data ---');
loadGameData();

// ---------- HTTP API ----------

// Native Android config endpoint
app.get('/lzceshi/native_setting/Android/setting_Android.bin', (req, res) => {
    console.log('[CONFIG] GET setting_Android.bin');
    // Returns the server-side version config
    const config = {
        sdkName: '',
        versionCode: 110,
        noticeList: [],
        maintain: { status: false },
        serverList: [
            {
                sid: "local",
                name: "Local Server",
                url: `http://127.0.0.1:${PORT}`,
                dungeonurl: `http://127.0.0.1:${PORT}`,
                chaturl: `http://127.0.0.1:${PORT}`,
                status: "smooth",
                new: true,
                recommend: true,
                serverId: 1,
                offlineReason: "",
                online: true
            }
        ],
        maxVersionCode: 110,
        minVersionCode: 1,
        updateUrl: "",
        forceUpdate: false,
        review: false
    };
    res.json(config);
});

app.get('/lzceshi/native_setting/Android/com.guan.wangys.bin', (req, res) => {
    console.log('[CONFIG] GET com.guan.wangys.bin');
    res.json({
        version: 1,
        sdkConfig: {}
    });
});

// Login check endpoint (called by native Android)
app.all('/lzceshi/native_setting/Android/loginchecknative', (req, res) => {
    const params = req.query;
    console.log('[LOGIN] loginchecknative params:', JSON.stringify(params).substring(0, 200));

    // Return success - the native code will then pass user info to game JS
    res.json({
        code: 0,
        msg: 'success',
        loginServer: `http://127.0.0.1:${PORT}`,
        serverUrl: `http://127.0.0.1:${PORT}`,
        socketUrl: `http://127.0.0.1:${PORT}`,
        teamServerHttpUrl: `http://127.0.0.1:${PORT}`
    });
});

// Game HTTP API - main handler for all game data requests
app.post('/api', (req, res) => {
    // The game sends data as form-urlencoded with "data={...}"
    let rawData = req.body.data || req.body;
    let payload;

    if (typeof rawData === 'string') {
        try { payload = JSON.parse(rawData); }
        catch (e) { payload = rawData; }
    } else {
        payload = rawData;
    }

    const type = payload.type || 'unknown';
    const action = payload.action || 'unknown';
    console.log(`[API] type=${type}, action=${action}`, JSON.stringify(payload).substring(0, 150));

    handleGameRequest(payload, res);
});

// Also handle direct POST for game requests
app.post('/*', (req, res) => {
    let rawData = req.body.data || req.body;
    let payload;
    if (typeof rawData === 'string') {
        try { payload = JSON.parse(rawData); } catch (e) { payload = { raw: rawData }; }
    } else {
        payload = rawData;
    }
    const type = payload.type || 'unknown';
    const action = payload.action || 'unknown';
    console.log(`[API-GENERIC] ${req.path} type=${type}, action=${action}`);
    handleGameRequest(payload, res);
});

// ---------- REQUEST HANDLER ----------

function handleGameRequest(payload, res) {
    const type = payload.type || '';
    const action = payload.action || '';

    try {
        // Login / User info
        if (type === 'login') {
            return res.json(successResponse({
                userId: payload.userId || 1001,
                serverId: 1,
                serverName: 'Local Server',
                sign: 'local_signature',
                nickname: 'Player',
                level: 50,
                vip: 5,
                gold: 999999,
                diamond: 99999,
                stamina: 120,
                exp: 0,
               战斗力: 50000,
                serverItem: {
                    url: `http://127.0.0.1:${PORT}`,
                    dungeonurl: `http://127.0.0.1:${PORT}`,
                    chaturl: `http://127.0.0.1:${PORT}`,
                    serverId: 1,
                    online: true,
                    offlineReason: '',
                    worldRoomId: 'room1',
                    guildRoomId: 'guild1',
                    teamChatRoomId: 'team1',
                    teamDungeonChatRoom: 'teamDungeon1'
                },
                serverTime: Date.now() / 1000
            }));
        }

        // Player data
        if (type === 'player' || type === 'user') {
            if (action === 'info' || action === 'getInfo') {
                return res.json(successResponse({
                    userId: 1001,
                    nickname: 'Player',
                    level: 50,
                    vip: 5,
                    gold: 999999,
                    diamond: 99999,
                    stamina: 120,
                    exp: 0,
                    fightPower: 50000,
                    avatar: 1
                }));
            }
        }

        // Hero list
        if (type === 'hero') {
            const heroData = gameData['hero'] || {};
            return res.json(successResponse({
                heros: Object.values(heroData).slice(0, 20).map((h, i) => ({
                    ...h,
                    userId: 1001,
                    level: 50,
                    star: 5,
                    exp: 0,
                    equipment: {}
                })),
                total: Object.keys(heroData).length
            }));
        }

        // Backpack / Items
        if (type === 'backpack' || type === 'item' || type === 'bag') {
            const thingsData = gameData['thingsID'] || {};
            const items = Object.entries(thingsData).slice(0, 50).map(([id, item]) => ({
                id: parseInt(id),
                count: 99,
                ...(typeof item === 'object' ? item : {name: item})
            }));
            return res.json(successResponse({ items, total: items.length }));
        }

        // Skill list
        if (type === 'skill') {
            const skillData = gameData['skill'] || {};
            const skills = Object.entries(skillData).slice(0, 50).map(([id, skill]) => ({
                id: parseInt(id),
                level: 5,
                unlocked: true,
                ...(typeof skill === 'object' ? skill : {})
            }));
            return res.json(successResponse({ skills, total: skills.length }));
        }

        // Equipment
        if (type === 'equip' || type === 'equipment') {
            const equipData = gameData['equip'] || {};
            const equips = Object.entries(equipData).slice(0, 20).map(([id, eq]) => ({
                id: parseInt(id),
                level: 50,
                star: 3,
                ...(typeof eq === 'object' ? eq : {})
            }));
            return res.json(successResponse({ equips, total: equips.length }));
        }

        // Expedition / Events
        if (type === 'expedition') {
            return res.json(successResponse({
                currentStage: 1,
                maxStage: 50,
                progress: {},
                rewards: []
            }));
        }

        // Guild
        if (type === 'guild') {
            return res.json(successResponse({
                guildId: 0,
                name: '',
                members: [],
                boss: { hp: 1000000, maxHp: 1000000 }
            }));
        }

        // Quest / Mission
        if (type === 'quest' || type === 'mission' || type === 'task') {
            return res.json(successResponse({
                quests: [],
                completed: [],
                daily: {}
            }));
        }

        // Chat
        if (type === 'chat') {
            return res.json(successResponse({
                messages: [],
                channels: {}
            }));
        }

        // Shop / Market
        if (type === 'shop' || type === 'market' || type === 'store') {
            return res.json(successResponse({
                items: [],
                refreshTime: 0
            }));
        }

        // Mail
        if (type === 'mail') {
            return res.json(successResponse({
                mails: [],
                unread: 0
            }));
        }

        // Activity
        if (type === 'activity') {
            return res.json(successResponse({
                activities: [],
                rewards: {}
            }));
        }

        // --- FALLBACK: Return empty/default data for unknown types ---
        console.log(`  [FALLBACK] No handler for type=${type}, action=${action}, returning empty`);
        return res.json(successResponse({}));

    } catch (error) {
        console.error(`  [ERROR] type=${type}, action=${action}:`, error.message);
        return res.json(errorResponse(500, error.message));
    }
}

// ---------- SOCKET.IO ----------

io.on('connection', (socket) => {
    console.log('[SOCKET] New connection:', socket.id);

    // Send verify challenge
    const challenge = Math.random().toString(36).substring(2, 15);
    socket.emit('verify', challenge);

    // Handle verify response - game expects {ret: 0} for success
    socket.on('verify', (data, callback) => {
        console.log('[SOCKET] Verify received, data:', typeof data === 'string' ? data.substring(0, 30) + '...' : data);
        if (typeof callback === 'function') {
            callback({ ret: 0, msg: 'verified' });
        }
        socket.emit('Notify', {
            type: 'verified',
            data: { userId: 1001, serverTime: Date.now() / 1000 }
        });
    });

    // Handle game RPC calls
    socket.on('handler.process', (data, callback) => {
        console.log('[SOCKET] handler.process:', JSON.stringify(data).substring(0, 200));
        if (typeof callback === 'function') {
            callback({ ret: 0, data: '{}' });
        }
    });

    socket.on('disconnect', () => {
        console.log('[SOCKET] Disconnected:', socket.id);
    });
});

// ---------- STATIC FILES ----------

// Serve game assets
const assetsDir = path.join(__dirname, '..', 'assets');
if (fs.existsSync(assetsDir)) {
    app.use('/assets', express.static(assetsDir));
}

// ---------- START ----------

server.listen(PORT, '0.0.0.0', () => {
    console.log('\n===========================================');
    console.log('  DRAGON BALL IDLE - LOCAL EMULATOR');
    console.log(`  Server running on http://0.0.0.0:${PORT}`);
    console.log('===========================================\n');
    console.log('Endpoints:');
    console.log(`  GET  /lzceshi/native_setting/Android/setting_Android.bin`);
    console.log(`  GET  /lzceshi/native_setting/Android/loginchecknative`);
    console.log(`  POST /api (data={type, action, ...})`);
    console.log(`  Socket.io on port ${PORT}\n`);
});
