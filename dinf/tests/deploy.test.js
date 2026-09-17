'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game}=require('../game.js');
test('deployment must finish before the deadline, not only start before it',()=>{
  const g=new Game(()=>0);g.room='qa';g.code=100;g.bugs=0;g.time=1017;g.startAction('deploy');
  for(let i=0;i<50;i++)g.update(.1);
  assert.equal(g.result.won,false);assert.equal(g.shipped,false);assert.equal(g.time,1020);
});
test('new bugs during deployment cause CI to reject the release',()=>{
  const g=new Game(()=>0);g.room='qa';g.code=100;g.bugs=2;g.startAction('deploy');g.bugs=4;
  for(let i=0;i<41;i++)g.update(.1);
  assert.equal(g.result,null);assert.equal(g.shipped,false);assert.equal(g.action,null);assert.match(g.logs[0].message,/CI/);
});
