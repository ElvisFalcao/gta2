// Sunny-toon people: each person is ONE skinned mesh (plus one skinned ink outline) with
// bending joints (shoulder / elbow / wrist, hip / knee / ankle), a modelled cartoon face and
// procedural animation: walk / run cycle, idle, poses (sit, lie, swim, dance, cheer, lift, wave...)
// and keyframed fight moves from moves.js.

import * as THREE from 'three';
import { clamp, lerp } from '../core/util.js';
import { roundedBox, RAMP } from '../core/toon.js';
import { GUARD, MOVES, LYING_T } from './moves.js';

export const SKIN = ['#3a2316', '#4f2f1d', '#6b4129', '#8a5636', '#a8724c', '#c99470', '#e2b896', '#f0d2b6'];
export const SHIRTS = ['#e04a4a', '#2f7ae0', '#f5c430', '#2fae62', '#ffffff', '#26262a', '#9a52c2', '#ff8a3f', '#3fc9cf', '#f07aae', '#6f80a0', '#b85a2c'];
export const PANTS = ['#2b2f3a', '#3b5a92', '#1f1f22', '#6b5b45', '#4a4f55', '#2f4a3a', '#c9b48f'];
export const HAIR = ['#141414', '#24180f', '#3a2a1a', '#5a4630', '#8a6a3a', '#b0a090'];

export function randomLook(r = Math.random) {
  const p = (a) => a[Math.floor(r() * a.length)];
  const hat = r() < 0.18 ? p(['bucket', 'cap', 'beanie']) : r() < 0.12 ? 'doek' : 'none';
  return {
    skin: p(SKIN), shirt: p(SHIRTS), pants: p(PANTS), shoes: p(['#f2f2f2', '#1b1b1b', '#6b4f36', '#c0392b']),
    hair: p(HAIR), hairStyle: p(['short', 'short', 'afro', 'bald', 'long']), hat, hatColor: p(SHIRTS),
    sleeves: r() < 0.6 ? 'short' : 'long', dress: hat === 'doek' ? r() < 0.6 : r() < 0.08, build: 0.95 + r() * 0.15,
  };
}

// ---------------------------------------------------------------- shared geometry and materials
const G = {
  sphere: new THREE.SphereGeometry(0.5, 14, 10),
  ball: new THREE.SphereGeometry(0.5, 9, 7),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 4, 10),
  skirt: new THREE.CylinderGeometry(0.28, 0.5, 1, 14),
  smile: new THREE.TorusGeometry(0.5, 0.2, 4, 10, Math.PI),
};
const SCALE = 1.06; // a touch bigger than the reference rig so doors / cars still fit around them
let toonMat = null, inkMat = null;
export function humanMaterial() {
  if (!toonMat) toonMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: RAMP });
  return toonMat;
}
/** Skinned ink outline: back faces pushed out along the skinned normals; aInk scales the width (0 = no outline). */
function inkMaterial() {
  if (inkMat) return inkMat;
  inkMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: new THREE.Color('#24170f') }, uWidth: { value: 0.022 } }]),
    vertexShader: `uniform float uWidth;
      attribute float aInk;
      #include <common>
      #include <skinning_pars_vertex>
      #include <fog_pars_vertex>
      void main() {
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        transformed += normalize(objectNormal) * uWidth * aInk;
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uColor;
      #include <common>
      #include <fog_pars_fragment>
      void main() { gl_FragColor = vec4(uColor, 1.0);
        #include <fog_fragment>
      }`,
    side: THREE.BackSide,
    fog: true,
  });
  return inkMat;
}

// ---------------------------------------------------------------- skeleton layout (bind pose, metres)
const THIGH = 0.36, SHIN = 0.33, UPPER = 0.27, FORE = 0.25, TH = 0.56;
const BONES = [
  // name, parent, x, y, z
  ['root', null, 0, 0, 0],
  ['off', 'root', 0, 0, 0],
  ['hips', 'off', 0, 0.78, 0],
  ['torso', 'hips', 0, 0, 0],
  ['head', 'torso', 0, TH + 0.31, 0],
  ['shoulderL', 'torso', 0.27, TH - 0.04, 0],
  ['elbowL', 'shoulderL', 0, -UPPER, 0],
  ['wristL', 'elbowL', 0, -FORE, 0],
  ['shoulderR', 'torso', -0.27, TH - 0.04, 0],
  ['elbowR', 'shoulderR', 0, -UPPER, 0],
  ['wristR', 'elbowR', 0, -FORE, 0],
  ['hipL', 'hips', 0.11, 0.02, 0],
  ['kneeL', 'hipL', 0, -THIGH, 0],
  ['ankleL', 'kneeL', 0, -SHIN, 0],
  ['hipR', 'hips', -0.11, 0.02, 0],
  ['kneeR', 'hipR', 0, -THIGH, 0],
  ['ankleR', 'kneeR', 0, -SHIN, 0],
];
const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
const BIND = (() => {
  // bind-pose world position of every bone (all rotations zero)
  const out = {};
  for (const [n, p, x, y, z] of BONES) {
    const base = p ? out[p] : [0, 0, 0];
    out[n] = [base[0] + x, base[1] + y, base[2] + z];
  }
  return out;
})();

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Matrix3(), _c = new THREE.Color();

