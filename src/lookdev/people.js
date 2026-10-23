// Look-dev characters: chunky cartoon proportions (big head, rounded limbs), painted faces,
// real outfits. Each rigid body part is one merged, vertex-coloured mesh with an ink outline,
// so a person is ~8 draw calls and animates by rotating pivots (no skinning).

import * as THREE from 'three';
import { toon, outlineMaterial, inked, roundedBox, SHAPES, Merger, faceTexture, RAMP } from './toon.js';

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
    this.hips = new THREE.Group();
    this.hips.position.y = 0.78;
    this.root.add(this.hips);
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

    // arms: pivot at the shoulder, sleeve + forearm + hand
    this.arms = [-1, 1].map((s) => {
      const g = new THREE.Group();
      g.position.set(s * (tw / 2 + 0.05), th - 0.04, 0);
      const m = new Merger();
      const sleeve = L.sleeves === 'long' ? 0.42 : 0.2;
      m.add(SHAPES.capsule, L.shirt, { y: -sleeve / 2, sx: 0.13, sy: sleeve / 1.2, sz: 0.13 });
      if (sleeve < 0.4) m.add(SHAPES.capsule, L.skin, { y: -0.3, sx: 0.1, sy: 0.18, sz: 0.1 });
      m.add(SHAPES.sphere, L.skin, { y: -0.5, sx: 0.13, sy: 0.13, sz: 0.13 });
      g.add(inked(m.build(), MAT, INK));
      g.rotation.z = s * 0.08;
      this.torso.add(g);
      return g;
    });

    // legs: pivot at the hip, trouser leg + takkie
    this.legs = [-1, 1].map((s) => {
      const g = new THREE.Group();
      g.position.set(s * 0.11 * b, 0.02, 0);
      const m = new Merger();
      m.add(SHAPES.capsule, L.pants, { y: -0.37, sx: 0.17, sy: 0.5, sz: 0.17 });
      m.add(roundedBox(0.16, 0.11, 0.28, 0.05), L.shoe, { y: -0.72, z: 0.05 });
      m.add(roundedBox(0.165, 0.035, 0.29, 0.015), L.sole, { y: -0.77, z: 0.05 });
      g.add(inked(m.build(), MAT, INK));
      this.hips.add(g);
      return g;
    });
  }

  /** Walk / idle cycle. speed in m/s; wave makes the right arm wave. */
  update(dt, { speed = 0, wave = false } = {}) {
    this.speed += (speed - this.speed) * Math.min(1, dt * 8);
    const k = Math.min(1, this.speed / 1.6);
    this.t += dt * (2.2 + this.speed * 3.2);
    const s = Math.sin(this.t), c = Math.cos(this.t);
    this.legs[0].rotation.x = s * 0.6 * k;
    this.legs[1].rotation.x = -s * 0.6 * k;
    this.arms[0].rotation.x = -s * 0.55 * k;
    this.arms[1].rotation.x = s * 0.55 * k;
    this.hips.position.y = 0.78 + Math.abs(c) * 0.05 * k + Math.sin(this.t * 0.5) * 0.008 * (1 - k);
    this.torso.rotation.y = s * 0.12 * k;
    this.torso.rotation.x = 0.05 * k;
    this.head.rotation.y = -s * 0.08 * k + Math.sin(this.t * 0.31) * 0.15 * (1 - k);
    // breathing when standing
    this.torso.scale.set(1, 1 + Math.sin(this.t * 0.9) * 0.012 * (1 - k), 1);
    if (wave) {
      this.arms[1].rotation.z = 2.3 + Math.sin(this.t * 2.6) * 0.35; // arm out to the side, waving
      this.arms[1].rotation.x = -0.25;
    } else this.arms[1].rotation.z += (0.08 - this.arms[1].rotation.z) * Math.min(1, dt * 6);
  }
}

function shade(hex, f) {
  return new THREE.Color(hex).multiplyScalar(f);
}
