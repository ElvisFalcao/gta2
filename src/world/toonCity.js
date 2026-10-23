// Sunny-toon city kit: cartoon facades (with a wall mask so trims and window frames stay white
// while the wall takes the building colour), a wall material that understands that mask,
// Cape Dutch gables, and ink-outline shells for the buildings.

import * as THREE from 'three';
import { RAMP_SOFT } from '../core/toon.js';
import { RNG } from '../core/util.js';

// ---------------------------------------------------------------- facades
const FACADES = {
  office: { bay: 4, floor: 3.6 },
  apartment: { bay: 4, floor: 3.2 },
  house: { bay: 3.4, floor: 3.4 },
  villa: { bay: 5, floor: 3.4 },
  industrial: { bay: 6, floor: 4.5 },
  township: { bay: 3, floor: 3.2 },
};

const S = 256; // tile = 2 bays x 2 floors
function canvas() {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  return [c, c.getContext('2d')];
}
const tex = (c, srgb = true) => {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
const TRIM = '#fbf6ea', GLASS = '#22405e', GLASS_HI = '#5f86a8', INK = '#2a1d17';

/**
 * map: what each texel looks like; mask: white = take the building colour, black = keep the map colour;
 * emissive: lit windows at night.
 */
export function makeToonFacade(style, seed = 7) {
  const [c, g] = canvas(), [cm, m] = canvas(), [ce, e] = canvas();
  const rng = new RNG(seed + style.length * 31);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, S, S);
  m.fillStyle = '#ffffff';
  m.fillRect(0, 0, S, S);
  e.fillStyle = '#000000';
  e.fillRect(0, 0, S, S);
  const cw = S / 2, ch = S / 2;
  // paint helpers: `keep` areas are drawn into the map and blacked out of the mask
  const keep = (fill, x, y, w, h, r = 0) => {
    g.fillStyle = fill;
    m.fillStyle = '#000000';
    for (const ctx of [g, m]) {
      ctx.beginPath();
      if (r) ctx.roundRect(x, y, w, h, r);
      else ctx.rect(x, y, w, h);
      ctx.fill();
    }
  };
  const shadeWall = (fill, x, y, w, h) => {
    g.fillStyle = fill; // tinted by the building colour (mask stays white)
    g.fillRect(x, y, w, h);
  };
  const windowAt = (x, y, w, h, { frame = 7, cross = true, shutters = false, sill = true } = {}) => {
    if (shutters) {
      shadeWall('#d8d2c8', x - w * 0.42, y, w * 0.36, h);
      shadeWall('#d8d2c8', x + w * 1.06, y, w * 0.36, h);
    }
    keep(INK, x - frame - 2, y - frame - 2, w + frame * 2 + 4, h + frame * 2 + 4, 6);
    keep(TRIM, x - frame, y - frame, w + frame * 2, h + frame * 2, 5);
    keep(GLASS, x, y, w, h, 3);
    keep(GLASS_HI, x + w * 0.12, y + h * 0.1, w * 0.18, h * 0.55, 3);
    if (cross) {
      keep(TRIM, x + w / 2 - 2.5, y, 5, h);
      keep(TRIM, x, y + h * 0.45, w, 5);
    }
    if (sill) keep(TRIM, x - frame - 6, y + h + frame - 2, w + frame * 2 + 12, 9, 3);
    if (rng.chance(0.42)) {
      e.fillStyle = rng.pick(['#ffd88a', '#ffe7b0', '#ffc977', '#fff2d0']);
      e.fillRect(x, y, w, h);
    }
  };
  for (let by = 0; by < 2; by++) {
    for (let bx = 0; bx < 2; bx++) {
      const x0 = bx * cw, y0 = by * ch;
      if (style === 'office') {
        // pastel frame with big glass panes and white mullions
        keep(INK, x0 + 6, y0 + 10, cw - 12, ch - 22, 4);
        keep('#3c6a8c', x0 + 9, y0 + 13, cw - 18, ch - 28, 3);
        keep('#7fb0d0', x0 + 14, y0 + 16, 14, ch - 40, 3);
        keep(TRIM, x0 + cw / 2 - 3, y0 + 13, 6, ch - 28);
        keep(TRIM, x0 + 4, y0 + ch - 14, cw - 8, 8, 3);
        if (rng.chance(0.4)) {
          e.fillStyle = '#ffe7b0';
          e.fillRect(x0 + 9, y0 + 13, cw - 18, ch - 28);
        }
      } else if (style === 'apartment') {
        windowAt(x0 + 30, y0 + 22, cw - 60, ch - 62, { cross: true });
        // balcony with white rail
        keep(TRIM, x0 + 8, y0 + ch - 22, cw - 16, 8, 3);
        for (let k = 0; k < 7; k++) keep(TRIM, x0 + 12 + k * 16, y0 + ch - 36, 4, 14);
        keep(TRIM, x0 + 8, y0 + ch - 38, cw - 16, 5, 2);
      } else if (style === 'house') {
        // Bo-Kaap / Victorian: tall sash window with white frame, cornice line per floor
        windowAt(x0 + 34, y0 + 20, cw - 68, ch - 50, { frame: 8, shutters: false });
        keep(TRIM, x0, y0 + ch - 10, cw, 10);
        keep(INK, x0, y0 + ch - 12, cw, 2);
        shadeWall('#efe9e0', x0, y0 + ch - 20, cw, 8); // shade under the cornice
      } else if (style === 'villa') {
        windowAt(x0 + 14, y0 + 22, cw - 28, ch - 52, { frame: 6, cross: false });
        keep(TRIM, x0, y0 + ch - 8, cw, 8);
      } else if (style === 'industrial') {
        for (let r = 0; r < ch; r += 12) {
          shadeWall(r % 24 === 0 ? '#ece6dc' : '#f6f1ea', x0, y0 + r, cw, 11);
          g.fillStyle = '#d8d0c4';
          for (let k = r % 24 === 0 ? 0 : 12; k < cw; k += 24) g.fillRect(x0 + k, y0 + r, 2, 11);
        }
        windowAt(x0 + 22, y0 + 12, cw - 44, 28, { frame: 5, cross: false, sill: false });
      } else {
        // township: plastered block, small window with a bright frame
        windowAt(x0 + 40, y0 + 36, 44, 36, { frame: 6 });
        shadeWall('#ebe4da', x0, y0 + ch - 14, cw, 14);
      }
    }
  }
  return { map: tex(c), mask: tex(cm, false), emissive: tex(ce), spec: FACADES[style] };
}

