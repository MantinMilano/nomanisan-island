// Visual tour: the hero at every place in the test menu, in day and night, third-person, HUD hidden.
// usage: node tools/tour.mjs <outDir> [day|night|both] [weather]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = process.argv[2];
const which = process.argv[3] || 'both';
const weather = process.argv[4] || 'clear';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(pathToFileURL(join(root, 'dist', 'nomanisan.html')).href);
await page.waitForFunction(() => !document.getElementById('title').hidden, null, { timeout: 180000, polling: 500 });
const mission = +(process.env.TOUR_MISSION || 13);
await page.evaluate((m) => { const N = window.__nomanisan; N.start(m, { skip: true }); N.HERO.god = true; N.GAME.noDetect = true; }, mission);
await page.waitForTimeout(1500);
await page.evaluate(() => { window.__nomanisan.skipCutscene(); document.getElementById('hud').style.visibility = 'hidden'; });
const places = await page.evaluate(() => window.__nomanisan.places());
for (const tod of which === 'both' ? ['night', 'day'] : [which]) {
  await page.evaluate(([d, w]) => window.__nomanisan.sky(d === 'day', w), [tod, weather]);
  for (let i = 0; i < places.length; i++) {
    const [name, cp] = places[i];
    await page.evaluate((cp) => { const N = window.__nomanisan; N.at(cp.x, cp.z, cp.y, cp.yaw || 0, -0.18); }, cp);
    await page.waitForTimeout(1300);
    const slug = name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, '');
    await page.screenshot({ path: join(out, `${tod}-${String(i).padStart(2, '0')}-${slug}.png`) });
  }
}
await browser.close();
console.log('tour done', places.length);
