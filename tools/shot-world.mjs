import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:8123/dev-world.html';
const out = process.argv[3] || '/tmp/shots';
const views = JSON.parse(process.argv[4] || '[]');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
await page.goto(url);
await page.waitForFunction(() => window.ready || window.__failed, null, { timeout: 120000 }).catch(e => logs.push('TIMEOUT ' + e.message));
console.log(JSON.stringify(await page.evaluate(() => window.stats)));
let i = 0;
for (const v of views) {
  const info = await page.evaluate((v) => window.view(...v), v);
  await page.screenshot({ path: `${out}/view${i++}.png` });
  console.log('view', i, JSON.stringify(info));
}
console.log(logs.join('\n'));
await browser.close();
