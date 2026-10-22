// ============================================================ the lair inside the volcano
const DOORS = [];
const SCREENS = {};
const LIFT = { y: BASE_Y, target: BASE_Y, moving: false, floor: null, cage: null, x: 19.6, z: VZ };
const RING_Y = 124;
const LAVA_WALL = { open: 0, target: 0 };
const FIELD = { x: -41, z: -58, r: 2.6 };
const IB_BOOTS = [];

// Terrain cut-outs for every place the lair meets the outside. Called before the terrain mesh is built.
function planHoles() {
  const dS = POI.dirS, yawS = Math.atan2(dS.x, dS.z);
  const dh = fromV(190.5, SCARP_A);
  addHole(dh.x, dh.z, 2.3, 2.3, yawS, POI.ledgeY - 0.6, POI.ledgeY + 5.2);
  const ca = POI.caveA, yawC = Math.atan2(Math.cos(ca), Math.sin(ca)), ch = fromV(189.2, ca);
  addHole(ch.x, ch.z, 1.9, 2.9, yawC, POI.caveY - 0.15, POI.caveY + 3.1);
  addHole(-24.5, -84.5, 2.1, 4.4, 0, CRATER_Y - 6, CRATER_Y + 4);
}

// ---- builders
function room(id, x0, x1, z0, z1, h, o = {}) {
  const y = o.y ?? BASE_Y;
  const fm = o.floor || M.concrete, wm = o.wall || M.concrete, cm = o.ceil || M.concreteDark;
  if (!o.noFloor) box(x1 - x0, 0.3, z1 - z0, fm, (x0 + x1) / 2, y - 0.3, (z0 + z1) / 2, { uvScale: o.floorUV || 3 });
  if (!o.noCeil) box(x1 - x0, 0.4, z1 - z0, cm, (x0 + x1) / 2, y + h, (z0 + z1) / 2, { uvScale: 4 });
  const sides = { n: [z0, x0, x1, 'x'], s: [z1, x0, x1, 'x'], w: [x0, z0, z1, 'z'], e: [x1, z0, z1, 'z'] };
  for (const k of ['n', 's', 'w', 'e']) {
    if (o.skip && o.skip.includes(k)) continue;
    const [c, a0, a1, axis] = sides[k];
    const gaps = (o.doors || []).filter((d) => d.side === k).sort((p, q) => p.a - q.a);
    const T = 0.4, off = k === 'n' || k === 'w' ? -T / 2 : T / 2;
    const mat = (o.wallMats && o.wallMats[k]) || wm;
    const seg = (s0, s1, yb, yt) => {
      if (s1 - s0 < 0.01 || yt - yb < 0.01) return;
      const len = s1 - s0, mid = (s0 + s1) / 2;
      if (axis === 'x') { box(len, yt - yb, T, mat, mid, yb, c + off, { uvScale: 3 }); addBoxObs(mid, c + off, len / 2, T / 2 + 0.02, 0, yb, yt); }
      else { box(T, yt - yb, len, mat, c + off, yb, mid, { uvScale: 3 }); addBoxObs(c + off, mid, T / 2 + 0.02, len / 2, 0, yb, yt); }
    };
    let cur = a0;
    for (const d of gaps) { seg(cur, d.a, y, y + h); seg(d.a, d.b, y + (d.h || 3.2), y + h); cur = d.b; }
    seg(cur, a1, y, y + h);
  }
  return floorBox(x0, x1, z0, z1, y, { indoor: true, room: id, kind: o.kind || 'concrete', ...(o.floorOpts || {}) });
}
// A rough rock surface facing into a room; displacement goes away from the room so it never blocks the walkway.
function rockSkin(cx, cy, cz, w, h, ry, depth = 1.4, seg = 36, mat = M.rock) {
  const g = new THREE.PlaneGeometry(w, h, seg, Math.max(4, Math.round(seg * h / w)));
  { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 5, uv.getY(i) * h / 5); }
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const edge = Math.min(1, (w / 2 - Math.abs(x)) / 1.5, (h / 2 - Math.abs(y)) / 1.5);
    const d = (0.55 + 0.45 * noise2(x * 0.12 + cx, y * 0.12 + cz)) * depth + 0.35 * noise2(x * 0.6, y * 0.6 + cy);
    p.setZ(i, -Math.max(d, 0) * clamp(edge, 0, 1));
  }
  g.computeVertexNormals();
  const m = mesh(g, mat, cx, cy, cz, scene, { ry });
  m.receiveShadow = true;
  return m;
}
function slideDoor(x, z, axis, width, y, h, o = {}) {
  const panels = [];
  const half = width / 2;
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? half : 0.22, h, axis === 'x' ? 0.22 : half), o.mat || M.metalPanel);
    m.position.set(x + (axis === 'x' ? (s * half) / 2 : 0), y + h / 2, z + (axis === 'z' ? (s * half) / 2 : 0));
    scene.add(m); panels.push({ m, s });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? half : 0.24, 0.14, axis === 'x' ? 0.24 : half), M.red);
    stripe.position.y = -h / 2 + 1.2; m.add(stripe);
  }
  // one obstacle per panel, moving with it, so a jammed door still leaves a gap to squeeze through
  for (const p of panels) p.obs = registerObstacle({ t: 'b', x: p.m.position.x, z: p.m.position.z, hx: axis === 'x' ? half / 2 : 0.16, hz: axis === 'x' ? 0.16 : half / 2, c: 1, s: 0, y0: y, y1: y + h }, x - 4, x + 4, z - 4, z + 4);
  const d = { x, z, y, h, axis, half, panels, open: 0, target: 0, jam: o.jam || 0, locked: o.locked || null, auto: o.auto !== false, wasOpen: false };
  DOORS.push(d);
  return d;
}
function updateDoors(dt, px, py, pz) {
  for (const d of DOORS) {
    const near = Math.hypot(px - d.x, pz - d.z) < 3.6 && Math.abs(py - d.y) < 3.5;
    const locked = d.locked && d.locked();
    d.target = d.force != null ? d.force : (d.auto && near && !locked ? 1 : 0);
    const maxOpen = d.jam && !GAME.power ? d.jam : 1;
    const tgt = Math.min(d.target, maxOpen);
    if (tgt > d.open + 0.2 && !d.wasOpen) { sfxAt('door', d.x, d.y + 1, d.z); d.wasOpen = true; }
    if (tgt < 0.1) d.wasOpen = false;
    d.open = damp(d.open, tgt, 3.2, dt);
    for (const p of d.panels) {
      const off = p.s * (d.half / 2 + d.open * d.half * 0.95);
      if (d.axis === 'x') p.m.position.x = d.x + off; else p.m.position.z = d.z + off;
      p.obs.x = p.m.position.x; p.obs.z = p.m.position.z;
      p.obs.y1 = d.open > 0.97 ? -999 : d.y + d.h;
    }
  }
}
function secCam(x, y, z, yaw, roomId, o = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), M.darkMetal); arm.position.y = 0.2; g.add(arm);
  const head = new THREE.Group(); head.rotation.order = 'YXZ'; g.add(head);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.55), M.white); head.add(body);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 12), M.black); lens.rotation.x = Math.PI / 2; lens.position.z = 0.32; head.add(lens);
  const ledMat = M.redGlow.clone();
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), ledMat); led.position.set(0.09, 0.08, 0.28); head.add(led);
  const range = o.range || 13, fov = o.fov || 0.42;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.tan(fov) * range, range, 24, 1, true).translate(0, -range / 2, 0).rotateX(-Math.PI / 2), beamMaterial(0xff3020, 0.02, 60));
  cone.position.z = 0.3; head.add(cone);
  const c = { g, head, ledMat, cone, x, y, z, yaw, baseYaw: yaw, sweep: o.sweep ?? 0.75, speed: o.speed || 0.45, pitch: o.pitch ?? -0.42, range, fov, room: roomId, phase: rng() * 10 };
  SECURITY.cams.push(c);
  return c;
}
function laser(ax, ay, az, bx, by, bz, onFn, roomId) {
  const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
  const len = a.distanceTo(b);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.25, 0.15), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 5), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  scene.add(m);
  for (const p of [a, b]) mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), M.darkMetal, p.x, p.y, p.z);
  const L = { a, b, mesh: m, on: onFn, room: roomId, active: true };
  SECURITY.lasers.push(L);
  return L;
}
function ceilingLight(x, y, z, w, d, onFn, color = 0xfff1dc, intensity = 30, dist = 16) {
  const mat = M.whiteGlow.clone(); mat.emissive.set(color);
  const m = mesh(new THREE.BoxGeometry(w, 0.08, d), mat, x, y - 0.05, z);
  const a = addLight(x, y - 0.6, z, color, intensity, dist, { on: onFn });
  ANIM.push(() => { mat.emissiveIntensity = onFn() ? 3 : 0.05; });
  return { m, a };
}
function emergencyLight(x, y, z, roomId) {
  const mat = M.redGlow.clone();
  const m = mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, TAU, 0, Math.PI / 2), mat, x, y - 0.02, z, scene, { rx: Math.PI });
  addLight(x, y - 0.5, z, 0xff2a14, 24, 13, { flicker: 3, on: () => !GAME.power || GAME.alarm > 0 });
  ANIM.push((dt, t) => { mat.emissiveIntensity = !GAME.power || GAME.alarm > 0 ? 2 + 3 * Math.max(0, Math.sin(t * 2.2 + x)) : 0.1; });
  void roomId;
  return m;
}
function rockTunnel(pts, radius, roomId, o = {}) {
  // pts: {x, y(floor), z}; tube centre sits above the floor
  const ring = 16, rows = [];
  const pos = [], nrm = [], uv = [], idx = [];
  let dist = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
    let tx = b.x - a.x, tz = b.z - a.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const sx = -tz, sz = tx;
    if (i) dist += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    const cy = p.y + radius * 0.62;
    for (let k = 0; k <= ring; k++) {
      const ang = (k / ring) * TAU;
      const cx = Math.cos(ang), cyy = Math.sin(ang);
      const n = 1 + 0.22 * noise2(dist * 0.25 + k * 0.7, i * 0.3) + 0.1 * noise2(dist * 0.9, k * 1.7);
      const r = radius * n * (cyy < 0 ? 1.1 : 1);
      const x = p.x + sx * cx * r, y = cy + cyy * r * 0.85, z = p.z + sz * cx * r;
      pos.push(x, y, z); nrm.push(-sx * cx, -cyy, -sz * cx); uv.push(k / ring * 4, dist / 3);
    }
    rows.push(i);
  }
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < ring; k++) {
    const a = i * (ring + 1) + k, b = a + ring + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const mat = (o.mat || M.rock).clone(); mat.side = THREE.DoubleSide;
  mesh(g, mat, 0, 0, 0, scene, { receive: true });
  // flat floor ribbon
  const fw = radius * 1.45;
  mesh(sweepProfile(pts.map((p) => ({ x: p.x, y: p.y, z: p.z })), [[-fw / 2, -0.05], [0, 0], [fw / 2, -0.05]]), o.floorMat || M.rockDark, 0, 0, 0, scene, {});
  return floorPath(pts, radius * 0.62, { indoor: true, room: roomId, kind: o.kind || 'rock' });
}
function cylWall(cx, cz, r, y0, y1, gaps, mat, seg = 64) {
  // gaps: [[angle, halfWidth]] in world angle (atan2(dz, dx)); builds inward-facing wall pieces between gaps
  const sorted = gaps.map(([a, hw]) => [wrapAngle(a) - hw, wrapAngle(a) + hw]).sort((p, q) => p[0] - q[0]);
  const spans = [];
  if (!sorted.length) spans.push([-Math.PI, Math.PI]);
  else {
    for (let i = 0; i < sorted.length; i++) { const end = sorted[i][1], next = i + 1 < sorted.length ? sorted[i + 1][0] : sorted[0][0] + TAU; spans.push([end, next]); }
  }
  for (const [a0, a1] of spans) {
    const len = a1 - a0; if (len <= 0.001) continue;
    // three's theta: direction (sin t, cos t) == (cos a, sin a)  ->  t = PI/2 - a
    const g = new THREE.CylinderGeometry(r, r, y1 - y0, Math.max(3, Math.round(seg * len / TAU)), 1, true, Math.PI / 2 - a1, len);
    const m = mesh(g, mat, cx, (y0 + y1) / 2, cz, scene, {});
    m.material = mat; m.material.side = THREE.DoubleSide;
  }
}

