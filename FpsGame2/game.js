(() => {
  "use strict";
  const { GameCore, WAVES, clamp } = NulovyBod;
  const $ = id => document.getElementById(id);
  const ids = ["shell", "game", "menu", "pauseScreen", "resultsScreen", "settingsScreen", "startButton", "resumeButton", "score", "highScore", "menuRecord", "wave", "waveName", "time", "timeBar", "streak", "multiplier", "comboBar", "health", "healthBar", "focusValue", "focusBar", "focusButton", "grenades", "grenadeButton", "ammo", "reloadButton", "weaponStatus", "reloadIndicator", "reloadLabel", "reloadProgress", "reloadHelp", "banner", "bannerLabel", "bannerTitle", "combatHint", "damage", "announcement", "soundButton", "volume", "volumeValue", "ambience", "effects", "storageNotice"];
  const ui = Object.fromEntries(ids.map(id => [id, $(id)]));
  const game = new GameCore();
  const audio = new GameAudio();
  game.resize(innerWidth, innerHeight);
  const renderer = new GameRenderer(ui.game, game);
  const STORAGE_KEY = "nulovy-bod-high-score";
  const SETTINGS_KEY = "nulovy-bod-settings-v2";
  let storageAvailable = true;
  function read(key) { try { return localStorage.getItem(key); } catch { storageAvailable = false; return null; } }
  function write(key, value) { try { localStorage.setItem(key, value); } catch { storageAvailable = false; ui.storageNotice.hidden = false; } }
  const savedBest = Number(read(STORAGE_KEY));
  let highScore = Number.isFinite(savedBest) ? clamp(Math.floor(savedBest), 0, Number.MAX_SAFE_INTEGER) : 0;
  let settings = { volume: 65, ambience: true, effects: !matchMedia("(prefers-reduced-motion: reduce)").matches, muted: false };
  try {
    const saved = JSON.parse(read(SETTINGS_KEY));
    if (saved && typeof saved === "object") {
      if (typeof saved.volume === "number" && Number.isFinite(saved.volume)) settings.volume = clamp(saved.volume, 0, 100);
      for (const name of ["ambience", "effects", "muted"]) if (typeof saved[name] === "boolean") settings[name] = saved[name];
    }
  } catch { /* A damaged preference entry does not prevent startup. */ }
  const keys = new Set();
  let pointer = null, rightHeld = false, startingBest = highScore, settingsReturn = "menu";
  let bannerTime = 0, uiTime = 0, lastFrame = performance.now();
  const formatScore = n => String(Math.floor(n)).padStart(6, "0");
  const setText = (element, value) => { const text = String(value); if (element.textContent !== text) element.textContent = text; };
  function applySettings(save = true) {
    audio.volume = settings.volume / 100; audio.muted = settings.muted; audio.ambience = settings.ambience; audio.settings(); renderer.effects = settings.effects;
    ui.volume.value = settings.volume; ui.volumeValue.value = `${settings.volume} %`; ui.ambience.checked = settings.ambience; ui.effects.checked = settings.effects;
    ui.soundButton.setAttribute("aria-pressed", String(settings.muted)); ui.soundButton.setAttribute("aria-label", settings.muted ? "Zapnout zvuk" : "Vypnout zvuk");
    ui.storageNotice.hidden = storageAvailable;
    if (save) write(SETTINGS_KEY, JSON.stringify(settings));
  }
  function stopInput() { keys.clear(); pointer = null; rightHeld = false; game.trigger = false; }
  function announce(text) { ui.announcement.textContent = text; }
  function banner(label, title, duration = 2.7) {
    ui.bannerLabel.textContent = label; ui.bannerTitle.textContent = title; ui.banner.classList.add("visible"); bannerTime = duration;
  }
  function syncScreens() {
    ui.shell.dataset.mode = game.mode;
    ui.menu.hidden = game.mode !== "menu";
    ui.pauseScreen.hidden = game.mode !== "paused" || !ui.settingsScreen.hidden;
    ui.resultsScreen.hidden = game.mode !== "gameover";
  }
  function start() {
    ui.settingsScreen.hidden = true; startingBest = highScore; stopInput(); renderer.reset(); audio.init(); game.start(); syncScreens(); ui.game.focus({ preventScroll: true }); processEvents(); updateHud();
  }
  function pause() { game.pause(); stopInput(); syncScreens(); processEvents(); if (game.mode === "paused" && ui.settingsScreen.hidden) ui.resumeButton.focus({ preventScroll: true }); }
  function resume() { if (!ui.settingsScreen.hidden) return; stopInput(); game.resume(); syncScreens(); ui.game.focus({ preventScroll: true }); processEvents(); }
  function togglePause() { game.mode === "playing" ? pause() : game.mode === "paused" ? resume() : null; }
  function record() {
    if (game.score > highScore) { highScore = game.score; write(STORAGE_KEY, String(highScore)); }
    setText(ui.highScore, formatScore(highScore)); setText(ui.menuRecord, formatScore(highScore));
  }
  function endScreen(event) {
    stopInput(); record(); syncScreens(); bannerTime = 0; ui.banner.classList.remove("visible"); ui.reloadIndicator.hidden = true;
    $("resultTitle").textContent = event.won ? "Signál udržen." : "Spojení ztraceno.";
    $("resultTag").textContent = event.won ? "OPERACE SPLNĚNA · 5 / 5 VLN" : `OPERACE UKONČENA · VLNA ${game.wave} / 5`;
    $("finalScore").textContent = formatScore(game.score);
    $("recordBadge").hidden = game.score <= startingBest;
    $("resultKills").textContent = game.stats.kills; $("resultAccuracy").textContent = `${game.accuracy} %`; $("resultHeads").textContent = game.stats.heads; $("resultStreak").textContent = game.stats.bestStreak;
    $("resultSummary").textContent = event.won ? `Bonus za obranu: +${event.bonus} bodů. Přesná přebití: ${game.stats.perfectReloads}.` : `Vydržel jsi ${Math.floor(game.elapsed)} sekund. Zkus zásahy hlavy, soustředění nebo granát proti skupině.`;
    $("playAgainButton").focus({ preventScroll: true }); announce(`Operace ${event.won ? "splněna" : "ukončena"}. Skóre ${game.score}.`);
  }
  function processEvents() {
    for (const e of game.drainEvents()) {
      renderer.event(e); audio.event(e, game.width);
      switch (e.type) {
        case "start": audio.setPlaying(true); break;
        case "pause": audio.setPlaying(false); break;
        case "resume": audio.init(); audio.setPlaying(true); break;
        case "end": audio.setPlaying(false); endScreen(e); break;
        case "wave": banner(`VLNA 0${e.wave} / 05`, e.name); announce(`Vlna ${e.wave}. ${e.name}.`); break;
        case "supplySpawn": banner("ZÁSOBY NA BOJIŠTI", "ZASÁHNI LÉKÁRNIČKU · +25 ZDRAVÍ", 2); break;
        case "notice": banner("TAKTICKÉ HLÁŠENÍ", e.title, 1.5); break;
      }
    }
    record();
  }
  function updateHud() {
    setText(ui.score, formatScore(game.score)); setText(ui.wave, `VLNA 0${game.wave} / 05`); setText(ui.waveName, WAVES[game.wave - 1]);
    const seconds = Math.ceil(game.remaining); setText(ui.time, `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`);
    ui.timeBar.style.width = `${game.remaining / 90 * 100}%`; ui.time.closest(".mission-panel").classList.toggle("urgent", game.remaining <= 10);
    setText(ui.multiplier, `×${game.multiplier}`); setText(ui.streak, `${game.streak} eliminací v sérii`); ui.comboBar.style.width = `${game.comboTime / 4.5 * 100}%`;
    setText(ui.health, Math.ceil(game.health)); ui.healthBar.style.width = `${game.health}%`; ui.health.closest(".vitals").classList.toggle("critical", game.health <= 30);
    setText(ui.focusValue, `${Math.round(game.focus)} %`); ui.focusBar.style.width = `${game.focus}%`; ui.focusButton.setAttribute("aria-pressed", String(game.focusing)); ui.focusButton.setAttribute("aria-label", game.focusing ? "Vypnout soustředění (Q)" : "Zapnout soustředění (Q)");
    setText(ui.grenades, `${game.grenades}× K DISPOZICI`); ui.grenadeButton.disabled = game.grenades === 0 || game.grenadeCooldown > 0;
    setText(ui.ammo, String(game.ammo).padStart(2, "0")); ui.reloadButton.classList.toggle("low", game.ammo <= 5);
    setText(ui.weaponStatus, game.reloading ? "KLEPNI PRO PŘESNÉ PŘEBITÍ" : game.boost > 0 ? `${game.boost} POSÍLENÝCH STŘEL` : "R · PŘEBÍT · ZÁSOBA ∞");
    ui.reloadIndicator.hidden = !game.reloading || game.mode !== "playing";
    if (game.reloading) {
      ui.reloadProgress.style.left = `${Math.min(99, game.reloading.elapsed / 1.65 * 100)}%`;
      setText(ui.reloadLabel, game.reloading.attempted ? "PŘÍŠTĚ V PÁSMU" : "PŘEBÍJENÍ");
      setText(ui.reloadHelp, game.reloading.attempted ? "Počkej na dokončení přebití." : "R nebo tlačítko munice v barevném pásmu = bonus.");
    }
    let hint = "";
    if (game.elapsed < 10) hint = "Drž spoušť pro dávku. Červený ukazatel varuje před útokem.";
    else if (game.elapsed < 17) hint = "R: přesné přebití · G: granát do zaměřovače · Q: zpomalení";
    else if (game.elapsed > 36 && game.elapsed < 41) hint = "Obrněncům miř na hlavu. Posily doplnily zdraví a jeden granát.";
    else if (game.focusing) hint = "SOUSTŘEDĚNÍ · Nepřátelé zpomalují, čas mise stále běží.";
    setText(ui.combatHint, hint);
  }
  function action(fn) { audio.init(); fn(); processEvents(); updateHud(); if (game.mode === "playing") ui.game.focus({ preventScroll: true }); }
  function aim(event) {
    const rect = ui.game.getBoundingClientRect();
    game.aim.x = clamp((event.clientX - rect.left) * game.width / rect.width, 0, game.width);
    game.aim.y = clamp((event.clientY - rect.top) * game.height / rect.height, 0, game.height);
  }
  ui.game.addEventListener("pointermove", event => { if (game.mode === "playing" && (event.pointerType === "mouse" || pointer === null || event.pointerId === pointer)) aim(event); });
  ui.game.addEventListener("pointerdown", event => {
    if (game.mode !== "playing") return;
    if (event.button === 2) { event.preventDefault(); rightHeld = true; action(() => { if (!game.focusing) game.toggleFocus(); }); return; }
    if (event.button !== 0 || pointer !== null) return;
    event.preventDefault(); pointer = event.pointerId; aim(event); ui.game.setPointerCapture(event.pointerId);
    action(() => { game.trigger = true; game.shoot(); });
  });
  function release(event) {
    if (event.pointerId === pointer) { pointer = null; game.trigger = keys.has("Space") || keys.has("Enter"); }
    if (rightHeld && (event.button === 2 || event.type === "pointercancel")) { rightHeld = false; if (game.focusing) action(() => game.toggleFocus()); }
  }
  window.addEventListener("pointerup", release); window.addEventListener("pointercancel", release);
  ui.game.addEventListener("lostpointercapture", event => { if (event.pointerId === pointer) { pointer = null; game.trigger = false; } });
  ui.game.addEventListener("contextmenu", event => event.preventDefault());
  const controlled = new Set(["Space", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD", "KeyR", "KeyG", "KeyQ", "KeyP", "Escape"]);
  window.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === "Escape") { event.preventDefault(); if (!ui.settingsScreen.hidden) closeSettings(); else togglePause(); return; }
    if (event.target instanceof HTMLInputElement) return;
    if (event.code === "KeyM" && !event.repeat) { settings.muted = !settings.muted; applySettings(); return; }
    if (!ui.settingsScreen.hidden) return;
    if (game.mode !== "playing") {
      if ((event.code === "KeyP") && game.mode === "paused" && !event.repeat) resume();
      return; // Native button activation remains available in every menu.
    }
    if (event.code === "Tab") { pause(); return; }
    if (controlled.has(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === "Space" || event.code === "Enter") action(() => { game.trigger = true; game.shoot(); });
    else if (event.code === "KeyR") action(() => game.reload());
    else if (event.code === "KeyG") action(() => game.grenade());
    else if (event.code === "KeyQ") action(() => game.toggleFocus());
    else if (event.code === "KeyP") pause();
  });
  window.addEventListener("keyup", event => { keys.delete(event.code); if (event.code === "Space" || event.code === "Enter") game.trigger = pointer !== null || keys.has("Space") || keys.has("Enter"); });
  function openSettings() {
    settingsReturn = game.mode; if (game.mode === "playing") pause(); ui.settingsScreen.hidden = false; syncScreens(); ui.volume.focus();
  }
  function closeSettings() {
    ui.settingsScreen.hidden = true; syncScreens();
    if (settingsReturn === "playing" || game.mode === "paused") ui.resumeButton.focus();
    else $("settingsButton").focus();
  }
  $("startButton").addEventListener("click", start); $("playAgainButton").addEventListener("click", start); $("restartButton").addEventListener("click", start);
  ui.resumeButton.addEventListener("click", resume); $("pauseButton").addEventListener("click", togglePause);
  $("brand").addEventListener("click", event => { event.preventDefault(); if (game.mode === "playing") pause(); });
  $("menuButton").addEventListener("click", () => { stopInput(); game.mode = "menu"; game.enemies = []; game.projectiles = []; game.supplies = []; renderer.reset(); syncScreens(); ui.startButton.focus(); });
  ui.reloadButton.addEventListener("click", () => action(() => game.reload())); ui.grenadeButton.addEventListener("click", () => action(() => game.grenade())); ui.focusButton.addEventListener("click", () => action(() => game.toggleFocus()));
  $("settingsButton").addEventListener("click", openSettings); $("closeSettingsButton").addEventListener("click", closeSettings);
  ui.soundButton.addEventListener("click", () => { settings.muted = !settings.muted; audio.init(); applySettings(); if (game.mode === "playing") ui.game.focus(); });
  ui.volume.addEventListener("input", () => { settings.volume = Number(ui.volume.value); audio.init(); applySettings(); });
  ui.ambience.addEventListener("change", () => { settings.ambience = ui.ambience.checked; applySettings(); }); ui.effects.addEventListener("change", () => { settings.effects = ui.effects.checked; applySettings(); });
  window.addEventListener("blur", () => { stopInput(); if (game.mode === "playing") pause(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { stopInput(); if (game.mode === "playing") pause(); } });
  window.addEventListener("resize", () => { game.resize(innerWidth, innerHeight); renderer.resize(); });
  // Focus stays inside the active menu instead of reaching hidden controls behind it.
  document.addEventListener("keydown", event => {
    if (event.code !== "Tab") return;
    const screen = !ui.settingsScreen.hidden ? ui.settingsScreen : !ui.pauseScreen.hidden ? ui.pauseScreen : !ui.resultsScreen.hidden ? ui.resultsScreen : null;
    if (!screen) return;
    const buttons = [...screen.querySelectorAll("button:not(:disabled), input")];
    if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
  });
  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
    if (game.mode === "playing") {
      const dx = Number(keys.has("ArrowRight") || keys.has("KeyD")) - Number(keys.has("ArrowLeft") || keys.has("KeyA"));
      const dy = Number(keys.has("ArrowDown") || keys.has("KeyS")) - Number(keys.has("ArrowUp") || keys.has("KeyW"));
      const speed = Math.min(game.width, game.height) * 0.85 * dt / (Math.hypot(dx, dy) || 1);
      game.aim.x = clamp(game.aim.x + dx * speed, 0, game.width); game.aim.y = clamp(game.aim.y + dy * speed, 0, game.height);
      game.update(dt); processEvents(); audio.update(game);
      if (bannerTime > 0) { bannerTime -= dt; if (bannerTime <= 0) ui.banner.classList.remove("visible"); }
    }
    if (game.mode !== "paused") renderer.update(dt);
    ui.damage.style.opacity = renderer.effects ? renderer.damage * 0.7 : renderer.damage * 0.22;
    renderer.render(); uiTime += dt;
    if (uiTime >= 0.06) { updateHud(); uiTime = 0; }
    requestAnimationFrame(frame);
  }
  applySettings(false); record(); syncScreens(); updateHud(); requestAnimationFrame(frame);
})();
