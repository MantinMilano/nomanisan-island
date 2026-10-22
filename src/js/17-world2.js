// ============================================================ story set pieces: everything the missions use
const W2 = { scorch: [], valves: [], nodes: [], pylons: [], vents: [], debris: [], breakables: [] };
const SILO = {};
const HEART = { x: VX, z: VZ, y: 8, r: 30, sealed: true, awake: 0, pillars: [], order: [], beam: null };
const GRATE = { x: VX - 8, z: VZ + 6, r: 2.3, open: false, hp: 3 };
const CAM_VOLUMES = [];   // shafts the camera may float in although no floor is under it
const _UP = new THREE.Vector3(0, 1, 0), _rv = new THREE.Vector3();
const unitRod = (r, mat, parent = scene) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8).translate(0, 0.5, 0), mat); m.castShadow = true; parent.add(m); return m; };
function setRod(m, a, b) { _rv.subVectors(b, a); const L = _rv.length(); m.position.copy(a); m.quaternion.setFromUnitVectors(_UP, _rv.multiplyScalar(1 / Math.max(L, 1e-4))); m.scale.set(1, L, 1); }
const groundY = (x, z) => Math.max(terrainHeight(x, z), 0.1);

function buildWorld2() {
  buildBoatWreck();
  buildTowerTop();
  buildScorchTrail();
  buildOutpost();
  buildJungleSecurity();
  buildEchoShards();
  buildVolcanoLife();
  LIGHT_ZONE = 'in';
  try {
    buildAlcove();
    buildHoloSyndrome();
    buildValves();
    buildOmniBoss();
    buildMirage();
    buildHeartCavern();
    buildBaseProps();
  } finally { LIGHT_ZONE = 'out'; }
  buildKronos();
  hookWaterfallDoor();
}

// ============================================================ prologue: the wrecked boat on the beach
// A boat hull lofted from U-shaped sections: full width at the stern, tapering to a raised bow.
function boatHullGeometry(L, W, D) {
  const NS = 18, NC = 12, pos = [], col = [], idx = [];
  const white = new THREE.Color(0xe4ded0), red = new THREE.Color(0xa3241b), dark = new THREE.Color(0x2a2a2c);
  for (let i = 0; i <= NS; i++) {
    const u = i / NS, z = -L / 2 + u * L;
    const w = (W / 2) * (u < 0.55 ? 0.88 + 0.12 * smoothstep(0, 0.25, u) : Math.pow(Math.cos(((u - 0.55) / 0.45) * Math.PI / 2), 0.75));
    const top = 0.35 * u * u, d = D * (0.75 + 0.25 * u);
    for (let j = 0; j <= NC; j++) {
      const t = j / NC * 2 - 1;
      const y = top - d * Math.pow(Math.max(0, 1 - t * t), 0.7);
      pos.push(w * t, y, z);
      const depth = (top - y) / d;
      col.push(...(depth > 0.78 ? dark : depth < 0.16 && depth > 0.06 ? red : white).toArray());
    }
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NC; j++) { const a = i * (NC + 1) + j, b = a + NC + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  // flat transom at the stern
  const base = pos.length / 3;
  for (let j = 0; j <= NC; j++) { pos.push(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]); col.push(...white.toArray()); }
  pos.push(0, 0, -L / 2); col.push(...white.toArray());
  const c = base + NC + 1;
  for (let j = 0; j < NC; j++) idx.push(base + j, c, base + j + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function buildBoatWreck() {
  const B = POI.beach, o = POI.out, s = POI.side;
  const x = B.x + s.x * 10 + o.x * 2, z = B.z + s.z * 10 + o.z * 2;
  const y = groundY(x, z);
  const yaw = Math.atan2(-o.x, -o.z) + 0.55;
  const g = new THREE.Group(); g.position.set(x, y - 0.25, z); g.rotation.set(0.1, yaw, 0.24); scene.add(g);
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.55, side: THREE.DoubleSide, envMap: envTex, envMapIntensity: 0.4 });
  const hull = new THREE.Mesh(boatHullGeometry(7.2, 2.5, 1.15), hullMat);
  hull.position.y = 1.15; hull.castShadow = true; hull.receiveShadow = true; g.add(hull);
  box(2.1, 0.1, 4.6, M.wood, 0.05, 1.02, -0.9, { parent: g, ry: 0.03 });
  const cabin = box(1.7, 1.1, 1.8, M.white, 0, 1.0, -0.8, { parent: g }); cabin.rotation.z = 0.05;
  box(1.6, 0.5, 0.08, M.glassDark, 0, 2.05, 0.15, { parent: g });
  box(1.8, 0.08, 2.1, M.darkMetal, 0, 2.1, -0.8, { parent: g });
  // outboard motor, knocked sideways
  const mot = new THREE.Group(); mot.position.set(0.3, 1.0, -3.6); mot.rotation.set(0.4, 0.3, 0.9); g.add(mot);
  mot.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.6), M.black));
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.24), M.darkMetal); leg.position.y = -0.8; mot.add(leg);
  // a hole punched in the side, scorched
  const holeM = new THREE.Mesh(new THREE.CircleGeometry(0.55, 14), new THREE.MeshBasicMaterial({ color: 0x050403 })); holeM.position.set(1.23, 0.75, 1.2); holeM.rotation.y = Math.PI / 2 + 0.1; g.add(holeM);
  // debris on the sand
  for (let i = 0; i < 9; i++) {
    const a = rr(0, TAU), d = rr(3, 9), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    const pl = box(rr(0.15, 0.3), 0.06, rr(1, 2.2), M.wood, px, groundY(px, pz) + 0.02, pz, { ry: rr(0, TAU) }); pl.rotation.z = rr(-0.2, 0.2);
  }
  const ring = mesh(new THREE.TorusGeometry(0.4, 0.12, 8, 20), M.orange, x - o.x * 4 + s.x * 2, groundY(x - o.x * 4 + s.x * 2, z - o.z * 4 + s.z * 2) + 0.12, z - o.z * 4 + s.z * 2, scene, { rx: -Math.PI / 2 + 0.2 });
  void ring;
  addCircleObs(x, z, 2.2, y - 1, y + 2.6);
  addCircleObs(x + Math.sin(yaw) * 3, z + Math.cos(yaw) * 3, 1.6, y - 1, y + 2.2);
  addCircleObs(x - Math.sin(yaw) * 3, z - Math.cos(yaw) * 3, 1.6, y - 1, y + 2.2);
  FX_POINTS.smoke.push({ x: x - Math.sin(yaw) * 3.4, y: y + 1.5, z: z - Math.cos(yaw) * 3.4, k: 0.4 });
  FX_POINTS.embers.push({ x: x - Math.sin(yaw) * 3.4, y: y + 1.2, z: z - Math.cos(yaw) * 3.4, k: 0.4 });
  addLight(x - Math.sin(yaw) * 3.4, y + 1.6, z - Math.cos(yaw) * 3.4, 0xff7a2a, 30, 12, { flicker: 1 });
  // the emergency tracker blinking in the cabin
  const tp = new THREE.Vector3(x + Math.sin(yaw) * -0.8, y + 1.5, z + Math.cos(yaw) * -0.8);
  const led = mesh(new THREE.SphereGeometry(0.08, 8, 6), M.redGlow.clone(), tp.x, tp.y + 0.3, tp.z);
  ANIM.push((dt, t) => { led.material.emissiveIntensity = (t % 1.2) < 0.15 ? 9 : 0.4; });
  W2.tracker = addScannable({ kind: 'clue', label: 'Emergency tracker', pos: () => tp, when: () => STORY.mission === 0, analyze: { time: 1.2, done: () => { STORY.flags.tracker = true; } } });
  W2.boatSpawn = { x: x - o.x * 4.5 - s.x * 3, z: z - o.z * 4.5 - s.z * 3, yaw: Math.atan2(o.x, o.z) };
  W2.boat = { x, y, z };
  for (let i = 0; i < 3; i++) addThrowable('crate', x - o.x * rr(5, 8) + s.x * rr(-5, 5), y, z - o.z * rr(5, 8) + s.z * rr(-5, 5));
}

// ============================================================ radio hill: platform, ladder, the transmitter
function buildTowerTop() {
  const R = POI.radio, y = terrainHeight(R.x, R.z), top = y + 30;
  W2.towerBase = { x: R.x, y, z: R.z }; W2.towerTop = top;
  const plat = mesh(new THREE.RingGeometry(0.95, 3.1, 40, 1).rotateX(-Math.PI / 2), M.metalPanel.clone(), R.x, top, R.z, scene, { cast: true });
  plat.material.side = THREE.DoubleSide;
  cyl(3.1, 3.1, 0.22, M.darkMetal, R.x, top - 0.22, R.z, { seg: 40, open: true });
  floorAnnulus(R.x, R.z, 2.05, 3.1, top, [], { kind: 'metal' });
  const rail = mesh(new THREE.TorusGeometry(3.05, 0.04, 6, 48), M.red, R.x, top + 1.05, R.z, scene, { rx: Math.PI / 2 });
  void rail;
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; cyl(0.03, 0.03, 1.05, M.red, R.x + Math.cos(a) * 3.05, top, R.z + Math.sin(a) * 3.05, { seg: 4 }); }
  // ladder on the west face
  const lx = R.x - 2.3, lz = R.z;
  for (const dz of [-0.32, 0.32]) cyl(0.035, 0.035, 30.2, M.metal, lx, y, lz + dz, { seg: 5 });
  const rungs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.05, 0.64), M.metal, 66);
  for (let k = 0; k < 66; k++) { _m4.makeTranslation(lx, y + 0.4 + k * 0.45, lz); rungs.setMatrixAt(k, _m4); }
  scene.add(rungs);
  const foot = { x: lx - 0.75, y, z: lz, face: Math.PI / 2 }, head = { x: R.x - 2.65, y: top, z: R.z };
  addInteract({ pos: { x: lx - 0.6, y: y + 1.3, z: lz }, r: 2.2, prompt: 'Climb the radio tower', use: () => startClimb(foot, head) });
  addInteract({ pos: { x: R.x - 2.75, y: top + 1.2, z: R.z }, r: 1.2, prio: -0.8, prompt: 'Climb down', use: () => startClimb({ ...head, face: Math.PI / 2 }, foot) });
  // Gazerbeam's visor wired into the mast
  const vp = new THREE.Vector3(R.x - 0.95, top + 1.7, R.z + 0.2);
  const vis = new THREE.Group(); vis.position.copy(vp); vis.rotation.y = -Math.PI / 2; scene.add(vis);
  const visor = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 0xa01810, emissive: 0xff2a10, emissiveIntensity: 2.4, roughness: 0.2 }));
  visor.rotation.z = Math.PI; vis.add(visor);
  const boxT = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.16), M.darkMetal); boxT.position.set(0, -0.25, -0.05); vis.add(boxT);
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 4), M.black); wire.position.set(0.12, 0.4, -0.1); wire.rotation.z = 0.3; vis.add(wire);
  ANIM.push((dt, t) => { visor.material.emissiveIntensity = 1.5 + 2.5 * Math.max(0, Math.sin(t * 5)); });
  addLight(vp.x - 0.4, vp.y, vp.z, 0xff3018, 6, 6, { flicker: 2 });
  W2.visor = vis;
  W2.visorScan = addScannable({ kind: 'clue', label: 'Signal source', pos: () => vp, when: () => STORY.mission === 2 && !STORY.flags.visorTaken, analyze: { time: 1.0, done: () => { STORY.flags.visorScanned = true; } } });
  addInteract({ pos: vp, r: 2.6, prio: 1.5, when: () => STORY.mission === 2 && !STORY.flags.visorTaken, prompt: "Pull out Gazerbeam's visor", use: () => { STORY.flags.visorTaken = true; vis.visible = false; sfx('spark'); sparkBurst(vp.x, vp.y, vp.z, 14); } });
  W2.visorPos = vp;
  for (let i = 0; i < 2; i++) addThrowable('crate', R.x + 6 + i * 1.3, y, R.z - 3 + i * 0.4);
  addThrowable('drum', R.x + 5, y, R.z + 4.5);
}

