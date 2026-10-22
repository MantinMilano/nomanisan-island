// ============================================================ the story: thirteen missions, checkpoints, saving
// Each mission has a spawn point, a script (run) and the world state it leaves behind (done).
// Jumping to any mission resets the world, replays every earlier mission's done(), then runs that mission,
// so the dev menu, checkpoints and saved games all build the same world for the same moment.
const WORLD = { awake: false };
const STORY = { mission: 0, gen: 0, clock: 0, flags: {}, shards: new Set(), upgrades: 0, kills: 0, kos: 0, target: null, targetFn: null, route: null, routeI: 0,
  objective: '', hint: '', cp: null, boss: null, hideMarker: false, skipStep: false, idleT: 120 };
const CANCEL = { cancelled: true };
const WAITS = [], WATCHES = [];

// ---- script helpers (every await rejects with CANCEL when the mission is abandoned)
function until(fn, main) { const gen = STORY.gen; return new Promise((res, rej) => WAITS.push({ fn, res, rej, gen, main })); }
function req(fn, force) { return until(fn, true).then((skipped) => { if (skipped && force) force(); }); }
function wait(sec) { const end = STORY.clock + sec; return until(() => STORY.clock >= end); }
function on(fn, cb) { WATCHES.push({ fn, cb, gen: STORY.gen }); }
async function line(ids) { const g = STORY.gen; await talk(ids); if (g !== STORY.gen) throw CANCEL; }
async function cut(shots, lines) { const g = STORY.gen; await cutscene(shots, lines); if (g !== STORY.gen) throw CANCEL; }
function updateWaits(dt) {
  if (GAME.mode === 'play' || GAME.mode === 'cutscene' || GAME.mode === 'ko' || GAME.mode === 'ride' || GAME.mode === 'terminal') STORY.clock += dt;
  let skipUsed = false;
  for (let i = WAITS.length - 1; i >= 0; i--) {
    const w = WAITS[i];
    if (w.gen !== STORY.gen) { WAITS.splice(i, 1); w.rej(CANCEL); continue; }
    let ok = false;
    try { ok = w.fn(); } catch (e) { console.error(e); }
    const skip = w.main && STORY.skipStep && !skipUsed;
    if (ok || skip) { WAITS.splice(i, 1); if (skip && !ok) skipUsed = true; w.res(!ok); }
  }
  if (skipUsed || !WAITS.some((w) => w.main)) STORY.skipStep = false;
  for (let i = WATCHES.length - 1; i >= 0; i--) {
    const w = WATCHES[i];
    if (w.gen !== STORY.gen) { WATCHES.splice(i, 1); continue; }
    let ok = false;
    try { ok = w.fn(); } catch (e) { console.error(e); }
    if (ok) { WATCHES.splice(i, 1); try { w.cb(); } catch (e) { console.error(e); } }
  }
}

