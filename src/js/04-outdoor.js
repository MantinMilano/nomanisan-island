// ============================================================ shared registries for gameplay
const INTERACT = [];   // {pos, r, prompt, use, when?, key?}
const SECURITY = { cams: [], searchlights: [], birds: [], lasers: [] };
const ANIM = [];       // per-frame callbacks (dt, t)
const MONO = { pts: [], curve: null, len: 0, pod: null, ride: null };
function addInteract(o) { o.pos = o.pos.isVector3 ? o.pos : new THREE.Vector3(o.pos.x, o.pos.y, o.pos.z); o.r = o.r || 2.6; INTERACT.push(o); return o; }

function textTex(lines, opts = {}) {
  const w = opts.w || 1024, h = opts.h || 256;
  return canvasTex(w, h, (g) => {
    g.fillStyle = opts.bg || 'rgba(0,0,0,0)'; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((ln, i) => {
      g.font = ln.font || `700 ${opts.size || 120}px Syncopate, Arial Black, sans-serif`;
      g.fillStyle = ln.color || '#fff';
      if (ln.glow) { g.shadowColor = ln.glow; g.shadowBlur = 24; }
      g.fillText(ln.text, w / 2, ln.y != null ? ln.y : h / 2);
      g.shadowBlur = 0;
    });
  }, { clamp: true });
}
let emblemTex = null;
function makeEmblem() {
  emblemTex = canvasTex(512, 512, (g) => {
    g.clearRect(0, 0, 512, 512);
    g.fillStyle = '#0d0e10'; g.beginPath(); g.arc(256, 256, 250, 0, TAU); g.fill();
    g.strokeStyle = '#d4542a'; g.lineWidth = 16; g.beginPath(); g.arc(256, 256, 226, 0, TAU); g.stroke();
    g.fillStyle = '#f2ede2'; g.font = 'italic 700 330px Syncopate, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('S', 262, 270);
  }, { clamp: true });
}
function emblem(size, x, y, z, ry = 0, parent = scene, glow = 0) {
  const m = new THREE.MeshStandardMaterial({ map: emblemTex, transparent: true, roughness: 0.4, emissive: 0xffffff, emissiveMap: emblemTex, emissiveIntensity: glow });
  return mesh(new THREE.CircleGeometry(size / 2, 48), m, x, y, z, parent, { ry });
}

// ============================================================ lamps
const LAMPS = { poles: [], globes: [] };
function lampPost(x, z, opts = {}) {
  const y = opts.y != null ? opts.y : terrainHeight(x, z);
  const hgt = opts.h || 2.7;
  const broken = opts.broken != null ? opts.broken : rng() < 0.12;
  const dead = !broken && rng() < 0.08;
  LAMPS.poles.push({ x, y, z, h: hgt });
  let mat = M.lamp;
  if (broken) { mat = M.lamp.clone(); }
  if (dead) mat = M.darkMetal;
  const globe = mesh(new THREE.SphereGeometry(0.2, 12, 8), mat, x, y + hgt + 0.15, z);
  if (!dead) addLight(x, y + hgt + 0.3, z, opts.color || 0xffb36b, opts.intensity || 22, opts.dist || 16, { flicker: broken ? 2 : 0, mat: broken ? mat : null, on: opts.on, lamp: true });
  addCircleObs(x, z, 0.12, y, y + hgt);
  return globe;
}
function buildLampPoles() {
  const n = LAMPS.poles.length;
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.07, 1, 6).translate(0, 0.5, 0), M.black, n);
  LAMPS.poles.forEach((p, i) => { _m4.compose(_v.set(p.x, p.y, p.z), _q.identity(), _s.set(1, p.h, 1)); pole.setMatrixAt(i, _m4); });
  pole.castShadow = true; pole.computeBoundingSphere(); scene.add(pole);
}
function lampsAlong(pts, every, side, opts = {}) {
  let acc = every * 0.5, flip = 1;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    acc += seg;
    if (acc < every) continue;
    acc = 0; flip = opts.alternate ? -flip : 1;
    const tx = (b.x - a.x) / seg, tz = (b.z - a.z) / seg;
    const x = b.x - tz * side * flip, z = b.z + tx * side * flip;
    if (terrainHeight(x, z) < 0.8 || riverAt(x, z) != null) continue;
    lampPost(x, z, opts);
  }
}

// ============================================================ planning (before flora)
function planOutdoor() {
  // keep the jungle off buildings, paths' edges and the monorail
  EXCLUDE.push({ x: POI.pavilion.x, z: POI.pavilion.z, r: 17 }, { x: POI.beachStation.x, z: POI.beachStation.z, r: 15 },
    { x: POI.battery.x, z: POI.battery.z, r: 24 }, { x: POI.radio.x, z: POI.radio.z, r: 12 }, { x: POI.omni.x, z: POI.omni.z, r: 17 },
    { x: POI.velo.x, z: POI.velo.z, r: 9 }, { x: POI.lavaLook.x, z: POI.lavaLook.z, r: 8 }, { x: POI.pool.x, z: POI.pool.z, r: 14 },
    { x: POI.door.x, z: POI.door.z, r: 9 }, { x: POI.cave.x, z: POI.cave.z, r: 9 }, { x: POI.planeWreck.x, z: POI.planeWreck.z, r: 9 },
    { x: 0, z: POI.plaza.z, r: 26 }, { x: 208, z: 34, r: 20 }, { x: 200, z: 14, r: 16 });
  excludeLine([{ x: POI.jetty.x0, z: POI.jetty.z0 }, { x: POI.jetty.x1, z: POI.jetty.z1 }], 6);
  excludeLine(ROAD, 4.5); excludeLine(CRATER_ROAD, 4);
  // monorail: beach station -> jungle -> plaza -> through the gate -> hall station
  const bs = POI.beachStation;
  const ctl = [
    { x: bs.x + POI.side.x * 14, z: bs.z + POI.side.z * 14 },
    { x: bs.x, z: bs.z }, { x: bs.x - POI.out.x * 26, z: bs.z - POI.out.z * 26 },
    { x: -36, z: 236 }, { x: -44, z: 200 }, { x: -34, z: 168 }, { x: -16, z: 146 }, { x: -4, z: POI.plaza.z + 22 },
    { x: 0, z: POI.plaza.z + 6 }, { x: 0, z: POI.gateZ }, { x: 0, z: POI.gateZ - 30 }, { x: 0, z: 30 }, { x: 0, z: 10 }, { x: 0, z: -2 },
  ];
  const pts = smoothPath(ctl, 2);
  const tunnelY = (z) => lerp(POI.plazaY, BASE_Y, clamp((POI.gateZ - z) / (POI.gateZ - 8), 0, 1));
  // heights: low at both stations, ~8 m over the jungle in between
  const n = pts.length;
  const raw = pts.map((p, i) => {
    if (p.z < POI.gateZ + 1) return (p.z < 8 ? BASE_Y : tunnelY(p.z)) + 0.3;
    const g = Math.max(terrainHeight(p.x, p.z), 0);
    return g + 8;
  });
  // stations
  const bsY = terrainHeight(bs.x, bs.z);
  pts.forEach((p, i) => {
    const dBS = Math.hypot(p.x - bs.x, p.z - bs.z);
    const dPl = Math.hypot(p.x - 0, p.z - (POI.plaza.z + 6));
    let y = raw[i];
    if (p.z >= POI.gateZ + 1) {
      y = lerp(bsY + 0.3, y, smoothstep(8, 40, dBS));
      if (p.z < POI.plaza.z + 40) y = lerp(POI.plazaY + 0.3, y, smoothstep(10, 34, dPl));
    }
    p.y = y;
  });
  for (let pass = 0; pass < 6; pass++) for (let i = 1; i < n - 1; i++) if (pts[i].z > POI.gateZ + 4) pts[i].y = (pts[i - 1].y + pts[i].y * 2 + pts[i + 1].y) / 4;
  MONO.pts = pts;
  MONO.curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, p.y, p.z)));
  MONO.len = MONO.curve.getLength();
  MONO.bsY = bsY;
  excludeLine(pts.filter((p) => p.z > POI.gateZ), 4.5);
}

