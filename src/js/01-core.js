import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ============================================================ small helpers
const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20041105);
const rr = (a, b) => a + (b - a) * rng();
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================ simplex noise (2D + 3D)
const perm = new Uint8Array(512), permMod12 = new Uint8Array(512);
(() => {
  const p = new Uint8Array(256); for (let i = 0; i < 256; i++) p[i] = i;
  const r = mulberry32(42);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; permMod12[i] = perm[i] % 12; }
})();
const grad3 = new Float32Array([1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1]);
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
function noise2(xin, yin) {
  let n0 = 0, n1 = 0, n2 = 0;
  const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s);
  const t = (i + j) * G2, x0 = xin - (i - t), y0 = yin - (j - t);
  const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  const ii = i & 255, jj = j & 255;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) { const g = permMod12[ii + perm[jj]] * 3; t0 *= t0; n0 = t0 * t0 * (grad3[g] * x0 + grad3[g + 1] * y0); }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) { const g = permMod12[ii + i1 + perm[jj + j1]] * 3; t1 *= t1; n1 = t1 * t1 * (grad3[g] * x1 + grad3[g + 1] * y1); }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) { const g = permMod12[ii + 1 + perm[jj + 1]] * 3; t2 *= t2; n2 = t2 * t2 * (grad3[g] * x2 + grad3[g + 1] * y2); }
  return 70 * (n0 + n1 + n2);
}
function noise3(xin, yin, zin) {
  const F3 = 1 / 3, G3 = 1 / 6;
  let n0 = 0, n1 = 0, n2 = 0, n3 = 0;
  const s = (xin + yin + zin) * F3;
  const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
  const t = (i + j + k) * G3;
  const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
  let i1, j1, k1, i2, j2, k2;
  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }
  const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
  const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
  const ii = i & 255, jj = j & 255, kk = k & 255;
  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t0 > 0) { const g = permMod12[ii + perm[jj + perm[kk]]] * 3; t0 *= t0; n0 = t0 * t0 * (grad3[g] * x0 + grad3[g + 1] * y0 + grad3[g + 2] * z0); }
  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t1 > 0) { const g = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; t1 *= t1; n1 = t1 * t1 * (grad3[g] * x1 + grad3[g + 1] * y1 + grad3[g + 2] * z1); }
  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t2 > 0) { const g = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; t2 *= t2; n2 = t2 * t2 * (grad3[g] * x2 + grad3[g + 1] * y2 + grad3[g + 2] * z2); }
  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t3 > 0) { const g = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; t3 *= t3; n3 = t3 * t3 * (grad3[g] * x3 + grad3[g + 1] * y3 + grad3[g + 2] * z3); }
  return 32 * (n0 + n1 + n2 + n3);
}
function fbm2(x, y, oct = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}

// ============================================================ renderer, scene, camera
let QUALITY = 'high';
try { QUALITY = localStorage.getItem('nomanisan.quality') || 'high'; } catch (e) { /* storage blocked */ }
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
const pixelRatio = () => Math.min(window.devicePixelRatio || 1, QUALITY === 'high' ? 1.5 : 1);
renderer.setPixelRatio(pixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.08, 6000);
camera.rotation.order = 'YXZ';
scene.add(camera);
const FOG_OUT = new THREE.Color(0x14243a), FOG_IN = new THREE.Color(0x120c09);
scene.fog = new THREE.FogExp2(FOG_OUT.getHex(), 0.0045);

const U = { time: { value: 0 }, flash: { value: 0 }, power: { value: 0 } };
const MOON_DIR = new THREE.Vector3(-0.35, 0.5, -0.8).normalize();