// ============================================================ Gazerbeam's scorch marks from radio hill to the cave
function scorchTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const gr = g.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(0.55, 'rgba(10,6,4,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 6;
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + rr(-0.2, 0.2); g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.cos(a) * rr(70, 120), h / 2 + Math.sin(a) * rr(70, 120)); g.stroke(); }
  }, { clamp: true });
}
// a small grid laid over the terrain so decals hug slopes
function terrainDecal(x, z, size, mat, lift = 0.06, rot = 0) {
  const g = new THREE.PlaneGeometry(size, size, 8, 8).rotateX(-Math.PI / 2).rotateY(rot);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, terrainHeight(x + p.getX(i), z + p.getZ(i)) + lift);
  const m = new THREE.Mesh(g, mat); m.position.set(x, 0, z); m.renderOrder = 2; scene.add(m);
  return m;
}
function buildScorchTrail() {
  const a = POI.caveA, mouth = fromV(199, a), R = POI.radio;
  const start = { x: R.x + 8, z: R.z + 7 };
  const tex = scorchTex();
  const darkMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.6, color: 0x000000 });
  const N = 7;
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
    const jx = Math.sin(i * 2.3) * 5 * (1 - f), jz = Math.cos(i * 1.7) * 5 * (1 - f);
    const x = lerp(start.x, mouth.x, f) + jx, z = lerp(start.z, mouth.z, f) + jz;
    terrainDecal(x, z, 2.8, darkMat, 0.05, rr(0, TAU));
    terrainDecal(x, z, 3.4, scanOnlyMaterial(0xff7a2a, 1.3), 0.12, 0);
    const p = new THREE.Vector3(x, terrainHeight(x, z) + 0.4, z);
    const sc = addScannable({ kind: 'clue', label: 'Scorch mark', pos: () => p, when: () => STORY.mission === 3, analyze: { time: 0.45, done: () => { STORY.flags['scorch' + i] = true; } } });
    W2.scorch.push({ p, sc, i });
  }
  // the last burn is a long gash beside the cave mouth
  const gash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3.2), scanOnlyMaterial(0xff7a2a, 1.6));
  const gp = fromV(197.4, a + 0.012);
  gash.position.set(gp.x, POI.caveY + 2.2, gp.z); gash.rotation.y = Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI / 2; gash.rotation.z = 0.5; scene.add(gash);
}

// ============================================================ the outpost by the gate: huts, crates, drums, a radar
function buildOutpost() {
  const cx = -24, cz = POI.plaza.z + 10;
  const y = terrainHeight(cx, cz);
  const hut = (x, z, ry) => {
    const hy = terrainHeight(x, z) - 0.2;
    box(5, 3, 3.6, M.concreteDark, x, hy, z, { ry, collide: true, cast: true, uvScale: 3 });
    box(5.4, 0.2, 4, M.darkMetal, x, hy + 3, z, { ry, cast: true });
    const d = mesh(new THREE.PlaneGeometry(1.1, 2.1), M.black, x + Math.sin(ry) * 1.82, hy + 1.05, z + Math.cos(ry) * 1.82, scene, { ry });
    void d;
    const lampG = mesh(new THREE.SphereGeometry(0.12, 8, 6), M.amberGlow, x + Math.sin(ry) * 1.9 + Math.cos(ry) * 1, hy + 2.4, z + Math.cos(ry) * 1.9 - Math.sin(ry) * 1);
    void lampG;
    addLight(x + Math.sin(ry) * 2.4, hy + 2.4, z + Math.cos(ry) * 2.4, 0xffb060, 16, 10, { lamp: true });
  };
  hut(cx - 4, cz - 3, 0.5); hut(cx + 3, cz + 6, -2.4);
  // sandbag walls
  const bagGeo = new THREE.CapsuleGeometry(0.22, 0.45, 3, 8).rotateZ(Math.PI / 2);
  const bags = new THREE.InstancedMesh(bagGeo, new THREE.MeshStandardMaterial({ color: 0x7a6c52, roughness: 0.95 }), 60);
  let n = 0;
  for (const [x0, z0, ry, len] of [[cx + 7, cz - 4, 0.3, 7], [cx - 9, cz + 6, 1.4, 6]]) {
    for (let row = 0; row < 3; row++) for (let k = 0; k < len && n < 60; k++) {
      const off = (k - len / 2) * 0.86 + (row % 2) * 0.4;
      const x = x0 + Math.cos(ry) * off, z = z0 - Math.sin(ry) * off;
      _q.setFromEuler(_e.set(0, ry, 0)); _m4.compose(_v.set(x, terrainHeight(x, z) + 0.22 + row * 0.4, z), _q, _s.set(1, 1, 1)); bags.setMatrixAt(n++, _m4);
    }
    addBoxObs(x0, z0, len * 0.45, 0.35, -ry, terrainHeight(x0, z0) - 1, terrainHeight(x0, z0) + 1.2);
  }
  bags.count = n; bags.castShadow = true; bags.receiveShadow = true; scene.add(bags);
  // rotating radar dish
  const rx = cx + 8, rz = cz + 4, ry0 = terrainHeight(rx, rz);
  cyl(0.15, 0.25, 6, M.darkMetal, rx, ry0, rz, { seg: 8, collide: true });
  const dish = new THREE.Group(); dish.position.set(rx, ry0 + 6.2, rz); scene.add(dish);
  const dm = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 10, 0, TAU, 0, 0.9), M.white.clone()); dm.material.side = THREE.DoubleSide; dm.rotation.x = -Math.PI / 2 + 0.3; dish.add(dm);
  ANIM.push((dt) => { dish.rotation.y += dt * (WORLD.awake ? 1.4 : 0.2); });
  secCam(cx + 8, ry0 + 4.6, rz + 0.3, Math.PI * 0.9, null, { range: 22, sweep: 0.9, pitch: -0.3 });
  for (let i = 0; i < 4; i++) addThrowable('crate', cx + rr(-6, 6), y, cz + rr(-2, 3));
  for (let i = 0; i < 4; i++) addThrowable('drum', cx + 5 + rr(-1.5, 1.5), y, cz - 1 + i * 1.1);
  // a log on the hut table
  addInteract({ pos: { x: cx - 4 + Math.sin(0.5) * 2.2, y: terrainHeight(cx - 4, cz - 3) + 1.4, z: cz - 3 + Math.cos(0.5) * 2.2 }, r: 2.4, prompt: 'Read the duty roster', use: () => openLog('outpost') });
  // more to throw around the island
  const B = POI.battery, yb = terrainHeight(B.x, B.z);
  for (let i = 0; i < 3; i++) addThrowable('drum', B.x + 6 + i * 1.1, yb, B.z + 5);
  for (let i = 0; i < 2; i++) addThrowable('crate', B.x - 5, yb, B.z + 6 + i * 1.3);
  const pv = POI.pavilion;
  for (let i = 0; i < 2; i++) addThrowable('crate', pv.x + 6 + i * 1.2, terrainHeight(pv.x, pv.z), pv.z - 5);
  for (const [bx, bz] of [[POI.J1.x + 6, POI.J1.z - 8], [POI.J1.x - 7, POI.J1.z + 5], [POI.omni.x + 14, POI.omni.z - 4], [POI.pool.x + 9, POI.pool.z + 12], [-160, 40], [-180, 0]]) addThrowable('boulder', bx, terrainHeight(bx, bz), bz);
  for (let i = 0; i < 6; i++) { const p = fromV(30.5, i / 6 * TAU + 0.3); if (Math.abs(terrainHeight(p.x, p.z) - CRATER_Y) < 1.5) addThrowable('boulder', p.x, CRATER_Y, p.z); }
}
// cameras along the jungle trail ("Still running")
function buildJungleSecurity() {
  const J = POI.J1;
  for (const [x, z, yaw] of [[J.x - 5, J.z - 14, 2.6], [POI.pool.x + 22, POI.pool.z + 24, -2.2]]) {
    const y = terrainHeight(x, z);
    cyl(0.08, 0.1, 4.2, M.darkMetal, x, y, z, { seg: 6, collide: true });
    secCam(x, y + 4.3, z, yaw, null, { range: 20, sweep: 0.8, pitch: -0.32 });
  }
  W2.firstCam = { x: J.x - 5, z: J.z - 14 };
}

// ============================================================ echo shards: ten voices kept by the mountain
const SHARDS = [];
function shardTex() {
  return canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(200,160,255,0.6)'); gr.addColorStop(1, 'rgba(120,60,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { clamp: true });
}
function buildEchoShards() {
  const tex = shardTex();
  const geo = new THREE.OctahedronGeometry(0.3, 0); geo.scale(1, 1.7, 1);
  const Y = BASE_Y, pv = POI.pavilion, o = POI.out, b = POI.battery, ll = POI.lavaLook, R = POI.radio;
  const spots = [
    ['e_univ', pv.x - o.x * 7, null, pv.z - o.z * 7],
    ['e_psyc', POI.omni.x + 9, null, POI.omni.z - 9],
    ['e_storm', R.x + 2.6, W2.towerTop + 1.2, R.z],
    ['e_down', b.x - 9, null, b.z - 6],
    ['e_blaze', ll.x + 1.5, null, ll.z - 2.5],
    ['e_gamma', -43, Y + 1.3, -6.3],
    ['e_vect', POI.rimStation.x + Math.sin(POI.rimStation.yaw) * -2, POI.rimStation.y + 1.3, POI.rimStation.z + Math.cos(POI.rimStation.yaw) * -2],
    ['e_phyl', POI.caveChamber.x, POI.caveChamber.y + 1.4, POI.caveChamber.z],
    ['e_hyper', 13.5, Y + 5.6, -70.5],
    ['e_macro', -50.6, Y + 8.6, -49],
  ];
  for (const [id, x, y0, z] of spots) {
    const y = y0 != null ? y0 : terrainHeight(x, z) + 1.4;
    const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a1840, emissive: 0xb07cff, emissiveIntensity: 0.8, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.9 });
    const m = new THREE.Mesh(geo, mat); g.add(m);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xc49bff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.25, fog: false }));
    halo.scale.setScalar(2.2); g.add(halo);
    const s = { id, g, m, mat, halo, x, y, z, got: false, ph: rr(0, 6) };
    s.sc = addScannable({ kind: 'shard', label: 'Echo shard', pos: () => g.position, when: () => !s.got && STORY.mission >= 3 });
    SHARDS.push(s);
  }
}
function updateShards(dt, t) {
  const show = STORY.mission >= 3;
  for (const s of SHARDS) {
    s.g.visible = show && !s.got;
    if (!s.g.visible) continue;
    s.g.position.y = s.y + Math.sin(t * 1.6 + s.ph) * 0.15;
    s.m.rotation.y += dt * 1.4;
    const near = Math.hypot(P.x - s.x, P.z - s.z);
    s.mat.emissiveIntensity = 0.8 + SCAN.k * 5 + (near < 6 ? 1.5 : 0);
    s.halo.material.opacity = 0.18 + SCAN.k * 0.7;
    if (GAME.mode === 'play' && near < 1.5 && Math.abs(P.y + 1 - s.g.position.y) < 2) collectShard(s);
  }
}
function collectShard(s) {
  s.got = true; s.sc.done = true;
  STORY.shards.add(s.id);
  sfx('shard');
  sparkBurst(s.x, s.y, s.z, 24, 0xc49bff);
  const n = STORY.shards.size;
  const up = { 3: ['Upgrade: Titan strength', 'Punches and slams hit twice as hard.'], 6: ['Upgrade: Iron hide', 'You can take far more punishment.'], 9: ['Upgrade: Wide scan', 'The scanner reaches much further.'] }[n];
  toast(`Echo shard ${n} of ${SHARDS.length}`, up ? up[0] : 'A voice kept by the mountain', up ? up[1] : '');
  if (up) { sfx('heal'); applyUpgrades(); }
  if (!DLG.cur || !DLG.cur.story) talk([s.id]); else DLG.queue.push({ id: s.id, who: 'echo', text: LINES[s.id][1], fx: 'echo', story: false });
  if (n === 2) setTimeout(() => bark('meg_shard'), 4500);
  if (n === SHARDS.length) setTimeout(() => toast('All ten echoes', 'Every voice is safe', 'Somebody remembers them now.'), 6000);
  saveGame();
}
function applyUpgrades() {
  const n = STORY.shards.size;
  STORY.upgrades = n >= 9 ? 3 : n >= 6 ? 2 : n >= 3 ? 1 : 0;
  HERO.power = (STORY.upgrades >= 1 ? 2 : 1) * (DEV.allPowers ? 1.5 : 1);
  HERO.maxHp = STORY.upgrades >= 2 ? 160 : 100;
  HERO.hp = Math.min(HERO.hp, HERO.maxHp);
}