// ============================================================ build outdoor structures
function buildOutdoor() {
  makeEmblem();
  buildJetty();
  buildPavilion();
  buildMonorail();
  buildGate();
  buildBattery();
  buildRadio();
  buildWrecks();
  buildBirds();
  buildLavaLook();
  buildRimAndCrater();
  buildWaterfallDoor();
  buildScarpColumns();
  // lamps
  for (const tr of TRAILS) if (tr.name !== 'cliff') lampsAlong(tr.pts, 19, 2.6, { alternate: true });
  lampsAlong(ROAD, 24, 4.2, { h: 4.2, intensity: 40, dist: 22, color: 0xffc489 });
  lampsAlong(CRATER_ROAD, 22, -3.6, { h: 3.6, intensity: 36, dist: 20, color: 0xffc489 });
  buildLampPoles();
}

function buildJetty() {
  const J = POI.jetty, len = Math.hypot(J.x1 - J.x0, J.z1 - J.z0), cx = (J.x0 + J.x1) / 2, cz = (J.z0 + J.z1) / 2;
  const deckY = 2.1;
  box(3.6, 0.35, len, M.concreteDark, cx, deckY - 0.35, cz, { ry: J.yaw, receive: true, uvScale: 2 });
  for (let s = 4; s < len; s += 6) for (const side of [-1.5, 1.5]) {
    const f = s / len, px = lerp(J.x0, J.x1, f) + Math.cos(J.yaw) * side, pz = lerp(J.z0, J.z1, f) - Math.sin(J.yaw) * side;
    cyl(0.22, 0.26, deckY + 6, M.concreteDark, px, -6, pz, { seg: 8 });
  }
  floorOBB(cx, cz, 1.8, len / 2, J.yaw, deckY, deckY, { kind: 'wood' });
  // bollards and lamps
  for (let s = 10; s < len; s += 12) {
    const f = s / len, px = lerp(J.x0, J.x1, f), pz = lerp(J.z0, J.z1, f);
    lampPost(px + Math.cos(J.yaw) * 1.6, pz - Math.sin(J.yaw) * 1.6, { y: deckY, h: 2.4, intensity: 18, broken: s > 30 });
  }
  // the boat that brought us
  const bx = J.x1 - POI.out.x * 2 + Math.cos(J.yaw) * 4, bz = J.z1 - POI.out.z * 2 - Math.sin(J.yaw) * 4;
  const boat = new THREE.Group(); boat.position.set(bx, 0.15, bz); boat.rotation.y = J.yaw; scene.add(boat);
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 6, 6, 12), M.white); hull.rotation.x = Math.PI / 2; hull.scale.set(1, 1, 0.45); hull.position.y = 0.2; hull.castShadow = true; boat.add(hull);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 2), M.glassDark); cab.position.set(0, 0.9, 0.6); boat.add(cab);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.12, 6.6), M.red); stripe.position.y = 0.45; boat.add(stripe);
  ANIM.push((dt, t) => { boat.position.y = 0.15 + Math.sin(t * 1.1) * 0.08; boat.rotation.z = Math.sin(t * 0.9) * 0.03; });
  addLight(bx, 1.6, bz, 0x9fd0ff, 6, 8);
}

function buildPavilion() {
  const P = POI.pavilion, yaw = Math.atan2(POI.out.x, POI.out.z);   // front faces the sea
  const y = terrainHeight(P.x, P.z) + 0.05;
  const g = new THREE.Group(); g.position.set(P.x, y, P.z); g.rotation.y = yaw; scene.add(g);
  const local = (lx, lz) => ({ x: P.x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z: P.z - lx * Math.sin(yaw) + lz * Math.cos(yaw) });
  // terrazzo deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 11), M.terrazzo); deck.position.y = 0.2; deck.receiveShadow = true; g.add(deck);
  floorOBB(P.x, P.z, 9, 5.5, yaw, y + 0.4, y + 0.4, { kind: 'stone' });
  // stacked-stone feature wall at the back with the sign
  const wall = new THREE.Mesh(new THREE.BoxGeometry(12, 4.2, 0.8), M.rock); wall.position.set(-1.5, 2.5, -5); wall.castShadow = true; wall.receiveShadow = true; g.add(wall);
  const wp = local(-1.5, -5); addBoxObs(wp.x, wp.z, 6, 0.4, -yaw, y, y + 4.6);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.5), new THREE.MeshStandardMaterial({ map: textTex([{ text: 'NOMANISAN', color: '#ffd9a8', glow: '#ff9a40' }]), transparent: true, emissive: 0xffa75a, emissiveMap: null, emissiveIntensity: 0, roughness: 0.6 }));
  sign.material.emissiveMap = sign.material.map; sign.material.emissiveIntensity = 2.2;
  sign.position.set(-1.5, 3.3, -4.55); g.add(sign);
  const sub = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.5), new THREE.MeshStandardMaterial({ map: textTex([{ text: 'A PRIVATE PARADISE', color: '#f3eadb', font: '500 70px Jost, sans-serif' }], { h: 128 }), transparent: true, roughness: 0.7 }));
  sub.position.set(-1.5, 2.35, -4.55); g.add(sub);
  addLight(local(-1.5, -3.5).x, y + 3, local(-1.5, -3.5).z, 0xff9a50, 26, 14, { flicker: 3 });
  // butterfly roof on slim columns
  for (const sx of [-7.5, 7.5]) for (const sz of [-3.8, 3.8]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8), M.black); c.position.set(sx, 2.1, sz); c.castShadow = true; g.add(c);
  }
  for (const s of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.18, 9.5), M.white); roof.position.set(s * 4.4, 3.95, 0); roof.rotation.z = s * 0.16; roof.castShadow = true; roof.receiveShadow = true; g.add(roof);
  }
  // bar counter
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.1, 32, 1, true, 0, Math.PI), M.wood); bar.position.set(4.5, 0.95, -2.2); bar.material.side = THREE.DoubleSide; g.add(bar);
  const barTop = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.9, 32, 1, 0, Math.PI), M.black); barTop.rotation.x = -Math.PI / 2; barTop.position.set(4.5, 1.52, -2.2); g.add(barTop);
  const bp = local(4.5, -1); addBoxObs(bp.x, bp.z, 2.8, 1.3, -yaw, y, y + 1.5);
  // loungers
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Group(); l.position.set(-6 + i * 3.1, 0.4, 3.2); g.add(l);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 1.9), M.white); seat.position.y = 0.38; l.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.8), M.white); back.position.set(0, 0.62, -0.95); back.rotation.x = -0.7; l.add(back);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.08), M.black); leg.position.set(0, 0.16, 0.6); l.add(leg);
    const leg2 = leg.clone(); leg2.position.z = -0.6; l.add(leg2);
  }
  // tiki torches by the steps
  for (const [lx, lz] of [[-8.5, 5.2], [8.5, 5.2], [-8.5, -4.6]]) {
    const p = local(lx, lz);
    cyl(0.06, 0.08, 2.2, M.wood, p.x, y, p.z, { seg: 6 });
    const fl = mesh(new THREE.ConeGeometry(0.16, 0.5, 8), M.lavaGlow.clone(), p.x, y + 2.45, p.z);
    fl.material.emissive.set(0xff8a2a);
    addLight(p.x, y + 2.6, p.z, 0xff8a3a, 14, 10, { flicker: 1, mat: fl.material });
    FX_POINTS.torches.push({ x: p.x, y: y + 2.5, z: p.z });
  }
  // welcome terminal
  const tp = local(2, -4.3);
  const kiosk = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.5), M.black); kiosk.position.set(2, 1.05, -4.3); kiosk.castShadow = true; g.add(kiosk);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), M.tealGlow); scr.position.set(2, 1.4, -4.04); g.add(scr);
  addInteract({ pos: { x: tp.x, y: y + 1.5, z: tp.z }, prompt: 'Read the welcome terminal', use: () => openLog('welcome') });
}

