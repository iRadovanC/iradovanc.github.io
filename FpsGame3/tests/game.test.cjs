const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

// Exercise real gameplay and rendering code with a deterministic clock and DOM.
// No test hooks, libraries or debug controls are included in the shipped game.
function fixture({ width = 1440, height = 900, blockedStorage = false, score = null, audio = false } = {}) {
  let seed = 4107;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const contexts = [];
  function drawingContext() {
    const target = { depth: 0, save() { this.depth++; }, restore() { assert.ok(this.depth > 0); this.depth--; }, createPattern() { return '#texture'; }, createLinearGradient() { return { addColorStop() {} }; }, createRadialGradient() { return { addColorStop() {} }; } };
    const result = new Proxy(target, { get(obj, key) { return key in obj ? obj[key] : (...args) => { for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `Non-finite canvas argument: ${String(key)}`); }; } });
    contexts.push(result); return result;
  }
  class Element {
    constructor() { this.children = []; this.style = {}; this.attributes = {}; this.events = {}; this.textContent = ''; this.hidden = false; this.disabled = false; this.classes = new Set(); this.classList = { add: (...names) => names.forEach(n => this.classes.add(n)), remove: (...names) => names.forEach(n => this.classes.delete(n)), toggle: (name, enabled) => { if (enabled ?? !this.classes.has(name)) this.classes.add(name); else this.classes.delete(name); } }; }
    getContext() { return this.ctx ??= drawingContext(); }
    append(child) { this.children.push(child); }
    addEventListener(name, fn) { this.events[name] = fn; }
    setAttribute(name, value) { this.attributes[name] = value; }
    querySelector() { return this.child ??= new Element(); }
    getBoundingClientRect() { return { left: 0, top: 0, width, height }; }
    focus() {} blur() {} setPointerCapture() {} closest() { return null; }
  }
  const elements = new Map(), element = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  for (const match of fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/id="([^"]+)"/g)) element(match[1]);
  element('armor').children = [new Element(), new Element(), new Element()];
  const storage = new Map(score === null ? [] : [['nulovy-bod-high-score', String(score)]]), windowEvents = {}, documentEvents = {};
  const audioCalls = [];
  class AudioContext {
    constructor() { this.currentTime = 1; this.sampleRate = 8000; this.destination = {}; this.state = 'running'; }
    node() { const param = { value: 0, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }; return { gain: { ...param }, frequency: { ...param }, threshold: { ...param }, ratio: { ...param }, pan: { ...param }, connect(n) { return n; }, disconnect() {}, start(...args) { audioCalls.push(['start', ...args]); }, stop(...args) { audioCalls.push(['stop', ...args]); } }; }
    createGain() { return this.node(); } createDynamicsCompressor() { return this.node(); } createBufferSource() { return this.node(); } createBiquadFilter() { return this.node(); } createOscillator() { return this.node(); } createStereoPanner() { return this.node(); }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    resume() { return Promise.resolve(); }
  }
  const sandbox = { console, innerWidth: width, innerHeight: height, devicePixelRatio: 1, HTMLElement: Element, Math: Object.create(Math), performance: { now: () => 0 }, matchMedia: () => ({ matches: false }), requestAnimationFrame() {}, localStorage: { getItem(k) { if (blockedStorage) throw Error('blocked'); return storage.get(k) ?? null; }, setItem(k, v) { if (blockedStorage) throw Error('blocked'); storage.set(k, v); } }, document: { getElementById: element, querySelector: element, createElement: () => new Element(), addEventListener: (k, v) => documentEvents[k] = v, hidden: false }, addEventListener: (k, v) => windowEvents[k] = v };
  sandbox.Math.random = random; sandbox.window = sandbox; if (audio) sandbox.AudioContext = AudioContext;
  const context = vm.createContext(sandbox);
  for (const file of ['audio.js', 'renderer.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8').replace('resize();hud(true);requestAnimationFrame(frame);', 'resize();hud(true);window.testGame={state,renderer,sound,start,end,pause,update,shoot,reload,spawn,cook,drop,attack,hitTest,resize,toggleSound};');
  vm.runInContext(game, context, { filename: 'game.js' });
  const api = sandbox.testGame;
  return { ...api, sandbox, element, storage, windowEvents, documentEvents, audioCalls, contexts, advance(seconds) { for (let t = 0; t < seconds; t += 1 / 60) api.update(Math.min(1 / 60, seconds - t)); }, render() { api.renderer.render(api.state); for (const g of contexts) assert.equal(g.depth, 0, 'Canvas save/restore remains balanced'); } };
}
function target(f, enemy, head = true) { f.state.aim = { x: enemy.x, y: enemy.y - (head ? 133 : 69) * enemy.scale }; }

