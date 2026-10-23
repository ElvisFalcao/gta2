// Filmstrips of the look-test animation: node tools/lookdev-anim.mjs [url] [outDir]
// Writes walk / run strips (side view, 6 phases each) plus wave and sit stills.
import { chromium } from 'playwright';
import { execSync } from 'child_process';
const url = process.argv[2] || 'http://localhost:8123/lookdev.html';
const out = process.argv[3] || './shots';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 420, height: 520 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(url + '?mood=midday');
await page.waitForFunction(() => window.__ld, null, { timeout: 120000 });
await page.evaluate(() => { document.querySelector('.bar').style.display = 'none'; document.querySelector('.tag').style.display = 'none'; });
const frame = async (name, setup, arg) => {
  await page.evaluate(setup, arg);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/${name}.png` });
};
for (const [gait, speed] of [['walk', 1.4], ['run', 3.6]]) {
  const files = [];
  // warm up so the speed blend settles, then sample one stride
  await page.evaluate((speed) => {
    window.__ldPaused = true;
    const L = window.__ld, s = L.sizwe;
    s.root.position.set(0, 0, 0);
    s.root.rotation.y = Math.PI / 2;
    for (let i = 0; i < 90; i++) s.update(1 / 60, { speed });
    Object.assign(L.cam, { yaw: 0, pitch: 0.05, dist: 3.4 });
    L.cam.target.set(0, 0.95, 0);
    const c = L.cam, cp = Math.cos(c.pitch);
    L.camera.position.set(c.target.x + Math.sin(c.yaw) * c.dist * cp, c.target.y + Math.sin(c.pitch) * c.dist, c.target.z + Math.cos(c.yaw) * c.dist * cp);
    L.camera.lookAt(c.target);
  }, speed);
  for (let f = 0; f < 6; f++) {
    await frame(`anim-${gait}-${f}`, (speed) => { const s = window.__ld.sizwe; const stride = speed > 2 ? 2.4 : 1.4; for (let i = 0; i < 10; i++) s.update((stride / speed) / 6 / 10, { speed }); }, speed);
    files.push(`${out}/anim-${gait}-${f}.png`);
  }
  execSync(`ffmpeg -v error -y ${files.map((f) => `-i ${f}`).join(' ')} -filter_complex "hstack=inputs=${files.length}" ${out}/strip-${gait}.png`);
}
// the aunty waving and the oom sitting, front-on
for (const [who, pose] of [['aunty', { wave: true }], ['oom', { pose: 'sit' }]]) {
  await page.evaluate(([who, pose]) => {
    const L = window.__ld, p = L[who];
    for (let i = 0; i < 40; i++) p.update(1 / 60, pose);
    const at = p.root.position, face = p.root.rotation.y;
    L.camera.position.set(at.x + Math.sin(face) * 3.2, at.y + 1.3, at.z + Math.cos(face) * 3.2);
    L.camera.lookAt(at.x, at.y + 0.9, at.z);
  }, [who, pose]);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/anim-${who}.png` });
}
console.log(errs.join('\n') || 'no errors');
await browser.close();
