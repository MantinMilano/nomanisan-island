// ============================================================ humanoid rigs (the hero, holograms, echoes)
// A rig is a tree of joint Groups; meshes hang off the joints. Facing is +z, left side is +x.
function buildHumanoid(o) {
  const S = o.scale || 1;
  const J = {};
  const root = new THREE.Group();
  const add = (parent, name, x, y, z) => { const g = new THREE.Group(); g.position.set(x * S, y * S, z * S); parent.add(g); if (name) J[name] = g; return g; };
  const part = (parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x * S, y * S, z * S); m.scale.set(sx * S, sy * S, sz * S);
    m.castShadow = !o.noShadow; m.receiveShadow = !o.noShadow; parent.add(m); return m;
  };
  const sph = (r, ws = 16, hs = 12) => new THREE.SphereGeometry(r, ws, hs);
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 12);
  const P = o.p;   // proportions
  const hips = add(root, 'hips', 0, P.hipY, 0);
  part(hips, sph(0.22), o.trunks || o.suit, 0, 0, 0, 1.2 * P.hipW, 0.78, 0.9);
  if (o.belt) part(hips, new THREE.CylinderGeometry(0.255, 0.255, 0.1, 20), o.belt, 0, 0.11, 0, 1.08 * P.hipW, 1, 0.84);
  const spine = add(hips, 'spine', 0, 0.12, 0);
  part(spine, cap(0.19, 0.16), o.suit, 0, 0.13, 0, 1.1 * P.waist, 1, 0.82);
  const chest = add(spine, 'chest', 0, 0.42, 0.02);
  if (o.heroTorso) {
    // a V-shaped torso: broad chest and shoulders tapering to a narrow waist
    const prof = [[0, -0.6], [0.2, -0.58], [0.23, -0.42], [0.27, -0.24], [0.36, -0.06], [0.45, 0.1], [0.48, 0.2], [0.44, 0.31], [0.3, 0.41], [0.12, 0.47], [0, 0.48]].map(([r, y]) => new THREE.Vector2(r, y));
    J.chestMesh = part(chest, new THREE.LatheGeometry(prof, 28), o.suit, 0, 0, 0, 1.05 * P.chest, 1, 0.64 * P.chestD);
    for (const sx of [-1, 1]) part(chest, sph(0.19, 16, 12), o.suit, sx * 0.17, 0.12, 0.19, 1.15, 0.78, 0.6);
    part(chest, sph(0.22, 16, 10), o.suit, 0, 0.33, -0.05, 1.7, 0.55, 0.95);
    for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) part(chest, sph(0.07, 10, 8), o.suit, sx * 0.065, -0.12 - i * 0.12, 0.165 - i * 0.012, 1, 0.8, 0.5);
  } else J.chestMesh = part(chest, sph(0.4, 20, 16), o.suit, 0, 0, 0, 1.24 * P.chest, 0.94, 0.78 * P.chestD);
  if (o.emblem) { const e = part(chest, new THREE.CircleGeometry(0.15, 32), o.emblem, 0, o.heroTorso ? 0.12 : 0.06, o.heroTorso ? 0.315 : 0.31 * P.chestD); e.castShadow = false; if (o.heroTorso) e.rotation.x = -0.12; }
  if (o.cape) {
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.75 * S, 1.25 * S, 4, 6), o.cape);
    cape.position.set(0, -0.35 * S, -0.27 * S); cape.rotation.x = 0.12; chest.add(cape); J.cape = cape;
  }
  const neck = add(chest, 'neck', 0, 0.36, -0.02);
  part(neck, new THREE.CylinderGeometry(0.085, 0.1, 0.14, 12), o.skin || o.suit, 0, 0.04, 0);
  const head = add(neck, 'head', 0, 0.1, 0);
  part(head, sph(0.15, 20, 16), o.skin || o.suit, 0, 0.13, 0.01, 0.95, 1.12, 1.0);
  part(head, new THREE.BoxGeometry(0.2, 0.11, 0.18), o.skin || o.suit, 0, 0.04, 0.035);           // square jaw
  if (o.mask) part(head, new THREE.CylinderGeometry(0.157, 0.157, 0.065, 20, 1, true), o.mask, 0, 0.165, 0.012, 1, 1, 1.02);
  if (o.eyes) { part(head, sph(0.022, 8, 6), o.eyes, 0.052, 0.168, 0.14); part(head, sph(0.022, 8, 6), o.eyes, -0.052, 0.168, 0.14); }
  if (o.hair) {
    part(head, sph(0.155, 16, 10), o.hair, 0, 0.19, -0.02, 1.0, 0.72, 1.04);
    if (o.flameHair) {   // tall swept hair for Syndrome's hologram
      for (let i = 0; i < 5; i++) { const c = part(head, new THREE.ConeGeometry(0.07, 0.42, 8), o.hair, (i - 2) * 0.045, 0.42, -0.06 - Math.abs(i - 2) * 0.02); c.rotation.x = -0.35; c.rotation.z = (i - 2) * -0.12; }
    } else { const q = part(head, sph(0.08, 10, 8), o.hair, 0, 0.26, 0.09, 1.3, 0.5, 0.9); q.rotation.x = -0.4; }
  }
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const sh = add(chest, 'sh' + side, sx * 0.47 * P.shoulder, 0.2, -0.02);
    part(sh, sph(0.16, 14, 10), o.suit, 0, 0, 0, 1.05 * P.arm, 1, 1);
    part(sh, cap(0.115 * P.arm, 0.3), o.suit, 0, -0.24, 0);
    const el = add(sh, 'el' + side, 0, -0.44, 0);
    part(el, cap(0.1 * P.arm, 0.24), o.suit, 0, -0.17, 0);
    if (o.heroTorso) { part(sh, sph(0.13 * P.arm, 12, 10), o.suit, 0, -0.2, 0.05, 1, 1.3, 1); part(el, new THREE.CylinderGeometry(0.135 * P.arm, 0.105 * P.arm, 0.2, 14), o.gloves || o.suit, 0, -0.17, 0); }
    const hd = add(el, 'hand' + side, 0, -0.34, 0);
    part(hd, new THREE.CylinderGeometry(0.11 * P.arm, 0.095 * P.arm, 0.16, 12), o.gloves || o.suit, 0, 0.06, 0);
    part(hd, sph(0.1 * P.arm, 12, 10), o.gloves || o.suit, 0, -0.06, 0.01, 1, 1.05, 1.1);
    const hip = add(hips, 'hip' + side, sx * 0.15 * P.hipW, -0.05, 0);
    part(hip, cap(0.13 * P.leg, 0.3), o.suit, 0, -0.23, 0);
    const kn = add(hip, 'knee' + side, 0, -0.46, 0);
    part(kn, cap(0.1 * P.leg, 0.28), o.suit, 0, -0.2, 0);
    if (o.heroTorso) part(kn, new THREE.CylinderGeometry(0.125 * P.leg, 0.11 * P.leg, 0.26, 14), o.boots || o.suit, 0, -0.26, 0);
    const ft = add(kn, 'foot' + side, 0, -0.42, 0);
    part(ft, cap(0.105 * P.leg, 0.1), o.boots || o.suit, 0, 0.08, 0);
    part(ft, new THREE.BoxGeometry(0.15, 0.08, 0.27), o.boots || o.suit, 0, -0.01, 0.06);
  }
  return { root, J };
}
function heroMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const emblemTexH = canvasTex(256, 256, (g) => {
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#f08a1c'; g.beginPath(); g.arc(128, 128, 124, 0, TAU); g.fill();
    g.fillStyle = '#16203a'; g.beginPath(); g.arc(128, 128, 104, 0, TAU); g.fill();
    // an atom-burst "M": three bolts meeting in the middle
    g.fillStyle = '#f2ede2';
    g.beginPath(); g.moveTo(60, 180); g.lineTo(84, 70); g.lineTo(128, 140); g.lineTo(172, 70); g.lineTo(196, 180); g.lineTo(170, 180); g.lineTo(158, 118); g.lineTo(128, 168); g.lineTo(98, 118); g.lineTo(86, 180); g.closePath(); g.fill();
  }, { clamp: true });
  return {
    suit: std({ color: 0x2c4fae, roughness: 0.36, metalness: 0.12, envMap: envTex, envMapIntensity: 0.7 }),
    trunks: std({ color: 0x141a33, roughness: 0.45 }),
    belt: std({ color: 0xe8861c, roughness: 0.35, metalness: 0.3, envMap: envTex, envMapIntensity: 0.6 }),
    gloves: std({ color: 0xe8861c, roughness: 0.38, envMap: envTex, envMapIntensity: 0.5 }),
    boots: std({ color: 0xe0801a, roughness: 0.38, envMap: envTex, envMapIntensity: 0.5 }),
    skin: std({ color: 0xd9a27c, roughness: 0.65 }),
    mask: std({ color: 0x0c0d12, roughness: 0.3 }),
    eyes: std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.25 }),
    hair: std({ color: 0x3a2618, roughness: 0.7 }),
    emblem: std({ map: emblemTexH, transparent: true, roughness: 0.4, emissive: 0xffffff, emissiveMap: emblemTexH, emissiveIntensity: 0.12 }),
  };
}
// Glowing see-through material for holograms and echoes
function holoMaterial(color, strength = 1) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: U.time, uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `uniform float uTime, uStrength; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        float lines = 0.65 + 0.35 * sin(vW.y * 60.0 - uTime * 8.0);
        float flick = 0.85 + 0.15 * sin(uTime * 23.0) * sin(uTime * 7.0);
        gl_FragColor = vec4(uColor * (0.12 + rim * 1.4) * lines * flick * uStrength, 1.0);
      }`,
  });
}

