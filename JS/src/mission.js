import * as THREE from 'three';
import { makeCharacter } from './character.js';
import { clamp, damp, resolveCircle } from './physics.js';
import { DIFFICULTIES, OBJECTIVES, applyPickup, damageHealth, canInteract, lineClear, makeNavigator } from './mission-rules.js';
import { seeded } from './world.js';

const SPAWNS=[
  [2,-3,[[2,-3],[3,-12]]],[-12,-14,[[-12,-14],[-22,-14]]],[12,-16,[[12,-16],[23,-16]]],
  [-4,-29,[[-4,-29],[-4,-42]]],[10,-38,[[10,-38],[21,-39]]],[3,-43,[[3,-43],[3,-35]]],
  [-19,-50,[[-19,-50],[-24,-46]]],[-5,-57,[[-5,-57],[-3,-48]]],
  [-26,-22,[[-26,-22],[-20,-21]]],[23,-47,[[23,-47],[12,-48]]],[-27,7,[[-27,7],[-18,9]]],[27,-24,[[27,-24],[24,-20]]],
];
export class BaghdadMission {
  constructor(world,state,hooks){this.world=world;this.state=state;this.hooks=hooks;this.enemies=[];this.nav=makeNavigator(world.obstacles);this.random=seeded(42);this.ray=new THREE.Raycaster();this.root=new THREE.Group();world.scene.add(this.root);this.stage=0;this.progress=0;this.upload=0;this.transmitting=false;this.finished=false;this.effects=[];}
  async init(){
    for(let i=0;i<SPAWNS.length;i++){
      const actor=await makeCharacter(this.root);actor.root.position.set(SPAWNS[i][0],0,SPAWNS[i][1]);
      actor.model.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.color.set('#b4a083');o.material.roughness=.92;}});
      const hitMaterial=new THREE.MeshBasicMaterial({visible:false});
      const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.26,.74,3,7),hitMaterial);torso.position.y=.96;actor.root.add(torso);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.19,8,6),hitMaterial);head.position.y=1.66;actor.root.add(head);
      const enemy={id:i+1,actor,torso,head,health:100,alive:true,active:true,path:[],patrol:0,yaw:Math.PI,awareness:0,mode:'patrol',lastKnown:null,seenAt:-100,think:i*.03,pose:0,shotAt:0,rounds:24,reload:0,burst:0,moveTimer:0,speed:0,spottedUntil:0,recoil:0};
      torso.userData.enemy=head.userData.enemy=enemy;head.userData.head=true;this.enemies.push(enemy);
    }
    this.reset('regular');
  }
  reset(difficulty){
    this.settings=DIFFICULTIES[difficulty]||DIFFICULTIES.regular;this.state.difficulty=difficulty;this.state.health=100;this.state.reserve=this.settings.reserve;this.state.ammo=30;this.state.kills=0;this.state.damageFlash=0;this.state.lastDamage=-100;this.stage=0;this.progress=0;this.upload=0;this.transmitting=false;this.finished=false;this.random=seeded(147);this.world.reset();
    for(const fx of this.effects){fx.mesh.removeFromParent();fx.mesh.geometry.dispose();fx.mesh.material.dispose();}this.effects.length=0;
    this.world.shootMeshes=this.world.shootMeshes.filter(o=>!o.userData.enemy);
    for(let i=0;i<this.enemies.length;i++){const e=this.enemies[i];Object.assign(e,{health:100,alive:true,active:i<this.settings.enemies,path:[],patrol:0,yaw:i%2?Math.PI/2:0,awareness:0,mode:'patrol',lastKnown:null,seenAt:-100,think:i*.03,pose:0,shotAt:3,rounds:24,reload:0,burst:0,moveTimer:0,speed:0,spottedUntil:0,recoil:0});e.actor.root.position.set(SPAWNS[i][0],0,SPAWNS[i][1]);e.actor.root.rotation.set(0,e.yaw,0);e.actor.root.visible=e.active;e.torso.visible=e.head.visible=true;if(e.active)this.world.shootMeshes.push(e.torso,e.head);this.pose(e,.016);}
    this.world.mission=this;
  }
  get objective(){return OBJECTIVES[Math.min(this.stage,3)];}
  get completed(){return this.finished&&this.state.health>0;}
  hearShot(point,radius=42){for(const e of this.enemies){if(!e.active||!e.alive||e.actor.root.position.distanceTo(point)>radius)continue;e.lastKnown={x:point.x,z:point.z};e.seenAt=this.state.time;e.awareness=Math.max(e.awareness,.5);if(e.mode==='patrol')e.mode='investigate';e.think=0;}}
  damage(amount,source){if(this.finished||this.state.health<=0)return;this.state.health=damageHealth(this.state.health,amount);this.state.lastDamage=this.state.time;this.state.damageFlash=1;this.state.damageYaw=Math.atan2(source.x-this.state.position.x,source.z-this.state.position.z);this.progress=0;this.hooks.hurt?.();if(this.state.health===0){this.finished=true;this.hooks.finish(false);}}
  hit(enemy,head=false){if(!enemy.alive||!enemy.active)return false;enemy.health=damageHealth(enemy.health,head?100:38);enemy.spottedUntil=this.state.time+5;enemy.lastKnown={x:this.state.position.x,z:this.state.position.z};enemy.seenAt=this.state.time;enemy.mode='combat';enemy.awareness=1;enemy.think=0;enemy.shotAt=Math.max(enemy.shotAt,this.state.time+.45);this.hearShot(this.state.position,24);if(enemy.health<=0){enemy.alive=false;enemy.mode='down';enemy.torso.visible=enemy.head.visible=false;this.world.shootMeshes=this.world.shootMeshes.filter(o=>o.userData.enemy!==enemy);this.state.kills++;this.state.score+=100;enemy.actor.flash.visible=false;enemy.actor.flashLight.intensity=0;}return true;}
  interaction(){
    const s=this.state,obj=this.objective;
    if(this.finished)return null;
    if(!this.transmitting&&canInteract(s.position,obj,this.world.obstacles))return {type:'objective',target:obj,text:obj.action};
    const items=this.world.pickups.filter(i=>!i.taken&&canInteract(s.position,i,this.world.obstacles,2)).sort((a,b)=>Math.hypot(a.x-s.position.x,a.z-s.position.z)-Math.hypot(b.x-s.position.x,b.z-s.position.z));
    if(items.length){const target=items[0],full=target.type==='medkit'?s.health>=100:s.reserve>=240;return {type:'pickup',target,full,text:full?(target.type==='medkit'?'ZDRAVÍ JE PLNÉ':'REZERVA JE PLNÁ'):(target.type==='medkit'?`LÉKÁRNIČKA · +${this.settings.medkit} ZDRAVÍ`:`MUNICE · +${this.settings.ammo} NÁBOJŮ`)};}
    return null;
  }
  interact(){const item=this.interaction();if(item?.type!=='pickup')return;const added=applyPickup(this.state,item.target,this.settings);if(added){item.target.mesh.visible=false;this.hooks.notify(item.target.type==='medkit'?`Ošetření · +${added} zdraví`:`Munice · +${added} nábojů`);this.hooks.pickup?.();}}
  advance(){
    this.progress=0;
    if(this.stage===0){this.world.powerLight.intensity=5;this.world.statusLamp.material.emissive.set('#7bd292');this.stage++;this.state.score+=250;this.hooks.notify('Napájení obnoveno. Zajistěte seznam pacientů v klinice.',5);}
    else if(this.stage===1){this.world.records.visible=false;this.stage++;this.state.score+=250;this.hooks.notify('Evakuační seznam zajištěn. Předejte souřadnice rádiem.',5);}
    else if(this.stage===2){this.transmitting=true;this.hearShot(new THREE.Vector3(this.objective.x,0,this.objective.z),52);this.hooks.notify('Přenos zahájen. Zůstaňte do 12 metrů od rádia po dobu 25 sekund.',6);}
    else {this.finished=true;this.state.score+=500;this.hooks.finish(true);}
    this.hooks.objective?.();
  }
  plan(enemy,goal){enemy.path=this.nav.path(enemy.actor.root.position,goal);}
  think(enemy){
    const p=enemy.actor.root.position,s=this.state,eye={x:p.x,y:1.5,z:p.z},target={x:s.position.x,y:s.crouched?.93:1.4,z:s.position.z};
    const distance=Math.hypot(target.x-p.x,target.z-p.z),dot=distance?(-Math.sin(enemy.yaw)*(target.x-p.x)-Math.cos(enemy.yaw)*(target.z-p.z))/distance:1;
    const visible=distance<this.settings.sight*(s.crouched?.8:1)&&(enemy.mode!=='patrol'||dot>.12||distance<6)&&lineClear(eye,target,this.world.obstacles);
    enemy.canSee=visible;
    if(visible){enemy.awareness=clamp(enemy.awareness+.2/this.settings.reaction,0,1);enemy.lastKnown={x:target.x,z:target.z};enemy.seenAt=s.time;if(enemy.awareness>=1){if(enemy.mode!=='combat')enemy.shotAt=Math.max(enemy.shotAt,s.time+.3);enemy.mode='combat';enemy.spottedUntil=s.time+3;}}
    else enemy.awareness=Math.max(0,enemy.awareness-.08);
    if(enemy.mode==='combat'&&!visible&&s.time-enemy.seenAt>2){enemy.mode='search';enemy.moveTimer=0;}
    if((enemy.mode==='search'||enemy.mode==='investigate')&&s.time-enemy.seenAt>14){enemy.mode='patrol';enemy.lastKnown=null;enemy.path=[];}
    enemy.moveTimer-=.2;
    if(enemy.mode==='patrol'){if(enemy.path.length===0){const route=SPAWNS[enemy.id-1][2];enemy.patrol=(enemy.patrol+1)%route.length;this.plan(enemy,{x:route[enemy.patrol][0],z:route[enemy.patrol][1]});}}
    else if(enemy.mode==='combat'){
      if(enemy.moveTimer<=0){enemy.moveTimer=3+this.random()*3;
        // Wounded/reloading guards prefer cover; others flank the last observed
        // position. Destination is never the player's hidden live position.
        let options=this.world.coverPoints.filter(c=>Math.hypot(c.x-p.x,c.z-p.z)<16&&Math.hypot(c.x-target.x,c.z-target.z)>5);
        const hiding=enemy.health<50||enemy.reload>0;
        options=options.filter(c=>hiding?!lineClear({x:c.x,y:.8,z:c.z},target,this.world.obstacles):lineClear({x:c.x,y:1.5,z:c.z},target,this.world.obstacles));
        if(options.length){options.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));this.plan(enemy,options[Math.min(options.length-1,enemy.id%3)]);}else if(distance>20&&enemy.lastKnown)this.plan(enemy,enemy.lastKnown);
      }
    }else if(enemy.moveTimer<=0&&enemy.lastKnown){enemy.moveTimer=3;const goal={...enemy.lastKnown};if(Math.hypot(goal.x-p.x,goal.z-p.z)<2){goal.x+=(this.random()-.5)*8;goal.z+=(this.random()-.5)*8;}this.plan(enemy,goal);}
  }
  fire(enemy){
    const s=this.state,p=enemy.actor.root.position,origin=enemy.actor.muzzle.getWorldPosition(new THREE.Vector3());
    // Shoulder check prevents a weapon protruding through a wall from firing.
    if(!lineClear({x:p.x,y:1.4,z:p.z},origin,this.world.obstacles))return;
    const target=s.position.clone();target.y=s.crouched?.85:1.13;const distance=origin.distanceTo(target),spread=this.settings.spread*distance*(s.speed>3?1.3:1);
    target.x+=(this.random()-.5)*spread*2;target.y+=(this.random()-.5)*spread*1.5;target.z+=(this.random()-.5)*spread;
    const direction=target.clone().sub(origin).normalize();this.ray.set(origin,direction);this.ray.far=55;
    const block=this.ray.intersectObjects(this.world.shootMeshes.filter(m=>!m.userData.enemy),false)[0];let end=block?.point||origin.clone().addScaledVector(direction,55);
    const hitPoint=new THREE.Vector3(),body=new THREE.Sphere(s.position.clone().add(new THREE.Vector3(0,s.crouched?.72:1.05,0)),s.crouched?.38:.44);
    const hit=this.ray.ray.intersectSphere(body,hitPoint);
    if(hit&&origin.distanceTo(hitPoint)<origin.distanceTo(end)){end=hitPoint.clone();this.damage(this.settings.damage,p);}
    const mesh=new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin,end]),new THREE.LineBasicMaterial({color:'#f0c991',transparent:true,opacity:.58}));this.root.add(mesh);this.effects.push({mesh,life:.085});enemy.recoil=1;enemy.rounds--;enemy.burst++;
    enemy.shotAt=s.time+(enemy.burst>=3?.95+this.random()*.8:.17);if(enemy.burst>=3)enemy.burst=0;if(enemy.rounds===0){enemy.reload=2.5;enemy.moveTimer=0;}
    this.hooks.enemyShot?.(Math.min(1,14/distance));
  }
  pose(e,dt){e.actor.update(dt,{speed:e.speed,sprint:false,crouched:e.mode==='combat'&&e.health<50&&e.speed<.1,aiming:e.mode==='combat',yaw:e.yaw,pitch:0,reload:e.reload>0?1-e.reload/2.5:0,recoil:e.recoil,time:this.state.time,moveX:0,moveZ:e.speed>0?1:0});e.torso.position.y=.96-e.actor.crouch*.4;e.head.position.y=1.66-e.actor.crouch*.48;}
  update(dt,held){
    if(this.finished)return;
    const s=this.state;s.damageFlash=Math.max(0,s.damageFlash-dt*1.6);
    const interaction=this.interaction();
    if(held&&interaction?.type==='objective'&&s.speed<.5&&s.reload===0&&s.time-s.lastDamage>.8){this.progress+=dt/interaction.target.duration;if(this.progress>=1)this.advance();}else this.progress=0;
    if(this.finished)return;
    if(this.transmitting){const near=Math.hypot(s.position.x-this.objective.x,s.position.z-this.objective.z)<=12;if(near)this.upload+=dt;if(this.upload>=25){this.transmitting=false;this.stage=3;this.state.score+=400;this.hooks.notify('Evakuace potvrzena. Vraťte se k vozidlu na jižním kontrolním bodě.',6);this.hooks.objective?.();}}
    for(const e of this.enemies){if(!e.active)continue;if(!e.alive){e.actor.root.rotation.z=damp(e.actor.root.rotation.z,1.48,7,dt);e.actor.root.position.y=damp(e.actor.root.position.y,.24,7,dt);continue;}
      e.think-=dt;if(e.think<=0){e.think=.2;this.think(e);}
      const p=e.actor.root.position,before=p.clone();
      if(e.path.length){const goal=e.path[0],dx=goal.x-p.x,dz=goal.z-p.z,dist=Math.hypot(dx,dz);if(dist<.18)e.path.shift();else{const speed=(e.mode==='patrol'?.85:this.settings.enemySpeed)*Math.min(1,dist/(dt*2));const next=resolveCircle({x:p.x+dx/dist*speed*dt,z:p.z+dz/dist*speed*dt},.32,this.world.obstacles);p.x=next.x;p.z=next.z;}}
      // Separate nearby actors without letting crowd avoidance push through walls.
      for(const other of this.enemies){if(other===e||!other.active||!other.alive)continue;const op=other.actor.root.position,dx=p.x-op.x,dz=p.z-op.z,d=Math.hypot(dx,dz);if(d>.001&&d<.65){const next=resolveCircle({x:p.x+dx/d*dt*.7,z:p.z+dz/d*dt*.7},.32,this.world.obstacles);p.x=next.x;p.z=next.z;}}
      e.speed=before.distanceTo(p)/dt;
      const face=e.canSee&&e.mode==='combat'?s.position:e.path[0]||e.lastKnown;
      if(face){const goal=Math.atan2(-(face.x-p.x),-(face.z-p.z));e.yaw+=Math.atan2(Math.sin(goal-e.yaw),Math.cos(goal-e.yaw))*Math.min(1,dt*7);}
      e.recoil=Math.max(0,e.recoil-dt*9);if(e.reload>0){e.reload=Math.max(0,e.reload-dt);if(e.reload===0)e.rounds=24;}
      e.pose+=dt;if(e.pose>.065){this.pose(e,e.pose);e.pose=0;}
      if(e.mode==='combat'&&e.canSee&&e.reload===0&&s.time>=e.shotAt&&e.awareness>=1){const target={x:s.position.x,y:s.crouched?.9:1.4,z:s.position.z};if(lineClear({x:p.x,y:1.45,z:p.z},target,this.world.obstacles))this.fire(e);}
      if(this.finished)break;
    }
    for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.life-=dt;if(e.life<=0){e.mesh.removeFromParent();e.mesh.geometry.dispose();e.mesh.material.dispose();this.effects.splice(i,1);}}
  }
}
