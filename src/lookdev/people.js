// Look-dev characters: chunky cartoon proportions (big head, rounded limbs), painted faces,
// real outfits. Each rigid body part is one merged, vertex-coloured mesh with an ink outline,
// so a person is ~8 draw calls and animates by rotating pivots (no skinning).

import * as THREE from 'three';
import { toon, outlineMaterial, inked, roundedBox, SHAPES, Merger, faceTexture, RAMP } from './toon.js';
import { GUARD, MOVES } from './moves.js';

const INK = outlineMaterial('#2a1c16', 0.022);
const MAT = toon();

export const LOOKS = {
  sizwe: {
    skin: '#5a3825', shirt: '#f2c230', stripe: '#1e7a3c', pants: '#2b3346', shoe: '#f7f4ee', sole: '#1e7a3c',
    hat: 'bucket', hatColor: '#1e7a3c', hatBand: '#f2c230', hair: '#141414', sleeves: 'short', build: 1.05,
  },
  aunty: {
    skin: '#6b4129', shirt: '#e8743b', dress: '#e8743b', dressPattern: '#ffd166', pants: '#6b4129', shoe: '#8a4b2a', sole: '#3a2216',
    hat: 'doek', hatColor: '#1e6fd9', hatBand: '#ffd166', sleeves: 'long', build: 1.12, lashes: true, bag: '#3cc9c9',
  },
  oom: {
    skin: '#c99470', shirt: '#8c2f39', pants: '#6d6a63', shoe: '#3a2a1f', sole: '#1e1510', hat: 'cap', hatColor: '#4b4f58',
    hair: '#b0a090', sleeves: 'long', build: 1.0, moustache: '#d8d0c0', belly: 1.12,
  },
  thug: {
    skin: '#4f2f1d', shirt: '#c0392b', stripe: '#1b1b1b', pants: '#2e3a52', shoe: '#1b1b1b', sole: '#f2f2f2', hat: 'cap', hatColor: '#1b1b1b',
    hair: '#141414', sleeves: 'short', build: 1.12,
  },
  sisi: {
    skin: '#8a5636', shirt: '#ff5fa2', pants: '#3b6fd9', shoe: '#ffffff', sole: '#ff5fa2', hat: 'none', hair: '#1a120c',
    braids: true, sleeves: 'short', build: 0.95, lashes: true,
  },
};

