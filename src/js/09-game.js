// ============================================================ game state
const GAME = {
  started: false, mode: 'title', power: false, alarm: 0, time: 0, aim: 0, aimHeld: false, hitStop: 0, cutscene: false, noDetect: false,
  flags: {}, secrets: new Set(), logs: new Set(), area: null, knowsPassword: false, loggedIn: false,
};
const TERRAIN = { kind: 'terrain' };
const WATER = { kind: 'water', water: true };   // deep river and pool water: you swim chest-deep at the surface
const SWIM_DEPTH = 1.45;
const STEP_UP = 0.6, PR = 0.48, GRAV = 20;
const P = { x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: 0, grounded: true, floor: TERRAIN, crouch: 0, crouchOn: false, stepAcc: 0, room: null, kind: 'grass', inWater: 0 };

// ============================================================ movement & collision
function resolveObstacles(x, z, yFeet, yHead, pr = PR) {
  for (let it = 0; it < 2; it++) {
    for (const o of obstaclesNear(x, z)) {
      if (o.y1 < yFeet + 0.25 || o.y0 > yHead) continue;
      if (o.t === 'c') {
        const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), R = o.r + pr;
        if (d < R && d > 1e-6) { x = o.x + (dx / d) * R; z = o.z + (dz / d) * R; }
      } else {
        const dx = x - o.x, dz = z - o.z;
        let lx = dx * o.c + dz * o.s, lz = -dx * o.s + dz * o.c;
        const ex = o.hx + pr, ez = o.hz + pr;
        if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
          if (ex - Math.abs(lx) < ez - Math.abs(lz)) lx = (lx < 0 ? -1 : 1) * ex; else lz = (lz < 0 ? -1 : 1) * ez;
          x = o.x + lx * o.c - lz * o.s; z = o.z + lx * o.s + lz * o.c;
        }
      }
    }
  }
  return [x, z];
}
function findFloor(x, z, yRef) {
  let best = -Infinity, bf = null;
  if (!inTerrainHole(x, z)) { const th = terrainHeight(x, z); if (th <= yRef + STEP_UP) { best = th; bf = TERRAIN; } }
  for (const f of floors) {
    if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue;
    if (f.enabled && !f.enabled()) continue;
    if (!f.contains(x, z)) continue;
    const fy = f.y(x, z);
    if (fy <= yRef + STEP_UP && fy > best) { best = fy; bf = f; }
  }
  const rv = riverAt(x, z);
  if (rv != null) { const sy = rv - SWIM_DEPTH; if (sy > terrainHeight(x, z) && sy <= yRef + STEP_UP && sy > best) { best = sy; bf = WATER; } }
  return bf ? { y: best, f: bf } : null;
}
function canStand(x, z) {
  // in the open air, rising ground higher than a step is a wall, in the air as much as on foot
  const open = inTerrainHole(P.x, P.z) ? P.y > CRATER_Y - 2 : terrainHeight(P.x, P.z) < P.y + 1.0;
  if (open && !inTerrainHole(x, z) && terrainHeight(x, z) > P.y + STEP_UP && (P.grounded || terrainHeight(x, z) > P.y + 0.2)) {
    if (P.grounded) { const fl0 = findFloor(x, z, P.y); if (!fl0 || fl0.f === TERRAIN) return null; } else return null;
  }
  const fl = findFloor(x, z, P.y);
  if (!fl) return P.grounded ? null : { y: -Infinity, f: null };
  if (fl.f === TERRAIN) {
    if (fl.y < -1.25) return null;
    const rv = riverAt(x, z);
    if (rv != null && rv - fl.y > SWIM_DEPTH + 0.05) return null;
    if (fl.y > P.y + 0.04 && P.grounded && terrainNormalY(x, z) < 0.52) return null;
  } else if (fl.f.indoor && fl.y < P.y - 1.2 && P.grounded && fl.f.room !== 'heart') return null;
  return fl;
}
function moveHoriz(dx, dz) {
  const head = P.y + (P.crouch > 0.5 ? 1.1 : 1.85);
  let [nx, nz] = resolveObstacles(P.x + dx, P.z + dz, P.y, head);
  let fl = canStand(nx, nz);
  if (!fl) {
    [nx, nz] = resolveObstacles(P.x + dx, P.z, P.y, head); fl = canStand(nx, nz);
    if (!fl) { [nx, nz] = resolveObstacles(P.x, P.z + dz, P.y, head); fl = canStand(nx, nz); }
    if (!fl) { P.vx *= 0.5; P.vz *= 0.5; return; }
  }
  P.x = nx; P.z = nz;
  if (P.grounded && fl.f && fl.y >= P.y - 0.65) { P.y = fl.y; P.floor = fl.f; }
}
function standBlocked() {
  for (const o of obstaclesNear(P.x, P.z)) {
    if (o.y1 < P.y + 1.15 || o.y0 > P.y + 1.9) continue;
    if (o.t === 'c') { if (Math.hypot(P.x - o.x, P.z - o.z) < o.r + PR) return true; }
    else { const dx = P.x - o.x, dz = P.z - o.z; const lx = dx * o.c + dz * o.s, lz = -dx * o.s + dz * o.c; if (Math.abs(lx) < o.hx + PR && Math.abs(lz) < o.hz + PR) return true; }
  }
  return false;
}
function floorKind() {
  if (P.inWater) return 'water';
  if (P.floor && P.floor !== TERRAIN) return P.floor.kind || 'concrete';
  const h = P.y;
  if (maskAt(P.x, P.z, 1) > 0.4) return 'stone';
  if (h < 3.6) return 'sand';
  if (terrainNormalY(P.x, P.z) < 0.8 || h > 70) return 'rock';
  return 'grass';
}

