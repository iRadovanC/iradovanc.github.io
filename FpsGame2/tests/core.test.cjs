const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GameCore } = require('../game-core.js');
function rng(seed = 57) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function fresh() { const g = new GameCore(rng()); g.start(); g.spawnTimer = 1000; g.drainEvents(); return g; }
function advance(g, seconds) { for (let i = 0; i < Math.ceil(seconds * 100); i++) g.update(0.01); }
function target(g, kind = 'soldier') { const e = g.spawn(kind); e.age = 1; e.u = e.baseU = 0.5; e.v = 0.55; return e; }
function aim(g, e, head = true) { const p = g.geometry(e); g.aim = { x: p.x, y: p.y - (head && e.kind !== 'drone' ? 64 * p.s : 0) }; }

test('headshots use the rendered head location and award a kill only once', () => {
  const g = fresh(), e = target(g); aim(g, e); assert.equal(g.shoot(), true);
  assert.equal(e.dead, true); assert.equal(g.stats.kills, 1); assert.equal(g.stats.heads, 1); assert.equal(g.score, 190);
  g.cooldown = 0; g.shoot(); assert.equal(g.stats.kills, 1); assert.equal(g.stats.hits, 1);
});
test('automatic weapon enforces its rate and ammunition limit', () => {
  const g = fresh(); g.trigger = true; advance(g, 0.95);
  assert.equal(g.stats.shots, 7); assert.equal(g.ammo, 17);
  assert.equal(g.shoot(), false);
  advance(g, 2.5); assert.equal(g.ammo, 0); assert.ok(g.reloading); assert.equal(g.stats.shots, 24);
});
test('perfect reload finishes early, grants six boosted rounds and cannot stack', () => {
  const g = fresh(); g.ammo = 4; g.reload(); advance(g, 1); g.reload();
  assert.equal(g.ammo, 24); assert.equal(g.reloading, null); assert.equal(g.boost, 6); assert.equal(g.score, 25);
  g.reload(); assert.equal(g.score, 25);
  const e = target(g, 'heavy'); aim(g, e); g.shoot(); assert.equal(g.boost, 5); assert.equal(e.hp, 25);
});
test('early reload timing adds a finite delay; spam does not extend it', () => {
  const g = fresh(); g.ammo = 3; g.reload(); advance(g, 0.2); g.reload();
  assert.equal(g.reloading.duration, 1.95); for (let i = 0; i < 20; i++) g.reload();
  advance(g, 1.6); assert.equal(g.ammo, 3); advance(g, 0.16); assert.equal(g.ammo, 24); assert.equal(g.boost, 0);
});
test('pause freezes the mission, reload, attacks, projectiles and focus', () => {
  const g = fresh(), e = target(g); g.ammo = 4; g.reload(); g.grenade(); g.toggleFocus(); advance(g, 0.2); g.pause();
  const snapshot = JSON.stringify({ t: g.elapsed, r: g.reloading, e, p: g.projectiles, f: g.focus });
  advance(g, 8); assert.equal(JSON.stringify({ t: g.elapsed, r: g.reloading, e, p: g.projectiles, f: g.focus }), snapshot);
  g.resume(); advance(g, 0.1); assert.ok(g.elapsed > 0.2);
});
test('focus slows enemy time but not mission time, then exhausts and recharges', () => {
  const g = fresh(), e = target(g); g.toggleFocus(); const before = e.attack; advance(g, 1);
  assert.ok(Math.abs((before - e.attack) - 0.38) < 0.001); assert.ok(Math.abs(g.elapsed - 1) < 0.001);
  advance(g, 2.75); assert.equal(g.focusing, false); const f = g.focus; advance(g, 0.2); assert.ok(g.focus > f);
});
test('grenade detonates at its launch aim and respects blast radius', () => {
  const g = fresh(), near = target(g, 'heavy'), far = target(g);
  far.u = far.baseU = 0.95; aim(g, near, false); assert.equal(g.grenade(), true); g.aim = { x: 0, y: 0 };
  advance(g, 0.7); assert.equal(near.dead, true); assert.equal(far.dead, false); assert.equal(g.grenades, 1); assert.equal(g.stats.shots, 0);
});
test('lethal simultaneous attacks end once and cannot score after defeat', () => {
  const g = fresh(); g.health = 10;
  for (let i = 0; i < 3; i++) g.projectiles.push({ kind: 'incoming', life: 0.001, damage: 20, u: 0.5 });
  g.update(0.01); assert.equal(g.mode, 'gameover'); assert.equal(g.health, 0);
  assert.equal(g.drainEvents().filter(e => e.type === 'end').length, 1);
  assert.equal(g.shoot(), false); assert.equal(g.grenade(), false); advance(g, 1); assert.equal(g.health, 0);
});
test('supplies restore bounded health and count as a hit, not a kill', () => {
  const g = fresh(); g.health = 90; g.supplies.push({ u: 0.5, v: 0.5, life: 8 }); g.aim = { x: g.width / 2, y: g.height / 2 }; g.shoot();
  assert.equal(g.health, 100); assert.equal(g.supplies.length, 0); assert.equal(g.stats.hits, 1); assert.equal(g.stats.kills, 0);
});
test('direct pointer coordinates remain valid at screen edges and after resize', () => {
  const g = fresh(); g.aim = { x: 1, y: 1 }; g.update(0.01); assert.deepEqual(g.aim, { x: 1, y: 1 });
  g.aim = { x: 640, y: 360 }; g.resize(390, 844); assert.deepEqual(g.aim, { x: 195, y: 422 });
});
test('five-wave mission can be completed with normal weapon rules on desktop and portrait', () => {
  for (const [w, h] of [[1280, 720], [390, 844]]) {
    const g = new GameCore(rng(42)); g.resize(w, h); g.start(); const waves = new Set(); let ended = null;
    for (let i = 0; i < 9010 && g.mode === 'playing'; i++) {
      const e = g.enemies.filter(e => !e.dead && e.age > 0.35).sort((a, b) => a.attack - b.attack)[0];
      if (e) { aim(g, e); g.shoot(); }
      if (g.reloading && !g.reloading.attempted && g.reloading.elapsed / 1.65 > 0.61) g.reload();
      g.update(0.01); for (const event of g.drainEvents()) { if (event.type === 'wave') waves.add(event.wave); if (event.type === 'end') ended = event; }
    }
    assert.equal(g.mode, 'gameover'); assert.equal(ended?.won, true); assert.equal(waves.size, 5); assert.ok(g.stats.kills > 40); assert.ok(g.score > 10000); assert.ok(g.accuracy > 95);
  }
});
test('restarting clears previous projectiles, reload, effects and elapsed time', () => {
  const g = fresh(); g.ammo = 3; g.reload(); g.grenade(); g.pause(); g.start();
  assert.equal(g.elapsed, 0); assert.equal(g.projectiles.length, 0); assert.equal(g.reloading, null); assert.equal(g.ammo, 24); assert.equal(g.focus, 100); assert.equal(g.grenades, 2); assert.equal(g.score, 0); assert.equal(g.trigger, false);
});