function buildBase() {
  LIGHT_ZONE = 'in';
  try { buildBaseInner(); } finally { LIGHT_ZONE = 'out'; }
}
function auxLight(x, y, z, intensity = 26, dist = 16, color = 0xffa860) {
  const m = M.amberGlow.clone(); m.emissiveIntensity = 1.6;
  mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.14, 12), m, x, y, z);
  addLight(x, y - 0.4, z, color, intensity, dist, { on: () => !GAME.power });
}
function buildBaseInner() {
  const Y = BASE_Y;
  const pow = () => GAME.power;
  const noPow = () => !GAME.power;

  // ---------------- waterfall tunnel (rock) -> checkpoint
  const ledgeY = POI.ledgeY;
  const tpts = [fromV(195, SCARP_A), fromV(191, SCARP_A), fromV(182, SCARP_A - 0.005), fromV(168, SCARP_A + 0.012), fromV(152, SCARP_A + 0.018), fromV(138, 2.226), { x: -79, z: -2 }, { x: -75.6, z: -2 }];
  const tp = smoothPath(tpts, 2);
  const totalL = pathLength(tp);
  let acc = 0;
  tp.forEach((p, i) => { if (i) acc += Math.hypot(p.x - tp[i - 1].x, p.z - tp[i - 1].z); p.y = lerp(ledgeY, Y, smoothstep(totalL * 0.15, totalL * 0.85, acc)); });
  const outside = tp.filter((p) => Math.hypot(p.x - VX, p.z - VZ) > 189.6);
  rockTunnel(tp.filter((p) => Math.hypot(p.x - VX, p.z - VZ) <= 191.2), 2.5, 'wfTunnel');
  floorPath(outside.concat([tp[outside.length]]), 1.8, { kind: 'rock' });
  for (let i = 8; i < tp.length - 4; i += 9) {
    const p = tp[i];
    const bm = M.lamp.clone();
    mesh(new THREE.SphereGeometry(0.12, 8, 6), bm, p.x, p.y + 2.6, p.z);
    addLight(p.x, p.y + 2.4, p.z, 0xffb070, 26, 12, { flicker: i % 2 ? 2 : 0, mat: bm, zone: 'any' });
  }
  // concrete collar where the tunnel meets the checkpoint
  room('checkpoint', -76, -60, -10, 6, 6, {
    wall: M.concrete, floor: M.terrazzo, floorUV: 3,
    doors: [{ side: 'w', a: -4, b: 0, h: 3.4 }, { side: 'e', a: -4, b: 0, h: 3.4 }],
  });
  emergencyLight(-68, Y + 6, -2, 'checkpoint');
  auxLight(-64, Y + 5.9, 3.5, 22, 12); auxLight(-73, Y + 5.9, -7, 18, 12);
  ceilingLight(-68, Y + 6, -6, 3, 0.6, pow); ceilingLight(-68, Y + 6, 2, 3, 0.6, pow);
  // guard booth with the log terminal
  box(5, 1.1, 0.6, M.wood, -64.5, Y, 2.6, { collide: true });
  box(5, 0.08, 0.8, M.black, -64.5, Y + 1.1, 2.6, {});
  box(5, 1.8, 0.06, M.glass, -64.5, Y + 1.18, 2.3, {});
  const crt1 = mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), M.white, -63.4, Y + 1.45, 3.1); void crt1;
  mesh(new THREE.PlaneGeometry(0.45, 0.32), M.tealGlow, -63.4, Y + 1.46, 2.84, scene, { ry: Math.PI });
  addInteract({ pos: { x: -63.4, y: Y + 1.5, z: 1.9 }, prompt: 'Read the guard log', use: () => openLog('guard') });
  // scanner arch
  for (const sz of [-4.3, 0.3]) box(0.5, 3.2, 0.5, M.darkMetal, -70, Y, sz, { collide: true });
  box(0.5, 0.4, 5.1, M.darkMetal, -70, Y + 3.2, -2, {});
  const archGlow = mesh(new THREE.BoxGeometry(0.06, 2.9, 0.06), M.redGlow, -70, Y + 1.5, -4.0); void archGlow;
  mesh(new THREE.BoxGeometry(0.06, 2.9, 0.06), M.redGlow, -70, Y + 1.5, 0.0);
  // lockers
  for (let i = 0; i < 6; i++) box(0.9, 2.1, 0.55, M.metalPanel, -74.5 + i * 0.95, Y, -9.4, { collide: true });
  addInteract({ pos: { x: -72, y: Y + 1.2, z: -8.8 }, prompt: 'Search the lockers', use: () => lockerSearch() });
  box(2.4, 0.45, 0.6, M.wood, -73, Y, 4.8, {});
  secCam(-75.4, Y + 5.2, -9.4, 0.65, 'checkpoint', { range: 15, sweep: 0.6 });
  signPlate('SECURITY CHECKPOINT 2', -75.75, Y + 4.5, 3.5, Math.PI / 2, 4.2);

  // ---------------- gauntlet corridor with automatic doors and a laser gate
  room('gauntlet', -60, -26, -4, 0, 4, { wall: M.concrete, floor: M.concreteDark, skip: ['w', 'e'], doors: [{ side: 'n', a: -44.5, b: -41.5, h: 4 }] });
  for (const dx of [-54, -44, -36, -30]) {
    const jam = dx === -36 ? 0.34 : 0;
    const d = slideDoor(dx, -2, 'z', 4, Y, 3.6, { locked: () => GAME.alarm > 0 });
    d.jam = jam;
    box(0.5, 0.4, 4.4, M.darkMetal, dx, Y + 3.6, -2, {});
    emergencyLight(dx + 1.5, Y + 4, -2, 'gauntlet');
  }
  const laserOn = (t) => !GAME.power && (t % 3.6) < 2.2;
  laser(-48.5, Y + 0.45, -3.95, -48.5, Y + 0.45, -0.05, laserOn, 'gauntlet');
  laser(-48.5, Y + 1.3, -3.95, -48.5, Y + 1.3, -0.05, laserOn, 'gauntlet');
  laser(-47.5, Y + 0.85, -3.95, -47.5, Y + 0.85, -0.05, (t) => !GAME.power && ((t + 1.8) % 3.6) < 2.2, 'gauntlet');
  secCam(-27, Y + 3.6, -3.6, -1.1, 'gauntlet', { range: 16, sweep: 0.35, speed: 0.3 });
  ceilingLight(-50, Y + 4, -2, 6, 0.4, pow); ceilingLight(-40, Y + 4, -2, 6, 0.4, pow);

  // ---------------- main hall
  const hall = { x0: -26, x1: 26, z0: -28, z1: 8, h: 24 };
  room('hall', hall.x0, hall.x1, hall.z0, hall.z1, hall.h, {
    floor: M.terrazzo, floorUV: 4, wall: M.concrete, noCeil: true, noFloor: true,
    doors: [{ side: 'w', a: -4, b: 0, h: 3.6 }, { side: 'e', a: -16, b: -12, h: 3.8 }, { side: 's', a: -5, b: 5, h: 8 }, { side: 'n', a: -3.5, b: 3.5, h: 7 }],
  });
  box(52, 0.3, 7.8, M.terrazzo, 0, Y - 0.3, -24.1, { uvScale: 4 });
  box(52, 0.3, 23.8, M.terrazzo, 0, Y - 0.3, -3.9, { uvScale: 4 });
  // rock skins on the long walls, cut around the doorways
  const skinW = (x, ry, za, zb, yb, yt) => rockSkin(x, (yb + yt) / 2, (za + zb) / 2, zb - za, yt - yb, ry, 1.6);
  skinW(hall.x0 + 0.05, Math.PI / 2, hall.z0, -4.7, Y, Y + hall.h); skinW(hall.x0 + 0.05, Math.PI / 2, 0.7, hall.z1, Y, Y + hall.h);
  skinW(hall.x0 + 0.05, Math.PI / 2, -4.7, 0.7, Y + 4.3, Y + hall.h);
  skinW(hall.x1 - 0.05, -Math.PI / 2, hall.z0, -16.7, Y, Y + hall.h); skinW(hall.x1 - 0.05, -Math.PI / 2, -11.3, hall.z1, Y, Y + hall.h);
  skinW(hall.x1 - 0.05, -Math.PI / 2, -16.7, -11.3, Y + 4.5, Y + hall.h);
  const ceil = rockSkin(0, Y + hall.h - 0.1, (hall.z0 + hall.z1) / 2, 52, 36, 0, 4.5, 40, M.rockDark); ceil.rotation.set(Math.PI / 2, 0, 0);
  // the openings in the rock skins: plain dark frames over the doors
  frameDoor(hall.x0 + 0.06, -2, 'z', 4, Y, 3.6);
  frameDoor(hall.x1 - 0.06, -14, 'z', 4, Y, 3.8);
  // glass floor over a lava trench
  const trench = new THREE.Mesh(new THREE.PlaneGeometry(50, 4).rotateX(-Math.PI / 2), lavaMaterial(1, 0, 0.9)); trench.position.set(0, Y - 2.2, -18); scene.add(trench);
  box(52, 0.25, 4.2, M.glass, 0, Y - 0.25, -18, {});
  for (const zz of [-20.15, -15.85]) box(52, 2.2, 0.15, M.darkMetal, 0, Y - 2.4, zz, {});
  for (let x = -22; x <= 22; x += 11) addLight(x, Y - 0.5, -18, 0xff5a1a, 80, 14, { flicker: 1 });
  // emblem inlay and the big sunburst
  const inlay = emblem(9, 0, Y + 0.02, -6, 0); inlay.rotation.x = -Math.PI / 2; inlay.material.emissiveIntensity = 0.05;
  sunburst(0, Y + 15, hall.z0 + 0.3, 7);
  // slanted concrete fins along the north wall, a light ring in the rock ceiling, floor lights round the emblem
  for (const fx of [-21, -12, 12, 21]) { const fin = box(1.2, 23, 3.2, M.concrete, fx, Y, hall.z0 + 1.7, { cast: true }); fin.rotation.x = 0.1; fin.position.z += 1.1; addBoxObs(fx, hall.z0 + 1.8, 0.6, 1.6, 0, Y, Y + 6); }
  const ringMat = M.whiteGlow.clone();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(11, 0.22, 8, 96), ringMat); ring.rotation.x = Math.PI / 2; ring.position.set(0, Y + 19.5, -8); scene.add(ring);
  const ringDisc = new THREE.Mesh(new THREE.RingGeometry(10.2, 11.8, 96), M.black); ringDisc.rotation.x = Math.PI / 2; ringDisc.position.set(0, Y + 19.75, -8); scene.add(ringDisc);
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; cyl(0.02, 0.02, 4.3, M.black, Math.cos(a) * 11, Y + 19.6, -8 + Math.sin(a) * 11, { seg: 4 }); }
  ANIM.push(() => { ringMat.emissive.set(GAME.power ? 0xfff1dc : 0xff8a3a); ringMat.emissiveIntensity = GAME.power ? 3.2 : 0.7; });
  addLight(0, Y + 17, -8, 0xffe2c0, 220, 40, { on: pow });
  addLight(0, Y + 17, -8, 0xff8a40, 70, 34, { on: noPow });
  const fl = M.amberGlow.clone(); fl.emissiveIntensity = 2;
  for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12), fl, Math.cos(a) * 6.3, Y + 0.01, -6 + Math.sin(a) * 6.3); }
  emblem(7, 0, Y + 14, hall.z1 - 0.3, Math.PI, scene, 0.25);
  // mezzanine balcony + stair along the south wall
  box(8, 0.5, 31, M.concrete, -22, Y + 6, -8.5, {});
  floorBox(-26, -18, -24, 7, Y + 6.5, { indoor: true, room: 'hall', kind: 'concrete' });
  floorRamp(-18, -8, 4, 7.6, 'x', Y + 6.5, Y, { indoor: true, room: 'hall', kind: 'concrete' });
  for (let k = 0; k < 13; k++) { const x = -8.4 - k * 0.78; box(0.8, 0.2, 3.4, M.white, x, Y + (k + 1) * 0.5 - 0.2, 5.8, { cast: true }); }
  addBoxObs(-15, 5.8, 3, 1.8, 0, Y, Y + 3.2);
  addBoxObs(-18.1, -8.6, 0.12, 15.4, 0, Y + 6.5, Y + 7.6);
  box(0.06, 1.05, 31, M.glass, -18, Y + 6.5, -8.5, {});
  box(0.1, 0.08, 31, M.black, -18, Y + 7.55, -8.5, {});
  for (const zz of [-22, -10, 2]) cyl(0.25, 0.25, 6, M.white, -18.5, Y, zz, { seg: 12, collide: true });
  // Syndrome's perch on the balcony
  const throne = new THREE.Group(); throne.position.set(-22, Y + 6.5, -12); throne.rotation.y = Math.PI / 2; scene.add(throne);
  const tb = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16, 0, TAU, 0, Math.PI * 0.62), M.black); tb.rotation.x = -Math.PI / 2 + 0.25; tb.position.y = 1.1; throne.add(tb);
  const tin = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 16, 0, TAU, 0, Math.PI * 0.6), M.red); tin.material = M.red.clone(); tin.material.side = THREE.BackSide; tin.rotation.x = -Math.PI / 2 + 0.25; tin.position.y = 1.1; throne.add(tin);
  addCircleObs(-22, -12, 1.1, Y + 6.5, Y + 8);
  addInteract({ pos: { x: -21, y: Y + 7.6, z: -9.5 }, prompt: 'Play the voice memo on the chair arm', use: () => openLog('memo') });
  // ball chairs and a low table on the main floor
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4, x = -8 + Math.cos(a) * 3.2, z = -4 + Math.sin(a) * 3.2;
    const ch = new THREE.Group(); ch.position.set(x, Y, z); ch.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); scene.add(ch);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 14, 0, TAU, 0, Math.PI * 0.62), M.white); shell.rotation.x = -Math.PI / 2 + 0.2; shell.position.y = 0.95; ch.add(shell);
    const lining = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 14, 0, TAU, 0, Math.PI * 0.6), M.red); lining.material = M.red.clone(); lining.material.side = THREE.BackSide; lining.rotation.x = -Math.PI / 2 + 0.2; lining.position.y = 0.95; ch.add(lining);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.15, 16), M.metal); foot.position.y = 0.08; ch.add(foot);
    addCircleObs(x, z, 0.85, Y, Y + 1.6);
  }
  cyl(1.0, 1.0, 0.42, M.white, -8, Y, -4, { seg: 24, collide: true });
  // long sofa and potted palms
  box(7, 0.45, 1.1, M.white, 8, Y, -24.5, { collide: true });
  box(7, 0.9, 0.3, M.white, 8, Y, -25.2, {});
  for (const [x, z] of [[-23, 6], [23, 6], [23, -25], [-14, -25]]) { cyl(0.55, 0.4, 0.8, M.white, x, Y, z, { seg: 16, collide: true }); }
  // pendant lamp clusters
  for (const [x, z] of [[-10, -10], [10, -10], [0, 2], [12, 2], [-4, -22]]) {
    const drop = Y + rr(12, 16);
    cyl(0.015, 0.015, Y + hall.h - drop, M.black, x, drop, z, { seg: 4 });
    for (let k = 0; k < 5; k++) {
      const gm = M.lamp.clone();
      mesh(new THREE.SphereGeometry(0.28, 14, 10), gm, x + rr(-0.8, 0.8), drop - rr(0, 1.2), z + rr(-0.8, 0.8));
      ANIM.push(() => { gm.emissiveIntensity = GAME.power ? 4 : 0.15; });
    }
    addLight(x, drop - 1, z, 0xffcf95, 120, 26, { on: pow });
  }
  for (const [x, z] of [[-24, -27], [24, -27], [-24, 7], [24, 7]]) emergencyLight(x, Y + 9, z, 'hall');
  for (const [x, z] of [[-23.5, -20], [-23.5, -4], [23.5, -22], [23.5, 0], [-10, -26.5], [10, -26.5]]) { auxLight(x, Y + 3.2, z, 34, 18); }
  for (const [x, z] of [[-12, -18], [12, -18]]) addLight(x, Y + 1.5, z, 0xff6a20, 60, 16, { flicker: 1 });
  addLight(0, Y + 3, -6, 0xff4a20, 40, 22, { flicker: 3, on: noPow });
  // plan screen above the dining door
  SCREENS.plan = screenPanel(25.7, Y + 8, -14, 9, 4.5, -Math.PI / 2, 1024, 512, drawPlanScreen);
  secCam(25.5, Y + 7, 7.5, -2.4, 'hall', { range: 22, sweep: 0.7 });
  secCam(-17.5, Y + 9.5, -27.5, 0.6, 'hall', { range: 22, sweep: 0.7, speed: 0.35 });
  // the jammed blast door to the silo corridor
  const bdMat = M.metalPanel;
  const bd = box(7.2, 7, 1.2, bdMat, 0, Y, -28.4, { cast: true });
  const bdObs = addBoxObs(0, -28.4, 3.6, 0.6, 0, Y + 1.15, Y + 7);
  ANIM.push((dt) => {
    const tgt = GAME.power ? 6.6 : 1.25;
    bd.position.y = damp(bd.position.y, Y + tgt + 3.5, 0.8, dt);
    bdObs.y0 = bd.position.y - 3.5;
  });
  for (const sx of [-3.9, 3.9]) box(0.6, 7.4, 1.6, M.darkMetal, sx, Y, -28.4, {});
  for (let i = -3; i <= 3; i++) mesh(new THREE.BoxGeometry(0.5, 0.06, 0.02), i % 2 ? M.black : M.amberGlow, i * 0.9, 0, 0, bd, {}).position.set(i * 0.9, -3.0, 0.62);

  // ---------------- monorail station + gate tunnel
  floorRamp(-5, 5, 8, POI.gateZ, 'z', Y, POI.plazaY, { indoor: true, room: 'gateTunnel', kind: 'concrete' });
  floorBox(-5.2, 5.2, POI.gateZ - 0.2, POI.gateZ + 5.6, POI.plazaY, { kind: 'concrete' });
  box(10.4, 0.3, 5.8, M.concreteDark, 0, POI.plazaY - 0.3, POI.gateZ + 2.7, {});
  rampVisual(-5, 5, 8, POI.gateZ, Y, POI.plazaY, 9);
  for (let z = 16; z < POI.gateZ - 4; z += 12) {
    const yy = lerp(Y, POI.plazaY, (z - 8) / (POI.gateZ - 8));
    ceilingLight(0, yy + 9, z, 1.2, 4, pow);
    emergencyLight(-4.6, yy + 5, z + 6, 'gateTunnel');
  }
  // the hall-side station
  box(4, 0.6, 12, M.white, 4.5, Y, 1, { collide: false });
  floorBox(2.5, 6.5, -5, 7, Y + 0.6, { indoor: true, room: 'hall', kind: 'stone' });
  addInteract({ pos: { x: 3.5, y: Y + 1.8, z: 0 }, r: 4, prompt: () => (GAME.power ? 'Ride the monorail to the beach' : 'Monorail (no power)'), use: () => rideMonorail(-1) });
  MONO.hallPlat = { x: 4.5, y: Y + 0.6, z: 1, yaw: Math.PI };

  // ---------------- dining room and the lava wall
  room('dining', 26, 46, -24, -4, 8, {
    floor: M.terrazzo, wall: M.wood, ceil: M.white, skip: ['e'],
    doors: [{ side: 'w', a: -16, b: -12, h: 3.8 }],
  });
  box(0.4, 8, 8.5, M.black, 48.4, BASE_Y, -19.75, {});
  box(0.4, 8, 7.5, M.black, 48.4, BASE_Y, -7.75, {});
  box(0.4, 4.4, 4, M.black, 48.4, BASE_Y + 3.6, -13.5, {});
  addBoxObs(46.2, -19.2, 0.25, 4.8, 0, Y, Y + 8);
  addBoxObs(46.2, -8.0, 0.25, 4.0, 0, Y, Y + 8);
  const glassDoorObs = addBoxObs(46.2, -13.5, 0.25, 2.2, 0, Y, Y + 8);
  box(0.12, 8, 20, M.glass, 46.15, Y, -14, {});
  box(0.3, 0.3, 20, M.darkMetal, 46.2, Y + 7.7, -14, {});
  const lavaL = new THREE.Mesh(new THREE.PlaneGeometry(10, 8.6), lavaMaterial(2, 0.32, 0.45)); lavaL.rotation.y = -Math.PI / 2;
  const lavaR = lavaL.clone(); lavaR.material = lavaL.material;
  lavaL.position.set(47.6, Y + 4, -18.5); lavaR.position.set(47.6, Y + 4, -8.5);
  scene.add(lavaL, lavaR);
  for (const zz of [-20, -14, -8]) addLight(45.4, Y + 3.5, zz, 0xff5a18, 160, 18, { flicker: 1 });
  ANIM.push((dt) => {
    LAVA_WALL.open = damp(LAVA_WALL.open, LAVA_WALL.target, 0.9, dt);
    const o = LAVA_WALL.open;
    lavaL.scale.x = 1 - o * 0.22; lavaL.position.z = -18.5 - o * 1.1;
    lavaR.scale.x = 1 - o * 0.22; lavaR.position.z = -8.5 + o * 1.1;
    glassDoorObs.y1 = o > 0.85 ? -999 : Y + 8;
  });
  // long table, tulip chairs, the head seat
  box(13, 0.12, 2.2, M.white, 36, Y + 0.76, -14, {});
  for (const xx of [31, 41]) cyl(0.12, 0.5, 0.76, M.white, xx, Y, -14, { seg: 16 });
  addBoxObs(36, -14, 6.5, 1.1, 0, Y, Y + 0.9);
  for (let i = 0; i < 10; i++) {
    const x = 31 + (i % 5) * 2.5, z = i < 5 ? -15.7 : -12.3;
    tulipChair(x, z, i < 5 ? 0 : Math.PI);
  }
  tulipChair(43.6, -14, -Math.PI / 2);
  sputnik(36, Y + 6.4, -14);
  addInteract({ pos: { x: 43.0, y: Y + 0.75, z: -14 }, r: 2.6, prompt: () => (LAVA_WALL.target ? 'The lava wall is open' : 'Feel under the edge of the table'), when: () => !LAVA_WALL.target, use: () => partLava() });
  emergencyLight(36, Y + 8, -5, 'dining');
  addLight(36, Y + 5.5, -14, 0xffd7a0, 50, 16, { on: pow });

  // ---------------- lava passage and the computer room
  room('passage', 48.6, 52, -15.5, -11.5, 3.6, { floor: M.black, wall: M.black, ceil: M.black, skip: ['w', 'e'], floorOpts: { enabled: () => LAVA_WALL.open > 0.6 } });
  floorBox(46, 48.6, -15.5, -11.5, Y, { indoor: true, room: 'passage', kind: 'concrete', enabled: () => LAVA_WALL.open > 0.6 });
  box(2.6, 8, 0.4, M.wood, 47.3, Y, -3.8, {}); box(2.6, 8, 0.4, M.wood, 47.3, Y, -24.2, {});
  mesh(new THREE.BoxGeometry(6, 0.05, 0.05), M.redGlow, 49, Y + 0.08, -15.3); mesh(new THREE.BoxGeometry(6, 0.05, 0.05), M.redGlow, 49, Y + 0.08, -11.7);
  room('computer', 52, 72, -26, -2, 9, {
    floor: M.black, wall: M.concreteDark, ceil: M.black,
    doors: [{ side: 'w', a: -15.5, b: -11.5, h: 3.6 }, { side: 'n', a: 60, b: 64, h: 3.6 }],
  });
  M.black.envMapIntensity = 0.9;
  SCREENS.kronos = screenArc(70.6, Y + 4.6, -14, 9, 6.0, 12, drawKronosScreen);
  // console desk on a low dais
  box(5, 0.3, 9, M.metalPanel, 66, Y, -14, {});
  floorBox(63.5, 68.5, -18.5, -9.5, Y + 0.3, { indoor: true, room: 'computer', kind: 'metal' });
  box(1.1, 0.95, 5.2, M.white, 66.4, Y + 0.3, -14, { collide: true });
  box(1.25, 0.08, 5.4, M.black, 66.35, Y + 1.25, -14, {});
  mesh(new THREE.BoxGeometry(0.45, 0.05, 1.6), M.darkMetal, 66.0, Y + 1.32, -14);
  for (let i = 0; i < 16; i++) mesh(new THREE.BoxGeometry(0.06, 0.03, 0.06), i % 3 ? M.amberGlow : M.greenGlow, 66.6, Y + 1.33, -16.2 + i * 0.28);
  addInteract({ pos: { x: 65.6, y: Y + 1.6, z: -14 }, r: 2.8, prompt: 'Use the main computer', use: () => openKronos() });
  // tape-reel cabinets
  for (let i = 0; i < 7; i++) tapeCabinet(54 + i * 2.4, -2.6, Math.PI);
  for (const x of [53.6, 55.8, 58, 66.4, 68.6]) tapeCabinet(x, -25.4, 0);
  ceilingLight(58, Y + 9, -14, 0.5, 18, pow, 0xcde8ff, 40, 16);
  auxLight(54, Y + 8.9, -6, 18, 12, 0xffb070); auxLight(54, Y + 8.9, -22, 18, 12, 0xffb070);
  addLight(66, Y + 4, -14, 0x50e8c8, 40, 14, { flicker: 3 });
  secCam(52.6, Y + 8, -25.4, 0.7, 'computer', { range: 18, sweep: 0.5 });
  signPlate('KRONOS', 71.7, Y + 8.1, -14, -Math.PI / 2, 4);

  // ---------------- lava lab
  room('labCorr', 60, 64, -36, -26, 4, { floor: M.metalPanel, wall: M.concreteDark, skip: ['n', 's'] });
  buildLavaLab();

  // ---------------- silo corridor, side wings
  room('siloCorr', -3.5, 3.5, -77.6, -28, 6, {
    floor: M.metalPanel, floorUV: 2, wall: M.concrete,
    skip: ['n', 's'],
    doors: [{ side: 'w', a: -60, b: -56, h: 3.4 }, { side: 'e', a: -62, b: -58, h: 3.4 }],
  });
  for (let z = -34; z > -76; z -= 8) { ceilingLight(0, Y + 6, z, 1, 3, pow); emergencyLight(3.3, Y + 4.5, z - 4, 'siloCorr'); }
  auxLight(-3, Y + 5.9, -45, 18, 12); auxLight(-3, Y + 5.9, -68, 18, 12);
  for (const s of [-1, 1]) { const pipe = cyl(0.25, 0.25, 49, M.darkMetal, s * 3, Y + 4.8, -52.8, { seg: 10 }); pipe.rotation.x = Math.PI / 2; pipe.position.y = Y + 5.2; }
  signPlate('LAUNCH SILO', 0, Y + 5.3, -29.2, Math.PI, 4.4);
  secCam(3.2, Y + 5.6, -30, -2.6, 'siloCorr', { range: 20, sweep: 0.25, speed: 0.25 });
  // containment wing
  room('cellCorr', -30, -3.5, -60, -56, 4, { floor: M.metalPanel, wall: M.concrete, skip: ['w', 'e'] });
  slideDoor(-12, -58, 'z', 4, Y, 3.6, { locked: () => GAME.alarm > 0 });
  buildContainment();
  // trophy wing
  room('trophyCorr', 3.5, 12, -62, -58, 4, { floor: M.terrazzo, wall: M.wood, skip: ['w', 'e'] });
  slideDoor(8, -60, 'z', 4, Y, 3.6, { mat: M.black });
  buildTrophyRoom();

  // ---------------- the launch silo
  buildSilo();

  // ---------------- Gazerbeam's cave
  buildCave();
}

