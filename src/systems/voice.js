// Street voices: people react out loud (bumped, nearly run over, hooted at, punched, robbed,
// chased) and chat in the background, with a speech bubble over the speaker. A line plays a
// clip when assets/voice/manifest.json lists one (a real recording in assets/voice/<voice>/, else an
// AI-generated one in assets/voice/ai/<voice>/), otherwise the browser's text-to-speech (a South African English voice when the device has one)
// stands in. One person speaks at a time; a higher-priority reaction interrupts chatter.

import * as THREE from 'three';
import { BARKS, VOICES, CIV_VOICES, CHARACTER_VOICES, lineIdFor } from '../data/barks.js';
import { POI } from '../world/mapData.js';
import { T } from '../world/grid.js';
import { clamp, dist, rand, chance } from '../core/util.js';

const PRIO = {
  ambient: 1, ambientNight: 1, beach: 1, food: 1, taxiRank: 1, langa: 1, boKaap: 1,
  greet: 2, wanted: 3, honked: 3, bumped: 3, witness: 3,
  nearMiss: 4, gangTaunt: 4, gangHurt: 4, copChase: 4,
  hurt: 5, fightBack: 5, carjacked: 5, copHurt: 5,
};
const HEAR = 30; // metres
const FOOD = [POI.gatsby, POI.fishChips, POI.shisaNyama, POI.rashieda];
const RANKS = [POI.taxiRank, POI.langaRank];
const FEMALE_TTS = /female|woman|leah|samantha|karen|moira|tessa|serena|fiona|kate|susan|hazel|libby|sonia|zira|aria|jenny|natasha|google uk english female/i;
const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const _v = new THREE.Vector3();

