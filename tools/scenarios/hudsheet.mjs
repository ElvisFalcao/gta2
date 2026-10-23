// HUD / menu contact sheet: SHOTS=dir [MOBILE=small] node tools/smoke.mjs <url> <dir> hudsheet
export default async function ({ page, run, sleep }) {
  const out = process.env.SHOTS || '/tmp';
  await sleep(2500);
  await page.screenshot({ path: `${out}/hud-title.png` });
  await page.click('#btn-new');
  await sleep(4200);
  await run(() => {
    const g = window.__game;
    g.testFreeze = true;
    g.missions.cancelAll?.();
    g.cutscene = false;
    g.hud.show(true);
    g.env.hours = 15;
    g.player.place(-165, -185, 2.4);
    g.hud.objective('Get to <em>Bo-Kaap</em> and find Auntie Fatima');
    g.hud.toast('Respect +5', 'resp');
    g.hud.toast('<b>R200</b> for the fare', 'cash');
    g.hud.toast('Police are looking for you', 'warn');
    g.hud.say('Auntie Fatima', 'Sizwe! Ag shame, you look like you slept on the beach. Come, I made koesisters.');
    return g.simulate(1);
  });
  await sleep(900);
  await page.screenshot({ path: `${out}/hud-play.png` });
  await run(() => {
    const g = window.__game;
    g.hud.closeDialogue();
    g.hud.choose('Pay the fine?', [{ text: 'Pay R500' }, { text: 'Run for it' }]);
    return g.simulate(0.3);
  });
  await sleep(600);
  await page.screenshot({ path: `${out}/hud-choice.png` });
  await run(() => {
    const g = window.__game;
    g.hud.closeDialogue?.();
    document.querySelector('#choices')?.classList.add('hidden');
    g.testFreeze = false;
    g.menu.open();
  });
  await sleep(900);
  await page.screenshot({ path: `${out}/hud-menu.png` });
}
