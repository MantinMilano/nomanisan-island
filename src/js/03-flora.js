// ============================================================ foliage atlas (all leaves on one canvas)
const ATLAS = 1024;
const REG = {
  palm: [0, 0, 256, 1024], fern: [256, 0, 384, 512], banana: [256, 512, 384, 1024], canopy: [384, 0, 896, 512],
  heart: [384, 512, 640, 768], grass: [640, 512, 896, 768], shrub: [640, 768, 896, 1024], vine: [896, 0, 960, 1024],
  stem: [962, 4, 1020, 60], dead: [384, 768, 640, 1024],
};
const regUV = (r) => ({ u0: r[0] / ATLAS, u1: r[2] / ATLAS, v0: 1 - r[3] / ATLAS, v1: 1 - r[1] / ATLAS });
function leafColor(base, vary = 0.25) {
  const [h, s, l] = base;
  return `hsl(${h + rr(-8, 8)}, ${s + rr(-10, 10) * vary * 4}%, ${l + rr(-8, 8) * vary * 4}%)`;
}
function drawAtlas() {
  return canvasTex(ATLAS, ATLAS, (g) => {
    g.clearRect(0, 0, ATLAS, ATLAS);
    // ---- palm frond: rib up the middle, long leaflets sweeping toward the tip
    {
      const [x0, y0, x1, y1] = REG.palm, cx = (x0 + x1) / 2;
      for (let i = 0; i < 70; i++) {
        const t = i / 70, y = y1 - 30 - t * (y1 - y0 - 50);
        const L = 122 * Math.pow(Math.sin(Math.PI * (0.08 + 0.92 * t)), 0.55) * (1 - t * 0.35);
        for (const sgn of [-1, 1]) {
          const ang = (sgn * Math.PI) / 2 + sgn * -0.75;
          g.strokeStyle = leafColor([92, 42, 26]); g.lineWidth = 7 - t * 4; g.lineCap = 'round';
          g.beginPath(); g.moveTo(cx, y);
          const ex = cx + Math.sin(ang + sgn * 0.1) * L * sgn * sgn, ey = y - Math.cos(ang) * L * 0.25 - L * 0.55;
          g.quadraticCurveTo(cx + sgn * L * 0.55, y - L * 0.15, cx + sgn * L * 0.98, ey + 30);
          g.stroke();
          void ex;
        }
      }
      g.strokeStyle = '#5b6b2c'; g.lineWidth = 6; g.beginPath(); g.moveTo(cx, y1); g.lineTo(cx, y0 + 10); g.stroke();
    }
    // ---- fern frond
    {
      const [x0, y0, x1, y1] = REG.fern, cx = (x0 + x1) / 2;
      for (let i = 0; i < 34; i++) {
        const t = i / 34, y = y1 - 12 - t * (y1 - y0 - 24), L = 58 * Math.sin(Math.PI * (0.12 + 0.88 * t)) * (1 - t * 0.5);
        for (const sgn of [-1, 1]) {
          g.fillStyle = leafColor([100, 46, 24]);
          g.beginPath(); g.moveTo(cx, y);
          for (let k = 0; k <= 6; k++) { const f = k / 6; g.lineTo(cx + sgn * L * f, y - 10 * f - Math.sin(f * Math.PI * 6) * 2.5); }
          for (let k = 6; k >= 0; k--) { const f = k / 6; g.lineTo(cx + sgn * L * f, y + 3 - 10 * f + Math.sin(f * Math.PI * 6) * 2.5); }
          g.fill();
        }
      }
      g.strokeStyle = '#3d4d1f'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, y1); g.lineTo(cx, y0 + 8); g.stroke();
    }
    // ---- banana leaf: long blade with a pale midrib and wind tears
    {
      const [x0, y0, x1, y1] = REG.banana, cx = (x0 + x1) / 2;
      g.fillStyle = '#3c6a26';
      g.beginPath(); g.moveTo(cx, y1 - 4);
      for (let k = 0; k <= 20; k++) { const f = k / 20; g.lineTo(cx - 58 * Math.sin(Math.PI * (0.05 + 0.95 * f)) * (1 - f * 0.3), y1 - 8 - f * (y1 - y0 - 16)); }
      for (let k = 20; k >= 0; k--) { const f = k / 20; g.lineTo(cx + 58 * Math.sin(Math.PI * (0.05 + 0.95 * f)) * (1 - f * 0.3), y1 - 8 - f * (y1 - y0 - 16)); }
      g.fill();
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 9; i++) { const y = y0 + 40 + rng() * (y1 - y0 - 80), sgn = rng() < 0.5 ? -1 : 1; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx + sgn * 64, y - 6); g.lineTo(cx + sgn * rr(14, 30), y + 4); g.stroke(); }
      g.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 60; i++) { const y = y0 + 10 + i * 8.2; g.strokeStyle = 'rgba(20,40,10,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, y); g.lineTo(cx - 56, y - 10); g.moveTo(cx, y); g.lineTo(cx + 56, y - 10); g.stroke(); }
      g.strokeStyle = '#a7b56a'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, y1); g.lineTo(cx, y0 + 8); g.stroke();
    }
    // ---- canopy cluster: overlapping broad leaves
    {
      const [x0, y0, x1, y1] = REG.canopy, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
      for (let i = 0; i < 150; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * 205;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        const L = rr(26, 52), W = L * rr(0.38, 0.5), rot = a + rr(-0.6, 0.6);
        g.save(); g.translate(x, y); g.rotate(rot);
        g.fillStyle = leafColor([108, 44, 20 + (1 - d / 205) * 6]);
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.5, -W, L, 0); g.quadraticCurveTo(L * 0.5, W, 0, 0); g.fill();
        g.strokeStyle = 'rgba(160,190,110,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(L * 0.92, 0); g.stroke();
        g.restore();
      }
      g.restore();
    }
    // ---- heart leaf (elephant ear)
    {
      const [x0, y0, x1, y1] = REG.heart, cx = (x0 + x1) / 2;
      g.fillStyle = '#2f5a24';
      g.beginPath(); g.moveTo(cx, y0 + 6);
      g.bezierCurveTo(cx + 150, y0 + 70, cx + 120, y1 - 30, cx + 18, y1 - 22);
      g.lineTo(cx, y1 - 60); g.lineTo(cx - 18, y1 - 22);
      g.bezierCurveTo(cx - 120, y1 - 30, cx - 150, y0 + 70, cx, y0 + 6); g.fill();
      g.strokeStyle = 'rgba(180,210,140,0.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, y1 - 60); g.lineTo(cx, y0 + 12); g.stroke();
      g.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) { const y = y1 - 70 - i * 24; g.beginPath(); g.moveTo(cx, y); g.quadraticCurveTo(cx + 50, y - 10, cx + 95 - i * 9, y - 30); g.moveTo(cx, y); g.quadraticCurveTo(cx - 50, y - 10, cx - 95 + i * 9, y - 30); g.stroke(); }
    }
    // ---- grass tuft
    {
      const [x0, y0, x1, y1] = REG.grass, cx = (x0 + x1) / 2;
      for (let i = 0; i < 70; i++) {
        const bx = cx + rr(-40, 40), tip = rr(-110, 110), h = rr(140, 245);
        g.strokeStyle = leafColor([85, 40, 28]); g.lineWidth = rr(2, 4.5);
        g.beginPath(); g.moveTo(bx, y1); g.quadraticCurveTo(bx + tip * 0.3, y1 - h * 0.6, bx + tip, y1 - h); g.stroke();
      }
    }
    // ---- shrub card
    {
      const [x0, y0, x1, y1] = REG.shrub, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + 20;
      g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
      for (let i = 0; i < 160; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * 100;
        const x = cx + Math.cos(a) * d * 1.1, y = cy + Math.sin(a) * d * 0.85;
        const L = rr(12, 22), rot = rng() * TAU;
        g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = leafColor([115, 40, 22]);
        g.beginPath(); g.ellipse(L / 2, 0, L / 2, L / 4.5, 0, 0, TAU); g.fill(); g.restore();
      }
      g.restore();
    }
    // ---- hanging vine
    {
      const [x0, y0, x1, y1] = REG.vine, cx = (x0 + x1) / 2;
      g.strokeStyle = '#3f4a22'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, y0); g.lineTo(cx, y1); g.stroke();
      for (let y = y0 + 10; y < y1 - 6; y += rr(10, 20)) {
        const sgn = rng() < 0.5 ? -1 : 1;
        g.fillStyle = leafColor([95, 40, 22]);
        g.beginPath(); g.ellipse(cx + sgn * 12, y + 4, 12, 5, sgn * 0.6, 0, TAU); g.fill();
      }
    }
    // ---- dead palm frond (brown, ragged)
    {
      const [x0, y0, x1, y1] = REG.dead, cx = (x0 + x1) / 2;
      for (let i = 0; i < 40; i++) {
        const t = i / 40, y = y1 - 10 - t * (y1 - y0 - 20), L = 100 * Math.sin(Math.PI * (0.1 + 0.9 * t));
        for (const sgn of [-1, 1]) { g.strokeStyle = `hsl(${rr(25, 38)}, ${rr(25, 40)}%, ${rr(18, 28)}%)`; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + sgn * L, y + rr(10, 40)); g.stroke(); }
      }
    }
    // ---- solid stem colour
    { const [x0, y0, x1, y1] = REG.stem; g.fillStyle = '#4b5a2a'; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
  });
}

