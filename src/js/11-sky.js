// ============================================================ time of day and weather
// SKY.day: 0 = night, 1 = day (eased towards dayTarget). SKY.rain: 0..1 rain amount, SKY.storm: lightning.
const SKY = { day: 0, dayTarget: 0, rain: 0, rainTarget: 0, storm: 0, stormTarget: 0, weather: 'storm' };
const SUN_DIR = new THREE.Vector3(-0.42, 0.68, 0.6).normalize();
const LIGHT_DIR = MOON_DIR.clone();
U.day = { value: 0 };
U.rain = { value: 0 };
U.lightDir = { value: LIGHT_DIR };
try {
  const t = localStorage.getItem('nomanisan.time'); if (t) SKY.day = SKY.dayTarget = t === 'day' ? 1 : 0;
  const w = localStorage.getItem('nomanisan.weather'); if (w) SKY.weather = w;
} catch (e) { /* storage blocked */ }

const LOOK = {
  night: { light: new THREE.Color(0x87a5ff), li: 1.3, sky: new THREE.Color(0x30507f), gnd: new THREE.Color(0x14181a), hi: 0.9, fog: new THREE.Color(0x1a2c48), fd: 0.0029, exp: 1.45, bloom: [0.7, 0.6, 0.86] },
  day: { light: new THREE.Color(0xfff0d8), li: 3.0, sky: new THREE.Color(0x9cc4ff), gnd: new THREE.Color(0x5c5442), hi: 1.15, fog: new THREE.Color(0xa4bdd2), fd: 0.0015, exp: 0.92, bloom: [0.32, 0.45, 0.96] },
};
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function setWeather(w) {
  SKY.weather = w;
  SKY.rainTarget = w === 'clear' ? 0 : w === 'rain' ? 0.75 : 1;
  SKY.stormTarget = w === 'storm' ? 1 : 0;
  try { localStorage.setItem('nomanisan.weather', w); } catch (e) { /* storage blocked */ }
}
function setTimeOfDay(day) {
  SKY.dayTarget = day ? 1 : 0;
  try { localStorage.setItem('nomanisan.time', day ? 'day' : 'night'); } catch (e) { /* storage blocked */ }
}
setWeather(SKY.weather);
SKY.rain = SKY.rainTarget; SKY.storm = SKY.stormTarget;

// called every frame with k = how far indoors the camera is (0..1)
function updateSky(dt, k) {
  SKY.day = damp(SKY.day, SKY.dayTarget, 1.4, dt);
  if (Math.abs(SKY.day - SKY.dayTarget) < 0.002) SKY.day = SKY.dayTarget;
  SKY.rain = damp(SKY.rain, SKY.rainTarget, 0.8, dt);
  SKY.storm = damp(SKY.storm, SKY.stormTarget, 0.8, dt);
  const d = smoothstep(0, 1, SKY.day), r = SKY.rain;
  U.day.value = d; U.rain.value = r;
  LIGHT_DIR.copy(MOON_DIR).lerp(SUN_DIR, d).normalize();
  const N = LOOK.night, D = LOOK.day;
  const overcast = 1 - r * lerp(0.2, 0.45, d);
  moon.color.copy(N.light).lerp(D.light, d);
  moon.intensity = lerp(N.li, D.li, d) * overcast * (1 - k);
  hemi.color.copy(N.sky).lerp(D.sky, d).lerp(_c1.setRGB(0.42, 0.45, 0.5), r * 0.35 * d);
  hemi.groundColor.copy(N.gnd).lerp(D.gnd, d);
  hemi.intensity = lerp(N.hi, D.hi, d) * lerp(1, 0.05, k);
  ambientIn.intensity = lerp(0, 0.18, k);
  _c2.copy(N.fog).lerp(D.fog, d).lerp(_c1.setRGB(lerp(0.09, 0.42, d), lerp(0.11, 0.44, d), lerp(0.14, 0.47, d)), r * 0.55);
  scene.fog.color.copy(_c2).lerp(FOG_IN, k);
  scene.fog.density = lerp(lerp(N.fd, D.fd, d) * (1 + r * 0.9), 0.011, k);
  renderer.toneMappingExposure = lerp(N.exp, D.exp, d) * lerp(1, 1.08, k);
  bloomPass.strength = lerp(N.bloom[0], D.bloom[0], d) * lerp(1, 1.1, k);
  bloomPass.radius = lerp(N.bloom[1], D.bloom[1], d);
  bloomPass.threshold = lerp(N.bloom[2], D.bloom[2], d);
  M.lamp.emissiveIntensity = 4 * (1 - 0.85 * d);
  rainMesh && (rainMesh.visible = r > 0.02 && k < 0.6);
  if (rainMesh) { rainMat.uniforms.uCam.value.copy(camera.position); rainMat.uniforms.uRain.value = r * (1 - k); }
  if (bolt.life > 0) { bolt.life -= dt; bolt.mesh.visible = bolt.life > 0 && (bolt.life * 30) % 2 > 0.6; }
}