test('menu renders; starting resets the original 60-second, 8-round, 3-life concept', () => {
  const f = fixture(); f.render(); f.start(); assert.equal(f.state.timeLeft, 60); assert.equal(f.state.ammo, 8); assert.equal(f.state.armor, 3); f.advance(1); assert.equal(f.state.enemies.length, 1); f.render();
});
test('visible helmet hit scores once, sends a helmet flying and cannot score twice', () => {
  const f = fixture(); f.start(); f.advance(1.1); const enemy = f.state.enemies[0]; target(f, enemy); f.shoot(); assert.equal(f.state.score, 180); assert.equal(f.state.hits, 1); assert.equal(f.state.ammo, 7); assert.ok(f.state.particles.some(p => p.kind === 'helmet')); f.advance(.2); f.shoot(); assert.equal(f.state.score, 180); assert.equal(f.state.shots, 2); assert.equal(f.state.combo, 0); f.render();
});
test('cover cannot be shot through while an enemy is emerging', () => {
  const f = fixture(); f.start(); f.spawn(); const e = f.state.enemies[0]; assert.equal(f.hitTest(e, e.x, e.y + 20 * e.scale), null); assert.equal(f.hitTest(e, e.x, e.y - 120 * e.scale), null);
});
test('pause freezes round, reload, enemies and effects; resume continues their clocks', () => {
  const f = fixture(); f.start(); f.advance(1); f.state.aim = { x: 5, y: 5 }; f.shoot(); f.reload(); f.advance(.4); f.pause(); const snapshot = JSON.stringify(f.state); f.advance(30); assert.equal(JSON.stringify(f.state), snapshot); f.pause(); f.advance(.8); assert.equal(f.state.ammo, 8); assert.equal(f.state.reload, 0); assert.ok(f.state.time < 3);
});
test('empty magazine reloads automatically and restart cancels an unfinished reload', () => {
  const f = fixture(); f.start(); f.state.nextSpawn = 99; for (let i = 0; i < 8; i++) { f.state.aim = { x: 4, y: 4 }; f.shoot(); f.advance(.16); } assert.equal(f.state.ammo, 0); f.advance(1.5); assert.equal(f.state.ammo, 8); f.shoot(); f.reload(); f.end(); f.start(); assert.equal(f.state.reload, 0); assert.equal(f.state.shots, 0); assert.equal(f.state.ammo, 8);
});
test('gulash hits nearby enemies; one shot counts as one accurate shot', () => {
  const f = fixture(); f.start(); f.advance(1); const b = f.renderer.barrels[0], e = f.state.enemies[0]; e.x = b.x + 80; e.y = b.y; f.state.aim = { x: b.x, y: b.y - 40 * b.scale }; f.shoot(); assert.ok(e.dead); assert.equal(f.state.hits, 1); assert.equal(f.state.shots, 1); assert.ok(f.state.score >= 175); assert.equal(f.state.barrelTimers[0], 12); f.render();
});
test('friendly fire costs points but cannot create a negative score or enemy hit', () => {
  const f = fixture(); f.start(); f.cook(); f.advance(1); const e = f.state.enemies.find(e => e.kind === 'cook'); target(f, e); f.state.score = 100; f.shoot(); assert.ok(e.dead); assert.equal(f.state.score, 0); assert.equal(f.state.hits, 0); assert.equal(f.state.combo, 0);
});
test('letting the cook cross earns the escort bonus', () => {
  const f = fixture(); f.start(); f.state.nextSpawn = 100; f.cook(); f.advance(8.2); assert.equal(f.state.score, 150); assert.equal(f.state.shots, 0);
});
test('supply restores one life and ammunition without exceeding caps', () => {
  const f = fixture(); f.start(); f.drop(); f.state.ammo = 2; f.state.armor = 2; f.state.aim = { x: f.state.supply.x, y: f.state.supply.y + 5 }; f.shoot(); assert.equal(f.state.ammo, 8); assert.equal(f.state.armor, 3); assert.equal(f.state.supply, null); assert.equal(f.state.score, 150); f.render();
});
test('faulty weapons give a grace period; simultaneous attacks cannot drain every life', () => {
  const f = fixture(); f.start(); f.advance(1); const e = f.state.enemies[0]; e.willJam = true; f.attack(e); assert.equal(f.state.armor, 3); assert.ok(e.jammed); f.attack(e); assert.equal(f.state.armor, 2); const second = { ...e, dead: false, willJam: false }; f.attack(second); assert.equal(f.state.armor, 2); f.render();
});
test('all scripted events run once and an entire 60-second mission ends with a saved record', () => {
  const f = fixture(); f.start(); f.state.nextSpawn = 100; f.state.score = 2000; f.advance(60.1); assert.equal(f.state.mode, 'gameover'); assert.equal(f.state.timeLeft, 0); assert.equal(f.state.events.size, 7); assert.equal(f.storage.get('nulovy-bod-high-score'), String(f.state.score)); const record = f.state.highScore; f.start(); assert.equal(f.state.highScore, record); assert.equal(f.state.events.size, 0); assert.equal(f.state.time, 0); f.render();
});
test('three separated attacks end the mission and cannot damage the following mission', () => {
  const f = fixture(); f.start(); for (let i = 0; i < 3; i++) { f.state.time += 2; f.attack({ x: 100, y: 100, scale: 1, willJam: false }); } assert.equal(f.state.mode, 'gameover'); assert.equal(f.state.armor, 0); f.start(); assert.equal(f.state.armor, 3); assert.equal(f.state.invulnerable, 0);
});
test('portrait, landscape, resize and reduced-motion rendering remain valid', () => {
  for (const [width, height] of [[390, 844], [844, 390], [1920, 1080]]) { const f = fixture({ width, height }); f.render(); f.start(); f.advance(1); f.render(); f.state.reducedMotion = true; f.state.shake = 10; f.render(); f.sandbox.innerWidth = 390; f.sandbox.innerHeight = 844; f.resize(); assert.equal(f.renderer.slots.length, 4); f.render(); }
});
test('blocked storage, corrupted records and unavailable audio do not stop gameplay', () => {
  for (const config of [{ blockedStorage: true }, { score: 'Infinity' }, { score: 'broken' }]) { const f = fixture(config); assert.equal(f.state.highScore, 0); f.start(); f.advance(1); f.state.score = 250; f.end(); assert.equal(f.state.highScore, 250); f.toggleSound(); f.render(); }
});
test('synthesized effects schedule valid audio and muting prevents new voices', () => {
  const f = fixture({ audio: true }); f.start(); for (const name of ['shot', 'helmet', 'hit', 'miss', 'empty', 'reloadOut', 'reloadIn', 'damage', 'jam', 'soup', 'supply', 'friendly', 'radio', 'end', 'tick', 'flap']) f.sound.play(name, .2); assert.ok(f.audioCalls.length > 100); for (const call of f.audioCalls) for (const n of call.slice(1)) assert.ok(Number.isFinite(n) && n >= 0); f.sound.setMuted(true); const count = f.audioCalls.length; f.sound.play('shot'); assert.equal(f.audioCalls.length, count);
});
test('tab hiding and focus loss automatically pause and clear held fire', () => {
  const f = fixture(); f.start(); f.state.pointerFiring = true; f.windowEvents.blur(); assert.equal(f.state.mode, 'paused'); assert.equal(f.state.pointerFiring, false); f.pause(); f.sandbox.document.hidden = true; f.documentEvents.visibilitychange(); assert.equal(f.state.mode, 'paused');
});
