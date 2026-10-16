import { readFileSync } from 'fs';
export default async function ({ page, run, sleep, shot, logs }) {
  await page.addScriptTag({ content: readFileSync(new URL('./autopilot.js', import.meta.url), 'utf8') });
  await page.click('#btn-new');
  await sleep(300);
  const from = process.env.FROM ? parseInt(process.env.FROM, 10) : 1;
  if (from > 1) await run((n) => { const g = window.__game; g.missions.failActive('ended'); for (let i = 1; i < n; i++) g.state.done.push('m' + i); g.state.respect = 0; g.state.flags.safehouse = true; g.missions.refreshGivers(); }, from);
  const status = () => run(() => { const g = window.__game; const a = g.missions.active; return { m: a && a.def.id, obj: document.querySelector('#objective').textContent.slice(0, 90), done: g.state.done.join(','), resp: g.state.respect, money: g.state.money, p: [Math.round(g.player.x), Math.round(g.player.z), g.player.state, g.player.onPlateau], time: g.time.toFixed(0), banner: document.querySelector('#banner .title').textContent }; });
  const want = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10'].slice(from - 1);
  let lastObj = '';
  const t0 = Date.now();
  for (const id of want) {
    // start mission if not active
    for (let tries = 0; tries < 1500; tries++) {
      const s = await status();
      if (s.done.split(',').includes(id)) break;
      if (!s.m) {
        await run((id) => {
          const g = window.__game;
          const d = g.missions.story.find((x) => x.id === id);
          if (g.state.respect < (d.respect || 0)) g.cheat('LEKKER');
          if (!d.auto && g.missions.available(d)) g.missions.start(d);
        }, id);
      }
      const r = await run(() => window.__auto.step());
      await run(() => window.__game.simulate(0.4));
      const s2 = await status();
      if (s2.obj !== lastObj) { console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${s2.m} | ${s2.obj} | ${r}`); lastObj = s2.obj; }
    }
    const s = await status();
    console.log(`== ${id} ${s.done.includes(id) ? 'PASSED' : 'NOT DONE'} resp=${s.resp} money=${s.money} banner=${s.banner}`);
    if (!s.done.split(',').includes(id)) {
      console.log(JSON.stringify(s));
      console.log(JSON.stringify(await run(() => { const g = window.__game; const a = g.missions.active && g.missions.active.api; return { targets: a && a.targets.map((t) => [t.x, t.z, t.color, !!t.entity]), waiters: a && a.waiters.size, pstate: g.player.state, anim: g.player.anim, locked: g.player.locked, dlgOpen: g.dialogueOpen, minigame: g.minigame }; })));
      await shot('fail-' + id);
      break;
    }
    if (id === 'm3' || id === 'm7' || id === 'm10') await shot('done-' + id);
  }
  console.log(JSON.stringify(await run(() => window.__auto.log)));
}
