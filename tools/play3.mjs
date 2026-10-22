// Playtest for the v2 game: mechanics checks plus a run through every mission.
// usage: node tools/play3.mjs <outDir> [quick]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = process.argv[2] || join(root, 'shots-play');
const quick = process.argv.includes('quick');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text().slice(0, 300)); console.log('[console.error]', m.text().slice(0, 300)); } });
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')); });
await page.goto(pathToFileURL(join(root, 'dist', 'nomanisan.html')).href);
await page.waitForFunction(() => !document.getElementById('title').hidden || /wrong/i.test(document.getElementById('loadStep').textContent), null, { timeout: 180000, polling: 500 });
const results = [];
const check = (name, ok, info = '') => { results.push([ok ? 'PASS' : 'FAIL', name, info]); console.log(ok ? 'PASS' : 'FAIL', name, info); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const W = (ms) => page.waitForTimeout(ms);
const shot = (n) => page.screenshot({ path: join(out, n + '.png') });
const state = () => ev(() => window.__nomanisan.state());

// ---- start a real game (audio on) and watch the intro play
await page.click('#btnStart');
await W(2500);
let s = await state();
check('intro cutscene starts', s.cut && s.mission === 0, JSON.stringify({ cut: s.cut, line: s.line }));
const audio = await ev(() => { const N = window.__nomanisan; return { on: N.AUDIO.on, state: N.AUDIO.ctx && N.AUDIO.ctx.state, voices: N.voices(), lines: N.lines(), speaking: N.DLG.speaking }; });
check('voices embedded and audio running', audio.voices >= 100 && audio.on, JSON.stringify(audio));
await W(3000);
await shot('01-intro');
s = await state();
const firstLine = s.line;
await page.keyboard.press('Enter');   // skip the cutscene
await W(800);
s = await state();
check('Enter skips the cutscene', !s.cut && s.mode === 'play', JSON.stringify({ mode: s.mode, line: firstLine }));
// the same line never repeats on its own
const heardBefore = await ev(() => [...window.__nomanisan.DLG.heard]);
await W(4000);
s = await state();
check('objective shown after intro', !!s.objective, s.objective);
await shot('02-play-start');

// ---- movement
const p0 = (await state()).p;
await ev(() => { window.__nomanisan.keys.KeyW = true; window.__nomanisan.keys.ShiftLeft = true; });
await W(1500);
await ev(() => { window.__nomanisan.keys.KeyW = false; window.__nomanisan.keys.ShiftLeft = false; });
const p1 = (await state()).p;
check('runs forward', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 6, `${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m`);
await shot('03-after-run');
// super jump: hold space, release
await ev(() => { window.__nomanisan.keys.Space = true; });
await W(1000);
await ev(() => { window.__nomanisan.keys.Space = false; });
let maxY = -1e9; const y0 = (await state()).p.y;
for (let i = 0; i < 12; i++) { await W(100); maxY = Math.max(maxY, (await state()).p.y); }
check('super jump goes high', maxY - y0 > 5, `${(maxY - y0).toFixed(1)} m`);
await W(2500);
s = await state();
check('lands again', s.grounded, JSON.stringify(s.p));

// ---- scanner on the tracker
await ev(() => { const N = window.__nomanisan; N.skipLine(); });
await W(500);
await ev(() => { const N = window.__nomanisan; const b = N.W2.boat; N.at(b.x + 5, b.z + 4, null, 0); });
await W(600);
await ev(() => window.__nomanisan.toggleScan(true));
for (let i = 0; i < 12; i++) { await ev(() => { const N = window.__nomanisan; const p = N.W2.tracker.pos(); N.aimAt(p.x, p.y, p.z); }); await W(250); }
await shot('04-scanner');
s = await state();
check('scanner analyzes the tracker', !!s.flags.tracker, JSON.stringify({ scan: s.scan, flags: s.flags }));
await ev(() => window.__nomanisan.toggleScan(false));

// ---- grab and throw a crate
const thr = await ev(() => {
  const N = window.__nomanisan; const c = N.THROWABLES.find((o) => o.kind === 'crate' && !o.gone);
  N.at(c.mesh.position.x + 1.4, c.mesh.position.z, null, 0); N.HERO.face = Math.atan2(-1, 0);
  return { x: c.mesh.position.x, z: c.mesh.position.z };
});
await W(400);
await ev(() => window.__nomanisan.tryGrab());
s = await ev(() => !!window.__nomanisan.HERO.carrying);
check('lifts a crate', s);
await W(500);
await shot('05-carry');
await ev(() => { const N = window.__nomanisan; N.P.pitch = 0.2; N.heroAttack(); });
await W(150);
const flying = await ev(() => window.__nomanisan.THROWABLES.some((o) => o.flying || o.gone));
check('throws it', flying);
await W(1500);

// ---- punching a drone
await ev(() => { const N = window.__nomanisan; N.HERO.god = true; });
const dr = await ev(() => { const N = window.__nomanisan; return { n: N.ENEMIES.length }; });
await ev(() => { const N = window.__nomanisan; const P = N.P; const e = window.__nomanisan.ENEMIES; void e; });
await ev(() => { const N = window.__nomanisan; const P = N.P; N.HERO.face = 0; const sp = (window.__spawned = []); void sp; });
const killed = await ev(async () => {
  const N = window.__nomanisan, P = N.P;
  // spawn a drone right in front of the hero, low enough to punch
  const before = N.ENEMIES.length;
  const e = N.spawnEnemy('drone', P.x + Math.sin(N.HERO.face) * 5, P.y + 3.5, P.z + Math.cos(N.HERO.face) * 5, { hunt: true });
  let swings = 0;
  for (let i = 0; i < 40 && e.alive; i++) { N.aimAt(e.pos.x, e.pos.y, e.pos.z); if (Math.hypot(e.pos.x - P.x, e.pos.z - P.z) < 8.5) { N.heroAttack(); swings++; } await new Promise((r) => setTimeout(r, 420)); }
  return { before, alive: e.alive, hp: e.hp, swings };
  return { before, alive: e.alive, hp: e.hp };
}).catch((er) => ({ err: String(er) }));
check('punches a drone to pieces', killed && killed.alive === false, JSON.stringify(killed));
void dr;

// ---- day / night
await ev(() => window.__nomanisan.sky(true));
await W(1500);
await shot('06-day');
await page.keyboard.press('KeyT');
await W(3500);
const dayNow = await ev(() => window.__nomanisan.SKY.day);
check('T switches back to night smoothly', dayNow < 0.2, dayNow.toFixed(2));
await shot('07-night');

// ---- dev menu opens and jumps
await page.keyboard.press('F2');
await W(400);
const devOpen = await ev(() => !document.getElementById('dev').hidden && window.__nomanisan.GAME.mode === 'dev');
check('F2 opens the test menu', devOpen);
await shot('08-devmenu');
await page.click('#devMissions button[data-m="5"]');
await W(1500);
s = await state();
check('test menu jumps to mission 5', s.mission === 5 && s.mode !== 'dev', JSON.stringify({ mission: s.mission, mode: s.mode, room: s.room }));
await shot('09-m5');

// ---- security cameras: hack one with the scanner (hold E), punch another
await ev(() => { const N = window.__nomanisan; N.mission(4); });
await W(1500);
await ev(() => { const N = window.__nomanisan; N.skipCutscene(); N.at(-70, -1, 40, -Math.PI / 2); });
await W(600);
const hack = await ev(async () => {
  const N = window.__nomanisan; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const cams = N.SECURITY.cams.filter((c) => c.room === 'checkpoint' || c.room === 'gauntlet');
  const c = cams.sort((a, b) => Math.hypot(a.x - N.P.x, a.z - N.P.z) - Math.hypot(b.x - N.P.x, b.z - N.P.z))[0];
  if (!c) return { err: 'no camera' };
  N.at(c.x + 3, c.z, 40, 0);
  await sleep(400);
  N.toggleScan(true);
  for (let i = 0; i < 30 && c.state !== 'hacked'; i++) { N.aimAt(c.x, c.y, c.z); N.keys.KeyE = i > 3; await sleep(100); }
  N.keys.KeyE = false; N.toggleScan(false);
  const other = cams.find((q) => q !== c && q.state !== 'broken');
  let broke = null;
  if (other) {
    N.at(other.x + 1.5, other.z + 1.5, 40, 0);
    for (let i = 0; i < 6 && other.state !== 'broken'; i++) { N.aimAt(other.x, other.y, other.z); N.P.vy = 8; N.P.grounded = false; await sleep(250); N.heroAttack(); await sleep(450); }
    broke = other.state;
  }
  return { hacked: c.state, broke };
});
check('hacks a camera with the scanner', hack.hacked === 'hacked', JSON.stringify(hack));
check('punches a camera off the wall', hack.broke === 'broken', JSON.stringify(hack));
await shot('10-cameras');

// ---- every mission: jump, check the world builds, then skip steps until it advances
await ev(() => { window.__nomanisan.DLG.skipAll = true; window.__nomanisan.HERO.god = true; });
const missionShots = {};
for (let m = 0; m <= 12; m++) {
  if (quick && m % 3) continue;
  await ev((i) => window.__nomanisan.mission(i), m);
  await W(1800);
  s = await state();
  const startState = s;
  await shot(`m${String(m).padStart(2, '0')}-start`);
  let guard = 0, advanced = false;
  while (guard++ < 40) {
    s = await state();
    if (s.mission !== m || s.mode === 'ending') { advanced = true; break; }
    if (s.cut) await ev(() => window.__nomanisan.skipCutscene());
    await ev(() => { window.__nomanisan.skipLine(); window.__nomanisan.skipStep(); });
    await W(700);
  }
  s = await state();
  check(`mission ${m} runs through`, advanced, `start: ${startState.objective || '(cutscene)'} | now: m${s.mission} ${s.mode} ${s.objective}`);
  missionShots[m] = startState;
}
// ---- ending screen
s = await state();
check('ending screen after mission 12', s.mode === 'ending' || s.mission === 13, s.mode);
await shot('99-ending');

console.log('\n==== RESULTS ====');
for (const r of results) console.log(r[0], r[1], r[2] ? '— ' + r[2] : '');
console.log('errors:', errors.length);
for (const e of [...new Set(errors)].slice(0, 15)) console.log('  ', e);
await browser.close();
