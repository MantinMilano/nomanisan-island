// Close looks at the story set pieces in their live state (game running, camera held by a long cutscene shot).
// usage: node tools/setpieces.mjs <outDir> [day|night]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = process.argv[2];
const tod = process.argv[3] || 'night';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message, (e.stack || '').split('\n')[1]));
await page.goto(pathToFileURL(join(root, 'dist', 'nomanisan.html')).href);
await page.waitForFunction(() => !document.getElementById('title').hidden, null, { timeout: 180000, polling: 500 });
await page.evaluate((d) => window.__nomanisan.sky(d === 'day', 'clear'), tod);
const Y = 40;
// each: [name, mission, setup(N) -> {from, look}]
const pieces = [
  ['boat', 0, `(N)=>{const b=N.W2.boat;return{from:[b.x+9,b.y+3.5,b.z+7],look:[b.x,b.y+1,b.z]}}`],
  ['tower-top', 2, `(N)=>{const R=N.POI.radio,t=N.W2.towerTop;N.at(R.x-2.6,R.z,t,-Math.PI/2);N.STORY.flags.visorScanned=true;return{from:[R.x-7,t+3,R.z+5],look:[R.x-1,t+1.5,R.z]}}`],
  ['scorch-scan', 3, `(N)=>{const m=N.W2.scorch[2];N.at(m.p.x+3,m.p.z+3,null,0);N.toggleScan(true);return{from:[m.p.x+7,m.p.y+5,m.p.z+7],look:[m.p.x,m.p.y,m.p.z]}}`],
  ['gazer-echo', 3, `(N)=>{const C=N.POI.caveChamber;N.at(C.x,C.z,C.y,0);N.W2.gazer.target=1;const g=N.W2.gazer.rig.root.position;return{from:[C.x+(C.x-g.x)*0.9,C.y+1.7,C.z+(C.z-g.z)*0.9],look:[g.x,g.y+1.2,g.z]}}`],
  ['syndrome-holo', 5, `(N)=>{N.at(30,-14,${Y},-Math.PI/2);N.W2.syn.target=1;return{from:[35,${Y}+2.3,-10.5],look:[40.5,${Y}+1.9,-14]}}`],
  ['valves', 7, `(N)=>{N.at(62,-38,${Y},Math.PI);const v=N.W2.valves[1];return{from:[v.x-6,${Y}+4,v.z+4],look:[v.x,${Y}+1.5,v.z]}}`],
  ['boots-case', 8, `(N)=>{N.at(14,-60,${Y},-Math.PI/2);return{from:[15.5,${Y}+2,-53.5],look:[18,${Y}+1.2,-56]}}`],
  ['omni', 9, `(N)=>{N.at(0,-80,${Y},0);N.startOmni();return{from:[-6,${Y}+7,-80],look:[11,${Y}+3,-108]}}`],
  ['mirage-held', 10, `(N)=>{N.at(-35,-58,${Y},-Math.PI/2);const F=N.FIELD;return{from:[F.x+7,${Y}+4,F.z+6],look:[F.x,${Y}+3,F.z]}}`],
  ['mirage-free', 11, `(N)=>{N.at(-38,-58,${Y},-Math.PI/2);const F=N.FIELD;return{from:[F.x+3.2,${Y}+1.7,F.z+2.4],look:[F.x,${Y}+1.4,F.z]}}`],
  ['heart-cavern', 11, `(N)=>{const H=N.HEART,G=N.GRATE;N.at(G.x+1,G.z,H.y,0);N.STORY.flags.inHeart=true;return{from:[H.x+20,H.y+9,H.z+14],look:[H.x,H.y+3,H.z]}}`],
  ['heart-awake', 11, `(N)=>{const H=N.HEART,G=N.GRATE;N.at(G.x+1,G.z,H.y,0);N.HEART.awakeTarget=1;N.HEART.seal.visible=false;return{from:[H.x-12,H.y+5,H.z-9],look:[H.x,H.y+5,H.z]}}`],
  ['silo-grate', 11, `(N)=>{N.at(0,-80,${Y},0);const G=N.GRATE;return{from:[G.x+5,${Y}+4,G.z+5],look:[G.x,${Y},G.z]}}`],
  ['kronos', 12, `(N)=>{N.skipCutscene();return{from:[24,152,-80],look:[0,152,-100]}}`],
  ['outpost', 13, `(N)=>{const z=N.POI.plaza.z+10;N.at(-14,z+12,null,0);return{from:[-10,N.terrainHeight(-10,z+18)+5,z+18],look:[-24,N.terrainHeight(-24,z)+2,z]}}`],
  ['alcove', 13, `(N)=>{N.at(-43,-1.5,${Y},0);N.toggleScan(true);return{from:[-40,${Y}+2.2,-0.6],look:[-43,${Y}+1.6,-4.2]}}`],
];
for (const [name, m, src] of pieces) {
  await page.evaluate(([m]) => { const N = window.__nomanisan; N.start(m, { skip: true }); N.HERO.god = true; N.GAME.noDetect = true; }, [m]);
  await page.waitForTimeout(900);
  await page.evaluate(() => { const N = window.__nomanisan; N.skipCutscene(); });
  await page.waitForTimeout(400);
  await page.evaluate(([src]) => {
    const N = window.__nomanisan; const r = (0, eval)(src)(N);
    N.cutscene([{ from: r.from, look: r.look, dur: 999, fov: 55 }]);
  }, [src]);
  await page.waitForTimeout(name === 'kronos' ? 7000 : name === 'omni' ? 4500 : 2200);
  await page.screenshot({ path: join(out, `sp-${name}.png`) });
  await page.evaluate(() => { const N = window.__nomanisan; N.endCutscene(true); N.toggleScan(false); });
}
await browser.close();
console.log('setpieces done');