// Shared GLSL helpers for every custom shader.
const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1.0,0.0)), u.x), mix(hash12(i+vec2(0.0,1.0)), hash12(i+vec2(1.0,1.0)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 5; i++){ s += a*vnoise(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
// distance to the nearest cell border of a jittered grid: small along cracks
float cellEdge(vec2 p){ vec2 n = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(float(i), float(j)); vec2 r = g + hash22(n + g) * 0.85 - f; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return sqrt(d2) - sqrt(d1); }
float fbm3o(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 3; i++){ s += a*vnoise(p); p = p*2.07 + vec2(5.3, 1.1); a *= 0.5; } return s; }
`;

// Height fog with moon scattering and a warm tint where lava lights the haze.
// Replaces three's fog chunks for every built-in material.
const GLSL_FOG = /* glsl */ `
vec3 applyFog(vec3 col, vec3 wp){
  vec3 ray = wp - cameraPosition; float dist = length(ray); vec3 rd = ray / max(dist, 1e-3);
  float k = 0.028; float y0 = cameraPosition.y; float dy = wp.y - y0;
  float base = exp(-k * clamp(y0 - 2.0, -20.0, 400.0));
  float integ = abs(dy) > 0.05 ? base * (1.0 - exp(-k * dy)) / (k * dy) : base;
  float amount = fogDensity * dist * (min(integ, 4.0) + 0.17);
  float f = 1.0 - exp(-amount);
  vec3 fc = fogColor;
  float m = max(dot(rd, vec3(${MOON_DIR.x.toFixed(4)}, ${MOON_DIR.y.toFixed(4)}, ${MOON_DIR.z.toFixed(4)})), 0.0);
  fc += vec3(0.02, 0.03, 0.045) * pow(m, 8.0);
  float g = exp(-distance(wp, vec3(0.0, 150.0, -100.0)) / 80.0) * 0.8
          + exp(-distance(wp, vec3(125.0, 128.0, -45.0)) / 60.0) * 1.4
          + exp(-distance(wp, vec3(215.0, 20.0, 0.0)) / 70.0) * 0.5
          + exp(-distance(wp, vec3(300.0, 6.0, 30.0)) / 55.0) * 0.6;
  fc += vec3(0.62, 0.17, 0.035) * g;
  return mix(col, fc, f);
}`;
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\nvarying vec3 vFogWorld;\n#endif';
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
{ vec4 fogW = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  fogW = instanceMatrix * fogW;
#endif
  fogW = modelMatrix * fogW; vFogWorld = fogW.xyz; }
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor; uniform float fogDensity; varying vec3 vFogWorld;
${GLSL_FOG}
#endif`;
THREE.ShaderChunk.fog_fragment = '#ifdef USE_FOG\ngl_FragColor.rgb = applyFog(gl_FragColor.rgb, vFogWorld);\n#endif';

// ============================================================ post processing
const composerTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, composerTarget);
composer.setPixelRatio(pixelRatio());
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.6, 0.85);
composer.addPass(bloomPass);
const gradePass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uWarm: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uWarm; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      vec3 coolShadow = c * vec3(0.82, 1.0, 1.18);
      c = mix(c, coolShadow, 0.45 * (1.0 - smoothstep(0.0, 0.3, l)));
      c = mix(c, c * vec3(1.08, 0.98, 0.9), smoothstep(0.4, 2.0, l) * 0.5 + uWarm * 0.2);
      c += vec3(0.0025, 0.0045, 0.0085);
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(gradePass);
composer.addPass(new OutputPass());
const finalPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 1 }, uFreeze: { value: 0 }, uAlarm: { value: 0 },
    uZoom: { value: 0 }, uAspect: { value: 1 }, uHit: { value: 0 }, uHeat: { value: 0 }, uScan: { value: 0 }, uScanT: { value: 9 }, uPx: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uFade, uFreeze, uAlarm, uZoom, uAspect, uHit, uHeat, uScan, uScanT; uniform vec2 uPx; varying vec2 vUv;
    float lum(vec2 p){ return dot(texture2D(tDiffuse, p).rgb, vec3(0.3, 0.55, 0.15)); }
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv; vec2 cc = uv - 0.5;
      if (uFreeze > 0.0) uv += vec2(sin(uv.y * 40.0 + uTime * 6.0), cos(uv.x * 30.0 + uTime * 5.0)) * 0.004 * uFreeze;
      if (uHeat > 0.0) uv += vec2(sin(uv.y * 60.0 + uTime * 9.0) * 0.0015, 0.0) * uHeat;
      float ca = 0.0018 + uHit * 0.01;
      vec3 c;
      c.r = texture2D(tDiffuse, uv + cc * ca).r;
      c.g = texture2D(tDiffuse, uv).g;
      c.b = texture2D(tDiffuse, uv - cc * ca).b;
      float v = smoothstep(1.05, 0.25, length(cc * vec2(1.0, 0.85)) * 1.25);
      c *= mix(0.55, 1.0, v);
      if (uAlarm > 0.0) { float p = 0.5 + 0.5 * sin(uTime * 7.0); c = mix(c, c * vec3(1.35, 0.45, 0.4) + vec3(0.06, 0.0, 0.0), uAlarm * (0.35 + 0.35 * p)); }
      if (uFreeze > 0.0) {
        float l = dot(c, vec3(0.3, 0.55, 0.15));
        vec3 z = vec3(0.45, 0.8, 1.0) * (l * 1.3 + 0.15) + vec3(0.6, 0.9, 1.0) * pow(0.5 + 0.5 * sin(uv.y * 90.0 - uTime * 12.0), 12.0) * 0.25;
        c = mix(c, z, clamp(uFreeze, 0.0, 1.0) * 0.85);
      }
      if (uScan > 0.0) {
        // detective vision: the world drops to a blue wireframe, saturated highlights keep their colour
        float gx = lum(uv + vec2(uPx.x, 0.0)) - lum(uv - vec2(uPx.x, 0.0));
        float gy = lum(uv + vec2(0.0, uPx.y)) - lum(uv - vec2(0.0, uPx.y));
        float e = clamp(length(vec2(gx, gy)) * 4.0, 0.0, 1.0);
        float l = dot(c, vec3(0.3, 0.55, 0.15));
        float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
        float sat = (mx - mn) / (mx + 0.001) * smoothstep(0.18, 0.5, mx);
        vec2 q = cc * vec2(uAspect, 1.0);
        float ring = smoothstep(0.035, 0.0, abs(length(q) - uScanT * 1.6)) * smoothstep(1.2, 0.2, uScanT);
        vec3 s = vec3(0.05, 0.16, 0.3) + vec3(0.12, 0.42, 0.75) * l * 1.6 + vec3(0.45, 0.85, 1.0) * e * 1.2;
        s += vec3(0.4, 0.9, 1.0) * ring * 0.8;
        s += vec3(0.25, 0.6, 0.9) * pow(0.5 + 0.5 * sin(uv.y * 520.0), 8.0) * 0.06;
        c = mix(c, s, uScan * (1.0 - sat * 0.85));
        c *= mix(1.0, smoothstep(1.25, 0.35, length(q)) * 0.6 + 0.55, uScan);
      }
      if (uZoom > 0.0) {
        vec2 q = cc * vec2(uAspect, 1.0);
        float m = max(smoothstep(0.36, 0.34, length(q - vec2(-0.2, 0.0))), smoothstep(0.36, 0.34, length(q - vec2(0.2, 0.0))));
        c = mix(c, c * m, uZoom);
      }
      c += (h(uv * 900.0 + fract(uTime * 7.13)) - 0.5) * 0.04;
      c *= 1.0 - uFade;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(finalPass);

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio()); renderer.setSize(w, h);
  composer.setPixelRatio(pixelRatio()); composer.setSize(w, h);
  finalPass.uniforms.uAspect.value = w / h;
  finalPass.uniforms.uPx.value.set(1 / (w * renderer.getPixelRatio()), 1 / (h * renderer.getPixelRatio()));
}
window.addEventListener('resize', onResize);
finalPass.uniforms.uAspect.value = window.innerWidth / window.innerHeight;

