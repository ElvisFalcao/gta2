import { readFileSync } from 'fs';
export default async function ({ page, run, sleep, shot, logs }) {
  await page.addScriptTag({ content: readFileSync(new URL('./autopilot.js', import.meta.url), 'utf8') });
  await shot('M0-title');
  await page.tap('#btn-new');
  await sleep(2500);
  await shot('M1-intro');
  for (let i = 0; i < 300; i++) {
    if (await run(() => window.__game.state.done.includes('m1'))) break;
    const r = await run(() => window.__auto.step());
    await run(() => window.__game.simulate(0.4));
    if (r === 'dlg' && i === 6) { await sleep(800); await shot('M2-dialogue'); }
  }
  await run(() => { window.__game.input.btnHeld.action = false; });
  await run(() => window.__game.simulate(5));
  await sleep(1500);
  await shot('M3-foot');
  // use the touch joystick: drag on the left side
  await page.touchscreen.tap(10, 10);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 300, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 150, y: 240, id: 1 }] });
  await run(() => window.__game.simulate(2));
  const moved = await run(() => ({ joy: window.__game.input.joy, p: [window.__game.player.x, window.__game.player.z] }));
  console.log('joystick', JSON.stringify(moved));
  await sleep(800);
  await shot('M4-joystick');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  // car HUD
  await run(() => { const g = window.__game; const p = g.player; const v = g.vehicles.spawn('minibus', p.x + 3, p.z, p.heading, { persistent: true }); p.enterVehicle(v); });
  await run(() => window.__game.simulate(1));
  await sleep(1500);
  await shot('M5-car');
  await run(() => window.__game.menu.open('stats'));
  await sleep(1000);
  await shot('M6-menu');
  await run(() => window.__game.menu.close());
  // viewpoint
  await run(() => { const g = window.__game; g.player.exitVehicle(true); g.env.hours = 15; g.player.place(-148, 244, 0); g.activities.rideCable(true); });
  await run(() => window.__game.simulate(16));
  await run(() => { const g = window.__game; g.player.place(-54, 357, Math.PI, true); g.activities.enjoyView(30); });
  await run(() => window.__game.simulate(4));
  await sleep(2500);
  await shot('M7-view');
}
