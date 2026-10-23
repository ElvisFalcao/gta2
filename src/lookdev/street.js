// Look-dev test street: a Bo-Kaap style row of painted terraced houses with a corner café,
// cobbled road, mural wall, lamps, palms, a parked minibus taxi, washing line and hadedas,
// with layered, hazy mountains (Signal Hill, Lion's Head, Table Mountain + tablecloth) behind.

import * as THREE from 'three';
import { toon, outlineMaterial, inked, roundedBox, SHAPES, Merger, canvasTex, cobbleTexture, signTexture, muralTexture } from '../core/toon.js';

const INK_BUILD = outlineMaterial('#2b1d18', 0.05);
const INK_PROP = outlineMaterial('#2b1d18', 0.03);
const HOUSE_COLOURS = ['#ff5fa2', '#7ed957', '#3cc9c9', '#ffd23f', '#a970ff', '#ff8c42', '#4aa3ff', '#ff6b6b', '#5fe0a8'];
const DOORS = ['#1e5a46', '#7a3b2e', '#1b2a4a', '#f2efe6', '#2f6e9a', '#5b3a8a'];
const TRIM = '#fbf6ea';

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];

export function buildStreet(scene) {
  const out = { lamps: [], glass: null, lampGlass: null, birds: [], clothes: [] };
  const solid = new Merger(); // inked, vertex-coloured buildings and props
  const flat = new Merger(); // ground pieces (no outline)
  const glass = new Merger(); // windows (glow at night)
  const lampGlass = new Merger();

  // ---------------------------------------------------------------- ground
  const cob = cobbleTexture();
  const road = new THREE.Mesh(new THREE.PlaneGeometry(80, 7), new THREE.MeshToonMaterial({ map: cob, gradientMap: null, color: '#d8cfc4' }));
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  scene.add(road);
  for (const s of [-1, 1]) {
    flat.add(roundedBox(80, 0.2, 2.6, 0.06), '#d9c7b0', { y: 0.1, z: s * 4.8 }); // pavement
    flat.add(roundedBox(80, 0.22, 0.22, 0.08), '#bfb2a2', { y: 0.11, z: s * 3.6 }); // kerb
    flat.add(SHAPES.cylLo, '#ffcf33', { y: 0.012, z: s * 3.25, sx: 80, sy: 0.01, sz: 0.12, rz: 0 }); // no-stopping line
  }
  flat.add(roundedBox(120, 0.1, 30, 0.05), '#86b85f', { y: -0.06, z: 21 }); // grass on the camera side
  flat.add(roundedBox(120, 0.1, 40, 0.05), '#cdb79a', { y: -0.06, z: -26 }); // yards behind the houses
  // paving joints on the pavement
  for (let x = -40; x < 40; x += 1.2) for (const s of [-1, 1]) flat.add(SHAPES.cylLo, '#c9b59c', { x, y: 0.205, z: s * 4.8, sx: 0.03, sy: 0.004, sz: 2.5 });

  // ---------------------------------------------------------------- terraced houses (north side, facing the street)
  let x = -27;
  for (let i = 0; i < 9; i++) {
    if (i === 5) {
      muralLot(scene, solid, x + 5, -6.1, 10);
      x += 10;
      continue;
    }
    const w = 5 + rnd() * 1.2, h = 6.2 + rnd() * 1.4, c = HOUSE_COLOURS[i % HOUSE_COLOURS.length];
    house(solid, glass, x + w / 2, -6.1, w, h, c, i);
    x += w;
  }
  cafe(scene, solid, glass, x + 4.2, -6.1, 8.4, 6.6);

  // ---------------------------------------------------------------- south side: a little park strip, trees, bench, lamps
  for (let k = 0; k < 26; k++) {
    const fx = -34 + k * 2.7 + rnd(), fz = 7 + rnd() * 2.2;
    solid.add(SHAPES.sphereLo, k % 3 ? '#4f9e4a' : '#3f8a44', { x: fx, y: 0.3, z: fz, sx: 1.2 + rnd(), sy: 0.8 + rnd() * 0.4, sz: 1.0 });
    if (k % 2) for (let f = 0; f < 4; f++) solid.add(SHAPES.sphereLo, pick(['#ff5fa2', '#ffd23f', '#ffffff', '#ff8c42']), { x: fx - 0.4 + rnd() * 0.8, y: 0.68, z: fz - 0.3 + rnd() * 0.4, sx: 0.18, sy: 0.14, sz: 0.18 });
  }
  palm(solid, -20.5, 6.3, 7.5);
  palm(solid, 3.5, 6.6, 8.6);
  bigTree(solid, 12, 8.5);
  bench(solid, -3, 5.6);
  for (const lx of [-24, -8, 8, 24]) lamp(solid, lampGlass, out, lx, 5.9);
  // bollards and a bin
  for (let bx = -30; bx < 32; bx += 4) solid.add(roundedBox(0.22, 0.7, 0.22, 0.09), '#1e5a46', { x: bx, y: 0.55, z: 3.9 });
  solid.add(roundedBox(0.5, 0.9, 0.5, 0.12), '#2f6e9a', { x: 0.6, y: 0.65, z: 5.4 });

  // ---------------------------------------------------------------- power line with hadedas, washing line
  for (const px of [-30, 0, 30]) solid.add(SHAPES.cylLo, '#6b4f36', { x: px, y: 4.5, z: -3.9, sx: 0.22, sy: 9, sz: 0.22 });
  const wire = new Merger();
  for (const [x0, x1] of [[-30, 0], [0, 30]]) {
    for (let k = 0; k < 14; k++) {
      const t0 = k / 14, t1 = (k + 1) / 14, sag = (t) => 8.6 - Math.sin(t * Math.PI) * 0.6;
      const ax = x0 + (x1 - x0) * t0, bx = x0 + (x1 - x0) * t1;
      const ay = sag(t0), by = sag(t1);
      wire.add(SHAPES.cylLo, '#2b2522', { x: (ax + bx) / 2, y: (ay + by) / 2, z: -3.9, sx: 0.04, sy: Math.hypot(bx - ax, by - ay), sz: 0.04, rz: Math.PI / 2 - Math.atan2(by - ay, bx - ax) });
    }
  }
  scene.add(new THREE.Mesh(wire.build(), new THREE.MeshBasicMaterial({ vertexColors: true })));
  for (const [hx, hy] of [[-18, 8.1], [-16.9, 8.05], [11, 8.05]]) out.birds.push(hadeda(scene, hx, hy, -3.9));
  washingLine(scene, out, -13.6, -6.6, 7.2);

  // ---------------------------------------------------------------- minibus taxi
  out.taxi = minibus(scene, 15, 2.1);

  // ---------------------------------------------------------------- merge
  const solidMesh = inked(solid.build(), toon(), INK_BUILD);
  scene.add(solidMesh);
  const flatMesh = new THREE.Mesh(flat.build(), toon({ soft: true }));
  flatMesh.receiveShadow = true;
  scene.add(flatMesh);
  out.glass = new THREE.Mesh(glass.build(), new THREE.MeshToonMaterial({ vertexColors: true, emissive: '#ffb45c', emissiveIntensity: 0 }));
  scene.add(out.glass);
  out.lampGlass = new THREE.Mesh(lampGlass.build(), new THREE.MeshBasicMaterial({ color: '#fff2c4' }));
  scene.add(out.lampGlass);

  backdrop(scene, out);
  return out;
}

