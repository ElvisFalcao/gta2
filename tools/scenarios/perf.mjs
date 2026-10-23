// Triangles / draw calls / fps at a few busy spots (fps is only meaningful on real hardware).
export default async function ({ page, run, sleep }) {
  await page.click('#btn-new');
  await sleep(500);
  for (const [name, x, z] of [['bokaap', -165, -185], ['citycentre', 75, -255], ['langa', 640, 60]]) {
    const r = await run(async ([x, z]) => {
      const g = window.__game;
      g.player.place(x, z, 0);
      g.env.hours = Number(new URLSearchParams(location.search).get('hour') || 21);
      await g.simulate(1);
      await new Promise((res) => setTimeout(res, 1500));
      const t0 = performance.now();
      let n = 0;
      await new Promise((res) => { const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      const i = g.renderer.info.render;
      return { fps: (n / 2).toFixed(1), calls: i.calls, tris: i.triangles, peds: g.peds.list.length };
    }, [x, z]);
    console.log(name, JSON.stringify(r));
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/perf-${name}.png` });
  }
}
