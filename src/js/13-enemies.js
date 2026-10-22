// ============================================================ combat world: things you can hit, enemies, security, projectiles
const HITTABLES = [];
const THROWABLES = [];
const ENEMIES = [];
const SHOTS = [];
const ALARM = { t: 0, zone: null, quiet: 0 };
function hittables() { return HITTABLES; }
function addHittable(h) { HITTABLES.push(h); return h; }

// ---- effects
function sparkBurst(x, y, z, n = 12, color = 0xffc070) {
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i++) FX.sparks.add(x, y, z, c.r * 3.5, c.g * 3.5, c.b * 3.5, rr(0.03, 0.07), rr(0.25, 0.7), rr(-5, 5), rr(0, 6), rr(-5, 5));
}
function burstDust(x, y, z, scale = 1, color = 0x8a7d6a) {
  const c = new THREE.Color(color), col = [c.r * 0.35, c.g * 0.35, c.b * 0.35];
  for (let i = 0; i < 10 * scale; i++) {
    const a = rr(0, TAU), sp = rr(2, 6) * scale;
    FX.smoke.spawn({ x: x + Math.cos(a) * 0.6, y: y + 0.3, z: z + Math.sin(a) * 0.6, vx: Math.cos(a) * sp, vy: rr(0.3, 1.5), vz: Math.sin(a) * sp, drag: 2.2, s0: 0.8 * scale, s1: rr(3, 5) * scale, a: 0.32, life: rr(1.2, 2.2), top: col, bot: col });
  }
}
const RINGS = [];
function shockRing(x, y, z, r) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.6, 0.8), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(x, y, z); scene.add(m);
  RINGS.push({ m, t: 0, r });
}
const boomLight = new THREE.PointLight(0xff9a40, 0, 40, 2);
scene.add(boomLight);
let boomT = 0;
function explosion(x, y, z, r = 4, dmg = 3) {
  sparkBurst(x, y, z, 40, 0xffa040);
  for (let i = 0; i < 8; i++) FX.smoke.spawn({ x: x + rr(-1, 1), y: y + rr(0, 1), z: z + rr(-1, 1), vx: rr(-2, 2), vy: rr(2, 5), vz: rr(-2, 2), drag: 1.2, s0: 2, s1: rr(6, 9), a: 0.45, life: rr(2, 3.5), top: [0.05, 0.045, 0.04], bot: [1.6, 0.5, 0.1] });
  boomLight.position.set(x, y + 1.5, z); boomLight.intensity = 3500; boomT = 0.35;
  shockRing(x, y + 0.2, z, r * 1.4);
  FX.shake = Math.max(FX.shake, clamp(1.2 - Math.hypot(P.x - x, P.z - z) / 40, 0.15, 1));
  sfxAt('explode', x, y, z);
  for (const tg of HITTABLES) {
    if (!tg.alive()) continue;
    const p = tg.pos(); const d = Math.hypot(p.x - x, p.y - y, p.z - z);
    if (d < r + (tg.radius || 0.5) && !tg.noSplash) { _hv.set(p.x - x, 0, p.z - z).normalize(); tg.hit(dmg, _hv, 'blast'); }
  }
  const hd = Math.hypot(P.x - x, P.y + 1 - y, P.z - z);
  if (hd < r) hurtHero(Math.round(dmg * 5 * (1 - hd / r)), { x, z });
}
function hitStop(sec) { GAME.hitStop = Math.max(GAME.hitStop || 0, sec); }
function updateEffects(dt) {
  for (let i = RINGS.length - 1; i >= 0; i--) {
    const R = RINGS[i]; R.t += dt;
    const k = R.t / 0.45;
    R.m.scale.setScalar(1 + k * R.r); R.m.material.opacity = 0.9 * (1 - k);
    if (k >= 1) { scene.remove(R.m); R.m.geometry.dispose(); R.m.material.dispose(); RINGS.splice(i, 1); }
  }
  if (boomT > 0) { boomT -= dt; boomLight.intensity = Math.max(0, boomT / 0.35) * 3500; }
}