// ============================================================ breakable walls (the scanner shows the cracks)
function crackTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(10,8,6,0.9)'; g.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      let x = w / 2 + rr(-40, 40), y = h / 2 + rr(-40, 40); g.lineWidth = rr(3, 7); g.beginPath(); g.moveTo(x, y);
      const a0 = rr(0, TAU);
      for (let i = 0; i < 9; i++) { x += Math.cos(a0 + rr(-0.6, 0.6)) * rr(18, 40); y += Math.sin(a0 + rr(-0.6, 0.6)) * rr(18, 40); g.lineTo(x, y); }
      g.stroke();
    }
  }, { clamp: true });
}
let _crackTex = null;
function addBreakable(o) {
  _crackTex = _crackTex || crackTex();
  const m = box(o.w, o.h, o.d, o.mat || M.concreteDark, o.x, o.y, o.z, { ry: o.yaw || 0, cast: true, uvScale: 3 });
  const crack = new THREE.Mesh(new THREE.PlaneGeometry(o.w * 0.95, o.h * 0.95), new THREE.MeshBasicMaterial({ map: _crackTex, transparent: true, depthWrite: false, opacity: 0.8 }));
  crack.position.set(0, 0, o.d / 2 + 0.01); m.add(crack);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(o.w * 0.95, o.h * 0.95), xrayMaterial(0xff9a40)); glow.position.set(0, 0, o.d / 2 + 0.03); m.add(glow);
  const obs = addBoxObs(o.x, o.z, o.w / 2, o.d / 2 + 0.05, -(o.yaw || 0), o.y, o.y + o.h);
  const b = { ...o, m, obs, height: o.h, hp: o.hp || 3, broken: false };
  const c = new THREE.Vector3(o.x, o.y + o.h / 2, o.z);
  b.hit = addHittable({ pos: () => c, radius: Math.max(o.w, o.d) / 2, reachUp: o.h, alive: () => !b.broken,
    hit: (dmg) => { b.hp -= dmg; FX.shake = Math.max(FX.shake, 0.25); burstDust(c.x, c.y - o.h / 2, c.z, 0.5, 0x8a8070); if (b.hp <= 0) breakWall(b); else sfxAt('thud', c.x, c.y, c.z); } });
  b.sc = addScannable({ kind: 'breakable', label: o.label || 'Cracked wall', pos: () => c, when: () => !b.broken });
  W2.breakables.push(b);
  return b;
}
function breakWall(b, quiet) {
  if (b.broken) return;
  b.broken = true; b.m.visible = false; b.obs.y1 = -999; b.sc.done = true;
  if (quiet) return;
  const c = b.hit.pos();
  sfxAt('explode', c.x, c.y, c.z); burstDust(c.x, c.y - b.height / 2, c.z, 1.4, 0x8a8070); FX.shake = Math.max(FX.shake, 0.6);
  spawnDebris(c.x, c.y, c.z, 10, b.mat || M.concreteDark);
  if (b.onBreak) b.onBreak();
}
function spawnDebris(x, y, z, n, mat) {
  for (let i = 0; i < n; i++) {
    const s = rr(0.2, 0.5);
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * rr(0.5, 1), s * rr(0.6, 1.2)), mat); m.position.set(x + rr(-0.6, 0.6), y + rr(-0.6, 0.6), z + rr(-0.6, 0.6)); m.castShadow = true; scene.add(m);
    const hf = heroForward();
    W2.debris.push({ m, v: new THREE.Vector3(hf.x * rr(3, 8) + rr(-3, 3), rr(2, 6), hf.z * rr(3, 8) + rr(-3, 3)), life: rr(3, 5), spin: new THREE.Vector3(rr(-6, 6), rr(-6, 6), rr(-6, 6)) });
  }
}
function updateDebris(dt) {
  for (let i = W2.debris.length - 1; i >= 0; i--) {
    const d = W2.debris[i]; d.life -= dt;
    d.v.y -= 20 * dt; d.m.position.addScaledVector(d.v, dt);
    d.m.rotation.x += d.spin.x * dt; d.m.rotation.y += d.spin.y * dt;
    const fl = findFloor(d.m.position.x, d.m.position.z, d.m.position.y + 0.5);
    if (fl && d.m.position.y < fl.y + 0.1) { d.m.position.y = fl.y + 0.1; d.v.multiplyScalar(0.4); d.v.y = Math.abs(d.v.y) * 0.3; d.spin.multiplyScalar(0.5); }
    if (d.life < 1) d.m.scale.setScalar(Math.max(d.life, 0.01));
    if (d.life <= 0) { scene.remove(d.m); d.m.geometry.dispose(); W2.debris.splice(i, 1); }
  }
}
// a sealed alcove off the door corridor, behind a cracked panel
function buildAlcove() {
  const Y = BASE_Y;
  room('alcove', -44.5, -41.5, -7.6, -4, 3.4, { wall: M.concreteDark, floor: M.concreteDark, skip: ['s'], floorOpts: { h: 3.4 } });
  addLight(-43, Y + 2.6, -6.5, 0xb07cff, 14, 7, { flicker: 2 });
  W2.alcoveWall = addBreakable({ x: -43, y: Y, z: -4.15, w: 3, h: 4, d: 0.3, label: 'Cracked panel', hp: 2 });
}

// ============================================================ holograms and people
function holoRig(color, hair, opts = {}) {
  const body = holoMaterial(color, 0.9), hairM = holoMaterial(hair, 1.4);
  const rig = buildHumanoid({ p: opts.p || { hipY: 0.95, hipW: 0.85, waist: 0.78, chest: 0.84, chestD: 0.8, shoulder: 0.85, arm: 0.78, leg: 0.88 }, scale: opts.scale || 1, noShadow: true,
    suit: body, skin: holoMaterial(color, 0.7), mask: holoMaterial(opts.maskColor || 0x8fe8ff, 1.8), cape: opts.cape ? holoMaterial(color, 0.5) : null, hair: hairM, flameHair: !!opts.flame, eyes: holoMaterial(0xffffff, 2) });
  rig.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.renderOrder = 5; } });
  return rig;
}
function buildHoloSyndrome() {
  const rig = holoRig(0x63c8ff, 0xff8a3a, { flame: true, cape: true });
  rig.root.position.set(40.5, BASE_Y + 0.78, -14); rig.root.rotation.y = -Math.PI / 2; rig.root.visible = false;
  scene.add(rig.root);
  const proj = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.3, 3.2, 20, 1, true).translate(0, 1.6, 0), beamMaterial(0x63c8ff, 0.08)); proj.position.set(40.5, BASE_Y + 0.78, -14); proj.visible = false; scene.add(proj);
  W2.syn = { rig, proj, on: 0, target: 0 };
  addLight(40.5, BASE_Y + 2.5, -14, 0x63c8ff, 30, 10, { on: () => W2.syn.on > 0.3, flicker: 2 });
}
function updateHoloSyndrome(dt, t) {
  const S = W2.syn;
  S.on = damp(S.on, S.target, 3, dt);
  const vis = S.on > 0.02;
  S.rig.root.visible = vis && (Math.random() > 0.04 || S.on > 0.95); S.proj.visible = vis;
  if (!vis) return;
  S.rig.root.scale.set(1, S.on, 1);
  const J = S.rig.J, talking = DLG.cur && DLG.cur.who === 'syndrome';
  const k = talking ? 1 : 0.25;
  J.shL.rotation.set(-0.4 - Math.sin(t * 3.1) * 0.6 * k, 0, 0.5 + Math.sin(t * 2.3) * 0.4 * k);
  J.shR.rotation.set(-0.3 - Math.sin(t * 2.7 + 1) * 0.7 * k, 0, -0.4 - Math.sin(t * 1.9) * 0.5 * k);
  J.elL.rotation.x = -0.8 - Math.sin(t * 4) * 0.4 * k; J.elR.rotation.x = -0.6;
  J.spine.rotation.set(Math.sin(t * 1.3) * 0.08, Math.sin(t * 0.9) * 0.25 * k, 0);
  J.head.rotation.set(-0.1 + Math.sin(t * 2.2) * 0.08 * k, Math.sin(t * 0.7) * 0.2, 0);
  S.rig.root.rotation.y = damp(S.rig.root.rotation.y, Math.atan2(P.x - S.rig.root.position.x, P.z - S.rig.root.position.z), 2, dt);
}
function buildGazerEcho(at) {
  const rig = holoRig(0xffd9a0, 0xfff0d0, { maskColor: 0xff3a20, p: { hipY: 0.98, hipW: 1, waist: 0.95, chest: 1.02, chestD: 0.95, shoulder: 1, arm: 1, leg: 1 } });
  const visor = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 20, Math.PI), holoMaterial(0xff3a20, 2.5)); visor.rotation.z = Math.PI; visor.position.set(0, 0.18, 0.06); rig.J.head.add(visor);
  rig.root.position.set(at.x, at.y, at.z); rig.root.visible = false; scene.add(rig.root);
  return { rig, on: 0, target: 0 };
}
function mirageRig() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const dress = std({ color: 0x141418, roughness: 0.35, metalness: 0.25, envMap: envTex, envMapIntensity: 0.6 });
  const skin = std({ color: 0xc8916a, roughness: 0.6 }), hair = std({ color: 0xf0ece4, roughness: 0.45 });
  const rig = buildHumanoid({ p: { hipY: 0.95, hipW: 0.92, waist: 0.68, chest: 0.74, chestD: 0.78, shoulder: 0.78, arm: 0.68, leg: 0.82 }, scale: 0.94,
    suit: dress, skin, hair, gloves: skin, boots: dress, eyes: std({ color: 0x4bd0ff, emissive: 0x4bd0ff, emissiveIntensity: 0.8 }) });
  const long = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.32, 4, 10), hair); long.position.set(0, 0.06, -0.08); long.scale.set(1.15, 1, 0.7); rig.J.head.add(long);
  const sweep = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), hair); sweep.position.set(0.07, 0.26, 0.09); sweep.scale.set(1.1, 0.6, 0.9); rig.J.head.add(sweep);
  rig.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return rig;
}
function buildMirage() {
  const Y = BASE_Y;
  const rig = mirageRig();
  scene.add(rig.root);
  W2.mirage = { rig, state: 'held', y: Y + 3.2, vy: 0 };
  // four field nodes on the walls
  const spots = [[-51.6, Y + 2.2, -50, Math.PI / 2], [-51.6, Y + 7.5, -66, Math.PI / 2], [-30.4, Y + 2.4, -67, -Math.PI / 2], [-41, Y + 8, -44.4, Math.PI]];
  for (const [x, y, z, ry] of spots) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.7), M.darkMetal); housing.position.z = 0.25; g.add(housing);
    const coreM = M.blueGlow.clone(); coreM.emissiveIntensity = 5;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), coreM); core.position.z = 0.7; g.add(core);
    const beam = unitRod(0.05, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.6, 4), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.castShadow = false;
    const wp = new THREE.Vector3(); core.getWorldPosition(wp);
    setRod(beam, wp, new THREE.Vector3(FIELD.x, Y + 3.2, FIELD.z));
    const n = { g, core, coreM, beam, pos: wp, hp: 2, broken: false };
    n.h = addHittable({ pos: () => n.pos, radius: 0.85, reachUp: 2.2, alive: () => !n.broken && STORY.mission === 10,
      hit: (dmg) => { n.hp -= dmg; sfxAt('metalHit', wp.x, wp.y, wp.z); sparkBurst(wp.x, wp.y, wp.z, 10, 0x8fd6ff); if (n.hp <= 0) breakNode(n); } });
    n.sc = addScannable({ kind: 'objective', label: 'Field node', pos: () => n.pos, when: () => !n.broken && STORY.mission === 10 });
    W2.nodes.push(n);
  }
  for (let i = 0; i < 2; i++) addThrowable('crate', -34 - i * 1.3, Y, -46);
}
function breakNode(n, quiet) {
  if (n.broken) return;
  n.broken = true; n.beam.visible = false; n.coreM.emissiveIntensity = 0; n.sc.done = true;
  if (!quiet) { explosion(n.pos.x, n.pos.y, n.pos.z, 1.5, 0); STORY.flags.nodes = W2.nodes.filter((q) => q.broken).length; }
}
function setFieldOn(on) {
  FIELD.on = on;
  if (FIELD.vis) for (const m of FIELD.vis) m.visible = on;
}
function updateMirage(dt, t) {
  const Mi = W2.mirage, R = Mi.rig.root, J = Mi.rig.J;
  if (Mi.state === 'held') {
    R.position.set(FIELD.x, BASE_Y + 3.2 + Math.sin(t * 0.6) * 0.15, FIELD.z); R.rotation.y = t * 0.15;
    J.shL.rotation.set(-0.2, 0, 0.9); J.shR.rotation.set(-0.2, 0, -0.9); J.elL.rotation.x = -0.3; J.elR.rotation.x = -0.3;
    J.head.rotation.x = 0.45; J.spine.rotation.x = 0.1; J.hipL.rotation.x = 0.15; J.hipR.rotation.x = -0.1; J.kneeL.rotation.x = 0.3; J.kneeR.rotation.x = 0.2;
  } else if (Mi.state === 'falling') {
    Mi.vy -= 6 * dt; Mi.y += Mi.vy * dt;
    if (Mi.y <= BASE_Y + 0.3) { Mi.y = BASE_Y + 0.3; Mi.state = 'free'; sfx('land'); }
    R.position.set(FIELD.x, Mi.y, FIELD.z);
  } else {
    R.position.set(FIELD.x, BASE_Y + 0.3, FIELD.z);
    const want = Math.atan2(P.x - FIELD.x, P.z - FIELD.z);
    R.rotation.y += wrapAngle(want - R.rotation.y) * (1 - Math.exp(-dt * 2));
    const talking = DLG.cur && DLG.cur.who === 'mirage' && !DLG.cur.fx;
    const br = Math.sin(t * 1.5) * 0.02;
    J.shL.rotation.set(talking ? -0.3 + Math.sin(t * 2) * 0.15 : 0.05, 0, 0.12); J.shR.rotation.set(0.05, 0, -0.18 + br); J.elL.rotation.x = talking ? -1.1 : -0.15; J.elR.rotation.x = -0.15;
    J.head.rotation.set(-0.05 + br, Math.sin(t * 0.4) * 0.1, 0); J.spine.rotation.x = br; J.hipL.rotation.x = 0; J.hipR.rotation.x = 0; J.kneeL.rotation.x = 0; J.kneeR.rotation.x = 0.06;
  }
}