// ---- objectives and the marker
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function objective(text, o = {}) {
  STORY.objective = text; STORY.hint = o.hint || '';
  STORY.targetFn = o.targetFn || (o.target ? () => o.target : null);
  STORY.route = o.route || null; STORY.routeI = 0;
  renderObjective(true);
}
function setObjectiveText(text) { STORY.objective = text; renderObjective(false); }
function hint(text) { STORY.hint = text; renderObjective(false); }
function renderObjective(flash) {
  $('objText').textContent = STORY.objective;
  $('objHint').textContent = STORY.hint;
  $('objective').hidden = !STORY.objective;
  if (flash && STORY.objective) { sfx('objective'); $('objective').animate([{ opacity: 0.2, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'ease-out' }); }
}
function updateObjectiveTarget() {
  let t = null;
  if (STORY.route && STORY.routeI < STORY.route.length) {
    const r = STORY.route[STORY.routeI];
    if (Math.hypot(P.x - r.x, P.z - r.z) < (r.r || 7) && Math.abs(P.y - r.y) < 6) STORY.routeI++;
    if (STORY.routeI < STORY.route.length) t = STORY.route[STORY.routeI];
  }
  if (!t && STORY.targetFn) t = STORY.targetFn();
  STORY.target = t || null;
}
const dist3 = (p) => Math.hypot(P.x - p.x, P.y - p.y, P.z - p.z);
const dist2 = (p) => Math.hypot(P.x - p.x, P.z - p.z);

// ---- checkpoints
function checkpoint(cp) { STORY.cp = cp; saveGame(); }
function currentCheckpoint() { return STORY.cp || MISSIONS[Math.min(STORY.mission, MISSIONS.length - 1)].spawn(); }
function placeHero(cp) {
  placeAt(cp);
  HERO.face = Math.atan2(-Math.sin(cp.yaw || 0), -Math.cos(cp.yaw || 0));
  P.pitch = -0.12;
  CAMR.pivot = null; CAMR.cur = 1.5;
}
const lookYaw = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

// ---- world switches used by several missions
function setAwake(on) {
  WORLD.awake = on;
  for (const s of SECURITY.searchlights) {
    if (s.state === 'hacked' && on) continue;
    s.state = on ? 'active' : 'dormant';
    s.spot.intensity = on ? 9000 : 0; s.cone.visible = on;
    if (s.lens) s.lens.material.emissiveIntensity = on ? 3.2 : 0.1;
  }
}
function powerOnNow() { GAME.power = true; U.power.value = 1; }
function blackout() {
  sfx('power'); FX.shake = 0.8;
  const f0 = FADE.v; FADE.v = 0.85; FADE.target = 0.85; finalPass.uniforms.uFade.value = 0.85;
  setTimeout(() => fadeTo(0.35, 0.2), 700); setTimeout(() => fadeTo(0.9, 0.1), 900); setTimeout(() => fadeTo(f0 > 0.5 ? 0 : f0, 1.5), 1600);
}
function heroIsHigh() { return P.y > CRATER_Y - 1.5 && P.grounded && Math.hypot(P.x - VX, P.z - VZ) > SILO_R + 1; }

// ============================================================ the missions
function missionSpawns() {
  const R = POI.radio, a = POI.caveA, ry = terrainHeight(R.x, R.z);
  // the crater-floor spawn: the spot on the ring furthest from the kiosk, the pylons and the vents
  const kioskA = Math.atan2(-84.8 - VZ, -24.5 - VX);
  const taken = [kioskA, ...W2.pylons.map((p) => Math.atan2(p.pos.z - VZ, p.pos.x - VX)), ...W2.vents.map((v) => Math.atan2(v.z - VZ, v.x - VX))];
  let bestA = kioskA + 1, bestS = -1;
  for (let a = 0; a < TAU; a += 0.05) { const s = Math.min(...taken.map((b) => Math.abs(wrapAngle(a - b)))); if (s > bestS) { bestS = s; bestA = a; } }
  const cr = fromV(30, bestA);
  return {
    beach: () => ({ ...W2.boatSpawn }),
    radio: () => ({ x: R.x + 9, z: R.z + 7, yaw: lookYaw({ x: R.x + 9, z: R.z + 7 }, R) }),
    tower: () => ({ x: R.x + 5, z: R.z + 5, y: ry, yaw: lookYaw({ x: R.x + 5, z: R.z + 5 }, fromV(199, a)) }),
    cave: () => { const p = fromV(204, a); return { x: p.x, z: p.z, yaw: lookYaw(p, POI.door) }; },
    hall: () => ({ x: -20, z: -2, y: BASE_Y, yaw: -Math.PI / 2 }),
    computer: () => ({ x: 55, z: -13.5, y: BASE_Y, yaw: -Math.PI / 2 }),
    lab: () => ({ x: 62, z: -38, y: BASE_Y, yaw: Math.PI }),
    corridor: () => ({ x: 0, z: -64, y: BASE_Y, yaw: 0 }),
    corridor2: () => ({ x: 0, z: -58, y: BASE_Y, yaw: Math.PI / 2 }),
    containment: () => ({ x: -35, z: -58, y: BASE_Y, yaw: -Math.PI / 2 }),
    crater: () => ({ x: cr.x, z: cr.z, y: CRATER_Y, yaw: lookYaw(cr, { x: VX, z: VZ }) }),
    rim: () => ({ x: POI.rimStation.x, z: POI.rimStation.z, y: POI.rimStation.y, yaw: POI.rimStation.yaw + Math.PI }),
  };
}
let SP = null;
const MISSIONS = [
  { id: 'm0', name: 'Landfall', sub: 'A beacon switched on three nights ago', spawn: () => SP.beach(),
    async run() {
      const b = W2.boat, s = W2.boatSpawn, gy = groundY(s.x, s.z), o = POI.out;
      STORY.hideMarker = true;
      await cut([
        { from: [b.x + o.x * 30 + 6, b.y + 9, b.z + o.z * 30], to: [b.x + o.x * 14 + 4, b.y + 4, b.z + o.z * 14], look: [b.x, b.y + 1, b.z], dur: 7, fov: 50 },
        { from: [s.x + 4, gy + 2.2, s.z + 3.5], to: [s.x + 2.6, gy + 2.0, s.z + 2.2], look: [s.x, gy + 1.7, s.z], dur: 9, fov: 45 },
      ], ['m0_01', 'm0_02', 'm0_03', 'm0_04', 'm0_05', 'm0_06']);
      STORY.hideMarker = false;
      objective('Get your bearings.', { hint: 'WASD to move, Shift to run. Space to jump; hold Space, then let go, for a super jump.' });
      await req(() => STORY.flags.superJumped || STORY.clock > STORY.t0 + 20);
      if (STORY.flags.superJumped) await line(['m0_07']);
      await line(['m0_08']);
      objective('Scan the boat for the tracker.', { target: W2.tracker.pos(), hint: 'Press Q to scan, then look at the blinking light in the cabin.' });
      await req(() => STORY.flags.tracker, () => { STORY.flags.tracker = true; });
      await line(['m0_09']);
    },
    done() { STORY.flags.tracker = true; } },

  { id: 'm1', name: 'Lights in the Jungle', sub: 'Somebody is paying the electric bill', spawn: () => SP.beach(),
    async run() {
      const R = POI.radio, tower = V3(R.x, terrainHeight(R.x, R.z) + 2, R.z);
      const s = W2.boatSpawn;
      objective('Follow the signal to radio hill.', { target: tower, hint: 'West, past the waterfall. The marker shows the way; Q shows more.' });
      on(() => Math.hypot(P.x - s.x, P.z - s.z) > 60, () => talk(['m1_01', 'm1_02', 'm1_03']));
      on(() => Math.hypot(P.x - W2.firstCam.x, P.z - W2.firstCam.z) < 26, () => talk(['m1_04']));
      const ds = { x: lerp(POI.pool.x, R.x, 0.45), z: lerp(POI.pool.z, R.z, 0.45) };
      on(() => Math.hypot(P.x - ds.x, P.z - ds.z) < 55, () => {
        for (let i = 0; i < 2; i++) spawnEnemy('drone', ds.x + i * 4, terrainHeight(ds.x, ds.z) + 4, ds.z + i * 3, { group: 'm1' });
        talk(['m1_06']).then(() => note('Left click to punch. Jump, then click again to slam down.', 6));
      });
      await req(() => dist2(tower) < 14);
    } },

  { id: 'm2', name: 'Radio Hill', sub: "Gazerbeam's signal", spawn: () => SP.radio(),
    async run() {
      const R = POI.radio, top = W2.towerTop;
      await line(['m2_01']);
      objective('Climb the radio tower.', { target: V3(R.x - 2.3, terrainHeight(R.x, R.z) + 1.5, R.z), hint: 'The ladder is on the west side. Press E at its foot.' });
      on(() => P.y > top - 1, () => objective('Scan the thing wired into the mast.', { target: W2.visorPos, hint: 'Press Q and look at it.' }));
      await req(() => P.y > top - 1 && dist2(R) < 4, () => placeHero({ x: R.x - 2.6, z: R.z, y: top, yaw: -Math.PI / 2 }));
      await req(() => STORY.flags.visorScanned, () => { STORY.flags.visorScanned = true; });
      await line(['m2_02']);
      objective('Pull it out.', { target: W2.visorPos });
      await req(() => STORY.flags.visorTaken, () => { STORY.flags.visorTaken = true; W2.visor.visible = false; });
      const v = W2.visorPos;
      await cut([{ from: [v.x - 6, v.y + 1.5, v.z + 5], to: [v.x - 5, v.y + 0.5, v.z + 2], look: [P.x, P.y + 1.7, P.z], dur: 10, fov: 45 }], ['m2_03', 'm2_04', 'm2_05', 'm2_06']);
      setAwake(true); sfx('power'); FX.shake = 0.6;
      await cut([{ from: [R.x - 30, top + 22, R.z + 30], to: [R.x - 10, top + 30, R.z + 60], look: [VX, 110, VZ], lookTo: [0, 60, 120], dur: 12, fov: 55 }], ['m2_07', 'm2_08', 'm2_09', 'm2_10']);
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; spawnEnemy('drone', R.x + Math.cos(a) * 14, top + rr(-6, 2), R.z + Math.sin(a) * 14, { group: 'm2', hunt: true }); }
      objective('Take down the drones.', { hint: 'Left click to punch. In the air, click to slam. E picks up crates; click to throw them.' });
      await req(() => groupAlive('m2') === 0, () => clearGroup('m2'));
    },
    done() { STORY.flags.visorTaken = true; W2.visor.visible = false; setAwake(true); } },

  { id: 'm3', name: "Gazerbeam's Trail", sub: 'He burned a path for whoever came next', spawn: () => SP.tower(),
    async run() {
      await line(['m3_01']);
      const marks = W2.scorch;
      const nextMark = () => marks.find((m) => !STORY.flags['scorch' + m.i]);
      objective("Follow Gazerbeam's scorch marks.", { targetFn: () => { const m = nextMark(); return m ? m.p : null; }, hint: 'Press Q. The burns only show up in the scanner. Look at each one.' });
      on(() => STORY.flags.scorch0 || marks.some((m) => STORY.flags['scorch' + m.i]), () => talk(['m3_02']));
      const mouth = fromV(198, POI.caveA);
      await req(() => !nextMark() || dist2(mouth) < 6, () => placeHero({ ...fromV(201, POI.caveA), yaw: lookYaw(fromV(201, POI.caveA), POI.caveChamber) }));
      const C = POI.caveChamber;
      objective('Go into the cave.', { target: V3(C.x, C.y + 1, C.z) });
      await req(() => P.room === 'cave' && dist2(C) < 4.5, () => placeHero({ x: C.x, z: C.z, y: C.y, yaw: 0 }));
      checkpoint({ x: C.x, z: C.z, y: C.y, yaw: lookYaw(C, { x: VX, z: VZ }) });
      await line(['m3_03']);
      const G = W2.gazer; G.target = 1; sfx('shard');
      await line(['m3_04', 'm3_05']);
      G.target = 0;
      await line(['m3_06', 'm3_07', 'm3_08']);
      objective('Read what Simon burned into the rock.', { target: W2.wordPos, hint: 'Press E by the wall.' });
      await req(() => GAME.knowsPassword, () => { GAME.knowsPassword = true; });
    },
    done() { GAME.knowsPassword = true; } },

  { id: 'm4', name: 'Behind the Falls', sub: 'They all used the back door', spawn: () => SP.cave(),
    async run() {
      const D = POI.door, door = V3(D.x, POI.ledgeY + 1.5, D.z);
      objective('Find the door behind the waterfall.', { target: door });
      on(() => dist2(D) < 32, () => talk(['m4_01']));
      await req(() => dist2(D) < 6.5 || STORY.flags.triedDoor, () => placeHero({ x: D.x + POI.dirS.x * 3, z: D.z + POI.dirS.z * 3, y: POI.ledgeY, yaw: lookYaw({ x: D.x + POI.dirS.x * 3, z: D.z + POI.dirS.z * 3 }, D) }));
      await line(['m4_02']);
      objective('Break the door down.', { target: door, hint: 'Punch it. Three good hits.' });
      await req(() => POI.wfDoorState.target, () => { POI.wfDoorState.broken = true; POI.wfDoorState.target = 1; });
      objective('Get inside: through the checkpoint and the door corridor.', { route: [V3(D.x - POI.dirS.x * 8, POI.ledgeY, D.z - POI.dirS.z * 8), V3(-68, BASE_Y, -2), V3(-56, BASE_Y, -2), V3(-30, BASE_Y, -2)], targetFn: () => V3(-20, BASE_Y + 1, -2), hint: 'Cameras are everywhere. Punch them, throw things at them, or scan them and hold E to hack.' });
      on(() => P.room === 'checkpoint', () => { talk(['m4_03']); checkpoint({ x: -73.5, z: -2, y: BASE_Y, yaw: -Math.PI / 2 }); });
      await req(() => P.room === 'hall', () => placeHero(SP.hall()));
    },
    done() { const st = POI.wfDoorState; st.broken = true; st.target = 1; st.open = 1; } },

  { id: 'm5', name: 'Dinner Is Served', sub: 'It is always eight o’clock', spawn: () => SP.hall(),
    async run() {
      objective('Cross the grand hall.', { target: V3(26, BASE_Y + 1, -14), hint: 'The dining room is on the far side.' });
      await req(() => P.room === 'dining', () => placeHero({ x: 29, z: -14, y: BASE_Y, yaw: -Math.PI / 2 }));
      checkpoint({ x: 28, z: -14, y: BASE_Y, yaw: -Math.PI / 2 });
      W2.syn.target = 1; sfx('zap');
      STORY.hideMarker = true;
      await line(['m5_01', 'm5_02', 'm5_03', 'm5_04', 'm5_05']);
      STORY.hideMarker = false;
      FX.shake = 0.7; sfx('rumble');
      for (const [x, z] of [[34, -8], [34, -20]]) spawnEnemy('spider', x, BASE_Y, z, { room: 'dining', group: 'm5' });
      setTimeout(() => { W2.syn.target = 0; }, 2500);
      objective('Destroy the spider-bots.', { hint: 'They wind up before they strike. Dodge, then hit back.' });
      await req(() => groupAlive('m5') === 0, () => clearGroup('m5'));
      await line(['m5_06']);
      objective('Find the switch under the head of the table.', { target: V3(43, BASE_Y + 0.8, -14), hint: 'Press E at the end of the table.' });
      await req(() => LAVA_WALL.target, () => { LAVA_WALL.target = 1; });
      await line(['m5_07']);
      objective('Go through the lava wall.', { target: V3(56, BASE_Y + 1, -14) });
      await req(() => P.room === 'computer', () => placeHero(SP.computer()));
    },
    done() { LAVA_WALL.target = 1; LAVA_WALL.open = 1; } },

  { id: 'm6', name: 'The Kronos Files', sub: 'He kept a copy of himself', spawn: () => SP.computer(),
    async run() {
      objective('Log in to the Kronos computer.', { target: V3(65.6, BASE_Y + 1.6, -14), hint: 'The password is the word Simon burned into the cave wall.' });
      await req(() => GAME.loggedIn, () => { GAME.loggedIn = true; });
      on(() => true, () => talk(['m6_01']));
      objective('Open the Kronos Protocol file.', { target: V3(65.6, BASE_Y + 1.6, -14), hint: 'Choose KRONOS PROTOCOL on the menu.' });
      await req(() => STORY.flags.protocol, () => { STORY.flags.protocol = true; });
      await until(() => GAME.mode === 'play');
      await line(['m6_02', 'm6_03', 'm6_04', 'm6_05', 'm6_06']);
      blackout();
      await wait(2.5);
    },
    done() { GAME.loggedIn = true; STORY.flags.protocol = true; } },

  { id: 'm7', name: 'Power Struggle', sub: 'You want power? Go get it', spawn: () => SP.computer(),
    async run() {
      await line(['m7_01', 'm7_02']);
      const left = () => W2.valves.filter((v) => !v.broken);
      const txt = () => `Smash the overloaded valves in the geothermal plant (${3 - left().length}/3).`;
      objective(txt(), { route: [V3(62, BASE_Y, -28), V3(62, BASE_Y, -37)], targetFn: () => { const l = left(); l.sort((a, b) => dist2(a) - dist2(b)); return l[0] ? l[0].pos : null; }, hint: "Don't fall in the lava. Q shows the valves through the walls." });
      on(() => P.room === 'lab', () => {
        checkpoint(SP.lab());
        spawnEnemy('spider', 42, BASE_Y, -50, { room: 'lab', group: 'm7' }); spawnEnemy('spider', 74, BASE_Y, -58, { room: 'lab', group: 'm7' });
        talk(['m7_03']);
      });
      let seen = 0;
      await req(() => { const n = 3 - left().length; if (n !== seen) { seen = n; setObjectiveText(txt()); if (n > 0 && n < 3 && groupAlive('m7') < 2) spawnEnemy('spider', 58, BASE_Y, -62, { room: 'lab', group: 'm7' }); } return left().length === 0; }, () => W2.valves.forEach((v) => breakValve(v, true)));
      clearGroup('m7');
      sfx('power'); FX.shake = 0.8; powerOnNow();
      await wait(1.5);
      await line(['m7_04']);
    },
    done() { W2.valves.forEach((v) => breakValve(v, true)); powerOnNow(); } },

  { id: 'm8', name: 'The Armory', sub: 'Every prototype he ever made', spawn: () => SP.lab(),
    async run() {
      await line(['m8_01']);
      objective('Find the trophy room.', { route: [V3(62, BASE_Y, -28), V3(50, BASE_Y, -13.5), V3(36, BASE_Y, -14), V3(0, BASE_Y, -24), V3(0, BASE_Y, -58), V3(10, BASE_Y, -60)], targetFn: () => V3(20, BASE_Y + 1, -60), hint: 'Back through the hall, then down the silo corridor.' });
      await req(() => P.room === 'trophy', () => placeHero({ x: 14, z: -60, y: BASE_Y, yaw: -Math.PI / 2 }));
      checkpoint({ x: 14, z: -60, y: BASE_Y, yaw: -Math.PI / 2 });
      await line(['m8_02']);
      objective('Take the rocket boots from the IncrediBoy case.', { target: V3(18, BASE_Y + 1.5, -56) });
      await req(() => HERO.boots, () => takeBoots(true));
      await line(['m8_03', 'm8_04']);
      note('Rocket boots: press Space in the air to jump again. Hold Space while falling to glide.', 8);
      await line(['m8_05']);
      objective('Try the boots.', { hint: 'Double jump, then hold Space to glide.' });
      await req(() => STORY.flags.glided || STORY.flags.doubleJumped);
    },
    done() { takeBoots(true); } },

  { id: 'm9', name: 'The Proving Ground', sub: 'Tonight’s contestant', spawn: () => SP.corridor(),
    async run() {
      objective('Head into the launch silo.', { route: [V3(0, BASE_Y, -60), V3(0, BASE_Y, -74)], targetFn: () => V3(0, BASE_Y + 1, -86) });
      await req(() => P.room === 'silo', () => placeHero({ x: 0, z: -80, y: BASE_Y, yaw: 0 }));
      checkpoint({ x: 0, z: -79, y: BASE_Y, yaw: 0 });
      await line(['m9_01', 'm9_02']);
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; spawnEnemy('drone', VX + Math.cos(a) * 12, BASE_Y + 5, VZ + Math.sin(a) * 12, { room: 'silo', group: 'arena', hunt: true }); }
      for (const [x, z] of [[-10, VZ - 10], [10, VZ + 8]]) spawnEnemy('spider', x, BASE_Y, z, { room: 'silo', group: 'arena' });
      objective('Round one: clear the arena.', { hint: 'Throw the crates and drums. Drums explode.' });
      await req(() => groupAlive('arena') === 0, () => clearGroup('arena'));
      await line(['m9_03']);
      startOmni();
      objective('Destroy Omnidroid v.9.', { hint: 'Jump over its stomp. Then its legs lock: hit the glowing core underneath.' });
      await req(() => OMNI.state === 'dead', () => { OMNI.state = 'dead'; omniShow(false); STORY.boss = null; });
      await wait(1.5);
      await line(['m9_05', 'm9_06']);
    },
    done() { OMNI.state = 'dead'; omniShow(false); STORY.boss = null; } },

  { id: 'm10', name: 'Mirage', sub: 'The voice on the radio', spawn: () => SP.corridor2(),
    async run() {
      objective("Follow Mirage's signal to the containment wing.", { route: [V3(0, BASE_Y, -58), V3(-16, BASE_Y, -58)], targetFn: () => V3(-36, BASE_Y + 1, -58) });
      await req(() => P.room === 'containment', () => placeHero(SP.containment()));
      checkpoint(SP.containment());
      await line(['m10_01', 'm10_02']);
      for (let i = 0; i < 2; i++) spawnEnemy('drone', -36 - i * 8, BASE_Y + 6, -50, { room: 'containment', group: 'm10', hunt: true });
      const left = () => W2.nodes.filter((n) => !n.broken);
      objective('Break the four field nodes (0/4).', { targetFn: () => { const l = left(); l.sort((a, b) => dist3(a.pos) - dist3(b.pos)); return l[0] ? l[0].pos : null; }, hint: 'Two are high up. Super jump, or throw a crate.' });
      let seen = 0;
      await req(() => { const n = 4 - left().length; if (n !== seen) { seen = n; setObjectiveText(`Break the four field nodes (${n}/4).`); } return !left().length; }, () => W2.nodes.forEach((n) => breakNode(n, true)));
      clearGroup('m10');
      setFieldOn(false); sfx('zap'); FX.shake = 0.5;
      W2.mirage.state = 'falling'; W2.mirage.vy = 0; W2.mirage.y = BASE_Y + 3.2;
      await wait(2);
      objective('');
      await line(['m10_03', 'm10_04', 'm10_05', 'm10_06']);
    },
    done() { W2.nodes.forEach((n) => breakNode(n, true)); setFieldOn(false); W2.mirage.state = 'free'; } },

  { id: 'm11', name: 'Heart of the Mountain', sub: 'Nobody built this', spawn: () => SP.containment(),
    async run() {
      await line(['m11_01']);
      const gp = V3(GRATE.x, BASE_Y + 0.5, GRATE.z);
      objective('Break the grate under the launch pad.', { route: [V3(-16, BASE_Y, -58), V3(0, BASE_Y, -60), V3(0, BASE_Y, -76)], targetFn: () => gp, hint: 'Jump, then press attack in the air to slam down on it.' });
      on(() => P.room === 'silo', () => checkpoint({ x: 0, z: -80, y: BASE_Y, yaw: 0 }));
      await req(() => GRATE.open, () => openGrate(true));
      objective('Drop down the old shaft.', { target: gp });
      await req(() => P.room === 'heart' || P.y < BASE_Y - 12, () => placeHero({ x: GRATE.x, z: GRATE.z, y: HEART.y, yaw: lookYaw(GRATE, HEART) }));
      await until(() => P.grounded);
      STORY.flags.inHeart = true;
      checkpoint({ x: GRATE.x + 1.5, z: GRATE.z, y: HEART.y, yaw: lookYaw(GRATE, HEART) });
      const H = HEART;
      await cut([
        { from: [GRATE.x, H.y + 3, GRATE.z], to: [H.x + 18, H.y + 9, H.z + 14], look: [H.x, H.y + 3, H.z], dur: 7, fov: 60 },
        { from: [H.x - 16, H.y + 6, H.z - 10], to: [H.x - 8, H.y + 4, H.z - 6], look: [H.x, H.y + 4, H.z], dur: 5, fov: 50 },
      ], ['m11_02']);
      objective('Scan the carvings on the wall.', { target: HEART.muralPos, hint: 'Press Q and look at the band of carvings.' });
      await req(() => STORY.flags.mural, () => { STORY.flags.mural = true; });
      await line(['m11_03']);
      const want = ['sun', 'wave', 'eye'];
      objective('Press the carvings in order: sun, wave, eye.', { targetFn: () => { const k = want[HEART.order.length] || 'eye'; const p = HEART.pillars.find((q) => q.kind === k); return p ? V3(p.x, H.y + 3, p.z) : null; }, hint: 'Each pillar has one carving. Press E at its foot.' });
      await req(() => !HEART.sealed, () => unsealHeart(true));
      await wait(2.6);
      objective('Approach the Heart.', { target: V3(H.x, H.y + 3, H.z) });
      await req(() => dist2(H) < 9);
      await line(['m11_04']);
      HEART.awakeTarget = 1; sfx('power'); FX.shake = 1;
      await line(['m11_05']);
      IRIS.target = 1; FX.eruption = 1; FX.eruptionDecay = false; sfx('rumble'); sfx('thunder');
      STORY.flags.updraft = true;
      await line(['m11_06', 'm11_07']);
      objective('Ride the hot air up to the crater.', { targetFn: () => P.y < BASE_Y + 2 ? V3(GRATE.x, BASE_Y, GRATE.z) : V3(VX + SILO_R + 5, CRATER_Y + 1, VZ), hint: 'Jump under the shaft. The updraft carries you. Hold Space to glide; steer out over the crater floor at the top.' });
      await req(() => heroIsHigh(), () => placeHero(SP.crater()));
      FX.eruptionDecay = true;
    },
    done() { openGrate(true); unsealHeart(true); HEART.awake = HEART.awakeTarget = 1; STORY.flags.inHeart = true; IRIS.target = 1; IRIS.open = 1; STORY.flags.updraft = true; FX.eruption = 0.3; FX.eruptionDecay = true; } },

  { id: 'm12', name: 'Kronos Ascending', sub: 'Fully charged, fully armed, fully him', spawn: () => SP.crater(),
    async run() {
      startKronos();
      const c = SP.crater();
      await cut([
        { from: [c.x, CRATER_Y + 3, c.z], to: [c.x * 0.6 + VX * 0.4, CRATER_Y + 6, c.z * 0.6 + VZ * 0.4], look: [VX, CRATER_Y - 10, VZ], lookTo: [VX, CRATER_Y + 18, VZ], dur: 6, fov: 55 },
        { from: [VX + 30, CRATER_Y + 26, VZ + 10], to: [VX + 22, CRATER_Y + 20, VZ + 20], look: [VX, CRATER_Y + 18, VZ], dur: 8, fov: 50 },
      ], ['m12_01', 'm12_02', 'm12_03']);
      const left = () => W2.pylons.filter((p) => !p.broken);
      objective('Destroy the three shield pylons (0/3).', { targetFn: () => { const l = left(); l.sort((a, b) => dist2(a.pos) - dist2(b.pos)); return l[0] ? l[0].pos : null; }, hint: 'Stay moving. Its shots lead you.' });
      let seen = 0;
      await req(() => { const n = 3 - left().length; if (n !== seen) { seen = n; setObjectiveText(`Destroy the three shield pylons (${n}/3).`); } return !left().length; }, () => W2.pylons.forEach((p) => breakPylon(p, true)));
      clearGroup('kronos');
      await line(['m12_04']);
      KRONOS.state = 'frozen'; KRONOS.t = 0; sfx('zap'); FX.shake = 0.8;
      objective('Kronos is down. Hit its core!', { targetFn: () => KRONOS.pos, hint: 'Punch it while the field holds it.' });
      await req(() => STORY.flags.kPhase3, () => { KRONOS.hp = KRONOS.maxHp / 2; STORY.flags.kPhase3 = true; KRONOS.state = 'rage'; KRONOS.t = 0; });
      await line(['m12_05', 'm12_06']);
      for (const v of W2.vents) v.on = true;
      objective('Ride a steam vent up, then slam down on Kronos.', { targetFn: () => { const l = W2.vents.slice().sort((a, b) => dist2(a) - dist2(b)); return P.y > CRATER_Y + 12 ? KRONOS.pos : V3(l[0].x, l[0].y + 1, l[0].z); }, hint: 'Jump into a vent and hold Space to glide. Over Kronos, press attack to dive.' });
      await req(() => KRONOS.state === 'dying' || KRONOS.state === 'dead', () => { KRONOS.hp = 0; KRONOS.state = 'dying'; KRONOS.t = 0; STORY.boss = null; });
      objective('');
      talk(['m12_07']);
      await until(() => KRONOS.state === 'dead');
      await wait(1.2);
      FX.eruptionDecay = true; STORY.flags.updraft = false;
      HEART.awakeTarget = 0;
      ECHO_RISE.on = true;
      await cut([
        { from: [VX + 34, CRATER_Y + 8, VZ + 12], to: [VX + 26, CRATER_Y + 30, VZ + 26], look: [VX, CRATER_Y + 4, VZ], lookTo: [VX, CRATER_Y + 60, VZ], dur: 12, fov: 55 },
        { from: [P.x + 3, P.y + 2, P.z + 3], to: [P.x + 2, P.y + 1.8, P.z + 2], look: [P.x, P.y + 1.6, P.z], dur: 10, fov: 45 },
      ], ['m12_08', 'm12_09', 'm12_10', 'm12_11']);
      ECHO_RISE.on = false;
    },
    done() { KRONOS.state = 'dead'; kronosShow(false); for (const v of W2.vents) v.on = false; STORY.flags.updraft = false; HEART.awake = HEART.awakeTarget = 0; FX.eruption = 0.1; FX.eruptionDecay = true; } },

  { id: 'free', name: 'Nomanisan', sub: 'The island is quiet now', spawn: () => SP.rim(),
    async run() {
      objective('The island is yours. Find every echo shard and secret.', { hint: 'Echo shards glow in the scanner. Some need the boots to reach.' });
      await until(() => false);
    } },
];