// ============================================================ the hero: Megaton
const HERO = {
  rig: null, mats: null, face: 0, hp: 100, maxHp: 100, lastHit: -99, boots: false, carrying: null,
  charge: 0, charging: false, slam: false, airJumps: 0, gliding: false, punchT: 0, punchSide: 0, combo: 0, comboT: 0,
  landT: 0, hitT: 0, throwT: 0, scanPose: 0, climb: null, liftT: 0, lamp: null, lampOn: false, god: false, flames: [],
  anim: { phase: 0 }, cur: {}, power: 1,
};
const HERO_H = 2.1, HERO_CROUCH_H = 1.35;
function buildHero() {
  HERO.mats = heroMaterials();
  const m = HERO.mats;
  const rig = buildHumanoid({
    p: { hipY: 0.98, hipW: 1.0, waist: 0.9, chest: 1.12, chestD: 1.05, shoulder: 1.12, arm: 1.18, leg: 1.1 }, heroTorso: true,
    suit: m.suit, trunks: m.trunks, belt: m.belt, gloves: m.gloves, boots: m.boots, skin: m.skin, mask: m.mask, eyes: m.eyes, hair: m.hair, emblem: m.emblem,
  });
  HERO.rig = rig;
  scene.add(rig.root);
  // suit lamp on the chest
  const lamp = new THREE.SpotLight(0xfff0d6, 0, 42, 0.5, 0.55, 2);
  lamp.position.set(0, 0.05, 0.35); rig.J.chest.add(lamp); rig.J.chest.add(lamp.target); lamp.target.position.set(0, -2, 10);
  HERO.lamp = lamp;
  // rocket boot flames (hidden until the boots are found)
  for (const side of ['L', 'R']) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 10, 1, true).translate(0, -0.25, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.6, 0.4), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    f.rotation.x = Math.PI; f.position.set(0, -0.06, 0); f.visible = false;
    rig.J['foot' + side].add(f); HERO.flames.push(f);
  }
  rig.root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  // a soft key light that keeps the hero readable at night, the way a film crew would light him
  HERO.fill = new THREE.PointLight(0xc8d6ff, 0, 7, 2);
  scene.add(HERO.fill);
}
function updateHeroFill() {
  const L = HERO.fill;
  if (!L) return;
  _cf.subVectors(camera.position, _tp.set(P.x, P.y + 1.4, P.z)).setY(0).normalize();
  L.position.set(P.x + _cf.x * 1.7 + _cf.z * 0.8, P.y + 2.6, P.z + _cf.z * 1.7 - _cf.x * 0.8);
  L.intensity = (1 - SKY.day * 0.85) * (P.room ? 2.5 : 5) * (HERO.rig.root.visible ? 1 : 0);
}
function setBoots(on) {
  HERO.boots = on;
  HERO.mats.boots.color.set(on ? 0xd8dde4 : 0xe0801a);
  HERO.mats.boots.metalness = on ? 0.8 : 0;
  HERO.mats.boots.roughness = on ? 0.25 : 0.38;
}

