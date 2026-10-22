// ============================================================ dialogue: one line at a time, voiced from the embedded clips
// talk([ids]) queues story lines and resolves when they have been heard (or skipped).
// bark(id) plays a short reaction only when nobody else is talking, with a cooldown.
// say(who, text) shows an unvoiced subtitle (base computer messages, narration).
// No browser speech synthesis anywhere: every voice is a recorded clip, played once when its moment comes.
const DLG = { queue: [], cur: null, speaking: false, src: null, t: 0, cd: {}, skipAll: false, heard: new Set(), lastBarkT: -99 };
try { DLG.skipAll = localStorage.getItem('nomanisan.skipDialogue') === 'on'; } catch (e) { /* storage blocked */ }
const BARK_COOLDOWN = { syn_alarm: 40, syn_hack: 999, syn_idle: 150, meg_hurt: 45, syn_ko: 60 };

function talk(ids, opts = {}) {
  if (typeof ids === 'string') ids = [ids];
  return new Promise((resolve) => {
    const items = ids.filter((id) => LINES[id]).map((id) => ({ id, who: LINES[id][0], text: LINES[id][1], fx: LINES[id][2] || null, story: true }));
    if (!items.length) { resolve(); return; }
    items[items.length - 1].resolve = resolve;
    if (opts.now) { dlgCancelQueue(); }
    DLG.queue.push(...items);
    if (!DLG.cur) dlgNext();
  });
}
function say(who, text, dur) {
  const label = who === 'BASE' ? 'BASE COMPUTER' : who || '';
  DLG.queue.push({ who: null, label, text, dur: dur || Math.max(3, text.length * 0.06), story: false });
  if (!DLG.cur) dlgNext();
}
function bark(base) {
  if (!AUDIO.on || GAME.mode !== 'play') return;
  const now = U.time.value;
  if (DLG.cur || DLG.queue.length || now - DLG.lastBarkT < 8) return;
  const cd = BARK_COOLDOWN[base.replace(/\d+$/, '')] ?? 30;
  if (now < (DLG.cd[base] || 0)) return;
  let ids = LINES[base] ? [base] : [1, 2, 3, 4].map((i) => base + i).filter((id) => LINES[id]);
  const fresh = ids.filter((id) => !DLG.heard.has(id));
  if (fresh.length) ids = fresh;
  if (!ids.length) return;
  DLG.cd[base] = now + cd; DLG.lastBarkT = now;
  const id = ids[Math.floor(Math.random() * ids.length)];
  DLG.queue.push({ id, who: LINES[id][0], text: LINES[id][1], fx: LINES[id][2] || null, story: false, bark: true });
  dlgNext();
}
async function dlgNext() {
  const it = DLG.queue.shift();
  DLG.cur = it || null;
  DLG.speaking = false;
  if (!it) { $('subs').classList.remove('on'); return; }
  const sp = it.who ? SPEAKERS[it.who] : null;
  const label = sp ? sp.label : it.label;
  const cls = sp ? sp.cls : 'sys';
  $('subs').innerHTML = (label ? `<span class="who ${cls}">${escapeHtml(label)}</span>` : '') + escapeHtml(it.text);
  $('subs').classList.add('on');
  $('subs').classList.toggle('narr', !label);
  it.t = it.dur || Math.max(2.4, it.text.length * 0.062);
  if (it.id) DLG.heard.add(it.id);
  if (it.id && AUDIO.on && AUDIO.voice && !(DLG.skipAll && it.story)) {
    const buf = await voiceBuffer(it.id);
    if (DLG.cur !== it) return;   // skipped while decoding
    if (buf) {
      it.t = buf.duration + 0.35;
      DLG.src = playVoiceBuffer(buf, it.fx);
      DLG.speaking = true;
    }
  }
  if (DLG.skipAll && it.story) it.t = Math.min(it.t, 0.9);
}
function dlgFinish() {
  const it = DLG.cur;
  if (DLG.src) { try { DLG.src.stop(); } catch (e) { /* already stopped */ } DLG.src = null; }
  DLG.speaking = false;
  if (it && it.resolve) it.resolve();
  dlgNext();
}
function updateDialogue(dt) {
  const it = DLG.cur;
  if (!it || it.t == null) return;
  it.t -= dt;
  if (it.t <= 0) dlgFinish();
}
function skipLine() { if (DLG.cur) { sfx('click'); dlgFinish(); } }
function dlgCancelQueue() {
  for (const it of DLG.queue) if (it.resolve) it.resolve();
  DLG.queue.length = 0;
}
function dlgCancelAll() {
  dlgCancelQueue();
  if (DLG.cur) { const it = DLG.cur; DLG.cur = null; if (DLG.src) { try { DLG.src.stop(); } catch (e) { /* stopped */ } DLG.src = null; } if (it.resolve) it.resolve(); }
  DLG.speaking = false;
  $('subs').classList.remove('on');
}

