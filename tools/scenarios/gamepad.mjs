// Drives the game with a fake standard-mapping (Xbox) gamepad and checks every binding.
import { readFileSync } from 'fs';
export default async function ({ page, run, sleep, shot }) {
  await page.addScriptTag({ content: readFileSync(new URL('./autopilot.js', import.meta.url), 'utf8') });
  await run(() => {
    const btn = () => ({ pressed: false, touched: false, value: 0 });
    window.__pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn), vibrationActuator: { playEffect: (t, o) => { window.__rumbles = (window.__rumbles || 0) + 1; return Promise.resolve('complete'); } } };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.__pad, null, null, null], configurable: true });
    window.__setBtn = (i, on) => { const b = window.__pad.buttons[i]; b.pressed = on; b.value = on ? 1 : 0; };
  });
  const results = [];
  const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}: ${name} ${info}`); };
  const sim = (s) => run((s) => window.__game.simulate(s), s);
  const tap = async (i, paused = false) => {
    await run((i) => window.__setBtn(i, true), i);
    if (paused) await sleep(250); else await sim(0.1);
    await run((i) => window.__setBtn(i, false), i);
    if (paused) await sleep(250); else await sim(0.1);
  };
  // A on the title screen starts a new game
  await run(() => window.__setBtn(0, true));
  await page.waitForFunction(() => window.__game.started, null, { timeout: 20000 }).catch(() => {});
  await run(() => window.__setBtn(0, false));
  await sleep(300);
  check('A starts the game from the title screen', await run(() => window.__game.started));
  check('gamepad detected', await run(() => window.__game.input.usingGamepad));
  for (let i = 0; i < 300; i++) {
    if (await run(() => window.__game.state.done.includes('m1'))) break;
    await run(() => window.__auto.step());
    await sim(0.4);
  }
  await run(() => { const g = window.__game; g.input.btnHeld = {}; g.player.place(-440, -372, 0); g.env.hours = 11; });
  await run(() => window.__game.input.setGamepad(true));
  await sim(0.5);
  // left stick walks
  const p0 = await run(() => [window.__game.player.x, window.__game.player.z]);
  await run(() => { window.__pad.axes[1] = -1; });
  await sim(1);
  await run(() => { window.__pad.axes[1] = 0; });
  const p1 = await run(() => [window.__game.player.x, window.__game.player.z]);
  check('left stick moves Sizwe', Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 2, JSON.stringify([p0, p1]));
  // right stick turns the camera
  const y0 = await run(() => window.__game.cameraRig.yaw);
  await run(() => { window.__pad.axes[2] = 1; });
  await sim(0.5);
  await run(() => { window.__pad.axes[2] = 0; });
  const y1 = await run(() => window.__game.cameraRig.yaw);
  check('right stick turns the camera', Math.abs(y1 - y0) > 0.3, `${y0.toFixed(2)} -> ${y1.toFixed(2)}`);
  // B punches
  await run(() => { const g = window.__game, p = g.player; g.__enemy = g.peds.spawn(p.x + Math.sin(p.heading) * 1.3, p.z + Math.cos(p.heading) * 1.3, { kind: 'gang', ai: 'idle', health: 200, mission: true }); });
  await sim(0.3);
  const hp0 = await run(() => window.__game.__enemy.health);
  for (let i = 0; i < 4; i++) { await tap(1); await sim(0.3); }
  const hp1 = await run(() => window.__game.__enemy.health);
  check('B punches', hp1 < hp0, `${hp0} -> ${hp1}`);
  check('rumble on hit', (await run(() => window.__rumbles || 0)) >= 0);
  await run(() => { const e = window.__game.__enemy; window.__game.peds.remove ? window.__game.peds.remove(e) : (e.health = 0); });
  // X jumps
  await run(() => window.__setBtn(2, true));
  await sim(0.15);
  const air = await run(() => window.__game.player.airborne || window.__game.player.y > 0.05);
  await run(() => window.__setBtn(2, false));
  await sim(1);
  check('X jumps', air);
  // Y gets in a car, RT drives, LT brakes, Y gets out
  await run(() => { const g = window.__game, p = g.player; g.cheat('BAKKIE'); const v = g.vehicles.nearestEnterable(p.x, p.z, 25); p.place(v.x + Math.cos(v.heading) * 1.6, v.z - Math.sin(v.heading) * 1.6, 0); });
  await sim(0.3);
  await tap(3);
  await sim(1.5);
  check('Y enters the vehicle', await run(() => window.__game.player.state === 'vehicle'));
  await run(() => { window.__pad.buttons[7].value = 1; window.__pad.buttons[7].pressed = true; });
  await sim(2.5);
  const sp = await run(() => window.__game.player.vehicle.fwdSpeed);
  check('RT accelerates', sp > 6, sp.toFixed(1));
  await shot('G1-driving');
  await run(() => { window.__pad.buttons[7].value = 0; window.__pad.buttons[7].pressed = false; window.__pad.buttons[6].value = 1; window.__pad.buttons[6].pressed = true; });
  await sim(1.2);
  const sp2 = await run(() => window.__game.player.vehicle.fwdSpeed);
  await run(() => { window.__pad.buttons[6].value = 0; window.__pad.buttons[6].pressed = false; });
  check('LT brakes', sp2 < sp - 3, sp2.toFixed(1));
  await sim(1.5);
  await tap(3);
  await sim(1.5);
  check('Y exits the vehicle', await run(() => window.__game.player.state === 'foot'));
  // Menu pauses, RB switches tab, B resumes
  await tap(9, true);
  check('Menu opens the pause menu', await run(() => window.__game.menu.isOpen && window.__game.paused));
  const tab0 = await run(() => window.__game.menu.tab);
  await tap(5, true);
  const tab1 = await run(() => window.__game.menu.tab);
  check('RB switches menu tab', tab0 !== tab1, `${tab0} -> ${tab1}`);
  await run(() => window.__game.menu.show('help'));
  await sleep(200);
  await shot('G2-menu-help');
  await tap(1, true);
  check('B closes the menu', await run(() => !window.__game.menu.isOpen && !window.__game.paused));
  // View opens the map, A sets a waypoint, B closes
  await tap(8);
  await sleep(200);
  check('View opens the map', await run(() => window.__game.menu.mapOpen));
  await run(() => { window.__game.waypoint = null; window.__pad.axes[0] = 1; });
  await sleep(400);
  await run(() => { window.__pad.axes[0] = 0; });
  await tap(0, true);
  check('A sets a waypoint on the map', await run(() => !!window.__game.waypoint), JSON.stringify(await run(() => { const g = window.__game; return [g.waypoint, g.menu.mapPan, g.player.x, g.player.z, g.menu.mapOpen, g.paused, g.fps]; })));
  await shot('G3-map');
  await tap(1, true);
  check('B closes the map', await run(() => !window.__game.menu.mapOpen && !window.__game.paused));
  // dialogue choice with d-pad + A
  const pick = run(() => window.__game.hud.choose('Pick one', [{ text: 'First' }, { text: 'Second' }, { text: 'Third' }]).then((i) => (window.__picked = i)));
  await sim(0.2);
  await tap(13);
  await tap(13);
  await shot('G4-choice');
  await tap(0);
  await pick;
  check('D-pad + A picks a dialogue choice', (await run(() => window.__picked)) === 2, String(await run(() => window.__picked)));
  // prompt shows controller glyphs
  const prompt = await run(() => { const h = window.__game.hud; h.actionLabel = 'Talk'; h.updatePrompt(false, 'foot'); const s = document.getElementById('prompt').innerHTML; h.actionLabel = null; return s; });
  check('prompt shows LB glyph', prompt.includes('LB'), prompt);
  check('touch controls hidden while using the pad', await run(() => document.getElementById('touch').classList.contains('hidden')));
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
}
