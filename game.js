(function () {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const ui = {
    start: document.getElementById("startScreen"),
    pause: document.getElementById("pauseScreen"),
    end: document.getElementById("endScreen"),
    startBtn: document.getElementById("startButton"),
    resumeBtn: document.getElementById("resumeButton"),
    restartBtn: document.getElementById("restartButton"),
    pauseBtn: document.getElementById("pauseButton"),
    soundBtn: document.getElementById("soundButton"),
    soundIcon: document.getElementById("soundIcon"),
    objective: document.getElementById("objectiveText"),
    healthBar: document.getElementById("healthBar"),
    healthText: document.getElementById("healthText"),
    radioCount: document.getElementById("radioCount"),
    signalBars: [...document.querySelectorAll("#signalBars i")],
    timer: document.getElementById("timerText"),
    prompt: document.getElementById("contextPrompt"),
    promptText: document.getElementById("contextText"),
    progress: document.getElementById("radioProgress"),
    progressBar: document.getElementById("radioProgressBar"),
    resultCard: document.querySelector(".result-card"),
    resultStamp: document.getElementById("resultStamp"),
    resultTitle: document.getElementById("resultTitle"),
    resultText: document.getElementById("resultText"),
    finalTime: document.getElementById("finalTime"),
    finalRadios: document.getElementById("finalRadios"),
    finalHealth: document.getElementById("finalHealth")
  };

  const keys = Object.create(null);
  let state = "title";
  let lastTime = 0;
  let missionTime = 0;
  let screenShake = 0;
  let radioHumPhase = 0;
  let audioOn = true;
  let audioCtx = null;

  const player = {
    x: 90, y: 510, radius: 14, speed: 150, health: 100,
    invulnerable: 0, rollCooldown: 0, rolling: 0,
    interact: 0, walkPhase: 0
  };

  const radios = [
    { x: 230, y: 430, fixed: false, pulse: 0 },
    { x: 510, y: 160, fixed: false, pulse: 1.8 },
    { x: 760, y: 390, fixed: false, pulse: 3.4 }
  ];

  const hq = { x: 886, y: 88, radius: 42 };
  const obstacles = [
    { x: 146, y: 278, w: 138, h: 44, type: "sandbags" },
    { x: 365, y: 343, w: 62, h: 118, type: "ruin" },
    { x: 577, y: 248, w: 145, h: 45, type: "sandbags" },
    { x: 780, y: 190, w: 66, h: 70, type: "ruin" },
    { x: 420, y: 53, w: 115, h: 30, type: "sandbags" },
    { x: 72, y: 102, w: 74, h: 66, type: "ruin" }
  ];

  const enemiesTemplate = [
    { x: 330, y: 235, ax: 285, ay: 250, bx: 455, by: 185, speed: 44 },
    { x: 630, y: 420, ax: 555, ay: 420, bx: 835, by: 420, speed: 50 },
    { x: 690, y: 105, ax: 565, ay: 135, bx: 810, by: 120, speed: 42 },
    { x: 225, y: 93, ax: 180, ay: 80, bx: 370, by: 160, speed: 38 }
  ];
  const enemyVision = {
    range: 160,
    halfAngle: .42,
    patrolTurnSpeed: 1.35,
    chaseTurnSpeed: 2.15,
    noticeTime: 1.25,
    forgetTime: .8
  };
  let enemies = [];
  let shells = [];
  let particles = [];
  let shellTimer = 2.5;

  const terrainDots = Array.from({ length: 145 }, (_, i) => ({
    x: (i * 83 + 41) % W,
    y: (i * 137 + 79) % H,
    r: 1 + (i % 4) * .55,
    tone: i % 3
  }));

  function resetGame() {
    player.x = 90;
    player.y = 510;
    player.health = 100;
    player.invulnerable = 0;
    player.rollCooldown = 0;
    player.rolling = 0;
    player.interact = 0;
    missionTime = 0;
    screenShake = 0;
    shellTimer = 2.7;
    shells = [];
    particles = [];
    radios.forEach((radio, index) => {
      radio.fixed = false;
      radio.pulse = index * 1.7;
    });
    enemies = enemiesTemplate.map((enemy, index) => {
      const dir = index % 2 ? -1 : 1;
      const targetX = dir > 0 ? enemy.bx : enemy.ax;
      const targetY = dir > 0 ? enemy.by : enemy.ay;
      return {
        ...enemy,
        dir,
        angle: Math.atan2(targetY - enemy.y, targetX - enemy.x),
        alert: 0,
        tracking: false,
        chasing: false,
        lastKnownX: enemy.x,
        lastKnownY: enemy.y,
        hitTimer: 0
      };
    });
    updateHud();
  }

  function beginGame() {
    initAudio();
    resetGame();
    state = "playing";
    ui.start.classList.add("hidden");
    ui.end.classList.add("hidden");
    ui.pause.classList.add("hidden");
    beep(260, .06, "square", .035);
    setTimeout(() => beep(390, .08, "square", .03), 80);
    lastTime = performance.now();
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      ui.pause.classList.remove("hidden");
    } else if (state === "paused") {
      state = "playing";
      ui.pause.classList.add("hidden");
      lastTime = performance.now();
    }
  }

  function finishGame(won) {
    state = won ? "won" : "lost";
    ui.end.classList.remove("hidden");
    ui.resultCard.classList.toggle("failed", !won);
    ui.resultStamp.textContent = won ? "SPOJENÍ OBNOVENO" : "SIGNÁL ZTRACEN";
    ui.resultTitle.textContent = won ? "Rozkaz doručen" : "Mise přerušena";
    ui.resultText.textContent = won
      ? "Velitelství přijalo zprávu. Síť znovu vysílá."
      : "Spojař byl vyřazen dřív, než mohl dokončit úkol.";
    ui.finalTime.textContent = formatTime(missionTime);
    ui.finalRadios.textContent = `${fixedCount()}/3`;
    ui.finalHealth.textContent = `${Math.max(0, Math.round(player.health))}%`;
    if (won) {
      beep(392, .12, "square", .04);
      setTimeout(() => beep(523, .12, "square", .04), 140);
      setTimeout(() => beep(659, .18, "square", .045), 280);
    } else {
      beep(130, .25, "sawtooth", .035);
    }
  }

  function fixedCount() {
    return radios.reduce((sum, radio) => sum + Number(radio.fixed), 0);
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }

  function updateHud() {
    const fixed = fixedCount();
    const health = Math.max(0, player.health);
    ui.healthBar.style.width = `${health}%`;
    ui.healthBar.style.background = health < 35 ? "#db634a" : "#d8e884";
    ui.healthText.textContent = Math.round(health);
    ui.radioCount.textContent = `${fixed}/3`;
    ui.signalBars.forEach((bar, index) => bar.classList.toggle("active", index < fixed));
    ui.timer.textContent = formatTime(missionTime);
    ui.objective.textContent = fixed < 3
      ? `Zprovozni vysílačky · ${fixed}/3`
      : "Doruč rozkaz na velitelství";
  }

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx?.state === "suspended") audioCtx.resume();
  }

  function beep(freq, duration, type = "square", volume = .025) {
    if (!audioOn || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  function collides(x, y, radius) {
    if (x - radius < 24 || x + radius > W - 24 || y - radius < 24 || y + radius > H - 24) return true;
    return obstacles.some(o => {
      const cx = Math.max(o.x, Math.min(x, o.x + o.w));
      const cy = Math.max(o.y, Math.min(y, o.y + o.h));
      return Math.hypot(x - cx, y - cy) < radius + 4;
    });
  }

  function movePlayer(dx, dy, dt) {
    if (!dx && !dy) return;
    const length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;
    const multiplier = player.rolling > 0 ? 2.65 : 1;
    const distance = player.speed * multiplier * dt;
    const nx = player.x + dx * distance;
    const ny = player.y + dy * distance;
    if (!collides(nx, player.y, player.radius)) player.x = nx;
    if (!collides(player.x, ny, player.radius)) player.y = ny;
    player.walkPhase += dt * 12 * multiplier;
  }

  function nearestInteraction() {
    for (const radio of radios) {
      if (!radio.fixed && Math.hypot(player.x - radio.x, player.y - radio.y) < 47) {
        return { type: "radio", target: radio };
      }
    }
    if (fixedCount() === 3 && Math.hypot(player.x - hq.x, player.y - hq.y) < 65) {
      return { type: "hq", target: hq };
    }
    return null;
  }

  function updatePlayer(dt) {
    const dx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    const dy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
    movePlayer(dx, dy, dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.rollCooldown = Math.max(0, player.rollCooldown - dt);
    player.rolling = Math.max(0, player.rolling - dt);

    if (keys.Space && player.rollCooldown <= 0 && (dx || dy)) {
      player.rolling = .24;
      player.rollCooldown = 1.05;
      player.invulnerable = Math.max(player.invulnerable, .3);
      beep(105, .04, "triangle", .012);
    }

    const interaction = nearestInteraction();
    ui.prompt.classList.toggle("hidden", !interaction);
    ui.progress.classList.add("hidden");

    if (!interaction) {
      player.interact = 0;
      return;
    }

    ui.promptText.textContent = interaction.type === "radio" ? "PODRŽ E · OPRAVIT VYSÍLAČKU" : "PODRŽ E · PŘEDAT ROZKAZ";
    if (keys.KeyE) {
      player.interact += dt;
      ui.progress.classList.remove("hidden");
      ui.progress.querySelector("span").textContent = interaction.type === "radio" ? "LADÍM FREKVENCI" : "PŘEDÁVÁM ROZKAZ";
      ui.progressBar.style.width = `${Math.min(100, player.interact / 1.35 * 100)}%`;
      if (Math.floor(player.interact * 8) !== Math.floor((player.interact - dt) * 8)) beep(190 + player.interact * 80, .025, "square", .008);
      if (player.interact >= 1.35) {
        player.interact = 0;
        if (interaction.type === "radio") {
          interaction.target.fixed = true;
          burst(interaction.target.x, interaction.target.y, "#d8e884", 18);
          beep(330, .08, "square", .035);
          setTimeout(() => beep(495, .1, "square", .025), 90);
          updateHud();
        } else {
          finishGame(true);
        }
      }
    } else {
      player.interact = Math.max(0, player.interact - dt * 1.8);
      ui.progressBar.style.width = `${player.interact / 1.35 * 100}%`;
    }
  }

  function lineBlocked(x1, y1, x2, y2) {
    const steps = 16;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      if (obstacles.some(o => x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h)) return true;
    }
    return false;
  }

  function angleDifference(from, to) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
  }

  function turnTowards(current, target, maxStep) {
    const difference = angleDifference(current, target);
    return current + Math.max(-maxStep, Math.min(maxStep, difference));
  }

  function updateEnemies(dt) {
    for (const enemy of enemies) {
      const playerDistance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      const playerAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const playerInCone = Math.abs(angleDifference(enemy.angle, playerAngle)) < enemyVision.halfAngle;
      const hasLineOfSight = playerDistance < enemyVision.range && !lineBlocked(enemy.x, enemy.y, player.x, player.y);

      // Vstup do kuželu zamkne pozornost hlídky. Potom hráče sleduje přes celý
      // zorný rozsah, dokud nezmizí za překážkou nebo neuteče z dosahu.
      if (!enemy.tracking && hasLineOfSight && playerInCone) enemy.tracking = true;
      if (enemy.tracking && !hasLineOfSight) enemy.tracking = false;
      const seesPlayer = enemy.tracking && hasLineOfSight;

      if (seesPlayer) {
        enemy.alert = Math.min(1, enemy.alert + dt / enemyVision.noticeTime);
        enemy.lastKnownX = player.x;
        enemy.lastKnownY = player.y;
      } else {
        enemy.alert = Math.max(0, enemy.alert - dt / enemyVision.forgetTime);
      }

      if (!enemy.chasing && enemy.alert >= 1) {
        enemy.chasing = true;
        beep(620, .07, "square", .018);
      } else if (enemy.chasing && enemy.alert <= 0) {
        enemy.chasing = false;
        enemy.tracking = false;
      }

      let targetX;
      let targetY;
      let speed = enemy.speed;
      if (enemy.chasing) {
        targetX = enemy.lastKnownX;
        targetY = enemy.lastKnownY;
        speed *= 1.28;
      } else if (enemy.tracking) {
        // Během odhalování nepokračuje v obchůzce, pouze drží hráče v kuželu.
        targetX = player.x;
        targetY = player.y;
        speed = 0;
      } else {
        targetX = enemy.dir > 0 ? enemy.bx : enemy.ax;
        targetY = enemy.dir > 0 ? enemy.by : enemy.ay;
        if (Math.hypot(targetX - enemy.x, targetY - enemy.y) < 8) {
          enemy.dir *= -1;
          targetX = enemy.dir > 0 ? enemy.bx : enemy.ax;
          targetY = enemy.dir > 0 ? enemy.by : enemy.ay;
        }
      }

      const targetAngle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
      const turnSpeed = enemy.chasing || enemy.tracking
        ? enemyVision.chaseTurnSpeed
        : enemyVision.patrolTurnSpeed;
      enemy.angle = turnTowards(enemy.angle, targetAngle, turnSpeed * dt);

      // Hlídka při prudkém obratu zpomalí, takže se neotáčí skokem ani neklouže bokem.
      const forwardAlignment = Math.max(0, Math.cos(angleDifference(enemy.angle, targetAngle)));
      const moveDistance = speed * forwardAlignment * dt;
      const nx = enemy.x + Math.cos(enemy.angle) * moveDistance;
      const ny = enemy.y + Math.sin(enemy.angle) * moveDistance;
      if (!collides(nx, enemy.y, 12)) enemy.x = nx;
      else if (!enemy.chasing) enemy.dir *= -1;
      if (!collides(enemy.x, ny, 12)) enemy.y = ny;
      else if (!enemy.chasing) enemy.dir *= -1;

      enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);
      const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      if (distance < 38 && enemy.hitTimer <= 0 && player.invulnerable <= 0) {
        enemy.hitTimer = .85;
        damagePlayer(16, enemy.x, enemy.y);
      }
    }
  }

  function updateShells(dt) {
    shellTimer -= dt;
    if (shellTimer <= 0) {
      const nearPlayer = Math.random() < .52;
      const x = nearPlayer ? player.x + (Math.random() - .5) * 240 : 80 + Math.random() * (W - 160);
      const y = nearPlayer ? player.y + (Math.random() - .5) * 190 : 70 + Math.random() * (H - 140);
      if (!collides(x, y, 30)) shells.push({ x, y, time: 1.35, exploded: false });
      shellTimer = 2.2 + Math.random() * 2.1;
    }

    for (const shell of shells) {
      shell.time -= dt;
      if (shell.time <= 0 && !shell.exploded) {
        shell.exploded = true;
        screenShake = 10;
        burst(shell.x, shell.y, "#e2a54d", 24);
        beep(68, .32, "sawtooth", .055);
        if (Math.hypot(player.x - shell.x, player.y - shell.y) < 58 && player.invulnerable <= 0) {
          damagePlayer(25, shell.x, shell.y);
        }
      }
    }
    shells = shells.filter(shell => shell.time > -.55);
  }

  function damagePlayer(amount, fromX, fromY) {
    player.health -= amount;
    player.invulnerable = .7;
    screenShake = 7;
    const angle = Math.atan2(player.y - fromY, player.x - fromX);
    const nx = player.x + Math.cos(angle) * 24;
    const ny = player.y + Math.sin(angle) * 24;
    if (!collides(nx, ny, player.radius)) { player.x = nx; player.y = ny; }
    burst(player.x, player.y, "#db634a", 10);
    beep(92, .12, "sawtooth", .035);
    updateHud();
    if (player.health <= 0) finishGame(false);
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 105;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .35 + Math.random() * .45, maxLife: .8, color });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= .96;
      p.vy *= .96;
      p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function update(dt) {
    missionTime += dt;
    radioHumPhase += dt;
    updatePlayer(dt);
    if (state !== "playing") return;
    updateEnemies(dt);
    updateShells(dt);
    updateParticles(dt);
    screenShake = Math.max(0, screenShake - dt * 28);
    updateHud();
  }

  function draw() {
    ctx.save();
    if (screenShake > 0) ctx.translate((Math.random() - .5) * screenShake, (Math.random() - .5) * screenShake);
    drawTerrain();
    drawRoute();
    drawHQ();
    radios.forEach(drawRadio);
    obstacles.forEach(drawObstacle);
    drawShells();
    enemies.forEach(drawEnemy);
    drawPlayer();
    drawParticles();
    drawVignette();
    ctx.restore();
  }

  function drawTerrain() {
    ctx.fillStyle = "#283024";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(198,203,143,.055)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    ctx.strokeStyle = "rgba(190,175,119,.08)";
    ctx.lineWidth = 18;
    ctx.setLineDash([22, 12]);
    ctx.beginPath();
    ctx.moveTo(-20, 535);
    ctx.bezierCurveTo(240, 490, 315, 560, 470, 410);
    ctx.bezierCurveTo(580, 300, 750, 210, 990, 165);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const dot of terrainDots) {
      ctx.fillStyle = dot.tone === 0 ? "#384031" : dot.tone === 1 ? "#1c241c" : "#4a4d36";
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
      ctx.fill();
    }

    drawTrench(0, 356, 195, 375);
    drawTrench(735, 535, 980, 500);
    drawCrater(303, 512, 31);
    drawCrater(550, 520, 22);
    drawCrater(888, 335, 29);
    drawCrater(505, 282, 17);
  }

  function drawTrench(x1, y1, x2, y2) {
    ctx.strokeStyle = "#151a14";
    ctx.lineWidth = 18;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = "#51503a";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(x1, y1 - 10); ctx.lineTo(x2, y2 - 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1 + 10); ctx.lineTo(x2, y2 + 10); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCrater(x, y, r) {
    ctx.fillStyle = "rgba(12,16,12,.42)";
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .62, -.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(109,100,67,.45)";
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  function drawRoute() {
    ctx.strokeStyle = "rgba(216,232,132,.22)";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 9]);
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    const remaining = radios.find(r => !r.fixed);
    const target = remaining || hq;
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawHQ() {
    ctx.save();
    ctx.translate(hq.x, hq.y);
    ctx.strokeStyle = fixedCount() === 3 ? "rgba(216,232,132,.75)" : "rgba(216,232,132,.2)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 43 + Math.sin(radioHumPhase * 3) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#5c623f";
    ctx.fillRect(-27, -18, 54, 38);
    ctx.fillStyle = "#303627";
    ctx.beginPath(); ctx.moveTo(-34, -18); ctx.lineTo(0, -40); ctx.lineTo(34, -18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#d8e884";
    ctx.fillRect(-5, -8, 10, 17);
    ctx.font = "bold 10px Courier New";
    ctx.textAlign = "center";
    ctx.fillText("HQ", 0, 34);
    ctx.restore();
  }

  function drawRadio(radio) {
    ctx.save();
    ctx.translate(radio.x, radio.y);
    const pulse = 17 + ((radioHumPhase * 24 + radio.pulse * 10) % 23);
    if (!radio.fixed) {
      ctx.strokeStyle = `rgba(226,165,77,${.7 - (pulse - 17) / 38})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, pulse, 0, Math.PI * 2); ctx.stroke();
    } else {
      for (let i = 0; i < 2; i++) {
        ctx.strokeStyle = `rgba(216,232,132,${.32 - i * .11})`;
        ctx.beginPath(); ctx.arc(0, -18, 25 + i * 11 + Math.sin(radioHumPhase * 3) * 2, Math.PI * 1.18, Math.PI * 1.82); ctx.stroke();
      }
    }
    ctx.strokeStyle = "#0c100c";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(19, -38); ctx.stroke();
    ctx.fillStyle = radio.fixed ? "#77834e" : "#75613a";
    ctx.fillRect(-15, -12, 30, 27);
    ctx.fillStyle = "#171c14";
    ctx.fillRect(-9, -6, 18, 8);
    ctx.fillStyle = radio.fixed ? "#d8e884" : "#e2a54d";
    ctx.beginPath(); ctx.arc(8, 9, 3, 0, Math.PI * 2); ctx.fill();
    ctx.font = "bold 9px Courier New";
    ctx.textAlign = "center";
    ctx.fillStyle = radio.fixed ? "#d8e884" : "#e2a54d";
    ctx.fillText(radio.fixed ? "ONLINE" : "OFFLINE", 0, 28);
    ctx.restore();
  }

  function drawObstacle(o) {
    ctx.save();
    if (o.type === "sandbags") {
      const count = Math.floor(o.w / 18);
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < count; i++) {
          const x = o.x + i * (o.w / count) + (row ? 7 : 0);
          const y = o.y + row * 17;
          ctx.fillStyle = (i + row) % 2 ? "#736e4d" : "#827b55";
          ctx.beginPath(); ctx.roundRect(x, y, o.w / count - 2, 15, 6); ctx.fill();
          ctx.strokeStyle = "#454631"; ctx.lineWidth = 1; ctx.stroke();
        }
      }
    } else {
      ctx.fillStyle = "#3b4035";
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = "#252b24";
      ctx.fillRect(o.x + 8, o.y + 9, o.w - 24, 18);
      ctx.fillRect(o.x + o.w - 20, o.y + 35, 20, o.h - 35);
      ctx.strokeStyle = "#60604b";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.w * .36, o.y + 20); ctx.lineTo(o.x + o.w, o.y + 4); ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.angle);
    const coneColor = enemy.chasing ? "219,99,74" : "226,165,77";
    const coneAlpha = .07 + enemy.alert * .16;
    ctx.fillStyle = `rgba(${coneColor},${coneAlpha})`;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.arc(8, 0, enemyVision.range, -enemyVision.halfAngle, enemyVision.halfAngle);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(${coneColor},${.18 + enemy.alert * .35})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.rotate(-enemy.angle);
    ctx.fillStyle = "rgba(0,0,0,.32)";
    ctx.beginPath(); ctx.ellipse(3, 9, 15, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(enemy.angle);
    ctx.fillStyle = enemy.chasing ? "#a94838" : "#574b3d";
    ctx.fillRect(-8, -8, 17, 18);
    ctx.fillStyle = "#282a20";
    ctx.beginPath(); ctx.arc(0, -10, 8, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = "#161a15";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(18, 0); ctx.stroke();
    ctx.rotate(-enemy.angle);
    if (enemy.alert > .04) {
      ctx.strokeStyle = enemy.chasing ? "#db634a" : "#e2a54d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -27, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * enemy.alert);
      ctx.stroke();
      ctx.fillStyle = enemy.chasing ? "#db634a" : "#e2a54d";
      ctx.font = "bold 13px Courier New";
      ctx.textAlign = "center";
      ctx.fillText(enemy.chasing ? "!" : "?", 0, -23);
    }
    ctx.restore();
  }

  function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.globalAlpha = player.invulnerable > 0 && Math.floor(player.invulnerable * 18) % 2 ? .38 : 1;
    ctx.fillStyle = "rgba(0,0,0,.38)";
    ctx.beginPath(); ctx.ellipse(0, 10, 17, 8, 0, 0, Math.PI * 2); ctx.fill();
    const step = Math.sin(player.walkPhase) * 4;
    ctx.strokeStyle = "#141914";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-5, 7); ctx.lineTo(-7, 16 + step); ctx.moveTo(5, 7); ctx.lineTo(7, 16 - step); ctx.stroke();
    ctx.fillStyle = "#728053";
    ctx.fillRect(-10, -9, 20, 22);
    ctx.fillStyle = "#313a2a";
    ctx.fillRect(-14, -7, 7, 19);
    ctx.strokeStyle = "#171c16";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-12, -7); ctx.lineTo(-19, -29); ctx.stroke();
    ctx.fillStyle = "#a09266";
    ctx.beginPath(); ctx.arc(2, -12, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#4b533b";
    ctx.beginPath(); ctx.arc(2, -14, 9, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#161b15";
    ctx.fillRect(7, -2, 14, 4);
    ctx.restore();

    if (player.rollCooldown > 0) {
      ctx.strokeStyle = "rgba(216,232,132,.38)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 20, -Math.PI / 2, -Math.PI / 2 + (1 - player.rollCooldown / 1.05) * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawShells() {
    for (const shell of shells) {
      if (!shell.exploded) {
        const urgency = 1 - Math.max(0, shell.time) / 1.35;
        ctx.strokeStyle = `rgba(219,99,74,${.3 + urgency * .6})`;
        ctx.lineWidth = 2 + urgency * 2;
        ctx.beginPath(); ctx.arc(shell.x, shell.y, 38 - urgency * 13, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(219,99,74,${.05 + urgency * .12})`;
        ctx.beginPath(); ctx.arc(shell.x, shell.y, 28, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(219,99,74,.7)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(shell.x - 7, shell.y); ctx.lineTo(shell.x + 7, shell.y); ctx.moveTo(shell.x, shell.y - 7); ctx.lineTo(shell.x, shell.y + 7); ctx.stroke();
      } else {
        const fade = Math.max(0, (shell.time + .55) / .55);
        ctx.fillStyle = `rgba(226,165,77,${fade * .35})`;
        ctx.beginPath(); ctx.arc(shell.x, shell.y, 48 * fade, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function drawVignette() {
    const gradient = ctx.createRadialGradient(W / 2, H / 2, 190, W / 2, H / 2, 560);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,.58)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(232,240,190,.025)";
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  }

  function loop(now) {
    const dt = Math.min(.033, (now - lastTime) / 1000 || 0);
    lastTime = now;
    if (state === "playing") update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function pressKey(code, pressed) {
    keys[code] = pressed;
    if (pressed && code === "Space") keys.Space = true;
  }

  window.addEventListener("keydown", event => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    if (event.repeat && ["KeyP", "KeyM", "Enter"].includes(event.code)) return;
    pressKey(event.code, true);
    if (event.code === "Enter" && (state === "title" || state === "won" || state === "lost")) beginGame();
    if (event.code === "KeyP" && (state === "playing" || state === "paused")) togglePause();
    if (event.code === "KeyM") toggleSound();
  });
  window.addEventListener("keyup", event => pressKey(event.code, false));
  window.addEventListener("blur", () => {
    Object.keys(keys).forEach(key => keys[key] = false);
    if (state === "playing") togglePause();
  });

  function bindHoldButton(button) {
    const code = button.dataset.key;
    const down = event => { event.preventDefault(); initAudio(); pressKey(code, true); };
    const up = event => { event.preventDefault(); pressKey(code, false); };
    button.addEventListener("pointerdown", down);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointercancel", up);
    button.addEventListener("pointerleave", up);
  }
  document.querySelectorAll("[data-key]").forEach(bindHoldButton);

  function toggleSound() {
    audioOn = !audioOn;
    ui.soundIcon.textContent = audioOn ? "◖" : "×";
    ui.soundBtn.setAttribute("aria-label", audioOn ? "Vypnout zvuk" : "Zapnout zvuk");
    if (audioOn) { initAudio(); beep(330, .05, "square", .02); }
  }

  ui.startBtn.addEventListener("click", beginGame);
  ui.restartBtn.addEventListener("click", beginGame);
  ui.resumeBtn.addEventListener("click", togglePause);
  ui.pauseBtn.addEventListener("click", togglePause);
  ui.soundBtn.addEventListener("click", toggleSound);

  resetGame();
  requestAnimationFrame(loop);
})();
