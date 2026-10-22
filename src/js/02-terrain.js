// ============================================================ island shape
const HALF = 550, SEG = 440, STEP = (HALF * 2) / SEG, GN = SEG + 1;
const VX = 0, VZ = -100;                      // volcano centre
const RIM_R = 60, RIM_H = 178, BASE_R = 300;  // outer cone
const CRATER_Y = 136, CRATER_FLOOR_R = 34, SILO_R = 22.5;
const BASE_Y = 40;                            // floor of the lair inside the mountain
const VENT = { x: 125, z: -45, r: 14 };       // the small active cone on the east flank
const SCARP_A = Math.atan2(0.8, -0.6);        // bearing (from the volcano) of the waterfall cliff
const HILLS = [];
let VENT_BASE = 0, LAVA_LAKE_Y = 0;
const H = new Float32Array(GN * GN);
const POI = {};

const polar = (r, a) => ({ x: Math.cos(a) * r, z: Math.sin(a) * r });
const fromV = (r, a) => ({ x: VX + Math.cos(a) * r, z: VZ + Math.sin(a) * r });

function coastR(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return 314 + 22 * noise2(c * 1.3 + 4.1, s * 1.3 - 2.7) + 10 * noise2(c * 3.4 - 6.3, s * 3.4 + 1.9) + 14 * Math.max(0, s);
}
function lowland(x, z) {
  let h = 7.5 + 5.5 * fbm2(x * 0.0062 + 11.3, z * 0.0062 - 7.1, 4) + 1.5 * noise2(x * 0.035, z * 0.035);
  for (const hl of HILLS) { const d2 = (x - hl.x) ** 2 + (z - hl.z) ** 2; h += hl.h * Math.exp(-d2 / (hl.r * hl.r)); }
  return h;
}
const lowW = (vr) => smoothstep(110, 230, vr);
function volcanoH(x, z) {
  const dx = x - VX, dz = z - VZ, vr = Math.hypot(dx, dz);
  if (vr > BASE_R + 5) return 0;
  const ca = dx / (vr || 1), sa = dz / (vr || 1);
  const rimN = noise2(ca * 1.6 + 3.3, sa * 1.6 - 1.2) * 6;
  let h;
  if (vr >= RIM_R) {
    const t = Math.min((vr - RIM_R) / (BASE_R - RIM_R), 1);
    h = (RIM_H + rimN * (1 - t)) * Math.pow(1 - t, 1.75);
    const r1 = 1 - Math.abs(noise3(ca * 3.0, sa * 3.0, vr * 0.016));
    const r2 = 1 - Math.abs(noise3(ca * 7.5 + 9, sa * 7.5, vr * 0.03));
    const amp = 15 * Math.sin(t * Math.PI) * (1 - t * 0.4);
    h += (r1 * r1 * 0.9 + r2 * 0.35 - 0.6) * amp;
    const da = Math.abs(wrapAngle(Math.atan2(dz, dx) - SCARP_A));
    h += 13 * smoothstep(0.62, 0.38, da) * smoothstep(194, 187, vr) * smoothstep(118, 160, vr);
  } else {
    const u = smoothstep(CRATER_FLOOR_R, RIM_R, vr);
    h = lerp(CRATER_Y, RIM_H + rimN, Math.pow(u, 1.25));
    h += noise3(ca * 7.5 + 9, sa * 7.5, vr * 0.03) * 12 * u * (1 - u);
  }
  return h;
}
function ventApply(x, z, hMain) {
  const dx = x - VENT.x, dz = z - VENT.z, d = Math.hypot(dx, dz);
  if (d > 85) return hMain;
  const notch = Math.exp(-Math.pow(wrapAngle(Math.atan2(dz, dx) - 0.25) / 0.38, 2));
  const rimH = 44 - notch * 15;
  if (d >= VENT.r) {
    const base = lerp(VENT_BASE, hMain, smoothstep(10, 45, d));
    const hv = base + rimH * Math.pow(1 - smoothstep(VENT.r, 85, d), 1.7) + noise2(x * 0.08, z * 0.08) * 1.8 * (1 - d / 85);
    return Math.max(hMain, hv);
  }
  return VENT_BASE + lerp(25, rimH, Math.pow(smoothstep(5, VENT.r, d), 1.3));
}
function rawHeight(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  const cr = coastR(a);
  const north = clamp(-Math.sin(a), 0, 1);
  const w = lerp(84, 24, north);
  const L = smoothstep(cr + w * 0.5, cr - w * 0.5, r);
  // the rolling lowland fades out up the volcano so the crater floor sits exactly at CRATER_Y
  let low = lowland(x, z) * lowW(Math.hypot(x - VX, z - VZ));
  const beach = smoothstep(cr - 75, cr - 25, r) * (1 - north);
  low = lerp(low, 1.5 + 0.7 * noise2(x * 0.02, z * 0.02), beach);
  const land = ventApply(x, z, low + volcanoH(x, z));
  const sea = -15 + 4 * noise2(x * 0.004 + 3, z * 0.004);
  return lerp(sea, land, L);
}
// Smooth cone height (no noise) and its inverse, used to lay out the switchback road.
const AVG_LOW = 7.5;
function coneY(vr) { return AVG_LOW * lowW(vr) + RIM_H * Math.pow(1 - clamp((vr - RIM_R) / (BASE_R - RIM_R), 0, 1), 1.75); }
function coneR(y) { let lo = RIM_R, hi = BASE_R; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (coneY(m) > y) lo = m; else hi = m; } return (lo + hi) / 2; }
function craterWallR(y) {
  let lo = CRATER_FLOOR_R, hi = RIM_R;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; const h = lerp(CRATER_Y, RIM_H, Math.pow(smoothstep(CRATER_FLOOR_R, RIM_R, m), 1.25)); if (h < y) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// ============================================================ layout: where everything goes
const TRAILS = [], RIVER = [], LAVA = [], ROAD = [], CRATER_ROAD = [];
const PADS = [];   // flattened areas {x, z, r | hw,hl,yaw, y, blend}
const HOLES = [];  // terrain cut-outs for tunnel mouths {cx, cz, hw, hl, yaw, y0, y1}
function coastPoint(a, level = 0.6) {
  for (let r = 200; r < 470; r += 0.5) { const p = polar(r, a); if (rawHeight(p.x, p.z) < level) return p; }
  return polar(470, a);
}
function sampleHeights(pts, smoothN = 4) {
  const ys = pts.map((p) => rawHeight(p.x, p.z));
  const out = ys.slice();
  for (let i = 0; i < ys.length; i++) {
    let s = 0, n = 0;
    for (let k = -smoothN; k <= smoothN; k++) { const j = clamp(i + k, 0, ys.length - 1); s += ys[j]; n++; }
    out[i] = s / n;
  }
  pts.forEach((p, i) => (p.y = out[i]));
  return pts;
}
function monotoneDown(pts) { for (let i = 1; i < pts.length; i++) pts[i].y = Math.min(pts[i].y, pts[i - 1].y - 0.02); return pts; }

function planIsland() {
  HILLS.push({ ...polar(coastR(2.25) - 42, 2.25), r: 44, h: 13 });   // battery ridge, south-west coast
  HILLS.push({ x: -207, z: -33, r: 42, h: 24 });                      // radio hill, west
  HILLS.push({ x: 214, z: 58, r: 32, h: 17 });                        // lava overlook, east
  VENT_BASE = lowland(VENT.x, VENT.z) * lowW(Math.hypot(VENT.x - VX, VENT.z - VZ)) + volcanoH(VENT.x, VENT.z);
  LAVA_LAKE_Y = VENT_BASE + 27.5;

  // South beach and the jetty
  const ja = 1.63, out = { x: Math.cos(ja), z: Math.sin(ja) }, side = { x: out.z, z: -out.x };
  const B = coastPoint(ja, 0.9);
  POI.out = out; POI.side = side;
  POI.beach = B;
  POI.jetty = { x0: B.x - out.x * 9, z0: B.z - out.z * 9, x1: B.x + out.x * 46, z1: B.z + out.z * 46, yaw: Math.atan2(out.x, out.z) };
  POI.start = { x: B.x + out.x * 38, z: B.z + out.z * 38 };
  POI.pavilion = { x: B.x - out.x * 34 + side.x * 26, z: B.z - out.z * 34 + side.z * 26 };
  POI.beachStation = { x: B.x - out.x * 40 - side.x * 34, z: B.z - out.z * 40 - side.z * 34 };
  const pw = coastPoint(1.27, 1.2);
  POI.planeWreck = { x: pw.x - Math.cos(1.27) * 5, z: pw.z - Math.sin(1.27) * 5 };
  POI.battery = { ...polar(coastR(2.25) - 44, 2.25) };
  POI.radio = { x: -207, z: -33 };
  POI.J1 = { x: -6, z: 206 };
  POI.omni = { x: 118, z: 176 };
  POI.velo = { x: 172, z: 120 };
  POI.lavaLook = { x: 214, z: 58 };

  // Volcano gate: a plaza cut into the south flank, the gate facade at its back.
  POI.gateZ = VZ + 202;                    // facade plane z
  POI.plaza = { x: 0, z: VZ + 216, hw: 17, hl: 15 };
  POI.plazaY = Math.round(Math.max(rawHeight(0, VZ + 228), 22) * 2) / 2;
  PADS.push({ x: 0, z: POI.plaza.z, hw: 18, hl: 16, yaw: 0, y: POI.plazaY, blend: 7 });

  // Waterfall: river over the basalt scarp into a pool; the lair door hides behind the curtain.
  const dirS = { x: Math.cos(SCARP_A), z: Math.sin(SCARP_A) };
  POI.dirS = dirS;
  POI.lip = fromV(185.5, SCARP_A);
  POI.pool = fromV(203.5, SCARP_A);
  POI.door = fromV(192.6, SCARP_A);
  const pr = fromV(209, SCARP_A);
  POI.poolY = Math.round(rawHeight(pr.x, pr.z) * 2) / 2 - 0.8;
  POI.ledgeY = POI.poolY + 0.6;
  PADS.push({ x: POI.pool.x, z: POI.pool.z, r: 8.5, y: POI.poolY - 1.6, blend: 4 });
  const ledge = fromV(194.6, SCARP_A);
  PADS.push({ x: ledge.x, z: ledge.z, hw: 5.5, hl: 2.2, yaw: Math.atan2(dirS.x, dirS.z), y: POI.ledgeY, blend: 1.5 });
  POI.cave = fromV(189.5, SCARP_A + 0.235);
  POI.caveA = SCARP_A + 0.235;
  POI.caveY = Math.round(rawHeight(fromV(197, POI.caveA).x, fromV(197, POI.caveA).z) * 2) / 2;

  // River: spring high on the flank -> scarp lip -> (falls) -> pool -> west coast
  const spring = fromV(150, SCARP_A + 0.04);
  const upper = [spring, fromV(165, SCARP_A + 0.02), fromV(178, SCARP_A + 0.005), POI.lip];
  const upperPts = monotoneDown(sampleHeights(smoothPath(upper, 3), 3));
  const lipY = upperPts[upperPts.length - 1].y;
  POI.lipY = lipY;
  const coastW = coastPoint(2.93, 0);
  const lower = [POI.pool, fromV(214, SCARP_A + 0.05), { x: -150, z: 86 }, { x: -170, z: 96 }, { x: -205, z: 98 }, { x: -240, z: 92 }, { x: -275, z: 88 },
    { x: coastW.x - 12, z: coastW.z }, { x: coastW.x - 40, z: coastW.z - 2 }];
  const lowerPts = monotoneDown(sampleHeights(smoothPath(lower, 3), 3));
  lowerPts.forEach((p) => (p.y = Math.min(p.y, POI.poolY)));
  lowerPts[0].y = POI.poolY;
  RIVER.push({ pts: upperPts, halfW: 2.6, part: 'upper' }, { pts: lowerPts, halfW: 3.2, part: 'lower' });

  // Lava river from the vent's breach to the sea
  const notch = { x: VENT.x + Math.cos(0.25) * 8, z: VENT.z + Math.sin(0.25) * 8 };
  const coastE = coastPoint(0.16, 0);
  const lavaCtl = [notch, { x: 150, z: -36 }, { x: 168, z: -28 }, { x: 196, z: -12 }, { x: 226, z: 7 }, { x: 256, z: 21 }, { x: 286, z: 30 }, { x: coastE.x + 6, z: coastE.z + 2 }, { x: coastE.x + 30, z: coastE.z + 6 }];
  const lavaPts = monotoneDown(sampleHeights(smoothPath(lavaCtl, 3), 2));
  lavaPts[0].y = LAVA_LAKE_Y;
  for (let i = 1; i < lavaPts.length; i++) lavaPts[i].y = Math.min(lavaPts[i].y, lavaPts[i - 1].y - 0.05);
  lavaPts.forEach((p) => (p.y = Math.max(p.y, -0.4)));
  LAVA.push(...lavaPts);
  POI.lavaSea = { x: coastE.x + 8, z: coastE.z + 3 };

  // Trails (lamp-lined jungle paths)
  const poolSouth = { x: POI.pool.x + 6, z: POI.pool.z + 10 };
  POI.poolSouth = poolSouth;
  const jettyFoot = { x: B.x - out.x * 6, z: B.z - out.z * 6 };
  const t = (pts, name, halfW = 1.7) => { const p = sampleHeights(smoothPath(pts, 3), 4); TRAILS.push({ name, pts: p, halfW }); return p; };
  t([jettyFoot, { x: B.x - out.x * 18, z: B.z - out.z * 18 }, { x: POI.pavilion.x - side.x * 12 - out.x * 4, z: POI.pavilion.z - side.z * 12 - out.z * 4 }, { x: 10, z: 262 }, { x: 2, z: 234 }, POI.J1], 'beach');
  t([{ x: B.x - out.x * 18, z: B.z - out.z * 18 }, { x: POI.beachStation.x + side.x * 10, z: POI.beachStation.z + side.z * 10 }], 'station');
  t([POI.J1, { x: -40, z: 188 }, { x: -76, z: 152 }, { x: -98, z: 116 }, { x: -108, z: 90 }, poolSouth], 'west');
  t([POI.J1, { x: 8, z: 180 }, { x: 4, z: 150 }, { x: 0, z: POI.plaza.z + 15 }], 'volcano');
  t([POI.J1, { x: 40, z: 202 }, { x: 84, z: 188 }, POI.omni, { x: 150, z: 148 }, POI.velo, { x: 196, z: 88 }, { x: POI.lavaLook.x - 4, z: POI.lavaLook.z + 4 }], 'east');
  t([{ x: -66, z: 162 }, { x: -108, z: 186 }, { x: -146, z: 206 }, { x: POI.battery.x + 6, z: POI.battery.z - 2 }], 'battery');
  const cl0 = fromV(202, SCARP_A + 0.07), cl1 = fromV(198, SCARP_A + 0.15), cl2 = fromV(196.5, POI.caveA - 0.02);
  t([{ x: POI.pool.x - dirS.z * 9, z: POI.pool.z + dirS.x * 9 }, cl0, cl1, cl2], 'cliff', 1.4);
  PADS.push({ x: POI.cave.x + Math.cos(POI.caveA) * 5, z: POI.cave.z + Math.sin(POI.caveA) * 5, r: 5, y: POI.caveY, blend: 3 });

  // Pads for buildings
  PADS.push({ x: POI.pavilion.x, z: POI.pavilion.z, r: 15, y: Math.max(rawHeight(POI.pavilion.x, POI.pavilion.z), 2.4), blend: 6 });
  PADS.push({ x: POI.beachStation.x, z: POI.beachStation.z, r: 13, y: Math.max(rawHeight(POI.beachStation.x, POI.beachStation.z), 2.4), blend: 6 });
  PADS.push({ x: POI.battery.x, z: POI.battery.z, r: 18, y: rawHeight(POI.battery.x, POI.battery.z), blend: 8 });
  PADS.push({ x: POI.radio.x, z: POI.radio.z, r: 8, y: rawHeight(POI.radio.x, POI.radio.z), blend: 5 });
  PADS.push({ x: POI.lavaLook.x, z: POI.lavaLook.z, r: 6, y: rawHeight(POI.lavaLook.x, POI.lavaLook.z), blend: 4 });
  PADS.push({ x: POI.omni.x, z: POI.omni.z, r: 16, y: rawHeight(POI.omni.x, POI.omni.z) - 0.6, blend: 8, bowl: true });

  planRoad();
}

// Switchbacks up the south-east face, over a notch in the rim, then a spiral down the crater wall.
function planRoad() {
  const g = 0.165, ds = 2;
  let th = Math.atan2(POI.plaza.z - VZ, 17), r = Math.hypot(17, POI.plaza.z - VZ), y = POI.plazaY;
  let dir = -1;
  const TH0 = 1.0, TH1 = 1.6, TURN = 6;
  const pts = [];
  const push = () => { const p = fromV(r, th); pts.push({ x: p.x, z: p.z, y }); };
  push();
  let guard = 0;
  while (y < RIM_H - 7 && guard++ < 4000) {
    y += g * ds;
    const rNew = Math.min(r, coneR(y));
    const dr = r - rNew;
    th += (dir * Math.sqrt(Math.max(ds * ds - dr * dr, 0.04))) / rNew;
    r = rNew;
    push();
    if ((dir < 0 && th < TH0) || (dir > 0 && th > TH1)) {
      if (r - 2 * TURN < RIM_R + 10) break;   // no room for another hairpin below the rim
      // hairpin: half circle turning uphill
      const p0 = fromV(r, th);
      const tx = -Math.sin(th) * dir, tz = Math.cos(th) * dir;      // travel direction
      const nx = (VX - p0.x) / r, nz = (VZ - p0.z) / r;               // towards the summit
      const cx = p0.x + nx * TURN, cz = p0.z + nz * TURN;
      for (let k = 1; k <= 10; k++) {
        const f = (k / 10) * Math.PI;
        const px = cx - nx * TURN * Math.cos(f) + tx * TURN * Math.sin(f) * 0.9;
        const pz = cz - nz * TURN * Math.cos(f) + tz * TURN * Math.sin(f) * 0.9;
        y += (g * Math.PI * TURN) / 10 * 0.6;
        pts.push({ x: px, z: pz, y });
      }
      const last = pts[pts.length - 1];
      r = Math.hypot(last.x - VX, last.z - VZ); th = Math.atan2(last.z - VZ, last.x - VX);
      dir = -dir;
    }
  }
  // finish the climb around the cone at a safe distance from the rim
  r = Math.max(r, RIM_R + 8);
  while (y < RIM_H - 7.5 && guard++ < 6000) { y += g * ds; th += (dir * ds) / r; const p = fromV(r, th); pts.push({ x: p.x, z: p.z, y }); }
  // straight over the rim through a cut
  const thE = th;
  const rimCut = RIM_H - 5.5;
  for (let k = 1; k <= 8; k++) { const rr2 = lerp(r, RIM_R - 1.5, k / 8); const p = fromV(rr2, thE); pts.push({ x: p.x, z: p.z, y: lerp(y, rimCut, k / 8) }); }
  ROAD.push(...pts);
  POI.rimTop = { ...fromV(RIM_R + 2, thE), y: rimCut, a: thE };
  // crater spiral
  let cy = rimCut, cth = thE;
  const cps = [{ ...fromV(RIM_R - 1.5, thE), y: rimCut }];
  guard = 0;
  while (cy > CRATER_Y + 0.6 && guard++ < 2000) {
    cy = Math.max(cy - g * ds, CRATER_Y + 0.5);
    const cr = Math.max(craterWallR(cy) + 0.6, CRATER_FLOOR_R + 1);
    cth += ds / cr;
    const p = fromV(cr, cth);
    cps.push({ x: p.x, z: p.z, y: cy });
  }
  CRATER_ROAD.push(...cps);
  POI.craterRoadEnd = cps[cps.length - 1];
}

// ============================================================ heightfield + carving
function carvePath(pts, halfW, blend, opts = {}) {
  const N = GN * GN;
  const bestD = carvePath.bd || (carvePath.bd = new Float32Array(N));
  const bestY = carvePath.by || (carvePath.by = new Float32Array(N));
  bestD.fill(1e9);
  const touched = [];
  const R = halfW + blend;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const ix0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - R + HALF) / STEP)), ix1 = Math.min(SEG, Math.ceil((Math.max(a.x, b.x) + R + HALF) / STEP));
    const iz0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - R + HALF) / STEP)), iz1 = Math.min(SEG, Math.ceil((Math.max(a.z, b.z) + R + HALF) / STEP));
    const abx = b.x - a.x, abz = b.z - a.z, ab2 = abx * abx + abz * abz || 1;
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const x = -HALF + ix * STEP, z = -HALF + iz * STEP;
      const t = clamp(((x - a.x) * abx + (z - a.z) * abz) / ab2, 0, 1);
      const d = Math.hypot(x - a.x - abx * t, z - a.z - abz * t);
      const idx = iz * GN + ix;
      if (d < bestD[idx]) { if (bestD[idx] === 1e9) touched.push(idx); bestD[idx] = d; bestY[idx] = a.y + (b.y - a.y) * t; }
    }
  }
  const strength = opts.strength ?? 1;
  for (const idx of touched) {
    const d = bestD[idx];
    const w = (1 - smoothstep(halfW, halfW + blend, d)) * strength;
    if (w <= 0) continue;
    let target = bestY[idx] + (opts.lift || 0);
    if (opts.depth) target = bestY[idx] + 0.35 - (opts.depth + 0.35) * (1 - smoothstep(halfW * 0.25, halfW * 1.05, d));
    if (opts.onlyDown && target > H[idx]) continue;
    H[idx] = lerp(H[idx], target, w);
  }
}
function carvePad(p) {
  const R = (p.r || Math.hypot(p.hw, p.hl)) + p.blend + 2;
  const ix0 = Math.max(0, Math.floor((p.x - R + HALF) / STEP)), ix1 = Math.min(SEG, Math.ceil((p.x + R + HALF) / STEP));
  const iz0 = Math.max(0, Math.floor((p.z - R + HALF) / STEP)), iz1 = Math.min(SEG, Math.ceil((p.z + R + HALF) / STEP));
  const c = Math.cos(p.yaw || 0), s = Math.sin(p.yaw || 0);
  for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
    const x = -HALF + ix * STEP, z = -HALF + iz * STEP, dx = x - p.x, dz = z - p.z;
    let d;
    if (p.r) d = Math.hypot(dx, dz) - p.r;
    else { const lx = Math.abs(dx * c - dz * s) - p.hw, lz = Math.abs(dx * s + dz * c) - p.hl; d = Math.max(lx, lz) > 0 ? Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) : Math.max(lx, lz); }
    let w = 1 - smoothstep(0, p.blend, d);
    if (w <= 0) continue;
    const idx = iz * GN + ix;
    H[idx] = lerp(H[idx], p.y, w);
  }
}
function buildHeights() {
  for (let iz = 0; iz < GN; iz++) for (let ix = 0; ix < GN; ix++) H[iz * GN + ix] = rawHeight(-HALF + ix * STEP, -HALF + iz * STEP);
  for (const tr of TRAILS) carvePath(tr.pts, tr.halfW, 3.2, { strength: 0.85 });
  carvePath(ROAD, 3.2, 5);
  carvePath(CRATER_ROAD, 2.8, 1.6, { onlyDown: true });
  for (const p of PADS) carvePad(p);
  poolBank();
  for (const rv of RIVER) carvePath(rv.pts, rv.halfW, 4, { depth: 1.5 });
  carvePath(LAVA, 4.5, 7, { depth: 2.2 });
}
// a lip of rock around the plunge pool so the water sits in a basin
function poolBank() {
  const p = POI.pool, R = 14;
  for (let iz = Math.floor((p.z - R + HALF) / STEP); iz <= Math.ceil((p.z + R + HALF) / STEP); iz++) for (let ix = Math.floor((p.x - R + HALF) / STEP); ix <= Math.ceil((p.x + R + HALF) / STEP); ix++) {
    const d = Math.hypot(-HALF + ix * STEP - p.x, -HALF + iz * STEP - p.z), i = iz * GN + ix;
    if (d < 8.6) H[i] = Math.min(H[i], POI.poolY - 1.6 + (d / 8.6) * 0.9);
    else if (d < 13) H[i] = Math.max(H[i], POI.poolY + 0.45 * (1 - smoothstep(10.5, 13, d)));
  }
}
function terrainHeight(x, z) {
  const fx = (x + HALF) / STEP, fz = (z + HALF) / STEP;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  if (ix < 0 || iz < 0 || ix >= SEG || iz >= SEG) return -20;
  const tx = fx - ix, tz = fz - iz;
  const a = H[iz * GN + ix], b = H[(iz + 1) * GN + ix], c = H[(iz + 1) * GN + ix + 1], d = H[iz * GN + ix + 1];
  if (tx + tz <= 1) return a + (d - a) * tx + (b - a) * tz;
  return c + (b - c) * (1 - tx) + (d - c) * (1 - tz);
}
function terrainNormalY(x, z) {
  const gx = (terrainHeight(x + 0.8, z) - terrainHeight(x - 0.8, z)) / 1.6;
  const gz = (terrainHeight(x, z + 0.8) - terrainHeight(x, z - 0.8)) / 1.6;
  return 1 / Math.sqrt(gx * gx + gz * gz + 1);
}
function terrainGrad(x, z) {
  return [(terrainHeight(x + 0.8, z) - terrainHeight(x - 0.8, z)) / 1.6, (terrainHeight(x, z + 0.8) - terrainHeight(x, z - 0.8)) / 1.6];
}
function inTerrainHole(x, z) {
  if ((x - VX) ** 2 + (z - VZ) ** 2 < SILO_R * SILO_R) return true;
  for (const h of HOLES) {
    const dx = x - h.cx, dz = z - h.cz;
    const lx = dx * h.c - dz * h.s, lz = dx * h.s + dz * h.c;
    if (Math.abs(lx) < h.hw && Math.abs(lz) < h.hl) return true;
  }
  return false;
}
function addHole(cx, cz, hw, hl, yaw, y0, y1) { HOLES.push({ cx, cz, hw, hl, yaw, c: Math.cos(yaw), s: Math.sin(yaw), y0, y1 }); }
// River surface at a point (or null when not in the river)
function riverAt(x, z) {
  for (const rv of RIVER) {
    const pts = rv.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (Math.max(a.x, b.x) + 6 < x || Math.min(a.x, b.x) - 6 > x || Math.max(a.z, b.z) + 6 < z || Math.min(a.z, b.z) - 6 > z) continue;
      const abx = b.x - a.x, abz = b.z - a.z;
      const t = clamp(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz), 0, 1);
      if (Math.hypot(x - a.x - abx * t, z - a.z - abz * t) < rv.halfW) return a.y + (b.y - a.y) * t;
    }
  }
  if ((x - POI.pool.x) ** 2 + (z - POI.pool.z) ** 2 < 8.5 * 8.5) return POI.poolY;
  return null;
}

