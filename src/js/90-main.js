// ============================================================ screens drawn on canvases
function drawKronosScreen(s, t) {
  const g = s.g, W = s.c.width, H = s.c.height;
  g.fillStyle = '#031512'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(99,230,205,0.08)'; g.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.fillStyle = '#63e6cd'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = '700 30px Syncopate, Arial Black, sans-serif'; g.fillText('KRONOS', 40, 60);
  g.font = '28px VT323, monospace'; g.fillStyle = 'rgba(99,230,205,0.7)';
  g.fillText(GAME.power ? 'MAIN POWER  ONLINE' : 'AUXILIARY POWER', W - 330, 58);
  if (!GAME.loggedIn) {
    const pulse = 0.55 + 0.45 * Math.sin(t * 2.2);
    g.textAlign = 'center';
    g.fillStyle = `rgba(99,230,205,${0.35 + pulse * 0.6})`;
    g.font = '700 170px Syncopate, Arial Black, sans-serif'; g.fillText('KRONOS', W / 2, H / 2 + 50);
    g.font = '44px VT323, monospace'; g.fillStyle = '#63e6cd';
    g.fillText(Math.floor(t * 1.5) % 2 ? 'ENTER PASSWORD_' : 'ENTER PASSWORD', W / 2, H / 2 + 150);
    g.fillStyle = 'rgba(255,90,60,0.85)'; g.fillText('OPERATOR NOT RESPONDING  /  21 DAYS', W / 2, H - 70);
    return;
  }
  // logged in: the roster of supers, three of them still blinking
  const cols = 8, cw = (W - 80) / cols, ch = 250;
  SUPERS.forEach(([nm, st], i) => {
    const cx = 40 + (i % cols) * cw, cy = 110 + Math.floor(i / cols) * (ch + 30);
    g.strokeStyle = 'rgba(99,230,205,0.5)'; g.strokeRect(cx + 8, cy, cw - 16, ch);
    g.fillStyle = 'rgba(99,230,205,0.12)';
    g.beginPath(); g.arc(cx + cw / 2, cy + 80, 42, 0, TAU); g.fill();
    g.fillRect(cx + cw / 2 - 52, cy + 128, 104, 70);
    g.fillStyle = '#63e6cd'; g.font = '26px VT323, monospace'; g.textAlign = 'center';
    g.fillText(nm, cx + cw / 2, cy + 226);
    if (st === 'TERMINATED') {
      g.save(); g.translate(cx + cw / 2, cy + 110); g.rotate(-0.35);
      g.strokeStyle = 'rgba(255,80,60,0.9)'; g.lineWidth = 4; g.strokeRect(-80, -22, 160, 44);
      g.fillStyle = 'rgba(255,80,60,0.95)'; g.font = '34px VT323, monospace'; g.fillText('TERMINATED', 0, 11);
      g.restore();
    } else if (Math.sin(t * 4 + i) > 0) {
      g.fillStyle = '#ffd36b'; g.font = '34px VT323, monospace'; g.fillText(st, cx + cw / 2, cy + 120);
    }
  });
  g.textAlign = 'left'; g.fillStyle = 'rgba(99,230,205,0.7)'; g.font = '30px VT323, monospace';
  g.fillText('PROJECT KRONOS  /  PHASE 3  /  METROVILLE  /  OPERATOR: NOT RESPONDING', 40, H - 30);
}
function drawPlanScreen(s) {
  const g = s.g, W = s.c.width, H = s.c.height;
  g.fillStyle = '#071019'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(140,200,255,0.12)';
  for (let i = -6; i <= 6; i++) { g.beginPath(); g.ellipse(W / 2, H / 2 + 60, 420, 200, 0, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(W / 2 + i * 60, H / 2 + 60, Math.abs(Math.cos(i / 4)) * 380 + 10, 200, 0, 0, TAU); g.stroke(); break; }
  for (let k = 0; k < 9; k++) { g.beginPath(); g.ellipse(W / 2, H / 2 + 60, 420, 200 * (1 - k / 9), 0, 0, TAU); g.stroke(); }
  for (let k = 0; k < 9; k++) { g.beginPath(); g.ellipse(W / 2, H / 2 + 60, 420 * (1 - k / 9), 200, 0, 0, TAU); g.stroke(); }
  const ax = W / 2 - 260, ay = H / 2 + 150, bx = W / 2 + 280, by = H / 2 - 20;
  g.strokeStyle = '#ff7b2f'; g.lineWidth = 5; g.setLineDash([16, 10]);
  g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(W / 2, -60, bx, by); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#ff7b2f'; g.beginPath(); g.arc(ax, ay, 12, 0, TAU); g.fill(); g.beginPath(); g.arc(bx, by, 12, 0, TAU); g.fill();
  g.fillStyle = '#e9e3d4'; g.font = '700 30px Syncopate, Arial Black, sans-serif'; g.textAlign = 'left';
  g.fillText('NOMANISAN', ax - 90, ay + 54); g.fillText('METROVILLE', bx - 120, by - 30);
  g.font = '700 38px Syncopate, Arial Black, sans-serif'; g.fillText('OPERATION KRONOS', 40, 64);
  g.font = '500 30px Jost, sans-serif'; g.fillStyle = '#ff9a5a'; g.fillText('PHASE 3  /  DELIVERY', 40, 106);
}

// ============================================================ boot
let SAVED = null;
function syncHoles() {
  HOLES.forEach((h, i) => { if (i < holeA.length) { holeA[i].set(h.cx, h.cz, h.hw, h.hl); holeB[i].set(h.c, h.s, h.y0, h.y1); } });
}
// how tall each room is, so the third-person camera knows where the ceiling is
const ROOM_H = { checkpoint: 6, gauntlet: 4, hall: 24, dining: 8, passage: 3.6, computer: 9, labCorr: 4, lab: 18, siloCorr: 6, cellCorr: 4, containment: 26, trophyCorr: 4, trophy: 7, silo: 180, stair: 5, gateTunnel: 7, wfTunnel: 4.4, cave: 5.5, alcove: 3.4, heart: 26 };
function assignRoomHeights() { for (const f of floors) if (f.indoor && !f.h) f.h = ROOM_H[f.room] || 4; }
async function init(hot) {
  let tPrev = performance.now();
  const step = async (pct, text) => { const now = performance.now(); console.info(`[load] ${(now - tPrev).toFixed(0)} ms before: ${text}`); tPrev = now; $('loadFill').style.width = pct + '%'; $('loadStep').textContent = text; await sleep(20); tPrev = performance.now(); };
  try {
    await Promise.race([Promise.all([document.fonts.load('700 64px Syncopate'), document.fonts.load('500 40px Jost'), document.fonts.load('40px VT323')]), sleep(3000)]);
  } catch (e) { /* fonts fall back */ }
  await step(4, 'Raising the island from the sea');
  initMaterials();
  planIsland();
  planHoles();
  await step(12, 'Carving the volcano and its roads');
  buildHeights();
  paintMask();
  await step(26, 'Baking moonlight and sunlight into the slopes');
  buildTerrainMesh();
  buildSky(); buildOcean(); buildWaterAndLava();
  await step(40, 'Growing the jungle');
  planOutdoor();
  initFloraMaterials();
  placeFlora();
  await step(56, 'Wiring the lair inside the mountain');
  buildOutdoor();
  buildBase();
  await step(66, 'Waking the Heart of the Mountain');
  buildWorld2();
  assignRoomHeights();
  syncHoles();
  await step(78, 'Lighting the lava');
  initFX();
  buildRain();
  addPatrolVelocipod();
  buildHero();
  initSecurity();
  buildScanner();
  missionsInit();
  buildDevMenu();
  devApply();
  PLACES = outdoorPlaces();
  wireInput();
  onResize();
  await step(90, 'Warming up the shaders');
  camera.position.set(0, 140, 420); camera.lookAt(VX, 100, VZ);
  // compile for the off-screen target the composer renders into, so the programs match the real frame
  renderer.setRenderTarget(composer.readBuffer);
  try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); } catch (e) { /* compile lazily */ }
  renderer.setRenderTarget(null);
  await step(96, 'Warming up the shaders');
  composer.render(0.016);
  await step(100, 'Ready');
  SAVED = (hot && hot.save) || loadSave();
  if (SAVED) { $('btnStart').textContent = `Continue: ${MISSIONS[Math.min(SAVED.mission, MISSIONS.length - 1)].name}`; $('btnNew').hidden = false; }
  TOUCH.active = window.matchMedia && window.matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window;
  $('loading').hidden = true;
  $('title').hidden = false;
  syncTitleToggles();
  fadeTo(0, 2.5);
  $('btnStart').onclick = () => startGame(!!SAVED);
  $('btnNew').onclick = () => { try { localStorage.removeItem('nomanisan.save2'); } catch (e) { /* storage blocked */ } SAVED = null; startGame(false); };
  $('tTime').onclick = () => { setTimeOfDay(SKY.dayTarget < 0.5); syncTitleToggles(); };
  $('tWeather').onclick = () => { cycleWeather(); syncTitleToggles(); };
  requestAnimationFrame(frame);
}
function syncTitleToggles() {
  $('tTime').textContent = SKY.dayTarget > 0.5 ? 'Day' : 'Night';
  $('tWeather').textContent = { clear: 'Clear sky', rain: 'Rain', storm: 'Storm' }[SKY.weather];
}
function startGame(cont) {
  startAudio();
  $('title').hidden = true;
  $('hud').hidden = false;
  if (TOUCH.active) { $('touch').hidden = false; document.body.classList.add('touch'); }
  GAME.started = true;
  if (cont && SAVED) { applySave(SAVED); jumpToMission(Math.min(SAVED.mission, MISSIONS.length - 1), { cp: SAVED.cp }); }
  else { STORY.shards = new Set(); GAME.secrets = new Set(); GAME.logs = new Set(); GAME.seenAreas = new Set(); GAME.time = 0; STORY.kos = 0; for (const s of SHARDS) s.got = false; jumpToMission(0); }
  updateStats();
  lockPointer();
  if (!startGame.saving) startGame.saving = setInterval(saveGame, 15000);
}