// ---- line of sight: terrain outdoors, same room indoors
function canSee(ax, ay, az, bx, by, bz, roomA) {
  if (roomA) return roomA === P.room;
  if (P.room) return false;
  for (let i = 1; i < 14; i++) { const f = i / 14, x = lerp(ax, bx, f), y = lerp(ay, by, f), z = lerp(az, bz, f); if (terrainHeight(x, z) > y + 0.3 && !inTerrainHole(x, z)) return false; }
  return true;
}
const heroChest = () => _tp.set(P.x, P.y + 1.35, P.z);

// ============================================================ projectiles
const shotGeo = new THREE.CapsuleGeometry(0.07, 0.6, 3, 6).rotateX(Math.PI / 2);
const shotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.6, 0.35) });
function fireShot(from, to, speed = 24, dmg = 9) {
  const dir = new THREE.Vector3().subVectors(to, from).normalize();
  const m = new THREE.Mesh(shotGeo, shotMat); m.position.copy(from); m.lookAt(to); scene.add(m);
  SHOTS.push({ m, vel: dir.multiplyScalar(speed), life: 3, dmg });
  sfxAt('laser', from.x, from.y, from.z);
}
function updateShots(dt) {
  for (let i = SHOTS.length - 1; i >= 0; i--) {
    const s = SHOTS[i]; s.life -= dt;
    s.m.position.addScaledVector(s.vel, dt);
    const p = s.m.position;
    let dead = s.life <= 0;
    // the hero (a vertical capsule)
    if (!dead && GAME.mode === 'play') {
      const dy = clamp(p.y, P.y + 0.3, P.y + 1.9);
      if (Math.hypot(p.x - P.x, p.y - dy, p.z - P.z) < 0.65) { hurtHero(s.dmg, { x: p.x - s.vel.x, z: p.z - s.vel.z }); sparkBurst(p.x, p.y, p.z, 8, 0xff5040); dead = true; }
    }
    if (!dead) { const fl = findFloor(p.x, p.z, p.y); if ((fl && p.y < fl.y + 0.05) || (!P.room && terrainHeight(p.x, p.z) > p.y && !inTerrainHole(p.x, p.z))) { sparkBurst(p.x, p.y, p.z, 6, 0xff6040); dead = true; } }
    if (!dead && obstacleAt(p)) { sparkBurst(p.x, p.y, p.z, 6, 0xff6040); dead = true; }
    if (dead) { scene.remove(s.m); SHOTS.splice(i, 1); }
  }
}