// ============================================================ lights
const moon = new THREE.DirectionalLight(0xa9c2ff, 0.85);
moon.castShadow = true;
moon.shadow.mapSize.set(QUALITY === 'high' ? 2048 : 1024, QUALITY === 'high' ? 2048 : 1024);
Object.assign(moon.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: 1, far: 900 });
moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.35;
scene.add(moon, moon.target);
const hemi = new THREE.HemisphereLight(0x29406a, 0x0a0c0a, 0.55);
scene.add(hemi);
const ambientIn = new THREE.AmbientLight(0xffb27a, 0.0);
scene.add(ambientIn);

// The world has hundreds of lamps and lava glows; only the most important few near the camera get a real light.
const lightAnchors = [];
let LIGHT_ZONE = 'out';   // lights built inside the mountain only shine when the camera is inside, and vice versa
function addLight(x, y, z, color, intensity, distance, opts = {}) {
  const a = { pos: new THREE.Vector3(x, y, z), color: new THREE.Color(color), intensity, distance, flicker: opts.flicker || 0, zone: opts.zone || LIGHT_ZONE,
    phase: rng() * 100, on: opts.on || null, lamp: !!opts.lamp, mat: opts.mat || null, matBase: opts.mat ? opts.mat.emissiveIntensity : 0, k: 1 };
  lightAnchors.push(a);
  return a;
}
const POOL_N = 10;
const lightPool = [];
for (let i = 0; i < POOL_N; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); scene.add(l); lightPool.push(l); }
function flickerValue(a, t) {
  if (a.flicker === 1) return 0.82 + 0.18 * Math.sin(t * 7.1 + a.phase) * Math.sin(t * 3.3 + a.phase * 1.7);
  if (a.flicker === 2) { const n = Math.sin(t * 11.0 + a.phase) * Math.sin(t * 6.7 + a.phase * 1.3) * Math.sin(t * 1.9 + a.phase); return n > 0.22 ? 0.08 : 1; }
  if (a.flicker === 3) return 0.6 + 0.4 * Math.max(0, Math.sin(t * 2.2 + a.phase));
  return 1;
}
const _cand = [];
function updateLightPool(t, camPos, kIn = 0) {
  _cand.length = 0;
  for (const a of lightAnchors) {
    const on = a.on ? a.on() : true;
    a.k = on ? flickerValue(a, t) * (a.lamp ? 1 - 0.9 * U.day.value : 1) : 0;
    if (a.mat) a.mat.emissiveIntensity = a.matBase * a.k;
    if (!on) continue;
    const zk = a.zone === 'in' ? kIn : a.zone === 'out' ? 1 - kIn : 1;
    if (zk < 0.02) continue;
    a.zk = zk;
    const d2 = a.pos.distanceToSquared(camPos);
    const reach = a.distance * 1.5 + 30;
    if (d2 > reach * reach) continue;
    a.fade = smoothstep(reach, reach * 0.7, Math.sqrt(d2));
    _cand.push(a);
    a.score = (a.intensity * a.distance) / (d2 + 30);
  }
  _cand.sort((p, q) => q.score - p.score);
  for (let i = 0; i < POOL_N; i++) {
    const l = lightPool[i], a = _cand[i];
    if (!a) { l.intensity = 0; continue; }
    l.position.copy(a.pos); l.color.copy(a.color); l.distance = a.distance;
    l.intensity = a.intensity * a.k * a.fade * a.zk;
  }
}