// ---- joint pose targets and smoothing
const POSE_KEYS = ['hipsY', 'spineX', 'spineY', 'spineZ', 'headX', 'headY', 'shLX', 'shLZ', 'elLX', 'shRX', 'shRZ', 'elRX', 'hipLX', 'hipLZ', 'kneeLX', 'hipRX', 'hipRZ', 'kneeRX', 'footLX', 'footRX'];
function animateHero(dt, t) {
  const A = HERO.anim, R = HERO.rig.J, T = {};
  for (const k of POSE_KEYS) T[k] = 0;
  const sp = Math.hypot(P.vx, P.vz), runK = clamp((sp - 4) / 5, 0, 1), moving = sp > 0.4 && P.grounded;
  A.phase += dt * (moving ? lerp(7.5, 11.5, runK) * clamp(sp / 5, 0.7, 1.4) : 0);
  const s = Math.sin(A.phase), c = Math.cos(A.phase);
  const breathe = Math.sin(t * 1.6) * 0.012;
  // base: arms hang slightly out past the big chest
  T.shLZ = 0.16; T.shRZ = -0.16; T.elLX = -0.18; T.elRX = -0.18;
  if (P.grounded) {
    if (moving) {
      const swing = lerp(0.6, 1.0, runK);
      T.hipLX = s * swing; T.hipRX = -s * swing;
      T.kneeLX = Math.max(0, Math.sin(A.phase + 1.4)) * lerp(0.9, 1.6, runK) + 0.1;
      T.kneeRX = Math.max(0, Math.sin(A.phase + 1.4 + Math.PI)) * lerp(0.9, 1.6, runK) + 0.1;
      T.shLX = -s * lerp(0.45, 0.95, runK); T.shRX = s * lerp(0.45, 0.95, runK);
      T.elLX = -lerp(0.3, 1.3, runK); T.elRX = -lerp(0.3, 1.3, runK);
      T.spineX = lerp(0.05, 0.28, runK); T.spineY = s * 0.08;
      T.hipsY = -Math.abs(c) * lerp(0.03, 0.08, runK);
    } else {
      T.spineX = breathe; T.headX = Math.sin(t * 0.4) * 0.03; T.headY = Math.sin(t * 0.23) * 0.12;
      T.shLZ += breathe * 2; T.shRZ -= breathe * 2;
    }
  } else if (HERO.gliding) {
    T.shLZ = 1.35; T.shRZ = -1.35; T.shLX = -0.2; T.shRX = -0.2; T.elLX = -0.1; T.elRX = -0.1;
    T.spineX = 0.55; T.hipLX = 0.25; T.hipRX = 0.25; T.kneeLX = 0.25; T.kneeRX = 0.35; T.headX = -0.35;
  } else if (HERO.slam) {
    T.shLX = -2.9; T.shRX = -2.9; T.shLZ = 0.15; T.shRZ = -0.15; T.elLX = -0.2; T.elRX = -0.2; T.spineX = 0.35; T.hipLX = -0.5; T.hipRX = -0.5; T.kneeLX = 1.2; T.kneeRX = 1.2;
  } else {
    const up = P.vy > 0;
    T.hipLX = up ? -0.7 : -0.35; T.hipRX = up ? 0.15 : -0.1; T.kneeLX = up ? 1.1 : 0.5; T.kneeRX = up ? 0.6 : 0.4;
    T.shLX = up ? -1.2 : -0.6; T.shRX = up ? -0.4 : -0.6; T.shLZ = 0.5; T.shRZ = -0.5; T.spineX = up ? 0.1 : -0.05;
  }
  // charging a super jump: deep crouch
  if (HERO.charging) { const k = HERO.charge; T.hipsY = -0.45 * k; T.hipLX = -0.9 * k; T.hipRX = -0.9 * k; T.kneeLX = 1.8 * k; T.kneeRX = 1.8 * k; T.spineX = 0.45 * k; T.shLX = 0.6 * k; T.shRX = 0.6 * k; }
  if (P.crouch > 0.5 && P.grounded && !HERO.charging) { T.hipsY = -0.38; T.hipLX -= 0.75; T.hipRX -= 0.75; T.kneeLX += 1.2; T.kneeRX += 1.2; T.spineX += 0.4; }
  if (HERO.landT > 0) { const k = HERO.landT / 0.35; T.hipsY -= 0.4 * k; T.kneeLX += 1.3 * k; T.kneeRX += 1.3 * k; T.hipLX -= 0.8 * k; T.hipRX -= 0.8 * k; T.spineX += 0.5 * k; T.shLX = lerp(T.shLX, 0.3, k); T.shRX = lerp(T.shRX, 0.3, k); }
  // punches
  if (HERO.punchT > 0) {
    const f = 1 - HERO.punchT / 0.32, ext = f < 0.35 ? f / 0.35 : 1 - (f - 0.35) / 0.65;
    const L = HERO.punchSide === 0;
    if (HERO.combo === 2) {   // finisher: both fists, uppercut
      T.shLX = lerp(T.shLX, -2.4, ext); T.shRX = lerp(T.shRX, -2.4, ext); T.elLX = lerp(-1.6, -0.2, ext); T.elRX = lerp(-1.6, -0.2, ext); T.spineX = lerp(0.3, -0.15, ext);
    } else {
      T[L ? 'shLX' : 'shRX'] = lerp(-0.5, -1.62, ext); T[L ? 'elLX' : 'elRX'] = lerp(-1.9, -0.05, ext); T[L ? 'shLZ' : 'shRZ'] = (L ? 1 : -1) * 0.05;
      T[L ? 'shRX' : 'shLX'] = 0.35; T[L ? 'elRX' : 'elLX'] = -1.7;
      T.spineY = (L ? -0.45 : 0.45) * ext; T.spineX = 0.12;
    }
  }
  if (HERO.throwT > 0) { const k = HERO.throwT / 0.4; T.shLX = lerp(-1.2, -2.8, k); T.shRX = lerp(-1.2, -2.8, k); T.elLX = -0.3; T.elRX = -0.3; T.spineX = lerp(0.35, -0.2, k); }
  if (HERO.carrying) { T.shLX = -2.85; T.shRX = -2.85; T.shLZ = 0.32; T.shRZ = -0.32; T.elLX = -0.55; T.elRX = -0.55; T.spineX = -0.05; }
  if (HERO.liftT > 0) { T.shLX = -3.0; T.shRX = -3.0; T.shLZ = 0.4; T.shRZ = -0.4; T.elLX = -0.2; T.elRX = -0.2; T.hipsY = -0.2; T.kneeLX = 0.6; T.kneeRX = 0.6; }
  if (HERO.scanPose > 0.01) { const k = HERO.scanPose; T.shRX = lerp(T.shRX, -1.9, k); T.shRZ = lerp(T.shRZ, -0.55, k); T.elRX = lerp(T.elRX, -2.35, k); T.headX = lerp(T.headX, 0.12, k); }
  if (HERO.climb) { const cp = t * 6; T.shLX = -2.8 + Math.sin(cp) * 0.35; T.shRX = -2.8 - Math.sin(cp) * 0.35; T.elLX = -0.6; T.elRX = -0.6; T.hipLX = -0.8 + Math.sin(cp) * 0.4; T.hipRX = -0.8 - Math.sin(cp) * 0.4; T.kneeLX = 1.2; T.kneeRX = 1.2; }
  if (HERO.hitT > 0) { const k = HERO.hitT / 0.3; T.spineX -= 0.35 * k; T.headX -= 0.3 * k; T.shLZ += 0.5 * k; T.shRZ -= 0.5 * k; }
  if (GAME.mode === 'ko') { T.hipsY = -0.6; T.kneeLX = 1.6; T.kneeRX = 1.4; T.spineX = 0.7; T.headX = 0.4; T.shLX = 0.4; T.shRX = 0.3; }
  // smooth toward the targets
  const C = HERO.cur, rate = 1 - Math.exp(-dt * 16);
  for (const k of POSE_KEYS) C[k] = (C[k] ?? 0) + (T[k] - (C[k] ?? 0)) * rate;
  R.hips.position.y = 0.98 + C.hipsY;
  R.spine.rotation.set(C.spineX, C.spineY, C.spineZ);
  R.head.rotation.set(C.headX, C.headY, 0);
  R.shL.rotation.set(C.shLX, 0, C.shLZ); R.shR.rotation.set(C.shRX, 0, C.shRZ);
  R.elL.rotation.x = C.elLX; R.elR.rotation.x = C.elRX;
  R.hipL.rotation.set(C.hipLX, 0, C.hipLZ + 0.04); R.hipR.rotation.set(C.hipRX, 0, C.hipRZ - 0.04);
  R.kneeL.rotation.x = C.kneeLX; R.kneeR.rotation.x = C.kneeRX;
  R.footL.rotation.x = -C.hipLX * 0.3 - C.kneeLX * 0.35; R.footR.rotation.x = -C.hipRX * 0.3 - C.kneeRX * 0.35;
  R.chestMesh.scale.y = 0.94 * (1 + breathe);
  // place the rig
  const root = HERO.rig.root;
  root.position.set(P.x, P.y, P.z);
  root.rotation.y = HERO.face;
  const fl = (HERO.gliding || (!P.grounded && HERO.boots && HERO.flameT > 0)) && GAME.mode === 'play';
  for (const f of HERO.flames) { f.visible = fl; f.scale.y = 0.8 + Math.random() * 0.6; }
  HERO.flameT = Math.max(0, (HERO.flameT || 0) - dt);
}

