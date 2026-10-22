// Views of every place the lair cuts through the terrain, to spot holes and gaps.
// usage: node tools/holes.mjs <outDir> [day|night]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = process.argv[2];
const tod = process.argv[3] || 'day';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(pathToFileURL(join(root, 'dist', 'nomanisan.html')).href);
await page.waitForFunction(() => !document.getElementById('title').hidden, null, { timeout: 180000, polling: 500 });
await page.evaluate((d) => window.__nomanisan.sky(d === 'day', 'clear'), tod);
// [name, fn(N) -> [x, y, z, lookX, lookY, lookZ]]
const views = {
  doorFront: `(N)=>{const D=N.POI.door,s=N.POI.dirS;return [D.x+s.x*9+s.z*3,N.POI.ledgeY+3,D.z+s.z*9-s.x*3,D.x,N.POI.ledgeY+1.5,D.z]}`,
  doorAbove: `(N)=>{const D=N.POI.door,s=N.POI.dirS;return [D.x+s.x*6,N.POI.ledgeY+16,D.z+s.z*6,D.x-s.x*2,N.POI.ledgeY,D.z-s.z*2]}`,
  doorTop: `(N)=>{const D=N.POI.door,s=N.POI.dirS;return [D.x-s.x*14,N.terrainHeight(D.x-s.x*14,D.z-s.z*14)+3,D.z-s.z*14,D.x+s.x*4,N.POI.ledgeY,D.z+s.z*4]}`,
  caveFront: `(N)=>{const a=N.POI.caveA;const p={x:Math.cos(a)*206,z:-100+Math.sin(a)*206};const m={x:Math.cos(a)*192,z:-100+Math.sin(a)*192};return [p.x,N.POI.caveY+3,p.z,m.x,N.POI.caveY+1.5,m.z]}`,
  caveAbove: `(N)=>{const a=N.POI.caveA;const p={x:Math.cos(a)*200,z:-100+Math.sin(a)*200};const m={x:Math.cos(a)*190,z:-100+Math.sin(a)*190};return [p.x,N.POI.caveY+14,p.z,m.x,N.POI.caveY,m.z]}`,
  caveTop: `(N)=>{const a=N.POI.caveA+0.03;const p={x:Math.cos(a)*180,z:-100+Math.sin(a)*180};const m={x:Math.cos(a)*196,z:-100+Math.sin(a)*196};return [p.x,N.terrainHeight(p.x,p.z)+3,p.z,m.x,N.POI.caveY,m.z]}`,
  gatePlaza: `(N)=>[4,N.POI.plazaY+3,N.POI.gateZ+30,0,N.POI.plazaY+5,N.POI.gateZ]`,
  gateSlope: `(N)=>[10,N.terrainHeight(10,N.POI.gateZ-22)+4,N.POI.gateZ-22,0,N.POI.plazaY+4,N.POI.gateZ-2]`,
  gateHigh: `(N)=>[-14,N.POI.plazaY+40,N.POI.gateZ-10,0,N.POI.plazaY,N.POI.gateZ-4]`,
  kiosk: `(N)=>[-14,138,-74,-24.5,137,-84]`,
  kioskTop: `(N)=>[-30,150,-70,-24.5,136,-84]`,
};
for (const [name, src] of Object.entries(views)) {
  await page.evaluate((src) => {
    const N = window.__nomanisan; const [x, y, z, lx, ly, lz] = (0, eval)(src)(N);
    const dx = lx - x, dy = ly - y, dz = lz - z;
    N.view(x, y, z, Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)), {});
  }, src);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, `hole-${name}.png`) });
}
await browser.close();
console.log('done');
