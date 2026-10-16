// Blocky low-poly people built as ONE skinned mesh each (one draw call per person)
// with procedural animation driven by bone rotations.

import * as THREE from 'three';
import { clamp, lerp } from '../core/util.js';

export const SKIN = ['#3a2316', '#4f2f1d', '#6b4129', '#8a5636', '#a8724c', '#c99470', '#e2b896', '#f0d2b6'];
export const SHIRTS = ['#d64545', '#2f6fd6', '#f2c230', '#2e9e5b', '#ffffff', '#1d1d1f', '#8e44ad', '#ff7f3f', '#3fc1c9', '#e86fa4', '#6b7a8f', '#a0522d'];
export const PANTS = ['#2b2f3a', '#3b4f7a', '#1f1f22', '#6b5b45', '#4a4f55', '#2f4a3a', '#c9b48f'];
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

const BOX = new THREE.BoxGeometry(1, 1, 1);
const _c = new THREE.Color();
const B = { root: 0, hips: 1, spine: 2, head: 3, armL: 4, armR: 5, legL: 6, legR: 7 };

function buildGeometry(L) {
  const pos = [], nor = [], col = [], si = [], sw = [], idx = [];
  let count = 0;
  const P = BOX.attributes.position, N = BOX.attributes.normal;
  const box = (bone, cx, cy, cz, sx, sy, sz, color) => {
    _c.set(color);
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i) * sx + cx, P.getY(i) * sy + cy, P.getZ(i) * sz + cz);
      nor.push(N.getX(i), N.getY(i), N.getZ(i));
      col.push(_c.r, _c.g, _c.b);
      si.push(bone, 0, 0, 0);
      sw.push(1, 0, 0, 0);
    }
    for (let i = 0; i < BOX.index.count; i++) idx.push(count + BOX.index.getX(i));
    count += P.count;
  };
  const skin = L.skin;
  // legs
  for (const [bone, x] of [[B.legL, 0.12], [B.legR, -0.12]]) {
    box(bone, x, 0.55, 0, 0.19, 0.8, 0.21, L.dress ? skin : L.pants);
    box(bone, x, 0.065, 0.04, 0.2, 0.13, 0.3, L.shoes || '#222');
  }
  box(B.hips, 0, 0.99, 0, 0.44, 0.16, 0.24, L.dress ? L.shirt : L.pants);
  if (L.dress) box(B.hips, 0, 0.78, 0, 0.5, 0.4, 0.3, L.shirt);
  // torso
  box(B.spine, 0, 1.28, 0, 0.48, 0.58, 0.26, L.shirt);
  if (L.stripe) box(B.spine, 0, 1.3, 0.132, 0.49, 0.1, 0.01, L.stripe);
  if (L.tie) box(B.spine, 0, 1.36, 0.134, 0.07, 0.34, 0.01, L.tie);
  if (L.vest) {
    box(B.spine, 0.16, 1.3, 0.133, 0.14, 0.5, 0.01, L.vest);
    box(B.spine, -0.16, 1.3, 0.133, 0.14, 0.5, 0.01, L.vest);
  }
  if (L.bandana) box(B.spine, 0, 1.55, 0.02, 0.3, 0.07, 0.29, L.bandana);
  if (L.belt) box(B.hips, 0, 1.06, 0, 0.46, 0.05, 0.26, L.belt);
  // head
  box(B.head, 0, 1.6, 0, 0.13, 0.08, 0.13, skin);
  box(B.head, 0, 1.77, 0, 0.28, 0.3, 0.28, skin);
  box(B.head, 0.065, 1.795, 0.142, 0.05, 0.04, 0.012, '#17110c');
  box(B.head, -0.065, 1.795, 0.142, 0.05, 0.04, 0.012, '#17110c');
  box(B.head, 0, 1.74, 0.15, 0.05, 0.07, 0.03, skin);
  box(B.head, 0, 1.69, 0.142, 0.09, 0.02, 0.01, '#5b2a22');
  const hs = L.hairStyle;
  if (L.hat === 'none' || !L.hat) {
    if (hs === 'short') {
      box(B.head, 0, 1.935, 0, 0.3, 0.07, 0.3, L.hair);
      box(B.head, 0, 1.84, -0.13, 0.3, 0.16, 0.05, L.hair);
    } else if (hs === 'afro') {
      box(B.head, 0, 1.96, -0.01, 0.36, 0.2, 0.36, L.hair);
    } else if (hs === 'long') {
      box(B.head, 0, 1.935, 0, 0.3, 0.07, 0.3, L.hair);
      box(B.head, 0, 1.72, -0.14, 0.31, 0.42, 0.06, L.hair);
    }
  } else if (L.hat === 'bucket') {
    box(B.head, 0, 1.97, 0, 0.32, 0.12, 0.32, L.hatColor);
    box(B.head, 0, 1.915, 0, 0.46, 0.03, 0.46, L.hatColor);
  } else if (L.hat === 'cap') {
    box(B.head, 0, 1.96, 0, 0.3, 0.1, 0.3, L.hatColor);
    box(B.head, 0, 1.92, 0.2, 0.26, 0.03, 0.17, L.hatColor);
  } else if (L.hat === 'doek') {
    box(B.head, 0, 1.97, -0.01, 0.34, 0.2, 0.34, L.hatColor);
    box(B.head, 0, 2.08, -0.05, 0.16, 0.1, 0.14, L.hatColor);
  } else if (L.hat === 'beanie') {
    box(B.head, 0, 1.95, 0, 0.31, 0.14, 0.31, L.hatColor);
  } else if (L.hat === 'police') {
    box(B.head, 0, 1.96, 0, 0.31, 0.1, 0.31, '#1c2a4a');
    box(B.head, 0, 1.92, 0.19, 0.28, 0.03, 0.14, '#111');
    box(B.head, 0, 1.97, 0.157, 0.08, 0.06, 0.01, '#d4af37');
  }
  // arms
  const forearm = L.sleeves === 'long' ? L.shirt : skin;
  for (const [bone, x] of [[B.armL, 0.31], [B.armR, -0.31]]) {
    box(bone, x, 1.38, 0, 0.14, 0.3, 0.15, L.shirt);
    box(bone, x, 1.07, 0, 0.12, 0.32, 0.13, forearm);
    box(bone, x, 0.86, 0, 0.12, 0.12, 0.13, skin);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  return g;
}

