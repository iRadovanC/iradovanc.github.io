/* IRON FRONT — standalone Canvas 2D RTS. No libraries, network calls or build step. */
'use strict';
(() => {
const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const mini = $('minimap'), mc = mini.getContext('2d');
const WORLD = { w: 2400, h: 1600, cell: 40, cols: 60, rows: 40 };
const TEAM = { player: '#93b995', enemy: '#c86d5d' };
const DEF = {
  hq:       { name:'Velitelství', hp:2600, r:66, size:183, sprite:0, vision:360, power:50, use:0 },
  power:    { name:'Elektrárna', hp:1000, r:47, size:146, sprite:1, vision:230, cost:600, time:9, power:100, use:0, desc:'Dodá základně 100 energie. Při nedostatku energie je výroba pomalejší.' },
  refinery: { name:'Zpracovatelský závod', hp:1350, r:57, size:172, sprite:2, vision:250, cost:1200, time:14, use:30, desc:'Drtí, třídí a upravuje rudu z lomu. S každým novým zpracovatelským závodem přijede logistická Tatra 815-7.' },
  barracks: { name:'Kasárna', hp:1100, r:47, size:154, sprite:3, vision:250, cost:500, time:8, use:15, desc:'Umožní výcvik střelců a protitankové pěchoty.' },
  factory:  { name:'Vojenské depo', hp:1600, r:66, size:189, sprite:4, vision:270, cost:1000, time:14, use:45, desc:'Připravuje k nasazení tanky Leopard 2A8, průzkumná Iveca LMV a logistické Tatry 815-7.' },
  turret:   { name:'Obranná věž', hp:1000, r:33, size:117, sprite:5, vision:300, cost:700, time:10, use:25, range:240, damage:34, reload:1.1, desc:'Automaticky brání základnu. Dostřel 240 m, spotřeba 25 energie.' },
  radar:    { name:'Radar', hp:900, r:44, size:150, sprite:6, vision:680, cost:800, time:10, use:20, desc:'Odhalí široké okolí v okruhu 680 m. Výhled se při výpadku energie zkrátí.' },
  fortress: { name:'Nepřátelské velitelství', hp:3400, r:72, size:206, sprite:7, vision:350, use:0 },
  rifle:    { name:'Střelec BREN 2', hp:110, r:7, size:18, speed:61, range:145, damage:13, reload:.72, vision:250, cost:100, time:4, requires:'barracks', desc:'Český pěšák s útočnou puškou CZ BREN 2. Pohyblivá podpora proti pěchotě.' },
  rocket:   { name:'Carl-Gustaf', hp:95, r:8, size:19, speed:49, range:215, damage:43, reload:2.5, vision:250, cost:250, time:6, requires:'barracks', desc:'Pancéřovník AČR s bezzákluzovou zbraní Carl-Gustaf. Účinný proti obrněným cílům.' },
  tank:     { name:'Leopard 2A8', hp:520, r:17, size:42, speed:70, range:215, damage:57, reload:1.65, vision:290, cost:650, time:10, requires:'factory', desc:'Tank nové generace objednaný pro AČR. Těžký pancíř a 120mm kanón pro průlom obrany.' },
  scout:    { name:'Iveco LMV', hp:210, r:13, size:31, speed:115, range:155, damage:16, reload:.55, vision:420, cost:350, time:7, requires:'factory', desc:'Lehké obrněné vozidlo AČR. Rychlý průzkum a kulometná podpora pěchoty.' },
  harvester:{ name:'Tatra 815-7', hp:750, r:20, size:46, speed:56, range:0, damage:0, reload:0, vision:230, cost:700, time:11, requires:'factory', desc:'Logistická Tatra 6×6 automaticky odváží rudu z lomu do zpracovatelského závodu. Náklad zvýší bilanci o 280.' }
};
const BUILDINGS = ['power','barracks','refinery','factory','turret','radar'];
const UNITS = ['rifle','rocket','tank','scout','harvester'];
const terrain = new Image(), atlas = new Image(), vehicles = new Image(), quarry = new Image();
const VEHICLE_SPRITES = {tank:[[18,158,567,266],[18,598,568,260]],scout:[[590,150,359,264],[594,580,360,257]],harvester:[[990,153,528,267],[987,593,531,258]]};
let game, terrainCache, fogCanvas, fogCtx, viewW=1000, viewH=650, dpr=1, last=0, uiClock=0, fogClock=0;
let selected = [], currentTab='buildings', placement=null, attackMode=false, hover=null;
let pointer={x:0,y:0,inside:false}, drag=null, pan=null, miniDrag=false, keys=new Set(), groups={};
let camera={x:900,y:980,zoom:.75}, audioCtx=null, soundOn=false, previousModalPause=false;
let randomSeed=7843;
const rand = () => { randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0; return randomSeed/4294967296; };
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clockText=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
const moneyFormatter = new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:0});
const money = value => moneyFormatter.format(Math.floor(value));
const isBuilding=e=>!DEF[e.type].speed;
const alive=e=>e&&e.hp>0;
const friendlies=()=>game.entities.filter(e=>alive(e)&&e.team==='player');
const riverX=y=>1395+Math.sin(y/270)*105+Math.sin(y/140)*24;
const onBridge=y=>Math.abs(y-600)<57||Math.abs(y-1210)<57;
const waterAt=(x,y)=>Math.abs(x-riverX(y))<64&&!onBridge(y);
const inMap=(x,y)=>x>=24&&y>=24&&x<WORLD.w-24&&y<WORLD.h-24;
function entity(type,team,x,y) {
  const d=DEF[type];
  const e={id:game.nextId++,type,team,x,y,hp:d.hp,maxHp:d.hp,r:d.r,angle:team==='player'?-.25:2.6,turretAngle:0,cooldown:rand(),order:null,path:[],pathTimer:0,scan:rand()*.35,target:null,flash:0,load:0,harvestTimer:0,repair:false,stuck:0,lastX:x,lastY:y};
  game.entities.push(e); return e;
}
function reset() {
  randomSeed=7843;
  game={entities:[],nextId:1,time:0,credits:3200,kills:0,losses:0,gathered:0,paused:false,started:false,ended:false,speed:1,wave:0,nextWave:100,queue:[],effects:[],projectiles:[],tracks:[],explored:new Uint8Array(2400),visible:new Uint8Array(2400),energy:{supply:150,use:45},ore:[{x:905,y:1245,amount:14000,r:105},{x:790,y:540,amount:12000,r:95},{x:1740,y:1000,amount:14000,r:100}],messageCooldown:0,obstacles:[]};
  entity('hq','player',445,1010);entity('power','player',335,1190);entity('refinery','player',665,1200);entity('barracks','player',660,920);
  const tanks=[entity('tank','player',785,945),entity('tank','player',840,978),entity('tank','player',786,1015)];
  entity('rifle','player',724,1015);entity('rifle','player',742,1036);entity('rocket','player',723,1055);
  const harvester=entity('harvester','player',795,1180);harvester.order={kind:'harvest'};
  entity('fortress','enemy',2070,365);entity('factory','enemy',2130,650);entity('power','enemy',2240,480);entity('barracks','enemy',1925,475);
  entity('turret','enemy',1780,550);entity('turret','enemy',1920,790);
  entity('tank','enemy',1845,645);entity('tank','enemy',1740,745);entity('rifle','enemy',1710,570);entity('rifle','enemy',1805,670);entity('rocket','enemy',1950,685);
  entity('rifle','enemy',1530,1170);entity('tank','enemy',1610,1210);
  selected=tanks.map(e=>e.id);placement=null;attackMode=false;groups={};camera={x:445+Math.min(340,viewW*.23/.85),y:985,zoom:.85};
  selectionSignature='reset';queueSignature='reset';currentTab='buildings';$('queue').replaceChildren();$('unit-roster').replaceChildren();
  for(const b of document.querySelectorAll('[data-tab]')){const active=b.dataset.tab==='buildings';b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));}
  document.querySelector('.production-panel').scrollTop=0;$('build-description').textContent='Rozšiřte základnu a připravte se k útoku.';cancelMode();
  $('notifications').replaceChildren(); $('speed').textContent='1×'; $('game-status').textContent='OPERACE PROBÍHÁ';
  buildTerrain();updateEnergy();reveal();buildCards();updateUI();clampCamera();
}
function updateEnergy() { const units=friendlies();game.energy={supply:units.reduce((n,e)=>n+(DEF[e.type].power||0),0),use:units.reduce((n,e)=>n+(DEF[e.type].use||0),0)}; }
const powered=()=>game.energy.supply>=game.energy.use;
function validCell(cx,cy,ignoreId) {
  const x=cx*40+20,y=cy*40+20;
  if(cx<0||cy<0||cx>=60||cy>=40||waterAt(x,y))return false;
  return !game.entities.some(e=>alive(e)&&isBuilding(e)&&e.id!==ignoreId&&Math.abs(e.x-x)<e.r+8&&Math.abs(e.y-y)<e.r*.65+10);
}
function nearestCell(x,y,ignoreId) {
  let cx=clamp(Math.floor(x/40),0,59),cy=clamp(Math.floor(y/40),0,39);
  if(validCell(cx,cy,ignoreId)) return [cx,cy];
  for(let r=1;r<10;r++) {
    const options=[];
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(Math.abs(dx)===r||Math.abs(dy)===r) {
      if(validCell(cx+dx,cy+dy,ignoreId))options.push([cx+dx,cy+dy]);
    }
    if(options.length)return options.sort((a,b)=>Math.hypot(a[0]*40+20-x,a[1]*40+20-y)-Math.hypot(b[0]*40+20-x,b[1]*40+20-y))[0];
  }
  return null;
}
function pathfind(sx,sy,tx,ty) {
  const start=nearestCell(sx,sy),end=nearestCell(tx,ty);if(!start||!end)return [];
  const startI=start[1]*60+start[0],endI=end[1]*60+end[0];
  if(startI===endI)return [{x:validCell(Math.floor(tx/40),Math.floor(ty/40))?clamp(tx,25,2375):end[0]*40+20,y:validCell(Math.floor(tx/40),Math.floor(ty/40))?clamp(ty,25,1575):end[1]*40+20}];
  const g=new Float32Array(2400).fill(Infinity),parent=new Int16Array(2400).fill(-1),closed=new Uint8Array(2400),open=[startI];g[startI]=0;
  const heur=i=>Math.hypot(i%60-end[0],Math.floor(i/60)-end[1]);
  const walk=new Uint8Array(2400);for(let i=0;i<2400;i++)walk[i]=validCell(i%60,Math.floor(i/60))?1:0;walk[startI]=1;
  let found=false;
  while(open.length) {
    let bi=0,bf=Infinity;
    for(let i=0;i<open.length;i++){const f=g[open[i]]+heur(open[i]);if(f<bf){bf=f;bi=i}}
    const cur=open.splice(bi,1)[0];if(cur===endI){found=true;break}closed[cur]=1;
    const cx=cur%60,cy=Math.floor(cur/60);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
      if(!dx&&!dy)continue;const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=60||ny>=40)continue;
      const ni=ny*60+nx;if(!walk[ni]||closed[ni])continue;
      if(dx&&dy&&(!walk[cy*60+nx]||!walk[ny*60+cx]))continue;
      const ng=g[cur]+(dx&&dy?1.4142:1);if(ng<g[ni]){if(g[ni]===Infinity)open.push(ni);g[ni]=ng;parent[ni]=cur;}
    }
  }
  if(!found)return [];
  const result=[];let i=endI;
  while(i!==startI&&i!==-1){result.push({x:(i%60)*40+20,y:Math.floor(i/60)*40+20});i=parent[i]}
  result.reverse();
  if(result.length&&validCell(Math.floor(tx/40),Math.floor(ty/40)))result[result.length-1]={x:clamp(tx,25,2375),y:clamp(ty,25,1575)};
  return result;
}
function route(e,x,y) { e.path=pathfind(e.x,e.y,x,y);e.pathTimer=1.2; }
function move(e,dt) {
  if(!e.path.length)return;
  const p=e.path[0],dx=p.x-e.x,dy=p.y-e.y,l=Math.hypot(dx,dy),speed=DEF[e.type].speed;
  if(l<Math.max(4,speed*dt)){e.x=p.x;e.y=p.y;e.path.shift();return}
  const angle=Math.atan2(dy,dx);e.angle=turnAngle(e.angle,angle,dt*7);
  e.x+=dx/l*speed*dt;e.y+=dy/l*speed*dt;
  if(e.type==='tank'||e.type==='harvester'||e.type==='scout')if(rand()<dt*5){game.tracks.push({x:e.x,y:e.y,angle:e.angle,life:15});if(game.tracks.length>260)game.tracks.shift()}
}
function turnAngle(a,b,rate) { const d=Math.atan2(Math.sin(b-a),Math.cos(b-a));return a+d*Math.min(1,rate); }
// Vehicle atlas art is authored upright while facing right.  A 180° canvas
// rotation makes left-moving vehicles face left, but also turns their cab,
// markings, and lighting upside down.  Keep the art upright in the left half
// of the turn by reflecting it horizontally instead.
function orientVehicleSprite(c,angle) {
  if(Math.cos(angle)<0){
    c.rotate(angle>0?angle-Math.PI:angle+Math.PI);
    c.scale(-1,1);
  }else c.rotate(angle);
}
function canSee(e) { return e.team==='player'||game.visible[clamp(Math.floor(e.y/40),0,39)*60+clamp(Math.floor(e.x/40),0,59)]===1; }
function reveal() {
  game.visible.fill(0);
  for(const e of friendlies()){
    const radius=e.type==='radar'&&!powered()?240:DEF[e.type].vision;
    const r=Math.ceil(radius/40),cx=Math.floor(e.x/40),cy=Math.floor(e.y/40);
    for(let y=Math.max(0,cy-r);y<=Math.min(39,cy+r);y++)for(let x=Math.max(0,cx-r);x<=Math.min(59,cx+r);x++)if(Math.hypot(x*40+20-e.x,y*40+20-e.y)<=radius){const i=y*60+x;game.visible[i]=1;game.explored[i]=1;}
  }
  if(!fogCanvas){fogCanvas=document.createElement('canvas');fogCanvas.width=60;fogCanvas.height=40;fogCtx=fogCanvas.getContext('2d')}
  fogCtx.clearRect(0,0,60,40);
  for(let y=0;y<40;y++)for(let x=0;x<60;x++){
    const i=y*60+x;if(game.visible[i])continue;fogCtx.fillStyle=game.explored[i]?'rgba(15,24,20,.48)':'rgba(12,21,18,.81)';fogCtx.fillRect(x,y,1,1);
  }
}
function acquire(e) {
  const d=DEF[e.type];if(!d.damage)return null;
  let best=null,bestScore=Infinity;
  for(const t of game.entities){if(!alive(t)||t.team===e.team)continue;if(e.team==='player'&&!canSee(t))continue;
    const distance=dist(e,t)-t.r;
    if(distance>d.range+(isBuilding(e)?0:45))continue;
    const score=distance+(isBuilding(t)?80:0);if(score<bestScore){best=t;bestScore=score}
  }return best;
}
function fire(e,t) {
  const d=DEF[e.type];e.cooldown=d.reload;e.flash=.13;e.turretAngle=Math.atan2(t.y-e.y,t.x-e.x);
  let damage=d.damage;
  if(e.type==='rifle'&&(isBuilding(t)||['tank','harvester'].includes(t.type)))damage*=.33;
  if(e.type==='rocket'&&!isBuilding(t)&&['rifle','rocket'].includes(t.type))damage*=.4;
  const shell=['tank','turret','rocket'].includes(e.type);
  game.projectiles.push({x:e.x,y:e.y-8,tx:t.x,ty:t.y-8,targetId:t.id,team:e.team,damage,speed:shell?410:750,kind:e.type,trail:[]});
  if(canSee(e)&&onScreen(e.x,e.y))beep(shell?'shot':'rifle');
}
function damage(target,amount,team) {
  if(!alive(target))return;target.hp-=amount;target.hit=.2;
  if(target.team==='player'&&game.messageCooldown<=0){radio(isBuilding(target)?'Naše základna je pod útokem!':'Naše jednotky jsou pod palbou!',true);game.messageCooldown=16;}
  if(target.hp<=0){
    target.hp=0;const big=isBuilding(target);burst(target.x,target.y,big?36:14,big?1.6:1);
    if(target.team==='enemy')game.kills++;else{game.losses++;if(target.type==='harvester')notify('Logistická Tatra byla zničena.','danger');}
    if(onScreen(target.x,target.y))beep('explosion');selected=selected.filter(id=>id!==target.id);updateEnergy();
    if(target.type==='hq'&&target.team==='player')finish(false);
    if(target.type==='fortress')finish(true);
    if(big){buildCards();for(const e of game.entities)if(e.path.length)e.pathTimer=0;}
  }
}
function burst(x,y,n,scale=1){for(let i=0;i<n;i++)game.effects.push({kind:'particle',x,y,vx:(rand()-.5)*140*scale,vy:(rand()-.5)*120*scale,size:(3+rand()*8)*scale,life:.3+rand()*.9,maxLife:1.2,color:rand()>.45?'#f6c169':'#4a4b40'});game.effects.push({kind:'blast',x,y,life:.42,maxLife:.42,size:35*scale});}
function findHarvesterTarget(e) {
  const ref=game.entities.filter(b=>alive(b)&&b.team===e.team&&b.type==='refinery').sort((a,b)=>dist(e,a)-dist(e,b))[0];
  if(!ref)return null;
  if(e.load>=280)return {kind:'unload',x:ref.x+ref.r+40,y:ref.y+25,ref};
  const ore=game.ore.filter(o=>o.amount>0).sort((a,b)=>dist(e,a)-dist(e,b))[0];
  return ore?{kind:'mine',x:ore.x+(e.id%3-1)*22,y:ore.y+e.id%2*18,ore}:{kind:'unload',x:ref.x+ref.r+40,y:ref.y+25,ref};
}
function harvest(e,dt) {
  const target=findHarvesterTarget(e);if(!target){e.path=[];return}
  if(dist(e,target)>27){if(e.pathTimer<=0||(!e.path.length&&e.harvestTimer<=0))route(e,target.x,target.y);move(e,dt);e.harvestTimer=0;}
  else {e.path=[];e.harvestTimer+=dt;
    if(target.kind==='mine'&&e.harvestTimer>=.14){const amount=Math.min(9,target.ore.amount,280-e.load);e.load+=amount;target.ore.amount-=amount;e.harvestTimer=0;}
    if(target.kind==='unload'&&e.harvestTimer>1.1){if(e.team==='player'){game.credits+=e.load;game.gathered+=e.load;game.effects.push({kind:'text',text:`+${money(e.load)}`,x:e.x,y:e.y-35,life:2,maxLife:2});}e.load=0;e.harvestTimer=0;e.pathTimer=0;}
  }
}
function updateEntity(e,dt) {
  if(!alive(e))return;const d=DEF[e.type];e.cooldown-=dt;e.flash=Math.max(0,e.flash-dt);e.hit=Math.max(0,(e.hit||0)-dt);e.pathTimer-=dt;e.scan-=dt;
  if(e.repair&&e.hp<e.maxHp&&game.credits>0){const heal=Math.min(dt*60,e.maxHp-e.hp,game.credits*4);e.hp+=heal;game.credits-=heal/4;if(e.hp>=e.maxHp)e.repair=false;}
  if(isBuilding(e)){if(e.type==='turret'&&(e.team==='enemy'||powered())){if(e.scan<=0){e.target=acquire(e);e.scan=.4;}if(alive(e.target)&&dist(e,e.target)-e.target.r<=d.range&&e.cooldown<=0)fire(e,e.target);}return;}
  if(e.type==='harvester'&&e.order?.kind==='harvest'){harvest(e,dt);return}
  if(e.order?.kind==='attack'){const t=game.entities.find(t=>t.id===e.order.target);if(!alive(t)){e.order=null;e.path=[];e.target=null;}else if(e.team==='player'&&!canSee(t)){e.order={kind:'attackMove',x:t.x,y:t.y};e.target=null;route(e,t.x,t.y);}else e.target=t;}
  if(e.scan<=0){if(e.order?.kind!=='attack')e.target=acquire(e);e.scan=.4;}
  if(e.target&&!alive(e.target))e.target=null;
  const moving=e.order?.kind==='move';
  if(e.target&&(!moving||dist(e,e.target)-e.target.r<=d.range)){
    const t=e.target,distance=dist(e,t)-t.r;e.turretAngle=turnAngle(e.turretAngle,Math.atan2(t.y-e.y,t.x-e.x),dt*8);
    if(distance<=d.range){if(e.cooldown<=0)fire(e,t);if(!moving)return;}
    else if(e.order?.kind==='attack'||e.order?.kind==='attackMove'){
      if(e.pathTimer<=0||!e.path.length){const angle=Math.atan2(e.y-t.y,e.x-t.x);route(e,t.x+Math.cos(angle)*(d.range*.7+t.r),t.y+Math.sin(angle)*(d.range*.7+t.r));}
      move(e,dt);return;
    }
  }
  if(e.order&&(e.order.kind==='move'||e.order.kind==='attackMove')) {
    if(!e.path.length&&dist(e,e.order)>32&&e.pathTimer<=0)route(e,e.order.x,e.order.y);
    move(e,dt);if(dist(e,e.order)<12){e.order=null;e.path=[];}
  } else if(e.order?.kind==='attack')move(e,dt);
}
function separate(dt) {
  const units=game.entities.filter(e=>alive(e)&&!isBuilding(e));
  for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){
    const a=units[i],b=units[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy),min=a.r+b.r+2;
    if(d<min&&d>.01){const push=Math.min((min-d)*.4,dt*25),nx=dx/d*push,ny=dy/d*push;
      if(validCell(Math.floor((a.x+nx)/40),Math.floor((a.y+ny)/40))){a.x+=nx;a.y+=ny}
      if(validCell(Math.floor((b.x-nx)/40),Math.floor((b.y-ny)/40))){b.x-=nx;b.y-=ny}
    }
  }
}
function updateQueue(dt) {
  for(const channel of ['building','unit']){
    const item=game.queue.find(q=>q.channel===channel);if(!item)continue;
    const d=DEF[item.type];
    if(item.channel==='unit'&&!friendlies().some(e=>e.type===d.requires)){item.blocked=true;continue}item.blocked=false;
    item.remaining-=dt*(powered()?1:.4);if(item.remaining>0)continue;
    game.queue=game.queue.filter(q=>q!==item);
    if(item.channel==='building'){
      entity(item.type,'player',item.x,item.y);
      if(item.type==='refinery'){const h=entity('harvester','player',item.x+100,item.y+40);h.order={kind:'harvest'};}
      radio(`${d.name}: stavba dokončena.`);notify(`${d.name} dokončena.`);updateEnergy();buildCards();beep('complete');
    }else {
      const producer=friendlies().find(e=>e.type===d.requires);
      const spawn=nearestCell(producer.x+producer.r+55,producer.y+45);
      const e=entity(item.type,'player',spawn[0]*40+20,spawn[1]*40+20);
      if(item.type==='harvester')e.order={kind:'harvest'};
      else{const rally={x:producer.x+producer.r+120+(rand()-.5)*60,y:producer.y+80+(rand()-.5)*85};e.order={kind:'move',...rally};route(e,rally.x,rally.y);}
      notify(`${d.name}: jednotka připravena.`);beep('complete');
    }
  }
}
function launchWave() {
  game.wave++;game.nextWave=game.time+Math.max(60,95-game.wave*5);
  const factory=game.entities.find(e=>alive(e)&&e.team==='enemy'&&e.type==='factory');if(!factory)return;
  const hq=game.entities.find(e=>alive(e)&&e.team==='player'&&e.type==='hq');if(!hq)return;
  const count=Math.min(7,2+Math.floor(game.wave/2));
  for(let i=0;i<count+2;i++){const e=entity(i<count?'tank':'rifle','enemy',factory.x-100-i*28,factory.y+115+(i%2)*40);e.order={kind:'attackMove',x:hq.x+100,y:hq.y};route(e,hq.x+100,hq.y);}
  radio(`Zachycen nepřátelský pohyb. Útočná vlna ${game.wave} míří k naší základně.`,true);notify('Nepřátelská útočná skupina je na cestě.','danger');
}
function update(dt) {
  if(game.paused||!game.started||game.ended)return;
  game.time+=dt;game.messageCooldown-=dt;
  if(game.time>=game.nextWave)launchWave();
  for(const e of game.entities){updateEntity(e,dt);if(game.ended)return;}
  separate(dt);updateQueue(dt);
  for(const p of game.projectiles){const t=game.entities.find(e=>e.id===p.targetId);if(alive(t)){p.tx=t.x;p.ty=t.y-8;}
    const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy);
    if(d<p.speed*dt+5){p.dead=true;if(alive(t))damage(t,p.damage,p.team);if(['tank','rocket','turret'].includes(p.kind))burst(p.tx,p.ty,5,.4);}
    else{p.x+=dx/d*p.speed*dt;p.y+=dy/d*p.speed*dt;}
  }
  game.projectiles=game.projectiles.filter(p=>!p.dead);
  for(const e of game.effects){e.life-=dt;if(e.kind==='particle'){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vx*=.96;e.vy*=.96;}if(e.kind==='text')e.y-=dt*16;}
  game.effects=game.effects.filter(e=>e.life>0);for(const t of game.tracks)t.life-=dt;game.tracks=game.tracks.filter(t=>t.life>0);
  fogClock+=dt;if(fogClock>.25){reveal();fogClock=0;}
}
function canPlace(type,x,y) {
  const d=DEF[type];if(!inMap(x-d.r,y-d.r)||!inMap(x+d.r,y+d.r))return {ok:false,reason:'Budova musí být uvnitř mapy.'};
  for(let dy=-d.r;dy<=d.r;dy+=20)for(let dx=-d.r;dx<=d.r;dx+=20)if(Math.abs(x+dx-riverX(y+dy))<90)return{ok:false,reason:'Na řece ani na mostě nelze stavět.'};
  if(!game.visible[Math.floor(y/40)*60+Math.floor(x/40)])return{ok:false,reason:'Tuto oblast nejprve prozkoumejte.'};
  if(!friendlies().some(e=>isBuilding(e)&&dist(e,{x,y})<370))return{ok:false,reason:'Stavte do vzdálenosti 370 m od vlastní základny.'};
  if(game.entities.some(e=>alive(e)&&isBuilding(e)&&Math.abs(e.x-x)<e.r+d.r+25&&Math.abs(e.y-y)<(e.r+d.r)*.75+25))return{ok:false,reason:'Příliš blízko jiné budovy.'};
  if(game.queue.some(q=>q.channel==='building'&&dist(q,{x,y})<DEF[q.type].r+d.r+25))return{ok:false,reason:'Toto místo je vyhrazeno jiné stavbě.'};
  if(game.ore.some(o=>dist(o,{x,y})<o.r*1.4+d.r))return{ok:false,reason:'Lom a jeho příjezdová cesta musí zůstat přístupné.'};
  if(game.entities.some(e=>alive(e)&&!isBuilding(e)&&Math.abs(e.x-x)<d.r+e.r&&Math.abs(e.y-y)<d.r*.7+e.r))return{ok:false,reason:'Přesuňte jednotky mimo staveniště.'};
  return{ok:true};
}
function buy(type) {
  if(!game.started||game.ended||game.paused)return;
  const d=DEF[type];if(game.credits<d.cost){notify('Nedostatečná bilance. Počkejte na návrat Tatry z lomu.','gold');beep('error');return;}
  if(game.queue.length>=12){notify('Výrobní fronta je plná (12 položek).','gold');return;}
  if(d.speed){
    if(!friendlies().some(e=>e.type===d.requires)){notify(`Nejprve postavte budovu: ${DEF[d.requires].name}.`,'gold');return;}
    if(friendlies().filter(e=>!isBuilding(e)).length+game.queue.filter(q=>q.channel==='unit'||q.type==='refinery').length>=60){notify('Dosažen limit 60 jednotek.','gold');return;}
    game.credits-=d.cost;game.queue.push({type,channel:'unit',remaining:d.time,total:d.time});notify(`${d.name} ve výrobní frontě.`);beep('click');
  }else{placement=type;attackMode=false;$('placement-banner').hidden=false;setTip('Vyberte volné místo poblíž základny. Zelený obrys znamená platné umístění.');beep('click');}
  updateUI();
}
function place(x,y){if(!placement)return;const type=placement,d=DEF[type],check=canPlace(type,x,y);if(!check.ok){notify(check.reason,'gold');return}if(game.credits<d.cost){notify('Nedostatečná bilance.','gold');return}
  if(game.queue.length>=12){notify('Výrobní fronta je plná.','gold');return}
  if(type==='refinery'&&friendlies().filter(e=>!isBuilding(e)).length+game.queue.filter(q=>q.channel==='unit'||q.type==='refinery').length>=60){notify('Zpracovatelský závod vyžaduje volné místo pro logistickou Tatru.','gold');return}
  game.credits-=d.cost;game.queue.push({type,channel:'building',x,y,remaining:d.time,total:d.time});cancelMode();radio(`Stavba zahájena: ${d.name}.`);beep('click');updateUI();
}
function cancelMode(){placement=null;attackMode=false;$('placement-banner').hidden=true;$('attack').classList.remove('active');$('order-mode').textContent='PŘIPRAVEN';setTip('Vyberte jednotky a vydejte rozkaz pravým tlačítkem.');}
function command(x,y,forceAttack=false) {
  if(game.paused||!game.started||game.ended)return;
  const units=selected.map(id=>game.entities.find(e=>e.id===id)).filter(e=>alive(e)&&!isBuilding(e));if(!units.length)return;
  const target=pick(x,y,'enemy'),ore=game.ore.find(o=>o.amount>0&&dist(o,{x,y})<o.r);
  const width=Math.ceil(Math.sqrt(units.length)),spacing=34;
  units.forEach((e,i)=>{
    e.target=null;e.path=[];e.pathTimer=0;
    if(e.type==='harvester'&&ore){e.order={kind:'harvest'};return;}
    if(target&&DEF[e.type].damage){e.order={kind:'attack',target:target.id};e.target=target;return;}
    const dest={x:clamp(x+(i%width-(width-1)/2)*spacing,25,2375),y:clamp(y+(Math.floor(i/width)-Math.floor(units.length/width)/2)*spacing,25,1575)};
    e.order={kind:forceAttack||attackMode?'attackMove':'move',...dest};route(e,dest.x,dest.y);
  });
  game.effects.push({kind:'marker',x,y,life:1.2,maxLife:1.2,color:target||attackMode||forceAttack?'#e89270':'#a9dac0'});beep('order');cancelMode();
}
function stopSelected(){for(const e of game.entities)if(selected.includes(e.id)){e.order=null;e.path=[];e.target=null;}cancelMode();notify('Jednotky drží pozici.');}
function repairSelected(){const buildings=friendlies().filter(e=>selected.includes(e.id)&&isBuilding(e));if(!buildings.length){notify('Pro opravu vyberte vlastní budovu.','gold');return}for(const e of buildings)e.repair=e.hp<e.maxHp;notify(buildings.some(e=>e.repair)?'Oprava zahájena. Cena: 1 za 4 body zdraví.':'Vybraná budova je nepoškozená.');}
function selectArmy(){selected=friendlies().filter(e=>!isBuilding(e)&&e.type!=='harvester').map(e=>e.id);updateUI();beep('click');}
function pick(x,y,team){return game.entities.filter(e=>alive(e)&&(!team||e.team===team)&&canSee(e)).sort((a,b)=>b.y-a.y).find(e=>isBuilding(e)?Math.abs(x-e.x)<e.r+15&&y>e.y-DEF[e.type].size*.75&&y<e.y+30:dist(e,{x,y})<e.r+10);}
function toWorld(x,y){return{x:(x-viewW/2)/camera.zoom+camera.x,y:(y-viewH/2)/camera.zoom+camera.y};}
function onScreen(x,y){return Math.abs(x-camera.x)<viewW/2/camera.zoom+150&&Math.abs(y-camera.y)<viewH/2/camera.zoom+160;}
function clampCamera(){const hw=viewW/2/camera.zoom,hh=viewH/2/camera.zoom;camera.x=clamp(camera.x,Math.min(hw,1200),Math.max(2400-hw,1200));camera.y=clamp(camera.y,Math.min(hh,800),Math.max(1600-hh,800));}
function zoom(delta,anchor){const before=anchor?toWorld(anchor.x,anchor.y):null;camera.zoom=clamp(camera.zoom+delta,.45,1.6);if(anchor){const after=toWorld(anchor.x,anchor.y);camera.x+=before.x-after.x;camera.y+=before.y-after.y;}clampCamera();$('zoom-label').textContent=`${Math.round(camera.zoom*100)}%`;}
function home(){const hq=friendlies().find(e=>e.type==='hq');if(hq){camera.x=hq.x+240;camera.y=hq.y-50;clampCamera();}}
function resize(){const r=canvas.parentElement.getBoundingClientRect();viewW=r.width;viewH=r.height;dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(viewW*dpr);canvas.height=Math.round(viewH*dpr);if(game)clampCamera();}
function notify(text,type=''){const el=document.createElement('div');el.className=`notification ${type}`;el.textContent=text;$('notifications').append(el);while($('notifications').children.length>3)$('notifications').firstChild.remove();setTimeout(()=>el.remove(),4500);}
function radio(text,danger=false){$('radio-text').textContent=text;$('radio-time').textContent=clockText(game.time);if(danger)beep('warning');}
function setTip(text){$('tip-text').textContent=text;}
function beep(kind){if(!soundOn||!audioCtx)return;try{const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),now=audioCtx.currentTime;const settings={click:[700,.055,.035],order:[490,.14,.045],complete:[880,.22,.04],error:[150,.15,.05],warning:[260,.32,.06],shot:[75,.12,.04],rifle:[120,.05,.018],explosion:[42,.28,.07]}[kind]||[600,.05,.04];osc.type=['shot','rifle','explosion'].includes(kind)?'sawtooth':'sine';osc.frequency.setValueAtTime(settings[0],now);osc.frequency.exponentialRampToValueAtTime(Math.max(20,settings[0]*.4),now+settings[1]);gain.gain.setValueAtTime(settings[2],now);gain.gain.exponentialRampToValueAtTime(.001,now+settings[1]);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(now+settings[1]);}catch(_){/* Audio is optional. */}}
function toggleSound(){soundOn=!soundOn;if(soundOn){try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();}catch(_){soundOn=false;notify('Zvuk není v tomto prohlížeči dostupný.','gold');}}$('sound').innerHTML=soundOn?'♪':'♪<span class="sound-off">×</span>';$('sound').title=soundOn?'Vypnout zvuk':'Zapnout zvuk';$('sound').setAttribute('aria-label',$('sound').title);beep('click');}