// ============================================================ the geothermal plant: three overloaded valves
function buildValves() {
  const Y = BASE_Y;
  for (const [x, z, ry] of [[47, -63.3, 0], [59.3, -50, -Math.PI / 2], [75.3, -46, -Math.PI / 2]]) {
    const g = new THREE.Group(); g.position.set(x, Y, z); g.rotation.y = ry; scene.add(g);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 3.2, 16), M.darkMetal); pipe.position.y = 1.6; pipe.castShadow = true; g.add(pipe);
    for (const yy of [0.5, 2.7]) { const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 16), M.metal); fl.position.y = yy; g.add(fl); }
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 8, 24), M.red); wheel.position.set(0, 1.8, 0.62); g.add(wheel);
    for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.05), M.red); sp.rotation.z = k / 3 * Math.PI; wheel.add(sp); }
    const gaugeM = M.redGlow.clone();
    const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.22, 18), gaugeM); gauge.position.set(0, 2.5, 0.43); g.add(gauge);
    addCircleObs(x, z, 0.45, Y, Y + 3.2);
    const v = { g, wheel, gaugeM, x, z, hp: 3, broken: false, pos: new THREE.Vector3(x, Y + 1.8, z) };
    v.h = addHittable({ pos: () => v.pos, radius: 0.6, reachUp: 1.6, slammable: true, alive: () => !v.broken && STORY.mission === 7,
      hit: (dmg) => { v.hp -= dmg; sfxAt('metalHit', x, Y + 1.8, z); sparkBurst(x, Y + 1.8, z, 10); v.wheel.rotation.z += 0.8; if (v.hp <= 0) breakValve(v); } });
    v.sc = addScannable({ kind: 'objective', label: 'Overloaded valve', pos: () => v.pos, when: () => !v.broken && STORY.mission === 7 });
    W2.valves.push(v);
  }
  for (let i = 0; i < 2; i++) addThrowable('drum', 42 + i * 1.1, Y, -38);
}
function breakValve(v, quiet) {
  if (v.broken) return;
  v.broken = true; v.sc.done = true; v.gaugeM.emissive.set(0x3dff8a); v.gaugeM.emissiveIntensity = 3; v.wheel.visible = false;
  if (quiet) return;
  sfxAt('explode', v.x, BASE_Y + 1.8, v.z);
  for (let i = 0; i < 14; i++) FX.smoke.spawn({ x: v.x + rr(-0.4, 0.4), y: BASE_Y + 2, z: v.z + rr(-0.4, 0.4), vx: rr(-3, 3), vy: rr(3, 7), vz: rr(-3, 3), drag: 1.2, s0: 1, s1: rr(5, 8), a: 0.35, life: rr(2, 3.5), top: [0.5, 0.5, 0.52], bot: [0.6, 0.6, 0.62] });
  FX.shake = Math.max(FX.shake, 0.5);
  STORY.flags.valves = W2.valves.filter((q) => q.broken).length;
}
function updateValves(dt) {
  if (STORY.mission !== 7) return;
  for (const v of W2.valves) {
    if (v.broken || Math.random() > dt * 12) continue;
    FX.smoke.spawn({ x: v.x + rr(-0.2, 0.2), y: BASE_Y + 3.2, z: v.z + rr(-0.2, 0.2), vx: rr(-0.6, 0.6), vy: rr(3, 5), vz: rr(-0.6, 0.6), drag: 0.8, s0: 0.5, s1: rr(3, 5), a: 0.22, life: rr(1.2, 2.2), top: [0.5, 0.5, 0.52], bot: [0.55, 0.55, 0.57] });
  }
}

// ============================================================ the proving ground boss: Omnidroid v.9 rebuilt
const OMNI = { state: 'off', hp: 10, maxHp: 10, t: 0, pos: new THREE.Vector3(11, BASE_Y, VZ - 8), yaw: 0, h: 4.6, legs: [], locks: 0 };
function buildOmniBoss() {
  const g = new THREE.Group(); scene.add(g); g.visible = false;
  const bodyM = M.black.clone();
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.4, 36, 24), bodyM); body.castShadow = true; g.add(body);
  const band = new THREE.Mesh(new THREE.TorusGeometry(2.42, 0.16, 8, 48), M.darkMetal); band.rotation.x = Math.PI / 2; g.add(band);
  const eyeM = M.redGlow.clone();
  const eyes = new THREE.Mesh(new THREE.TorusGeometry(2.38, 0.12, 6, 40, 1.4), eyeM); eyes.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 0.7 + Math.PI); eyes.position.y = 0.55; g.add(eyes);
  const coreM = M.lavaGlow.clone(); coreM.emissiveIntensity = 0.3;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 12), coreM); core.position.y = -2.0; g.add(core);
  const stencil = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.5), new THREE.MeshBasicMaterial({ map: textTex([{ text: 'v.9', color: '#e9e5db' }], { w: 256, h: 64, size: 48 }), transparent: true })); stencil.position.set(0, 0.9, 2.3); g.add(stencil);
  for (let i = 0; i < 4; i++) {
    const up = unitRod(0.26, M.black), low = unitRod(0.2, M.black);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), M.darkMetal); scene.add(knee);
    up.visible = low.visible = knee.visible = false;
    const a = i / 4 * TAU + Math.PI / 4;
    OMNI.legs.push({ up, low, knee, a, foot: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), hip: new THREE.Vector3(), mid: new THREE.Vector3(), step: 0 });
  }
  Object.assign(OMNI, { g, body, core, coreM, eyeM, bodyM });
  OMNI.hit = addHittable({ pos: () => _hv2.set(OMNI.pos.x, OMNI.pos.y + OMNI.h, OMNI.pos.z), radius: 2.6, reachUp: 3.2, slammable: true, noSplash: false, alive: () => OMNI.state !== 'off' && OMNI.state !== 'dead' && OMNI.state !== 'intro',
    hit: (dmg, dir, kind) => damageOmni(dmg, kind) });
  OMNI.sc = addScannable({ kind: 'enemy', label: 'Omnidroid v.9', pos: () => _hv3.set(OMNI.pos.x, OMNI.pos.y + OMNI.h, OMNI.pos.z), when: () => OMNI.state !== 'off' && OMNI.state !== 'dead' });
  OMNI.coreSc = addScannable({ kind: 'clue', label: 'Weak point: core (wait for a stomp)', pos: () => _hv4.set(OMNI.pos.x, OMNI.pos.y + OMNI.h - 2, OMNI.pos.z), when: () => OMNI.state === 'walk' || OMNI.state === 'shoot' });
}
const _hv2 = new THREE.Vector3(), _hv3 = new THREE.Vector3(), _hv4 = new THREE.Vector3();
function omniShow(on) {
  OMNI.g.visible = on;
  for (const L of OMNI.legs) L.up.visible = L.low.visible = L.knee.visible = on;
  if (SILO.scrap) SILO.scrap.visible = !on && OMNI.state !== 'dead';
  if (SILO.scrapObs) SILO.scrapObs.y1 = on || OMNI.state === 'dead' ? -999 : BASE_Y + 4;
}
function startOmni() {
  OMNI.state = 'intro'; OMNI.t = 0; OMNI.hp = OMNI.maxHp; OMNI.locks = 0;
  OMNI.pos.set(11, BASE_Y, VZ - 8); OMNI.h = 0.5; OMNI.yaw = Math.atan2(P.x - 11, P.z - (VZ - 8));
  omniShow(true);
  for (const L of OMNI.legs) { L.foot.set(OMNI.pos.x + Math.cos(L.a) * 6, BASE_Y, OMNI.pos.z + Math.sin(L.a) * 6); L.step = 0; }
  sfx('power'); FX.shake = 1.2;
  STORY.boss = { name: 'OMNIDROID v.9', hp: () => OMNI.hp / OMNI.maxHp };
}
function damageOmni(dmg, kind) {
  if (OMNI.state !== 'locked') {
    sfxAt('metalHit', OMNI.pos.x, OMNI.pos.y + OMNI.h, OMNI.pos.z); sparkBurst(OMNI.pos.x, OMNI.pos.y + OMNI.h, OMNI.pos.z, 8);
    if (!OMNI.armorNote) { OMNI.armorNote = true; note('The armor is too thick. Wait for it to stomp, then hit the glowing core.', 5); }
    return;
  }
  OMNI.hp -= dmg; OMNI.flash = 0.15;
  sfxAt('punchHeavy', OMNI.pos.x, OMNI.pos.y + 2, OMNI.pos.z);
  if (OMNI.hp <= 0) killOmni();
}
function killOmni() {
  OMNI.state = 'dead'; STORY.boss = null; findSecret('prototype');
  const p = OMNI.pos;
  explosion(p.x, p.y + 3, p.z, 6, 0);
  setTimeout(() => explosion(p.x + 2, p.y + 1, p.z - 1, 4, 0), 350);
  setTimeout(() => { explosion(p.x - 1, p.y + 2, p.z + 2, 5, 0); omniShow(false); spawnDebris(p.x, p.y + 3, p.z, 16, M.black); }, 800);
  hitStop(0.2);
}
function updateOmni(dt, t) {
  if (OMNI.state === 'off' || OMNI.state === 'dead') return;
  OMNI.t += dt;
  const p = OMNI.pos, playing = GAME.mode === 'play';
  const dx = P.x - p.x, dz = P.z - p.z, dist = Math.hypot(dx, dz);
  const wantYaw = Math.atan2(dx, dz);
  let hTarget = 4.6, speed = 0;
  switch (OMNI.state) {
    case 'intro': hTarget = 4.6; if (OMNI.t > 2.5) { OMNI.state = 'walk'; OMNI.t = 0; } break;
    case 'walk':
      speed = dist > 8 ? 3.2 : 0;
      OMNI.yaw += wrapAngle(wantYaw - OMNI.yaw) * (1 - Math.exp(-dt * 1.5));
      if (OMNI.t > 4.5 && playing) { OMNI.state = dist < 13 ? 'windup' : 'shoot'; OMNI.t = 0; OMNI.shots = 0; }
      break;
    case 'shoot':
      OMNI.yaw += wrapAngle(wantYaw - OMNI.yaw) * (1 - Math.exp(-dt * 3));
      if (OMNI.t > 0.6 + OMNI.shots * 0.45 && OMNI.shots < 5) {
        OMNI.shots++;
        const from = new THREE.Vector3(p.x + Math.sin(OMNI.yaw) * 2.4, p.y + OMNI.h + 0.5, p.z + Math.cos(OMNI.yaw) * 2.4);
        fireShot(from, new THREE.Vector3(P.x + P.vx * 0.3, P.y + 1.2, P.z + P.vz * 0.3), 28, 9);
      }
      if (OMNI.t > 3.4) { OMNI.state = 'windup'; OMNI.t = 0; }
      break;
    case 'windup': hTarget = 6.4; if (OMNI.t > 0.9) { OMNI.state = 'slam'; OMNI.t = 0; } break;
    case 'slam':
      hTarget = 2.2;
      if (OMNI.t > 0.12 && !OMNI.slammed) {
        OMNI.slammed = true;
        shockRing(p.x, BASE_Y + 0.15, p.z, 9); FX.shake = Math.max(FX.shake, 0.9); sfxAt('slam', p.x, p.y, p.z); burstDust(p.x, BASE_Y, p.z, 2.2);
        if (playing && P.grounded && dist < 9.5) { hurtHero(18, p); P.vy = 7; P.grounded = false; }
      }
      if (OMNI.t > 0.4) { OMNI.state = 'locked'; OMNI.t = 0; OMNI.slammed = false; OMNI.locks++; if (OMNI.locks === 1) talk(['m9_04']); }
      break;
    case 'locked': hTarget = 2.2; if (OMNI.t > 3.8) { OMNI.state = 'walk'; OMNI.t = 0; sfxAt('servo', p.x, p.y, p.z); } break;
  }
  // move, staying inside the silo
  if (speed > 0) { p.x += Math.sin(OMNI.yaw) * speed * dt; p.z += Math.cos(OMNI.yaw) * speed * dt; }
  const r = Math.hypot(p.x - VX, p.z - VZ); if (r > SILO_R - 4) { p.x = VX + (p.x - VX) / r * (SILO_R - 4); p.z = VZ + (p.z - VZ) / r * (SILO_R - 4); }
  OMNI.h = damp(OMNI.h, hTarget, OMNI.state === 'slam' ? 25 : 3, dt);
  OMNI.g.position.set(p.x, p.y + OMNI.h + (OMNI.state === 'walk' ? Math.sin(t * 6) * 0.08 : 0), p.z);
  OMNI.g.rotation.y = OMNI.yaw;
  const locked = OMNI.state === 'locked';
  OMNI.coreM.emissiveIntensity = locked ? 6 + Math.sin(t * 12) * 2 : 0.3;
  OMNI.eyeM.emissiveIntensity = (OMNI.flash > 0 ? 14 : locked ? 1 : 6);
  OMNI.flash = Math.max(0, (OMNI.flash || 0) - dt);
  OMNI.bodyM.emissive.setRGB(OMNI.flash > 0 ? 0.6 : 0, OMNI.flash > 0 ? 0.2 : 0, 0);
  // legs: feet step when they lag behind
  let stepping = OMNI.legs.some((L) => L.step > 0);
  OMNI.legs.forEach((L, i) => {
    const ha = L.a + OMNI.yaw;
    const home = _v.set(p.x + Math.sin(ha) * (locked ? 7.5 : 6), BASE_Y, p.z + Math.cos(ha) * (locked ? 7.5 : 6));
    if (L.step > 0) {
      L.step = Math.min(1, L.step + dt / 0.35);
      L.foot.lerpVectors(L.from, L.to, L.step); L.foot.y = BASE_Y + Math.sin(L.step * Math.PI) * 1.4;
      if (L.step >= 1) { L.step = 0; L.foot.y = BASE_Y; sfxAt('clank', L.foot.x, L.foot.y, L.foot.z); }
    } else if (!stepping && L.foot.distanceTo(home) > 2.2) { L.from.copy(L.foot); L.to.copy(home); L.step = 0.001; stepping = true; }
    L.hip.set(p.x + Math.sin(ha) * 2.1, OMNI.g.position.y - 0.3, p.z + Math.cos(ha) * 2.1);
    L.mid.lerpVectors(L.hip, L.foot, 0.5); L.mid.y += 3.2;
    L.knee.position.copy(L.mid);
    setRod(L.up, L.hip, L.mid); setRod(L.low, L.mid, L.foot);
    void i;
  });
}

