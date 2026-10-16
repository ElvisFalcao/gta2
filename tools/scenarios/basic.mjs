export default async function ({ page, run, sleep, shot, logs }) {
  await page.click('#btn-new');
  await sleep(1500);
  await shot('01-intro');
  console.log(JSON.stringify(await run(() => { const g = window.__game; return { fps: g.fps, mission: g.missions.active && g.missions.active.def.id, p: [g.player.x, g.player.z], peds: g.peds.list.length, cars: g.vehicles.list.length, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles }; })));
  await sleep(6000);
  await shot('02-kyle');
  // advance dialogue a few times
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Space'); await sleep(350); }
  await shot('03-after-dialogue');
  console.log(JSON.stringify(await run(() => { const g = window.__game; return { obj: document.querySelector('#objective').textContent, dlg: !!g.hud.dlg, phone: !document.querySelector('#phone').classList.contains('hidden'), p: [g.player.x, g.player.z], fps: g.fps }; })));
}