// ============================================================ HUD helpers
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
let bannerTimer = 0;
function banner(title, sub) { $('bannerTitle').textContent = title; $('bannerSub').textContent = sub || ''; $('banner').classList.add('on'); bannerTimer = 5; }
function toast(kicker, title, desc) {
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = `<div class="k">${escapeHtml(kicker)}</div><div class="t">${escapeHtml(title)}</div>${desc ? `<div class="d">${escapeHtml(desc)}</div>` : ''}`;
  $('toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 5200);
  setTimeout(() => el.remove(), 5900);
}
function updateStats() {
  $('statShards').textContent = `${STORY.shards.size}/${SHARDS.length || 10}`;
  $('statSecrets').textContent = `${GAME.secrets.size}/${SECRET_ORDER.length}`;
}
function findSecret(id) {
  if (GAME.secrets.has(id)) return;
  GAME.secrets.add(id);
  const s = SECRETS[id];
  toast(`Secret ${GAME.secrets.size} of ${SECRET_ORDER.length}`, s.name, s.desc);
  sfx('sting');
  saveGame();
}
function updateHealth() {
  const k = clamp(HERO.hp / HERO.maxHp, 0, 1);
  $('hpFill').style.width = (k * 100).toFixed(1) + '%';
  $('hp').classList.toggle('low', k < 0.35);
  $('hp').classList.toggle('full', k >= 0.999 && !STORY.boss);
  $('hp').style.width = (HERO.maxHp > 100 ? 260 : 200) + 'px';
}

// ============================================================ terminals
const TERM = { kind: null, page: 'login', fails: 0 };
function openTerminalUI(title, style) {
  GAME.mode = 'terminal';
  if (SCAN.on) toggleScan(false);
  releasePointer();
  $('terminal').hidden = false;
  $('crt').className = style === 'amber' ? 'amber' : style === 'red' ? 'red' : '';
  $('crtTitle').textContent = title;
  $('crtClock').textContent = 'NOMANISAN  ' + fakeClock();
  $('crtInputRow').hidden = true;
  sfx('beep');
}
function fakeClock() { const m = Math.floor(GAME.time / 60); return `0${2 + Math.floor(m / 60) % 8}:${String(14 + (m % 46)).padStart(2, '0')}`; }
function closeTerminal() {
  $('terminal').hidden = true;
  if (GAME.mode === 'terminal') GAME.mode = 'play';
  TERM.kind = null;
  lockPointer();
}
function openLog(id) {
  const L = LOGS[id];
  if (!L) return;
  openTerminalUI(L.title, L.style);
  TERM.kind = 'log';
  $('crtBody').innerHTML = `<span class="dim">${escapeHtml(L.from.toUpperCase())}</span>\n\n${escapeHtml(L.body)}`;
  if (!GAME.logs.has(id)) { GAME.logs.add(id); saveGame(); }
}
function readKronosWall() {
  if (GAME.knowsPassword) return;
  GAME.knowsPassword = true;
  findSecret('gazerbeam');
  say('', 'Burned into the rock above the bones, one word: KRONOS.', 5);
}
function openKronos() {
  openTerminalUI('KRONOS  /  MAIN SYSTEM', 'teal');
  TERM.kind = 'kronos';
  if (GAME.loggedIn) return kronosMenu();
  TERM.page = 'login';
  $('crtBody').innerHTML = `<span class="big">KRONOS</span>\n\n<span class="dim">POWER            ${GAME.power ? 'MAIN' : 'AUXILIARY'}\nOPERATOR         ${STORY.mission >= 2 ? 'ONLINE (DIGITAL)' : 'NOT RESPONDING'}</span>\n\nENTER PASSWORD TO CONTINUE.` + (TERM.fails >= 2 ? `\n\n<span class="dim">HINT: THE WORD ON THE CAVE WALL.</span>` : '');
  $('crtInputRow').hidden = false;
  $('crtPromptLbl').textContent = 'PASSWORD:';
  const inp = $('crtInput'); inp.value = ''; setTimeout(() => inp.focus(), 30);
}
function kronosSubmit(v) {
  v = v.trim().toUpperCase();
  if (TERM.page === 'login') {
    if (v === 'KRONOS') {
      sfx('grant');
      GAME.loggedIn = true; GAME.knowsPassword = true;
      $('crtInputRow').hidden = true;
      $('crtBody').innerHTML = `<span class="big">WELCOME BACK,\nSYNDROME.</span>\n\n<span class="dim">...BIOMETRIC MISMATCH. CONTINUING ANYWAY.</span>`;
      setTimeout(() => { if (TERM.kind === 'kronos') kronosMenu(); }, 1800);
      saveGame();
    } else {
      sfx('deny'); TERM.fails++;
      $('crtBody').innerHTML += `\n<span class="warn">ACCESS DENIED.</span>`;
      if (TERM.fails === 2) $('crtBody').innerHTML += `\n<span class="dim">HINT: THE WORD ON THE CAVE WALL.</span>`;
      $('crtInput').value = '';
    }
    return;
  }
  $('crtInput').value = '';
  const n = parseInt(v, 10);
  if (!isNaN(n)) kronosChoose(n);
}
function kronosMenu() {
  TERM.page = 'menu';
  const items = [[1, 'PROJECT KRONOS'], [2, 'SUPERS DATABASE'], [3, 'OMNIDROID TRIALS'], [4, 'KRONOS PROTOCOL  (EYES ONLY)'], [5, GAME.power ? 'MAIN POWER ........ ONLINE' : 'MAIN POWER ........ CUT'], [0, 'LOG OFF']];
  $('crtBody').innerHTML = `<span class="dim">KRONOS MAIN MENU. TYPE A NUMBER OR CLICK.</span>\n\n` + items.map(([k, t]) => `<a data-k="${k}">[${k}] ${t}</a>`).join('\n');
  $('crtInputRow').hidden = false; $('crtPromptLbl').textContent = '>'; $('crtInput').value = '';
  setTimeout(() => $('crtInput').focus(), 30);
}
function kronosChoose(n) {
  sfx('key');
  const body = $('crtBody');
  const back = `\n\n<a data-k="9">[9] BACK</a>`;
  if (n === 0) return closeTerminal();
  if (n === 9) return kronosMenu();
  if (n === 1) { body.innerHTML = escapeHtml(KRONOS_FILES.project) + back; logFile('kronos'); }
  if (n === 2) { body.innerHTML = 'SUPERS DATABASE\n===============\n\n' + SUPERS.map(([nm, st]) => `${nm.padEnd(16, '.')} ${st === 'TERMINATED' ? `<span class="warn">${st}</span>` : st}`).join('\n') + back; logFile('supers'); }
  if (n === 3) { body.innerHTML = escapeHtml(KRONOS_FILES.omnis) + back; logFile('omnis'); }
  if (n === 4) { body.innerHTML = `<span class="warn">${escapeHtml(KRONOS_FILES.protocol)}</span>` + back; logFile('protocol'); STORY.flags.protocol = true; }
  if (n === 5) body.innerHTML = (GAME.power ? 'MAIN POWER ONLINE.\nMONORAIL: ONLINE.  SILO LIFT: ONLINE.' : 'MAIN POWER: <span class="warn">CUT BY OPERATOR.</span>\nGEOTHERMAL VALVES 1-3: OVERLOADED.\nAUXILIARY POWER ONLY.') + back;
}
function logFile(id) { if (!GAME.logs.has('k_' + id)) { GAME.logs.add('k_' + id); saveGame(); } }
function lockerSearch() { openLog('locker'); }

// ============================================================ world switches
function partLava() {
  if (LAVA_WALL.target) return;
  LAVA_WALL.target = 1;
  sfx('iris');
  findSecret('lavawall');
}
function pullIrisLever() {
  if (IRIS.target) { note('The crater iris is already open.'); return; }
  sfx('deny'); note('Launch systems locked out by KRONOS.');
}
function showEnding() {
  GAME.mode = 'ending';
  if (SCAN.on) toggleScan(false);
  releasePointer();
  const m = Math.floor(GAME.time / 60), s = Math.floor(GAME.time % 60);
  $('endTime').textContent = `${m}:${String(s).padStart(2, '0')}`;
  $('endShards').textContent = `${STORY.shards.size}/${SHARDS.length}`;
  $('endSecrets').textContent = `${GAME.secrets.size}/${SECRET_ORDER.length}`;
  $('endKos').textContent = `${STORY.kos}`;
  $('ending').hidden = false;
  saveGame();
}
function useTelescope() {
  findSecret('telescope');
  GAME.scope = true;
  say('', 'Through the old brass telescope: the plume, the sea, and far off to the north-east, a smudge of city light.', 5);
}
function useLift() {
  if (!GAME.power) { sfx('deny'); note('Silo lift offline. Main power required.'); return; }
  LIFT.target = Math.abs(LIFT.y - BASE_Y) < 1 ? RING_Y : BASE_Y;
}
function callLift(y) {
  if (!GAME.power) { sfx('deny'); note('Silo lift offline. Main power required.'); return; }
  LIFT.target = y; sfx('beep');
}
function liftPrompt() {
  if (!GAME.power) return 'Silo lift (no power)';
  return Math.abs(LIFT.y - BASE_Y) < 1 ? 'Ride the lift up the silo' : 'Ride the lift down to the silo floor';
}
function updateLift(dt) {
  const d = LIFT.target - LIFT.y;
  if (Math.abs(d) > 0.01) {
    if (!LIFT.moving) { LIFT.moving = true; LIFT.snd = loopTone(55, 0.05); }
    const v = Math.sign(d) * Math.min(Math.abs(d), dt * 5.5 * clamp(Math.abs(d) / 3, 0.25, 1));
    LIFT.y += v;
    if (P.floor === LIFT.floor) P.y = LIFT.y;
  } else if (LIFT.moving) { LIFT.moving = false; LIFT.y = LIFT.target; if (LIFT.snd) LIFT.snd.stop(); sfx('beep'); }
  LIFT.cage.position.y = LIFT.y;
}

// ---- the monorail ride
function rideMonorail(dir) {
  if (!GAME.power) { sfx('deny'); note('Monorail offline. Main power required.'); return; }
  if (GAME.mode !== 'play') return;
  if (HERO.carrying) dropCarried();
  GAME.mode = 'ride';
  const from = dir > 0 ? MONO.stationU : 1, to = dir > 0 ? 1 : MONO.stationU;
  MONO.ride = { from, to, t: 0, dur: 52, dir };
  MONO.snd = loopTone(82, 0.04);
  fadeTo(1, 0.5, () => { MONO.ride.started = true; fadeTo(0, 0.8); });
}
function updateRide(dt) {
  const R = MONO.ride;
  if (!R || !R.started) return;
  R.t += dt;
  const k = clamp(R.t / R.dur, 0, 1);
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const u = lerp(R.from, R.to, e);
  MONO.u = u; placePod(u);
  const p = MONO.pod.position, tng = MONO.curve.getTangentAt(clamp(u, 0, 1));
  const side = new THREE.Vector3(tng.z, 0, -tng.x).normalize().multiplyScalar(0.55 * R.dir);
  camera.position.set(p.x + side.x, p.y + 2.05, p.z + side.z);
  camera.rotation.set(P.pitch, P.yaw, 0);
  HERO.rig.root.visible = false;
  if (MONO.pod.userData.band) MONO.pod.userData.band.emissiveIntensity = 2.2;
  if ((keys.Enter || keys.Space) && R.t > 2 && !R.ending) R.t = R.dur;
  if (k >= 1 && !R.ending) {
    R.ending = true;
    fadeTo(1, 0.6, () => {
      const dst = R.dir > 0 ? MONO.hallPlat : MONO.beachPlat;
      placeAt({ x: dst.x + (R.dir > 0 ? -1.2 : 0), z: dst.z, y: dst.y, yaw: P.yaw });
      MONO.ride = null; GAME.mode = 'play'; if (MONO.snd) MONO.snd.stop();
      HERO.rig.root.visible = true;
      if (MONO.pod.userData.band) MONO.pod.userData.band.emissiveIntensity = 0.8;
      fadeTo(0, 0.8);
    });
  }
}

// ---- fades and placing the hero
const FADE = { v: 1, target: 0, speed: 1, cb: null };
function fadeTo(v, secs, cb) { FADE.target = v; FADE.speed = 1 / Math.max(secs, 0.01); FADE.cb = cb || null; }
function updateFade(dt) {
  const d = FADE.target - FADE.v;
  if (Math.abs(d) < 0.001) { if (FADE.cb) { const c = FADE.cb; FADE.cb = null; c(); } return; }
  FADE.v += Math.sign(d) * Math.min(Math.abs(d), dt * FADE.speed);
  finalPass.uniforms.uFade.value = FADE.v;
}
function placeAt(cp) {
  P.x = cp.x; P.z = cp.z;
  const fl = findFloor(cp.x, cp.z, cp.y != null ? cp.y + 1 : 1000);
  P.y = fl ? fl.y : terrainHeight(cp.x, cp.z); P.floor = fl ? fl.f : TERRAIN;
  P.vx = P.vz = P.vy = 0; P.grounded = true; P.yaw = cp.yaw || 0; P.pitch = 0;
  P.room = P.floor && P.floor.room ? P.floor.room : null;
}
// the patrolling Velocipod with its searchlight
function addPatrolVelocipod() {
  const v = makeVelocipod(true); scene.add(v);
  const head = new THREE.Group(); v.add(head); head.position.set(0, -0.4, 0.6);
  const spot = new THREE.SpotLight(0xe8f0ff, 7000, 70, 0.17, 0.5, 2); head.add(spot); head.add(spot.target); spot.target.position.set(0, 0, 10);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, Math.tan(0.17) * 55, 55, 20, 1, true).translate(0, -27.5, 0).rotateX(-Math.PI / 2), beamMaterial(0xcfe0ff, 0.08));
  head.add(cone);
  const s = { grp: v, head, spot, cone, range: 60, pitch: -0.9, patrol: true };
  s.update = (dt, t) => {
    const a = t * 0.045;
    const cx = 10, cz = 170, rx = 120, rz = 70;
    const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz;
    const gy = Math.max(terrainHeight(x, z), 0);
    v.position.set(x, gy + 26 + Math.sin(t * 0.7) * 2, z);
    const tx = -Math.sin(a) * rx, tz = Math.cos(a) * rz;
    v.rotation.set(0.12, Math.atan2(tx, tz), Math.sin(t * 0.5) * 0.08);
    head.rotation.set(0.95 + Math.sin(t * 0.6) * 0.15, Math.sin(t * 0.37) * 0.6, 0);
    v.userData.blades.rotation.y += dt * 14;
  };
  SECURITY.searchlights.push(s);
}

