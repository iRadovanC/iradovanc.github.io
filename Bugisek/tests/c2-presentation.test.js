'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {reactionPoses,layoutMarkers,symbol}=require('../c2-presentation.js');
const {VEHICLES}=require('../engine.js');

test('Every comic reaction mixes three different poses and each soldier cycles through all three',()=>{
  for(const emotion of ['sad','angry','panic']){
    const combinations=Array.from({length:9},(_,serial)=>reactionPoses(emotion,serial));
    for(const poses of combinations)assert.equal(new Set(poses).size,3);
    for(let soldier=0;soldier<3;soldier++)assert.deepEqual(new Set(combinations.map(p=>p[soldier])),new Set(['facepalm','shock','despair']));
  }
});
test('Units have six distinct APP-6 branch icons in both the map and list',()=>{
  assert.equal(new Set(VEHICLES.map(v=>v.symbol)).size,6);
  assert.equal(new Set(VEHICLES.map(symbol)).size,6);
  assert.ok(VEHICLES.every(v=>v.branch&&v.driver.includes('AČR')));
});
test('Decluttered symbols remain separate and clickable inside the map at tablet and phone widths',()=>{
  for(const [w,h,mw,mh] of [[111,333,40,40],[95,333,40,40],[236,350,46,52],[390,285,56,58],[700,350,56,58]]){
    for(let frame=0;frame<80;frame++){
      // Includes all units converging at the edge and at the same coordinate.
      const points=Array.from({length:6},(_,i)=>({x:frame<3?frame*w/2:(Math.sin(frame*.3+i)*.7+.5)*w,y:frame<3?h/2:(Math.cos(frame*.4+i)*.7+.5)*h}));
      const placed=layoutMarkers(points,w,h,mw,mh);
      assert.equal(placed.length,6);
      for(let i=0;i<6;i++){
        assert.ok(placed[i].x-mw/2>=44&&placed[i].x+mw/2<=w,`horizontal bounds at ${w}`);
        assert.ok(placed[i].y-mh/2>=36&&placed[i].y+mh/2<=h,`vertical bounds at ${w}`);
        for(let j=i+1;j<6;j++)assert.ok(Math.abs(placed[i].x-placed[j].x)>=mw||Math.abs(placed[i].y-placed[j].y)>=mh,`overlap at ${w}, frame ${frame}`);
      }
    }
  }
});