// ============================================================ hero control
const AIM = new THREE.Vector3();
const _hfw = new THREE.Vector3();
function heroForward(out = _hfw) { return out.set(Math.sin(HERO.face), 0, Math.cos(HERO.face)); }
function camForward(out) { return out.set(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch)); }
function updateHero(dt, t) {
  const canMove = GAME.mode === 'play' && !HERO.climb && HERO.liftT <= 0;
  let f = 0, s = 0;
  if (canMove) {
    f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + TOUCH.f;
    s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + TOUCH.s;
  }
  const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
  // camera-relative direction
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  const mx = fx * f + rx * s, mz = fz * f + rz * s;
  const wantCrouch = (P.crouchOn || keys.ControlLeft || keys.ControlRight) && !HERO.carrying;
  if (wantCrouch) P.crouch = 1; else if (P.crouch && !standBlocked()) P.crouch = 0;
  const run = (keys.ShiftLeft || keys.ShiftRight || TOUCH.run) && P.crouch < 0.5;
  let speed = P.crouch > 0.5 ? 2.6 : run ? 9.6 : 5.0;
  if (HERO.carrying) speed *= 0.72;
  if (HERO.charging) speed *= 0.2;
  if (HERO.punchT > 0 && P.grounded) speed *= 0.35;
  if (P.inWater) speed *= 0.6;
  if (SCAN.on) speed *= 0.62;
  if (P.floor === TERRAIN && P.grounded && len > 0) {
    const [gx, gz] = terrainGrad(P.x, P.z);
    const up = (gx * mx + gz * mz) / Math.max(len, 0.01);
    if (up > 0.35) speed *= clamp(1.3 - up * 0.75, 0.5, 1);
  }
  let tvx = mx * speed, tvz = mz * speed;
  // gliding carries you forward; riding a column of hot air you hover and steer instead
  if (HERO.gliding) { if (HERO.inUpdraft) { tvx = mx * 8; tvz = mz * 8; } else { const hf = heroForward(); tvx = lerp(hf.x * 11, mx * 11, 0.5); tvz = lerp(hf.z * 11, mz * 11, 0.5); } }
  let acc = P.grounded ? 12 : HERO.gliding ? 3 : 2.4;
  if (HERO.dashT > 0) { HERO.dashT -= dt; tvx = HERO.dashVx; tvz = HERO.dashVz; acc = 40; }
  P.vx = damp(P.vx, tvx, acc, dt); P.vz = damp(P.vz, tvz, acc, dt);
  // facing: toward movement, or toward the camera while aiming/punching/carrying
  const aiming = GAME.aim > 0.5 || HERO.scanPose > 0.5;
  let targetFace = null;
  if (aiming || (HERO.punchT > 0 && len < 0.1)) targetFace = Math.atan2(fx, fz);
  else if (len > 0.1) targetFace = Math.atan2(mx, mz);
  if (targetFace != null) HERO.face += wrapAngle(targetFace - HERO.face) * (1 - Math.exp(-dt * (aiming ? 18 : 11)));
  if (P.grounded && P.floor === TERRAIN) {
    const ny = terrainNormalY(P.x, P.z);
    if (ny < 0.5) { const [gx, gz] = terrainGrad(P.x, P.z); P.vx -= gx * 14 * dt; P.vz -= gz * 14 * dt; }
  }
  if (HERO.climb) climbStep(dt);
  else {
    const dist = Math.hypot(P.vx, P.vz) * dt, n = Math.max(1, Math.ceil(dist / 0.22));
    for (let i = 0; i < n; i++) moveHoriz((P.vx * dt) / n, (P.vz * dt) / n);
  }
  // jumping: tap to hop, hold to charge a super jump; boots give a second jump and a glide
  const jumpKey = canMove && (keys.Space || TOUCH.jump);
  if (jumpKey && !HERO.jumpHeld) {
    HERO.jumpHeld = true; HERO.jumpPressT = t;
    if (!P.grounded && HERO.boots && HERO.airJumps < 1 && !HERO.carrying && !HERO.slam) { HERO.airJumps++; P.vy = Math.max(P.vy, 10.5); HERO.flameT = 0.5; sfx('boost'); burstDust(P.x, P.y, P.z, 0.5, 0x9fb0c0); STORY.flags.doubleJumped = true; }
  }
  if (jumpKey && P.grounded && P.crouch < 0.5 && t - HERO.jumpPressT > 0.16) { HERO.charging = true; HERO.charge = Math.min(1, HERO.charge + dt / 0.8); }
  if (!jumpKey && HERO.jumpHeld) {
    HERO.jumpHeld = false; TOUCH.jump = false;
    if (P.grounded && P.crouch < 0.5) {
      const k = HERO.charging ? HERO.charge : 0;
      P.vy = lerp(7.8, 18.5, k); P.grounded = false; HERO.airJumps = 0;
      if (k > 0.3) { sfx('superjump'); burstDust(P.x, P.y, P.z, 1 + k, 0x8a7d6a); FX.shake = Math.max(FX.shake, 0.3 * k); if (k > 0.55) STORY.flags.superJumped = true; }
      else sfx('jump');
    }
    HERO.charging = false; HERO.charge = 0;
  }
  const up = P.grounded ? 0 : updraftAt(P.x, P.y, P.z);
  HERO.inUpdraft = up > 0;
  HERO.gliding = HERO.boots && !P.grounded && (P.vy < 0 || up > 0) && jumpKey && !HERO.carrying && !HERO.slam && t - HERO.jumpPressT > 0.25;
  if (HERO.gliding && !STORY.flags.glided) { STORY.flags.glided = true; if (!DLG.heard.has('meg_glide')) setTimeout(() => bark('meg_glide'), 600); }
  if (P.grounded) { HERO.charging = HERO.charging && jumpKey; }
  // vertical motion
  if (P.grounded) {
    const fl = findFloor(P.x, P.z, P.y);
    if (!fl || fl.y < P.y - 0.65) { P.grounded = false; P.vy = 0; HERO.airJumps = 0; }
    else { P.y = fl.y; P.floor = fl.f; }
  }
  if (!P.grounded && !HERO.climb) {
    P.vy -= (HERO.slam ? 60 : GRAV) * dt;
    if (HERO.gliding) { P.vy = Math.max(P.vy, -2.6); }
    if (up > 0 && !HERO.slam) P.vy = Math.min(P.vy + up * dt * (HERO.gliding ? 1.3 : 1), HERO.gliding ? 16 : 12);
    P.y += P.vy * dt;
    if (P.vy <= 0) {
      const fl = findFloor(P.x, P.z, P.y + 0.35);
      if (fl && P.y <= fl.y) {
        const impact = -P.vy;
        P.y = fl.y; P.vy = 0; P.grounded = true; P.floor = fl.f; HERO.airJumps = 0;
        if (HERO.slam) { HERO.slam = false; groundSlam(); }
        else if (impact > 14) { HERO.landT = 0.35; FX.shake = Math.max(FX.shake, clamp(impact / 40, 0.2, 0.9)); burstDust(P.x, P.y, P.z, clamp(impact / 15, 0.6, 2), 0x8a7d6a); sfx('land'); damageAround(P.x, P.y, P.z, 3.5, impact > 24 ? 1 : 0, 'land'); }
        else if (impact > 6) { HERO.landT = 0.18; footstep(floorKind()); }
      }
    }
    if (P.y < -40) return fellIntoVoid();
  }
  // where am I
  P.room = P.floor && P.floor.room ? P.floor.room : null;
  const rv = P.floor === TERRAIN || P.floor === WATER ? riverAt(P.x, P.z) : null;
  P.inWater = (P.floor === TERRAIN && P.y < -0.2) || (rv != null && rv > P.y + 0.15) ? 1 : 0;
  const hs = Math.hypot(P.vx, P.vz);
  if (P.grounded && hs > 0.6) { P.stepAcc += hs * dt; if (P.stepAcc > (run ? 2.9 : 2.1)) { P.stepAcc = 0; footstep(floorKind()); } }
  // timers
  HERO.punchT = Math.max(0, HERO.punchT - dt); HERO.comboT = Math.max(0, HERO.comboT - dt);
  HERO.landT = Math.max(0, HERO.landT - dt); HERO.hitT = Math.max(0, HERO.hitT - dt); HERO.throwT = Math.max(0, HERO.throwT - dt);
  HERO.liftT = Math.max(0, HERO.liftT - dt);
  HERO.scanPose = damp(HERO.scanPose, SCAN.on ? 1 : 0, 10, dt);
  if (HERO.pendingHit && t >= HERO.pendingHit.at) { const ph = HERO.pendingHit; HERO.pendingHit = null; resolvePunch(ph.dmg, ph.finisher); }
  // health regenerates after a few quiet seconds
  if (t - HERO.lastHit > 4 && HERO.hp < HERO.maxHp) HERO.hp = Math.min(HERO.maxHp, HERO.hp + 14 * dt);
  // the carried object rides above the head
  if (HERO.carrying) { const o = HERO.carrying; const hf = heroForward(); o.mesh.position.set(P.x + hf.x * 0.15, P.y + 2.75 + (o.lift || 0), P.z + hf.z * 0.15); o.mesh.rotation.y = HERO.face; }
  HERO.lamp.intensity = HERO.lampOn ? 90 : 0;
}