/** Merges parts into one skinned geometry; each part is rigidly bound to one bone. */
class SkinBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.si = [];
    this.sw = [];
    this.ink = [];
    this.idx = [];
    this.count = 0;
  }
  add(bone, geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, ink = 1 } = {}) {
    const b = BIND[bone];
    _m.compose(_v.set(b[0] + x, b[1] + y, b[2] + z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
    _n.getNormalMatrix(_m);
    _c.set(color);
    const P = geo.attributes.position, N = geo.attributes.normal, bi = BI[bone], base = this.count;
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(_m);
      this.pos.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(N, i).applyMatrix3(_n).normalize();
      this.nor.push(_v.x, _v.y, _v.z);
      this.col.push(_c.r, _c.g, _c.b);
      this.si.push(bi, 0, 0, 0);
      this.sw.push(1, 0, 0, 0);
      this.ink.push(ink);
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) this.idx.push(base + geo.index.getX(i));
    else for (let i = 0; i < P.count; i++) this.idx.push(base + i);
    this.count += P.count;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setAttribute('aInk', new THREE.Float32BufferAttribute(this.ink, 1));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    return g;
  }
}

const shade = (hex, f) => '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
const mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

function buildGeometry(L) {
  const k = new SkinBuilder();
  const skin = L.skin, shirt = L.shirt, pants = L.dress ? skin : L.pants || '#2b2f3a';
  const shoe = L.shoes || '#f2f2f2', sole = shade(shoe, 0.55);
  const tw = 0.44, belly = L.belly || 1;
  // torso: shirt, extras, neck
  k.add('torso', roundedBox(tw, TH, 0.27 * belly, 0.11), shirt, { y: TH / 2 + 0.02 });
  if (L.stripe) k.add('torso', roundedBox(tw + 0.012, 0.08, 0.28 * belly + 0.012, 0.04), L.stripe, { y: 0.34 });
  if (L.vest) for (const s of [-1, 1]) k.add('torso', roundedBox(0.14, TH - 0.06, 0.02, 0.01), L.vest, { x: s * 0.12, y: TH / 2 + 0.03, z: 0.137 * belly });
  if (L.tie) k.add('torso', roundedBox(0.06, 0.32, 0.02, 0.01), L.tie, { y: TH - 0.2, z: 0.14 * belly });
  if (L.bandana) k.add('torso', G.cyl, L.bandana, { y: TH + 0.02, sx: 0.24, sy: 0.07, sz: 0.24 });
  k.add('torso', G.cyl, skin, { y: TH + 0.07, sx: 0.12, sy: 0.12, sz: 0.12 });
  if (L.dress) {
    k.add('hips', G.skirt, L.shirt, { y: -0.2, sx: 0.66, sy: 0.62, sz: 0.5 });
    k.add('hips', G.cyl, shade(L.shirt, 0.8), { y: -0.44, sx: 0.6, sy: 0.05, sz: 0.46 });
  } else k.add('hips', roundedBox(tw * 0.98, 0.16, 0.25, 0.06), L.pants, { y: 0 });
  if (L.belt) k.add('hips', roundedBox(tw, 0.05, 0.26, 0.02), L.belt, { y: 0.06 });

  // head: skin, ears, nose, modelled face (no outline on the small face parts)
  k.add('head', G.sphere, skin, { sx: 0.42, sy: 0.44, sz: 0.4 });
  for (const s of [-1, 1]) {
    k.add('head', G.ball, skin, { x: s * 0.205, y: -0.01, sx: 0.08, sy: 0.12, sz: 0.07 });
    k.add('head', G.ball, '#fbf8f0', { x: s * 0.075, y: 0.025, z: 0.165, sx: 0.08, sy: 0.095, sz: 0.06, ink: 0.35 });
    k.add('head', G.ball, '#24160d', { x: s * 0.07, y: 0.018, z: 0.19, sx: 0.045, sy: 0.058, sz: 0.03, ink: 0 });
    k.add('head', G.ball, '#ffffff', { x: s * 0.06, y: 0.034, z: 0.204, sx: 0.016, sy: 0.016, sz: 0.01, ink: 0 });
    k.add('head', roundedBox(0.085, 0.024, 0.03, 0.01), shade(L.hair || '#141414', 0.8), { x: s * 0.078, y: 0.1, z: 0.176, rz: -s * 0.12, ink: 0 });
    k.add('head', G.ball, mix(skin, '#ff7a6a', 0.3), { x: s * 0.125, y: -0.045, z: 0.148, sx: 0.06, sy: 0.04, sz: 0.03, ink: 0 });
  }
  k.add('head', G.ball, shade(skin, 0.9), { y: -0.025, z: 0.2, sx: 0.075, sy: 0.065, sz: 0.06, ink: 0.5 });
  k.add('head', G.smile, '#5b2a22', { y: -0.075, z: 0.175, sx: 0.05, sy: 0.04, sz: 0.03, rz: Math.PI, ink: 0 });
  if (L.moustache) k.add('head', roundedBox(0.13, 0.035, 0.035, 0.014), L.moustache, { y: -0.065, z: 0.19, ink: 0 });
  // hair and hats
  const hs = L.hairStyle, hat = L.hat && L.hat !== 'none' ? L.hat : null;
  if (!hat || hat === 'cap' || hat === 'bucket' || hat === 'police') {
    if (hs === 'short' || (hat && hs !== 'bald')) k.add('head', G.sphere, L.hair, { y: 0.06, z: -0.03, sx: 0.43, sy: 0.38, sz: 0.41 });
    else if (hs === 'afro') k.add('head', G.sphere, L.hair, { y: 0.1, z: -0.03, sx: 0.56, sy: 0.5, sz: 0.54 });
    else if (hs === 'long') {
      k.add('head', G.sphere, L.hair, { y: 0.06, z: -0.03, sx: 0.44, sy: 0.4, sz: 0.42 });
      k.add('head', roundedBox(0.36, 0.44, 0.1, 0.05), L.hair, { y: -0.12, z: -0.13 });
    }
  }
  if (hat === 'bucket') {
    k.add('head', G.skirt, L.hatColor, { y: 0.21, z: -0.02, sx: 0.5, sy: 0.17, sz: 0.5 });
    k.add('head', G.ball, L.hatColor, { y: 0.29, z: -0.02, sx: 0.29, sy: 0.07, sz: 0.29 });
    k.add('head', G.skirt, L.hatColor, { y: 0.12, z: -0.02, sx: 0.66, sy: 0.05, sz: 0.66, rx: -0.1 });
  } else if (hat === 'cap' || hat === 'police') {
    const c = hat === 'police' ? '#1c2a4a' : L.hatColor;
    k.add('head', G.sphere, c, { y: 0.12, sx: 0.44, sy: 0.27, sz: 0.44 });
    k.add('head', roundedBox(0.34, 0.03, 0.16, 0.014), hat === 'police' ? '#111111' : c, { y: 0.1, z: 0.22, rx: 0.12 });
    if (hat === 'police') k.add('head', roundedBox(0.07, 0.06, 0.02, 0.01), '#d4af37', { y: 0.18, z: 0.205, ink: 0 });
  } else if (hat === 'doek') {
    k.add('head', G.sphere, L.hatColor, { y: 0.13, z: -0.06, sx: 0.46, sy: 0.36, sz: 0.44 });
    k.add('head', G.ball, L.hatColor, { y: 0.3, z: -0.1, sx: 0.32, sy: 0.24, sz: 0.28 });
  } else if (hat === 'beanie') {
    k.add('head', G.sphere, L.hatColor, { y: 0.1, z: -0.02, sx: 0.45, sy: 0.4, sz: 0.44 });
    k.add('head', G.cyl, shade(L.hatColor, 0.8), { y: 0.03, z: -0.02, sx: 0.44, sy: 0.07, sz: 0.43 });
  }

  // arms
  const sleeve = L.sleeves === 'long' ? shirt : skin;
  for (const s of ['L', 'R']) {
    k.add('shoulder' + s, G.ball, shirt, { sx: 0.15, sy: 0.15, sz: 0.15 });
    k.add('shoulder' + s, G.capsule, shirt, { y: -UPPER / 2, sx: 0.13, sy: UPPER / 1.5, sz: 0.13 });
    k.add('elbow' + s, G.ball, sleeve, { sx: 0.12, sy: 0.12, sz: 0.12 });
    k.add('elbow' + s, G.capsule, sleeve, { y: -FORE / 2, sx: 0.11, sy: FORE / 1.6, sz: 0.11 });
    if (L.sleeves === 'long') k.add('elbow' + s, G.cyl, shade(shirt, 0.85), { y: -FORE + 0.02, sx: 0.12, sy: 0.04, sz: 0.12 });
    k.add('wrist' + s, G.ball, skin, { y: -0.05, sx: 0.12, sy: 0.13, sz: 0.1 });
  }
  // legs
  for (const s of ['L', 'R']) {
    k.add('hip' + s, G.capsule, pants, { y: -THIGH / 2, sx: 0.18, sy: THIGH / 1.5, sz: 0.18 });
    k.add('knee' + s, G.ball, pants, { sx: 0.165, sy: 0.165, sz: 0.165 });
    k.add('knee' + s, G.capsule, pants, { y: -SHIN / 2, sx: 0.155, sy: SHIN / 1.5, sz: 0.155 });
    k.add('ankle' + s, roundedBox(0.16, 0.11, 0.28, 0.05), shoe, { y: -0.03, z: 0.05 });
    k.add('ankle' + s, roundedBox(0.165, 0.035, 0.29, 0.015), sole, { y: -0.08, z: 0.05 });
  }
  return k.build();
}

