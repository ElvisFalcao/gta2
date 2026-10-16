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
  await run(() => { const g = window.__game; g.input.btnHeld.action = false; g.player.place(-440, -372, 0); g.cameraRig.first = true; g.cameraRig.yaw = 0; g.env.hours = 11;
    g.__enemy = g.peds.spawn(-440, -370.6, { kind: 'gang', ai: 'idle', health: 200, mission: true }); });
  await run(() => window.__game.simulate(1));
  const probe = () => run(() => {
    const g = window.__game, p = g.player, r = p.rig;
    r.group.updateMatrixWorld(true);
    const bad = (m) => m.elements.some((x) => !Number.isFinite(x));
    const bones = r.mesh.skeleton.bones.map((b) => bad(b.matrixWorld));
    const cam = g.camera.position;
    return { state: p.state, vis: r.group.visible, meshVis: r.mesh.visible, pos: [p.x.toFixed(2), p.y.toFixed(2), p.z.toFixed(2)], h: p.heading.toFixed(2), groupBad: bad(r.group.matrixWorld), bonesBad: bones.some(Boolean), attack: p.attack && p.attack.type,
      cam: [cam.x.toFixed(1), cam.y.toFixed(1), cam.z.toFixed(1)], camDist: Math.hypot(cam.x - p.x, cam.z - p.z).toFixed(2), enemy: [g.__enemy.x.toFixed(2), g.__enemy.z.toFixed(2), g.__enemy.state, g.__enemy.health.toFixed(0)], scale: [r.group.scale.x, r.b.spine.scale.x.toFixed(2)] };
  });
  console.log('before', JSON.stringify(await probe()));
  await sleep(1200);
  await shot('P0-before');
  let ok = true;
  const hp0 = (await probe()).enemy[3];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('KeyJ');
    // sample several frames across the whole swing (punches and the kick)
    for (let f = 0; f < 6; f++) {
      await run(() => window.__game.simulate(0.05));
      const s = await probe();
      if (s.bonesBad || s.groupBad || !s.vis) { ok = false; console.log('BAD FRAME', i, f, JSON.stringify(s)); }
    }
    if (i === 1) { await sleep(900); await shot('P-punch'); }
  }
  const hp1 = (await probe()).enemy[3];
  console.log(ok && +hp1 < +hp0 ? `PASS: Sizwe stayed visible through 6 attacks, enemy health ${hp0} -> ${hp1}` : `FAIL: visible=${ok} enemy health ${hp0} -> ${hp1}`);
}
