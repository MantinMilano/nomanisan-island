// ============================================================ the mask scanner: x-ray "detective vision"
// Hold the world in a blue wireframe view; clues, enemies, devices, breakable walls and echo shards light up through rock.
// Point the centre of the screen at a clue to analyze it. Hold E on a security device to hack it.
const SCAN = { on: false, k: 0, items: [], focus: null, prog: 0, hackHeld: false, t: 0, range: 80, markers: [], ghosts: [] };
U.scan = { value: 0 };
const SCAN_COLORS = { clue: '#ffd36b', objective: '#3dff8a', security: '#ff5a3c', enemy: '#ff3b30', breakable: '#ff9a40', shard: '#c49bff', secret: '#8fd6ff', path: '#63e6cd' };
const SCAN_LABELS = { clue: 'Clue', objective: 'Objective', security: 'Security', enemy: 'Hostile', breakable: 'Breakable', shard: 'Echo shard', secret: 'Secret', path: 'Hidden path' };
// o: { kind, label, pos(): Vector3, when?(), analyze?: { time, done() }, hack?(), room?, info? }
function addScannable(o) { o.done = false; SCAN.items.push(o); return o; }
function removeScannable(o) { const i = SCAN.items.indexOf(o); if (i >= 0) SCAN.items.splice(i, 1); }