// ============================================================ terrain mask (paths, road, lava, wet)
const MASK_N = 1024;
let maskTex = null, maskData = null;
function paintMask() {
  maskData = new Uint8Array(MASK_N * MASK_N * 4);
  const px = (x) => ((x + HALF) / (HALF * 2)) * MASK_N;
  const paint = (pts, halfW, soft, ch, noiseAmt = 0) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const R = halfW + soft + noiseAmt;
      const x0 = Math.max(0, Math.floor(px(Math.min(a.x, b.x) - R))), x1 = Math.min(MASK_N - 1, Math.ceil(px(Math.max(a.x, b.x) + R)));
      const z0 = Math.max(0, Math.floor(px(Math.min(a.z, b.z) - R))), z1 = Math.min(MASK_N - 1, Math.ceil(px(Math.max(a.z, b.z) + R)));
      const abx = b.x - a.x, abz = b.z - a.z, ab2 = abx * abx + abz * abz || 1;
      for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
        const x = ((ix + 0.5) / MASK_N) * HALF * 2 - HALF, z = ((iz + 0.5) / MASK_N) * HALF * 2 - HALF;
        const t = clamp(((x - a.x) * abx + (z - a.z) * abz) / ab2, 0, 1);
        let d = Math.hypot(x - a.x - abx * t, z - a.z - abz * t);
        if (noiseAmt) d -= noiseAmt * (0.5 + 0.5 * noise2(x * 0.05, z * 0.05)) + noiseAmt * 0.4 * noise2(x * 0.2, z * 0.2);
        const v = Math.round((1 - smoothstep(halfW - soft * 0.3, halfW + soft, d)) * 255);
        const k = (iz * MASK_N + ix) * 4 + ch;
        if (v > maskData[k]) maskData[k] = v;
      }
    }
  };
  for (const tr of TRAILS) paint(tr.pts, tr.halfW * 0.8, 1.4, 0, 0.6);
  paint(ROAD, 2.6, 1.0, 1);
  paint(CRATER_ROAD, 2.4, 1.0, 1);
  paint([{ x: -18, z: POI.plaza.z }, { x: 18, z: POI.plaza.z }], 14, 2, 1);
  paint(LAVA, 2, 26, 2, 12);
  for (const rv of RIVER) paint(rv.pts, rv.halfW + 1.5, 2, 3);
  maskTex = new THREE.DataTexture(maskData, MASK_N, MASK_N, THREE.RGBAFormat);
  maskTex.magFilter = THREE.LinearFilter; maskTex.minFilter = THREE.LinearMipmapLinearFilter; maskTex.generateMipmaps = true;
  maskTex.needsUpdate = true;
}
function maskAt(x, z, ch) {
  const ix = clamp(Math.floor(((x + HALF) / (HALF * 2)) * MASK_N), 0, MASK_N - 1), iz = clamp(Math.floor(((z + HALF) / (HALF * 2)) * MASK_N), 0, MASK_N - 1);
  return maskData[(iz * MASK_N + ix) * 4 + ch] / 255;
}

