// Contact sheet of the look-test fight: the jab, cross, kick combo and the thug's knock-down.
// node tools/lookdev-fight.mjs [url] [outDir]
import { chromium } from 'playwright';
import { execSync } from 'child_process';
const url = process.argv[2] || 'http://localhost:8123/lookdev.html';
const out = process.argv[3] || './shots';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const close = process.argv[4] === 'close';
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(url + '?mood=midday');
await page.waitForFunction(() => window.__ld, null, { timeout: 120000 });
await page.evaluate(() => {
  for (const s of ['.bar', '.tag', '#ld-fps']) document.querySelector(s).style.display = 'none';
  window.__ldPaused = true;
  const L = window.__ld;
  L.sizwe.root.position.set(-2, 0, 0.4);
  L.setFight(true);
  L.fight.idleT = -99; // no auto demo: the test drives the combo
  for (let i = 0; i < 60; i++) L.step(1 / 60); // settle into the stance
  window.__moves = 0;
}, null);
if (close) await page.evaluate(() => (window.__close = true));
if (close) await page.evaluate(() => Object.assign(window.__ld.cam, { dist: 3.2, pitch: 0.06, yaw: 0.25 }));
const total = close ? 15 : 30;
const files = [];
const log = [];
for (let f = 0; f < total; f++) {
  const info = await page.evaluate(() => {
    const L = window.__ld;
    for (let i = 0; i < (window.__close ? 4 : 7); i++) {
      if (!L.sizwe.busy && window.__moves < 3 && L.fight.hitstop <= 0) {
        L.attack();
        window.__moves++;
      }
      L.step(1 / 60);
    }
    return `${L.sizwe.act ? L.sizwe.act.name + ' ' + L.sizwe.act.t.toFixed(2) : '-'} / ${L.thug.act ? L.thug.act.name + ' ' + L.thug.act.t.toFixed(2) : '-'}`;
  });
  log.push(`${f}: ${info}`);
  await page.waitForTimeout(120);
  const file = `${out}/fight-${String(f).padStart(2, '0')}.png`;
  await page.screenshot({ path: file });
  files.push(file);
}
execSync(`ffmpeg -v error -y ${files.map((f) => `-i ${f}`).join(' ')} -filter_complex "${files.map((_, i) => `[${i}]`).join('')}xstack=inputs=${files.length}:layout=${files.map((_, i) => `${(i % 5) * 640}_${Math.floor(i / 5) * 400}`).join('|')}" ${out}/fight-sheet.png`);
console.log(log.join('\n'));
console.log(errs.join('\n') || 'no errors');
await browser.close();