// ---------------------------------------------------------------- pieces
function house(m, glass, cx, front, w, h, c, i) {
  const d = 8, z = front - d / 2;
  m.add(roundedBox(w - 0.04, h, d, 0.1), c, { x: cx, y: h / 2, z });
  // white pilasters at the ends, cornice and a parapet with a little moulded top
  for (const s of [-1, 1]) m.add(roundedBox(0.28, h + 0.5, 0.2, 0.06), TRIM, { x: cx + s * (w / 2 - 0.14), y: (h + 0.5) / 2, z: front + 0.05 });
  m.add(roundedBox(w, 0.22, 0.42, 0.08), TRIM, { x: cx, y: h - 0.55, z: front + 0.1 });
  m.add(roundedBox(w - 0.3, 0.5, 0.3, 0.08), c, { x: cx, y: h + 0.2, z: front - 0.02 });
  m.add(roundedBox(w + 0.04, 0.12, 0.4, 0.05), TRIM, { x: cx, y: h + 0.48, z: front });
  if (i % 3 === 1) {
    // curvy Cape Dutch gable over the middle, white trim behind the coloured face
    m.add(GABLE_TRIM, TRIM, { x: cx, y: h + 0.3, z: front - 0.3 });
    m.add(GABLE, c, { x: cx, y: h + 0.3, z: front - 0.2 });
  }
  // ground floor: door with a fanlight, a big window, stoep steps
  const doorLeft = i % 2 === 0;
  const dx = cx + (doorLeft ? -w / 4 : w / 4), wx = cx + (doorLeft ? w / 5 : -w / 5);
  const door = DOORS[i % DOORS.length];
  m.add(roundedBox(1.25, 2.55, 0.16, 0.05), TRIM, { x: dx, y: 1.5, z: front + 0.06 });
  m.add(roundedBox(1.0, 2.3, 0.14, 0.04), door, { x: dx, y: 1.4, z: front + 0.1 });
  for (const py of [0.8, 1.75]) m.add(roundedBox(0.7, 0.6, 0.06, 0.03), shade(door, 0.82), { x: dx, y: py, z: front + 0.18 });
  m.add(SHAPES.sphereLo, '#e8c25a', { x: dx + (doorLeft ? 0.35 : -0.35), y: 1.3, z: front + 0.2, sx: 0.09, sy: 0.09, sz: 0.09 });
  glass.add(SHAPES.cyl, '#2c4d6e', { x: dx, y: 2.62, z: front + 0.04, sx: 0.95, sy: 0.08, sz: 0.95, rx: Math.PI / 2 });
  for (let s = 0; s < 2; s++) m.add(roundedBox(1.6 - s * 0.3, 0.2, 0.55 - s * 0.2, 0.05), '#cdbca6', { x: dx, y: 0.3 + s * 0.2, z: front + 0.35 - s * 0.12 });
  window_(m, glass, wx, 1.7, front, 1.5, 1.4);
  // upper floor: two windows, some with a little wrought-iron balcony
  const up = h * 0.62;
  for (const s of [-1, 1]) window_(m, glass, cx + s * w * 0.24, up, front, 1.0, 1.35);
  if (i % 3 === 0) {
    m.add(roundedBox(w * 0.7, 0.12, 0.8, 0.04), TRIM, { x: cx, y: up - 0.85, z: front + 0.4 });
    for (let k = 0; k <= 10; k++) m.add(SHAPES.cylLo, '#2b2522', { x: cx - w * 0.35 + (k / 10) * w * 0.7, y: up - 0.45, z: front + 0.77, sx: 0.04, sy: 0.8, sz: 0.04 });
    m.add(roundedBox(w * 0.7, 0.06, 0.06, 0.02), '#2b2522', { x: cx, y: up - 0.05, z: front + 0.77 });
  }
  // drainpipe and a pot plant on the stoep
  m.add(SHAPES.cylLo, shade(c, 0.75), { x: cx + w / 2 - 0.35, y: h / 2, z: front + 0.12, sx: 0.12, sy: h, sz: 0.12 });
  if (i % 2) {
    m.add(SHAPES.cylLo, '#c0623a', { x: dx + (doorLeft ? 0.95 : -0.95), y: 0.45, z: front + 0.45, sx: 0.4, sy: 0.45, sz: 0.4 });
    m.add(SHAPES.sphereLo, '#3f9a4b', { x: dx + (doorLeft ? 0.95 : -0.95), y: 0.85, z: front + 0.45, sx: 0.6, sy: 0.5, sz: 0.6 });
  }
  if (i === 4) {
    // bougainvillea climbing the corner and spilling along the top of the ground floor
    m.add(SHAPES.cylLo, '#6b4f36', { x: cx - w / 2 + 0.6, y: 1.4, z: front + 0.25, sx: 0.12, sy: 2.8, sz: 0.12 });
    for (let k = 0; k < 34; k++) {
      const t = rnd(), across = k > 14;
      const bx = across ? cx - w / 2 + 0.5 + rnd() * w * 0.55 : cx - w / 2 + 0.3 + rnd() * 0.9;
      const by = across ? 2.9 + rnd() * 0.7 - (rnd() < 0.3 ? rnd() * 0.8 : 0) : 0.5 + t * 2.6;
      m.add(SHAPES.sphereLo, pick(['#ff3e96', '#ff6fb1', '#e0247a', '#ff8cc6', '#3f8a44']), { x: bx, y: by, z: front + 0.25 + rnd() * 0.35, sx: 0.35 + rnd() * 0.35, sy: 0.3 + rnd() * 0.3, sz: 0.3 });
    }
  }
}