function frameDoor(x, z, axis, w, y, h) {
  const t = 0.5;
  if (axis === 'z') { box(0.7, 0.5, w + 2 * t, M.darkMetal, x, y + h, z, {}); box(0.7, h, t, M.darkMetal, x, y, z - w / 2 - t / 2, {}); box(0.7, h, t, M.darkMetal, x, y, z + w / 2 + t / 2, {}); }
  else { box(w + 2 * t, 0.5, 0.7, M.darkMetal, x, y + h, z, {}); box(t, h, 0.7, M.darkMetal, x - w / 2 - t / 2, y, z, {}); box(t, h, 0.7, M.darkMetal, x + w / 2 + t / 2, y, z, {}); }
}
function rampVisual(x0, x1, z0, z1, y0, y1, h) {
  const len = Math.hypot(z1 - z0, y1 - y0), ang = Math.atan2(y1 - y0, z1 - z0);
  const fl = mesh(new THREE.BoxGeometry(x1 - x0, 0.3, len), M.concreteDark, (x0 + x1) / 2, (y0 + y1) / 2 - 0.15, (z0 + z1) / 2); fl.rotation.x = -ang;
  const ce = mesh(new THREE.BoxGeometry(x1 - x0, 0.3, len), M.concreteDark, (x0 + x1) / 2, (y0 + y1) / 2 + h, (z0 + z1) / 2); ce.rotation.x = -ang;
  for (const xx of [x0 - 0.2, x1 + 0.2]) {
    const w = mesh(new THREE.BoxGeometry(0.4, h + 2, len), M.concrete, xx, (y0 + y1) / 2 + h / 2, (z0 + z1) / 2); w.rotation.x = -ang;
    addBoxObs(xx, (z0 + z1) / 2, 0.22, len / 2, 0, Math.min(y0, y1) - 2, Math.max(y0, y1) + h);
  }
}
function signPlate(text, x, y, z, ry, w) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.16), new THREE.MeshStandardMaterial({ map: textTex([{ text, color: '#f3ecdc', font: '700 92px Syncopate, Arial Black, sans-serif' }], { w: 1600, h: 256, bg: '#1a1b1e' }), roughness: 0.6 }));
  m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  return m;
}
function sunburst(x, y, z, r) {
  const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  for (let i = 0; i < 24; i++) {
    const L = r * (i % 2 ? 0.75 : 1);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, L, 5), M.metal);
    const a = (i / 24) * TAU;
    rod.position.set(Math.cos(a) * L / 2, Math.sin(a) * L / 2, 0.3); rod.rotation.z = a - Math.PI / 2; g.add(rod);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), M.metal); tip.position.set(Math.cos(a) * L, Math.sin(a) * L, 0.3); g.add(tip);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 14), M.amberGlow.clone()); hub.position.z = 0.4; g.add(hub);
  ANIM.push(() => { hub.material.emissiveIntensity = GAME.power ? 3 : 0.4; });
}
function tulipChair(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, BASE_Y, z); g.rotation.y = ry; scene.add(g);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.28, 0.45, 16), M.white); base.position.y = 0.22; g.add(base);
  const cup = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 10, 0, TAU, Math.PI * 0.45, Math.PI * 0.55), M.white); cup.position.y = 0.72; cup.material = M.white; g.add(cup);
  const cush = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16), M.red); cush.position.y = 0.5; g.add(cush);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.05), M.white); back.position.set(0, 0.85, -0.25); back.rotation.x = 0.15; g.add(back);
  addCircleObs(x, z, 0.32, BASE_Y, BASE_Y + 1);
}
function sputnik(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), M.metal); g.add(core);
  for (let i = 0; i < 16; i++) {
    const d = new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 4), M.metal);
    rod.position.copy(d).multiplyScalar(0.7); rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); g.add(rod);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M.lamp); bulb.position.copy(d).multiplyScalar(1.4); g.add(bulb);
  }
  cyl(0.015, 0.015, 1.6, M.black, x, y + 0.2, z, { seg: 4 });
}
function tapeCabinet(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, BASE_Y, z); g.rotation.y = ry; scene.add(g);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.0, 0.8), M.white); body.position.y = 1.5; body.castShadow = true; g.add(body);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), M.glassDark); win.position.set(0, 2.15, 0.41); g.add(win);
  const reels = [];
  for (const sx of [-0.42, 0.42]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 20), M.darkMetal); r.rotation.x = Math.PI / 2; r.position.set(sx, 2.15, 0.38); g.add(r);
    const hub = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), M.metal); hub.position.set(sx, 2.15, 0.42); g.add(hub);
    reels.push(hub);
  }
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), blinkMaterial()); panel.position.set(0, 0.9, 0.41); g.add(panel);
  ANIM.push((dt, t) => { const sp = GAME.power ? 3 : 0.4; reels.forEach((h, i) => { h.rotation.z += dt * sp * (i ? 1 : -1.3) * (Math.sin(t * 0.7 + x) > -0.3 ? 1 : 0); }); });
  addBoxObs(x, z, 1.0, 0.4, -ry, BASE_Y, BASE_Y + 3);
}
let _blinkMat = null;
function blinkMaterial() {
  if (_blinkMat) return _blinkMat;
  _blinkMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.time, uPower: U.power },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `uniform float uTime, uPower; varying vec2 vUv; ${GLSL_NOISE}
      void main(){ vec2 g = vUv * vec2(12.0, 6.0); vec2 id = floor(g); vec2 f = fract(g) - 0.5;
        float on = step(0.55, hash12(id + floor(uTime * (0.8 + hash12(id) * 2.0))));
        float d = smoothstep(0.32, 0.18, length(f));
        vec3 col = mix(vec3(1.0, 0.55, 0.1), vec3(0.2, 1.0, 0.5), step(0.7, hash12(id * 3.1)));
        gl_FragColor = vec4(vec3(0.02) + col * d * on * mix(0.6, 3.0, uPower), 1.0); }`,
  });
  return _blinkMat;
}
function screenPanel(x, y, z, w, h, ry, cw, ch, draw) {
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: true });
  const m = mesh(new THREE.PlaneGeometry(w, h), mat, x, y, z, scene, { ry });
  const s = { c, g: c.getContext('2d'), tex, mat, m, draw, next: 0 };
  draw(s, 0); tex.needsUpdate = true;
  return s;
}
function screenArc(cx, cy, cz, radius, height, arcW, draw) {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 768;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.5, 1.5, 1.5), side: THREE.DoubleSide });
  const th = arcW / radius;
  const g = new THREE.CylinderGeometry(radius, radius, height, 48, 1, true, -th / 2, th);
  // flip u so the texture reads correctly from inside
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  const m = mesh(g, mat, cx - radius, cy, cz, scene, { ry: Math.PI / 2 });
  const frame = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.15, radius + 0.15, height + 0.6, 48, 1, true, -th / 2 - 0.03, th + 0.06), M.black);
  frame.material = M.black.clone(); frame.material.side = THREE.BackSide; frame.position.copy(m.position); frame.rotation.y = Math.PI / 2; scene.add(frame);
  const s = { c, g: c.getContext('2d'), tex, mat, m, draw, next: 0 };
  draw(s, 0); tex.needsUpdate = true;
  addLight(cx - 2.5, cy, cz, 0x4fe0c0, 30, 12, { on: () => true });
  return s;
}

