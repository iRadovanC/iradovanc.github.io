'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // The actual distributable must also work directly from the filesystem.
  await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href + '?test');
  await page.waitForFunction(() => window.IronFront);
  await page.getByRole('button', { name: 'ZAHÁJIT OPERACI →' }).click();
  assert.deepEqual(await page.evaluate(() => IronFront.getState().assets), [true, true, true, true]);
  const rules = await page.evaluate(() => {
    const t = IronFront.test, before = IronFront.getState().credits;
    t.buy('tank');
    const locked = IronFront.getState().queue.length === 0 && IronFront.getState().credits === before;
    const river = t.canPlace('power', 1380, 900).ok;
    const overlapping = t.canPlace('power', 445, 1010).ok;
    t.buy('factory'); t.place(465, 780); t.step(15);
    const power = IronFront.getState().entities.find(e => e.type === 'power' && e.team === 'player');
    t.damage(power.id, 5000);
    t.buy('tank'); t.step(5);
    const lowPower = IronFront.getState().queue.find(q => q.type === 'tank').remaining;
    return { locked, river, overlapping, lowPower };
  });
  assert.equal(rules.locked, true);
  assert.equal(rules.river, false);
  assert.equal(rules.overlapping, false);
  assert(rules.lowPower > 7.8 && rules.lowPower < 8.2);
  console.log('PASS: file:// offline play, prerequisite/placement rules, low-power slowdown');
  await page.evaluate(() => IronFront.test.reset());
  // Win using only legal purchases, mining and attack orders. No free credits,
  // entity spawning or forced damage in this complete mission playthrough.
  const result = await page.evaluate(() => {
    const t = IronFront.test;
    t.buy('factory'); t.place(465, 780);
    t.buy('turret'); t.place(1020, 965);
    t.step(15);
    let purchased = 0;
    while (IronFront.getState().time < 210 && purchased < 7 && !IronFront.getState().ended) {
      if (IronFront.getState().credits >= 650) { t.buy('tank'); purchased++; }
      t.step(5);
    }
    t.step(30);
    const army = IronFront.getState().entities.filter(e => e.team === 'player' && ['tank', 'rifle', 'rocket'].includes(e.type) && e.hp > 0);
    t.select(army.map(e => e.id));
    t.command(2050, 365, true);
    for (let i = 0; i < 80 && !IronFront.getState().ended; i++) t.step(5);
    const state = IronFront.getState();
    t.setCamera(1900, 550); t.render();
    return { time: state.time, purchased, gathered: state.gathered, ended: state.ended, kills: state.kills,
      playerHQ: state.entities.find(e => e.type === 'hq').hp,
      fortress: state.entities.find(e => e.type === 'fortress').hp,
      survivingTanks: state.entities.filter(e => e.type === 'tank' && e.team === 'player' && e.hp > 0).length,
      units: state.entities.filter(e => e.type === 'tank' && e.team === 'player').map(e => ({x:e.x,y:e.y,hp:e.hp,order:e.order,path:e.pathLength})) };
  });
  console.log(JSON.stringify(result, null, 2));
  await page.screenshot({ path: path.join(__dirname, '..', 'output', 'mission-result.png') });
  assert.equal(result.fortress, 0, 'The mission can be won with normal economy and orders');
  assert(result.playerHQ > 0, 'The player base survives');
  assert.deepEqual(errors, []);
  console.log('PASS: complete mission victory with legal purchases and orders');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