// how "inside" the camera is: tunnels blend in over their first metres so the night outside stays lit
function indoorTarget() {
  const room = P.room;
  if (!room) return 0;
  const mouth = room === 'wfTunnel' ? POI.door : room === 'cave' ? POI.cave : room === 'gateTunnel' ? { x: 0, z: POI.gateZ } : null;
  if (room === 'silo' && P.y > CRATER_Y - 4) return 0;
  if (!mouth) return 1;
  return smoothstep(3, 18, Math.hypot(P.x - mouth.x, P.z - mouth.z));
}
// ============================================================ main loop
let lastT = performance.now();
const _lr = new THREE.Vector3(), _lu = new THREE.Vector3(), _head = new THREE.Vector3();
const FROZEN_MODES = ['pause', 'journal', 'dev'];
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  const t = now / 1000;
  U.time.value = t;
  if (GAME.hitStop > 0) { GAME.hitStop -= dt; dt *= 0.06; }
  if (GAME.mode === 'title' || GAME.mode === 'debug') {
    if (GAME.mode === 'title') {
      const a = t * 0.025 + 1.2;
      camera.position.set(VX + Math.cos(a) * 470, 95 + Math.sin(t * 0.07) * 20, VZ + Math.sin(a) * 470);
      camera.lookAt(VX, 110, VZ); camera.fov = 52; camera.updateProjectionMatrix();
    } else { const d = GAME.debugCam; camera.position.set(d.x, d.y, d.z); camera.rotation.set(d.pitch, d.yaw, 0); camera.fov = d.fov || 68; camera.updateProjectionMatrix(); }
    if (HERO.rig) HERO.rig.root.visible = GAME.mode === 'debug' && !!GAME.debugCam.hero;
  } else if (!FROZEN_MODES.includes(GAME.mode)) {
    if (GAME.mode === 'play') GAME.time += dt;
    GAME.aim = damp(GAME.aim, GAME.aimHeld && GAME.mode === 'play' && !HERO.climb ? 1 : 0, 10, dt);
    if (GAME.mode !== 'ride') updateHero(dt, t);
    animateHero(dt, t);
    updateLift(dt);
    updateDoors(dt, P.x, P.y, P.z);
    updateRide(dt);
    updateThrowables(dt);
    updateShots(dt);
    updateEnemies(dt, t);
    updateSecurity2(dt, t);
    updateEffects(dt);
    updateWorld2(dt, t);
    updateStory(dt, t);
    updateDialogue(dt);
    updateNote(dt);
    if (CUT.on) updateCutscene(dt);
    else if (GAME.mode !== 'ride') {
      updateCameraTP(dt, t);
      updateHeroFill();
      // the telescope: look straight through it
      if (GAME.scope && (Math.hypot(P.vx, P.vz) > 0.6 || GAME.mode !== 'play')) GAME.scope = false;
      GAME.zoom = damp(GAME.zoom || 0, GAME.scope ? 1 : 0, 9, dt);
      if (GAME.zoom > 0.01) { _head.set(P.x, P.y + 1.8, P.z); camera.position.lerp(_head, GAME.zoom); if (GAME.zoom > 0.5) HERO.rig.root.visible = false; }
      camera.fov = lerp(68 - GAME.aim * 10, 9, GAME.zoom); camera.updateProjectionMatrix();
      finalPass.uniforms.uZoom.value = GAME.zoom;
    }
    updateInteract();
    updateAreas(dt);
    fieldCheck(dt);
  }
  for (const f of ANIM) f(dt, t);
  // indoor / outdoor light balance
  const inK = GAME.mode === 'debug' ? (GAME.debugCam.indoor ? 1 : 0) : GAME.mode === 'title' || GAME.mode === 'ride' ? 0 : CUT.on && CUT.shots[CUT.i].outdoor ? 0 : indoorTarget();
  GAME.indoorK = GAME.mode === 'debug' ? inK : damp(GAME.indoorK || 0, inK, 2.5, dt);
  const k = GAME.indoorK;
  updateSky(dt, k);
  if (GAME.mode === 'debug' && GAME.debugCam.nofog) scene.fog.density = 0.00001;
  FX.smoke.mesh.visible = !(GAME.mode === 'debug' && GAME.debugCam.nofog);
  gradePass.uniforms.uWarm.value = k;
  // shadow camera follows the view, snapped to texels so shadows don't crawl
  const cp = camera.position;
  _lr.crossVectors(new THREE.Vector3(0, 1, 0), LIGHT_DIR).normalize(); _lu.crossVectors(LIGHT_DIR, _lr).normalize();
  const tex = 130 / moon.shadow.mapSize.x;
  const a = Math.round(cp.dot(_lr) / tex) * tex, b = Math.round(cp.dot(_lu) / tex) * tex, c = cp.dot(LIGHT_DIR);
  moon.target.position.copy(_lr).multiplyScalar(a).addScaledVector(_lu, b).addScaledVector(LIGHT_DIR, c);
  moon.position.copy(moon.target.position).addScaledVector(LIGHT_DIR, 420);
  skyMesh.position.copy(cp);
  updateLightPool(t, cp, k);
  updateFloraLOD(cp);
  updateFX(dt, t, cp, k > 0.5);
  // screens
  for (const s of Object.values(SCREENS)) {
    if (s.draw === drawPlanScreen) { if (s.drawnPower !== GAME.power) { s.drawnPower = GAME.power; s.draw(s, t); s.tex.needsUpdate = true; s.mat.color.setScalar(GAME.power ? 1.8 : 0.5); } continue; }
    if (t > s.next && s.m.position.distanceToSquared(cp) < 45 * 45) { s.next = t + 0.25; s.draw(s, t); s.tex.needsUpdate = true; }
  }
  finalPass.uniforms.uTime.value = t;
  finalPass.uniforms.uAlarm.value = ALARM.t > 0 ? Math.min(ALARM.t, 1) * 0.3 : 0;
  finalPass.uniforms.uHeat.value = GAME.mode === 'title' ? 0 : lavaHeat(cp.x, cp.y, cp.z) * 0.7;
  finalPass.uniforms.uHit.value = Math.max(0, finalPass.uniforms.uHit.value - dt * 2.2);
  if (GAME.started && GAME.mode !== 'title') { updateScanner(dt); updateHealth(); }
  // sound
  if (AUDIO.on) {
    const r = Math.hypot(P.x, P.z);
    const env = {
      indoor: k > 0.5, y: P.y, coastDist: coastR(Math.atan2(P.z, P.x)) - r,
      jungle: smoothstep(70, 30, P.y) * (P.y > 2.5 ? 1 : 0.3),
      volcano: smoothstep(260, 40, Math.hypot(P.x - VX, P.z - VZ)) * 0.4 + smoothstep(120, 20, Math.hypot(P.x - VENT.x, P.z - VENT.z)) * 0.4,
      fallsDist: Math.hypot(P.x - POI.pool.x, P.y - POI.poolY, P.z - POI.pool.z), heat: lavaHeat(P.x, P.y, P.z),
      heart: P.room === 'heart' ? 1 : P.y < BASE_Y + 2 ? smoothstep(40, 12, Math.hypot(P.x - HEART.x, P.y - HEART.y, P.z - HEART.z)) : 0,
    };
    updateAudio(dt, env); updateListener();
  }
  // hud timers
  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) $('banner').classList.remove('on'); }
  if (GAME.mode === 'play') updateCompass();
  if ((frame.statT = (frame.statT || 0) + dt) > 0.5) { frame.statT = 0; if (GAME.started) updateStats(); }
  updateFps(dt);
  updateFade(dt);
  composer.render(dt);
}

