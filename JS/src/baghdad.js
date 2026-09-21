import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import textureData from '../tmp/textures.js';
import propData from '../tmp/props.js';
import { seeded } from './world.js';
import { CITY_BOUNDS, OBJECTIVES } from './mission-rules.js';

export async function makeBaghdad(scene) {
  const random=seeded(2003),staticRoot=new THREE.Group(),obstacles=[],shootMeshes=[],mapObjects=[],coverPoints=[],pickups=[],trees=[];
  scene.add(staticRoot);
  const loader=new THREE.TextureLoader();
  function photo(name,color=false){const t=loader.load(textureData[name]);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(color)t.colorSpace=THREE.SRGBColorSpace;return t;}
  const plaster={map:photo('plastered_wall_05_Diffuse',true),normalMap:photo('plastered_wall_05_nor_gl'),roughnessMap:photo('plastered_wall_05_Rough'),normalScale:new THREE.Vector2(.7,.7)};
  const stone={map:photo('sandstone_blocks_05_Diffuse',true),normalMap:photo('sandstone_blocks_05_nor_gl'),roughnessMap:photo('sandstone_blocks_05_Rough'),normalScale:new THREE.Vector2(.6,.6)};
  const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.9,...extra});
  const m={plaster:material('#d7c5a2',plaster),cream:material('#dfcfab',plaster),ochre:material('#c5a578',plaster),rose:material('#c2a18b',plaster),brick:material('#c3ab89',stone),concrete:material('#aa9b83',plaster),trim:material('#cbb898'),dark:material('#343732'),window:material('#273b3a',{roughness:.4,metalness:.25}),teal:material('#41645d',{metalness:.3}),steel:material('#777d77',{metalness:.6,roughness:.6}),rust:material('#82634e',{metalness:.4}),wood:material('#74614b'),sand:material('#b6a181'),fabric:material('#79715a'),tire:material('#292924'),white:material('#dfd9c2'),yellow:material('#ac9667'),palm:material('#4c6040',{side:THREE.DoubleSide}),bark:material('#76654c')};
  for(const key of ['plaster','cream','ochre','rose'])m[key].color.multiplyScalar(5);
  m.concrete.color.multiplyScalar(2.8);
  function box(x,y,z,w,h,d,mat=m.plaster,collide=false,parent=staticRoot){const g=new THREE.BoxGeometry(w,h,d);if(mat.map){const uv=g.attributes.uv,n=g.attributes.normal;for(let i=0;i<uv.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));uv.setXY(i,uv.getX(i)*(nx>.5?d:w)/3,uv.getY(i)*(ny>.5?d:h)/3);}}const o=new THREE.Mesh(g,mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);if(collide){obstacles.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,minY:Math.max(0,y-h/2),height:y+h/2});shootMeshes.push(o);mapObjects.push({x,z,w,d,type:h>3?'building':'cover'});}return o;}
  function cylinder(x,y,z,r,h,mat=m.steel,parent=staticRoot,segments=12){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
  function sign(text,sub,x,y,z,w=3,h=.7,bg='#35534e',rotation=0,parent=staticRoot){const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,1024,256);ctx.fillStyle='#e7ddbc';ctx.textAlign='center';ctx.font='bold 87px Segoe UI';ctx.fillText(text,512,115);ctx.font='34px Bahnschrift, sans-serif';ctx.fillStyle='#d3c39d';ctx.fillText(sub,512,190);ctx.strokeStyle='#d9c49e70';ctx.lineWidth=4;ctx.strokeRect(12,12,1000,232);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material('#ffffff',{map:t,side:THREE.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.y=rotation;parent.add(mesh);return mesh;}
  function wire(a,b,sag=.5,radius=.018,mat=m.dark){const points=[];for(let i=0;i<=12;i++){const t=i/12;points.push(new THREE.Vector3(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t-Math.sin(t*Math.PI)*sag,a[2]+(b[2]-a[2])*t));}const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),16,radius,4,false),mat);staticRoot.add(mesh);return mesh;}
  scene.background=new THREE.Color('#d9d1ba');scene.fog=new THREE.FogExp2('#d5c6a9',.0065);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(350,32,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 v;void main(){vec3 d=normalize(v);float s=max(dot(d,normalize(vec3(-.45,.65,.3))),0.);vec3 c=mix(vec3(.78,.72,.60),vec3(.32,.49,.57),pow(max(d.y,0.),.48));c+=vec3(.5,.36,.2)*pow(s,90.)+vec3(.7,.55,.33)*pow(s,1600.);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));scene.add(sky);
  scene.add(new THREE.HemisphereLight('#d5decc','#80715c',2.1));const sun=new THREE.DirectionalLight('#ffe1ad',3.5);sun.position.set(-32,55,25);sun.target.position.set(0,0,-18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-55,right:55,top:62,bottom:-62,near:.5,far:170});sun.shadow.bias=-.0002;sun.shadow.normalBias=.045;scene.add(sun,sun.target);
  const asphalt=material('#baa88b',{map:photo('asphalt_02_Diffuse',true),normalMap:photo('asphalt_02_nor_gl'),roughnessMap:photo('asphalt_02_Rough')});
  box(0,-.15,-15,260,.25,260,m.sand);const floor=box(0,-.055,-16,65,.1,94,asphalt);shootMeshes.push(floor);
  mapObjects.push({x:0,z:-16,w:12,d:92,type:'road'});
  for(const z of [7,-21,-49])mapObjects.push({x:0,z,w:62,d:8,type:'road'});
  // Sidewalk edges are deliberately low enough to walk over without a jump key.
  for(const side of [-1,1])for(const [z,d] of [[20,16],[-5,16],[-34,18],[-58,12]]){
    box(side*7,.055,z,2,.12,d,m.concrete);
    for(let k=0;k<d;k+=1.5)box(side*6,.10,z-d/2+k+.7,.22,.2,1.35,k%3===0?m.white:m.yellow);
  }
  for(let z=22;z>-60;z-=6)box(0,.006,z,.12,.014,2.2,m.yellow);
  const tones=[m.plaster,m.cream,m.ochre,m.rose];
  function building(x,z,w,d,h,style=0){const mat=tones[style%4];box(x,h/2,z,w,h,d,mat,true);box(x,.35,z,w+.12,.7,d+.12,m.brick);box(x,h+.1,z,w+.45,.24,d+.45,m.trim);box(x,h+.55,z-d/2,.26,.9,d*.015+ .3,m.trim);for(const dz of [-d/2,d/2])box(x,h+.5,z+dz,w,.8,.18,mat);for(const dx of [-w/2,w/2])box(x+dx,h+.5,z,.18,.8,d,mat);
    // Deep window surrounds, external blinds, AC units and exposed lintels.
    for(const side of [-1,1])for(let xx=-w/2+1.5;xx<w/2-1;xx+=2.7)for(let y=2.3;y<h-1;y+=3){const zz=z+side*(d/2+.018);box(x+xx,y,zz,1.2,1.55,.09,m.trim);box(x+xx,y,zz+side*.065,1.02,1.33,.08,m.window);box(x+xx,y-.75,zz+side*.17,1.37,.12,.45,m.trim);box(x+xx,y,zz+side*.14,.055,1.35,.07,m.teal);if(random()<.4){for(let j=0;j<5;j++)box(x+xx,y-.5+j*.23,zz+side*.17,1.0,.13,.1,m.teal);}if(y>3&&random()<.34){box(x+xx+.85,y-.5,zz+side*.3,.68,.45,.48,m.white);for(let j=0;j<5;j++)box(x+xx+.85,y-.64+j*.068,zz+side*.55,.52,.025,.015,m.dark);}}
    for(const side of [-1,1])for(let zz=-d/2+1.6;zz<d/2-1;zz+=3)for(let y=2.4;y<h-1;y+=3){box(x+side*(w/2+.025),y,z+zz,.08,1.5,1.1,m.trim);box(x+side*(w/2+.08),y,z+zz,.045,1.3,.9,m.window);box(x+side*(w/2+.11),y,z+zz,.06,1.3,.06,m.teal);}
    const faceZ=z+d/2+.08;box(x,1.2,faceZ,1.25,2.4,.12,m.teal);box(x+.4,1.2,faceZ+.09,.07,.16,.09,m.steel);
    if(style%2===0){box(x,3.65,faceZ+.55,3.6,.18,1.25,m.trim);box(x,4.13,faceZ+1.1,3.6,.08,.08,m.rust);for(let i=0;i<12;i++)box(x-1.6+i*.29,3.95,faceZ+1.1,.035,.6,.035,m.rust);}
    cylinder(x+w*.25,h+.85,z,.62,1.1,m.dark);for(let y=0;y<3;y++)cylinder(x+w*.25,h+.45+y*.34,z,.65,.065,m.steel);
    const dish=new THREE.Mesh(new THREE.SphereGeometry(.7,16,8,0,Math.PI*2,0,.9),m.white);dish.position.set(x-w*.23,h+1,z-.5);dish.rotation.set(.9,0,.4);staticRoot.add(dish);cylinder(x-w*.23,h+.5,z-.5,.04,1,m.steel);
  }
  // A fictional Baghdad block: flat roofs, dense sand-coloured masonry and courts.
  for(const spec of [
    [-14,20,12,11,8,0],[-26,20,8,12,6.5,2],[15,20,13,10,9.5,1],[27,20,7,12,7,0],
    [-16,-1,16,13,9,2],[-28,-1,6,13,6,1],[17,-3,18,16,8.5,0],[29,-3,4,16,6,3],
    [-15,-33,14,16,9.5,1],[-28,-33,6,17,7,2],[27,-37,8,17,7,0],[15,-28,13,5,5.8,1],
    [-27,-58,7,8,8,2],[-12,-59,8,6,6.5,0],[15,-58,14,12,8.5,2],[28,-58,8,12,11,1],
  ])building(...spec);
  // Physical map perimeter, with a closed checkpoint and distant city silhouettes.
  for(const side of [-1,1])box(side*32,2,-17,1,4,94,m.brick,true);
  box(0,2,-64,65,4,1,m.brick,true);box(-18,2,30,27,4,1,m.brick,true);box(20,2,30,25,4,1,m.brick,true);box(2,2,30,14,4,.4,m.teal,true);
  sign('بغداد', 'BAGHDAD / SOUTH CHECKPOINT',2,4.6,29.75,8,1.0,'#394e46',Math.PI);
  for(let i=0;i<58;i++){const side=i%2?-1:1,x=side*(40+random()*65),z=-85+random()*135,w=5+random()*8,d=6+random()*8,h=7+random()*17;box(x,h/2,z,w,h,d,tones[i%4]);box(x,h+.4,z,w+.15,.7,d+.15,m.trim);if(i%4===0)cylinder(x,h+1.1,z,.65,1.5,m.dark);}
  // Low concrete roadblocks create actual crouching cover and flanking routes.
  function barrier(x,z,w=3.6){box(x,.57,z,w,1.14,.65,m.concrete,true);box(x,.12,z,w+.32,.24,1.15,m.concrete);box(x,.89,z+.34,w,.16,.03,m.yellow);for(let k=0;k<w;k+=.7)box(x-w/2+k+.15,.89,z+.37,.24,.16,.02,m.dark).rotation.z=.3;coverPoints.push({x:x-w/2-.7,z:z-1.1},{x:x+w/2+.7,z:z+1.1});}
  barrier(-2,15);barrier(3,-7,3.2);barrier(-3,-25,3.3);barrier(4,-45,3);barrier(-15,-17,4);barrier(16,-43,3.8);barrier(-15,-49,3.5);
  function sedan(x,z,angle=0,color='#8c8a79',van=false){const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=angle;staticRoot.add(group);const paint=material(color,{metalness:.35,roughness:.67});box(0,.65,0,1.8,.55,4.1,paint,false,group);box(0,1.15,-.25,1.65,van?1.4:.62,2.05,paint,false,group);box(0,1.22,.81,1.43,.47,.035,m.window,false,group).rotation.x=.22;box(0,1.21,-1.3,1.43,.46,.035,m.window,false,group).rotation.x=-.2;for(const side of [-1,1]){for(const zz of [-.75,.35])box(side*.837,1.25,zz,.025,.4,.84,m.window,false,group);box(side*.93,.88,.7,.18,.15,.3,paint,false,group);for(const zz of [-1.32,1.3]){const wheel=cylinder(side*.91,.43,zz,.37,.19,m.tire,group,16);wheel.rotation.z=Math.PI/2;const hub=cylinder(side*1.015,.43,zz,.19,.018,m.steel,group);hub.rotation.z=Math.PI/2;}box(side*.59,.76,2.067,.44,.22,.05,m.white,false,group);box(side*.64,.75,-2.067,.36,.18,.05,m.rust,false,group);box(side*.83,.92,-.16,.025,.04,.2,m.dark,false,group);}box(0,.45,2.08,1.7,.18,.14,m.steel,false,group);box(0,.7,2.10,.4,.12,.01,m.white,false,group);
    const wide=Math.abs(Math.sin(angle))>.5;obstacles.push({minX:x-(wide?2.2:1),maxX:x+(wide?2.2:1),minZ:z-(wide?1:2.2),maxZ:z+(wide?1:2.2),height:van?2:1.5});group.updateMatrixWorld(true);group.traverse(o=>{if(o.isMesh)shootMeshes.push(o);});mapObjects.push({x,z,w:wide?4.4:2,d:wide?2:4.4,type:'cover'});coverPoints.push({x:x-1.7,z:z+2.7},{x:x+1.7,z:z-2.7});return group;
  }
  sedan(4.7,2,.12,'#b3a777');sedan(-4.8,-36,-.12,'#7d9692');sedan(12,-19,Math.PI/2,'#bda679');sedan(4.8,25,0,'#e1d8bb',true);
  // Clinic awning and tables; all mission objects have a tangible place in-world.
  box(19,2.9,-35.7,8,.13,4.9,m.fabric);for(const x of [15.2,22.8])for(const z of [-33.4,-38])cylinder(x,1.45,z,.04,2.9,m.rust);
  sign('عيادة الأمل', 'AL AMAL / FIELD CLINIC',20,3.55,-30.6,6,1,'#526f64',Math.PI);
  sign('عيادة الأمل', 'FIELD CLINIC / MEDICAL AID',20,2.9,-33.18,5,.8);
  function table(x,z,w=1.8){box(x,.87,z,w,.10,.85,m.wood);for(const dx of [-w/2+.12,w/2-.12])for(const dz of [-.3,.3])box(x+dx,.43,z+dz,.055,.86,.055,m.steel);}
  const records=new THREE.Group();scene.add(records);
  table(20,-38,2);box(20,.95,-38,.42,.055,.3,m.white,false,records);box(20.07,.985,-38,.26,.009,.2,m.yellow,false,records);box(20.27,.955,-37.91,.04,.018,.21,m.dark,false,records);
  table(-20,-54);box(-20,1.09,-54,.65,.34,.38,m.teal);box(-20,1.1,-53.798,.52,.24,.012,m.dark);for(let i=0;i<3;i++)cylinder(-20.17+i*.17,1.12,-53.777,.035,.022,m.steel).rotation.x=Math.PI/2;
  cylinder(-20.8,3.2,-54,.028,6.4,m.steel);wire([-20.8,6.4,-54],[-29,5,-61],.3);wire([-20.8,6.4,-54],[-12,5,-61],.3);wire([-20.8,1,-54],[-20.1,1.25,-54],.25);
  sign('RADIO / 03','EVACUATION UPLINK',-20,1.8,-54.5,2,.48);
  for(const x of [-20.8,-19.2])cylinder(x,.91,-54.52,.025,1.82,m.steel);
  // Diesel generator is connected to the downloaded, weathered electrical cabinet.
  box(-25,.57,-12,2.4,1.12,1.3,m.teal,true);box(-25,.12,-12,2.7,.2,1.5,m.dark);for(let i=0;i<10;i++)box(-25.8+i*.13,.62,-11.337,.055,.67,.025,m.dark);cylinder(-25.5,1.45,-12,.08,.7,m.rust);wire([-24,1,-12],[-23,.1,-12],.1,.025);sign('POWER / 01','CLINIC BACKUP',-25,1.8,-12.7,2.5,.5);
  for(const x of [-26,-24])cylinder(x,.95,-12.73,.03,1.9,m.steel);
  const powerLight=new THREE.PointLight('#a9e8b0',0,9,2);powerLight.position.set(20,2.6,-36);scene.add(powerLight);
  const statusLamp=box(-23,1.38,-11.83,.07,.07,.025,new THREE.MeshStandardMaterial({color:'#a95735',emissive:'#a95735',emissiveIntensity:.5}),false,scene);
  // Market stalls, shaded shutters, overhead distribution cables and street litter.
  for(const [x,z] of [[-11,7],[15,7],[-27,-20]]){box(x,2.4,z,5,.09,2.3,m.fabric);for(const dx of [-2.3,2.3])cylinder(x+dx,1.2,z+1,.035,2.4,m.rust);table(x,z);for(let i=0;i<7;i++)box(x-1.7+i*.52,1.02,z,.44,.2,.6,i%2?m.yellow:m.rust);}
  sign('سوق النخيل','AL NAKHEEL MARKET',-15,3.3,5.56,5,1);
  sign('كهربائيات','REPAIRS / ELECTRICAL',17,3.4,5.06,4.8,.8,'#60503d');
  for(const x of [-6.1,6.1])for(const z of [12,-17,-46]){cylinder(x,4.5,z,.095,9,m.wood);box(x,8.4,z,1.1,.08,.08,m.steel);wire([x,8.4,z],[x,8.4,z-27],1.15);wire([x+.3,8.4,z],[x+.3,8.4,z-27],1.35);wire([x,7.9,z],[-x,7.9,z-5],1.4);box(x,7.7,z,.45,.15,.25,m.dark);}
  // Date palms with individual drooping leaflets, not conifer vegetation.
  function palm(x,z,h){const trunk=cylinder(x,h/2,z,.2,h,m.bark);trunk.rotation.z=.035;for(let k=0;k<h;k+=.22)cylinder(x,k,z,.215,.07,m.wood);for(let f=0;f<10;f++){const a=f*Math.PI/5,tip=[x+Math.cos(a)*3,h-.9,z+Math.sin(a)*3];wire([x,h,z],tip, -.65,.025,m.palm);for(let j=1;j<10;j++){const t=j/10,px=x+Math.cos(a)*3*t,pz=z+Math.sin(a)*3*t,py=h-.9*t+Math.sin(t*Math.PI)*.65;for(const s of [-1,1]){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([px,py,pz,px+Math.cos(a+.8*s)*(.75*(1-t)+.2),py-.18,pz+Math.sin(a+.8*s)*(.75*(1-t)+.2),px+Math.cos(a)*.24,py-.02,pz+Math.sin(a)*.24],3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1],2));geo.computeVertexNormals();const leaf=new THREE.Mesh(geo,m.palm);leaf.castShadow=true;staticRoot.add(leaf);}}}trees.push({x,z,h});obstacles.push({minX:x-.2,maxX:x+.2,minZ:z-.2,maxZ:z+.2,height:h});shootMeshes.push(trunk);}
  for(const args of [[-28,10,6.8],[27,9,7.7],[10,-40,6],[-29,-48,7.1],[-8,26,7.4],[36,-20,9]])palm(...args);
  for(let i=0;i<150;i++){const x=(random()>.5?1:-1)*(5.5+random()*1.4),z=-60+random()*88;const o=box(x,.018,z,.1+random()*.2,.02,.08+random()*.15,i%3?m.trim:m.white);o.rotation.y=random()*6;}
  for(const [x,z] of [[-9,11],[24,-19],[-10,-45]]){box(x,.55,z,1.2,1.1,.8,m.teal,true);box(x,1.12,z,1.3,.07,.9,m.dark);}
  // Embed real CC0 props, keeping the source glTF material maps intact.
  const assets={};for(const id of Object.keys(propData))assets[id]=(await new GLTFLoader().parseAsync(JSON.stringify(propData[id]),'')).scene;
  function prop(id,x,z,width=1,y=0,rotation=0){const model=assets[id].clone(true),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());const s=width/size.x;model.scale.multiplyScalar(s);model.position.set(-center.x*s,-bounds.min.y*s,-center.z*s);const group=new THREE.Group();group.add(model);group.position.set(x,y,z);group.rotation.y=rotation;scene.add(group);model.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;for(const mat of Array.isArray(o.material)?o.material:[o.material])if(mat.map)mat.map.anisotropy=8;}});return group;}
  prop('power_box_01',-23,-12,.62,.4,Math.PI);box(-23,.2,-12,.55,.4,.45,m.concrete);
  for(const [x,z,w] of [[-10,1,1.1],[-12,1,1.4],[22,-34,1.3],[-22,-57,1.15],[-24,-55,1.2]]){const o=prop('wooden_military_crate',x,z,w);o.updateMatrixWorld(true);o.traverse(m=>{if(m.isMesh)shootMeshes.push(m);});const b=new THREE.Box3().setFromObject(o);obstacles.push({minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z,height:b.max.y});coverPoints.push({x:x+1.3,z:z+.8});mapObjects.push({x,z,w,d:b.max.z-b.min.z,type:'cover'});}
  function medkit(x,z,y=0){const group=new THREE.Group();group.position.set(x,y,z);scene.add(group);const cloth=material('#576653',{roughness:1,normalMap:plaster.normalMap,normalScale:new THREE.Vector2(.2,.2)});box(0,.13,0,.48,.24,.3,cloth,false,group);box(0,.25,0,.44,.04,.29,cloth,false,group);for(const sx of [-.17,.17]){box(sx,.145,.158,.06,.23,.026,m.dark,false,group);box(sx,.20,.177,.07,.035,.025,m.steel,false,group);}box(0,.286,0,.18,.018,.04,m.dark,false,group);box(-.09,.265,0,.018,.04,.04,m.dark,false,group);box(.09,.265,0,.018,.04,.04,m.dark,false,group);box(0,.153,.157,.15,.14,.01,m.white,false,group);box(0,.153,.165,.09,.027,.005,cloth,false,group);box(0,.153,.166,.028,.09,.005,cloth,false,group);return group;}
  for(const [type,x,z,y] of [['ammo',-4,23,0],['medkit',-4.9,22,0],['ammo',-26,-16,0],['medkit',-22,-9,0],['medkit',19.4,-38,.93],['ammo',21.8,-39,0],['medkit',-22.5,-53,0],['ammo',-19,-56,0]]){
    const mesh=type==='ammo'?prop('wooden_military_crate',x,z,.72,y):medkit(x,z,y);pickups.push({id:pickups.length,type,x,z,y:y+.2,mesh,taken:false});mapObjects.push({x,z,w:.65,d:.5,type:'supply'});
  }
  staticRoot.updateMatrixWorld(true);const batches=new Map();staticRoot.traverse(o=>{if(!o.isMesh)return;const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(g);});scene.remove(staticRoot);for(const [mat,geometries]of batches){const mesh=new THREE.Mesh(mergeGeometries(geometries),mat);mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);for(const g of geometries)g.dispose();}
  const grass=new THREE.Group();scene.add(grass);
  return {id:'baghdad',scene,obstacles,shootMeshes,mapObjects,targets:[],pickups,coverPoints,trees,sun,grass,bounds:CITY_BOUNDS,spawn:{x:0,z:25},supply:new THREE.Vector3(-4,0,23),objectives:OBJECTIVES,powerLight,statusLamp,records,update(){},reset(){records.visible=true;powerLight.intensity=0;statusLamp.material.emissive.set('#a95735');for(const item of pickups){item.taken=false;item.amount=undefined;item.mesh.visible=true;}}};
}