function buildMonorail() {
  const pts = MONO.pts;
  // beam
  const outside = pts.filter((p) => p.z > POI.gateZ - 2);
  const beamG = sweepProfile(outside.map((p) => ({ x: p.x, y: p.y, z: p.z })), [[-0.45, -1.1], [-0.45, 0], [0.45, 0], [0.45, -1.1], [-0.45, -1.1]]);
  mesh(beamG, M.concrete, 0, 0, 0, scene, { cast: true });
  const inside = pts.filter((p) => p.z <= POI.gateZ + 2);
  mesh(sweepProfile(inside, [[-0.45, -0.9], [-0.45, 0], [0.45, 0], [0.45, -0.9]]), M.concreteDark, 0, 0, 0, scene, {});
  // pylons
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]; acc += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    if (acc < 16 || p.z < POI.gateZ + 2) continue;
    const g = terrainHeight(p.x, p.z);
    if (p.y - g < 2.2) continue;
    acc = 0;
    const hgt = p.y - 1.1 - g + 0.5;
    cyl(0.32, 0.5, hgt, M.concrete, p.x, g - 0.5, p.z, { seg: 10, cast: true, collide: true });
    box(2.0, 0.5, 0.9, M.concrete, p.x, p.y - 1.6, p.z, { ry: Math.atan2(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z), cast: true });
  }
  // beach station: platform, curved canopy
  const bs = POI.beachStation, sy = terrainHeight(bs.x, bs.z);
  let bi = 0, bd = Infinity, acc2 = 0, bu = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) acc2 += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z);
    const d = Math.hypot(pts[i].x - bs.x, pts[i].z - bs.z); if (d < bd) { bd = d; bi = i; bu = acc2; }
  }
  MONO.stationU = bu / MONO.len;
  const pa = pts[Math.max(bi - 2, 0)], pb = pts[Math.min(bi + 2, pts.length - 1)];
  const syaw = Math.atan2(pb.x - pa.x, pb.z - pa.z);
  const plat = { x: bs.x + Math.cos(syaw) * 3.4, z: bs.z - Math.sin(syaw) * 3.4 };
  box(4.4, 0.5, 18, M.concrete, plat.x, sy, plat.z, { ry: syaw, uvScale: 2 });
  floorOBB(plat.x, plat.z, 2.2, 9, syaw, sy + 0.5, sy + 0.5, { kind: 'stone' });
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 18, 24, 1, true, -0.2, 1.9), M.white);
  canopy.material = M.white.clone(); canopy.material.side = THREE.DoubleSide;
  canopy.rotation.set(Math.PI / 2, 0, 0); const cg = new THREE.Group(); cg.add(canopy); cg.position.set(plat.x, sy + 1.6, plat.z); cg.rotation.y = syaw; canopy.castShadow = true; scene.add(cg);
  for (const s of [-7, 0, 7]) { const q = { x: plat.x + Math.sin(syaw) * s + Math.cos(syaw) * 1.6, z: plat.z + Math.cos(syaw) * s - Math.sin(syaw) * 1.6 }; cyl(0.08, 0.08, 4.5, M.black, q.x, sy, q.z, { seg: 6 }); }
  const sgn = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.75), new THREE.MeshStandardMaterial({ map: textTex([{ text: 'MONORAIL', color: '#ffffff' }], { size: 110 }), transparent: true, emissive: 0xffffff, emissiveIntensity: 0.0, roughness: 0.5 }));
  sgn.material.emissiveMap = sgn.material.map;
  sgn.position.set(plat.x + Math.cos(syaw) * 1.8, sy + 3.6, plat.z - Math.sin(syaw) * 1.8); sgn.rotation.y = syaw + Math.PI / 2; scene.add(sgn);
  ANIM.push(() => { sgn.material.emissiveIntensity = GAME.power ? 1.8 : 0.0; });
  addLight(plat.x, sy + 3.5, plat.z, 0xdfe8ff, 20, 14, { on: () => GAME.power });
  MONO.beachPlat = { x: plat.x, y: sy + 0.5, z: plat.z, yaw: syaw };
  // the pod
  MONO.pod = makePod();
  scene.add(MONO.pod);
  MONO.u = MONO.stationU;
  placePod(MONO.u);
  addInteract({ pos: { x: plat.x, y: sy + 1.6, z: plat.z }, r: 4.5, prompt: () => (GAME.power ? 'Ride the monorail to the volcano' : 'Monorail (no power)'), use: () => rideMonorail(1) });
}
function makePod() {
  const g = new THREE.Group();
  const prof = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; prof.push(new THREE.Vector2(1.35 * Math.pow(Math.sin(Math.PI * t), 0.42), (t - 0.5) * 10)); }
  const shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), M.white);
  shell.rotation.x = Math.PI / 2; shell.scale.set(1, 1, 0.92); shell.position.y = 1.55; shell.castShadow = true; g.add(shell);
  const band = new THREE.Mesh(new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p.x * 1.012, p.y * 0.86)), 24, -1.0, 2.0), new THREE.MeshStandardMaterial({ color: 0x0b0d10, emissive: 0xffd7a0, emissiveIntensity: 0, roughness: 0.15 }));
  band.rotation.x = Math.PI / 2; band.rotation.y = 0; band.position.y = 1.75; band.scale.set(1, 1, 0.55); g.add(band);
  const band2 = band.clone(); band2.rotation.z = Math.PI; g.add(band2);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.16, 8.2), M.red); stripe.position.y = 1.05; g.add(stripe);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 2.2), M.red); fin.position.set(0, 2.95, -2.5); fin.rotation.x = -0.25; g.add(fin);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 9), M.darkMetal); skirt.position.y = 0.35; g.add(skirt);
  g.userData.band = band.material;
  band2.material = band.material;
  return g;
}
function placePod(u) {
  const c = MONO.curve;
  const p = c.getPointAt(clamp(u, 0, 1)), t = c.getTangentAt(clamp(u, 0, 1));
  MONO.pod.position.set(p.x, p.y + 0.05, p.z);
  MONO.pod.rotation.set(0, Math.atan2(t.x, t.z), 0);
  MONO.pod.rotateX(-Math.asin(clamp(t.y, -1, 1)));
}

