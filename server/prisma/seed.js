// ============================================================
// Seed — load reverse-engineered game data + a default player
// ============================================================
//   node prisma/seed.js       (or: npm run seed)
// Idempotent: clears the seeded tables first, then re-inserts.
// ============================================================

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const JSON_DIR = path.resolve(__dirname, '..', '..', 'decrypted_assets', 'game_source', 'resource', 'json');
const HERO_STATS = path.resolve(__dirname, '..', 'src', 'data', 'hero-stats.json');
const HERO_BOOK = path.join(JSON_DIR, 'heroBook.json');

// Team heroes placed first so their instance ids are 1..N (matches the
// old hero-roster ordering). The rest follow in heroBook order.
const TEAM_HERO_IDS = [1205, 1206, 1207, 1309];
const BATCH = 500;

async function insertBatched(rows) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await prisma.gameData.createMany({ data: rows.slice(i, i + BATCH) });
  }
}

// One decrypted JSON file → GameData rows (key = object key or array index).
function fileToRows(name, parsed) {
  const rows = [];
  const seen = new Set();
  const push = (key, entry) => {
    let k = String(key);
    while (seen.has(k)) k += '_'; // guarantee (collection,key) uniqueness
    seen.add(k);
    rows.push({ collection: name, key: k, data: JSON.stringify(entry) });
  };
  if (Array.isArray(parsed)) parsed.forEach((e, i) => push((e && (e.id ?? e.ID)) ?? i, e));
  else if (parsed && typeof parsed === 'object') for (const k of Object.keys(parsed)) push(k, parsed[k]);
  else push('_', parsed);
  return rows;
}

async function seedGameData() {
  await prisma.gameData.deleteMany();
  const files = fs.readdirSync(JSON_DIR).filter((f) => f.endsWith('.json'));
  let total = 0;
  for (const file of files) {
    const name = path.basename(file, '.json');
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(path.join(JSON_DIR, file), 'utf8')); } catch { continue; }
    const rows = fileToRows(name, parsed);
    await insertBatched(rows);
    total += rows.length;
  }
  console.log(`[seed] GameData: ${total} entries from ${files.length} collections`);
}

async function seedHeroStats() {
  await prisma.heroStat.deleteMany();
  if (!fs.existsSync(HERO_STATS)) { console.warn('[seed] hero-stats.json missing — skipping'); return; }
  const stats = JSON.parse(fs.readFileSync(HERO_STATS, 'utf8'));
  const rows = [];
  for (const [displayId, s] of Object.entries(stats)) {
    if (!s || s.error || s.hp == null) continue;
    rows.push({
      displayId: Number(displayId),
      level: s.level ?? 200, star: s.star ?? 0, evolveLevel: s.evolveLevel ?? 200, isRed: !!s.isRed,
      hp: Math.round(s.hp), attack: Math.round(s.attack), armor: Math.round(s.armor), speed: Math.round(s.speed),
    });
  }
  await prisma.heroStat.createMany({ data: rows });
  console.log(`[seed] HeroStat: ${rows.length} heroes`);
}

async function seedPlayers() {
  await prisma.playerHero.deleteMany();
  await prisma.playerItem.deleteMany();
  await prisma.player.deleteMany();

  // Special account: can buy any item free (admin flag).
  const admin = await prisma.player.create({
    data: { id: 1001, nickname: 'admin', admin: true, diamonds: 999999, coins: 999999, level: 200, vip: 15 },
  });

  // Default player (id 1): rich + high VIP, full roster.
  const player = await prisma.player.create({
    data: { id: 1, nickname: 'Player', diamonds: 999999, coins: 999999, level: 200, vip: 15 },
  });

  // Seed currencies + VIP as items so DB state matches the game's
  // ItemsCommonSingleton (items 101..107). VIP 15 → expAll threshold.
  const vipExpAll = seedVipCumulative(15);
  const items = [
    { playerId: 1, itemId: 101, num: 999999 }, // diamond
    { playerId: 1, itemId: 102, num: 999999 }, // gold
    { playerId: 1, itemId: 103, num: 4659000 }, // player exp (lvl200)
    { playerId: 1, itemId: 104, num: 200 }, // player level
    { playerId: 1, itemId: 105, num: 0 }, // vip exp
    { playerId: 1, itemId: 106, num: 15 }, // vip level
    { playerId: 1, itemId: 107, num: vipExpAll }, // vip exp all
  ];
  const adminItems = [
    { playerId: admin.id, itemId: 101, num: 999999 },
    { playerId: admin.id, itemId: 102, num: 999999 },
    { playerId: admin.id, itemId: 103, num: 4659000 },
    { playerId: admin.id, itemId: 104, num: 200 },
    { playerId: admin.id, itemId: 105, num: 0 },
    { playerId: admin.id, itemId: 106, num: 15 },
    { playerId: admin.id, itemId: 107, num: vipExpAll },
  ];
  await prisma.playerItem.createMany({ data: [...items, ...adminItems] });

  const heroBook = JSON.parse(fs.readFileSync(HERO_BOOK, 'utf8'));
  const bookIds = Object.keys(heroBook).map(Number).filter((n) => !Number.isNaN(n));
  const ordered = [
    ...TEAM_HERO_IDS.filter((id) => bookIds.includes(id)),
    ...bookIds.filter((id) => !TEAM_HERO_IDS.includes(id)),
  ];
  const heroRows = (pid) => ordered.map((displayId, i) => ({
    playerId: pid,
    displayId,
    instanceId: i + 1,
    star: Math.min(Number(heroBook[displayId] && heroBook[displayId].star) || 1, 10),
    level: 200,
  }));
  // Give both the default player and the admin user the full roster.
  await prisma.playerHero.createMany({ data: [...heroRows(player.id), ...heroRows(admin.id)] });
  console.log(`[seed] Player #1 + #${admin.id} + ${ordered.length} owned heroes each`);
}

/** Cumulative VIP exp needed to reach `level` (sum of vipUpgrade expNeeded). */
function seedVipCumulative(level) {
  const vipUpgrade = JSON.parse(fs.readFileSync(path.join(JSON_DIR, 'vipUpgrade.json'), 'utf8'));
  let cum = 0;
  for (let l = 0; l < level; l++) {
    const info = vipUpgrade[String(l)];
    if (info && info.expNeeded) cum += info.expNeeded;
  }
  return cum;
}

(async () => {
  console.time('[seed] done');
  await seedGameData();
  await seedHeroStats();
  await seedPlayers();
  console.timeEnd('[seed] done');
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('[seed] FAILED:', e);
  await prisma.$disconnect();
  process.exit(1);
});
