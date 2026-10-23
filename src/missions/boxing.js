// Langa Boxing Club: Coach Mzi teaches three lessons (pad work to the beat). Each one adds a move to
// Sizwe's combo: hook, then uppercut, then body shots (see COMBOS in player.js).

import * as THREE from 'three';
import { MeshKit, vcMaterial } from '../core/meshkit.js';
import { roundedBox, outlineMaterial } from '../core/toon.js';
import { makeSignTexture } from '../world/textures.js';
import { frontage } from '../systems/weapons.js';
import { T } from '../world/grid.js';
import { dist, formatMoney, pick } from '../core/util.js';

const LESSONS = [
  { move: 'hook', name: 'The hook', price: 100, respect: 0, cues: ['punchL', 'punchR', 'hook'], combo: 'jab, cross, hook',
    intro: "Ewe, my boy. Street fighters swing; boxers turn. Elbow up, turn the hips, and the hook does the work. Hit the pads when I call it." },
  { move: 'uppercut', name: 'The uppercut', price: 200, respect: 30, cues: ['punchL', 'punchR', 'hook', 'uppercut'], combo: 'jab, cross, hook, uppercut',
    intro: 'Sink in the knees, then drive up from the back foot. The uppercut puts them on the canvas. On my call!' },
  { move: 'body', name: 'Body shots', price: 300, respect: 60, cues: ['punchL', 'punchR', 'body', 'hook', 'uppercut'], combo: 'jab, cross, body shot, hook, uppercut',
    intro: "Champions dig to the body. Bend, rip the ribs, come up top with the hook and finish with the uppercut. Five-punch combo. Let's go!" },
];
const CUE_WORD = { punchL: 'JAB!', punchR: 'CROSS!', hook: 'HOOK!', uppercut: 'UPPERCUT!', body: 'BODY!' };
const CUE_DUR = { punchL: 0.36, punchR: 0.46, hook: 0.44, uppercut: 0.58, body: 0.4 };
const COACH = { skin: '#3a2316', shirt: '#c0392b', stripe: '#ffffff', pants: '#1c2a4a', shoes: '#f2f2f2', hair: '#141414', hairStyle: 'bald', hat: 'none', sleeves: 'short', build: 1.06, moustache: '#e8e0d0' };
const INK = '#2a1d17';

export class BoxingClub {
  constructor(game) {
    this.game = game;
    this.coach = null;
    this.build();
  }

  get level() {
    return this.game.state.boxing || 0;
  }