// ============================================================ terrain mesh
let terrainMesh = null, bakeAttr = null;
const holeA = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 0));
const holeB = Array.from({ length: 8 }, () => new THREE.Vector4(1, 0, 0, 0));
function buildTerrainMesh() {
  const pos = new Float32Array(GN * GN * 3);
  for (let iz = 0; iz < GN; iz++) for (let ix = 0; ix < GN; ix++) {
    const i = iz * GN + ix;
    pos[i * 3] = -HALF + ix * STEP; pos[i * 3 + 1] = H[i]; pos[i * 3 + 2] = -HALF + iz * STEP;
  }
  const idx = new Uint32Array(SEG * SEG * 6);
  let k = 0;
  for (let iz = 0; iz < SEG; iz++) for (let ix = 0; ix < SEG; ix++) {
    const a = iz * GN + ix, b = (iz + 1) * GN + ix, c = (iz + 1) * GN + ix + 1, d = iz * GN + ix + 1;
    idx[k++] = a; idx[k++] = b; idx[k++] = d; idx[k++] = b; idx[k++] = c; idx[k++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  bakeAttr = new THREE.BufferAttribute(bakeTerrain(), 3);
  geo.setAttribute('aBake', bakeAttr);
  geo.computeBoundingSphere();

  HOLES.forEach((h, i) => { holeA[i].set(h.cx, h.cz, h.hw, h.hl); holeB[i].set(h.c, h.s, h.y0, h.y1); });
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMask = { value: maskTex };
    sh.uniforms.uTime = U.time;
    sh.uniforms.uDay = U.day;
    sh.uniforms.uRain = U.rain;
    sh.uniforms.uHoleA = { value: holeA };
    sh.uniforms.uHoleB = { value: holeB };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aBake;\nvarying vec3 vBake;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvBake = aBake;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_NOISE + TERRAIN_PARS)
      .replace('#include <color_fragment>', TERRAIN_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = tRough;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += tEmis;')
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(
        'getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= mix(vBake.x, vBake.z, uDay);'))
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= vBake.y;');
  };
  terrainMesh = new THREE.Mesh(geo, mat);
  terrainMesh.receiveShadow = true; terrainMesh.castShadow = true;
  scene.add(terrainMesh);
}
const TERRAIN_PARS = /* glsl */ `
uniform sampler2D uMask; uniform float uTime, uDay, uRain; uniform vec4 uHoleA[8]; uniform vec4 uHoleB[8];
varying vec3 vBake; varying vec3 vWPos; varying vec3 vWNrm;
`;
const TERRAIN_COLOR = /* glsl */ `
for (int i = 0; i < 8; i++) {
  vec4 A = uHoleA[i]; vec4 B = uHoleB[i];
  if (A.z <= 0.0) continue;
  vec2 d = vWPos.xz - A.xy;
  vec2 l = vec2(d.x * B.x - d.y * B.y, d.x * B.y + d.y * B.x);
  if (abs(l.x) < A.z && abs(l.y) < A.w && vWPos.y > B.z && vWPos.y < B.w) discard;
}
float vr = length(vWPos.xz - vec2(${VX.toFixed(1)}, ${VZ.toFixed(1)}));
if (vr < ${(SILO_R - 0.05).toFixed(2)} && vWPos.y > 120.0) discard;
vec4 Mk = texture2D(uMask, (vWPos.xz + ${HALF.toFixed(1)}) / ${(HALF * 2).toFixed(1)});
float h = vWPos.y;
float slope = 1.0 - clamp(vWNrm.y, 0.0, 1.0);
float n1 = fbm3o(vWPos.xz * 0.045);
float n2 = vnoise(vWPos.xz * 0.6);
float n3 = vnoise(vWPos.xz * 3.1);
vec3 jungle = mix(vec3(0.026, 0.046, 0.018), vec3(0.052, 0.072, 0.026), n1);
jungle = mix(jungle, vec3(0.05, 0.036, 0.021), smoothstep(0.55, 0.85, n2) * 0.55);
vec3 sand = mix(vec3(0.22, 0.18, 0.12), vec3(0.29, 0.24, 0.16), n2);
vec3 rock = mix(vec3(0.045, 0.042, 0.04), vec3(0.09, 0.083, 0.076), n2) * (0.75 + 0.5 * n3);
vec3 ash = mix(vec3(0.036, 0.031, 0.03), vec3(0.07, 0.048, 0.036), n1);
ash = mix(ash, vec3(0.1, 0.04, 0.022), smoothstep(0.62, 0.82, fbm3o(vec2(atan(vWPos.z + 100.0, vWPos.x) * 9.0, h * 0.04))) * 0.7);
vec3 col = jungle;
float sandM = smoothstep(4.0, 2.2, h + (n2 - 0.5) * 1.6);
col = mix(col, sand, sandM);
col = mix(col, sand * 0.38, smoothstep(0.9, -0.2, h) * sandM);
float ashM = smoothstep(48.0, 78.0, h + (n1 - 0.5) * 34.0) * smoothstep(310.0, 230.0, vr);
col = mix(col, ash, ashM);
float rockM = smoothstep(0.32, 0.55, slope + (n2 - 0.5) * 0.22);
col = mix(col, rock, rockM);
col = mix(col, col * vec3(0.55, 0.75, 0.8), smoothstep(-0.5, -3.0, h));
vec3 dirt = mix(vec3(0.052, 0.036, 0.022), vec3(0.075, 0.053, 0.034), n3);
vec3 gravel = mix(vec3(0.04, 0.037, 0.035), vec3(0.065, 0.06, 0.056), n3);
col = mix(col, dirt, Mk.r * (1.0 - rockM * 0.6));
col = mix(col, gravel, Mk.g);
col = mix(col, col * 0.55, Mk.a * (1.0 - sandM));
float tRough = mix(0.95, 0.6, max(sandM * smoothstep(1.0, -0.2, h), Mk.a * 0.6));
vec3 tEmis = vec3(0.0);
if (Mk.b > 0.01) {
  vec3 crust = mix(vec3(0.011, 0.009, 0.009), vec3(0.028, 0.022, 0.02), n2);
  float crustM = smoothstep(0.02, 0.3, Mk.b);
  col = mix(col, crust, crustM);
  vec2 cq = vWPos.xz * 0.35; cq += vec2(vnoise(cq * 0.7), vnoise(cq * 0.7 + 5.3)) * 0.9;
  float e1 = cellEdge(cq), e2 = cellEdge(vWPos.xz * 1.1 + 3.0 + cq * 0.3);
  float ew = mix(0.018, 0.06, vnoise(cq * 1.3));
  float hotPatch = smoothstep(0.55, 0.8, vnoise(vWPos.xz * 0.045 + vec2(uTime * 0.01, 0.0)));
  float nearFlow = smoothstep(0.62, 0.97, Mk.b);
  float glow = max(hotPatch * crustM, nearFlow * smoothstep(0.3, 0.62, vnoise(vWPos.xz * 0.07 + 7.0)));
  float crack = (1.0 - smoothstep(0.0, ew, e1)) * glow + (1.0 - smoothstep(0.0, 0.025, e2)) * glow * 0.35;
  float pulse = 0.65 + 0.35 * sin(uTime * 0.7 + vnoise(vWPos.xz * 0.05) * 6.28);
  col = mix(col, vec3(0.05, 0.02, 0.012), (1.0 - smoothstep(0.0, 0.2, e1)) * crustM * 0.6);
  tEmis += vec3(3.2, 0.7, 0.09) * crack * pulse;
  tRough = 0.85;
}
float crat = smoothstep(37.0, 27.0, vr) * smoothstep(128.0, 134.0, h);
if (crat > 0.0) {
  float crk = (1.0 - smoothstep(0.0, 0.06, cellEdge(vWPos.xz * 0.2 + 3.0))) * smoothstep(0.35, 0.7, vnoise(vWPos.xz * 0.08));
  float ring = smoothstep(26.0, 22.6, vr);
  col = mix(col, vec3(0.018, 0.014, 0.013), crat);
  tEmis += vec3(3.4, 0.75, 0.1) * (crk * 0.9 + ring * 0.7) * crat * (0.7 + 0.3 * sin(uTime * 1.3 + vr * 0.7));
}
float seam = smoothstep(150.0, 170.0, h) * smoothstep(${(RIM_R + 25).toFixed(1)}, ${RIM_R.toFixed(1)}, vr);
if (seam > 0.0) {
  vec2 sp = vec2(atan(vWPos.z + 100.0, vWPos.x) * vr, h) * 0.22;
  sp += vec2(vnoise(sp * 0.6), vnoise(sp * 0.6 + 4.1)) * 0.9;
  float c4 = cellEdge(sp);
  float patchy = smoothstep(0.7, 0.84, vnoise(sp * 0.18 + 2.0));
  tEmis += vec3(2.0, 0.42, 0.05) * (1.0 - smoothstep(0.0, 0.04, c4)) * patchy * seam * (0.6 + 0.4 * sin(uTime * 0.9 + h));
}
// wet ground in the rain: darker and shinier
col *= 1.0 - uRain * 0.28 * (1.0 - Mk.b);
tRough = mix(tRough, 0.42, uRain * (1.0 - sandM * 0.3));
diffuseColor.rgb = col;
`;