let RAIL_GLOW = null;
function buildLavaLab() {
  RAIL_GLOW = M.amberGlow.clone(); RAIL_GLOW.emissiveIntensity = 1.0;
  const Y = BASE_Y, x0 = 40, x1 = 76, z0 = -64, z1 = -36, h = 18;
  // shell
  const lavaY = Y - 6;
  box(x1 - x0, 0.4, z1 - z0, M.concreteDark, (x0 + x1) / 2, Y + h, (z0 + z1) / 2, {});
  for (const [cx, cz, w, d] of [[(x0 + x1) / 2, z0 - 0.2, x1 - x0, 0.4], [50, z1 + 0.2, 20, 0.4], [70, z1 + 0.2, 12, 0.4], [x0 - 0.2, (z0 + z1) / 2, 0.4, z1 - z0], [x1 + 0.2, (z0 + z1) / 2, 0.4, z1 - z0]]) {
    box(w, h + 8, d, M.concreteDark, cx, lavaY - 2, cz, { uvScale: 4 });
  }
  box(4, h + 8 - 9.4, 0.4, M.concreteDark, 62, Y + 3.4, z1 + 0.2, {});
  box(4, 8, 0.4, M.concreteDark, 62, lavaY - 2, z1 + 0.2, {});
  addBoxObs(62, z1 + 0.2, 2, 0.2, 0, Y, Y + 3.4, { id: 'labDoorFrame', disabled: true }).y1 = -999;
  for (const [ax0, ax1] of [[x0, 60], [64, x1]]) addBoxObs((ax0 + ax1) / 2, z1 + 0.2, (ax1 - ax0) / 2, 0.22, 0, Y, Y + h);
  addBoxObs(x0 - 0.2, (z0 + z1) / 2, 0.22, (z1 - z0) / 2, 0, Y, Y + h);
  addBoxObs(x1 + 0.2, (z0 + z1) / 2, 0.22, (z1 - z0) / 2, 0, Y, Y + h);
  addBoxObs((x0 + x1) / 2, z0 - 0.2, (x1 - x0) / 2, 0.22, 0, Y, Y + h);
  rockSkin((x0 + x1) / 2, lavaY + (h + 6) / 2, z0 + 0.1, x1 - x0, h + 6, 0, 2.2);
  // lava pits
  const lp = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), lavaMaterial(1, 0, 0.6)); lp.position.set((x0 + x1) / 2, lavaY, (z0 + z1) / 2); scene.add(lp);
  for (const [lx, lz] of [[50, -50], [68, -50], [58, -44], [58, -58]]) addLight(lx, lavaY + 3, lz, 0xff5a14, 170, 24, { flicker: 1 });
  // walkways
  const walk = (wx0, wx1, wz0, wz1) => {
    box(wx1 - wx0, 0.3, wz1 - wz0, M.metalPanel, (wx0 + wx1) / 2, Y - 0.3, (wz0 + wz1) / 2, { uvScale: 2 });
    floorBox(wx0, wx1, wz0, wz1, Y, { indoor: true, room: 'lab', kind: 'metal' });
  };
  walk(40, 76, -40, -36); walk(40, 76, -64, -60); walk(40, 44, -60, -40); walk(72, 76, -60, -40); walk(56, 60, -60, -40);
  // railings (visual + low obstacles on the pit side)
  const rail = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2, ry = Math.atan2(bx - ax, bz - az);
    box(0.06, 0.06, len, RAIL_GLOW, cx, Y + 1.05, cz, { ry });
    box(0.04, 1.05, len, M.glass, cx, Y, cz, { ry });
  };
  rail(44, -40, 56, -40); rail(60, -40, 72, -40); rail(44, -60, 56, -60); rail(60, -60, 72, -60);
  rail(44, -60, 44, -40); rail(56, -60, 56, -40); rail(60, -60, 60, -40); rail(72, -60, 72, -40);
  // turbines rising from the lava
  for (const [tx, tz] of [[50, -50], [66, -50]]) {
    cyl(2.2, 2.6, 14, M.darkMetal, tx, lavaY, tz, { seg: 24 });
    const fan = new THREE.Group(); fan.position.set(tx, Y + 8.4, tz); scene.add(fan);
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 2), M.metal); b.position.set(Math.cos(i / 5 * TAU) * 1.2, 0, Math.sin(i / 5 * TAU) * 1.2); b.rotation.y = -i / 5 * TAU; b.rotation.z = 0.4; fan.add(b); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.15, 8, 32), M.amberGlow); ring.rotation.x = Math.PI / 2; ring.position.set(tx, Y + 6, tz); scene.add(ring);
    ANIM.push((dt) => { fan.rotation.y += dt * (GAME.power ? 5 : 0.8); });
    FX_POINTS.steam.push({ x: tx, y: Y + 9, z: tz, k: 0.5, indoor: true });
  }
  // lava spilling through a cracked wall
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(5, 18), lavaMaterial(2, 0.5, 0.7)); fall.position.set(70, lavaY + 9, z0 + 0.6); scene.add(fall);
  addLight(70, Y + 2, z0 + 3, 0xff4a10, 260, 24, { flicker: 1 });
  FX_POINTS.embers.push({ x: 70, y: lavaY + 1, z: z0 + 2, k: 1 });
  // regulator terminal + warning beacons
  box(1.2, 1.3, 0.6, M.white, 48, Y, -37.2, { collide: true });
  mesh(new THREE.PlaneGeometry(0.9, 0.5), M.redGlow, 48, Y + 1.0, -37.52, scene, { ry: Math.PI });
  addInteract({ pos: { x: 48, y: Y + 1.4, z: -38.4 }, prompt: 'Read the geothermal regulator', use: () => openLog('regulator') });
  for (const [bx, bz] of [[42, -38], [74, -62]]) {
    const beacon = new THREE.Group(); beacon.position.set(bx, Y + 4, bz); scene.add(beacon);
    const lampM = M.amberGlow.clone(); const bm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.35, 12), lampM); beacon.add(bm);
    const sp = new THREE.SpotLight(0xffa020, 0, 20, 0.5, 0.5, 2); sp.position.set(0, 0, 0); beacon.add(sp); beacon.add(sp.target); sp.target.position.set(1, -0.4, 0);
    ANIM.push((dt) => { beacon.rotation.y += dt * 3; });
  }
  ceilingLight(58, Y + h, -38, 8, 0.6, () => GAME.power, 0xfff1dc, 60, 22);
  emergencyLight(62, Y + 4, -36.2, 'lab');
  FX_POINTS.heat.push({ x: 58, z: -50, r: 20, y: Y });
}

