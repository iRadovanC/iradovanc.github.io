/* Ještě jeden meeting — vanilla JavaScript. Engine also runs in Node for tests. */
const OfficeSim = (() => {
  'use strict';
  const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
  // Change this one value when the team moves on to the next application.
  const CURRENT_APP = 'ZPR';
  const ZBYSEK_LINES = [
    'Už to máš hotový?',
    'Budeš dneska i programovat nebo jen mlít pantem.',
    `Tak co, ${CURRENT_APP} už běží?`,
    'Máro, tohle mělo být na pět minut.',
    'Cabi se ptal, jestli by mohl vidět to skoro.',
    'Kdyby ses zasekl, zkus víc panikařit.',
    'Dlouho jsi nenadával na Webexu, není ti nic?.',
  ];
  const ROOMS = {
    code: { name: 'Tvoje kancelář', icon: 'code', key: '1', marker: [315, 298], node: 'desk', description: 'Dva monitory, sedm kontextů a jeden skutečný úkol.', actions: ['code', 'refactor'] },
    meeting: { name: 'Zasedačka', icon: 'meeting', key: '2', marker: [590, 125], node: 'meeting', description: 'Místnost, kde se minuty zapisují a hodiny ztrácejí.', actions: ['meeting'] },
    director: { name: 'Ředitelna', icon: 'briefcase', key: '3', marker: [1010, 116], node: 'director', description: 'Peterova kancelář. Tady je každá změna jen „jedna malá drobnost“.', actions: ['meeting', 'report'] },
    team: { name: 'Kolegové', icon: 'team', key: '4', marker: [1259, 347], node: 'team', description: 'Rubber duck debugging. Kachna má dnes home office.', actions: ['pair'] },
    kitchen: { name: 'Kuchyňka', icon: 'coffee', key: '5', marker: [440, 534], node: 'kitchen', description: 'Jediný microservice, který dnes spolehlivě funguje.', actions: ['coffee', 'water', 'snack'] },
    wc: { name: 'WC', icon: 'toilet', key: '6', marker: [183, 526], node: 'wc', description: 'Jediné místo, kde má flush jasný výsledek.', actions: ['wc'] },
    qa: { name: 'QA testbed', icon: 'bug', key: '7', marker: [1135, 595], node: 'qa', description: '„U mě to funguje“ tu není akceptační kritérium.', actions: ['test', 'deploy'] },
    rest: { name: 'Chvilka klidu', icon: 'sofa', key: '8', marker: [631, 398], node: 'rest', description: 'Pohovka. Jediný opravdu stabilní stav v aplikaci.', actions: ['rest'] },
  };
  // Hand-authored navigation follows the open floor and doorways in office.png.
  const NODES = {
    desk: [340, 440], deskExit: [441, 453], officeDoor: [510, 464], westHall: [570, 495],
    middle: [714, 480], north: [787, 365], northDoor: [810, 291], meetingDoor: [773, 270], meeting: [705, 286],
    directorDoor: [867, 298], director: [959, 307], teamDoor: [978, 448], teamEntry: [1050, 508], team: [1156, 567],
    rest: [672, 495], westSouth: [704, 606], south: [715, 701], eastSouth: [856, 727],
    qaDoor: [883, 605], qaEntry: [925, 643], qa: [1092, 730],
    kitchenDoor: [654, 648], kitchen: [551, 650], kitchenSouth: [507, 742], kitchenWest: [359, 678], bathroomDoor: [271, 632], wc: [216, 604],
  };
  const EDGES = [['desk','deskExit'],['deskExit','officeDoor'],['officeDoor','westHall'],['westHall','middle'],['middle','north'],['north','northDoor'],['northDoor','meetingDoor'],['meetingDoor','meeting'],['northDoor','directorDoor'],['directorDoor','director'],['north','teamDoor'],['teamDoor','teamEntry'],['teamEntry','team'],['middle','rest'],['middle','westSouth'],['westSouth','south'],['south','eastSouth'],['eastSouth','qaDoor'],['qaDoor','qaEntry'],['qaEntry','qa'],['south','kitchenDoor'],['kitchenDoor','kitchen'],['kitchen','kitchenSouth'],['kitchenSouth','kitchenWest'],['kitchenWest','bathroomDoor'],['bathroomDoor','wc']];
  const ACTIONS = {
    code: { title:'Psát kód', icon:'code', duration:16, hint:'+24 % kódu · +3 bugy · −9 energie', busy:'Píšeš kód. Zatím bez Stack Overflow.', quote:'Tohle bude na pět minut.', effect:g=>{g.code+=g.energy<25?16:24;g.bugs+=3;g.energy-=9;g.water-=3;g.stress+=7;g.log('Další kus kódu. A tři nové příležitosti pro QA.');} },
    refactor: { title:'Refaktorovat', icon:'code', duration:12, hint:'+10 % kódu · −2 bugy · −7 energie', busy:'Přejmenováváš final_final na final_v2.', quote:'Teď je to architektonicky krásné.', effect:g=>{g.code+=10;g.bugs-=2;g.energy-=7;g.stress-=4;g.log('Refaktor hotový. Proměnné se konečně nestydí za jména.');} },
    coffee: { title:'Dvojité espresso', icon:'coffee', duration:4, hint:'+34 energie · +26 močák · +6 stres', busy:'Probíhá aktualizace kofeinu…', quote:'Java. Konečně ta dobrá.', effect:g=>{g.energy+=34;g.bladder+=26;g.stress+=6;g.coffees++;g.log('Espresso nainstalováno. Močák požaduje restart.');} },
    water: { title:'Sklenice vody', icon:'water', duration:3, hint:'+48 hydratace · +18 močák', busy:'Hydratuješ biologický hardware.', quote:'HTTP 200: voda teče.', effect:g=>{g.water+=48;g.bladder+=18;g.log('Hydratace doplněna. Kytka ti závidí.');} },
    snack: { title:'Tajná sušenka co tu zapomněl Libor', icon:'snack', duration:5, hint:'+18 energie · −7 stres · −5 hydratace', busy:'Vyjednáváš s poslední sušenkou.', quote:'To není oběd. To je workaround. Proč vidím 12 prstů', effect:g=>{g.energy+=18;g.stress-=7;g.water-=5;g.log('Sušenka snědena. Incident se neeskaluje.');} },
    wc: { title:'Provést flush()', icon:'toilet', duration:5, hint:'Vyprázdní močák · −10 stres', busy:'Uvolňuješ operační paměť.', quote:'Garbage collection v praxi.', effect:g=>{g.bladder=0;g.stress-=10;g.log('flush() úspěšný. Žádný memory leak.');} },
    rest: { title:'Osm sekund bez urážení se na Webexu', icon:'sofa', duration:8, hint:'−30 stres · +12 energie', busy:'Díváš se do prázdna. Profesionálně.', quote:'Momentálně jsem v režimu zen.', effect:g=>{g.stress-=30;g.energy+=12;g.log('Duše obnovena ze zálohy.');} },
    pair: { title:'Poprosit kolegu o pomoc', icon:'team', duration:11, hint:'+14 % kódu · −2 bugy · −6 stres', busy:'Kolega se ptá, proč je všechno globální.', quote:'A zkoušel jsi to zapnout?', effect:g=>{g.code+=14;g.bugs-=2;g.stress-=6;g.energy-=4;g.log('Kolega našel chybu. Byl to tvůj komentář „TODO“.');} },
    test: { title:'Otestovat a opravit', icon:'bug', duration:10, hint:'−6 bugů · −5 energie · +4 stres', busy:'Testuješ i to, na co nikdo neklikne.', quote:'A když kliknu dvakrát?', effect:g=>{g.bugs-=6;g.energy-=5;g.stress+=4;g.log('QA odlovilo až šest bugů. Žádní nebyli zraněni.');} },
    report: { title:'Říct Peterovi „jsme skoro hotoví“', icon:'briefcase', duration:7, hint:'+12 důvěra · +8 stres · cooldown 60 herních minut', busy:'Překládáš technický dluh do optimismu.', quote:'Všechno jde podle roadmapy.', effect:g=>{g.reputation+=12;g.stress+=8;g.reportAfter=g.time+60;g.log('Peter je spokojený. S realitou se zatím nepotkal.');} },
    meeting: { title:'Připojit se k meetingu', icon:'meeting', duration:10, hint:'+9 důvěra · +12 stres · −5 energie', busy:'Říkáš „souhlasím“ ve správných intervalech.', quote:'Slyšíme se? Vidíte můj screen?', effect:(g,a)=>{const m=g.meetings.find(m=>m.id===a.meetingId);if(m){m.status='done';g.reputation+=9;g.stress+=12;g.energy-=5;g.attended++;g.log('Meeting skončil. Závěr: potřebujeme další meeting.');}} },
    deploy: { title:'Nasadit do produkce', icon:'rocket', duration:4, hint:'Vyžaduje 100 % kódu a nejvýš 2 bugy', busy:'Držíš palce. CI/CD a.k.a Miloš se Sazym dělá to ostatní.', quote:'Pátek je ideální den na deploy.', effect:g=>{if(g.code>=100&&g.bugs<=2){g.shipped=true;g.finish(true,'Release je venku. A ty taky.');}else{g.log('CI zastavilo nasazení: během buildu přibyly bugy.',true);g.notify('BUILD NEPROŠEL','Oprav nové bugy v QA a zkus nasazení znovu.');}} },
  };
  function shortestPath(start,end){
    const dist=Object.fromEntries(Object.keys(NODES).map(k=>[k,Infinity])),prev={},todo=new Set(Object.keys(NODES));dist[start]=0;
    while(todo.size){let u=[...todo].reduce((a,b)=>dist[a]<dist[b]?a:b);todo.delete(u);if(u===end)break;
      for(const [a,b] of EDGES){const v=a===u?b:b===u?a:null;if(!v||!todo.has(v))continue;const d=dist[u]+Math.hypot(NODES[u][0]-NODES[v][0],NODES[u][1]-NODES[v][1]);if(d<dist[v]){dist[v]=d;prev[v]=u;}}
    }
    const path=[end];while(path[0]!==start){if(!prev[path[0]])return [];path.unshift(prev[path[0]]);}return path;
  }
  class Game {
    constructor(random=Math.random){
      this.random=random;this.time=540;this.energy=86;this.water=74;this.bladder=24;this.stress=18;this.reputation=80;this.code=0;this.bugs=6;
      this.started=false;this.paused=false;this.result=null;this.shipped=false;this.coffees=0;this.attended=0;this.incidents=0;this.reportAfter=0;this.skipTimedActions=true;
      this.room='code';this.actor={x:340,y:440,node:'desk',facing:1};this.path=[];this.destination=null;this.action=null;this.lastEvent=540;this.eventIndex=0;this.notices=[];this.logs=[];this.speech='';this.speechUntil=0;this.revision=0;this.arrival=0;
      this.zbysek={x:NODES.team[0],y:NODES.team[1],node:'team',room:'team',path:[],destination:null,facing:-1,nextMove:552,speech:ZBYSEK_LINES[0],speechUntil:554,lineIndex:1};
      this.meetings=[{id:'standup',time:600,title:'Rychlý stand-up',room:'meeting',note:'Zasedačka · „jen na chvilku“',status:'pending'},{id:'sync',time:780,title:'Strategický sync',room:'director',note:'Ředitelna · buzzword bingo',status:'pending'},{id:'retro',time:930,title:'Retro před releasem',room:'meeting',note:'Zasedačka · čí je to chyba?',status:'pending'}];
      this.log('Nový pátek. Nová šance nic nerozbít.');
    }
    log(message,bad=false){this.logs.unshift({time:this.time,message,bad});this.logs=this.logs.slice(0,3);this.revision++;}
    say(message){this.speech=message;this.speechUntil=this.time+10;}
    notify(title,message){this.notices.push({title,message,time:this.time});this.revision++;}
    activeMeeting(room){return this.meetings.find(m=>m.room===room&&m.status==='pending'&&this.time>=m.time-18&&this.time<=m.time+36);}
    canDo(id){
      if(!ACTIONS[id]||!ROOMS[this.room].actions.includes(id)||this.path.length||this.action||this.result)return false;
      if(id==='meeting')return Boolean(this.activeMeeting(this.room));
      if(id==='deploy')return this.code>=100&&this.bugs<=2;
      if(id==='report')return this.time>=this.reportAfter;
      if(id==='code'||id==='refactor')return this.code<100 || (id==='refactor'&&this.bugs>0);
      if(id==='test')return this.bugs>0;
      return true;
    }
    startAction(id){
      if(!this.canDo(id))return false;
      this.started=true;const m=id==='meeting'?this.activeMeeting(this.room):null;if(m)m.status='running';
      this.action={id,elapsed:0,duration:ACTIONS[id].duration,meetingId:m?.id};this.say(ACTIONS[id].quote);this.revision++;return true;
    }
    chooseAction(id){
      if(!this.startAction(id))return {started:false,timeJump:0};
      const before=this.time;if(this.skipTimedActions)this.completeAction();
      return {started:true,timeJump:this.time-before};
    }
    completeAction(){
      if(!this.action||this.result)return 0;
      const before=this.time;let guard=1000;
      while(this.action&&!this.result&&guard-->0)this.update(Math.min(.1,this.action.duration-this.action.elapsed));
      return this.time-before;
    }
    cancel(){if(this.action?.meetingId){const m=this.meetings.find(m=>m.id===this.action.meetingId);if(m)m.status='pending';}if(this.action)this.log('Činnost přerušena. Kontext přepnut. Zase.');this.action=null;this.revision++;}
    go(room){
      if(!ROOMS[room]||this.result)return false;
      this.cancel();this.started=true;this.destination=room;const target=ROOMS[room].node;
      // Finish the current corridor segment before replanning, so reroutes never cut through walls.
      const anchor=this.path.length?this.path[0]:this.actor.node;
      const route=shortestPath(anchor,target);this.path=this.path.length?[anchor,...route.slice(1)]:route.slice(1);
      if(!this.path.length){this.room=room;this.destination=null;this.arrival++;}this.revision++;return true;
    }
    normalize(){for(const k of ['energy','water','bladder','stress','reputation','code'])this[k]=clamp(this[k]);this.bugs=Math.max(0,this.bugs);}
    updateZbysek(dt){
      const z=this.zbysek;
      if(!z.path.length&&this.time>=z.nextMove){
        const rooms=Object.keys(ROOMS).filter(id=>id!==z.room&&id!=='wc');
        const destination=rooms[Math.floor(this.random()*rooms.length)];z.destination=destination;
        z.path=shortestPath(z.node,ROOMS[destination].node).slice(1);z.nextMove=Infinity;
      }
      let remaining=dt*132;
      while(remaining>0&&z.path.length){const id=z.path[0],[x,y]=NODES[id],dx=x-z.x,dy=y-z.y,d=Math.hypot(dx,dy);if(Math.abs(dx)>1)z.facing=dx>0?1:-1;if(d<=remaining){z.x=x;z.y=y;z.node=id;z.path.shift();remaining-=d;}else{z.x+=dx/d*remaining;z.y+=dy/d*remaining;remaining=0;}}
      if(!z.path.length&&z.destination){z.room=z.destination;z.destination=null;z.nextMove=this.time+24+this.random()*22;z.speech=ZBYSEK_LINES[z.lineIndex++%ZBYSEK_LINES.length];z.speechUntil=this.time+14;this.revision++;}
    }
    update(dt){
      if(!this.started||this.paused||this.result||dt<=0)return;
      this.time+=dt*1.5;if(this.time>=1020){this.time=1020;this.finish(false,'Je 17:00. Release dostal nový termín.');return;}this.energy-=dt*.105;this.water-=dt*.17;this.bladder+=dt*.10;this.stress+=dt*.035;
      this.updateZbysek(dt);
      if(this.path.length){let remaining=dt*(this.bladder>85?144:180);while(remaining>0&&this.path.length){const id=this.path[0],[x,y]=NODES[id],dx=x-this.actor.x,dy=y-this.actor.y,d=Math.hypot(dx,dy);if(Math.abs(dx)>1)this.actor.facing=dx>0?1:-1;if(d<=remaining){this.actor.x=x;this.actor.y=y;this.actor.node=id;this.path.shift();remaining-=d;}else{this.actor.x+=dx/d*remaining;this.actor.y+=dy/d*remaining;remaining=0;}}
        if(!this.path.length){this.room=this.destination;this.destination=null;this.arrival++;this.revision++;}
      }else if(this.action){this.action.elapsed+=dt;if(this.action.elapsed>=this.action.duration){const done=this.action;this.action=null;ACTIONS[done.id].effect(this,done);this.normalize();this.revision++;}}
      if(this.result)return;
      for(const m of this.meetings){if(m.status==='pending'&&this.time>=m.time-18&&!m.announced){m.announced=true;this.notify('POZVÁNKA, KTERÁ NEPOČKÁ',`${m.title} · ${ROOMS[m.room].name}. Přijď nejpozději do ${formatTime(m.time+36)}.`);this.log(`Brzy: ${m.title}. „Bude to rychlé.“`);}if(m.status==='pending'&&this.time>m.time+36){m.status='missed';this.reputation-=16;this.stress+=9;this.log('Zmeškaný meeting. Tvoje židle měla dobré připomínky.',true);this.notify('MEETING BEZ TEBE','−16 důvěra. Aspoň ti nikdo nepřidělil zápis.');}}
      if(this.time-this.lastEvent>=75){this.lastEvent=this.time;this.randomEvent();}
      if(this.bladder>=100){this.bladder=15;this.stress+=22;this.reputation-=18;this.incidents++;this.cancel();this.notify('NEPLÁNOVANÝ MEMORY LEAK','−18 důvěra, +22 stres. Příště je WC opravdu priorita.');this.log('Kalhoty utrpěly nevratný merge conflict.',true);}
      this.normalize();
      if(this.energy<=0)this.finish(false,'Baterie vedoucího se vybila.');
      else if(this.water<=0)this.finish(false,'Tvůj hardware běží nasucho.');
      else if(this.stress>=100)this.finish(false,'Vyhořel jsi dřív než produkce.');
      else if(this.reputation<=0)this.finish(false,'Byl jsi povýšen na bývalého zaměstnance.');
      else if(this.time>=1020)this.finish(false,'Je 17:00. Release dostal nový termín.');
    }
    randomEvent(){
      const events=[
        ['WEBEX: @Cabi','„Máš minutku?“ Ztrácíš jen nervy. +5 stres.',()=>{this.stress+=5;}],
        ['NAŠEL SE BUG','QA zadalo do jména emoji. +2 bugy.',()=>{this.bugs+=2;}],
        ['MALÉ VÍTĚZSTVÍ','Kolega vyřešil tvoje TODO. +6 % kódu.',()=>{this.code+=6;}],
        ['POZDRAV Z LIPNÍKA','„Spadlo to, když jsme to upustili!“ -6 důvěra, +5 stres.',()=>{this.reputation-=6;this.stress+=5;}],
        ['POŽADAVEK NA POSLEDNÍ CHVÍLI','„A umělo by to i AI?“ +6 stres.',()=>{this.stress+=6;}],
      ];
      const event=events[(this.eventIndex+Math.floor(this.random()*2))%events.length];this.eventIndex++;event[2]();this.notify(event[0],event[1]);this.log(event[1]);
    }
    finish(won,reason){if(this.result)return;this.normalize();this.result={won,reason,score:Math.max(0,Math.round((won?1000:0)+this.code*3+this.reputation*4+this.attended*90+Math.max(0,1020-this.time)*2-this.bugs*15-this.incidents*100))};this.action=null;this.path=[];this.revision++;}
  }
  const formatTime=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
  return {Game,ROOMS,ACTIONS,NODES,EDGES,CURRENT_APP,ZBYSEK_LINES,shortestPath,formatTime,clamp};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=OfficeSim;

if(typeof document!=='undefined')(() => {
  'use strict';
  const {Game,ROOMS,ACTIONS,formatTime}=OfficeSim;
  const $=id=>document.getElementById(id);
  const paths={
    energy:'m13 2-8 12h6l-1 8 9-12h-6l1-8Z',
    water:'M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13ZM8 15c0 2 1 3 3 3',
    toilet:'M6 3h10v7H6zM6 10h13v3a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-1h16M9 19v3h6v-3M9 6h3',
    stress:'M8 3 5 7l4 3-4 4 3 4M15 3l4 4-4 3 4 4-3 4M12 19v3',
    code:'m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18',
    coffee:'M4 8h12v8a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Zm12 1h2a3 3 0 0 1 0 6h-2M7 2v3m4-3v3M2 22h17',
    meeting:'M3 14h18v5H3zM6 19v3m12-3v3M9 5a3 3 0 1 0 6 0 3 3 0 1 0-6 0M6 12c0-4 12-4 12 0',
    briefcase:'M3 7h18v14H3zM8 7V3h8v4M3 12c6 3 12 3 18 0m-11 2v3h4v-3',
    team:'M6 7a3 3 0 1 0 6 0 3 3 0 1 0-6 0M3 21v-4c0-5 12-5 12 0v4M16 4a3 3 0 0 1 0 6m2 4c4 0 4 4 4 7',
    bug:'M8 10h8v7a4 4 0 0 1-8 0v-7ZM9 10V7a3 3 0 0 1 6 0v3M9 4 7 2m8 2 2-2M4 11l4 2m8 0 4-2M3 17h5m8 0h5M5 23l4-3m6 0 4 3m-7-13v11',
    sofa:'M4 12V8c0-4 16-4 16 0v4M3 11c-2 0-2 5 0 5v4h18v-4c2 0 2-5 0-5s-3 1-3 5H6c0-4-1-5-3-5Zm2 9v2m14-2v2',
    calendar:'M3 5h18v17H3zM3 10h18M7 2v6m10-6v6M7 14h3m4 0h3m-10 4h3',
    star:'m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z',
    rocket:'M9 15c-3-9 4-13 13-13 0 9-4 16-13 13ZM9 8H5l-3 6 6-1m8 2v4l-6 3 1-6M6 17l-4 5m12-16a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
    snack:'M21 10a6 6 0 0 1-7-7C6-1-1 8 3 16s16 8 19 0a7 7 0 0 1-1-6ZM7 8h.01M8 15h.01M14 17h.01M13 11h.01',
  };
  function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.code}"/></svg>`;}
  document.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));
  let game=new Game(),seenRevision=-1,seenArrival=0,openOnArrival=false,zoom=1,sound=false,audioCtx=null,last=0,lastHud=0,shownResult=false,speechLast='',zbysekSpeechLast='',toastUntil=0,timeJumpTimer=null;
  const canvas=$('world'),ctx=canvas.getContext('2d'),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const maraFace=new Image();maraFace.decoding='async';maraFace.src='assets/mara-face.png';
  const markers=$('room-markers');
  for(const [id,room] of Object.entries(ROOMS)){const b=document.createElement('button');b.className='room-marker';b.dataset.room=id;b.style.left=`${room.marker[0]/1536*100}%`;b.style.top=`${room.marker[1]/1024*100}%`;b.innerHTML=`${icon(room.icon)}<span class="name">${room.name}</span><span class="key">${room.key}</span>`;b.title=`${room.key} · ${room.name}`;b.setAttribute('aria-label',`Jít: ${room.name}`);b.addEventListener('click',()=>travel(id));markers.append(b);}
  function beep(freq=440,duration=.08){if(!sound)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(.035,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration);}catch{/* Audio is optional. */}}
  function showTimeJump(minutes){
    if(minutes<.5)return;const card=$('shift-card'),badge=$('time-jump-badge');clearTimeout(timeJumpTimer);
    badge.textContent=`+${Math.max(1,Math.round(minutes))} MIN`;badge.hidden=false;card.classList.remove('time-jump');void card.offsetWidth;card.classList.add('time-jump');
    timeJumpTimer=setTimeout(()=>{card.classList.remove('time-jump');badge.hidden=true;},1250);beep(920,.16);
  }
  function travel(id){if(game.result)return;if(!game.started){game.started=true;game.paused=false;}openOnArrival=true;game.go(id);beep(550);updateHud();}
  function dialogOpen(){return Boolean(document.querySelector('dialog[open]'));}
  function showRoom(){if(game.result||game.path.length||game.action)return;const room=ROOMS[game.room];$('room-title').textContent=room.name;$('room-description').textContent=room.description;$('room-kicker').textContent='CO TADY PROVEDEŠ?';const holder=$('room-actions');holder.replaceChildren();
    for(const id of room.actions){const a=ACTIONS[id];const b=document.createElement('button');b.className='room-action';b.disabled=!game.canDo(id);let hint=a.hint;if(id==='meeting'&&!game.activeMeeting(game.room)){const next=game.meetings.find(m=>m.room===game.room&&m.status==='pending');hint=next?`Další meeting v ${formatTime(next.time)} · vstup od ${formatTime(next.time-18)}`:'Dnes už žádný meeting. Malé vítězství.';}if(id==='report'&&game.time<game.reportAfter)hint=`Ředitel potřebuje klid do ${formatTime(game.reportAfter)}.`;
      b.innerHTML=`<i>${icon(a.icon)}</i><span><strong>${a.title}</strong><small>${hint}</small></span><span class="duration">${game.skipTimedActions?`+${Math.round(a.duration*1.5)} min`:`${a.duration} s`}</span>`;
      b.addEventListener('click',()=>{const result=game.chooseAction(id);if(result.started){$('room-dialog').close();if(result.timeJump)showTimeJump(result.timeJump);else beep(700);updateHud();}});holder.append(b);
    }$('room-hint').textContent=game.skipTimedActions?'Činnost posune herní hodiny. Aspoň něco dnes poběží rychle.':'Činnost proběhne v reálném čase a můžeš ji přerušit.';$('room-dialog').showModal();
  }
  function updateHud(){
    for(const k of ['energy','water','bladder','stress']){const value=Math.round(game[k]);$(k+'-value').innerHTML=`${value}<span>%</span>`;$(k+'-bar').style.width=`${value}%`;document.querySelector(`[data-stat="${k}"]`).classList.toggle('critical',(k==='energy'||k==='water')?value<=25:value>=80);}
    $('energy-note').textContent=game.energy<25?'Nouzový režim. Dej si kávu!':'Ještě věříš v čistý kód.';
    $('water-note').textContent=game.water<25?'Vodu. Teď. Ne po commitu.':'Káva není vodní režim.';
    $('bladder-note').textContent=game.bladder>80?'Kritický buffer. Směr WC!':'Zatím žádný incident.';
    $('stress-note').textContent=game.stress>80?'Pohovka je teď priorita.':'Produkce podezřele mlčí.';
    $('game-clock').innerHTML=formatTime(Math.min(game.time,1020)).replace(':','<span>:</span>');$('day-progress').style.width=`${Math.min(100,(game.time-540)/480*100)}%`;
    $('state-badge').textContent=game.result?'PO SMĚNĚ':!game.started?'PŘIPRAVEN?':game.paused||dialogOpen()?'PAUZA':'V PRACOVNÍM PROCESU';
    $('pause-button').textContent=!game.started||game.paused?'▶':'Ⅱ';$('pause-button').setAttribute('aria-label',game.paused||!game.started?'Spustit směnu':'Pozastavit směnu');$('pause-button').title=$('pause-button').getAttribute('aria-label');
    $('reputation-value').innerHTML=`${Math.round(game.reputation)} <span>/ 100</span>`;$('code-value').innerHTML=`${Math.round(game.code)} <span>/ 100 %</span>`;$('code-bar').style.width=`${game.code}%`;$('bug-count').textContent=game.bugs;
    $('mission-tip').innerHTML=game.code>=100?(game.bugs<=2?'<strong>Release čeká! V QA klikni na Nasadit.</strong><br>Odvaha je také strategie.':'Kód hotový! Teď odlov bugy v QA.<br>Produkce snese nejvýš dva.'):'Napiš kód → otestuj v QA → nasaď.<br>Co by se mohlo pokazit?';
    const room=ROOMS[game.destination||game.room];$('location-icon').innerHTML=icon(room.icon);$('location-label').textContent=game.destination?`Na cestě · ${room.name}`:room.name;
    $('action-label').textContent=game.result?'Směna skončila.':game.action?ACTIONS[game.action.id].busy:game.path.length?'Přepínáš kontext. Tentokrát pěšky.':!game.started?'Páteční release na tebe čeká.':'Vyber si další činnost. Pátek nepočká.';
    $('context-button').innerHTML=game.result?'Hrát znovu ↻':!game.started?'Začít směnu <span>↗</span>':game.action?`${Math.max(0,Math.ceil(game.action.duration-game.action.elapsed))} s <span>◷</span>`:game.path.length?'Na cestě <span>↗</span>':'Vybrat činnost <span>↗</span>';
    $('context-button').disabled=Boolean(game.path.length||game.action);$('action-track').hidden=!game.action;$('cancel-button').hidden=!game.action;
    if(game.action)$('action-progress').style.width=`${game.action.elapsed/game.action.duration*100}%`;
    for(const b of markers.children){b.classList.toggle('selected',b.dataset.room===(game.destination||game.room));b.classList.toggle('due',Boolean(game.activeMeeting(b.dataset.room)));}
    $('agenda').innerHTML=game.meetings.map(m=>`<div class="agenda-item ${m.status==='done'?'done':m.status==='missed'?'missed':game.activeMeeting(m.room)?.id===m.id||m.status==='running'?'active':''}"><span class="agenda-time">${formatTime(m.time)}</span><span class="agenda-dot"></span><div class="agenda-content"><strong>${m.title}</strong><small>${m.status==='done'?'✓ Odsezeno. Jsi hrdina.':m.status==='missed'?'× Tvoje židle tě zastoupila.':m.note}</small></div></div>`).join('');
    if(seenRevision!==game.revision){$('activity-log').innerHTML=game.logs.map(l=>`<div class="activity-item${l.bad?' bad':''}"><time>${formatTime(l.time)}</time><span>${l.message}</span></div>`).join('');seenRevision=game.revision;}
    if(game.notices.length){const notice=game.notices.shift();$('event-toast').innerHTML=`<strong>${notice.title}</strong>${notice.message}`;$('event-toast').hidden=false;toastUntil=performance.now()+7000;beep(380,.12);}
    if(game.result&&!shownResult)showResult();
  }
  function showResult(){shownResult=true;for(const d of document.querySelectorAll('dialog[open]'))d.close();const r=game.result;$('result-symbol').textContent=r.won?'✓':'…';$('result-eyebrow').textContent=r.won?'PÁTEK ÚSPĚŠNĚ NASAZEN':'POST-MORTEM BEZ OBVIŇOVÁNÍ';$('result-title').textContent=r.reason;
    $('result-description').textContent=r.won?'Produkce žije. Tým tě má rád. V pondělí se ukáže, jestli oprávněně. Teď zavři notebook.':'I tohle je zkušenost do životopisu. Příště střídej práci s vodou, kávou, WC a pohovkou. A QA není volitelný doplněk.';
    $('result-stats').innerHTML=`<div class="result-stat"><strong>${r.score}</strong><small>bodů za přežití</small></div><div class="result-stat"><strong>${game.attended}/3</strong><small>odsezených porad</small></div><div class="result-stat"><strong>${game.coffees}</strong><small>kávových závislostí</small></div>`;
    let best=r.score;try{const saved=Number(localStorage.getItem('almost-done-best'));best=Math.max(Number.isFinite(saved)?saved:0,r.score);localStorage.setItem('almost-done-best',String(best));}catch{/* file:// or privacy settings may forbid storage. */}
    $('best-score').textContent=`Tvůj nejlepší pátek: ${best} bodů · ${formatTime(Math.min(game.time,1020))}`;$('result-dialog').showModal();beep(r.won?880:220,.3);
  }
  function reset(){for(const d of document.querySelectorAll('dialog[open]'))d.close();game=new Game();game.skipTimedActions=$('time-skip-option').checked;seenRevision=-1;seenArrival=0;shownResult=false;openOnArrival=false;$('speech').hidden=true;$('zbysek-speech').hidden=true;$('event-toast').hidden=true;game.started=true;updateHud();}
  function pause(){if(game.result||dialogOpen())return;if(!game.started)game.started=true;else game.paused=!game.paused;updateHud();beep(440);}
  function focusMode(value){document.body.classList.toggle('focus-mode',value);$('focus-button').setAttribute('aria-pressed',String(value));$('focus-button').querySelector('span').textContent=value?'Celá stránka':'Herní režim';if(value)window.scrollTo(0,0);}
  $('focus-button').addEventListener('click',()=>focusMode(!document.body.classList.contains('focus-mode')));
  $('time-skip-option').addEventListener('change',e=>{game.skipTimedActions=e.target.checked;});
  $('start-button').addEventListener('click',()=>{$('welcome-dialog').close();game.skipTimedActions=$('time-skip-option').checked;game.started=true;game.paused=false;focusMode(true);updateHud();beep(660);});
  $('help-button').addEventListener('click',()=>{$('start-button').innerHTML=game.started?'Zpátky do kanceláře <span>→</span>':'Jdu zachránit pátek <span>→</span>';$('welcome-dialog').showModal();});
  $('pause-button').addEventListener('click',pause);$('context-button').addEventListener('click',()=>{if(game.result){reset();return;}if(!game.started){$('welcome-dialog').showModal();return;}showRoom();});
  $('cancel-button').addEventListener('click',()=>{game.cancel();updateHud();});$('restart-button').addEventListener('click',reset);
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{$(b.dataset.close).close();updateHud();}));
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>updateHud()));
  $('sound-button').addEventListener('click',()=>{sound=!sound;$('sound-button').querySelector('span').hidden=sound;$('sound-button').setAttribute('aria-label',sound?'Vypnout zvuk':'Zapnout zvuk');$('sound-button').title=sound?'Vypnout zvuk':'Zapnout zvuk';beep(660,.13);});
  function setZoom(n){zoom=Math.max(.85,Math.min(1.3,n));$('scene').style.transform=`scale(${zoom})`;$('zoom-value').textContent=`${Math.round(zoom*100)}%`;}
  $('zoom-in').addEventListener('click',()=>setZoom(zoom+.1));$('zoom-out').addEventListener('click',()=>setZoom(zoom-.1));$('labels-button').addEventListener('click',()=>{const hidden=markers.classList.toggle('labels-hidden');$('labels-button').setAttribute('aria-pressed',String(!hidden));});
  canvas.addEventListener('click',e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*1536,y=(e.clientY-r.top)/r.height*1024;let found=null,d=Infinity;for(const [id,room] of Object.entries(ROOMS)){const p=OfficeSim.NODES[room.node],n=Math.hypot(p[0]-x,(p[1]-y)*1.2);if(n<d){found=id;d=n;}}if(d<235)travel(found);});
  window.addEventListener('keydown',e=>{if(dialogOpen()||e.repeat||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();pause();return;}if(e.key.toLowerCase()==='e'){e.preventDefault();if(!game.started){$('welcome-dialog').showModal();return;}showRoom();}const room=Object.keys(ROOMS).find(k=>ROOMS[k].key===e.key);if(room){e.preventDefault();travel(room);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.started&&!game.result){game.paused=true;updateHud();}});
  window.addEventListener('blur',()=>{if(game.started&&!game.result){game.paused=true;updateHud();}});
  const roundRect=(x,y,w,h,r,fill)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();};
  function drawPerson(x,y,shirt,scale=1,walk=0,facing=1,lead=false){
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle='#283e332c';ctx.beginPath();ctx.ellipse(1,2,17,7,0,0,Math.PI*2);ctx.fill();
    const step=Math.sin(walk)*5,bob=walk?Math.abs(Math.sin(walk))*2:0;ctx.translate(0,-bob);
    ctx.strokeStyle='#3c4b4e';ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-5,-20);ctx.lineTo(-6+step,-3);ctx.moveTo(6,-20);ctx.lineTo(7-step,-3);ctx.stroke();roundRect(-11+step,-4,10,5,2,'#faf3de');roundRect(3-step,-4,10,5,2,'#faf3de');
    ctx.fillStyle=shirt;ctx.beginPath();ctx.moveTo(-11,-43);ctx.quadraticCurveTo(0,-48,11,-43);ctx.lineTo(12,-22);ctx.quadraticCurveTo(0,-17,-12,-22);ctx.closePath();ctx.fill();
    ctx.strokeStyle=shirt;ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-10,-40);ctx.lineTo(-15-step*.6,-28);ctx.moveTo(10,-40);ctx.lineTo(15+step*.6,-28);ctx.stroke();ctx.fillStyle='#eac1a0';for(const dx of [-15-step*.6,15+step*.6]){ctx.beginPath();ctx.arc(dx,-25,3.2,0,Math.PI*2);ctx.fill();}
    roundRect(-3,-49,7,8,2,'#dab28d');
    if(lead&&maraFace.complete&&maraFace.naturalWidth)ctx.drawImage(maraFace,-30,-96,60,60);
    else{ctx.fillStyle='#eac19d';ctx.beginPath();ctx.ellipse(facing*1.5,-56,10,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#51473d';ctx.beginPath();ctx.ellipse(-1,-62,11,8,-.15,Math.PI,Math.PI*2);ctx.lineTo(10,-56);ctx.lineTo(7,-62);ctx.lineTo(-4,-62);ctx.lineTo(-9,-53);ctx.closePath();ctx.fill();ctx.strokeStyle='#3d4941';ctx.lineWidth=1.6;ctx.beginPath();ctx.roundRect(-7+facing*2,-58,6,5,1);ctx.roundRect(1+facing*2,-58,6,5,1);ctx.moveTo(-1+facing*2,-56);ctx.lineTo(1+facing*2,-56);ctx.stroke();}
    if(lead){ctx.fillStyle='#ecd9bb';ctx.fillRect(-1,-41,2,15);roundRect(-4,-31,7,8,1,'#f5efd8');ctx.fillStyle='#6e8d6a';ctx.fillRect(-2,-29,3,2);}
    ctx.restore();
  }
  function drawNameTag(x,y,name,accent='#526a56'){
    ctx.save();ctx.font='600 14px system-ui, sans-serif';const width=ctx.measureText(name).width+16;roundRect(x-width/2,y-91,width,24,6,'#fffdf0e8');ctx.fillStyle=accent;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,x,y-79);ctx.restore();
  }
  function draw(t){
    ctx.clearRect(0,0,1536,1024);
    if(game.path.length){ctx.save();ctx.beginPath();ctx.moveTo(game.actor.x,game.actor.y);for(const n of game.path)ctx.lineTo(...OfficeSim.NODES[n]);ctx.strokeStyle='#677f6780';ctx.lineWidth=3;ctx.setLineDash([4,10]);ctx.stroke();ctx.restore();const end=OfficeSim.NODES[game.path.at(-1)];ctx.strokeStyle='#c16c478c';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(end[0],end[1],18,9,0,0,Math.PI*2);ctx.stroke();}
    const pulse=reducedMotion?0:Math.sin(t*.002)*.08;
    const z=game.zbysek,npcs=[{x:1175,y:488,c:'#839e9e',s:.74},{x:1350,y:533,c:'#a39783',s:.74},{x:1005,y:211,c:'#817f93',s:.72,label:'Peter'},{x:z.x,y:z.y,c:'#5e7f91',s:.82,facing:z.facing,zbysek:true,label:'Zbyšek'}];
    const actors=[...npcs.map(n=>({...n,lead:false})),{x:game.actor.x,y:game.actor.y,c:'#ce714c',s:.96,lead:true}].sort((a,b)=>a.y-b.y);
    for(const a of actors){drawPerson(a.x,a.y,a.c,a.s,a.zbysek&&z.path.length&&!game.paused&&!dialogOpen()?t*.012:0,a.lead?game.actor.facing:a.facing??-1,a.lead);if(a.label)drawNameTag(a.x+(a.label==='Peter'?46:0),a.y+(a.label==='Peter'?34:0),a.label,a.zbysek?'#496b79':'#665f7d');}
    const {x,y}=game.actor;ctx.strokeStyle='#d28655';ctx.lineWidth=2.4;ctx.beginPath();ctx.ellipse(x,y+3,22+pulse*10,10+pulse*4,0,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#ce6947';ctx.beginPath();ctx.moveTo(x-6,y-109);ctx.lineTo(x+6,y-109);ctx.lineTo(x,y-101);ctx.fill();
    if(game.action){const progress=game.action.elapsed/game.action.duration;ctx.fillStyle='#faf7e9';ctx.beginPath();ctx.arc(x+22,y-62,11,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d9e2cd';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x+22,y-62,8,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#6f8b60';ctx.beginPath();ctx.arc(x+22,y-62,8,-Math.PI/2,progress*Math.PI*2-Math.PI/2);ctx.stroke();}
    const speech=$('speech');if(game.speech&&game.time<game.speechUntil){if(speechLast!==game.speech){speech.textContent=game.speech;speechLast=game.speech;}speech.hidden=false;speech.style.left=`${x/1536*100}%`;speech.style.top=`${(y-91)/1024*100}%`;}else speech.hidden=true;
    const zSpeech=$('zbysek-speech');if(z.speech&&game.time<z.speechUntil){if(zbysekSpeechLast!==z.speech){zSpeech.querySelector('span').textContent=z.speech;zbysekSpeechLast=z.speech;}zSpeech.hidden=false;zSpeech.style.left=`${z.x/1536*100}%`;zSpeech.style.top=`${(z.y-96)/1024*100}%`;}else zSpeech.hidden=true;
    if(performance.now()>toastUntil)$('event-toast').hidden=true;
  }
  function frame(t){const dt=last?Math.min((t-last)/1000,.1):0;last=t;if(!dialogOpen())game.update(dt);if(game.arrival!==seenArrival){seenArrival=game.arrival;if(openOnArrival){openOnArrival=false;showRoom();}}if(t-lastHud>120){updateHud();lastHud=t;}draw(t);requestAnimationFrame(frame);}
  updateHud();requestAnimationFrame(frame);
})();
