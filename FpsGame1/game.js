(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const shell = document.querySelector(".game-shell");
  const overlay = document.querySelector("#overlay");
  const overlayTitle = document.querySelector("#overlayTitle");
  const startButton = document.querySelector("#startButton");
  const startButtonLabel = document.querySelector("#startButtonLabel");
  const resultPanel = document.querySelector("#result");
  const finalScoreEl = document.querySelector("#finalScore");
  const newRecordEl = document.querySelector("#newRecord");
  const scoreEl = document.querySelector("#score");
  const highScoreEl = document.querySelector("#highScore");
  const timeEl = document.querySelector("#time");
  const accuracyEl = document.querySelector("#accuracy");
  const comboEl = document.querySelector("#combo");
  const timerProgress = document.querySelector("#timerProgress");
  const ammoEl = document.querySelector("#ammo");
  const reloadText = document.querySelector("#reloadText");
  const armorEl = document.querySelector("#armor");
  const messageEl = document.querySelector("#message");
  const soundToggle = document.querySelector("#soundToggle");

  const ROUND_SECONDS = 60;
  const MAG_SIZE = 8;
  const TAU = Math.PI * 2;
  const STORAGE_KEY = "nulovy-bod-high-score";

  const state = {
    mode: "menu",
    width: innerWidth,
    height: innerHeight,
    dpr: 1,
    score: 0,
    highScore: readHighScore(),
    shots: 0,
    hits: 0,
    combo: 0,
    armor: 3,
    ammo: MAG_SIZE,
    reloading: false,
    muted: false,
    timeLeft: ROUND_SECONDS,
    startedAt: 0,
    lastFrame: performance.now(),
    nextSpawn: 0,
    shake: 0,
    recoil: 0,
    muzzle: 0,
    damageFlash: 0,
    aim: { x: innerWidth / 2, y: innerHeight * 0.43 },
    aimTarget: { x: innerWidth / 2, y: innerHeight * 0.43 },
    keys: new Set(),
    enemies: [],
    particles: [],
    casings: [],
    audio: null,
  };

  let enemyId = 0;
  let messageTimer = 0;
  let reloadTimer = 0;

  function readHighScore() {
    try {
      return Math.max(0, Number(localStorage.getItem(STORAGE_KEY)) || 0);
    } catch {
      return 0;
    }
  }

  function saveHighScore(value) {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Hra zůstává funkční i v režimu, který blokuje úložiště.
    }
  }

  function formatScore(value) {
    return Math.floor(value).toString().padStart(6, "0");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, amount) {
    return a + (b - a) * amount;
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function resize() {
    state.width = innerWidth;
    state.height = innerHeight;
    state.dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    state.aimTarget.x = clamp(state.aimTarget.x, 28, state.width - 28);
    state.aimTarget.y = clamp(state.aimTarget.y, 80, state.height - 90);
  }

  function buildAmmo() {
    ammoEl.replaceChildren();
    for (let i = 0; i < MAG_SIZE; i += 1) {
      const bullet = document.createElement("i");
      if (i >= state.ammo) bullet.className = "is-empty";
      ammoEl.append(bullet);
    }
    ammoEl.setAttribute("aria-label", `Munice ${state.ammo} z ${MAG_SIZE}`);
  }

  function updateHud() {
    scoreEl.textContent = formatScore(state.score);
    highScoreEl.textContent = formatScore(state.highScore);
    timeEl.textContent = String(Math.max(0, Math.ceil(state.timeLeft))).padStart(2, "0");
    accuracyEl.textContent = state.shots ? `${Math.round((state.hits / state.shots) * 100)} %` : "—";
    comboEl.textContent = `×${Math.max(1, state.combo)}`;

    const progress = clamp(state.timeLeft / ROUND_SECONDS, 0, 1);
    timerProgress.style.strokeDashoffset = String(157.08 * (1 - progress));
    timerProgress.style.stroke = state.timeLeft <= 10 ? "#ff6a3d" : "#d8ff58";

    [...armorEl.children].forEach((part, index) => {
      part.classList.toggle("is-empty", index >= state.armor);
    });
    armorEl.setAttribute("aria-label", `Odolnost ${state.armor} ze 3`);
  }

  function createAudio() {
    if (!state.audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) state.audio = new AudioContext();
    }
    if (state.audio?.state === "suspended") state.audio.resume();
  }

  function tone(frequency, duration, volume, type = "square", glide = 0) {
    if (state.muted || !state.audio) return;
    const now = state.audio.currentTime;
    const oscillator = state.audio.createOscillator();
    const gain = state.audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (glide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + glide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(state.audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function startGame() {
    createAudio();
    clearTimeout(reloadTimer);
    state.mode = "playing";
    state.score = 0;
    state.shots = 0;
    state.hits = 0;
    state.combo = 0;
    state.armor = 3;
    state.ammo = MAG_SIZE;
    state.reloading = false;
    state.timeLeft = ROUND_SECONDS;
    state.startedAt = performance.now();
    state.nextSpawn = state.startedAt + 500;
    state.enemies.length = 0;
    state.particles.length = 0;
    state.casings.length = 0;
    state.aim.x = state.aimTarget.x = state.width / 2;
    state.aim.y = state.aimTarget.y = state.height * 0.43;
    overlay.classList.remove("is-visible", "game-over");
    shell.classList.add("playing");
    reloadText.textContent = "PŘIPRAVEN";
    updateHud();
    buildAmmo();
    tone(180, 0.09, 0.045, "sawtooth", 180);
  }

  function endGame() {
    if (state.mode !== "playing") return;
    state.mode = "gameover";
    clearTimeout(reloadTimer);
    state.reloading = false;
    shell.classList.remove("playing");
    const isRecord = state.score > state.highScore;
    if (isRecord) {
      state.highScore = state.score;
      saveHighScore(state.highScore);
    }
    updateHud();
    finalScoreEl.textContent = formatScore(state.score);
    newRecordEl.hidden = !isRecord;
    resultPanel.hidden = false;
    overlayTitle.innerHTML = state.armor <= 0 ? "MISE<br><em>UKONČENA</em>" : "ČAS<br><em>VYPRŠEL</em>";
    startButtonLabel.textContent = "HRÁT ZNOVU";
    overlay.classList.add("is-visible", "game-over");
    tone(isRecord ? 520 : 110, 0.32, 0.045, isRecord ? "triangle" : "sawtooth", isRecord ? 380 : -55);
    startButton.focus({ preventScroll: true });
  }

  function spawnEnemy(now) {
    const lane = random(0.08, 0.92);
    const depth = random(0.2, 0.78);
    const scale = lerp(0.55, 1.3, depth);
    const baseY = lerp(state.height * 0.4, state.height * 0.67, depth);
    const margin = 70 * scale;
    const x = clamp(lane * state.width, margin, state.width - margin);
    const life = lerp(3000, 1500, (ROUND_SECONDS - state.timeLeft) / ROUND_SECONDS) * random(0.86, 1.15);
    state.enemies.push({
      id: enemyId += 1,
      x,
      y: baseY,
      baseX: x,
      scale,
      spawned: now,
      life,
      phase: random(0, TAU),
      speed: random(0.9, 1.7),
      direction: Math.random() > 0.5 ? 1 : -1,
      hit: false,
      hitAt: 0,
      warning: false,
    });
  }

  function enemyGeometry(enemy) {
    const bob = Math.sin(enemy.phase) * 3 * enemy.scale;
    const torsoW = 38 * enemy.scale;
    const torsoH = 54 * enemy.scale;
    const headR = 12 * enemy.scale;
    const headY = enemy.y - torsoH * 0.55 + bob;
    return { x: enemy.x, torsoW, torsoH, headR, headY, bob };
  }

  function isHit(enemy, x, y) {
    const g = enemyGeometry(enemy);
    const headDistance = Math.hypot(x - g.x, y - g.headY);
    if (headDistance <= g.headR * 1.12) return "head";
    const dx = (x - g.x) / (g.torsoW * 0.68);
    const dy = (y - (enemy.y + g.bob)) / (g.torsoH * 0.7);
    return dx * dx + dy * dy <= 1 ? "body" : null;
  }

  function reload() {
    if (state.mode !== "playing" || state.reloading || state.ammo === MAG_SIZE) return;
    state.reloading = true;
    reloadText.textContent = "PŘEBÍJÍM…";
    tone(190, 0.07, 0.02, "triangle", -40);
    reloadTimer = setTimeout(() => {
      if (state.mode !== "playing") return;
      state.ammo = MAG_SIZE;
      state.reloading = false;
      reloadText.textContent = "PŘIPRAVEN";
      buildAmmo();
      tone(260, 0.06, 0.025, "triangle", 90);
    }, 980);
  }

  function showMessage(text, kind = "") {
    clearTimeout(messageTimer);
    messageEl.textContent = text;
    messageEl.className = `message ${kind}`.trim();
    void messageEl.offsetWidth;
    messageEl.classList.add("pop");
    messageTimer = setTimeout(() => messageEl.classList.remove("pop"), 580);
  }

  function burst(x, y, color, count = 11) {
    for (let i = 0; i < count; i += 1) {
      const angle = random(0, TAU);
      const speed = random(45, 190);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: random(0.25, 0.55),
        maxLife: 0.55,
        size: random(1.5, 4),
        color,
      });
    }
  }

  function shoot() {
    if (state.mode !== "playing" || state.reloading) return;
    createAudio();
    if (state.ammo <= 0) {
      tone(75, 0.05, 0.025, "square");
      reload();
      return;
    }

    state.ammo -= 1;
    state.shots += 1;
    state.recoil = 1;
    state.muzzle = 1;
    state.shake = Math.max(state.shake, 3.4);
    state.casings.push({ x: state.width * 0.57, y: state.height * 0.9, vx: random(95, 170), vy: random(-210, -130), spin: 0, life: 1 });
    tone(88, 0.075, 0.075, "sawtooth", -45);
    tone(52, 0.11, 0.05, "square", -20);

    const candidates = state.enemies
      .filter((enemy) => !enemy.hit)
      .map((enemy) => ({ enemy, area: isHit(enemy, state.aim.x, state.aim.y) }))
      .filter((candidate) => candidate.area)
      .sort((a, b) => b.enemy.scale - a.enemy.scale);

    if (candidates.length) {
      const { enemy, area } = candidates[0];
      enemy.hit = true;
      enemy.hitAt = performance.now();
      state.hits += 1;
      state.combo = Math.min(9, state.combo + 1);
      const base = area === "head" ? 180 : 100;
      const points = base + Math.max(0, state.combo - 1) * 20;
      state.score += points;
      const g = enemyGeometry(enemy);
      burst(state.aim.x, state.aim.y, area === "head" ? "#d8ff58" : "#ff7147", area === "head" ? 18 : 11);
      burst(g.x, g.headY + 16 * enemy.scale, "#dce7ca", 7);
      showMessage(area === "head" ? `ZÁSAH HLAVY  +${points}` : `ZÁSAH  +${points}`, area === "head" ? "headshot" : "");
      tone(area === "head" ? 760 : 510, 0.08, 0.035, "triangle", 130);
    } else {
      state.combo = 0;
      burst(state.aim.x, state.aim.y, "#f5c46b", 5);
    }

    if (state.ammo === 0) setTimeout(reload, 180);
    updateHud();
    buildAmmo();
  }

  function enemyAttack(enemy) {
    enemy.hit = true;
    enemy.hitAt = performance.now();
    state.armor -= 1;
    state.combo = 0;
    state.damageFlash = 1;
    state.shake = 13;
    burst(enemy.x, enemy.y, "#ff3c38", 20);
    showMessage("ZÁSAH!", "danger");
    tone(64, 0.24, 0.08, "sawtooth", -25);
    updateHud();
    if (state.armor <= 0) setTimeout(endGame, 420);
  }

  function update(dt, now) {
    const keyboardSpeed = Math.min(state.width, state.height) * 0.58;
    if (state.keys.has("ArrowLeft") || state.keys.has("KeyA")) state.aimTarget.x -= keyboardSpeed * dt;
    if (state.keys.has("ArrowRight") || state.keys.has("KeyD")) state.aimTarget.x += keyboardSpeed * dt;
    if (state.keys.has("ArrowUp") || state.keys.has("KeyW")) state.aimTarget.y -= keyboardSpeed * dt;
    if (state.keys.has("ArrowDown") || state.keys.has("KeyS")) state.aimTarget.y += keyboardSpeed * dt;
    state.aimTarget.x = clamp(state.aimTarget.x, 28, state.width - 28);
    state.aimTarget.y = clamp(state.aimTarget.y, 84, state.height - 82);
    state.aim.x = lerp(state.aim.x, state.aimTarget.x, 1 - Math.pow(0.0004, dt));
    state.aim.y = lerp(state.aim.y, state.aimTarget.y, 1 - Math.pow(0.0004, dt));
    state.recoil = Math.max(0, state.recoil - dt * 5.6);
    state.muzzle = Math.max(0, state.muzzle - dt * 12);
    state.shake = Math.max(0, state.shake - dt * 24);
    state.damageFlash = Math.max(0, state.damageFlash - dt * 2.8);

    if (state.mode === "playing") {
      state.timeLeft = ROUND_SECONDS - (now - state.startedAt) / 1000;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        updateHud();
        endGame();
      } else {
        if (now >= state.nextSpawn && state.enemies.filter((enemy) => !enemy.hit).length < 5) {
          spawnEnemy(now);
          const elapsedRatio = 1 - state.timeLeft / ROUND_SECONDS;
          state.nextSpawn = now + lerp(1020, 480, elapsedRatio) * random(0.72, 1.25);
        }
        for (const enemy of state.enemies) {
          if (enemy.hit) continue;
          enemy.phase += dt * enemy.speed * 2.7;
          enemy.x = enemy.baseX + Math.sin(enemy.phase) * Math.min(65, state.width * 0.055) * enemy.direction;
          const age = now - enemy.spawned;
          enemy.warning = age > enemy.life * 0.72;
          if (age > enemy.life) enemyAttack(enemy);
        }
        state.enemies = state.enemies.filter((enemy) => !enemy.hit || now - enemy.hitAt < 620);
        updateHud();
      }
    } else {
      state.aim.x = lerp(state.aim.x, state.width / 2 + Math.sin(now / 1900) * 26, dt * 1.2);
      state.aim.y = lerp(state.aim.y, state.height * 0.44 + Math.cos(now / 1500) * 10, dt * 1.2);
    }

    for (const particle of state.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 220 * dt;
      particle.vx *= Math.pow(0.16, dt);
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);

    for (const casing of state.casings) {
      casing.life -= dt;
      casing.x += casing.vx * dt;
      casing.y += casing.vy * dt;
      casing.vy += 650 * dt;
      casing.spin += dt * 13;
    }
    state.casings = state.casings.filter((casing) => casing.life > 0 && casing.y < state.height + 30);
  }

  function drawBackground(now) {
    const { width: w, height: h } = state;
    const horizon = h * 0.43;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#061011");
    sky.addColorStop(0.62, "#163233");
    sky.addColorStop(1, "#9a5a3d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon + 1);

    ctx.fillStyle = "rgba(219, 109, 65, 0.38)";
    ctx.beginPath();
    ctx.arc(w * 0.74, horizon * 0.57, Math.min(w, h) * 0.065, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "#142120";
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(w * 0.08, horizon * 0.7);
    ctx.lineTo(w * 0.17, horizon * 0.88);
    ctx.lineTo(w * 0.3, horizon * 0.58);
    ctx.lineTo(w * 0.43, horizon * 0.83);
    ctx.lineTo(w * 0.57, horizon * 0.55);
    ctx.lineTo(w * 0.69, horizon * 0.84);
    ctx.lineTo(w * 0.83, horizon * 0.65);
    ctx.lineTo(w, horizon * 0.9);
    ctx.lineTo(w, horizon);
    ctx.closePath();
    ctx.fill();

    const ground = ctx.createLinearGradient(0, horizon, 0, h);
    ground.addColorStop(0, "#263126");
    ground.addColorStop(0.5, "#151d18");
    ground.addColorStop(1, "#070d0d");
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, w, h - horizon);

    ctx.strokeStyle = "rgba(194, 219, 172, 0.09)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 8; i += 1) {
      const t = i / 8;
      const y = horizon + (h - horizon) * t * t;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let i = -10; i <= 10; i += 1) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * 18, horizon);
      ctx.lineTo(w / 2 + i * w * 0.18, h);
      ctx.stroke();
    }

    drawOutpost(w * 0.1, horizon, Math.min(w, h) * 0.72);
    drawOutpost(w * 0.82, horizon * 1.01, Math.min(w, h) * 0.43);

    ctx.fillStyle = "rgba(206, 224, 185, 0.05)";
    for (let i = 0; i < 5; i += 1) {
      const x = (i * 317 + now * 0.006) % (w + 200) - 100;
      ctx.fillRect(x, horizon + 25 + (i % 3) * 36, 90 + i * 13, 1);
    }
  }

  function drawOutpost(x, y, size) {
    ctx.fillStyle = "#0a1211";
    ctx.fillRect(x, y - size * 0.13, size * 0.23, size * 0.13);
    ctx.fillRect(x + size * 0.035, y - size * 0.22, size * 0.055, size * 0.09);
    ctx.fillRect(x + size * 0.15, y - size * 0.28, size * 0.015, size * 0.15);
    ctx.beginPath();
    ctx.moveTo(x + size * 0.157, y - size * 0.28);
    ctx.lineTo(x + size * 0.115, y - size * 0.245);
    ctx.lineTo(x + size * 0.198, y - size * 0.245);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(216, 255, 88, 0.45)";
    ctx.fillRect(x + size * 0.18, y - size * 0.085, size * 0.018, size * 0.014);
  }

  function drawEnemy(enemy, now) {
    const g = enemyGeometry(enemy);
    const ageRatio = clamp((now - enemy.spawned) / enemy.life, 0, 1);
    const deathRatio = enemy.hit ? clamp((now - enemy.hitAt) / 620, 0, 1) : 0;

    ctx.save();
    ctx.translate(g.x, enemy.y + g.bob + deathRatio * 30);
    ctx.rotate(deathRatio * enemy.direction * 0.8);
    ctx.globalAlpha = 1 - deathRatio;

    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(0, g.torsoH * 0.65, g.torsoW * 0.95, 7 * enemy.scale, 0, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = "#090f0e";
    ctx.lineWidth = 11 * enemy.scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-g.torsoW * 0.22, g.torsoH * 0.45);
    ctx.lineTo(-g.torsoW * 0.35, g.torsoH * 0.95);
    ctx.moveTo(g.torsoW * 0.22, g.torsoH * 0.45);
    ctx.lineTo(g.torsoW * 0.38, g.torsoH * 0.95);
    ctx.stroke();

    ctx.fillStyle = "#101a17";
    ctx.beginPath();
    ctx.moveTo(-g.torsoW * 0.64, -g.torsoH * 0.48);
    ctx.lineTo(-g.torsoW * 0.79, g.torsoH * 0.33);
    ctx.lineTo(-g.torsoW * 0.38, g.torsoH * 0.61);
    ctx.lineTo(g.torsoW * 0.4, g.torsoH * 0.58);
    ctx.lineTo(g.torsoW * 0.72, g.torsoH * 0.25);
    ctx.lineTo(g.torsoW * 0.56, -g.torsoH * 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#526156";
    ctx.lineWidth = Math.max(1, enemy.scale);
    ctx.stroke();
    ctx.fillStyle = "#26332c";
    ctx.fillRect(-g.torsoW * 0.43, -g.torsoH * 0.24, g.torsoW * 0.86, g.torsoH * 0.55);
    ctx.fillStyle = "#6d744f";
    ctx.fillRect(-g.torsoW * 0.11, -g.torsoH * 0.16, g.torsoW * 0.22, g.torsoH * 0.36);

    ctx.strokeStyle = "#0a100e";
    ctx.lineWidth = 7 * enemy.scale;
    ctx.beginPath();
    ctx.moveTo(g.torsoW * 0.35, -g.torsoH * 0.18);
    ctx.lineTo(g.torsoW * 0.82, g.torsoH * 0.06);
    ctx.stroke();
    ctx.fillStyle = "#060b0a";
    ctx.fillRect(g.torsoW * 0.46, -g.torsoH * 0.02, g.torsoW * 0.7, 6 * enemy.scale);

    ctx.fillStyle = "#18231e";
    ctx.beginPath();
    ctx.arc(0, -g.torsoH * 0.57, g.headR, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#0b1210";
    ctx.beginPath();
    ctx.arc(0, -g.torsoH * 0.64, g.headR * 1.08, Math.PI, TAU);
    ctx.fill();
    ctx.fillRect(-g.headR * 1.25, -g.torsoH * 0.62, g.headR * 2.5, g.headR * 0.28);

    if (!enemy.hit) {
      const warningAlpha = enemy.warning ? 0.5 + Math.sin(now * 0.018) * 0.45 : 0.35;
      ctx.strokeStyle = enemy.warning ? `rgba(255, 60, 56, ${warningAlpha})` : "rgba(216, 255, 88, 0.2)";
      ctx.lineWidth = Math.max(1, 1.2 * enemy.scale);
      ctx.beginPath();
      ctx.arc(0, -g.torsoH * 0.12, g.torsoW * 0.88, -Math.PI / 2, -Math.PI / 2 + TAU * ageRatio);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const particle of state.particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;

    for (const casing of state.casings) {
      ctx.save();
      ctx.translate(casing.x, casing.y);
      ctx.rotate(casing.spin);
      ctx.fillStyle = "#e3bd62";
      ctx.fillRect(-2, -6, 4, 12);
      ctx.restore();
    }
  }

  function drawWeapon() {
    const w = state.width;
    const h = state.height;
    const compact = Math.min(w, h);
    const scale = clamp(compact / 720, 0.68, 1.25);
    const swayX = (state.aim.x - w / 2) * 0.018;
    const swayY = (state.aim.y - h * 0.45) * 0.012;
    const recoil = state.recoil * 18 * scale;
    const x = w * 0.53 + swayX;
    const y = h + 20 + swayY + recoil;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Rukávy a rukavice udržují jasný pohled vojáka z první osoby.
    ctx.fillStyle = "#263329";
    ctx.beginPath();
    ctx.moveTo(-178, 24);
    ctx.lineTo(-95, -123);
    ctx.lineTo(-45, -101);
    ctx.lineTo(-61, 5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(176, 24);
    ctx.lineTo(92, -121);
    ctx.lineTo(46, -98);
    ctx.lineTo(64, 7);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#4d5d49";
    ctx.beginPath();
    ctx.ellipse(-65, -116, 28, 40, 0.6, 0, TAU);
    ctx.ellipse(65, -112, 27, 39, -0.58, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "#0a0e0e";
    ctx.beginPath();
    ctx.moveTo(-105, -25);
    ctx.lineTo(-54, -170);
    ctx.lineTo(48, -172);
    ctx.lineTo(127, -23);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#18211f";
    ctx.beginPath();
    ctx.moveTo(-72, -70);
    ctx.lineTo(-45, -211);
    ctx.lineTo(45, -211);
    ctx.lineTo(83, -69);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#45524b";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#090d0d";
    ctx.fillRect(-27, -305, 56, 102);
    ctx.fillStyle = "#222d29";
    ctx.fillRect(-20, -326, 40, 29);
    ctx.fillStyle = "#060909";
    ctx.fillRect(-8, -340, 16, 21);
    ctx.fillStyle = "#59655a";
    ctx.fillRect(-55, -196, 110, 13);
    ctx.fillRect(-45, -162, 90, 6);

    ctx.fillStyle = "#7d8b72";
    for (let i = 0; i < 5; i += 1) ctx.fillRect(-35 + i * 16, -190, 8, 4);

    ctx.fillStyle = "#121917";
    ctx.beginPath();
    ctx.moveTo(-65, -45);
    ctx.lineTo(-32, -142);
    ctx.lineTo(1, -128);
    ctx.lineTo(-18, -21);
    ctx.closePath();
    ctx.fill();

    if (state.muzzle > 0) {
      ctx.globalAlpha = state.muzzle;
      const flash = ctx.createRadialGradient(0, -348, 2, 0, -348, 74);
      flash.addColorStop(0, "#fffbe0");
      flash.addColorStop(0.18, "#ffd35d");
      flash.addColorStop(0.58, "rgba(255, 91, 35, .75)");
      flash.addColorStop(1, "rgba(255, 91, 35, 0)");
      ctx.fillStyle = flash;
      ctx.beginPath();
      for (let i = 0; i < 12; i += 1) {
        const angle = (i / 12) * TAU;
        const radius = i % 2 ? 24 : 74;
        const px = Math.cos(angle) * radius;
        const py = -348 + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCrosshair() {
    const x = state.aim.x;
    const y = state.aim.y;
    const spread = 12 + state.recoil * 11;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "rgba(232, 243, 217, 0.88)";
    ctx.fillStyle = "#d8ff58";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-spread - 10, 0);
    ctx.lineTo(-spread, 0);
    ctx.moveTo(spread, 0);
    ctx.lineTo(spread + 10, 0);
    ctx.moveTo(0, -spread - 10);
    ctx.lineTo(0, -spread);
    ctx.moveTo(0, spread);
    ctx.lineTo(0, spread + 10);
    ctx.stroke();
    ctx.fillRect(-1.5, -1.5, 3, 3);
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(0, 0, spread + 5, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function render(now) {
    const shakeX = state.shake ? random(-state.shake, state.shake) : 0;
    const shakeY = state.shake ? random(-state.shake, state.shake) : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawBackground(now);
    const sortedEnemies = [...state.enemies].sort((a, b) => a.scale - b.scale);
    sortedEnemies.forEach((enemy) => drawEnemy(enemy, now));
    drawParticles();
    drawWeapon();
    drawCrosshair();
    ctx.restore();

    if (state.damageFlash > 0) {
      ctx.fillStyle = `rgba(255, 28, 22, ${state.damageFlash * 0.24})`;
      ctx.fillRect(0, 0, state.width, state.height);
    }
  }

  function frame(now) {
    const dt = Math.min(0.034, (now - state.lastFrame) / 1000 || 0);
    state.lastFrame = now;
    update(dt, now);
    render(now);
    requestAnimationFrame(frame);
  }

  function setAimFromPointer(event) {
    state.aimTarget.x = event.clientX;
    state.aimTarget.y = event.clientY;
    state.aim.x = event.clientX;
    state.aim.y = event.clientY;
  }

  canvas.addEventListener("pointermove", (event) => {
    if (state.mode === "playing") setAimFromPointer(event);
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (state.mode !== "playing") return;
    event.preventDefault();
    setAimFromPointer(event);
    shoot();
  });

  window.addEventListener("keydown", (event) => {
    const controlledKeys = ["Space", "Enter", "KeyR", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD"];
    if (controlledKeys.includes(event.code)) event.preventDefault();
    state.keys.add(event.code);
    if (event.repeat) return;
    if ((event.code === "Space" || event.code === "Enter") && state.mode !== "playing") startGame();
    else if (event.code === "Space" || event.code === "Enter") shoot();
    else if (event.code === "KeyR") reload();
  });

  window.addEventListener("keyup", (event) => state.keys.delete(event.code));
  window.addEventListener("blur", () => state.keys.clear());
  window.addEventListener("resize", resize);

  startButton.addEventListener("click", startGame);
  soundToggle.addEventListener("click", () => {
    state.muted = !state.muted;
    soundToggle.classList.toggle("is-muted", state.muted);
    soundToggle.setAttribute("aria-label", state.muted ? "Zapnout zvuk" : "Vypnout zvuk");
    if (!state.muted) {
      createAudio();
      tone(420, 0.06, 0.025, "triangle", 80);
    }
  });

  highScoreEl.textContent = formatScore(state.highScore);
  resize();
  buildAmmo();
  requestAnimationFrame(frame);
})();
