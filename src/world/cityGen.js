// Procedural city generation on top of the hand-made map: rasterises roads,
// landmark footprints, then packs district-styled buildings, trees and street furniture.

import { DISTRICTS, STYLES } from './mapData.js';
import { T, inDistrict } from './grid.js';
import { RNG, clamp, dist, polyBounds } from '../core/util.js';

function pentagon(cx, cz, r, rot = 0.3) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = rot + (i / 5) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return pts;
}

// Solid footprints of hand-built landmarks (meshes are made in landmarks.js).
export const LANDMARK_SOLIDS = [
  { id: 'cityhall', rect: [194, -280, 236, -262], h: 16 },
  { id: 'cityhallTower', rect: [211, -276, 219, -268], h: 34 },
  { id: 'police', rect: [196, -210, 234, -188], h: 12 },
  { id: 'station', rect: [120, -350, 170, -338], h: 9 },
  { id: 'hospital', rect: [266, 24, 326, 66], h: 18 },
  { id: 'lighthouse', rect: [-413, -403, -407, -397], h: 18 },
  { id: 'wheelBase', rect: [56, -452, 64, -438], h: 3 },
  { id: 'clockTower', rect: [136, -472, 144, -464], h: 16 },
  { id: 'wharf', rect: [192, -472, 262, -406], h: 14 },
  { id: 'aquarium', rect: [36, -478, 84, -464], h: 9 },
  { id: 'fishChips', rect: [57, -408, 63, -403], h: 3 },
  { id: 'gatsby', rect: [49, -188, 55, -182], h: 3 },
  { id: 'mosque', rect: [-90, -193, -74, -177], h: 8 },
  { id: 'minaret', rect: [-78, -193, -72, -187], h: 22 },
  { id: 'rashieda', rect: [-170, -186, -150, -174], h: 8 },
  { id: 'siteOffice', rect: [482, -206, 500, -198], h: 3.6 },
  { id: 'container1', rect: [446, -206, 458, -200], h: 5.2 },
  { id: 'container2', rect: [446, -196, 458, -190], h: 2.6 },
  { id: 'container3', rect: [500, -178, 506, -166], h: 2.6 },
  { id: 'fenceN', rect: [440, -210, 510, -208], h: 2.4 },
  { id: 'fenceW', rect: [440, -210, 442, -160], h: 2.4 },
  { id: 'fenceE', rect: [508, -210, 510, -160], h: 2.4 },
  { id: 'fenceS1', rect: [440, -162, 466, -160], h: 2.4 },
  { id: 'fenceS2', rect: [484, -162, 510, -160], h: 2.4 },
  { id: 'cableLower', rect: [-158, 252, -142, 262], h: 7 },
  { id: 'lifeguard', rect: [-599, 224, -595, 228], h: 5 },
  { id: 'shisa', rect: [634, 104, 646, 112], h: 3.2 },
  { id: 'stadium', circle: [-200, -355, 46], h: 24 },
  { id: 'castle', poly: pentagon(295, -255, 27), h: 9 },
];

const snap2 = (v) => Math.max(4, Math.round(v / 2) * 2);

export function buildCity(grid, roads, seed = 2025) {
  const rng = new RNG(seed);
  grid.buildTerrain();
  rasterRoads(grid, roads);
  for (const s of LANDMARK_SOLIDS) markSolid(grid, s);
  const buildings = placeBuildings(grid, rng);
  const trees = placeTrees(grid, rng);
  const lamps = placeLamps(grid, roads);
  const { signals, crosswalks } = placeSignals(roads);
  return { buildings, trees, lamps, signals, crosswalks };
}

function rasterRoads(grid, roads) {
  const { type } = grid;
  for (const e of roads.edges) {
    const A = roads.nodes[e.a], B = roads.nodes[e.b];
    grid.fillSegment(A.x, A.z, B.x, B.z, e.width / 2 + e.sidewalk, (i) => {
      const t = type[i];
      if (t === T.LAND || t === T.SAND || t === T.PARK) type[i] = T.WALK;
    });
  }
  for (const e of roads.edges) {
    const A = roads.nodes[e.a], B = roads.nodes[e.b];
    grid.fillSegment(A.x, A.z, B.x, B.z, e.width / 2, (i) => {
      if (type[i] !== T.WATER) { type[i] = T.ROAD; grid.height[i] = 0; }
    });
  }
  for (const n of roads.nodes) {
    grid.fillCircle(n.x, n.z, n.maxWidth / 2, (i) => { if (type[i] !== T.WATER) type[i] = T.ROAD; });
  }
}

function markSolid(grid, s) {
  const fn = (i) => {
    grid.type[i] = T.PROP;
    grid.height[i] = Math.max(grid.height[i], Math.min(255, Math.round(s.h)));
  };
  if (s.rect) grid.fillRect(s.rect[0], s.rect[1], s.rect[2], s.rect[3], fn);
  else if (s.circle) grid.fillCircle(s.circle[0], s.circle[1], s.circle[2], fn);
  else if (s.poly) grid.fillPoly(s.poly, fn);
}