function buildContainment() {
  const Y = BASE_Y;
  room('containment', -52, -30, -72, -44, 26, {
    floor: M.metalPanel, wall: M.concreteDark, ceil: M.black, floorUV: 2,
    doors: [{ side: 'e', a: -60, b: -56, h: 3.6 }],
  });
  // dais and the zero-point field
  cyl(4, 4.3, 0.3, M.darkMetal, FIELD.x, Y, FIELD.z, { seg: 40 });
  floorCircle(FIELD.x, FIELD.z, 4, Y + 0.3, { indoor: true, room: 'containment', kind: 'metal' });
  const emit = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.35, 12, 48), M.darkMetal); emit.rotation.x = Math.PI / 2; emit.position.set(FIELD.x, Y + 22, FIELD.z); scene.add(emit);
  const emitGlow = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.12, 8, 48), M.blueGlow); emitGlow.rotation.x = Math.PI / 2; emitGlow.position.set(FIELD.x, Y + 21.6, FIELD.z); scene.add(emitGlow);
  const rings = [];
  for (let i = 0; i < 9; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(2.2 + (i % 3) * 0.35, 0.03, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.3, 2.0), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    r.position.set(FIELD.x, Y + 1 + i * 2.2, FIELD.z); scene.add(r); rings.push(r);
  }
  const col = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 21, 32, 1, true), beamMaterial(0x7fc8ff, 0.05));
  col.position.set(FIELD.x, Y + 10.8, FIELD.z); col.rotation.x = 0; scene.add(col);
  col.material.vertexShader = col.material.vertexShader.replace('vAlong = position.z;', 'vAlong = 2.0;');
  FIELD.vis = [col, emitGlow, ...rings]; FIELD.on = true;
  ANIM.push((dt, t) => {
    rings.forEach((r, i) => { r.rotation.x = Math.PI / 2 + Math.sin(t * 0.7 + i) * 0.35; r.rotation.y = t * (0.3 + i * 0.07); r.position.y = Y + 1 + ((i * 2.2 + t * 0.6) % 20); });
  });
  addLight(FIELD.x, Y + 6, FIELD.z, 0x9fd4ff, 70, 20, { flicker: 1 });
  addLight(FIELD.x, Y + 18, FIELD.z, 0x7fc8ff, 120, 22);
  // Mirage's console on a low platform by the south wall
  box(6, 0.5, 3, M.concrete, -41, Y, -69.8, {});
  floorBox(-44, -38, -71.3, -68.3, Y + 0.5, { indoor: true, room: 'containment', kind: 'concrete' });
  box(2.6, 1.1, 0.7, M.white, -41, Y + 0.5, -70.6, { collide: true });
  mesh(new THREE.PlaneGeometry(2.2, 0.6), M.blueGlow.clone(), -41, Y + 1.5, -70.24, scene, {}).material.emissiveIntensity = 1.4;
  addInteract({ pos: { x: -41, y: Y + 1.9, z: -69.6 }, prompt: 'Read the note taped to the console', use: () => openLog('mirage') });
  secCam(-30.6, Y + 9, -71.4, -0.7, 'containment', { range: 24, sweep: 0.55 });
  emergencyLight(-31, Y + 6, -58, 'containment');
  auxLight(-50, Y + 6, -46, 20, 14);
}

