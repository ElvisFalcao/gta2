// In-game fight contact sheet: Sizwe throws jab / cross / kick at a gang member, a frame every ~0.1 s.
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
export default async function ({ page, run, sleep, shot }) {
  await page.addScriptTag({ content: readFileSync(new URL('./autopilot.js', import.meta.url), 'utf8') });
  await page.click('#btn-new');
  await sleep(300);
  for (let i = 0; i < 300; i++) {
    if (await run(() => window.__game.state.done.includes('m1'))) break;
    await run(() => window.__auto.step());
    await run(() => window.__game.simulate(0.4));
  }
  await run(() => {
    const g = window.__game;
    g.input.btnHeld = {};
    g.player.place(-440, -372, 0);
    g.env.hours = 11;
    g.testFreeze = true;
    g.__enemy = g.peds.spawn(-440, -370.7, { kind: 'gang', ai: 'fight', target: g.player, health: 400, mission: true, heading: Math.PI, dmgMul: 0 });
    g.cameraRig.yaw = Math.PI / 2;
    g.cameraRig.manualT = 99;
    g.cameraRig.dist = 4.5;
  });
  await run(() => window.__game.simulate(1));
  const out = process.env.SHOTS || '/tmp';
  const files = [];
  for (let f = 0; f < 30; f++) {
    const info = await run(() => {
      const g = window.__game, p = g.player;
      if (!p.attack && (window.__n || 0) < 3) {
        p.startAttack();
        window.__n = (window.__n || 0) + 1;
      }
      g.cameraRig.yaw = Math.PI / 2;
      g.cameraRig.manualT = 99;
      return g.simulate(0.08).then(() => `${p.attack ? p.attack.type + ' ' + p.attack.t.toFixed(2) : '-'} enemy:${g.__enemy.state} hp:${g.__enemy.health.toFixed(0)} guard:${p.guard}`);
    });
    console.log(f, info);
    await sleep(350);
    const file = `${out}/gf-${String(f).padStart(2, '0')}.png`;
    await page.screenshot({ path: file, clip: { x: 320, y: 120, width: 640, height: 480 } });
    files.push(file);
  }
  execSync(`ffmpeg -v error -y ${files.map((f) => `-i ${f}`).join(' ')} -filter_complex "${files.map((_, i) => `[${i}]`).join('')}xstack=inputs=${files.length}:layout=${files.map((_, i) => `${(i % 5) * 640}_${Math.floor(i / 5) * 480}`).join('|')}" ${out}/game-fight-sheet.png`);
}