// ---- punches, slams, grabbing, throwing
function heroAttack() {
  if (GAME.mode !== 'play' || HERO.climb) return;
  if (HERO.carrying) return throwCarried();
  // in the air: punch whatever is within reach at your height, otherwise dive into a ground slam
  if (!P.grounded && !HERO.slam && P.y - (findFloor(P.x, P.z, P.y)?.y ?? P.y) > 1.6) {
    const airHit = punchTarget(true);
    if (!airHit) { HERO.slam = true; P.vy = -14; HERO.gliding = false; sfx('whoosh'); return; }
    P.vy = Math.max(P.vy, 2.5);   // hang in the air for the punch
  }
  if (HERO.punchT > 0.12) return;
  HERO.combo = HERO.comboT > 0 ? (HERO.combo + 1) % 3 : 0;
  HERO.comboT = 0.75;
  HERO.punchSide = HERO.combo === 1 ? 1 : 0;
  HERO.punchT = HERO.combo === 2 ? 0.42 : 0.32;
  // lock on: turn toward the nearest thing worth hitting in front of the camera and lunge at it
  const tg = punchTarget(!P.grounded);
  if (tg) {
    const p = tg.pos(), dx = p.x - P.x, dz = p.z - P.z, d = Math.hypot(dx, dz) || 1;
    HERO.face = Math.atan2(dx, dz);
    const reachD = 1.2 + (tg.radius || 0.5);
    if (d > reachD + 0.4) { HERO.dashT = Math.min(0.32, (d - reachD) / 22); HERO.dashVx = dx / d * 22; HERO.dashVz = dz / d * 22; }
    const up = p.y - (P.y + 1.3);
    if (P.grounded && up > 1.2 && up < 6) { P.vy = Math.sqrt(2 * GRAV * (up + 0.6)); P.grounded = false; }
    if (HERO.dashT > 0) sfx('whoosh');
  }
  const hf = heroForward();
  if (P.grounded && !tg) { P.vx += hf.x * 2.5; P.vz += hf.z * 2.5; }
  sfx('swing');
  HERO.pendingHit = { at: U.time.value + (HERO.dashT || 0) + (HERO.combo === 2 ? 0.14 : 0.09), dmg: HERO.combo === 2 ? 2 * HERO.power : 1 * HERO.power, finisher: HERO.combo === 2 };
}
const _hv = new THREE.Vector3(), _cfw = new THREE.Vector3();
// air: only things within a punch of where the hero is right now (in the air there is no lunge upward)
function punchTarget(air) {
  camForward(_cfw); _cfw.y = 0; _cfw.normalize();
  let best = null, bs = Infinity;
  for (const tg of HITTABLES) {
    if (!tg.alive || !tg.alive()) continue;
    const r = tg.radius || 0.5;
    const p = tg.pos(), dx = p.x - P.x, dz = p.z - P.z, d = Math.hypot(dx, dz), dy = p.y - (P.y + 1.3);
    if (air ? (d > 4.5 + r || dy < -2.4 || dy > 2.8) : (d > 8 + r || p.y - P.y > 6.5 || P.y - p.y > 3)) continue;
    const dot = d > 0.5 ? (dx * _cfw.x + dz * _cfw.z) / d : 1;
    if (dot < 0.35) continue;
    const score = Math.hypot(d, dy * 0.8) - r - dot * 1.5;
    if (score < bs) { bs = score; best = tg; }
  }
  return best;
}
function resolvePunch(dmg, finisher) {
  const hf = heroForward();
  const cx = P.x + hf.x * 1.1, cy = P.y + 1.3, cz = P.z + hf.z * 1.1;
  let hit = false;
  for (const tg of hittables()) {
    if (!tg.alive || !tg.alive()) continue;
    const p = tg.pos();
    const dx = p.x - P.x, dz = p.z - P.z, d = Math.hypot(dx, dz);
    const r = tg.radius || 0.6;
    if (d - r > 2.3) continue;
    if (d > 0.4 && (dx * hf.x + dz * hf.z) / d < 0.25) continue;
    const dy = p.y - cy;
    const reach = (tg.reachUp || 1.6) + (P.grounded ? 0 : 1.5);
    if (dy > reach || dy < -2.2) continue;
    _hv.set(dx, 0, dz).normalize();
    tg.hit(dmg, _hv, finisher ? 'finisher' : 'punch');
    hit = true;
  }
  if (hit) { hitStop(finisher ? 0.09 : 0.05); FX.shake = Math.max(FX.shake, finisher ? 0.5 : 0.25); sparkBurst(cx, cy, cz, finisher ? 22 : 12, 0xffc070); sfx(finisher ? 'punchHeavy' : 'punchHit'); }
}
function groundSlam() {
  HERO.landT = 0.45;
  FX.shake = Math.max(FX.shake, 1.0);
  sfx('slam');
  burstDust(P.x, P.y, P.z, 2.6, 0x8a7d6a);
  shockRing(P.x, P.y + 0.1, P.z, 7);
  damageAround(P.x, P.y, P.z, 6.5, 2 * HERO.power, 'slam');
}
function damageAround(x, y, z, r, dmg, kind) {
  for (const tg of hittables()) {
    if (!tg.alive || !tg.alive()) continue;
    const p = tg.pos();
    const d = Math.hypot(p.x - x, p.z - z);
    if (d > r + (tg.radius || 0.5) || Math.abs(p.y - y) > 3.5) continue;
    if (kind === 'land' && !tg.slammable) continue;
    if (dmg <= 0 && !tg.slammable) continue;
    _hv.set(p.x - x, 0, p.z - z).normalize();
    tg.hit(Math.max(dmg, tg.slammable ? 1 : 0), _hv, kind);
  }
}
function tryGrab() {
  if (HERO.carrying) { dropCarried(); return true; }
  let best = null, bd = 2.6;
  for (const o of THROWABLES) {
    if (o.gone || o.flying) continue;
    const d = Math.hypot(o.mesh.position.x - P.x, o.mesh.position.z - P.z);
    if (d < bd && Math.abs(o.mesh.position.y - P.y) < 2.2) { bd = d; best = o; }
  }
  if (!best) return false;
  HERO.carrying = best; best.held = true; sfx('lift');
  return true;
}
function dropCarried() {
  const o = HERO.carrying; if (!o) return;
  HERO.carrying = null; o.held = false;
  const hf = heroForward();
  const x = P.x + hf.x * 1.4, z = P.z + hf.z * 1.4;
  const fl = findFloor(x, z, P.y + 1);
  o.mesh.position.set(x, (fl ? fl.y : P.y) + (o.rest || 0.5), z);
}
function throwCarried() {
  const o = HERO.carrying; if (!o) return;
  HERO.carrying = null; o.held = false; o.flying = true;
  camForward(AIM);
  const dir = AIM.clone(); dir.y = Math.max(dir.y + 0.12, -0.25); dir.normalize();
  o.vel = dir.multiplyScalar(30);
  HERO.throwT = 0.4;
  HERO.face = Math.atan2(AIM.x, AIM.z);
  sfx('throw');
}

