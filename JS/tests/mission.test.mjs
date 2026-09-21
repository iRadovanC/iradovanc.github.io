import test from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, damageHealth, applyPickup, lineClear, canInteract, makeNavigator } from '../src/mission-rules.js';

test('health cannot overflow or become negative; healing is a finite pickup',()=>{
  assert.equal(damageHealth(30,50),0);assert.equal(damageHealth(50,-8),50);
  const state={health:92,reserve:235},med={type:'medkit',taken:false},ammo={type:'ammo',taken:false};
  assert.equal(applyPickup(state,med,DIFFICULTIES.regular),8);assert.equal(state.health,100);
  assert.equal(applyPickup(state,med,DIFFICULTIES.regular),0);
  assert.equal(applyPickup(state,ammo,DIFFICULTIES.regular),5);assert.equal(state.reserve,240);
  const full={type:'medkit',taken:false};assert.equal(applyPickup(state,full,DIFFICULTIES.regular),0);assert.equal(full.taken,false);
});
test('difficulty changes supplies, reactions and incoming damage, not hit points',()=>{
  const {recruit:a,regular:b,veteran:c}=DIFFICULTIES;
  assert.ok(a.reserve>b.reserve&&b.reserve>c.reserve);assert.ok(a.reaction>b.reaction&&b.reaction>c.reaction);
  assert.ok(a.damage<b.damage&&b.damage<c.damage);assert.ok(a.enemies<b.enemies&&b.enemies<c.enemies);
});
test('opaque cover blocks sight and interactions, with standing/crouching height respected',()=>{
  const wall={minX:0,maxX:1,minZ:-2,maxZ:2,height:1.15};
  assert.equal(lineClear({x:-2,z:0,y:1},{x:2,z:0,y:1},[wall]),false);
  assert.equal(lineClear({x:-2,z:0,y:1.5},{x:2,z:0,y:1.5},[wall]),true);
  assert.equal(canInteract({x:-.5,z:0},{x:1.5,z:0},[{...wall,height:3}]),false);
  assert.equal(canInteract({x:-.5,z:0},{x:-1.5,z:0},[wall]),true);
  assert.equal(canInteract({x:-.5,z:0},{x:-8,z:0},[]),false);
});
test('A* navigates around buildings, not through their corners',()=>{
  const boxes=[{minX:-1,maxX:1,minZ:-2,maxZ:2,height:8}],bounds={minX:-6,maxX:6,minZ:-6,maxZ:6};
  const nav=makeNavigator(boxes,bounds),start={x:-4,z:0},goal={x:4,z:0},route=nav.path(start,goal);
  assert.ok(route.length>8);let previous=start;
  for(const p of route){assert.equal(lineClear({...previous,y:.5},{...p,y:.5},boxes,.3),true);previous=p;}
  assert.deepEqual(route.at(-1),goal);
});
test('A* returns no route through an enclosing perimeter',()=>{
  const nav=makeNavigator([{minX:-.5,maxX:.5,minZ:-10,maxZ:10,height:8}],{minX:-4,maxX:4,minZ:-4,maxZ:4});
  assert.deepEqual(nav.path({x:-3,z:0},{x:3,z:0}),[]);
});
