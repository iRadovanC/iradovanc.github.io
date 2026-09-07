/* Original sound synthesis: layered impulses, spatial effects and an adaptive score. */
(() => {
  "use strict";
  class GameAudio {
    constructor() { this.ctx = null; this.volume = 0.65; this.muted = false; this.ambience = true; this.playing = false; this.beat = 0; this.nextBeat = 0; }
    init() {
      try {
        if (!this.ctx) {
          const Audio = window.AudioContext || window.webkitAudioContext;
          if (!Audio) return;
          this.ctx = new Audio();
          this.master = this.ctx.createGain();
          const compressor = this.ctx.createDynamicsCompressor();
          compressor.threshold.value = -16; compressor.ratio.value = 5;
          this.master.connect(compressor).connect(this.ctx.destination);
          this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
          const data = this.noise.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
          this.room = this.ctx.createDelay(0.5);
          this.room.delayTime.value = 0.115;
          const echo = this.ctx.createGain(); echo.gain.value = 0.12;
          const filter = this.ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 1800;
          this.room.connect(filter).connect(echo).connect(this.master);
          this.wind = this.ctx.createBufferSource(); this.wind.buffer = this.noise; this.wind.loop = true;
          const windFilter = this.ctx.createBiquadFilter(); windFilter.type = "lowpass"; windFilter.frequency.value = 260;
          this.windGain = this.ctx.createGain(); this.windGain.gain.value = 0;
          this.wind.connect(windFilter).connect(this.windGain).connect(this.master); this.wind.start();
          this.settings();
        }
        if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      } catch { this.ctx = null; }
    }
    settings() {
      if (!this.ctx) return;
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.7, this.ctx.currentTime, 0.03);
      this.windGain.gain.setTargetAtTime(this.ambience && this.playing ? 0.075 : 0, this.ctx.currentTime, 0.15);
    }
    setPlaying(value) { this.playing = value; this.nextBeat = 0; this.settings(); }
    route(node, pan = 0, echo = false) {
      if (this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); node = p; }
      node.connect(this.master);
      if (echo) node.connect(this.room);
    }
    tone(freq, endFreq, duration, volume, type = "sine", pan = 0, delay = 0) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime + delay, osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + 0.003); gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain); this.route(gain, pan); osc.start(t); osc.stop(t + duration + 0.01);
    }
    noiseBurst(duration, volume, cutoff, pan = 0, delay = 0, echo = false) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime + delay, source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
      source.buffer = this.noise; filter.type = "lowpass"; filter.frequency.value = cutoff;
      gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      source.connect(filter).connect(gain); this.route(gain, pan, echo); source.start(t, Math.random() * 0.5); source.stop(t + duration + 0.01);
    }
    event(event, width) {
      if (!this.ctx) return;
      const pan = event.x === undefined ? 0 : (event.x / width - 0.5) * 1.5;
      switch (event.type) {
        case "shot": this.noiseBurst(0.16, 0.65, 3400, 0.1, 0, true); this.tone(135, 42, 0.16, 0.5); this.noiseBurst(0.035, 0.23, 7800, 0.1); this.tone(1800, 950, 0.025, 0.065, "triangle", 0.35, 0.06); break;
        case "hit": this.noiseBurst(0.06, 0.14, event.armor ? 8000 : 2200, pan); if (event.head) { this.tone(1420, 1820, 0.12, 0.13, "sine", pan); this.tone(2130, 2530, 0.1, 0.045, "sine", pan, 0.025); } break;
        case "kill": if (!event.head) this.tone(670, 420, 0.085, 0.1, "triangle", pan); break;
        case "reload": this.noiseBurst(0.1, 0.22, 2500, 0.2); this.tone(210, 100, 0.07, 0.13, "triangle"); break;
        case "reloadClick": this.noiseBurst(0.09, 0.18, 4200, -0.15); break;
        case "loaded": this.noiseBurst(0.12, 0.28, 3500, 0.2); this.tone(350, 140, 0.07, 0.09, "triangle"); break;
        case "perfect": this.tone(620, 620, 0.12, 0.13, "sine"); this.tone(930, 930, 0.2, 0.1, "sine", 0, 0.07); this.noiseBurst(0.07, 0.15, 3700); break;
        case "reloadMiss": this.tone(130, 80, 0.15, 0.08, "triangle"); break;
        case "enemyShot": this.noiseBurst(0.18, 0.24, 1800, pan, 0, true); this.tone(85, 35, 0.15, 0.13, "sine", pan); break;
        case "damage": this.noiseBurst(0.2, 0.4, 850); this.tone(78, 35, 0.32, 0.3); break;
        case "warning": this.tone(1050, 1000, 0.075, 0.038, "sine", pan); break;
        case "throw": this.noiseBurst(0.2, 0.17, 1600); this.tone(500, 180, 0.2, 0.07, "triangle"); break;
        case "explosion": this.noiseBurst(0.95, 0.9, 850, pan, 0, true); this.noiseBurst(0.13, 0.5, 3600, pan); this.tone(90, 23, 0.65, 0.65, "sine", pan); break;
        case "focus": this.tone(event.active ? 650 : 180, event.active ? 180 : 650, 0.3, 0.12, "sine"); break;
        case "wave": [220, 330, 440].forEach((f, i) => this.tone(f, f, 0.25, 0.075, "triangle", 0, i * 0.13)); break;
        case "supply": [620, 780, 1040].forEach((f, i) => this.tone(f, f, 0.16, 0.07, "sine", 0, i * 0.06)); break;
        case "end": (event.won ? [220, 330, 440, 660] : [196, 185, 130]).forEach((f, i) => this.tone(f, f * 0.99, 0.65, 0.13, "triangle", 0, i * 0.17)); break;
      }
    }
    update(game) {
      if (!this.ctx || !this.playing || !this.ambience || this.muted) return;
      const now = this.ctx.currentTime;
      if (now < this.nextBeat) return;
      const step = (game.focusing ? 0.37 : 0.27) - game.wave * 0.01;
      this.nextBeat = now + step;
      const notes = [55, 55, 65.41, 55, 73.42, 55, 65.41, 49];
      if (this.beat % 2 === 0) this.tone(notes[(this.beat / 2) % 8], 48, 0.18, 0.12);
      if (this.beat % 4 === 0) this.tone(84, 32, 0.2, 0.17);
      if (game.wave >= 2 && this.beat % 4 === 2) this.noiseBurst(0.06, 0.065, 2400);
      if (game.wave >= 3) this.noiseBurst(0.024, 0.018, 6500, this.beat % 2 ? -0.4 : 0.4);
      if (this.beat % 16 === 0) [110, 164.81, 220].forEach(f => this.tone(f, f, 2.5, 0.018, "sine"));
      if (game.health <= 30 && this.beat % 4 === 0) this.tone(62, 38, 0.15, 0.22);
      this.beat = (this.beat + 1) % 32;
    }
  }
  globalThis.GameAudio = GameAudio;
})();
