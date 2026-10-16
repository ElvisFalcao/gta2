import { readFileSync } from 'fs';
export default async function ({ page, run, sleep, shot, logs }) {
  await page.addScriptTag({ content: readFileSync(new URL('./autopilot.js', import.meta.url), 'utf8') });
  await page.click('#btn-new');
  await sleep(300);
  // finish m1 quickly so we're free roaming
  for (let i = 0; i < 300; i++) {
    const done = await run(() => window.__game.state.done.includes('m1'));
    if (done) break;
    await run(() => window.__auto.step());
    await run(() => window.__game.simulate(0.4));
  }
  await run(() => { window.__game.input.btnHeld.action = false; });
  await run(() => window.__game.simulate(4));
  const st = () => run(() => { const g = window.__game, p = g.player; return { p: [Math.round(p.x), Math.round(p.z)], state: p.state, speed: p.vehicle ? p.vehicle.speed.toFixed(1) : p.speedNow.toFixed(1), hp: Math.round(p.health), stars: g.police.stars, cops: g.police.cops.size, peds: g.peds.list.length, cars: g.vehicles.list.length, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles }; });
  // A: walk on Long Street
  await run(() => { const g = window.__game; g.player.place(46, -230, Math.PI); g.cameraRig.first = true; g.cameraRig.yaw = Math.PI; g.env.hours = 10; });
  await run(() => window.__game.simulate(3));
  await page.keyboard.down('KeyW');
  await run(() => window.__game.simulate(2));
  await page.keyboard.up('KeyW');
  console.log('A walk', JSON.stringify(await st()));
  await sleep(1200);
  await shot('A-longstreet');
  // B: drive
  await run(() => { const g = window.__game; g.player.place(110, -330, Math.PI); g.cameraRig.first = true; g.cameraRig.yaw = Math.PI; const v = g.vehicles.spawn('sports', 110 - 2.5, -326, Math.PI, { persistent: true }); g.player.enterVehicle(v); });
  await page.keyboard.down('KeyW');
  await run(() => window.__game.simulate(3));
  console.log('B drive 3s', JSON.stringify(await st()));
  await sleep(1500);
  await shot('B-driving');
  await page.keyboard.down('KeyD');
  await run(() => window.__game.simulate(1.2));
  await page.keyboard.up('KeyD');
  await run(() => window.__game.simulate(2));
  await page.keyboard.up('KeyW');
  console.log('B drive turn', JSON.stringify(await st()));
  await sleep(1500);
  await shot('B-driving2');
  // brake & exit
  await page.keyboard.down('KeyS');
  await run(() => window.__game.simulate(2));
  await page.keyboard.up('KeyS');
  await page.keyboard.press('KeyF');
  await run(() => window.__game.simulate(0.5));
  console.log('B exit', JSON.stringify(await st()));
  // C: crime
  await run(() => { const g = window.__game; const p = g.player; const civ = g.peds.list.find((q) => q.kind === 'civ' && q.state === 'ok'); if (civ) { p.place(civ.x - 1, civ.z, Math.PI / 2); civ.takeHit(10, 1, 0, p, 'light'); } });
  await run(() => window.__game.simulate(5));
  console.log('C crime', JSON.stringify(await st()));
  await sleep(1200);
  await shot('C-wanted');
  await run(() => window.__game.simulate(8));
  console.log('C after', JSON.stringify(await st()), await run(() => document.querySelector('#banner .title').textContent));
  await sleep(4000);
  await run(() => window.__game.simulate(4));
  console.log('C busted?', JSON.stringify(await st()), await run(() => window.__game.state.totals));
  // D: night in Bo-Kaap
  await run(() => { const g = window.__game; g.police.clear(); g.player.place(-150, -200, 0); g.cameraRig.first = true; g.cameraRig.yaw = 0.6; g.env.hours = 21; });
  await run(() => window.__game.simulate(2));
  await sleep(1500);
  await shot('D-night-bokaap');
  // E: Table Mountain top
  await run(() => { const g = window.__game; g.env.hours = 16.5; g.player.place(-148, 244, 0); });
  await run(() => window.__game.activities.rideCable(true));
  await run(() => window.__game.simulate(2));
  await sleep(1500);
  await shot('E-cable');
  await run(() => window.__game.simulate(14));
  await sleep(1500);
  await run(() => { const g = window.__game; g.cameraRig.yaw = Math.PI; });
  await run(() => window.__game.simulate(1));
  await sleep(1000);
  await shot('E-top');
  console.log('E top', JSON.stringify(await st()), await run(() => window.__game.player.onPlateau));
  // G: gym
  await run(() => { const g = window.__game; g.player.onPlateau = false; g.player.place(-520, -166, 0); g.env.hours = 9; g.activities.gym(); });
  await sleep(500);
  for (let i = 0; i < 6; i++) await run(() => document.querySelector('#minigame .tap')?.dispatchEvent(new PointerEvent('pointerdown')));
  await sleep(1500);
  await shot('G-gym');
  for (let i = 0; i < 90; i++) { await run(() => document.querySelector('#minigame .tap')?.dispatchEvent(new PointerEvent('pointerdown'))); await sleep(40); }
  await sleep(500);
  console.log('G gym', await run(() => JSON.stringify(window.__game.state.stats)));
  // H: menu + map
  await run(() => window.__game.menu.open('missions'));
  await sleep(1200);
  await shot('H-menu');
  await run(() => { window.__game.menu.close(); window.__game.menu.openMap(); });
  await sleep(1200);
  await shot('H-map');
  await run(() => window.__game.menu.closeMap());
}
