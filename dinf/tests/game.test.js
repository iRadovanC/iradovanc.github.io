'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game,ROOMS,NODES,EDGES,CURRENT_APP,ZBYSEK_LINES,shortestPath}=require('../game.js');
function tick(g,seconds){for(let t=0;t<seconds&&!g.result;t+=.05)g.update(.05);}
function go(g,room){assert.ok(g.go(room));let limit=1000;while(g.path.length&&!g.result&&limit-->0)g.update(.05);assert.equal(g.room,room);}
function act(g,id){assert.ok(g.startAction(id),`Cannot ${id} at ${g.time}, room ${g.room}`);let limit=1000;while(g.action&&!g.result&&limit-->0)g.update(.05);}

test('every room is reachable via authored corridor edges',()=>{
  for(const a of Object.values(ROOMS))for(const b of Object.values(ROOMS)){
    const route=shortestPath(a.node,b.node);assert.equal(route[0],a.node);assert.equal(route.at(-1),b.node);
    for(let i=1;i<route.length;i++)assert.ok(EDGES.some(e=>e.includes(route[i-1])&&e.includes(route[i])));
  }
});
test('changing destination midway finishes the current floor segment',()=>{
  const g=new Game(()=>0);g.go('qa');tick(g,.2);const next=g.path[0];g.go('wc');assert.equal(g.path[0],next);go(g,'wc');assert.deepEqual([g.actor.x,g.actor.y],NODES.wc);
});
test('paused and unstarted shifts do not drain needs or advance the clock',()=>{
  const g=new Game();tick(g,10);assert.equal(g.time,540);g.started=true;g.paused=true;tick(g,10);assert.equal(g.energy,86);assert.equal(g.time,540);
});
test('actions only work at the right destination and cannot complete when cancelled',()=>{
  const g=new Game(()=>0);assert.equal(g.startAction('coffee'),false);g.startAction('code');tick(g,5);g.cancel();assert.equal(g.code,0);act(g,'code');assert.equal(g.code,24);assert.equal(g.bugs,9);
});
test('timed actions skip ahead by default and can retain real-time progress when disabled',()=>{
  const fast=new Game(()=>0);const result=fast.chooseAction('code');
  assert.equal(result.started,true);assert.equal(fast.action,null);assert.equal(fast.code,24);assert.ok(result.timeJump>23.9&&result.timeJump<24.1);
  const live=new Game(()=>0);live.skipTimedActions=false;const liveResult=live.chooseAction('code');
  assert.equal(liveResult.timeJump,0);assert.equal(live.action.id,'code');assert.equal(live.code,0);
});
test('Zbyšek walks between offices and has project-aware sarcastic lines',()=>{
  const g=new Game(()=>0);assert.equal(CURRENT_APP,'ZPR');assert.ok(ZBYSEK_LINES.some(line=>line.includes(CURRENT_APP)));
  g.started=true;tick(g,30);assert.equal(g.zbysek.room,'code');assert.equal(g.zbysek.path.length,0);assert.ok(g.zbysek.speech.length>0);
});
test('coffee, water and WC have meaningful connected effects',()=>{
  const g=new Game(()=>0);g.energy=25;g.water=20;go(g,'kitchen');act(g,'coffee');assert.ok(g.energy>50);act(g,'water');assert.ok(g.water>60);assert.ok(g.bladder>65);go(g,'wc');act(g,'wc');assert.equal(g.bladder,0);
});
test('meeting attendance is completed once, cancellation does not reserve a meeting',()=>{
  const g=new Game(()=>0);g.time=595;g.lastEvent=595;go(g,'meeting');assert.ok(g.startAction('meeting'));tick(g,2);g.cancel();assert.equal(g.meetings[0].status,'pending');act(g,'meeting');assert.equal(g.meetings[0].status,'done');assert.equal(g.attended,1);assert.equal(g.startAction('meeting'),false);
});
test('missed meetings incur one penalty, director reports have a cooldown',()=>{
  const g=new Game(()=>0);g.started=true;g.time=635;g.lastEvent=635;tick(g,2);assert.equal(g.meetings[0].status,'missed');const reputation=g.reputation;tick(g,2);assert.equal(g.reputation,reputation);go(g,'director');act(g,'report');assert.equal(g.canDo('report'),false);
});
test('deadline, exhaustion, dehydration and stress all end the shift',()=>{
  for(const [key,value] of [['time',1020],['energy',0],['water',0],['stress',100],['reputation',0]]){const g=new Game(()=>0);g.started=true;g[key]=value;tick(g,.1);assert.equal(g.result?.won,false,key);}
});
test('a full bladder is recoverable but damages reputation',()=>{
  const g=new Game(()=>0);g.started=true;g.bladder=100;tick(g,.1);assert.equal(g.incidents,1);assert.ok(g.bladder<20);assert.equal(g.reputation,62);assert.equal(g.result,null);
});
test('deploy is gated by completed code and tested quality',()=>{
  const g=new Game(()=>0);go(g,'qa');assert.equal(g.canDo('deploy'),false);g.code=100;assert.equal(g.canDo('deploy'),false);act(g,'test');assert.equal(g.canDo('deploy'),true);act(g,'deploy');assert.equal(g.result.won,true);const score=g.result.score;tick(g,60);assert.equal(g.result.score,score);
});
test('a full shift is winnable without changing player stats or the clock',()=>{
  const g=new Game(()=>0);
  act(g,'code');act(g,'code');go(g,'meeting');act(g,'meeting');
  go(g,'code');act(g,'code');act(g,'code');
  go(g,'kitchen');act(g,'coffee');act(g,'water');go(g,'wc');act(g,'wc');
  go(g,'rest');act(g,'rest');go(g,'team');act(g,'pair');
  go(g,'qa');while(g.bugs>2&&!g.result)act(g,'test');act(g,'deploy');
  assert.equal(g.result.won,true);assert.ok(g.time<1020);assert.ok(g.energy>0&&g.water>0&&g.stress<100);assert.equal(g.incidents,0);
});