function window_(m, glass, x, y, front, w, h) {
  m.add(roundedBox(w + 0.3, h + 0.3, 0.14, 0.05), TRIM, { x, y, z: front + 0.05 });
  glass.add(roundedBox(w, h, 0.06, 0.02), '#2c4d6e', { x, y, z: front + 0.1 });
  m.add(roundedBox(0.06, h, 0.08, 0.02), TRIM, { x, y, z: front + 0.14 });
  m.add(roundedBox(w, 0.06, 0.08, 0.02), TRIM, { x, y: y + h * 0.15, z: front + 0.14 });
  m.add(roundedBox(w + 0.45, 0.12, 0.35, 0.04), TRIM, { x, y: y - h / 2 - 0.18, z: front + 0.15 }); // sill
}

function cafe(scene, m, glass, cx, front, w, h) {
  const c = '#f6efe1', d = 8;
  m.add(roundedBox(w, h, d, 0.12), c, { x: cx, y: h / 2, z: front - d / 2 });
  m.add(roundedBox(w + 0.1, 0.5, 0.4, 0.08), '#1e7a3c', { x: cx, y: h + 0.2, z: front });
  m.add(roundedBox(w + 0.1, 0.9, 0.3, 0.08), '#1e7a3c', { x: cx, y: 0.45, z: front + 0.05 });
  // shop windows and an open door
  glass.add(roundedBox(2.4, 1.9, 0.06, 0.03), '#2c4d6e', { x: cx - 2.4, y: 1.95, z: front + 0.08 });
  glass.add(roundedBox(2.4, 1.9, 0.06, 0.03), '#2c4d6e', { x: cx + 2.4, y: 1.95, z: front + 0.08 });
  m.add(roundedBox(1.3, 2.5, 0.1, 0.04), '#3a2a1f', { x: cx, y: 1.25, z: front + 0.04 });
  // striped awning
  for (let k = 0; k < 12; k++) {
    m.add(roundedBox(w / 12 + 0.01, 0.08, 1.6, 0.03), k % 2 ? '#ffffff' : '#e03c31', { x: cx - w / 2 + (k + 0.5) * (w / 12), y: 3.35, z: front + 0.75, rx: 0.32 });
    m.add(SHAPES.sphereLo, k % 2 ? '#ffffff' : '#e03c31', { x: cx - w / 2 + (k + 0.5) * (w / 12), y: 3.08, z: front + 1.52, sx: w / 12, sy: 0.22, sz: 0.12 });
  }
  // fruit crates
  for (const [fx, fc] of [[-3.4, '#ff9f1c'], [-2.5, '#7ed957'], [3.1, '#e03c31']]) {
    m.add(roundedBox(0.8, 0.5, 0.6, 0.05), '#b9864f', { x: cx + fx, y: 0.45, z: front + 0.7 });
    for (let k = 0; k < 6; k++) m.add(SHAPES.sphereLo, fc, { x: cx + fx - 0.25 + (k % 3) * 0.25, y: 0.78, z: front + 0.6 + Math.floor(k / 3) * 0.22, sx: 0.2, sy: 0.2, sz: 0.2 });
  }
  // sign board
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 1.05), new THREE.MeshToonMaterial({ map: signTexture("RASHIEDA'S CAFÉ", { sub: 'GATSBY • KOEKSISTERS • SAMOOSAS', bg: '#1e7a3c' }), gradientMap: null }));
  sign.position.set(cx, h - 1.25, front + 0.14);
  scene.add(sign);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2), new THREE.MeshToonMaterial({ map: chalkboard(), gradientMap: null }));
  board.position.set(cx + 1.3, 0.75, front + 1.7);
  board.rotation.x = -0.2;
  scene.add(board);
  m.add(roundedBox(1.0, 1.3, 0.08, 0.03), '#6b4f36', { x: cx + 1.3, y: 0.72, z: front + 1.67, rx: -0.2 });
}

