// ============================================================ sound: everything is synthesized except the voices
const AUDIO = { ctx: null, on: false, music: true, voice: true, beds: {}, alarmNode: null, buffers: {}, duck: 1, combat: 0 };
try { AUDIO.music = localStorage.getItem('nomanisan.music') !== 'off'; AUDIO.voice = localStorage.getItem('nomanisan.voice') !== 'off'; } catch (e) { /* storage blocked */ }

function noiseBuffer(ctx, seconds, kind) {
  const n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
    else d[i] = w;
  }
  return b;
}
function synthBuffer(ctx, seconds, fn) {
  const n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(1, n, ctx.sampleRate);
  fn(b.getChannelData(0), ctx.sampleRate);
  return b;
}
function cricketBuffer(ctx) {
  return synthBuffer(ctx, 8, (d, sr) => {
    for (let v = 0; v < 6; v++) {
      const f = 3600 + Math.random() * 1500, period = 0.5 + Math.random() * 0.8, pulses = 2 + Math.floor(Math.random() * 3), amp = 0.03 + Math.random() * 0.03, off = Math.random() * period;
      for (let t0 = off; t0 < 8; t0 += period * (0.9 + Math.random() * 0.2)) {
        if (Math.random() < 0.2) continue;
        for (let p = 0; p < pulses; p++) {
          const s0 = Math.floor((t0 + p * 0.032) * sr), len = Math.floor(0.018 * sr);
          for (let k = 0; k < len && s0 + k < d.length; k++) d[s0 + k] += Math.sin(TAU * f * k / sr) * Math.sin(Math.PI * k / len) * amp;
        }
      }
    }
  });
}
function frogBuffer(ctx) {
  return synthBuffer(ctx, 11, (d, sr) => {
    for (let c = 0; c < 12; c++) {
      const t0 = Math.random() * 10.5, f = 130 + Math.random() * 140, dur = 0.18 + Math.random() * 0.2, am = 25 + Math.random() * 25, amp = 0.1 + Math.random() * 0.08;
      const s0 = Math.floor(t0 * sr), len = Math.floor(dur * sr);
      for (let k = 0; k < len && s0 + k < d.length; k++) {
        const t = k / sr, env = Math.sin(Math.PI * k / len);
        d[s0 + k] += Math.sign(Math.sin(TAU * f * t)) * 0.4 * (0.5 + 0.5 * Math.sin(TAU * am * t)) * env * amp;
      }
    }
    // a night bird now and then
    for (let c = 0; c < 2; c++) {
      const t0 = 1 + Math.random() * 9, s0 = Math.floor(t0 * sr), len = Math.floor(0.5 * sr);
      for (let k = 0; k < len && s0 + k < d.length; k++) { const t = k / sr; const f = 2600 - 900 * (k / len); d[s0 + k] += Math.sin(TAU * f * t) * Math.sin(Math.PI * k / len) * 0.04; }
    }
  });
}
// droplets pattering on leaves and rock
function rainDropsBuffer(ctx) {
  return synthBuffer(ctx, 4, (d, sr) => {
    for (let i = 0; i < 2600; i++) {
      const s0 = Math.floor(Math.random() * (d.length - 400)), f = 1800 + Math.random() * 4000, a = 0.02 + Math.random() * 0.05, len = 60 + Math.floor(Math.random() * 220);
      for (let k = 0; k < len; k++) d[s0 + k] += Math.sin(TAU * f * k / sr) * Math.exp(-k / (len * 0.25)) * a;
    }
  });
}
function impulse(ctx, seconds, decay) {
  const n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
  return b;
}
function filt(ctx, type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
function loopBed(ctx, buf, chain, dest) {
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const g = ctx.createGain(); g.gain.value = 0;
  let node = src;
  for (const c of chain) { node.connect(c); node = c; }
  node.connect(g); g.connect(dest);
  src.start(0, Math.random() * buf.duration);
  return { src, g, level: 0 };
}
function startAudio() {
  if (AUDIO.ctx) { AUDIO.ctx.resume(); return; }
  let ctx;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  AUDIO.ctx = ctx;
  // master: a gentle compressor, then a limiter so thunder can be huge without clipping
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.25;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
  AUDIO.master = ctx.createGain(); AUDIO.master.gain.value = 0.95;
  AUDIO.master.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
  const bus = (g) => { const n = ctx.createGain(); n.gain.value = g; n.connect(AUDIO.master); return n; };
  AUDIO.amb = bus(1); AUDIO.sfxBus = bus(1); AUDIO.voiceBus = bus(1.2); AUDIO.musicBus = bus(1);
  AUDIO.reverb = ctx.createConvolver(); AUDIO.reverb.buffer = impulse(ctx, 3.2, 2.6);
  const revOut = ctx.createGain(); revOut.gain.value = 0.55; AUDIO.reverb.connect(revOut); revOut.connect(AUDIO.master);
  AUDIO.revSend = ctx.createGain(); AUDIO.revSend.connect(AUDIO.reverb);
  const W = noiseBuffer(ctx, 3, 'white'), Bn = noiseBuffer(ctx, 4, 'brown'), Pk = noiseBuffer(ctx, 4, 'pink');
  AUDIO.white = W; AUDIO.brown = Bn; AUDIO.pink = Pk;
  const B = AUDIO.beds, A = AUDIO.amb;
  B.ocean = loopBed(ctx, Bn, [filt(ctx, 'lowpass', 480)], A);
  B.surf = loopBed(ctx, Pk, [filt(ctx, 'bandpass', 900, 0.6)], A);
  B.wind = loopBed(ctx, W, [filt(ctx, 'bandpass', 480, 0.6), filt(ctx, 'lowpass', 1600)], A);
  B.gust = loopBed(ctx, Pk, [filt(ctx, 'bandpass', 1200, 1.5)], A);
  B.rain = loopBed(ctx, Pk, [filt(ctx, 'highpass', 450), filt(ctx, 'lowpass', 7000)], A);
  B.rainDrops = loopBed(ctx, rainDropsBuffer(ctx), [filt(ctx, 'highpass', 900)], A);
  B.rainIn = loopBed(ctx, Bn, [filt(ctx, 'lowpass', 320)], A);
  B.crickets = loopBed(ctx, cricketBuffer(ctx), [filt(ctx, 'highpass', 2000)], A);
  B.frogs = loopBed(ctx, frogBuffer(ctx), [filt(ctx, 'lowpass', 3000)], A);
  B.rumble = loopBed(ctx, Bn, [filt(ctx, 'lowpass', 70)], A);
  B.falls = loopBed(ctx, W, [filt(ctx, 'lowpass', 2200), filt(ctx, 'highpass', 160)], A);
  B.lava = loopBed(ctx, Bn, [filt(ctx, 'bandpass', 240, 0.8)], A);
  // machine hum inside the lair
  const hum = ctx.createGain(); hum.gain.value = 0; hum.connect(A);
  const hf = filt(ctx, 'lowpass', 240); hf.connect(hum);
  for (const [f, type] of [[55, 'sawtooth'], [110.3, 'sawtooth'], [165, 'sine']]) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.2; o.connect(g); g.connect(hf); o.start(); }
  B.hum = { g: hum, level: 0 };
  // the Heart's choir: slow detuned sines, heard only deep under the volcano
  const ch = ctx.createGain(); ch.gain.value = 0; ch.connect(A); ch.connect(AUDIO.revSend);
  for (const f of [220, 277.2, 329.6, 440.4, 554.9]) for (const det of [-5, 5]) {
    const o = ctx.createOscillator(); o.frequency.value = f; o.detune.value = det;
    const g = ctx.createGain(); g.gain.value = 0.04;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.1; const lg = ctx.createGain(); lg.gain.value = 0.03;
    lfo.connect(lg); lg.connect(g.gain); lfo.start(); o.connect(g); g.connect(ch); o.start();
  }
  B.choir = { g: ch, level: 0 };
  // music: an exploration pad and a combat groove
  B.music = { g: ctx.createGain(), level: 0 }; B.music.g.gain.value = 0; B.music.g.connect(AUDIO.musicBus);
  AUDIO.padFilter = filt(ctx, 'lowpass', 700, 0.5); AUDIO.padFilter.connect(B.music.g);
  AUDIO.padOsc = [];
  for (let i = 0; i < 4; i++) for (const det of [-6, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = det; const g = ctx.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(AUDIO.padFilter); o.start(); AUDIO.padOsc.push(o); }
  AUDIO.chord = -1; AUDIO.chordT = 0;
  B.combat = { g: ctx.createGain(), level: 0 }; B.combat.g.gain.value = 0; B.combat.g.connect(AUDIO.musicBus);
  AUDIO.seqT = ctx.currentTime + 0.1; AUDIO.seqStep = 0;
  AUDIO.gustT = 0; AUDIO.gust = 0.3; AUDIO.gustTarget = 0.3; AUDIO.roarT = 8; AUDIO.plopT = 0;
  AUDIO.on = true;
}
const CHORDS = [[50, 53, 57, 64], [46, 50, 53, 57], [43, 46, 50, 57], [45, 49, 52, 55]];  // Dm9, Bbmaj7, Gm9, A7
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function setBed(name, target, speed = 1.5) {
  const b = AUDIO.beds[name]; if (!b) return;
  if (!Number.isFinite(target)) target = 0;
  b.level = damp(b.level, target, speed, AUDIO.dt);
  b.g.gain.value = b.level;
}
function updateAudio(dt, env) {
  if (!AUDIO.on) return;
  AUDIO.dt = dt;
  const now = AUDIO.ctx.currentTime;
  // dialogue ducks the world so every word is heard
  AUDIO.duck = damp(AUDIO.duck, DLG.speaking ? 0.45 : 1, 4, dt);
  AUDIO.amb.gain.value = AUDIO.duck;
  AUDIO.musicBus.gain.value = AUDIO.music ? lerp(0.5, 1, AUDIO.duck) : 0;
  const out = env.indoor ? 0 : 1, rain = SKY.rain, night = 1 - SKY.day;
  // gusts wander between calm and strong; storms gust harder
  AUDIO.gustT -= dt;
  if (AUDIO.gustT <= 0) { AUDIO.gustT = rr(2, 6); AUDIO.gustTarget = rr(0.1, 1) * (0.5 + SKY.storm * 0.8); }
  AUDIO.gust = damp(AUDIO.gust, AUDIO.gustTarget, 0.8, dt);
  const alt = smoothstep(30, 175, env.y);
  setBed('ocean', out * (0.06 + 0.55 * smoothstep(150, 8, env.coastDist)) * (1 + SKY.storm * 0.4));
  setBed('surf', out * smoothstep(90, 6, env.coastDist) * (0.12 + 0.2 * Math.max(0, Math.sin(now * 0.45))) * (1 + SKY.storm * 0.6));
  setBed('wind', 0.03 + out * (0.06 + 0.3 * alt + 0.12 * SKY.storm) * (0.6 + AUDIO.gust * 0.6));
  setBed('gust', out * AUDIO.gust * (0.04 + alt * 0.12 + SKY.storm * 0.1));
  setBed('rain', out * rain * 0.42);
  setBed('rainDrops', out * rain * 0.5);
  setBed('rainIn', (1 - out) * rain * 0.25 * (env.y > 30 ? 1 : 0));
  setBed('crickets', out * env.jungle * 0.55 * night * (1 - rain * 0.7));
  setBed('frogs', out * env.jungle * 0.45 * smoothstep(40, 10, env.y) * (0.4 + rain * 0.8));
  setBed('rumble', 0.08 + env.volcano * 0.45 + (env.indoor ? 0.18 : 0) + FX.shake * 0.7 + FX.eruption * 0.9, 3);
  setBed('falls', smoothstep(70, 4, env.fallsDist) * (env.indoor ? 0.3 : 0.7));
  setBed('lava', env.heat * 0.8);
  setBed('hum', env.indoor ? (GAME.power ? 0.05 : 0.02) : 0);
  setBed('choir', (env.heart || 0) * 0.5, 0.6);
  // the volcano roars now and then; lava plops when you are close
  AUDIO.roarT -= dt;
  if (AUDIO.roarT <= 0) { AUDIO.roarT = rr(14, 35); if (env.volcano > 0.15 || env.indoor) roar(env.volcano + (env.indoor ? 0.3 : 0)); }
  AUDIO.plopT -= dt;
  if (AUDIO.plopT <= 0) { AUDIO.plopT = rr(0.25, 0.9); if (env.heat > 0.2) plop(env.heat); }
  // music: the pad drifts through minor chords; the groove takes over while drones hunt you
  const fighting = AUDIO.music && GAME.started && ENEMIES.some((e) => e.alive && e.state === 'hunt') ? 1 : 0;
  AUDIO.combat = damp(AUDIO.combat, fighting, fighting ? 3 : 0.5, dt);
  setBed('music', AUDIO.music && GAME.started ? (env.indoor ? 0.09 : 0.06) * (1 - AUDIO.combat) : 0, 0.4);
  AUDIO.beds.combat.g.gain.value = AUDIO.combat * 0.32;
  if (AUDIO.combat > 0.02) combatSequencer(now); else AUDIO.seqT = now + 0.05;
  AUDIO.chordT -= dt;
  if (AUDIO.chordT <= 0) {
    AUDIO.chordT = 11;
    AUDIO.chord = (AUDIO.chord + 1) % CHORDS.length;
    CHORDS[AUDIO.chord].forEach((m, i) => { for (let k = 0; k < 2; k++) AUDIO.padOsc[i * 2 + k].frequency.setTargetAtTime(mtof(m - 12 + (i === 0 ? -12 : 0)), now, 2.5); });
    AUDIO.padFilter.frequency.setTargetAtTime(env.indoor ? 900 : 600, now, 3);
  }
  // alarm: a soft two-tone while drones are out, never a constant beeping
  if (ALARM.t > 0 && !AUDIO.alarmNode) AUDIO.alarmNode = startAlarm();
  if (ALARM.t <= 0 && AUDIO.alarmNode) { AUDIO.alarmNode.stop(); AUDIO.alarmNode = null; }
}
// 125 bpm spy-action groove: kick, rim, hats and a walking bass in D minor
const BASS = [38, 0, 38, 41, 0, 43, 0, 44, 45, 0, 45, 43, 0, 41, 0, 40];
function combatSequencer(now) {
  const ctx = AUDIO.ctx, step = 60 / 125 / 4, dest = AUDIO.beds.combat.g;
  while (AUDIO.seqT < now + 0.2) {
    const t = AUDIO.seqT, s = AUDIO.seqStep % 16;
    if (s % 4 === 0) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); const g = envGain(0.9, t, 0.002, 0.18); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.25); }
    if (s % 4 === 2 || s === 15) noiseHit(AUDIO.white, [filt(ctx, 'highpass', 6000)], 0.18, 0.001, 0.05, t, dest);
    if (s === 4 || s === 12) noiseHit(AUDIO.white, [filt(ctx, 'bandpass', 1800, 1.5)], 0.35, 0.001, 0.09, t, dest);
    if (BASS[s]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(BASS[s]); const f = filt(ctx, 'lowpass', 520, 3); const g = envGain(0.32, t, 0.005, step * 1.7); o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + step * 2); }
    if (s === 0 && Math.floor(AUDIO.seqStep / 16) % 2 === 1) for (const m of [62, 65, 69]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(m); const f = filt(ctx, 'lowpass', 1400, 1); const g = envGain(0.05, t, 0.01, 0.35); o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.5); }
    AUDIO.seqT += step; AUDIO.seqStep++;
  }
}
function envGain(v, when, attack, decay) {
  const g = AUDIO.ctx.createGain();
  g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), when + attack); g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
  return g;
}
function noiseHit(buf, filters, vol, attack, decay, when, dest = AUDIO.sfxBus, rate = 1) {
  const s = AUDIO.ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate * (0.85 + Math.random() * 0.3);
  let node = s;
  for (const f of filters) { node.connect(f); node = f; }
  const g = envGain(vol, when, attack, decay); node.connect(g); g.connect(dest);
  s.start(when, Math.random() * 1.2, attack + decay + 0.05);
  return g;
}
function tone(type, f0, f1, vol, attack, decay, when, dest = AUDIO.sfxBus) {
  const o = AUDIO.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, when); if (f1) o.frequency.exponentialRampToValueAtTime(f1, when + attack + decay);
  const g = envGain(vol, when, attack, decay); o.connect(g); g.connect(dest);
  o.start(when); o.stop(when + attack + decay + 0.05);
  return g;
}
// Thunder: a sharp crack when close, a long rolling boom and a sub-bass thump, all sent through the reverb.
function thunder(dist, indoor) {
  if (!AUDIO.on) return;
  const ctx = AUDIO.ctx, t = ctx.currentTime;
  const near = clamp(1 - dist / 500, 0.15, 1);
  const out = ctx.createGain(); out.gain.value = indoor ? 0.45 : 1;
  const lp = filt(ctx, 'lowpass', indoor ? 260 : 12000); out.connect(lp); lp.connect(AUDIO.sfxBus); lp.connect(AUDIO.revSend);
  if (near > 0.45 && !indoor) {
    noiseHit(AUDIO.white, [filt(ctx, 'highpass', 1600)], 0.9 * near, 0.003, 0.25, t, out);
    noiseHit(AUDIO.white, [filt(ctx, 'bandpass', 900, 0.8)], 0.7 * near, 0.005, 0.5, t + 0.04, out);
  }
  const rolls = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < rolls; i++) {
    const at = t + 0.05 + i * rr(0.35, 0.9) + (i ? rr(0, 0.5) : 0);
    noiseHit(AUDIO.brown, [filt(ctx, 'lowpass', lerp(140, 380, near))], (1.5 - i * 0.18) * (0.55 + near * 0.6), 0.04 + i * 0.03, rr(1.5, 3.2), at, out, 0.7);
  }
  const sub = ctx.createOscillator(); sub.frequency.setValueAtTime(46, t); sub.frequency.exponentialRampToValueAtTime(26, t + 2.2);
  const sg = envGain(0.9 * near + 0.25, t + 0.02, 0.06, 2.6); sub.connect(sg); sg.connect(out); sub.start(t); sub.stop(t + 3);
  FX.shake = Math.max(FX.shake, 0.15 + near * 0.4);
}
function roar(k) {
  const t = AUDIO.ctx.currentTime;
  noiseHit(AUDIO.brown, [filt(AUDIO.ctx, 'lowpass', 120)], clamp(0.4 + k, 0.4, 1.3), 1.2, 3.5, t, AUDIO.sfxBus, 0.6);
  noiseHit(AUDIO.pink, [filt(AUDIO.ctx, 'bandpass', 300, 0.7)], 0.08 * k, 0.8, 2.5, t + 0.3, AUDIO.revSend);
}
function plop(k) { tone('sine', rr(90, 160), rr(35, 55), 0.12 * k, 0.005, rr(0.15, 0.3), AUDIO.ctx.currentTime); }
function panTo(x, y, z) {
  const p = AUDIO.ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 5; p.rolloffFactor = 1.1;
  p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z;
  p.connect(AUDIO.sfxBus);
  return p;
}
function updateListener() {
  if (!AUDIO.on) return;
  const L = AUDIO.ctx.listener, p = camera.position;
  camera.getWorldDirection(_v);
  if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = _v.x; L.forwardY.value = _v.y; L.forwardZ.value = _v.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
  else { L.setPosition(p.x, p.y, p.z); L.setOrientation(_v.x, _v.y, _v.z, 0, 1, 0); }
}
// heavier steps: the hero is a big guy
function footstep(kind) {
  if (!AUDIO.on) return;
  const ctx = AUDIO.ctx, t = ctx.currentTime, W = AUDIO.white, Bn = AUDIO.brown;
  switch (kind) {
    case 'sand': noiseHit(W, [filt(ctx, 'lowpass', 650)], 0.1, 0.01, 0.13, t); break;
    case 'grass': noiseHit(W, [filt(ctx, 'bandpass', 1600, 0.6)], 0.04, 0.005, 0.09, t); noiseHit(Bn, [filt(ctx, 'lowpass', 300)], 0.16, 0.005, 0.08, t); break;
    case 'metal': noiseHit(W, [filt(ctx, 'bandpass', 1000, 5)], 0.08, 0.002, 0.18, t); tone('triangle', 380 + Math.random() * 60, 0, 0.012, 0.002, 0.2, t); noiseHit(Bn, [filt(ctx, 'lowpass', 200)], 0.18, 0.003, 0.08, t); break;
    case 'wood': noiseHit(Bn, [filt(ctx, 'bandpass', 450, 2)], 0.22, 0.003, 0.11, t); break;
    case 'water': noiseHit(W, [filt(ctx, 'bandpass', 900, 1)], 0.12, 0.02, 0.25, t); break;
    case 'stone': case 'concrete': noiseHit(W, [filt(ctx, 'highpass', 1500), filt(ctx, 'lowpass', 5000)], 0.04, 0.002, 0.06, t); noiseHit(Bn, [filt(ctx, 'lowpass', 260)], 0.22, 0.003, 0.07, t); break;
    default: noiseHit(W, [filt(ctx, 'bandpass', 2200, 0.8)], 0.04, 0.003, 0.08, t); noiseHit(Bn, [filt(ctx, 'lowpass', 240)], 0.18, 0.004, 0.08, t);
  }
}
function sfxAt(name, x, y, z) { if (!AUDIO.on) return; sfx(name, panTo(x, y, z)); }
function sfx(name, dest) {
  if (!AUDIO.on) return;
  const ctx = AUDIO.ctx, t = ctx.currentTime, W = AUDIO.white, Bn = AUDIO.brown;
  dest = dest || AUDIO.sfxBus;
  switch (name) {
    case 'door': noiseHit(W, [filt(ctx, 'bandpass', 800, 0.7)], 0.08, 0.05, 0.45, t, dest); noiseHit(Bn, [filt(ctx, 'lowpass', 120)], 0.4, 0.01, 0.35, t + 0.45, dest); break;
    case 'beep': tone('sine', 1320, 0, 0.03, 0.003, 0.06, t, dest); break;
    case 'key': noiseHit(W, [filt(ctx, 'bandpass', 3000, 2)], 0.06, 0.001, 0.03, t, dest); break;
    case 'deny': tone('square', 220, 0, 0.04, 0.005, 0.15, t, dest); tone('square', 165, 0, 0.04, 0.005, 0.25, t + 0.18, dest); break;
    case 'grant': [880, 1108, 1320].forEach((f, i) => tone('sine', f, 0, 0.05, 0.004, 0.12, t + i * 0.09, dest)); break;
    case 'spark': noiseHit(W, [filt(ctx, 'highpass', 3500)], 0.06, 0.001, 0.04, t, dest); break;
    case 'rumble': noiseHit(Bn, [filt(ctx, 'lowpass', 90)], 1.3, 0.8, 3.5, t, dest); break;
    case 'thunder': thunder(200, false); break;
    case 'squawk': tone('sawtooth', 900, 1300, 0.02, 0.02, 0.1, t, dest); break;
    case 'spotted': tone('sine', 660, 990, 0.05, 0.01, 0.12, t, dest); break;
    case 'alarmStart': tone('triangle', 520, 780, 0.06, 0.02, 0.35, t, dest); break;
    case 'zap': tone('sine', 200, 1800, 0.12, 0.05, 1.0, t, dest); noiseHit(W, [filt(ctx, 'bandpass', 2000, 3)], 0.08, 0.1, 1.0, t, dest); break;
    case 'power': tone('sawtooth', 40, 220, 0.16, 0.4, 2.6, t, dest); for (const d of [0.2, 0.9, 1.6]) noiseHit(Bn, [filt(ctx, 'lowpass', 150)], 0.7, 0.02, 0.6, t + d, dest); break;
    case 'iris': tone('sawtooth', 50, 32, 0.25, 0.5, 6, t, dest); noiseHit(Bn, [filt(ctx, 'lowpass', 200)], 1.1, 0.5, 6, t, dest); break;
    case 'sting': playSting(t); break;
    case 'click': tone('sine', 1800, 0, 0.025, 0.001, 0.03, t, dest); break;
    // hero
    case 'swing': noiseHit(W, [filt(ctx, 'bandpass', 700, 1.2)], 0.12, 0.03, 0.12, t, dest, 1.4); break;
    case 'punchHit': noiseHit(Bn, [filt(ctx, 'lowpass', 220)], 0.9, 0.002, 0.18, t, dest); noiseHit(W, [filt(ctx, 'bandpass', 1500, 1)], 0.25, 0.001, 0.06, t, dest); break;
    case 'punchHeavy': noiseHit(Bn, [filt(ctx, 'lowpass', 180)], 1.3, 0.002, 0.35, t, dest); tone('sine', 90, 40, 0.5, 0.002, 0.3, t, dest); noiseHit(W, [filt(ctx, 'bandpass', 1200, 1)], 0.35, 0.001, 0.1, t, dest); break;
    case 'metalHit': tone('triangle', rr(300, 500), rr(150, 250), 0.1, 0.002, 0.25, t, dest); noiseHit(W, [filt(ctx, 'bandpass', 2500, 4)], 0.12, 0.001, 0.15, t, dest); break;
    case 'jump': noiseHit(W, [filt(ctx, 'lowpass', 900)], 0.06, 0.01, 0.12, t, dest); break;
    case 'superjump': noiseHit(Bn, [filt(ctx, 'lowpass', 160)], 1.0, 0.005, 0.4, t, dest); noiseHit(W, [filt(ctx, 'bandpass', 500, 0.7)], 0.2, 0.02, 0.6, t, dest, 0.7); break;
    case 'boost': noiseHit(W, [filt(ctx, 'bandpass', 900, 0.8)], 0.3, 0.01, 0.5, t, dest, 1.2); tone('sawtooth', 120, 300, 0.05, 0.02, 0.4, t, dest); break;
    case 'land': noiseHit(Bn, [filt(ctx, 'lowpass', 140)], 1.1, 0.003, 0.5, t, dest); noiseHit(W, [filt(ctx, 'lowpass', 1200)], 0.15, 0.01, 0.4, t, dest); break;
    case 'slam': noiseHit(Bn, [filt(ctx, 'lowpass', 120)], 1.5, 0.003, 1.2, t, dest); tone('sine', 70, 28, 0.8, 0.005, 1.0, t, dest); noiseHit(W, [filt(ctx, 'lowpass', 2500)], 0.3, 0.01, 0.8, t, AUDIO.revSend); break;
    case 'whoosh': noiseHit(W, [filt(ctx, 'bandpass', 600, 1)], 0.2, 0.05, 0.3, t, dest, 0.8); break;
    case 'lift': noiseHit(Bn, [filt(ctx, 'lowpass', 300)], 0.4, 0.05, 0.3, t, dest); break;
    case 'throw': noiseHit(W, [filt(ctx, 'bandpass', 500, 1)], 0.3, 0.02, 0.35, t, dest, 0.9); break;
    case 'thud': noiseHit(Bn, [filt(ctx, 'lowpass', 160)], 0.9, 0.003, 0.4, t, dest); break;
    case 'wood': noiseHit(Bn, [filt(ctx, 'bandpass', 380, 2)], 0.6, 0.002, 0.2, t, dest); noiseHit(W, [filt(ctx, 'bandpass', 1800, 2)], 0.15, 0.001, 0.15, t + 0.02, dest); break;
    case 'hurt': tone('sine', 140, 90, 0.2, 0.005, 0.15, t, dest); noiseHit(W, [filt(ctx, 'lowpass', 700)], 0.18, 0.003, 0.12, t, dest); break;
    case 'ko': tone('sawtooth', 220, 55, 0.12, 0.01, 1.2, t, dest); noiseHit(Bn, [filt(ctx, 'lowpass', 200)], 0.8, 0.01, 1.0, t, dest); break;
    // machines
    case 'explode': noiseHit(Bn, [filt(ctx, 'lowpass', 250)], 1.6, 0.004, 1.4, t, dest); noiseHit(W, [filt(ctx, 'lowpass', 3000)], 0.5, 0.004, 0.6, t, dest); tone('sine', 60, 30, 0.7, 0.005, 0.8, t, dest); break;
    case 'laser': tone('square', 1600, 400, 0.02, 0.003, 0.12, t, dest); break;
    case 'droneUp': tone('sawtooth', 200, 600, 0.03, 0.2, 0.5, t, dest); break;
    case 'robotBreak': noiseHit(W, [filt(ctx, 'bandpass', 2000, 2)], 0.35, 0.002, 0.3, t, dest); tone('square', 800, 80, 0.06, 0.005, 0.5, t, dest); break;
    case 'clank': noiseHit(W, [filt(ctx, 'bandpass', 1400, 6)], 0.35, 0.002, 0.25, t, dest); noiseHit(Bn, [filt(ctx, 'lowpass', 200)], 0.5, 0.002, 0.2, t, dest); break;
    case 'servo': tone('sawtooth', 300, 700, 0.03, 0.05, 0.35, t, dest); break;
    // scanner and story
    case 'scanOn': tone('sine', 440, 1760, 0.05, 0.02, 0.35, t, dest); tone('sine', 660, 2640, 0.025, 0.04, 0.3, t, dest); break;
    case 'scanOff': tone('sine', 1760, 440, 0.04, 0.02, 0.25, t, dest); break;
    case 'scanTick': tone('sine', 2200, 0, 0.012, 0.001, 0.03, t, dest); break;
    case 'scanDone': [1320, 1760, 2640].forEach((f, i) => tone('sine', f, 0, 0.05, 0.003, 0.2, t + i * 0.06, dest)); break;
    case 'hack': tone('square', 300, 1200, 0.03, 0.01, 0.25, t, dest); tone('square', 1200, 300, 0.025, 0.01, 0.2, t + 0.25, dest); break;
    case 'objective': [784, 1047].forEach((f, i) => tone('triangle', f, 0, 0.06, 0.004, 0.35, t + i * 0.12, dest)); break;
    case 'shard': [1568, 1976, 2349, 3136].forEach((f, i) => tone('sine', f, 0, 0.06, 0.002, 1.4, t + i * 0.07, dest).connect(AUDIO.revSend)); break;
    case 'heal': tone('sine', 523, 1046, 0.05, 0.05, 0.5, t, dest); break;
  }
}
// "bah-bah... BAAAH": a little spy-jazz brass stab for discoveries
function playSting(t) {
  const ctx = AUDIO.ctx;
  const out = ctx.createGain(); out.gain.value = 0.45; out.connect(AUDIO.musicBus);
  const lp = filt(ctx, 'lowpass', 1400, 1.2); lp.connect(out);
  for (const [m, dt, len] of [[62, 0, 0.12], [65, 0.16, 0.12], [73, 0.34, 0.9]]) for (const det of [-8, 0, 7]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
    const g = envGain(0.08, t + dt, 0.02, len); o.connect(g); g.connect(lp); o.start(t + dt); o.stop(t + dt + len + 0.1);
  }
  const bass = ctx.createOscillator(); bass.type = 'triangle'; bass.frequency.value = mtof(38);
  const bg = envGain(0.22, t + 0.34, 0.01, 0.8); bass.connect(bg); bg.connect(out); bass.start(t + 0.34); bass.stop(t + 1.3);
  lp.frequency.setValueAtTime(600, t); lp.frequency.exponentialRampToValueAtTime(2600, t + 0.45);
}
function startAlarm() {
  const ctx = AUDIO.ctx;
  const o = ctx.createOscillator(); o.type = 'triangle';
  const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 0.9;
  const depth = ctx.createGain(); depth.gain.value = 110; lfo.connect(depth); depth.connect(o.frequency); o.frequency.value = 560;
  const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.012, ctx.currentTime, 0.4);
  const lp = filt(ctx, 'lowpass', 1200);
  o.connect(lp); lp.connect(g); g.connect(AUDIO.sfxBus); o.start(); lfo.start();
  return { stop: () => { try { g.gain.setTargetAtTime(0, ctx.currentTime, 0.2); o.stop(ctx.currentTime + 1); lfo.stop(ctx.currentTime + 1); } catch (e) { /* already stopped */ } } };
}
function loopTone(f, vol) {
  if (!AUDIO.on) return { stop() {} };
  const ctx = AUDIO.ctx;
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.01;
  const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(vol, ctx.currentTime, 0.3);
  const lp = filt(ctx, 'lowpass', 400);
  o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(AUDIO.sfxBus); o.start(); o2.start();
  return { o, stop: () => { g.gain.setTargetAtTime(0, ctx.currentTime, 0.25); o.stop(ctx.currentTime + 1.2); o2.stop(ctx.currentTime + 1.2); } };
}