// The terrain is painted once; the generated material and sprite atlas are local assets.
function poly(c,points,fill,stroke){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
function ellipse(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);c.fillStyle=color;c.fill();}
function line(c,pts,color,width=1,dash=[]){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.setLineDash(dash);c.stroke();c.setLineDash([]);}
function buildTerrain(){
  terrainCache=document.createElement('canvas');terrainCache.width=WORLD.w;terrainCache.height=WORLD.h;const c=terrainCache.getContext('2d');
  c.fillStyle='#77745a';c.fillRect(0,0,2400,1600);
  if(terrain.complete&&terrain.naturalWidth){const patternCanvas=document.createElement('canvas');patternCanvas.width=640;patternCanvas.height=640;patternCanvas.getContext('2d').drawImage(terrain,0,0,640,640);c.fillStyle=c.createPattern(patternCanvas,'repeat');c.fillRect(0,0,2400,1600);}
  c.fillStyle='#535f3820';c.fillRect(0,0,2400,1600);
  for(let i=0;i<100;i++){const x=rand()*2400,y=rand()*1600,r=50+rand()*160,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rand()>.5?'#283c282b':'#c8af7530');g.addColorStop(1,'#5f6b4000');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  const points=[];for(let y=-50;y<1690;y+=18)points.push([riverX(y),y]);
  line(c,points,'#454b36',180);line(c,points,'#6a6b4b',164);line(c,points,'#9e9770',142);line(c,points,'#344c43',121);line(c,points,'#405e52',106);line(c,points,'#4d6a5b',74);
  for(let i=0;i<440;i++){const y=rand()*1600,x=riverX(y)+(rand()-.5)*104;line(c,[[x,y],[x+3+rand()*15,y-2]],rand()>.5?'#a2b49922':'#203e3629',.7);}
  for(let side of [-1,1])for(let y=0;y<1600;y+=19+rand()*15){const x=riverX(y)+side*(67+rand()*18);ellipse(c,x+4,y+3,7+rand()*7,4+rand()*4,'#343d3040');ellipse(c,x,y,4+rand()*7,2+rand()*4,'#888669');}
  const roads=[[[80,1100],[445,1085],[650,1040],[920,1070],[1160,1208],[1650,1210],[1890,1030],[2080,650],[2160,130]],[[460,1580],[465,1290],[485,1080],[530,815],[850,602],[1590,600],[1820,565],[2070,365]],[[480,1100],[650,1195],[1090,1270]]];
  for(const road of roads){line(c,road,'#796e4c70',61);line(c,road,'#b1a27a80',45);line(c,road,'#93866acc',35);if(terrain.complete&&terrain.naturalWidth){c.globalAlpha=.38;line(c,road,c.createPattern(terrain,'repeat'),35);c.globalAlpha=1;}line(c,road.map(p=>[p[0]-9,p[1]-2]),'#6d654544',3);line(c,road.map(p=>[p[0]+9,p[1]+2]),'#6d654544',3);
    for(let j=1;j<road.length;j++){const a=road[j-1],b=road[j],length=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/length,ny=(b[0]-a[0])/length;for(let k=0;k<length;k+=4){const t=k/length,offset=(rand()-.5)*55,x=a[0]+(b[0]-a[0])*t+nx*offset,y=a[1]+(b[1]-a[1])*t+ny*offset;c.fillStyle=rand()>.5?'#514e3333':'#c4b38544';c.fillRect(x,y,1+rand()*2,1+rand()*2);}}
  }
  drawQuarries(c);
  for(const y of [600,1210]){
    const x=riverX(y);c.fillStyle='#20282088';c.fillRect(x-106,y-47,222,108);c.fillStyle='#55584a';c.fillRect(x-113,y-49,226,98);c.fillStyle='#8c8971';c.fillRect(x-118,y-42,236,84);
    for(let i=-108;i<118;i+=18){c.fillStyle=(i/18)%2?'#737865':'#7f826d';c.fillRect(x+i,y-39,15,78);line(c,[[x+i,y-39],[x+i,y+38]],'#4e594c',1);}
    line(c,[[x-118,y-45],[x+118,y-45]],'#b0b299',5);line(c,[[x-118,y+45],[x+118,y+45]],'#4a4f40',6);line(c,[[x-111,y],[x+111,y]],'#d8c99288',2,[11,12]);
    for(const end of [-1,1])for(const edge of [-1,1]){c.fillStyle='#b2ac88';c.fillRect(x+end*108-4,y+edge*44-7,8,15);c.fillStyle='#363e2f';c.fillRect(x+end*108-4,y+edge*44-7,8,3);}
  }
  // Concrete staging area and utility details around the player's outpost.
  poly(c,[[242,826],[593,738],[825,896],[780,1283],[347,1350],[223,1213]],'#7a7c6533','#b2ad7722');
  for(let x=260;x<800;x+=50)for(let y=790;y<1320;y+=50)if(x<590||y>880){c.strokeStyle='#3d493014';c.lineWidth=1;c.strokeRect(x,y,50,50);}
  for(const [x,y] of [[252,1035],[264,1080],[595,835],[558,817],[736,1290],[308,1295]]){c.fillStyle='#474c36';c.fillRect(x,y,20,12);c.fillStyle='#747a51';c.fillRect(x,y-3,20,9);c.strokeStyle='#333d2e';c.strokeRect(x,y-3,20,9);c.fillStyle='#a59b69';c.fillRect(x+3,y-3,2,9);c.fillRect(x+15,y-3,2,9);}
  // Tree clusters avoid roads, ore and base footprints.
  for(let i=0;i<520;i++){
    const x=rand()*2400,y=rand()*1600;if(Math.abs(x-riverX(y))<104||game.ore.some(o=>dist(o,{x,y})<o.r+50)||game.entities.some(e=>dist(e,{x,y})<DEF[e.type].r+105))continue;
    if((x>200&&x<1120&&y>740&&y<1350)||roads.some(r=>r.some((p,j)=>j&&pointSegment(x,y,r[j-1],p)<49)))continue;
    if(rand()>.60&&x<1200)continue;drawTree(c,x,y,10+rand()*12,rand());
  }
  // Abandoned observation post.
  for(const [x,y] of [[1075,390],[1140,410],[1830,1410]]){
    ellipse(c,x+10,y+12,42,24,'#333b2d55');poly(c,[[x-26,y-15],[x+17,y-28],[x+38,y-12],[x-9,y+6]],'#96917a');poly(c,[[x-26,y-15],[x-9,y+6],[x-9,y+29],[x-26,y+6]],'#575e4b');poly(c,[[x-9,y+6],[x+38,y-12],[x+38,y+10],[x-9,y+29]],'#70715c');c.fillStyle='#303d33';c.fillRect(x,y+2,9,14);line(c,[[x-15,y-5],[x+9,y-16],[x+20,y-10]],'#494e3c',3);
  }
  for(let i=0;i<26;i++){const x=rand()*2400,y=rand()*1600;if(waterAt(x,y))continue;ellipse(c,x+3,y+2,12+rand()*10,7+rand()*5,'#333b2822');ellipse(c,x,y,8+rand()*6,4+rand()*4,'#6b6d51');line(c,[[x-5,y-2],[x+1,y-5],[x+5,y-2]],'#a29d7444',2);}
}
function pointSegment(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}
function drawQuarries(c){
  for(const o of game.ore){
    // A ground-level loading yard and an open western approach, not a pit.
    const access=[[o.x-o.r*1.7,o.y+o.r*.05],[o.x-o.r*.9,o.y+o.r*.08],[o.x-o.r*.15,o.y+o.r*.1]];
    line(c,access,'#aaa08333',64);line(c,access,'#bab09666',46);
    if(terrain.complete&&terrain.naturalWidth){c.save();c.globalAlpha=.28;line(c,access,c.createPattern(terrain,'repeat'),43);c.restore();}
    if(quarry.complete&&quarry.naturalWidth){c.drawImage(quarry,o.x-o.r*1.6,o.y-o.r*1.3,o.r*3.2,o.r*2.5);}
    else {ellipse(c,o.x,o.y,o.r*1.25,o.r*.82,'#b3aa8e99');}
    for(const offset of [-12,12])line(c,access.map(([x,y])=>[x,y+offset]),'#746e5633',2);
  }
}
function drawTree(c,x,y,size,variant){
  ellipse(c,x+size*.55,y+size*.3,size*.9,size*.44,'#23302445');line(c,[[x,y],[x-2,y-size*.7]],'#4b4933',3);
  if(variant>.4){for(let j=0;j<3;j++){const yy=y-j*size*.42,sz=size*(1-j*.18);poly(c,[[x,yy-sz*1.5],[x-sz*.69,yy],[x+sz*.7,yy]],j%2?'#3e5131':'#34492f');poly(c,[[x-1,yy-sz*1.45],[x-sz*.65,yy-1],[x-1,yy-sz*.22]],'#64704766');}}
  else {for(let j=0;j<7;j++){const a=j*2.4;ellipse(c,x+Math.cos(a)*size*.5,y-size*.8+Math.sin(a)*size*.33,size*.56,size*.48,['#4b5b34','#59633a','#657344','#414e2e'][j%4]);}ellipse(c,x-3,y-size,size*.47,size*.37,'#78804966');}
}
function drawOre(c){
  for(const o of game.ore){if(!onScreen(o.x,o.y))continue;
    const depletion=Math.min(1,o.amount/1500);c.save();c.globalAlpha=depletion*.8;
    // Small mineral heaps stay beside the loading lane so the truck rests on gravel.
    let seed=234;for(let i=0;i<65*depletion;i++){seed=(seed*16807)%2147483647;const a=seed/2147483647*Math.PI*2;seed=(seed*16807)%2147483647;const rad=Math.sqrt(seed/2147483647)*o.r;const x=o.x+o.r*.38+Math.abs(Math.cos(a))*rad*.4,y=o.y+Math.sin(a)*rad*.64,s=1.5+(i%4)*.65;
      poly(c,[[x-s,y],[x-1,y-s],[x+s,y-1],[x+s+1,y+2],[x,y+s*.5]],['#aa9670','#a08e66','#9f8157','#c2ad84'][i%4],'#857552');}
    c.restore();if(game.visible[Math.floor(o.y/40)*60+Math.floor(o.x/40)]){c.font='9px Consolas';c.fillStyle='#ead8a9';c.textAlign='center';c.fillText(o.amount>0?'◈ LOM · SUROVINY':'LOM · VYTĚŽENO',o.x,o.y+o.r*1.02);}
  }
}
function drawBuilding(c,e,scale=1,icon=false){
  const d=DEF[e.type],s=d.size*scale;c.save();c.translate(e.x,e.y);
  // The sprite already contains contact shading at its concrete foundation.
  // No displaced ellipse underneath: it made the entire building appear airborne.
  if(atlas.complete&&atlas.naturalWidth){const sw=atlas.naturalWidth/4,sh=atlas.naturalHeight/2;c.drawImage(atlas,(d.sprite%4)*sw,Math.floor(d.sprite/4)*sh,sw,sh,-s/2,-s*.79,s,s);}
  else {poly(c,[[-s*.4,-s*.25],[0,-s*.45],[s*.4,-s*.25],[0,0]],'#8a9170');poly(c,[[-s*.4,-s*.25],[0,0],[0,s*.2],[-s*.4,0]],'#495c48');poly(c,[[0,0],[s*.4,-s*.25],[s*.4,0],[0,s*.2]],'#66745a');}
  if(!icon){
    if(e.team==='player'&&e.type==='hq'){
      const fx=-s*.36,fy=s*.055;
      line(c,[[fx,fy],[fx,fy-s*.48]],'#c2c5ac',1.3);
      drawCzechFlag(c,fx+1,fy-s*.48,s*.16,s*.1);
    }
    if(e.team==='enemy'&&e.type!=='fortress'){line(c,[[-s*.12,-s*.27],[s*.1,-s*.31]],'#a95143',2.5);}
    if(e.type==='hq'||e.type==='radar'||e.type==='fortress'){c.fillStyle=(Math.sin(game.time*3+e.id)>0?TEAM[e.team]:'#627554');c.fillRect(s*.23,-s*.65,2.5,2.5);}
    if(e.repair){c.fillStyle='#a5dab4';c.font='bold 18px Segoe UI';c.textAlign='center';c.fillText('+',0,-s*.79-10);}
    if(e.hp<e.maxHp*.45){const wobble=Math.sin(game.time*2+e.id)*4;ellipse(c,-13+wobble,-s*.5,8,12,'#313a3080');ellipse(c,-10-wobble,-s*.6,12,15,'#3c443b55');}
    if(e.flash>0){ellipse(c,30,-45,14,8,'#ffe1a2');}
  }
  c.restore();
}
function drawCzechFlag(c,x,y,w,h){c.fillStyle='#e2e3d9';c.fillRect(x,y,w,h/2);c.fillStyle='#aa493d';c.fillRect(x,y+h/2,w,h/2);poly(c,[[x,y],[x+w*.5,y+h/2],[x,y+h]],'#315777');}
function drawUnit(c,e,scale=1,icon=false){
  const d=DEF[e.type];c.save();c.translate(e.x,e.y);c.scale(scale,scale);const color=TEAM[e.team],enemy=e.team==='enemy';
  if(e.type==='rifle'||e.type==='rocket'){
    const step=e.path?.length?Math.sin(game.time*13+e.id)*2:0;
    ellipse(c,3,2,7,3,'#15201766');line(c,[[-2,0],[-3-step,5]],'#2d3527',3);line(c,[[2,0],[3+step,5]],'#2d3527',3);
    ellipse(c,0,-4,5,7,enemy?'#896851':'#68744f');line(c,[[-4,-6],[4,-6]],enemy?color:'#555d3f',2);if(!enemy)drawCzechFlag(c,-5,-7,4,2.5);c.save();c.rotate(e.target?e.turretAngle:e.angle);c.fillStyle='#272f29';c.fillRect(0,-5,e.type==='rocket'?14:11,e.type==='rocket'?4:2);if(e.type==='rocket'){c.fillStyle='#7c8561';c.fillRect(5,-6,8,5);}c.restore();ellipse(c,0,-11,4.2,3.7,'#293b2e');ellipse(c,-1,-12,3.5,2.5,enemy?'#a18969':'#9ca57b');
  }else{
    if(vehicles.complete&&vehicles.naturalWidth){
      ellipse(c,3,5,d.r+5,d.r*.6,'#17201766');c.save();orientVehicleSprite(c,e.angle);
      const rect=VEHICLE_SPRITES[e.type][enemy?1:0],width=e.type==='tank'?64:e.type==='harvester'?60:44,height=width*rect[3]/rect[2];
      c.drawImage(vehicles,...rect,-width/2,-height/2,width,height);
      if(e.flash>0)poly(c,[[width/2-2,-5],[width/2+14,0],[width/2-2,5],[width/2+3,0]],'#fff0ac');
      c.restore();
      if(!icon&&e.hit>0){c.globalAlpha=.25;ellipse(c,0,0,d.r,d.r*.7,'#fff9cc');}
      c.restore();return;
    }
    ellipse(c,3,5,d.r+5,d.r*.6,'#17201766');c.save();orientVehicleSprite(c,e.angle);
    const tank=e.type==='tank',harvester=e.type==='harvester',w=harvester?40:tank?35:29,h=harvester?26:tank?25:19;
    if(tank||harvester){for(const sign of [-1,1]){c.fillStyle='#222b24';c.fillRect(-w/2-2,sign*h/2-4,w+4,8);c.fillStyle='#535c48';for(let i=-w/2;i<w/2;i+=5)c.fillRect(i,sign*h/2-3,2,6);}}
    else{for(const x of [-9,9])for(const y of [-11,8]){c.fillStyle='#1d271f';c.fillRect(x-4,y,8,5);}}
    c.fillStyle=enemy?'#6b6750':'#627555';c.fillRect(-w/2,-h/2,w,h);c.fillStyle=enemy?'#8e8362':'#8a9972';c.fillRect(-w/2+2,-h/2+1,w-4,h-6);
    poly(c,[[w/2,-h/2],[w/2+5,-h/2+5],[w/2+5,h/2-4],[w/2,h/2]],enemy?'#777253':'#748460');
    line(c,[[-w/2+3,-h/2+2],[w/2-3,-h/2+2]],'#c3c29a88',1);c.fillStyle=color;c.fillRect(-w/2+5,-h/2+1,4,h-3);
    if(harvester){c.fillStyle='#3e4c36';c.fillRect(-18,-10,25,20);c.fillStyle='#8d9366';for(let i=-15;i<4;i+=6)c.fillRect(i,-9,2,18);c.fillStyle='#c4a34f';c.fillRect(8,-11,10,21);c.fillStyle='#334d48';c.fillRect(10,-8,7,7);c.fillStyle='#e1c075';c.fillRect(10,6,8,3);if(e.load){c.fillStyle='#c9ac60';for(let i=0;i<e.load/30;i++)c.fillRect(-14+(i%4)*5,-7+Math.floor(i/4)*5,4,4);}}
    else{c.fillStyle='#354a43';c.fillRect(w/2-7,-h/2+3,5,7);c.fillStyle='#d8c58b';c.fillRect(w/2,-h/2+2,3,3);c.fillRect(w/2,h/2-5,3,3);}
    c.restore();
    if(!harvester){c.save();c.rotate(e.target?e.turretAngle:e.angle);c.translate(0,-3);ellipse(c,-1,0,tank?12:7,tank?9:6,'#3b4935');poly(c,tank?[[-11,-6],[5,-9],[13,-3],[10,6],[-7,8]]:[[-7,-4],[5,-5],[8,2],[-5,5]],enemy?'#9b8868':'#a0ab7e','#4f5c43');c.fillStyle='#354331';c.fillRect(7,-3,tank?24:14,tank?5:3);c.fillStyle='#a0ad81';c.fillRect(8,-3,tank?22:13,2);c.fillStyle='#303c2b';c.fillRect(tank?27:18,-4,6,6);c.fillStyle=color;c.fillRect(-6,-6,4,11);ellipse(c,0,0,tank?4:3,tank?3:2,'#536248');if(e.flash>0)poly(c,[[32,-6],[48,0],[32,6],[38,0]],'#fff0ac');c.restore();}
  }
  if(!icon&&e.hit>0){c.globalAlpha=.3;c.fillStyle='#fff9cc';c.fillRect(-d.r,-d.r,d.r*2,d.r*1.5);}
  c.restore();
}
function drawSelection(c,e){
  const building=isBuilding(e),w=building?e.r*2+18:e.r*2+12,h=building?e.r*1.1+13:e.r+13;c.save();c.translate(e.x,e.y);c.strokeStyle=TEAM[e.team];c.lineWidth=1.2;
  if(building){c.setLineDash([5,4]);c.beginPath();c.ellipse(0,7,w*.52,h*.65,0,0,Math.PI*2);c.stroke();c.setLineDash([]);}
  else {for(const sx of [-1,1])for(const sy of [-1,1])line(c,[[sx*(w/2-7),sy*h/2],[sx*w/2,sy*h/2],[sx*w/2,sy*(h/2-5)]],TEAM[e.team],1.3);}
  c.restore();
}
function healthBar(c,e){const d=DEF[e.type],building=isBuilding(e),w=building?53:26,y=e.y-(building?d.size*.72:d.r+17);c.fillStyle='#16261ddd';c.fillRect(e.x-w/2-1,y-1,w+2,5);c.fillStyle=e.hp/e.maxHp<.3?'#dc8a62':TEAM[e.team];c.fillRect(e.x-w/2,y,w*e.hp/e.maxHp,3);if(e.type==='harvester'&&e.load){c.fillStyle='#d9bd6f';c.fillRect(e.x-w/2,y+5,w*e.load/280,2);}}
function drawEffects(c){
  for(const p of game.projectiles){if(!onScreen(p.x,p.y))continue;const a=Math.atan2(p.ty-p.y,p.tx-p.x);line(c,[[p.x-Math.cos(a)*14,p.y-Math.sin(a)*14],[p.x,p.y]],p.kind==='rocket'?'#e7af6f':'#edd697',p.kind==='rifle'?1:2);ellipse(c,p.x,p.y,2,2,'#fff0c3');}
  for(const e of game.effects){c.save();c.globalAlpha=clamp(e.life/e.maxLife,0,1);
    if(e.kind==='particle'){ellipse(c,e.x,e.y,e.size,e.size*.7,e.color);}
    else if(e.kind==='blast'){const progress=1-e.life/e.maxLife,g=c.createRadialGradient(e.x,e.y,0,e.x,e.y,e.size*(.5+progress));g.addColorStop(0,'#fff1aa');g.addColorStop(.4,'#e59b4baf');g.addColorStop(1,'#a5481300');c.fillStyle=g;c.beginPath();c.arc(e.x,e.y,e.size*(.5+progress),0,Math.PI*2);c.fill();}
    else if(e.kind==='marker'){const r=16+(1-e.life/e.maxLife)*21;c.strokeStyle=e.color;c.lineWidth=2;c.beginPath();c.ellipse(e.x,e.y,r,r*.55,0,0,Math.PI*2);c.stroke();line(c,[[e.x-5,e.y],[e.x+5,e.y]],e.color,1);line(c,[[e.x,e.y-5],[e.x,e.y+5]],e.color,1);}
    else if(e.kind==='text'){c.font='bold 14px Consolas';c.fillStyle='#e8d48c';c.textAlign='center';c.fillText(e.text,e.x,e.y);}
    c.restore();
  }
}
function drawConstruction(c){for(const q of game.queue.filter(q=>q.channel==='building')){
  const d=DEF[q.type],r=d.r;c.save();c.globalAlpha=.25;drawBuilding(c,{...q,team:'player',hp:d.hp,maxHp:d.hp},1);c.globalAlpha=1;poly(c,[[q.x-r,q.y],[q.x,q.y-r*.55],[q.x+r,q.y],[q.x,q.y+r*.55]],'#bdac5622','#d8c582');
  for(const s of [-1,1]){line(c,[[q.x+s*r*.7,q.y+10],[q.x+s*r*.7,q.y-d.size*.6]],'#a79466',3);line(c,[[q.x+s*r*.7,q.y-d.size*.6],[q.x,q.y-d.size*.8]],'#8c8866',2);}
  c.fillStyle='#1b291ddd';c.fillRect(q.x-35,q.y+30,70,7);c.fillStyle='#d7bd74';c.fillRect(q.x-34,q.y+31,68*(1-q.remaining/q.total),5);c.textAlign='center';c.font='9px Consolas';c.fillStyle='#f0dda7';c.fillText('STAVBA '+Math.floor((1-q.remaining/q.total)*100)+' %',q.x,q.y+52);c.restore();
}}
function render(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,viewW,viewH);ctx.fillStyle='#222c20';ctx.fillRect(0,0,viewW,viewH);
  ctx.save();ctx.translate(viewW/2,viewH/2);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);ctx.drawImage(terrainCache,0,0);
  for(const t of game.tracks){ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.angle);ctx.fillStyle=`rgba(38,46,28,${t.life/15*.16})`;ctx.fillRect(-4,-14,7,3);ctx.fillRect(-4,11,7,3);ctx.restore();}
  drawOre(ctx);
  for(const e of game.entities.filter(e=>e.hp<=0&&onScreen(e.x,e.y))){if(game.explored[Math.floor(e.y/40)*60+Math.floor(e.x/40)]){ellipse(ctx,e.x,e.y,e.r+5,e.r*.55,'#2b3129aa');poly(ctx,[[e.x-e.r*.6,e.y],[e.x,e.y-e.r*.6],[e.x+e.r,e.y],[e.x+3,e.y+e.r*.3]],'#515548');}}
  const list=game.entities.filter(e=>alive(e)&&onScreen(e.x,e.y)&&(e.team==='player'||canSee(e)||(isBuilding(e)&&game.explored[Math.floor(e.y/40)*60+Math.floor(e.x/40)]))).sort((a,b)=>a.y-b.y);
  for(const e of list){if(selected.includes(e.id))drawSelection(ctx,e);if(isBuilding(e))drawBuilding(ctx,e);else drawUnit(ctx,e);}
  drawConstruction(ctx);drawEffects(ctx);
  ctx.imageSmoothingEnabled=true;ctx.drawImage(fogCanvas,0,0,2400,1600);
  for(const e of list)if(canSee(e)&&(selected.includes(e.id)||e.hp<e.maxHp||hover?.id===e.id))healthBar(ctx,e);
  // Enemy command objective is marked by intelligence, even outside current sight.
  const enemyHQ=game.entities.find(e=>alive(e)&&e.type==='fortress');if(enemyHQ&&onScreen(enemyHQ.x,enemyHQ.y)){ctx.save();ctx.translate(enemyHQ.x,enemyHQ.y-155);ctx.strokeStyle='#d8956e';ctx.lineWidth=1;ctx.strokeRect(-7,-7,14,14);ctx.fillStyle='#d8ae87';ctx.textAlign='center';ctx.font='9px Consolas';ctx.fillText('NEPŘÁTELSKÉ VELITELSTVÍ',0,-18);ctx.restore();}
  if(placement&&pointer.inside){const p=toWorld(pointer.x,pointer.y),check=canPlace(placement,p.x,p.y),d=DEF[placement];ctx.save();ctx.globalAlpha=.65;drawBuilding(ctx,{type:placement,team:'player',x:p.x,y:p.y,hp:d.hp,maxHp:d.hp},1);ctx.globalAlpha=1;poly(ctx,[[p.x-d.r,p.y],[p.x,p.y-d.r*.6],[p.x+d.r,p.y],[p.x,p.y+d.r*.6]],check.ok?'#a0ce8933':'#e8796733',check.ok?'#b0d792':'#eb8b73');ctx.restore();}
  if(attackMode&&pointer.inside){const p=toWorld(pointer.x,pointer.y);ctx.strokeStyle='#e9c180';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(p.x,p.y,16,0,Math.PI*2);ctx.stroke();line(ctx,[[p.x-24,p.y],[p.x+24,p.y]],'#e9c180',1);line(ctx,[[p.x,p.y-24],[p.x,p.y+24]],'#e9c180',1);}
  ctx.restore();
  // Subtle vignette holds the battlefield together without obscuring units.
  const vg=ctx.createRadialGradient(viewW*.5,viewH*.5,viewW*.2,viewW*.5,viewH*.5,viewW*.7);vg.addColorStop(0,'#0c170c00');vg.addColorStop(1,'#0c170c40');ctx.fillStyle=vg;ctx.fillRect(0,0,viewW,viewH);
  if(drag&&Math.hypot(pointer.x-drag.x,pointer.y-drag.y)>5){ctx.fillStyle='#b6d29c14';ctx.strokeStyle='#c2d6a2';ctx.lineWidth=1;ctx.fillRect(drag.x,drag.y,pointer.x-drag.x,pointer.y-drag.y);ctx.strokeRect(drag.x,drag.y,pointer.x-drag.x,pointer.y-drag.y);}
  drawMinimap();
}
function drawMinimap(){const w=mini.width,h=mini.height,sx=w/2400,sy=h/1600;mc.clearRect(0,0,w,h);mc.drawImage(terrainCache,0,0,w,h);mc.fillStyle='#263c2644';mc.fillRect(0,0,w,h);
  for(const o of game.ore){if(o.amount>0){mc.fillStyle='#d7bd65';mc.fillRect(o.x*sx-4,o.y*sy-3,8,6);}}
  mc.drawImage(fogCanvas,0,0,w,h);
  for(const e of game.entities)if(alive(e)&&(e.team==='player'||canSee(e)||(isBuilding(e)&&game.explored[Math.floor(e.y/40)*60+Math.floor(e.x/40)]))){mc.fillStyle=TEAM[e.team];const size=isBuilding(e)?5:2.5;mc.fillRect(e.x*sx-size/2,e.y*sy-size/2,size,size);}
  const fortress=game.entities.find(e=>alive(e)&&e.type==='fortress');if(fortress){mc.strokeStyle='#d08c66';mc.lineWidth=1;mc.strokeRect(fortress.x*sx-5,fortress.y*sy-5,10,10);}
  mc.strokeStyle='#e3dec0aa';mc.lineWidth=1;mc.strokeRect((camera.x-viewW/2/camera.zoom)*sx,(camera.y-viewH/2/camera.zoom)*sy,viewW/camera.zoom*sx,viewH/camera.zoom*sy);
}
function renderIcon(canvas,type,team='player',scale=1){const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);const d=DEF[type];if(!d)return;const e={type,team,x:canvas.width/2,y:d.speed?canvas.height*.60:canvas.height*.73,hp:d.hp,maxHp:d.hp,angle:-.5,turretAngle:-.5,load:type==='harvester'?190:0,path:[]};if(d.speed)drawUnit(c,e,Math.min(canvas.width/(d.size*1.8),canvas.height/(d.size*1.2))*scale,true);else drawBuilding(c,e,Math.min(canvas.width/(d.size*1.04),canvas.height/(d.size*.9))*scale,true);}
function buildCards(){const grid=$('build-grid');grid.replaceChildren();const list=currentTab==='buildings'?BUILDINGS:UNITS;
  list.forEach((type,i)=>{const d=DEF[type],button=document.createElement('button');button.className='build-card';button.dataset.type=type;button.setAttribute('aria-label',`${d.name}, ${money(d.cost)}, ${d.time} sekund`);button.innerHTML=`<span class="card-key">${String(i+1).padStart(2,'0')}</span><canvas width="240" height="130"></canvas><span class="card-name">${d.name}</span><span class="card-cost">${money(d.cost)}</span><span class="card-time">${d.time} s</span>`;button.addEventListener('click',()=>buy(type));button.addEventListener('mouseenter',()=>{$('build-description').textContent=d.desc;});button.addEventListener('mouseleave',()=>{$('build-description').textContent=currentTab==='buildings'?'Rozšiřte základnu a připravte se k útoku.':'Kliknutím zařadíte jednotku do výroby.';});button.addEventListener('focus',()=>{$('build-description').textContent=d.desc;});grid.append(button);renderIcon(button.querySelector('canvas'),type);});
  updateCardAvailability();
}
function updateCardAvailability(){for(const card of $('build-grid').children){const d=DEF[card.dataset.type],missing=d.requires&&!friendlies().some(e=>e.type===d.requires);card.classList.toggle('unavailable',Boolean(missing||game.credits<d.cost));card.title=missing?`Vyžaduje: ${DEF[d.requires].name}`:d.desc;}}
let selectionSignature='',queueSignature='';
function updateUI(){
  $('credits').textContent=money(game.credits);$('power').textContent=`${game.energy.use} / ${game.energy.supply}`;$('power').style.color=powered()?'':'#e38f6c';$('income').textContent=powered()?'+ těžba':'nízká energie';
  const count=friendlies().filter(e=>!isBuilding(e)).length;$('population').innerHTML=`${count} <em>/ 60</em>`;$('time').textContent=clockText(game.time);$('zoom-label').textContent=`${Math.round(camera.zoom*100)}%`;
  $('pause').textContent=game.paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',game.paused?'Pokračovat':'Pozastavit');$('game-status').textContent=game.ended?$('game-status').textContent:game.paused?'OPERACE POZASTAVENA':'OPERACE PROBÍHÁ';
  updateCardAvailability();
  selected=selected.filter(id=>game.entities.some(e=>e.id===id&&alive(e)));
  const sel=selected.map(id=>game.entities.find(e=>e.id===id));const main=sel[0];
  $('selection-type').textContent=main?(isBuilding(main)?'INFRASTRUKTURA ZÁKLADNY':'ARMÁDA ČESKÉ REPUBLIKY'):'TAKTICKÉ VELENÍ';
  $('selection-name').textContent=sel.length>1?'Úderná skupina':main?DEF[main.type].name:'Žádný výběr';
  $('selection-detail').textContent=sel.length>1?`${sel.length} jednotek · připraveno k akci`:main?`${Math.ceil(main.hp)} / ${main.maxHp} HP${main.type==='harvester'?` · náklad ${Math.floor(main.load)}/280`:main.repair?' · oprava':''}`:'Klikněte na jednotku nebo budovu';
  $('selection-health').style.width=main?`${sel.reduce((n,e)=>n+e.hp,0)/sel.reduce((n,e)=>n+e.maxHp,0)*100}%`:'0%';$('selection-count').textContent=sel.length?`VÝBĚR JEDNOTEK / ${String(sel.length).padStart(2,'0')}`:'VÝBĚR JEDNOTEK';
  const signature=selected.join(',');
  if(signature!==selectionSignature||!$('unit-roster').children.length){selectionSignature=signature;const art=$('selection-art');art.getContext('2d').clearRect(0,0,art.width,art.height);if(main)renderIcon(art,main.type);const roster=$('unit-roster');roster.replaceChildren();
    for(const e of sel){const b=document.createElement('button');b.className='unit-tile';b.title=DEF[e.type].name;b.setAttribute('aria-label',`Vybrat pouze: ${DEF[e.type].name}`);b.dataset.id=e.id;b.innerHTML='<canvas width="96" height="96"></canvas><i></i>';b.addEventListener('click',()=>{selected=[e.id];updateUI();});roster.append(b);renderIcon(b.querySelector('canvas'),e.type);}
    if(!sel.length){const p=document.createElement('span');p.className='roster-placeholder';p.textContent='Tažením na mapě vyberte skupinu jednotek.';roster.append(p);}
  }
  for(const tile of $('unit-roster').children){const e=sel.find(e=>e.id===Number(tile.dataset.id));if(e)tile.querySelector('i').style.width=`${42*e.hp/e.maxHp}px`;}
  $('queue-count').textContent=String(game.queue.length).padStart(2,'0');const qs=game.queue.map(q=>`${q.type}:${q.x||0}:${q.total}:${q.remaining>0}`).join(',');
  if(qs!==queueSignature||!$('queue').children.length){queueSignature=qs;$('queue').replaceChildren();game.queue.forEach((q,i)=>{const b=document.createElement('button');b.className='queue-item';b.setAttribute('aria-label',`Zrušit výrobu: ${DEF[q.type].name}`);b.innerHTML='<canvas width="80" height="68"></canvas><div class="progress"></div><small></small>';b.addEventListener('click',()=>{if(game.paused||game.ended)return;const index=game.queue.indexOf(q);if(index<0)return;game.credits+=DEF[q.type].cost;game.queue.splice(index,1);queueSignature='';notify('Výroba zrušena. Částka vrácena do bilance.');updateUI();});$('queue').append(b);renderIcon(b.querySelector('canvas'),q.type);});
    if(!game.queue.length)$('queue').innerHTML='<div class="queue-empty"><span>＋</span>Čekám na vaše rozkazy</div>';
  }
  game.queue.forEach((q,i)=>{const node=$('queue').children[i];if(node){node.querySelector('.progress').style.width=`${(1-q.remaining/q.total)*100}%`;node.querySelector('small').textContent=q.blocked?'!':Math.ceil(q.remaining);node.title=q.blocked?`Chybí ${DEF[DEF[q.type].requires].name}. Kliknutím zrušíte a vrátíte částku do bilance.`:`${DEF[q.type].name} · ${Math.ceil(q.remaining)} s · kliknutím zrušit`;}});
}
function showModal(content,buttons){
  previousModalPause=game.paused;game.paused=true;$('modal-content').innerHTML=content;$('modal-buttons').replaceChildren();
  for(const [text,action,secondary] of buttons){const b=document.createElement('button');b.textContent=text;if(secondary)b.className='secondary-button';b.addEventListener('click',action);$('modal-buttons').append(b);}
  $('modal').hidden=false;$('modal-buttons').firstElementChild?.focus();updateUI();
}
function closeModal(){ $('modal').hidden=true;game.paused=previousModalPause;canvas.focus();updateUI(); }
function start(){ $('modal').hidden=true;game.started=true;game.paused=false;canvas.focus();updateUI();beep('order');radio('Úkolové uskupení AČR na pozici. Zajistěte lom a připravte obrněnou skupinu.'); }
function briefing(){
  const active=game.started;
  showModal(`<span class="mission-number">AČR / NĚKDE NA VÝCHODĚ</span><h1 id="modal-title">Železný úsvit</h1><p>České úkolové uskupení drží předmostí někde na východě. Na protějším břehu se soustřeďují neoznačené mechanizované síly. Vaším úkolem je zajistit údolí a udržet předsunutou základnu AČR.</p><div class="brief-objective"><span>01</span><div><strong>Vybudujte údernou sílu</strong><p>Tatra automaticky sváží suroviny z lomu. Postavte vojenské depo a nasaďte Leopardy. Hlídejte bilanci a dostatek energie.</p></div></div><div class="brief-objective"><span>02</span><div><strong>Prorazte přes řeku</strong><p>Vyberte jednotky tažením myši. Pravým tlačítkem vydejte rozkaz. Klávesou A a kliknutím zahájíte útok za přesunu.</p></div></div><div class="brief-objective"><span>03</span><div><strong>Zničte nepřátelské velitelství</strong><p>Cíl je označen na severovýchodě minimapy. Chraňte vlastní velitelství před nepřátelskými protiútoky.</p></div></div><div class="brief-meta"><span>OBLAST<strong>Někde na východě</strong></span><span>ODHAD MISE<strong>10–15 minut</strong></span><span>PODMÍNKY<strong>Jasno · 06:40</strong></span></div>`,[[active?'ZPĚT DO OPERACE →':'ZAHÁJIT OPERACI →',active?()=>{closeModal();game.paused=false;}:start],['OVLÁDÁNÍ',()=>help(true),true]]);
}
function help(fromBriefing=false){
  const wasPaused=game.paused;
  showModal('<span class="mission-number">POLNÍ PŘÍRUČKA</span><h1 id="modal-title">Rozkazy, veliteli.</h1><div class="help-grid"><kbd>Levý klik / tažení</kbd><span>Výběr jednotky / celé skupiny</span><kbd>Shift + klik</kbd><span>Přidat nebo odebrat jednotku z výběru</span><kbd>Pravý klik</kbd><span>Přesun, útok na cíl nebo těžba rudy</span><kbd>A, potom levý klik</kbd><span>Útok za přesunu; napadat cíle po cestě</span><kbd>S</kbd><span>Zastavit vybrané jednotky</span><kbd>R</kbd><span>Opravit vybranou vlastní budovu z bilance</span><kbd>F2</kbd><span>Vybrat celou bojovou armádu</span><kbd>Šipky / prostřední</kbd><span>Posun mapy / táhnout mapu myší</span><kbd>Kolečko</kbd><span>Přiblížit a oddálit mapu</span><kbd>Mezerník</kbd><span>Vrátit kameru k základně</span><kbd>Ctrl + 1–9 / 1–9</kbd><span>Uložit / vybrat skupinu jednotek</span><kbd>Esc</kbd><span>Zrušit rozkaz nebo pozastavit hru</span><kbd>Minimapa</kbd><span>Levým klikem kamera, pravým rozkaz</span><kbd>Výrobní fronta</kbd><span>Klikem zrušit položku a vrátit částku</span></div>',[[fromBriefing?'ZPĚT K ZADÁNÍ':'ROZUMÍM →',fromBriefing?briefing:()=>{closeModal();game.paused=wasPaused;}]]);
}
function pauseMenu(){if(game.ended)return;if(!$('modal').hidden){if(!game.started){start();return;}closeModal();game.paused=false;return;}if(!game.started){briefing();return;}showModal('<span class="mission-number">OPERACE POZASTAVENA</span><h1 id="modal-title">Čekáme na rozkazy.</h1><p>Bojiště zůstává pod kontrolou. Pokračujte v operaci, nebo ji zahajte znovu.</p>',[['POKRAČOVAT →',()=>{closeModal();game.paused=false;}],['RESTART MISE',confirmRestart,true]]);}
function confirmRestart(){showModal('<span class="mission-number">NOVÉ NASAZENÍ</span><h1 id="modal-title">Restartovat misi?</h1><p>Aktuální postup bude ztracen. Začnete s novou základnou, sedmi jednotkami a bilancí 3 200.</p>',[['RESTARTOVAT',()=>{reset();start();}],['ZPĚT',()=>{$('modal').hidden=true;game.paused=false;pauseMenu();},true]]);}
function finish(victory){if(game.ended)return;game.ended=true;game.paused=true;cancelMode();$('game-status').textContent=victory?'MISE SPLNĚNA':'MISE NESPLNĚNA';
  showModal(`<span class="mission-number">${victory?'OPERACE ÚSPĚŠNÁ':'SPOJENÍ ZTRACENO'}</span><h1 id="modal-title">${victory?'Údolí je naše.':'Základna padla.'}</h1><p>${victory?'Nepřátelské velitelství bylo zničeno. Průchod údolím je znovu otevřený. Dobrá práce, veliteli.':'Naše velitelství bylo zničeno. Při dalším nasazení posilte obranu věžemi a opravujte poškozené budovy.'}</p><div class="results"><div><strong>${clockText(game.time)}</strong><small>ČAS OPERACE</small></div><div><strong>${game.kills}</strong><small>ZNIČENÉ CÍLE</small></div><div><strong>${money(game.gathered)}</strong><small>VÝNOS Z TĚŽBY</small></div></div>`,[['HRÁT ZNOVU →',()=>{reset();start();}],['PROHLÉDNOUT BOJIŠTĚ',()=>{$('modal').hidden=true;canvas.focus();},true]]);beep(victory?'complete':'warning');
}
function attachInput(){
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    const r=canvas.getBoundingClientRect();pointer={x:e.clientX-r.left,y:e.clientY-r.top,inside:true};canvas.focus();canvas.setPointerCapture(e.pointerId);
    if(e.button===1){pan={x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y};e.preventDefault();return;}
    if(e.button===2){if(placement){cancelMode();return}const p=toWorld(pointer.x,pointer.y);command(p.x,p.y);e.preventDefault();return;}
    if(e.button!==0||game.paused||!game.started||game.ended)return;
    if(placement){const p=toWorld(pointer.x,pointer.y);place(p.x,p.y);return;}
    if(attackMode){const p=toWorld(pointer.x,pointer.y);command(p.x,p.y,true);return;}
    drag={x:pointer.x,y:pointer.y,shift:e.shiftKey};
  });
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();pointer={x:e.clientX-r.left,y:e.clientY-r.top,inside:true};if(pan){camera.x=pan.cx-(e.clientX-pan.x)/camera.zoom;camera.y=pan.cy-(e.clientY-pan.y)/camera.zoom;clampCamera();}const p=toWorld(pointer.x,pointer.y);hover=pick(p.x,p.y);$('coordinates').textContent=`X ${String(Math.floor(p.x)).padStart(4,'0')} · Y ${String(Math.floor(p.y)).padStart(4,'0')}`;canvas.style.cursor=placement||attackMode?'crosshair':hover?.team==='enemy'?'crosshair':hover?'pointer':pan?'grabbing':'default';});
  canvas.addEventListener('pointerup',e=>{
    if(e.button===1){pan=null;return;}if(e.button!==0||!drag)return;
    const r=canvas.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top;
    const a=toWorld(drag.x,drag.y),b=toWorld(pointer.x,pointer.y);let ids=[];
    if(Math.hypot(pointer.x-drag.x,pointer.y-drag.y)>5){ids=friendlies().filter(u=>!isBuilding(u)&&u.x>=Math.min(a.x,b.x)&&u.x<=Math.max(a.x,b.x)&&u.y>=Math.min(a.y,b.y)&&u.y<=Math.max(a.y,b.y)).map(u=>u.id);}
    else {const unit=pick(b.x,b.y,'player');if(unit)ids=[unit.id];}
    if(drag.shift){if(ids.length===1&&selected.includes(ids[0]))selected=selected.filter(id=>id!==ids[0]);else selected=[...new Set([...selected,...ids])];}else selected=ids;
    drag=null;beep('click');updateUI();
  });
  canvas.addEventListener('pointercancel',()=>{drag=null;pan=null;});
  canvas.addEventListener('pointerleave',()=>{pointer.inside=false;hover=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(e.deltaY>0?-.08:.08,{x:e.clientX-r.left,y:e.clientY-r.top});},{passive:false});
  mini.addEventListener('contextmenu',e=>e.preventDefault());
  const miniPoint=e=>{const r=mini.getBoundingClientRect();return {x:clamp((e.clientX-r.left)/r.width*2400,0,2400),y:clamp((e.clientY-r.top)/r.height*1600,0,1600)};};
  mini.addEventListener('pointerdown',e=>{const p=miniPoint(e);if(e.button===2){command(p.x,p.y);return}if(e.button!==0)return;miniDrag=true;mini.setPointerCapture(e.pointerId);camera.x=p.x;camera.y=p.y;clampCamera();});
  mini.addEventListener('pointermove',e=>{if(miniDrag){const p=miniPoint(e);camera.x=p.x;camera.y=p.y;clampCamera();}});mini.addEventListener('pointerup',()=>miniDrag=false);mini.addEventListener('pointercancel',()=>miniDrag=false);
  window.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase();
    if(!$('modal').hidden){
      if(key==='escape'){e.preventDefault();if(game.started&&!game.ended){closeModal();game.paused=false;}}
      if(key==='tab'){const buttons=[...$('modal').querySelectorAll('button')];const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      return;
    }
    if(['arrowleft','arrowright','arrowup','arrowdown',' ','f2'].includes(key))e.preventDefault();keys.add(key);if(e.repeat)return;
    if(key==='escape'){if(placement||attackMode||drag){cancelMode();drag=null;}else pauseMenu();}
    if(key===' '){home();return;}if(game.ended||game.paused||!game.started)return;
    if(key==='a'){attackMode=!attackMode;placement=null;$('placement-banner').hidden=true;$('attack').classList.toggle('active',attackMode);$('order-mode').textContent=attackMode?'VYBERTE CÍL':'PŘIPRAVEN';setTip(attackMode?'Klikněte na cíl. Jednotky napadnou nepřítele po cestě.':'Pravým tlačítkem vydejte rozkaz.');}
    if(key==='s')stopSelected();if(key==='r')repairSelected();if(key==='f2')selectArmy();if(key==='h')for(const unit of friendlies().filter(u=>selected.includes(u.id)&&u.type==='harvester')){unit.order={kind:'harvest'};unit.path=[];unit.pathTimer=0;}
    if(/^[1-9]$/.test(key)){e.preventDefault();if(e.ctrlKey||e.metaKey){groups[key]=[...selected];notify(`Skupina ${key} uložena (${selected.length} jednotek).`);}else if(groups[key]){selected=groups[key].filter(id=>game.entities.some(e=>e.id===id&&alive(e)));updateUI();}}
  });
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>{keys.clear();drag=null;pan=null;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.started&&!game.paused&&!game.ended){pauseMenu();}});
  $('tab-buildings').addEventListener('click',()=>switchTab('buildings'));$('tab-units').addEventListener('click',()=>switchTab('units'));
  $('pause').addEventListener('click',pauseMenu);$('help').addEventListener('click',()=>help());$('briefing-button').addEventListener('click',briefing);$('sound').addEventListener('click',toggleSound);
  $('zoom-in').addEventListener('click',()=>zoom(.1));$('zoom-out').addEventListener('click',()=>zoom(-.1));$('home').addEventListener('click',home);
  $('attack').addEventListener('click',()=>{if(!game.started||game.paused||game.ended)return;placement=null;$('placement-banner').hidden=true;attackMode=!attackMode;$('attack').classList.toggle('active',attackMode);$('order-mode').textContent=attackMode?'VYBERTE CÍL':'PŘIPRAVEN';setTip(attackMode?'Klikněte na cíl. Jednotky napadnou nepřítele po cestě.':'Pravým tlačítkem vydejte rozkaz.');});
  $('stop').addEventListener('click',()=>{if(!game.paused&&!game.ended)stopSelected();});$('repair').addEventListener('click',()=>{if(!game.paused&&!game.ended)repairSelected();});$('select-army').addEventListener('click',selectArmy);
  $('speed').addEventListener('click',()=>{game.speed=game.speed===1?2:1;$('speed').textContent=`${game.speed}×`;});window.addEventListener('resize',resize);
}
function switchTab(tab){currentTab=tab;for(const b of document.querySelectorAll('[data-tab]')){const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));}buildCards();$('build-description').textContent=tab==='buildings'?'Rozšiřte základnu a připravte se k útoku.':'Kliknutím zařadíte jednotku do výroby.';}
function frame(now){
  const dt=Math.min((now-last)/1000||.016,.05);last=now;
  if($('modal').hidden){const step=dt*600/camera.zoom;if(keys.has('arrowleft'))camera.x-=step;if(keys.has('arrowright'))camera.x+=step;if(keys.has('arrowup'))camera.y-=step;if(keys.has('arrowdown'))camera.y+=step;clampCamera();}
  // Fixed small simulation steps keep movement and collisions stable at 2× speed.
  let remaining=dt*game.speed;while(remaining>0){const sub=Math.min(remaining,.025);update(sub);remaining-=sub;}
  render();uiClock+=dt;if(uiClock>.15){updateUI();uiClock=0;}requestAnimationFrame(frame);
}
function loadImage(img,src){return new Promise(resolve=>{img.onload=()=>resolve(true);img.onerror=()=>resolve(false);img.src=src;});}
Promise.all([loadImage(terrain,'assets/terrain.png'),loadImage(atlas,'assets/buildings.png'),loadImage(vehicles,'assets/vehicles-cz.png'),loadImage(quarry,'assets/quarry.png')]).then(results=>{
  resize();reset();attachInput();briefing();requestAnimationFrame(frame);
  if(results.includes(false))notify('Některou texturu nelze načíst. Zkontrolujte složku assets.','gold');
  // Read-only diagnostics are useful for development and offline smoke tests.
  window.IronFront={getState:()=>({time:game.time,credits:game.credits,energy:{...game.energy},started:game.started,paused:game.paused,ended:game.ended,wave:game.wave,kills:game.kills,gathered:game.gathered,selected:[...selected],queue:game.queue.map(q=>({...q})),camera:{...camera},entities:game.entities.map(e=>({id:e.id,type:e.type,team:e.team,x:e.x,y:e.y,hp:e.hp,load:e.load,order:e.order?{...e.order}:null,pathLength:e.path.length})),assets:results}),worldToScreen:(x,y)=>({x:(x-camera.x)*camera.zoom+viewW/2,y:(y-camera.y)*camera.zoom+viewH/2})};
  if(new URLSearchParams(location.search).has('test'))window.IronFront.test={reset:()=>{reset();start();},step:seconds=>{for(let i=0;i<seconds*40&&!game.ended;i++)update(.025);reveal();updateUI();},pathfind,canPlace,buy,place,command,damage:(id,n)=>{const e=game.entities.find(e=>e.id===id);damage(e,n,'player');},select:ids=>{selected=[...ids];updateUI();},spawn:entity,reveal,updateUI,render,setCredits:n=>{game.credits=n;},setCamera:(x,y)=>{camera.x=x;camera.y=y;clampCamera();}};
});
})();