// ---- climbing ladders (auto-climb between two points)
function startClimb(from, to, then) {
  HERO.climb = { from: new THREE.Vector3(from.x, from.y, from.z), to: new THREE.Vector3(to.x, to.y, to.z), t: 0, dur: Math.max(1.2, Math.abs(to.y - from.y) / 4.5), then };
  P.vx = P.vz = P.vy = 0; HERO.face = from.face ?? HERO.face;
}
function climbStep(dt) {
  const C = HERO.climb;
  C.t += dt / C.dur;
  const k = Math.min(C.t, 1);
  P.x = lerp(C.from.x, C.to.x, k); P.z = lerp(C.from.z, C.to.z, k); P.y = lerp(C.from.y, C.to.y, k);
  if (k >= 1) { HERO.climb = null; P.grounded = true; const fl = findFloor(P.x, P.z, P.y + 0.3); if (fl) { P.y = fl.y; P.floor = fl.f; } if (C.then) C.then(); }
}

// ---- damage to the hero
function hurtHero(dmg, from) {
  if (GAME.mode !== 'play' || HERO.god || GAME.cutscene) return;
  HERO.hp -= dmg; HERO.lastHit = U.time.value; HERO.hitT = 0.3;
  finalPass.uniforms.uHit.value = Math.min(1, finalPass.uniforms.uHit.value + 0.5 + dmg / 30);
  if (from) { _hv.set(P.x - from.x, 0, P.z - from.z).normalize(); P.vx += _hv.x * 5; P.vz += _hv.z * 5; }
  sfx('hurt');
  if (HERO.hp <= 0) knockOut();
}
function knockOut() {
  HERO.hp = 0; GAME.mode = 'ko'; GAME.koT = 0; STORY.kos++;
  if (SCAN.on) toggleScan(false);
  if (STORY.mission >= 2) setTimeout(() => bark('syn_ko'), 2600);
  if (HERO.carrying) dropCarried();
  sfx('ko');
  setTimeout(() => fadeTo(1, 0.9, () => { respawnHero(); }), 1600);
}
function respawnHero(msg) {
  HERO.hp = HERO.maxHp; HERO.slam = false; HERO.climb = null; HERO.gliding = false; HERO.charging = false;
  const cp = currentCheckpoint();
  placeAt(cp);
  GAME.mode = 'play';
  calmAllEnemies();
  fadeTo(0, 1.0);
  if (msg) setTimeout(() => toast('Checkpoint', msg, ''), 400);
}
function fellIntoVoid() {
  if (GAME.mode !== 'play') return;
  GAME.mode = 'ko';
  fadeTo(1, 0.35, () => respawnHero());
}
// rising hot air (the silo during the eruption, steam vents)
const UPDRAFTS = [];
function updraftAt(x, y, z) {
  let u = 0;
  for (const d of UPDRAFTS) { if (d.on && !d.on()) continue; if ((x - d.x) ** 2 + (z - d.z) ** 2 < d.r * d.r && y > d.y0 && y < d.y1) u = Math.max(u, d.power); }
  return u;
}

