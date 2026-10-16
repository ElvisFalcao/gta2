import { readFileSync } from 'fs';
export default async function ({ page, run, sleep, shot, logs }) {
  await page.addScriptTag({ content: readFileSync(new URL('./autopilot.js', import.meta.url), 'utf8') });
  await page.click('#btn-new');
  await sleep(2600);
  await shot('V1-intro-bay');
  console.log(JSON.stringify(await run(() => ({ calls: window.__game.renderer.info.render.calls, tris: window.__game.renderer.info.render.triangles }))));
  await run(() => window.__game.simulate(4.5));
  await sleep(1500);
  await shot('V2-intro-flyover');
  for (let i = 0; i < 300; i++) {
    if (await run(() => window.__game.state.done.includes('m1'))) break;
    await run(() => window.__auto.step());
    await run(() => window.__game.simulate(0.4));
  }
  await run(() => { window.__game.input.btnHeld.action = false; window.__game.env.hours = 15; });
  await run(() => { const g = window.__game; g.player.place(-148, 244, 0); g.activities.rideCable(true); });
  await sleep(800);
  await run(() => window.__game.simulate(6));
  await sleep(1500);
  await shot('V3-cable-ride');
  await run(() => window.__game.simulate(10));
  await sleep(2000);
  await run(() => window.__game.simulate(1));
  await sleep(1200);
  await shot('V4-top-arrival');
  await run(() => { const g = window.__game; g.player.place(-54, 357, Math.PI, true); g.activities.enjoyView(30); });
  await run(() => window.__game.simulate(4));
  await sleep(2500);
  await shot('V5-view');
}