function placeBuildings(grid, rng) {
  const out = [];
  const { type, height, reserved, w } = grid;
  for (const d of DISTRICTS) {
    if (!d.style) continue;
    const st = STYLES[d.style];
    const b = d.rect ? { minX: d.rect[0], minZ: d.rect[1], maxX: d.rect[2], maxZ: d.rect[3] } : polyBounds(d.poly);
    const cands = [];
    for (let x = Math.max(b.minX, grid.minX + 4); x < Math.min(b.maxX, grid.maxX - 4); x += 4) {
      for (let z = Math.max(b.minZ, grid.minZ + 4); z < Math.min(b.maxZ, grid.maxZ - 4); z += 4) {
        if (inDistrict(d, x, z)) cands.push([x, z]);
      }
    }
    rng.shuffle(cands);
    const gapC = Math.round(st.gap / 2);
    for (const [x, z] of cands) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const shrink = attempt === 0 ? 1 : attempt === 1 ? 0.75 : 0.55;
        const bw = snap2(rng.range(st.size[0], st.size[1]) * shrink);
        const bd = snap2(rng.range(st.size[0], st.size[1]) * shrink);
        const ix0 = grid.ix(x - bw / 2), iz0 = grid.iz(z - bd / 2);
        const wc = bw / 2, dc = bd / 2;
        if (!fits(grid, ix0, iz0, wc, dc, gapC)) continue;
        // inside district check for the corners (keeps styles from bleeding)
        const x0 = grid.minX + ix0 * 2, z0 = grid.minZ + iz0 * 2, x1 = x0 + bw, z1 = z0 + bd;
        if (!inDistrict(d, x0, z0) || !inDistrict(d, x1, z1)) continue;
        const h = buildingHeight(d, st, rng, (x0 + x1) / 2, (z0 + z1) / 2, Math.min(bw, bd));
        for (let iz = iz0; iz < iz0 + dc; iz++) for (let ix = ix0; ix < ix0 + wc; ix++) {
          const i = iz * w + ix;
          type[i] = T.BUILDING;
          height[i] = Math.min(255, Math.ceil(h + (st.roof === 'gable' ? Math.min(bw, bd) * 0.3 : 0)));
        }
        out.push({
          x0, z0, x1, z1, h, district: d.id, style: d.style, wall: st.wall, roof: st.roof,
          color: varyColor(rng.pick(st.colors), rng),
          roofColor: roofColorFor(st, rng),
          uOff: rng.int(0, 3), seed: rng.int(0, 1e6),
        });
        break;
      }
    }
  }
  return out;
}

function fits(grid, ix0, iz0, wc, dc, gapC) {
  const { type, height, reserved, w } = grid;
  if (ix0 - gapC < 0 || iz0 - gapC < 0 || ix0 + wc + gapC >= grid.w || iz0 + dc + gapC >= grid.h) return false;
  for (let iz = iz0; iz < iz0 + dc; iz++) {
    for (let ix = ix0; ix < ix0 + wc; ix++) {
      const i = iz * w + ix;
      if (type[i] !== T.LAND || reserved[i] || height[i] > 3) return false;
    }
  }
  if (gapC > 0) {
    for (let iz = iz0 - gapC; iz < iz0 + dc + gapC; iz++) {
      for (let ix = ix0 - gapC; ix < ix0 + wc + gapC; ix++) {
        if (type[iz * w + ix] === T.BUILDING) return false;
      }
    }
  }
  return true;
}

function buildingHeight(d, st, rng, cx, cz, minSide) {
  const [h0, h1] = st.h;
  if (d.style === 'office') {
    const f = clamp(1 - dist(cx, cz, 120, -255) / 300, 0.12, 1);
    let h = h0 + (h1 - h0) * Math.pow(rng.next(), 1.3) * f;
    if (rng.chance(0.14 * f) && minSide >= 14) h = h1 * rng.range(0.85, 1.35);
    if (minSide < 12) h = Math.min(h, 26);
    return Math.round(h);
  }
  if (d.style === 'apartment') {
    let h = rng.range(h0, h1);
    if (minSide < 14) h = Math.min(h, 22);
    return Math.round(h);
  }
  return Math.round(rng.range(h0, h1) * 10) / 10;
}

