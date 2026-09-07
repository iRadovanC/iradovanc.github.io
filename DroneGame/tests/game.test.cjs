/* Run with: node --test tests/game.test.cjs. Uses only Node's built-in modules. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function game({ blockedStorage = false, stored = {}, width = 900 } = {}) {
  let now = 0;
  const noop = () => {};
  const gradient = { addColorStop: noop };
  const context2d = new Proxy({}, { get: (_, key) => key === 'createLinearGradient' ? () => gradient : noop, set: () => true });
  const elements = new Map();
  class Element {
    constructor(id) {
      this.id = id; this.handlers = {}; this.style = {}; this.attributes = {}; this.textContent = '';
      this.hidden = false; this.className = ''; this.disabled = false;
      const classes = new Set();
      this.classList = { toggle: (name, on) => on ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) };
      this.parentElement = { classList: this.classList };
    }
    addEventListener(type, callback) { (this.handlers[type] ??= []).push(callback); }
    fire(type, data = {}) { for (const callback of this.handlers[type] || []) callback(data); }
    getContext() { return context2d; }
    getBoundingClientRect() { return { left: 0, top: 0, width, height: 576, bottom: 576 }; }
    setAttribute(key, value) { this.attributes[key] = value; }
    querySelector() { return { setAttribute: (key, value) => this.attributes['child-' + key] = value }; }
    focus() {} scrollIntoView() {} setPointerCapture() {}
    click() { this.fire('click'); }
  }
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) elements.set(id, new Element(id));
  const document = new Element('document');
  document.getElementById = id => { assert.ok(elements.has(id), `Missing element: ${id}`); return elements.get(id); };
  const window = new Element('window');
  window.matchMedia = () => ({ matches: false });
  window.innerHeight = 900; window.devicePixelRatio = 1;
  const storage = new Map(Object.entries(stored));
  const sandbox = {
    window, document, console, Math, ResizeObserver: class { observe() {} },
    performance: { now: () => now }, requestAnimationFrame: noop,
    localStorage: {
      getItem(key) { if (blockedStorage) throw Error('Denied'); return storage.get(key) ?? null; },
      setItem(key, value) { if (blockedStorage) throw Error('Denied'); storage.set(key, value); },
    },
  };
  // Expose the closure only in the test VM; production has no debug globals.
  vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, 'this.testAPI = { state, keys, pointer, startGame, pauseGame, resumeGame, finishGame, update, frame, spawnTarget, updateTarget, sweptHit, movePointer, accuracy, updateHUD }; })();'), sandbox);
  const api = sandbox.testAPI;
  return {
    ...api, elements, window, document, storage,
    frameAt(seconds) { now = seconds * 1000; api.frame(now); },
    step(seconds) { for (let t = 0; t < seconds; t += 1 / 120) api.update(Math.min(1 / 120, seconds - t)); },
    keyDown(key) { document.fire('keydown', { key, target: { tagName: 'CANVAS' }, preventDefault: noop }); },
    keyUp(key) { document.fire('keyup', { key }); },
  };
}

test('a new game starts at 60 seconds with an active target and resets previous results', () => {
  const g = game(); g.startGame();
  assert.equal(g.state.mode, 'playing'); assert.equal(g.elements.get('timer').textContent, '01:00');
  assert.ok(g.state.target.z > g.state.drone.z); assert.equal(g.elements.get('overlay').hidden, true);
  g.state.hits = 7; g.state.misses = 3; g.state.sortie = 11; g.state.streak = 2;
  g.startGame();
  assert.equal(g.state.hits, 0); assert.equal(g.state.misses, 0); assert.equal(g.state.sortie, 1); assert.equal(g.state.streak, 0);
});

test('swept collision detects a target crossed between frames but rejects a near miss', () => {
  const g = game();
  assert.equal(g.sweptHit(0, -200, 0, 200, 48), true);
  assert.equal(g.sweptHit(49, -200, 49, 200, 48), false);
  assert.equal(g.sweptHit(0, 0, 0, 0, 48), true);
  assert.equal(g.sweptHit(70, 0, 70, 0, 48), false);
});

test('contact scores exactly once, consumes the drone and automatically spawns the next', () => {
  const g = game(); g.startGame();
  Object.assign(g.state.target, { x: 0, center: 0, baseAmplitude: 0, z: 50, speed: 0 });
  g.step(.1);
  assert.equal(g.state.hits, 1); assert.equal(g.state.misses, 0); assert.equal(g.state.target, null);
  assert.ok(g.state.transition > 0); assert.equal(g.accuracy(), 100);
  g.step(.7);
  assert.equal(g.state.hits, 1); assert.equal(g.state.sortie, 2); assert.ok(g.state.target);
});

test('passing a target records one miss and breaks the streak', () => {
  const g = game(); g.startGame(); g.state.streak = 4;
  Object.assign(g.state.target, { x: 300, center: 300, baseAmplitude: 0, z: -50, speed: 0 });
  g.step(.15);
  assert.equal(g.state.hits, 0); assert.equal(g.state.misses, 1); assert.equal(g.state.streak, 0);
  g.step(.7); assert.equal(g.state.sortie, 2); assert.equal(g.state.misses, 1);
});

test('random targets stay reachable at every difficulty, including those spawned early', () => {
  const g = game(); g.startGame();
  for (let i = 0; i < 2000; i++) {
    g.state.elapsed = i % 60;
    g.spawnTarget(); const t = g.state.target;
    assert.ok(t.center - t.maxAmplitude >= -450); assert.ok(t.center + t.maxAmplitude <= 450);
    assert.ok(t.z - g.state.drone.z >= 540); assert.ok(t.z - g.state.drone.z <= 670);
    for (const elapsed of [0, 15, 30, 45, 59]) {
      g.state.elapsed = elapsed; g.updateTarget(t, .3);
      assert.ok(Math.abs(t.x) <= 450);
    }
  }
});

test('target movement grows throughout the round even with zero hits', () => {
  const g = game(); g.startGame();
  const original = { ...g.state.target, phase: 0, baseAmplitude: 100, baseFrequency: .8, weavePhase: 1, center: 0 };
  let previousTravel = 0, previousRange = 0;
  for (const elapsed of [0, 15, 30, 45, 55]) {
    g.state.elapsed = elapsed;
    const t = { ...original };
    g.updateTarget(t, 0);
    let travel = 0, minX = t.x, maxX = t.x;
    for (let i = 0; i < 1440; i++) {
      const oldX = t.x; g.updateTarget(t, 1 / 120);
      travel += Math.abs(t.x - oldX); minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x);
    }
    assert.ok(travel > previousTravel, `More movement at ${elapsed} seconds`);
    assert.ok(maxX - minX > previousRange, `Wider movement at ${elapsed} seconds`);
    previousTravel = travel; previousRange = maxX - minX;
  }
  assert.equal(g.state.hits, 0);
  const zeroHits = { ...original }; g.updateTarget(zeroHits, .1);
  g.state.hits = 30;
  const manyHits = { ...original }; g.updateTarget(manyHits, .1);
  assert.equal(manyHits.x, zeroHits.x, 'Time, not score, controls the difficulty');
});

test('a target changes difficulty continuously without jumping at level boundaries', () => {
  const g = game(); g.startGame();
  const t = g.state.target;
  for (let i = 1; i <= 7200; i++) {
    const oldX = t.x;
    g.state.elapsed = i / 120; g.updateTarget(t, 1 / 120);
    assert.ok(Math.abs(t.x - oldX) < 6, 'No sudden teleport during progression');
    assert.ok(Math.abs(t.x) <= 450);
  }
});

test('the prominent clock stays synchronized, warns for the last ten seconds and resets', () => {
  const g = game(); g.startGame(); g.state.target = null;
  const clock = g.elements.get('round-clock');
  assert.equal(g.elements.get('round-timer').textContent, '01:00');
  g.frameAt(30);
  assert.equal(g.elements.get('round-timer').textContent, g.elements.get('timer').textContent);
  assert.equal(g.elements.get('round-progress').style.width, '50%');
  assert.equal(clock.classList.contains('urgent'), false);
  g.frameAt(50);
  assert.equal(g.elements.get('round-timer').textContent, '00:10');
  assert.equal(clock.classList.contains('urgent'), true); assert.equal(clock.classList.contains('ticking'), true);
  g.pauseGame(); assert.equal(clock.classList.contains('ticking'), false);
  g.startGame(); assert.equal(g.elements.get('round-timer').textContent, '01:00');
  assert.equal(g.elements.get('round-progress').style.width, '100%'); assert.equal(clock.classList.contains('urgent'), false);
  assert.match(g.elements.get('arena-status').textContent, /ÚROVEŇ 1\/4/);
});

test('keyboard steering, acceleration, braking and world boundaries work', () => {
  const g = game(); g.startGame(); g.state.target = null;
  g.keyDown('ArrowRight'); g.keyDown('ArrowUp'); g.step(2);
  assert.equal(g.state.drone.x, 450); assert.ok(g.state.drone.speed > 295); assert.ok(g.state.drone.z > 0);
  g.keyUp('ArrowRight'); g.keyUp('ArrowUp'); g.keyDown('ArrowLeft'); g.keyDown('ArrowDown'); g.step(3);
  assert.equal(g.state.drone.x, -450); assert.ok(g.state.drone.speed < 150);
  g.keyUp('ArrowLeft'); g.keyUp('ArrowDown'); g.step(1);
  assert.ok(g.state.drone.speed > 210 && g.state.drone.speed < 216);
});

test('mouse and touch steer; releasing the active touch stops steering; other fingers do not cancel it', () => {
  const g = game({ width: 390 }); g.startGame(); g.state.target = null;
  const canvas = g.elements.get('game');
  g.movePointer({ pointerType: 'mouse', clientX: 290, clientY: 80 }); g.step(.5);
  assert.ok(g.state.drone.x > 0); assert.ok(g.state.drone.speed > 250);
  canvas.fire('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 90, clientY: 490 });
  canvas.fire('pointerdown', { pointerType: 'touch', pointerId: 2, clientX: 350, clientY: 30 });
  canvas.fire('pointercancel', { pointerType: 'touch', pointerId: 2 });
  assert.equal(g.pointer.id, 1); assert.equal(g.pointer.active, true);
  g.step(.7); assert.ok(g.state.drone.x < 0); assert.ok(g.state.drone.speed < 180);
  canvas.fire('pointerup', { pointerType: 'touch', pointerId: 1 });
  assert.equal(g.pointer.active, false); assert.equal(g.pointer.id, null);
});

test('pausing freezes the timer and clears input; resuming excludes time spent paused', () => {
  const g = game(); g.startGame(); g.frameAt(5); g.keyDown('ArrowRight'); g.pauseGame();
  const position = g.state.drone.z;
  g.frameAt(45);
  assert.equal(g.state.elapsed, 5); assert.equal(g.state.drone.z, position); assert.equal(g.keys.size, 0);
  assert.equal(g.elements.get('pause-screen').hidden, false);
  g.resumeGame(); g.frameAt(46);
  assert.equal(g.state.elapsed, 6); assert.equal(g.state.mode, 'playing');
});

test('window blur and hiding the document automatically pause a flight', () => {
  const g = game(); g.startGame(); g.window.fire('blur'); assert.equal(g.state.mode, 'paused');
  g.resumeGame(); g.document.hidden = true; g.document.fire('visibilitychange'); assert.equal(g.state.mode, 'paused');
});

test('the 60-second deadline is exact even on a slow frame and does not count an unfinished target', () => {
  const g = game(); g.startGame(); g.state.target = null;
  g.state.hits = 8; g.state.misses = 2; g.state.bestStreak = 3;
  g.frameAt(59.9); assert.equal(g.state.mode, 'playing');
  g.frameAt(62); assert.equal(g.state.elapsed, 60); assert.equal(g.state.mode, 'finished');
  assert.equal(g.elements.get('timer').textContent, '00:00'); assert.equal(g.elements.get('result-score').textContent, 8);
  assert.equal(g.elements.get('result-accuracy').textContent, '80 %'); assert.equal(g.state.misses, 2);
  assert.equal(g.storage.get('signal-best-v1'), '8');
});

test('blocked or corrupt storage never prevents playing or finishing', () => {
  const blocked = game({ blockedStorage: true }); blocked.startGame(); blocked.state.hits = 1; blocked.finishGame();
  assert.equal(blocked.state.best, 1); assert.match(blocked.elements.get('result-copy').textContent, /nepodařilo uložit/);
  for (const value of ['oops', '-7', '"9"', 'null', '1e999']) {
    const g = game({ stored: { 'signal-best-v1': value } }); assert.equal(g.state.best, 0);
  }
  const valid = game({ stored: { 'signal-best-v1': '12' } }); assert.equal(valid.state.best, 12);
});

test('stationary simulation gives the same movement at desktop and phone widths', () => {
  const desktop = game({ width: 1100 }); const phone = game({ width: 390 });
  for (const g of [desktop, phone]) { g.startGame(); g.state.target = null; g.keyDown('ArrowLeft'); g.keyDown('ArrowUp'); g.step(1); }
  assert.deepEqual(JSON.parse(JSON.stringify(desktop.state.drone)), JSON.parse(JSON.stringify(phone.state.drone)));
});
