// Extract each hero's REAL base stats by calling the game's OWN
// getHeroBookDataModel (the exact fn the Illustration uses) in-browser,
// so results match the Illustration to the digit. Dumps hero-stats.json.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = 'http://127.0.0.1:8080';
const OUT = path.resolve(__dirname, '..', 'server', 'src', 'data', 'hero-stats.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 } });
  const page = await ctx.newPage();
  const click = async (x, y, w = 1500) => { await page.mouse.click(x, y); await sleep(w); };
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await sleep(6000);
  await click(345, 828); await page.keyboard.type('tester', { delay: 40 });
  await click(345, 949); await page.keyboard.type('tester', { delay: 40 });
  await click(345, 1075); await sleep(2000);
  await click(197, 587); await click(345, 1075, 3000);
  await sleep(8000);

  const result = await page.evaluate(() => {
    const RJ = window.ReadJsonSingleton.getInstance();
    const HM = window.HerosManager.getInstance();
    const book = RJ.heroBook || {};
    const bookRed = RJ.heroBookRed || {};
    const stats = {};
    let sampleDump = null;
    const LEVEL = 200;          // user wants level-200 base stats
    const EVOLVE = 200;         // fully evolved at max level
    // getHeroBookDataModel caches _attribute_Basic by hero id — clear so our
    // (200,200,star) params actually recompute instead of returning stale values.
    const run = (src, isRed) => {
      for (const key in src) {
        const b = src[key];
        try {
          HM._heroBookAttribute_Basic = {};
          HM._heroBookAttributeRed_Basic = {};
          const m = HM.getHeroBookDataModel(b.id, LEVEL, EVOLVE, b.star, isRed);
          if (m && m.heroBaseAttr) {
            const a = m.heroBaseAttr;
            stats[b.id] = {
              level: LEVEL, star: b.star, evolveLevel: EVOLVE, isRed: !!isRed,
              hp: Math.round(a.hp || 0), attack: Math.round(a.attack || 0),
              armor: Math.round(a.armor || 0), speed: Math.round(a.speed || 0),
            };
            if (!sampleDump) sampleDump = { id: b.id, heroBaseAttr: JSON.parse(JSON.stringify(a)), basic: JSON.parse(JSON.stringify(HM._attribute_Basic || {})) };
          }
        } catch (e) { stats[b.id] = { error: e.message }; }
      }
    };
    run(book, false);
    run(bookRed, true);
    return { count: Object.keys(stats).length, stats, sampleDump };
  });

  console.log('extracted heroes:', result.count);
  console.log('sample full attr:', JSON.stringify(result.sampleDump, null, 1).slice(0, 600));
  // sanity: a few
  ['1206', '1309', '1701'].forEach((id) => console.log('  ', id, '->', JSON.stringify(result.stats[id])));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result.stats, null, 0));
  console.log('written ->', OUT);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
