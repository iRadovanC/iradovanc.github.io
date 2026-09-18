'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game,PLUGINS,INCIDENTS}=require('../engine.js');
const advance=(g,seconds)=>{for(let i=0;i<Math.round(seconds*10);i++)g.tick(.1);};
const fresh=()=>{const g=new Game(()=>.5);g.start();return g;};

test('Ready state is inert and a successful vehicle demo advances to a plugin task',()=>{const g=new Game();g.act('select','van');assert.equal(g.selected,null);g.start();g.act('select','van');g.act('track');assert.equal(g.completed,1);assert.equal(g.mission.plugin,'measure');assert.equal(g.score,100);});
test('Each plugin really creates a bug and can be corrected only once',()=>{for(const id of Object.keys(PLUGINS)){const g=fresh();g.act('plugin-use',id);assert.equal(g.pluginBugs[id],true);assert.equal(g.bugs,1);g.act('plugin-fix',id);assert.equal(g.pluginBugs[id],undefined);assert.equal(g.bugs,0);const score=g.score;g.act('plugin-fix',id);assert.equal(g.score,score);}});
test('Plugin mission requires both demonstration and corrective action',()=>{const g=fresh();g.act('select','van');g.act('track');advance(g,2);g.act('plugin-fix','measure');assert.equal(g.completed,1);g.act('plugin-use','measure');g.act('plugin-fix','measure');assert.equal(g.completed,2);assert.equal(g.pluginDemos,1);});
test('Three unresolved bugs automatically open the customer scene without losing',()=>{const g=fresh();g.act('plugin-use','layers');g.act('plugin-use','maps');g.act('plugin-use','fleet');assert.equal(g.phase,'room');assert.equal(g.status,'playing');assert.ok(g.room.question);});
test('A fatal crash displays blue death then automatically switches to the PM',()=>{const g=fresh();g.act('install');assert.equal(g.phase,'bsod');assert.equal(g.stability,0);assert.equal(g.status,'playing');advance(g,2.4);assert.equal(g.phase,'room');assert.equal(g.crashes,1);});
test('Good contextual answer covers a complete stealth restart and returns to the tablet',()=>{const g=fresh();g.crash();advance(g,2.4);g.act('answer',g.room.question.answers.findIndex(a=>a.good));g.act('restart');advance(g,4.3);assert.equal(g.phase,'tablet');assert.equal(g.rescues,1);assert.equal(g.bugs,0);assert.equal(g.stability>70,true);assert.equal(g.tracked,null);assert.equal(g.room,null);});
test('Repeated answers cannot farm reputation or distraction',()=>{const g=fresh();g.enterRoom('test',false);const good=g.room.question.answers.findIndex(a=>a.good);g.act('answer',good);const snapshot=[g.score,g.trust,g.room.cover];g.act('answer',good);assert.deepEqual([g.score,g.trust,g.room.cover],snapshot);});
test('Uncovered restart is noticed, loses trust and stops',()=>{const g=fresh();g.enterRoom('test',false);const before=g.trust;g.act('restart');advance(g,3.4);assert.equal(g.room.restarting,false);assert.ok(g.trust<before-20);assert.ok(g.room.progress<15);});
test('Bad excuses lose trust, room timeout loses the presentation',()=>{const g=fresh();g.enterRoom('test',false);const trust=g.trust;g.act('answer',g.room.question.answers.findIndex(a=>!a.good));assert.equal(g.trust,trust-14);advance(g,24.1);assert.equal(g.status,'lost');assert.match(g.failureReason,/výběrové řízení/);});
test('Pause freezes blue death and recovery, and stops hidden restarting',()=>{const g=fresh();g.crash();g.pause();advance(g,12);assert.equal(g.phase,'bsod');assert.equal(g.bsodRemaining,2.3);g.resume();advance(g,2.4);g.act('restart');g.pause();const s=[g.elapsed,g.room.remaining,g.room.progress,g.trust];advance(g,20);g.act('answer',0);assert.deepEqual([g.elapsed,g.room.remaining,g.room.progress,g.trust],s);assert.equal(g.room.restarting,false);});
test('All ambient incidents are solvable, and ignored incidents accumulate bugs',()=>{for(const bug of INCIDENTS){const g=fresh();g.tracked='van';g.selected='van';g.spawnIncident(bug.id);g.act(bug.solution);assert.equal(g.incident,null,bug.id);assert.equal(g.fixed,1);}const g=fresh();g.spawnIncident('gps');advance(g,8.1);assert.equal(g.bugs,1);assert.ok(g.stability<70);});
test('Time expiring during recovery cannot award a win until the app is restored',()=>{const g=fresh();g.completed=4;g.pluginDemos=1;g.elapsed=89;g.crash();advance(g,2.4);assert.equal(g.remaining,0);assert.equal(g.phase,'room');assert.equal(g.status,'playing');g.act('answer',g.room.question.answers.findIndex(a=>a.good));g.act('restart');advance(g,4.3);assert.equal(g.status,'won');});
test('No win without enough real demonstrations, end event emitted exactly once',()=>{const g=fresh();g.nextIncident=999;g.stability=100;g.elapsed=89.8;advance(g,.5);assert.equal(g.status,'lost');assert.match(g.failureReason,/4 ukázky/);g.end(false);assert.equal(g.drain().filter(e=>e.type==='end').length,1);});
test('Whole presentations can be won across random incidents and a deliberate blue death',()=>{
  for(let seed=1;seed<=25;seed++){
    let state=seed;const g=new Game(()=>{state=(state*16807)%2147483647;return(state-1)/2147483646;});g.start();let nextDemo=1,crashed=false;
    for(let i=0;i<1300&&g.status==='playing';i++){
      g.tick(.1);
      if(g.phase==='room'){
        if(!g.room.answered)g.act('answer',g.room.question.answers.findIndex(a=>a.good));
        if(!g.room.restarting&&g.room.cover>4.5)g.act('restart');
      }else if(g.phase==='tablet'){
        if(g.elapsed>28&&!crashed){g.crash('deliberate demo crash');crashed=true;}
        else if(g.incident&&g.incident.remaining<g.incident.duration-1){if(g.incident.solution==='stop')g.selected=g.tracked;g.act(g.incident.solution);}
        else if(!g.incident&&g.elapsed>=nextDemo){const m=g.mission;if(m.plugin){if(!g.pluginBugs[m.plugin])g.act('plugin-use',m.plugin);if(g.phase==='tablet')g.act('plugin-fix',m.plugin);}else{g.act('select',m.vehicle);g.act(m.action);}nextDemo=g.elapsed+4;}
      }
      g.drain();
    }
    assert.equal(g.status,'won',`seed ${seed}: ${g.failureReason}`);assert.ok(g.rescues>=1);assert.ok(g.pluginDemos>=1);assert.ok(g.completed>=4);
  }
});
test('Reset removes plugin errors, all scene state and previous score',()=>{const g=fresh();g.act('plugin-use','draw');g.enterRoom('test',false);g.reset();assert.equal(g.status,'ready');assert.equal(g.phase,'tablet');assert.equal(g.room,null);assert.equal(g.bugs,0);assert.deepEqual(g.pluginBugs,{});assert.equal(g.score,0);assert.equal(g.repairs,2);});