function buildTrophyRoom() {
  const Y = BASE_Y;
  room('trophy', 12, 32, -72, -50, 7, {
    floor: M.terrazzo, wall: M.wood, ceil: M.black,
    doors: [{ side: 'w', a: -62, b: -58, h: 3.6 }],
  });
  const caseAt = (x, z, label, build) => {
    box(1.6, 1.0, 1.6, M.black, x, Y, z, { collide: true });
    const glass = box(1.5, 2.0, 1.5, M.glass, x, Y + 1.0, z, {}); void glass;
    const g = new THREE.Group(); g.position.set(x, Y + 1.0, z); scene.add(g); build(g);
    const spotMat = M.whiteGlow.clone();
    mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.2, 12), spotMat, x, Y + 6.8, z);
    addLight(x, Y + 5.5, z, 0xfff0d8, 40, 9, { on: () => true });
    addCircleObs(x, z, 0.95, Y, Y + 3);
    void label;
  };
  // the IncrediBoy suit on a child-sized mannequin, rocket boots below
  caseAt(18, -56, 'incrediboy', (g) => {
    const suit = new THREE.MeshStandardMaterial({ color: 0x2a5fb0, roughness: 0.6 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.35, 4, 10), suit); torso.position.y = 0.95; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), M.white); head.position.y = 1.42; g.add(head);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.4, 4, 8), suit); leg.position.set(s * 0.1, 0.45, 0); g.add(leg);
      const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.25, 10), M.metal); boot.position.set(s * 0.1, 0.13, 0); g.add(boot); IB_BOOTS.push(boot);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.35, 4, 8), suit); arm.position.set(s * 0.28, 0.98, 0); arm.rotation.z = s * 0.2; g.add(arm);
    }
    const em = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), M.white); em.position.set(0, 1.08, 0.21); g.add(em);
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshStandardMaterial({ color: 0x111111, side: THREE.DoubleSide })); cape.position.set(0, 0.85, -0.22); cape.rotation.x = 0.1; g.add(cape);
  });
  // Omnidroid v.10 model on a plinth
  caseAt(26, -56, 'model', (g) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 14), M.black); s.position.y = 0.8; g.add(s);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.8, 5), M.black); leg.position.set(Math.cos(a) * 0.45, 0.45, Math.sin(a) * 0.45); leg.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); g.add(leg); }
    const eyes = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.02, 4, 24, 1.2), M.redGlow); eyes.position.y = 0.85; eyes.rotation.y = 0.6; g.add(eyes);
  });
  // zero-point gauntlet prototype
  caseAt(22, -66, 'gauntlet', (g) => {
    const glove = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.45, 12), M.white); glove.rotation.z = Math.PI / 2; glove.position.y = 0.6; g.add(glove);
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.blueGlow); node.position.set(0.25, 0.6, 0); g.add(node);
  });
  // cape rack along the east wall
  box(0.08, 0.08, 9, M.metal, 31, Y + 3.2, -61, {});
  for (let i = 0; i < 7; i++) {
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2, 4, 6), new THREE.MeshStandardMaterial({ color: i === 3 ? 0x101010 : 0x141416, roughness: 0.7, side: THREE.DoubleSide }));
    const lin = cape.geometry.attributes.position;
    for (let k = 0; k < lin.count; k++) lin.setZ(k, Math.sin(lin.getX(k) * 4 + i) * 0.08);
    cape.geometry.computeVertexNormals();
    cape.position.set(30.7, Y + 2.1, -65 + i * 1.3); cape.rotation.y = -Math.PI / 2 + rr(-0.2, 0.2); scene.add(cape);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.1), new THREE.MeshStandardMaterial({ color: 0x8e1c14, roughness: 0.6 })); inner.position.set(30.75, Y + 2.1, -65 + i * 1.3); inner.rotation.y = Math.PI / 2; scene.add(inner);
  }
  addBoxObs(30.8, -61, 0.6, 4.6, 0, Y, Y + 3);
  addInteract({ pos: { x: 30, y: Y + 1.8, z: -61 }, r: 3, prompt: 'Look at the capes', use: () => findSecret('capes') });
  addInteract({ pos: { x: 18, y: Y + 1.8, z: -54.8 }, r: 2.4, prompt: 'Read the case label', use: () => findSecret('incrediboy') });
  // framed poster + personal terminal
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3), new THREE.MeshStandardMaterial({ map: posterTex(), roughness: 0.5 })); poster.position.set(12.25, Y + 2.6, -66); poster.rotation.y = Math.PI / 2; scene.add(poster);
  box(1.4, 0.8, 0.7, M.black, 24, Y, -71.3, { collide: true });
  mesh(new THREE.PlaneGeometry(1.0, 0.6), M.amberGlow, 24, Y + 1.25, -70.9, scene, {}).rotation.x = -0.4;
  addInteract({ pos: { x: 24, y: Y + 1.3, z: -70.2 }, prompt: 'Read the personal journal', use: () => openLog('journal') });
  secCam(31.5, Y + 6.4, -50.5, -2.4, 'trophy', { range: 18, sweep: 0.45 });
  // a red laser sweeping the IncrediBoy case (for show; it trips the alarm all the same)
  const sweepPivot = new THREE.Vector3(18, Y + 0.6, -53.2);
  const L = laser(15.5, Y + 0.6, -53.2, 20.5, Y + 0.6, -53.2, () => !GAME.power, 'trophy');
  ANIM.push((dt, t) => { const k = Math.sin(t * 0.8) * 0.5; L.a.set(sweepPivot.x - 2.5, Y + 0.6 + k * 0.6 + 0.6, sweepPivot.z); L.b.set(sweepPivot.x + 2.5, Y + 0.6 - k * 0.6 + 0.6, sweepPivot.z); L.mesh.position.copy(L.a).add(L.b).multiplyScalar(0.5); L.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), L.b.clone().sub(L.a).normalize()); });
}
function posterTex() {
  return canvasTex(512, 700, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f1d48a'); gr.addColorStop(1, '#d4632c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a1310'; g.font = '700 54px Syncopate, Arial Black, sans-serif'; g.textAlign = 'center';
    g.fillText('MR.', w / 2, 90); g.fillText('INCREDIBLE', w / 2, 160);
    g.beginPath(); g.arc(w / 2, 360, 140, 0, TAU); g.fillStyle = '#b8221a'; g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.ellipse(w / 2, 360, 92, 120, 0, 0, TAU); g.fill();
    g.fillStyle = '#f5d84a'; g.font = '700 150px Syncopate, Arial Black, sans-serif'; g.fillText('i', w / 2, 410);
    g.fillStyle = '#1a1310'; g.font = 'italic 500 34px Jost, sans-serif'; g.fillText('"Fly home, Buddy."', w / 2, 600);
    g.strokeStyle = 'rgba(30,0,0,0.85)'; g.lineWidth = 16; g.beginPath(); g.moveTo(60, 230); g.lineTo(452, 520); g.moveTo(452, 230); g.lineTo(60, 520); g.stroke();
  }, { clamp: true });
}

