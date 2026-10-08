export class GameAudio{
  constructor(){this.ctx=null;this.volume=.5;}
  start(){if(!this.ctx){const A=window.AudioContext||window.webkitAudioContext;if(!A)return;this.ctx=new A();this.master=this.ctx.createGain();this.master.gain.value=this.volume*.55;this.master.connect(this.ctx.destination);const n=this.ctx.sampleRate*2;this.noiseBuffer=this.ctx.createBuffer(1,n,this.ctx.sampleRate);const data=this.noiseBuffer.getChannelData(0);for(let i=0;i<n;i++)data[i]=Math.random()*2-1;}this.ctx.resume().catch(()=>{});}
  setVolume(v){this.volume=v;if(this.master)this.master.gain.value=v*.55;}
  noise(duration,gain,freq=1000,delay=0){if(!this.ctx)return;const t=this.ctx.currentTime+delay,s=this.ctx.createBufferSource(),g=this.ctx.createGain(),f=this.ctx.createBiquadFilter();s.buffer=this.noiseBuffer;f.type='lowpass';f.frequency.value=freq;g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);s.connect(f);f.connect(g);g.connect(this.master);s.start(t);s.stop(t+duration);}
  tone(freq,duration,gain,type='sine',delay=0){if(!this.ctx)return;const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(freq*.5,25),t+duration);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration);}
  shot(){this.noise(.12,.85,5200);this.tone(125,.14,.7,'triangle');this.noise(.3,.13,850,.075);this.noise(.2,.06,1100,.19);}
  hit(){this.tone(1900,.18,.22,'sine');this.tone(2800,.08,.08,'triangle');}
  step(crouch=false){this.noise(.095,crouch?.065:.14,700);this.tone(75,.065,.065);}
  reload(stage=0){this.noise(.07,.23,3500);this.tone(stage?680:380,.045,.085,'square');}
  empty(){this.tone(170,.04,.09,'square');}
  hurt(){this.noise(.18,.26,550);this.tone(65,.22,.22,'sine');}
  enemyShot(gain=.5){this.noise(.11,.25*gain,2400);this.tone(100,.13,.18*gain,'triangle');}
}