// ============================================================ under the launch pad: the old shaft and the Heart of the Mountain
function glyphTex(kind, lit) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = lit ? '#1c1030' : '#2a2622'; g.fillRect(0, 0, w, h);
    g.strokeStyle = lit ? '#c9a8ff' : '#5c554c'; g.fillStyle = g.strokeStyle; g.lineWidth = 12; g.lineCap = 'round';
    const c = w / 2;
    if (kind === 'sun') { g.beginPath(); g.arc(c, c, 42, 0, TAU); g.stroke(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; g.beginPath(); g.moveTo(c + Math.cos(a) * 62, c + Math.sin(a) * 62); g.lineTo(c + Math.cos(a) * 92, c + Math.sin(a) * 92); g.stroke(); } }
    if (kind === 'wave') { for (let r = 0; r < 3; r++) { g.beginPath(); for (let x = 30; x <= 226; x += 4) { const y = 80 + r * 46 + Math.sin(x / 22) * 16; if (x === 30) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); } }
    if (kind === 'eye') { g.beginPath(); g.moveTo(26, c); g.quadraticCurveTo(c, 40, 230, c); g.quadraticCurveTo(c, 216, 26, c); g.stroke(); g.beginPath(); g.arc(c, c, 26, 0, TAU); g.fill(); }
  }, { clamp: true });
}
function muralTex() {
  return canvasTex(2048, 256, (g, w, h) => {
    g.fillStyle = '#26221f'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1500, ['#1d1a18', '#302b27', '#3a342e'], 1, 4, 0.7);
    g.strokeStyle = '#8a7a64'; g.fillStyle = '#8a7a64'; g.lineWidth = 7; g.lineCap = 'round';
    const fig = (x, raise) => { g.beginPath(); g.arc(x, 70, 14, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(x, 84); g.lineTo(x, 150); g.moveTo(x, 150); g.lineTo(x - 18, 200); g.moveTo(x, 150); g.lineTo(x + 18, 200); g.moveTo(x, 104); g.lineTo(x - 26, raise ? 70 : 130); g.moveTo(x, 104); g.lineTo(x + 26, raise ? 70 : 130); g.stroke(); };
    const sym = (x, kind) => { g.save(); g.translate(x - 60, 40); g.scale(0.7, 0.7); const t = glyphTex(kind, false).image; g.drawImage(t, 0, 0); g.restore(); };
    for (let k = 0; k < 2; k++) {
      const o = k * 1024;
      fig(o + 80, true); fig(o + 150, false); fig(o + 220, true);
      sym(o + 360, 'sun'); g.beginPath(); g.moveTo(o + 430, 128); g.lineTo(o + 470, 128); g.stroke();
      sym(o + 560, 'wave'); g.beginPath(); g.moveTo(o + 630, 128); g.lineTo(o + 670, 128); g.stroke();
      sym(o + 760, 'eye');
      g.beginPath(); g.moveTo(o + 860, 220); g.lineTo(o + 920, 60); g.lineTo(o + 980, 220); g.closePath(); g.stroke();
      g.setLineDash([4, 16]); g.beginPath(); g.moveTo(o + 990, 128); g.lineTo(o + 1020, 128); g.stroke(); g.setLineDash([]);
    }
  });
}
function buildHeartCavern() {
  const Hc = HEART, y0 = Hc.y, R = Hc.r;
  // floor and dome
  const fl = new THREE.Mesh(new THREE.CircleGeometry(R + 1, 72).rotateX(-Math.PI / 2), M.rockDark); fl.position.set(Hc.x, y0 - 0.02, Hc.z); fl.receiveShadow = true; scene.add(fl);
  floorCircle(Hc.x, Hc.z, R - 1.2, y0, { indoor: true, room: 'heart', kind: 'rock', h: 26 });
  let dome = new THREE.SphereGeometry(R + 0.5, 72, 28, 0, TAU, 0, Math.PI / 2);
  dome.scale(1, 0.82, 1);
  { const p = dome.attributes.position; for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); const n = 1 + 0.07 * noise3(_v.x * 0.12, _v.y * 0.12, _v.z * 0.12); p.setXYZ(i, _v.x * n, _v.y * n, _v.z * n); } }
  dome = dome.toNonIndexed();
  { // cut the hole where the shaft comes through
    const p = dome.attributes.position, keep = [];
    const sx = GRATE.x - Hc.x, sz = GRATE.z - Hc.z;
    for (let i = 0; i < p.count; i += 3) {
      let cx = 0, cz = 0; for (let k = 0; k < 3; k++) { cx += p.getX(i + k) / 3; cz += p.getZ(i + k) / 3; }
      if ((cx - sx) ** 2 + (cz - sz) ** 2 < (GRATE.r + 0.6) ** 2) continue;
      for (let k = 0; k < 3; k++) keep.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k));
    }
    dome = new THREE.BufferGeometry(); dome.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
    const uv = []; for (let i = 0; i < keep.length; i += 3) uv.push(keep[i] * 0.08, keep[i + 1] * 0.08 + keep[i + 2] * 0.05);
    dome.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); dome.computeVertexNormals();
  }
  const domeM = M.rockDark.clone(); domeM.side = THREE.BackSide;
  mesh(dome, domeM, Hc.x, y0, Hc.z);
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; addCircleObs(Hc.x + Math.cos(a) * (R - 0.2), Hc.z + Math.sin(a) * (R - 0.2), 1.6, y0 - 1, y0 + 20); }
  // the shaft from the silo floor down through the dome
  const shaftTop = BASE_Y, shaftBot = y0 + 0.82 * Math.sqrt(Math.max(0, R * R - (GRATE.x - Hc.x) ** 2 - (GRATE.z - Hc.z) ** 2)) - 1;
  const sm = M.rockDark.clone(); sm.side = THREE.BackSide;
  cyl(GRATE.r + 0.2, GRATE.r + 0.6, shaftTop - shaftBot, sm, GRATE.x, shaftBot, GRATE.z, { seg: 20, open: true });
  CAM_VOLUMES.push({ x: GRATE.x, z: GRATE.z, r: GRATE.r, y0: shaftBot - 2, y1: shaftTop + 2 });
  // once the volcano erupts, hot air roars up the shaft and the whole silo
  UPDRAFTS.push({ x: GRATE.x, z: GRATE.z, r: 3.2, y0: HEART.y - 1, y1: BASE_Y + 5, power: 36, on: () => STORY.flags.updraft });
  UPDRAFTS.push({ x: VX, z: VZ, r: SILO_R - 0.5, y0: BASE_Y - 2, y1: CRATER_Y + 24, power: 30, on: () => STORY.flags.updraft });
  // crystals around the walls and hanging from the dome
  const cm = new THREE.MeshStandardMaterial({ color: 0x1a0f2e, emissive: 0x8c5cff, emissiveIntensity: 1.4, roughness: 0.15, metalness: 0.1 });
  HEART.crystalMat = cm;
  const cg = new THREE.OctahedronGeometry(1, 0);
  const crys = new THREE.InstancedMesh(cg, cm, 90);
  for (let i = 0; i < 90; i++) {
    const a = rr(0, TAU), hang = i >= 60;
    const r = hang ? rr(6, R - 6) : rr(R - 6, R - 1.5);
    const x = Hc.x + Math.cos(a) * r, z = Hc.z + Math.sin(a) * r;
    if (Math.hypot(x - GRATE.x, z - GRATE.z) < 5) continue;
    const top = y0 + 0.82 * Math.sqrt(Math.max(0, R * R - r * r));
    const y = hang ? top - rr(0.5, 2) : y0 + rr(0, 1);
    _e.set(hang ? Math.PI + rr(-0.3, 0.3) : rr(-0.4, 0.4), rr(0, TAU), rr(-0.4, 0.4)); _q.setFromEuler(_e);
    const s = rr(0.4, 1.2);
    _m4.compose(_v.set(x, y, z), _q, _s.set(s, s * rr(2.2, 4), s)); crys.setMatrixAt(i, _m4);
  }
  crys.castShadow = false; scene.add(crys);
  for (const a of [0.4, 2.0, 3.6, 5.2]) addLight(Hc.x + Math.cos(a) * (R - 5), y0 + 4, Hc.z + Math.sin(a) * (R - 5), a > 3 ? 0x8c5cff : 0x4fd8ff, 70, 22, { flicker: 1 });
  // mural band
  const mt = muralTex(); mt.wrapS = THREE.RepeatWrapping; mt.repeat.set(2, 1);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R - 1.7, R - 1.7, 4.2, 96, 1, true), new THREE.MeshStandardMaterial({ map: mt, roughness: 0.95, side: THREE.BackSide, emissive: 0x3a2a60, emissiveMap: mt, emissiveIntensity: 0.25 }));
  band.position.set(Hc.x, y0 + 4.6, Hc.z); scene.add(band);
  HEART.muralMat = band.material;
  const ma = Math.atan2(GRATE.z - Hc.z, GRATE.x - Hc.x) + Math.PI;   // facing the landing spot
  const mp = new THREE.Vector3(Hc.x + Math.cos(ma) * (R - 2), y0 + 4.6, Hc.z + Math.sin(ma) * (R - 2));
  HEART.mural = addScannable({ kind: 'clue', label: 'Ancient carvings', pos: () => mp, when: () => STORY.mission === 11 && STORY.flags.inHeart, analyze: { time: 1.4, done: () => { STORY.flags.mural = true; } } });
  HEART.muralPos = mp;
  // three pillars
  ['sun', 'wave', 'eye'].forEach((kind, i) => {
    const a = ma + Math.PI + (i - 1) * 1.9 + 0.5;
    const x = Hc.x + Math.cos(a) * 16, z = Hc.z + Math.sin(a) * 16;
    const pil = cyl(1.3, 1.6, 7, M.rock, x, y0, z, { seg: 8, collide: true });
    void pil;
    const offM = new THREE.MeshStandardMaterial({ map: glyphTex(kind, false), roughness: 0.9 }), onM = new THREE.MeshStandardMaterial({ map: glyphTex(kind, true), emissive: 0xffffff, emissiveMap: glyphTex(kind, true), emissiveIntensity: 1.6 });
    const face = Math.atan2(Hc.x - x, Hc.z - z);
    const plate = mesh(new THREE.PlaneGeometry(1.8, 1.8), offM, x + Math.sin(face) * 1.42, y0 + 3.2, z + Math.cos(face) * 1.42, scene, { ry: face });
    const capM = cm.clone(); capM.emissiveIntensity = 0.3;
    const cap = mesh(new THREE.OctahedronGeometry(0.7, 0), capM, x, y0 + 7.8, z); cap.scale.y = 1.8;
    const p = { kind, x, z, plate, offM, onM, capM, lit: false };
    addInteract({ pos: { x: x + Math.sin(face) * 2.2, y: y0 + 1.6, z: z + Math.cos(face) * 2.2 }, r: 2.6, when: () => STORY.mission === 11 && HEART.sealed && STORY.flags.inHeart, prompt: `Press the ${kind} carving`, use: () => pressPillar(p) });
    HEART.pillars.push(p);
  });
  // the Heart itself
  const hg = new THREE.Group(); hg.position.set(Hc.x, y0, Hc.z); scene.add(hg);
  cyl(4.2, 4.8, 0.8, M.rock, Hc.x, y0, Hc.z, { seg: 10 });
  floorCircle(Hc.x, Hc.z, 4.6, y0 + 0.8, { indoor: true, room: 'heart', kind: 'rock', h: 25 });
  const heartM = new THREE.MeshStandardMaterial({ color: 0x20304a, emissive: 0x9fe8ff, emissiveIntensity: 1.2, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.92 });
  HEART.mat = heartM;
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * TAU, big = i === 0;
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(big ? 1.4 : rr(0.6, 1), 0), heartM);
    c.position.set(big ? 0 : Math.cos(a) * rr(1, 2.2), 0.8 + (big ? 2.6 : rr(0.8, 1.8)), big ? 0 : Math.sin(a) * rr(1, 2.2));
    c.scale.y = big ? 2.6 : rr(1.8, 3); c.rotation.set(big ? 0 : rr(-0.5, 0.5), rr(0, TAU), big ? 0 : rr(-0.5, 0.5)); hg.add(c);
  }
  const sealM = holoMaterial(0xb07cff, 0.8);
  const seal = new THREE.Mesh(new THREE.IcosahedronGeometry(4.3, 1), sealM); seal.position.y = 3.2; hg.add(seal);
  addCircleObs(Hc.x, Hc.z, 3.2, y0, y0 + 9);
  HEART.group = hg; HEART.seal = seal;
  HEART.light = addLight(Hc.x, y0 + 4, Hc.z, 0x9fe8ff, 160, 30, { flicker: 1 });
  // the beam it sends up when it wakes
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 500, 24, 1, true).translate(0, 250, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 1.1, 1.8), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(Hc.x, y0 + 3, Hc.z); beam.visible = false; beam.frustumCulled = false; scene.add(beam);
  HEART.beam = beam;
  HEART.heartSc = addScannable({ kind: 'objective', label: 'The Heart of the Mountain', pos: () => _hv4.set(Hc.x, y0 + 4, Hc.z), when: () => STORY.mission === 11 && STORY.flags.inHeart });
  // the grate on the silo floor
  const gt = canvasTex(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#3a3936'; for (let x = 8; x < w; x += 32) g.fillRect(x, 0, 14, h); for (let y = 8; y < h; y += 64) g.fillRect(0, y, w, 10); g.strokeStyle = '#555'; g.lineWidth = 16; g.beginPath(); g.arc(128, 128, 120, 0, TAU); g.stroke(); }, { clamp: true });
  const grate = new THREE.Mesh(new THREE.CircleGeometry(GRATE.r + 0.15, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: gt, transparent: true, alphaTest: 0.5, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide }));
  grate.position.set(GRATE.x, BASE_Y + 0.04, GRATE.z); scene.add(grate);
  const glowUnder = new THREE.Mesh(new THREE.CircleGeometry(GRATE.r, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.15, 0.5) })); glowUnder.position.set(GRATE.x, BASE_Y - 0.6, GRATE.z); scene.add(glowUnder);
  GRATE.mesh = grate; GRATE.under = glowUnder;
  const gc = new THREE.Vector3(GRATE.x, BASE_Y + 0.3, GRATE.z);
  GRATE.h = addHittable({ pos: () => gc, radius: GRATE.r, reachUp: 1, slammable: true, alive: () => !GRATE.open && STORY.mission === 11,
    hit: (dmg, dir, kind) => {
      if (kind !== 'slam' && kind !== 'land') { sfxAt('metalHit', gc.x, gc.y, gc.z); if (!GRATE.noted) { GRATE.noted = true; note('Punching it does nothing. Jump, then press attack to slam down on it.', 5); } return; }
      openGrate();
    } });
  GRATE.sc = addScannable({ kind: 'breakable', label: 'Old shaft grate (slam it)', pos: () => gc, when: () => !GRATE.open && STORY.mission === 11 });
}
function openGrate(quiet) {
  if (GRATE.open) return;
  GRATE.open = true; GRATE.mesh.visible = false; GRATE.under.visible = false; GRATE.sc.done = true;
  if (quiet) return;
  sfx('explode'); FX.shake = 1; spawnDebris(GRATE.x, BASE_Y + 0.3, GRATE.z, 8, M.darkMetal);
}
function pressPillar(p) {
  if (p.lit) return;
  p.lit = true; p.plate.material = p.onM; p.capM.emissiveIntensity = 3; sfx('grant');
  HEART.order.push(p.kind);
  const want = ['sun', 'wave', 'eye'];
  const ok = HEART.order.every((k, i) => k === want[i]);
  if (!ok) {
    sfx('deny'); note('The carvings go dark again. The order is wrong.', 3.5);
    setTimeout(() => { for (const q of HEART.pillars) { q.lit = false; q.plate.material = q.offM; q.capM.emissiveIntensity = 0.3; } HEART.order.length = 0; }, 900);
    return;
  }
  if (HEART.order.length === 3) unsealHeart();
}
function unsealHeart(quiet) {
  HEART.sealed = false;
  if (quiet) { HEART.seal.visible = false; for (const q of HEART.pillars) { q.lit = true; q.plate.material = q.onM; q.capM.emissiveIntensity = 3; } return; }
  sfx('iris'); FX.shake = 0.8;
  HEART.unsealT = 0;
}
function updateHeart(dt, t) {
  const near = Math.hypot(P.x - HEART.x, P.z - HEART.z) < HEART.r && P.y < BASE_Y - 4;
  if (HEART.unsealT != null) {
    HEART.unsealT += dt;
    const k = clamp(HEART.unsealT / 2.5, 0, 1);
    HEART.seal.scale.setScalar(1 + k * 0.6); HEART.seal.material.uniforms.uStrength.value = 0.8 * (1 - k);
    if (k >= 1) { HEART.seal.visible = false; HEART.unsealT = null; }
  }
  HEART.group.rotation.y += dt * (0.1 + HEART.awake * 0.8);
  HEART.mat.emissiveIntensity = 1.2 + Math.sin(t * 1.4) * 0.4 + HEART.awake * 2;
  HEART.crystalMat.emissiveIntensity = 1.4 + Math.sin(t * 0.9) * 0.3 + HEART.awake * 1.5;
  HEART.beam.visible = HEART.awake > 0.05;
  if (HEART.beam.visible) { HEART.beam.material.opacity = 0.16 * HEART.awake + Math.sin(t * 20) * 0.03; HEART.beam.scale.set(1 + Math.sin(t * 7) * 0.1, 1, 1 + Math.sin(t * 7) * 0.1); }
  if (near && Math.random() < dt * 20) FX.sparks.add(HEART.x + rr(-3, 3), HEART.y + rr(1, 3), HEART.z + rr(-3, 3), 0.8, 1.6, 3, rr(0.03, 0.06), rr(1.5, 3), 0, rr(0.5, 1.5), 0);
}