export class VoiceSystem {
  constructor(game) {
    this.game = game;
    this.files = {}; // voice -> { id: path under assets/voice/ }
    this.buffers = new Map();
    this.current = null;
    this.gap = 4;
    this.catCd = {};
    this.recent = [];
    this.log = [];
    this.tts = typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null;
    this.ttsVoices = { male: [], female: [] };
    this.bubble = document.getElementById('speech');
    if (this.tts) {
      this.pickTtsVoices();
      try {
        this.tts.addEventListener('voiceschanged', () => this.pickTtsVoices());
      } catch {
        /* old Safari */
      }
    }
    fetch('assets/voice/manifest.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (m && m.voices) this.files = m.voices;
      })
      .catch(() => {});
  }

  get mode() {
    return this.game.settings.voices || 'on'; // on | subs | off
  }

  pickTtsVoices() {
    const all = this.tts.getVoices() || [];
    const en = all.filter((v) => /^en/i.test(v.lang));
    const rank = (v) => (/en[-_]ZA/i.test(v.lang) || /south africa/i.test(v.name) ? 0 : /en[-_](GB|IE|AU|NZ)/i.test(v.lang) ? 1 : 2);
    const best = Math.min(3, ...en.map(rank));
    const pool = en.filter((v) => rank(v) === best);
    this.ttsVoices = { female: pool.filter((v) => FEMALE_TTS.test(v.name)), male: pool.filter((v) => !FEMALE_TTS.test(v.name)), any: pool };
  }

  /** Call from a user gesture: iOS only allows speech after one. */
  unlock() {
    if (!this.tts || this.unlocked) return;
    this.unlocked = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      this.tts.speak(u);
    } catch {
      /* ignore */
    }
  }

  pedVoice(p) {
    if (p.voice) return p.voice;
    if (p.kind === 'gang') return (p.voice = 'thug');
    if (p.kind === 'police') return (p.voice = 'cop');
    if (p.name && CHARACTER_VOICES[p.name]) return (p.voice = CHARACTER_VOICES[p.name]);
    const L = p.look || {}, h = hash('p' + p.id);
    const female = L.dress || L.hat === 'doek' || (L.hairStyle === 'long' && h % 3 !== 0);
    const old = L.hair === '#b0a090' || h % 4 === 0;
    return (p.voice = female ? (old ? 'aunty' : 'sisi') : old ? 'oom' : 'bra');
  }

  /** A person reacts out loud. Returns true if they spoke. */
  react(p, cat, o = {}) {
    const g = this.game, B = BARKS[cat];
    if (!B || !p || p.isDog || p.state === 'dead' || this.mode === 'off' || g.cutscene) return false;
    const now = g.time, prio = o.prio ?? PRIO[cat] ?? 1;
    if (!o.force && (this.catCd[cat] || 0) > now) return false;
    if (!o.force && (p.voiceT || 0) > now) return false;
    if (dist(p.x, p.z, g.player.x, g.player.z) > HEAR) return false;
    if (this.current && this.current.prio >= prio) return false;
    const voice = this.pedVoice(p);
    if (!B.voices.includes(voice)) return false;
    const line = this.pickLine(B, voice);
    if (!line) return false;
    this.catCd[cat] = now + (B.cooldown || 3);
    p.voiceT = now + 6;
    this.speak({ id: line[0], text: line[1], gloss: line[2] || null, voice, ped: p, prio, cat });
    return true;
  }

  pickLine(B, voice) {
    const ok = B.lines.filter((l) => !l[3] || l[3].includes(voice));
    const fresh = ok.filter((l) => !this.recent.includes(l[0]));
    const from = fresh.length ? fresh : ok;
    return from.length ? from[Math.floor(Math.random() * from.length)] : null;
  }

  /** Voice a scripted bark (the HUD already shows the text). */
  sayAs(who, text) {
    if (this.mode !== 'on' || !text) return;
    let voice = CHARACTER_VOICES[who];
    if (!voice) voice = CIV_VOICES[hash(text) % CIV_VOICES.length];
    this.speak({ id: lineIdFor(text), text, voice, ped: null, prio: 6, cat: 'script' });
  }

  speak(L) {
    this.stop();
    const g = this.game;
    const dur = 0.9 + L.text.length * 0.065;
    this.current = { ...L, end: g.time + dur, stopFn: null };
    this.recent.push(L.id);
    if (this.recent.length > 14) this.recent.shift();
    // no clip for this voice yet: borrow one recorded by another voice of the same kind
    let file = this.clipFor(L.voice, L.id);
    if (!file) {
      const fem = !!(VOICES[L.voice] || {}).female;
      for (const v of CIV_VOICES) {
        if (v !== L.voice && !!VOICES[v].female === fem && (file = this.clipFor(v, L.id))) break;
      }
    }
    this.log.push({ id: L.id, ped: L.ped ? L.ped.id : null, voice: L.voice, cat: L.cat, text: L.text, via: this.mode !== 'on' ? 'subs' : file ? 'file' : 'tts', file });
    if (this.log.length > 60) this.log.shift();
    if (L.ped) this.showBubble(L);
    if (this.mode !== 'on') return;
    const vol = L.ped ? clamp(1.15 - dist(L.ped.x, L.ped.z, g.player.x, g.player.z) / HEAR, 0.15, 1) : 1;
    if (file) this.playFile(file, vol, this.current);
    else this.playTts(L, vol, this.current);
  }

  clipFor(voice, id) {
    const f = this.files[voice] && this.files[voice][id];
    if (!f) return null;
    return f.includes('.') ? f : `${voice}/${id}.${f}`; // older manifests stored just the extension
  }

  playTts(L, vol, cur) {
    if (!this.tts) return;
    const prof = VOICES[L.voice] || VOICES.bra;
    const pool = (prof.female ? this.ttsVoices.female : this.ttsVoices.male) || [];
    const any = this.ttsVoices.any || [];
    const h = L.ped ? hash('v' + L.ped.id) : hash(L.text);
    const u = new SpeechSynthesisUtterance(L.text);
    const v = pool.length ? pool[h % pool.length] : any.length ? any[h % any.length] : null;
    if (v) u.voice = v;
    u.lang = v ? v.lang : 'en-ZA';
    // without a matching voice, push the pitch further so women / men still sound different
    const shift = !pool.length && prof.female ? 0.25 : 0;
    u.pitch = clamp(prof.pitch + shift + ((h % 7) - 3) * 0.03, 0.1, 2);
    u.rate = clamp(prof.rate + ((h >> 3) % 5 - 2) * 0.03, 0.5, 1.6);
    u.volume = clamp(vol * (this.game.settings.sfx ?? 0.8) * 1.1, 0, 1);
    u.onend = () => {
      if (this.current === cur) cur.end = Math.min(cur.end, this.game.time + 0.4);
    };
    try {
      this.tts.cancel();
      this.tts.speak(u);
      cur.stopFn = () => this.tts.cancel();
    } catch {
      /* ignore */
    }
  }

  playFile(path, vol, cur) {
    const a = this.game.audio;
    if (!a.ctx) return;
    const start = (buf) => {
      if (!buf || this.current !== cur) return;
      const src = a.ctx.createBufferSource();
      src.buffer = buf;
      const gn = a.ctx.createGain();
      gn.gain.value = vol * 1.4;
      const pan = a.ctx.createStereoPanner ? a.ctx.createStereoPanner() : null;
      if (pan && cur.ped) pan.pan.value = this.panOf(cur.ped);
      src.connect(gn);
      (pan ? gn.connect(pan) : gn).connect(a.sfx);
      src.start();
      cur.end = this.game.time + buf.duration + 0.3;
      cur.stopFn = () => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      };
    };
    const have = this.buffers.get(path);
    if (have instanceof AudioBuffer) return start(have);
    if (have === null) return this.playTts(cur, vol, cur);
    if (have) return have.then(start);
    const pr = fetch('assets/voice/' + path)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then((ab) => a.ctx.decodeAudioData(ab))
      .then((buf) => {
        this.buffers.set(path, buf);
        return buf;
      })
      .catch(() => {
        this.buffers.set(path, null);
        if (this.current === cur) this.playTts(cur, vol, cur);
        return null;
      });
    this.buffers.set(path, pr);
    pr.then(start);
  }

  panOf(p) {
    const cam = this.game.cameraRig;
    const { r } = cam.basis();
    const g = this.game.player;
    const dx = p.x - g.x, dz = p.z - g.z, d = Math.hypot(dx, dz) || 1;
    return clamp(((dx * r.x + dz * r.z) / d) * 0.8, -0.8, 0.8);
  }

  stop() {
    const c = this.current;
    this.current = null;
    if (c && c.stopFn) c.stopFn();
    if (this.bubble) this.bubble.classList.add('hidden');
  }

  showBubble(L) {
    const el = this.bubble;
    if (!el) return;
    el.querySelector('.t').textContent = L.text;
    const gl = el.querySelector('.g');
    gl.textContent = L.gloss || '';
    gl.classList.toggle('hidden', !L.gloss);
    el.classList.remove('hidden');
    this.placeBubble();
  }

  placeBubble() {
    const c = this.current, el = this.bubble;
    if (!c || !c.ped || !el) return;
    const g = this.game, p = c.ped;
    _v.set(p.x, p.y + 2.25, p.z).project(g.camera);
    const off = _v.z > 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05 || g.dialogueOpen;
    el.classList.toggle('off', off);
    if (off) return;
    const x = clamp((_v.x * 0.5 + 0.5) * window.innerWidth, 90, window.innerWidth - 90);
    const y = clamp((-_v.y * 0.5 + 0.5) * window.innerHeight, 70, window.innerHeight - 20);
    el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -100%)`;
  }

  // ---------------------------------------------------------------- hooks
  onHit(p, byPlayer) {
    if (!byPlayer) return;
    if (p.kind === 'gang') {
      if (chance(0.6)) this.react(p, 'gangHurt');
    } else if (p.kind === 'police') this.react(p, 'copHurt');
    else if (p.kind === 'civ') {
      if (p.ai === 'fight') this.react(p, 'fightBack') || this.react(p, 'hurt');
      else this.react(p, 'hurt');
    }
  }

  onHorn() {
    const g = this.game, v = g.player.vehicle;
    if (!v) return;
    const ahead = [];
    for (const p of g.peds.list) {
      if (p.kind !== 'civ' || p.state !== 'ok') continue;
      const d = dist(p.x, p.z, v.x, v.z);
      if (d > 16) continue;
      const { lz } = v.localOf(p.x, p.z);
      if (lz * Math.sign(v.fwdSpeed || 1) > 0) ahead.push([p, d]); // only people in front of the car
    }
    ahead.sort((a, b) => a[1] - b[1]);
    for (const [p] of ahead) if (this.react(p, 'honked')) return;
  }

  // ---------------------------------------------------------------- ambient
  update(dt) {
    const g = this.game, c = this.current;
    if (c && (g.time > c.end || (c.ped && (c.ped.removeMe || c.ped.state === 'dead')))) this.stop();
    else if (c) this.placeBubble();
    if (this.mode === 'off' || g.cutscene || g.dialogueOpen) return;
    const pl = g.player;
    // gang members and cops shout while they come for you
    for (const p of g.peds.list) {
      if (p.state !== 'ok' || p.target !== pl) continue;
      const d = dist(p.x, p.z, pl.x, pl.z);
      if (d > 20) continue;
      if (p.kind === 'gang' && p.ai === 'fight' && (!p.taunted || chance(dt * 0.15))) {
        if (this.react(p, 'gangTaunt')) p.taunted = true;
      } else if (p.kind === 'police' && chance(dt * 0.35)) this.react(p, 'copChase');
    }
    this.gap -= dt;
    if (this.gap > 0 || this.current) return;
    this.gap = rand(4, 9);
    const near = [];
    for (const p of g.peds.list) {
      if (p.kind !== 'civ' || p.state !== 'ok' || p.ai === 'flee' || p.mission) continue;
      const d = dist(p.x, p.z, pl.x, pl.z);
      if (d < 16) near.push([p, d]);
    }
    if (!near.length) return;
    // let someone new talk: pick among the three who spoke longest ago
    near.sort((a, b) => (a[0].voiceT || 0) - (b[0].voiceT || 0));
    const [p, d] = near[Math.floor(Math.random() * Math.min(3, near.length))];
    const area = g.grid.areaName(p.x, p.z, p.onPlateau);
    const cands = [];
    if (g.police.stars > 0) cands.push(['wanted', 0.5]);
    if (d < 4.5 && pl.state === 'foot') cands.push(['greet', 0.6]);
    if (RANKS.some((r) => dist(p.x, p.z, r.x, r.z) < 32)) cands.push(['taxiRank', 0.7]);
    if (FOOD.some((r) => dist(p.x, p.z, r.x, r.z) < 26)) cands.push(['food', 0.5]);
    if (g.grid.typeAt(p.x, p.z) === T.SAND) cands.push(['beach', 0.6]);
    if (area === 'Langa') cands.push(['langa', 0.4]);
    if (area === 'Bo-Kaap') cands.push(['boKaap', 0.4]);
    const h = g.env.hours;
    cands.push([h < 5.5 || h > 20.5 ? 'ambientNight' : 'ambient', 1]);
    for (const [cat, pr] of cands) if (chance(pr) && this.react(p, cat)) return;
  }
}
