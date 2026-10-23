// Body shape, weapons (store, pickups, aim assist, shooting, tools, armed cops), boxing combos and
// lessons, and returning to the title screen: SHOTS=dir node tools/smoke.mjs <url> <dir> features
export default async function ({ page, run, sleep }) {
  const out = process.env.SHOTS || '/tmp';
  const snap = async (name) => {
    await sleep(700);
    await page.screenshot({ path: `${out}/feat-${name}.png` });
  };
  const results = [];
  const check = (name, ok, info = '') => {
    results.push(ok);
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name} ${info}`);
  };
  await page.click('#btn-new');
  await sleep(4200);
  await run(() => {
    const g = window.__game;
    g.testFreeze = true;
    g.missions.debugPass(); // skip the intro mission so shops and lessons are open
    document.querySelectorAll('.title-card').forEach((e) => e.remove());
    g.cutscene = false;
    g.dialogueOpen = false;
    g.hud.closeDialogue?.();
    g.env.hours = 11;
    g.state.money = 9000;
    g.state.respect = 120;
  });
  await run(() => window.__game.simulate(2));
  // a quiet stretch of the Sea Point promenade to work in, camera looking up the prom
  const stage = (x = -440, z = -372) =>
    run(([x, z]) => {
      const g = window.__game, p = g.player;
      g.hud.closeDialogue?.();
      g.dialogueOpen = false;
      p.locked = false;
      p.anim = null;
      p.revive();
      p.attack = null;
      p.place(x, z, 0);
      g.cameraRig.first = true;
      g.cameraRig.yaw = 0;
      g.peds.clearNonMission();
      for (const q of [...g.peds.list]) if (q.__test) q.removeMe = true;
      return g.simulate(0.4);
    }, [x, z]);

  // ------------------------------------------------------------ body
  await stage();
  const speed = (fat) =>
    run(async (fat) => {
      const g = window.__game, p = g.player;
      g.state.stats.fat = fat;
      p.place(-440, -372, 0);
      p.stamina = 100;
      g.input.keys.add('KeyW');
      g.input.btnHeld.sprint = true;
      await g.simulate(1.2);
      const v = p.speedNow;
      g.input.keys.delete('KeyW');
      g.input.btnHeld.sprint = false;
      await g.simulate(0.5);
      const B = p.rig.bones;
      return { v: +v.toFixed(2), chest: +B.chest.scale.x.toFixed(2), belly: +B.belly.scale.x.toFixed(2), bicep: +B.bicepL.scale.x.toFixed(2) };
    }, fat);
  const lean = await speed(0), heavy = await speed(100);
  check('fat makes Sizwe slower', heavy.v < lean.v * 0.85, `${lean.v} -> ${heavy.v} m/s`);
  check('fat shows: belly and chest grow', heavy.belly > lean.belly + 0.5 && heavy.chest > lean.chest, JSON.stringify({ lean, heavy }));
  const buff = await run(async () => {
    const g = window.__game, p = g.player;
    Object.assign(g.state.stats, { muscle: 100, fat: 0 });
    await g.simulate(0.2);
    return { bicep: +p.rig.bones.bicepL.scale.x.toFixed(2), maxHealth: p.maxHealth };
  });
  check('gym muscle shows: bigger arms, more health', buff.bicep > 1.5 && buff.maxHealth === 130, JSON.stringify(buff));
  const ate = await run(() => {
    const g = window.__game;
    g.state.stats.fat = 0;
    g.activities.eat('a test gatsby', 45, 60, 9);
    return g.state.stats.fat;
  });
  check('a gatsby adds fat', ate === 9, `fat ${ate}`);
  // body line-up: skinny, buff, heavy (three Sizwe look-alikes)
  await run(async () => {
    const g = window.__game, p = g.player;
    const { LOOKS } = await import('./src/entities/humanModel.js');
    p.place(-440, -390, 0); // out of shot
    const shapes = [[0, 0], [1, 0], [0.15, 1]];
    shapes.forEach(([m, f], i) => {
      const q = g.peds.spawn(-442.5 + i * 2.5, -372, { kind: 'npc', look: { ...LOOKS.sizwe }, ai: 'idle', mission: true, heading: 0, faceTarget: false });
      q.__test = true;
      q.rig.setBody(m, f);
    });
    const V = p.rig.group.position.constructor;
    g.cameraRig.setShot(new V(-440, 1.8, -366.5), new V(-440, 1.0, -372), 50);
    g.cameraRig.first = true;
    await g.simulate(0.5);
  });
  await snap('body');
  await run(() => {
    const g = window.__game;
    g.cameraRig.clearShot();
    for (const q of g.peds.list) if (q.__test) q.removeMe = true;
    Object.assign(g.state.stats, { muscle: 30, fat: 0 });
  });

  // ------------------------------------------------------------ weapons: store
  const storeOk = await run(async () => {
    const g = window.__game, w = g.weapons;
    if (!w.storeDoor) return { ok: false };
    g.player.place(w.storeDoor.x, w.storeDoor.z, 0);
    g.weapons.openStore();
    for (let i = 0; i < 40 && !document.querySelector('#choices button'); i++) await new Promise((r) => setTimeout(r, 100));
    const opts = [...document.querySelectorAll('#choices button')].map((b) => b.textContent);
    const pistol = [...document.querySelectorAll('#choices button')].find((b) => b.textContent.includes('Pistol'));
    return { ok: true, opts, door: w.storeDoor, pistol: !!pistol };
  });
  check('hardware store found in Woodstock and lists weapons', storeOk.ok && storeOk.pistol, JSON.stringify(storeOk.door));
  if (storeOk.ok) {
    await run(() => {
      const g = window.__game, w = g.weapons, V = g.player.rig.group.position.constructor;
      const d = w.storeDoor, s = w.store;
      g.cameraRig.setShot(new V(d.x + Math.sin(s.ry) * 9 + Math.cos(s.ry) * 3, 3.2, d.z + Math.cos(s.ry) * 9 - Math.sin(s.ry) * 3), new V(s.x, 2.4, s.z), 50);
      g.cameraRig.first = true;
      return g.simulate(0.3);
    });
    await snap('store');
    await page.click('#choices button:has-text("Pistol")');
    await sleep(300);
    const bought = await run(() => ({ owned: !!window.__game.weapons.inv.owned.pistol, ammo: window.__game.weapons.ammo('pistol'), money: window.__game.state.money }));
    check('bought a pistol', bought.owned && bought.ammo === 36, JSON.stringify(bought));
    await run(() => window.__game.cameraRig.clearShot());
  }

  // ------------------------------------------------------------ weapons: aim assist + shooting
  await stage();
  const shoot = await run(async () => {
    const g = window.__game, p = g.player, w = g.weapons;
    g.cheat('ARMED');
    w.equip('pistol');
    g.settings.aimAssist = 'strong';
    const e = g.peds.spawn(-438.5, -364, { kind: 'gang', ai: 'idle', health: 60, mission: true });
    e.__test = true;
    await g.simulate(0.3);
    const locked = w.target === e;
    const a0 = w.ammo('pistol');
    for (let i = 0; i < 8 && e.state !== 'dead'; i++) {
      g.input.btnPressed.attack = true;
      await g.simulate(0.35);
    }
    return { locked, dead: e.state === 'dead', used: a0 - w.ammo('pistol'), aim: +w.aimW.toFixed(2) };
  });
  check('aim assist locks on and the pistol drops a gang member', shoot.locked && shoot.dead, JSON.stringify(shoot));
  await run(async () => {
    const g = window.__game, w = g.weapons;
    const e = g.peds.spawn(-437, -363, { kind: 'gang', ai: 'idle', health: 400, mission: true });
    e.__test = true;
    await g.simulate(0.4);
    g.input.btnPressed.attack = true;
    await g.simulate(0.05);
  });
  await snap('aim');
  const off = await run(async () => {
    const g = window.__game, w = g.weapons;
    for (const q of g.peds.list) if (q.__test) q.removeMe = true;
    g.settings.aimAssist = 'off';
    const e = g.peds.spawn(-434, -366, { kind: 'gang', ai: 'idle', health: 60, mission: true });
    e.__test = true;
    await g.simulate(0.3);
    const t = w.target;
    g.settings.aimAssist = 'strong';
    await g.simulate(0.1);
    return { offTarget: !!t, strongTarget: w.target === e };
  });
  check('aim assist setting: off = no lock, strong = lock', !off.offTarget && off.strongTarget, JSON.stringify(off));
  const smg = await run(async () => {
    const g = window.__game, w = g.weapons;
    g.peds.spawn(-446, -368, { kind: 'civ' }).__test = true; // a witness
    w.equip('smg');
    const a0 = w.ammo('smg');
    g.input.btnHeld.attack = true;
    await g.simulate(1);
    g.input.btnHeld.attack = false;
    await g.simulate(0.2);
    return a0 - w.ammo('smg');
  });
  check('holding the trigger empties the SMG fast', smg >= 8, `${smg} rounds in 1 s`);
  const stars = await run(() => window.__game.police.stars);
  check('gunfire brings the police', stars >= 1, `${stars} stars`);
  await run(() => window.__game.police.clear());

  // ------------------------------------------------------------ tools
  await stage();
  const bat = await run(async () => {
    const g = window.__game, p = g.player, w = g.weapons;
    w.equip('bat');
    const e = g.peds.spawn(-440, -370.7, { kind: 'gang', ai: 'idle', health: 200, mission: true });
    e.__test = true;
    await g.simulate(0.3);
    g.input.btnPressed.attack = true;
    await g.simulate(0.1);
    const type = p.attack && p.attack.type;
    await g.simulate(0.4);
    return { type, hp: Math.round(e.health) };
  });
  check('cricket bat swing hits hard', bat.type === 'bat' && bat.hp < 185, JSON.stringify(bat));
  const pick = await run(async () => {
    const g = window.__game, w = g.weapons, p = g.player;
    delete w.inv.owned.spanner;
    w.equip('fists');
    const k = w.pickups.find((q) => q.type === 'spanner');
    if (!k) return { found: false };
    p.place(k.x, k.z, 0);
    await g.simulate(0.3);
    return { found: true, owned: !!w.inv.owned.spanner, current: w.current };
  });
  check('wheel spanner pickup in the Woodstock yard', pick.found && pick.owned, JSON.stringify(pick));

  // ------------------------------------------------------------ armed police
  await stage();
  const cops = await run(async () => {
    const g = window.__game, p = g.player;
    g.police.heat = 3;
    g.police.lastCrime = g.time;
    const c = g.police.addCop(-440, -362);
    c.__test = true;
    p.health = p.maxHealth;
    const h0 = p.health;
    let aimed = 0;
    for (let i = 0; i < 40; i++) {
      await g.simulate(0.25);
      if (c.aimW > 0.8) aimed++;
      if (p.health < h0) break;
    }
    return { gun: c.weapon, aimed, hurt: Math.round(h0 - p.health) };
  });
  check('three-star cops draw pistols and shoot', cops.gun === 'pistol' && cops.aimed > 0 && cops.hurt > 0, JSON.stringify(cops));
  await snap('cop');
  const conf = await run(() => {
    const g = window.__game;
    g.police.clear();
    g.weapons.confiscate();
    return { pistol: !!g.weapons.inv.owned.pistol, bat: !!g.weapons.inv.owned.bat };
  });
  check('busted: guns confiscated, tools kept', !conf.pistol && conf.bat, JSON.stringify(conf));

  // ------------------------------------------------------------ boxing
  await stage();
  const club = await run(() => ({ spot: !!window.__game.boxing.spot, at: window.__game.boxing.coachSpot }));
  check('Langa Boxing Club placed', club.spot, JSON.stringify(club.at));
  const combo = await run(async () => {
    const g = window.__game, p = g.player;
    g.weapons.equip('fists');
    g.state.boxing = 3;
    p.invulnT = 99; // nothing passing by should knock him over mid-combo
    const e = g.peds.spawn(-440, -370.6, { kind: 'gang', ai: 'idle', health: 999, mission: true });
    e.__test = true;
    await g.simulate(0.3);
    const seen = [];
    for (let i = 0; i < 5; i++) {
      g.input.btnPressed.attack = true;
      await g.simulate(0.05);
      if (p.attack) seen.push(p.attack.type);
      while (p.attack) await g.simulate(0.05);
      await g.simulate(0.1);
    }
    e.removeMe = true;
    p.invulnT = 0;
    return { seen, why: { st: p.state, locked: p.locked, anim: p.anim, swim: p.swimming, cur: g.weapons.current, mg: g.minigame, dlg: g.dialogueOpen, hp: p.health } };
  });
  check('boxing champion combo', combo.seen.join() === 'punchL,punchR,body,hook,uppercut', combo.seen.join() + ' ' + JSON.stringify(combo.why));
  // contact sheet of the new punches
  for (const [mv, frac] of [['hook', 0.4], ['body', 0.4], ['uppercut', 0.44]]) {
    await run(async ([mv, frac]) => {
      const g = window.__game, p = g.player, V = p.rig.group.position.constructor;
      p.place(-440, -372, 0);
      p.locked = true;
      p.anim = { guard: true, action: mv, actionT: frac };
      g.cameraRig.setShot(new V(-437.2, 1.7, -369.6), new V(-440, 1.1, -371.6), 50);
      g.cameraRig.first = true;
      await g.simulate(0.3);
    }, [mv, frac]);
    await snap('move-' + mv);
  }
  await run(() => {
    const p = window.__game.player;
    p.locked = false;
    p.anim = null;
    window.__game.cameraRig.clearShot();
  });
  // a lesson: an in-page helper taps exactly when the ring reaches the pad
  const lesson = await run(async () => {
    const g = window.__game;
    const box = document.getElementById('minigame');
    let armed = false;
    const watch = setInterval(() => {
      const ring = box.querySelector('.pad-ring');
      const m = ring && /scale\(([\d.]+)\)/.exec(ring.style.transform || '');
      if (!m) return;
      if (+m[1] >= 1.8) armed = true; // a fresh call: the ring is wide again
      if (armed && +m[1] <= 1.02) {
        armed = false;
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }));
      }
    }, 8);
    const ok = await g.boxing.padWork({ cues: ['punchL', 'punchR', 'hook'] }, 'TEST');
    clearInterval(watch);
    return ok;
  });
  check('pad-work lesson can be passed', lesson === true, String(lesson));

  // ------------------------------------------------------------ return to title
  await run(() => {
    const g = window.__game;
    g.testFreeze = false;
    g.menu.open('quit');
  });
  await sleep(400);
  await page.screenshot({ path: `${out}/feat-quit.png` });
  await Promise.all([page.waitForNavigation({ timeout: 20000 }).catch(() => null), page.click('#quit-go')]);
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 }).catch(() => null);
  await sleep(800);
  const title = await run(() => ({ title: !document.getElementById('title').classList.contains('hidden'), cont: !document.getElementById('btn-continue').classList.contains('hidden') }));
  check('returned to the title screen with Continue', title.title && title.cont, JSON.stringify(title));
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
}