// ============================================================ geometry builders
// Geometry assembled from quads: every vertex gets position, normal, uv and aFlex (how far wind bends it).
class GeoBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.f = []; this.i = []; }
  vert(x, y, z, nx, ny, nz, u, v, f) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v); this.f.push(f); return this.p.length / 3 - 1; }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aFlex', new THREE.Float32BufferAttribute(this.f, 1));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}
// An arching leaf strip from `origin`, heading `yaw`, starting at `pitch` and drooping. Normals lean up so leaves glow softly.
function addStrip(gb, reg, origin, yaw, pitch, droop, length, width, segs, flex0, flex1, fold = 0.18, widthProfile = null) {
  const uvr = regUV(reg);
  const dx = Math.sin(yaw), dz = Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
  let x = origin.x, y = origin.y, z = origin.z;
  const rows = [];
  for (let k = 0; k <= segs; k++) {
    const t = k / segs;
    const w = width * (widthProfile ? widthProfile(t) : Math.sin(Math.PI * (0.12 + 0.88 * t)) * 0.9 + 0.1 * (1 - t));
    const a = pitch - droop * Math.pow(t, 1.4);
    if (k > 0) { const st = length / segs; x += dx * Math.cos(a) * st; y += Math.sin(a) * st; z += dz * Math.cos(a) * st; }
    const ny = 0.75, f = lerp(flex0, flex1, t), v = lerp(uvr.v0, uvr.v1, t);
    const L = gb.vert(x - sx * w / 2, y - fold * w, z - sz * w / 2, -sx * 0.3, ny, -sz * 0.3, uvr.u0, v, f);
    const C = gb.vert(x, y, z, 0, 1, 0, (uvr.u0 + uvr.u1) / 2, v, f);
    const R = gb.vert(x + sx * w / 2, y - fold * w, z + sz * w / 2, sx * 0.3, ny, sz * 0.3, uvr.u1, v, f);
    rows.push([L, C, R]);
  }
  for (let k = 0; k < segs; k++) { const a = rows[k], b = rows[k + 1]; gb.quad(a[0], a[1], b[1], b[0]); gb.quad(a[1], a[2], b[2], b[1]); }
}
function addCard(gb, reg, cx, cy, cz, size, yaw, pitch, nrm, flex) {
  const uvr = regUV(reg);
  const ux = Math.cos(yaw), uz = -Math.sin(yaw);
  const vx = Math.sin(yaw) * Math.sin(pitch), vy = Math.cos(pitch), vz = Math.cos(yaw) * Math.sin(pitch);
  const h = size / 2;
  const c = [[-1, -1, uvr.u0, uvr.v0], [1, -1, uvr.u1, uvr.v0], [1, 1, uvr.u1, uvr.v1], [-1, 1, uvr.u0, uvr.v1]].map(([a, b, u, v]) =>
    gb.vert(cx + (ux * a + vx * b) * h, cy + vy * b * h, cz + (uz * a + vz * b) * h, nrm[0], nrm[1], nrm[2], u, v, flex));
  gb.quad(c[0], c[1], c[2], c[3]);
}
function addTube(gb, pts, radii, sides, reg, flexFn, vScale = 1) {
  const uvr = regUV(reg);
  const rows = [];
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k], q = pts[Math.min(k + 1, pts.length - 1)], o = pts[Math.max(k - 1, 0)];
    const t = new THREE.Vector3(q.x - o.x, q.y - o.y, q.z - o.z).normalize();
    const a = Math.abs(t.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const n1 = new THREE.Vector3().crossVectors(t, a).normalize(), n2 = new THREE.Vector3().crossVectors(t, n1).normalize();
    const row = [];
    for (let s = 0; s <= sides; s++) {
      const ang = (s / sides) * TAU, cx = Math.cos(ang), sy = Math.sin(ang);
      const nx = n1.x * cx + n2.x * sy, ny = n1.y * cx + n2.y * sy, nz = n1.z * cx + n2.z * sy;
      row.push(gb.vert(p.x + nx * radii[k], p.y + ny * radii[k], p.z + nz * radii[k], nx, ny, nz, lerp(uvr.u0, uvr.u1, s / sides), reg === REG.stem ? (uvr.v0 + uvr.v1) / 2 : (p.y * vScale), flexFn(p, k)));
    }
    rows.push(row);
  }
  for (let k = 0; k < rows.length - 1; k++) for (let s = 0; s < sides; s++) gb.quad(rows[k][s], rows[k + 1][s], rows[k + 1][s + 1], rows[k][s + 1]);
}

