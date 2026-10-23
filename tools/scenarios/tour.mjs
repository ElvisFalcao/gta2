// Screenshot tour of the city at a few times of day: SHOTS=dir node tools/smoke.mjs <url> <dir> tour
export default async function ({ page, run, sleep }) {
  await page.click('#btn-new');
  await sleep(500);
  await run(() => {
    const g = window.__game;
    g.testFreeze = true;
    g.missions.cancelAll?.();
    g.cutscene = false;
    g.hud.show(true);
  });
  const out = process.env.SHOTS || '/tmp';
  const spots = [
    ['bokaap', -165, -185, 2.4], ['citycentre', 75, -255, 0.8], ['campsbay', -560, 250, -1.9], ['langa', 640, 60, 0.6], ['waterfront', 120, -420, 3.0], ['woodstock', 380, -170, 1.2],
  ];
  const times = (process.env.TIMES || '11,18,21').split(',').map(Number);
  for (const h of times) {
    for (const [name, x, z, yaw] of spots) {
      await run(([x, z, yaw, h]) => {
        const g = window.__game, p = g.player;
        if (p.state === 'vehicle') p.exitVehicle(true);
        // stand on the nearest road and look along it
        const ne = g.roads.nearestEdge(x, z), A = g.roads.nodes[ne.edge.a], B = g.roads.nodes[ne.edge.b];
        x = ne.x;
        z = ne.z;
        yaw = Math.atan2(B.x - A.x, B.z - A.z) + (yaw > 0 ? 0 : Math.PI);
        p.place(x, z, yaw);
        g.env.hours = h;
        // fixed street-level camera behind the player
        const V = p.rig.group.position.constructor;
        g.cameraRig.setShot(new V(x - Math.sin(yaw) * 7, 2.6, z - Math.cos(yaw) * 7), new V(x + Math.sin(yaw) * 6, 2.6, z + Math.cos(yaw) * 6), 50);
        g.cameraRig.first = true;
        return g.simulate(1.2);
      }, [x, z, yaw, h]);
      await sleep(900);
      await page.screenshot({ path: `${out}/tour-${h}-${name}.png` });
    }
  }
}
