(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const canvas=$("game"), shell=document.querySelector(".game-shell");
  const renderer=new FieldRenderer(canvas), sound=new FieldAudio();
  const ROUND=60, MAG=8, RELOAD=1.15, STORAGE="nulovy-bod-high-score";
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), random=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.floor(Math.random()*a.length)];
  const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
  const save=(key,value)=>{try{localStorage.setItem(key,String(value));}catch{/* Storage is optional, including file:// and private browsing. */}};
  const storedScore=Number(read(STORAGE,0));
  const state={mode:"menu",width:innerWidth,height:innerHeight,score:0,highScore:Number.isFinite(storedScore)?Math.max(0,Math.floor(storedScore)):0,shots:0,hits:0,combo:0,bestCombo:0,mishaps:0,armor:3,ammo:MAG,reload:0,reloadDuration:RELOAD,reloadClick:false,time:0,timeLeft:ROUND,visualTime:0,nextSpawn:.65,spawnCount:0,shotAt:-1,invulnerable:0,enemies:[],particles:[],floaters:[],barrelTimers:[],supply:null,events:new Set(),keys:new Set(),pointerFiring:false,keyFiring:false,recoil:0,muzzle:0,shake:0,damageFlash:0,hitMarker:0,radioUntil:0,bannerUntil:0,lastSecond:60,aim:{x:innerWidth*.5,y:innerHeight*.5},reducedMotion:matchMedia("(prefers-reduced-motion: reduce)").matches};
  let previousFrame=performance.now(),hudSnapshot="";

  function resize() {
    const oldW=state.width,oldH=state.height;state.width=innerWidth;state.height=innerHeight;
    renderer.resize(state.width,state.height,Math.min(devicePixelRatio||1,2));
    state.aim.x=clamp(state.aim.x/oldW*state.width,0,state.width);state.aim.y=clamp(state.aim.y/oldH*state.height,0,state.height);
    // Resizing and rotating preserve progress but retire actors in removed cover slots.
    state.enemies=state.enemies.filter(e=>e.free||renderer.slots[e.slot]);
    for(const e of state.enemies){if(e.free){e.x=e.x/oldW*state.width;e.y=e.y/oldH*state.height;e.scale=renderer.u;}else Object.assign(e,renderer.slots[e.slot],{slot:e.slot});}
    if(state.supply){state.supply.x*=state.width/oldW;state.supply.y*=state.height/oldH;}
    state.barrelTimers=renderer.barrels.map((_,i)=>state.barrelTimers[i]||0);
  }
  function hud(force=false) {
    const sec=Math.max(0,Math.ceil(state.timeLeft)),accuracy=state.shots?Math.round(state.hits/state.shots*100):0;
    const snapshot=[sec,state.score,state.combo,state.armor,state.ammo,state.reload>0,state.shots,state.hits,state.highScore].join(":");
    $("reloadProgress").style.transform=`scaleX(${state.reload>0?1-state.reload/RELOAD:0})`;
    if(!force&&snapshot===hudSnapshot)return;hudSnapshot=snapshot;
    $("score").textContent=String(state.score).padStart(6,"0");$("highScore").textContent=String(state.highScore).padStart(6,"0");
    $("time").textContent=`${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;
    $("timerProgress").style.transform=`scaleX(${state.timeLeft/ROUND})`;document.querySelector(".clock-panel").classList.toggle("is-urgent",sec<=10);
    $("combo").textContent=`×${Math.max(1,state.combo)}`;$("accuracy").textContent=state.shots?`${accuracy} %`:"—";
    $("ammoCount").textContent=String(state.ammo).padStart(2,"0");$("reloadText").textContent=state.reload>0?"PŘEBÍJÍM":"PŘEBÍT";
    $("reloadButton").disabled=state.reload>0||state.ammo===MAG;
    $("armor").setAttribute("aria-label",`Odolnost ${state.armor} ze 3`);
    [...$("armor").children].forEach((el,i)=>el.classList.toggle("is-empty",i>=state.armor));
    $("ammo").setAttribute("aria-label",`Munice ${state.ammo} z ${MAG}`);
    [...$("ammo").children].forEach((el,i)=>el.classList.toggle("is-empty",i>=state.ammo));
  }
  function radio(text,speaker="VELITELSTVÍ · KANÁL 07",force=false) {
    if(!force&&state.radioUntil-state.time>2)return;
    $("radioText").textContent=text;$("radioSpeaker").textContent=speaker;$("radio").classList.add("is-visible");state.radioUntil=state.time+5.5;sound.play("radio");
  }
  function banner(text) {$("eventBanner").textContent=text;$("eventBanner").classList.add("is-visible");state.bannerUntil=state.time+3.2;}
  function message(text,danger=false) {
    $("message").textContent=text;$("message").className=`message${danger?" danger":""}`;
    // Restart the CSS animation without an asynchronous gameplay timer.
    $("message").style.animation="none";void $("message").offsetWidth;$("message").style.animation="";$("message").classList.add("pop");
  }
  function floater(text,x,y,color="#f3d270",size=28) {state.floaters.push({text,x,y,life:1.05,color,size:size*clamp(renderer.u,.7,1.3),angle:random(-.12,.12)});}
  function burst(x,y,colors,count=16,kind="confetti") {
    for(let i=0;i<count;i++){const a=random(0,Math.PI*2),v=random(50,230)*renderer.u,life=random(.45,1);
      state.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-50,life,max:life,size:random(3,8)*renderer.u,color:pick(colors),angle:random(0,6),spin:random(-9,9),kind});}
    if(state.particles.length>280)state.particles.splice(0,state.particles.length-280);
  }
  function start() {
    sound.unlock();sound.setActive(true);sound.play("start");
    Object.assign(state,{mode:"playing",score:0,shots:0,hits:0,combo:0,bestCombo:0,mishaps:0,armor:3,ammo:MAG,reload:0,reloadClick:false,time:0,timeLeft:ROUND,nextSpawn:.65,spawnCount:0,shotAt:-1,invulnerable:0,enemies:[],particles:[],floaters:[],barrelTimers:renderer.barrels.map(()=>0),supply:null,events:new Set(),pointerFiring:false,keyFiring:false,recoil:0,muzzle:0,shake:0,damageFlash:0,hitMarker:0,radioUntil:0,bannerUntil:0,lastSecond:60});
    state.keys.clear();state.aim={x:state.width*.5,y:state.height*.5};previousFrame=performance.now();
    shell.classList.add("playing");shell.classList.remove("paused");$("overlay").classList.remove("is-visible","game-over");$("overlay").inert=true;$("pauseOverlay").hidden=true;$("result").hidden=true;$("eventBanner").classList.remove("is-visible");$("message").classList.remove("pop");$("startButton").blur();
    $("message").textContent="";$("pauseButton").setAttribute("aria-label","Pozastavit hru");
    radio("Drž pozici. Na pohyb nemáme formulář. Klikni na nepřátele, R přebíjí.",undefined,true);hud(true);
  }
  function end() {
    if(state.mode!=="playing")return;
    state.mode="gameover";state.pointerFiring=state.keyFiring=false;state.keys.clear();state.reload=0;state.enemies=[];state.supply=null;sound.setActive(false);sound.play("end");
    const record=state.score>state.highScore;if(record){state.highScore=state.score;save(STORAGE,state.highScore);}
    shell.classList.remove("playing","paused");$("overlay").classList.add("is-visible","game-over");$("overlay").inert=false;$("pauseOverlay").hidden=true;$("radio").classList.remove("is-visible");$("eventBanner").classList.remove("is-visible");
    $("overlayTitle").innerHTML=state.armor<=0?"TAKTICKÝ<br /><em>ODPOČINEK.</em>":"MISE<br /><em>ODŠLENDRIÁNA.</em>";
    $("overlayText").textContent=state.armor<=0?"Polní nemocnice hlásí: ego pohmožděné. Jinak dobrý.":"Pozice udržena. Vybavení odevzdej. Pokud ještě existuje.";
    $("result").hidden=false;$("finalScore").textContent=state.score.toLocaleString("cs-CZ");
    $("resultRank").textContent=state.score>=6500?"Hodnost: maršál improvizace.":state.score>=3500?"Hodnost: kapitán kontrolovaného chaosu.":state.score>=1200?"Hodnost: desátník. Klíče od skladu zatím nedostaneš.":"Hodnost: vojín. Perspektivní. Z dálky.";
    $("resultHits").textContent=state.hits;$("resultAccuracy").textContent=`${state.shots?Math.round(state.hits/state.shots*100):0} %`;$("resultMishaps").textContent=state.mishaps;$("newRecord").hidden=!record;$("startButtonLabel").textContent="JEŠTĚ JEDNU ŠICHTU";$("message").textContent="";hud(true);$("startButton").focus({preventScroll:true});
  }
  function pause() {
    if(state.mode!=="playing"&&state.mode!=="paused")return;
    const paused=state.mode==="playing";state.mode=paused?"paused":"playing";state.pointerFiring=state.keyFiring=false;state.keys.clear();sound.setActive(!paused);
    shell.classList.toggle("paused",paused);shell.classList.toggle("playing",!paused);$("pauseOverlay").hidden=!paused;$("pauseButton").setAttribute("aria-label",paused?"Pokračovat ve hře":"Pozastavit hru");
    previousFrame=performance.now();if(paused)$("resumeButton").focus({preventScroll:true});else{$("resumeButton").blur();sound.unlock();}
  }
  function reload() {
    if(state.mode!=="playing"||state.reload>0||state.ammo===MAG)return;
    state.reload=RELOAD;state.reloadClick=false;sound.play("reloadOut");hud();
    if(state.ammo===0&&Math.random()<.3)radio(pick(["Zásobník není bezedný. Účetní to ověřila.","Osm ran. Devátá je optimismus.","Přebij. Nadávky se jako munice nepočítají."]));
  }
  function spawn() {
    const available=renderer.slots.filter(slot=>!state.enemies.some(e=>e.slot===slot.i));if(!available.length)return;
    const slot=pick(available),n=state.spawnCount++,kind=n%4===1?"pot":n%5===3?"officer":"soldier";
    state.enemies.push({slot:slot.i,x:slot.x,y:slot.y,scale:slot.scale,kind,seed:n+random(0,6),born:state.time,life:random(4.0,4.7)-state.time*.023,dead:false,jammed:false,willJam:kind==="pot"||n%7===5});
  }
  function cook() {
    state.enemies.push({slot:-1,free:true,x:-60*renderer.u,y:state.height*.57,scale:renderer.u*.94,kind:"cook",seed:3,born:state.time,life:8,dead:false});
    banner("POLNÍ KUCHAŘ NA BOJIŠTI — NESTŘÍLET!");radio("Ten v bílé čepici je náš! Nech ho projít pro bonus. A pro oběd.",undefined,true);
  }
  function drop() {
    state.supply={x:state.width*.52,y:state.height*.23,born:state.time};banner("ZÁSOBY NA DEŠTNÍKU! TREF BEDNU.");radio("Padáky došly. Tref zásoby: doplní munici a jeden život.","ZÁSOBOVÁNÍ · PRÝ TO VYDRŽÍ",true);sound.play("flap");
  }
  function event(at,action) {if(state.time>=at&&!state.events.has(at)){state.events.add(at);action();}}
  function kill(e,head=false,explosion=false) {
    if(e.dead||e.kind==="cook")return;
    e.dead=true;e.deadAt=state.time;state.combo=Math.min(9,state.combo+1);state.bestCombo=Math.max(state.bestCombo,state.combo);
    const points=(head?180:100)+(state.combo-1)*20;state.score+=points;
    const x=e.x,y=e.y-122*e.scale;
    burst(x,y,["#ebcc70","#ece2bb","#b7c987","#d78e56"],head?20:12,"star");
    floater(head?pick(["CINK!","BEZ ČEPICE!","ODVĚTRÁNO!"]):pick(["PÁC!","SEDNI!","PADLA!"]),x,y-31*e.scale,head?"#f5d670":"#efe4bc",head?31:27);
    floater(`+${points}`,x+24*e.scale,y+32*e.scale,"#edf0c3",19);
    if(head){state.mishaps++;state.particles.push({x,y:y-28*e.scale,vx:random(-100,100),vy:-300*e.scale,life:1.2,max:1.2,size:e.scale,color:"",angle:0,spin:random(-7,7),kind:"helmet",variant:e.kind});}
    if(!explosion)sound.play(head?"helmet":"hit",x/state.width);state.hitMarker=.18;
    if(state.combo===5)message("PĚT ZA SEBOU. VELITEL TOMU NEVĚŘÍ.");
  }
  function hitTest(e,x,y) {
    if(e.dead)return null;const rise=clamp((state.time-e.born)/.32,0,1),bob=Math.sin(state.time*4+e.seed)*1.4*e.scale;
    const foot=e.y+(e.free?0:(1-rise)*125*e.scale)+bob;
    if(!e.free&&y>e.y+4*e.scale)return null;
    const dx=(x-e.x)/e.scale,dy=(y-foot)/e.scale;
    if((dx/33)**2+((dy+131)/39)**2<=1)return "head";
    return Math.abs(dx)<43&&dy>-99&&dy<-27?"body":null;
  }
  function shoot() {
    if(state.mode!=="playing"||state.reload>0||state.time-state.shotAt<.145)return;
    if(state.ammo===0){sound.play("empty");reload();return;}
    state.shotAt=state.time;state.ammo--;state.shots++;state.recoil=1;state.muzzle=1;state.shake=state.reducedMotion?0:2.2;sound.play("shot",state.aim.x/state.width);
    state.particles.push({x:state.width*.57,y:state.height-135*renderer.u,vx:random(170,260),vy:-180,life:.7,max:.7,size:5*renderer.u,color:"#e4be64",angle:0,spin:18,kind:"casing"});
    const {x,y}=state.aim;
    const candidates=state.enemies.map(e=>({e,area:hitTest(e,x,y)})).filter(o=>o.area).sort((a,b)=>b.e.y-a.e.y);
    const supply=state.supply;
    if(supply&&Math.abs(x-supply.x)<32*renderer.u&&y>supply.y-15*renderer.u&&y<supply.y+38*renderer.u) {
      state.hits++;state.ammo=MAG;state.armor=Math.min(3,state.armor+1);state.score+=150;state.supply=null;state.mishaps++;sound.play("supply");burst(x,y,["#f0d373","#d9e6bb","#f2e7c4"],26);floater("DORUČENO! +150",x,y-35,"#e7efb9");message("+1 ŽIVOT · PLNÝ ZÁSOBNÍK");
    } else if(candidates.length) {
      const {e,area}=candidates[0];
      if(e.kind==="cook"){e.dead=true;e.deadAt=state.time;state.score=Math.max(0,state.score-200);state.combo=0;state.mishaps++;burst(x,y,["#e8e0bf","#cfaa77"],15);floater("MŮJ EŠUS! −200",x,y-25,"#ffbc8a");sound.play("friendly");radio("Trefil jsi kuchaře. Za trest budeš vařit ty.","KUCHYNĚ · DIPLOMATICKÝ INCIDENT",true);}
      else {state.hits++;kill(e,area==="head");}
    } else {
      const index=renderer.barrels.findIndex((b,i)=>!state.barrelTimers[i]&&Math.abs(x-b.x)<32*b.scale&&y>b.y-82*b.scale&&y<b.y+6*b.scale);
      if(index>=0) {
        const b=renderer.barrels[index];state.barrelTimers[index]=12;state.hits++;state.mishaps++;state.score+=75;state.shake=state.reducedMotion?0:8;sound.play("soup",b.x/state.width);
        burst(b.x,b.y-40*b.scale,["#e1a052","#c18a48","#e4c96d","#a9b86d"],45);floater("GULÁŠOVÁ VLNA!",b.x,b.y-110*b.scale,"#ffd582",34);
        for(const e of state.enemies)if(e.kind!=="cook"&&!e.dead&&Math.hypot(e.x-b.x,(e.y-b.y)*.6)<state.width*.30)kill(e,false,true);
        radio("Oběd se podává. Plošně.","POLNÍ KUCHYNĚ · ROZPTYL V NORMĚ",true);
      } else {state.combo=0;burst(x,y,["#d1c38c","#8c9262"],5);sound.play("miss",x/state.width);}
    }
    hud();
  }
  function attack(e) {
    if(e.willJam&&!e.jammed){e.jammed=true;e.life+=2.2;state.mishaps++;sound.play("jam",e.x/state.width);floater("ZASEKLO SE TO?!",e.x,e.y-170*e.scale,"#f4d78b",23);radio(pick(["Nepřítel má technickou přestávku. Využij reklamaci.","Jejich výzbroj dodával nejlevnější uchazeč.","Zaseknutá zbraň. Konečně rovnocenný soupeř."]));return;}
    e.dead=true;e.deadAt=state.time;burst(e.x,e.y-65*e.scale,["#f0c260","#efe5b9"],7);
    if(state.time<state.invulnerable)return;
    state.armor=Math.max(0,state.armor-1);state.invulnerable=state.time+1.2;state.combo=0;state.damageFlash=1;state.shake=state.reducedMotion?0:10;sound.play("damage",e.x/state.width);message(pick(["AU. TO BYLA SLUŽEBNÍ HELMA!","ZÁSAH! STÍŽNOST PODEJ PO BOJI.","ŠKRÁBANEC NA VOJENSKÉ CTI."]),true);hud();if(state.armor===0)end();
  }
  function update(dt) {
    if(state.mode==="paused")return;
    state.visualTime+=dt;
    if(state.mode==="playing") {
      state.time+=dt;state.timeLeft=Math.max(0,ROUND-state.time);if(state.timeLeft===0){end();return;}
      const speed=Math.min(state.width,state.height)*.72;
      if(state.keys.has("ArrowLeft")||state.keys.has("KeyA"))state.aim.x-=speed*dt;if(state.keys.has("ArrowRight")||state.keys.has("KeyD"))state.aim.x+=speed*dt;
      if(state.keys.has("ArrowUp")||state.keys.has("KeyW"))state.aim.y-=speed*dt;if(state.keys.has("ArrowDown")||state.keys.has("KeyS"))state.aim.y+=speed*dt;
      state.aim.x=clamp(state.aim.x,5,state.width-5);state.aim.y=clamp(state.aim.y,5,state.height-5);
      if(state.reload>0){state.reload=Math.max(0,state.reload-dt);if(state.reload<.28&&!state.reloadClick){state.reloadClick=true;sound.play("reloadIn");}if(state.reload===0)state.ammo=MAG;}
      else if(state.ammo===0&&state.time-state.shotAt>.22)reload();
      if(state.pointerFiring||state.keyFiring)shoot();
      if(state.time>=state.nextSpawn&&state.enemies.filter(e=>!e.dead&&!e.free).length<(state.width<600?3:4)){spawn();state.nextSpawn=state.time+random(.95,1.4)-state.time*.006;}
      for(const e of state.enemies){if(e.dead)continue;if(e.free){e.x=(state.time-e.born)/e.life*(state.width+140*renderer.u)-70*renderer.u;if(state.time-e.born>e.life){e.dead=true;e.deadAt=state.time-1;state.score+=150;floater("OBĚD ZACHRÁNĚN +150",state.width*.65,state.height*.43,"#e5edb8",24);radio("Kuchař dorazil. Oběd přežil. Bohužel je to zase guláš.","KUCHYNĚ · +150 ZA DOPROVOD",true);}}else if(state.time-e.born>=e.life){attack(e);if(state.mode!=="playing")return;}}
      state.enemies=state.enemies.filter(e=>!e.dead||state.time-e.deadAt<.7);
      state.barrelTimers=state.barrelTimers.map(t=>Math.max(0,t-dt));
      if(state.supply){const age=state.time-state.supply.born;state.supply.x=state.width*(.52+Math.sin(age*.75)*.12);state.supply.y=state.height*(.23+age*.038);if(age>11)state.supply=null;}
      event(5,()=>radio("Helma cinkne za víc bodů. Sudy s gulášem vyřadí okolní nepřátele.",undefined,true));
      event(10,cook);event(18,drop);
      event(29,()=>{banner("INSPEKCE! VŠICHNI PŘEDSTÍRAJÍ KOMPETENCI.");radio("Přijel generál. Nepřítel na tři sekundy salutuje. Pal!",undefined,true);for(const e of state.enemies)if(!e.dead&&!e.free){e.life+=3;e.saluteUntil=state.time+3;}state.mishaps++;});
      event(37,cook);event(44,drop);event(51,()=>{banner("POSLEDNÍ SMĚNA. DRŽ POZICI!");radio("Za devět sekund padla. Kdo přežije, zametá.",undefined,true);});
      const sec=Math.ceil(state.timeLeft);if(sec<=10&&sec!==state.lastSecond)sound.play("tick");state.lastSecond=sec;
      if(state.time>state.radioUntil)$("radio").classList.remove("is-visible");if(state.time>state.bannerUntil)$("eventBanner").classList.remove("is-visible");
      sound.update(state.time);hud();
    }
    for(const key of ["recoil","muzzle","shake","damageFlash","hitMarker"])state[key]=Math.max(0,state[key]-dt*({recoil:6,muzzle:14,shake:23,damageFlash:2,hitMarker:1}[key]));
    for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=dt*(p.kind==="helmet"?520:330);p.angle+=p.spin*dt;}
    state.particles=state.particles.filter(p=>p.life>0);for(const f of state.floaters){f.life-=dt;f.y-=dt*35;}state.floaters=state.floaters.filter(f=>f.life>0);
  }
  function frame(now) {const dt=clamp((now-previousFrame)/1000,0,.1);previousFrame=now;update(dt);renderer.render(state);requestAnimationFrame(frame);}
  function aim(event) {const rect=canvas.getBoundingClientRect();state.aim.x=event.clientX-rect.left;state.aim.y=event.clientY-rect.top;}
  canvas.addEventListener("pointermove",event=>{if(state.mode==="playing")aim(event);});
  canvas.addEventListener("pointerdown",event=>{if(state.mode!=="playing"||event.button!==0)return;event.preventDefault();sound.unlock();aim(event);canvas.setPointerCapture(event.pointerId);state.pointerFiring=true;shoot();});
  for(const type of ["pointerup","pointercancel","lostpointercapture"])canvas.addEventListener(type,()=>{state.pointerFiring=false;});
  canvas.addEventListener("contextmenu",event=>event.preventDefault());
  const movement=["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","KeyW","KeyA","KeyS","KeyD"];
  window.addEventListener("keydown",event=>{
    if(event.code==="Escape"&&!event.repeat){event.preventDefault();pause();return;}
    if(event.code==="KeyM"&&!event.repeat){toggleSound();return;}
    // Native button keyboard activation remains intact on menus and controls.
    if(event.target instanceof HTMLElement&&event.target.closest("button")&&["Enter","Space"].includes(event.code))return;
    if(state.mode!=="playing"){if(!event.repeat&&["Space","Enter"].includes(event.code)){event.preventDefault();if(state.mode==="paused")pause();else start();}return;}
    if([...movement,"Space","Enter","KeyR"].includes(event.code))event.preventDefault();state.keys.add(event.code);
    if(["Space","Enter"].includes(event.code)){state.keyFiring=true;if(!event.repeat)shoot();}if(event.code==="KeyR"&&!event.repeat)reload();
  });
  window.addEventListener("keyup",event=>{state.keys.delete(event.code);if(["Space","Enter"].includes(event.code))state.keyFiring=false;});
  window.addEventListener("blur",()=>{state.keys.clear();state.pointerFiring=state.keyFiring=false;if(state.mode==="playing")pause();});
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&state.mode==="playing")pause();});
  window.addEventListener("resize",resize);
  $("startButton").addEventListener("click",start);$("resumeButton").addEventListener("click",pause);$("pauseButton").addEventListener("click",pause);$("reloadButton").addEventListener("click",()=>{reload();$("reloadButton").blur();});
  function updateSoundButton() {$("soundToggle").classList.toggle("is-muted",sound.muted);$("soundToggle").setAttribute("aria-label",sound.muted?"Zapnout zvuk":"Vypnout zvuk");$("soundToggle").setAttribute("aria-pressed",String(sound.muted));$("soundToggle").querySelector("span").textContent=sound.muted?"ZVUK VYP":"ZVUK ZAP";}
  function toggleSound() {sound.unlock();sound.setMuted(!sound.muted);save("nulovy-bod-muted",sound.muted);updateSoundButton();$("soundToggle").blur();}
  $("soundToggle").addEventListener("click",toggleSound);sound.setMuted(read("nulovy-bod-muted","false")==="true");updateSoundButton();
  for(let i=0;i<MAG;i++)$("ammo").append(document.createElement("i"));
  resize();hud(true);requestAnimationFrame(frame);
})();
