/* KURÝR 84 — no libraries, assets, network requests or build step. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const ui = Object.fromEntries(['distance', 'armorValue', 'armorBar', 'speed', 'overlay',
    'overlayKicker', 'overlayTitle', 'overlayText', 'startButton', 'startButtonText',
    'startHint', 'pauseButton', 'runLabel', 'runDot', 'footerStatus', 'warning',
    'resultStats', 'resultDistance', 'resultBest', 'bestDistance', 'announcement',
    'damageVignette', 'fieldTip', 'soundButton'].map(id => [id, $(id)]));
  const TAU = Math.PI * 2;
  const tuning = {
    metersPerLevel: 170, secondsPerLevel: 10,
    offroadSpeed: .20, offroadSteering: .38,
    brakingResponse: 5, accelerationResponse: 2,
  };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const number = n => Math.floor(n).toLocaleString('cs-CZ');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 900, H = 610, dpr = 1, lastFrame = 0, hudClock = 0;
  let best = 0;
  try { best = Math.max(0, Number(localStorage.getItem('kuryr84.best')) || 0); } catch (_) { /* Storage may be disabled on file URLs. */ }
  if (!Number.isFinite(best)) best = 0;
  ui.bestDistance.textContent = number(best);

  const player = { x: 450, y: 460, vx: 0, vy: 0, angle: 0, health: 100, invincible: 0 };
  const state = {
    phase: 'ready', distance: 0, scroll: 0, elapsed: 0, speed: 0, level: 0,
    offroad: 0, damageFlash: 0, shake: 0, nextShell: 3.8, nextBullet: 6,
    nextObstacle: 3.4, nextRepair: 11, dustClock: 0, message: '', messageTime: 0,
    shells: [], bullets: [], objects: [], particles: [], craters: [],
  };
  const input = { keys: new Set(), pointer: null, pointerId: null, mode: 'keyboard' };

  // Sound is synthesized locally and starts only after an explicit user gesture.
  const sound = {
    enabled: false, context: null, engine: null, engineGain: null,
    init() {
      try {
        if (!this.context) {
          const Audio = window.AudioContext || window.webkitAudioContext;
          if (!Audio) return false;
          this.context = new Audio();
          this.engine = this.context.createOscillator();
          this.engineGain = this.context.createGain();
          this.engine.type = 'sawtooth';
          this.engine.frequency.value = 34;
          const filter = this.context.createBiquadFilter();
          filter.type = 'lowpass'; filter.frequency.value = 180;
          this.engineGain.gain.value = 0;
          this.engine.connect(filter); filter.connect(this.engineGain);
          this.engineGain.connect(this.context.destination); this.engine.start();
        }
        this.context.resume().catch(() => {});
        return true;
      } catch (_) { return false; }
    },
    tick() {
      if (!this.context) return;
      const t = this.context.currentTime;
      this.engineGain.gain.setTargetAtTime(this.enabled && state.phase === 'playing' ? .027 : 0, t, .12);
      this.engine.frequency.setTargetAtTime(29 + state.speed * .12, t, .1);
    },
    tone(frequency, duration, type = 'sine', volume = .06, endFrequency = frequency) {
      if (!this.enabled || !this.context) return;
      const t = this.context.currentTime;
      const oscillator = this.context.createOscillator(), gain = this.context.createGain();
      oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, t);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(10, endFrequency), t + duration);
      gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(.001, t + duration);
      oscillator.connect(gain); gain.connect(this.context.destination);
      oscillator.start(t); oscillator.stop(t + duration);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    },
    blast() { this.tone(100, .42, 'sawtooth', .09, 15); this.tone(54, .55, 'triangle', .16, 12); },
  };

  function roadCenter(z) {
    return W * .5 + Math.sin(z / 810) * W * .105 + Math.sin(z / 1730 + .65) * W * .075;
  }
  function roadWidth(z) { return clamp(W * .42, 236, 350) + Math.sin(z / 1190) * 16; }
  function worldAt(y) { return state.scroll + H - y; }
  function screenAt(z) { return H - z + state.scroll; }
  function isOffroad() {
    const z = worldAt(player.y);
    return Math.abs(player.x - roadCenter(z)) > roadWidth(z) * .5 - 16;
  }
  function targetSpeed(offroad) { return (212 + state.level * 13) * (offroad ? tuning.offroadSpeed : 1); }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const oldW = W, oldH = H;
    W = Math.max(540, rect.width); H = rect.height * W / rect.width;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    if (state.phase === 'ready') { player.x = roadCenter(worldAt(H * .84)); player.y = H * .84; }
    else {
      player.x *= W / oldW; player.y *= H / oldH;
      // Preserve each hazard's on-screen position through viewport changes.
      for (const collection of [state.objects, state.shells, state.craters]) {
        for (const obj of collection) { obj.x *= W / oldW; obj.z += H - oldH; }
      }
      for (const bullet of state.bullets) { bullet.x *= W / oldW; bullet.y *= H / oldH; }
      state.particles.length = 0;
      input.pointer = null;
    }
    render();
  }

  function reset() {
    Object.assign(state, { phase: 'playing', distance: 0, scroll: 0, elapsed: 0, speed: 0,
      level: 0, offroad: 0, damageFlash: 0, shake: 0, nextShell: 3.8, nextBullet: 6,
      nextObstacle: 3.4, nextRepair: 11, dustClock: 0, message: '', messageTime: 0 });
    for (const name of ['shells', 'bullets', 'objects', 'particles', 'craters']) state[name].length = 0;
    Object.assign(player, { x: roadCenter(worldAt(H * .77)), y: H * .77, vx: 0, vy: 0, angle: 0, health: 100, invincible: 0 });
    input.keys.clear(); input.pointer = null; input.pointerId = null;
    ui.overlay.hidden = true; ui.pauseButton.disabled = false; ui.pauseButton.textContent = 'Ⅱ';
    ui.pauseButton.setAttribute('aria-label', 'Pozastavit hru');
    ui.runLabel.textContent = 'ZÁSILKA V POHYBU'; ui.runDot.style.background = '#b3c58e';
    ui.footerStatus.textContent = 'DRŽ SE CESTY. DORUČ BRAŠNU.';
    ui.announcement.textContent = 'Mise zahájena. Ovládej auto šipkami, myší nebo dotykem.';
    canvas.focus({ preventScroll: true });
    if (sound.enabled) sound.init();
    sound.tone(260, .14, 'triangle', .05, 520);
    updateHud();
  }

  function pause() {
    if (state.phase !== 'playing' && state.phase !== 'paused') return;
    const pausing = state.phase === 'playing';
    state.phase = pausing ? 'paused' : 'playing';
    input.keys.clear(); input.pointer = null; input.pointerId = null;
    ui.overlay.hidden = !pausing;
    ui.pauseButton.textContent = pausing ? '▷' : 'Ⅱ';
    ui.pauseButton.setAttribute('aria-label', pausing ? 'Pokračovat ve hře' : 'Pozastavit hru');
    ui.runLabel.textContent = pausing ? 'RÁDIOVÝ KLID' : 'ZÁSILKA V POHYBU';
    if (pausing) {
      ui.overlayKicker.textContent = 'OPERACE POZASTAVENA';
      ui.overlayTitle.textContent = 'Chvíle na vydechnutí.';
      ui.overlayText.innerHTML = 'Brašna je v bezpečí. Zatím.<br>Pokračuj, až budeš připraven.';
      ui.startButtonText.textContent = 'ZPÁTKY NA CESTU';
      ui.startHint.textContent = 'MEZERNÍK / P / ESC PRO POKRAČOVÁNÍ';
      ui.resultStats.hidden = true; ui.startButton.focus({ preventScroll: true });
    } else canvas.focus({ preventScroll: true });
    sound.tick();
  }

  function endRun() {
    if (state.phase !== 'playing') return;
    state.phase = 'over'; player.health = 0;
    const distance = Math.floor(state.distance), isRecord = distance > best;
    best = Math.max(best, distance);
    try { localStorage.setItem('kuryr84.best', String(best)); } catch (_) { /* The game works without persistent storage. */ }
    ui.overlayKicker.textContent = isRecord ? 'NOVÝ OSOBNÍ REKORD' : 'SPOJENÍ ZTRACENO';
    ui.overlayTitle.textContent = 'Tentokrát neprojel.';
    ui.overlayText.innerHTML = 'Auto to má za sebou. Kurýr má další pokus.<br>Příště tu brašnu dostaneme dál.';
    ui.resultStats.hidden = false;
    ui.resultDistance.textContent = number(distance) + ' m'; ui.resultBest.textContent = number(best) + ' m';
    ui.bestDistance.textContent = number(best);
    ui.startButtonText.textContent = 'ZKUSIT ZNOVU'; ui.startHint.textContent = 'NEBO STISKNI MEZERNÍK';
    ui.overlay.hidden = false; ui.pauseButton.disabled = true;
    ui.runLabel.textContent = 'VOZIDLO VYŘAZENO'; ui.runDot.style.background = '#db7750';
    ui.footerStatus.textContent = 'KONEC PŘENOSU / ČEKÁME NA DALŠÍHO KURÝRA';
    ui.announcement.textContent = `Mise skončila. Ujeto ${distance} metrů. Rekord ${best} metrů.`;
    ui.startButton.focus({ preventScroll: true });
    burst(player.x, player.y, 36, '#e89b4f', 180);
    sound.blast(); sound.tick(); updateHud();
  }

  function damage(amount) {
    if (player.invincible > 0 || state.phase !== 'playing') return;
    player.health = Math.max(0, player.health - amount);
    player.invincible = .65; state.damageFlash = .65; state.shake = reducedMotion ? 0 : 8;
    burst(player.x, player.y, 14, '#ecd393', 120);
    sound.tone(120, .16, 'square', .025, 35);
    if (player.health <= 0) endRun();
  }

  function message(text, duration = 1.8) { state.message = text; state.messageTime = duration; }

  function spawnShell() {
    const offroad = isOffroad();
    const delay = offroad ? 1.4 : 1.65;
    const spread = offroad ? 16 : 35;
    const x = clamp(player.x + player.vx * .3 + rand(-spread, spread), 45, W - 45);
    // Account for braking when aiming: constant-speed prediction would miss a car slowing in the grass.
    // Once shown, the world-anchored marker stays fixed; changing course still evades the shell.
    const target = targetSpeed(offroad);
    const response = offroad ? tuning.brakingResponse : tuning.accelerationResponse;
    const travel = target * delay + (state.speed - target) * (1 - Math.exp(-response * delay)) / response;
    const y = player.y - travel;
    state.shells.push({ x, z: worldAt(y), timer: delay, duration: delay, radius: 53 });
    sound.tone(620, .10, 'sine', .025, 450);
  }

  function spawnBullet() {
    const side = Math.random() < .5 ? -1 : 1;
    const y = rand(100, Math.max(130, player.y - 145));
    const x = clamp(roadCenter(worldAt(y)) + side * (roadWidth(worldAt(y)) * .5 + 42), 20, W - 20);
    const targetX = clamp(player.x + player.vx * .28, 30, W - 30);
    const angle = Math.atan2(player.y - y, targetX - x);
    const speed = 295 + state.level * 12;
    state.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      warning: .65, life: 5, originX: x, originY: y, targetX, targetY: player.y, trail: [] });
  }

  function spawnObject(type) {
    const z = worldAt(-65);
    const x = roadCenter(z) + rand(-.32, .32) * roadWidth(z);
    state.objects.push({ x, z, type, radius: type === 'repair' ? 21 : 29, rotation: rand(-.2, .2) });
  }

  function burst(x, y, count, color, velocity) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), v = rand(velocity * .15, velocity), life = rand(.25, .8);
      state.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life,
        maxLife: life, radius: rand(2, 6), color, dust: false });
    }
    if (state.particles.length > 220) state.particles.splice(0, state.particles.length - 220);
  }

  function update(dt) {
    state.elapsed += dt;
    // Time also raises pressure so crawling outside the road cannot hold difficulty down.
    state.level = Math.min(9, Math.max(state.distance / tuning.metersPerLevel, state.elapsed / tuning.secondsPerLevel));
    state.messageTime = Math.max(0, state.messageTime - dt);
    player.invincible = Math.max(0, player.invincible - dt);
    state.damageFlash = Math.max(0, state.damageFlash - dt * 2);
    state.shake = Math.max(0, state.shake - dt * 30);

    const keys = input.keys;
    let dx = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    let dy = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
    if (input.mode === 'pointer' && input.pointer) {
      dx = clamp((input.pointer.x - player.x) / 55, -1, 1);
      dy = clamp((input.pointer.y - player.y) / 55, -1, 1);
    }
    const length = Math.hypot(dx, dy);
    if (length > 1) { dx /= length; dy /= length; }
    const steering = isOffroad() ? tuning.offroadSteering : 1;
    player.vx = mix(player.vx, dx * 310 * steering, 1 - Math.exp(-11 * dt));
    player.vy = mix(player.vy, dy * 235 * steering, 1 - Math.exp(-11 * dt));
    player.x = clamp(player.x + player.vx * dt, 27, W - 27);
    player.y = clamp(player.y + player.vy * dt, H * .27, H - 60);
    player.angle = mix(player.angle, player.vx / 1000, 1 - Math.exp(-8 * dt));

    const offroad = isOffroad();
    state.offroad = offroad ? state.offroad + dt : 0;
    const response = offroad ? tuning.brakingResponse : tuning.accelerationResponse;
    state.speed = mix(state.speed, targetSpeed(offroad), 1 - Math.exp(-response * dt));
    state.scroll += state.speed * dt; state.distance += state.speed * dt / 8;
    if (state.offroad > .75) {
      player.health = Math.max(0, player.health - 9 * dt);
      state.damageFlash = Math.max(state.damageFlash, .07);
      if (player.health <= 0) { endRun(); return; }
    }

    state.dustClock -= dt;
    if (state.dustClock <= 0 && state.speed > 20) {
      state.dustClock = reducedMotion ? .13 : .055;
      for (const side of [-1, 1]) {
        const life = rand(.4, .8);
        state.particles.push({ x: player.x + side * 22, y: player.y + 36,
          vx: rand(-9, 9), vy: rand(25, 55), life, maxLife: life,
          radius: offroad ? rand(8, 13) : rand(4, 7), color: '#d5c398', dust: true });
      }
    }

    state.nextShell -= dt * (state.offroad > .55 ? 1.25 : 1);
    state.nextBullet -= dt; state.nextObstacle -= dt; state.nextRepair -= dt;
    if (state.nextShell <= 0) { spawnShell(); state.nextShell = Math.max(1.3, 3.5 - state.level * .22) + rand(0, .6); }
    if (state.nextBullet <= 0) { spawnBullet(); state.nextBullet = Math.max(.7, 2.5 - state.level * .19) + rand(0, .5); }
    if (state.nextObstacle <= 0) { spawnObject('barrier'); state.nextObstacle = rand(3.8, 6.2) / (1 + state.level * .08); }
    if (state.nextRepair <= 0) { spawnObject('repair'); state.nextRepair = rand(10, 14); }

    for (let i = state.shells.length - 1; i >= 0; i--) {
      const shell = state.shells[i]; shell.timer -= dt;
      if (shell.timer <= 0) {
        const y = screenAt(shell.z);
        burst(shell.x, y, 28, '#f2b862', 180);
        burst(shell.x, y, 14, '#4b4b39', 95);
        state.craters.push({ x: shell.x, z: shell.z, radius: shell.radius * .78 });
        sound.blast();
        if (Math.hypot(player.x - shell.x, player.y - y) < shell.radius + 19) damage(32);
        state.shells.splice(i, 1);
        if (state.phase !== 'playing') return;
      }
    }

    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const bullet = state.bullets[i]; bullet.life -= dt;
      if (bullet.warning > 0) {
        bullet.warning -= dt;
        if (bullet.warning <= 0) { burst(bullet.x, bullet.y, 6, '#f5d18b', 45); sound.tone(190, .1, 'sawtooth', .035, 60); }
      } else {
        const oldX = bullet.x, oldY = bullet.y;
        bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt;
        // Segment collision prevents fast bullets from passing through the car between frames.
        const bx = bullet.x - oldX, by = bullet.y - oldY;
        const t = clamp(((player.x - oldX) * bx + (player.y - oldY) * by) / (bx * bx + by * by || 1), 0, 1);
        if (Math.hypot(player.x - oldX - bx * t, (player.y - oldY - by * t) * .72) < 23) {
          damage(14); bullet.life = 0;
          if (state.phase !== 'playing') return;
        }
      }
      if (bullet.life <= 0 || bullet.y > H + 60 || bullet.x < -60 || bullet.x > W + 60) state.bullets.splice(i, 1);
    }

    for (let i = state.objects.length - 1; i >= 0; i--) {
      const obj = state.objects[i], y = screenAt(obj.z);
      const touching = Math.abs(player.x - obj.x) < obj.radius + 20 && Math.abs(player.y - y) < (obj.type === 'repair' ? 39 : 32);
      if (touching) {
        if (obj.type === 'repair') {
          player.health = Math.min(100, player.health + 25);
          burst(obj.x, y, 15, '#d3edaa', 80); message('PANCÍŘ OPRAVEN +25 %', 1.6);
          sound.tone(470, .18, 'sine', .05, 880);
        } else { damage(23); burst(obj.x, y, 12, '#b9a77c', 90); }
        state.objects.splice(i, 1);
        if (state.phase !== 'playing') return;
      } else if (y > H + 100) state.objects.splice(i, 1);
    }
    state.craters = state.craters.filter(crater => screenAt(crater.z) < H + 80);
    updateParticles(dt);
    if (player.health <= 0) endRun();
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i]; p.life -= dt;
      p.x += p.vx * dt; p.y += (p.vy + state.speed * .55) * dt;
      p.vx *= Math.exp(-2 * dt); p.radius += dt * (p.dust ? 15 : 3);
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  function updateHud() {
    ui.distance.textContent = String(Math.floor(state.distance)).padStart(4, '0');
    const health = Math.ceil(player.health);
    ui.armorValue.innerHTML = `${health}<span>%</span>`;
    ui.armorBar.style.width = health + '%';
    ui.armorBar.style.background = health < 30 ? '#ef8b60' : health < 55 ? '#e4c680' : '#e3edb6';
    ui.speed.textContent = String(state.phase === 'playing' ? Math.round(state.speed * .45) : 0).padStart(2, '0');
    let warning = '';
    if (state.phase === 'playing') {
      if (state.offroad > .15) warning = '⚠ MIMO CESTU — SNADNÝ CÍL';
      else if (state.messageTime > 0) warning = state.message;
      else if (player.health < 28) warning = '⚠ KRITICKÝ STAV PANCÍŘE';
      else if (state.shells.length) warning = '⌖ POZOR, DĚLOSTŘELECKÁ PALBA';
      ui.footerStatus.textContent = state.distance < 90 ? 'DRŽ SE CESTY. DORUČ BRAŠNU.' : `NEPŘÁTELSKÁ AKTIVITA: ${state.level < 2 ? 'ZVÝŠENÁ' : state.level < 5 ? 'VYSOKÁ' : 'KRITICKÁ'}`;
      if (state.offroad > .55) ui.footerStatus.textContent = 'ZTRÁCÍŠ RYCHLOST. VRAŤ SE NA SILNICI!';
    }
    ui.warning.textContent = warning; ui.warning.classList.toggle('visible', Boolean(warning));
    ui.damageVignette.style.opacity = String(state.damageFlash * .5);
  }

  // All artwork is drawn in Canvas, including terrain, vehicles and light/shadow.
  function polygon(points, fill, stroke, lineWidth = 1) {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function ellipse(x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function line(x1, y1, x2, y2, color, width = 1) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
  function roundedRect(x, y, w, h, r, color) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = color; ctx.fill(); }

  function drawTerrain() {
    ctx.fillStyle = '#7c8661'; ctx.fillRect(0, 0, W, H);
    const first = Math.floor(state.scroll / 180) - 1, last = Math.ceil((state.scroll + H) / 180) + 1;
    for (let row = first; row <= last; row++) {
      for (let col = 0; col < Math.ceil(W / 160); col++) {
        const id = row * 83 + col * 7, x = col * 160 + hash(id) * 80, y = screenAt(row * 180 + hash(id + 1) * 80);
        polygon([[x - 90, y - 80], [x + 35, y - 107], [x + 110, y - 23], [x + 87, y + 73], [x - 42, y + 95], [x - 115, y + 18]], hash(id + 3) > .5 ? '#858d662c' : '#566c4a25');
        for (let j = 0; j < 10; j++) {
          const gx = x - 80 + hash(id + j * 31) * 160, gy = y - 65 + hash(id + j * 17) * 140;
          line(gx, gy, gx + 2, gy - 5, '#52684940');
          line(gx + 4, gy + 1, gx + 7, gy - 3, '#acac7d38');
        }
      }
    }
  }

  function roadPath(extra = 0) {
    ctx.beginPath();
    for (let y = -40; y <= H + 50; y += 15) {
      const z = worldAt(y), x = roadCenter(z) - roadWidth(z) * .5 - extra;
      y === -40 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    for (let y = H + 50; y >= -55; y -= 15) {
      const z = worldAt(y); ctx.lineTo(roadCenter(z) + roadWidth(z) * .5 + extra, y);
    }
    ctx.closePath();
  }

  function drawRoad() {
    roadPath(24); ctx.fillStyle = '#65745455'; ctx.fill();
    roadPath(15); ctx.fillStyle = '#b4aa86'; ctx.fill();
    roadPath(6); ctx.fillStyle = '#a79e7b'; ctx.fill();
    roadPath(); ctx.fillStyle = '#858777'; ctx.fill();
    // Long weathered tire tracks, shoulders and worn paint.
    for (const offset of [-.29, -.13, .13, .29]) {
      ctx.beginPath();
      for (let y = -30; y <= H + 40; y += 18) {
        const z = worldAt(y), x = roadCenter(z) + roadWidth(z) * offset;
        y === -30 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#666e6120'; ctx.lineWidth = 10; ctx.stroke();
    }
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let y = -30; y <= H + 40; y += 18) {
        const z = worldAt(y), x = roadCenter(z) + side * (roadWidth(z) * .5 - 10);
        y === -30 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#d0cbb080'; ctx.lineWidth = 2; ctx.stroke();
    }
    for (let z = Math.floor(state.scroll / 98) * 98; z < state.scroll + H + 100; z += 98) {
      ctx.beginPath(); ctx.moveTo(roadCenter(z), screenAt(z));
      ctx.lineTo(roadCenter(z + 39), screenAt(z + 39)); ctx.strokeStyle = '#d8d0ad'; ctx.lineWidth = 3; ctx.stroke();
    }
    for (let z = Math.floor(state.scroll / 60) * 60; z < state.scroll + H + 70; z += 60) {
      const y = screenAt(z), x = roadCenter(z) + (hash(z) - .5) * roadWidth(z) * .85;
      line(x, y, x + 6, y - 2, '#626b5d55', 1);
      line(x + 20, y + 20, x + 30, y + 21, '#b9b59a55', 1);
    }
  }

  function drawTree(x, y, size, seed) {
    ctx.save(); ctx.translate(x, y);
    polygon([[-size * .65, 10], [size * .4, -size * .6], [size * 1.9, size * .75], [size * 1.3, size * 1.05], [size * .2, size * .8]], '#263d3030');
    line(0, 4, 4, 19, '#595b3d', 5);
    const colors = hash(seed) > .5 ? ['#425c40', '#526b45', '#657951'] : ['#3e5940', '#4b6544', '#5c734d'];
    for (let layer = 0; layer < 3; layer++) {
      const r = size * (1 - layer * .22), cy = -layer * size * .13;
      const points = [];
      for (let k = 0; k < 11; k++) {
        const a = k / 11 * TAU, radius = r * (.75 + hash(seed + k * 5 + layer) * .25);
        points.push([Math.cos(a) * radius - layer * 2, Math.sin(a) * radius * .78 + cy]);
      }
      polygon(points, colors[layer]);
    }
    line(-size * .24, -size * .4, -size * .42, -size * .17, '#91a06c55', 2);
    ctx.restore();
  }

  function drawBunker(x, y, side) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(side * -.12);
    polygon([[-27, -19], [26, -19], [42, 21], [-16, 34], [-30, 10]], '#29382c35');
    roundedRect(-28, -21, 54, 42, 8, '#aaa58a');
    roundedRect(-24, -24, 48, 36, 7, '#bcb69a');
    roundedRect(-18, -18, 36, 26, 4, '#7d8366');
    ellipse(0, -3, 12, 10, '#4d6047');
    line(side * -3, -3, side * -37, 10, '#293a2f', 7);
    line(side * -3, -6, side * -35, 7, '#718063', 3);
    for (let i = -1; i <= 1; i++) line(i * 15, 14, i * 15, 22, '#7d8066');
    ctx.restore();
  }

  function drawScenery() {
    const start = Math.floor((state.scroll - 100) / 100), end = Math.ceil((state.scroll + H + 110) / 100);
    for (let row = end; row >= start; row--) {
      const z = row * 100, y = screenAt(z);
      for (const side of [-1, 1]) {
        const seed = row * 13 + side * 237;
        const center = roadCenter(z), edge = center + side * (roadWidth(z) * .5 + 24);
        for (let j = 0; j < 2; j++) {
          const x = edge + side * (24 + j * 75 + hash(seed + j * 6) * 48);
          const treeY = y + hash(seed + j * 5) * 61 - 30;
          if (x < -70 || x > W + 70) continue;
          if (hash(seed + j * 11) > .14) drawTree(x, treeY, 23 + hash(seed + 1 + j) * 22, seed + j * 43);
          else {
            ellipse(x + 5, treeY + 6, 15, 8, '#31463326');
            polygon([[x - 11, treeY + 3], [x - 8, treeY - 9], [x + 5, treeY - 12], [x + 13, treeY], [x + 7, treeY + 7]], '#a5a28a', '#828a6a');
          }
        }
        if (row % 3 === 0) {
          const postX = center + side * (roadWidth(z) * .5 + 16);
          line(postX, y, postX + 10, y + 7, '#3c4a323b', 3);
          roundedRect(postX - 2, y - 9, 4, 14, 1, '#e0d5ad');
          ctx.fillStyle = side > 0 ? '#c4714e' : '#52694d'; ctx.fillRect(postX - 2, y - 6, 4, 4);
        }
      }
      if ((row + 3) % 9 === 0) {
        const side = hash(row + 18) > .5 ? -1 : 1;
        drawBunker(roadCenter(z) + side * (roadWidth(z) * .5 + 65), y, side);
      }
      if (row % 11 === 1) {
        const x = roadCenter(z) - roadWidth(z) * .5 - 44;
        line(x, y, x, y - 30, '#5c6349', 4); roundedRect(x - 20, y - 44, 41, 26, 2, '#d4c9a4');
        ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#4a5d41'; ctx.fillText('07 →', x, y - 27);
      }
    }
  }

  function drawObject(obj) {
    const y = screenAt(obj.z);
    ctx.save(); ctx.translate(obj.x, y); ctx.rotate(obj.rotation);
    if (obj.type === 'repair') {
      const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, 40);
      glow.addColorStop(0, '#dfeb9a66'); glow.addColorStop(1, '#dfeb9a00');
      ellipse(0, 0, 40, 40, glow); ellipse(5, 12, 23, 12, '#25382b40');
      roundedRect(-16, -18, 32, 37, 3, '#495e42'); roundedRect(-16, -21, 32, 34, 3, '#d1d7a9');
      ctx.strokeStyle = '#576b47'; ctx.lineWidth = 3; ctx.strokeRect(-6, -26, 12, 6);
      ctx.fillStyle = '#5b744d'; ctx.fillRect(-3, -15, 6, 22); ctx.fillRect(-11, -7, 22, 6);
      line(-12, 15, 12, 15, '#354e39', 2);
    } else {
      ellipse(7, 10, 38, 14, '#28392c38');
      line(-26, -13, -26, 15, '#4a503d', 6); line(26, -13, 26, 15, '#4a503d', 6);
      roundedRect(-37, -11, 74, 20, 2, '#584e38');
      ctx.save(); ctx.beginPath(); ctx.rect(-36, -11, 72, 17); ctx.clip();
      for (let x = -50; x < 60; x += 22) polygon([[x, -12], [x + 12, -12], [x + 1, 7], [x - 11, 7]], '#c5a873');
      ctx.restore(); line(-35, -11, 35, -11, '#e0c899', 2);
    }
    ctx.restore();
  }

  function drawCar() {
    ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.angle);
    if (player.invincible > 0 && Math.floor(state.elapsed * 14) % 2) ctx.globalAlpha = .65;
    polygon([[-27, -35], [24, -37], [40, -18], [42, 46], [-13, 50], [-27, 32]], '#23342b4a');
    for (const x of [-28, 18]) {
      roundedRect(x, -29, 10, 23, 3, '#27352d'); roundedRect(x, 17, 10, 24, 3, '#26352b');
      line(x + 2, -25, x + 2, -10, '#5b6251', 2); line(x + 2, 21, x + 2, 36, '#5b6251', 2);
    }
    polygon([[-22, -39], [20, -39], [25, -24], [25, 40], [18, 45], [-20, 45], [-25, 37], [-25, -23]], '#344a39', '#263c30', 2);
    polygon([[-20, -42], [18, -42], [22, -27], [20, 36], [14, 40], [-19, 39], [-22, 30], [-22, -28]], '#8f9b6c', '#506645', 1.5);
    polygon([[-20, -41], [18, -41], [20, -24], [-22, -24]], '#a5ad7a');
    line(-16, -38, 14, -38, '#c0c494', 2);
    polygon([[-17, -21], [16, -21], [18, -5], [-19, -5]], '#344a41', '#bdc293', 1.5);
    line(0, -20, 0, -5, '#8c9f7c', 2); line(-15, -19, -4, -19, '#8fa998', 2);
    polygon([[-19, -2], [18, -2], [18, 24], [-20, 24]], '#788b5c', '#65794d');
    ellipse(-1, 10, 12, 11, '#4c6645'); ellipse(-2, 8, 10, 9, '#a0aa78');
    line(-7, 7, 4, 7, '#657a52', 2);
    polygon([[-16, 27], [14, 27], [14, 35], [-17, 35]], '#657b51');
    line(-18, 39, 16, 39, '#acb387', 2);
    // The courier's leather bag is strapped to the rear rack.
    roundedRect(-11, 27, 21, 12, 2, '#805c3e'); line(-6, 28, -6, 38, '#c69a61', 2); line(5, 28, 5, 38, '#c69a61', 2);
    line(16, 12, 22, -15, '#2a4434', 1);
    ctx.fillStyle = '#f0ddb0'; ctx.fillRect(-20, -37, 5, 6); ctx.fillRect(14, -37, 5, 6);
    ctx.fillStyle = '#be7351'; ctx.fillRect(-21, 36, 4, 4); ctx.fillRect(16, 36, 4, 4);
    line(-27, -12, -22, -9, '#4e6550', 3); line(21, -9, 27, -12, '#4e6550', 3);
    // Small white unit insignia.
    ctx.fillStyle = '#e3e0b9'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.fillText('84', -1, -28);
    if (player.health < 40) {
      ellipse(8, -31, 6, 8, '#303b2caa');
      if (state.phase === 'over') { ellipse(-3, -4, 17, 25, '#383b2ba8'); line(-13, -14, 12, 17, '#aa9b6d', 2); }
    }
    ctx.restore();
  }

  function drawHazards() {
    for (const shell of state.shells) {
      const y = screenAt(shell.z), progress = 1 - shell.timer / shell.duration;
      const pulse = reducedMotion ? .5 : .5 + Math.sin(state.elapsed * 13) * .5;
      ellipse(shell.x, y, shell.radius, shell.radius, `rgba(173,63,38,${.1 + pulse * .09})`);
      ctx.beginPath(); ctx.arc(shell.x, y, shell.radius, 0, TAU); ctx.strokeStyle = '#e6a077'; ctx.lineWidth = 1.3; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(shell.x, y, shell.radius * (1 - progress), 0, TAU); ctx.strokeStyle = '#ec8860'; ctx.lineWidth = 2; ctx.stroke();
      for (const side of [-1, 1]) {
        line(shell.x + side * 8, y, shell.x + side * 20, y, '#ffe0b2', 1.5);
        line(shell.x, y + side * 8, shell.x, y + side * 20, '#ffe0b2', 1.5);
      }
      ctx.fillStyle = '#ffe1b7'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('DOPAD', shell.x, y - shell.radius - 10);
    }
    for (const bullet of state.bullets) {
      if (bullet.warning > 0) {
        ctx.globalAlpha = .25 + (1 - bullet.warning / .65) * .3;
        ctx.setLineDash([8, 9]); line(bullet.x, bullet.y, bullet.targetX, bullet.targetY, '#f6b583', 1); ctx.setLineDash([]); ctx.globalAlpha = 1;
        ellipse(bullet.x, bullet.y, 7, 7, '#e7c084');
      } else {
        const a = Math.atan2(bullet.vy, bullet.vx);
        line(bullet.x - Math.cos(a) * 22, bullet.y - Math.sin(a) * 22, bullet.x, bullet.y, '#eeba71aa', 4);
        line(bullet.x - Math.cos(a) * 15, bullet.y - Math.sin(a) * 15, bullet.x, bullet.y, '#fff1bd', 2);
      }
    }
  }

  function render() {
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.save();
    if (state.shake > 0 && state.phase === 'playing') ctx.translate(rand(-state.shake, state.shake), rand(-state.shake, state.shake));
    drawTerrain(); drawRoad();
    for (const c of state.craters) {
      const y = screenAt(c.z); ellipse(c.x, y, c.radius + 7, c.radius * .74, '#645d4055');
      ellipse(c.x, y, c.radius, c.radius * .65, '#4c513b99'); ellipse(c.x - 4, y - 3, c.radius * .7, c.radius * .39, '#393f31aa');
    }
    drawScenery();
    for (const obj of state.objects) drawObject(obj);
    for (const p of state.particles) {
      ctx.globalAlpha = (p.life / p.maxLife) * (p.dust ? .22 : .85);
      ellipse(p.x, p.y, p.radius, p.radius * .8, p.color);
    }
    ctx.globalAlpha = 1; drawCar(); drawHazards();
    // Soft vignette makes the top-down scene read as a physical map.
    const vignette = ctx.createRadialGradient(W * .5, H * .46, W * .17, W * .5, H * .5, Math.max(W, H) * .74);
    vignette.addColorStop(0, '#20392900'); vignette.addColorStop(1, '#20392955');
    ctx.fillStyle = vignette; ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.restore();
  }

  function frame(time) {
    const dt = Math.min(Math.max((time - lastFrame) / 1000, 0), .04); lastFrame = time;
    if (state.phase === 'playing') update(dt);
    else if (state.phase === 'over') {
      state.speed = 0; state.damageFlash = Math.max(0, state.damageFlash - dt * 2); updateParticles(dt);
    }
    hudClock += dt;
    if (hudClock >= .065) { hudClock = 0; updateHud(); sound.tick(); }
    render(); requestAnimationFrame(frame);
  }

  function primaryAction() { if (state.phase === 'paused') pause(); else if (state.phase !== 'playing') reset(); }
  ui.startButton.addEventListener('click', primaryAction);
  ui.pauseButton.addEventListener('click', pause);
  function toggleSound() {
    sound.enabled = !sound.enabled;
    if (sound.enabled && !sound.init()) { sound.enabled = false; message('ZVUK NENÍ V TOMTO PROHLÍŽEČI DOSTUPNÝ'); }
    ui.soundButton.setAttribute('aria-pressed', String(sound.enabled));
    ui.soundButton.title = sound.enabled ? 'Vypnout zvuk (M)' : 'Zapnout zvuk (M)';
    ui.soundButton.querySelector('span').textContent = sound.enabled ? 'ZVUK ZAPNUTÝ' : 'ZVUK VYPNUTÝ';
    ui.soundButton.querySelector('path').setAttribute('d', sound.enabled ? 'M11 5 6 9H3v6h3l5 4V5Zm5 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14' : 'M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6');
    sound.tick();
  }
  ui.soundButton.addEventListener('click', toggleSound);
  const movementKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (movementKeys.has(event.code)) {
      if (state.phase === 'playing') { event.preventDefault(); input.mode = 'keyboard'; input.pointer = null; input.keys.add(event.code); }
      return;
    }
    if (event.repeat) return;
    if (event.code === 'Space') {
      // Preserve native activation for focused buttons; the start button also handles Enter.
      if (event.target instanceof Element && event.target.closest('button, a')) return;
      event.preventDefault(); if (state.phase === 'playing') pause(); else primaryAction();
    } else if (event.code === 'Escape' || event.code === 'KeyP') { event.preventDefault(); pause(); }
    else if (event.code === 'KeyM') toggleSound();
  });
  window.addEventListener('keyup', event => input.keys.delete(event.code));
  function pointerPosition(event) {
    const r = canvas.getBoundingClientRect();
    return { x: clamp((event.clientX - r.left) / r.width * W, 27, W - 27),
      y: clamp((event.clientY - r.top) / r.height * H - (event.pointerType === 'touch' ? 58 : 0), H * .27, H - 60) };
  }
  canvas.addEventListener('pointerdown', event => {
    if (state.phase !== 'playing' || !event.isPrimary) return;
    event.preventDefault(); input.pointerId = event.pointerId; input.mode = 'pointer'; input.keys.clear();
    input.pointer = pointerPosition(event); canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointermove', event => {
    if (state.phase !== 'playing' || !event.isPrimary) return;
    if (event.pointerType !== 'mouse' && input.pointerId !== event.pointerId) return;
    input.mode = 'pointer'; input.pointer = pointerPosition(event);
  });
  function releasePointer(event) {
    if (input.pointerId !== event.pointerId) return;
    input.pointerId = null; input.pointer = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('lostpointercapture', releasePointer);
  canvas.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse' && input.pointerId === null) input.pointer = null; });
  window.addEventListener('blur', () => { input.keys.clear(); if (state.phase === 'playing') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.phase === 'playing') pause(); });
  window.addEventListener('resize', resize);
  resize(); requestAnimationFrame(frame);
})();
