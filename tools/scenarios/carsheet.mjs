// Line-up of every vehicle type on a road for a contact sheet: SHOTS=dir node tools/smoke.mjs <url> <dir> carsheet
export default async function ({ page, run, sleep }) {
  await page.click('#btn-new');
  await sleep(3800); // let the opening title card fade
  const out = process.env.SHOTS || '/tmp';
  await run(() => {
    const g = window.__game;
    g.testFreeze = true;
    g.missions.cancelAll?.();
    g.cutscene = false;
    g.env.hours = 11;
    document.querySelectorAll('.title-card').forEach((e) => e.remove());
    // clear traffic so the line-up is alone
    for (const v of [...g.vehicles.list]) if (v.driver !== 'player') v.wreckT = 0;
  });
  const angles = [['front', 1], ['side', 0], ['back', -1]];
  for (const [name, a] of angles) {
    await run((a) => {
      const g = window.__game, p = g.player;
      const ne = g.roads.nearestEdge(75, -255), A = g.roads.nodes[ne.edge.a], B = g.roads.nodes[ne.edge.b];
      const dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
      const hd = Math.atan2(ux, uz);
      if (!g.__lineup) {
        g.__lineup = ['minibus', 'bakkie', 'sedan', 'hatch', 'police', 'suv', 'sports'].map((t, i) =>
          g.vehicles.spawn(t, ne.x + ux * (i - 3) * 8, ne.z + uz * (i - 3) * 8, hd, { persistent: true, taxiSign: false }));
        p.place(ne.x - uz * 6, ne.z + ux * 6, hd);
      }
      // camera stays over the road (5 m to the side, 8 m up) and slides along the row
      const V = p.rig.group.position.constructor, along = a * 26;
      g.cameraRig.setShot(new V(ne.x + ux * along + uz * 5, 8, ne.z + uz * along - ux * 5), new V(ne.x + ux * along * 0.3, 0.9, ne.z + uz * along * 0.3), 50);
      g.cameraRig.first = true;
      return g.simulate(0.6);
    }, a);
    await sleep(800);
    await page.screenshot({ path: `${out}/cars-${name}.png` });
  }
  // close-up of the minibus taxi
  await run(() => {
    const g = window.__game, v = g.__lineup[0], V = v.group.position.constructor;
    const ca = v.heading + 0.7;
    g.cameraRig.setShot(new V(v.x + Math.sin(ca) * 7, 2.4, v.z + Math.cos(ca) * 7), new V(v.x, 1.0, v.z), 50);
    g.cameraRig.first = true;
    return g.simulate(0.4);
  });
  await sleep(800);
  await page.screenshot({ path: `${out}/cars-taxi.png` });
}