// ---- species
function makePalm(seed) {
  const r = mulberry32(seed), R = (a, b) => a + (b - a) * r();
  const Ht = R(7.5, 11.5), lean = R(0.6, 2.2);
  const trunk = new GeoBuilder(), crown = new GeoBuilder();
  const pts = [], radii = [];
  for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push({ x: lean * t * t, y: t * Ht, z: 0 }); radii.push(lerp(0.27, 0.15, t) + 0.12 * Math.pow(1 - t, 6)); }
  addTube(trunk, pts, radii, 8, REG.palm, (p) => 0.5 * Math.pow(p.y / Ht, 2), 1.4);
  const top = { x: lean, y: Ht, z: 0 };
  const n = 12;
  for (let i = 0; i < n; i++) {
    const yaw = (i / n) * TAU + R(-0.2, 0.2);
    const pitch = R(-0.15, 0.6), L = R(3.4, 4.8);
    addStrip(crown, REG.palm, { x: top.x, y: top.y + R(-0.1, 0.15), z: top.z }, yaw, pitch, R(1.1, 1.9), L, R(1.35, 1.7), 8, 0.5, 1.0, 0.2);
  }
  for (let i = 0; i < 3; i++) addStrip(crown, REG.dead, { x: top.x, y: top.y - 0.3, z: top.z }, R(0, TAU), -1.0, 0.4, R(2.2, 3), 1.0, 4, 0.5, 0.7, 0.1);
  for (let i = 0; i < 5; i++) { const a = R(0, TAU); addCard(crown, REG.stem, top.x + Math.cos(a) * 0.32, top.y - 0.35, top.z + Math.sin(a) * 0.32, 0.32, a, 0.3, [0, 1, 0], 0.5); }
  return { trunk: trunk.build(), crown: crown.build(), height: Ht, top };
}
function makeJungleTree(seed) {
  const r = mulberry32(seed), R = (a, b) => a + (b - a) * r();
  const Ht = R(11, 17);
  const trunk = new GeoBuilder(), crown = new GeoBuilder();
  const bend = R(-1, 1);
  const tp = [], tr = [];
  for (let k = 0; k <= 8; k++) { const t = k / 8; tp.push({ x: bend * t * t, y: t * Ht * 0.78, z: 0 }); tr.push(lerp(0.55, 0.28, t) + 0.35 * Math.pow(1 - t, 8)); }
  addTube(trunk, tp, tr, 9, REG.stem, (p) => 0.12 * (p.y / Ht), 0.5);
  // buttress roots
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + R(-0.3, 0.3), L = R(1.2, 2.2);
    addTube(trunk, [{ x: Math.cos(a) * 0.2, y: 1.6, z: Math.sin(a) * 0.2 }, { x: Math.cos(a) * L * 0.6, y: 0.5, z: Math.sin(a) * L * 0.6 }, { x: Math.cos(a) * L, y: -0.2, z: Math.sin(a) * L }], [0.22, 0.16, 0.06], 5, REG.stem, () => 0, 0.5);
  }
  const top = tp[tp.length - 1];
  const clumps = [];
  const nb = 4 + Math.floor(R(0, 2));
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * TAU + R(-0.4, 0.4), out = R(2.2, 4.2), up = R(1.5, 4.2);
    const end = { x: top.x + Math.cos(a) * out, y: top.y + up, z: Math.sin(a) * out };
    addTube(trunk, [{ x: top.x * 0.8, y: top.y - 1.5, z: 0 }, { x: (top.x + end.x) / 2, y: (top.y + end.y) / 2 + 0.3, z: end.z / 2 }, end], [0.22, 0.14, 0.08], 5, REG.stem, (p) => 0.15 + 0.15 * ((p.y - top.y) / 4), 0.5);
    clumps.push({ ...end, r: R(2.6, 3.6) });
  }
  clumps.push({ x: top.x, y: top.y + R(4, 5.5), z: 0, r: R(3, 3.8) });
  for (const c of clumps) {
    const cards = 15;
    for (let j = 0; j < cards; j++) {
      const u = r() * 2 - 1, phi = r() * TAU, s = Math.sqrt(1 - u * u);
      const dir = [s * Math.cos(phi), Math.abs(u) * 0.75 + 0.1, s * Math.sin(phi)];
      const d = Math.sqrt(r()) * c.r * 0.75;
      const px = c.x + dir[0] * d, py = c.y + dir[1] * d * 0.6, pz = c.z + dir[2] * d;
      const nl = Math.hypot(dir[0], dir[1] + 0.6, dir[2]);
      addCard(crown, REG.canopy, px, py, pz, R(2.6, 3.6), R(0, TAU), R(-1.2, 1.2), [dir[0] / nl, (dir[1] + 0.6) / nl, dir[2] / nl], 0.35);
    }
    // vines hanging from the clump
    if (r() < 0.75) {
      const nv = 1 + Math.floor(r() * 3);
      for (let v = 0; v < nv; v++) {
        const a = r() * TAU, vx = c.x + Math.cos(a) * c.r * 0.5, vz = c.z + Math.sin(a) * c.r * 0.5, len = R(3, 8);
        addStrip(crown, REG.vine, { x: vx, y: c.y - 0.5, z: vz }, a, -Math.PI / 2 + 0.05, 0, len, 0.32, 5, 0.3, 0.9, 0, () => 1);
      }
    }
  }
  return { trunk: trunk.build(), crown: crown.build(), height: Ht + 5, clumps };
}
function makeFern(seed) {
  const r = mulberry32(seed), R = (a, b) => a + (b - a) * r();
  const gb = new GeoBuilder();
  const n = 7;
  for (let i = 0; i < n; i++) addStrip(gb, REG.fern, { x: 0, y: 0.05, z: 0 }, (i / n) * TAU + R(-0.3, 0.3), R(0.7, 1.1), R(1.3, 2.0), R(1.1, 1.7), R(0.45, 0.6), 4, 0, 1, 0.05);
  return gb.build();
}
function makeBanana(seed) {
  const r = mulberry32(seed), R = (a, b) => a + (b - a) * r();
  const gb = new GeoBuilder();
  const Ht = R(1.8, 2.8);
  addTube(gb, [{ x: 0, y: 0, z: 0 }, { x: 0.05, y: Ht * 0.5, z: 0 }, { x: 0.1, y: Ht, z: 0 }], [0.16, 0.13, 0.1], 6, REG.stem, (p) => 0.2 * p.y / Ht, 1);
  for (let i = 0; i < 6; i++) addStrip(gb, REG.banana, { x: 0.1, y: Ht, z: 0 }, (i / 6) * TAU + R(-0.3, 0.3), R(0.6, 1.2), R(1.2, 2.2), R(1.8, 2.6), R(0.6, 0.75), 6, 0.2, 1, 0.08, (t) => Math.sin(Math.PI * (0.05 + 0.95 * t)) * 0.95 + 0.05);
  return gb.build();
}
function makeHeart(seed) {
  const r = mulberry32(seed), R = (a, b) => a + (b - a) * r();
  const gb = new GeoBuilder();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + R(-0.4, 0.4), h = R(0.7, 1.3), out = R(0.3, 0.7);
    addTube(gb, [{ x: 0, y: 0, z: 0 }, { x: Math.cos(a) * out * 0.5, y: h * 0.6, z: Math.sin(a) * out * 0.5 }, { x: Math.cos(a) * out, y: h, z: Math.sin(a) * out }], [0.04, 0.03, 0.025], 4, REG.stem, (p) => p.y * 0.3, 1);
    addStrip(gb, REG.heart, { x: Math.cos(a) * out, y: h, z: Math.sin(a) * out }, Math.atan2(Math.cos(a), Math.sin(a)), R(0.2, 0.7), R(0.6, 1.1), R(0.9, 1.3), R(0.8, 1.1), 3, 0.4, 1, 0.12, (t) => 0.4 + 0.6 * Math.sin(Math.PI * (0.25 + 0.75 * t)));
  }
  return gb.build();
}
function makeCross(reg, size, height, cards = 3, flexTop = 1) {
  const gb = new GeoBuilder();
  const uvr = regUV(reg);
  for (let i = 0; i < cards; i++) {
    const a = (i / cards) * Math.PI, cx = Math.cos(a) * size / 2, cz = -Math.sin(a) * size / 2;
    const v = [gb.vert(-cx, 0, -cz, 0, 1, 0, uvr.u0, uvr.v0, 0), gb.vert(cx, 0, cz, 0, 1, 0, uvr.u1, uvr.v0, 0), gb.vert(cx, height, cz, 0, 1, 0, uvr.u1, uvr.v1, flexTop), gb.vert(-cx, height, -cz, 0, 1, 0, uvr.u0, uvr.v1, flexTop)];
    gb.quad(v[0], v[1], v[2], v[3]);
  }
  return gb.build();
}
function makeRock(seed, flat = 0.6) {
  const r = mulberry32(seed);
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    _v.fromBufferAttribute(p, i);
    const n = 1 + 0.28 * noise3(_v.x * 1.7 + seed, _v.y * 1.7, _v.z * 1.7) + 0.1 * noise3(_v.x * 4 + seed, _v.y * 4, _v.z * 4);
    _v.multiplyScalar(n); _v.y *= flat; if (_v.y < -0.2) _v.y = -0.2 - (_v.y + 0.2) * 0.2;
    p.setXYZ(i, _v.x * (1 + r() * 0.05), _v.y, _v.z);
  }
  g.computeVertexNormals();
  return g;
}

