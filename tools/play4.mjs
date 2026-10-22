// Plays missions 2-12 with real actions (no step skipping): climbing, scanning, punching, typing, bosses, updrafts.
// usage: node tools/play4.mjs <outDir> [fromMission]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = process.argv[2] || join(root, 'shots-play4');
const from = +(process.argv[3] || 2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text().slice(0, 300)); console.log('[console.error]', m.text().slice(0, 300)); } });
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')); });
await page.goto(pathToFileURL(join(root, 'dist', 'nomanisan.html')).href);
await page.waitForFunction(() => !document.getElementById('title').hidden, null, { timeout: 180000, polling: 500 });
const results = [];
const check = (name, ok, info = '') => { results.push([ok ? 'PASS' : 'FAIL', name, info]); console.log(ok ? 'PASS' : 'FAIL', name, info); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const W = (ms) => page.waitForTimeout(ms);
const shot = (n) => page.screenshot({ path: join(out, n + '.png') });
const state = () => ev(() => window.__nomanisan.state());
// install helpers in the page
await ev(() => {
  const N = window.__nomanisan;
  window.T = {
    go(x, z, y, yaw = 0) { N.at(x, z, y == null ? N.terrainHeight(x, z) : y, yaw); },
    async until(fn, ms = 15000) { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 100)); } return false; },
    async swing(target, n = 8, gap = 420) { for (let i = 0; i < n; i++) { if (target && target.done && target.done()) return true; if (target) N.aimAt(target.x(), target.y(), target.z()); N.heroAttack(); await new Promise((r) => setTimeout(r, gap)); } return false; },
    async fightGroup(group, ms = 30000) {
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        const alive = N.ENEMIES.filter((e) => e.alive && (!group || e.group === group));
        if (!alive.length) return true;
        const e = alive.sort((a, b) => Math.hypot(a.pos.x - N.P.x, a.pos.z - N.P.z) - Math.hypot(b.pos.x - N.P.x, b.pos.z - N.P.z))[0];
        const d = Math.hypot(e.pos.x - N.P.x, e.pos.z - N.P.z);
        if (d > 7) { const fy = e.room ? N.P.y : N.terrainHeight(e.pos.x + 3, e.pos.z); N.at(e.pos.x + 3, e.pos.z, fy, 0); }
        N.aimAt(e.pos.x, e.pos.y, e.pos.z); N.heroAttack();
        await new Promise((r) => setTimeout(r, 380));
      }
      return false;
    },
    async scan(sc, ms = 6000) { N.toggleScan(true); const ok = await window.T.until(() => { const p = sc.pos(); N.aimAt(p.x, p.y, p.z); return sc.done; }, ms); N.toggleScan(false); return ok; },
    async use(ms = 300) { N.useHot(); await new Promise((r) => setTimeout(r, ms)); },
  };
  N.DLG.skipAll = true; N.HERO.god = true;
});
async function waitMission(m, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const s = await state(); if (s.mission >= m || s.mode === 'ending') return true; if (s.cut) await ev(() => window.__nomanisan.skipCutscene()); await W(300); }
  return false;
}
async function startAt(m) { await ev((i) => window.__nomanisan.start(i, { skip: true }), m); await W(1200); await ev(() => window.__nomanisan.skipCutscene()); await W(500); }
const skipCut = () => ev(() => window.__nomanisan.skipCutscene());
async function ensure(m) { const s = await state(); if (s.mission !== m) { console.log('  (starting mission ' + m + ' fresh; was ' + s.mission + ')'); await startAt(m); } }

