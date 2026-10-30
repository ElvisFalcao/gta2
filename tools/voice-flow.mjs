// Bring a Google Flow video into the game as voice clips (see docs/voice-flow-test.md).
//   node tools/voice-flow.mjs <video.mp4> <voice> <id1,id2,...> [--noise -35] [--gap 0.25]
// The character in the video says the lines in order with a pause between them. The audio is cut at
// the longest pauses, one piece per id, levelled and saved as assets/voice/flow/<voice>/<id>.mp3, then
// the manifest is refreshed. Flow clips win over the Kokoro ones in assets/voice/ai/; real recordings
// in assets/voice/<voice>/ win over both. Needs ffmpeg.
import { execFileSync, spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { BARKS, VOICES } from '../src/data/barks.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  if (i < 0) return d;
  const v = args[i + 1];
  args.splice(i, 2);
  return Number(v);
};
const noise = opt('--noise', -35); // dB: quieter than this counts as a pause
const minGap = opt('--gap', 0.25); // s: shortest pause that can separate two lines
const [video, voice, idList] = args;
if (!video || !voice || !idList) {
  console.error('usage: node tools/voice-flow.mjs <video.mp4> <voice> <id1,id2,...> [--noise -35] [--gap 0.25]');
  process.exit(1);
}
if (!VOICES[voice]) throw new Error(`unknown voice "${voice}" (${Object.keys(VOICES).join(', ')})`);
if (!existsSync(video)) throw new Error(`no such file: ${video}`);
const ids = idList.split(',').filter(Boolean);
const lines = {};
for (const B of Object.values(BARKS)) {
  for (const [id, text, , only] of B.lines) if ((only || B.voices).includes(voice)) lines[id] = text;
}
for (const id of ids) if (!lines[id]) console.warn(`warning: "${id}" is not a ${voice} line in src/data/barks.js`);

const tmp = mkdtempSync(join(tmpdir(), 'flow-'));
try {
  const wav = join(tmp, 'all.wav');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vn', '-ac', '1', '-ar', '48000', wav]);
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], { encoding: 'utf8' }));
  const log = spawnSync('ffmpeg', ['-hide_banner', '-i', wav, '-af', `silencedetect=noise=${noise}dB:d=${minGap}`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const quiet = [];
  for (const m of log.matchAll(/silence_(start|end): ([\d.]+)/g)) {
    if (m[1] === 'start') quiet.push({ a: +m[2], b: dur });
    else if (quiet.length) quiet[quiet.length - 1].b = +m[2];
  }
  let from = 0, to = dur;
  if (quiet.length && quiet[0].a < 0.05) from = quiet.shift().b;
  if (quiet.length && quiet[quiet.length - 1].b > dur - 0.05) to = quiet.pop().a;
  if (quiet.length < ids.length - 1) {
    const found = quiet.map((q) => `${q.a.toFixed(2)}–${q.b.toFixed(2)}`).join(', ') || 'none';
    throw new Error(`need ${ids.length - 1} pauses between lines, found ${quiet.length} (${found}). Try --noise -30 or --gap 0.2.`);
  }
  // the longest pauses separate the lines; shorter ones are breaths inside a line
  const cuts = [...quiet].sort((x, y) => y.b - y.a - (x.b - x.a)).slice(0, ids.length - 1).sort((x, y) => x.a - y.a);
  const bounds = [from, ...cuts.flatMap((c) => [c.a, c.b]), to];
  const outDir = join(root, 'assets/voice/flow', voice);
  mkdirSync(outDir, { recursive: true });
  ids.forEach((id, i) => {
    const a = Math.max(0, bounds[i * 2] - 0.08), b = Math.min(dur, bounds[i * 2 + 1] + 0.12);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', a.toFixed(3), '-to', b.toFixed(3), '-i', wav,
      '-af', 'highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=7', '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '64k', join(outDir, id + '.mp3')]);
    const text = lines[id] || '?';
    const guess = 0.4 + text.length * 0.06; // rough speaking time, to flag a cut in the wrong place
    const odd = b - a < guess * 0.4 || b - a > guess * 2.5 ? '   <- length looks wrong for this line' : '';
    console.log(`${voice}/${id}  ${a.toFixed(2)}–${b.toFixed(2)} s  "${text}"${odd}`);
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
execFileSync('node', [join(root, 'tools/voice-script.mjs')], { stdio: 'inherit' });