let sharedMat = null;
export function humanMaterial() {
  if (!sharedMat) sharedMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return sharedMat;
}

export class HumanRig {
  constructor(look) {
    this.look = look;
    this.group = new THREE.Group();
    const geo = buildGeometry(look);
    const bones = [];
    const mk = (name, x, y, z, parent) => {
      const b = new THREE.Bone();
      b.name = name;
      b.position.set(x, y, z);
      if (parent) parent.add(b);
      bones.push(b);
      return b;
    };
    const root = mk('root', 0, 0, 0, null);
    const hips = mk('hips', 0, 0.95, 0, root);
    const spine = mk('spine', 0, 0.05, 0, hips);
    const head = mk('head', 0, 0.6, 0, spine);
    const armL = mk('armL', 0.31, 0.52, 0, spine);
    const armR = mk('armR', -0.31, 0.52, 0, spine);
    const legL = mk('legL', 0.12, 0, 0, hips);
    const legR = mk('legR', -0.12, 0, 0, hips);
    this.b = { root, hips, spine, head, armL, armR, legL, legR };
    const mesh = new THREE.SkinnedMesh(geo, humanMaterial());
    mesh.add(root);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 2.2);
    mesh.castShadow = true;
    this.mesh = mesh;
    this.group.add(mesh);
    this.phase = Math.random() * 6;
    this.t = 0;
    this.muscle = 1;
    const s = look.build || 1;
    this.group.scale.setScalar(s);
    // blob shadow
    this.blob = new THREE.Mesh(BLOB_GEO, blobMaterial());
    this.blob.position.y = 0.03;
    this.blob.renderOrder = 1;
    this.group.add(this.blob);
  }

  setMuscle(m) {
    this.muscle = m;
    this.b.spine.scale.set(m, 1, 1 + (m - 1) * 0.6);
    this.b.head.scale.set(1 / m, 1, 1 / (1 + (m - 1) * 0.6));
  }

  /** Pose the skeleton. s: {speed, mode, action, actionT, dt, swim, carry} */
  animate(dt, s) {
    const b = this.b;
    this.t += dt;
    b.root.position.set(0, 0, 0);
    b.root.rotation.set(0, 0, 0);
    b.hips.position.set(0, 0.95, 0);
    for (const k of ['hips', 'spine', 'head', 'armL', 'armR', 'legL', 'legR']) b[k].rotation.set(0, 0, 0);
    this.blob.visible = true;
    const mode = s.mode || 'normal';

    if (mode === 'down') {
      b.root.rotation.x = -Math.PI / 2;
      b.root.position.y = 0.14;
      b.armL.rotation.z = 0.5;
      b.armR.rotation.z = -0.5;
      b.legL.rotation.z = 0.12;
      b.legR.rotation.z = -0.12;
      b.head.rotation.y = 0.4;
      return;
    }
    if (mode === 'sunbathe') {
      b.root.rotation.x = -Math.PI / 2;
      b.root.position.y = 0.16;
      b.armL.rotation.z = 2.6;
      b.armR.rotation.z = -2.6;
      return;
    }
    if (mode === 'sit') {
      b.root.position.y = -0.48;
      b.legL.rotation.x = -1.45;
      b.legR.rotation.x = -1.45;
      b.armL.rotation.x = -0.3;
      b.armR.rotation.x = -0.3;
      b.spine.rotation.x = -0.1;
      return;
    }
    if (mode === 'swim') {
      this.phase += dt * 4;
      b.root.position.y = -0.95;
      b.spine.rotation.x = 0.0;
      b.hips.rotation.x = 1.25;
      b.head.rotation.x = -1.0;
      b.armL.rotation.x = this.phase;
      b.armR.rotation.x = this.phase + Math.PI;
      b.legL.rotation.x = Math.sin(this.phase * 2) * 0.3;
      b.legR.rotation.x = -Math.sin(this.phase * 2) * 0.3;
      this.blob.visible = false;
      return;
    }
    if (mode === 'dance') {
      const t = this.t * 7.5;
      b.hips.position.y = 0.95 - Math.abs(Math.sin(t)) * 0.08;
      b.spine.rotation.y = Math.sin(t * 0.5) * 0.35;
      b.armL.rotation.x = -0.9 + Math.sin(t) * 0.5;
      b.armR.rotation.x = -0.9 - Math.sin(t) * 0.5;
      b.armL.rotation.z = 0.4;
      b.armR.rotation.z = -0.4;
      b.legL.rotation.x = Math.max(0, Math.sin(t)) * -0.5;
      b.legR.rotation.x = Math.max(0, -Math.sin(t)) * -0.5;
      b.head.rotation.x = Math.sin(t * 2) * 0.12;
      return;
    }
    if (mode === 'handsup') {
      b.armL.rotation.z = 2.85;
      b.armR.rotation.z = -2.85;
      return;
    }
    if (mode === 'cheer') {
      const t = this.t * 6;
      b.root.position.y = Math.abs(Math.sin(t)) * 0.2;
      b.armL.rotation.z = 2.6 + Math.sin(t) * 0.3;
      b.armR.rotation.z = -2.6 - Math.sin(t) * 0.3;
      return;
    }
    if (mode === 'lift') {
      const p = s.liftP ?? (Math.sin(this.t * 3) * 0.5 + 0.5);
      b.armL.rotation.z = lerp(1.6, 2.95, p);
      b.armR.rotation.z = -lerp(1.6, 2.95, p);
      b.armL.rotation.x = -0.2;
      b.armR.rotation.x = -0.2;
      b.hips.position.y = 0.95 - (1 - p) * 0.05;
      return;
    }
    if (mode === 'talk') {
      b.armR.rotation.x = -0.5 + Math.sin(this.t * 3.2) * 0.25;
      b.armR.rotation.z = -0.15;
      b.armL.rotation.x = -0.2 + Math.sin(this.t * 2.1) * 0.1;
      b.head.rotation.y = Math.sin(this.t * 1.3) * 0.15;
      b.head.rotation.x = Math.sin(this.t * 4.1) * 0.05;
      return;
    }
    if (mode === 'wave') {
      b.armR.rotation.z = -2.6 + Math.sin(this.t * 8) * 0.35;
      return;
    }
    if (mode === 'poster') {
      b.armL.rotation.x = -1.9 + Math.sin(this.t * 9) * 0.15;
      b.armR.rotation.x = -1.9 - Math.sin(this.t * 9) * 0.15;
      return;
    }

    // locomotion
    const speed = s.speed || 0;
    if (s.airborne) {
      b.legL.rotation.x = -0.6;
      b.legR.rotation.x = 0.3;
      b.armL.rotation.z = 0.6;
      b.armR.rotation.z = -0.6;
    } else if (speed > 0.3) {
      const run = clamp((speed - 4) / 4, 0, 1);
      this.phase += dt * (speed * 1.9 + 1);
      const amp = lerp(0.55, 0.95, run) * clamp(speed / 2.5, 0.3, 1);
      const sw = Math.sin(this.phase) * amp;
      b.legL.rotation.x = sw;
      b.legR.rotation.x = -sw;
      b.armL.rotation.x = -sw * 0.85;
      b.armR.rotation.x = sw * 0.85;
      b.armL.rotation.z = 0.06 + run * 0.1;
      b.armR.rotation.z = -0.06 - run * 0.1;
      b.hips.position.y = 0.95 + Math.abs(Math.cos(this.phase)) * 0.05 * amp;
      b.spine.rotation.x = 0.05 + run * 0.18;
    } else {
      const br = Math.sin(this.t * 2) * 0.02;
      b.armL.rotation.z = 0.08 + br;
      b.armR.rotation.z = -0.08 - br;
      b.spine.rotation.x = br * 0.5;
    }
    if (s.carry) {
      b.armL.rotation.x = -1.1;
      b.armR.rotation.x = -1.1;
      b.armL.rotation.z = -0.15;
      b.armR.rotation.z = 0.15;
    }

    // actions layered on top
    const a = s.action;
    const t = Number.isFinite(s.actionT) ? clamp(s.actionT, 0, 1) : 0;
    if (a === 'punchR' || a === 'punchL' || a === 'bat') {
      const k = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
      const arm = a === 'punchL' ? b.armL : b.armR;
      if (a === 'bat') {
        b.armR.rotation.x = lerp(-2.6, -0.6, clamp(t * 1.6, 0, 1));
        b.armL.rotation.x = b.armR.rotation.x;
        b.spine.rotation.y = lerp(0.6, -0.6, clamp(t * 1.6, 0, 1));
      } else {
        arm.rotation.x = -1.55 * k;
        arm.rotation.z = (a === 'punchL' ? -0.25 : 0.25) * k;
        b.spine.rotation.y = (a === 'punchL' ? -0.35 : 0.35) * k;
      }
    } else if (a === 'kick') {
      const k = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
      b.legR.rotation.x = -1.4 * k;
      b.spine.rotation.x = -0.25 * k;
      b.armL.rotation.z = 0.6 * k;
      b.armR.rotation.z = -0.6 * k;
    } else if (a === 'hit') {
      const k = 1 - t;
      b.spine.rotation.x = -0.4 * k;
      b.head.rotation.x = -0.35 * k;
      b.armL.rotation.z = 0.5 * k;
      b.armR.rotation.z = -0.5 * k;
    } else if (a === 'windup') {
      b.armR.rotation.x = 0.6 * t;
      b.spine.rotation.y = -0.3 * t;
    }
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
  sizwe: { skin: '#5a3825', shirt: '#f2c230', stripe: '#1e7a3c', pants: '#2b3346', shoes: '#f2f2f2', hair: '#141414', hairStyle: 'short', hat: 'bucket', hatColor: '#1e7a3c', sleeves: 'short', build: 1.0 },
  kyle: { skin: '#e2b896', shirt: '#d63a2f', pants: '#f1c40f', shoes: '#c99470', hair: '#c9a46a', hairStyle: 'short', hat: 'none', sleeves: 'short', build: 1.02 },
  zanele: { skin: '#6b4129', shirt: '#e86fa4', pants: '#1d1d1f', shoes: '#ffffff', hair: '#141414', hairStyle: 'afro', hat: 'none', sleeves: 'short', build: 0.98 },
  noma: { skin: '#4f2f1d', shirt: '#1e7a3c', pants: '#1e7a3c', shoes: '#1b1b1b', hair: '#141414', hairStyle: 'short', hat: 'doek', hatColor: '#f2c230', sleeves: 'long', dress: true, build: 1.04 },
  vusi: { skin: '#3a2316', shirt: '#ffffff', vest: '#c0392b', pants: '#2b2f3a', shoes: '#6b4f36', hair: '#141414', hairStyle: 'bald', hat: 'cap', hatColor: '#c0392b', sleeves: 'short', build: 1.1 },
  rashieda: { skin: '#a8724c', shirt: '#8e44ad', pants: '#8e44ad', shoes: '#6b4f36', hair: '#141414', hairStyle: 'long', hat: 'doek', hatColor: '#f7f1e3', sleeves: 'long', dress: true, build: 0.96 },
  pieter: { skin: '#f0d2b6', shirt: '#cfd8dc', tie: '#2f6fd6', pants: '#3b3f46', shoes: '#1b1b1b', hair: '#5a4630', hairStyle: 'short', hat: 'none', sleeves: 'long', build: 0.97 },
  victor: { skin: '#e2b896', shirt: '#2a2d33', tie: '#c0392b', pants: '#2a2d33', shoes: '#111111', hair: '#b0a090', hairStyle: 'short', hat: 'none', sleeves: 'long', build: 1.05 },
  gang: { skin: '#6b4129', shirt: '#1d1d1f', bandana: '#ff7f3f', pants: '#2b2f3a', shoes: '#1b1b1b', hair: '#141414', hairStyle: 'short', hat: 'beanie', hatColor: '#1d1d1f', sleeves: 'long', build: 1.04 },
  guard: { skin: '#8a5636', shirt: '#3a3f46', vest: '#13202b', pants: '#1f1f22', shoes: '#111111', hair: '#141414', hairStyle: 'bald', hat: 'none', sleeves: 'long', belt: '#111', build: 1.1 },
  police: { skin: '#6b4129', shirt: '#2a3f6b', pants: '#1c2a4a', shoes: '#111111', hair: '#141414', hairStyle: 'short', hat: 'police', sleeves: 'short', belt: '#111', build: 1.03 },
  marshal: { skin: '#4f2f1d', shirt: '#f1c40f', vest: '#2e9e5b', pants: '#2b2f3a', shoes: '#1b1b1b', hair: '#141414', hairStyle: 'short', hat: 'cap', hatColor: '#2e9e5b', sleeves: 'short', build: 1.06 },
  jade: { skin: '#c99470', shirt: '#3fc1c9', pants: '#e86fa4', shoes: '#f2f2f2', hair: '#8e44ad', hairStyle: 'long', hat: 'none', sleeves: 'short', build: 0.95 },
  bheki: { skin: '#3a2316', shirt: '#a0522d', pants: '#6b5b45', shoes: '#6b4f36', hair: '#b0a090', hairStyle: 'short', hat: 'cap', hatColor: '#2f4a3a', sleeves: 'short', build: 1.08 },
};