// ============================================================ KRONOS: Syndrome's new body, over the open silo
const KRONOS = { state: 'off', hp: 12, maxHp: 12, t: 0, pos: new THREE.Vector3(VX, CRATER_Y + 18, VZ), shield: 1, arms: [], pylonsLeft: 3, hits: 0 };
function headHolo(scale) {
  const g = new THREE.Group();
  const m = holoMaterial(0x63c8ff, 1.1), hair = holoMaterial(0xff8a3a, 1.6), mask = holoMaterial(0x9ff0ff, 2.2);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), m); head.scale.set(0.95, 1.12, 1); g.add(head);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.1, 0.17), m); jaw.position.set(0, -0.09, 0.03); g.add(jaw);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.163, 0.163, 0.065, 20, 1, true), mask); band.position.y = 0.035; g.add(band);
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 8), hair); c.position.set((i - 2) * 0.045, 0.3, -0.06 - Math.abs(i - 2) * 0.02); c.rotation.x = -0.35; c.rotation.z = (i - 2) * -0.12; g.add(c); }
  g.scale.setScalar(scale);
  g.traverse((o) => { if (o.isMesh) o.renderOrder = 6; });
  return g;
}
function shieldMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: U.time, uColor: { value: new THREE.Color(0x63c8ff) }, uOn: { value: 1 }, uHit: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = position; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `uniform float uTime, uOn, uHit; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
        vec2 q = vec2(atan(vP.z, vP.x) * 6.0, vP.y * 1.2);
        vec2 h = abs(fract(q) - 0.5); float hex = smoothstep(0.42, 0.48, max(h.x, h.y));
        float wave = 0.5 + 0.5 * sin(vP.y * 2.0 - uTime * 3.0);
        gl_FragColor = vec4(uColor * (f * 1.6 + hex * 0.25 * wave + uHit) * uOn, 1.0);
      }`,
  });
}
function buildKronos() {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const panel = canvasTex(512, 256, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ff7a2a'; c.lineWidth = 3; for (let x = 0; x < w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 48) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } });
  const coreM = new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.8, roughness: 0.35, envMap: envTex, envMapIntensity: 0.8, emissive: 0xffffff, emissiveMap: panel, emissiveIntensity: 0.6 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(4.5, 48, 32), coreM); core.castShadow = true; g.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.1, 0.35, 10, 64), M.darkMetal); ring.rotation.x = Math.PI / 2; g.add(ring);
  const ringGlow = new THREE.Mesh(new THREE.TorusGeometry(5.15, 0.1, 6, 64), M.redGlow.clone()); ringGlow.rotation.x = Math.PI / 2; ringGlow.position.y = 0.3; g.add(ringGlow);
  const eyeM = M.redGlow.clone(); eyeM.emissiveIntensity = 8;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), eyeM); eye.position.set(0, 0.6, 4.2); g.add(eye);
  const head = headHolo(14); head.position.y = 6.5; g.add(head);
  for (let i = 0; i < 6; i++) {
    const up = unitRod(0.35, M.black), low = unitRod(0.25, M.black);
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 8), M.darkMetal); scene.add(claw);
    up.visible = low.visible = claw.visible = false;
    KRONOS.arms.push({ up, low, claw, a: i / 6 * TAU, base: new THREE.Vector3(), elbow: new THREE.Vector3(), hand: new THREE.Vector3() });
  }
  const shield = new THREE.Mesh(new THREE.SphereGeometry(9, 48, 32), shieldMaterial()); g.add(shield);
  Object.assign(KRONOS, { g, core, coreM, eyeM, head, shield, ringGlow });
  // feed beam from the silo
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.6, 1, 16, 1, true).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 1.05, 1.8), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  feed.visible = false; feed.frustumCulled = false; scene.add(feed);
  KRONOS.feed = feed;
  KRONOS.h = addHittable({ pos: () => KRONOS.pos, radius: 5, reachUp: 6, alive: () => KRONOS.state === 'frozen', hit: (dmg) => damageKronos(dmg) });
  KRONOS.sc = addScannable({ kind: 'enemy', label: 'KRONOS', pos: () => KRONOS.pos, when: () => KRONOS.state !== 'off' && KRONOS.state !== 'dead' });
  // shield pylons and steam vents on the crater floor, clear of the kiosk and the road
  const kioskA = Math.atan2(-84.8 - VZ, -24.5 - VX);
  const roadA = POI.craterRoadEnd ? Math.atan2(POI.craterRoadEnd.z - VZ, POI.craterRoadEnd.x - VX) : kioskA + Math.PI;
  const clash = (a) => Math.min(Math.abs(wrapAngle(a - kioskA)), Math.abs(wrapAngle(a - roadA)));
  let base = kioskA + Math.PI / 3, bestScore = -1;
  for (const off of [0, 0.35, -0.35, 0.7, -0.7]) { const b = kioskA + Math.PI / 3 + off; const s = Math.min(...[0, 1, 2].map((i) => clash(b + i * TAU / 3)), ...[0, 1, 2].map((i) => clash(b + i * TAU / 3 + Math.PI / 3))); if (s > bestScore) { bestScore = s; base = b; } }
  for (let i = 0; i < 3; i++) {
    const a = base + i * TAU / 3, p = fromV(29.5, a);
    const y = terrainHeight(p.x, p.z);
    const col = cyl(0.8, 1.1, 5, M.darkMetal, p.x, y, p.z, { seg: 10, collide: true });
    const capM = M.blueGlow.clone(); capM.emissiveIntensity = 5;
    const cap = mesh(new THREE.SphereGeometry(0.9, 16, 12), capM, p.x, y + 5.6, p.z);
    const beam = unitRod(0.12, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.4, 4), transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false })); beam.castShadow = false;
    const pl = { col, cap, capM, beam, pos: new THREE.Vector3(p.x, y + 5.6, p.z), hp: 3, broken: false };
    col.visible = cap.visible = beam.visible = false;
    pl.obs = obstaclesNear(p.x, p.z).find((o) => o.t === 'c' && Math.abs(o.x - p.x) < 0.01 && Math.abs(o.z - p.z) < 0.01);
    if (pl.obs) pl.obs.y1 = -999;
    pl.h = addHittable({ pos: () => _hv4.set(pl.pos.x, pl.pos.y - 3, pl.pos.z), radius: 1.1, reachUp: 4, slammable: true, alive: () => !pl.broken && KRONOS.state === 'shield',
      hit: (dmg) => { pl.hp -= dmg; sfxAt('metalHit', p.x, y + 2.5, p.z); sparkBurst(p.x, y + 3, p.z, 10, 0x8fd6ff); if (pl.hp <= 0) breakPylon(pl); } });
    pl.sc = addScannable({ kind: 'objective', label: 'Shield pylon', pos: () => pl.pos, when: () => !pl.broken && KRONOS.state === 'shield' });
    W2.pylons.push(pl);
    const va = a + Math.PI / 3, vp = fromV(29, va);
    const vy = terrainHeight(vp.x, vp.z);
    const ventRing = mesh(new THREE.TorusGeometry(1.6, 0.25, 8, 24), M.darkMetal, vp.x, vy + 0.15, vp.z, scene, { rx: Math.PI / 2 });
    const heat = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.6, 46, 20, 1, true).translate(0, 23, 0), beamMaterial(0xffb070, 0.07)); heat.position.set(vp.x, vy, vp.z); heat.visible = false; scene.add(heat);
    const vent = { x: vp.x, z: vp.z, y: vy, ring: ventRing, heat, on: false };
    UPDRAFTS.push({ x: vp.x, z: vp.z, r: 2.6, y0: vy - 1, y1: vy + 44, power: 26, on: () => vent.on });
    W2.vents.push(vent);
    vent.sc = addScannable({ kind: 'path', label: 'Steam vent: jump in and glide up', pos: () => _hv3.set(vp.x, vy + 2, vp.z), when: () => vent.on });
  }
}
function breakPylon(pl, quiet) {
  if (pl.broken) return;
  pl.broken = true; pl.beam.visible = false; pl.capM.emissiveIntensity = 0; pl.sc.done = true;
  KRONOS.pylonsLeft = W2.pylons.filter((q) => !q.broken).length;
  if (!quiet) { explosion(pl.pos.x, pl.pos.y, pl.pos.z, 3, 0); KRONOS.shieldHit = 1; }
}
function kronosShow(on) {
  KRONOS.g.visible = on; KRONOS.feed.visible = on;
  for (const A of KRONOS.arms) A.up.visible = A.low.visible = A.claw.visible = on;
  for (const pl of W2.pylons) { pl.col.visible = pl.cap.visible = on; pl.beam.visible = on && !pl.broken; if (pl.obs) pl.obs.y1 = on ? pl.pos.y - 0.6 : -999; }
}
function startKronos() {
  KRONOS.state = 'rise'; KRONOS.t = 0; KRONOS.hp = KRONOS.maxHp; KRONOS.hits = 0;
  for (const pl of W2.pylons) { pl.broken = false; pl.hp = 3; pl.capM.emissiveIntensity = 5; pl.sc.done = false; }
  KRONOS.pylonsLeft = 3;
  KRONOS.pos.set(VX, CRATER_Y - 30, VZ);
  kronosShow(true);
  STORY.boss = { name: 'KRONOS', hp: () => KRONOS.hp / KRONOS.maxHp };
}
function damageKronos(dmg) {
  if (KRONOS.state !== 'frozen') return;
  KRONOS.hp = Math.max(0, KRONOS.hp - dmg); KRONOS.flash = 0.15; KRONOS.hits += dmg;
  sfx('punchHeavy');
  if (KRONOS.hp <= KRONOS.maxHp / 2 && !STORY.flags.kPhase3) { STORY.flags.kPhase3 = true; KRONOS.state = 'rage'; KRONOS.t = 0; }
}
function kronosSlammed() {
  KRONOS.hp = Math.max(0, KRONOS.hp - 3 * Math.max(1, HERO.power * 0.75)); KRONOS.flash = 0.3;
  sfx('punchHeavy'); sfx('slam'); hitStop(0.15); FX.shake = 1.2; sparkBurst(P.x, P.y, P.z, 30, 0xffa040); shockRing(P.x, P.y - 0.5, P.z, 6);
  HERO.slam = false; P.vy = 14; HERO.airJumps = 0;
  if (KRONOS.hp <= 0) { KRONOS.state = 'dying'; KRONOS.t = 0; STORY.boss = null; }
}
function updateKronos(dt, t) {
  if (KRONOS.state === 'off' || KRONOS.state === 'dead') return;
  const K = KRONOS, p = K.pos, playing = GAME.mode === 'play';
  K.t += dt;
  let target = null;
  const toHero = Math.atan2(P.x - VX, P.z - VZ);
  switch (K.state) {
    case 'rise': target = _hv2.set(VX, CRATER_Y + 18, VZ); if (K.t > 5) { K.state = 'shield'; K.t = 0; } break;
    case 'shield':
      target = _hv2.set(VX + Math.sin(t * 0.3) * 4, CRATER_Y + 18 + Math.sin(t * 0.8) * 1.5, VZ + Math.cos(t * 0.3) * 4);
      if (playing && K.t > 2.6) { K.t = 0; kronosVolley(4); }
      if (playing && (K.droneT = (K.droneT || 0) - dt) < 0) { K.droneT = 14; if (ENEMIES.filter((e) => e.alive && e.group === 'kronos').length < 2) spawnEnemy('drone', p.x, p.y - 4, p.z, { group: 'kronos', hunt: true }); }
      if (K.pylonsLeft <= 0) { K.state = 'stunned'; K.t = 0; }
      break;
    case 'stunned': target = _hv2.copy(p); break;        // the mission script drops the field on it
    case 'frozen': {
      const a = K.dropA ?? toHero; K.dropA = a;
      target = _hv2.set(VX + Math.sin(a) * 17, CRATER_Y + 3.5, VZ + Math.cos(a) * 17);
      if (K.t > 14) { K.state = 'shield2'; K.t = 0; K.dropA = null; }
      break;
    }
    case 'shield2':   // shook the field off; Mirage will drop it again
      target = _hv2.set(VX, CRATER_Y + 16, VZ);
      if (playing && K.t > 1 && (K.t % 2.8) < dt) kronosVolley(3);
      if (K.t > 9) { K.state = 'frozen'; K.t = 0; sfx('zap'); }
      break;
    case 'rage':
      target = _hv2.set(VX + Math.sin(t * 0.4) * 3, CRATER_Y + 27 + Math.sin(t * 0.9) * 2, VZ + Math.cos(t * 0.4) * 3);
      if (playing) {
        K.slamT = (K.slamT ?? 4) - dt;
        if (K.slamT < 0) { K.slamT = 7.5; kronosShockwave(); }
        K.volT = (K.volT ?? 2) - dt;
        if (K.volT < 0) { K.volT = 3.4; kronosVolley(3); }
      }
      // the hero slams down on top of it
      if (HERO.slam && P.vy < 0 && Math.hypot(P.x - p.x, P.z - p.z) < 6.5 && P.y > p.y + 1 && P.y < p.y + 9) kronosSlammed();
      break;
    case 'dying':
      target = _hv2.set(p.x, p.y - dt * 2, p.z);
      if (Math.random() < dt * 8) explosion(p.x + rr(-4, 4), p.y + rr(-3, 3), p.z + rr(-4, 4), 2, 0);
      if (K.t > 4) { K.state = 'dead'; explosion(p.x, p.y, p.z, 10, 0); FX.shake = 2; kronosShow(false); for (const v of W2.vents) v.on = false; }
      break;
  }
  if (target) p.lerp(target, 1 - Math.exp(-dt * (K.state === 'frozen' ? 1.2 : 0.8)));
  K.g.position.copy(p);
  K.g.rotation.y += dt * (K.state === 'frozen' ? 0.02 : 0.25);
  K.head.rotation.y = toHero - K.g.rotation.y;
  K.head.visible = K.state !== 'dying' || Math.random() > 0.3;
  const frozen = K.state === 'frozen' || K.state === 'stunned';
  K.shield.visible = K.state !== 'frozen' && K.state !== 'dying';
  K.shieldHit = Math.max(0, (K.shieldHit || 0) - dt * 2);
  K.shield.material.uniforms.uHit.value = K.shieldHit;
  K.shield.material.uniforms.uColor.value.set(K.state === 'rage' ? 0xff5030 : 0x63c8ff);
  K.flash = Math.max(0, (K.flash || 0) - dt);
  K.coreM.emissiveIntensity = K.flash > 0 ? 4 : frozen ? 0.2 : 0.6 + Math.sin(t * 3) * 0.2;
  K.eyeM.emissiveIntensity = frozen ? 0.5 : 8;
  if (frozen) K.coreM.emissive.set(0x8fd6ff); else K.coreM.emissive.set(0xffffff);
  // arms
  K.arms.forEach((A, i) => {
    const a = A.a + K.g.rotation.y, wig = Math.sin(t * 2 + i) * 0.4;
    A.base.set(p.x + Math.cos(a) * 4.8, p.y - 0.5, p.z + Math.sin(a) * 4.8);
    A.elbow.set(p.x + Math.cos(a) * 9, p.y + 1.5 + wig * 2 - (frozen ? 3 : 0), p.z + Math.sin(a) * 9);
    A.hand.set(p.x + Math.cos(a + wig * 0.2) * 11, p.y - 4 - (frozen ? 2 : 0) + wig, p.z + Math.sin(a + wig * 0.2) * 11);
    setRod(A.up, A.base, A.elbow); setRod(A.low, A.elbow, A.hand);
    A.claw.position.copy(A.hand); A.claw.lookAt(p); A.claw.rotateX(Math.PI / 2);
  });
  // feed beam from the silo and pylon beams
  const fb = KRONOS.feed; fb.position.set(VX, BASE_Y, VZ); fb.scale.set(1, Math.max(1, p.y - BASE_Y), 1); fb.visible = K.state !== 'dying' && K.state !== 'frozen';
  for (const pl of W2.pylons) if (!pl.broken) setRod(pl.beam, pl.pos, p);
}
function kronosVolley(n) {
  for (let i = 0; i < n; i++) setTimeout(() => {
    if (KRONOS.state === 'off' || KRONOS.state === 'dead' || GAME.mode !== 'play') return;
    const from = KRONOS.pos.clone().add(new THREE.Vector3(Math.sin(KRONOS.g.rotation.y) * 4.5, 0.6, Math.cos(KRONOS.g.rotation.y) * 4.5));
    fireShot(from, new THREE.Vector3(P.x + P.vx * 0.4 + rr(-1, 1), P.y + 1.2, P.z + P.vz * 0.4 + rr(-1, 1)), 30, 8);
  }, i * 220);
}
// a ring of force rolling out across the crater floor: jump over it
const QUAKES = [];
function kronosShockwave() {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.4), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(VX, CRATER_Y + 0.3, VZ); scene.add(m);
  QUAKES.push({ m, r: SILO_R, hit: false });
  sfx('slam'); FX.shake = Math.max(FX.shake, 0.6);
}
function updateQuakes(dt) {
  for (let i = QUAKES.length - 1; i >= 0; i--) {
    const q = QUAKES[i]; q.r += dt * 9;
    q.m.scale.setScalar(q.r); q.m.material.opacity = 0.9 * clamp((40 - q.r) / 10, 0, 1);
    const hr = Math.hypot(P.x - VX, P.z - VZ);
    if (!q.hit && GAME.mode === 'play' && P.grounded && Math.abs(hr - q.r) < 1.2 && Math.abs(P.y - CRATER_Y) < 2) { q.hit = true; hurtHero(18, { x: VX, z: VZ }); P.vy = 9; P.grounded = false; }
    if (q.r > 40) { scene.remove(q.m); q.m.geometry.dispose(); QUAKES.splice(i, 1); }
  }
}

