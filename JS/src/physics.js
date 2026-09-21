// Segment casts are used for every bullet step; fast projectiles cannot tunnel
// through a thin target between frames. The camera chooses the aim point,
// but collision begins at the muzzle, so nearby cover still blocks the shot.
export const GRAVITY = 9.81;
export const MUZZLE_SPEED = 880;
export const FIXED_STEP = 1 / 120;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export function resolveCircle(position, radius, boxes) {
  const p={x:position.x,z:position.z};
  for(let pass=0;pass<3;pass++) for(const b of boxes){
    const x=clamp(p.x,b.minX,b.maxX),z=clamp(p.z,b.minZ,b.maxZ);
    const dx=p.x-x,dz=p.z-z,d2=dx*dx+dz*dz;
    if(d2>=radius*radius)continue;
    if(d2>1e-10){const s=(radius-Math.sqrt(d2))/Math.sqrt(d2);p.x+=dx*s;p.z+=dz*s;}
    else{const faces=[{d:p.x-b.minX,x:b.minX-radius,z:p.z},{d:b.maxX-p.x,x:b.maxX+radius,z:p.z},{d:p.z-b.minZ,x:p.x,z:b.minZ-radius},{d:b.maxZ-p.z,x:p.x,z:b.maxZ+radius}];faces.sort((a,b)=>a.d-b.d);p.x=faces[0].x;p.z=faces[0].z;}
  }
  return p;
}
export function integrateBullet(position, velocity, dt) {
  return {position:{x:position.x+velocity.x*dt,y:position.y+velocity.y*dt-GRAVITY*.5*dt*dt,z:position.z+velocity.z*dt},velocity:{x:velocity.x,y:velocity.y-GRAVITY*dt,z:velocity.z}};
}
export function reloadAmmo(ammo,reserve,capacity=30){const moved=Math.min(capacity-ammo,reserve);return{ammo:ammo+moved,reserve:reserve-moved};}
