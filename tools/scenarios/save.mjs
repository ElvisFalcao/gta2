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
  await run(() => { const g = window.__game; g.input.btnHeld.action = false; g.state.proteas.push(3); g.state.stats.muscle = 22; g.player.place(46, -230, 1); return g.save(); });
  const before = await run(() => { const g = window.__game; return { done: g.state.done, money: g.state.money, resp: g.state.respect, muscle: g.state.stats.muscle, clues: g.state.clues.length, pos: g.state.pos, day: g.env.day }; });
  console.log('before', JSON.stringify(before));
  await page.reload();
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const hasCont = await run(() => !document.querySelector('#btn-continue').classList.contains('hidden'));
  console.log('continue button visible', hasCont);
  await page.click('#btn-continue');
  await sleep(500);
  await run(() => window.__game.simulate(1));
  const after = await run(() => { const g = window.__game; return { done: g.state.done, money: g.state.money, resp: g.state.respect, muscle: g.state.stats.muscle, clues: g.state.clues.length, p: [Math.round(g.player.x), Math.round(g.player.z)], givers: [...g.missions.givers.keys()], proteaMeshes: g.activities.proteaMeshes.size, mission: g.missions.active && g.missions.active.def.id }; });
  console.log('after', JSON.stringify(after));
  await sleep(1000);
  await shot('SV-continue');
}