// ============================================================ voices: recorded clips embedded in the page, decoded on first use
async function voiceBuffer(id) {
  if (AUDIO.buffers[id]) return AUDIO.buffers[id];
  const src = typeof VOICE_DATA !== 'undefined' && VOICE_DATA[id];
  if (!src || !AUDIO.on) return null;
  try {
    const bin = Uint8Array.from(atob(src), (c) => c.charCodeAt(0));
    AUDIO.buffers[id] = await AUDIO.ctx.decodeAudioData(bin.buffer);
    return AUDIO.buffers[id];
  } catch (e) { return null; }
}
// each way of hearing someone gets its own colour: a radio earpiece, the base PA, a hologram, a ghost in the machine
function voiceChain(fx) {
  const ctx = AUDIO.ctx, out = AUDIO.voiceBus, input = ctx.createGain();
  const send = (node, amt) => { const s = ctx.createGain(); s.gain.value = amt; node.connect(s); s.connect(AUDIO.revSend); };
  if (fx === 'radio') {
    const hp = filt(ctx, 'highpass', 380), lp = filt(ctx, 'lowpass', 3300), pk = filt(ctx, 'peaking', 1800, 1.2); pk.gain.value = 6;
    const sh = ctx.createWaveShaper(), curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) curve[i] = Math.tanh((i / 128 - 1) * 2.2) * 0.9;
    sh.curve = curve;
    input.connect(hp); hp.connect(pk); pk.connect(sh); sh.connect(lp); lp.connect(out);
  } else if (fx === 'pa') {
    const hp = filt(ctx, 'highpass', 220), lp = filt(ctx, 'lowpass', 6500);
    const d = ctx.createDelay(); d.delayTime.value = 0.085; const dg = ctx.createGain(); dg.gain.value = 0.25;
    input.connect(hp); hp.connect(lp); lp.connect(out); lp.connect(d); d.connect(dg); dg.connect(out);
    send(lp, 0.35);
  } else if (fx === 'holo') {
    const hp = filt(ctx, 'highpass', 160), ring = ctx.createGain();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 38; const lg = ctx.createGain(); lg.gain.value = 0.18;
    lfo.connect(lg); lg.connect(ring.gain); lfo.start(); lfo.stop(ctx.currentTime + 20);
    input.connect(hp); hp.connect(ring); ring.connect(out);
    send(ring, 0.25);
  } else if (fx === 'echo') {
    const lp = filt(ctx, 'lowpass', 5200);
    input.connect(lp); lp.connect(out);
    for (const [dt, g] of [[0.021, 0.5], [0.033, 0.4]]) { const d = ctx.createDelay(); d.delayTime.value = dt; const dg = ctx.createGain(); dg.gain.value = g; lp.connect(d); d.connect(dg); dg.connect(out); }
    send(lp, 1.1);
  } else {
    input.connect(out);
    send(input, 0.08);
  }
  return input;
}
function playVoiceBuffer(buf, fx) {
  const src = AUDIO.ctx.createBufferSource(); src.buffer = buf;
  src.connect(voiceChain(fx));
  if (fx === 'radio') noiseHit(AUDIO.white, [filt(AUDIO.ctx, 'bandpass', 3000, 0.5)], 0.01, 0.05, buf.duration, AUDIO.ctx.currentTime, AUDIO.voiceBus);
  src.start();
  return src;
}