// ============================================================ running, jumping, resetting
async function runMission(i) {
  const gen = STORY.gen;
  const m = MISSIONS[i];
  STORY.mission = i; STORY.t0 = STORY.clock;
  if (i < MISSIONS.length - 1) banner(m.name.toUpperCase(), `Mission ${i} · ${m.sub}`);
  saveGame();
  try { await m.run(); } catch (e) { if (e !== CANCEL) console.error(e); return; }
  if (gen !== STORY.gen) return;
  if (m.done) m.done();
  if (i === 12) { showEnding(); return; }
  if (i + 1 < MISSIONS.length) { STORY.cp = null; runMission(i + 1); }
}
function cancelStory() {
  STORY.gen++;
  for (const w of WAITS.splice(0)) w.rej(CANCEL);
  WATCHES.length = 0;
  dlgCancelAll();
  if (CUT.on) endCutscene(false);
}
function jumpToMission(i, opts = {}) {
  cancelStory();
  resetWorld();
  for (let j = 0; j < i; j++) if (MISSIONS[j].done) MISSIONS[j].done();
  STORY.mission = i;
  STORY.cp = opts.cp || null;
  placeHero(opts.cp || MISSIONS[i].spawn());
  GAME.mode = 'play'; finalPass.uniforms.uFreeze.value = 0;
  FADE.v = 1; finalPass.uniforms.uFade.value = 1; fadeTo(0, 1.2);
  applyUpgrades(); HERO.hp = HERO.maxHp;
  runMission(i);
}
function resetWorld() {
  STORY.flags = {}; STORY.boss = null; STORY.target = null; STORY.targetFn = null; STORY.route = null; STORY.objective = ''; STORY.hint = ''; STORY.hideMarker = false;
  // enemies, shots, effects
  for (const e of ENEMIES) { if (e.alive) disposeEnemy(e); e.alive = false; }
  ENEMIES.length = 0;
  for (const s of SHOTS) scene.remove(s.m); SHOTS.length = 0;
  for (const q of QUAKES) scene.remove(q.m); QUAKES.length = 0;
  ALARM.t = 0; GAME.alarm = 0;
  // hero
  if (HERO.carrying) { HERO.carrying.held = false; HERO.carrying = null; }
  Object.assign(HERO, { slam: false, climb: null, gliding: false, charging: false, charge: 0, punchT: 0, pendingHit: null, liftT: 0 });
  takeBoots(false);
  // movable things
  for (const o of THROWABLES) { o.gone = false; o.held = false; o.flying = false; o.vel = null; o.mesh.visible = true; o.mesh.position.copy(o.home); o.hp = o.kind === 'drum' ? 1 : 2; }
  for (const b of W2.breakables) { b.broken = false; b.m.visible = true; b.obs.y1 = b.y + b.height; b.hp = 3; b.sc.done = false; }
  // security
  for (const c of SECURITY.cams) { c.state = 'active'; c.seen = 0; c.cone.visible = true; c.ledMat.emissive.set(0xff2a18); c.head.rotation.z = 0; c.trackYaw = null; }
  for (const b of SECURITY.birds) { b.state = 'active'; b.seen = 0; b.cone.visible = true; b.eyeMat.emissive.set(0xff2a18); b.eyeMat.emissiveIntensity = 3; b.head.rotation.set(0, 0, 0); }
  for (const s of SECURITY.searchlights) { s.state = 'active'; s.seen = 0; }
  setAwake(false);
  for (const sc of SCAN.items) sc.done = false;
  for (const s of SHARDS) if (s.got) s.sc.done = true;
  // doors, power, lava wall
  const st = POI.wfDoorState; Object.assign(st, { target: 0, open: 0, broken: false, hp: 3 }); if (st.door) { st.door.position.set(0, 2.3, -0.3); st.door.rotation.x = 0; }
  LAVA_WALL.target = 0; LAVA_WALL.open = 0;
  GAME.power = false; U.power.value = 0; GAME.loggedIn = false; GAME.knowsPassword = false; TERM.fails = 0;
  // set pieces
  for (const v of W2.valves) { v.broken = false; v.hp = 3; v.wheel.visible = true; v.gaugeM.emissive.set(0xff2a18); v.gaugeM.emissiveIntensity = 5; }
  OMNI.state = 'off'; omniShow(false);
  for (const n of W2.nodes) { n.broken = false; n.hp = 2; n.beam.visible = true; n.coreM.emissiveIntensity = 5; }
  setFieldOn(true); W2.mirage.state = 'held';
  GRATE.open = false; GRATE.mesh.visible = true; GRATE.under.visible = true; GRATE.noted = false;
  HEART.sealed = true; HEART.seal.visible = true; HEART.seal.scale.setScalar(1); HEART.seal.material.uniforms.uStrength.value = 0.8; HEART.unsealT = null; HEART.order.length = 0; HEART.awake = HEART.awakeTarget = 0;
  for (const q of HEART.pillars) { q.lit = false; q.plate.material = q.offM; q.capM.emissiveIntensity = 0.3; }
  IRIS.target = 0; IRIS.open = 0; FX.eruption = 0; FX.eruptionDecay = false;
  KRONOS.state = 'off'; kronosShow(false); for (const v of W2.vents) v.on = false;
  for (const pl of W2.pylons) { pl.broken = false; pl.hp = 3; pl.capM.emissiveIntensity = 5; }
  W2.syn.target = 0; W2.syn.on = 0; if (W2.gazer) { W2.gazer.target = 0; W2.gazer.on = 0; }
  ECHO_RISE.on = false;
  LIFT.y = LIFT.target = BASE_Y; LIFT.moving = false; if (LIFT.snd) { LIFT.snd.stop(); LIFT.snd = null; }
  if (MONO.ride) { MONO.ride = null; if (MONO.snd) MONO.snd.stop(); }
  W2.visor.visible = true;
  if (SCAN.on) toggleScan(false);
}
function takeBoots(on) {
  setBoots(on);
  for (const b of IB_BOOTS) b.visible = !on;
}