// ============================================================ interaction (from the hero, toward where the camera looks)
let hot = null, hotThrow = null;
const _dir = new THREE.Vector3();
function promptText(o) { return typeof o.prompt === 'function' ? o.prompt() : o.prompt; }
function updateInteract() {
  hot = null; hotThrow = null;
  const el = $('prompt');
  if (GAME.mode !== 'play' || HERO.climb) { el.hidden = true; return; }
  camera.getWorldDirection(_dir);
  const hx = P.x, hy = P.y + 1.2, hz = P.z;
  let best = -Infinity;
  for (const o of INTERACT) {
    if (o.when && !o.when()) continue;
    const dx = o.pos.x - hx, dy = o.pos.y - hy, dz = o.pos.z - hz;
    const d = Math.hypot(dx, dy * 0.8, dz);
    if (d > o.r + 0.5) continue;
    const dh = Math.hypot(dx, dz);
    const facing = dh < 0.6 ? 0.3 : (dx * _dir.x + dz * _dir.z) / dh;
    const score = -d + facing * 1.2 + (o.prio || 0);
    if (score > best) { best = score; hot = o; }
  }
  let text = hot ? promptText(hot) : null, key = TOUCH.active ? 'Use' : 'E';
  if (!hot && HERO.carrying) { text = TOUCH.active ? 'Hit to throw · Use to put down' : 'Click to throw · E to put down'; }
  else if (!hot) {
    let bd = 2.4;
    for (const o of THROWABLES) { if (o.gone || o.flying || o.held) continue; const d = Math.hypot(o.mesh.position.x - P.x, o.mesh.position.z - P.z); if (d < bd && Math.abs(o.mesh.position.y - P.y) < 2.2) { bd = d; hotThrow = o; } }
    if (hotThrow) text = `Pick up the ${hotThrow.kind === 'drum' ? 'fuel drum' : hotThrow.kind}`;
  }
  el.hidden = !text;
  if (text) { if ($('promptText').textContent !== text) $('promptText').textContent = text; $('promptKey').textContent = key; }
}
function useHot() {
  if (GAME.mode !== 'play' || HERO.climb) return;
  if (SCAN.on && SCAN.focus && SCAN.focus.hack) return;   // E is held to hack instead
  if (hot) { sfx('click'); hot.use(); return; }
  tryGrab();
}

