import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1000},offline:true});
const page=await context.newPage(),errors=[],requests=[];let count=0;
page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
async function check(name,fn){await fn();console.log('PASS',name);count++;}
const run=fn=>page.evaluate(fn);
const isolate=()=>run(()=>{for(const e of __VANGUARD__.mission.enemies){e.active=false;e.actor.root.visible=false;}});
try{
  await page.goto(pathToFileURL(path.resolve(process.env.GAME_FILE||'Vanguard.html')).href+'?test');
  await page.waitForFunction(()=>window.__VANGUARD__?.state.ready,null,{timeout:45000});
  await page.click('[data-level="baghdad"]');
  await check('second level and all three difficulties launch from the menu',async()=>{
    for(const [name,ammo,enemies] of [['recruit',180,8],['veteran',90,12],['regular',120,10]]){await page.selectOption('#difficulty',name);const result=await run(()=>({level:__VANGUARD__.state.level,reserve:__VANGUARD__.state.reserve,enemies:__VANGUARD__.mission.enemies.filter(e=>e.active).length}));assert.deepEqual(result,{level:'baghdad',reserve:ammo,enemies});}
  });
  await page.click('#play');
  await check('tight-wall camera does not clip into the player model',async()=>{
    const r=await run(()=>{const g=__VANGUARD__;g.state.position.set(-23,0,-8);g.state.yaw=0;g.state.pitch=-.18;g.updateCamera(1);const hidden=!g.character.model.visible;g.state.position.set(0,0,25);g.updateCamera(1);return{hidden,restored:g.character.model.visible};});assert.equal(r.hidden,true);assert.equal(r.restored,true);
  });
  await check('all mission objectives and pickups have routes from insertion',async()=>{
    const result=await run(()=>{const g=__VANGUARD__;return [...g.world.objectives,...g.world.pickups].map(o=>({id:o.id,path:g.mission.nav.path(g.world.spawn,o).length}));});assert.ok(result.every(o=>o.path>0),JSON.stringify(result));
  });
  await check('enemy perception respects opaque buildings and a reaction delay',async()=>{
    const r=await run(()=>{const g=__VANGUARD__,m=g.mission,e=m.enemies[0];for(const other of m.enemies)other.active=false;e.active=true;e.path=[];e.actor.root.position.set(0,0,0);e.yaw=Math.PI;e.awareness=0;e.mode='patrol';g.state.position.set(0,0,6);m.think(e);const delay=e.mode;for(let i=0;i<8;i++)m.think(e);const detected=e.mode;e.actor.root.position.set(-14,0,12);g.state.position.set(-14,0,28);m.think(e);return{delay,detected,blocked:!e.canSee};});assert.equal(r.delay,'patrol');assert.equal(r.detected,'combat');assert.equal(r.blocked,true);
  });
  await check('enemy bullets damage an exposed player but cannot pass through a building',async()=>{
    const r=await run(()=>{const g=__VANGUARD__,m=g.mission,e=m.enemies[0];g.state.health=100;g.state.position.set(0,0,6);e.actor.root.position.set(0,0,0);e.yaw=Math.PI;e.speed=0;m.pose(e,1);for(let i=0;i<5;i++)m.fire(e);const exposed=g.state.health;g.state.health=100;g.state.position.set(-14,0,28);e.actor.root.position.set(-14,0,12);m.pose(e,1);for(let i=0;i<5;i++)m.fire(e);return{exposed,covered:g.state.health};});assert.ok(r.exposed<100,r);assert.equal(r.covered,100);
  });
  await isolate();
  await check('finite medical and ammunition pickups are grounded and work with E',async()=>{
    await run(()=>{const g=__VANGUARD__;g.state.position.set(-4.9,0,22.6);g.state.health=40;g.state.reserve=0;g.state.lastDamage=-100;});
    await page.keyboard.press('KeyE');await page.waitForTimeout(100);assert.equal(await run(()=>__VANGUARD__.state.health),85);
    await page.keyboard.press('KeyE');assert.equal(await run(()=>__VANGUARD__.state.health),85);
    await run(()=>{__VANGUARD__.state.position.set(-4,0,23.6);});await page.keyboard.press('KeyE');await page.waitForTimeout(100);assert.ok(await run(()=>__VANGUARD__.state.reserve>=60));
    assert.equal(await run(()=>__VANGUARD__.world.pickups.find(i=>i.type==='medkit').mesh.position.y),0);
  });
  await check('real player gunfire damages and eliminates an enemy',async()=>{
    await run(()=>{const g=__VANGUARD__,e=g.mission.enemies[0];g.state.position.set(0,0,12);g.state.health=100;g.state.ammo=30;g.state.yaw=0;g.state.pitch=0;e.active=true;e.alive=true;e.health=100;e.think=1e6;e.canSee=false;e.path=[];e.mode='patrol';e.actor.root.visible=true;e.actor.root.position.set(0,0,5);e.yaw=0;g.mission.pose(e,1);});
    await page.mouse.down({button:'right'});await page.waitForTimeout(250);
    await run(()=>{const g=__VANGUARD__;for(let i=0;i<8;i++){g.updateCamera(1);const dx=-g.camera.position.x,dy=1.66-g.camera.position.y,dz=5-g.camera.position.z;g.state.yaw=Math.atan2(-dx,-dz);g.state.pitch=Math.atan2(dy,Math.hypot(dx,dz));}});
    await page.waitForTimeout(200);await page.mouse.down();await page.waitForTimeout(450);await page.mouse.up();await page.mouse.up({button:'right'});await page.waitForTimeout(150);
    assert.equal(await run(()=>__VANGUARD__.mission.enemies[0].alive),false);assert.ok(await run(()=>__VANGUARD__.state.hits>0));
  });
  await isolate();
  await check('objective order is enforced and releasing E cancels work',async()=>{
    await run(()=>{__VANGUARD__.state.position.set(20,0,-37);});await page.keyboard.down('KeyE');await page.waitForTimeout(400);await page.keyboard.up('KeyE');assert.equal(await run(()=>__VANGUARD__.mission.stage),0);
    await run(()=>{__VANGUARD__.state.position.set(-23,0,-10.6);});await page.keyboard.down('KeyE');await page.waitForTimeout(700);assert.ok(await run(()=>__VANGUARD__.mission.progress>0));await page.keyboard.up('KeyE');await page.waitForTimeout(150);assert.equal(await run(()=>__VANGUARD__.mission.progress),0);
  });
  await check('power and patient records advance by holding E',async()=>{
    await page.keyboard.down('KeyE');await page.waitForFunction(()=>__VANGUARD__.mission.stage===1,null,{timeout:10000});await page.keyboard.up('KeyE');assert.ok(await run(()=>__VANGUARD__.world.powerLight.intensity>0));
    await run(()=>{__VANGUARD__.state.position.set(20,0,-37);});await page.keyboard.down('KeyE');await page.waitForFunction(()=>__VANGUARD__.mission.stage===2,null,{timeout:10000});await page.keyboard.up('KeyE');assert.equal(await run(()=>__VANGUARD__.world.records.visible),false);
  });
  await check('radio transmission pauses outside its radius and when C2 is open',async()=>{
    await run(()=>{__VANGUARD__.state.position.set(-20,0,-52.5);});await page.keyboard.down('KeyE');await page.waitForFunction(()=>__VANGUARD__.mission.transmitting,null,{timeout:10000});await page.keyboard.up('KeyE');
    await run(()=>{__VANGUARD__.state.position.set(0,0,20);});await page.waitForTimeout(200);const a=await run(()=>__VANGUARD__.mission.upload);await page.waitForTimeout(300);assert.equal(await run(()=>__VANGUARD__.mission.upload),a);
    await run(()=>{__VANGUARD__.state.position.set(-20,0,-52.5);});await page.keyboard.press('Tab');const b=await run(()=>__VANGUARD__.mission.upload);await page.waitForTimeout(300);assert.equal(await run(()=>__VANGUARD__.mission.upload),b);await page.keyboard.press('Tab');
    await run(()=>{const g=__VANGUARD__;for(let i=0;i<260;i++){g.state.time+=.1;g.mission.update(.1,false);}});assert.equal(await run(()=>__VANGUARD__.mission.stage),3);
  });
  await check('mission completes by extraction, without requiring all enemies to be killed',async()=>{
    await run(()=>{__VANGUARD__.state.position.set(2.3,0,24);});await page.keyboard.down('KeyE');await page.waitForFunction(()=>__VANGUARD__.state.mode==='result',null,{timeout:10000});await page.keyboard.up('KeyE');assert.equal(await page.textContent('#result-title'),'MISE SPLNĚNA');assert.ok(await run(()=>__VANGUARD__.mission.enemies.some(e=>e.alive)));await page.screenshot({path:'tmp/baghdad-complete.png'});
  });
  await check('restart restores health, objectives, enemies and finite supplies',async()=>{
    await page.click('#retry-mission');const r=await run(()=>({health:__VANGUARD__.state.health,stage:__VANGUARD__.mission.stage,taken:__VANGUARD__.world.pickups.some(i=>i.taken),alive:__VANGUARD__.mission.enemies.filter(e=>e.active&&e.alive).length,mode:__VANGUARD__.state.mode}));assert.deepEqual(r,{health:100,stage:0,taken:false,alive:10,mode:'playing'});
  });
  await check('lethal damage stops simulation and offers a retry',async()=>{
    await run(()=>{const g=__VANGUARD__;g.mission.damage(100,g.mission.enemies[0].actor.root.position);});assert.equal(await run(()=>__VANGUARD__.state.mode),'result');const t=await run(()=>__VANGUARD__.state.time);await page.waitForTimeout(300);assert.equal(await run(()=>__VANGUARD__.state.time),t);assert.equal(await page.textContent('#result-title'),'OPERÁTOR VYŘAZEN');
  });
  await check('returning to training rebuilds its map and playing state',async()=>{
    await page.click('#result-menu');await page.click('[data-level="training"]');await page.click('#play');assert.equal(await run(()=>__VANGUARD__.world.targets.length),10);assert.equal(await run(()=>__VANGUARD__.state.level),'training');assert.equal(await page.locator('#target-list button').count(),10);
  });
  await check('standalone file has no runtime errors or network requests',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);});
  console.log(JSON.stringify({passed:count,errors,requests}));
}catch(error){await page.screenshot({path:'tmp/mission-test-failure.png'});console.log('STATE',await run(()=>({state:__VANGUARD__.state,stage:__VANGUARD__.mission?.stage,interaction:__VANGUARD__.mission?.interaction()?.text})));throw error;}finally{await browser.close();}