// Moon visibility (terrain self-shadow beyond the shadow map) and cavity AO, baked per vertex.
function lightVis(x, z, h0, dir) {
  const hl = Math.hypot(dir.x, dir.z), mdx = dir.x / hl, mdz = dir.z / hl, tanE = dir.y / hl;
  let occ = -1;
  for (let s = 3; s < 560; s = s * 1.1 + 1.5) {
    const sx = x + mdx * s, sz = z + mdz * s;
    if (sx < -HALF || sx > HALF || sz < -HALF || sz > HALF) break;
    const o = (terrainHeight(sx, sz) - h0 - 0.4) / s;
    if (o > occ) occ = o;
    if (occ > tanE + 0.08) break;
  }
  return smoothstep(tanE + 0.06, tanE - 0.05, occ);
}
function bakeTerrain() {
  const out = new Float32Array(GN * GN * 3);
  for (let iz = 0; iz < GN; iz++) for (let ix = 0; ix < GN; ix++) {
    const i = iz * GN + ix, x = -HALF + ix * STEP, z = -HALF + iz * STEP, h0 = H[i];
    const vis = lightVis(x, z, h0, MOON_DIR);
    let avg = 0;
    for (const [ox, oz] of [[6, 0], [-6, 0], [0, 6], [0, -6], [12, 12], [-12, 12], [12, -12], [-12, -12]]) avg += terrainHeight(x + ox, z + oz);
    avg /= 8;
    const ao = clamp(1 - Math.max(avg - h0, 0) * 0.07, 0.4, 1);
    out[i * 3] = vis; out[i * 3 + 1] = ao; out[i * 3 + 2] = lightVis(x, z, h0, SUN_DIR);
  }
  return out;
}
// Trees darken the ground under them (moon and sky) — cheap canopy shadow for the far jungle.
function darkenUnder(x, z, r, k) {
  const ix0 = Math.max(0, Math.floor((x - r + HALF) / STEP)), ix1 = Math.min(SEG, Math.ceil((x + r + HALF) / STEP));
  const iz0 = Math.max(0, Math.floor((z - r + HALF) / STEP)), iz1 = Math.min(SEG, Math.ceil((z + r + HALF) / STEP));
  const a = bakeAttr.array;
  for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
    const d = Math.hypot(-HALF + ix * STEP - x, -HALF + iz * STEP - z);
    if (d > r) continue;
    const f = 1 - k * (1 - d / r);
    const i = (iz * GN + ix) * 3;
    a[i] *= f; a[i + 1] *= lerp(1, f, 0.6); a[i + 2] *= lerp(1, f, 0.8);
  }
}

