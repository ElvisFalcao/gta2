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
  await run(() => { const g = window.__game; g.input.btnHeld.action = false; g.player.place(117, -255, 0); g.env.hours = 10;
    g.__impacts = 0; g.__pedHits = 0;
    const V = g.vehicles.list[0].constructor;
    const orig = V.prototype.onImpact; V.prototype.onImpact = function (s, x, z) { if (s > 4 && this.driver === 'npc') g.__impacts++; return orig.call(this, s, x, z); };
    g.__stuck = new Map();
  });
  const sample = () => run(() => {
    const g = window.__game;
    const tr = g.vehicles.list.filter((v) => v.driver === 'npc' && v.ai && v.ai.isTraffic);
    let slow = 0, sum = 0, off = 0;
    for (const v of tr) {
      sum += v.speed;
      const t = (g.__stuck.get(v) || 0);
      if (v.speed < 0.5) g.__stuck.set(v, t + 1); else g.__stuck.set(v, 0);
      if ((g.__stuck.get(v) || 0) > 12) slow++;
      const ne = g.roads.nearestEdge(v.x, v.z);
      if (ne && ne.d > ne.edge.width / 2 + 1) off++;
    }
    return { n: tr.length, avg: tr.length ? (sum / tr.length).toFixed(1) : 0, stuck12s: slow, offroad: off, impacts: g.__impacts, peds: g.peds.list.length, downPeds: g.peds.list.filter((p) => p.state !== 'ok').length };
  });
  for (let k = 0; k < 12; k++) {
    await run(() => window.__game.simulate(5));
    console.log('t+' + (k + 1) * 5 + 's', JSON.stringify(await sample()));
  }
  await sleep(1500);
  await shot('T-traffic');
}