// ============================================================ throwables (crates, boulders, drums, scrap)
function addThrowable(kind, x, y, z, opts = {}) {
  let mesh;
  if (kind === 'crate') { mesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), M.wood); }
  else if (kind === 'drum') {
    mesh = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.15, 16), M.red); mesh.add(b);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.08, 16), M.black); band.position.y = 0.3; mesh.add(band);
    const band2 = band.clone(); band2.position.y = -0.3; mesh.add(band2);
    const lab = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), M.amberGlow); lab.position.set(0, 0, 0.425); mesh.add(lab);
  } else if (kind === 'boulder') { mesh = new THREE.Mesh(makeRock(rng() * 100 | 0, 0.8), M.rock); mesh.scale.setScalar(0.75); }
  else { mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI * 1.3), M.black); }
  mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const rest = kind === 'boulder' ? 0.45 : kind === 'drum' ? 0.58 : 0.55;
  const fl = findFloor(x, z, y + 1);
  mesh.position.set(x, (fl ? fl.y : y) + rest, z);
  mesh.rotation.y = rr(0, TAU);
  scene.add(mesh);
  const o = { kind, mesh, rest, vel: null, flying: false, held: false, gone: false, home: mesh.position.clone(), respawn: opts.respawn };
  THROWABLES.push(o);
  if (kind === 'crate' || kind === 'drum') {
    o.hp = kind === 'drum' ? 1 : 2;
    o.h = addHittable({ pos: () => o.mesh.position, radius: 0.7, reachUp: 1.2, slammable: true, alive: () => !o.gone && !o.held && !o.flying,
      hit: (dmg) => { o.hp -= dmg; if (o.hp <= 0) breakThrowable(o); else { o.mesh.position.y += 0.05; sfxAt('wood', o.mesh.position.x, o.mesh.position.y, o.mesh.position.z); } } });
  }
  return o;
}
function breakThrowable(o) {
  if (o.gone) return;
  o.gone = true; o.mesh.visible = false;
  const p = o.mesh.position;
  if (o.kind === 'drum') explosion(p.x, p.y, p.z, 5, 3);
  else { sparkBurst(p.x, p.y, p.z, 10, 0xc89a60); burstDust(p.x, p.y - 0.4, p.z, 0.6, 0x6a5040); sfxAt('wood', p.x, p.y, p.z); if (o.onBreak) o.onBreak(); }
  if (o.respawn) setTimeout(() => { o.gone = false; o.hp = o.kind === 'drum' ? 1 : 2; o.mesh.visible = true; o.mesh.position.copy(o.home); o.flying = false; o.vel = null; }, o.respawn * 1000);
}
function updateThrowables(dt) {
  for (const o of THROWABLES) {
    if (!o.flying || o.gone) continue;
    o.vel.y -= 22 * dt;
    const p = o.mesh.position;
    p.addScaledVector(o.vel, dt);
    o.mesh.rotation.x += dt * 7; o.mesh.rotation.z += dt * 5;
    let impact = false;
    for (const tg of HITTABLES) {
      if (tg === o.h || !tg.alive()) continue;
      const q = tg.pos();
      if (Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) < (tg.radius || 0.6) + 0.8) { _hv.copy(o.vel).setY(0).normalize(); tg.hit(o.kind === 'boulder' ? 4 : 3, _hv, 'throw'); impact = true; }
    }
    const fl = findFloor(p.x, p.z, p.y + 0.5);
    if (fl && p.y - o.rest < fl.y) { p.y = fl.y + o.rest; impact = true; }
    if (!P.room && !inTerrainHole(p.x, p.z) && terrainHeight(p.x, p.z) > p.y - 0.3) impact = true;
    if (obstacleAt(p)) impact = true;
    if (p.y < -30) impact = true;
    if (impact) {
      o.flying = false; o.vel = null;
      FX.shake = Math.max(FX.shake, 0.2);
      if (o.kind === 'crate' || o.kind === 'drum') breakThrowable(o);
      else { burstDust(p.x, p.y - 0.4, p.z, 0.8); sfxAt('thud', p.x, p.y, p.z); const f2 = findFloor(p.x, p.z, p.y + 2); if (f2) p.y = f2.y + o.rest; }
    }
  }
}

