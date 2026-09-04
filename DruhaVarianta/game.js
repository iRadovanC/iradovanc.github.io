(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const startOverlay = document.getElementById("startOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");
  const jumpButton = document.getElementById("jumpButton");
  const countdownEl = document.getElementById("countdown");
  const metersEl = document.getElementById("meters");
  const bestEl = document.getElementById("best");
  const finalMetersEl = document.getElementById("finalMeters");
  const newRecordEl = document.getElementById("newRecord");
  const missionStatusEl = document.getElementById("missionStatus");
  const flashEl = document.getElementById("flash");

  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = 492;
  const SOLDIER_X = 278;
  const GRAVITY = 2200;
  const JUMP_SPEED = 820;
  const WORLD_SCALE = 0.095;

  const colors = {
    skyTop: "#667467",
    skyBottom: "#c7a96a",
    haze: "#ded2a3",
    far: "#59634e",
    mid: "#394235",
    ground: "#242a22",
    dirt: "#40382a",
    dark: "#101511",
    outline: "#121713",
    uniform: "#5e6742",
    uniformLight: "#7a8252",
    leather: "#4b3827",
    skin: "#b88961",
    helmet: "#3f4937",
    cable: "#171816",
    fire: "#f4b23d",
    fireHot: "#f6df77",
    ember: "#e96732",
    smoke: "#32362f",
  };

  const state = {
    mode: "menu",
    time: 0,
    runTime: 0,
    distance: 0,
    speed: 390,
    spawnAt: 760,
    lastTime: performance.now(),
    shake: 0,
    flash: 0,
    explosionTimer: 0.5,
    audioReady: false,
    best: Number(localStorage.getItem("signalRunnerBest") || 0),
  };

  const soldier = {
    y: GROUND_Y,
    vy: 0,
    onGround: true,
    runPhase: 0,
    fallen: false,
  };

  let obstacles = [];
  let particles = [];
  let embers = [];
  let audioContext = null;

  function formatMeters(value) {
    return String(Math.max(0, Math.floor(value))).padStart(4, "0");
  }

  function updateHud() {
    metersEl.textContent = formatMeters(state.distance);
    bestEl.textContent = formatMeters(state.best);
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function initAudio() {
    if (audioContext) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audioContext = new AudioCtx();
  }

  function tone(frequency, duration, type = "square", volume = 0.04, delay = 0) {
    if (!audioContext) return;
    const now = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function noiseBurst(duration = 0.45, volume = 0.09) {
    if (!audioContext) return;
    const frameCount = Math.floor(audioContext.sampleRate * duration);
    const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
    }
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    filter.type = "lowpass";
    filter.frequency.value = 380;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    source.start();
  }

  function resetGame() {
    state.time = 0;
    state.runTime = 0;
    state.distance = 0;
    state.speed = 390;
    state.spawnAt = W + 260;
    state.explosionTimer = 0.35;
    state.shake = 0;
    state.flash = 0;
    soldier.y = GROUND_Y;
    soldier.vy = 0;
    soldier.onGround = true;
    soldier.fallen = false;
    soldier.runPhase = 0;
    obstacles = [];
    particles = [];
    embers = [];
    seedObstacles();
    updateHud();
  }

  function seedObstacles() {
    obstacles.push({ type: "crate", x: W + 230, width: 54, height: 60, passed: false });
    obstacles.push({ type: "pit", x: W + 650, width: 138, height: 0, passed: false });
    state.spawnAt = W + 1050;
  }

  function createObstacle() {
    const difficulty = clamp(state.distance / 450, 0, 1);
    const roll = Math.random();
    let obstacle;
    if (roll < 0.34) {
      obstacle = {
        type: "pit",
        x: state.spawnAt,
        width: random(118, 155 + difficulty * 34),
        height: 0,
        passed: false,
      };
    } else if (roll < 0.68) {
      obstacle = {
        type: "barricade",
        x: state.spawnAt,
        width: 72,
        height: 68,
        passed: false,
      };
    } else {
      obstacle = {
        type: "crate",
        x: state.spawnAt,
        width: roll > 0.89 ? 75 : 55,
        height: roll > 0.89 ? 72 : 58,
        passed: false,
      };
    }
    obstacles.push(obstacle);
    const gap = random(330, 500) - difficulty * 60;
    state.spawnAt += obstacle.width + gap;
  }

  async function startCountdown() {
    if (state.mode === "countdown" || state.mode === "running") return;
    initAudio();
    if (audioContext?.state === "suspended") await audioContext.resume();
    resetGame();
    state.mode = "countdown";
    startOverlay.classList.add("hidden");
    gameOverOverlay.classList.add("hidden");
    countdownEl.classList.remove("hidden", "go");
    missionStatusEl.textContent = "ODPOČET — ČEKEJTE";

    const beats = ["3", "2", "1"];
    for (const beat of beats) {
      countdownEl.textContent = beat;
      tone(310, 0.12, "square", 0.04);
      await wait(720);
    }
    countdownEl.textContent = "BĚŽ!";
    countdownEl.classList.add("go");
    tone(590, 0.25, "sawtooth", 0.05);
    await wait(520);
    countdownEl.classList.add("hidden");
    state.mode = "running";
    missionStatusEl.textContent = "LINKA SE ODVÍJÍ";
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function jump() {
    if (state.mode === "menu" || state.mode === "over") {
      startCountdown();
      return;
    }
    if (state.mode !== "running" || !soldier.onGround) return;
    soldier.vy = -JUMP_SPEED;
    soldier.onGround = false;
    tone(170, 0.1, "triangle", 0.025);
  }

  function endGame(reason) {
    if (state.mode !== "running") return;
    state.mode = "over";
    soldier.fallen = true;
    soldier.vy = -170;
    const rounded = Math.floor(state.distance);
    const isRecord = rounded > state.best;
    if (isRecord) {
      state.best = rounded;
      localStorage.setItem("signalRunnerBest", String(rounded));
    }
    updateHud();
    finalMetersEl.textContent = String(rounded);
    newRecordEl.classList.toggle("hidden", !isRecord);
    document.getElementById("resultTitle").textContent =
      reason === "pit" ? "Příkop byl příliš široký." : "Překážka zastavila běh.";
    missionStatusEl.textContent = "SPOJENÍ PŘERUŠENO";
    tone(120, 0.45, "sawtooth", 0.05);
    window.setTimeout(() => gameOverOverlay.classList.remove("hidden"), 700);
  }

  function spawnExplosion() {
    const x = random(45, SOLDIER_X - 105);
    const y = random(GROUND_Y - 25, GROUND_Y + 18);
    for (let i = 0; i < 22; i += 1) {
      const angle = random(Math.PI * 1.08, Math.PI * 1.92);
      const speed = random(100, 420);
      particles.push({
        kind: i < 8 ? "fire" : "smoke",
        x,
        y,
        vx: Math.cos(angle) * speed + state.speed * 0.15,
        vy: Math.sin(angle) * speed,
        life: random(0.45, 1.1),
        maxLife: 1.1,
        size: random(12, 38),
      });
    }
    for (let i = 0; i < 16; i += 1) {
      embers.push({
        x,
        y,
        vx: random(-170, 260),
        vy: random(-330, -90),
        life: random(0.3, 0.85),
      });
    }
    state.shake = 11;
    state.flash = 0.13;
    noiseBurst(0.35, 0.075);
  }

  function update(dt) {
    state.time += dt;

    if (state.mode === "running") {
      state.runTime += dt;
      state.speed = Math.min(590, 390 + state.runTime * 4.8);
      state.distance += state.speed * WORLD_SCALE * dt;
      soldier.runPhase += dt * (state.speed / 23);

      soldier.vy += GRAVITY * dt;
      soldier.y += soldier.vy * dt;
      if (soldier.y >= GROUND_Y) {
        soldier.y = GROUND_Y;
        soldier.vy = 0;
        soldier.onGround = true;
      }

      for (const obstacle of obstacles) obstacle.x -= state.speed * dt;
      state.spawnAt -= state.speed * dt;
      while (state.spawnAt < W + 420) createObstacle();
      obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > -90);
      checkCollisions();

      state.explosionTimer -= dt;
      if (state.explosionTimer <= 0) {
        spawnExplosion();
        state.explosionTimer = random(1.8, 3.4);
      }
      updateHud();
    } else if (state.mode === "over") {
      soldier.runPhase += dt * 4;
      soldier.vy += GRAVITY * dt;
      soldier.y = Math.min(GROUND_Y + 30, soldier.y + soldier.vy * dt);
    }

    updateParticles(dt);
    state.shake = Math.max(0, state.shake - dt * 35);
    state.flash = Math.max(0, state.flash - dt);
    flashEl.style.opacity = String(state.flash * 2.5);
  }

  function updateParticles(dt) {
    for (const particle of particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += (particle.kind === "smoke" ? -45 : 240) * dt;
      particle.vx *= 0.985;
      particle.size += (particle.kind === "smoke" ? 22 : -5) * dt;
    }
    particles = particles.filter((particle) => particle.life > 0);

    for (const ember of embers) {
      ember.life -= dt;
      ember.x += ember.vx * dt;
      ember.y += ember.vy * dt;
      ember.vy += 600 * dt;
    }
    embers = embers.filter((ember) => ember.life > 0);
  }

  function checkCollisions() {
    const body = {
      left: SOLDIER_X - 25,
      right: SOLDIER_X + 31,
      top: soldier.y - 122,
      bottom: soldier.y - 8,
    };

    for (const obstacle of obstacles) {
      if (obstacle.type === "pit") {
        const footX = SOLDIER_X + 5;
        if (
          footX > obstacle.x + 12 &&
          footX < obstacle.x + obstacle.width - 12 &&
          soldier.y > GROUND_Y - 38
        ) {
          endGame("pit");
          return;
        }
      } else {
        const box = {
          left: obstacle.x + 5,
          right: obstacle.x + obstacle.width - 5,
          top: GROUND_Y - obstacle.height,
          bottom: GROUND_Y,
        };
        if (
          body.right > box.left &&
          body.left < box.right &&
          body.bottom > box.top &&
          body.top < box.bottom
        ) {
          endGame("obstacle");
          return;
        }
      }
    }
  }

  function draw() {
    ctx.save();
    const shakeX = state.shake ? random(-state.shake, state.shake) : 0;
    const shakeY = state.shake ? random(-state.shake * 0.55, state.shake * 0.55) : 0;
    ctx.translate(shakeX, shakeY);
    drawSky();
    drawFarLandscape();
    drawGround();
    drawCable();
    drawObstacles();
    drawParticles();
    drawSoldier();
    drawForeground();
    ctx.restore();
    drawVignette();
  }

  function drawSky() {
    const gradient = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    gradient.addColorStop(0, colors.skyTop);
    gradient.addColorStop(0.68, colors.skyBottom);
    gradient.addColorStop(1, colors.haze);
    ctx.fillStyle = gradient;
    ctx.fillRect(-20, -20, W + 40, GROUND_Y + 30);

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#f5e6b6";
    ctx.beginPath();
    ctx.arc(W * 0.76, 152, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    for (let i = 0; i < 6; i += 1) {
      const x = ((i * 258 - state.time * 8) % (W + 280)) - 120;
      const y = 115 + (i % 3) * 58;
      ctx.fillStyle = "rgba(44, 51, 43, 0.11)";
      ctx.beginPath();
      ctx.ellipse(x, y, 120 + i * 7, 22, -0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFarLandscape() {
    const farOffset = (state.distance * 1.7) % 300;
    ctx.fillStyle = colors.far;
    ctx.beginPath();
    ctx.moveTo(-50, GROUND_Y);
    for (let x = -350 - farOffset; x < W + 350; x += 300) {
      ctx.lineTo(x, 390);
      ctx.lineTo(x + 80, 310);
      ctx.lineTo(x + 170, 372);
      ctx.lineTo(x + 240, 328);
      ctx.lineTo(x + 320, 405);
    }
    ctx.lineTo(W + 50, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    const midOffset = (state.distance * 4.5) % 235;
    ctx.fillStyle = colors.mid;
    ctx.beginPath();
    ctx.moveTo(-80, GROUND_Y);
    for (let x = -250 - midOffset; x < W + 260; x += 235) {
      ctx.lineTo(x, 420);
      ctx.quadraticCurveTo(x + 65, 365, x + 130, 430);
      ctx.quadraticCurveTo(x + 190, 385, x + 250, 435);
    }
    ctx.lineTo(W + 80, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    drawRuins(midOffset);
  }

  function drawRuins(offset) {
    ctx.fillStyle = "#30372f";
    for (let i = 0; i < 6; i += 1) {
      const x = i * 270 - offset * 0.65 - 120;
      const h = 38 + (i % 3) * 14;
      ctx.fillRect(x, GROUND_Y - h - 18, 80, h);
      ctx.clearRect(x + 14, GROUND_Y - h - 6, 14, 20);
      ctx.clearRect(x + 50, GROUND_Y - h + 2, 13, 16);
    }
  }

  function drawGround() {
    ctx.fillStyle = colors.ground;
    ctx.fillRect(-20, GROUND_Y, W + 40, H - GROUND_Y + 20);
    ctx.fillStyle = colors.dirt;
    ctx.fillRect(-20, GROUND_Y, W + 40, 13);

    const trackOffset = (state.distance * 22) % 95;
    ctx.strokeStyle = "rgba(190, 172, 122, 0.16)";
    ctx.lineWidth = 3;
    for (let x = -100 - trackOffset; x < W + 100; x += 95) {
      ctx.beginPath();
      ctx.moveTo(x, 548);
      ctx.lineTo(x + 46, 552);
      ctx.stroke();
    }

    for (const obstacle of obstacles) {
      if (obstacle.type !== "pit") continue;
      ctx.fillStyle = colors.dark;
      ctx.beginPath();
      ctx.moveTo(obstacle.x, GROUND_Y - 3);
      ctx.lineTo(obstacle.x + 18, GROUND_Y + 19);
      ctx.lineTo(obstacle.x + 35, H + 10);
      ctx.lineTo(obstacle.x + obstacle.width - 30, H + 10);
      ctx.lineTo(obstacle.x + obstacle.width - 14, GROUND_Y + 16);
      ctx.lineTo(obstacle.x + obstacle.width, GROUND_Y - 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#171b17";
      ctx.lineWidth = 6;
      ctx.stroke();
    }
  }

  function drawCable() {
    const bob = state.mode === "running" ? Math.sin(soldier.runPhase * 2) * 3 : 0;
    const spoolX = SOLDIER_X - 45;
    const spoolY = soldier.y - 72 + bob;
    ctx.strokeStyle = colors.cable;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-30, GROUND_Y + 12);
    ctx.bezierCurveTo(75, GROUND_Y + 8, 120, GROUND_Y - 10, 178, GROUND_Y + 3);
    ctx.bezierCurveTo(222, GROUND_Y + 15, spoolX - 40, spoolY + 32, spoolX, spoolY);
    ctx.stroke();
    ctx.strokeStyle = "rgba(232, 225, 197, 0.15)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  function drawObstacles() {
    for (const obstacle of obstacles) {
      if (obstacle.type === "pit") {
        drawPitDetails(obstacle);
      } else if (obstacle.type === "crate") {
        drawCrate(obstacle);
      } else {
        drawBarricade(obstacle);
      }
    }
  }

  function drawPitDetails(obstacle) {
    ctx.strokeStyle = "#302b22";
    ctx.lineWidth = 5;
    for (let i = 0; i < 3; i += 1) {
      const x = obstacle.x + 20 + i * ((obstacle.width - 40) / 2);
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 14);
      ctx.lineTo(x + random(-10, 10), GROUND_Y + 70);
      ctx.stroke();
    }
  }

  function drawCrate(obstacle) {
    const x = obstacle.x;
    const y = GROUND_Y - obstacle.height;
    ctx.fillStyle = "#574b31";
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 5;
    ctx.fillRect(x, y, obstacle.width, obstacle.height);
    ctx.strokeRect(x, y, obstacle.width, obstacle.height);
    ctx.strokeStyle = "#85724a";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x + 7, y + 7);
    ctx.lineTo(x + obstacle.width - 7, y + obstacle.height - 7);
    ctx.moveTo(x + obstacle.width - 7, y + 7);
    ctx.lineTo(x + 7, y + obstacle.height - 7);
    ctx.stroke();
    ctx.fillStyle = "#171b17";
    ctx.font = "bold 14px Consolas";
    ctx.fillText("POLNÍ", x + 7, y + obstacle.height / 2 + 5);
  }

  function drawBarricade(obstacle) {
    const x = obstacle.x;
    const y = GROUND_Y - obstacle.height;
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x + 14, GROUND_Y);
    ctx.lineTo(x + 27, y + 10);
    ctx.moveTo(x + obstacle.width - 14, GROUND_Y);
    ctx.lineTo(x + obstacle.width - 27, y + 10);
    ctx.stroke();
    ctx.fillStyle = "#80643a";
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 4;
    ctx.save();
    ctx.translate(x + obstacle.width / 2, y + 20);
    ctx.rotate(-0.06);
    ctx.fillRect(-obstacle.width / 2, -13, obstacle.width, 27);
    ctx.strokeRect(-obstacle.width / 2, -13, obstacle.width, 27);
    ctx.restore();
    ctx.fillStyle = colors.signal || "#f2b441";
    for (let i = 0; i < 3; i += 1) {
      ctx.fillRect(x + 8 + i * 25, y + 10, 11, 23);
    }
  }

  function drawParticles() {
    for (const particle of particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.globalAlpha = alpha * (particle.kind === "smoke" ? 0.55 : 0.9);
      ctx.fillStyle = particle.kind === "smoke" ? colors.smoke : colors.fire;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, Math.max(2, particle.size), 0, Math.PI * 2);
      ctx.fill();
      if (particle.kind === "fire") {
        ctx.fillStyle = colors.fireHot;
        ctx.beginPath();
        ctx.arc(particle.x - 3, particle.y - 3, Math.max(2, particle.size * 0.38), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = colors.ember;
    for (const ember of embers) {
      ctx.globalAlpha = clamp(ember.life * 2, 0, 1);
      ctx.fillRect(ember.x, ember.y, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function drawSoldier() {
    const running = state.mode === "running";
    const phase = running ? soldier.runPhase : 0;
    const bob = running && soldier.onGround ? Math.abs(Math.sin(phase)) * -5 : 0;
    const lean = soldier.fallen ? 0.85 : running ? 0.12 : 0;
    const stride = soldier.onGround ? Math.sin(phase) : 0.55;
    const armSwing = soldier.onGround ? Math.sin(phase + Math.PI) : -0.4;

    ctx.save();
    ctx.translate(SOLDIER_X, soldier.y + bob);
    ctx.rotate(lean);

    drawLeg(-8, -6, stride * 32, 0);
    drawLeg(10, -7, -stride * 32, 1);
    drawBackpack();

    ctx.fillStyle = colors.uniform;
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-23, -104);
    ctx.quadraticCurveTo(10, -117, 27, -94);
    ctx.lineTo(20, -43);
    ctx.lineTo(-20, -44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    drawArm(-6, -91, armSwing * 25, true);
    drawArm(12, -90, -armSwing * 24, false);

    ctx.fillStyle = colors.skin;
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(10, -126, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colors.helmet;
    ctx.beginPath();
    ctx.arc(6, -134, 27, Math.PI, Math.PI * 2);
    ctx.lineTo(34, -130);
    ctx.lineTo(24, -124);
    ctx.lineTo(-19, -125);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colors.outline;
    ctx.beginPath();
    ctx.arc(22, -127, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colors.leather;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-9, -120);
    ctx.quadraticCurveTo(5, -109, 19, -116);
    ctx.stroke();

    ctx.fillStyle = colors.leather;
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 4;
    ctx.fillRect(-22, -59, 45, 13);
    ctx.strokeRect(-22, -59, 45, 13);

    ctx.restore();
  }

  function drawBackpack() {
    ctx.fillStyle = "#3b4430";
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(-54, -108, 38, 67, 6);
    ctx.fill();
    ctx.stroke();

    const spin = state.distance * 0.34;
    ctx.save();
    ctx.translate(-50, -72);
    ctx.rotate(spin);
    ctx.fillStyle = "#695236";
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = colors.cable;
    ctx.lineWidth = 4;
    for (let radius = 6; radius <= 17; radius += 5) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#c19958";
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLeg(x, y, swing, back) {
    const hipY = -47;
    const kneeX = x + swing * 0.45;
    const kneeY = -25 + Math.abs(swing) * 0.16;
    const footX = x + swing;
    const footY = y;
    ctx.strokeStyle = back ? "#40472e" : colors.uniformLight;
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(footX - 4, footY);
    ctx.lineTo(footX + 18, footY);
    ctx.stroke();
  }

  function drawArm(x, y, swing, back) {
    const handX = x + 23 + swing;
    const handY = -54 + Math.abs(swing) * 0.25;
    ctx.strokeStyle = back ? "#424a32" : colors.uniformLight;
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 15 - swing * 0.15, -76);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    ctx.fillStyle = colors.skin;
    ctx.beginPath();
    ctx.arc(handX, handY, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawForeground() {
    ctx.fillStyle = "rgba(10, 14, 12, 0.55)";
    const offset = (state.distance * 33) % 210;
    for (let i = -1; i < 7; i += 1) {
      const x = i * 210 - offset;
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.quadraticCurveTo(x + 45, 575, x + 100, H);
      ctx.fill();
    }
  }

  function drawVignette() {
    const gradient = ctx.createRadialGradient(W / 2, H / 2, 180, W / 2, H / 2, 690);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.025)";
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  }

  function frame(now) {
    const dt = Math.min(0.032, (now - state.lastTime) / 1000 || 0);
    state.lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  startButton.addEventListener("click", startCountdown);
  restartButton.addEventListener("click", startCountdown);
  jumpButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    jump();
  });
  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    jump();
  });
  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space") return;
    event.preventDefault();
    if (!event.repeat) jump();
  });
  window.addEventListener("blur", () => {
    state.lastTime = performance.now();
  });

  updateHud();
  requestAnimationFrame(frame);
})();
