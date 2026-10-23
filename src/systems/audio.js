// All sound is synthesised with WebAudio: no audio files. Includes a little
// amapiano-style loop on "Mother City FM" when you're driving.

import { clamp, dist, rand } from '../core/util.js';

export class Audio {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.sfxVol = 0.8;
    this.musicVol = 0.6;
    this.radioOn = true;
    this.inCar = false;
    this.step16 = 0;
    this.nextNote = 0;
    this.bar = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxVol;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = 0;
    this.music.connect(this.master);
    // noise buffer
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // engine
    this.engOsc = ctx.createOscillator();
    this.engOsc.type = 'sawtooth';
    this.engOsc2 = ctx.createOscillator();
    this.engOsc2.type = 'square';
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 400;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engOsc.connect(this.engFilter);
    this.engOsc2.connect(this.engFilter);
    this.engFilter.connect(this.engGain).connect(this.sfx);
    this.engOsc.start();
    this.engOsc2.start();
    // waves ambience
    const wn = ctx.createBufferSource();
    wn.buffer = this.noiseBuf;
    wn.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 500;
    this.waveGain = ctx.createGain();
    this.waveGain.gain.value = 0;
    wn.connect(wf).connect(this.waveGain).connect(this.sfx);
    wn.start();
    // siren
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.sfx);
    this.sirenOsc.start();
    // music distortion for the log drum
    this.shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    this.shaper.curve = curve;
    this.shaper.connect(this.music);
    this.nextNote = ctx.currentTime + 0.1;
  }

  get t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setVolumes(sfx, music) {
    this.sfxVol = sfx;
    this.musicVol = music;
    if (this.sfx) this.sfx.gain.value = sfx;
  }

  att(x, z) {
    if (x === undefined) return 1;
    const p = this.game.player;
    return clamp(1 - dist(x, z, p.x, p.z) / 70, 0, 1);
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, attack = 0.005, slide = null, when = 0, dest = null, x, z } = {}) {
    if (!this.ctx) return;
    const a = this.att(x, z) * vol;
    if (a <= 0.001) return;
    const ctx = this.ctx, t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.linearRampToValueAtTime(a, t0 + attack);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn).connect(dest || this.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  noise(dur, { vol = 0.3, filter = 'lowpass', freq = 1200, q = 1, when = 0, dest = null, x, z, attack = 0.002 } = {}) {
    if (!this.ctx) return;
    const a = this.att(x, z) * vol;
    if (a <= 0.001) return;
    const ctx = this.ctx, t0 = ctx.currentTime + when;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.linearRampToValueAtTime(a, t0 + attack);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(gn).connect(dest || this.sfx);
    s.start(t0, Math.random() * 1.5);
    s.stop(t0 + dur + 0.05);
  }

  // ---------------- sfx ----------------
  punch(heavy, x, z) {
    this.noise(heavy ? 0.22 : 0.12, { vol: heavy ? 0.7 : 0.5, freq: heavy ? 700 : 1100, x, z });
    this.tone(heavy ? 90 : 140, 0.12, { type: 'sine', vol: 0.5, slide: 50, x, z });
  }
  /** Synthesised gunshots: a sharp crack, a body thump and a tail; the shotgun booms, the SMG snaps. */
  gunshot(type = 'pistol', x, z) {
    const big = type === 'shotgun', small = type === 'smg';
    this.noise(big ? 0.42 : small ? 0.1 : 0.2, { vol: big ? 0.9 : small ? 0.5 : 0.7, filter: 'lowpass', freq: big ? 1600 : 3200, x, z, attack: 0.001 });
    this.noise(0.05, { vol: 0.5, filter: 'highpass', freq: 3000, x, z, attack: 0.001 });
    this.tone(big ? 70 : 120, big ? 0.3 : 0.14, { type: 'triangle', vol: big ? 0.6 : 0.4, slide: 40, x, z });
  }
  dryFire() {
    this.tone(1800, 0.03, { type: 'square', vol: 0.12 });
    this.tone(900, 0.03, { type: 'square', vol: 0.1, when: 0.04 });
  }
  whoosh() {
    this.noise(0.14, { vol: 0.12, filter: 'bandpass', freq: 1800, q: 0.8, attack: 0.04 });
  }
  step(run) {
    this.noise(0.05, { vol: run ? 0.08 : 0.05, freq: 600 });
  }
  jump() {
    this.noise(0.08, { vol: 0.08, freq: 800 });
  }
  thud(x, z) {
    this.tone(70, 0.25, { vol: 0.6, slide: 40, x, z });
    this.noise(0.15, { vol: 0.4, freq: 500, x, z });
  }
  crash(i, x, z) {
    this.noise(0.35 + i * 0.3, { vol: 0.25 + i * 0.5, freq: 900 + i * 1500, x, z });
    this.tone(60, 0.3, { vol: 0.3 * i, slide: 35, x, z });
  }
  explosion(x, z) {
    this.noise(1.6, { vol: 1.0, freq: 400, x, z, attack: 0.01 });
    this.tone(55, 1.2, { vol: 0.8, slide: 25, x, z });
    this.game.vibrate([60, 40, 120]);
  }
  horn(x, z, npc = false) {
    if (!this.ctx) return;
    const v = npc ? 0.08 : 0.16;
    this.tone(415, 0.35, { type: 'square', vol: v, attack: 0.01, x, z });
    this.tone(523, 0.35, { type: 'square', vol: v * 0.8, attack: 0.01, x, z });
  }
  door() {
    this.noise(0.08, { vol: 0.25, freq: 400 });
    this.tone(120, 0.08, { vol: 0.2, slide: 80, when: 0.03 });
  }
  shout(x, z) {
    this.tone(rand(380, 520), 0.25, { type: 'sawtooth', vol: 0.05, slide: rand(250, 320), x, z, attack: 0.03 });
  }
  pickup() {
    this.tone(880, 0.12, { type: 'triangle', vol: 0.25 });
    this.tone(1320, 0.18, { type: 'triangle', vol: 0.22, when: 0.07 });
  }
  cash() {
    this.tone(1568, 0.08, { type: 'square', vol: 0.1 });
    this.tone(2093, 0.14, { type: 'square', vol: 0.1, when: 0.07 });
  }
  click() {
    this.tone(660, 0.05, { type: 'triangle', vol: 0.12 });
  }
  beep() {
    this.tone(990, 0.08, { type: 'square', vol: 0.08 });
  }
  wanted() {
    this.tone(330, 0.15, { type: 'square', vol: 0.12 });
    this.tone(247, 0.25, { type: 'square', vol: 0.12, when: 0.15 });
  }
  noonGun(v = 1) {
    this.noise(2.2, { vol: 1 * v, freq: 300, attack: 0.005 });
    this.tone(45, 1.6, { vol: 0.9 * v, slide: 22 });
  }
  passed() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', vol: 0.22, when: i * 0.11 }));
    [130.8, 164.8, 196].forEach((f, i) => this.tone(f, 1.4, { type: 'sawtooth', vol: 0.06, when: 0.33 + i * 0.01, attack: 0.05 }));
  }
  failed() {
    [392, 349.2, 311.1, 261.6].forEach((f, i) => this.tone(f, 0.45, { type: 'triangle', vol: 0.2, when: i * 0.18 }));
  }
  wasted() {
    this.tone(220, 1.8, { type: 'sawtooth', vol: 0.15, slide: 55, attack: 0.05 });
    this.noise(1.4, { vol: 0.15, freq: 300, attack: 0.1 });
  }
  phone() {
    for (let i = 0; i < 2; i++) {
      this.tone(1318, 0.09, { type: 'sine', vol: 0.18, when: i * 0.22 });
      this.tone(1760, 0.09, { type: 'sine', vol: 0.18, when: i * 0.22 + 0.1 });
    }
  }
  lift() {
    this.tone(220, 0.1, { type: 'triangle', vol: 0.12, slide: 330 });
  }

  // ---------------- continuous ----------------
  update(dt) {
    if (!this.ctx) return;
    const g = this.game, p = g.player, t = this.ctx.currentTime;
    const v = p.vehicle;
    if (v && v.state !== 'wrecked') {
      const sp = Math.abs(v.fwdSpeed);
      const gearSpan = 9;
      const gearPos = (sp % gearSpan) / gearSpan;
      const base = v.type === 'minibus' || v.type === 'bakkie' ? 38 : v.type === 'sports' ? 62 : 48;
      const f = base + gearPos * 55 + Math.min(sp, 40) * 1.2;
      this.engOsc.frequency.setTargetAtTime(f, t, 0.05);
      this.engOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
      this.engFilter.frequency.setTargetAtTime(300 + Math.abs(v.input.throttle) * 900 + sp * 10, t, 0.08);
      this.engGain.gain.setTargetAtTime(0.06 + Math.abs(v.input.throttle) * 0.07, t, 0.1);
    } else this.engGain.gain.setTargetAtTime(0, t, 0.15);
    // ocean
    const near = g.grid.waterNearby(p.x, p.z, 40);
    this.waveGain.gain.setTargetAtTime(near * (0.12 + Math.sin(t * 0.5) * 0.05), t, 0.4);
    // siren
    if (g.police.sirenOn) {
      this.sirenOsc.frequency.setTargetAtTime(700 + Math.sin(t * 5) * 250, t, 0.02);
      this.sirenGain.gain.setTargetAtTime(0.05, t, 0.2);
    } else this.sirenGain.gain.setTargetAtTime(0, t, 0.3);
    // radio
    const radio = !!v && this.radioOn && !g.paused;
    this.music.gain.setTargetAtTime(radio ? this.musicVol * 0.55 : 0, t, 0.3);
    if (radio) this.schedule();
    else this.nextNote = t + 0.05;
  }

  toggleRadio() {
    this.radioOn = !this.radioOn;
    return this.radioOn;
  }

  schedule() {
    const ctx = this.ctx;
    const spb = 60 / 113 / 4; // seconds per 16th
    if (this.nextNote < ctx.currentTime - 0.05) this.nextNote = ctx.currentTime + 0.05;
    while (this.nextNote < ctx.currentTime + 0.12) {
      this.playStep(this.step16, this.nextNote);
      this.nextNote += spb;
      this.step16 = (this.step16 + 1) % 16;
      if (this.step16 === 0) this.bar = (this.bar + 1) % 8;
    }
  }

  playStep(s, when) {
    const ctx = this.ctx;
    const w = when - ctx.currentTime;
    const dest = this.music;
    // kick on the four
    if (s % 4 === 0) this.tone(140, 0.28, { vol: 0.55, slide: 42, when: w, dest });
    // shaker 16ths
    this.noise(0.035, { vol: s % 2 ? 0.07 : 0.11, filter: 'highpass', freq: 7000, when: w, dest });
    // clap / rim on 2 and 4
    if (s === 4 || s === 12) this.noise(0.12, { vol: 0.18, filter: 'bandpass', freq: 1800, q: 1.2, when: w, dest });
    if (s === 7 || s === 15) this.tone(1200, 0.03, { type: 'square', vol: 0.03, when: w, dest });
    // log drum (pitched, syncopated)
    const prog = [[87.3, 103.8], [69.3, 87.3], [77.8, 98], [87.3, 116.5]];
    const bar = prog[Math.floor(this.bar / 2) % 4];
    const pat = { 3: 0, 6: 1, 10: 0, 11: 1, 14: 0 };
    if (pat[s] !== undefined && (this.bar % 2 === 0 || s !== 11)) {
      const f = bar[pat[s]];
      this.tone(f * 1.6, 0.34, { type: 'sine', vol: 0.5, slide: f, when: w, dest: this.shaper });
    }
    // chord stabs
    if (s === 0 || s === 8 || (s === 14 && this.bar % 2)) {
      const chords = [[349.2, 415.3, 523.3, 622.3], [277.2, 349.2, 415.3, 523.3], [311.1, 392, 466.2, 587.3], [349.2, 415.3, 523.3, 698.5]];
      const ch = chords[Math.floor(this.bar / 2) % 4];
      for (const f of ch) this.tone(f, s === 14 ? 0.25 : 0.55, { type: 'triangle', vol: 0.045, attack: 0.02, when: w, dest });
    }
    // little marimba line every other bar
    if (this.bar % 2 === 1 && (s === 2 || s === 5 || s === 9 || s === 13)) {
      const mel = [698.5, 830.6, 932.3, 1046.5];
      this.tone(mel[(s + this.bar) % 4], 0.18, { type: 'sine', vol: 0.06, when: w, dest });
    }
  }
}
