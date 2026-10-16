// Headless smoke test: boots the game, starts a new game, runs scripted steps and screenshots.
// Usage: node tools/smoke.mjs [url] [outDir] [scenario]
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:8123/index.html';
const out = process.argv[3] || '/tmp';
const scenario = process.argv[4] || 'basic';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const mobile = !!process.env.MOBILE;
const ctx = await browser.newContext(mobile ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1.5, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '')));
await page.goto(url);
await page.waitForFunction(() => window.__ready || window.__failed, null, { timeout: 180000 });
const shot = async (name) => page.screenshot({ path: `${out}/${name}.png` });
await shot('00-title');
const run = (fn, arg) => page.evaluate(fn, arg);
const sleep = (ms) => page.waitForTimeout(ms);
const mod = await import(`./scenarios/${scenario}.mjs`);
try {
  await mod.default({ page, run, sleep, shot, logs });
} catch (e) {
  logs.push('SCENARIO ERROR: ' + e.message);
}
console.log(logs.join('\n') || 'no console errors');
await browser.close();
