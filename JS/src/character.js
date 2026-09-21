import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import modelData from '../tmp/model.js';
import { damp, clamp } from './physics.js';
const V=()=>new THREE.Vector3(), Q=()=>new THREE.Quaternion();
let loadedCharacter;
function pointBone(bone,child,point){
  const start=bone.getWorldPosition(V()),current=child.getWorldPosition(V()).sub(start).normalize(),desired=point.clone().sub(start).normalize();
  const rotation=new THREE.Quaternion().setFromUnitVectors(current,desired).multiply(bone.getWorldQuaternion(Q()));
  bone.quaternion.copy(bone.parent.getWorldQuaternion(Q()).invert().multiply(rotation));bone.updateWorldMatrix(false,true);
}
function twoBone(upper,lower,end,target,pole){
  const a=upper.getWorldPosition(V()),b=lower.getWorldPosition(V()),c=end.getWorldPosition(V());
  const l1=a.distanceTo(b),l2=b.distanceTo(c),direction=target.clone().sub(a),dist=clamp(direction.length(),Math.abs(l1-l2)+.001,l1+l2-.002);direction.normalize();
  const along=(l1*l1-l2*l2+dist*dist)/(2*dist),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  const bend=pole.clone().sub(a);bend.addScaledVector(direction,-bend.dot(direction)).normalize();
  const elbow=a.clone().addScaledVector(direction,along).addScaledVector(bend,height);
  pointBone(upper,lower,elbow);pointBone(lower,end,target);
}
export async function makeCharacter(scene){
  loadedCharacter??=new GLTFLoader().parseAsync(Uint8Array.from(atob(modelData),c=>c.charCodeAt(0)).buffer,'');
  const gltf=await loadedCharacter;
  const root=new THREE.Group(),model=clone(gltf.scene);root.add(model);scene.add(root);root.position.set(0,0,18);
  const bones={},rest={};model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){o.material.roughness=.84;o.material.metalness=.13;if(o.material.map)o.material.map.anisotropy=8;}}if(o.isBone){const name=o.name.replace('mixamorig','').replace(':','');bones[name]=o;rest[name]={q:o.quaternion.clone(),p:o.position.clone()};}});
  root.updateMatrixWorld(true);
  const feetRest={};for(const side of ['Left','Right'])feetRest[side]=bones[side+'Foot'].getWorldQuaternion(Q());
  const mixer=new THREE.AnimationMixer(model),actions={};
  for(const clip of gltf.animations){if(clip.name==='TPose')continue;const inPlace=clip.clone();for(const track of inPlace.tracks){if(track.name.endsWith('Hips.position')){for(let i=0;i<track.values.length;i+=3){track.values[i]=rest.Hips.p.x;track.values[i+1]=rest.Hips.p.y;}}}actions[clip.name]=mixer.clipAction(inPlace);actions[clip.name].play();actions[clip.name].setEffectiveWeight(clip.name==='Idle'?1:0);}
  const weapon=new THREE.Group();weapon.scale.setScalar(.76);root.add(weapon);
  const steel=new THREE.MeshStandardMaterial({color:'#303c37',roughness:.45,metalness:.8}),polymer=new THREE.MeshStandardMaterial({color:'#3f4a37',roughness:.77,metalness:.1}),edge=new THREE.MeshStandardMaterial({color:'#818376',roughness:.5,metalness:.8});
  function part(w,h,d,x,y,z,mat=steel){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;weapon.add(mesh);return mesh;}
  // The weapon points down local -Z; its root is the trigger-hand grip.
  part(.092,.13,.29,0,.09,-.03);part(.11,.12,.35,0,.07,-.35,polymer);part(.085,.16,.08,0,-.04,.03,polymer).rotation.x=-.23;const magazine=part(.085,.25,.1,0,-.08,-.1,polymer);magazine.rotation.x=.14;
  part(.09,.10,.23,0,.07,.23,polymer);part(.12,.20,.045,0,.035,.35,polymer);part(.08,.025,.53,0,.169,-.2);part(.13,.012,.29,0,.025,-.36);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.019,.022,.3,12),steel);barrel.rotation.x=Math.PI/2;barrel.position.set(0,.09,-.66);barrel.castShadow=true;weapon.add(barrel);
  const muzzleBrake=new THREE.Mesh(new THREE.CylinderGeometry(.027,.027,.07,10),steel);muzzleBrake.rotation.x=Math.PI/2;muzzleBrake.position.set(0,.09,-.83);weapon.add(muzzleBrake);
  for(let i=0;i<7;i++){part(.115,.018,.013,0,.14,-.22-i*.038,edge);part(.005,.04,.018,.057,.075,-.22-i*.038,steel);}
  part(.09,.05,.07,0,.205,.015,polymer);part(.072,.07,.052,0,.255,.015);part(.04,.026,.006,0,.255,-.015,new THREE.MeshStandardMaterial({color:'#5a967b',emissive:'#305341',metalness:.5,roughness:.13}));
  const muzzle=new THREE.Object3D();muzzle.position.set(0,.09,-.87);weapon.add(muzzle);
  const flash=new THREE.Mesh(new THREE.OctahedronGeometry(.08),new THREE.MeshBasicMaterial({color:'#ffe6ac',transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending}));flash.position.copy(muzzle.position);flash.scale.set(.65,.65,2.2);flash.visible=false;weapon.add(flash);
  const flashLight=new THREE.PointLight('#ffc774',0,3,2);flashLight.position.copy(muzzle.position);weapon.add(flashLight);
  // Batch rigid gun parts; the magazine and muzzle flash remain animated.
  const batches=new Map();
  for(const part of [...weapon.children]){if(!part.isMesh||part===magazine||part===flash)continue;part.updateMatrix();const geometry=(part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone()).applyMatrix4(part.matrix);if(!batches.has(part.material))batches.set(part.material,[]);batches.get(part.material).push(geometry);weapon.remove(part);part.geometry.dispose();}
  for(const [material,geometries] of batches){const mesh=new THREE.Mesh(mergeGeometries(geometries),material);mesh.castShadow=true;weapon.add(mesh);for(const geometry of geometries)geometry.dispose();}
  const state={root,model,bones,weapon,muzzle,mixer,actions,flash,flashLight,crouch:0,aim:0,gait:0,weights:{Idle:1,Walk:0,Run:0},clips:gltf.animations.map(a=>a.name),boneCount:Object.keys(bones).length};
  state.update=(dt,input)=>{
    const {speed,sprint,crouched,aiming,yaw,pitch,reload,recoil,time,moveX,moveZ}=input;
    state.crouch=damp(state.crouch,crouched?1:0,10,dt);state.aim=damp(state.aim,aiming?1:0,12,dt);root.rotation.y=yaw;
    // Restore the skeleton before sampling so procedural layers never accumulate.
    for(const name in bones){bones[name].quaternion.copy(rest[name].q);bones[name].position.copy(rest[name].p);}
    const moving=clamp(speed/1.2,0,1),run=sprint?moving:0;
    const goal={Idle:1-moving,Walk:moving-run,Run:run};
    for(const name in actions){state.weights[name]=damp(state.weights[name],goal[name]||0,9,dt);actions[name].setEffectiveWeight(state.weights[name]);actions[name].setEffectiveTimeScale(name==='Run'?Math.max(.55,speed/5.1):name==='Walk'?Math.max(.25,speed/1.7):1);}
    mixer.update(dt);root.updateMatrixWorld(true);
    state.gait+=speed*dt*3.3;
    const c=state.crouch;
    if(c>.001){
      // Lower the pelvis in world space, retaining the imported bone hierarchy.
      const hp=bones.Hips.getWorldPosition(V());hp.y-=c*.48;bones.Hips.position.copy(bones.Hips.parent.worldToLocal(hp));root.updateMatrixWorld(true);
      for(const[side,sgn]of[['Left',-1],['Right',1]]){
        const phase=state.gait+(sgn>0?Math.PI:0),motion=clamp(speed,0,1),foot=bones[side+'Foot'];
        const standing=root.worldToLocal(foot.getWorldPosition(V()));
        const kneeling=new THREE.Vector3(sgn*.16,.12+Math.max(0,Math.sin(phase))*.12*motion,sgn>0?.34:-.3);
        kneeling.z+=Math.cos(phase)*.25*motion;
        if(sgn>0)kneeling.y+=.04*(1-motion);
        const target=root.localToWorld(standing.lerp(kneeling,c));
        const pole=root.localToWorld(new THREE.Vector3(sgn*.17,.45,-1.2));
        twoBone(bones[side+'UpLeg'],bones[side+'Leg'],foot,target,pole);
        const desired=root.getWorldQuaternion(Q()).multiply(feetRest[side]);
        const local=foot.parent.getWorldQuaternion(Q()).invert().multiply(desired);foot.quaternion.slerp(local,c*.92);
      }
    }
    // Two-handed aiming/reloading is an actual IK layer on the skinned arms.
    const chest=root.worldToLocal(bones.Spine2.getWorldPosition(V()));
    weapon.position.set(.13,chest.y+.09+state.aim*.10, -.18+recoil*.035);
    weapon.position.y+=Math.sin(state.gait*2)*.011*moving;
    const busy=reload>0?Math.min(1,reload*8,(1-reload)*8):0;
    weapon.rotation.set(pitch*(.35+state.aim*.65)-.14*(1-state.aim)+busy*.32+recoil*.035,0,-busy*.45+Math.sin(state.gait)*.012*moving);
    magazine.visible=reload<.34||reload>.63;magazine.position.y=-.08-(reload>.15&&reload<.76?Math.sin((reload-.15)/.61*Math.PI)*.22:0);
    weapon.updateWorldMatrix(true,true);
    const rightTarget=weapon.localToWorld(new THREE.Vector3(.018,-.02,.07));
    const leftTarget=weapon.localToWorld(new THREE.Vector3(-.025,.005,-.23));
    if(reload>0){const handPath=[new THREE.Vector3(-.025,.005,-.23),new THREE.Vector3(-.02,-.15,-.11),new THREE.Vector3(-.25,-.53,.12),new THREE.Vector3(-.05,-.23,-.12),new THREE.Vector3(-.025,.005,-.23)];const t=clamp(reload*4,0,3.999),i=Math.floor(t);leftTarget.copy(weapon.localToWorld(handPath[i].clone().lerp(handPath[i+1],t-i)));}
    twoBone(bones.RightArm,bones.RightForeArm,bones.RightHand,rightTarget,root.localToWorld(new THREE.Vector3(.70,chest.y-.24,.04)));
    twoBone(bones.LeftArm,bones.LeftForeArm,bones.LeftHand,leftTarget,root.localToWorld(new THREE.Vector3(-.43,chest.y-.31,-.28)));
    // Keep palms oriented along the fore-end instead of leaving open T-pose hands.
    pointBone(bones.RightHand,bones.RightHandMiddle1,weapon.localToWorld(new THREE.Vector3(.02,-.09,-.035)));
    pointBone(bones.LeftHand,bones.LeftHandMiddle1,weapon.localToWorld(new THREE.Vector3(.025,.055,-.30)));
    for(const side of ['Left','Right'])for(const finger of ['Index','Middle','Ring','Pinky'])for(let i=1;i<=3;i++){const b=bones[side+'Hand'+finger+i];if(b)b.rotateZ((side==='Left'?-1:1)*(finger==='Index'&&side==='Right'?.22:.55));}
    bones.Head.rotateX(pitch*.25);root.updateMatrixWorld(true);
    state.flash.visible=recoil>.65;state.flash.rotation.z=time*32;state.flashLight.intensity=recoil>.65?2.5:0;
  };
  return state;
}