function chalkboard() {
  return canvasTex(256, 340, (g, w, h) => {
    g.fillStyle = '#26302b';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2efe6';
    g.textAlign = 'center';
    g.font = '44px Bebas Neue, Impact, sans-serif';
    g.fillText("TODAY'S", w / 2, 60);
    g.fillStyle = '#ffd166';
    g.fillText('SPECIAL', w / 2, 104);
    g.fillStyle = '#f2efe6';
    g.font = '600 26px Inter, Arial, sans-serif';
    ['Full house', 'Gatsby', 'R85', '', 'Koeksisters', '3 for R20'].forEach((t, i) => g.fillText(t, w / 2, 150 + i * 32));
  });
}

function palm(m, x, z, h) {
  for (let k = 0; k < 8; k++) {
    const t = k / 8;
    m.add(SHAPES.cylLo, k % 2 ? '#8a6a48' : '#7a5c3e', { x: x + Math.sin(t * 1.4) * 0.6, y: t * h + h / 16, z, sx: 0.42 - t * 0.12, sy: h / 8 + 0.05, sz: 0.42 - t * 0.12 });
  }
  const tx = x + Math.sin(1.4) * 0.6, ty = h;
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    m.add(SHAPES.sphereLo, k % 2 ? '#3f9a4b' : '#5bb85a', { x: tx + Math.cos(a) * 1.5, y: ty - 0.35, z: z + Math.sin(a) * 1.5, sx: 3.2, sy: 0.18, sz: 0.75, ry: -a, rz: -0.35 });
  }
  m.add(SHAPES.sphereLo, '#6b4f36', { x: tx, y: ty, z, sx: 0.7, sy: 0.6, sz: 0.7 });
}