/** Toon wall material: map colours where the mask is black, map x building colour where it is white. */
export function toonWallMaterial(fac) {
  const mat = new THREE.MeshToonMaterial({ map: fac.map, vertexColors: true, gradientMap: RAMP_SOFT, emissiveMap: fac.emissive, emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMask = { value: fac.mask };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uMask;')
      .replace('#include <color_fragment>', '')
      .replace(
        '#include <map_fragment>',
        `vec4 facadeTexel = texture2D( map, vMapUv );
         float wallMask = texture2D( uMask, vMapUv ).r;
         diffuseColor.rgb *= facadeTexel.rgb * mix( vec3( 1.0 ), vColor, wallMask );`,
      );
  };
  mat.customProgramCacheKey = () => 'toonWall';
  return mat;
}

// ---------------------------------------------------------------- Cape Dutch gable
function gableShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.bezierCurveTo(-w / 2, h * 0.35, -w * 0.2, h * 0.3, -w * 0.22, h * 0.62);
  s.bezierCurveTo(-w * 0.24, h * 1.02, w * 0.24, h * 1.02, w * 0.22, h * 0.62);
  s.bezierCurveTo(w * 0.2, h * 0.3, w / 2, h * 0.35, w / 2, 0);
  s.lineTo(-w / 2, 0);
  return s;
}
// flat cut-outs (front face + back face), coarse curves: thousands of these sit in one city mesh
function flatGable(w, h, z) {
  const f = new THREE.ShapeGeometry(gableShape(w, h), 4);
  const pa = f.attributes.position.array, n = pa.length / 3, ia = f.index.array;
  const pos = new Float32Array(pa.length * 2);
  for (let i = 0; i < n; i++) {
    pos.set([pa[i * 3], pa[i * 3 + 1], z], i * 3); // front copy
    pos.set([pa[i * 3], pa[i * 3 + 1], z - 0.02], (n + i) * 3); // back copy, triangles reversed below
  }
  const idx = [...ia];
  for (let t = 0; t < ia.length; t += 3) idx.push(ia[t] + n, ia[t + 2] + n, ia[t + 1] + n);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** Gables 3 m wide, 1.8 m tall, standing in the z = 0..0.3 slab (front face at z = 0.3). */
export const GABLE = flatGable(3.0, 1.8, 0.3);
export const GABLE_TRIM = flatGable(3.36, 2.08, 0.28);
export const TRIM_COLOUR = TRIM;

// ---------------------------------------------------------------- ink outlines for boxy buildings
/** A slightly bigger box drawn back-faces-only in dark ink around each building = a cartoon outline. */
export function buildingOutlines(buildings, pad = 0.07) {
  const pos = [], idx = [];
  let n = 0;
  for (const b of buildings) {
    const x0 = b.x0 - pad, x1 = b.x1 + pad, z0 = b.z0 - pad, z1 = b.z1 + pad, y0 = -0.2, y1 = b.h + pad + (b.roof === 'slab' ? 0.22 : 0);
    const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    for (const p of v) pos.push(...p);
    // faces wound outward; the material draws back faces only
    const f = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [3, 7, 6, 2]];
    for (const [a, b2, c, d] of f) idx.push(n + a, n + b2, n + c, n + a, n + c, n + d);
    n += 8;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  mesh.name = 'building_ink';
  return mesh;
}
