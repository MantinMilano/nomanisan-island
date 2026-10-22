// ============================================================ effects: smoke, steam, embers, fireflies, mist, bats, lightning
const FX_POINTS = { torches: [], sparks: [], smoke: [], steam: [], embers: [], glow: [], heat: [] };
const FX = { smoke: null, embers: null, flies: null, glow: null, sparks: null, ash: null, bats: [], flashT: 0, nextFlash: 25, nextTremor: 70, shake: 0, eruption: 0 };

function smokeTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) {
      const a = rng() * TAU, d = Math.pow(rng(), 0.7) * 55, r = rr(18, Math.min(60, 120 - d)), x = w / 2 + Math.cos(a) * d, y = h / 2 + Math.sin(a) * d;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const l = Math.round(rr(170, 255));
      gr.addColorStop(0, `rgba(${l},${l},${l},${rr(0.08, 0.16)})`); gr.addColorStop(1, `rgba(${l},${l},${l},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  }, { clamp: true });
}

// ---- billboard smoke system (one draw call, sorted back to front)
class SmokeSystem {
  constructor(max) {
    this.max = max; this.p = [];
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aMisc = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);   // size, rot, alpha
    this.aTop = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aBot = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    for (const a of [this.aPos, this.aMisc, this.aTop, this.aBot]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iMisc', this.aMisc); g.setAttribute('iTop', this.aTop); g.setAttribute('iBot', this.aBot);
    g.instanceCount = 0;
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTex: { value: smokeTexture() }, uFlash: { value: 0 }, uDay: { value: 0 } }]),
      vertexShader: /* glsl */ `
        attribute vec3 iPos; attribute vec3 iMisc; attribute vec3 iTop; attribute vec3 iBot;
        varying vec2 vUv; varying float vGrad; varying float vA; varying vec3 vTop; varying vec3 vBot; varying vec3 vW;
        void main(){
          vUv = uv;
          vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 Up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          float c = cos(iMisc.y), s = sin(iMisc.y);
          vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iMisc.x;
          vGrad = clamp(0.5 + (position.x * s + position.y * c), 0.0, 1.0);
          vec3 wp = iPos + R * p.x + Up * p.y;
          vA = iMisc.z; vTop = iTop; vBot = iBot; vW = iPos;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex; uniform float uFlash, uDay;
        varying vec2 vUv; varying float vGrad; varying float vA; varying vec3 vTop; varying vec3 vBot; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){
          vec4 t = texture2D(uTex, vUv);
          vec3 col = mix(vBot, vTop, smoothstep(0.0, 1.0, vGrad)) * (0.55 + 0.6 * t.r);
          vec3 dayCol = mix(vec3(0.3, 0.29, 0.28), vec3(0.78, 0.77, 0.75), smoothstep(0.0, 1.0, vGrad)) * (0.6 + 0.5 * t.r) + vBot * 0.25;
          col = mix(col, dayCol, uDay * 0.85);
          col += vec3(0.5, 0.5, 0.65) * uFlash * step(80.0, vW.y);
          float a = t.a * vA * 2.4 * smoothstep(0.5, 0.3, length(vUv - 0.5));
          gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
          #ifdef USE_FOG
          gl_FragColor.rgb = applyFog(gl_FragColor.rgb, vW);
          #endif
        }`,
    });
    mat.uniforms.uDay = U.day;
    this.mat = mat;
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }
  spawn(o) { if (this.p.length >= this.max) return; this.p.push(Object.assign({ age: 0, rot: rr(0, TAU), rv: rr(-0.1, 0.1) }, o)); }
  update(dt, cam) {
    const P = this.p;
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i];
      q.age += dt;
      if (q.age > q.life) { P[i] = P[P.length - 1]; P.pop(); continue; }
      const drag = Math.exp(-(q.drag || 0) * dt);
      q.vx *= drag; q.vy *= drag; q.vz *= drag;
      q.x += (q.vx + (q.wind || 0)) * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      q.rot += q.rv * dt;
      if (q.update) q.update(q, dt, cam);
    }
    for (const q of P) q.d = (q.x - cam.x) ** 2 + (q.y - cam.y) ** 2 + (q.z - cam.z) ** 2;
    P.sort((a, b) => b.d - a.d);
    const pos = this.aPos.array, misc = this.aMisc.array, top = this.aTop.array, bot = this.aBot.array;
    for (let i = 0; i < P.length; i++) {
      const q = P[i], f = q.age / q.life;
      const size = lerp(q.s0, q.s1, Math.sqrt(f));
      const alpha = q.a * smoothstep(0, q.fadeIn || 0.08, f) * (1 - smoothstep(0.55, 1, f));
      pos[i * 3] = q.x; pos[i * 3 + 1] = q.y; pos[i * 3 + 2] = q.z;
      misc[i * 3] = size; misc[i * 3 + 1] = q.rot; misc[i * 3 + 2] = alpha;
      const lt = q.light ? q.light(q, f) : null;
      const T = lt ? lt[0] : q.top, B = lt ? lt[1] : q.bot;
      top[i * 3] = T[0]; top[i * 3 + 1] = T[1]; top[i * 3 + 2] = T[2];
      bot[i * 3] = B[0]; bot[i * 3 + 1] = B[1]; bot[i * 3 + 2] = B[2];
    }
    this.geo.instanceCount = P.length;
    for (const a of [this.aPos, this.aMisc, this.aTop, this.aBot]) a.needsUpdate = true;
  }
}

// ---- additive points (embers, fireflies, glow worms, sparks, ash)
class PointSystem {
  constructor(max, opts = {}) {
    this.max = max; this.n = 0; this.opts = opts;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.phase = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.age = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aPhase = new THREE.BufferAttribute(this.phase, 1);
    g.setAttribute('position', this.aPos); g.setAttribute('aCol', this.aCol); g.setAttribute('aSize', this.aSize); g.setAttribute('aPhase', this.aPhase);
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: U.time, uBlink: { value: opts.blink || 0 }, uScale: { value: window.innerHeight / 2 } },
      vertexShader: /* glsl */ `
        attribute vec3 aCol; attribute float aSize; attribute float aPhase; uniform float uTime, uBlink, uScale;
        varying vec3 vCol; varying float vA;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.1), 1.0, 64.0);
          float blink = uBlink > 0.5 ? pow(max(sin(uTime * (1.3 + fract(aPhase * 7.1)) + aPhase * 6.28), 0.0), 5.0) : 1.0;
          vA = blink * smoothstep(400.0, 120.0, -mv.z);
          vCol = aCol;
        }`,
      fragmentShader: /* glsl */ `varying vec3 vCol; varying float vA;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d); a *= a;
          gl_FragColor = vec4(vCol * a * vA, 1.0); }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  add(x, y, z, r, g, b, size, life = 1e9, vx = 0, vy = 0, vz = 0) {
    let i = this.n;
    if (i >= this.max) { i = Math.floor(rng() * this.max); } else this.n++;
    this.pos.set([x, y, z], i * 3); this.col.set([r, g, b], i * 3); this.size[i] = size; this.phase[i] = rng();
    this.vel.set([vx, vy, vz], i * 3); this.life[i] = life; this.age[i] = 0;
    return i;
  }
  commit() { this.geo.setDrawRange(0, this.n); this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true; this.aPhase.needsUpdate = true; }
}