// A mesh only seen through the scanner (scorch marks, hidden ledges, cracks): fades in with the scan.
function scanOnlyMaterial(color, strength = 1) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uScan: U.scan, uTime: U.time, uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uScan, uTime, uStrength; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        vec2 c = vUv - 0.5; float r = length(c) * 2.0;
        float blob = smoothstep(1.0, 0.55, r);
        float rim = smoothstep(0.98, 0.9, r) * smoothstep(0.75, 0.9, r);
        float pulse = 0.75 + 0.25 * sin(uTime * 4.0 - r * 6.0);
        gl_FragColor = vec4(uColor * (blob * 0.9 + rim * 1.6) * pulse * uStrength * uScan, 1.0);
      }`,
  });
}
// A glowing copy of a shape drawn on top of everything while scanning
function xrayMaterial(color) {
  const m = holoMaterial(color, 1.4);
  m.depthTest = false;
  m.uniforms.uScan = U.scan;
  m.fragmentShader = m.fragmentShader.replace('uniform float uTime, uStrength;', 'uniform float uTime, uStrength, uScan;').replace('* uStrength, 1.0)', '* uStrength * uScan, 1.0)');
  return m;
}

// the tall beam that marks the current objective while scanning
let objBeam = null;
function buildScanner() {
  const layer = $('scanLayer');
  for (let i = 0; i < 28; i++) {
    const el = document.createElement('div'); el.className = 'sm'; el.hidden = true;
    el.innerHTML = '<i></i><span class="l"></span><span class="d"></span>';
    layer.appendChild(el);
    SCAN.markers.push({ el, i: el.firstChild, l: el.children[1], d: el.children[2], key: null });
  }
  const g = new THREE.CylinderGeometry(0.9, 0.9, 400, 16, 1, true).translate(0, 200, 0);
  objBeam = new THREE.Mesh(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uScan: U.scan, uTime: U.time },
    vertexShader: /* glsl */ `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `uniform float uScan, uTime; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5); float f = smoothstep(400.0, 0.0, vY) * (0.6 + 0.4 * sin(vY * 0.5 - uTime * 6.0));
        gl_FragColor = vec4(vec3(0.24, 1.0, 0.54) * (0.25 + edge) * f * uScan * 0.9, 1.0); }`,
  }));
  objBeam.renderOrder = 20; objBeam.frustumCulled = false; objBeam.visible = false;
  scene.add(objBeam);
}
function toggleScan(on = !SCAN.on) {
  if (GAME.mode !== 'play') on = false;
  if (on === SCAN.on) return;
  SCAN.on = on; SCAN.t = 0; SCAN.prog = 0; SCAN.focus = null;
  sfx(on ? 'scanOn' : 'scanOff');
  $('scanLayer').classList.toggle('on', on);
  STORY.flags.usedScan = true;
}
const _sp = new THREE.Vector3();
function updateScanner(dt) {
  if (SCAN.on && GAME.mode !== 'play') toggleScan(false);
  SCAN.k = damp(SCAN.k, SCAN.on ? 1 : 0, 7, dt);
  U.scan.value = SCAN.k;
  SCAN.t += dt;
  finalPass.uniforms.uScan.value = SCAN.k;
  finalPass.uniforms.uScanT.value = SCAN.on ? SCAN.t : 9;
  const tgt = STORY.target;
  objBeam.visible = SCAN.k > 0.02 && !!tgt;
  if (tgt) { objBeam.position.set(tgt.x, tgt.y - 2, tgt.z); objBeam.scale.set(1, 1, 1); objBeam.visible = objBeam.visible && Math.hypot(tgt.x - P.x, tgt.z - P.z) > 9; }
  updateObjectiveMarker();
  if (SCAN.k < 0.02) { for (const m of SCAN.markers) if (!m.el.hidden) m.el.hidden = true; $('scanInfo').hidden = true; return; }
  const W = window.innerWidth, H = window.innerHeight, cp = camera.position;
  const range = (P.room ? 40 : SCAN.range) * (1 + (STORY.upgrades >= 3 ? 0.5 : 0));
  // candidates: visible, in range, in front of the camera
  const list = [];
  for (const o of SCAN.items) {
    if (o.done && o.kind !== 'security' && o.kind !== 'enemy') continue;
    if (o.when && !o.when()) continue;
    const p = o.pos();
    const d = p.distanceTo(cp);
    if (d > range) continue;
    _sp.copy(p).project(camera);
    if (_sp.z > 1 || _sp.z < -1) continue;
    const sx = (_sp.x * 0.5 + 0.5) * W, sy = (-_sp.y * 0.5 + 0.5) * H;
    if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue;
    list.push({ o, d, sx, sy, c: Math.hypot(sx - W / 2, sy - H / 2) });
  }
  list.sort((a, b) => a.d - b.d);
  // focus: closest to the crosshair within reach
  let focus = null, best = 95;
  for (const it of list) {
    const reach = it.o.kind === 'security' ? 30 : it.o.analyze ? 40 : 0;
    if (!reach || it.d > reach || it.o.done) continue;
    if (it.c < best) { best = it.c; focus = it; }
  }
  if (!focus || focus.o !== SCAN.focus) { SCAN.focus = focus ? focus.o : null; SCAN.prog = 0; }
  const F = SCAN.focus;
  if (F && SCAN.k > 0.8) {
    if (F.analyze) {
      SCAN.prog += dt / (F.analyze.time || 0.8);
      if (Math.floor(SCAN.prog * 8) !== Math.floor((SCAN.prog - dt / (F.analyze.time || 0.8)) * 8)) sfx('scanTick');
      if (SCAN.prog >= 1) { F.done = true; SCAN.prog = 0; SCAN.focus = null; sfx('scanDone'); F.analyze.done(); }
    } else if (F.hack && (keys.KeyE || TOUCH.hack)) {
      SCAN.prog += dt / 1.1;
      if (SCAN.prog >= 1) { F.done = true; SCAN.prog = 0; SCAN.focus = null; sfx('hack'); F.hack(); toast('Hacked', F.label, 'It is on your side now.'); }
    } else SCAN.prog = Math.max(0, SCAN.prog - dt * 2);
  }
  // draw markers
  let n = 0;
  for (const it of list) {
    if (n >= SCAN.markers.length) break;
    const m = SCAN.markers[n++], o = it.o;
    const col = SCAN_COLORS[o.kind] || '#fff';
    const near = it.d < 25 || o === SCAN.focus;
    m.el.hidden = false;
    m.el.style.transform = `translate(${it.sx.toFixed(1)}px, ${it.sy.toFixed(1)}px)`;
    m.el.style.setProperty('--c', col);
    m.el.style.opacity = (clamp(1.3 - it.d / range, 0.25, 1) * SCAN.k).toFixed(2);
    m.el.classList.toggle('focus', o === SCAN.focus);
    m.el.classList.toggle('done', !!o.done);
    const label = o.done && o.kind === 'security' ? o.label + ' (off)' : o.label || SCAN_LABELS[o.kind];
    if (m.l.textContent !== label) m.l.textContent = label;
    m.l.hidden = !near;
    m.d.textContent = near ? `${Math.round(it.d)} m` : '';
    m.el.style.setProperty('--p', o === SCAN.focus ? SCAN.prog.toFixed(3) : 0);
  }
  for (; n < SCAN.markers.length; n++) if (!SCAN.markers[n].el.hidden) SCAN.markers[n].el.hidden = true;
  // the info line under the crosshair
  const info = $('scanInfo');
  if (F) {
    info.hidden = false;
    const what = F.analyze ? 'Analyzing' : F.hack ? (TOUCH.active ? 'Hold Hack' : 'Hold E to hack') : '';
    info.textContent = `${F.label || SCAN_LABELS[F.kind]}${what ? '  ·  ' + what : ''}`;
  } else info.hidden = true;
}
// the always-on objective diamond, pinned to the screen edge when off screen
function updateObjectiveMarker() {
  const el = $('objMarker'), tgt = STORY.target;
  if (!tgt || GAME.mode !== 'play' || STORY.hideMarker) { el.hidden = true; return; }
  const W = window.innerWidth, H = window.innerHeight;
  _sp.copy(tgt).project(camera);
  let sx = (_sp.x * 0.5 + 0.5) * W, sy = (-_sp.y * 0.5 + 0.5) * H;
  const behind = _sp.z > 1;
  if (behind) { sx = W - sx; sy = H - sy; }
  const m = 48, off = behind || sx < m || sx > W - m || sy < m + 30 || sy > H - m;
  if (off) {
    const cx = W / 2, cy = H / 2;
    let dx = sx - cx, dy = sy - cy;
    if (behind && Math.abs(dy) < 1) dy = 1;
    const kx = (W / 2 - m) / Math.max(Math.abs(dx), 1e-3), ky = (H / 2 - m - 30) / Math.max(Math.abs(dy), 1e-3), k = Math.min(kx, ky);
    sx = cx + dx * k; sy = cy + dy * k;
  }
  el.hidden = false;
  el.classList.toggle('edge', off);
  el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
  const d = Math.round(Math.hypot(tgt.x - P.x, tgt.y - P.y, tgt.z - P.z));
  const txt = d > 3 ? `${d} m` : '';
  if (el.lastChild.textContent !== txt) el.lastChild.textContent = txt;
}