function bigTree(m, x, z) {
  m.add(SHAPES.cyl, '#6b4f36', { x, y: 1.6, z, sx: 0.6, sy: 3.2, sz: 0.6 });
  for (const [dx, dy, dz, r, c] of [[0, 4.6, 0, 3.6, '#4caf50'], [-1.6, 4.0, 0.6, 2.6, '#5bbf5e'], [1.5, 4.2, -0.4, 2.8, '#3f9a4b'], [0.3, 5.7, 0.2, 2.4, '#6fcf63']]) {
    m.add(SHAPES.sphere, c, { x: x + dx, y: dy, z: z + dz, sx: r, sy: r * 0.85, sz: r });
  }
}

function bench(m, x, z) {
  for (let k = 0; k < 3; k++) m.add(roundedBox(2.2, 0.08, 0.16, 0.03), '#a8743f', { x, y: 0.62, z: z - 0.2 + k * 0.2 });
  for (let k = 0; k < 2; k++) m.add(roundedBox(2.2, 0.14, 0.06, 0.03), '#a8743f', { x, y: 0.9 + k * 0.2, z: z + 0.25, rx: -0.15 });
  for (const s of [-1, 1]) m.add(roundedBox(0.08, 0.6, 0.6, 0.03), '#2b2522', { x: x + s * 1.0, y: 0.5, z });
}

