// Fixed-camera shots of the mountains, landmarks and trees: SHOTS=dir node tools/smoke.mjs <url> <dir> landmarks
export default async function ({ page, run, sleep }) {
  await page.click('#btn-new');
  await sleep(3800);
  const out = process.env.SHOTS || '/tmp';
  const info = await run(() => {
    const g = window.__game;
    g.testFreeze = true;
    g.missions.cancelAll?.();
    g.cutscene = false;
    g.hud.show(false);
    document.querySelectorAll('.title-card').forEach((e) => e.remove());
    const t = g.city.trees;
    return { oak: t.oak.length, pine: t.pine.length, palm: t.palm.length, bush: t.bush.length };
  });
  console.log('trees', JSON.stringify(info));
  // [name, camera, look-at]
  const shots = [
    ['tablemountain', [40, 30, -120], [-20, 150, 420]],
    ['lionshead', [-300, 25, -20], [-430, 70, 80]],
    ['stadium', [-120, 40, -300], [-200, 8, -355]],
    ['castle', [250, 30, -210], [295, 4, -255]],
    ['waterfront', [60, 25, -350], [120, 8, -430]],
    ['lighthouse', [-370, 14, -360], [-410, 8, -400]],
    ['cableway', [-160, 120, 250], [-110, 180, 372]],
    ['campsbay', [-560, 12, 200], [-600, 4, 260]],
    ['trees-bokaap', [-130, 14, -150], [-170, 3, -195]],
  ];
  const hours = Number(process.env.HOUR || 15);
  // the cable car, parked halfway up, seen from the side
  const cab = await run(() => {
    const L = window.__game.landmarks;
    L.cabinOverride = 0.5;
    const p = L.cableA.clone().lerp(L.cableB, 0.5);
    return [p.x, p.y - 4.2, p.z];
  });
  shots.push(['cablecar', [cab[0] + 22, cab[1] + 4, cab[2] - 6], cab]);
  for (const [name, c, l] of shots) {
    await run(([c, l, h]) => {
      const g = window.__game, V = g.player.rig.group.position.constructor;
      g.player.place(l[0], l[2], 0);
      g.env.hours = h;
      g.cameraRig.setShot(new V(...c), new V(...l), 50);
      g.cameraRig.first = true;
      return g.simulate(0.8);
    }, [c, l, hours]);
    await sleep(900);
    await page.screenshot({ path: `${out}/lm-${name}.png` });
  }
}