if (from <= 2) {
  // ---- M2 Radio Hill: ladder, scan, pull, drones
  await startAt(2);
  await ev(() => { const N = window.__nomanisan; return N.STORY.mission; });
  await W(1500);
  await ev(() => { const N = window.__nomanisan, R = N.POI.radio; T.go(R.x - 3.1, R.z, null, -Math.PI / 2); });
  await W(400);
  await ev(() => T.use());
  const climbed = await ev(() => T.until(() => window.__nomanisan.P.y > window.__nomanisan.W2.towerTop - 0.5 && window.__nomanisan.P.grounded, 15000));
  check('M2 climbs the ladder', climbed, JSON.stringify((await state()).p));
  await shot('m2-top');
  const scanned = await ev(() => { const N = window.__nomanisan; return T.scan(N.W2.visorScan); });
  check('M2 scans the transmitter', scanned);
  await W(800);
  await ev(async () => { const N = window.__nomanisan, v = N.W2.visorPos; N.aimAt(v.x, v.y, v.z); await new Promise((r) => setTimeout(r, 200)); N.useHot(); });
  await W(600);
  await skipCut(); await W(400); await skipCut(); await W(800);
  let s = await state();
  check('M2 drones attack after the reveal', s.enemies >= 3, JSON.stringify({ enemies: s.enemies, obj: s.objective }));
  await shot('m2-drones');
  const won = await ev(() => T.fightGroup('m2', 40000));
  check('M2 drones destroyed by punching', won);
  check('M2 -> M3', await waitMission(3));
}
if (from <= 3) {
  // ---- M3 Gazerbeam's Trail
  await ensure(3);
  await W(1500);
  const marks = await ev(async () => {
    const N = window.__nomanisan; let n = 0;
    for (const m of N.W2.scorch) { T.go(m.p.x + 4, m.p.z + 3, null, 0); await new Promise((r) => setTimeout(r, 400)); if (await T.scan(m.sc, 4000)) n++; }
    return n;
  });
  check('M3 scans the scorch marks', marks === 7, `${marks}/7`);
  await shot('m3-marks');
  await ev(() => { const N = window.__nomanisan, C = N.POI.caveChamber; T.go(C.x, C.z, C.y, 0); });
  await W(1500);
  let s = await state();
  check('M3 in the cave', s.room === 'cave', s.room);
  await shot('m3-cave');
  await ev(() => T.until(() => /Read what Simon/.test(window.__nomanisan.STORY.objective), 20000));
  await shot('m3-echo');
  await ev(async () => { const N = window.__nomanisan, w = N.W2.wordPos; N.aimAt(w.x, w.y, w.z); await new Promise((r) => setTimeout(r, 300)); N.useHot(); });
  check('M3 -> M4', await waitMission(4));
}
if (from <= 4) {
  // ---- M4 Behind the Falls: punch the door in
  await ensure(4);
  await W(1000);
  await ev(() => { const N = window.__nomanisan, D = N.POI.door, s = N.POI.dirS; T.go(D.x + s.x * 2.6, D.z + s.z * 2.6, N.POI.ledgeY, Math.atan2(s.x, s.z)); });
  await ev(() => T.until(() => /Break the door/.test(window.__nomanisan.STORY.objective), 15000));
  await ev(async () => { const N = window.__nomanisan, D = N.POI.door; for (let i = 0; i < 10 && !N.POI.wfDoorState.target; i++) { N.aimAt(D.x, N.POI.ledgeY + 1.5, D.z); N.heroAttack(); await new Promise((r) => setTimeout(r, 450)); } });
  let s = await state();
  check('M4 door punched in', await ev(() => !!window.__nomanisan.POI.wfDoorState.target), s.objective);
  await W(1500);
  await shot('m4-door');
  await ev(() => T.go(-20, -2, 40, -Math.PI / 2));
  check('M4 -> M5', await waitMission(5));
}
if (from <= 5) {
  // ---- M5 Dinner: hologram, spiders, the switch
  await ensure(5);
  await ev(() => T.go(29, -14, 40, -Math.PI / 2));
  await ev(() => T.until(() => window.__nomanisan.ENEMIES.some((e) => e.alive && e.group === 'm5'), 25000));
  await shot('m5-holo');
  const won = await ev(() => T.fightGroup('m5', 40000));
  check('M5 spider-bots destroyed', won);
  await ev(() => T.until(() => /switch/.test(window.__nomanisan.STORY.objective), 15000));
  await ev(async () => { const N = window.__nomanisan; T.go(41.5, -14, 40, -Math.PI / 2); await new Promise((r) => setTimeout(r, 300)); N.aimAt(43, 40.8, -14); await new Promise((r) => setTimeout(r, 200)); N.useHot(); });
  await W(800);
  check('M5 lava wall opens', await ev(() => window.__nomanisan.LAVA_WALL.target === 1));
  await W(2500);
  await ev(() => T.go(55, -13.5, 40, -Math.PI / 2));
  check('M5 -> M6', await waitMission(6));
}
if (from <= 6) {
  // ---- M6 Kronos: type the password, read the protocol
  await ensure(6);
  await ev(async () => { const N = window.__nomanisan; T.go(63.5, -14, 40.3, -Math.PI / 2); await new Promise((r) => setTimeout(r, 300)); N.aimAt(65.6, 41.6, -14); await new Promise((r) => setTimeout(r, 200)); N.useHot(); });
  await W(500);
  check('M6 terminal opens', await ev(() => !document.getElementById('terminal').hidden));
  await page.keyboard.type('kronos'); await page.keyboard.press('Enter');
  await W(2300);
  await shot('m6-menu');
  await page.keyboard.type('4'); await page.keyboard.press('Enter');
  await W(600);
  await shot('m6-protocol');
  await page.keyboard.press('Escape');
  check('M6 -> M7', await waitMission(7, 40000));
}
if (from <= 7) {
  // ---- M7 Power: smash the valves
  await ensure(7);
  await ev(() => T.go(62, -38, 40, Math.PI));
  await W(1500);
  const n = await ev(async () => {
    const N = window.__nomanisan; let n = 0;
    for (const v of N.W2.valves) {
      T.go(v.x + (v.x > 70 ? -1.6 : v.x > 58 ? -1.6 : 0), v.z + (v.x < 50 ? 1.7 : 0), 40, 0);
      for (let i = 0; i < 10 && !v.broken; i++) { N.aimAt(v.pos.x, v.pos.y, v.pos.z); N.heroAttack(); await new Promise((r) => setTimeout(r, 420)); }
      if (v.broken) n++;
    }
    return n;
  });
  check('M7 valves smashed', n === 3, `${n}/3`);
  await shot('m7-valves');
  check('M7 -> M8 (power on)', await waitMission(8, 40000) && await ev(() => window.__nomanisan.GAME.power));
}
if (from <= 8) {
  // ---- M8 Armory: take the boots, double jump
  await ensure(8);
  await ev(async () => { const N = window.__nomanisan; T.go(16, -54.5, 40, Math.PI); await new Promise((r) => setTimeout(r, 400)); });
  await ev(() => T.until(() => /rocket boots/.test(window.__nomanisan.STORY.objective), 20000));
  await ev(async () => { const N = window.__nomanisan; N.aimAt(18, 41.5, -56); await new Promise((r) => setTimeout(r, 200)); N.useHot(); });
  await W(500);
  check('M8 boots taken', await ev(() => window.__nomanisan.HERO.boots));
  await ev(() => T.until(() => /Try the boots/.test(window.__nomanisan.STORY.objective), 20000));
  await ev(async () => { const k = window.__nomanisan.keys; k.Space = true; await new Promise((r) => setTimeout(r, 80)); k.Space = false; await new Promise((r) => setTimeout(r, 350)); k.Space = true; await new Promise((r) => setTimeout(r, 1200)); k.Space = false; });
  await shot('m8-boots');
  check('M8 -> M9', await waitMission(9));
}
if (from <= 9) {
  // ---- M9 Proving ground: round one, then Omnidroid v.9
  await ensure(9);
  await ev(() => T.go(0, -80, 40, 0));
  await ev(() => T.until(() => window.__nomanisan.ENEMIES.some((e) => e.alive && e.group === 'arena'), 25000));
  const r1 = await ev(() => T.fightGroup('arena', 60000));
  check('M9 round one cleared', r1);
  await ev(() => T.until(() => window.__nomanisan.OMNI.state !== 'off', 20000));
  await W(3000);
  await shot('m9-omni');
  const boss = await ev(async () => {
    const N = window.__nomanisan, O = N.OMNI; let swings = 0, locks = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 70000 && O.state !== 'dead') {
      if (O.state === 'locked') { locks++; N.at(O.pos.x + 3.6, O.pos.z, 40, 0); N.aimAt(O.pos.x, 40 + O.h - 1, O.pos.z); N.heroAttack(); swings++; }
      else if (O.state === 'windup' || O.state === 'slam') { const k = N.keys; k.Space = true; setTimeout(() => (k.Space = false), 120); }
      else if (Math.hypot(O.pos.x - N.P.x, O.pos.z - N.P.z) > 11) N.at(O.pos.x + 8, O.pos.z, 40, 0);
      await new Promise((r) => setTimeout(r, 330));
    }
    return { state: O.state, hp: O.hp, swings };
  });
  check('M9 Omnidroid destroyed in its lock windows', boss.state === 'dead', JSON.stringify(boss));
  check('M9 -> M10', await waitMission(10, 30000));
}
if (from <= 10) {
  // ---- M10 Mirage: break the field nodes
  await ensure(10);
  await ev(() => T.go(-35, -58, 40, -Math.PI / 2));
  await ev(() => T.until(() => /field nodes/.test(window.__nomanisan.STORY.objective), 25000));
  await shot('m10-field');
  const n = await ev(async () => {
    const N = window.__nomanisan; let n = 0;
    for (const nd of N.W2.nodes) {
      const p = nd.pos, high = p.y > 44;
      for (let i = 0; i < 8 && !nd.broken; i++) {
        T.go(p.x + (p.x < -45 ? 1.8 : p.x > -35 ? -1.8 : 0), p.z + (p.z > -46 ? -1.8 : 0), 40, 0);
        if (high) { await T.until(() => N.P.grounded, 3000); N.aimAt(p.x, p.y, p.z); await new Promise((r) => setTimeout(r, 300)); N.aimAt(p.x, p.y, p.z); N.P.vy = Math.sqrt(2 * 20 * (p.y - 1.0 - N.P.y)); N.P.grounded = false; await T.until(() => N.P.vy < 1.5, 2000); }
        N.aimAt(p.x, p.y, p.z); N.heroAttack();
        await new Promise((r) => setTimeout(r, 450));
      }
      if (nd.broken) n++;
    }
    return n;
  });
  check('M10 field nodes broken', n === 4, `${n}/4`);
  await W(2500);
  await shot('m10-mirage');
  check('M10 -> M11', await waitMission(11, 40000));
}
if (from <= 11) {
  // ---- M11 Heart: slam the grate, the pillars, the updraft
  await ensure(11);
  await ev(() => { const N = window.__nomanisan; T.go(N.GRATE.x + 0.5, N.GRATE.z + 0.5, 40, 0); });
  await ev(() => T.until(() => /grate/.test(window.__nomanisan.STORY.objective), 20000));
  await ev(async () => { const N = window.__nomanisan; N.P.vy = 9; N.P.grounded = false; await new Promise((r) => setTimeout(r, 450)); N.heroAttack(); });
  await W(1500);
  check('M11 grate slammed open', await ev(() => window.__nomanisan.GRATE.open));
  await ev(() => { const N = window.__nomanisan; T.go(N.GRATE.x, N.GRATE.z, 40, 0); });
  const fell = await ev(() => T.until(() => window.__nomanisan.P.room === 'heart' && window.__nomanisan.P.grounded, 15000));
  check('M11 drops into the Heart cavern', fell, JSON.stringify((await state()).p));
  await W(600); await skipCut(); await W(500);
  await shot('m11-cavern');
  const mur = await ev(() => { const N = window.__nomanisan; const m = N.HEART.muralPos; T.go(m.x * 0.7 + N.HEART.x * 0.3, m.z * 0.7 + N.HEART.z * 0.3, N.HEART.y, 0); return T.scan(N.HEART.mural); });
  check('M11 mural scanned', mur);
  const pil = await ev(async () => {
    const N = window.__nomanisan;
    await T.until(() => /order/.test(N.STORY.objective), 10000);
    for (const k of ['sun', 'wave', 'eye']) {
      const p = N.HEART.pillars.find((q) => q.kind === k);
      const dx = N.HEART.x - p.x, dz = N.HEART.z - p.z, d = Math.hypot(dx, dz);
      T.go(p.x + dx / d * 2.2, p.z + dz / d * 2.2, N.HEART.y, 0);
      await new Promise((r) => setTimeout(r, 300)); N.aimAt(p.x, N.HEART.y + 1.6, p.z); await new Promise((r) => setTimeout(r, 200)); N.useHot(); await new Promise((r) => setTimeout(r, 500));
    }
    return !N.HEART.sealed;
  });
  check('M11 pillars pressed in order', pil);
  await W(3000);
  await ev(() => { const N = window.__nomanisan; T.go(N.HEART.x + 6, N.HEART.z, N.HEART.y, 0); });
  await ev(() => T.until(() => window.__nomanisan.STORY.flags.updraft, 20000));
  await shot('m11-heart');
  // ride: stand under the shaft, jump, hold space (glide), and steer outward at the top
  const rode = await ev(async () => {
    const N = window.__nomanisan, k = N.keys;
    T.go(N.GRATE.x + 0.3, N.GRATE.z, N.HEART.y, 0);
    await new Promise((r) => setTimeout(r, 300));
    k.Space = true; await new Promise((r) => setTimeout(r, 100)); k.Space = false; await new Promise((r) => setTimeout(r, 300));
    k.Space = true;
    let top = 0; const t0 = performance.now();
    while (performance.now() - t0 < 30000) {
      top = Math.max(top, N.P.y);
      if (N.P.y > 140) { N.aimAt(N.P.x + 40, N.P.y, N.P.z); k.KeyW = true; }
      if (N.P.grounded && N.P.y > 130) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    k.Space = false; k.KeyW = false;
    return { top, y: N.P.y, grounded: N.P.grounded };
  });
  check('M11 updraft carries the hero up to the crater', rode.top > 136, JSON.stringify(rode));
  await shot('m11-ride');
  check('M11 -> M12', await waitMission(12, 30000));
}
if (from <= 12) {
  // ---- M12 Kronos
  await ensure(12);
  await W(1000); await skipCut(); await W(1500);
  await shot('m12-kronos');
  const py = await ev(async () => {
    const N = window.__nomanisan; let n = 0;
    for (const pl of N.W2.pylons) {
      for (let i = 0; i < 10 && !pl.broken; i++) { const p = pl.pos; const dx = p.x - (0), dz = p.z - (-100), d = Math.hypot(dx, dz); T.go(p.x - dx / d * 2.4, p.z - dz / d * 2.4, 136, 0); N.aimAt(p.x, p.y - 3, p.z); N.heroAttack(); await new Promise((r) => setTimeout(r, 420)); }
      if (pl.broken) n++;
    }
    return n;
  });
  check('M12 pylons destroyed', py === 3, `${py}/3`);
  await ev(() => T.until(() => window.__nomanisan.KRONOS.state === 'frozen', 30000));
  await W(4000);
  await shot('m12-frozen');
  const core = await ev(async () => {
    const N = window.__nomanisan, K = N.KRONOS; const t0 = performance.now();
    while (performance.now() - t0 < 30000 && !N.STORY.flags.kPhase3) {
      if (K.state === 'frozen') { const p = K.pos; const dx = p.x - 0, dz = p.z + 100, d = Math.hypot(dx, dz) || 1; T.go(p.x + dx / d * 6.5, p.z + dz / d * 6.5, 136, 0); N.aimAt(p.x, p.y, p.z); N.heroAttack(); }
      await new Promise((r) => setTimeout(r, 380));
    }
    return { phase3: !!N.STORY.flags.kPhase3, hp: K.hp, state: K.state };
  });
  check('M12 core punched while frozen', core.phase3, JSON.stringify(core));
  await ev(() => T.until(() => window.__nomanisan.W2.vents.some((v) => v.on), 30000));
  await shot('m12-rage');
  const slam = await ev(async () => {
    const N = window.__nomanisan, K = N.KRONOS, k = N.keys; let tries = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 60000 && K.state !== 'dying' && K.state !== 'dead') {
      tries++;
      const v = N.W2.vents[tries % 3];
      T.go(v.x, v.z, v.y, 0);
      await new Promise((r) => setTimeout(r, 200));
      k.Space = true; await new Promise((r) => setTimeout(r, 90)); k.Space = false; await new Promise((r) => setTimeout(r, 250)); k.Space = true;
      // rise in the vent, then hop over Kronos and dive
      await T.until(() => N.P.y > K.pos.y + 4, 8000);
      k.Space = false;
      N.P.x = K.pos.x + 1; N.P.z = K.pos.z; N.P.y = Math.max(N.P.y, K.pos.y + 6); N.P.vy = 0;
      N.heroAttack();
      await new Promise((r) => setTimeout(r, 900));
    }
    return { state: K.state, hp: K.hp, tries };
  });
  check('M12 slams Kronos from above', slam.state === 'dying' || slam.state === 'dead', JSON.stringify(slam));
  const ended = await ev(() => T.until(() => window.__nomanisan.GAME.mode === 'ending' || window.__nomanisan.CUT.on, 30000));
  await W(2000);
  await shot('m12-finale');
  await ev(() => window.__nomanisan.skipCutscene());
  await ev(() => T.until(() => window.__nomanisan.GAME.mode === 'ending', 20000));
  check('M12 -> ending', ended && (await state()).mode === 'ending');
  await shot('m12-ending');
}
console.log('\n==== RESULTS ====');
for (const r of results) console.log(r[0], r[1], r[2] ? '— ' + r[2] : '');
console.log('errors:', errors.length);
for (const e of [...new Set(errors)].slice(0, 15)) console.log('  ', e);
await browser.close();