function lamp(m, lampGlass, out, x, z) {
  // Victorian lamp post: fluted base, slim pole, a lantern on top
  m.add(SHAPES.cyl, '#1e5a46', { x, y: 0.45, z, sx: 0.42, sy: 0.7, sz: 0.42 });
  m.add(SHAPES.cyl, '#1e5a46', { x, y: 0.82, z, sx: 0.3, sy: 0.12, sz: 0.3 });
  m.add(SHAPES.cylLo, '#1e5a46', { x, y: 2.4, z, sx: 0.15, sy: 3.4, sz: 0.15 });
  m.add(SHAPES.cyl, '#1e5a46', { x, y: 4.1, z, sx: 0.36, sy: 0.12, sz: 0.36 });
  lampGlass.add(SHAPES.cyl, '#fff2c4', { x, y: 4.45, z, sx: 0.46, sy: 0.6, sz: 0.46 });
  for (let k = 0; k < 4; k++) m.add(roundedBox(0.05, 0.62, 0.05, 0.02), '#1e5a46', { x: x + Math.cos(k * Math.PI / 2 + 0.78) * 0.24, y: 4.45, z: z + Math.sin(k * Math.PI / 2 + 0.78) * 0.24 });
  m.add(SHAPES.cone, '#1e5a46', { x, y: 4.9, z, sx: 0.62, sy: 0.32, sz: 0.62 });
  m.add(SHAPES.sphereLo, '#1e5a46', { x, y: 5.1, z, sx: 0.12, sy: 0.12, sz: 0.12 });
  out.lamps.push(new THREE.Vector3(x, 4.3, z));
}

function hadeda(scene, x, y, z) {
  const m = new Merger();
  m.add(SHAPES.sphereLo, '#7d7466', { y: 0.12, sx: 0.5, sy: 0.3, sz: 0.28, rz: -0.25 });
  m.add(SHAPES.sphereLo, '#8a8273', { x: 0.27, y: 0.26, sx: 0.16, sy: 0.15, sz: 0.15 });
  m.add(SHAPES.cone, '#3a3530', { x: 0.45, y: 0.2, sx: 0.04, sy: 0.32, sz: 0.04, rz: -2.0 }); // long curved-ish beak
  m.add(SHAPES.sphereLo, '#5b8f6a', { x: -0.05, y: 0.16, z: 0.12, sx: 0.3, sy: 0.14, sz: 0.06 }); // green shoulder sheen
  for (const s of [-1, 1]) m.add(SHAPES.cylLo, '#3a3530', { x: 0, y: -0.07, z: s * 0.05, sx: 0.02, sy: 0.18, sz: 0.02 });
  const b = inked(m.build(), toon(), INK_PROP);
  b.position.set(x, y, z);
  b.rotation.y = Math.random() * Math.PI;
  scene.add(b);
  return b;
}