// ============================================================ cutscenes: a camera move with letterbox bars, skippable with Enter
const CUT = { on: false, shots: null, i: 0, t: 0, resolve: null, prevMode: 'play', lines: null };
const _ca = new THREE.Vector3(), _cb = new THREE.Vector3(), _cl = new THREE.Vector3();
// shot: { from:[x,y,z], to:[x,y,z], look:[x,y,z] or lookFrom/lookTo, dur, fov }
function cutscene(shots, lines) {
  return new Promise((resolve) => {
    if (CUT.on) endCutscene(true);
    CUT.on = true; CUT.shots = shots; CUT.i = 0; CUT.t = 0; CUT.resolve = resolve; CUT.linesDone = !lines;
    CUT.prevMode = GAME.mode === 'cutscene' ? 'play' : GAME.mode;
    GAME.mode = 'cutscene'; GAME.cutscene = true;
    if (SCAN.on) toggleScan(false);
    document.body.classList.add('letterbox');
    $('skipHint').hidden = false;
    if (lines) talk(lines).then(() => { CUT.linesDone = true; });
  });
}
function updateCutscene(dt) {
  if (!CUT.on) return;
  const s = CUT.shots[CUT.i];
  CUT.t += dt;
  const k = clamp(CUT.t / s.dur, 0, 1), e = k * k * (3 - 2 * k);
  _ca.fromArray(s.from); _cb.fromArray(s.to || s.from);
  camera.position.lerpVectors(_ca, _cb, e);
  _ca.fromArray(s.lookFrom || s.look); _cb.fromArray(s.lookTo || s.look);
  _cl.lerpVectors(_ca, _cb, e);
  camera.lookAt(_cl);
  camera.fov = s.fov || 60; camera.updateProjectionMatrix();
  if (FX.shake > 0) { camera.position.x += Math.sin(U.time.value * 37) * FX.shake * 0.05; camera.position.y += Math.sin(U.time.value * 41) * FX.shake * 0.05; }
  if (k >= 1) {
    if (CUT.i < CUT.shots.length - 1) { CUT.i++; CUT.t = 0; }
    else if (CUT.linesDone) endCutscene();
  }
}
function endCutscene(skipped) {
  if (!CUT.on) return;
  CUT.on = false; GAME.cutscene = false;
  if (skipped) { dlgCancelAll(); }
  if (GAME.mode === 'cutscene') GAME.mode = CUT.prevMode === 'cutscene' ? 'play' : CUT.prevMode || 'play';
  document.body.classList.remove('letterbox');
  $('skipHint').hidden = true;
  camera.fov = 68; camera.updateProjectionMatrix();
  const r = CUT.resolve; CUT.resolve = null; if (r) r();
}
function skipCutscene() { if (CUT.on) { sfx('click'); endCutscene(true); } }

// small unvoiced note near the crosshair (locked doors, controls)
let noteTimer = 0;
function note(text, secs = 3.2) { const el = $('note'); el.textContent = text; el.classList.add('on'); noteTimer = secs; }
function updateNote(dt) { if (noteTimer > 0) { noteTimer -= dt; if (noteTimer <= 0) $('note').classList.remove('on'); } }
