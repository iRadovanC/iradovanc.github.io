import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCircle,integrateBullet,reloadAmmo,GRAVITY,FIXED_STEP,MUZZLE_SPEED} from '../src/physics.js';
test('player slides along cover without entering it',()=>{const b=[{minX:1,maxX:2,minZ:-3,maxZ:3}];const p=resolveCircle({x:.9,z:.5},.31,b);assert.ok(Math.abs(p.x-.69)<1e-8);assert.equal(p.z,.5);});
test('embedded player is pushed to nearest edge, not trapped',()=>{const p=resolveCircle({x:1.1,z:0},.3,[{minX:1,maxX:3,minZ:-2,maxZ:2}]);assert.equal(p.x,.7);assert.equal(p.z,0);});
test('a player radius also collides with cover corners',()=>{const p=resolveCircle({x:.9,z:.9},.3,[{minX:1,maxX:2,minZ:1,maxZ:2}]);assert.ok(Math.abs(Math.hypot(1-p.x,1-p.z)-.3)<1e-8);});
test('ballistic integration obeys gravity and is independent of step count',()=>{const initial={x:0,y:1.5,z:0},velocity={x:0,y:0,z:-MUZZLE_SPEED};let step={position:initial,velocity};for(let i=0;i<24;i++)step=integrateBullet(step.position,step.velocity,FIXED_STEP);assert.ok(Math.abs(step.position.z+176)<1e-8);assert.ok(Math.abs(step.position.y-(1.5-GRAVITY*.5*.2**2))<1e-8);const single=integrateBullet(initial,velocity,.2);assert.ok(Math.abs(single.position.y-step.position.y)<1e-8);});
test('reload conserves ammunition and respects magazine capacity',()=>{assert.deepEqual(reloadAmmo(13,180),{ammo:30,reserve:163});assert.deepEqual(reloadAmmo(0,7),{ammo:7,reserve:0});assert.deepEqual(reloadAmmo(30,100),{ammo:30,reserve:100});assert.deepEqual(reloadAmmo(0,0),{ammo:0,reserve:0});});
