/* Canvas presentation. Background is cached; all transient effects are bounded. */
(() => {
  "use strict";
  const { TYPES, clamp } = NulovyBod;
  const TAU = Math.PI * 2;
  function polygon(c, points, fill, stroke) {
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.stroke(); }
  }
  function ellipse(c, x, y, rx, ry, fill) { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
  class GameRenderer {
    constructor(canvas, game) {
      this.canvas = canvas; this.ctx = canvas.getContext("2d", { alpha: false }); this.game = game;
      this.background = document.createElement("canvas"); this.bg = this.background.getContext("2d", { alpha: false });
      this.images = {}; this.particles = []; this.labels = []; this.rings = []; this.tracers = []; this.casings = [];
      this.recoil = this.muzzle = this.hitmark = this.damage = this.shake = 0; this.effects = true; this.visualTime = 0;
      this.dust = Array.from({ length: 42 }, () => ({ u: Math.random(), v: Math.random(), s: 0.4 + Math.random() * 1.8, speed: 0.006 + Math.random() * 0.012 }));
      this.load("outpost", "assets/outpost.png"); this.load("rifle", "assets/rifle.png"); this.load("enemy", "assets/operative.png");
      this.resize();
    }
    load(name, src) {
      const img = new Image();
      img.onload = () => { this.images[name] = img; if (name === "outpost") this.cacheBackground(); };
      img.onerror = () => { /* Procedural artwork remains available offline if an asset is absent. */ };
      img.src = src;
    }
    resize() {
      this.w = this.game.width; this.h = this.game.height; this.dpr = Math.min(devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.background.width = this.canvas.width; this.background.height = this.canvas.height;
      this.bg.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.cacheBackground();
    }
    cacheBackground() {
      const c = this.bg, w = this.w, h = this.h, img = this.images.outpost;
      if (img) {
        const s = Math.max(w / img.width, h / img.height);
        c.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
      } else {
        const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#152e3b"); g.addColorStop(0.45, "#ce925e"); g.addColorStop(0.47, "#4c5147"); g.addColorStop(1, "#142322"); c.fillStyle = g; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 18; i++) { c.fillStyle = i % 2 ? "#263632" : "#33423a"; const y = h * (0.32 + Math.sin(i * 5) * 0.07); c.fillRect(w * i / 17, y, w / 15, h * 0.49 - y); }
        c.fillStyle = "#121e1c"; c.fillRect(w * 0.56, h * 0.13, 3, h * 0.34);
      }
    }
    reset() { this.particles = []; this.labels = []; this.rings = []; this.tracers = []; this.casings = []; this.recoil = this.muzzle = this.hitmark = this.damage = this.shake = 0; }
    weaponPose() {
      const menu = this.game.mode === "menu";
      const size = Math.min(this.w * (menu ? 0.82 : 0.86), this.h * (menu ? 0.85 : 0.72));
      const reload = this.game.reloading ? Math.sin(clamp(this.game.reloading.elapsed / this.game.reloading.duration, 0, 1) * Math.PI) : 0;
      const sx = (this.game.aim.x / this.w - 0.5) * 16, sy = (this.game.aim.y / this.h - 0.5) * 9;
      const x = this.w * (this.w < 650 ? 0.24 : 0.51) + sx + this.recoil * 8;
      const y = this.h - size * (menu ? 0.67 : 0.58) + sy + this.recoil * 14 + reload * size * 0.24;
      return { x, y, size, reload, mx: x + size * 0.21, my: y + size * 0.108 };
    }
    emitParticles(x, y, count, colors, force = 1) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU, speed = (30 + Math.random() * 220) * force;
        this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 20, life: 0.25 + Math.random() * 0.45, max: 0.7, size: 1 + Math.random() * 3, color: colors[i % colors.length] });
      }
      if (this.particles.length > 280) this.particles.splice(0, this.particles.length - 280);
    }
    event(e) {
      switch (e.type) {
        case "shot": {
          this.recoil = 1; this.muzzle = 1;
          const p = this.weaponPose();
          this.tracers.push({ x: p.mx, y: p.my, tx: e.x, ty: e.y, life: 0.055, color: e.boosted ? "#a6f4dc" : "#ffe0a1" });
          if (this.effects) this.casings.push({ x: p.x + p.size * 0.59, y: p.y + p.size * 0.45, vx: 110 + Math.random() * 140, vy: -130 - Math.random() * 150, spin: Math.random() * TAU, life: 0.75 });
          break;
        }
        case "hit": this.hitmark = 0.16; this.headmark = e.head; this.emitParticles(e.x, e.y, e.head ? 14 : 8, e.armor ? ["#edca89", "#ebf5e4"] : ["#ffc178", "#e5e3c2"], 0.8); break;
        case "miss": this.emitParticles(e.x, e.y, 5, ["#a3a398", "#d1b184"], 0.4); break;
        case "kill": this.labels.push({ x: e.x, y: e.y - 58 * this.game.scale, text: `+${e.points}`, detail: e.head ? "PRŮSTŘEL HLAVY" : e.blast ? "ELIMINACE" : "ZÁSAH", life: 0.9, color: e.head ? "#afe5c4" : "#f4c785" }); if (e.kind === "drone") this.emitParticles(e.x, e.y, 22, ["#dcf8e1", "#f69a5b", "#9ecdc9"]); break;
        case "explosion": this.rings.push({ x: e.x, y: e.y, radius: e.radius, age: 0, life: 0.85 }); this.emitParticles(e.x, e.y, this.effects ? 65 : 20, ["#ffdf8e", "#ff9a4d", "#a9a49b"], 2); this.shake = 12; break;
        case "damage": this.damage = 0.85; this.shake = 10; this.damageSide = e.u < 0.5 ? -1 : 1; break;
        case "supply": this.emitParticles(e.x, e.y, 18, ["#a4e9ca", "#f5ffe9"]); this.labels.push({ x: e.x, y: e.y, text: "+25 ZDRAVÍ", life: 1, color: "#afe5c4" }); break;
        case "perfect": this.labels.push({ x: this.w / 2, y: this.h * 0.68, text: "PŘESNÉ PŘEBITÍ", detail: "+25 · 6 POSÍLENÝCH STŘEL", life: 1.2, color: "#afe5c4" }); break;
      }
    }
    update(dt) {
      this.visualTime += dt;
      this.recoil = Math.max(0, this.recoil - dt * 7); this.muzzle = Math.max(0, this.muzzle - dt * 18);
      this.hitmark = Math.max(0, this.hitmark - dt); this.damage = Math.max(0, this.damage - dt * 1.7); this.shake = Math.max(0, this.shake - dt * 35);
      for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += dt * 280; p.vx *= Math.pow(0.3, dt); }
      for (const p of this.casings) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += dt * 760; p.spin += dt * 15; }
      for (const p of this.labels) { p.life -= dt; p.y -= dt * 30; }
      for (const p of this.rings) { p.life -= dt; p.age += dt; }
      for (const p of this.tracers) p.life -= dt;
      this.particles = this.particles.filter(p => p.life > 0); this.casings = this.casings.filter(p => p.life > 0);
      this.labels = this.labels.filter(p => p.life > 0); this.rings = this.rings.filter(p => p.life > 0); this.tracers = this.tracers.filter(p => p.life > 0);
    }
    soldier(c, e) {
      const heavy = e.kind === "heavy", scout = e.kind === "scout";
      const shade = heavy ? "#555d5b" : scout ? "#49605b" : "#667269";
      const stripe = TYPES[e.kind].color;
      const step = Math.sin(e.phase * 3) * (scout ? 7 : 2.5);
      // Articulated legs with thigh, knee and boot surfaces.
      for (const side of [-1, 1]) {
        c.save(); c.translate(side * 12, 13); c.rotate(side * step * 0.012);
        polygon(c, [[-10, -2], [10, -2], [12, 24], [8, 43], [-10, 43]], shade, "#242c2c");
        polygon(c, [[-8, 18], [10, 19], [9, 30], [-7, 31]], "#303e3c", "#9aa08a");
        polygon(c, [[-10, 40], [8, 40], [14, 49], [14, 53], [-12, 53]], "#182323", "#5e6a5d");
        c.restore();
      }
      const body = c.createLinearGradient(-33, -40, 32, 20); body.addColorStop(0, "#8d9380"); body.addColorStop(0.3, shade); body.addColorStop(1, "#253735");
      polygon(c, [[-23, -48], [22, -48], [31, -33], [26, 15], [-24, 15], [-30, -30]], body, "#a3aa94");
      polygon(c, [[-19, -42], [17, -42], [23, -32], [19, -1], [-20, -1], [-23, -29]], "#283b3b", "#9b9d88");
      polygon(c, [[-15, -36], [13, -36], [17, -28], [14, -10], [-17, -10]], "#40534f");
      c.fillStyle = stripe; c.fillRect(-18, -42, 5, 10); c.fillRect(14, -42, 5, 10);
      c.fillStyle = "#7d8972"; for (let i = 0; i < 3; i++) c.fillRect(-18 + i * 13, -3, 10, 13);
      for (const side of [-1, 1]) {
        polygon(c, [[side * 21, -45], [side * 36, -38], [side * 37, -13], [side * 18, -18]], shade, "#8a9b85");
        polygon(c, [[side * 23, -42], [side * 35, -36], [side * 34, -27], [side * 23, -29]], heavy ? "#768174" : "#41564f", "#9a9f88");
      }
      c.fillStyle = "#1b2929"; c.fillRect(-21, -25, 53, 9); c.fillRect(24, -27, 23, 6); c.fillRect(0, -17, 11, 17);
      c.fillStyle = "#8b9a84"; c.fillRect(-17, -26, 35, 2); ellipse(c, -12, -19, 8, 5, "#505e4e"); ellipse(c, 22, -19, 7, 6, "#566954");
      polygon(c, [[-13, -69], [-10, -78], [7, -80], [14, -70], [12, -54], [5, -49], [-7, -50], [-13, -58]], "#283d3b", "#97a78d");
      polygon(c, [[-13, -67], [-10, -79], [7, -81], [15, -72], [15, -66]], "#697e6c", "#b0b299");
      c.fillStyle = e.attack < 0.9 ? "#ff9271" : "#efa46b"; c.shadowBlur = 8; c.shadowColor = "#ff8758"; c.fillRect(-10, -66, 21, 4); c.shadowBlur = 0;
      c.fillStyle = "#1f302e"; c.fillRect(-6, -59, 11, 8);
    }
    drone(c, e) {
      const rotation = Math.sin(this.visualTime * 65) * 5;
      for (const side of [-1, 1]) {
        polygon(c, [[side * 8, -6], [side * 37, -13], [side * 43, -2], [side * 11, 6]], "#354b49", "#a2b7ab");
        ellipse(c, side * 34, -9, 20, 5, "#203234");
        c.strokeStyle = "#b2cbc877"; c.lineWidth = 2; c.beginPath(); c.ellipse(side * 34, -9, 20 + rotation * 0.3, 4, 0, 0, TAU); c.stroke();
        c.fillStyle = "#8daca5"; c.fillRect(side * 34 - 3, -12, 6, 8);
      }
      const b = c.createLinearGradient(-18, -12, 18, 14); b.addColorStop(0, "#b0bcb0"); b.addColorStop(0.4, "#526b65"); b.addColorStop(1, "#1e3435");
      polygon(c, [[-17, -12], [13, -13], [23, -3], [16, 14], [-14, 14], [-23, 0]], b, "#93b2a7");
      ellipse(c, 0, 0, 11, 10, "#162c2e"); c.shadowBlur = 14; c.shadowColor = "#ff8053"; ellipse(c, 0, 0, 5, 5, e.attack < 0.9 ? "#ffe8a5" : "#ed9c68"); c.shadowBlur = 0;
      c.fillStyle = "#182629"; c.fillRect(-9, 12, 5, 11); c.fillRect(6, 12, 5, 11);
    }
    enemy(e) {
      const c = this.ctx, g = this.game.geometry(e), cfg = TYPES[e.kind];
      const entrance = clamp(e.age / 0.3, 0, 1), death = e.dead ? e.deathTime / 0.65 : 0;
      c.save(); c.translate(g.x, g.y);
      if (e.kind !== "drone") ellipse(c, 0, 63 * g.s, 44 * g.s, 7 * g.s, `rgba(0,0,0,${0.32 * (1 - death)})`);
      c.globalAlpha = entrance * (1 - death); c.translate(0, (1 - entrance) * 14 + death * 28); c.scale(g.s, g.s); c.rotate(death * (e.u < 0.5 ? -1.1 : 1.1));
      if (e.kind === "drone") this.drone(c, e);
      else if (this.images.enemy) {
        // Sprite is fitted to the same anatomical bounds used by hit testing.
        const img = this.images.enemy;
        c.drawImage(img, 0, 0, img.width, img.height, -49, -79, 98, 145);
        c.fillStyle = cfg.color; c.globalAlpha *= 0.9; c.fillRect(-23, -41, 6, 4); c.fillRect(18, -41, 6, 4);
        if (e.kind === "heavy") { c.strokeStyle = "#ffb18bcc"; c.lineWidth = 2; c.strokeRect(-25, -42, 50, 43); }
      } else this.soldier(c, e);
      if (e.flash > 0) {
        c.globalCompositeOperation = "screen"; c.globalAlpha = e.flash * 2.5;
        if (e.kind === "drone") ellipse(c, 0, 0, 20, 15, "#fff6c4"); else polygon(c, [[-22, -42], [23, -42], [22, 14], [-22, 14]], "#fff6c4");
        c.globalCompositeOperation = "source-over";
      }
      c.restore();
      if (e.dead) return;
      const y = g.y - (e.kind === "drone" ? 35 : 98) * g.s;
      const danger = e.attack < 1.2;
      const progress = 1 - clamp(e.attack / e.interval, 0, 1);
      c.save(); c.globalAlpha = entrance; c.textAlign = "center"; c.font = `${Math.max(8, 9 * g.s)}px ui-monospace,monospace`;
      c.fillStyle = danger ? "#ff9b7e" : "#ebe9d2"; c.shadowColor = "#071717"; c.shadowBlur = 5; c.fillText(danger ? "!  PÁLÍ" : cfg.name, g.x, y - 7);
      c.shadowBlur = 0; c.fillStyle = "#081718cc"; c.fillRect(g.x - 25 * g.s, y, 50 * g.s, 4);
      c.fillStyle = danger ? "#ff775f" : cfg.color; c.fillRect(g.x - 25 * g.s, y, 50 * g.s * progress, 3);
      if (e.hp < e.maxHp) { c.fillStyle = "#ffffff33"; c.fillRect(g.x - 20 * g.s, y + 7, 40 * g.s, 2); c.fillStyle = "#c4ddbd"; c.fillRect(g.x - 20 * g.s, y + 7, 40 * g.s * e.hp / e.maxHp, 2); }
      c.restore();
    }
    effectsLayer() {
      const c = this.ctx;
      for (const ring of this.rings) {
        c.save(); c.globalAlpha = Math.min(1, ring.life * 2);
        const r = Math.max(1, ring.radius * Math.min(1, ring.age * 4));
        const glow = c.createRadialGradient(ring.x, ring.y, 0, ring.x, ring.y, r); glow.addColorStop(0, "#fff0bb99"); glow.addColorStop(0.3, "#fba55d66"); glow.addColorStop(1, "#ce764500"); c.fillStyle = glow; c.fillRect(ring.x - r, ring.y - r, r * 2, r * 2);
        c.strokeStyle = "#e3b476"; c.lineWidth = 2; c.beginPath(); c.ellipse(ring.x, ring.y, r, r * 0.5, 0, 0, TAU); c.stroke(); c.restore();
      }
      for (const p of this.particles) { c.globalAlpha = clamp(p.life / p.max, 0, 1); c.fillStyle = p.color; c.fillRect(p.x, p.y, p.size, p.size); }
      c.globalAlpha = 1;
      for (const t of this.tracers) { c.strokeStyle = t.color; c.globalAlpha = t.life / 0.055 * 0.7; c.lineWidth = 1.5; c.beginPath(); c.moveTo(t.x, t.y); c.lineTo(t.tx, t.ty); c.stroke(); }
      c.globalAlpha = 1;
      for (const p of this.game.projectiles) {
        const t = 1 - p.life / p.total, x = p.u * this.w, y = p.v * this.h;
        if (p.kind === "grenade") {
          const gx = this.w * 0.55 + (x - this.w * 0.55) * t, gy = this.h * 0.87 + (y - this.h * 0.87) * t - Math.sin(t * Math.PI) * this.h * 0.23;
          ellipse(c, gx, gy, 5, 7, "#819b6d"); c.strokeStyle = "#cadd92"; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 15 + Math.sin(this.visualTime * 12) * 3, 0, TAU); c.stroke();
        } else {
          c.strokeStyle = "#ffca88"; c.lineWidth = 1 + t * 3; c.globalAlpha = 1 - t * 0.5; c.beginPath(); c.moveTo(x, y - 15); c.lineTo(x + (this.w * 0.5 - x) * t, y + (this.h - y) * t); c.stroke(); c.globalAlpha = 1;
        }
      }
    }
    weapon() {
      const c = this.ctx, p = this.weaponPose();
      c.save(); c.translate(p.x, p.y);
      c.translate(p.size * 0.75, p.size * 0.8); c.rotate(p.reload * 0.22 + (this.effects ? Math.sin(this.visualTime * 1.6) * 0.004 : 0)); c.translate(-p.size * 0.75, -p.size * 0.8);
      if (this.images.rifle) c.drawImage(this.images.rifle, 0, 0, p.size, p.size);
      else {
        c.scale(p.size / 520, p.size / 520);
        polygon(c, [[50, 400], [100, 145], [195, 193], [160, 510]], "#4c6556", "#9ba98c");
        polygon(c, [[115, 130], [142, 115], [470, 390], [485, 520], [360, 520]], "#273c3d", "#a9b8a3");
        polygon(c, [[108, 120], [128, 95], [172, 135], [148, 155]], "#1d2d2f", "#c6b587");
        for (let i = 0; i < 6; i++) polygon(c, [[178 + i * 20, 176 + i * 18], [187 + i * 20, 166 + i * 18], [198 + i * 20, 177 + i * 18], [189 + i * 20, 187 + i * 18]], "#17282a");
        polygon(c, [[274, 220], [274, 175], [310, 169], [331, 210], [316, 239]], "#214c50", "#b3c4a4");
      }
      c.restore();
      if (this.muzzle > 0) {
        const radius = this.effects ? 55 + Math.random() * 26 : 23;
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = this.muzzle;
        const glow = c.createRadialGradient(p.mx, p.my, 1, p.mx, p.my, radius); glow.addColorStop(0, "#fffdea"); glow.addColorStop(0.18, "#ffe4a9"); glow.addColorStop(0.5, "#ffa35199"); glow.addColorStop(1, "#ff713300"); c.fillStyle = glow; c.fillRect(p.mx - radius, p.my - radius, radius * 2, radius * 2);
        c.translate(p.mx, p.my); c.rotate(Math.random() * TAU); polygon(c, [[-33, 0], [-6, -4], [0, -28], [5, -5], [31, 0], [5, 5], [0, 26], [-5, 4]], "#fff2cb"); c.restore();
      }
      for (const p of this.casings) { c.save(); c.translate(p.x, p.y); c.rotate(p.spin); c.fillStyle = "#caa565"; c.fillRect(-2, -5, 4, 10); c.fillStyle = "#ffdf9a"; c.fillRect(-2, -5, 1, 10); c.restore(); }
    }
    crosshair() {
      if (this.game.mode !== "playing") return;
      const c = this.ctx, { x, y } = this.game.aim, gap = 6 + this.recoil * 5;
      const target = this.game.enemies.find(e => this.game.hitTest(e, x, y));
      c.save(); c.translate(x, y); c.strokeStyle = target ? "#ffd18c" : this.game.focusing ? "#a8eedb" : "#f7f1df"; c.shadowColor = "#061312"; c.shadowBlur = 4; c.lineWidth = 1.5;
      c.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; c.moveTo(Math.cos(a) * gap, Math.sin(a) * gap); c.lineTo(Math.cos(a) * (gap + 8), Math.sin(a) * (gap + 8)); } c.stroke();
      c.fillStyle = "#fff6dd"; c.fillRect(-1, -1, 2, 2);
      if (this.hitmark > 0) { c.strokeStyle = this.headmark ? "#baffd7" : "#fff3ce"; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; c.moveTo(Math.cos(a) * 7, Math.sin(a) * 7); c.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); } c.stroke(); }
      c.restore();
    }
    render() {
      const c = this.ctx, g = this.game;
      c.drawImage(this.background, 0, 0, this.w, this.h);
      // Background and targets never shake: the crosshair and hitboxes stay exact.
      if (this.effects) {
        for (const d of this.dust) { const x = ((d.u + this.visualTime * d.speed) % 1) * this.w, y = d.v * this.h; c.globalAlpha = 0.06 + d.s * 0.035; c.fillStyle = "#f9d69a"; c.fillRect(x, y + Math.sin(this.visualTime + d.u * 12) * 7, d.s, d.s); } c.globalAlpha = 1;
      }
      for (const e of [...g.enemies].sort((a, b) => a.v - b.v)) this.enemy(e);
      for (const s of g.supplies) {
        const x = s.u * this.w, y = s.v * this.h + Math.sin(this.visualTime * 3) * 4, size = 18 * g.scale;
        c.save(); c.globalAlpha = s.life < 2 ? 0.45 + Math.sin(this.visualTime * 10) * 0.35 : 1; c.shadowColor = "#adf6c1"; c.shadowBlur = 16; c.fillStyle = "#233f32"; c.fillRect(x - size, y - size, size * 2, size * 2); c.strokeStyle = "#b8e5b4"; c.strokeRect(x - size, y - size, size * 2, size * 2); c.shadowBlur = 0; c.fillStyle = "#b8e5b4"; c.fillRect(x - size * 0.6, y - 3, size * 1.2, 6); c.fillRect(x - 3, y - size * 0.6, 6, size * 1.2); c.restore();
      }
      this.effectsLayer();
      if (g.focusing) { c.fillStyle = "#2dbaa114"; c.fillRect(0, 0, this.w, this.h); c.strokeStyle = "#9fddc63a"; c.lineWidth = 3; c.strokeRect(10, 10, this.w - 20, this.h - 20); }
      c.save(); if (this.effects && this.shake) c.translate(Math.sin(this.visualTime * 77) * this.shake * 0.4, Math.cos(this.visualTime * 93) * this.shake * 0.3); this.weapon(); c.restore();
      for (const p of this.labels) { c.save(); c.globalAlpha = Math.min(1, p.life * 3); c.fillStyle = p.color; c.shadowColor = "#081516"; c.shadowBlur = 7; c.textAlign = "center"; c.font = "600 20px Bahnschrift,Arial,sans-serif"; c.fillText(p.text, p.x, p.y); if (p.detail) { c.font = "9px ui-monospace,monospace"; c.fillText(p.detail, p.x, p.y + 17); } c.restore(); }
      this.crosshair();
    }
  }
  globalThis.GameRenderer = GameRenderer;
})();