// ---- rain: streaks wrapped around the camera entirely on the GPU
let rainMesh = null, rainMat = null;
function buildRain() {
  const N = 7000, seed = new Float32Array(N * 2 * 3), end = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const s = [rng() * 60, rng() * 60, rng()];
    seed.set(s, i * 6); seed.set(s, i * 6 + 3);
    end[i * 2] = 0; end[i * 2 + 1] = 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: U.time, uCam: { value: new THREE.Vector3() }, uRain: { value: 0 }, uDay: U.day },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed; attribute float aEnd; uniform float uTime, uRain; uniform vec3 uCam; varying float vA;
      void main(){
        float R = 30.0, Hh = 34.0;
        float x = uCam.x + mod(aSeed.x - uCam.x, 2.0 * R) - R;
        float z = uCam.z + mod(aSeed.y - uCam.z, 2.0 * R) - R;
        float y = uCam.y + Hh * 0.55 - mod(uTime * 21.0 + aSeed.z * Hh * 7.0, Hh);
        vec3 p = vec3(x, y, z) + aEnd * vec3(0.35, -1.1, 0.12);
        float on = step(fract(aSeed.z * 13.37), uRain);
        float d = length(p.xz - uCam.xz);
        vA = on * smoothstep(30.0, 6.0, d) * smoothstep(1.8, 6.0, length(p - uCam)) * (0.35 + 0.65 * aEnd);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `uniform float uDay; varying float vA;
      void main(){ gl_FragColor = vec4(mix(vec3(0.55, 0.62, 0.75), vec3(0.75, 0.78, 0.82), uDay), vA * 0.3); }`,
  });
  rainMesh = new THREE.LineSegments(g, rainMat);
  rainMesh.frustumCulled = false;
  rainMesh.renderOrder = 6;
  scene.add(rainMesh);
}

// ---- lightning bolts (storm)
const bolt = { mesh: null, life: 0 };
function strikeBolt(tx, tz) {
  const pts = [];
  const top = new THREE.Vector3(tx + rr(-60, 60), 420, tz + rr(-60, 60));
  const gy = Math.max(terrainHeight(tx, tz), 0);
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const p = new THREE.Vector3(lerp(top.x, tx, f), lerp(top.y, gy, f), lerp(top.z, tz, f));
    if (i > 0 && i < n) { p.x += rr(-14, 14) * (1 - f * 0.5); p.z += rr(-14, 14) * (1 - f * 0.5); }
    pts.push(p);
  }
  const segs = [];
  for (let i = 0; i < n; i++) segs.push(pts[i], pts[i + 1]);
  for (let b = 0; b < 3; b++) {   // a few side branches
    let p = pts[3 + Math.floor(rng() * 10)].clone();
    for (let k = 0; k < 4; k++) { const q = p.clone().add(new THREE.Vector3(rr(-18, 18), -rr(10, 25), rr(-18, 18))); segs.push(p, q); p = q; }
  }
  if (bolt.mesh) { scene.remove(bolt.mesh); bolt.mesh.geometry.dispose(); bolt.mesh.material.dispose(); }
  bolt.mesh = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segs), new THREE.LineBasicMaterial({ color: new THREE.Color(6, 6, 9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  bolt.mesh.frustumCulled = false;
  scene.add(bolt.mesh);
  bolt.life = 0.35;
  return { x: tx, y: gy, z: tz };
}