function buildSilo() {
  const Y = BASE_Y, R = SILO_R;
  // floor: launch pad with a flame trench grate
  const padShape = new THREE.Shape(); padShape.absarc(0, 0, R, 0, TAU, false);
  const padHole = new THREE.Path(); padHole.absarc(GRATE.x - VX, -(GRATE.z - VZ), GRATE.r, 0, TAU, true); padShape.holes.push(padHole);
  const padGeo = new THREE.ShapeGeometry(padShape, 48);
  { const uv = padGeo.attributes.uv, p = padGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) / R + 1) / 2, (p.getY(i) / R + 1) / 2); }
  padGeo.rotateX(-Math.PI / 2);
  const pad = new THREE.Mesh(padGeo, new THREE.MeshStandardMaterial({ map: padTex(), roughness: 0.85 }));
  pad.position.set(VX, Y + 0.01, VZ); pad.receiveShadow = true; scene.add(pad);
  const siloFloor = floorCircle(VX, VZ, R, Y, { indoor: true, room: 'silo', kind: 'metal' });
  const inGrate = (x, z) => GRATE.open && (x - GRATE.x) ** 2 + (z - GRATE.z) ** 2 < GRATE.r * GRATE.r;
  const c0 = siloFloor.contains; siloFloor.contains = (x, z) => c0(x, z) && !inGrate(x, z);
  box(10, 0.3, 4, M.metalPanel, 0, Y - 0.3, -78.6, {});
  floorBox(-3.5, 3.5, -79.6, -77, Y, { indoor: true, room: 'silo', kind: 'metal' });
  // walls: a gap for the corridor (south), the stair door (west)
  const wallMat = M.concrete.clone(); wallMat.side = THREE.DoubleSide;
  cylWall(VX, VZ, R + 0.2, Y, Y + 6.2, [[Math.PI / 2, 0.165]], wallMat);
  cylWall(VX, VZ, R + 0.2, Y + 6.2, RING_Y, [], wallMat);
  cylWall(VX, VZ, R + 0.2, RING_Y, RING_Y + 3.2, [[Math.PI, 0.075]], wallMat);
  cylWall(VX, VZ, R + 0.2, RING_Y + 3.2, CRATER_Y - 0.1, [], wallMat);
  // wall collision: ring of short obstacles, leaving the two openings
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU - Math.PI;
    const x = VX + Math.cos(a) * (R + 0.6), z = VZ + Math.sin(a) * (R + 0.6);
    const southGap = Math.abs(wrapAngle(a - Math.PI / 2)) < 0.19;
    if (!southGap) addCircleObs(x, z, 1.2, Y - 1, Y + 7);
    const westGap = Math.abs(wrapAngle(a - Math.PI)) < 0.1;
    if (!westGap) addCircleObs(x, z, 1.2, RING_Y - 1, RING_Y + 4);
  }
  // light rings up the shaft
  for (let yy = Y + 10, k = 0; yy < CRATER_Y - 6; yy += 11, k++) {
    const ringMat = (k % 2 ? M.redGlow : M.whiteGlow).clone();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 0.1, 0.09, 6, 96), ringMat); ring.rotation.x = Math.PI / 2; ring.position.set(VX, yy, VZ); scene.add(ring);
    ANIM.push(() => { ringMat.emissiveIntensity = GAME.power ? 3.2 : (k % 2 ? 1.6 : 0.25); });
    const rib = new THREE.Mesh(new THREE.TorusGeometry(R - 0.05, 0.3, 6, 64), M.concreteDark); rib.rotation.x = Math.PI / 2; rib.position.set(VX, yy + 1.2, VZ); scene.add(rib);
  }
  for (let yy = Y + 8; yy < CRATER_Y; yy += 18) addLight(VX, yy, VZ, 0xffe6c8, 85, 30, { on: () => GAME.power && FX.eruption < 0.3 });
  addLight(VX, Y + 25, VZ, 0xff6a1a, 2400, 110, { flicker: 1, zone: 'any', on: () => FX.eruption > 0.1 });
  addLight(VX, CRATER_Y + 10, VZ, 0xff6a1a, 3000, 160, { flicker: 1, zone: 'out', on: () => FX.eruption > 0.1 });
  addLight(VX, Y + 6, VZ, 0xff3018, 160, 34, { flicker: 3, on: () => !GAME.power });
  for (const a of [0.6, 2.6, 4.6]) { const p = fromV(R - 1, a); auxLight(p.x, Y + 7, p.z, 40, 22); }
  for (let yy = Y + 30; yy < RING_Y; yy += 30) addLight(VX + 12, yy, VZ, 0xff7a40, 70, 30, { on: () => !GAME.power });
  // gantry tower (west) with retracted arms
  for (const [ox, oz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) cyl(0.15, 0.15, 70, M.red, -15 + ox, Y, VZ + oz, { seg: 6 });
  for (let yy = Y + 4; yy < Y + 70; yy += 4) { box(2.6, 0.12, 0.12, M.red, -15, yy, VZ - 1.2, {}); box(2.6, 0.12, 0.12, M.red, -15, yy, VZ + 1.2, {}); box(0.12, 0.12, 2.6, M.red, -16.2, yy, VZ, {}); }
  for (const yy of [Y + 20, Y + 38, Y + 56]) box(7, 0.8, 1.2, M.darkMetal, -11.5, yy, VZ, { cast: true });
  addBoxObs(-15, VZ, 1.5, 1.5, 0, Y, Y + 70);
  // the scorched centre and prototype scrap
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(7, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x050403, transparent: true, opacity: 0.75, depthWrite: false })); scorch.position.set(VX, Y + 0.03, VZ); scene.add(scorch);
  const scrap = new THREE.Group(); scrap.position.set(11, Y, VZ - 8); scene.add(scrap);
  SILO.scrap = scrap;
  const half = new THREE.Mesh(new THREE.SphereGeometry(3, 28, 16, 0, Math.PI * 1.3), M.black); half.position.y = 1.4; half.rotation.set(0.5, 0.3, 0.8); half.material = M.black.clone(); half.material.side = THREE.DoubleSide; scrap.add(half);
  for (let i = 0; i < 3; i++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.18, 9, 8), M.black); leg.position.set(-3 + i * 2.5, 0.3, 4 + i); leg.rotation.set(Math.PI / 2, 0, 0.4 * i); scrap.add(leg); }
  SILO.scrapObs = addCircleObs(11, VZ - 8, 3.3, Y, Y + 4);
  addInteract({ pos: { x: 9, y: Y + 1.6, z: VZ - 5 }, r: 3.6, when: () => OMNI.state === 'off', prompt: 'Read the stencil on the shell', use: () => findSecret('prototype') });
  for (let i = 0; i < 5; i++) box(1.6, 1.4, 1.6, M.wood, 16 + rr(-1, 1), Y, VZ + 6 + i * 1.8, { collide: true, ry: rr(-0.2, 0.2) });
  // launch control console
  const lc = fromV(R - 1.6, 2.15);
  box(2.4, 1.1, 0.9, M.white, lc.x, Y, lc.z, { collide: true, ry: Math.atan2(VX - lc.x, VZ - lc.z) });
  const lever = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), M.red, lc.x, Y + 1.5, lc.z);
  ANIM.push(() => { lever.rotation.x = IRIS.target ? 0.8 : -0.4; });
  addInteract({ pos: { x: lc.x, y: Y + 1.4, z: lc.z }, r: 2.6, prompt: () => (IRIS.target ? 'The crater iris is open' : 'Pull the crater iris lever'), use: () => pullIrisLever() });

  // ---------------- the lift (east wall) and the ring catwalk
  const cage = new THREE.Group(); scene.add(cage);
  const cfloor = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 3), M.metalPanel); cfloor.position.y = -0.125; cage.add(cfloor);
  for (const [ox, oz] of [[-1.45, -1.45], [1.45, -1.45], [-1.45, 1.45], [1.45, 1.45]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 0.1), M.orange); p.position.set(ox, 1.5, oz); cage.add(p); }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 3), M.darkMetal); roof.position.y = 3; cage.add(roof);
  const cl = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, 0.3), M.amberGlow.clone()); cl.position.y = 2.9; cage.add(cl);
  for (const oz of [-1.45, 1.45]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(3, 0.06, 0.06), M.orange); rail.position.set(0, 1.05, oz); cage.add(rail); }
  cage.position.set(LIFT.x, Y, LIFT.z);
  LIFT.cage = cage;
  cyl(0.12, 0.12, RING_Y - Y + 4, M.darkMetal, VX + R - 0.25, Y, VZ - 1.7, { seg: 6 });
  cyl(0.12, 0.12, RING_Y - Y + 4, M.darkMetal, VX + R - 0.25, Y, VZ + 1.7, { seg: 6 });
  LIFT.floor = floorBox(LIFT.x - 1.5, LIFT.x + 1.5, LIFT.z - 1.5, LIFT.z + 1.5, Y, { indoor: true, room: 'silo', kind: 'metal' });
  LIFT.floor.y = () => LIFT.y;
  const rideI = addInteract({ pos: { x: LIFT.x, y: Y + 1.3, z: LIFT.z }, r: 2.4, when: () => !LIFT.moving, prompt: () => liftPrompt(), use: () => useLift() });
  ANIM.push(() => { rideI.pos.set(LIFT.x - 0.4, LIFT.y + 1.3, LIFT.z); });
  addInteract({ pos: { x: LIFT.x - 2.6, y: RING_Y + 1.4, z: LIFT.z }, r: 2.8, when: () => Math.abs(LIFT.y - RING_Y) > 0.3 && !LIFT.moving, prompt: 'Call the lift', use: () => callLift(RING_Y) });
  addInteract({ pos: { x: LIFT.x - 2.6, y: Y + 1.4, z: LIFT.z }, r: 2.8, when: () => Math.abs(LIFT.y - Y) > 0.3 && !LIFT.moving, prompt: 'Call the lift', use: () => callLift(Y) });
  // ring catwalk (gap where the lift arrives)
  const ringG = new THREE.RingGeometry(R - 4, R, 96, 1);
  ringG.rotateX(-Math.PI / 2);
  const ringM = mesh(ringG, M.metalPanel, VX, RING_Y - 0.02, VZ); ringM.material = M.metalPanel.clone(); ringM.material.side = THREE.DoubleSide;
  floorAnnulus(VX, VZ, R - 4, R, RING_Y, [[0, 0.085]], { indoor: true, room: 'silo', kind: 'metal' });
  const rail = new THREE.Mesh(new THREE.TorusGeometry(R - 4, 0.05, 6, 120), M.amberGlow); rail.rotation.x = Math.PI / 2; rail.position.set(VX, RING_Y + 1.05, VZ); scene.add(rail);
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; if (Math.abs(wrapAngle(a)) < 0.12) continue; addCircleObs(VX + Math.cos(a) * (R - 4.3), VZ + Math.sin(a) * (R - 4.3), 0.5, RING_Y, RING_Y + 1.1); }
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; cyl(0.04, 0.04, 1.05, M.darkMetal, VX + Math.cos(a) * (R - 4), RING_Y, VZ + Math.sin(a) * (R - 4), { seg: 4 }); }
  addLight(VX - R + 2, RING_Y + 3, VZ, 0xffc890, 60, 18, { on: () => true, flicker: 3 });
  // stair from the ring up to the crater-floor kiosk
  floorBox(-26, -22, -101.6, -98.4, RING_Y, { indoor: true, room: 'stair', kind: 'metal' });
  floorRamp(-26, -23, -98.4, -84, 'z', RING_Y, CRATER_Y - 0.1, { indoor: true, room: 'stair', kind: 'metal' });
  floorBox(-26, -23, -84, -79.4, CRATER_Y - 0.1, { indoor: true, room: 'stair', kind: 'metal' });
  const stairLen = Math.hypot(14.4, CRATER_Y - 0.1 - RING_Y);
  for (let k = 0; k < 24; k++) { const f = (k + 0.5) / 24; box(3, 0.2, 0.62, M.metalPanel, -24.5, lerp(RING_Y, CRATER_Y - 0.1, f) - 0.2, lerp(-98.4, -84, f), {}); }
  void stairLen;
  for (const [xx, za, zb] of [[-26.2, -102, -80], [-22.8, -98.2, -80]]) {
    mesh(new THREE.BoxGeometry(0.4, CRATER_Y + 4 - RING_Y, zb - za), M.concreteDark, xx, (RING_Y + CRATER_Y + 4) / 2, (za + zb) / 2);
    addBoxObs(xx, (za + zb) / 2, 0.21, (zb - za) / 2, 0, RING_Y - 1, CRATER_Y + 4);
  }
  box(4, 0.3, 21, M.concreteDark, -24.5, CRATER_Y + 3.5, -90.5, {});
  addBoxObs(-24.5, -101.8, 2, 0.2, 0, RING_Y - 1, CRATER_Y + 4);
  ceilingLight(-24.5, CRATER_Y + 3.4, -88, 1, 2, () => true, 0xffd2a0, 20, 10);
  ceilingLight(-24.5, CRATER_Y + 3.4, -97, 1, 2, () => true, 0xffd2a0, 20, 10);
  // kiosk on the crater floor
  const ky = CRATER_Y;
  box(4.6, 0.3, 9.6, M.concreteDark, -24.5, ky + 3.6, -84.8, { cast: true });
  for (const xx of [-26.75, -22.25]) box(0.3, 3.6, 9.6, M.concreteDark, xx, ky, -84.8, { cast: true });
  box(4.6, 3.9, 0.3, M.concreteDark, -24.5, ky, -89.45, { cast: true });
  addBoxObs(-26.75, -84.8, 0.2, 4.8, 0, ky - 1, ky + 3.6); addBoxObs(-22.25, -84.8, 0.2, 4.8, 0, ky - 1, ky + 3.6);
  signPlate('SILO ACCESS', -24.5, ky + 3.1, -79.9, 0, 3.2);
  const kd = slideDoor(-24.5, -80.1, 'x', 3.4, ky - 0.1, 3.2, { locked: () => !GAME.power });
  void kd;
  const kl = mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), M.redGlow.clone(), -24.5, ky + 3.4, -79.95);
  ANIM.push(() => kl.material.emissive.set(GAME.power ? 0x3dff8a : 0xff2a18));
  addInteract({ pos: { x: -24.5, y: ky + 1.5, z: -79.2 }, r: 2.4, when: () => !GAME.power, prompt: 'Service hatch (locked, no power)', use: () => note('Service hatch sealed. Main power required.') });
}
function padTex() {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#6d6a64'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 2000, ['#5e5b56', '#7a766f', '#55524d'], 0.6, 2.2, 0.6);
    g.strokeStyle = '#2b2a28'; g.lineWidth = 6;
    for (const r of [160, 260, 380, 470]) { g.beginPath(); g.arc(512, 512, r, 0, TAU); g.stroke(); }
    g.fillStyle = '#c9a227';
    for (let i = 0; i < 16; i++) { g.save(); g.translate(512, 512); g.rotate(i / 16 * TAU); g.fillRect(400, -10, 60, 20); g.restore(); }
    g.fillStyle = '#1c1b19'; g.beginPath(); g.arc(512, 512, 150, 0, TAU); g.fill();
    g.strokeStyle = '#3a3936'; g.lineWidth = 5;
    for (let x = 370; x < 660; x += 18) { g.beginPath(); g.moveTo(x, 370); g.lineTo(x, 655); g.stroke(); }
  }, { clamp: true });
}