  build() {
    const g = this.game;
    const f = frontage(g.city, g.grid, 'langa', 600, 70, new Set(), { minH: 2.5, minW: 6, walk: [T.WALK, T.LAND, T.PARK, T.PLAZA] });
    if (!f) return;
    this.spot = f;
    const { x, z, ry, w } = f;
    const out = (d) => [x + Math.sin(ry) * d, z + Math.cos(ry) * d];
    const k = new MeshKit();
    // red doorway, a hanging heavy bag under a little canopy, a bench
    const along = (d, o) => [x + Math.cos(ry) * d + Math.sin(ry) * o, z - Math.sin(ry) * d + Math.cos(ry) * o];
    let [px, pz] = along(0, 0.05);
    k.add(roundedBox(1.3, 2.1, 0.12, 0.05, 1), { x: px, y: 1.05, z: pz, ry, color: '#c0392b' });
    [px, pz] = along(-Math.min(w / 2 - 1, 2.6), 1.3);
    k.add(roundedBox(1.8, 0.12, 1.8, 0.05, 1), { x: px, y: 2.6, z: pz, ry, color: '#ffc928' });
    k.cyl(px, 1.9, pz, 0.03, 0.7, '#3a3f44', 6);
    k.add(roundedBox(0.5, 1.0, 0.5, 0.22, 2), { x: px, y: 1.35, z: pz, color: '#c0392b' });
    for (const s of [-1, 1]) {
      const [qx, qz] = along(-Math.min(w / 2 - 1, 2.6) + s * 0.8, 1.3);
      k.cyl(qx, 0, qz, 0.05, 2.6, '#3a3f44', 6);
    }
    [px, pz] = along(1.9, 0.8);
    k.add(roundedBox(1.6, 0.45, 0.5, 0.08, 1), { x: px, y: 0.23, z: pz, ry, color: '#8a6040' });
    const mesh = new THREE.Mesh(k.build(), vcMaterial());
    mesh.add(new THREE.Mesh(mesh.geometry, outlineMaterial(INK, 0.03)));
    g.meshes.root.add(mesh);
    const tex = makeSignTexture('LANGA BOXING CLUB', { w: 512, h: 96, bg: '#c0392b', fg: '#ffffff' });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.95, 6.5), 1.1), new THREE.MeshBasicMaterial({ map: tex }));
    const [sx, sz] = out(0.1);
    sign.position.set(sx, 2.75, sz);
    sign.rotation.y = ry;
    g.meshes.root.add(sign);
    const [cx, cz] = along(1.4, 1.8);
    this.coachSpot = { x: cx, z: cz, h: ry };
    g.interactions.add('boxing', { x: cx, z: cz, r: 2.6, label: () => this.label(), onUse: () => this.lesson() });
  }

  label() {
    if (this.level >= LESSONS.length) return '🥊 Pad work with Coach Mzi';
    const L = LESSONS[this.level];
    return `🥊 Boxing lesson ${this.level + 1}: ${L.name} — ${formatMoney(L.price)}`;
  }

  /** Keep Coach Mzi standing outside his club while Sizwe is in the area. */
  update() {
    const g = this.game, p = g.player, c = this.coach;
    if (!this.coachSpot) return;
    const near = dist(p.x, p.z, this.coachSpot.x, this.coachSpot.z) < 90;
    if (near && (!c || c.removeMe || !g.peds.list.includes(c))) {
      this.coach = g.peds.spawn(this.coachSpot.x, this.coachSpot.z, { kind: 'npc', look: COACH, ai: 'idle', anim: 'talk', persistent: true, invulnerable: true, noFight: true, name: 'Coach Mzi', heading: this.coachSpot.h, faceTarget: true });
    } else if (!near && c && !c.removeMe) {
      c.removeMe = true;
      this.coach = null;
    }
  }

  async lesson() {
    const g = this.game, p = g.player;
    if (g.missions.active) return g.hud.toast('Finish your job first.');
    const done = this.level >= LESSONS.length;
    const L = done ? LESSONS[LESSONS.length - 1] : LESSONS[this.level];
    if (!done) {
      if (g.state.respect < L.respect) {
        return g.hud.say('Coach Mzi', `Come back when the streets know your name, boy (${L.respect} respect). Practise what I showed you.`, { auto: 3.5, bark: true });
      }
      if (g.state.money < L.price) return g.hud.toast(`Lessons cost ${formatMoney(L.price)}.`, 'warn');
    }
    await g.hud.say('Coach Mzi', done ? pick(['Again! A champion never stops training.', 'Pads up. Show me the five-punch combo.']) : L.intro);
    if (!done) g.addMoney(-L.price);
    const ok = await this.padWork(L, done ? 'PAD WORK' : `LESSON ${this.level + 1}: ${L.name.toUpperCase()}`);
    if (!ok) {
      if (!done) g.addMoney(L.price, true);
      return g.hud.say('Coach Mzi', 'Eish, too slow! Breathe, and come try again. (Lesson refunded.)', { auto: 3, bark: true });
    }
    if (done) {
      g.state.stats.stamina = Math.min(100, g.state.stats.stamina + 1);
      p.burnFat(2);
      return g.hud.toast('Good session. Stamina +1% · Fat -2%', 'good');
    }
    g.state.boxing = this.level + 1;
    g.addRespect(2);
    g.audio.passed();
    g.hud.banner('NEW MOVE', L.name.toUpperCase(), 'title-card', 2600);
    g.hud.toast(`🥊 Combo is now: <b>${L.combo}</b>. Tap attack in rhythm to chain it.`, 'good', 6000);
  }

  /** Coach calls a punch, a ring closes on the pad: tap attack as it lands. 10 calls, 7 good ones to pass. */
  padWork(L, title) {
    const g = this.game, p = g.player;
    const box = document.getElementById('minigame');
    const calls = Array.from({ length: 10 }, (_, i) => L.cues[i % L.cues.length]);
    box.innerHTML = `<div class="mg"><h2>${title}</h2><p>Tap (or press attack) when the ring hits the pad!</p>
      <div class="pad-zone"><div class="pad-target"></div><div class="pad-ring"></div><div class="pad-word"></div></div>
      <div class="reps">0 / 7</div><button class="tap">HIT!</button><div class="row"><button class="quit">Give up</button></div></div>`;
    box.classList.remove('hidden');
    g.minigame = true;
    p.locked = true;
    p.anim = { guard: true, action: null, actionT: 0 };
    if (this.coach) {
      this.coach.anim = null;
      this.coach.face?.(p.x, p.z, 1);
    }
    const ring = box.querySelector('.pad-ring'), word = box.querySelector('.pad-word'), repEl = box.querySelector('.reps');
    let i = -1, t = 0, good = 0, tapped = true, finished = false, act = null;
    const RING = 0.95; // seconds from wide ring to the pad
    return new Promise((resolve) => {
      const end = (ok) => {
        if (finished) return;
        finished = true;
        box.classList.add('hidden');
        box.innerHTML = '';
        g.minigame = false;
        p.locked = false;
        p.anim = null;
        if (this.coach) this.coach.anim = 'talk';
        window.removeEventListener('keydown', key);
        resolve(ok);
      };
      const judge = (text, cls) => {
        word.textContent = text;
        word.className = 'pad-word ' + cls;
      };
      const tap = () => {
        if (finished || tapped || i < 0) return;
        tapped = true;
        const off = Math.abs(t - RING);
        const cue = calls[i];
        act = { type: cue, t: 0 };
        g.audio.whoosh();
        if (off < 0.13) {
          good++;
          g.audio.punch(cue === 'uppercut' || cue === 'hook');
          g.effects.pow(p.x + Math.sin(p.heading) * 0.8, p.y + 1.45, p.z + Math.cos(p.heading) * 0.8, cue === 'uppercut');
          judge(off < 0.06 ? 'PERFECT!' : 'GOOD!', 'good');
        } else judge(t < RING ? 'TOO EARLY' : 'TOO LATE', 'miss');
        repEl.textContent = `${good} / 7`;
      };
      const key = (e) => {
        if (['Space', 'KeyJ', 'KeyK', 'Enter', 'KeyE'].includes(e.code) && !e.repeat) {
          e.preventDefault();
          tap();
        }
        if (e.code === 'Escape') end(false);
      };
      window.addEventListener('keydown', key);
      box.querySelector('.tap').addEventListener('pointerdown', (e) => {
        e.preventDefault();
        tap();
      });
      box.querySelector('.quit').addEventListener('click', () => end(false));
      let last = performance.now(), padWas = true;
      const next = () => {
        i++;
        t = 0;
        tapped = false;
        if (i >= calls.length) return end(good >= 7);
        judge(CUE_WORD[calls[i]], 'call');
      };
      next();
      const loop = (now) => {
        if (finished) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const ph = g.input.padHeld, padNow = !!(ph.confirm || ph.attack);
        if (padNow && !padWas) tap();
        padWas = padNow;
        if (!g.paused) {
          t += dt;
          const sc = Math.max(0.55, 2.4 - (t / RING) * 1.4);
          ring.style.transform = `translate(-50%, -50%) scale(${sc})`;
          ring.style.opacity = t > RING + 0.25 ? 0.3 : 1;
          if (t > RING + 0.55) {
            if (!tapped) judge('MISS', 'miss');
            next();
          }
          // Sizwe throws the called punch
          if (act) {
            act.t += dt;
            const d = CUE_DUR[act.type];
            p.anim.action = act.type;
            p.anim.actionT = Math.min(1, act.t / d);
            if (act.t >= d) {
              act = null;
              p.anim.action = null;
            }
          }
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
  }
}