function initFX() {
  FX.smoke = new SmokeSystem(520);
  // embers: rise from lava, cool, respawn
  FX.embers = new PointSystem(900);
  FX.emberSources = [{ x: VENT.x, y: LAVA_LAKE_Y + 0.5, z: VENT.z, r: 9, w: 5 }, { x: VX, y: CRATER_Y + 0.5, z: VZ, r: 26, w: 2.5 }];
  for (let i = 0; i < LAVA.length; i += 12) FX.emberSources.push({ x: LAVA[i].x, y: LAVA[i].y + 0.3, z: LAVA[i].z, r: 3, w: 1 });
  for (const e of FX_POINTS.embers) FX.emberSources.push({ x: e.x, y: e.y, z: e.z, r: 2, w: 1.5 });
  FX.emberSources.push({ x: 58, y: BASE_Y - 5.5, z: -50, r: 12, w: 2 });
  for (const t of FX_POINTS.torches) FX.emberSources.push({ x: t.x, y: t.y + 0.2, z: t.z, r: 0.1, w: 0.3, small: true });
  FX.emberW = FX.emberSources.reduce((a, s) => a + s.w, 0);
  for (let i = 0; i < 900; i++) spawnEmber(true);
  FX.embers.commit();
  // fireflies along the jungle trails
  FX.flies = new PointSystem(380, { blink: 1 });
  let n = 0;
  for (const tr of TRAILS) for (let i = 0; i < tr.pts.length && n < 380; i += 2) {
    if (rng() > 0.55) continue;
    const p = tr.pts[i], x = p.x + rr(-9, 9), z = p.z + rr(-9, 9), h = terrainHeight(x, z);
    if (h < 3 || h > 60) continue;
    FX.flies.add(x, h + rr(0.4, 2.8), z, 1.4, 2.4, 0.45, rr(0.1, 0.16)); n++;
  }
  FX.flyHome = FX.flies.pos.slice();
  FX.flies.commit();
  // glow worms in Gazerbeam's cave
  FX.glow = new PointSystem(60, { blink: 1 });
  for (const p of FX_POINTS.glow) FX.glow.add(p.x, p.y, p.z, 0.3, 1.6, 1.4, 0.05);
  FX.glow.commit();
  FX.sparks = new PointSystem(160);
  FX.ash = new PointSystem(500);
  for (let i = 0; i < 500; i++) FX.ash.add(0, -999, 0, 0.18, 0.16, 0.15, 0.05, 1e9);
  FX.ash.mat.blending = THREE.NormalBlending;
  FX.ash.commit();
  // mist sheets that follow the camera around the lowlands
  FX.mist = [];
  for (let i = 0; i < 46; i++) FX.mist.push({ x: 0, y: -999, z: 0, s: rr(18, 34), a: rr(0.06, 0.11), age: rr(0, 40), life: rr(30, 60) });
  // bats circling the moonlit side of the volcano
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const wingG = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.55, 0.05, -0.12, 0.18, 0, 0.18], 3));
    wingG.computeVertexNormals();
    const wm = new THREE.MeshBasicMaterial({ color: 0x050506, side: THREE.DoubleSide });
    const L = new THREE.Mesh(wingG, wm), R = new THREE.Mesh(wingG, wm); R.scale.x = -1;
    g.add(L, R); g.scale.setScalar(rr(0.9, 1.4)); scene.add(g);
    FX.bats.push({ g, L, R, cx: rr(-60, 60), cz: rr(60, 200), r: rr(15, 40), h: rr(25, 55), sp: rr(0.25, 0.5) * (rng() < 0.5 ? -1 : 1), ph: rr(0, TAU) });
  }
  // let the plumes form before the first frame
  const warmCam = new THREE.Vector3(0, 60, 300);
  for (let i = 0; i < 170; i++) { emitSmoke(0.5, i * 0.5); FX.smoke.update(0.5, warmCam); }
  FX.lightning = new THREE.PointLight(0xc8d4ff, 0, 600, 1.4);
  FX.lightning.position.set(VX + 20, 330, VZ);
  scene.add(FX.lightning);
}
function spawnEmber(initial) {
  let r = rng() * FX.emberW, s = FX.emberSources[0];
  for (const src of FX.emberSources) { r -= src.w; if (r <= 0) { s = src; break; } }
  const a = rng() * TAU, d = Math.sqrt(rng()) * s.r;
  const life = s.small ? rr(0.6, 1.4) : rr(3, 9);
  const i = FX.embers.add(s.x + Math.cos(a) * d, s.y, s.z + Math.sin(a) * d, rr(2.5, 4.5), rr(0.6, 1.1), rr(0.06, 0.15), s.small ? 0.05 : rr(0.07, 0.16), life, rr(-0.4, 0.4), s.small ? rr(0.8, 1.6) : rr(1.5, 4.5), rr(-0.4, 0.4));
  if (initial) FX.embers.age[i] = rng() * life;
}