function buildCave() {
  const a = POI.caveA, y0 = POI.caveY;
  const ctl = [fromV(197, a), fromV(190, a), fromV(181, a + 0.012), fromV(172, a + 0.03), fromV(165, a + 0.045)];
  const pts = smoothPath(ctl, 1.6);
  pts.forEach((p, i) => (p.y = y0 + Math.min(i * 0.06, 1.2)));
  const inside = pts.filter((p) => Math.hypot(p.x - VX, p.z - VZ) <= 192);
  rockTunnel(inside, 2.1, 'cave', { mat: M.rockDark });
  floorPath(pts.filter((p) => Math.hypot(p.x - VX, p.z - VZ) > 189).concat([inside[0]]), 1.4, { kind: 'rock' });
  // a ring of boulders around the mouth hides where the tunnel meets the hillside
  { const mp = fromV(192.3, a), g = new THREE.Group(); g.position.set(mp.x, y0, mp.z); g.rotation.y = Math.atan2(Math.cos(a), Math.sin(a)); scene.add(g);
    for (let i = 0; i < 9; i++) { const ang = (i / 8) * Math.PI; const rk = new THREE.Mesh(makeRock(70 + i, 0.8), M.rockDark); rk.position.set(Math.cos(ang) * 3.5, Math.sin(ang) * 3.7 + 0.3, 0.3); rk.scale.setScalar(rr(1.0, 1.35)); rk.castShadow = true; g.add(rk); } }
  // chamber
  const C = fromV(160, a + 0.05), cy = pts[pts.length - 1].y;
  const g = new THREE.SphereGeometry(6.5, 36, 24);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    _v.fromBufferAttribute(p, i);
    const n = 1 + 0.18 * noise3(_v.x * 0.4, _v.y * 0.4, _v.z * 0.4) + 0.06 * noise3(_v.x * 1.4, _v.y * 1.4, _v.z * 1.4);
    _v.multiplyScalar(n); if (_v.y < -1.2) _v.y = -1.2 - (_v.y + 1.2) * 0.1; _v.y *= 0.7;
    p.setXYZ(i, _v.x, _v.y, _v.z);
  }
  g.computeVertexNormals();
  const cm = M.rockDark.clone(); cm.side = THREE.BackSide;
  mesh(g, cm, C.x, cy + 1.0, C.z, scene, {});
  floorCircle(C.x, C.z, 5.2, cy, { indoor: true, room: 'cave', kind: 'rock' });
  const fl = new THREE.Mesh(new THREE.CircleGeometry(6, 32).rotateX(-Math.PI / 2), M.rockDark); fl.position.set(C.x, cy - 0.02, C.z); scene.add(fl);
  // the remains of Gazerbeam slumped against the far wall, and the word he burned above them
  const inward = { x: (VX - C.x) / 160, z: (VZ - C.z) / 160 };
  const wallP = { x: C.x + inward.x * 4.6, z: C.z + inward.z * 4.6 };
  const faceYaw = Math.atan2(-inward.x, -inward.z);
  const bones = new THREE.Group(); bones.position.set(wallP.x, cy, wallP.z); bones.rotation.y = faceYaw; scene.add(bones);
  const boneM = new THREE.MeshStandardMaterial({ color: 0xcfc4a8, roughness: 0.8 });
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), boneM); skull.position.set(0.05, 0.95, 0.15); skull.rotation.z = 0.4; bones.add(skull);
  const visor = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x8a1a1a, emissive: 0x400808, roughness: 0.2 })); visor.position.set(0.05, 0.98, 0.22); visor.rotation.set(0, 0, Math.PI); bones.add(visor);
  for (let i = 0; i < 6; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.15 - i * 0.008, 0.012, 4, 12, Math.PI), boneM); rib.position.set(0, 0.62 - i * 0.06, 0.08); rib.rotation.x = Math.PI / 2; bones.add(rib); }
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), boneM); spine.position.set(0, 0.55, 0); spine.rotation.x = 0.3; bones.add(spine);
  for (const s of [-1, 1]) {
    const femur = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6), boneM); femur.position.set(s * 0.12, 0.2, 0.32); femur.rotation.x = Math.PI / 2; bones.add(femur);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6), boneM); shin.position.set(s * 0.14, 0.05, 0.62); shin.rotation.x = Math.PI / 2 - 0.2; bones.add(shin);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6), boneM); arm.position.set(s * 0.22, 0.45, 0.12); arm.rotation.z = s * 0.4; bones.add(arm);
  }
  const rag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.7), new THREE.MeshStandardMaterial({ color: 0x2c3a5a, roughness: 0.9, side: THREE.DoubleSide })); rag.position.set(0, 0.5, 0.05); rag.rotation.x = -0.2; bones.add(rag);
  const word = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.9), new THREE.MeshStandardMaterial({ map: kronosTex(), transparent: true, roughness: 1, emissive: 0xff5a1a, emissiveIntensity: 0.0 }));
  word.material.emissiveMap = word.material.map;
  const wp = { x: C.x + inward.x * 4.7, z: C.z + inward.z * 4.7 };
  word.position.set(wp.x, cy + 2.3, wp.z); word.rotation.y = faceYaw; scene.add(word);
  ANIM.push((dt, t) => { word.material.emissiveIntensity = 0.55 + 0.15 * Math.sin(t * 0.8); });
  // the probe that missed him
  const probe = new THREE.Group(); probe.position.set(C.x - inward.x * 2 + inward.z * 2.2, cy + 0.4, C.z - inward.z * 2 - inward.x * 2.2); probe.rotation.set(0.6, 1, 0.3); scene.add(probe);
  const pb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), M.white); probe.add(pb);
  const pe = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), M.redGlow.clone()); pe.position.z = 0.41; pe.material.emissiveIntensity = 0.2; probe.add(pe);
  for (let i = 0; i < 3; i++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.3), M.darkMetal); fin.rotation.y = i / 3 * TAU; fin.position.y = -0.2; probe.add(fin); }
  addCircleObs(probe.position.x, probe.position.z, 0.5, cy, cy + 1);
  addInteract({ pos: { x: wp.x - inward.x * 1.4, y: cy + 1.6, z: wp.z - inward.z * 1.4 }, r: 4.5, prompt: 'Read the words burned into the rock', use: () => readKronosWall() });
  addInteract({ pos: { x: wallP.x - inward.x * 0.8, y: cy + 0.8, z: wallP.z - inward.z * 0.8 }, r: 2.4, prompt: 'Kneel by the remains', use: () => findSecret('gazerbeam') });
  // a few drips of light: glowworms on the ceiling
  for (let i = 0; i < 40; i++) {
    const u = rng() * TAU, v = rr(0.2, 1);
    FX_POINTS.glow.push({ x: C.x + Math.cos(u) * 5 * v, y: cy + 3.6 + rr(-0.4, 0.8), z: C.z + Math.sin(u) * 5 * v });
  }
  addLight(C.x, cy + 3, C.z, 0x7fe0cc, 85, 14);
  addLight(C.x - inward.x * 3, cy + 1.2, C.z - inward.z * 3, 0xffc890, 22, 9);
  POI.caveChamber = { x: C.x, y: cy, z: C.z };
}
function kronosTex() {
  return canvasTex(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = '700 168px Syncopate, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeStyle = 'rgba(10,6,4,0.95)'; g.lineWidth = 22; g.lineJoin = 'round';
    g.strokeText('KRONOS', w / 2, h / 2);
    g.fillStyle = 'rgba(255,120,40,0.9)'; g.fillText('KRONOS', w / 2, h / 2);
    g.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${rr(120, 255)},${rr(50, 110)},20,${rr(0.05, 0.25)})`; g.fillRect(rr(0, w), rr(0, h), rr(2, 9), rr(2, 9)); }
    g.globalCompositeOperation = 'source-over';
  }, { clamp: true });
}