function varyColor(hex, rng) {
  const n = parseInt(hex.slice(1), 16);
  const f = rng.range(0.9, 1.05);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((n & 255) * f), 0, 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function roofColorFor(st, rng) {
  if (st.roof === 'slab') return rng.pick(st.roofColors);
  if (st.roof === 'gable') return rng.pick(['#d8643f', '#c0503a', '#3f7fb0', '#4f9a5a', '#e0884a', '#8a6a5a']);
  return rng.pick(['#cfc8bc', '#d8d2c6', '#c4bfb4', '#e0d8cc']);
}

function placeTrees(grid, rng) {
  const trees = { oak: [], pine: [], palm: [], bush: [] };
  const { type, reserved, height, w, h } = grid;
  const near = (ix, iz, t, r = 1) => {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const jx = ix + dx, jz = iz + dz;
      if (jx >= 0 && jz >= 0 && jx < w && jz < h && type[jz * w + jx] === t) return true;
    }
    return false;
  };
  const occupied = new Uint8Array(w * h);
  const free = (ix, iz, r) => {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const jx = ix + dx, jz = iz + dz;
      if (jx < 0 || jz < 0 || jx >= w || jz >= h) return false;
      if (occupied[jz * w + jx]) return false;
    }
    return true;
  };
  const plant = (kind, ix, iz, scale, solid = true) => {
    const x = grid.cx(ix) + rng.range(-0.4, 0.4), z = grid.cz(iz) + rng.range(-0.4, 0.4);
    trees[kind].push({ x, z, s: scale, r: rng.range(0, Math.PI * 2) });
    occupied[iz * w + ix] = 1;
    if (solid) { type[iz * w + ix] = T.PROP; }
  };
  for (let iz = 2; iz < h - 2; iz++) {
    for (let ix = 2; ix < w - 2; ix++) {
      const i = iz * w + ix;
      const t = type[i];
      if (reserved[i]) continue;
      const x = grid.cx(ix), z = grid.cz(iz);
      const d = grid.district(x, z);
      const did = d ? d.id : null;
      if (t === T.PARK) {
        if (x > 684 && x < 756 && z > 164 && z < 236) continue; // soccer pitch
        if (!near(ix, iz, T.PARK, 1) || near(ix, iz, T.WALK, 1)) continue;
        if (rng.chance(0.035) && free(ix, iz, 3)) {
          const coastal = did === 'seapoint' || did === 'greenpoint';
          if (coastal && rng.chance(0.55)) plant('palm', ix, iz, rng.range(0.9, 1.2));
          else plant(rng.chance(0.6) ? 'oak' : 'pine', ix, iz, rng.range(0.8, 1.3));
        }
      } else if (t === T.LAND) {
        if (height[i] > 0) {
          if (rng.chance(0.02) && free(ix, iz, 2)) plant('bush', ix, iz, rng.range(0.8, 1.8), false);
          continue;
        }
        const street = near(ix, iz, T.WALK, 1);
        if ((did === 'gardens' || did === 'observatory') && street && rng.chance(0.07) && free(ix, iz, 4)) plant('oak', ix, iz, rng.range(0.8, 1.15));
        else if ((did === 'campsbay' || did === 'clifton' || did === 'seapoint') && street && rng.chance(0.06) && free(ix, iz, 4)) plant('palm', ix, iz, rng.range(0.9, 1.25));
        else if ((!did || did === 'kloofnek') && rng.chance(0.03) && free(ix, iz, 2)) {
          if (rng.chance(0.15)) plant('pine', ix, iz, rng.range(0.9, 1.4));
          else plant('bush', ix, iz, rng.range(0.7, 1.6), false);
        } else if (did === 'langa' && street && rng.chance(0.01) && free(ix, iz, 5)) plant('oak', ix, iz, rng.range(0.7, 1.0));
      } else if (t === T.SAND && did === 'campsbay') {
        if (near(ix, iz, T.WALK, 1) && rng.chance(0.18) && free(ix, iz, 4)) plant('palm', ix, iz, rng.range(1.0, 1.3));
      }
    }
  }
  return trees;
}

function placeLamps(grid, roads) {
  const lamps = [];
  for (const e of roads.edges) {
    if (e.len < 24) continue;
    const A = roads.nodes[e.a], B = roads.nodes[e.b];
    const px = e.dz, pz = -e.dx; // left of a->b
    const start = A.clearance + e.sidewalk + 6, end = e.len - B.clearance - e.sidewalk - 6;
    let side = e.id % 2 ? 1 : -1;
    for (let s = start; s <= end; s += 32) {
      const off = e.width / 2 + e.sidewalk * 0.72;
      const x = A.x + e.dx * s + px * off * side, z = A.z + e.dz * s + pz * off * side;
      if (grid.typeAt(x, z) === T.WALK) lamps.push({ x, z, ry: Math.atan2(-px * side, -pz * side) });
      side = -side;
    }
  }
  return lamps;
}

function placeSignals(roads) {
  const signals = [], crosswalks = [];
  for (const n of roads.nodes) {
    if (!n.junction) continue;
    for (const id of n.edges) {
      const e = roads.edges[id];
      const [dx, dz] = roads.dirFrom(e, n.id);
      const out = n.maxWidth / 2 + 1.6;
      if (n.signal) {
        const lx = -dz, lz = dx; // left of incoming traffic
        const off = e.width / 2 + 1.1;
        signals.push({ x: n.x + dx * (out + 1.2) + lx * off, z: n.z + dz * (out + 1.2) + lz * off, ry: Math.atan2(dx, dz), group: e.group });
        crosswalks.push({ x: n.x + dx * out, z: n.z + dz * out, ry: Math.atan2(dx, dz), width: e.width });
      }
    }
  }
  return { signals, crosswalks };
}