// ============================================================ the living volcano: geysers on the slopes and lava bombs from the vent
const GEYSERS = [], BOMBS = [];
function buildVolcanoLife() {
  for (const [r, a] of [[150, 0.9], [128, 1.9], [165, 3.3], [140, 4.3], [118, 5.4]]) {
    const p = fromV(r, a), y = terrainHeight(p.x, p.z);
    if (maskAt(p.x, p.z, 2) > 0.2) continue;   // not in a lava channel
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.45, 8, 20), M.rockDark); ring.rotation.x = Math.PI / 2; ring.position.set(p.x, y + 0.2, p.z); ring.castShadow = true; scene.add(ring);
    const crust = new THREE.Mesh(new THREE.CircleGeometry(1.4, 18).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc8b46a, roughness: 0.9 })); crust.position.set(p.x, y + 0.12, p.z); scene.add(crust);
    const gy = { x: p.x, z: p.z, y, t: rr(0, 7), on: false };
    UPDRAFTS.push({ x: p.x, z: p.z, r: 2.4, y0: y - 1, y1: y + 34, power: 30, on: () => gy.on });
    gy.sc = addScannable({ kind: 'path', label: 'Geyser: ride it up', pos: () => _hv3.set(p.x, y + 1, p.z), when: () => HERO.boots });
    GEYSERS.push(gy);
  }
}
function updateVolcanoLife(dt) {
  for (const g of GEYSERS) {
    g.t += dt;
    const cyc = g.t % 8, was = g.on;
    g.on = cyc > 5.5;
    const near = Math.hypot(P.x - g.x, P.z - g.z) < 160;
    if (g.on && !was && near) sfxAt('whoosh', g.x, g.y + 2, g.z);
    if (near && (g.on ? Math.random() < dt * 40 : Math.random() < dt * 1.5)) FX.smoke.spawn({ x: g.x + rr(-0.6, 0.6), y: g.y + 0.5, z: g.z + rr(-0.6, 0.6), vx: rr(-0.4, 0.4), vy: g.on ? rr(14, 22) : rr(1, 2), vz: rr(-0.4, 0.4), wind: 0.6, drag: 0.25, s0: 1, s1: g.on ? rr(5, 9) : 3, a: g.on ? 0.3 : 0.12, life: g.on ? rr(1.6, 2.6) : rr(2, 4), top: [0.6, 0.6, 0.62], bot: [0.7, 0.68, 0.66] });
  }
  // the east vent spits glowing rocks when you are within earshot
  const dv = Math.hypot(P.x - VENT.x, P.z - VENT.z);
  W2.bombT = (W2.bombT ?? 5) - dt;
  if (W2.bombT < 0 && dv < 230 && GAME.mode === 'play') {
    W2.bombT = rr(4, 10);
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(rr(0.4, 0.8), 0), M.lavaGlow);
    m.position.set(VENT.x + rr(-4, 4), LAVA_LAKE_Y + 2, VENT.z + rr(-4, 4)); scene.add(m);
    const tx = P.x + rr(-25, 25), tz = P.z + rr(-25, 25), T = rr(3.5, 5);
    const v = new THREE.Vector3((tx - m.position.x) / T, 0, (tz - m.position.z) / T);
    v.y = ((terrainHeight(tx, tz) - m.position.y) + 0.5 * 22 * T * T) / T;
    BOMBS.push({ m, v, life: T + 1 });
    sfxAt('rumble', VENT.x, LAVA_LAKE_Y, VENT.z);
  }
  for (let i = BOMBS.length - 1; i >= 0; i--) {
    const b = BOMBS[i]; b.life -= dt;
    b.v.y -= 22 * dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += dt * 4;
    if (Math.random() < dt * 30) FX.sparks.add(b.m.position.x, b.m.position.y, b.m.position.z, 3, 1.2, 0.3, rr(0.06, 0.12), rr(0.4, 0.9), 0, 0.5, 0);
    const p = b.m.position;
    if ((p.y < terrainHeight(p.x, p.z) + 0.3 && b.v.y < 0) || b.life < 0) {
      sparkBurst(p.x, p.y, p.z, 20, 0xff7a2a); burstDust(p.x, p.y, p.z, 0.8, 0x4a3a30); sfxAt('thud', p.x, p.y, p.z);
      if (Math.hypot(P.x - p.x, P.y - p.y, P.z - p.z) < 3.5) hurtHero(12, p);
      scene.remove(b.m); b.m.geometry.dispose(); BOMBS.splice(i, 1);
    }
  }
}

