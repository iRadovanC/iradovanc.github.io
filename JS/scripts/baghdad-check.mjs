import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},offline:true});
const errors=[],requests=[];
page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});
page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('CONSOLE',m.text().slice(0,600));}});
page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
try{
  await page.goto(pathToFileURL(path.resolve(process.env.GAME_FILE||'index.html')).href+'?test');
  console.log('PAGE LOADED');
  await page.waitForFunction(()=>window.__VANGUARD__?.state.ready,null,{timeout:45000});
  await page.click('[data-level="baghdad"]');await page.waitForTimeout(1500);await page.screenshot({path:'tmp/baghdad-menu.png'});
  await page.click('#play');await page.waitForTimeout(1300);await page.screenshot({path:'tmp/baghdad-play.png'});
  console.log('STATE',await page.evaluate(()=>({ready:__VANGUARD__.state.ready,level:__VANGUARD__.state.level,mode:__VANGUARD__.state.mode,diagnostics:__VANGUARD__.diagnostics,enemies:__VANGUARD__.mission.enemies.filter(e=>e.active).length})));
  await page.keyboard.press('Tab');await page.waitForTimeout(200);await page.screenshot({path:'tmp/baghdad-map.png'});
  // Inspect the tangible mission props from their normal approach directions.
  await page.keyboard.press('Tab');
  for(const [name,x,z,yaw] of [['power',-23,-8,0],['clinic',19,-34,0],['radio',-20,-50,0]]){
    await page.evaluate(({x,z,yaw})=>{const g=__VANGUARD__;g.pause();g.state.position.set(x,0,z);g.state.yaw=yaw;g.state.pitch=-.18;g.character.root.position.copy(g.state.position);g.character.update(1,{speed:0,sprint:false,crouched:false,aiming:false,yaw,pitch:-.18,reload:0,recoil:0,time:0,moveX:0,moveZ:0});g.updateCamera(1);document.getElementById('menu').classList.add('hidden');document.body.classList.remove('in-menu');}, {x,z,yaw});
    await page.waitForTimeout(200);await page.screenshot({path:'tmp/baghdad-'+name+'.png'});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
}catch(error){console.log('BOOT',await page.evaluate(()=>({ready:window.__VANGUARD__?.state.ready,error:document.getElementById('load-error')?.textContent})));await page.screenshot({path:'tmp/baghdad-failure.png'});throw error;}finally{await browser.close();}
