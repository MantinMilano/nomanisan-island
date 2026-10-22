// ============================================================ developer and testing menu (F2 or `)
const DEV = { god: false, noDetect: false, allPowers: false, fps: false };
try { Object.assign(DEV, JSON.parse(localStorage.getItem('nomanisan.dev') || '{}')); } catch (e) { /* storage blocked */ }
function devSave() { try { localStorage.setItem('nomanisan.dev', JSON.stringify(DEV)); } catch (e) { /* storage blocked */ } }
function devApply() { HERO.god = DEV.god; GAME.noDetect = DEV.noDetect; applyUpgrades(); $('fps').hidden = !DEV.fps; }
function devLocations() {
  const R = POI.radio, Y = BASE_Y, C = POI.caveChamber, o = POI.omni, ll = POI.lavaLook, b = POI.battery, sp = W2.boatSpawn;
  const at = (x, z, y, face) => ({ x, z, y, yaw: face ?? 0 });
  return [
    ['Beach (the wreck)', () => ({ ...sp })],
    ['Jetty', () => at(POI.start.x, POI.start.z, null, Math.atan2(POI.out.x, POI.out.z))],
    ['Jungle trail', () => at(POI.J1.x, POI.J1.z + 4, null, Math.PI)],
    ['Test clearing', () => at(o.x + 12, o.z + 10, null, lookYaw({ x: o.x + 12, z: o.z + 10 }, o))],
    ['Missile battery', () => at(b.x + 14, b.z - 10, null, lookYaw({ x: b.x + 14, z: b.z - 10 }, b))],
    ['Lava lookout', () => at(ll.x, ll.z, null, -Math.PI / 2)],
    ['Radio hill', () => SP.radio()],
    ['Radio tower top', () => at(R.x - 2.6, R.z, W2.towerTop, -Math.PI / 2)],
    ['Waterfall pool', () => at(POI.poolSouth.x, POI.poolSouth.z, null, lookYaw(POI.poolSouth, POI.door))],
    ['Cave by the falls', () => at(C.x, C.z, C.y, lookYaw(C, { x: VX, z: VZ }))],
    ['Volcano gate', () => at(0, POI.plaza.z + 10, null, 0)],
    ['Outpost', () => at(-18, POI.plaza.z + 16, null, 0.6)],
    ['Crater rim station', () => SP.rim()],
    ['Crater floor', () => SP.crater()],
    ['Security checkpoint', () => at(-73.5, -2, Y, -Math.PI / 2)],
    ['Grand hall', () => SP.hall()],
    ['Dining room', () => at(29, -14, Y, -Math.PI / 2)],
    ['Kronos computer', () => SP.computer()],
    ['Geothermal plant', () => SP.lab()],
    ['Trophy room', () => at(14, -60, Y, -Math.PI / 2)],
    ['Launch silo', () => at(0, -80, Y, 0)],
    ['Containment', () => SP.containment()],
    ['Heart cavern', () => at(GRATE.x + 1.5, GRATE.z, HEART.y, lookYaw(GRATE, HEART))],
  ];
}
function buildDevMenu() {
  const M_ = $('devMissions'), L = $('devPlaces'), T = $('devToggles'), A = $('devActions');
  M_.innerHTML = MISSIONS.map((m, i) => `<button type="button" data-m="${i}"><span>${i < 13 ? i : '★'}</span>${escapeHtml(m.name)}</button>`).join('');
  M_.onclick = (e) => { const b = e.target.closest('button[data-m]'); if (!b) return; closeDev(); jumpToMission(+b.dataset.m); };
  const locs = devLocations();
  L.innerHTML = locs.map(([n], i) => `<button type="button" data-l="${i}">${escapeHtml(n)}</button>`).join('');
  L.onclick = (e) => { const b = e.target.closest('button[data-l]'); if (!b) return; const cp = locs[+b.dataset.l][1](); closeDev(); placeHero(cp); calmAllEnemies(); };
  const toggles = [
    ['god', 'God mode'], ['noDetect', 'Cameras ignore you'], ['allPowers', 'Extra strength'], ['fps', 'Show FPS'],
  ];
  T.innerHTML = toggles.map(([k, n]) => `<button type="button" class="toggle" data-t="${k}" aria-pressed="${DEV[k]}">${n}</button>`).join('')
    + `<button type="button" class="toggle" data-t="skip" aria-pressed="${DLG.skipAll}">Skip all dialogue</button>`
    + `<button type="button" class="toggle" data-t="boots" aria-pressed="${HERO.boots}">Rocket boots</button>`;
  T.onclick = (e) => {
    const b = e.target.closest('button[data-t]'); if (!b) return;
    const k = b.dataset.t;
    if (k === 'skip') { DLG.skipAll = !DLG.skipAll; try { localStorage.setItem('nomanisan.skipDialogue', DLG.skipAll ? 'on' : 'off'); } catch (er) { /* storage blocked */ } if (DLG.skipAll) skipLine(); }
    else if (k === 'boots') takeBoots(!HERO.boots);
    else { DEV[k] = !DEV[k]; devSave(); devApply(); }
    refreshDev();
  };
  const actions = [
    ['step', 'Complete current step'], ['restart', 'Restart this mission'], ['checkpoint', 'Back to checkpoint'], ['line', 'Skip dialogue line'],
    ['kill', 'Destroy all enemies'], ['heal', 'Full health'], ['shards', 'Collect all echo shards'], ['reset', 'Erase saved game'],
  ];
  A.innerHTML = actions.map(([k, n]) => `<button type="button" data-a="${k}">${n}</button>`).join('');
  A.onclick = (e) => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const k = b.dataset.a;
    if (k === 'step') { STORY.skipStep = true; if (CUT.on) skipCutscene(); skipLine(); }
    if (k === 'restart') { closeDev(); jumpToMission(STORY.mission); return; }
    if (k === 'checkpoint') { closeDev(); respawnHero(); return; }
    if (k === 'line') skipLine();
    if (k === 'kill') { for (const en of ENEMIES.slice()) if (en.alive) killEnemy(en); }
    if (k === 'heal') HERO.hp = HERO.maxHp;
    if (k === 'shards') { for (const s of SHARDS) if (!s.got) { s.got = true; s.sc.done = true; STORY.shards.add(s.id); } applyUpgrades(); saveGame(); toast('Dev', 'All echo shards collected', ''); }
    if (k === 'reset') { try { localStorage.removeItem('nomanisan.save2'); } catch (er) { /* storage blocked */ } toast('Dev', 'Saved game erased', 'The next start begins at Landfall.'); }
    refreshDev();
  };
  $('devDay').onclick = () => { setTimeOfDay(SKY.dayTarget < 0.5); refreshDev(); };
  $('devWeather').onclick = (e) => { const b = e.target.closest('button[data-w]'); if (b) { setWeather(b.dataset.w); refreshDev(); } };
  $('devClose').onclick = closeDev;
}
function refreshDev() {
  for (const b of $('devMissions').children) b.classList.toggle('cur', +b.dataset.m === STORY.mission);
  for (const b of $('devToggles').children) { const k = b.dataset.t; b.setAttribute('aria-pressed', String(k === 'skip' ? DLG.skipAll : k === 'boots' ? HERO.boots : DEV[k])); }
  $('devDay').textContent = SKY.dayTarget > 0.5 ? 'Day' : 'Night';
  for (const b of $('devWeather').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.w === SKY.weather));
  $('devState').textContent = `Mission ${STORY.mission}: ${MISSIONS[STORY.mission].name}  ·  ${STORY.objective || 'no objective'}  ·  HP ${Math.round(HERO.hp)}/${HERO.maxHp}  ·  shards ${STORY.shards.size}/10`;
}
function openDev() {
  if (!GAME.started || GAME.mode === 'title' || GAME.mode === 'dev' || GAME.mode === 'ending') return;
  if (CUT.on) skipCutscene();
  if (GAME.mode === 'terminal') closeTerminal();
  $('pause').hidden = true; $('journal').hidden = true;
  GAME.devPrev = 'play';
  GAME.mode = 'dev';
  releasePointer();
  $('dev').hidden = false;
  refreshDev();
}
function closeDev() { $('dev').hidden = true; if (GAME.mode === 'dev') GAME.mode = GAME.devPrev || 'play'; lockPointer(); }
// skip whatever the current objective is waiting for (N, or the pause menu)
function skipStepNow() {
  if (!GAME.started) return;
  STORY.skipStep = true;
  if (CUT.on) skipCutscene();
  skipLine();
  note('Step skipped.', 1.5);
}
// frame counter
let fpsN = 0, fpsT = 0;
function updateFps(dt) { if (!DEV.fps) return; fpsN++; fpsT += dt; if (fpsT >= 0.5) { $('fps').textContent = `${Math.round(fpsN / fpsT)} fps · ${renderer.info.render.calls} draws`; fpsN = 0; fpsT = 0; } }