// ============================================================ materials with wind
function windPatch(mat, amp = 1) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aFlex;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ipos = vec3(0.0);
        #ifdef USE_INSTANCING
        ipos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #endif
        float ph = ipos.x * 0.21 + ipos.z * 0.17;
        float sway = sin(uTime * 0.85 + ph) * 0.6 + sin(uTime * 2.0 + ph * 1.7) * 0.25;
        transformed.x += (sway * 0.35 + sin(uTime * 5.0 + position.y * 2.0 + ph) * 0.05) * aFlex * ${amp.toFixed(2)};
        transformed.z += cos(uTime * 0.75 + ph * 1.3) * aFlex * 0.22 * ${amp.toFixed(2)};
        transformed.y += sin(uTime * 3.1 + position.x * 2.0 + ph) * aFlex * 0.05 * ${amp.toFixed(2)};`);
  };
  mat.customProgramCacheKey = () => 'wind' + amp;
  return mat;
}
let foliageMat, foliageDepth, barkMat, palmBarkMat, rockMat, deadMat;
function initFloraMaterials() {
  const atlas = drawAtlas();
  atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping;
  foliageMat = windPatch(new THREE.MeshLambertMaterial({ map: atlas, alphaTest: 0.42, side: THREE.DoubleSide }));
  foliageDepth = windPatch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas, alphaTest: 0.42 }));
  const barkTex = canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#5a4a3a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 12) { g.fillStyle = `rgba(30,22,15,${rr(0.4, 0.7)})`; g.fillRect(0, y, w, rr(2, 4)); g.fillStyle = `rgba(140,120,90,${rr(0.1, 0.25)})`; g.fillRect(0, y + 5, w, 2); }
  });
  palmBarkMat = windPatch(new THREE.MeshLambertMaterial({ map: barkTex, color: 0x9a8b78 }));
  barkMat = windPatch(new THREE.MeshLambertMaterial({ color: 0x4a4038 }), 0.4);
  deadMat = new THREE.MeshLambertMaterial({ color: 0x191512 });
  rockMat = new THREE.MeshStandardMaterial({ map: M.rock.map, color: 0x6e6763, roughness: 0.95 });
}

// ============================================================ placement
const EXCLUDE = [];          // {x, z, r}
const EXCLUDE_LINES = [];    // {pts, r}
const flora = { chunks: [] };
function excluded(x, z, pad = 0) {
  for (const e of EXCLUDE) if ((x - e.x) ** 2 + (z - e.z) ** 2 < (e.r + pad) ** 2) return true;
  for (const l of EXCLUDE_LINES) {
    if (x < l.x0 - l.r || x > l.x1 + l.r || z < l.z0 - l.r || z > l.z1 + l.r) continue;
    for (let i = 0; i < l.pts.length - 1; i += 1) {
      const a = l.pts[i], b = l.pts[i + 1], abx = b.x - a.x, abz = b.z - a.z;
      const t = clamp(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz), 0, 1);
      if (Math.hypot(x - a.x - abx * t, z - a.z - abz * t) < l.r + pad) return true;
    }
  }
  return false;
}
function excludeLine(pts, r) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  EXCLUDE_LINES.push({ pts, r, x0, x1, z0, z1 });
}
const CHUNK = 110;
function scatterInstances(name, parts, list, opts = {}) {
  // parts: [{geo, mat, depth, cast}] sharing transforms; list: [{x,y,z,ry,s,tilt,col}]
  const byChunk = new Map();
  for (const it of list) { const k = Math.floor(it.x / CHUNK) + ',' + Math.floor(it.z / CHUNK); if (!byChunk.has(k)) byChunk.set(k, []); byChunk.get(k).push(it); }
  const col = new THREE.Color();
  for (const [k, items] of byChunk) {
    const group = { name, meshes: [], cx: 0, cz: 0, far: opts.far || 0 };
    for (const it of items) { group.cx += it.x / items.length; group.cz += it.z / items.length; }
    for (const part of parts) {
      const im = new THREE.InstancedMesh(part.geo, part.mat, items.length);
      items.forEach((it, i) => {
        _e.set(it.tiltX || 0, it.ry || 0, it.tiltZ || 0);
        _q.setFromEuler(_e);
        _s.set(it.s, it.sy || it.s, it.s);
        _m4.compose(_v.set(it.x, it.y, it.z), _q, _s);
        im.setMatrixAt(i, _m4);
        col.setRGB(it.c[0], it.c[1], it.c[2]);
        im.setColorAt(i, col);
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = !!part.cast; im.receiveShadow = true;
      if (part.depth) im.customDepthMaterial = part.depth;
      scene.add(im);
      group.meshes.push(im);
    }
    flora.chunks.push(group);
  }
}
function updateFloraLOD(cam) {
  for (const g of flora.chunks) {
    if (!g.far) continue;
    const vis = Math.hypot(g.cx - cam.x, g.cz - cam.z) < g.far;
    for (const m of g.meshes) m.visible = vis;
  }
}
function placeFlora(progress) {
  const palms = [0, 1, 2, 3].map((i) => makePalm(101 + i * 17));
  const trees = [0, 1, 2].map((i) => makeJungleTree(501 + i * 31));
  const ferns = [makeFern(7), makeFern(8)];
  const banana = makeBanana(3), heart = makeHeart(4);
  const grass = makeCross(REG.grass, 1.1, 0.95, 3, 0.8), shrub = makeCross(REG.shrub, 1.6, 1.4, 4, 0.5);
  const rocks = [makeRock(1, 0.6), makeRock(2, 0.75), makeRock(3, 0.45)];
  const L = { palm: palms.map(() => []), tree: trees.map(() => []), dead: [], fern: ferns.map(() => []), banana: [], heart: [], grass: [], shrub: [], rock: rocks.map(() => []) };
  const tint = (vis, base, v = 0.15) => {
    const k = lerp(0.5, 1, vis);
    return [base[0] * k * (1 + rr(-v, v)), base[1] * k * (1 + rr(-v, v)), base[2] * k * (1 + rr(-v, v))];
  };
  const visAt = (x, z) => {
    const ix = clamp(Math.round((x + HALF) / STEP), 0, SEG), iz = clamp(Math.round((z + HALF) / STEP), 0, SEG);
    return bakeAttr.array[(iz * GN + ix) * 3];
  };
  const pathy = (x, z) => Math.max(maskAt(x, z, 0) * 1.4, maskAt(x, z, 1) * 2, maskAt(x, z, 3) * 1.5);
  // coarse pass: trees, palms, big plants
  for (let gz = -340; gz < 340; gz += 4) for (let gx = -340; gx < 340; gx += 4) {
    const x = gx + rr(-1.8, 1.8), z = gz + rr(-1.8, 1.8);
    const h = terrainHeight(x, z);
    if (h < 0.4 || inTerrainHole(x, z)) continue;
    const ny = terrainNormalY(x, z), vr = Math.hypot(x - VX, z - VZ);
    const lavaM = maskAt(x, z, 2);
    if (lavaM > 0.05) { if (lavaM < 0.5 && rng() < 0.03 && ny > 0.8) L.dead.push({ x, y: h - 0.3, z, ry: rr(0, TAU), s: rr(0.7, 1.1), c: [1, 1, 1], tiltX: rr(-0.15, 0.15), tiltZ: rr(-0.15, 0.15) }); continue; }
    const pm = pathy(x, z);
    const dens = 0.35 + 0.65 * (0.5 + 0.5 * noise2(x * 0.011 + 40, z * 0.011));
    const vis = visAt(x, z);
    const beachy = h < 3.6;
    const alt = smoothstep(95, 55, h) * smoothstep(165, 215, vr);   // vegetation fades up the volcano
    if (beachy) {
      if (pm < 0.15 && !excluded(x, z, 3) && rng() < 0.05) {
        const out = Math.atan2(x, z);
        const i = Math.floor(rng() * palms.length);
        L.palm[i].push({ x, y: h - 0.2, z, ry: out - Math.PI / 2 + rr(-0.6, 0.6), s: rr(0.85, 1.15), c: tint(vis, [1, 1, 1]) });
        addCircleObs(x, z, 0.35, h, h + 8);
      }
      if (pm < 0.3 && rng() < 0.05 && !excluded(x, z)) L.grass.push({ x, y: h, z, ry: rr(0, TAU), s: rr(0.7, 1.1), c: tint(vis, [0.8, 0.85, 0.6]) });
      continue;
    }
    if (ny < 0.7 || alt <= 0.02) {
      if (ny < 0.75 && rng() < 0.03 && vr < 290) { const i = Math.floor(rng() * rocks.length); L.rock[i].push({ x, y: h - 0.4, z, ry: rr(0, TAU), s: rr(0.8, 2.6), c: tint(vis, [1, 1, 1], 0.1) }); }
      if (alt <= 0.02 && rng() < 0.012 && ny > 0.75) L.grass.push({ x, y: h, z, ry: rr(0, TAU), s: rr(0.5, 0.8), c: tint(vis, [0.7, 0.62, 0.4]) });
      continue;
    }
    if (pm > 0.08) continue;
    const ex = excluded(x, z, 2);
    if (ex) continue;
    const roll = rng();
    if (roll < 0.075 * dens * alt) {
      const i = Math.floor(rng() * trees.length);
      L.tree[i].push({ x, y: h - 0.2, z, ry: rr(0, TAU), s: rr(0.8, 1.15), c: tint(vis, [1, 1, 1]) });
      addCircleObs(x, z, 0.6, h, h + 12);
      darkenUnder(x, z, 7, 0.5);
    } else if (roll < 0.075 * dens * alt + 0.034 * alt) {
      const i = Math.floor(rng() * palms.length);
      L.palm[i].push({ x, y: h - 0.2, z, ry: rr(0, TAU), s: rr(0.8, 1.1), c: tint(vis, [1, 1, 1]) });
      addCircleObs(x, z, 0.35, h, h + 8);
      darkenUnder(x, z, 4, 0.25);
    } else if (rng() < 0.065 * alt) {
      L.banana.push({ x, y: h, z, ry: rr(0, TAU), s: rr(0.8, 1.2), c: tint(vis, [0.95, 1, 0.9]) });
    } else if (rng() < 0.1 * alt) {
      L.heart.push({ x, y: h, z, ry: rr(0, TAU), s: rr(0.8, 1.4), c: tint(vis, [0.9, 1, 0.9]) });
    } else if (rng() < 0.22 * alt) {
      L.shrub.push({ x, y: h - 0.1, z, ry: rr(0, TAU), s: rr(0.8, 1.5), c: tint(vis, [0.85, 0.95, 0.75]) });
    }
    if (rng() < 0.02) { const i = Math.floor(rng() * rocks.length); L.rock[i].push({ x: x + 1, y: h - 0.3, z: z + 1, ry: rr(0, TAU), s: rr(0.4, 1.2), c: tint(vis, [0.8, 0.85, 0.75], 0.1) }); }
  }
  progress && progress(0.5);
  // fine pass: ferns and grass
  for (let gz = -330; gz < 330; gz += 2.6) for (let gx = -330; gx < 330; gx += 2.6) {
    const x = gx + rr(-1.2, 1.2), z = gz + rr(-1.2, 1.2);
    const h = terrainHeight(x, z);
    if (h < 3.4) continue;
    const vr = Math.hypot(x - VX, z - VZ);
    const alt = smoothstep(90, 50, h) * smoothstep(170, 220, vr);
    if (alt < 0.05) continue;
    if (maskAt(x, z, 2) > 0.02) continue;
    const pm = pathy(x, z);
    if (pm > 0.25) continue;
    if (terrainNormalY(x, z) < 0.72) continue;
    const dens = 0.4 + 0.6 * (0.5 + 0.5 * noise2(x * 0.02 - 13, z * 0.02 + 5));
    const vis = visAt(x, z);
    const r = rng();
    if (r < 0.28 * dens * alt) { if (!excluded(x, z)) { const i = Math.floor(rng() * ferns.length); L.fern[i].push({ x, y: h - 0.05, z, ry: rr(0, TAU), s: rr(0.75, 1.3), c: tint(vis, [0.9, 1, 0.85]) }); } }
    else if (r < 0.28 * dens * alt + 0.13 * alt) { if (!excluded(x, z)) L.grass.push({ x, y: h - 0.05, z, ry: rr(0, TAU), s: rr(0.7, 1.2), c: tint(vis, [0.85, 0.95, 0.7]) }); }
  }
  bakeAttr.needsUpdate = true;
  progress && progress(0.8);
  const F = (geo, cast = true) => ({ geo, mat: foliageMat, depth: foliageDepth, cast });
  palms.forEach((p, i) => scatterInstances('palm', [{ geo: p.trunk, mat: palmBarkMat, cast: true }, F(p.crown)], L.palm[i]));
  trees.forEach((t, i) => scatterInstances('tree', [{ geo: t.trunk, mat: barkMat, cast: true }, F(t.crown)], L.tree[i]));
  scatterInstances('dead', [{ geo: trees[0].trunk, mat: deadMat, cast: true }], L.dead);
  ferns.forEach((f, i) => scatterInstances('fern', [F(f, false)], L.fern[i], { far: 170 }));
  scatterInstances('banana', [F(banana)], L.banana, { far: 260 });
  scatterInstances('heart', [F(heart)], L.heart, { far: 200 });
  scatterInstances('grass', [F(grass, false)], L.grass, { far: 120 });
  scatterInstances('shrub', [F(shrub, false)], L.shrub, { far: 220 });
  rocks.forEach((g, i) => scatterInstances('rock', [{ geo: g, mat: rockMat, cast: true }], L.rock[i]));
  flora.counts = Object.fromEntries(Object.entries(L).map(([k, v]) => [k, Array.isArray(v[0]) ? v.reduce((a, b) => a + b.length, 0) : v.length]));
}
