// Frames of Sizwe's moves from a front three-quarter camera: SHOTS=dir MOVES=hook,body node tools/smoke.mjs <url> <dir> movesheet
// Writes <dir>/mv-<move>-<i>.png (crop + tile them with any image tool).
export default async function ({ page, run, sleep }) {
  const out = process.env.SHOTS || '/tmp';
  const moves = (process.env.MOVES || 'punchL,punchR,hook,body,uppercut,kick,swing,bat').split(',');
  const fracs = (process.env.FRACS || '0.2,0.38,0.55,0.8').split(',').map(Number);
  await page.click('#btn-new');
  await sleep(4200);
  await run(() => {
    const g = window.__game;
    g.testFreeze = true;
    g.missions.debugPass();
    document.querySelectorAll('.title-card').forEach((e) => e.remove());
    g.hud.show(false);
    g.env.hours = 12;
  });
  await run(() => window.__game.simulate(1));
  for (const mv of moves) {
    for (let i = 0; i < fracs.length; i++) {
      await run(async ([mv, f, weapon]) => {
        const g = window.__game, p = g.player, V = p.rig.group.position.constructor;
        g.hud.closeDialogue?.();
        g.weapons.inv.owned[weapon] = true;
        g.weapons.equip(weapon);
        p.place(-440, -372, 0);
        p.locked = true;
        p.anim = { guard: weapon === 'fists', action: mv, actionT: f };
        const h = p.heading, fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
        g.cameraRig.setShot(new V(p.x + fx * 3.4 - rx * 1.8, 1.5, p.z + fz * 3.4 - rz * 1.8), new V(p.x, 1.05, p.z), 50);
        g.cameraRig.first = true;
        await g.simulate(0.25);
      }, [mv, fracs[i], mv === 'bat' ? 'bat' : mv === 'swing' ? 'spanner' : 'fists']);
      await sleep(350);
      await page.screenshot({ path: `${out}/mv-${mv}-${i}.png` });
    }
  }
}