// ============================================================ collision world
// Obstacles block sideways movement. Floors (terrain, rooms, decks, lifts) hold the player up.
const obstacles = [];
const OBS_CELL = 12;
const obsGrid = new Map();
function obsKey(cx, cz) { return cx * 73856093 ^ cz * 19349663; }
function registerObstacle(o, x0, x1, z0, z1) {
  obstacles.push(o);
  const c0 = Math.floor((x0 - 1) / OBS_CELL), c1 = Math.floor((x1 + 1) / OBS_CELL);
  const d0 = Math.floor((z0 - 1) / OBS_CELL), d1 = Math.floor((z1 + 1) / OBS_CELL);
  for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) {
    const k = obsKey(cx, cz); let list = obsGrid.get(k); if (!list) obsGrid.set(k, (list = [])); list.push(o);
  }
  return o;
}
function addCircleObs(x, z, r, y0, y1, extra) {
  return registerObstacle(Object.assign({ t: 'c', x, z, r, y0, y1 }, extra), x - r, x + r, z - r, z + r);
}
function addBoxObs(x, z, hx, hz, rot, y0, y1, extra) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const ex = Math.abs(c) * hx + Math.abs(s) * hz, ez = Math.abs(s) * hx + Math.abs(c) * hz;
  return registerObstacle(Object.assign({ t: 'b', x, z, hx, hz, c, s, y0, y1 }, extra), x - ex, x + ex, z - ez, z + ez);
}
function obstaclesNear(x, z) { return obsGrid.get(obsKey(Math.floor(x / OBS_CELL), Math.floor(z / OBS_CELL))) || []; }

