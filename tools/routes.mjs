// Runs the hero in a straight line between story locations (holding W + Shift, hopping when blocked)
// and reports every spot where he stays stuck: candidates for invisible walls.
// usage: node tools/routes.mjs
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(pathToFileURL(join(root, 'dist', 'nomanisan.html')).href);
await page.waitForFunction(() => !document.getElementById('title').hidden, null, { timeout: 180000, polling: 500 });
await page.evaluate(() => { const N = window.__nomanisan; N.start(13, { skip: true }); N.HERO.god = true; N.GAME.noDetect = true; });
await page.waitForTimeout(2000);
await page.evaluate(() => window.__nomanisan.skipCutscene());
// [name, from(N), to(N)]
const routes = [
  ['beach -> radio hill', 'N.W2.boatSpawn', 'N.POI.radio'],
  ['radio hill -> cave', '({x:N.POI.radio.x+8,z:N.POI.radio.z+7})', '(()=>{const a=N.POI.caveA;return {x:Math.cos(a)*201,z:-100+Math.sin(a)*201}})()'],
  ['cave -> waterfall door', '(()=>{const a=N.POI.caveA;return {x:Math.cos(a)*203,z:-100+Math.sin(a)*203}})()', '({x:N.POI.door.x+N.POI.dirS.x*2,z:N.POI.door.z+N.POI.dirS.z*2})'],
  ['beach -> test clearing', 'N.W2.boatSpawn', '({x:N.POI.omni.x+10,z:N.POI.omni.z+8})'],
  ['beach -> battery', 'N.W2.boatSpawn', 'N.POI.battery'],
  ['beach -> gate plaza', 'N.W2.boatSpawn', '({x:0,z:N.POI.plaza.z+8})'],
  ['falls pool -> radio hill', 'N.POI.poolSouth', 'N.POI.radio'],
  ['gate plaza -> waterfall', '({x:0,z:N.POI.plaza.z+8})', 'N.POI.poolSouth'],
  ['test clearing -> lava lookout', '({x:N.POI.omni.x+10,z:N.POI.omni.z+8})', 'N.POI.lavaLook'],
];
for (const [name, fromSrc, toSrc] of routes) {
  const r = await page.evaluate(async ([fromSrc, toSrc]) => {
    const N = window.__nomanisan; const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const from = (0, eval)(`(N)=>${fromSrc}`)(N), to = (0, eval)(`(N)=>${toSrc}`)(N);
    N.at(from.x, from.z, null, 0);
    await sleep(500);
    const k = N.keys; k.KeyW = true; k.ShiftLeft = true;
    const stuck = []; let last = null, still = 0, hops = 0, arrived = false;
    for (let i = 0; i < 400; i++) {
      const dx = to.x - N.P.x, dz = to.z - N.P.z;
      if (Math.hypot(dx, dz) < 8) { arrived = true; break; }
      N.P.yaw = Math.atan2(-dx, -dz);
      await sleep(150);
      const p = { x: N.P.x, z: N.P.z };
      if (last && Math.hypot(p.x - last.x, p.z - last.z) < 0.25) still++; else still = 0;
      last = p;
      if (still === 4 || still === 12) { hops++; k.Space = true; await sleep(90); k.Space = false; }
      if (still > 20) { stuck.push({ x: +N.P.x.toFixed(1), y: +N.P.y.toFixed(1), z: +N.P.z.toFixed(1), water: N.P.inWater, floor: N.P.floor && N.P.floor.kind }); break; }
    }
    k.KeyW = false; k.ShiftLeft = false;
    return { arrived, hops, stuck, end: { x: +N.P.x.toFixed(1), y: +N.P.y.toFixed(1), z: +N.P.z.toFixed(1) } };
  }, [fromSrc, toSrc]);
  console.log((r.arrived ? 'OK   ' : 'STUCK') + ' ' + name.padEnd(30) + JSON.stringify(r));
}
await browser.close();
