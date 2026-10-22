// Street voices: stubs speechSynthesis, then checks ambient chatter, reactions, bubbles,
// recorded-clip playback (a generated wav served for one line) and the Off setting.
import { readFileSync } from 'fs';
function wav(sec = 0.6, rate = 22050) {
  const n = Math.floor(sec * rate), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 8) * 8000), 44 + i * 2);
  return b;
}
export default async function ({ page, run, sleep, shot }) {
  await page.route('**/assets/voice/bra/greet_howzit.wav', (r) => r.fulfill({ body: wav(), contentType: 'audio/wav' }));
  await page.addScriptTag({ content: readFileSync(new URL('./autopilot.js', import.meta.url), 'utf8') });
  await run(() => {
    window.__spoken = [];
    const fake = { speak: (u) => window.__spoken.push({ text: u.text, pitch: u.pitch, rate: u.rate, vol: u.volume, lang: u.lang }), cancel() {}, getVoices: () => [], addEventListener() {} };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
    window.__game.voice.tts = fake;
  });
  const results = [];
  const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}: ${name} ${info}`); };
  const sim = (s) => run((s) => window.__game.simulate(s), s);
  const log = () => run(() => window.__game.voice.log.map((l) => `${l.cat}:${l.voice}:${l.via}:${l.text}`));
  await page.click('#btn-new');
  await sleep(300);
  for (let i = 0; i < 300; i++) {
    if (await run(() => window.__game.state.done.includes('m1'))) break;
    await run(() => window.__auto.step());
    await sim(0.4);
  }
  // ambient chatter on the Sea Point promenade
  await run(() => { const g = window.__game; g.input.btnHeld = {}; g.player.place(-470, -230, 0); g.env.hours = 11; g.voice.log.length = 0; window.__spoken.length = 0;
    for (let i = 0; i < 6; i++) g.peds.spawn(-470 + (i % 3) * 3 - 3, -226 + Math.floor(i / 3) * 3, { kind: 'civ', ai: 'idle' }); });
  let bubbleSeen = false;
  for (let i = 0; i < 20; i++) {
    await sim(2);
    if (!bubbleSeen && (await run(() => { const e = document.getElementById('speech'); return !e.classList.contains('hidden') && !e.classList.contains('off'); }))) {
      bubbleSeen = true;
      await shot('V1-bubble');
    }
  }
  const amb = await log();
  check('ambient chatter happens', amb.length >= 3, `${amb.length} lines: ${amb.slice(0, 4).join(' | ')}`);
  const via = await run(() => window.__game.voice.log.reduce((o, l) => ((o[l.via] = (o[l.via] || 0) + 1), o), {}));
  check('every line is voiced (AI clip or text-to-speech)', (via.file || 0) + (via.tts || 0) === amb.length, JSON.stringify(via));
  check('AI clips from the manifest are used', (via.file || 0) > 0 && (await run(() => [...window.__game.voice.buffers.values()].some((b) => b instanceof AudioBuffer))), JSON.stringify(via));
  check('speech bubble shown over the speaker', bubbleSeen);
  check('different people take turns', (await run(() => new Set(window.__game.voice.log.map((l) => l.ped)).size)) >= 3, String(await run(() => new Set(window.__game.voice.log.map((l) => l.ped)).size)));
  check('different voices speak', (await run(() => new Set(window.__game.voice.log.map((l) => l.voice)).size)) >= 2);
  // reactions
  const react = (cat) => run((cat) => {
    const g = window.__game, p = g.player, v = g.voice;
    v.stop(); v.catCd = {};
    const civ = g.peds.spawn(p.x + Math.sin(p.heading) * 1.2, p.z + Math.cos(p.heading) * 1.2, { kind: cat === 'gang' ? 'gang' : 'civ', ai: 'idle', tough: false, health: 300 });
    civ.voiceT = 0;
    const before = v.log.length;
    if (cat === 'hit' || cat === 'gang') civ.takeHit(5, 0, 1, p, 'light');
    return v.log.slice(before).map((l) => l.cat).join(',');
  }, cat);
  check('punched civilian cries out', (await react('hit')).includes('hurt'));
  let gangCats = '';
  for (let i = 0; i < 6 && !gangCats.includes('gangHurt'); i++) gangCats += await react('gang');
  check('punched gang member answers in the thug voice', gangCats.includes('gangHurt') && (await log()).slice(-1)[0].includes(':thug:'), gangCats);
  // horn: put a civilian in front of a car
  await run(() => { const g = window.__game; g.voice.stop(); g.voice.catCd = {}; g.cheat('BAKKIE'); const v = g.vehicles.nearestEnterable(g.player.x, g.player.z, 25); g.player.place(v.x + Math.cos(v.heading) * 1.6, v.z - Math.sin(v.heading) * 1.6, 0); g.player.enterVehicle(v); });
  await sim(1.2);
  await run(() => { const g = window.__game, v = g.player.vehicle; g.voice.stop(); g.voice.catCd = {}; g.__hp = g.peds.spawn(v.x + Math.sin(v.heading) * 7, v.z + Math.cos(v.heading) * 7, { kind: 'civ', ai: 'idle' }); g.voice.onHorn(); });
  check('hooted-at pedestrian answers', (await log()).slice(-1)[0]?.startsWith('honked'), (await log()).slice(-1)[0]);
  // carjacking
  await run(() => { const g = window.__game; g.voice.stop(); g.voice.catCd = {}; const v = g.player.vehicle; v.npcLook = null; g.peds.ejectDriver(v); v.driver = 'player'; });
  check('carjacked driver shouts', (await log()).slice(-1)[0]?.startsWith('carjacked'), (await log()).slice(-1)[0]);
  // scripted bark from a mission character
  await run(() => { const g = window.__game; g.voice.stop(); g.hud.say('Thug', 'Ey! Who invited you, laaitie?', { auto: 1, bark: true }); });
  check('mission bark is voiced with the thug voice', /^script:thug:(file|tts):Ey! Who invited you, laaitie\?$/.test((await log()).slice(-1)[0]), (await log()).slice(-1)[0]);
  // recorded clip beats text-to-speech
  await run(() => { const g = window.__game; g.player.exitVehicle(); });
  await sim(1);
  const fileRes = await run(async () => {
    const g = window.__game, v = g.voice, p = g.player;
    v.files = { bra: { greet_howzit: 'wav' } };
    v.stop(); v.catCd = {};
    const civ = g.peds.spawn(p.x + 1.5, p.z, { kind: 'civ', ai: 'idle' });
    civ.voice = 'bra';
    const greet = (await import('./src/data/barks.js')).BARKS.greet;
    const keep = greet.lines;
    greet.lines = keep.filter((l) => l[0] === 'greet_howzit');
    const n0 = window.__spoken.length;
    const ok = v.react(civ, 'greet', { force: true });
    greet.lines = keep;
    await new Promise((r) => setTimeout(r, 800));
    return { ok, via: v.log.slice(-1)[0].via, decoded: v.buffers.get('bra/greet_howzit.wav') instanceof AudioBuffer, tts: window.__spoken.length - n0 };
  });
  check('recorded clip plays instead of TTS', fileRes.ok && fileRes.via === 'file' && fileRes.decoded && fileRes.tts === 0, JSON.stringify(fileRes));
  // Off setting silences everything
  await run(() => { const g = window.__game; g.settings.voices = 'off'; g.voice.stop(); g.voice.log.length = 0; g.voice.catCd = {}; g.voice.gap = 0; });
  await sim(12);
  check('Off setting = silence', (await run(() => window.__game.voice.log.length)) === 0);
  await run(() => { window.__game.settings.voices = 'on'; });
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
}
