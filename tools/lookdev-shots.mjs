// Screenshots of the look-dev street: node tools/lookdev-shots.mjs [url] [outDir] [phone]
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:8123/lookdev.html';
const out = process.argv[3] || './shots';
const phone = process.argv[4] === 'phone';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: phone ? { width: 812, height: 375 } : { width: 1280, height: 720 }, deviceScaleFactor: phone ? 2 : 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(url);
await page.waitForFunction(() => window.__ld, null, { timeout: 120000 });
const views = [
  ['hero', { yaw: -0.3, pitch: 0.16, dist: 10 }, [-4, 0.2, -4.4]],
  ['faces', { yaw: 0.2, pitch: 0.05, dist: 3.6 }, [-6.2, 0.2, -4.0]],
  ['street', { yaw: 0.0, pitch: 0.12, dist: 22 }, [0, 0.2, 4.0]],
  ['close', { yaw: -0.6, pitch: 0.08, dist: 4.2 }, [-6.5, 0.2, -4.2]],
  ['cafe', { yaw: 0.45, pitch: 0.18, dist: 14 }, [26, 0.2, 3.0]],
];
for (const mood of phone ? ['golden'] : ['golden', 'midday', 'night']) {
  await page.evaluate((m) => window.__ld.applyPreset(m), mood);
  for (const [name, c, p] of phone ? views.slice(0, 2) : views) {
    await page.evaluate(([c, p]) => {
      const L = window.__ld;
      L.setAutoWalk(false);
      Object.assign(L.cam, c);
      L.sizwe.root.position.set(...p);
      L.sizwe.root.rotation.y = c.face ?? 0.3;
      L.cam.target.set(p[0], 1.4, p[2]);
      for (let i = 0; i < 20; i++) L.step(1 / 30);
    }, [c, p]);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/ld-${phone ? 'phone-' : ''}${mood}-${name}.png` });
  }
}
console.log(errs.join('\n') || 'no errors');
await browser.close();
