// Close-up renders of the hero (front, side, back) for model work.
// usage: node tools/hero-shot.mjs <outDir> [day|night]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = process.argv[2];
const tod = process.argv[3] || 'day';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(pathToFileURL(join(root, 'dist', 'nomanisan.html')).href);
await page.waitForFunction(() => !document.getElementById('title').hidden, null, { timeout: 180000, polling: 500 });
await page.evaluate((d) => { const N = window.__nomanisan; N.sky(d === 'day', 'clear'); N.start(5, { skip: true }); }, tod);
await page.waitForTimeout(1500);
await page.evaluate(() => { const N = window.__nomanisan; N.skipCutscene(); N.at(-14, 0, 40, 0); });
await page.waitForTimeout(1200);
for (const [name, ang, h, d] of [['front', 0, 1.5, 3.4], ['side', Math.PI / 2, 1.4, 3.4], ['back', Math.PI, 1.6, 3.6], ['three', 0.7, 1.9, 4.2]]) {
  await page.evaluate(([ang, h, d]) => {
    const N = window.__nomanisan, P = N.P; N.HERO.face = 0;
    const x = P.x + Math.sin(ang) * d, z = P.z + Math.cos(ang) * d;
    N.view(x, P.y + h, z, Math.atan2(-(P.x - x), -(P.z - z)), -0.12, { hero: true, indoor: true, fov: 50 });
  }, [ang, h, d]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, `hero-${name}.png`) });
}
await browser.close();