// ============================================================ sky
let skyMesh = null;
function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: U.time, uFlash: U.flash, uMoon: { value: MOON_DIR }, uSun: { value: SUN_DIR }, uDay: U.day, uRain: U.rain, uFog: { value: scene.fog.color }, uVolc: { value: new THREE.Vector3(VX, 150, VZ) } },
    vertexShader: /* glsl */ `varying vec3 vDir; varying vec3 vW;
      void main(){ vDir = normalize(position); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 p = projectionMatrix * viewMatrix * w; gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFlash, uDay, uRain; uniform vec3 uMoon, uSun, uVolc, uFog; varying vec3 vDir; varying vec3 vW;
      ${GLSL_NOISE}
      float stars(vec3 d, float scale, float thresh){
        vec3 p = d * scale; vec3 i = floor(p); vec3 f = fract(p);
        float h = hash13(i);
        if (h < thresh) return 0.0;
        vec3 c = vec3(hash13(i + 1.3), hash13(i + 2.7), hash13(i + 5.1)) * 0.7 + 0.15;
        float b = (h - thresh) / (1.0 - thresh);
        float tw = 0.65 + 0.35 * sin(uTime * (1.5 + h * 3.0) + h * 40.0);
        return smoothstep(0.09, 0.0, length(f - c)) * b * tw;
      }
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 zen = mix(vec3(0.008, 0.016, 0.04), vec3(0.16, 0.34, 0.75), uDay);
        vec3 hor = mix(vec3(0.05, 0.1, 0.16), vec3(0.62, 0.74, 0.88), uDay);
        zen = mix(zen, mix(vec3(0.02, 0.025, 0.03), vec3(0.32, 0.35, 0.4), uDay), uRain * 0.8);
        hor = mix(hor, mix(vec3(0.05, 0.06, 0.07), vec3(0.5, 0.53, 0.57), uDay), uRain * 0.8);
        vec3 col = mix(hor, zen, pow(clamp(y, 0.0, 1.0), 0.42));
        if (y < 0.0) col = hor * 0.7;
        float md = dot(d, uMoon);
        col += ((vec3(0.07, 0.1, 0.16) * pow(max(md, 0.0), 6.0) + vec3(0.12, 0.15, 0.2) * pow(max(md, 0.0), 80.0)) * (1.0 - uRain * 0.7)) * (1.0 - uDay);
        // milky way band
        vec3 bn = normalize(vec3(0.5, 0.25, 0.83));
        float band = exp(-pow(dot(d, bn) / 0.2, 2.0));
        float mw = fbm(vec2(atan(d.z, d.x) * 3.0, d.y * 6.0)) * band;
        col += vec3(0.03, 0.035, 0.05) * mw * smoothstep(0.0, 0.3, y);
        float st = (1.0 - uDay) * (1.0 - uRain * 0.8) * stars(d, 260.0, 0.982) * 1.4 + stars(d, 520.0, 0.99) * 0.9 + mw * stars(d, 700.0, 0.97) * 0.8;
        // clouds
        vec2 cp = d.xz / (y + 0.12);
        float cl = fbm(cp * 1.15 + vec2(uTime * 0.004, uTime * 0.0015) * (1.0 + uRain * 3.0));
        cl = smoothstep(mix(0.5, 0.25, uRain), mix(0.82, 0.6, uRain), cl) * smoothstep(0.02, 0.25, y);
        float sd = max(dot(d, uSun), 0.0);
        vec3 cloudNight = vec3(0.045, 0.055, 0.08) + vec3(0.2, 0.24, 0.3) * pow(max(md, 0.0), 10.0);
        vec3 cloudDay = vec3(0.86, 0.88, 0.92) - vec3(0.25, 0.22, 0.18) * fbm(cp * 3.0) + vec3(0.4, 0.35, 0.25) * pow(sd, 8.0);
        vec3 cloudCol = mix(cloudNight, cloudDay, uDay) * mix(1.0, 0.55, uRain);
        // lava glow under the clouds near the volcano and lightning
        vec3 toV = normalize(uVolc - cameraPosition);
        float vg = pow(max(dot(d, toV), 0.0), 18.0);
        cloudCol += vec3(0.35, 0.09, 0.02) * vg * 1.5 + vec3(0.6, 0.6, 0.75) * uFlash * pow(max(dot(d, toV), 0.0), 6.0);
        col += vec3(0.12, 0.03, 0.006) * vg * smoothstep(-0.05, 0.25, y);
        col = mix(col + st * vec3(0.9, 0.93, 1.0) * smoothstep(0.0, 0.12, y) * (1.0 - smoothstep(0.996, 0.999, md)), cloudCol, cl * 0.92);
        // moon disc
        float disc = smoothstep(0.99935, 0.99955, md) * (1.0 - uDay) * (1.0 - uRain * 0.92);
        float mare = fbm(d.xy * 380.0 + d.z * 120.0);
        col = mix(col, vec3(2.2, 2.25, 2.35) * (0.78 + 0.3 * mare), disc * (1.0 - cl * 0.7));
        col += uDay * (1.0 - cl * 0.8) * (1.0 - uRain * 0.85) * (vec3(1.0, 0.85, 0.6) * pow(sd, 400.0) * 18.0 + vec3(0.5, 0.42, 0.3) * pow(sd, 24.0) * 0.5);
        col = mix(col, uFog, smoothstep(0.16, 0.0, y));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  skyMesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), mat);
  skyMesh.frustumCulled = false;
  skyMesh.renderOrder = -10;
  scene.add(skyMesh);
}

// ============================================================ ocean
let oceanMat = null, heightTex = null;
function buildOcean() {
  const N = 512, data = new Uint8Array(N * N * 4);
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
    const h = terrainHeight(((ix + 0.5) / N) * HALF * 2 - HALF, ((iz + 0.5) / N) * HALF * 2 - HALF);
    data[(iz * N + ix) * 4] = Math.round(clamp((h + 20) / 40, 0, 1) * 255);
    data[(iz * N + ix) * 4 + 3] = 255;
  }
  heightTex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  heightTex.magFilter = THREE.LinearFilter; heightTex.minFilter = THREE.LinearFilter; heightTex.needsUpdate = true;
  oceanMat = new THREE.ShaderMaterial({
    transparent: true, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uHeight: { value: null }, uMoon: { value: MOON_DIR }, uDay: { value: 0 }, uRain: { value: 0 } }]),
    vertexShader: /* glsl */ `varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uDay, uRain; uniform sampler2D uHeight; uniform vec3 uMoon; varying vec3 vW;
      #include <fog_pars_fragment>
      ${GLSL_NOISE}
      vec2 wgrad(vec2 p, float t){
        float e = 0.15;
        float a = fbm3o(p * 0.18 + vec2(t * 0.05, t * 0.03)) + 0.5 * fbm3o(p * 0.55 - vec2(t * 0.09, -t * 0.04));
        float bx = fbm3o((p + vec2(e, 0.0)) * 0.18 + vec2(t * 0.05, t * 0.03)) + 0.5 * fbm3o((p + vec2(e, 0.0)) * 0.55 - vec2(t * 0.09, -t * 0.04));
        float bz = fbm3o((p + vec2(0.0, e)) * 0.18 + vec2(t * 0.05, t * 0.03)) + 0.5 * fbm3o((p + vec2(0.0, e)) * 0.55 - vec2(t * 0.09, -t * 0.04));
        return vec2(bx - a, bz - a) / e;
      }
      void main(){
        float dist = length(vW - cameraPosition);
        vec2 g = wgrad(vW.xz, uTime) * mix(0.9, 0.12, smoothstep(30.0, 900.0, dist));
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vW);
        float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 R = reflect(-V, n);
        vec3 sky = mix(mix(vec3(0.05, 0.1, 0.16), vec3(0.6, 0.72, 0.86), uDay), mix(vec3(0.012, 0.024, 0.05), vec3(0.2, 0.38, 0.72), uDay), clamp(R.y * 2.0, 0.0, 1.0));
        sky = mix(sky, vec3(0.06, 0.07, 0.08) + uDay * 0.4, uRain * 0.6);
        float md = max(dot(R, uMoon), 0.0);
        float spec = (pow(md, 420.0) * 9.0 + pow(md, 40.0) * 0.18) * (1.0 - uRain * 0.7) * mix(1.0, 2.5, uDay);
        // warm reflections of the crater and the lava
        vec3 toC = normalize(vec3(0.0, 150.0, -100.0) - vW);
        vec3 toL = normalize(vec3(296.0, 4.0, 32.0) - vW);
        vec3 warm = vec3(1.2, 0.3, 0.05) * (pow(max(dot(R, toC), 0.0), 60.0) * 0.6 + pow(max(dot(R, toL), 0.0), 30.0) * 1.2 * exp(-length(vW.xz - vec2(296.0, 32.0)) / 220.0));
        vec2 huv = (vW.xz + ${HALF.toFixed(1)}) / ${(HALF * 2).toFixed(1)};
        float th = (huv.x > 0.0 && huv.x < 1.0 && huv.y > 0.0 && huv.y < 1.0) ? texture2D(uHeight, huv).r * 40.0 - 20.0 : -20.0;
        float depth = -th;
        vec3 deep = mix(vec3(0.004, 0.02, 0.035), vec3(0.01, 0.09, 0.14), uDay), shallow = mix(vec3(0.03, 0.1, 0.105), vec3(0.08, 0.36, 0.36), uDay);
        vec3 body = mix(shallow, deep, smoothstep(0.0, 9.0, depth));
        vec3 col = mix(body, sky, fres) + spec * vec3(0.8, 0.88, 1.0) + warm * fres * 3.0;
        float wave = sin(uTime * 1.1 - depth * 2.2 + fbm3o(vW.xz * 0.08) * 6.0);
        float foam = smoothstep(1.4, 0.0, depth) * (0.55 + 0.45 * wave) * smoothstep(0.35, 0.65, fbm3o(vW.xz * 0.6 + uTime * 0.2));
        foam += smoothstep(0.35, 0.0, depth) * 0.6;
        col = mix(col, mix(vec3(0.32, 0.36, 0.4), vec3(0.85, 0.9, 0.92), uDay), clamp(foam, 0.0, 1.0) * 0.75);
        col += uRain * 0.05 * smoothstep(0.93, 1.0, hash12(floor(vW.xz * 3.0) + floor(uTime * 8.0)));
        float alpha = mix(0.45, 0.97, smoothstep(0.0, 2.5, depth));
        alpha = max(alpha, foam * 0.8);
        gl_FragColor = vec4(col, alpha);
        #ifdef USE_FOG
        gl_FragColor.rgb = applyFog(gl_FragColor.rgb, vW);
        #endif
      }`,
  });
  oceanMat.uniforms.uHeight.value = heightTex;
  oceanMat.uniforms.uTime = U.time; oceanMat.uniforms.uDay = U.day; oceanMat.uniforms.uRain = U.rain; oceanMat.uniforms.uMoon = U.lightDir;
  const geo = new THREE.PlaneGeometry(9000, 9000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const ocean = new THREE.Mesh(geo, oceanMat);
  ocean.renderOrder = 1;
  scene.add(ocean);
}

// ============================================================ rivers, waterfall, lava
const flowMats = [];
function waterFlowMaterial(opts = {}) {
  const m = new THREE.ShaderMaterial({
    transparent: true, fog: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uSpeed: { value: opts.speed || 1.2 }, uMoon: { value: MOON_DIR }, uWidth: { value: opts.width || 6 }, uDay: { value: 0 } }]),
    vertexShader: /* glsl */ `varying vec3 vW; varying vec2 vUv;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uSpeed, uWidth, uDay; uniform vec3 uMoon; varying vec3 vW; varying vec2 vUv;
      #include <fog_pars_fragment>
      ${GLSL_NOISE}
      void main(){
        vec2 p = vec2(vUv.x * 0.9, vUv.y * 0.35 - uTime * uSpeed * 0.6);
        float n = fbm(p * 2.0);
        float n2 = fbm(p * 5.0 + 3.0);
        vec3 nn = normalize(vec3((n - 0.5) * 0.9, 1.0, (n2 - 0.5) * 0.9));
        vec3 V = normalize(cameraPosition - vW);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(nn, V), 0.0), 5.0);
        vec3 R = reflect(-V, nn);
        vec3 sky = mix(mix(vec3(0.05, 0.09, 0.13), vec3(0.6, 0.72, 0.86), uDay), mix(vec3(0.012, 0.022, 0.04), vec3(0.22, 0.4, 0.75), uDay), clamp(R.y * 2.0, 0.0, 1.0));
        float md = max(dot(R, uMoon), 0.0);
        vec3 col = mix(mix(vec3(0.015, 0.035, 0.04), vec3(0.06, 0.2, 0.2), uDay), sky, fres) + vec3(0.8, 0.9, 1.0) * (pow(md, 200.0) * 4.0 + pow(md, 20.0) * 0.1);
        float edge = abs(vUv.x / uWidth - 0.5) * 2.0;
        float foam = smoothstep(0.62, 0.8, n2) * 0.5 + smoothstep(0.7, 1.0, edge) * 0.4 * n;
        col = mix(col, vec3(0.3, 0.34, 0.37), foam);
        float alpha = (0.82 - 0.5 * smoothstep(0.75, 1.0, edge));
        gl_FragColor = vec4(col, alpha);
        #ifdef USE_FOG
        gl_FragColor.rgb = applyFog(gl_FragColor.rgb, vW);
        #endif
      }`,
  });
  m.uniforms.uTime = U.time; m.uniforms.uDay = U.day; m.uniforms.uMoon = U.lightDir;
  flowMats.push(m);
  return m;
}
function lavaMaterial(mode = 0, speed = 0.25, bright = 1) {
  const m = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uSpeed: { value: speed }, uMode: { value: mode }, uBright: { value: bright }, uWidth: { value: 8 } }]),
    vertexShader: /* glsl */ `varying vec3 vW; varying vec2 vUv;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uSpeed, uMode, uBright, uWidth; varying vec3 vW; varying vec2 vUv;
      #include <fog_pars_fragment>
      ${GLSL_NOISE}
      void main(){
        vec2 p = uMode < 0.5 ? vec2(vUv.x * 0.5, vUv.y * 0.12 - uTime * uSpeed) : (uMode < 1.5 ? vW.xz * 0.12 + vec2(sin(uTime * 0.05), cos(uTime * 0.04)) * 2.0 : vec2(vUv.x * 0.6, vUv.y * 0.3 + uTime * uSpeed));
        float w = fbm(p * 0.8 + vec2(uTime * 0.02, 0.0));
        float n = fbm(p * 1.6 + w * 2.2);
        float crust = smoothstep(0.5, 0.68, n);
        vec3 hot = vec3(7.0, 2.4, 0.45), mid = vec3(2.6, 0.45, 0.06), dark = vec3(0.035, 0.016, 0.01);
        vec3 c = mix(hot, mid, smoothstep(0.3, 0.55, n));
        c = mix(c, dark, crust);
        c += vec3(1.5, 0.3, 0.04) * (1.0 - smoothstep(0.0, 0.03, abs(n - 0.6))) * crust;
        if (uMode < 0.5) { float e = abs(vUv.x / uWidth - 0.5) * 2.0; c = mix(c, dark, smoothstep(0.6, 0.98, e)); }
        c *= uBright * (0.85 + 0.15 * sin(uTime * 1.7 + n * 8.0));
        gl_FragColor = vec4(c, 1.0);
        #ifdef USE_FOG
        gl_FragColor.rgb = applyFog(gl_FragColor.rgb, vW);
        #endif
      }`,
  });
  m.uniforms.uTime = U.time;
  return m;
}
let waterfallMat = null;
function buildWaterAndLava() {
  // rivers
  for (const rv of RIVER) {
    const w = rv.halfW * 2 + 0.6;
    const pts = rv.pts.map((p) => ({ x: p.x, y: p.y + 0.05, z: p.z }));
    const g = sweepProfile(pts, [[-w / 2, 0], [0, -0.02], [w / 2, 0]]);
    const m = waterFlowMaterial({ speed: rv.part === 'upper' ? 1.8 : 1.0, width: w });
    const mm = new THREE.Mesh(g, m); mm.renderOrder = 2; scene.add(mm);
  }
  // pool
  const pool = new THREE.Mesh(new THREE.CircleGeometry(9, 48).rotateX(-Math.PI / 2), waterFlowMaterial({ speed: 0.3, width: 1 }));
  pool.position.set(POI.pool.x, POI.poolY + 0.04, POI.pool.z); pool.renderOrder = 2; scene.add(pool);
  // waterfall curtain: from the lip down to the pool, slightly bowed
  const dir = POI.dirS, side = { x: -dir.z, z: dir.x };
  const W = 8, cols = 16, rows = 18, top = POI.lipY + 0.2, bot = POI.poolY;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const u = i / cols, v = j / rows;
    const yy = lerp(top, bot, v);
    const out = 0.8 + 9.8 * Math.pow(v, 0.85) + Math.sin(u * Math.PI) * 0.6;
    const bx = POI.lip.x + dir.x * out + side.x * (u - 0.5) * W * (1 + v * 0.25);
    const bz = POI.lip.z + dir.z * out + side.z * (u - 0.5) * W * (1 + v * 0.25);
    pos.push(bx, yy, bz); uv.push(u, v);
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i; idx.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  waterfallMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: /* glsl */ `varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `uniform float uTime; varying vec3 vW; varying vec2 vUv;
      #include <fog_pars_fragment>
      ${GLSL_NOISE}
      void main(){
        float s = fbm(vec2(vUv.x * 16.0, vUv.y * 2.2 - uTime * 2.6));
        float s2 = fbm(vec2(vUv.x * 40.0, vUv.y * 5.0 - uTime * 4.0));
        float a = (0.28 + 0.55 * smoothstep(0.35, 0.75, s) + 0.2 * s2) * smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        vec3 c = mix(vec3(0.05, 0.08, 0.1), vec3(0.42, 0.5, 0.58), smoothstep(0.4, 0.85, s));
        c += vec3(0.35, 0.4, 0.45) * smoothstep(0.75, 1.0, vUv.y) * s2;
        gl_FragColor = vec4(c, a * 0.85);
        #ifdef USE_FOG
        gl_FragColor.rgb = applyFog(gl_FragColor.rgb, vW);
        #endif
      }`,
  });
  waterfallMat.uniforms.uTime = U.time;
  const wf = new THREE.Mesh(g, waterfallMat); wf.renderOrder = 3; scene.add(wf);

  // lava river and lake
  const lavaW = 7.5;
  const lp = LAVA.map((p) => ({ x: p.x, y: p.y + 0.1, z: p.z }));
  const lavaG = sweepProfile(lp, [[-lavaW / 2, -0.1], [-lavaW / 4, 0.05], [0, 0.1], [lavaW / 4, 0.05], [lavaW / 2, -0.1]]);
  const lm = lavaMaterial(0, 0.22, 1); lm.uniforms.uWidth.value = lavaW;
  scene.add(new THREE.Mesh(lavaG, lm));
  const lake = new THREE.Mesh(new THREE.CircleGeometry(VENT.r - 2.5, 40).rotateX(-Math.PI / 2), lavaMaterial(1, 0, 1.15));
  lake.position.set(VENT.x, LAVA_LAKE_Y, VENT.z); scene.add(lake);
  // lights along the lava
  addLight(VENT.x, LAVA_LAKE_Y + 8, VENT.z, 0xff5a1a, 2600, 120, { flicker: 1 });
  for (let i = 6; i < LAVA.length - 2; i += 9) { const p = LAVA[i]; addLight(p.x, p.y + 4, p.z, 0xff5512, 700, 45, { flicker: 1 }); }
}