// ============================================================ areas: a banner the first time you arrive somewhere
let lastArea = null, areaHold = 0;
function updateAreas(dt) {
  let id = null, info = null;
  if (P.room && ROOM_NAMES[P.room]) { id = P.room === 'labCorr' ? 'lab' : P.room; info = ROOM_NAMES[P.room]; }
  else if (!P.room) {
    for (const [pid, x, z, r, name, sub] of PLACES) {
      if ((P.x - x) ** 2 + (P.z - z) ** 2 < r * r && (pid !== 'crater' || P.y > CRATER_Y - 3)) { id = pid; info = [name, sub]; break; }
    }
    if (!id) {
      const vr = Math.hypot(P.x - VX, P.z - VZ);
      if (maskAt(P.x, P.z, 1) > 0.3 && vr < 240) { id = 'road'; info = ['THE SUMMIT ROAD', 'Switchbacks all the way to the crater.']; }
      else if (P.y < 60 && vr > 200) { id = 'jungle'; info = ['THE JUNGLE', 'The lamps are still lit for guests who never came back.']; }
      else if (vr < 290) { id = 'slopes'; info = ['THE VOLCANO', 'Loose ash and warm rock.']; }
    }
  }
  if (id !== lastArea) {
    areaHold += dt;
    if (areaHold > 0.8) {
      lastArea = id; areaHold = 0; GAME.area = id;
      if (id && info && !GAME.seenAreas?.has(id) && !CUT.on && bannerTimer <= 0) { (GAME.seenAreas ||= new Set()).add(id); banner(info[0], info[1]); }
      if (id === 'containment' && FIELD.on && !GAME.secrets.has('field')) setTimeout(() => findSecret('field'), 4000);
    }
  } else areaHold = 0;
}
let PLACES = [];
// the zero-point field throws you back while it is on
function fieldCheck(dt) {
  if (P.room !== 'containment' || !FIELD.on) { if (GAME.fieldT) { GAME.fieldT = 0; finalPass.uniforms.uFreeze.value = 0; } return; }
  const dx = P.x - FIELD.x, dz = P.z - FIELD.z, d = Math.hypot(dx, dz);
  if (d < FIELD.r + 0.9 && GAME.mode === 'play') {
    GAME.fieldT = 0.6;
    P.vx = dx / Math.max(d, 0.1) * 9; P.vz = dz / Math.max(d, 0.1) * 9; P.vy = 4; P.grounded = false;
    sfx('zap'); hurtHero(5);
    if (!GAME.fieldNoted) { GAME.fieldNoted = true; note('The zero-point field throws you back. Break the nodes that feed it.', 4); }
  }
  GAME.fieldT = Math.max(0, (GAME.fieldT || 0) - dt);
  finalPass.uniforms.uFreeze.value = GAME.fieldT;
}