export class Person {
  constructor(look) {
    const L = (this.look = look);
    const b = L.build || 1;
    this.root = new THREE.Group();
    this.off = new THREE.Group(); // pivot at the feet: lunges, knock-back, falling over
    this.root.add(this.off);
    this.hips = new THREE.Group();
    this.hips.position.y = 0.78;
    this.off.add(this.hips);
    this.fight = false; // fighting stance
    this.stanceW = 0;
    this.act = null;
    this.t = Math.random() * 10;
    this.speed = 0;

    // torso (shirt, stripe or dress top)
    const torso = new Merger();
    const tw = 0.44 * b, th = 0.56;
    torso.add(roundedBox(tw, th, 0.27 * b * (L.belly || 1), 0.11), L.shirt, { y: th / 2 + 0.02 });
    if (L.stripe) torso.add(roundedBox(tw + 0.012, 0.08, 0.28 * b + 0.012, 0.04), L.stripe, { y: 0.34 });
    torso.add(SHAPES.cyl, L.skin, { y: th + 0.06, sx: 0.12, sy: 0.1, sz: 0.12 }); // neck
    if (L.dress) {
      // skirt flares from the waist down to the knees, with a band of pattern
      torso.add(SHAPES.skirt, L.dress, { y: -0.2, sx: 0.66 * b, sy: 0.62, sz: 0.5 * b });
      torso.add(SHAPES.cyl, L.dressPattern, { y: -0.42, sx: 0.6 * b, sy: 0.05, sz: 0.46 * b });
    } else torso.add(roundedBox(tw * 0.98, 0.14, 0.25 * b, 0.06), L.pants, { y: 0.0 }); // waistband
    if (L.bag) torso.add(roundedBox(0.08, 0.5, 0.05, 0.02), L.bag, { y: 0.32, rz: 0.55, z: 0.05 });
    this.torso = new THREE.Group();
    this.torso.add(inked(torso.build(), MAT, INK));
    this.hips.add(this.torso);

    // head with a painted face, ears, nose, hair / hat
    this.head = new THREE.Group();
    this.head.position.y = th + 0.31;
    const face = new THREE.Mesh(SHAPES.sphere, new THREE.MeshToonMaterial({ map: faceTexture({ skin: L.skin, lashes: L.lashes }), gradientMap: RAMP }));
    face.scale.set(0.42, 0.44, 0.4);
    face.rotation.y = -Math.PI / 2; // texture centre faces forward (+z)
    face.castShadow = true;
    const faceInk = new THREE.Mesh(SHAPES.sphere, INK);
    faceInk.scale.copy(face.scale);
    this.head.add(face, faceInk);
    const hd = new Merger();
    hd.add(SHAPES.sphereLo, L.skin, { x: 0.205, y: -0.01, sx: 0.08, sy: 0.12, sz: 0.07 });
    hd.add(SHAPES.sphereLo, L.skin, { x: -0.205, y: -0.01, sx: 0.08, sy: 0.12, sz: 0.07 });
    hd.add(SHAPES.sphereLo, shade(L.skin, 0.9), { y: -0.02, z: 0.2, sx: 0.08, sy: 0.07, sz: 0.07 }); // nose
    if (L.moustache) hd.add(roundedBox(0.13, 0.035, 0.035, 0.014), L.moustache, { y: -0.07, z: 0.19 });
    if (L.hair && L.hat !== 'doek') hd.add(SHAPES.sphere, L.hair, { y: 0.06, z: -0.03, sx: 0.43, sy: 0.38, sz: 0.41 });
    if (L.braids) {
      for (let i = 0; i < 7; i++) {
        const a = -1.1 + (i / 6) * 2.2;
        hd.add(SHAPES.cylLo, L.hair, { x: Math.sin(a) * 0.18, y: -0.14, z: -Math.cos(a) * 0.15, sx: 0.04, sy: 0.36, sz: 0.04 });
      }
    }
    if (L.hat === 'bucket') {
      // bucket hat: tapered crown, soft sloping brim
      hd.add(SHAPES.skirt, L.hatColor, { y: 0.21, z: -0.02, sx: 0.5, sy: 0.17, sz: 0.5 });
      hd.add(SHAPES.sphereLo, L.hatColor, { y: 0.29, z: -0.02, sx: 0.29, sy: 0.07, sz: 0.29 });
      hd.add(SHAPES.skirt, L.hatColor, { y: 0.12, z: -0.02, sx: 0.66, sy: 0.05, sz: 0.66, rx: -0.1 });
      hd.add(SHAPES.cyl, L.hatBand, { y: 0.155, z: -0.02, sx: 0.42, sy: 0.035, sz: 0.42 });
    } else if (L.hat === 'doek') {
      hd.add(SHAPES.sphere, L.hatColor, { y: 0.13, z: -0.06, sx: 0.46, sy: 0.36, sz: 0.44 });
      hd.add(SHAPES.sphere, L.hatColor, { y: 0.3, z: -0.1, sx: 0.32, sy: 0.24, sz: 0.28 }); // the knot
      hd.add(SHAPES.torus, L.hatBand, { y: 0.11, z: -0.03, sx: 0.43, sy: 0.43, sz: 0.43, rx: Math.PI / 2 + 0.35 });
    } else if (L.hat === 'cap') {
      hd.add(SHAPES.sphere, L.hatColor, { y: 0.12, sx: 0.44, sy: 0.27, sz: 0.44 });
      hd.add(roundedBox(0.34, 0.03, 0.16, 0.014), L.hatColor, { y: 0.1, z: 0.22, rx: 0.12 });
    }
    this.head.add(inked(hd.build(), MAT, INK));
    this.torso.add(this.head);

    // arms: shoulder -> upper arm -> elbow -> forearm -> wrist -> hand
    const part = (build) => {
      const m = new Merger();
      build(m);
      return inked(m.build(), MAT, INK);
    };
    const UPPER = 0.27, FORE = 0.25;
    this.arms = [-1, 1].map((s) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * (tw / 2 + 0.05), th - 0.04, 0);
      shoulder.add(part((m) => {
        m.add(SHAPES.sphere, L.shirt, { sx: 0.15, sy: 0.15, sz: 0.15 }); // shoulder ball hides the joint
        m.add(SHAPES.capsule, L.shirt, { y: -UPPER / 2, sx: 0.13, sy: UPPER / 1.5, sz: 0.13 });
      }));
      const elbow = new THREE.Group();
      elbow.position.y = -UPPER;
      elbow.add(part((m) => {
        const sleeveCol = L.sleeves === 'long' ? L.shirt : L.skin;
        m.add(SHAPES.sphere, sleeveCol, { sx: 0.12, sy: 0.12, sz: 0.12 });
        m.add(SHAPES.capsule, sleeveCol, { y: -FORE / 2, sx: 0.11, sy: FORE / 1.6, sz: 0.11 });
        if (L.sleeves === 'long') m.add(SHAPES.cyl, shade(L.shirt, 0.85), { y: -FORE + 0.02, sx: 0.12, sy: 0.04, sz: 0.12 }); // cuff
      }));
      const wrist = new THREE.Group();
      wrist.position.y = -FORE;
      wrist.add(part((m) => {
        m.add(SHAPES.sphere, L.skin, { y: -0.05, sx: 0.12, sy: 0.13, sz: 0.1 });
        m.add(SHAPES.sphereLo, L.skin, { x: s * -0.045, y: -0.03, z: 0.03, sx: 0.05, sy: 0.07, sz: 0.05 }); // thumb
      }));
      elbow.add(wrist);
      shoulder.add(elbow);
      this.torso.add(shoulder);
      return { shoulder, elbow, wrist, side: s };
    });

    // legs: hip -> thigh -> knee -> shin -> ankle -> takkie
    const THIGH = 0.36, SHIN = 0.33;
    this.legs = [-1, 1].map((s) => {
      const hip = new THREE.Group();
      hip.position.set(s * 0.11 * b, 0.02, 0);
      hip.add(part((m) => m.add(SHAPES.capsule, L.pants, { y: -THIGH / 2, sx: 0.18, sy: THIGH / 1.5, sz: 0.18 })));
      const knee = new THREE.Group();
      knee.position.y = -THIGH;
      knee.add(part((m) => {
        m.add(SHAPES.sphere, L.pants, { sx: 0.165, sy: 0.165, sz: 0.165 });
        m.add(SHAPES.capsule, L.pants, { y: -SHIN / 2, sx: 0.155, sy: SHIN / 1.5, sz: 0.155 });
      }));
      const ankle = new THREE.Group();
      ankle.position.y = -SHIN;
      ankle.add(part((m) => {
        m.add(roundedBox(0.16, 0.11, 0.28, 0.05), L.shoe, { y: -0.03, z: 0.05 });
        m.add(roundedBox(0.165, 0.035, 0.29, 0.015), L.sole, { y: -0.08, z: 0.05 });
      }));
      knee.add(ankle);
      hip.add(knee);
      this.hips.add(hip);
      return { hip, knee, ankle, side: s };
    });

    // named joints for keyframed moves (see moves.js); L = lead side (+x), R = rear side (-x)
    const J = (this.J = {});
    const add = (name, obj, prop, axis) => (J[name] = { obj: obj[prop], axis });
    add('off.px', this.off, 'position', 'x');
    add('off.py', this.off, 'position', 'y');
    add('off.pz', this.off, 'position', 'z');
    add('off.rx', this.off, 'rotation', 'x');
    add('hips.py', this.hips, 'position', 'y');
    for (const ax of ['y', 'z']) add('hips.r' + ax, this.hips, 'rotation', ax);
    for (const ax of ['x', 'y', 'z']) {
      add('torso.r' + ax, this.torso, 'rotation', ax);
      add('head.r' + ax, this.head, 'rotation', ax);
    }
    for (const [n, a] of [['armR', this.arms[0]], ['armL', this.arms[1]]]) {
      for (const ax of ['x', 'y', 'z']) add(`${n}.s${ax}`, a.shoulder, 'rotation', ax);
      add(n + '.ex', a.elbow, 'rotation', 'x');
      add(n + '.ez', a.elbow, 'rotation', 'z');
      add(n + '.wx', a.wrist, 'rotation', 'x');
    }
    for (const [n, l] of [['legR', this.legs[0]], ['legL', this.legs[1]]]) {
      add(n + '.hx', l.hip, 'rotation', 'x');
      add(n + '.hz', l.hip, 'rotation', 'z');
      add(n + '.kx', l.knee, 'rotation', 'x');
      add(n + '.ax', l.ankle, 'rotation', 'x');
    }
  }

  /** Start a move from moves.js. onHit fires at the moment of contact. */
  play(name, { onHit = null, onEnd = null } = {}) {
    const m = MOVES[name];
    this.act = { name, m, t: 0, onHit, onEnd, hitDone: false, start: this.snapshot() };
    return m;
  }

  get busy() {
    return !!this.act;
  }

  snapshot() {
    const o = {};
    for (const k in this.J) o[k] = this.J[k].obj[this.J[k].axis];
    return o;
  }

  /** Pose of a move at time t (keys interpolated, gaps filled from the guard). */
  sample(m, t) {
    const K = m.keys;
    let i = 0;
    while (i < K.length - 2 && t >= K[i + 1].t) i++;
    const a = K[i], b = K[i + 1];
    let u = THREE.MathUtils.clamp((t - a.t) / Math.max(1e-4, b.t - a.t), 0, 1);
    if (b.ease === 'snap') {
      const c = 1.3, v = u - 1;
      u = 1 + (c + 1) * v * v * v + c * v * v; // fast out with a small overshoot
    } else u = u * u * (3 - 2 * u);
    const out = {};
    for (const k in GUARD) {
      const va = a.p && k in a.p ? a.p[k] : GUARD[k];
      const vb = b.p && k in b.p ? b.p[k] : GUARD[k];
      out[k] = va + (vb - va) * u;
    }
    return out;
  }

  /** Blend the fighting stance and the current move over the walk / idle pose. */
  applyFight(dt, k) {
    this.stanceW += ((this.fight ? 1 : 0) - this.stanceW) * Math.min(1, dt * 7);
    let target = null, w = 0;
    if (this.act) {
      const A = this.act, m = A.m;
      A.t += dt;
      if (!A.hitDone && m.hit !== undefined && A.t >= m.hit) A.fireHit = true; // fired once this frame's pose is applied
      if (A.t >= m.dur) {
        // bake any step the move took into the real position
        if (m.keepOffset) {
          const o = this.off.position, ry = this.root.rotation.y;
          this.root.position.x += Math.sin(ry) * o.z + Math.cos(ry) * o.x;
          this.root.position.z += Math.cos(ry) * o.z - Math.sin(ry) * o.x;
        }
        this.off.position.set(0, 0, 0);
        this.off.rotation.set(0, 0, 0);
        this.act = null;
        if (A.onEnd) A.onEnd();
      } else {
        target = this.sample(m, A.t);
        // ease in from wherever the body was; ease out to the walk pose if not in a stance
        w = Math.min(1, A.t / 0.06) * (this.stanceW > 0.5 ? 1 : Math.min(1, (m.dur - A.t) / 0.12));
      }
    }
    const sw = this.stanceW;
    if (sw < 0.001 && !target) return;
    const bounce = Math.sin(this.t * 7.5);
    for (const key in this.J) {
      const j = this.J[key], cur = j.obj[j.axis];
      let v = cur;
      if (sw > 0.001 && key in GUARD && !key.startsWith('off.')) {
        let g = GUARD[key];
        if (key === 'hips.py') g += bounce * 0.012;
        if (key === 'torso.rz') g += Math.sin(this.t * 3.7) * 0.03;
        if (key === 'armL.sx' || key === 'armR.sx') g += Math.sin(this.t * 3.7 + (key[3] === 'L' ? 0 : 1.5)) * 0.05;
        // while moving in a stance the legs keep walking (a shuffle), the upper body keeps its guard
        const legs = key.startsWith('leg') || key === 'hips.ry';
        v = cur + (g - cur) * sw * (legs ? 1 - k : 1);
      }
      if (target) v = v + (target[key] - v) * w;
      j.obj[j.axis] = v;
    }
    if (this.act && this.act.fireHit) {
      this.act.fireHit = false;
      this.act.hitDone = true;
      this.root.updateMatrixWorld(true); // so the fist / foot position is this frame's
      if (this.act.onHit) this.act.onHit(this.act.m);
    }
  }

  /**
   * Procedural animation with bending joints.
   * speed in m/s (walk ~1.4, run ~3.5); pose: 'stand' | 'sit'; wave: wave the right hand.
   */
  update(dt, { speed = 0, wave = false, pose = 'stand' } = {}) {
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    const v = this.speed;
    const k = Math.min(1, v / 1.2); // 0 standing -> 1 walking
    const run = THREE.MathUtils.clamp((v - 2) / 1.5, 0, 1); // blends walk -> run
    // phase advances with distance so the feet don't skate: one stride (two steps) ~1.4 m walking, ~2.4 m running
    const stride = 1.4 + run * 1.0;
    this.t += dt * (k > 0.02 ? (Math.PI * 2 * v) / stride : 0) + dt * 0.9 * (1 - k);
    const p = this.t;
    const ease = (x) => x * x * (3 - 2 * x);

    if (pose === 'sit') {
      this.hips.position.y = 0.6;
      this.hips.rotation.set(0, 0, 0);
      for (const l of this.legs) {
        l.hip.rotation.set(-1.5, 0, l.side * 0.08);
        l.knee.rotation.x = 1.5;
        l.ankle.rotation.x = 0.05;
      }
      for (const a of this.arms) {
        a.shoulder.rotation.set(-0.55, 0, a.side * 0.12);
        a.elbow.rotation.set(-0.7, 0, 0);
        a.wrist.rotation.x = 0.2;
      }
      this.torso.rotation.set(-0.08 + Math.sin(p * 0.9) * 0.012, 0, 0);
      this.head.rotation.set(0.05, Math.sin(p * 0.27) * 0.35, 0);
      this.applyFight(dt, 0);
      return;
    }

    // ---- legs: thigh swings, knee folds as the leg passes under the body, foot rolls heel -> toe
    const thighAmp = (0.5 + run * 0.35) * k;
    for (const l of this.legs) {
      const ph = p + (l.side > 0 ? Math.PI : 0);
      const swing = Math.sin(ph); // +1 leg forward
      const passing = Math.max(0, Math.cos(ph)); // >0 while the leg swings forward
      const thigh = -swing * thighAmp - run * 0.15;
      const knee = (0.08 + Math.pow(passing, 1.5) * (0.95 + run * 0.7)) * k + (1 - k) * 0.04;
      l.hip.rotation.x = thigh;
      l.knee.rotation.x = knee;
      // keep the sole near the ground: undo the leg angle, add a toe-off flick behind and heel strike in front
      l.ankle.rotation.x = -(thigh + knee) * 0.75 + (swing < -0.6 ? (swing + 0.6) * -0.9 : 0) * k - Math.max(0, swing - 0.7) * 0.6 * k;
      l.hip.rotation.z = l.side * 0.03;
    }
    // idle: weight shifts slowly from foot to foot, one knee relaxes
    const shift = Math.sin(p * 0.35) * (1 - k);
    this.legs[0].knee.rotation.x += Math.max(0, shift) * 0.18;
    this.legs[1].knee.rotation.x += Math.max(0, -shift) * 0.18;

    // ---- hips and spine: bob (lowest when both feet are down), sway, twist against the shoulders
    const bob = Math.abs(Math.cos(p)) * (0.045 + run * 0.06) * k;
    this.hips.position.y = 0.78 - 0.035 * k + bob - run * 0.03 + Math.sin(p * 0.9) * 0.006 * (1 - k);
    this.hips.position.x = Math.sin(p) * 0.03 * k + shift * 0.025;
    this.hips.rotation.y = -Math.sin(p) * 0.14 * k;
    this.hips.rotation.z = Math.sin(p) * 0.04 * k - shift * 0.04;
    this.torso.rotation.y = Math.sin(p) * (0.26 + run * 0.1) * k; // shoulders counter-twist
    this.torso.rotation.x = (0.06 + run * 0.22) * k;
    this.torso.rotation.z = -Math.sin(p) * 0.03 * k + shift * 0.05;
    this.torso.scale.set(1, 1 + Math.sin(p * 0.9) * 0.012 * (1 - k), 1); // breathing
    // head stays level and looks around a little when standing
    this.head.rotation.y = -this.torso.rotation.y * 0.8 - this.hips.rotation.y + Math.sin(p * 0.21) * 0.3 * (1 - k);
    this.head.rotation.x = -this.torso.rotation.x * 0.7 + Math.cos(p * 2) * 0.02 * k;
    this.head.rotation.z = -this.torso.rotation.z;

    // ---- arms: swing opposite the legs, elbows bend more on the forward swing (and a lot when running)
    const armAmp = (0.45 + run * 0.4) * k;
    for (const a of this.arms) {
      const ph = p + (a.side > 0 ? 0 : Math.PI);
      const fwd = Math.sin(ph);
      a.shoulder.rotation.x = -fwd * armAmp;
      a.shoulder.rotation.z = a.side * (0.1 + run * 0.08) + Math.sin(p * 0.9 + a.side) * 0.01 * (1 - k);
      a.elbow.rotation.x = -(0.18 + 0.25 * k + Math.max(0, fwd) * 0.45 * k + run * 0.9);
      a.elbow.rotation.z = 0;
      a.wrist.rotation.x = -0.1 - fwd * 0.12 * k;
    }
    if (wave) {
      // right arm: upper arm out to the side, forearm up, hand waving from the elbow
      const a = this.arms[1];
      a.shoulder.rotation.set(-0.15, 0, 1.35);
      a.elbow.rotation.set(0, 0, 1.25 + Math.sin(p * 5) * 0.4);
      a.wrist.rotation.set(0, 0, Math.sin(p * 5 + 0.6) * 0.25);
    }
    this.applyFight(dt, k);
  }
}

function shade(hex, f) {
  return new THREE.Color(hex).multiplyScalar(f);
}
