/* Deterministic game rules. No DOM, timers or dependencies. */
(() => {
  "use strict";
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const TYPES = {
    soldier: { name: "ÚTOČNÍK", hp: 90, damage: 12, interval: 4.5, speed: 0.018, points: 100, color: "#efbd72" },
    scout: { name: "PRŮZKUMNÍK", hp: 65, damage: 10, interval: 3.7, speed: 0.052, points: 140, color: "#98d7cf" },
    heavy: { name: "OBRNĚNEC", hp: 220, damage: 23, interval: 5.2, speed: 0.008, points: 250, color: "#f58561" },
    drone: { name: "DRON", hp: 60, damage: 9, interval: 3.6, speed: 0.04, points: 160, color: "#d6b1ea" },
  };
  const WAVES = ["PRVNÍ KONTAKT", "RYCHLÝ POSTUP", "TĚŽKÁ TECHNIKA", "KŘÍŽOVÁ PALBA", "POSLEDNÍ NÁPOR"];
  class GameCore {
    constructor(random = Math.random) {
      this.random = random;
      this.width = 1280;
      this.height = 720;
      this.mode = "menu";
      this.events = [];
      this.enemies = [];
      this.projectiles = [];
      this.supplies = [];
      this.aim = { x: 640, y: 340 };
      this.time = 0;
      this.elapsed = 0;
      this.health = 100;
      this.ammo = 24;
      this.focus = 100;
      this.focusing = false;
      this.reloading = null;
      this.score = 0;
      this.streak = 0;
      this.comboTime = 0;
      this.wave = 1;
      this.grenades = 2;
      this.stats = { shots: 0, hits: 0, kills: 0, heads: 0, bestStreak: 0, perfectReloads: 0 };
    }
    emit(type, data = {}) { this.events.push({ type, ...data }); }
    drainEvents() { return this.events.splice(0); }
    resize(w, h) {
      this.aim.x *= w / this.width;
      this.aim.y *= h / this.height;
      this.width = w;
      this.height = h;
    }
    get remaining() { return Math.max(0, 90 - this.elapsed); }
    get multiplier() { return Math.min(4, 1 + Math.floor(this.streak / 4)); }
    get accuracy() { return this.stats.shots ? Math.round(this.stats.hits / this.stats.shots * 100) : 0; }
    get scale() { return clamp(Math.min(this.width / 1280, this.height / 720), 0.68, 1.5); }
    start() {
      this.mode = "playing";
      this.time = this.elapsed = this.score = this.streak = this.comboTime = 0;
      this.health = this.focus = 100;
      this.ammo = 24;
      this.wave = 1;
      this.grenades = 2;
      this.focusing = this.trigger = false;
      this.reloading = null;
      this.boost = 0;
      this.cooldown = this.grenadeCooldown = 0;
      this.spawnTimer = 1.6;
      this.enemies = [];
      this.projectiles = [];
      this.supplies = [];
      this.events = [];
      this.aim = { x: this.width * 0.5, y: this.height * 0.5 };
      this.stats = { shots: 0, hits: 0, kills: 0, heads: 0, bestStreak: 0, perfectReloads: 0 };
      this.emit("start");
      this.emit("wave", { wave: 1, name: WAVES[0] });
    }
    pause() {
      if (this.mode !== "playing") return;
      this.mode = "paused";
      this.trigger = this.focusing = false;
      this.emit("pause");
    }
    resume() { if (this.mode === "paused") { this.mode = "playing"; this.emit("resume"); } }
    end(won) {
      if (this.mode !== "playing") return;
      this.mode = "gameover";
      this.trigger = this.focusing = false;
      this.reloading = null;
      const bonus = won ? Math.round(this.health * 10 + this.accuracy * 5) : 0;
      this.score += bonus;
      this.emit("end", { won, bonus });
    }
    toggleFocus() {
      if (this.mode !== "playing") return;
      if (!this.focusing && this.focus < 15) { this.emit("notice", { title: "SOUSTŘEDĚNÍ SE OBNOVUJE" }); return; }
      this.focusing = !this.focusing;
      this.emit("focus", { active: this.focusing });
    }
    reload() {
      if (this.mode !== "playing") return;
      if (this.reloading) {
        if (this.reloading.attempted) return;
        const ratio = this.reloading.elapsed / 1.65;
        if (ratio >= 0.58 && ratio <= 0.77) {
          this.ammo = 24;
          this.reloading = null;
          this.boost = 6;
          this.stats.perfectReloads++;
          this.score += 25;
          this.emit("perfect");
        } else {
          this.reloading.attempted = true;
          this.reloading.duration = 1.95;
          this.emit("reloadMiss");
        }
        return;
      }
      if (this.ammo === 24) return;
      this.reloading = { elapsed: 0, duration: 1.65, attempted: false, clicked: false };
      this.emit("reload");
    }
    geometry(enemy) {
      const s = this.scale * (enemy.kind === "heavy" ? 1.24 : 1) * (0.8 + (enemy.v - 0.45) * 1.45);
      return { x: enemy.u * this.width, y: enemy.v * this.height + Math.sin(enemy.phase * 2) * (enemy.kind === "drone" ? 9 : 2) * s, s };
    }
    hitTest(enemy, x, y) {
      if (enemy.dead || enemy.age < 0.28) return null;
      const g = this.geometry(enemy);
      const dx = (x - g.x) / g.s;
      const dy = (y - g.y) / g.s;
      if (enemy.kind === "drone") {
        if (Math.hypot(dx, dy) <= 10) return "head";
        return Math.abs(dx) <= 45 && Math.abs(dy) <= 17 ? "body" : null;
      }
      if ((dx / 13) ** 2 + ((dy + 64) / 14) ** 2 <= 1) return "head";
      if (Math.abs(dx) < 28 && dy >= -48 && dy <= 17) return "body";
      if (dy > 17 && dy < 59 && Math.abs(dx) < 25) return "leg";
      return null;
    }
    shoot() {
      if (this.mode !== "playing" || this.reloading || this.cooldown > 0) return false;
      if (!this.ammo) { this.reload(); return false; }
      this.cooldown = 0.135;
      this.ammo--;
      this.stats.shots++;
      const boosted = this.boost > 0;
      if (boosted) this.boost--;
      const { x, y } = this.aim;
      this.emit("shot", { x, y, boosted });
      const supply = this.supplies.find(s => Math.hypot(x - s.u * this.width, y - s.v * this.height) < 25 * this.scale);
      if (supply) {
        this.supplies = this.supplies.filter(s => s !== supply);
        this.stats.hits++;
        this.health = Math.min(100, this.health + 25);
        this.score += 50;
        this.emit("supply", { x, y });
      } else {
        const candidates = this.enemies.map(enemy => ({ enemy, part: this.hitTest(enemy, x, y) })).filter(hit => hit.part).sort((a, b) => b.enemy.v - a.enemy.v);
        if (candidates.length) {
          const { enemy, part } = candidates[0];
          this.stats.hits++;
          const head = part === "head";
          if (head) this.stats.heads++;
          let damage = head ? 130 : part === "leg" ? 35 : 55;
          if (enemy.kind === "heavy" && !head) damage *= 0.7;
          if (boosted) damage *= 1.5;
          enemy.hp -= damage;
          enemy.flash = 0.12;
          this.emit("hit", { x, y, head, armor: enemy.kind === "heavy" && !head });
          if (enemy.hp <= 0) this.kill(enemy, head);
        } else {
          this.streak = this.comboTime = 0;
          this.emit("miss", { x, y });
        }
      }
      if (!this.ammo) this.reload();
      return true;
    }
    kill(enemy, head = false, blast = false) {
      if (enemy.dead) return;
      enemy.dead = true;
      enemy.deathTime = 0;
      this.stats.kills++;
      this.streak++;
      this.comboTime = 4.5;
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.streak);
      const points = (TYPES[enemy.kind].points + (head ? 90 : 0)) * this.multiplier;
      this.score += points;
      const g = this.geometry(enemy);
      this.emit("kill", { x: g.x, y: g.y, points, head, kind: enemy.kind, blast, multiplier: this.multiplier });
      if (this.stats.kills % 8 === 0 && this.supplies.length < 2) {
        this.supplies.push({ u: clamp(enemy.u, 0.15, 0.85), v: clamp(enemy.v + 0.025, 0.48, 0.65), life: 8 });
        this.emit("supplySpawn");
      }
    }
    grenade() {
      if (this.mode !== "playing" || !this.grenades || this.grenadeCooldown > 0) return false;
      this.grenades--;
      this.grenadeCooldown = 1;
      const u = this.aim.x / this.width, v = this.aim.y / this.height;
      this.projectiles.push({ kind: "grenade", u, v, life: 0.65, total: 0.65 });
      this.emit("throw", { x: this.aim.x, y: this.aim.y });
      return true;
    }
    explode(projectile) {
      const x = projectile.u * this.width, y = projectile.v * this.height;
      const radius = 185 * this.scale;
      this.emit("explosion", { x, y, radius });
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        const g = this.geometry(enemy);
        const distance = Math.hypot(x - g.x, y - (g.y - (enemy.kind === "drone" ? 0 : 22 * g.s)));
        if (distance < radius) {
          enemy.hp -= 330 * (1 - distance / radius * 0.62);
          enemy.flash = 0.2;
          if (enemy.hp <= 0) this.kill(enemy, false, true);
        }
      }
    }
    spawn(kind) {
      if (!kind) {
        const roll = this.random();
        kind = this.wave >= 3 && roll < 0.22 ? "heavy" : this.wave >= 2 && roll < 0.43 ? "drone" : roll < 0.65 ? "scout" : "soldier";
        if (this.wave === 1 && this.elapsed < 9) kind = "soldier";
      }
      const config = TYPES[kind];
      let u = 0.5, v = 0.58;
      for (let attempt = 0; attempt < 20; attempt++) {
        u = 0.14 + this.random() * 0.72;
        v = kind === "drone" ? 0.37 + this.random() * 0.13 : 0.51 + this.random() * 0.15;
        if (!this.enemies.some(e => !e.dead && Math.abs(e.u - u) < (this.width < 650 ? 0.23 : 0.11) && Math.abs(e.v - v) < 0.15)) break;
      }
      const interval = config.interval * (1 - (this.wave - 1) * 0.075);
      const enemy = { kind, u, v, baseU: u, hp: config.hp, maxHp: config.hp, phase: this.random() * 6.28, age: 0, interval, attack: interval, flash: 0, dead: false, deathTime: 0, warned: false };
      this.enemies.push(enemy);
      return enemy;
    }
    update(dt) {
      if (this.mode !== "playing") return;
      dt = clamp(dt, 0, 0.1);
      this.elapsed = Math.min(90, this.elapsed + dt);
      this.time += dt;
      if (this.remaining <= 0) { this.end(true); return; }
      const wave = Math.min(5, Math.floor(this.elapsed / 18) + 1);
      if (wave !== this.wave) {
        this.wave = wave;
        this.health = Math.min(100, this.health + 12);
        if (wave === 3) this.grenades++;
        this.spawnTimer = 1.6;
        for (const e of this.enemies) e.attack = Math.max(e.attack, 2.2);
        this.emit("wave", { wave, name: WAVES[wave - 1] });
      }
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt);
      if (this.focusing) {
        this.focus = Math.max(0, this.focus - dt * 27);
        if (!this.focus) { this.focusing = false; this.emit("focus", { active: false }); }
      } else this.focus = Math.min(100, this.focus + dt * 11);
      const worldDt = dt * (this.focusing ? 0.38 : 1);
      this.comboTime = Math.max(0, this.comboTime - worldDt);
      if (!this.comboTime) this.streak = 0;
      if (this.reloading) {
        this.reloading.elapsed += dt;
        if (!this.reloading.clicked && this.reloading.elapsed > 0.5) { this.reloading.clicked = true; this.emit("reloadClick"); }
        if (this.reloading.elapsed >= this.reloading.duration) { this.ammo = 24; this.reloading = null; this.emit("loaded"); }
      }
      if (this.trigger) this.shoot();
      this.spawnTimer -= worldDt;
      const capacity = this.width < 650 ? 4 : 6;
      if (this.spawnTimer <= 0 && this.enemies.filter(e => !e.dead).length < capacity) {
        this.spawn();
        this.spawnTimer = (1.95 - (this.wave - 1) * 0.24) * (0.8 + this.random() * 0.35);
      }
      for (const enemy of this.enemies) {
        enemy.flash = Math.max(0, enemy.flash - dt);
        if (enemy.dead) { enemy.deathTime += worldDt; continue; }
        enemy.age += worldDt;
        enemy.phase += worldDt * (enemy.kind === "scout" ? 2.3 : 1.3);
        enemy.u = clamp(enemy.baseU + Math.sin(enemy.phase) * TYPES[enemy.kind].speed, 0.09, 0.91);
        enemy.attack -= worldDt;
        if (enemy.attack < 0.9 && !enemy.warned) {
          enemy.warned = true;
          this.emit("warning", { x: this.geometry(enemy).x });
        }
        if (enemy.attack <= 0) {
          enemy.attack = enemy.interval;
          enemy.warned = false;
          this.projectiles.push({ kind: "incoming", u: enemy.u, v: enemy.v, life: 0.3, total: 0.3, damage: TYPES[enemy.kind].damage });
          this.emit("enemyShot", { x: this.geometry(enemy).x });
        }
      }
      for (const projectile of this.projectiles) {
        projectile.life -= worldDt;
        if (projectile.life > 0) continue;
        if (projectile.kind === "grenade") this.explode(projectile);
        else {
          this.health = Math.max(0, this.health - projectile.damage);
          this.streak = this.comboTime = 0;
          this.emit("damage", { damage: projectile.damage, u: projectile.u });
          if (this.health <= 0) { this.end(false); break; }
        }
      }
      this.projectiles = this.projectiles.filter(p => p.life > 0);
      this.enemies = this.enemies.filter(e => !e.dead || e.deathTime < 0.65);
      this.supplies.forEach(s => { s.life -= worldDt; });
      this.supplies = this.supplies.filter(s => s.life > 0);
    }
  }
  const api = { GameCore, TYPES, WAVES, clamp };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.NulovyBod = api;
})();