// ---------------------------------------------------------------- the rig
export class HumanRig {
  constructor(look) {
    this.look = look;
    this.group = new THREE.Group();
    const geo = buildGeometry(look);
    const bones = BONES.map(([n, , x, y, z]) => {
      const b = new THREE.Bone();
      b.name = n;
      b.position.set(x, y, z);
      return b;
    });
    BONES.forEach(([, p], i) => p && bones[BI[p]].add(bones[i]));
    const B = Object.fromEntries(BONES.map(([n], i) => [n, bones[i]]));
    this.bones = B;
    const mesh = new THREE.SkinnedMesh(geo, humanMaterial());
    mesh.add(B.root);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 2.2);
    mesh.frustumCulled = true;
    mesh.castShadow = true;
    this.mesh = mesh;
    this.group.add(mesh);
    const ink = new THREE.SkinnedMesh(geo, inkMaterial());
    ink.bind(mesh.skeleton, mesh.bindMatrix);
    ink.boundingSphere = mesh.boundingSphere;
    ink.castShadow = false;
    this.ink = ink;
    this.group.add(ink);
    // compatibility with the old rig (props attach to these)
    this.b = { root: B.root, hips: B.hips, spine: B.torso, head: B.head, armL: B.wristL, armR: B.wristR, legL: B.hipL, legR: B.hipR };
    this.arms = [{ shoulder: B.shoulderR, elbow: B.elbowR, wrist: B.wristR, side: -1 }, { shoulder: B.shoulderL, elbow: B.elbowL, wrist: B.wristL, side: 1 }];
    this.legs = [{ hip: B.hipR, knee: B.kneeR, ankle: B.ankleR, side: -1 }, { hip: B.hipL, knee: B.kneeL, ankle: B.ankleL, side: 1 }];
    // named joints used by moves.js
    const J = (this.J = {});
    const add = (name, obj, prop, axis) => (J[name] = { obj: obj[prop], axis });
    for (const ax of ['x', 'y', 'z']) add('off.p' + ax, B.off, 'position', ax);
    add('off.rx', B.off, 'rotation', 'x');
    add('hips.py', B.hips, 'position', 'y');
    for (const ax of ['y', 'z']) add('hips.r' + ax, B.hips, 'rotation', ax);
    for (const ax of ['x', 'y', 'z']) {
      add('torso.r' + ax, B.torso, 'rotation', ax);
      add('head.r' + ax, B.head, 'rotation', ax);
    }
    for (const s of ['L', 'R']) {
      for (const ax of ['x', 'y', 'z']) add(`arm${s}.s${ax}`, B['shoulder' + s], 'rotation', ax);
      add(`arm${s}.ex`, B['elbow' + s], 'rotation', 'x');
      add(`arm${s}.ez`, B['elbow' + s], 'rotation', 'z');
      add(`arm${s}.wx`, B['wrist' + s], 'rotation', 'x');
      add(`leg${s}.hx`, B['hip' + s], 'rotation', 'x');
      add(`leg${s}.hz`, B['hip' + s], 'rotation', 'z');
      add(`leg${s}.kx`, B['knee' + s], 'rotation', 'x');
      add(`leg${s}.ax`, B['ankle' + s], 'rotation', 'x');
    }
    this.t = Math.random() * 10;
    this.phase = Math.random() * 6;
    this.speed = 0;
    this.stanceW = 0;
    this.muscle = 1;
    this.group.scale.setScalar((look.build || 1) * SCALE);
    this.blob = new THREE.Mesh(BLOB_GEO, blobMaterial());
    this.blob.position.y = 0.03;
    this.blob.renderOrder = 1;
    this.group.add(this.blob);
  }

  setMuscle(m) {
    if (m === this.muscle) return;
    this.muscle = m;
    this.bones.torso.scale.set(m, 1, 1 + (m - 1) * 0.6);
    this.bones.head.scale.set(1 / m, 1, 1 / (1 + (m - 1) * 0.6));
  }

  reset() {
    for (const n in this.bones) {
      const b = this.bones[n];
      b.rotation.set(0, 0, 0);
    }
    this.bones.off.position.set(0, 0, 0);
    this.bones.hips.position.set(0, 0.78, 0);
  }

  set(pose) {
    for (const k in pose) {
      const j = this.J[k];
      if (j) j.obj[j.axis] = pose[k];
    }
  }

  /** Pose of a move at time t (keys interpolated; gaps filled from the guard). */
  sample(m, t) {
    const K = m.keys;
    let i = 0;
    while (i < K.length - 2 && t >= K[i + 1].t) i++;
    const a = K[i], b = K[i + 1];
    let u = clamp((t - a.t) / Math.max(1e-4, b.t - a.t), 0, 1);
    if (b.ease === 'snap') {
      const v = u - 1;
      u = 1 + 2.3 * v * v * v + 1.3 * v * v;
    } else u = u * u * (3 - 2 * u);
    const out = {};
    for (const k in GUARD) {
      const va = a.p && k in a.p ? a.p[k] : GUARD[k];
      const vb = b.p && k in b.p ? b.p[k] : GUARD[k];
      out[k] = va + (vb - va) * u;
    }
    return out;
  }

  /** Blend a full pose over the current one. skipOff: ignore whole-body offsets (the game moves the entity itself). */
  blend(pose, w, skipOff = true) {
    for (const k in pose) {
      if (skipOff && (k === 'off.px' || k === 'off.pz')) continue;
      const j = this.J[k];
      if (!j) continue;
      j.obj[j.axis] += (pose[k] - j.obj[j.axis]) * w;
    }
  }

  /**
   * Pose the skeleton. s: { speed, mode, action, actionT, airborne, carry, liftP, guard }
   * action: punchL (jab) | punchR (cross) | kick | bat | hit | windup, actionT 0..1.
   */
  animate(dt, s) {
    this.t += dt;
    this.reset();
    this.blob.visible = true;
    const B = this.bones, mode = s.mode || 'normal', t = this.t;
    const legsOut = (hx, kx, ax = 0) => this.legs.forEach((l) => { l.hip.rotation.x = hx; l.knee.rotation.x = kx; l.ankle.rotation.x = ax; });

    if (mode === 'down' && s.elapsed !== undefined) {
      // knocked down: fall, lie there dazed, get up for the last moments
      const rem = s.remaining ?? Infinity, fall = MOVES.fall, up = MOVES.getup;
      let pose;
      if (s.elapsed < fall.dur) pose = this.sample(fall, s.elapsed);
      else if (rem < 0.9) pose = this.sample(up, up.dur * (1 - rem / 0.9));
      else pose = this.sample(MOVES.knockdown, LYING_T);
      this.blend(pose, 1);
      if (s.elapsed >= fall.dur && rem >= 0.9) B.head.rotation.z = Math.sin(t * 1.3) * 0.3;
      return;
    }
    if (mode === 'down' || mode === 'sunbathe') {
      // lying on the back
      B.off.rotation.x = -1.5;
      B.off.position.set(0, 0.14, 0.8); // centred on the spot where they fell
      const breathe = Math.sin(t * 1.6) * 0.02;
      B.torso.rotation.x = 0.08 + breathe;
      for (const a of this.arms) {
        if (mode === 'sunbathe') {
          a.shoulder.rotation.set(-2.9, 0, a.side * 0.35);
          a.elbow.rotation.x = -2.0; // hands behind the head
        } else {
          a.shoulder.rotation.set(-2.5, 0, a.side * 0.8);
          a.elbow.rotation.x = -0.4;
        }
      }
      this.legs[1].hip.rotation.x = mode === 'sunbathe' ? -0.7 : -0.35;
      this.legs[1].knee.rotation.x = mode === 'sunbathe' ? 1.3 : 0.5;
      this.legs[0].knee.rotation.x = 0.15;
      for (const l of this.legs) l.ankle.rotation.x = 0.4;
      B.head.rotation.set(0.15, mode === 'down' ? 0.4 : 0, 0);
      return;
    }
    if (mode === 'sit') {
      // sitting on the ground / a low wall, knees up, forearms on the knees
      B.hips.position.y = 0.2;
      legsOut(-1.15, 1.75, 0.1);
      this.legs.forEach((l) => (l.hip.rotation.z = l.side * 0.18));
      for (const a of this.arms) {
        a.shoulder.rotation.set(-0.95, 0, -a.side * 0.12);
        a.elbow.rotation.x = -0.55;
      }
      B.torso.rotation.x = 0.18 + Math.sin(t * 1.4) * 0.012;
      B.head.rotation.set(-0.15, Math.sin(t * 0.27) * 0.4, 0);
      this.blob.visible = true;
      return;
    }
    if (mode === 'swim') {
      this.phase += dt * 4;
      B.off.rotation.x = 1.4;
      B.off.position.set(0, -0.2, -0.75);
      B.head.rotation.x = -1.0;
      for (const a of this.arms) {
        a.shoulder.rotation.x = -(this.phase + (a.side > 0 ? Math.PI : 0));
        a.elbow.rotation.x = -0.35;
      }
      for (const l of this.legs) {
        l.hip.rotation.x = Math.sin(this.phase * 2 + l.side) * 0.3;
        l.knee.rotation.x = 0.25 + Math.max(0, Math.sin(this.phase * 2 + l.side)) * 0.3;
        l.ankle.rotation.x = 0.6;
      }
      this.blob.visible = false;
      return;
    }
    if (mode === 'dance') {
      const p = t * 7.5;
      B.hips.position.y = 0.78 - Math.abs(Math.sin(p)) * 0.08;
      B.hips.rotation.y = Math.sin(p * 0.5) * 0.25;
      B.torso.rotation.y = Math.sin(p * 0.5) * 0.3;
      for (const l of this.legs) {
        l.knee.rotation.x = 0.25 + Math.max(0, Math.sin(p + (l.side > 0 ? 0 : Math.PI))) * 0.6;
        l.hip.rotation.x = -l.knee.rotation.x * 0.5;
        l.ankle.rotation.x = -l.knee.rotation.x * 0.4;
      }
      for (const a of this.arms) {
        a.shoulder.rotation.set(-0.8 + Math.sin(p + (a.side > 0 ? 0 : Math.PI)) * 0.5, 0, a.side * 0.35);
        a.elbow.rotation.x = -1.4 + Math.sin(p) * 0.3;
      }
      B.head.rotation.x = Math.sin(p * 2) * 0.12;
      return;
    }
    if (mode === 'handsup') {
      for (const a of this.arms) {
        a.shoulder.rotation.z = a.side * 2.7;
        a.elbow.rotation.z = a.side * 0.35;
      }
      B.head.rotation.x = 0.1;
      return;
    }
    if (mode === 'cheer') {
      const p = t * 6;
      B.off.position.y = Math.abs(Math.sin(p)) * 0.18;
      for (const l of this.legs) l.knee.rotation.x = (1 - Math.abs(Math.sin(p))) * 0.5;
      for (const a of this.arms) {
        a.shoulder.rotation.z = a.side * (2.5 + Math.sin(p) * 0.3);
        a.elbow.rotation.z = a.side * 0.4;
      }
      B.head.rotation.x = -0.15;
      return;
    }
    if (mode === 'lift') {
      // overhead press: elbows out and bent at the bottom, arms straight at the top
      const p = s.liftP ?? Math.sin(t * 3) * 0.5 + 0.5;
      for (const a of this.arms) {
        a.shoulder.rotation.z = a.side * lerp(1.45, 2.8, p);
        a.elbow.rotation.z = a.side * lerp(1.55, 0.15, p);
      }
      B.hips.position.y = 0.78 - (1 - p) * 0.05;
      legsOut(-0.12 * (1 - p), 0.25 * (1 - p), -0.12 * (1 - p));
      B.head.rotation.x = -0.1;
      return;
    }
    if (mode === 'talk') {
      const R = this.arms[0], Lf = this.arms[1];
      R.shoulder.rotation.set(-0.45 + Math.sin(t * 3.2) * 0.25, 0, -0.1);
      R.elbow.rotation.x = -1.1 + Math.sin(t * 2.3) * 0.35;
      Lf.shoulder.rotation.set(-0.2 + Math.sin(t * 2.1) * 0.1, 0, 0.12);
      Lf.elbow.rotation.x = -0.5;
      B.head.rotation.set(Math.sin(t * 4.1) * 0.05, Math.sin(t * 1.3) * 0.18, 0);
      B.torso.rotation.y = Math.sin(t * 1.3) * 0.06;
      this.idleLegs(t, 1);
      return;
    }
    if (mode === 'wave') {
      const R = this.arms[0];
      R.shoulder.rotation.set(-0.15, 0, -1.35);
      R.elbow.rotation.z = -(1.25 + Math.sin(t * 8) * 0.4);
      this.arms[1].elbow.rotation.x = -0.2;
      this.idleLegs(t, 1);
      return;
    }
    if (mode === 'poster') {
      for (const a of this.arms) {
        a.shoulder.rotation.set(-2.0 + Math.sin(t * 9 + a.side) * 0.15, 0, -a.side * 0.15);
        a.elbow.rotation.x = -0.45;
      }
      B.head.rotation.x = -0.25;
      return;
    }

    // ---------------------------------------------------------------- locomotion
    this.speed += ((s.speed || 0) - this.speed) * Math.min(1, dt * 6);
    const v = this.speed;
    const k = Math.min(1, v / 1.2);
    const run = clamp((v - 2) / 1.5, 0, 1);
    const stride = 1.4 + run * 1.0 + Math.max(0, v - 3.6) * 0.25;
    this.phase += dt * (k > 0.02 ? (Math.PI * 2 * v) / stride : 0);
    const p = this.phase;
    if (s.airborne) {
      // tuck: knees up, arms out for balance
      this.legs[1].hip.rotation.x = -0.75;
      this.legs[1].knee.rotation.x = 1.1;
      this.legs[0].hip.rotation.x = -0.15;
      this.legs[0].knee.rotation.x = 0.7;
      for (const l of this.legs) l.ankle.rotation.x = 0.3;
      for (const a of this.arms) {
        a.shoulder.rotation.set(-0.4, 0, a.side * 0.75);
        a.elbow.rotation.x = -0.6;
      }
      B.torso.rotation.x = 0.1;
    } else {
      const thighAmp = (0.5 + run * 0.35) * k;
      for (const l of this.legs) {
        const ph = p + (l.side > 0 ? Math.PI : 0);
        const swing = Math.sin(ph), passing = Math.max(0, Math.cos(ph));
        const thigh = -swing * thighAmp - run * 0.15;
        const knee = (0.08 + Math.pow(passing, 1.5) * (0.95 + run * 0.7)) * k + (1 - k) * 0.04;
        l.hip.rotation.x = thigh;
        l.knee.rotation.x = knee;
        l.ankle.rotation.x = -(thigh + knee) * 0.75 + (swing < -0.6 ? (swing + 0.6) * -0.9 : 0) * k - Math.max(0, swing - 0.7) * 0.6 * k;
        l.hip.rotation.z = l.side * 0.03;
      }
      const shift = Math.sin(t * 0.35) * (1 - k);
      this.legs[1].knee.rotation.x += Math.max(0, shift) * 0.18;
      this.legs[0].knee.rotation.x += Math.max(0, -shift) * 0.18;
      const bob = Math.abs(Math.cos(p)) * (0.045 + run * 0.06) * k;
      B.hips.position.y = 0.78 - 0.035 * k + bob - run * 0.03 + Math.sin(t * 0.9) * 0.006 * (1 - k);
      B.hips.position.x = Math.sin(p) * 0.03 * k + shift * 0.025;
      B.hips.rotation.y = -Math.sin(p) * 0.14 * k;
      B.hips.rotation.z = Math.sin(p) * 0.04 * k - shift * 0.04;
      B.torso.rotation.y = Math.sin(p) * (0.26 + run * 0.1) * k;
      B.torso.rotation.x = (0.06 + run * 0.22) * k;
      B.torso.rotation.z = -Math.sin(p) * 0.03 * k + shift * 0.05;
      B.head.rotation.y = -B.torso.rotation.y * 0.8 - B.hips.rotation.y + Math.sin(t * 0.21) * 0.3 * (1 - k);
      B.head.rotation.x = -B.torso.rotation.x * 0.7 + Math.cos(p * 2) * 0.02 * k;
      B.head.rotation.z = -B.torso.rotation.z;
      const armAmp = (0.45 + run * 0.4) * k;
      for (const a of this.arms) {
        const fwd = Math.sin(p + (a.side > 0 ? 0 : Math.PI));
        a.shoulder.rotation.x = -fwd * armAmp;
        a.shoulder.rotation.z = a.side * (0.1 + run * 0.08) + Math.sin(t * 0.9 + a.side) * 0.01 * (1 - k);
        a.elbow.rotation.x = -(0.18 + 0.25 * k + Math.max(0, fwd) * 0.45 * k + run * 0.9);
        a.wrist.rotation.x = -0.1 - fwd * 0.12 * k;
      }
    }
    if (s.carry) {
      for (const a of this.arms) {
        a.shoulder.rotation.set(-0.95, 0, -a.side * 0.15);
        a.elbow.rotation.x = -0.75;
      }
    }

    // fighting stance when there's trouble around (upper body; legs keep walking while moving)
    this.stanceW += ((s.guard ? 1 : 0) - this.stanceW) * Math.min(1, dt * 7);
    if (this.stanceW > 0.01 && !s.airborne) {
      const g = { ...GUARD, 'hips.py': GUARD['hips.py'] + Math.sin(t * 7.5) * 0.012, 'armL.sx': GUARD['armL.sx'] + Math.sin(t * 3.7) * 0.05, 'armR.sx': GUARD['armR.sx'] + Math.sin(t * 3.7 + 1.5) * 0.05 };
      const legKeys = {}, upper = {};
      for (const key in g) (key.startsWith('leg') || key === 'hips.ry' ? legKeys : upper)[key] = g[key];
      this.blend(upper, this.stanceW);
      this.blend(legKeys, this.stanceW * (1 - k));
    }

    // actions layered on top
    const a = s.action;
    if (!a) return;
    const at = Number.isFinite(s.actionT) ? clamp(s.actionT, 0, 1) : 0;
    const name = a === 'punchL' ? 'jab' : a === 'punchR' ? 'cross' : a;
    if (name === 'windup') {
      // cocking the rear hand before a punch (enemies)
      const pose = this.sample(MOVES.cross, 0.07);
      this.blend(pose, Math.min(1, at * 2));
      return;
    }
    const m = MOVES[name];
    if (!m) return;
    const mt = at * m.dur;
    const w = Math.min(1, mt / 0.05) * (this.stanceW > 0.5 ? 1 : Math.min(1, (m.dur - mt) / 0.1));
    this.blend(this.sample(m, mt), w);
  }

  idleLegs(t, w) {
    const shift = Math.sin(t * 0.35) * w;
    this.legs[1].knee.rotation.x = 0.04 + Math.max(0, shift) * 0.18;
    this.legs[0].knee.rotation.x = 0.04 + Math.max(0, -shift) * 0.18;
    this.bones.hips.position.x = shift * 0.025;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.skeleton.dispose();
  }
}