const floors = [];
function addFloor(f) {
  f.enabled = f.enabled || null;
  floors.push(f);
  return f;
}
function floorBox(x0, x1, z0, z1, y, opts = {}) {
  return addFloor(Object.assign({ x0, x1, z0, z1, contains: (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1, y: () => y }, opts));
}
// Ramp along an axis: y0 at the low end of that axis, y1 at the high end.
function floorRamp(x0, x1, z0, z1, axis, y0, y1, opts = {}) {
  const a0 = axis === 'x' ? x0 : z0, a1 = axis === 'x' ? x1 : z1;
  return addFloor(Object.assign({ x0, x1, z0, z1, contains: (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1,
    y: (x, z) => lerp(y0, y1, clamp(((axis === 'x' ? x : z) - a0) / (a1 - a0), 0, 1)) }, opts));
}
function floorCircle(cx, cz, r, y, opts = {}) {
  return addFloor(Object.assign({ x0: cx - r, x1: cx + r, z0: cz - r, z1: cz + r, contains: (x, z) => (x - cx) ** 2 + (z - cz) ** 2 <= r * r, y: () => y }, opts));
}
function floorAnnulus(cx, cz, r0, r1, y, gaps = [], opts = {}) {
  return addFloor(Object.assign({ x0: cx - r1, x1: cx + r1, z0: cz - r1, z1: cz + r1, y: () => y,
    contains: (x, z) => {
      const d2 = (x - cx) ** 2 + (z - cz) ** 2; if (d2 < r0 * r0 || d2 > r1 * r1) return false;
      const a = Math.atan2(z - cz, x - cx);
      for (const g of gaps) if (Math.abs(wrapAngle(a - g[0])) < g[1]) return false;
      return true;
    } }, opts));
}
// A walkable strip along a polyline of {x, z, y} points.
function floorPath(pts, halfW, opts = {}) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x - halfW); x1 = Math.max(x1, p.x + halfW); z0 = Math.min(z0, p.z - halfW); z1 = Math.max(z1, p.z + halfW); }
  const near = (x, z) => {
    let best = Infinity, by = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], abx = b.x - a.x, abz = b.z - a.z;
      const t = clamp(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz), 0, 1);
      const d = Math.hypot(x - a.x - abx * t, z - a.z - abz * t);
      if (d < best) { best = d; by = a.y + (b.y - a.y) * t; }
    }
    return [best, by];
  };
  return addFloor(Object.assign({ x0, x1, z0, z1, contains: (x, z) => near(x, z)[0] <= halfW, y: (x, z) => near(x, z)[1] }, opts));
}
// Oriented rectangle, yaw = rotation of its length axis (local +z) about Y, with y rising from y0 (back) to y1 (front).
function floorOBB(cx, cz, hw, hl, yaw, y0, y1, opts = {}) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const ex = Math.abs(c) * hw + Math.abs(s) * hl, ez = Math.abs(s) * hw + Math.abs(c) * hl;
  const local = (x, z) => { const dx = x - cx, dz = z - cz; return [dx * c - dz * s, dx * s + dz * c]; };
  return addFloor(Object.assign({ x0: cx - ex, x1: cx + ex, z0: cz - ez, z1: cz + ez,
    contains: (x, z) => { const [lx, lz] = local(x, z); return Math.abs(lx) <= hw && Math.abs(lz) <= hl; },
    y: (x, z) => lerp(y0, y1, clamp((local(x, z)[1] + hl) / (2 * hl), 0, 1)) }, opts));
}

// ============================================================ input
const keys = Object.create(null);
const input = { locked: false, dragging: false, dx: 0, dy: 0, sens: 0.0021, invert: false, lastX: 0, lastY: 0 };
try { const s = parseFloat(localStorage.getItem('nomanisan.sens')); if (s > 0) input.sens = s; } catch (e) { /* storage blocked */ }