function emitSmoke(dt, t) {
  const S = FX.smoke;
  const er = FX.eruption;
  // main crater plume, lit from below by the glowing crater
  FX.acc1 = (FX.acc1 || 0) + dt * (1.7 + er * 4);
  while (FX.acc1 > 1) {
    FX.acc1--;
    const a = rr(0, TAU), d = rr(0, 14) * (er > 0.2 ? 0.6 : 1);
    S.spawn({ x: VX + Math.cos(a) * d, y: CRATER_Y + rr(2, 10), z: VZ + Math.sin(a) * d, vx: rr(-0.4, 0.4), vy: rr(5, 7) + er * 8, vz: rr(-0.4, 0.4), wind: 1.2, drag: 0.008,
      s0: rr(12, 18), s1: rr(60, 100), a: rr(0.42, 0.55), life: rr(65, 85), fadeIn: 0.04,
      light: (q) => { const hgt = q.y - CRATER_Y; const k = Math.exp(-hgt / 60) * (1 + er); const m = 1 - Math.exp(-hgt / 120); return [[0.06 + 0.1 * m, 0.065 + 0.11 * m, 0.08 + 0.13 * m], [0.05 + 1.5 * k, 0.03 + 0.36 * k, 0.025 + 0.06 * k]]; } });
  }
  // fire up the launch tube once the iris is open
  if (er > 0.15) {
    FX.acc5 = (FX.acc5 || 0) + dt * 14 * er;
    while (FX.acc5 > 1) {
      FX.acc5--;
      const a = rr(0, TAU), d = rr(0, 6);
      S.spawn({ x: VX + Math.cos(a) * d, y: BASE_Y + rr(0, 6), z: VZ + Math.sin(a) * d, vx: rr(-1, 1), vy: rr(22, 34), vz: rr(-1, 1), drag: 0.02, s0: rr(5, 8), s1: rr(26, 40), a: 0.5, life: rr(4.5, 6.5), fadeIn: 0.02,
        light: (q, f) => { const k = 1 - f; return [[0.4 + 2.2 * k, 0.12 + 0.6 * k, 0.04 + 0.1 * k], [0.8 + 3.5 * k, 0.25 + 1.0 * k, 0.05 + 0.15 * k]]; } });
    }
  }
  // the active vent: darker ash, heavily lit
  FX.acc2 = (FX.acc2 || 0) + dt * 0.9;
  while (FX.acc2 > 1) {
    FX.acc2--;
    S.spawn({ x: VENT.x + rr(-5, 5), y: LAVA_LAKE_Y + rr(3, 8), z: VENT.z + rr(-5, 5), vx: rr(-0.5, 0.5), vy: rr(3, 5), vz: rr(-0.5, 0.5), wind: 2.0, drag: 0.012,
      s0: rr(10, 16), s1: rr(70, 110), a: rr(0.26, 0.36), life: rr(60, 85),
      light: (q) => { const hgt = q.y - LAVA_LAKE_Y; const k = Math.exp(-hgt / 40); return [[0.03, 0.03, 0.036], [0.04 + 1.8 * k, 0.025 + 0.42 * k, 0.02 + 0.07 * k]]; } });
  }
  // steam where the lava meets the sea
  FX.acc3 = (FX.acc3 || 0) + dt * 0.9;
  while (FX.acc3 > 1) {
    FX.acc3--;
    S.spawn({ x: POI.lavaSea.x + rr(-6, 6), y: rr(0.5, 2), z: POI.lavaSea.z + rr(-6, 6), vx: rr(-0.5, 0.5), vy: rr(2, 4), vz: rr(-0.5, 0.5), wind: 1.4, drag: 0.03,
      s0: rr(6, 10), s1: rr(40, 70), a: rr(0.2, 0.28), life: rr(30, 45),
      light: (q) => { const k = Math.exp(-q.y / 22); return [[0.09, 0.1, 0.12], [0.1 + 1.0 * k, 0.07 + 0.25 * k, 0.06 + 0.05 * k]]; } });
  }
  // small emitters: crater vents, turbines, wreck smoke, waterfall mist
  FX.acc4 = (FX.acc4 || 0) + dt;
  if (FX.acc4 > 0.5) {
    FX.acc4 = 0;
    for (const v of FX_POINTS.steam) if (rng() < 0.35 * v.k) S.spawn({ x: v.x + rr(-0.5, 0.5), y: v.y, z: v.z + rr(-0.5, 0.5), vx: 0, vy: rr(1.5, 3), vz: 0, wind: v.indoor ? 0 : 0.8, drag: 0.1, s0: 1.5, s1: rr(9, 15), a: 0.16, life: rr(8, 13), top: [0.1, 0.1, 0.11], bot: v.indoor ? [0.6, 0.2, 0.06] : [0.5, 0.16, 0.05] });
    for (const v of FX_POINTS.smoke) if (rng() < 0.5) S.spawn({ x: v.x, y: v.y, z: v.z, vx: 0, vy: rr(0.8, 1.4), vz: 0, wind: 0.3, drag: 0.05, s0: 0.8, s1: 6, a: 0.2, life: 10, top: [0.03, 0.03, 0.035], bot: [0.03, 0.03, 0.03] });
    for (let k = 0; k < 2; k++) S.spawn({ x: POI.pool.x + rr(-4, 4) - POI.dirS.x * 2, y: POI.poolY + rr(0, 1.5), z: POI.pool.z + rr(-4, 4) - POI.dirS.z * 2, vx: POI.dirS.x * 0.6, vy: rr(0.3, 0.8), vz: POI.dirS.z * 0.6, drag: 0.2, s0: 2, s1: rr(7, 11), a: 0.12, life: rr(5, 8), top: [0.11, 0.13, 0.16], bot: [0.06, 0.07, 0.09] });
  }
}
function updateFX(dt, t, cam, indoor) {
  emitSmoke(dt, t);
  // mist
  const S = FX.smoke;
  for (const m of FX.mist) {
    m.age += dt;
    const far = (m.x - cam.x) ** 2 + (m.z - cam.z) ** 2 > 95 * 95;
    if (m.age > m.life || far || m.y < -100) {
      const a = rr(0, TAU), d = rr(15, 90), x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
      const h = terrainHeight(x, z);
      m.x = x; m.z = z; m.y = Math.max(h, 0) + rr(1.2, 4); m.age = 0; m.life = rr(30, 60); m.ok = h < 46 && !inTerrainHole(x, z);
    }
  }
  const cw = 0.4 * Math.sin(t * 0.05);
  for (const m of FX.mist) {
    if (!m.ok || indoor || S.p.length >= S.max) continue;
    m.x += (0.4 + cw) * dt;
    const f = m.age / m.life;
    S.p.push({ x: m.x, y: m.y, z: m.z, age: f * 10, life: 10, s0: m.s, s1: m.s, a: m.a, rot: m.x * 0.1, rv: 0, vx: 0, vy: 0, vz: 0, mist: true, top: [0.07, 0.09, 0.12], bot: [0.045, 0.06, 0.08], fadeIn: 0.25 });
  }
  S.update(dt, cam);
  for (let i = S.p.length - 1; i >= 0; i--) if (S.p[i].mist) { S.p[i] = S.p[S.p.length - 1]; S.p.pop(); }
  S.mat.uniforms.uFlash.value = U.flash.value;

  // embers
  const E = FX.embers;
  for (let i = 0; i < E.n; i++) {
    E.age[i] += dt;
    if (E.age[i] > E.life[i]) { E.n--; copyPoint(E, E.n, i); i--; continue; }
    const j = i * 3;
    E.vel[j] += (Math.sin(t * 1.3 + i) * 0.5 - E.vel[j] * 0.2) * dt;
    E.vel[j + 2] += (Math.cos(t * 1.1 + i * 1.7) * 0.5 - E.vel[j + 2] * 0.2) * dt;
    E.pos[j] += (E.vel[j] + 1.2) * dt; E.pos[j + 1] += E.vel[j + 1] * dt; E.pos[j + 2] += E.vel[j + 2] * dt;
    const f = E.age[i] / E.life[i];
    const k = 1 - f;
    E.col[j] = 3.6 * k + 0.1; E.col[j + 1] = 0.9 * k * k; E.col[j + 2] = 0.12 * k * k * k;
  }
  const want = FX.eruption > 0.1 ? 900 : 760;
  for (let k = 0; k < 40 && E.n < want; k++) spawnEmber(false);
  if (FX.eruption > 0.1) for (let k = 0; k < Math.round(24 * FX.eruption); k++) {
    const a = rr(0, TAU), d = rr(0, SILO_R * 0.7);
    E.add(VX + Math.cos(a) * d, BASE_Y + rr(0, 90), VZ + Math.sin(a) * d, 4, 1.2, 0.15, rr(0.1, 0.25), rr(3, 7), rr(-2, 2), rr(18, 40) * FX.eruption, rr(-2, 2));
  }
  if (FX.eruptionDecay) FX.eruption = Math.max(0.12, FX.eruption - dt * 0.025);
  E.commit();
  // fireflies drift around their homes
  const F = FX.flies;
  for (let i = 0; i < F.n; i++) {
    const j = i * 3;
    F.pos[j] = FX.flyHome[j] + Math.sin(t * 0.3 + i) * 1.5; F.pos[j + 1] = FX.flyHome[j + 1] + Math.sin(t * 0.5 + i * 2.1) * 0.5; F.pos[j + 2] = FX.flyHome[j + 2] + Math.cos(t * 0.27 + i * 0.7) * 1.5;
  }
  F.aPos.needsUpdate = true;
  // sparks from broken machines
  const SP = FX.sparks;
  FX.sparkT = (FX.sparkT || 0) - dt;
  if (FX.sparkT < 0) {
    FX.sparkT = rr(0.4, 2.2);
    for (const s of FX_POINTS.sparks) {
      if ((s.x - cam.x) ** 2 + (s.z - cam.z) ** 2 > 90 * 90 || rng() < 0.4) continue;
      for (let k = 0; k < 14; k++) SP.add(s.x, s.y, s.z, 3, 2.4, 1.2, 0.04, rr(0.3, 0.8), rr(-3, 3), rr(0, 4), rr(-3, 3));
      sfxAt('spark', s.x, s.y, s.z);
    }
  }
  for (let i = 0; i < SP.n; i++) {
    SP.age[i] += dt;
    if (SP.age[i] > SP.life[i]) { SP.n--; copyPoint(SP, SP.n, i); i--; continue; }
    const j = i * 3;
    SP.vel[j + 1] -= 9.8 * dt;
    SP.pos[j] += SP.vel[j] * dt; SP.pos[j + 1] += SP.vel[j + 1] * dt; SP.pos[j + 2] += SP.vel[j + 2] * dt;
  }
  SP.commit();
  // ash falling near the summit and around the vent
  const A = FX.ash;
  const nearV = smoothstep(260, 120, Math.hypot(cam.x - VX, cam.z - VZ)) * (indoor ? 0 : 1);
  for (let i = 0; i < A.n; i++) {
    const j = i * 3;
    A.pos[j + 1] -= (0.7 + (i % 7) * 0.08) * dt; A.pos[j] += (0.6 + Math.sin(t + i) * 0.3) * dt; A.pos[j + 2] += Math.cos(t * 0.7 + i) * 0.3 * dt;
    const dx = A.pos[j] - cam.x, dz = A.pos[j + 2] - cam.z;
    if (A.pos[j + 1] < cam.y - 8 || dx * dx + dz * dz > 30 * 30) {
      if (rng() < nearV) { A.pos[j] = cam.x + rr(-28, 28); A.pos[j + 1] = cam.y + rr(4, 16); A.pos[j + 2] = cam.z + rr(-28, 28); }
      else A.pos[j + 1] = -999;
    }
  }
  A.aPos.needsUpdate = true;
  // bats
  for (const b of FX.bats) {
    const a = t * b.sp + b.ph;
    b.g.position.set(b.cx + Math.cos(a) * b.r, b.h + Math.sin(t * 0.7 + b.ph) * 4, b.cz + Math.sin(a * 1.3) * b.r);
    b.g.rotation.y = -a * Math.sign(b.sp) + (b.sp > 0 ? 0 : Math.PI);
    const fl = Math.sin(t * 14 + b.ph) * 0.7;
    b.L.rotation.z = fl; b.R.rotation.z = -fl;
  }
  // volcanic lightning in the plume
  FX.nextFlash -= dt;
  if (FX.nextFlash < 0) {
    const storm = SKY.storm > 0.5;
    FX.nextFlash = (storm ? rr(7, 18) : rr(18, 45)) * (FX.eruption > 0.1 ? 0.3 : 1);
    FX.flashT = 0.0001; FX.flashPos = rr(-30, 30);
    let at = { x: VX + FX.flashPos, y: 300, z: VZ };
    if (storm && rng() < 0.75) { const a = rr(0, TAU), d = rr(60, 420); at = strikeBolt(cam.x + Math.cos(a) * d, cam.z + Math.sin(a) * d); }
    FX.flashAt = at;
    const dist = Math.hypot(at.x - cam.x, at.z - cam.z);
    setTimeout(() => thunder(dist, indoor), clamp(dist / 343, 0.15, 4) * 1000);
  }
  if (FX.flashT > 0) {
    FX.flashT += dt;
    const f = FX.flashT;
    const v = f < 0.06 ? 1 : f < 0.12 ? 0.2 : f < 0.2 ? 0.8 : Math.max(0, 1 - (f - 0.2) * 3);
    U.flash.value = v * (indoor ? 0.15 : 1);
    FX.lightning.intensity = v * 30000 * (indoor ? 0 : 1) * lerp(1, 0.3, SKY.day);
    FX.lightning.position.set(FX.flashAt.x, Math.max(FX.flashAt.y + 120, 200), FX.flashAt.z);
    if (f > 0.6) { FX.flashT = 0; U.flash.value = 0; FX.lightning.intensity = 0; }
  }
  // tremors
  FX.nextTremor -= dt;
  if (FX.nextTremor < 0) { FX.nextTremor = rr(80, 140); FX.shake = 1.6; sfx('rumble'); burstEmbers(); }
  FX.shake = Math.max(0, FX.shake - dt * 0.7);
}
function copyPoint(S, from, to) {
  for (let k = 0; k < 3; k++) { S.pos[to * 3 + k] = S.pos[from * 3 + k]; S.col[to * 3 + k] = S.col[from * 3 + k]; S.vel[to * 3 + k] = S.vel[from * 3 + k]; }
  S.size[to] = S.size[from]; S.life[to] = S.life[from]; S.age[to] = S.age[from];
}
function burstEmbers() {
  for (let k = 0; k < 120; k++) {
    const a = rr(0, TAU), d = rr(0, 10);
    FX.embers.add(VENT.x + Math.cos(a) * d, LAVA_LAKE_Y, VENT.z + Math.sin(a) * d, 4, 1.2, 0.2, rr(0.15, 0.3), rr(3, 7), rr(-4, 4), rr(10, 22), rr(-4, 4));
  }
}
const TREMOR_LINES = [
  'Seismic activity detected. Geothermal regulators offline.',
  'Warning. Magma pressure above tolerance in chamber two.',
  'Tremor recorded. All personnel... no personnel registered.',
];
function lavaHeat(x, y, z) {
  let d = Infinity;
  for (let i = 0; i < LAVA.length; i += 3) { const p = LAVA[i]; const dd = (p.x - x) ** 2 + (p.z - z) ** 2; if (dd < d) d = dd; }
  d = Math.sqrt(d);
  d = Math.min(d, Math.hypot(x - VENT.x, z - VENT.z) - 10);
  if (x > 40 && x < 76 && z > -64 && z < -36 && Math.abs(y - BASE_Y) < 6) d = Math.min(d, 6);
  if (x > 44 && x < 48 && z > -24 && z < -4 && Math.abs(y - BASE_Y) < 6) d = Math.min(d, 4);
  return smoothstep(26, 5, d);
}