const BLOB_GEO = (() => {
  const g = new THREE.CircleGeometry(0.42, 12);
  g.rotateX(-Math.PI / 2);
  return g;
})();
let blobMat = null;
export function blobMaterial() {
  if (!blobMat) blobMat = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false });
  return blobMat;
}

// Named characters
export const LOOKS = {
  sizwe: { skin: '#5a3825', shirt: '#f2c230', stripe: '#1e7a3c', pants: '#2b3346', shoes: '#f7f4ee', hair: '#141414', hairStyle: 'short', hat: 'bucket', hatColor: '#1e7a3c', sleeves: 'short', build: 1.0 },
  kyle: { skin: '#e2b896', shirt: '#d63a2f', pants: '#f1c40f', shoes: '#c99470', hair: '#c9a46a', hairStyle: 'short', hat: 'none', sleeves: 'short', build: 1.02 },
  zanele: { skin: '#6b4129', shirt: '#e86fa4', pants: '#1d1d1f', shoes: '#ffffff', hair: '#141414', hairStyle: 'afro', hat: 'none', sleeves: 'short', build: 0.98 },
  noma: { skin: '#4f2f1d', shirt: '#1e7a3c', pants: '#1e7a3c', shoes: '#1b1b1b', hair: '#141414', hairStyle: 'short', hat: 'doek', hatColor: '#f2c230', sleeves: 'long', dress: true, build: 1.04 },
  vusi: { skin: '#3a2316', shirt: '#ffffff', vest: '#c0392b', pants: '#2b2f3a', shoes: '#6b4f36', hair: '#141414', hairStyle: 'bald', hat: 'cap', hatColor: '#c0392b', sleeves: 'short', build: 1.1, belly: 1.12 },
  rashieda: { skin: '#a8724c', shirt: '#8e44ad', pants: '#8e44ad', shoes: '#6b4f36', hair: '#141414', hairStyle: 'long', hat: 'doek', hatColor: '#f7f1e3', sleeves: 'long', dress: true, build: 0.96 },
  pieter: { skin: '#f0d2b6', shirt: '#cfd8dc', tie: '#2f6fd6', pants: '#3b3f46', shoes: '#1b1b1b', hair: '#5a4630', hairStyle: 'short', hat: 'none', sleeves: 'long', build: 0.97 },
  victor: { skin: '#e2b896', shirt: '#2a2d33', tie: '#c0392b', pants: '#2a2d33', shoes: '#111111', hair: '#b0a090', hairStyle: 'short', hat: 'none', sleeves: 'long', build: 1.05 },
  gang: { skin: '#6b4129', shirt: '#1d1d1f', bandana: '#ff7f3f', pants: '#2b2f3a', shoes: '#1b1b1b', hair: '#141414', hairStyle: 'short', hat: 'beanie', hatColor: '#1d1d1f', sleeves: 'long', build: 1.04 },
  guard: { skin: '#8a5636', shirt: '#3a3f46', vest: '#13202b', pants: '#1f1f22', shoes: '#111111', hair: '#141414', hairStyle: 'bald', hat: 'none', sleeves: 'long', belt: '#111', build: 1.1 },
  police: { skin: '#6b4129', shirt: '#2a3f6b', pants: '#1c2a4a', shoes: '#111111', hair: '#141414', hairStyle: 'short', hat: 'police', sleeves: 'short', belt: '#111', build: 1.03 },
  marshal: { skin: '#4f2f1d', shirt: '#f1c40f', vest: '#2e9e5b', pants: '#2b2f3a', shoes: '#1b1b1b', hair: '#141414', hairStyle: 'short', hat: 'cap', hatColor: '#2e9e5b', sleeves: 'short', build: 1.06 },
  jade: { skin: '#c99470', shirt: '#3fc1c9', pants: '#e86fa4', shoes: '#f2f2f2', hair: '#8e44ad', hairStyle: 'long', hat: 'none', sleeves: 'short', build: 0.95 },
  bheki: { skin: '#3a2316', shirt: '#a0522d', pants: '#6b5b45', shoes: '#6b4f36', hair: '#b0a090', hairStyle: 'short', hat: 'cap', hatColor: '#2f4a3a', sleeves: 'short', build: 1.08, moustache: '#d8d0c0' },
};