// ============================================================ textures & materials
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  return t;
}
function speckle(g, w, h, n, colors, rmin, rmax, alpha = 1) {
  for (let i = 0; i < n; i++) {
    const x = rng() * w, y = rng() * h, r = rr(rmin, rmax);
    g.globalAlpha = alpha * rr(0.4, 1); g.fillStyle = pick(colors);
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, TAU); g.fill(); }
  }
  g.globalAlpha = 1;
}
const M = {};
let envTex = null;
function initMaterials() {
  // A tiny night environment so metals and glass have something to reflect.
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; void main(){ float y = vP.y;
      vec3 c = mix(vec3(0.05, 0.05, 0.06), vec3(0.03, 0.05, 0.1), smoothstep(-0.2, 0.8, y));
      c += vec3(1.2, 0.35, 0.08) * pow(max(dot(vP, normalize(vec3(0.6, -0.1, 0.4))), 0.0), 8.0);
      c += vec3(0.9, 0.85, 0.7) * pow(max(dot(vP, normalize(vec3(-0.3, 0.9, 0.2))), 0.0), 40.0) * 2.0;
      gl_FragColor = vec4(c, 1.0); }`,
  })));
  envTex = pm.fromScene(envScene, 0.02).texture;

  const concreteTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#bdb6a8'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 900, ['#a9a294', '#c9c2b4', '#9e978a', '#d2ccbf'], 0.4, 1.6, 0.6);
    speckle(g, w, h, 14, ['#8f887c', '#b0a99b'], 10, 30, 0.12);
    g.strokeStyle = 'rgba(80,74,66,0.35)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
  });
  const terrazzoTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e6dfd2'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 520, ['#7d7468', '#b6ab9a', '#3d3a37', '#c4562f', '#a9a090', '#8c8d86'], 0.8, 3.2, 0.9);
  });
  const woodTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6b3f22'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(${40 + rng() * 30},${18 + rng() * 14},${8},${0.25 + rng() * 0.3})`; g.fillRect(x, 0, 1 + rng() * 2, h); }
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(20,10,5,0.6)'; g.fillRect(x, 0, 2, h); }
  });
  const rockTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4a4542'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1400, ['#3a3532', '#575250', '#2e2a28', '#625c58'], 0.6, 2.6, 0.7);
    speckle(g, w, h, 40, ['#2a2624', '#5a524c'], 8, 22, 0.2);
  });
  const metalPanelTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8e939a'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 300, ['#80858c', '#9ba0a7'], 0.5, 1.5, 0.5);
    g.strokeStyle = 'rgba(30,32,36,0.8)'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
    g.fillStyle = 'rgba(30,32,36,0.8)';
    for (const [x, y] of [[12, 12], [w - 12, 12], [12, h - 12], [w - 12, h - 12]]) { g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); }
  });
  const std = (o) => new THREE.MeshStandardMaterial(o);
  M.concrete = std({ map: concreteTex, color: 0xe2dccf, roughness: 0.92 });
  M.concreteDark = std({ map: concreteTex, color: 0x77716a, roughness: 0.95 });
  M.terrazzo = std({ map: terrazzoTex, color: 0xffffff, roughness: 0.28, envMap: envTex, envMapIntensity: 0.6 });
  M.wood = std({ map: woodTex, color: 0xffffff, roughness: 0.55, envMap: envTex, envMapIntensity: 0.3 });
  M.metal = std({ color: 0xa5abb2, metalness: 0.85, roughness: 0.32, envMap: envTex, envMapIntensity: 1.0 });
  M.metalPanel = std({ map: metalPanelTex, color: 0xffffff, metalness: 0.6, roughness: 0.45, envMap: envTex, envMapIntensity: 0.8 });
  M.darkMetal = std({ color: 0x2b2e33, metalness: 0.7, roughness: 0.45, envMap: envTex, envMapIntensity: 0.8 });
  M.black = std({ color: 0x0f1012, roughness: 0.28, envMap: envTex, envMapIntensity: 0.7 });
  M.red = std({ color: 0xa3241b, roughness: 0.45, envMap: envTex, envMapIntensity: 0.4 });
  M.white = std({ color: 0xe9e5db, roughness: 0.5, envMap: envTex, envMapIntensity: 0.4 });
  M.orange = std({ color: 0xd2621f, roughness: 0.5 });
  M.rock = std({ map: rockTex, color: 0x7d7672, roughness: 0.96 });
  M.rockDark = std({ map: rockTex, color: 0x3e3936, roughness: 0.97 });
  M.glass = std({ color: 0x9fc0d8, transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0.1, envMap: envTex, envMapIntensity: 0.6, depthWrite: false });
  M.glassDark = std({ color: 0x182028, transparent: true, opacity: 0.55, roughness: 0.05, envMap: envTex, envMapIntensity: 1.2, depthWrite: false });
  const glow = (c, i) => std({ color: 0x000000, emissive: c, emissiveIntensity: i, roughness: 1 });
  M.lamp = glow(0xffc27a, 4.0);
  M.lampCool = glow(0xdde9ff, 3.0);
  M.redGlow = glow(0xff2a18, 5.0);
  M.greenGlow = glow(0x3dff8a, 3.0);
  M.tealGlow = glow(0x3fe0c5, 2.4);
  M.blueGlow = glow(0x79c6ff, 4.0);
  M.amberGlow = glow(0xffa21f, 3.5);
  M.whiteGlow = glow(0xfff1dc, 3.2);
  M.lavaGlow = glow(0xff5a12, 6.0);
}