function washingLine(scene, out, x0, z, w) {
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, w, 4), new THREE.MeshBasicMaterial({ color: '#f2efe6' }));
  line.rotation.z = Math.PI / 2;
  line.position.set(x0 + w / 2, 4.6, z + 1.25);
  scene.add(line);
  const cols = ['#ff5fa2', '#ffd23f', '#3cc9c9', '#ffffff', '#7ed957', '#4aa3ff', '#ff8c42'];
  for (let k = 0; k < 7; k++) {
    const shirt = k % 3 !== 2;
    const g = shirt ? roundedBox(0.7, 0.8, 0.04, 0.02) : roundedBox(0.45, 0.9, 0.04, 0.02);
    const cl = inked(g, new THREE.MeshToonMaterial({ color: cols[k], gradientMap: null }), INK_PROP);
    cl.position.set(x0 + 0.6 + k * 0.95, 4.6 - 0.42, z + 1.25);
    scene.add(cl);
    out.clothes.push(cl);
  }
}

function minibus(scene, x, z) {
  const g = new THREE.Group();
  const m = new Merger();
  m.add(roundedBox(5.2, 1.5, 2.1, 0.35), '#f7f4ee', { y: 1.15 });
  m.add(roundedBox(4.6, 0.85, 2.0, 0.3), '#f7f4ee', { x: -0.25, y: 2.15 });
  m.add(roundedBox(5.25, 0.2, 2.15, 0.08), '#3cc9c9', { y: 1.15 }); // stripe
  m.add(roundedBox(5.25, 0.08, 2.15, 0.03), '#ff5fa2', { y: 0.98 });
  m.add(roundedBox(0.3, 0.3, 1.8, 0.12), '#bfb2a2', { x: 2.65, y: 0.6 }); // bumper
  m.add(roundedBox(0.3, 0.3, 1.8, 0.12), '#bfb2a2', { x: -2.65, y: 0.6 });
  for (const s of [-1, 1]) m.add(SHAPES.sphereLo, '#fff6c8', { x: 2.6, y: 1.05, z: s * 0.7, sx: 0.1, sy: 0.22, sz: 0.3 });
  m.add(roundedBox(1.2, 0.35, 0.8, 0.12), '#2b2522', { x: -0.5, y: 2.7 }); // roof rack
  g.add(inked(m.build(), toon(), INK_PROP));
  const win = new Merger();
  win.add(roundedBox(4.0, 0.62, 2.04, 0.22), '#24384d', { x: -0.35, y: 2.15 });
  win.add(roundedBox(0.1, 0.62, 1.7, 0.05), '#24384d', { x: 1.95, y: 2.1, rz: -0.25 });
  g.add(new THREE.Mesh(win.build(), toon()));
  const wheel = new Merger();
  for (const wx of [-1.7, 1.7]) {
    for (const s of [-1, 1]) {
      wheel.add(SHAPES.cyl, '#1e1b19', { x: wx, y: 0.45, z: s * 0.98, sx: 0.9, sy: 0.32, sz: 0.9, rx: Math.PI / 2 });
      wheel.add(SHAPES.cyl, '#cfd3d6', { x: wx, y: 0.45, z: s * 1.15, sx: 0.4, sy: 0.04, sz: 0.4, rx: Math.PI / 2 });
    }
  }
  g.add(inked(wheel.build(), toon(), INK_PROP));
  const name = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshBasicMaterial({ map: signTexture('SHARP SHARP EXPRESS', { bg: '#00000000', fg: '#e03c31', w: 512, h: 96 }), transparent: true }));
  name.position.set(0.1, 1.55, 1.075);
  g.add(name);
  g.position.set(x, 0, z);
  g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  scene.add(g);
  return g;
}