// ============================================================ security devices (cameras, birds, searchlights, lasers)
// A device fills a "seen" meter while the hero is in view; full = alarm and drones.
function initSecurity() {
  for (const c of SECURITY.cams) {
    c.state = 'active'; c.seen = 0; c.hp = 1; c.spawnCd = 0;
    c.h = addHittable({ pos: () => c.g.position, radius: 0.4, reachUp: 6, alive: () => c.state !== 'broken', hit: () => breakCamera(c) });
    addScannable({ kind: 'security', label: 'Camera', pos: () => c.g.position, when: () => c.state === 'active' || c.state === 'alert', hack: () => hackCamera(c), room: c.room });
  }
  for (const b of SECURITY.birds) {
    b.state = 'active'; b.seen = 0;
    b.pv = new THREE.Vector3(b.x, b.y, b.z);
    b.h = addHittable({ pos: () => b.pv, radius: 0.5, reachUp: 3.4, alive: () => b.state !== 'broken', hit: () => { b.state = 'broken'; b.head.rotation.set(1.2, 0, 0.5); b.cone.visible = false; b.eyeMat.emissiveIntensity = 0; sparkBurst(b.x, b.y, b.z, 18); sfxAt('robotBreak', b.x, b.y, b.z); onSecurityDown('bird'); } });
    addScannable({ kind: 'security', label: 'Bird sentry', pos: () => b.pv, when: () => b.state === 'active', hack: () => { b.state = 'hacked'; b.cone.visible = false; b.eyeMat.emissive.set(0x3dff8a); onSecurityDown('bird'); } });
  }
  for (const s of SECURITY.searchlights) {
    s.state = 'active'; s.seen = 0;
    if (s.patrol) continue;
    const base = s.grp.position;
    const lp = new THREE.Vector3(base.x, base.y - 3, base.z);
    addScannable({ kind: 'security', label: 'Searchlight power', pos: () => lp, when: () => s.state === 'active', hack: () => { s.state = 'hacked'; s.spot.intensity = 0; s.cone.visible = false; s.lens.material.emissiveIntensity = 0.1; onSecurityDown('light'); } });
  }
}
function breakCamera(c) {
  if (c.state === 'broken') return;
  c.state = 'broken'; c.cone.visible = false;
  c.ledMat.emissiveIntensity = 0;
  c.head.rotation.x = 1.1; c.head.rotation.z = 0.6;
  sparkBurst(c.g.position.x, c.g.position.y, c.g.position.z, 20);
  sfxAt('robotBreak', c.g.position.x, c.g.position.y, c.g.position.z);
  c.sparkT = 0;
  onSecurityDown('camera');
}
function hackCamera(c) {
  c.state = 'hacked'; c.cone.visible = false; c.ledMat.emissive.set(0x3dff8a); c.ledMat.emissiveIntensity = 1.2;
  onSecurityDown('camera');
}
let securityDownCount = 0;
function onSecurityDown(kind) {
  securityDownCount++;
  STORY.flags['down_' + kind] = (STORY.flags['down_' + kind] || 0) + 1;
  if (securityDownCount === 2) bark('syn_hack');
  if (kind === 'bird') findSecret('bird');
}
function raiseAlarm(where, room) {
  const fresh = ALARM.t <= 0;
  ALARM.t = 22; ALARM.room = room || null;
  if (fresh) { sfx('alarmStart'); bark('syn_alarm'); }
  const alive = ENEMIES.filter((e) => e.alive && e.type === 'drone').length;
  const n = Math.min(2, 4 - alive);
  for (let i = 0; i < n; i++) {
    const a = rr(0, TAU);
    const x = where.x + Math.cos(a) * 6, z = where.z + Math.sin(a) * 6;
    const y = room ? where.y + 1 : Math.max(terrainHeight(x, z), 0) + 9;
    spawnEnemy('drone', x, y, z, { room, alert: true });
  }
}
const _dir2 = new THREE.Vector3();
function updateSecurity2(dt, t) {
  const playing = GAME.mode === 'play' && !GAME.noDetect && !GAME.cutscene;
  const eye = _v3a.set(P.x, P.y + (P.crouch > 0.5 ? 1.2 : 1.8), P.z);
  const stealth = P.crouch > 0.5 ? 0.6 : 1;
  let seenMax = 0;
  for (const c of SECURITY.cams) {
    if (c.state === 'broken') { c.sparkT = (c.sparkT || 0) - dt; if (c.sparkT < 0 && c.g.position.distanceToSquared(camera.position) < 900) { c.sparkT = rr(0.6, 2.5); sparkBurst(c.g.position.x, c.g.position.y - 0.2, c.g.position.z, 4); } continue; }
    if (c.state === 'hacked') { c.head.rotation.x = 0.7; continue; }
    let yaw = c.baseYaw + Math.sin(t * c.speed + c.phase) * c.sweep;
    let seen = false, d = 99;
    if (playing && P.room === c.room) {
      _dir2.set(Math.sin(yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(yaw) * Math.cos(c.pitch));
      _v3b.copy(eye).sub(c.g.position); d = _v3b.length();
      if (d < c.range * stealth && Math.acos(clamp(_v3b.dot(_dir2) / d, -1, 1)) < c.fov) seen = true;
    }
    if (seen || c.seen > 0.3) { const want = Math.atan2(P.x - c.x, P.z - c.z); c.trackYaw = c.trackYaw == null ? yaw : c.trackYaw + wrapAngle(want - c.trackYaw) * (1 - Math.exp(-dt * 4)); yaw = c.trackYaw; } else c.trackYaw = null;
    c.head.rotation.y = yaw; c.head.rotation.x = -c.pitch;
    c.seen = clamp(c.seen + (seen ? dt * (1.3 + (1 - d / c.range) * 1.5) : -dt * 0.5), 0, 1);
    c.state = c.seen > 0.05 ? 'alert' : 'active';
    c.ledMat.emissiveIntensity = c.state === 'alert' ? (Math.sin(t * 16) > 0 ? 6 : 1) : 2;
    if (seen && c.seen > 0.05 && !c.chirped) { c.chirped = true; sfxAt('spotted', c.x, c.y, c.z); }
    if (!seen && c.seen <= 0) c.chirped = false;
    c.spawnCd = Math.max(0, (c.spawnCd || 0) - dt);
    if (c.seen >= 1 && c.spawnCd <= 0) { c.spawnCd = 35; raiseAlarm(c.g.position, c.room); }
    seenMax = Math.max(seenMax, c.seen);
  }
  for (const b of SECURITY.birds) {
    if (b.state !== 'active') { if (b.state === 'hacked') b.head.rotation.x = 0.7; continue; }
    b.yaw += dt * 0.6 * Math.sin(t * 0.3 + b.x);
    b.head.rotation.y = b.yaw;
    const d = Math.hypot(P.x - b.x, P.z - b.z);
    let seen = false;
    if (playing && !P.room && d < 9 * stealth) {
      const bearing = Math.atan2(P.x - b.x, P.z - b.z);
      if (Math.abs(wrapAngle(bearing - b.yaw)) < 0.5) seen = true;
    }
    b.seen = clamp(b.seen + (seen ? dt * 1.2 : -dt * 0.4), 0, 1);
    if (seen && b.squawk <= 0) { b.squawk = 3; sfxAt('squawk', b.x, b.y, b.z); }
    b.squawk = Math.max(0, (b.squawk || 0) - dt);
    b.spawnCd = Math.max(0, (b.spawnCd || 0) - dt);
    if (b.seen >= 1 && b.spawnCd <= 0) { b.spawnCd = 40; raiseAlarm({ x: b.x, y: b.y, z: b.z }, null); }
    seenMax = Math.max(seenMax, b.seen);
  }
  for (const s of SECURITY.searchlights) {
    if (s.update) s.update(dt, t); else if (s.state !== 'hacked' && s.state !== 'dormant') { s.yaw = s.baseYaw + Math.sin(t * s.speed) * s.sweep; s.head.rotation.set(-s.pitch, s.yaw, 0, 'YXZ'); }
    if (s.state === 'hacked' || s.state === 'dormant' || !playing || P.room) { s.seen = Math.max(0, (s.seen || 0) - dt); continue; }
    s.head.getWorldDirection(_dir2); s.head.getWorldPosition(_v3b);
    const sx = _v3b.x, sy = _v3b.y, sz = _v3b.z;
    _v3b.copy(eye).sub(_v3b); const d = _v3b.length();
    let seen = d < s.range * 1.1 && Math.acos(clamp(_v3b.dot(_dir2) / d, -1, 1)) < 0.15 && canSee(sx, sy, sz, eye.x, eye.y, eye.z, null);
    s.seen = clamp((s.seen || 0) + (seen ? dt * 0.9 : -dt * 0.35), 0, 1);
    s.spawnCd = Math.max(0, (s.spawnCd || 0) - dt);
    if (s.seen >= 1 && s.spawnCd <= 0) { s.spawnCd = 40; raiseAlarm(eye, null); }
    seenMax = Math.max(seenMax, s.seen);
  }
  for (const L of SECURITY.lasers) {
    const on = L.on(t) && !L.off;
    L.mesh.visible = on;
    if (!on || !playing || P.room !== L.room) continue;
    for (let i = 0; i <= 12; i++) {
      const f = i / 12, qx = lerp(L.a.x, L.b.x, f), qy = lerp(L.a.y, L.b.y, f), qz = lerp(L.a.z, L.b.z, f);
      if (Math.hypot(qx - P.x, qz - P.z) < 0.5 && qy > P.y && qy < P.y + (P.crouch > 0.5 ? HERO_CROUCH_H : HERO_H)) {
        if (!L.cool || t > L.cool) { L.cool = t + 2; hurtHero(10, { x: qx, z: qz }); raiseAlarm(_v3a.set(qx, qy, qz).clone(), L.room); }
        break;
      }
    }
  }
  ALARM.t = Math.max(0, ALARM.t - dt);
  if (ALARM.t > 0 && !ENEMIES.some((e) => e.alive && e.alarmSpawn)) ALARM.t = Math.min(ALARM.t, 3);
  GAME.alarm = ALARM.t;
  $('detect').classList.toggle('on', seenMax > 0.02 && ALARM.t <= 0);
  $('detectFill').style.width = (seenMax * 100).toFixed(1) + '%';
}
const _v3a = new THREE.Vector3(), _v3b = new THREE.Vector3();

// ============================================================ enemies
function makeDroneMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 12), M.white); g.add(body);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.06, 6, 24), M.darkMetal); band.rotation.x = Math.PI / 2; g.add(band);
  const eyeM = M.redGlow.clone();
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), eyeM); eye.position.z = 0.4; g.add(eye);
  const rotor = new THREE.Group(); rotor.position.y = 0.42; g.add(rotor);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.12), M.darkMetal); b.rotation.y = (i / 3) * Math.PI; rotor.add(b); }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.3), M.red); fin.position.set(0, -0.35, -0.25); g.add(fin);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { g, eyeM, rotor };
}
function makeSpiderMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 14), M.black); body.position.y = 1.1; g.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.71, 0.06, 6, 28, 2.2), M.redGlow.clone()); ring.position.y = 1.18; ring.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 1.1); g.add(ring);
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const hip = new THREE.Group(); hip.position.set(Math.cos(a) * 0.55, 1.05, Math.sin(a) * 0.55); hip.rotation.y = -a; g.add(hip);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.9, 6).translate(0, 0.45, 0), M.darkMetal); up.rotation.z = -1.0; hip.add(up);
    const knee = new THREE.Group(); knee.position.set(0.76, 0.48, 0); hip.add(knee);
    const low = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.02, 1.25, 6).translate(0, -0.62, 0), M.black); low.rotation.z = 0.35; knee.add(low);
    legs.push({ hip, knee, a });
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { g, eyeM: ring.material, legs, body };
}
function spawnEnemy(type, x, y, z, opts = {}) {
  const e = { type, alive: true, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), hp: type === 'drone' ? 2 : type === 'spider' ? 4 : 3, t: rr(0, 3), cd: rr(0.8, 2), room: opts.room || null, group: opts.group || null, alarmSpawn: !!opts.alert, flash: 0, state: opts.alert || opts.hunt ? 'hunt' : 'idle' };
  if (type === 'drone') { Object.assign(e, makeDroneMesh()); e.hover = rr(2.8, 3.8); }
  if (type === 'spider') { Object.assign(e, makeSpiderMesh()); e.state = 'hunt'; }
  e.g.position.copy(e.pos); scene.add(e.g);
  e.h = addHittable({ pos: () => e.pos, radius: type === 'spider' ? 0.9 : 0.55, reachUp: type === 'drone' ? 4.2 : 2, slammable: type === 'spider', alive: () => e.alive,
    hit: (dmg, dir, kind) => damageEnemy(e, dmg, dir, kind) });
  e.sc = addScannable({ kind: 'enemy', label: type === 'drone' ? 'Security drone' : 'Spider-bot', pos: () => e.pos, when: () => e.alive });
  ENEMIES.push(e);
  if (type === 'drone') sfxAt('droneUp', x, y, z);
  return e;
}
function damageEnemy(e, dmg, dir, kind) {
  if (!e.alive) return;
  e.hp -= dmg; e.flash = 0.12;
  e.vel.addScaledVector(dir, kind === 'finisher' || kind === 'slam' ? 9 : 3);
  if (e.type === 'drone') { e.vel.y += 1.5; e.stun = 0.8; e.diving = 0; e.diveT = rr(2, 4); }
  e.state = 'hunt';
  if (e.hp <= 0) killEnemy(e);
  else sfxAt('metalHit', e.pos.x, e.pos.y, e.pos.z);
}
// free everything a dead enemy owned (meshes are built per enemy)
function disposeEnemy(e) {
  scene.remove(e.g);
  e.g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  if (e.eyeM) e.eyeM.dispose();
  removeScannable(e.sc);
  const i = HITTABLES.indexOf(e.h); if (i >= 0) HITTABLES.splice(i, 1);
}
function killEnemy(e) {
  e.alive = false;
  explosion(e.pos.x, e.pos.y, e.pos.z, 2.5, 1);
  disposeEnemy(e);
  STORY.kills = (STORY.kills || 0) + 1;
  if (rng() < 0.4 && !e.room) addThrowable('scrap', e.pos.x, e.pos.y, e.pos.z);
  if (STORY.kills === 1) setTimeout(() => bark('meg_firstkill'), 600);
}
function calmAllEnemies() {
  for (const e of ENEMIES) if (e.alive && e.alarmSpawn) { e.alive = false; disposeEnemy(e); }
  for (const s of SHOTS) scene.remove(s.m); SHOTS.length = 0;
  ALARM.t = 0;
  for (const c of SECURITY.cams) c.seen = 0;
  for (const b of SECURITY.birds) b.seen = 0;
  for (const s of SECURITY.searchlights) s.seen = 0;
}
function clearGroup(group) { for (const e of ENEMIES) if (e.group === group && e.alive) { e.alive = false; disposeEnemy(e); } }
function groupAlive(group) { return ENEMIES.filter((e) => e.group === group && e.alive).length; }
const _e1 = new THREE.Vector3();
function updateEnemies(dt, t) {
  const playing = GAME.mode === 'play' && !GAME.cutscene;
  const chest = _e1.set(P.x, P.y + 1.35, P.z);
  for (const e of ENEMIES) {
    if (!e.alive) continue;
    e.t += dt; e.flash = Math.max(0, e.flash - dt);
    const toP = _v3a.copy(chest).sub(e.pos); const d = toP.length();
    const sees = playing && d < 40 && canSee(e.pos.x, e.pos.y, e.pos.z, chest.x, chest.y, chest.z, e.room);
    if (sees && e.state === 'idle' && d < 22) e.state = 'hunt';
    if (e.type === 'drone') {
      e.rotor.rotation.y += dt * 30;
      let want = e.pos.clone();
      e.stun = Math.max(0, (e.stun || 0) - dt);
      // drones circle and shoot, then swoop in close to ram you: that is when you punch them
      e.diveT = (e.diveT ?? rr(3, 6)) - dt;
      if (e.diveT < 0 && !e.diving && e.state === 'hunt') { e.diving = 1.6; sfxAt('droneUp', e.pos.x, e.pos.y, e.pos.z); }
      if (e.diving) { e.diving -= dt; if (e.diving <= 0) { e.diving = 0; e.diveT = rr(4, 7); } }
      if (e.stun > 0) { want.y = e.pos.y - dt * 2; }
      else if (e.state === 'hunt' && playing && e.diving) {
        want.set(P.x + Math.sin(HERO.face) * 1.7, P.y + 1.5, P.z + Math.cos(HERO.face) * 1.7);
        if (d < 1.4 && !e.rammed) { e.rammed = true; hurtHero(6, e.pos); }
      } else if (e.state === 'hunt' && playing) {
        e.rammed = false;
        const ang = Math.atan2(e.pos.z - P.z, e.pos.x - P.x) + dt * 0.5;
        const R = 7 + Math.sin(e.t * 0.7) * 1.5;
        want.set(P.x + Math.cos(ang) * R, P.y + e.hover + Math.sin(e.t * 1.3) * 0.6, P.z + Math.sin(ang) * R);
      } else want.y = e.pos.y + Math.sin(e.t) * 0.02;
      e.vel.lerp(_v3b.copy(want).sub(e.pos).multiplyScalar(e.diving ? 3 : 1.6).clampLength(0, e.diving ? 13 : 9), 1 - Math.exp(-dt * (e.stun > 0 ? 0.6 : 2.5)));
      e.pos.addScaledVector(e.vel, dt);
      const gy = e.room ? floorUnder(e.pos, e.room) : Math.max(terrainHeight(e.pos.x, e.pos.z), -0.5);
      if (e.pos.y < gy + 1.6) { e.pos.y = gy + 1.6; e.vel.y = Math.max(e.vel.y, 0); }
      if (e.room) clampToRoom(e.pos, e.room, 0.8);
      e.g.position.copy(e.pos);
      e.g.lookAt(chest.x, e.pos.y, chest.z);
      e.g.rotation.z = -e.vel.x * 0.04;
      e.eyeM.emissiveIntensity = e.flash > 0 ? 12 : e.state === 'hunt' ? 5 : 2;
      e.cd -= dt;
      if (e.state === 'hunt' && sees && e.cd <= 0 && d < 30 && !e.diving && e.stun <= 0) {
        e.cd = rr(1.7, 2.6);
        const lead = _v3b.set(P.vx, 0, P.vz).multiplyScalar(d / 26 * 0.6);
        fireShot(e.pos.clone().add(new THREE.Vector3(0, -0.1, 0)), chest.clone().add(lead), 26, 8);
      }
    } else if (e.type === 'spider') {
      const flat = Math.hypot(P.x - e.pos.x, P.z - e.pos.z);
      let speed = 0;
      if (e.state === 'hunt' && playing) {
        if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) { if (flat < 2.8 && Math.abs(P.y - e.pos.y) < 2) hurtHero(14, e.pos); e.cd = 1.3; sfxAt('clank', e.pos.x, e.pos.y, e.pos.z); } }
        else if (flat < 2.2 && e.cd <= 0) { e.windup = 0.45; sfxAt('servo', e.pos.x, e.pos.y, e.pos.z); }
        else if (flat > 1.8) speed = 6.2;
      }
      e.cd -= dt;
      const ang = Math.atan2(P.x - e.pos.x, P.z - e.pos.z);
      e.yaw = e.yaw == null ? ang : e.yaw + wrapAngle(ang - e.yaw) * (1 - Math.exp(-dt * 6));
      e.vel.x = damp(e.vel.x, Math.sin(e.yaw) * speed, 4, dt); e.vel.z = damp(e.vel.z, Math.cos(e.yaw) * speed, 4, dt);
      const nx = e.pos.x + e.vel.x * dt, nz = e.pos.z + e.vel.z * dt;
      const fl = findFloor(nx, nz, e.pos.y + 0.6);
      if (fl && Math.abs(fl.y - e.pos.y) < 1.2 && (!e.room || fl.f.room === e.room || fl.f === TERRAIN)) { const [rx, rz] = resolveObstacles(nx, nz, fl.y, fl.y + 1.6); e.pos.x = rx; e.pos.z = rz; e.pos.y = fl.y; }
      else { e.vel.x *= -0.3; e.vel.z *= -0.3; }
      e.g.position.copy(e.pos); e.g.rotation.y = e.yaw;
      const gait = e.t * (speed > 0.5 ? 12 : 2);
      e.legs.forEach((L, i) => { L.hip.rotation.z = Math.sin(gait + i * Math.PI / 2) * 0.25; L.knee.rotation.z = 0.35 + Math.max(0, Math.sin(gait + i * Math.PI / 2)) * 0.4; });
      e.body.position.y = 1.1 + Math.abs(Math.sin(gait)) * 0.06 - (e.windup > 0 ? 0.25 : 0);
      e.eyeM.emissiveIntensity = e.flash > 0 ? 12 : e.windup > 0 ? (Math.sin(t * 40) > 0 ? 9 : 2) : 4;
    }
  }
  for (let i = ENEMIES.length - 1; i >= 0; i--) if (!ENEMIES[i].alive) ENEMIES.splice(i, 1);
}
// keep indoor enemies inside their room
function roomFloors(room) { return floors.filter((f) => f.room === room); }
function floorUnder(p, room) { let best = -Infinity; for (const f of roomFloors(room)) if (f.contains(p.x, p.z)) best = Math.max(best, f.y(p.x, p.z)); return best === -Infinity ? p.y - 2 : best; }
function clampToRoom(p, room, m) {
  const fs = roomFloors(room); if (!fs.length) return;
  if (fs.some((f) => f.contains(p.x, p.z))) return;
  let bx = 0, bz = 0, bd = Infinity;
  for (const f of fs) { const cx = clamp(p.x, f.x0 + m, f.x1 - m), cz = clamp(p.z, f.z0 + m, f.z1 - m); const d = (cx - p.x) ** 2 + (cz - p.z) ** 2; if (d < bd && f.contains(cx, cz)) { bd = d; bx = cx; bz = cz; } }
  if (bd < Infinity) { p.x = bx; p.z = bz; }
}
