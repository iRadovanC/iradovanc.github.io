/* SIGNAL — vanilla JavaScript / Canvas 2D. No assets, libraries or network needed. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    $('start-screen').innerHTML = '<h2>Canvas není dostupný.</h2><p>Otevři hru v prohlížeči s podporou Canvas 2D.</p>';
    return;
  }
  const DURATION = 60;
  const WORLD_EDGE = 450;
  const MIN_SPEED = 145;
  const MAX_SPEED = 300;
  const CRUISE_SPEED = 215;
  const HIT_RADIUS = 48;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ui = Object.fromEntries(['score', 'timer', 'round-clock', 'round-timer', 'round-progress', 'best', 'misses', 'accuracy', 'speed', 'speed-bar', 'drone-number', 'drone-state', 'arena-status', 'flight-label', 'feedback', 'overlay', 'start-screen', 'pause-screen', 'result-screen', 'pause-button', 'mobile-hint'].map(id => [id, $(id)]));
  const keys = new Set();
  const pointer = { active: false, x: 0, throttle: CRUISE_SPEED, id: null, type: 'mouse' };
  const state = {
    mode: 'ready', elapsed: 0, clock: 0, hits: 0, misses: 0, sortie: 1,
    streak: 0, bestStreak: 0, best: readStorage('signal-best-v1', 0),
    drone: { x: -105, z: 0, speed: CRUISE_SPEED, tilt: 0 }, target: null,
    transition: 0, feedbackTime: 0, particles: [], rings: [], trail: [],
    cameraZ: 0, cameraX: 0, shake: 0, sound: readStorage('signal-sound-v1', false),
  };
  let width = 900, height = 576, scale = 1, pixelRatio = 1;
  let lastTime = null, audioContext = null, hudTime = 0;
  let storageAvailable = true;

  function readStorage(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      if (typeof value !== typeof fallback) return fallback;
      return typeof value === 'number' ? (Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback) : value;
    } catch { return fallback; }
  }
  function saveStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { storageAvailable = false; }
  }
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const random = (min, max) => min + Math.random() * (max - min);
  const pad = (n) => String(n).padStart(2, '0');

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    scale = Math.min(width / 1030, height / 620);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  // The whole ground is an orthographic scene with a little depth compression.
  // Physics stay in world coordinates, independent of screen size and resolution.
  function project(x, z, altitude = 0) {
    const depth = z - state.cameraZ;
    const perspective = clamp(1 - depth * .00032, .62, 1.1);
    const forwardScale = height / 740;
    return {
      x: width / 2 + (x - state.cameraX) * scale * perspective,
      y: height * .79 - depth * forwardScale * .65 - altitude * scale * perspective,
      s: scale * perspective,
    };
  }

  function roundDifficulty() {
    const progress = clamp(state.elapsed / (DURATION - 5), 0, 1);
    // Ease into the first flights, then increase continuously regardless of score.
    return progress * progress * (3 - 2 * progress);
  }

  function updateTarget(target, dt) {
    const difficulty = target.preview ? 0 : roundDifficulty();
    target.amplitude = target.baseAmplitude * (1 + .9 * difficulty);
    target.frequency = target.baseFrequency + .95 * difficulty;
    target.phase += dt * target.frequency;
    const weave = .2 * difficulty;
    const offset = (Math.sin(target.phase) + weave * Math.sin(target.phase * 2.7 + target.weavePhase)) / (1 + weave);
    const previousX = target.x;
    target.x = target.center + offset * target.amplitude;
    target.direction = Math.sign(target.x - previousX) || target.direction;
    target.z += target.speed * dt;
  }

  function spawnTarget(preview = false) {
    const baseAmplitude = preview ? 125 : random(88, 110);
    // Reserve room for the largest later swing, including targets already in flight.
    const maxAmplitude = baseAmplitude * (preview ? 1 : 1.9);
    const center = preview ? 110 : random(-WORLD_EDGE + maxAmplitude + 35, WORLD_EDGE - maxAmplitude - 35);
    const phase = preview ? .6 : random(0, Math.PI * 2);
    state.target = {
      x: center, center, phase, baseAmplitude, maxAmplitude, preview,
      baseFrequency: preview ? .38 : random(.7, .9),
      weavePhase: preview ? 0 : random(0, Math.PI * 2), direction: 1,
      z: state.drone.z + (preview ? 440 : random(540, 670)),
      speed: preview ? 0 : random(18, 32), radius: HIT_RADIUS,
    };
    updateTarget(state.target, 0);
  }

  function unlockAudio() {
    if (!state.sound) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioContext ??= new AudioContext();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch { /* Audio is optional, including in restricted file:// contexts. */ }
  }

  function tone(frequency, duration, type = 'sine', volume = .045, delay = 0) {
    if (!state.sound || !audioContext || audioContext.state !== 'running') return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + .012);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  function updateSoundButton() {
    const button = $('sound-button');
    const label = state.sound ? 'Vypnout zvuk' : 'Zapnout zvuk';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(state.sound));
    button.title = `${label} (M)`;
    button.querySelector('use').setAttribute('href', state.sound ? '#i-sound' : '#i-muted');
  }

  function clearInput() {
    keys.clear();
    pointer.active = false;
    pointer.id = null;
  }

  function showScreen(screen) {
    ui.overlay.hidden = !screen;
    for (const name of ['start', 'pause', 'result']) ui[`${name}-screen`].hidden = name !== screen;
  }

  function startGame() {
    clearInput();
    Object.assign(state, { mode: 'playing', elapsed: 0, hits: 0, misses: 0, sortie: 1, streak: 0, bestStreak: 0, transition: 0, feedbackTime: 0, cameraZ: 0, cameraX: 0, shake: 0 });
    Object.assign(state.drone, { x: 0, z: 0, speed: CRUISE_SPEED, tilt: 0 });
    state.particles.length = 0;
    state.rings.length = 0;
    state.trail.length = 0;
    ui.feedback.className = 'flight-feedback';
    ui.feedback.textContent = '';
    showScreen(null);
    spawnTarget();
    ui['pause-button'].disabled = false;
    ui['mobile-hint'].style.display = window.matchMedia('(pointer: coarse)').matches ? 'block' : 'none';
    canvas.focus({ preventScroll: true });
    const arenaBounds = $('arena').getBoundingClientRect();
    if (arenaBounds.bottom > window.innerHeight || arenaBounds.top < 0) {
      $('arena').scrollIntoView({ block: 'center', behavior: reducedMotion ? 'instant' : 'smooth' });
    }
    unlockAudio();
    tone(440, .13);
    tone(660, .2, 'sine', .04, .1);
    lastTime = performance.now();
    updateHUD();
    $('announcer').textContent = 'Let začíná. Máš 60 sekund.';
  }

  function pauseGame() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    clearInput();
    showScreen('pause');
    ui['pause-button'].disabled = true;
    updateHUD();
    $('resume-button').focus({ preventScroll: true });
  }

  function resumeGame() {
    if (state.mode !== 'paused') return;
    state.mode = 'playing';
    clearInput();
    showScreen(null);
    lastTime = performance.now();
    ui['pause-button'].disabled = false;
    canvas.focus({ preventScroll: true });
    unlockAudio();
    updateHUD();
  }

  function finishGame() {
    state.mode = 'finished';
    state.elapsed = DURATION;
    clearInput();
    const newBest = state.hits > state.best;
    if (newBest) { state.best = state.hits; saveStorage('signal-best-v1', state.best); }
    showScreen('result');
    ui.feedback.className = 'flight-feedback';
    ui.feedback.textContent = '';
    ui['mobile-hint'].style.display = 'none';
    $('result-eyebrow').textContent = newBest ? 'NOVÝ OSOBNÍ REKORD' : 'MISE DOKONČENA';
    $('result-title').textContent = state.hits >= 12 ? 'Přesnost v krvi.' : state.hits >= 6 ? 'To byl dobrý let.' : state.hits ? 'První signály chyceny.' : 'Další let bude tvůj.';
    $('result-copy').textContent = newBest ? (storageAvailable ? 'Laťka je o kousek výš. Překonáš ji znovu?' : 'Nový rekord! V tomto prohlížeči se ale nepodařilo uložit ho na příště.') : 'Minuta utekla. Na další pokus máš celou letku.';
    $('result-score').textContent = state.hits;
    $('result-accuracy').textContent = `${accuracy()} %`;
    $('result-streak').textContent = state.bestStreak;
    ui['pause-button'].disabled = true;
    updateHUD();
    tone(523, .2); tone(659, .2, 'sine', .045, .12); tone(784, .4, 'sine', .04, .24);
    $('announcer').textContent = `Konec mise. Počet zásahů: ${state.hits}. Úspěšnost: ${accuracy()} procent.`;
    $('replay-button').focus({ preventScroll: true });
  }

  function accuracy() {
    const attempts = state.hits + state.misses;
    return attempts ? Math.round(state.hits / attempts * 100) : 0;
  }

  function updateHUD() {
    const seconds = Math.max(0, Math.ceil(DURATION - state.elapsed));
    ui.score.textContent = pad(state.hits);
    ui.timer.textContent = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
    ui.timer.parentElement.classList.toggle('urgent', seconds <= 10);
    ui['round-timer'].textContent = ui.timer.textContent;
    ui['round-progress'].style.width = `${clamp(1 - state.elapsed / DURATION, 0, 1) * 100}%`;
    ui['round-clock'].classList.toggle('urgent', seconds <= 10);
    ui['round-clock'].classList.toggle('ticking', seconds <= 10 && state.mode === 'playing');
    ui.best.textContent = pad(state.best);
    ui.misses.textContent = pad(state.misses);
    ui.accuracy.textContent = state.hits + state.misses ? `${accuracy()} %` : '—';
    const flying = state.mode === 'playing' && !state.transition;
    ui.speed.textContent = flying ? Math.round(state.drone.speed * .3) : '0';
    ui['speed-bar'].style.width = flying ? `${state.drone.speed / MAX_SPEED * 100}%` : '0%';
    ui['drone-number'].textContent = `DRN–${String(state.sortie).padStart(3, '0')}`;
    ui['drone-state'].textContent = flying ? 'IN FLIGHT' : state.mode === 'paused' ? 'PAUSED' : state.mode === 'finished' ? 'DONE' : state.transition ? 'NEXT' : 'READY';
    const level = Math.min(4, 1 + Math.floor(state.elapsed / 15));
    ui['arena-status'].textContent = state.mode === 'playing' ? `ZÁSAHY ${pad(state.hits)} · ÚROVEŇ ${level}/4` : state.mode === 'paused' ? 'LET POZASTAVEN' : state.mode === 'finished' ? 'MISE DOKONČENA' : 'ČEKÁM NA PILOTA';
    ui['flight-label'].textContent = state.mode === 'playing' ? `DRN–${String(state.sortie).padStart(3, '0')} / ${state.transition ? 'DALŠÍ DRON SE PŘIPRAVUJE' : 'LETÍŠ · P / ESC = PAUZA'}` : 'LETOVÝ SYSTÉM ONLINE';
  }

  function resolveFlight(hit) {
    if (state.transition || state.mode !== 'playing') return;
    if (hit) {
      state.hits++;
      state.streak++;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      ui.feedback.innerHTML = `Cíl zasažen. <small>+1 ZÁSAH${state.streak > 1 ? ` · ${state.streak} V ŘADĚ` : ''}</small>`;
      ui.feedback.className = 'flight-feedback visible';
      const { x, z } = state.drone;
      state.rings.push({ x, z, life: .7, maxLife: .7 });
      for (let i = 0; i < 25; i++) {
        const angle = random(0, Math.PI * 2);
        const velocity = random(35, 190);
        state.particles.push({ x, z, vx: Math.cos(angle) * velocity, vz: Math.sin(angle) * velocity, life: random(.3, .85), maxLife: .85, size: random(2, 5) });
      }
      state.shake = reducedMotion ? 0 : 3;
      tone(740, .13, 'sine'); tone(1109, .25, 'sine', .04, .08);
    } else {
      state.misses++;
      state.streak = 0;
      ui.feedback.innerHTML = 'Těsně vedle. <small>NOVÝ DRON. NOVÁ ŠANCE.</small>';
      ui.feedback.className = 'flight-feedback visible missed';
      tone(190, .19, 'triangle', .03); tone(140, .23, 'triangle', .025, .12);
    }
    state.feedbackTime = 1.25;
    state.transition = .62;
    state.target = null;
    updateHUD();
  }

  // Sweep the relative movement segment so a fast drone cannot tunnel through a target.
  function sweptHit(oldX, oldZ, newX, newZ, radius) {
    const dx = newX - oldX, dz = newZ - oldZ;
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared ? clamp(-(oldX * dx + oldZ * dz) / lengthSquared, 0, 1) : 0;
    return Math.hypot(oldX + dx * t, oldZ + dz * t) <= radius;
  }

  function update(dt) {
    if (state.mode === 'paused' || state.mode === 'finished') return;
    state.clock += dt;
    if (state.mode === 'ready') {
      updateTarget(state.target, dt);
      return;
    }
    if (state.feedbackTime > 0) {
      state.feedbackTime -= dt;
      if (state.feedbackTime <= 0) {
        ui.feedback.className = 'flight-feedback';
        ui.feedback.textContent = '';
      }
    }
    if (state.elapsed > 4) ui['mobile-hint'].style.display = 'none';
    const d = state.drone;
    if (state.transition > 0) {
      state.transition = Math.max(0, state.transition - dt);
      if (!state.transition) {
        state.sortie++;
        d.x = 0;
        d.tilt = 0;
        d.speed = CRUISE_SPEED;
        state.trail.length = 0;
        spawnTarget();
        updateHUD();
      }
    } else {
      const oldX = d.x, oldZ = d.z;
      let desiredSpeed = CRUISE_SPEED;
      let lateral = 0;
      if (keys.size) {
        lateral = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
        if (keys.has('ArrowUp') || keys.has('w')) desiredSpeed = MAX_SPEED;
        if (keys.has('ArrowDown') || keys.has('s')) desiredSpeed = MIN_SPEED;
      } else if (pointer.active) {
        lateral = clamp((pointer.x - d.x) / 72, -1, 1);
        desiredSpeed = pointer.throttle;
      }
      d.speed = lerp(d.speed, desiredSpeed, 1 - Math.exp(-dt * 4));
      d.x = clamp(d.x + lateral * 345 * dt, -WORLD_EDGE, WORLD_EDGE);
      d.z += d.speed * dt;
      d.tilt = lerp(d.tilt, lateral * .28, 1 - Math.exp(-dt * 9));
      const t = state.target;
      if (t) {
        const oldTX = t.x, oldTZ = t.z;
        updateTarget(t, dt);
        if (sweptHit(oldX - oldTX, oldZ - oldTZ, d.x - t.x, d.z - t.z, HIT_RADIUS)) resolveFlight(true);
        else if (d.z > t.z + HIT_RADIUS + 18) resolveFlight(false);
      }
      if (!reducedMotion) {
        state.trail.push({ x: d.x, z: d.z - 18, life: .5 });
        if (state.trail.length > 35) state.trail.shift();
      }
    }
    state.cameraZ = d.z;
    state.cameraX = lerp(state.cameraX, d.x * .08, 1 - Math.exp(-dt * 2));
    state.shake *= Math.exp(-dt * 12);
    for (const p of state.particles) { p.x += p.vx * dt; p.z += p.vz * dt; p.life -= dt; }
    for (const r of state.rings) r.life -= dt;
    for (const t of state.trail) t.life -= dt;
    state.particles = state.particles.filter(p => p.life > 0);
    state.rings = state.rings.filter(r => r.life > 0);
    state.trail = state.trail.filter(t => t.life > 0);
  }

  function polygon(points, fill, stroke = null, lineWidth = 1) {
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) ctx[i ? 'lineTo' : 'moveTo'](points[i][0], points[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function line(x1, y1, x2, y2, color, lineWidth = 1) {
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function ellipse(x, y, rx, ry, color, stroke = null, lineWidth = 1) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
    if (color) { ctx.fillStyle = color; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function worldPolygon(coords, fill, stroke = null) {
    polygon(coords.map(([x, z]) => { const p = project(x, z); return [p.x, p.y]; }), fill, stroke);
  }

  // Seeded scenery is generated from its strip index; the world needs no large map.
  function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function drawBlock(x, z, w, depth, altitude, color) {
    const corners = [[x - w / 2, z - depth / 2], [x + w / 2, z - depth / 2], [x + w / 2, z + depth / 2], [x - w / 2, z + depth / 2]];
    const bottom = corners.map(([px, pz]) => project(px, pz));
    const top = corners.map(([px, pz]) => project(px, pz, altitude));
    polygon([[bottom[0].x, bottom[0].y], [bottom[1].x, bottom[1].y], [top[1].x, top[1].y], [top[0].x, top[0].y]], '#253027');
    polygon([[bottom[1].x, bottom[1].y], [bottom[2].x, bottom[2].y], [top[2].x, top[2].y], [top[1].x, top[1].y]], '#344132');
    polygon(top.map(p => [p.x, p.y]), color, '#71835a32');
    line(top[0].x, top[0].y, top[1].x, top[1].y, '#96a8773a');
  }

  function drawGround() {
    ctx.fillStyle = '#29382b'; ctx.fillRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#3e4b302a'); gradient.addColorStop(.65, '#6e794016'); gradient.addColorStop(1, '#182c250e');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    const base = Math.floor(state.cameraZ / 180);
    for (let strip = base + 8; strip >= base - 3; strip--) {
      const z = strip * 180;
      worldPolygon([[-850,z],[-490,z],[-490,z+175],[-850,z+175]], strip % 3 ? '#3b472c5e' : '#4b553840');
      worldPolygon([[500,z],[950,z],[950,z+175],[500,z+175]], strip % 2 ? '#42513665' : '#3a492a50');
      if (strip % 5 === 0) worldPolygon([[-900,z+60],[900,z+60],[900,z+91],[-900,z+91]], '#8292670a');
      for (let side = -1; side <= 1; side += 2) {
        const seed = strip * 3.17 + side * 721;
        for (let j = 0; j < 5; j++) {
          const tx = side * (520 + hash(seed + j) * 310);
          const tz = z + hash(seed + j * 4.1) * 180;
          const p = project(tx + 8, tz - 6);
          const r = (11 + hash(seed + j * 9) * 18) * p.s;
          ellipse(p.x + r * .4, p.y + r * .4, r * 1.1, r * .58, '#111f1c37');
          const q = project(tx, tz, 5);
          ellipse(q.x, q.y, r, r * .67, '#405234');
          ellipse(q.x - r * .15, q.y - r * .13, r * .76, r * .5, '#495b38');
          ellipse(q.x - r * .24, q.y - r * .21, r * .47, r * .33, '#51633b');
        }
        if (hash(seed + 10) > .5) drawBlock(side * (570 + hash(seed) * 110), z + 90, 60 + hash(seed+1)*70, 63, 17, '#4c5840');
      }
    }
    // Fine survey grid and runway boundaries.
    for (let x = -450; x <= 450; x += 90) {
      const near = project(x, state.cameraZ - 260), far = project(x, state.cameraZ + 1200);
      line(near.x, near.y, far.x, far.y, x === 0 ? '#b6c88a11' : '#a0b47a0b');
    }
    const gridBase = Math.floor(state.cameraZ / 90);
    for (let i = gridBase - 3; i <= gridBase + 14; i++) {
      const a = project(-475, i*90), b = project(475, i*90);
      line(a.x, a.y, b.x, b.y, '#a0b47a0d');
      if (i % 2 === 0) for (const x of [-360, -180, 0, 180, 360]) {
        const p = project(x, i * 90);
        line(p.x-3, p.y, p.x+3, p.y, '#b0c28b22');
        line(p.x, p.y-3, p.x, p.y+3, '#b0c28b22');
      }
    }
    for (const side of [-1,1]) {
      const a = project(side * 485, state.cameraZ - 270), b = project(side * 485, state.cameraZ + 1200);
      line(a.x, a.y, b.x, b.y, '#b3c38721');
      for (let i = gridBase - 3; i <= gridBase + 13; i++) {
        const p = project(side * 485, i * 90);
        line(p.x, p.y, p.x + side * 7 * p.s, p.y, '#bbcd9260');
      }
    }
    const shade = ctx.createLinearGradient(0, 0, 0, height);
    shade.addColorStop(0,'#101f2669'); shade.addColorStop(.2,'#18282000'); shade.addColorStop(.8,'#18282000'); shade.addColorStop(1,'#12201bb3');
    ctx.fillStyle = shade; ctx.fillRect(0,0,width,height);
    ctx.font = '8px Consolas, monospace'; ctx.fillStyle = '#b1c09242';
    ctx.fillText('N', width / 2 - 3, 70);
    line(width / 2, 77, width / 2, 93, '#b1c09238');
    polygon([[width/2-3,80],[width/2,76],[width/2+3,80]], '#b1c09255');
  }

  function drawTarget() {
    const t = state.target;
    if (!t) return;
    const p = project(t.x, t.z, 7);
    const visualScale = Math.max(p.s, .53);
    const r = HIT_RADIUS * p.s;
    const pulse = reducedMotion ? .5 : (Math.sin(state.clock * 3) + 1) / 2;
    const shadow = project(t.x+7,t.z-8);
    ellipse(shadow.x,shadow.y,r*1.2,r*.74,'#101b1655');
    ellipse(p.x,p.y+5*p.s,r,r*.7,'#946447');
    ellipse(p.x,p.y,r,r*.7,'#524730','#efb37b',1.5);
    ellipse(p.x,p.y,r*.75,r*.75*.7,null,'#efb37b55');
    ellipse(p.x,p.y,r*.45,r*.45*.7,'#f1b27415','#f1b274aa');
    ellipse(p.x,p.y,r*(1.1+pulse*.35),r*.7*(1.1+pulse*.35),null,`rgba(242,177,117,${.24-pulse*.15})`);
    ctx.save(); ctx.translate(p.x,p.y); ctx.scale(visualScale,visualScale);
    // Small moving signal beacon on the landing puck.
    polygon([[-13,5],[0,13],[13,5],[13,-6],[0,-14],[-13,-6]],'#9c714c','#f7c68e',1);
    polygon([[-13,-6],[0,1],[13,-6],[0,-14]],'#f0bb7c');
    line(0,-8,0,-24,'#f7d8a9',2);
    ellipse(0,-25,3,3,'#ffe3aa');
    ctx.restore();
    if (state.mode !== 'ready') {
      const direction = t.direction;
      const arrowX = p.x + direction * (r + 13);
      line(arrowX-direction*4,p.y,arrowX+direction*6,p.y,'#f1ba85a0');
      line(arrowX+direction*2,p.y-4,arrowX+direction*6,p.y,'#f1ba85a0');
      line(arrowX+direction*2,p.y+4,arrowX+direction*6,p.y,'#f1ba85a0');
    }
    const labelY = p.y - Math.max(r * .7, 17) - 21;
    ctx.font = '8px Consolas, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#f3c090';ctx.fillText('CÍL ' + String(state.sortie).padStart(2,'0'),p.x,labelY);
    ctx.font = '7px Consolas, monospace';ctx.fillStyle = '#ddbc9585';ctx.fillText(`${Math.max(0,Math.round((t.z-state.drone.z)/4))} m`,p.x,labelY+12);
    ctx.textAlign = 'left';
  }

  function drawDrone() {
    if (state.transition > 0) return;
    const d = state.drone;
    // A projected approach line helps judge the intercept.
    if (state.mode === 'playing') {
      const a = project(d.x,d.z+45), b = project(d.x,d.z+235);
      ctx.setLineDash([3,7]);line(a.x,a.y,b.x,b.y,'#d5fb7833');ctx.setLineDash([]);
    }
    for (let i = 1; i < state.trail.length; i++) {
      const a = project(state.trail[i-1].x,state.trail[i-1].z,19);
      const b = project(state.trail[i].x,state.trail[i].z,19);
      line(a.x,a.y,b.x,b.y,`rgba(216,251,138,${state.trail[i].life*.18})`,2);
    }
    const shadow = project(d.x+11,d.z-11);
    ellipse(shadow.x,shadow.y,37*scale,20*scale,'#101c1980');
    const hover = reducedMotion ? 0 : Math.sin(state.clock*3)*1.4;
    const p = project(d.x,d.z,24+hover);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(d.tilt);ctx.scale(Math.max(p.s,.65),Math.max(p.s,.65));
    line(-22,-19,22,19,'#152320',7);line(-22,19,22,-19,'#152320',7);
    line(-22,-19,22,19,'#b8c7a1',4);line(-22,19,22,-19,'#b8c7a1',4);
    for (const x of [-24,24]) for (const y of [-20,20]) {
      ellipse(x,y+2,14,10,'#19282080');
      ellipse(x,y,14,10,'#d9e6bc10','#c1d3a461',1);
      const angle = reducedMotion ? .7 : state.clock*55 + x+y;
      line(x-Math.cos(angle)*12,y-Math.sin(angle)*8,x+Math.cos(angle)*12,y+Math.sin(angle)*8,'#d9e8bcaa',2);
      ellipse(x,y,3,2.5,'#d5dfc3');
    }
    polygon([[-9,13],[-10,-8],[-5,-18],[5,-18],[10,-8],[9,13],[0,18]],'#819274','#10251c',1.5);
    polygon([[-8,10],[-8,-9],[-4,-16],[4,-16],[8,-9],[8,10],[0,14]],'#dfebcc');
    polygon([[-5,-7],[0,-12],[5,-7],[4,3],[-4,3]],'#2c4938');
    line(-4,8,4,8,'#8fb061',2);
    ellipse(0,-16,2.5,1.5,'#e8ffb2');
    ellipse(-24,20,2,1.5,'#d5fb78');ellipse(24,20,2,1.5,'#d5fb78');
    ctx.restore();
    if (state.mode === 'playing') {
      ctx.textAlign='center';ctx.font='9px Consolas, monospace';ctx.fillStyle='#d7e7bdbb';ctx.fillText('533. PBS',p.x,p.y+Math.max(44*p.s,35));ctx.textAlign='left';
    }
  }

  function drawEffects() {
    for (const ring of state.rings) {
      const p=project(ring.x,ring.z,5);const progress=1-ring.life/ring.maxLife;
      ellipse(p.x,p.y,(25+progress*130)*p.s,(25+progress*130)*p.s*.7,null,`rgba(213,251,120,${1-progress})`,2);
    }
    for (const particle of state.particles) {
      const p=project(particle.x,particle.z,12);ctx.globalAlpha=clamp(particle.life/particle.maxLife,0,1);
      ctx.fillStyle='#e4ffa4';ctx.fillRect(p.x,p.y,particle.size*p.s,particle.size*p.s);
    }
    ctx.globalAlpha=1;
  }

  function render() {
    ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    ctx.save();
    if(state.shake>.1) ctx.translate(Math.sin(state.clock*83)*state.shake,Math.cos(state.clock*69)*state.shake);
    drawGround();drawTarget();drawDrone();drawEffects();
    ctx.restore();
  }

  function frame(now) {
    const rawDt=lastTime===null?0:Math.max(0,(now-lastTime)/1000);
    lastTime=now;
    if(state.mode==='playing') {
      // Wall-clock time stays honest even if a slow frame limits physics catch-up.
      const remaining=DURATION-state.elapsed;
      const activeTime=Math.min(rawDt,remaining);
      let simulationTime=Math.min(activeTime,.25);
      while(simulationTime>0) { const step=Math.min(simulationTime,1/120);update(step);simulationTime-=step; }
      state.elapsed+=activeTime;
      if(state.elapsed>=DURATION) finishGame();
    } else if(state.mode==='ready') update(Math.min(rawDt,.05));
    hudTime+=rawDt;
    if(hudTime>.1) { updateHUD();hudTime=0; }
    render();requestAnimationFrame(frame);
  }

  function movePointer(event) {
    if(state.mode!=='playing') return;
    if(event.pointerType!=='mouse'&&pointer.id!==event.pointerId) return;
    if(event.pointerType==='mouse'&&keys.size) return;
    const rect=canvas.getBoundingClientRect();
    pointer.x=clamp((event.clientX-rect.left-width/2)/scale+state.cameraX,-WORLD_EDGE,WORLD_EDGE);
    const y=clamp((event.clientY-rect.top)/height,0,1);
    pointer.throttle=lerp(MAX_SPEED,MIN_SPEED,clamp((y-.12)/.78,0,1));
    pointer.active=true;pointer.type=event.pointerType;
    ui['mobile-hint'].style.display='none';
  }

  canvas.addEventListener('pointermove',movePointer);
  canvas.addEventListener('pointerdown',event=>{
    if(state.mode!=='playing'||(pointer.id!==null&&event.pointerId!==pointer.id)) return;
    pointer.id=event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    canvas.focus({preventScroll:true});unlockAudio();movePointer(event);
  });
  function endPointer(event) {
    if(pointer.id!==event.pointerId) return;
    pointer.id=null;
    if(event.pointerType!=='mouse') pointer.active=false;
  }
  canvas.addEventListener('pointerup',endPointer);
  canvas.addEventListener('pointercancel',event=>{
    if(pointer.id===event.pointerId) {endPointer(event);pointer.active=false;}
  });
  canvas.addEventListener('lostpointercapture',endPointer);
  canvas.addEventListener('pointerleave',()=>{if(pointer.id===null) pointer.active=false;});
  canvas.addEventListener('contextmenu',event=>event.preventDefault());

  const movementKeys=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d']);
  document.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey) return;
    const key=event.key.length===1?event.key.toLowerCase():event.key;
    if(key==='Tab'&&state.mode==='playing') { pauseGame();return; }
    if(movementKeys.has(key)&&state.mode==='playing') {
      event.preventDefault();keys.add(key);pointer.active=false;return;
    }
    if(event.repeat) return;
    if(key==='p'||key==='Escape') {
      if(state.mode==='playing') {event.preventDefault();pauseGame();}
      else if(state.mode==='paused') {event.preventDefault();resumeGame();}
    } else if(key==='m') {event.preventDefault();$('sound-button').click();}
    else if(key==='Enter'&&event.target.tagName!=='BUTTON'&&event.target.tagName!=='A') {
      event.preventDefault();if(state.mode==='paused') resumeGame();else if(state.mode!=='playing') startGame();
    }
  });
  document.addEventListener('keyup',event=>keys.delete(event.key.length===1?event.key.toLowerCase():event.key));
  window.addEventListener('blur',pauseGame);
  document.addEventListener('visibilitychange',()=>{if(document.hidden) pauseGame();});
  $('start-button').addEventListener('click',startGame);
  $('replay-button').addEventListener('click',startGame);
  $('restart-button').addEventListener('click',startGame);
  $('resume-button').addEventListener('click',resumeGame);
  $('pause-button').addEventListener('click',pauseGame);
  $('sound-button').addEventListener('click',()=>{
    state.sound=!state.sound;saveStorage('signal-sound-v1',state.sound);updateSoundButton();unlockAudio();tone(660,.12);
  });
  $('fullscreen-button').addEventListener('click',async()=>{
    try {
      if(document.fullscreenElement) await document.exitFullscreen();
      else await $('arena').requestFullscreen();
    } catch { $('announcer').textContent='Celá obrazovka není v tomto prohlížeči dostupná.'; }
  });
  if(!$('arena').requestFullscreen) $('fullscreen-button').hidden=true;
  document.addEventListener('fullscreenchange',()=>{
    const label=document.fullscreenElement?'Opustit celou obrazovku':'Celá obrazovka';
    $('fullscreen-button').setAttribute('aria-label',label);$('fullscreen-button').title=label;
    resize();
  });
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize',resize);
  spawnTarget(true);resize();updateHUD();updateSoundButton();requestAnimationFrame(frame);
})();