/** Hazy mountain layers: further = lighter and bluer (painted atmospheric perspective). */
function backdrop(scene, out) {
  out.backdrop = [];
  // each layer is shaded from its colour at the top to the haze colour at its foot (set per mood)
  const layer = (pts, z) => {
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], -30);
    for (const [px, py] of pts) sh.lineTo(px, py);
    sh.lineTo(pts[pts.length - 1][0], -30);
    const geo = new THREE.ShapeGeometry(sh, 4);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    mesh.position.z = z;
    mesh.userData.top = Math.max(...pts.map((p) => p[1]));
    scene.add(mesh);
    out.backdrop.push(mesh);
    return mesh;
  };
  // Table Mountain: long flat top with cliffs, Devil's Peak to the east; Lion's Head and Signal Hill to the west
  layer([[-420, 0], [-310, 14], [-250, 50], [-222, 84], [-210, 94], [70, 96], [84, 90], [104, 80], [126, 88], [146, 76], [200, 46], [300, 20], [420, 6]], -380);
  layer([[-420, 0], [-300, 12], [-250, 40], [-226, 62], [-214, 66], [-202, 58], [-178, 32], [-130, 16], [-60, 8], [40, 2], [420, 1]], -250);
  layer([[-300, 0], [-200, 9], [-120, 17], [-60, 15], [40, 8], [160, 11], [300, 2]], -120);
  // the tablecloth cloud pouring over the top
  const cloud = new THREE.Group();
  // a flat white blanket on the table top, with wisps hanging down the face
  for (let k = 0; k < 18; k++) {
    const s = new THREE.Mesh(SHAPES.sphereLo, new THREE.MeshBasicMaterial({ color: '#f6f1ff', fog: false, transparent: true, opacity: 0.96 }));
    s.position.set(-195 + k * 15 + Math.sin(k) * 3, 96.5, -372);
    s.scale.set(30, 6, 4);
    s.userData.y0 = s.position.y;
    s.userData.flow = 0;
    cloud.add(s);
  }
  for (let k = 0; k < 9; k++) {
    const s = new THREE.Mesh(SHAPES.sphereLo, new THREE.MeshBasicMaterial({ color: '#f6f1ff', fog: false, transparent: true, opacity: 0.7 }));
    s.position.set(-170 + k * 28 + Math.cos(k * 2.3) * 6, 89, -370);
    s.scale.set(16, 10, 3);
    s.userData.y0 = s.position.y;
    s.userData.flow = 1;
    cloud.add(s);
  }
  scene.add(cloud);
  out.cloud = cloud;
}

// Cape Dutch gable outline: S-curves rising to a rounded crown
function gableShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.bezierCurveTo(-w / 2, h * 0.35, -w * 0.2, h * 0.3, -w * 0.22, h * 0.62);
  s.bezierCurveTo(-w * 0.24, h * 1.02, w * 0.24, h * 1.02, w * 0.22, h * 0.62);
  s.bezierCurveTo(w * 0.2, h * 0.3, w / 2, h * 0.35, w / 2, 0);
  s.lineTo(-w / 2, 0);
  return s;
}
const extrude = (sh, d) => {
  const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 16 });
  g.computeVertexNormals();
  return g;
};
const GABLE = extrude(gableShape(3.0, 1.8), 0.3);
const GABLE_TRIM = extrude(gableShape(3.36, 2.08), 0.3);

function muralLot(scene, m, cx, front, w) {
  // garden wall with a big mural, a gate, and a tree peeking over
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(w - 1.2, 2.9), new THREE.MeshToonMaterial({ map: muralTexture(), gradientMap: null }));
  mural.position.set(cx, 1.75, front + 0.01);
  mural.receiveShadow = true;
  scene.add(mural);
  m.add(roundedBox(w, 3.4, 0.5, 0.1), '#f2e4cf', { x: cx, y: 1.7, z: front - 0.26 });
  m.add(roundedBox(w + 0.2, 0.2, 0.7, 0.07), TRIM, { x: cx, y: 3.45, z: front - 0.26 });
  bigTree(m, cx + 2, front - 4.5);
  m.add(roundedBox(w, 0.2, 8, 0.05), '#86b85f', { x: cx, y: 0.05, z: front - 4.3 });
}

function shade(hex, f) {
  return new THREE.Color(hex).multiplyScalar(f);
}