// ============================================================ third-person camera
const CAMR = { dist: 4.6, cur: 4.6, side: 0.62 };
const _cp = new THREE.Vector3(), _cf = new THREE.Vector3(), _cr = new THREE.Vector3(), _tp = new THREE.Vector3();
function camBlocked(p) {
  // the bosses' bodies push the camera in front of them
  if (OMNI.state !== 'off' && OMNI.state !== 'dead' && p.distanceTo(_hv2.set(OMNI.pos.x, OMNI.pos.y + OMNI.h, OMNI.pos.z)) < 2.8) return true;
  if (KRONOS.state !== 'off' && KRONOS.state !== 'dead' && p.distanceTo(KRONOS.pos) < 5.4) return true;
  for (const v of CAM_VOLUMES) if ((p.x - v.x) ** 2 + (p.z - v.z) ** 2 < v.r * v.r && p.y > v.y0 && p.y < v.y1) return false;
  if (P.room) {
    for (const f of floors) {
      if (!f.indoor || p.x < f.x0 || p.x > f.x1 || p.z < f.z0 || p.z > f.z1) continue;
      if (f.enabled && !f.enabled()) continue;
      if (!f.contains(p.x, p.z)) continue;
      const fy = f.y(p.x, p.z);
      if (p.y > fy + 0.15 && p.y < fy + (f.h || 4) - 0.2) return obstacleAt(p);
    }
    return true;
  }
  if (!inTerrainHole(p.x, p.z) && terrainHeight(p.x, p.z) > p.y - 0.45) return true;
  return obstacleAt(p);
}
function obstacleAt(p) {
  for (const o of obstaclesNear(p.x, p.z)) {
    if (p.y < o.y0 - 0.1 || p.y > o.y1 + 0.1 || o.noCam) continue;
    if (o.t === 'c') { if ((p.x - o.x) ** 2 + (p.z - o.z) ** 2 < (o.r + 0.2) ** 2) return true; }
    else { const dx = p.x - o.x, dz = p.z - o.z; const lx = dx * o.c + dz * o.s, lz = -dx * o.s + dz * o.c; if (Math.abs(lx) < o.hx + 0.2 && Math.abs(lz) < o.hz + 0.2) return true; }
  }
  return false;
}
function updateCameraTP(dt, t) {
  if (GAME.mode === 'ride' || GAME.cutscene) return;
  const aim = GAME.aim || 0;
  const indoor = !!P.room;
  const want = lerp(indoor ? 3.6 : 4.8, 2.4, aim) + (HERO.gliding ? 1.6 : 0) + (Math.hypot(P.vx, P.vz) > 8 ? 0.5 : 0);
  _cf.set(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
  _cr.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  const pivotY = P.y + (P.crouch > 0.5 ? 1.45 : 1.95) + HERO.cur.hipsY * 0.5;
  CAMR.pivot = CAMR.pivot || new THREE.Vector3(P.x, pivotY, P.z);
  CAMR.pivot.x = P.x; CAMR.pivot.z = P.z; CAMR.pivot.y = damp(CAMR.pivot.y, pivotY, 12, dt);
  _cp.copy(CAMR.pivot).addScaledVector(_cr, lerp(CAMR.side, 0.75, aim) * clamp(CAMR.cur / 3.5, 0.35, 1));
  // the shoulder offset must not push the pivot into a wall
  if (camBlocked(_cp)) _cp.copy(CAMR.pivot);
  let free = want;
  for (let d = 0.5; d <= want; d += 0.22) {
    _tp.copy(_cp).addScaledVector(_cf, -d);
    if (camBlocked(_tp)) { free = Math.max(0.35, d - 0.32); break; }
  }
  CAMR.cur = free < CAMR.cur ? damp(CAMR.cur, free, 30, dt) : damp(CAMR.cur, free, 3.5, dt);
  const sh = FX.shake * 0.06;
  camera.position.copy(_cp).addScaledVector(_cf, -CAMR.cur);
  camera.position.x += Math.sin(t * 37) * sh; camera.position.y += Math.sin(t * 41) * sh; camera.position.z += Math.cos(t * 33) * sh;
  camera.rotation.set(P.pitch, P.yaw, 0);
  // fade the hero out when the camera squeezes in close
  HERO.rig.root.visible = CAMR.cur > 0.8;
}