// ---- extras that belong to the story but live outside a single mission
const ECHO_RISE = { on: false };
function missionsInit() {
  SP = missionSpawns();
  const C = POI.caveChamber;
  const inward = { x: (VX - C.x) / 160, z: (VZ - C.z) / 160 };
  W2.wordPos = V3(C.x + inward.x * 4.7, C.y + 2.3, C.z + inward.z * 4.7);
  W2.gazer = buildGazerEcho({ x: C.x + inward.x * 2.2, y: C.y, z: C.z + inward.z * 2.2 });
  W2.gazer.rig.root.rotation.y = Math.atan2(-inward.x, -inward.z);
  // the Omnidroid wreck in the test clearing tells its own story
  const om = POI.omni, op = V3(om.x - 2.4, terrainHeight(om.x, om.z) + 4.4, om.z + 0.9);
  addScannable({ kind: 'clue', label: 'Omnidroid v.8', pos: () => op, when: () => STORY.mission >= 1, analyze: { time: 1.0, done: () => { talk(['m1_05']); findSecret('omni8'); } } });
  // the cave wall and the remains
  addScannable({ kind: 'clue', label: 'Burned words', pos: () => W2.wordPos, when: () => STORY.mission === 3 && STORY.flags.inCave !== false, analyze: { time: 0.8, done: () => readKronosWall() } });
}
function updateStory(dt, t) {
  updateWaits(dt);
  updateObjectiveTarget();
  // gazerbeam's echo and the heart's light
  const G = W2.gazer;
  if (G) {
    G.on = damp(G.on, G.target, 2, dt);
    G.rig.root.visible = G.on > 0.02 && Math.random() > 0.03;
    if (G.rig.root.visible) { G.rig.root.scale.set(1, G.on, 1); G.rig.J.head.rotation.x = 0.1 + Math.sin(t * 0.8) * 0.05; G.rig.J.shL.rotation.z = 0.2; G.rig.J.shR.rotation.set(-0.5 - Math.sin(t) * 0.1, 0, -0.3); }
  }
  HEART.awake = damp(HEART.awake, HEART.awakeTarget || 0, 1.2, dt);
  // echoes leaving the mountain at the end
  if (ECHO_RISE.on && Math.random() < dt * 40) FX.sparks.add(VX + rr(-10, 10), CRATER_Y + rr(-5, 5), VZ + rr(-10, 10), 1.6, 1.2, 3.2, rr(0.08, 0.16), rr(4, 7), rr(-0.5, 0.5), rr(6, 12), rr(-0.5, 0.5));
  // Syndrome gets bored and talks to you
  if (STORY.mission >= 3 && STORY.mission <= 11 && GAME.mode === 'play' && !DLG.cur && !ENEMIES.some((e) => e.alive && e.state === 'hunt')) {
    STORY.idleT -= dt;
    if (STORY.idleT <= 0) { STORY.idleT = rr(170, 260); bark('syn_idle'); }
  }
  if (HERO.hp < 35 && HERO.hp > 0 && GAME.mode === 'play') bark('meg_hurt');
  // the boss bar
  const bb = $('bossBar');
  if (STORY.boss && GAME.mode !== 'title') { bb.hidden = false; $('bossName').textContent = STORY.boss.name; $('bossFill').style.width = (clamp(STORY.boss.hp(), 0, 1) * 100).toFixed(1) + '%'; }
  else bb.hidden = true;
}

// ============================================================ saving
function saveData() {
  return { v: 2, mission: STORY.mission, cp: STORY.cp, shards: [...STORY.shards], secrets: [...GAME.secrets], logs: [...GAME.logs], seen: [...(GAME.seenAreas || [])], time: GAME.time, kos: STORY.kos };
}
function saveGame() { if (!GAME.started || GAME.mode === 'debug') return; try { localStorage.setItem('nomanisan.save2', JSON.stringify(saveData())); } catch (e) { /* storage blocked */ } }
function loadSave() { try { const s = JSON.parse(localStorage.getItem('nomanisan.save2') || 'null'); return s && s.v === 2 ? s : null; } catch (e) { return null; } }
function applySave(s) {
  GAME.secrets = new Set(s.secrets || []); GAME.logs = new Set(s.logs || []); GAME.seenAreas = new Set(s.seen || []); GAME.time = s.time || 0; STORY.kos = s.kos || 0;
  STORY.shards = new Set(s.shards || []);
  for (const sh of SHARDS) sh.got = STORY.shards.has(sh.id);
  applyUpgrades();
}
