/* Locally synthesized sound: no samples, requests or dependencies. */
(() => {
  "use strict";
  class FieldAudio {
    constructor() { this.context = null; this.muted = false; this.active = false; this.beat = 0; this.nextBeat = 0; }
    unlock() {
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        if (!this.context) {
          this.context = new Audio();
          this.master = this.context.createGain(); this.master.gain.value = this.muted ? 0 : .48;
          const limiter = this.context.createDynamicsCompressor(); limiter.threshold.value = -12; limiter.ratio.value = 5;
          this.master.connect(limiter).connect(this.context.destination);
          this.noiseBuffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
          const data = this.noiseBuffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
          this.wind = this.context.createBufferSource(); this.wind.buffer = this.noiseBuffer; this.wind.loop = true;
          const filter = this.context.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 420;
          this.ambience = this.context.createGain(); this.ambience.gain.value = 0;
          this.wind.connect(filter).connect(this.ambience).connect(this.master); this.wind.start();
        }
        if (this.context.state === "suspended") this.context.resume().catch(() => {});
      } catch { /* The game remains playable when a browser disables audio. */ }
    }
    setMuted(muted) { this.muted = muted; if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : .48, this.context.currentTime, .03); }
    setActive(active) { this.active = active; if (this.ambience) this.ambience.gain.setTargetAtTime(active ? .075 : 0, this.context.currentTime, .2); if (active) this.nextBeat = 0; }
    route(node, x = .5) {
      if (this.context.createStereoPanner) { const pan = this.context.createStereoPanner(); pan.pan.value = Math.max(-.8, Math.min(.8, (x - .5) * 1.6)); node.connect(pan).connect(this.master); return pan; }
      node.connect(this.master); return null;
    }
    tone(freq, duration, volume = .1, type = "triangle", end = freq, delay = 0, x = .5) {
      if (!this.context || this.muted) return;
      const t = this.context.currentTime + delay, osc = this.context.createOscillator(), gain = this.context.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, t); osc.frequency.exponentialRampToValueAtTime(Math.max(15, end), t + duration);
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + .006); gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
      osc.connect(gain); const pan = this.route(gain, x); osc.start(t); osc.stop(t + duration + .01);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); if (pan) pan.disconnect(); };
    }
    noise(duration, volume, cutoff, delay = 0, x = .5, type = "lowpass") {
      if (!this.context || this.muted) return;
      const t = this.context.currentTime + delay, source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), gain = this.context.createGain();
      source.buffer = this.noiseBuffer; filter.type = type; filter.frequency.value = cutoff;
      gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
      source.connect(filter).connect(gain); const pan = this.route(gain, x); source.start(t, Math.random()); source.stop(t + duration);
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); if (pan) pan.disconnect(); };
    }
    play(name, x = .5) {
      if (!this.context || this.muted) return;
      switch (name) {
        case "shot": this.noise(.16,.65,3400,0,x); this.tone(150,.16,.34,"triangle",35,0,x); this.noise(.12,.12,900,.065,x); this.tone(2600,.05,.03,"sine",1500,.09,.85); break;
        case "helmet": this.tone(1200,.3,.2,"sine",530,0,x); this.tone(1870,.16,.1,"triangle",1600,.01,x); break;
        case "hit": this.noise(.09,.24,750,0,x); this.tone(350,.16,.13,"triangle",700,0,x); break;
        case "miss": this.noise(.06,.09,1600,0,x); break;
        case "empty": this.noise(.035,.16,2200); this.tone(140,.04,.08,"square",90); break;
        case "reloadOut": this.noise(.13,.24,1700); this.tone(180,.1,.08,"triangle",90); break;
        case "reloadIn": this.noise(.08,.26,2300); this.noise(.055,.2,3500,.13); this.tone(380,.06,.07,"square",230,.13); break;
        case "damage": this.noise(.25,.4,600,0,x); this.tone(90,.35,.3,"sawtooth",28,0,x); break;
        case "jam": this.tone(420,.18,.17,"sawtooth",110,0,x); this.tone(95,.22,.17,"triangle",65,.2,x); break;
        case "soup": this.noise(.55,.65,850,0,x); this.tone(100,.5,.35,"sine",24,0,x); for (let i=0;i<6;i++) this.tone(180+i*65,.12,.12,"sine",70,.12+i*.055,x); break;
        case "supply": [523,659,784,1046].forEach((f,i)=>this.tone(f,.17,.12,"triangle",f,i*.09,x)); break;
        case "friendly": [340,310,270,140].forEach((f,i)=>this.tone(f,.22,.12,"sawtooth",f*.92,i*.15,x)); break;
        case "radio": this.noise(.1,.08,2200,0,.25,"bandpass"); this.tone(1200,.05,.06,"sine",1200,.06,.25); break;
        case "start": [196,196,262,330,392].forEach((f,i)=>this.tone(f,.18,.13,"triangle",f,i*.13)); break;
        case "end": [392,330,262,196].forEach((f,i)=>this.tone(f,.28,.14,"triangle",f,i*.18)); break;
        case "tick": this.tone(880,.065,.08,"sine"); break;
        case "flap": this.noise(.16,.08,1200,0,x); break;
      }
    }
    update(time) {
      if (!this.active || this.muted || !this.context || time < this.nextBeat) return;
      this.nextBeat = time + .43; const beat = this.beat++ % 16;
      // A deliberately lopsided marching band, quieter than combat effects.
      if (beat % 4 === 0) this.tone([65.4,65.4,87.3,73.4][Math.floor(beat/4)],.23,.055,"triangle",55);
      if (beat % 2) this.noise(.08,.022,2300);
      if ([0,3,6,8,11,14].includes(beat)) { const f=[261.6,0,0,329.6,0,0,392,0,349.2,0,0,329.6,0,0,246.9,0][beat]; this.tone(f,.15,.022,"triangle",f*.985); }
      if (beat === 7) this.tone(1400,.16,.018,"sine",2000,0,.8);
    }
  }
  window.FieldAudio = FieldAudio;
})();
