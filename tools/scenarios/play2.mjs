import { readFileSync } from 'fs';
export default async function ({ page, run, sleep, shot, logs }) {
  await page.addScriptTag({ content: readFileSync(new URL('./autopilot.js', import.meta.url), 'utf8') });
  await page.click('#btn-new');
  await sleep(300);
  for (let i = 0; i < 300; i++) {
    if (await run(() => window.__game.state.done.includes('m1'))) break;
    await run(() => window.__auto.step());
    await run(() => window.__game.simulate(0.4));
  }
  await run(() => { window.__game.input.btnHeld.action = false; });
  await run(() => window.__game.simulate(4));
  const st = () => run(() => { const g = window.__game, p = g.player; return { p: [Math.round(p.x), Math.round(p.z)], state: p.state, hp: Math.round(p.health), stars: g.police.stars, cops: g.police.cops.size, pcars: g.police.cars.size, arrest: g.police.arrestT.toFixed(2), sideGivers: g.missions.side.givers.length, mission: g.missions.active && g.missions.active.def.title }; });
  // police: assault a civilian on Adderley St
  await run(() => { const g = window.__game; g.player.place(110 + 7.5, -250, 0); g.cameraRig.first = true; const civ = g.peds.spawn(110 + 7.5, -248, { kind: 'civ', ai: 'wander' }); civ.tough = false; civ.takeHit(10, 0, 1, g.player, 'light'); });
  await run(() => window.__game.simulate(1));
  console.log('crime', JSON.stringify(await st()));
  await run(() => window.__game.simulate(6));
  console.log('cops coming', JSON.stringify(await st()));
  await sleep(1500);
  await shot('P1-cops');
  await run(() => window.__game.simulate(8));
  console.log('cops later', JSON.stringify(await st()));
  await sleep(4500);
  await run(() => window.__game.simulate(2));
  console.log('after arrest?', JSON.stringify(await st()), JSON.stringify(await run(() => window.__game.state.totals)));
  await sleep(2500);
  await shot('P2-after-busted');
  // night in the Bo-Kaap street
  await run(() => { const g = window.__game; g.police.clear(); g.player.place(-160, -150, 0); g.cameraRig.first = true; g.cameraRig.yaw = Math.PI * 0.75; g.env.hours = 21.5; });
  await run(() => window.__game.simulate(2));
  await sleep(1500);
  await shot('N1-night-bokaap');
  await run(() => { const g = window.__game; g.player.place(110 - 7.5, -200, Math.PI); g.cameraRig.first = true; g.cameraRig.yaw = Math.PI; g.env.hours = 22; });
  await run(() => window.__game.simulate(2));
  await sleep(1500);
  await shot('N2-night-cbd');
  // Table Mountain view
  await run(() => { const g = window.__game; g.env.hours = 16; g.player.place(-148, 244, 0); g.activities.rideCable(true); });
  await run(() => window.__game.simulate(16));
  await sleep(1200);
  await run(() => { const g = window.__game; g.cameraRig.yaw = Math.PI; g.player.heading = Math.PI; });
  await run(() => window.__game.simulate(1));
  await sleep(1200);
  await shot('T1-top-view');
  // walk to the edge
  await run(() => { const g = window.__game; g.player.place(-60, 365, Math.PI, true); g.cameraRig.yaw = Math.PI; g.cameraRig.first = true; });
  await run(() => window.__game.simulate(1));
  await sleep(1200);
  await shot('T2-viewpoint');
  await run(() => window.__game.activities.rideCable(false));
  await run(() => window.__game.simulate(16));
  // side quest: spawn a giver next to us and accept
  await run(() => { const g = window.__game; g.env.hours = 10; g.player.place(46, -230, 0); g.missions.side.addGiver(46, -226); });
  await run(() => window.__game.simulate(0.5));
  await run(() => { const g = window.__game; const q = g.missions.side.givers[g.missions.side.givers.length - 1]; g.missions.side.offer(q); });
  for (let i = 0; i < 200; i++) {
    const r = await run(() => window.__auto.step());
    await run(() => window.__game.simulate(0.4));
    const m = await run(() => window.__game.missions.active && window.__game.missions.active.def.title);
    if (!m) { console.log('side quest ended after', i, 'steps'); break; }
    if (i === 3) { await sleep(1200); await shot('S1-sidequest'); }
  }
  console.log('side', JSON.stringify(await st()), JSON.stringify(await run(() => window.__game.state.totals)));
  await run(() => { window.__game.input.btnHeld.action = false; });
  // taxi job
  await run(() => { const g = window.__game; g.player.place(140, -320, Math.PI / 2); const v = g.vehicles.spawn('minibus', 143, -320, Math.PI / 2, { persistent: true }); g.player.enterVehicle(v); g.activities.startTaxi(); });
  await run(() => window.__game.simulate(1));
  console.log('taxi', JSON.stringify(await run(() => { const t = window.__game.activities.taxi; return t && { stage: t.stage, target: t.target }; })));
  await run(() => { const g = window.__game; const t = g.activities.taxi; g.player.vehicle.x = t.target.x; g.player.vehicle.z = t.target.z; g.player.vehicle.vx = g.player.vehicle.vz = 0; });
  await run(() => window.__game.simulate(1));
  console.log('taxi2', JSON.stringify(await run(() => { const t = window.__game.activities.taxi; return t && { stage: t.stage, target: t.target, time: t.timeLeft }; })));
  await run(() => { const g = window.__game; const t = g.activities.taxi; g.player.vehicle.x = t.target.x; g.player.vehicle.z = t.target.z; g.player.vehicle.vx = g.player.vehicle.vz = 0; });
  await run(() => window.__game.simulate(1));
  console.log('taxi3', JSON.stringify(await run(() => { const g = window.__game; const t = g.activities.taxi; return t && { stage: t.stage, fares: t.fares, money: g.state.money }; })));
  await sleep(1200);
  await shot('X1-taxi');
}