function buildGate() {
  const z0 = POI.gateZ, y0 = POI.plazaY;
  // facade: tall concrete wall with an overhanging blade roof; a 10.4 m opening for the doors and the monorail
  box(17.4, 24, 4, M.concrete, -14.3, y0 - 2, z0 + 1, { cast: true, uvScale: 4, collide: true });
  box(17.4, 24, 4, M.concrete, 14.3, y0 - 2, z0 + 1, { cast: true, uvScale: 4, collide: true });
  box(11.2, 12.5, 4, M.concrete, 0, y0 + 9.5, z0 + 1, { cast: true, uvScale: 4 });
  addHole(0, z0 - 4, 5.6, 8.5, 0, y0 - 1.5, y0 + 11);
  const blade = box(30, 0.9, 12, M.white, 0, y0 + 13.5, z0 + 6.5, { cast: true });
  blade.rotation.x = -0.08;
  for (const sx of [-13, 13]) cyl(0.35, 0.35, 13.5, M.concrete, sx, y0, z0 + 11, { seg: 12, cast: true, collide: true });
  // the two sliding blast doors
  const doorMat = M.metalPanel;
  const dl = box(5.2, 9.5, 1.0, doorMat, -2.6, y0, z0 + 3.4, { cast: true });
  const dr = box(5.2, 9.5, 1.0, doorMat, 2.6, y0, z0 + 3.4, { cast: true });
  const frame = box(12.4, 1.2, 1.4, M.darkMetal, 0, y0 + 9.5, z0 + 3.4, {});
  void frame;
  const gateObs = addBoxObs(0, z0 + 3.4, 5.2, 0.6, 0, y0, y0 + 9.5, { id: 'gateDoor' });
  emblem(3.4, 0, y0 + 11.6, z0 + 3.05, 0, scene, 0.4);
  const word = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.3), new THREE.MeshStandardMaterial({ map: textTex([{ text: 'SYNDROME', color: '#f2ede2' }], { size: 130 }), transparent: true, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.25 }));
  word.material.emissiveMap = word.material.map; word.position.set(0, y0 + 17.8, z0 + 3.05); scene.add(word);
  // beacons + floods
  for (const sx of [-21, 21]) {
    const b = mesh(new THREE.SphereGeometry(0.35, 12, 8), M.redGlow.clone(), sx, y0 + 21.5, z0 + 3.2);
    ANIM.push((dt, t) => { b.material.emissiveIntensity = (Math.sin(t * 3 + sx) > 0.6 ? 6 : 0.3); });
    addLight(sx * 0.7, y0 + 2.5, z0 + 6, 0xffd2a0, 30, 16, { on: () => GAME.power });
  }
  addLight(0, y0 + 9, z0 + 8, 0xff3a22, 40, 22, { flicker: 3, on: () => !GAME.power });
  // plaza dressing: guard booth, crates, a parked jeep
  box(3, 2.6, 2.4, M.white, 11, y0, z0 + 22, { cast: true, collide: true });
  box(3.2, 0.25, 2.6, M.black, 11, y0 + 2.6, z0 + 22, {});
  box(2.6, 1.0, 0.05, M.glassDark, 11, y0 + 1.3, z0 + 23.2, {});
  for (let i = 0; i < 6; i++) box(1.4, 1.2, 1.4, M.wood, -12 + (i % 3) * 1.5, y0 + Math.floor(i / 3) * 1.2, z0 + 18 + rr(-0.2, 0.2), { cast: true, collide: i < 3, ry: rr(-0.1, 0.1) });
  const jeep = new THREE.Group(); jeep.position.set(-8, y0, z0 + 28); jeep.rotation.y = 0.5; scene.add(jeep);
  const jb = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 4.2), M.white); jb.position.y = 1.0; jb.castShadow = true; jeep.add(jb);
  const jw = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 0.06), M.glassDark); jw.position.set(0, 1.75, 0.6); jw.rotation.x = -0.4; jeep.add(jw);
  for (const [wx, wz] of [[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14), M.black); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); jeep.add(w); }
  addCircleObs(-8, z0 + 28, 2.2, y0, y0 + 2);
  // the gate opens once main power is back
  const GATE = { open: 0, obs: gateObs };
  ANIM.push((dt) => {
    const target = GAME.power ? 1 : 0;
    GATE.open = damp(GATE.open, target, 0.6, dt);
    dl.position.x = -2.6 - GATE.open * 5.1; dr.position.x = 2.6 + GATE.open * 5.1;
    gateObs.y1 = GATE.open > 0.6 ? -999 : y0 + 9.5;
  });
  addInteract({ pos: { x: 0, y: y0 + 1.6, z: z0 + 5 }, r: 4, when: () => !GAME.power, prompt: 'Main gate (sealed, no power)', use: () => note('Blast doors, sealed from inside. There must be another way in.') });
  // searchlight on the facade top
  addSearchlight(-16, y0 + 22.5, z0 + 3.5, { baseYaw: Math.PI, sweep: 0.9, speed: 0.22, pitch: -0.42, range: 70 });
}
function addSearchlight(x, y, z, o) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); scene.add(grp);
  const head = new THREE.Group(); grp.add(head);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.2, 16), M.darkMetal); can.rotation.x = Math.PI / 2; head.add(can);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.52, 20), M.whiteGlow.clone()); lens.position.z = 0.61; head.add(lens);
  const spot = new THREE.SpotLight(0xe8f0ff, 9000, o.range * 1.4, 0.16, 0.45, 2);
  spot.position.set(0, 0, 0.7); head.add(spot); head.add(spot.target); spot.target.position.set(0, 0, 10);
  const coneLen = o.range;
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.5, Math.tan(0.16) * coneLen, coneLen, 24, 1, true).translate(0, -coneLen / 2, 0).rotateX(-Math.PI / 2), beamMaterial(0xcfe0ff, 0.09));
  cone.position.z = 0.65; head.add(cone);
  const sl = { grp, head, spot, cone, lens, ...o, yaw: o.baseYaw, pitch: o.pitch, alarmed: 0 };
  SECURITY.searchlights.push(sl);
  return sl;
}
function beamMaterial(color, strength, far = 2000) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength }, uFar: { value: far } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying float vAlong; varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
        vAlong = position.z; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uStrength, uFar; varying vec3 vN; varying vec3 vV; varying float vAlong; varying vec3 vW;
      void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float a = f * uStrength * exp(-vAlong * 0.035) * smoothstep(0.0, 2.0, vAlong);
        float d = length(vW - cameraPosition); a *= smoothstep(0.8, 6.0, d) * smoothstep(uFar, uFar * 0.6, d);
        gl_FragColor = vec4(uColor * a, 1.0); }`,
  });
}

function buildBattery() {
  const P = POI.battery, y = terrainHeight(P.x, P.z);
  const outA = Math.atan2(P.z, P.x);           // faces the sea
  const yaw = Math.atan2(Math.cos(outA), Math.sin(outA));
  const g = new THREE.Group(); g.position.set(P.x, y, P.z); g.rotation.y = yaw; scene.add(g);
  const local = (lx, lz) => ({ x: P.x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z: P.z - lx * Math.sin(yaw) + lz * Math.cos(yaw) });
  const bunker = new THREE.Mesh(new THREE.BoxGeometry(12, 3.2, 7), M.concrete); bunker.position.set(0, 1.6, -5); bunker.castShadow = true; bunker.receiveShadow = true; g.add(bunker);
  const bp = local(0, -5); addBoxObs(bp.x, bp.z, 6, 3.5, -yaw, y, y + 3.2);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 0.1), M.amberGlow); slot.position.set(0, 2.3, -1.45); g.add(slot);
  addLight(local(0, -0.5).x, y + 2.3, local(0, -0.5).z, 0xffa040, 18, 12, { flicker: 3 });
  // two launchers
  for (const sx of [-4.5, 4.5]) {
    const base = new THREE.Group(); base.position.set(sx, 0, 3.5); g.add(base);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 1.2, 16), M.darkMetal); ped.position.y = 0.6; base.add(ped);
    const rack = new THREE.Group(); rack.position.y = 1.6; rack.rotation.x = -0.65; base.add(rack);
    for (let k = -1; k <= 1; k++) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 5.5), M.darkMetal); rail.position.set(k * 0.75, 0, 0); rack.add(rail);
      if (!(sx > 0 && k > -1)) {
        const mis = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.6, 12), M.white); mis.rotation.x = Math.PI / 2; mis.position.set(k * 0.75, 0.3, 0.2); rack.add(mis);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 12), M.red); tip.rotation.x = Math.PI / 2; tip.position.set(k * 0.75, 0.3, 2.85); rack.add(tip);
      }
    }
    const lp = local(sx, 3.5); addCircleObs(lp.x, lp.z, 1.6, y, y + 3);
    ANIM.push((dt, t) => { base.rotation.y = Math.sin(t * 0.07 + sx) * 0.5; });
  }
  // radar dish
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 6, 8), M.darkMetal); mast.position.set(5, 3.2 + 3, -6.5); g.add(mast);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(2, 20, 10, 0, TAU, 0, 0.9), M.white); dish.material = M.white.clone(); dish.material.side = THREE.DoubleSide;
  const dg = new THREE.Group(); dg.position.set(5, 9.4, -6.5); dg.add(dish); dish.rotation.x = Math.PI / 2 + 0.4; g.add(dg);
  ANIM.push((dt) => { dg.rotation.y += dt * (GAME.power ? 0.9 : 0.25); });
  const beacon = mesh(new THREE.SphereGeometry(0.18, 8, 6), M.redGlow.clone(), 0, 0, 0, dg); beacon.position.set(0, 0.6, 0);
  // searchlight tower
  const tw = local(-5.5, -6.5);
  for (const [ox, oz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) cyl(0.08, 0.08, 9, M.darkMetal, tw.x + ox, y + 3.2, tw.z + oz, { seg: 6 });
  box(2.4, 0.2, 2.4, M.darkMetal, tw.x, y + 12.2, tw.z, {});
  addSearchlight(tw.x, y + 13.2, tw.z, { baseYaw: yaw + Math.PI, sweep: 1.2, speed: 0.17, pitch: -0.28, range: 85 });
  // terminal in the bunker slot
  const tp = local(-3, -1.2);
  addInteract({ pos: { x: tp.x, y: y + 1.6, z: tp.z }, prompt: 'Read the battery log', use: () => openLog('battery') });
}

function buildRadio() {
  const P = POI.radio, y = terrainHeight(P.x, P.z);
  const H2 = 34;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, H2, 6), M.red);
    const bx = Math.cos(a) * 1.6, bz = Math.sin(a) * 1.6;
    leg.position.set(P.x + bx * 0.5, y + H2 / 2, P.z + bz * 0.5); leg.rotation.set(bz * 0.025, 0, -bx * 0.025); leg.castShadow = true; scene.add(leg);
  }
  for (let hh = 3; hh < H2; hh += 3.2) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6 * (1 - hh / H2 * 0.5), 0.05, 4, 3), M.white); ring.rotation.x = Math.PI / 2; ring.position.set(P.x, y + hh, P.z); scene.add(ring);
  }
  const tip = mesh(new THREE.SphereGeometry(0.4, 10, 8), M.redGlow.clone(), P.x, y + H2 + 0.4, P.z);
  ANIM.push((dt, t) => { tip.material.emissiveIntensity = (t % 2) < 0.25 ? 8 : 0.2; });
  addLight(P.x, y + H2, P.z, 0xff2010, 30, 30, { flicker: 0, on: () => (performance.now() / 1000 % 2) < 0.25 });
  box(3.2, 2.6, 2.6, M.concrete, P.x + 4, y, P.z + 1, { cast: true, collide: true });
  addInteract({ pos: { x: P.x + 4, y: y + 1.5, z: P.z + 2.4 }, prompt: 'Read the radio log', use: () => openLog('radio') });
  addCircleObs(P.x, P.z, 1.6, y, y + H2);
}

function buildWrecks() {
  // Helen's jet: tail and a wing on the beach
  {
    const P = POI.planeWreck, y = terrainHeight(P.x, P.z);
    const g = new THREE.Group(); g.position.set(P.x, y - 0.3, P.z); g.rotation.y = 0.8; scene.add(g);
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.0, 6, 16, 1, true), M.white.clone()); fus.material.side = THREE.DoubleSide; fus.rotation.z = Math.PI / 2 - 0.15; fus.position.y = 0.9; fus.castShadow = true; g.add(fus);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3, 2.4), M.white); fin.position.set(2.8, 2.6, 0); fin.rotation.z = -0.35; g.add(fin);
    const burn = new THREE.Mesh(new THREE.CircleGeometry(4, 20), new THREE.MeshBasicMaterial({ color: 0x050403, transparent: true, opacity: 0.6, depthWrite: false })); burn.rotation.x = -Math.PI / 2; burn.position.y = 0.32; g.add(burn);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(5, 0.15, 1.6), M.white); wing.position.set(-4, 0.4, 3); wing.rotation.set(0.1, 0.6, 0.2); g.add(wing);
    addCircleObs(P.x, P.z, 2.6, y, y + 3);
    addInteract({ pos: { x: P.x, y: y + 1.4, z: P.z }, r: 5, prompt: 'Look at the wreck', use: () => findSecret('jet') });
  }
  // Omnidroid v8 in its clearing
  {
    const P = POI.omni, y = terrainHeight(P.x, P.z);
    const g = new THREE.Group(); g.position.set(P.x, y, P.z); scene.add(g);
    const body = new THREE.Mesh(new THREE.SphereGeometry(4.2, 32, 20), M.black); body.position.y = 2.6; body.rotation.z = 0.4; body.castShadow = true; g.add(body);
    const band = new THREE.Mesh(new THREE.TorusGeometry(4.25, 0.25, 8, 40), M.darkMetal); band.position.y = 2.6; band.rotation.set(Math.PI / 2 + 0.4, 0, 0); g.add(band);
    for (let i = 0; i < 6; i++) {
      const eye = mesh(new THREE.SphereGeometry(0.28, 10, 8), M.redGlow.clone(), 0, 0, 0, g);
      const a = i / 6 * 1.4 - 0.7;
      eye.position.set(Math.sin(a) * 4.1, 3.6 + Math.cos(a) * 0.3, Math.cos(a) * 4.1 - 0.4);
      eye.material.emissiveIntensity = i === 2 ? 2.5 : 0.08;
      if (i === 2) ANIM.push((dt, t) => { eye.material.emissiveIntensity = Math.sin(t * 1.3) > 0.2 ? 3 : 0.1; });
    }
    // ripped power socket
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.8, 16, 1, true), M.darkMetal); sock.position.set(-2.6, 4.6, 1.0); sock.rotation.z = 0.9; g.add(sock);
    const core = mesh(new THREE.SphereGeometry(0.6, 12, 8), M.blueGlow.clone(), -2.4, 4.4, 0.9, g);
    core.material.emissiveIntensity = 0.6;
    FX_POINTS.sparks.push({ x: P.x - 2.4, y: y + 4.6, z: P.z + 0.9 });
    // legs
    const V3 = (x, yy, z) => new THREE.Vector3(x, yy, z);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.5, ca = Math.cos(a), sa = Math.sin(a);
      const hip = V3(ca * 3.4, 2.2, sa * 3.4), knee = V3(ca * 8, i === 2 ? 1.2 : rr(3.6, 5.2), sa * 8), foot = V3(ca * 12.5, 0.25, sa * 12.5);
      rod(hip, knee, 0.34, M.black, g, 0.28);
      mesh(new THREE.SphereGeometry(0.42, 12, 8), M.darkMetal, knee.x, knee.y, knee.z, g, { cast: true });
      if (i === 2) { rod(V3(ca * 9.5 + sa * 2, 0.3, sa * 9.5 - ca * 2), V3(ca * 14 + sa * 3.5, 0.3, sa * 14 - ca * 3.5), 0.26, M.black, g, 0.12); continue; }
      rod(knee, foot, 0.28, M.black, g, 0.14);
      for (let k = 0; k < 3; k++) { const ka = a + (k - 1) * 0.7; rod(foot, V3(foot.x + Math.cos(ka) * 1.2, 0.05, foot.z + Math.sin(ka) * 1.2), 0.12, M.darkMetal, g, 0.02); }
    }
    addCircleObs(P.x, P.z, 4.3, y, y + 7);
    addInteract({ pos: { x: P.x - 2.4, y: y + 4.4, z: P.z + 0.9 }, r: 7, prompt: 'Look at the torn-out power socket', use: () => findSecret('omni8') });
    addLight(P.x - 2.4, y + 5, P.z + 0.9, 0x7fbfff, 8, 9, { flicker: 2 });
    // fallen trunks around
    for (let i = 0; i < 5; i++) {
      const a = rr(0, TAU), d = rr(7, 13), x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
      const L = rr(6, 11), t = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, L, 8), deadMat || M.black);
      t.position.set(x, terrainHeight(x, z) + 0.35, z); t.rotation.set(Math.PI / 2, 0, rr(0, TAU)); t.castShadow = true; scene.add(t);
    }
  }
  // two Velocipods that met each other
  {
    const P = POI.velo, y = terrainHeight(P.x, P.z);
    for (let k = 0; k < 2; k++) {
      const v = makeVelocipod(false);
      v.position.set(P.x + (k ? 2.4 : -1.6), y + (k ? 1.0 : 0.6), P.z + (k ? 1.5 : -1)); v.rotation.set(k ? 0.6 : -0.3, k * 2, k ? -0.4 : 0.5); scene.add(v);
    }
    FX_POINTS.sparks.push({ x: P.x, y: y + 1.4, z: P.z });
    FX_POINTS.smoke.push({ x: P.x, y: y + 1, z: P.z, k: 0.4 });
    addCircleObs(P.x, P.z, 3.5, y, y + 3);
    addInteract({ pos: { x: P.x, y: y + 1.2, z: P.z }, r: 5, prompt: 'Look at the tangled Velocipods', use: () => findSecret('velo') });
  }
}
function makeVelocipod(lit = true) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 12, 0, TAU, 0, Math.PI * 0.62), M.white); body.scale.set(1, 0.55, 1.2); g.add(body);
  const under = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 8, 0, TAU, Math.PI * 0.62, Math.PI * 0.38), M.darkMetal); under.scale.set(1, 0.55, 1.2); g.add(under);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6), M.black); seat.position.set(0, 0.5, -0.2); g.add(seat);
  const ring = new THREE.Group(); ring.position.y = 0.25; g.add(ring);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.09, 6, 36), M.darkMetal); rim.rotation.x = Math.PI / 2; ring.add(rim);
  const blades = new THREE.Group(); ring.add(blades);
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 1.1), M.metal); b.position.set(Math.cos(i / 6 * TAU) * 1.55, 0, Math.sin(i / 6 * TAU) * 1.55); b.rotation.y = -i / 6 * TAU; b.rotation.z = 0.35; blades.add(b); }
  const lamp = mesh(new THREE.SphereGeometry(0.14, 8, 6), lit ? M.redGlow : M.darkMetal, 0, 0, 1.2, g);
  void lamp;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.blades = blades; g.userData.ring = ring;
  return g;
}

function buildBirds() {
  const spots = [
    [POI.J1.x + 3, POI.J1.z - 3], [-96, 118], [POI.omni.x - 16, POI.omni.z + 6], [6, POI.plaza.z + 32], [POI.pool.x + 12, POI.pool.z + 4],
  ];
  for (const [x, z] of spots) {
    const y = terrainHeight(x, z);
    const post = cyl(0.07, 0.09, 2.6, M.darkMetal, x, y, z, { seg: 6, collide: true });
    void post;
    const bird = new THREE.Group(); bird.position.set(x, y + 2.6, z); scene.add(bird);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), M.metal); body.scale.set(0.8, 0.9, 1.3); body.position.y = 0.25; bird.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 4), M.darkMetal); tail.rotation.x = -Math.PI / 2 - 0.5; tail.position.set(0, 0.2, -0.5); bird.add(tail);
    const head = new THREE.Group(); head.position.set(0, 0.55, 0.25); bird.add(head);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), M.white); head.add(hd);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.55, 8), M.orange); beak.rotation.x = Math.PI / 2; beak.position.z = 0.36; head.add(beak);
    const eyeMat = M.redGlow.clone(); eyeMat.emissiveIntensity = 3;
    const eye = mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeMat, 0.12, 0.05, 0.12, head);
    const eye2 = mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeMat, -0.12, 0.05, 0.12, head);
    void eye; void eye2;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.tan(0.4) * 7, 7, 20, 1, true).translate(0, -3.5, 0).rotateX(-Math.PI / 2), beamMaterial(0xff4030, 0.014, 45));
    cone.position.z = 0.1; head.rotation.order = 'YXZ'; head.add(cone);
    SECURITY.birds.push({ x, y: y + 3.2, z, head, eyeMat, cone, yaw: rr(0, TAU), squawk: 0, seen: 0 });
  }
}

function buildLavaLook() {
  const P = POI.lavaLook, y = terrainHeight(P.x, P.z);
  box(6, 0.3, 4, M.wood, P.x, y + 0.6, P.z - 1, { ry: 0.3 });
  floorOBB(P.x, P.z - 1, 3, 2, 0.3, y + 0.9, y + 0.9, { kind: 'wood' });
  for (const sx of [-2.8, 2.8]) cyl(0.05, 0.05, 1.1, M.black, P.x + sx * Math.cos(0.3), y + 0.9, P.z - 1 - sx * Math.sin(0.3) - 1.8, { seg: 6 });
  box(6, 0.06, 0.06, M.black, P.x, y + 1.95, P.z - 2.9, { ry: 0.3 });
  addBoxObs(P.x - Math.sin(0.3) * 1.9, P.z - 1 - Math.cos(0.3) * 1.9, 3, 0.1, -0.3, y, y + 2);
  addInteract({ pos: { x: P.x, y: y + 2.2, z: P.z - 2 }, r: 3.2, prompt: 'Read the survey plaque', use: () => openLog('lavaPlaque') });
}

// ============================================================ the summit: rim station, crater road end, iris
const IRIS = { open: 0, target: 0, petals: [], floor: null };
function buildRimAndCrater() {
  // Rim station: cantilevered deck on the rim beside the road cut, looking into the crater
  const R = POI.rimTop, a = R.a;
  // a balcony at the inner end of the road cut, hanging over the crater
  const st = fromV(RIM_R - 5.2, a);
  const yaw = Math.atan2(VX - st.x, VZ - st.z);     // faces the crater
  const deckH = R.y + 0.25;
  const deck = box(9, 0.45, 7, M.concrete, st.x, deckH - 0.45, st.z, { ry: yaw, cast: true });
  void deck;
  floorOBB(st.x, st.z, 4.5, 3.5, yaw, deckH, deckH, { kind: 'stone' });
  const fw = { x: st.x + Math.sin(yaw) * 3.4, z: st.z + Math.cos(yaw) * 3.4 };
  box(9, 1.05, 0.06, M.glass, fw.x, deckH, fw.z, { ry: yaw });
  addBoxObs(fw.x, fw.z, 4.5, 0.15, -yaw, deckH, deckH + 1.1);
  for (const s of [-1, 1]) { const q = { x: st.x + Math.cos(yaw) * 4.45 * s, z: st.z - Math.sin(yaw) * 4.45 * s }; addBoxObs(q.x, q.z, 0.15, 3.5, -yaw, deckH, deckH + 1.1); box(0.06, 1.05, 7, M.glass, q.x, deckH, q.z, { ry: yaw }); }
  cyl(0.6, 0.9, deckH - terrainHeight(st.x, st.z) + 6, M.concrete, st.x, terrainHeight(st.x, st.z) - 6, st.z, { seg: 12 });
  // telescope
  const tp = { x: st.x + Math.sin(yaw) * 2.2 + Math.cos(yaw) * 2, z: st.z + Math.cos(yaw) * 2.2 - Math.sin(yaw) * 2 };
  cyl(0.06, 0.12, 1.1, M.black, tp.x, deckH, tp.z, { seg: 8 });
  const scope = mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.0, 12), M.metal, tp.x, deckH + 1.3, tp.z); scope.rotation.set(Math.PI / 2 - 0.35, 0, 0); scope.rotation.y = yaw; scope.rotation.order = 'YXZ';
  addInteract({ pos: { x: tp.x, y: deckH + 1.4, z: tp.z }, r: 2.2, prompt: 'Look through the telescope', use: () => useTelescope() });
  // terminal + lamp
  const kp = { x: st.x - Math.cos(yaw) * 3 - Math.sin(yaw) * 2, z: st.z + Math.sin(yaw) * 3 - Math.cos(yaw) * 2 };
  box(0.8, 1.2, 0.5, M.black, kp.x, deckH, kp.z, { ry: yaw, collide: true });
  mesh(new THREE.PlaneGeometry(0.6, 0.4), M.amberGlow, kp.x + Math.sin(yaw) * 0.26, deckH + 1.0, kp.z + Math.cos(yaw) * 0.26, scene, { ry: yaw });
  addInteract({ pos: { x: kp.x, y: deckH + 1.2, z: kp.z }, prompt: 'Read the rim station log', use: () => openLog('rim') });
  lampPost(st.x - Math.sin(yaw) * 3, st.z - Math.cos(yaw) * 3, { y: deckH, h: 2.8, intensity: 26, broken: false });
  POI.rimStation = { x: st.x, y: deckH, z: st.z, yaw };

  // crater floor: concrete collar around the iris, the iris petals, steam vents
  const collar = new THREE.Mesh(new THREE.RingGeometry(SILO_R - 0.1, SILO_R + 2.2, 64, 1), M.concreteDark); collar.rotation.x = -Math.PI / 2; collar.position.set(VX, CRATER_Y + 0.08, VZ); collar.receiveShadow = true; scene.add(collar);
  const ringGlow = new THREE.Mesh(new THREE.RingGeometry(SILO_R + 0.1, SILO_R + 0.45, 64, 1), M.lavaGlow.clone()); ringGlow.material.emissiveIntensity = 2.5; ringGlow.rotation.x = -Math.PI / 2; ringGlow.position.set(VX, CRATER_Y + 0.1, VZ); scene.add(ringGlow);
  const N = 12;
  const petalShape = new THREE.Shape();
  const a0 = -TAU / N / 2 - 0.06, a1 = TAU / N / 2 + 0.06;
  petalShape.moveTo(0, 0); petalShape.lineTo(Math.cos(a0) * (SILO_R + 0.4), Math.sin(a0) * (SILO_R + 0.4)); petalShape.absarc(0, 0, SILO_R + 0.4, a0, a1, false); petalShape.lineTo(0, 0);
  const petalGeo = new THREE.ExtrudeGeometry(petalShape, { depth: 1.6, bevelEnabled: false, curveSegments: 6 });
  petalGeo.rotateX(Math.PI / 2);
  { const uv = petalGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.22, uv.getY(i) * 0.22); }
  for (let i = 0; i < N; i++) {
    const p = new THREE.Mesh(petalGeo, i % 2 ? M.metalPanel : M.darkMetal);
    const ang = (i / N) * TAU;
    const pg = new THREE.Group(); pg.position.set(VX, CRATER_Y - 0.02 + (i % 2) * 0.03, VZ); pg.rotation.y = -ang; pg.add(p);
    p.castShadow = true; p.receiveShadow = true;
    scene.add(pg); IRIS.petals.push(pg);
  }
  IRIS.floor = floorCircle(VX, VZ, SILO_R, CRATER_Y, { kind: 'metal', enabled: () => IRIS.open < 0.05 });
  ANIM.push((dt) => {
    IRIS.open = damp(IRIS.open, IRIS.target, 0.35, dt);
    IRIS.petals.forEach((pg, i) => { const ang = (i / N) * TAU; pg.position.x = VX + Math.cos(ang) * IRIS.open * (SILO_R + 1); pg.position.z = VZ + Math.sin(ang) * IRIS.open * (SILO_R + 1); pg.position.y = CRATER_Y - 0.02 - IRIS.open * 1.8; });
  });
  for (let i = 0; i < 7; i++) {
    const a2 = rr(0, TAU), d = rr(25, 32), p = fromV(d, a2);
    FX_POINTS.steam.push({ x: p.x, y: CRATER_Y + 0.2, z: p.z, k: rr(0.6, 1.2) });
    const pud = new THREE.Mesh(new THREE.CircleGeometry(rr(0.8, 1.8), 16), lavaMaterial(1, 0, 0.8)); pud.rotation.x = -Math.PI / 2; pud.position.set(p.x + 1.5, terrainHeight(p.x + 1.5, p.z) + 0.06, p.z); scene.add(pud);
  }
  addLight(VX, CRATER_Y + 6, VZ, 0xff5016, 900, 70, { flicker: 1 });
}

// Columnar basalt along the cliff band the falls pour over
function buildScarpColumns() {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0);
  const list = [];
  for (let a = SCARP_A - 0.5; a < SCARP_A + 0.5; a += 0.0085) {
    if (Math.abs(a - SCARP_A) < 0.032 || Math.abs(a - POI.caveA) < 0.026) continue;
    const edge = smoothstep(0.5, 0.38, Math.abs(a - SCARP_A));
    if (edge <= 0.05) continue;
    for (let row = 0; row < 2; row++) {
      const r = 191.6 + row * 1.4 + rr(-0.3, 0.3), p = fromV(r, a + rr(-0.003, 0.003));
      const top = terrainHeight(fromV(185.5, a).x, fromV(185.5, a).z), base = terrainHeight(p.x, p.z);
      const h = (top - base) * (row ? rr(0.35, 0.8) : rr(0.85, 1.05)) * edge;
      if (h < 1.5) continue;
      list.push({ x: p.x, y: base - 1.2, z: p.z, rad: rr(0.7, 1.1), h: h + 1.2, ry: rr(0, TAU), tx: rr(-0.05, 0.05), tz: rr(-0.05, 0.05) });
    }
  }
  const im = new THREE.InstancedMesh(geo, M.rock, list.length);
  list.forEach((c, i) => { _e.set(c.tx, c.ry, c.tz); _q.setFromEuler(_e); _m4.compose(_v.set(c.x, c.y, c.z), _q, _s.set(c.rad, c.h, c.rad)); im.setMatrixAt(i, _m4); addCircleObs(c.x, c.z, c.rad * 0.9, c.y, c.y + c.h); });
  im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im);
}
function buildWaterfallDoor() {
  const D = POI.door, a = SCARP_A, yaw = Math.atan2(POI.dirS.x, POI.dirS.z);   // faces outward
  const y = POI.ledgeY;
  const g = new THREE.Group(); g.position.set(D.x, y, D.z); g.rotation.y = yaw; scene.add(g);
  const frameMat = M.concreteDark;
  for (const [px, py, w, h] of [[-2.55, 2.8, 0.9, 5.6], [2.55, 2.8, 0.9, 5.6], [0, 5.1, 6.0, 1.0]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2.2), frameMat); b.position.set(px, py, 0); b.castShadow = true; g.add(b);
  }
  // rock collar to hide the cut in the cliff
  for (let i = 0; i < 9; i++) {
    const ang = (i / 8) * Math.PI;
    const rk = new THREE.Mesh(makeRock(40 + i, 0.8), M.rockDark);
    rk.position.set(Math.cos(ang) * 4.3, Math.sin(ang) * 4.6 + 0.4, -0.8); rk.scale.setScalar(rr(1.4, 2.2)); g.add(rk);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.6, 0.3), M.metalPanel); door.position.set(0, 2.3, -0.3); g.add(door);
  const seam = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.08, 0.1), M.amberGlow); seam.position.set(0, 4.65, -0.05); g.add(seam);
  const pad = mesh(new THREE.BoxGeometry(0.35, 0.5, 0.1), M.black, 2.55, 1.5, 0.95, g);
  const padLed = mesh(new THREE.PlaneGeometry(0.2, 0.08), M.redGlow.clone(), 2.55, 1.65, 1.01, g);
  addLight(D.x + POI.dirS.x * 1.5, y + 4.2, D.z + POI.dirS.z * 1.5, 0xffb060, 16, 9, { flicker: 3, zone: 'any' });
  addLight(POI.pool.x, POI.poolY + 4, POI.pool.z, 0x9fbfff, 26, 26);
  const st = { open: 0, target: 0 };
  const obs = addBoxObs(D.x, D.z, 2.2, 0.4, -yaw, y, y + 4.6, { id: 'wfDoor' });
  st.door = door;
  ANIM.push((dt) => {
    st.open = damp(st.open, st.target, 2.2, dt);
    if (st.broken) { door.position.set(0, 2.3 - st.open * 2.2, -0.3 - st.open * 3.2); door.rotation.x = -st.open * 1.45; }
    else { door.position.y = 2.3 + st.open * 4.4; door.rotation.x = 0; }
    obs.y1 = st.open > 0.7 ? -999 : y + 4.6;
    padLed.material.emissive.set(st.target ? 0x3dff8a : 0xff2a18);
  });
  void pad;
  addInteract({ pos: { x: D.x + POI.dirS.x * 1.2, y: y + 1.6, z: D.z + POI.dirS.z * 1.2 }, r: 3, when: () => !st.target,
    prompt: 'Try the steel door', use: () => { STORY.flags.triedDoor = true; note(STORY.mission >= 4 ? 'Locked from inside. The hinges look weak. Punch it.' : 'Locked tight.'); } });
  POI.wfDoorState = st;
  void a;
}