// ============================================================ geometry helpers
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  if (opts.rx) m.rotation.x = opts.rx;
  if (opts.rz) m.rotation.z = opts.rz;
  if (opts.scale) m.scale.setScalar(opts.scale);
  m.castShadow = !!opts.cast;
  m.receiveShadow = opts.receive !== false;
  parent.add(m);
  return m;
}
// Box with its base centred at (x, y, z); optionally registers a collision box.
function box(w, h, d, mat, x, y, z, opts = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (opts.uvScale) scaleBoxUV(g, w, h, d, opts.uvScale);
  const m = mesh(g, mat, x, y + h / 2, z, opts.parent || scene, opts);
  if (opts.collide) addBoxObs(x, z, w / 2, d / 2, -(opts.ry || 0), y + (opts.collideY0 || 0), y + h);
  return m;
}
function cyl(rt, rb, h, mat, x, y, z, opts = {}) {
  const g = new THREE.CylinderGeometry(rt, rb, h, opts.seg || 16, 1, !!opts.open);
  const m = mesh(g, mat, x, y + h / 2, z, opts.parent || scene, opts);
  if (opts.collide) addCircleObs(x, z, Math.max(rt, rb), y, y + h);
  return m;
}
// Cylinder between two points (radius r at a, r2 at b)
function rod(a, b, r, mat, parent = scene, r2 = r) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, L, 8), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true; parent.add(m);
  return m;
}
// Make box UVs tile by world size so textures keep their scale on long walls.
function scaleBoxUV(g, w, h, d, s) {
  const uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const su = nx > 0.5 ? d : w, sv = ny > 0.5 ? d : h;
    uv.setXY(i, uv.getX(i) * su / s, uv.getY(i) * sv / s);
  }
}
// Sweep a 2D profile [[x, y], ...] along points with a fixed up axis. Returns a BufferGeometry with uv (u across, v along in metres).
function sweepProfile(pts, profile, closed = false) {
  const pos = [], uv = [], idx = [];
  let dist = 0;
  const pl = profile.length;
  const plen = []; let acc = 0;
  for (let j = 0; j < pl; j++) { plen.push(acc); if (j < pl - 1) acc += Math.hypot(profile[j + 1][0] - profile[j][0], profile[j + 1][1] - profile[j][1]); }
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
    let tx = b.x - a.x, tz = b.z - a.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const nx = -tz, nz = tx; // side vector
    if (i > 0) dist += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y, p.z - pts[i - 1].z);
    for (let j = 0; j < pl; j++) {
      const [px, py] = profile[j];
      pos.push(p.x + nx * px, p.y + py, p.z + nz * px);
      uv.push(plen[j], dist);
    }
  }
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < pl - 1; j++) {
    const a = i * pl + j, b = (i + 1) * pl + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Resample a polyline (with y) to even spacing using Catmull-Rom smoothing.
function smoothPath(ctrl, spacing = 3) {
  const v3 = ctrl.map((p) => new THREE.Vector3(p.x, p.y || 0, p.z));
  const curve = new THREE.CatmullRomCurve3(v3, false, 'centripetal');
  const n = Math.max(2, Math.ceil(curve.getLength() / spacing));
  return curve.getSpacedPoints(n).map((v) => ({ x: v.x, y: v.y, z: v.z }));
}
function pathLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); return L; }