// ============================================================ map & journal
let mapBase = null;
function drawMapBase() {
  const N = 1024, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data;
  const S = 760, s = S / N;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -S / 2 + i * s, z = -S / 2 + j * s;
    const h = terrainHeight(x, z), hx = terrainHeight(x + 2, z), hz = terrainHeight(x, z + 2);
    const nx = -(hx - h) / 2, nz = -(hz - h) / 2, nl = Math.hypot(nx, 1, nz);
    const sh = clamp((nx * -0.5 + 1 * 0.6 + nz * -0.6) / nl, 0, 1);
    let r, gg, b;
    if (h < 0) { const k = clamp(-h / 15, 0, 1); r = 12 - 6 * k; gg = 30 - 14 * k; b = 52 - 20 * k; }
    else {
      const lava = maskAt(x, z, 2), road = Math.max(maskAt(x, z, 0), maskAt(x, z, 1));
      if (h < 3.4) { r = 120; gg = 112; b = 88; }
      else if (h < 60) { r = 38; gg = 64; b = 44; }
      else { const k = clamp((h - 60) / 110, 0, 1); r = 60 + 30 * k; gg = 58 + 20 * k; b = 54 + 16 * k; }
      r *= 0.45 + sh * 0.85; gg *= 0.45 + sh * 0.85; b *= 0.45 + sh * 0.85;
      if (lava > 0.1) { const k = smoothstep(0.1, 0.6, lava); r = lerp(r, 170, k); gg = lerp(gg, 50, k); b = lerp(b, 20, k); }
      if (road > 0.35) { r = lerp(r, 214, road * 0.8); gg = lerp(gg, 160, road * 0.8); b = lerp(b, 100, road * 0.8); }
      if (Math.abs((h % 20) - 0) < 0.6 && h > 5) { r *= 0.8; gg *= 0.8; b *= 0.8; }
    }
    const k = (j * N + i) * 4; d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(160,190,220,0.08)'; g.lineWidth = 1;
  for (let i = 0; i <= N; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, N); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(N, i); g.stroke(); }
  g.strokeStyle = 'rgba(240,235,220,0.55)'; g.lineWidth = 2; g.setLineDash([6, 5]); g.beginPath();
  MONO.pts.forEach((p, i) => { const X = (p.x + S / 2) / s, Y = (p.z + S / 2) / s; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.stroke(); g.setLineDash([]);
  mapBase = { c, S, s };
}
function openJournal() {
  if (!mapBase) drawMapBase();
  GAME.prevMode = GAME.mode === 'pause' ? 'pause' : 'play';
  GAME.mode = 'journal';
  if (SCAN.on) toggleScan(false);
  releasePointer();
  $('pause').hidden = true;
  $('journal').hidden = false;
  const cv = $('mapCanvas'), g = cv.getContext('2d'), { c, S, s } = mapBase;
  g.drawImage(c, 0, 0);
  const M2 = (x, z) => [(x + S / 2) / s, (z + S / 2) / s];
  g.font = '600 15px Jost, sans-serif'; g.textAlign = 'left';
  const label = (x, z, text, col = '#ece5d3') => { const [X, Y] = M2(x, z); g.fillStyle = col; g.beginPath(); g.arc(X, Y, 4, 0, TAU); g.fill(); g.fillStyle = 'rgba(5,8,15,0.75)'; const w = g.measureText(text).width; g.fillRect(X + 8, Y - 10, w + 8, 20); g.fillStyle = col; g.fillText(text, X + 12, Y + 5); };
  for (const [pid, x, z, , name] of PLACES) if (GAME.seenAreas?.has(pid)) label(x, z, titleCase(name));
  label(VX, VZ - 4, 'Volcano', '#ff9a5a');
  if (STORY.mission >= 1) label(POI.radio.x, POI.radio.z, 'Radio hill', '#ffd36b');
  if (STORY.mission >= 4) label(POI.door.x, POI.door.z, 'Hidden door', '#ff7b2f');
  if (GAME.seenAreas?.has('hall')) {
    g.strokeStyle = 'rgba(99,230,205,0.6)'; g.lineWidth = 1.5;
    for (const f of floors) if (f.indoor && f.x1 - f.x0 < 80 && f.room !== 'heart') { const [a, b] = M2(f.x0, f.z0), [cc, dd] = M2(f.x1, f.z1); g.strokeRect(a, b, cc - a, dd - b); }
  }
  for (const sh of SHARDS) if (sh.got) { const [X, Y] = M2(sh.x, sh.z); g.fillStyle = '#c49bff'; g.beginPath(); g.arc(X, Y, 3, 0, TAU); g.fill(); }
  if (STORY.target) { const [X, Y] = M2(STORY.target.x, STORY.target.z); g.strokeStyle = '#3dff8a'; g.lineWidth = 3; g.beginPath(); g.moveTo(X, Y - 10); g.lineTo(X + 10, Y); g.lineTo(X, Y + 10); g.lineTo(X - 10, Y); g.closePath(); g.stroke(); }
  const [X, Y] = M2(P.x, P.z);
  g.save(); g.translate(X, Y); g.rotate(-P.yaw); g.fillStyle = '#ff7b2f'; g.beginPath(); g.moveTo(0, -14); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath(); g.fill(); g.restore();
  g.fillStyle = 'rgba(255,123,47,0.85)'; g.font = '700 22px Syncopate, sans-serif'; g.fillText('NOMANISAN', 24, 44);
  g.font = '500 13px Jost, sans-serif'; g.fillStyle = 'rgba(236,229,211,0.6)'; g.fillText('CLASSIFIED  /  NSA FIELD MAP', 24, 66);
  const cur = STORY.mission;
  $('jObjectives').innerHTML = MISSIONS.slice(0, 13).map((m, i) => `<div class="row ${i < cur ? 'done' : i > cur ? 'locked' : ''}"><span class="mk">${i < cur ? '✓' : i === cur ? '›' : '·'}</span><span>${i > cur ? 'Classified' : escapeHtml(m.name) + (i === cur && STORY.objective ? `<br><small>${escapeHtml(STORY.objective)}</small>` : '')}</span></div>`).join('');
  $('jShards').textContent = `${STORY.shards.size} of ${SHARDS.length} found` + (STORY.upgrades ? `  ·  ${['', 'Titan strength', 'Titan strength, iron hide', 'Titan strength, iron hide, wide scan'][STORY.upgrades]}` : '');
  $('jSecrets').innerHTML = SECRET_ORDER.map((id, i) => { const f = GAME.secrets.has(id); return `<div class="sec ${f ? 'found' : ''}"><span class="n">No. ${i + 1}</span>${f ? escapeHtml(SECRETS[id].name) : 'Not found yet'}</div>`; }).join('');
  const logs = [...GAME.logs];
  $('jLogs').innerHTML = logs.length ? logs.map((id) => `<div class="row"><span class="mk">▪</span><span>${escapeHtml(id.startsWith('k_') ? 'Kronos: ' + ({ kronos: 'Project Kronos', supers: 'Supers database', omnis: 'Omnidroid trials', protocol: 'The Kronos Protocol' }[id.slice(2)]) : titleCase(LOGS[id].title))}</span></div>`).join('') : '<div class="row"><span class="mk">·</span><span>None yet. Terminals and notes are worth reading.</span></div>';
}
function titleCase(s) { return s.toLowerCase().replace(/(^|\s|\/|-)([a-z])/g, (m, a, b) => a + b.toUpperCase()); }
function closeJournal() { $('journal').hidden = true; if (GAME.prevMode === 'pause') { GAME.mode = 'pause'; $('pause').hidden = false; } else { GAME.mode = 'play'; lockPointer(); } }

// ============================================================ compass
const COMPASS_W = 420;
function updateCompass() {
  const heading = -P.yaw;
  const el = $('compassStrip');
  const pxPerRad = COMPASS_W / 2.2;
  const items = [['N', 0, 'card'], ['NE', Math.PI / 4, ''], ['E', Math.PI / 2, 'card'], ['SE', 3 * Math.PI / 4, ''], ['S', Math.PI, 'card'], ['SW', -3 * Math.PI / 4, ''], ['W', -Math.PI / 2, 'card'], ['NW', -Math.PI / 4, '']];
  items.push(['▲', Math.atan2(VX - P.x, -(VZ - P.z)), 'poi']);
  if (STORY.target) items.push(['◆', Math.atan2(STORY.target.x - P.x, -(STORY.target.z - P.z)), 'obj']);
  let html = '';
  for (const [t, b, cls] of items) {
    const off = wrapAngle(b - heading);
    if (Math.abs(off) > 1.25) continue;
    html += `<span class="${cls}" style="left:${(COMPASS_W / 2 + off * pxPerRad).toFixed(1)}px">${t}</span>`;
  }
  if (html !== updateCompass.last) { el.innerHTML = html; updateCompass.last = html; }
}

// ============================================================ input wiring
const TOUCH = { active: false, f: 0, s: 0, run: false, jump: false, hack: false };
function lockPointer() {
  if (TOUCH.active) return;
  try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* pointer lock refused: drag to look */ }
}
function releasePointer() { GAME.ignoreUnlock = true; if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => (GAME.ignoreUnlock = false), 120); }
function openPause() {
  if (GAME.mode !== 'play') return;
  GAME.mode = 'pause';
  if (SCAN.on) toggleScan(false);
  $('pause').hidden = false;
  $('optSens').value = input.sens;
  syncToggles();
  if (AUDIO.ctx) AUDIO.ctx.suspend();
}
function closePause() { $('pause').hidden = true; GAME.mode = 'play'; lockPointer(); if (AUDIO.ctx) AUDIO.ctx.resume(); }
function syncToggles() {
  const set = (id, on, a, b) => { const el = $(id); el.setAttribute('aria-pressed', on ? 'true' : 'false'); el.textContent = on ? a : b; };
  set('optInvert', input.invert, 'On', 'Off'); set('optQuality', QUALITY === 'high', 'High', 'Fast'); set('optMusic', AUDIO.music, 'On', 'Off'); set('optVoice', AUDIO.voice, 'On', 'Off');
  set('optTime', SKY.dayTarget > 0.5, 'Day', 'Night');
  const w = $('optWeather'); w.textContent = { clear: 'Clear', rain: 'Rain', storm: 'Storm' }[SKY.weather]; w.setAttribute('aria-pressed', SKY.weather !== 'clear' ? 'true' : 'false');
}
function toggleDayNight() {
  const day = SKY.dayTarget < 0.5;
  setTimeOfDay(day);
  note(day ? 'Daylight.' : 'Night falls.', 1.6);
  syncToggles();
}
function cycleWeather() { const order = ['clear', 'rain', 'storm']; setWeather(order[(order.indexOf(SKY.weather) + 1) % 3]); syncToggles(); }
function wireInput() {
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
    if (!input.locked && (GAME.mode === 'play' || GAME.mode === 'cutscene') && !GAME.ignoreUnlock) { if (CUT.on) skipCutscene(); openPause(); }
  });
  document.addEventListener('mousemove', (e) => {
    if (GAME.mode !== 'play' && GAME.mode !== 'ride') return;
    if (!input.locked && !input.dragging) return;
    const k = input.sens * (GAME.zoom > 0.5 ? 0.35 : 1) * (GAME.aim > 0.5 ? 0.7 : 1);
    P.yaw -= e.movementX * k;
    P.pitch = clamp(P.pitch - e.movementY * k * (input.invert ? -1 : 1), -1.25, 1.05);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (GAME.mode === 'cutscene') return;
    if (GAME.mode === 'play' || GAME.mode === 'ride') {
      if (!input.locked) { lockPointer(); input.dragging = true; return; }
      if (e.button === 0 && GAME.mode === 'play') heroAttack();
      if (e.button === 2) GAME.aimHeld = true;
    }
  });
  window.addEventListener('mouseup', (e) => { input.dragging = false; if (e.button === 2) GAME.aimHeld = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F2' || e.code === 'Backquote') { e.preventDefault(); if (GAME.mode === 'dev') closeDev(); else openDev(); return; }
    if (GAME.mode === 'dev') { if (e.code === 'Escape') { e.preventDefault(); closeDev(); } return; }
    if (GAME.mode === 'terminal') {
      if (e.code === 'Escape') { e.preventDefault(); closeTerminal(); }
      else if (TERM.kind === 'log' && (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); closeTerminal(); }
      else if (TERM.kind === 'kronos') { if (e.code === 'Enter') { e.preventDefault(); kronosSubmit($('crtInput').value); } else if (e.key.length === 1) sfx('key'); }
      return;
    }
    if (e.target && e.target.tagName === 'INPUT') return;
    if (GAME.mode === 'cutscene') { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') { e.preventDefault(); skipCutscene(); } return; }
    keys[e.code] = true;
    if (GAME.mode === 'journal') { if (e.code === 'Escape' || e.code === 'KeyM' || e.code === 'KeyJ' || e.code === 'Tab') { e.preventDefault(); closeJournal(); } return; }
    if (GAME.mode === 'pause') { if (e.code === 'Escape') { e.preventDefault(); closePause(); } return; }
    if (GAME.mode === 'ending') { if (e.code === 'Escape' || e.code === 'Enter') { $('btnKeepExploring').click(); } return; }
    if (GAME.mode !== 'play') return;
    if (e.repeat) { if (e.code === 'Space' || e.code === 'Tab') e.preventDefault(); return; }
    if (e.code === 'KeyE') useHot();
    if (e.code === 'KeyQ') toggleScan();
    if (e.code === 'KeyF') { HERO.lampOn = !HERO.lampOn; sfx('click'); }
    if (e.code === 'KeyT') toggleDayNight();
    if (e.code === 'KeyC') P.crouchOn = !P.crouchOn;
    if (e.code === 'Enter') skipLine();
    if (e.code === 'KeyN') skipStepNow();
    if (e.code === 'KeyM' || e.code === 'KeyJ' || e.code === 'Tab') { e.preventDefault(); openJournal(); }
    if (e.code === 'Escape') openPause();
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; GAME.aimHeld = false; });
  $('crtBody').addEventListener('click', (e) => { const a = e.target.closest('a[data-k]'); if (a) kronosChoose(parseInt(a.dataset.k, 10)); });
  $('terminal').addEventListener('click', (e) => { if (e.target.id === 'terminal') closeTerminal(); });
  $('btnResume').onclick = closePause;
  $('btnJournal').onclick = openJournal;
  $('btnCloseJournal').onclick = closeJournal;
  $('btnDev').onclick = () => { closePause(); openDev(); };
  $('btnSkipStep').onclick = () => { closePause(); skipStepNow(); };
  $('btnNextMission').onclick = () => { closePause(); if (AUDIO.ctx) AUDIO.ctx.resume(); jumpToMission(Math.min(STORY.mission + 1, MISSIONS.length - 1)); };
  $('btnRespawn').onclick = () => { $('pause').hidden = true; if (AUDIO.ctx) AUDIO.ctx.resume(); GAME.mode = 'ko'; fadeTo(1, 0.4, () => { respawnHero(); lockPointer(); }); };
  $('btnKeepExploring').onclick = () => { $('ending').hidden = true; GAME.mode = 'play'; lockPointer(); if (STORY.mission < 13) { cancelStory(); STORY.cp = null; runMission(13); } };
  $('optSens').oninput = (e) => { input.sens = parseFloat(e.target.value); try { localStorage.setItem('nomanisan.sens', input.sens); } catch (er) { /* storage blocked */ } };
  $('optInvert').onclick = () => { input.invert = !input.invert; syncToggles(); };
  $('optMusic').onclick = () => { AUDIO.music = !AUDIO.music; try { localStorage.setItem('nomanisan.music', AUDIO.music ? 'on' : 'off'); } catch (er) { /* storage blocked */ } syncToggles(); };
  $('optVoice').onclick = () => { AUDIO.voice = !AUDIO.voice; try { localStorage.setItem('nomanisan.voice', AUDIO.voice ? 'on' : 'off'); } catch (er) { /* storage blocked */ } syncToggles(); };
  $('optTime').onclick = toggleDayNight;
  $('optWeather').onclick = cycleWeather;
  $('optQuality').onclick = () => {
    QUALITY = QUALITY === 'high' ? 'fast' : 'high';
    try { localStorage.setItem('nomanisan.quality', QUALITY); } catch (er) { /* storage blocked */ }
    const sz = QUALITY === 'high' ? 2048 : 1024; moon.shadow.mapSize.set(sz, sz); if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; }
    onResize(); syncToggles();
  };
  // touch: left stick walks, right side looks
  const stick = $('touchStick'), nub = $('touchNub'), look = $('touchLook');
  let sid = null, lid = null, lx = 0, ly = 0;
  stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; stick.setPointerCapture(sid); });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sid) return;
    const r = stick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const l = Math.min(Math.hypot(dx, dy), 50), a = Math.atan2(dy, dx);
    nub.style.transform = `translate(${Math.cos(a) * l}px, ${Math.sin(a) * l}px)`;
    TOUCH.s = (Math.cos(a) * l) / 50; TOUCH.f = -(Math.sin(a) * l) / 50;
  });
  const endStick = () => { sid = null; nub.style.transform = ''; TOUCH.f = TOUCH.s = 0; };
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
  look.addEventListener('pointerdown', (e) => { lid = e.pointerId; lx = e.clientX; ly = e.clientY; look.setPointerCapture(lid); if (GAME.mode === 'cutscene') skipCutscene(); });
  look.addEventListener('pointermove', (e) => { if (e.pointerId !== lid) return; P.yaw -= (e.clientX - lx) * 0.005; P.pitch = clamp(P.pitch - (e.clientY - ly) * 0.005, -1.25, 1.05); lx = e.clientX; ly = e.clientY; });
  look.addEventListener('pointerup', () => (lid = null));
  $('tE').onpointerdown = () => { TOUCH.hack = true; }; $('tE').onpointerup = () => { TOUCH.hack = false; }; $('tE').onclick = useHot;
  $('tJump').onpointerdown = () => { TOUCH.jump = true; }; $('tJump').onpointerup = () => { TOUCH.jump = false; };
  $('tAtk').onclick = () => heroAttack();
  $('tQ').onclick = () => toggleScan();
  $('tF').onclick = () => { HERO.lampOn = !HERO.lampOn; };
  $('tC').onclick = () => (P.crouchOn = !P.crouchOn);
  $('tM').onclick = openJournal;
  $('tRun').onclick = () => { TOUCH.run = !TOUCH.run; $('tRun').style.borderColor = TOUCH.run ? 'var(--lava)' : ''; };
}