// ============================================================ test hooks (used by the screenshot and playtest harnesses)
window.__nomanisan = {
  GAME, P, POI, LIFT, IRIS, MONO, floors, HOLES, obstacles, obstaclesNear, HERO, STORY, SCAN, ENEMIES, MISSIONS, W2, OMNI, KRONOS, HEART, GRATE, DLG, SKY, CUT, SHARDS, THROWABLES, SECURITY, keys, FIELD, LAVA_WALL, AUDIO, FX, INTERACT,
  sky(day, weather) { if (day != null) { setTimeOfDay(day); SKY.day = day ? 1 : 0; } if (weather) { setWeather(weather); SKY.rain = SKY.rainTarget; SKY.storm = SKY.stormTarget; } },
  view(x, y, z, yaw = 0, pitch = 0, opts = {}) { GAME.mode = 'debug'; GAME.debugCam = { x, y, z, yaw, pitch, fov: opts.fov, indoor: !!opts.indoor, nofog: !!opts.nofog, hero: !!opts.hero }; $('title').hidden = true; $('loading').hidden = true; $('journal').hidden = true; $('hud').hidden = true; FADE.v = 0; FADE.target = 0; finalPass.uniforms.uFade.value = 0; },
  start(mission = 0, opts = {}) { $('title').hidden = true; $('hud').hidden = false; GAME.started = true; if (opts.skip) DLG.skipAll = true; jumpToMission(mission); FADE.v = 0; FADE.target = 0; finalPass.uniforms.uFade.value = 0; },
  at(x, z, y, yaw = 0, pitch = 0) { placeHero({ x, z, y, yaw }); P.pitch = pitch; },
  mission: jumpToMission, skipStep() { STORY.skipStep = true; }, skipCutscene, skipLine, toggleScan, heroAttack, groundSlam, openDev, closeDev, setBoots: takeBoots, respawnHero, hurtHero, useHot, tryGrab, spawnEnemy, killEnemy,
  power() { powerOnNow(); },
  erupt() { FX.eruption = 1; },
  camera,
  aimAt(x, y, z) { const c = camera.position, dx = x - c.x, dy = y - c.y, dz = z - c.z; P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz)); HERO.face = Math.atan2(x - P.x, z - P.z); },
  places: () => devLocations().map(([n, f]) => [n, f()]),
  cutscene, endCutscene, startOmni, startKronos, setFieldOn, punchTarget, HITTABLES, resolvePunch, heroForward,
  lines: () => Object.keys(LINES).length, voices: () => (typeof VOICE_DATA !== 'undefined' ? Object.keys(VOICE_DATA).length : 0),
  terrainHeight, findFloor, riverAt, terrainNormalY,
  state() { return { mode: GAME.mode, mission: STORY.mission, objective: STORY.objective, target: STORY.target && { x: +STORY.target.x.toFixed(1), y: +STORY.target.y.toFixed(1), z: +STORY.target.z.toFixed(1) }, hp: HERO.hp, p: { x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2) }, room: P.room, grounded: P.grounded, enemies: ENEMIES.filter((e) => e.alive).length, line: DLG.cur && DLG.cur.id, cut: CUT.on, boss: STORY.boss && STORY.boss.name, scan: SCAN.on, flags: { ...STORY.flags } }; },
  validate() {
    const bad = [];
    for (const f of floors) {
      if (!f.indoor || f.room === 'heart') continue;
      for (let x = f.x0; x <= f.x1; x += 2) for (let z = f.z0; z <= f.z1; z += 2) {
        if (!f.contains(x, z)) continue;
        const fy = f.y(x, z), th = terrainHeight(x, z);
        if (th < fy + 6 && !inTerrainHole(x, z)) bad.push({ room: f.room, x: +x.toFixed(1), z: +z.toFixed(1), floor: +fy.toFixed(1), terrain: +th.toFixed(1) });
      }
    }
    return bad;
  },
  info() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, flora: flora.counts, lights: lightAnchors.length, floors: floors.length, obstacles: obstacles.length }; },
};

// ============================================================ start (keeps state across live updates of the page)
const HOT = window.claude && window.claude.hot;
if (HOT && HOT.snapshot) HOT.snapshot(() => ({ save: GAME.started ? saveData() : null }));
const bootGame = (data) => init(data || {}).catch((e) => { console.error(e); $('loadStep').textContent = 'Something went wrong while building the island: ' + e.message; });
if (HOT && HOT.ready) HOT.ready(bootGame); else bootGame((HOT && HOT.data) || {});
