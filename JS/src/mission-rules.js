import { clamp } from './physics.js';

export const DIFFICULTIES = Object.freeze({
  recruit: { name:'Rekrut', reserve:180, damage:8, reaction:1.2, spread:.075, sight:30, enemies:8, medkit:65, ammo:90, enemySpeed:1.45 },
  regular: { name:'Voják', reserve:120, damage:12, reaction:.8, spread:.053, sight:36, enemies:10, medkit:45, ammo:60, enemySpeed:1.8 },
  veteran: { name:'Veterán', reserve:90, damage:18, reaction:.5, spread:.036, sight:42, enemies:12, medkit:30, ammo:45, enemySpeed:2.15 },
});
export const CITY_BOUNDS = { minX:-31, maxX:31, minZ:-62, maxZ:29 };
export const OBJECTIVES = [
  { id:'power', title:'Obnovte napájení kliniky', detail:'Západní servisní dvůr. U rozvaděče podržte E.', x:-23, z:-12, duration:3, action:'OBNOVIT NAPÁJENÍ' },
  { id:'records', title:'Získejte evakuační seznam', detail:'Klinika ve východním dvoře. Vyhledejte dokumenty na stole.', x:20, z:-38, duration:2, action:'ZAJISTIT EVAKUAČNÍ SEZNAM' },
  { id:'radio', title:'Odvysílejte žádost o evakuaci', detail:'Severozápadní stanoviště. Zapněte rádio a zůstaňte v jeho dosahu.', x:-20, z:-54, duration:3, action:'ZAPOJIT VYSÍLAČ' },
  { id:'extract', title:'Vraťte se k evakuačnímu vozidlu', detail:'Jižní kontrolní bod. K dokončení mise podržte E u vozidla.', x:3, z:24, duration:2, action:'DOKONČIT EVAKUACI' },
];
export function damageHealth(health, damage) { return clamp(health-Math.max(0,damage),0,100); }
export function applyPickup(state, item, settings) {
  if(item.taken) return 0;
  const key=item.type==='medkit'?'health':'reserve', cap=key==='health'?100:240;
  const amount=Math.min(cap-state[key],item.amount ?? settings[item.type]);
  if(amount<=0) return 0;
  state[key]+=amount; item.taken=true; return amount;
}
// Slab intersection with cover height. This same query controls sight, hearing
// confirmation, interactions and enemy fire; opaque buildings never reveal players.
export function segmentBox(a,b,box,padding=0) {
  let low=0,high=1;
  for(const [axis,min,max] of [['x',box.minX-padding,box.maxX+padding],['z',box.minZ-padding,box.maxZ+padding],['y',box.minY??0,box.height??20]]) {
    const start=a[axis]??0,end=b[axis]??0,delta=end-start;
    if(Math.abs(delta)<1e-8){if(start<min||start>max)return false;}
    else {let t0=(min-start)/delta,t1=(max-start)/delta;if(t0>t1)[t0,t1]=[t1,t0];low=Math.max(low,t0);high=Math.min(high,t1);if(low>high)return false;}
  }
  return high>.001&&low<.999;
}
export function lineClear(a,b,obstacles,padding=0) { return !obstacles.some(box=>segmentBox(a,b,box,padding)); }
export function canInteract(position, target, obstacles, radius=2.3) {
  return Math.hypot(position.x-target.x,position.z-target.z)<radius && lineClear({x:position.x,z:position.z,y:1.25},{x:target.x,z:target.z,y:target.y??1.1},obstacles);
}
// A* on a fixed walkability grid, including diagonal corner checks. Used for
// patrols, investigating last-known positions and moving between pieces of cover.
export function makeNavigator(obstacles,bounds=CITY_BOUNDS,cell=1) {
  const width=Math.floor((bounds.maxX-bounds.minX)/cell)+1,height=Math.floor((bounds.maxZ-bounds.minZ)/cell)+1;
  const at=(x,z)=>z*width+x, coords=id=>({x:bounds.minX+(id%width)*cell,z:bounds.minZ+Math.floor(id/width)*cell});
  const free=new Uint8Array(width*height);
  for(let z=0;z<height;z++)for(let x=0;x<width;x++){const p=coords(at(x,z));free[at(x,z)]=!obstacles.some(b=>p.x>b.minX-.42&&p.x<b.maxX+.42&&p.z>b.minZ-.42&&p.z<b.maxZ+.42);}
  function nearest(p) {
    const x=clamp(Math.round((p.x-bounds.minX)/cell),0,width-1),z=clamp(Math.round((p.z-bounds.minZ)/cell),0,height-1);
    for(let r=0;r<8;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;const xx=x+dx,zz=z+dz;if(xx>=0&&xx<width&&zz>=0&&zz<height&&free[at(xx,zz)])return at(xx,zz);}
    return -1;
  }
  function path(from,to) {
    const start=nearest(from),end=nearest(to);if(start<0||end<0)return [];
    if(start===end)return [coords(end)];
    const g=new Float32Array(free.length).fill(Infinity),came=new Int32Array(free.length).fill(-1),closed=new Uint8Array(free.length),open=[start];g[start]=0;
    const goal=coords(end),heuristic=id=>{const p=coords(id);return Math.hypot(p.x-goal.x,p.z-goal.z)/cell;};
    while(open.length){let best=0;for(let i=1;i<open.length;i++)if(g[open[i]]+heuristic(open[i])<g[open[best]]+heuristic(open[best]))best=i;const current=open.splice(best,1)[0];if(current===end){const result=[];let id=end;while(id!==start){result.push(coords(id));id=came[id];}return result.reverse();}closed[current]=1;
      const x=current%width,z=Math.floor(current/width);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const xx=x+dx,zz=z+dz;if(xx<0||xx>=width||zz<0||zz>=height)continue;const next=at(xx,zz);if(!free[next]||closed[next]||(dx&&dz&&(!free[at(x+dx,z)]||!free[at(x,z+dz)])))continue;const cost=g[current]+Math.hypot(dx,dz);if(cost<g[next]){g[next]=cost;came[next]=current;if(!open.includes(next))open.push(next);}}
    }
    return [];
  }
  return {path,nearest,coords,free,width,height};
}