// ============================================================ smaller hooks into existing places
function buildBaseProps() {
  const Y = BASE_Y;
  addInteract({ pos: { x: 18, y: Y + 1.2, z: -56 }, r: 2.8, prio: 1, when: () => STORY.mission >= 8 && !HERO.boots, prompt: 'Take the rocket boots', use: () => { takeBoots(true); findSecret('incrediboy'); sfx('grant'); } });
  for (const [x, z] of [[-70, 3], [-68, 3.2], [-12, 2], [-10.6, 2.4], [-12, -20]]) addThrowable('crate', x, Y, z);
  for (const [x, z] of [[8, VZ + 14], [-6, VZ - 14], [6, VZ - 16]]) addThrowable('crate', x, Y, z, { respawn: 30 });
  for (const [x, z] of [[-14, VZ + 12], [12, VZ + 15]]) addThrowable('drum', x, Y, z, { respawn: 40 });
}
// the waterfall door: punch it in
function hookWaterfallDoor() {
  const st = POI.wfDoorState; if (!st) return;
  st.hp = 3;
  const D = POI.door, c = new THREE.Vector3(D.x, POI.ledgeY + 2.3, D.z);
  st.h = addHittable({ pos: () => c, radius: 2.2, reachUp: 2.5, alive: () => !st.target && STORY.mission >= 4,
    hit: (dmg) => {
      st.hp -= dmg; sfxAt('metalHit', c.x, c.y, c.z); sparkBurst(c.x + POI.dirS.x * 0.6, c.y, c.z + POI.dirS.z * 0.6, 12); FX.shake = Math.max(FX.shake, 0.35);
      if (st.door) st.door.position.z = -0.3 - (3 - st.hp) * 0.08;
      if (st.hp <= 0) { st.broken = true; st.target = 1; sfx('explode'); FX.shake = 0.9; burstDust(c.x, POI.ledgeY, c.z, 1.5, 0x8a8070); findSecret('door'); }
    } });
  st.sc = addScannable({ kind: 'breakable', label: 'Steel door (weak hinges)', pos: () => c, when: () => !st.target && STORY.mission === 4 });
}

// ============================================================ per-frame
function updateWorld2(dt, t) {
  updateShards(dt, t);
  updateDebris(dt);
  updateHoloSyndrome(dt, t);
  updateValves(dt);
  updateOmni(dt, t);
  updateMirage(dt, t);
  updateHeart(dt, t);
  updateKronos(dt, t);
  updateQuakes(dt);
  updateVolcanoLife(dt);
  for (const v of W2.vents) {
    v.heat.visible = v.on;
    if (v.on && Math.random() < dt * 14) FX.smoke.spawn({ x: v.x + rr(-1, 1), y: v.y + 0.5, z: v.z + rr(-1, 1), vx: rr(-0.3, 0.3), vy: rr(10, 16), vz: rr(-0.3, 0.3), drag: 0.3, s0: 1.5, s1: rr(6, 10), a: 0.25, life: rr(2, 3), top: [0.45, 0.43, 0.42], bot: [0.7, 0.5, 0.35] });
  }
  // updraft columns pull you to their middle so the narrow shaft is easy to ride
  if (!P.grounded && STORY.flags.updraft && Math.hypot(P.x - GRATE.x, P.z - GRATE.z) < 3.5 && P.y < BASE_Y + 3 && P.y > HEART.y) {
    P.x = damp(P.x, GRATE.x, 4, dt); P.z = damp(P.z, GRATE.z, 4, dt); P.vx *= 0.9; P.vz *= 0.9;
  }
  // near the top of the silo the hot air pushes you out over the crater floor
  if (!P.grounded && STORY.flags.updraft && STORY.mission === 11 && P.y > CRATER_Y + 6 && Math.hypot(P.x - VX, P.z - VZ) < SILO_R + 1) {
    const r = Math.max(Math.hypot(P.x - VX, P.z - VZ), 0.5);
    P.vx += (P.x - VX) / r * 9 * dt; P.vz += (P.z - VZ) / r * 9 * dt;
    if (r < 1) { P.vx += -Math.sin(P.yaw) * 6 * dt; P.vz += -Math.cos(P.yaw) * 6 * dt; }
  }
  // the silo wall has no collision between its ledges: keep the hero inside the shaft
  { const r = Math.hypot(P.x - VX, P.z - VZ);
    const band = P.y > BASE_Y + 6.5 && P.y < CRATER_Y - 0.3 && !(P.y > RING_Y - 1 && P.y < RING_Y + 4);
    if (band && r > SILO_R - 0.7 && r < SILO_R + 3) { const k = (SILO_R - 0.7) / r; P.x = VX + (P.x - VX) * k; P.z = VZ + (P.z - VZ) * k; P.vx *= 0.5; P.vz *= 0.5; } }
  // the lava under the geothermal walkways
  if (GAME.mode === 'play' && P.x > 40 && P.x < 76 && P.z > -64 && P.z < -36 && P.y < BASE_Y - 3.5) { hurtHero(15); fellIntoVoid(); }
}
