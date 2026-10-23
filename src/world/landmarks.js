// Hand-built Cape Town landmarks (stylised). Static parts are merged; a few pieces animate.

import * as THREE from 'three';
import { MeshKit, GEO, vcMaterial } from '../core/meshkit.js';
import { RAMP_SOFT, outlineMaterial, roundedBox } from '../core/toon.js';
import { POI, PLATEAU } from './mapData.js';
import { T } from './grid.js';
import { RNG } from '../core/util.js';
import { makeSignTexture, makeStripesTexture, makeClockTexture, makeMuralTexture, makeGlowTexture } from './textures.js';

const toonM = (o) => new THREE.MeshToonMaterial({ gradientMap: RAMP_SOFT, ...o });
const INK = new THREE.MeshBasicMaterial({ color: '#2a1d17', side: THREE.BackSide });
/** Cartoon outline for a closed mesh centred on its origin: a slightly bigger copy drawn back faces only. */
function inkShell(mesh, pad = 0.04) {
  const o = new THREE.Mesh(mesh.geometry, INK);
  o.scale.setScalar(1 + pad);
  o.raycast = () => {};
  mesh.add(o);
  return o;
}

export class Landmarks {
  constructor(root, grid, city) {
    this.root = root;
    this.grid = grid;
    this.city = city;
    this.kit = new MeshKit();
    this.anim = [];
    this.smokeSpots = [{ x: 640, y: 3.5, z: 108 }];
    this.muralSpots = [];
  }

  sign(text, x, y, z, ry, w, h, opts = {}) {
    const tex = makeSignTexture(text, { w: 512, h: Math.round((512 * h) / w), ...opts });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color: '#e6e6e6', side: opts.double ? THREE.DoubleSide : THREE.FrontSide }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    this.root.add(m);
    return m;
  }

  build() {
    const k = this.kit;
    this.cityHall(k);
    this.policeStation(k);
    this.station(k);
    this.hospital(k);
    this.lighthouse(k);
    this.waterfront(k);
    this.bokaap(k);
    this.silverleaf(k);
    this.cableway(k);
    this.beach(k);
    this.stadium(k);
    this.castle();
    this.misc(k);
    this.murals();
    this.boats();
    this.billboards(k);
    const mesh = new THREE.Mesh(k.build(), vcMaterial());
    mesh.name = 'landmarks';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const ink = new THREE.Mesh(mesh.geometry, outlineMaterial('#2a1d17', 0.09));
    ink.raycast = () => {};
    mesh.add(ink);
    this.root.add(mesh);
  }

  cityHall(k) {
    const sand = '#d6b27a', trim = '#efe0c0';
    k.block(215, 0, -271, 42, 15, 18, sand);
    k.block(215, 15, -271, 43, 1, 19, trim);
    k.block(215, 0, -263.5, 20, 12, 3, trim); // portico
    for (let i = 0; i < 6; i++) k.cyl(206.5 + i * 3.4, 0, -261.6, 0.55, 12, '#f3e7cc', 8);
    k.block(215, 12, -261.8, 21, 2.2, 2, sand);
    k.block(215, 0, -272, 8, 30, 8, sand); // clock tower
    k.block(215, 30, -272, 9, 1, 9, trim);
    k.block(215, 31, -272, 6, 4, 6, sand);
    k.cone(215, 35, -272, 4.6, 5, '#7c8a6a', { four: true, ry: Math.PI / 4 });
    k.block(215, 0, -248, 54, 0.15, 0.6, '#bdb5a4'); // parade kerb
    const clock = makeClockTexture();
    const cm = new THREE.MeshBasicMaterial({ map: clock });
    for (const [x, z, ry] of [[215, -276.05, Math.PI], [215, -267.95, 0], [210.95, -272, -Math.PI / 2], [219.05, -272, Math.PI / 2]]) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), cm);
      m.position.set(x, 26, z);
      m.rotation.y = ry;
      this.root.add(m);
    }
    this.sign('CITY HALL', 215, 13.4, -260.7, 0, 12, 1.6, { bg: '#d6b27a', fg: '#3b2a14' });
    // Grand Parade market stalls
    const awn = ['#c0392b', '#2e86c1', '#f1c40f', '#27ae60'];
    for (let i = 0; i < 4; i++) {
      const x = 195 + i * 7;
      k.block(x, 0, -236, 4, 1, 2.5, '#8b6b4a');
      for (const dx of [-1.8, 1.8]) for (const dz of [-1.1, 1.1]) k.cyl(x + dx, 0, -236 + dz, 0.06, 2.6, '#555', 6);
      k.block(x, 2.6, -236, 4.4, 0.15, 3, awn[i]);
    }
  }

  policeStation(k) {
    k.block(215, 0, -199, 38, 12, 22, '#6f8aa8');
    k.block(215, 12, -199, 38.6, 0.8, 22.6, '#e3e7ea');
    k.block(215, 0, -187.6, 8, 4, 1.2, '#e3e7ea');
    for (let i = 0; i < 8; i++) k.block(199 + i * 4.6, 3.2, -187.95, 2.4, 6, 0.1, '#2b3a4a');
    this.sign('POLICE', 215, 9.5, -187.9, 0, 10, 2, { bg: '#1f3f8f', fg: '#ffffff' });
    k.cyl(203, 0, -185, 0.08, 7, '#ccc', 6);
    k.block(203.7, 6, -185, 1.4, 0.9, 0.05, '#2d6cdf'); // flag
  }

  station(k) {
    k.block(145, 0, -344, 50, 9, 12, '#c9c3b5');
    k.block(145, 9, -344, 51, 0.6, 13, '#9b958a');
    for (let i = 0; i < 10; i++) k.block(124 + i * 4.6, 2, -337.9, 3, 5, 0.1, '#3a4650');
    this.sign('CAPE TOWN STATION', 145, 7.3, -337.85, 0, 18, 1.8, { bg: '#26313a', fg: '#ffd84a' });
    // taxi rank canopies
    for (const z of [-326, -309]) {
      for (let i = 0; i <= 5; i++) k.cyl(124 + i * 9, 0, z, 0.12, 3.4, '#6f6f6f', 6);
      k.block(146, 3.4, z, 50, 0.25, 6, '#3c7a4a');
    }
    this.sign('TAXI RANK', 146, 4.6, -305.9, 0, 10, 1.4, { bg: '#3c7a4a', fg: '#fff' });
  }

  hospital(k) {
    k.block(296, 0, 45, 60, 18, 42, '#eef1f2');
    for (let f = 0; f < 4; f++) k.block(296, 2.5 + f * 4, 23.95, 58, 1.6, 0.1, '#5b8fa8');
    k.block(296, 18, 45, 60.6, 0.8, 42.6, '#c9d3d6');
    k.block(296, 0, 21.5, 14, 4, 5, '#dfe6e8');
    this.sign('CITY HOSPITAL', 296, 15.5, 23.9, Math.PI, 18, 2.2, { bg: '#ffffff', fg: '#c0392b' });
    k.block(282, 16.5, 23.8, 0.8, 2.6, 0.2, '#d62828');
    k.block(282, 16.5, 23.8, 2.6, 0.8, 0.2, '#d62828');
  }

  lighthouse(k) {
    const { x, z } = POI.lighthouse;
    const tex = makeStripesTexture('#d6362b', '#f7f7f2', 7, true);
    tex.repeat.set(1, 1.5);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(5, 16, 5), toonM({ map: tex }));
    tower.position.set(x, 8, z);
    tower.castShadow = true;
    inkShell(tower, 0.03);
    this.root.add(tower);
    k.block(x, 16, z, 6, 0.4, 6, '#333');
    k.cyl(x, 16.4, z, 1.6, 2.2, '#ffe9a8', 8);
    k.cone(x, 18.6, z, 2, 1.6, '#c0392b');
    // rotating beam (night)
    const beamMat = new THREE.MeshBasicMaterial({ map: makeGlowTexture(), color: '#fff3c0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Group();
    for (const s of [1, -1]) {
      const g = new THREE.ConeGeometry(4, 60, 12, 1, true);
      g.rotateZ((s * Math.PI) / 2);
      g.translate(s * 30, 0, 0);
      beam.add(new THREE.Mesh(g, beamMat));
    }
    beam.position.set(x, 17.5, z);
    this.root.add(beam);
    this.anim.push((t, env) => {
      beam.rotation.y = t * 0.8;
      beamMat.opacity = env.night * 0.35;
    });
  }

  waterfront(k) {
    // quay edges + bollards around the basin
    k.block(140, 0, -455.6, 82, 0.6, 1.2, '#e0d2b4');
    k.block(140, 0, -404.4, 82, 0.6, 1.2, '#e0d2b4');
    k.block(99.4, 0, -430, 1.2, 0.6, 52, '#e0d2b4');
    k.block(180.6, 0, -430, 1.2, 0.6, 52, '#e0d2b4');
    for (let i = 0; i < 9; i++) k.cyl(104 + i * 9, 0.6, -456.6, 0.32, 0.7, '#3a3f44', 8);
    // clock tower
    const { x: cx, z: cz } = POI.clockTower;
    k.block(cx, 0, cz, 6, 12, 6, '#e0553c');
    for (const y of [3.6, 7.4]) k.block(cx, y, cz, 6.3, 0.4, 6.3, '#fbf6ea');
    k.block(cx, 12, cz, 6.6, 0.6, 6.6, '#f2ede2');
    k.block(cx, 12.6, cz, 4.4, 2.6, 4.4, '#e0553c');
    k.cone(cx, 15.2, cz, 3.6, 4.5, '#3f9a7a', { four: true, ry: Math.PI / 4 });
    k.cyl(cx, 19.7, cz, 0.12, 1.4, '#ffc928', 6);
    const clock = new THREE.MeshBasicMaterial({ map: makeClockTexture() });
    for (const [x, z, ry] of [[cx, cz + 3.05, 0], [cx, cz - 3.05, Math.PI], [cx + 3.05, cz, Math.PI / 2], [cx - 3.05, cz, -Math.PI / 2]]) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1.5, 16), clock);
      m.position.set(x, 9.5, z);
      m.rotation.y = ry;
      this.root.add(m);
    }
    // the wharf shopping centre
    k.block(227, 0, -439, 70, 14, 66, '#fff1d6');
    // ground-floor shopfront glass with white mullions, upper-floor windows, on the quay and basin sides
    k.block(227, 5, -405.9, 66, 4, 0.2, '#3c6a8c');
    for (let i = 0; i <= 16; i++) k.block(194 + i * 4.125, 5, -405.75, 0.35, 4, 0.2, '#fbf6ea');
    k.block(227, 9.4, -405.6, 70.6, 0.7, 0.8, '#fbf6ea'); // cornice over the glass
    for (let i = 0; i < 11; i++) {
      if (Math.abs(197 + i * 6 - 227) < 9) continue; // the sign hangs here
      k.block(197 + i * 6, 10.8, -405.85, 3.4, 2.2, 0.2, '#fbf6ea');
      k.block(197 + i * 6, 11.05, -405.75, 2.8, 1.7, 0.2, '#3c6a8c');
    }
    k.block(191.9, 5, -439, 0.2, 4, 60, '#3c6a8c');
    for (let i = 0; i <= 14; i++) k.block(191.75, 5, -469 + i * (60 / 14), 0.2, 4, 0.35, '#fbf6ea');
    k.block(191.6, 9.4, -439, 0.8, 0.7, 66.6, '#fbf6ea');
    for (let i = 0; i < 10; i++) {
      k.block(191.85, 10.8, -466 + i * 6, 0.2, 2.2, 3.4, '#fbf6ea');
      k.block(191.75, 11.05, -466 + i * 6, 0.2, 1.7, 2.8, '#3c6a8c');
    }
    // striped shop awnings along the quay
    const aw = ['#e2483d', '#3a8ad4', '#ffc928', '#5fd35a'];
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 4; j++) k.block(197 + i * 8.6 - 2.4 + j * 1.6, 4.5, -404.9, 1.6, 0.22, 2.2, j % 2 ? '#ffffff' : aw[i % 4], { rx: 0.35 });
    }
    k.block(227, 14, -439, 71, 1, 67, '#e0553c');
    k.block(227, 15, -439, 30, 3, 20, '#9fd0e6');
    k.block(227, 18, -439, 31, 0.5, 21, '#fbf6ea');
    this.sign('THE WHARF', 227, 11, -405.8, 0, 16, 2.2, { bg: '#1c3b52', fg: '#ffffff' });
    // aquarium
    k.block(60, 0, -471, 48, 9, 14, '#3fa9d8');
    k.block(60, 2.2, -463.95, 48.2, 0.6, 0.2, '#ffffff');
    for (let i = 0; i < 6; i++) k.cyl(40 + i * 8, 4.2, -463.9, 1.1, 0.12, '#1d5f86', 12, { rx: Math.PI / 2 });
    k.block(60, 9, -471, 48.6, 0.6, 14.6, '#fbf6ea');
    this.sign('AQUARIUM', 60, 6.5, -463.9, 0, 12, 2, { bg: '#e8f1f5', fg: '#1d5f86' });
    // fish & chips stall
    k.block(60, 0, -405.5, 6, 2.6, 4.5, '#fbf6ea');
    for (let j = 0; j < 5; j++) k.block(57.2 + j * 1.4, 2.6, -404.7, 1.4, 0.3, 6, j % 2 ? '#ffffff' : '#3a8ad4');
    this.sign('FISH & CHIPS', 60, 3.4, -402.2, 0, 5, 0.9, { bg: '#2e86c1', fg: '#fff' });
    // helipad
    const { x: hx, z: hz } = POI.helipad;
    k.cyl(hx, 0, hz, 6, 0.08, '#555b60', 24);
    k.block(hx, 0.08, hz, 0.8, 0.02, 5, '#f2f2f2');
    k.block(hx - 1.6, 0.08, hz, 0.8, 0.02, 5, '#f2f2f2');
    k.block(hx + 1.6, 0.08, hz, 0.8, 0.02, 5, '#f2f2f2');
    k.block(hx, 0.08, hz, 3.2, 0.02, 0.8, '#f2f2f2');
    // Big wheel (axis along x)
    const { x: wx, z: wz } = POI.capeWheel;
    for (const sx of [-3.2, 3.2]) {
      k.add(GEO.box, { x: wx + sx, y: 10, z: wz - 5, sx: 0.6, sy: 21, sz: 0.6, rx: -0.45, color: '#d9dde0' });
      k.add(GEO.box, { x: wx + sx, y: 10, z: wz + 5, sx: 0.6, sy: 21, sz: 0.6, rx: 0.45, color: '#d9dde0' });
    }
    k.block(wx, 0, wz, 8, 0.8, 14, '#9e9a90');
    const wheel = new THREE.Group();
    wheel.position.set(wx, 19.5, wz);
    const wmat = toonM({ color: '#ffffff' });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(16, 0.35, 6, 48), wmat);
    rim.rotation.y = Math.PI / 2;
    wheel.add(rim);
    const rim2 = rim.clone();
    rim2.scale.setScalar(0.97);
    wheel.add(rim2);
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.15, 32, 0.15), wmat);
      s.rotation.x = (i / 12) * Math.PI;
      wheel.add(s);
    }
    this.root.add(wheel);
    const gondolas = [];
    const gcols = ['#f25f5c', '#ffc928', '#3a8ad4', '#5fd35a', '#a86cf0', '#ff8c42'];
    for (let i = 0; i < 18; i++) {
      const g = new THREE.Mesh(roundedBox(1.7, 1.9, 1.7, 0.45, 2), toonM({ color: gcols[i % gcols.length] }));
      inkShell(g, 0.07);
      this.root.add(g);
      gondolas.push(g);
    }
    this.anim.push((t) => {
      const a0 = t * 0.06;
      wheel.rotation.x = a0;
      gondolas.forEach((g, i) => {
        const a = a0 + (i / gondolas.length) * Math.PI * 2;
        g.position.set(wx, 19.5 + Math.cos(a) * 16 - 1.2, wz + Math.sin(a) * 16);
      });
    });
  }

  bokaap(k) {
    // Auwal-style mosque with green dome and minaret
    const { x, z } = POI.mosque;
    k.block(x - 2, 0, z, 16, 8, 16, '#f4f1e8');
    k.add(GEO.sphere, { x: x - 2, y: 8.6, z, sx: 7, sy: 6, sz: 7, color: '#2f8a4f' });
    k.block(x + 6, 0, z - 5, 5, 20, 5, '#f4f1e8');
    k.block(x + 6, 20, z - 5, 5.6, 0.6, 5.6, '#2f8a4f');
    k.cone(x + 6, 20.6, z - 5, 2.4, 4, '#2f8a4f');
    // Rashieda's spice shop (hot pink) with stoep
    k.block(-160, 0, -180, 20, 8, 12, '#ff5fa2');
    k.block(-160, 8, -180, 20.4, 0.6, 12.4, '#ffffff');
    k.block(-160, 0, -173.6, 4, 3.2, 0.3, '#7a3b1e');
    k.block(-152, 0, -173.7, 2.2, 3, 0.2, '#3a5a8c'); // stair door to Sizwe's room
    k.block(-166, 1.2, -173.7, 3, 1.8, 0.2, '#3d4a55');
    this.sign("RASHIEDA'S SPICES", -160, 5.6, -173.6, 0, 9, 1.2, { bg: '#fff3c4', fg: '#a8327a' });
    // spice sacks on the stoep
    const sp = ['#d35400', '#f1c40f', '#c0392b', '#7e5109'];
    for (let i = 0; i < 4; i++) k.cyl(-167 + i * 1.6, 0, -170.5, 0.6, 0.9, sp[i], 8);
    // Noon Gun on Signal Hill
    const { x: gx, z: gz } = POI.noonGun;
    k.block(gx, 0, gz, 12, 0.6, 8, '#a59d8c');
    for (const dx of [-2.5, 2.5]) {
      k.add(GEO.cyl8, { x: gx + dx, y: 1.6, z: gz - 0.8, sx: 0.8, sy: 4, sz: 0.8, rx: Math.PI / 2 - 0.15, color: '#222' });
      k.add(GEO.cyl12, { x: gx + dx - 0.6, y: 1.2, z: gz, sx: 1.8, sy: 0.2, sz: 1.8, rz: Math.PI / 2, color: '#5a3d22' });
      k.add(GEO.cyl12, { x: gx + dx + 0.6, y: 1.2, z: gz, sx: 1.8, sy: 0.2, sz: 1.8, rz: Math.PI / 2, color: '#5a3d22' });
    }
    this.sign('NOON GUN', gx, 1.8, gz + 4.2, 0, 4, 1, { bg: '#5a3d22', fg: '#fff' });
  }

  silverleaf(k) {
    const wall = '#9a9a94';
    k.block(475, 0, -209, 70, 2.4, 1, wall);
    k.block(441, 0, -185, 1, 2.4, 50, wall);
    k.block(509, 0, -185, 1, 2.4, 50, wall);
    k.block(453, 0, -161, 26, 2.4, 1, wall);
    k.block(497, 0, -161, 26, 2.4, 1, wall);
    for (const x of [466.5, 483.5]) k.block(x, 0, -161, 1.6, 3.2, 1.6, '#6b6b66');
    k.block(491, 0, -202, 18, 3.6, 8, '#e8e8e0'); // site office
    k.block(491, 3.6, -202, 18.6, 0.2, 8.6, '#9aa0a6');
    k.block(486, 0, -197.9, 1.4, 2.4, 0.1, '#3a3a3a');
    for (let i = 0; i < 3; i++) k.block(492 + i * 4, 1.4, -197.95, 2.2, 1.2, 0.1, '#3d4a55');
    k.block(452, 0, -203, 12, 2.6, 6, '#c9622f');
    k.block(452, 2.6, -203, 12, 2.6, 6, '#2f5d8c');
    k.block(452, 0, -193, 12, 2.6, 6, '#3f7f4f');
    k.block(503, 0, -172, 6, 2.6, 12, '#b9a23a');
    // billboard by the gate
    k.cyl(462, 0, -158, 0.15, 7, '#555', 6);
    k.cyl(470, 0, -158, 0.15, 7, '#555', 6);
    this.sign('SILVERLEAF DEVELOPMENTS', 466, 6, -157.6, 0, 11, 2.4, { bg: '#13202b', fg: '#c7d3dc', sub: 'BUILDING TOMORROW, TODAY' });
  }

  cableway(k) {
    const { x, z } = POI.cableLower;
    k.block(x, 0, z + 7, 16, 7, 10, '#c9c4b8');
    k.block(x, 7, z + 7, 17, 0.6, 11, '#8a3b2e');
    this.sign('CABLEWAY', x, 5.6, z + 1.9, Math.PI, 8, 1.4, { bg: '#8a3b2e', fg: '#fff' });
    const top = { x: POI.cableTop.x, y: PLATEAU.y, z: POI.cableTop.z };
    k.block(top.x, top.y - 2, top.z + 10, 14, 7, 9, '#c9c4b8');
    k.block(top.x, top.y + 5, top.z + 10, 15, 0.6, 10, '#8a3b2e');
    // viewpoint railing near the north edge
    k.block(POI.viewpoint.x - 3, top.y, POI.viewpoint.z - 3.2, 14, 1.05, 0.15, '#6b4f36');
    for (let i = 0; i < 5; i++) k.block(POI.viewpoint.x - 9.5 + i * 3.25, top.y, POI.viewpoint.z - 3.2, 0.18, 1.1, 0.18, '#4a3624');
    k.block(POI.viewpoint.x + 1, top.y, POI.viewpoint.z + 1.5, 2.4, 0.5, 0.7, '#7a5230'); // bench
    // cables
    const a = new THREE.Vector3(x, 6.5, z + 4), b = new THREE.Vector3(top.x, top.y + 4, top.z + 10);
    for (const off of [-0.8, 0.8]) {
      const len = a.distanceTo(b);
      const g = new THREE.CylinderGeometry(0.06, 0.06, len, 4);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#333' }));
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.position.x += off;
      m.lookAt(b.x + off, b.y, b.z);
      m.rotateX(Math.PI / 2);
      this.root.add(m);
    }
    const cabEnd = new THREE.Vector3(top.x, top.y + 4, top.z + 4);
    this.cableA = a;
    this.cableB = cabEnd;
    // rotating cabin
    const cab = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 2.6, 16), toonM({ color: '#ec3f2f' }));
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 1.1, 16), toonM({ color: '#4c6a7a' }));
    glass.position.y = 0.4;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 0.6, 16), toonM({ color: '#f2f2f2' }));
    roof.position.y = 1.6;
    const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 0.2), toonM({ color: '#444' }));
    hanger.position.y = 3;
    cab.add(body, glass, roof, hanger);
    inkShell(body, 0.05);
    inkShell(roof, 0.06);
    this.root.add(cab);
    this.cabin = cab;
    this.cabinT = 0;
    this.cabinOverride = null;
    this.anim.push((t, env, dt) => {
      let u;
      if (this.cabinOverride !== null) u = this.cabinOverride;
      else {
        const cyc = (t % 60) / 60;
        u = cyc < 0.5 ? cyc * 2 : 2 - cyc * 2;
        u = THREE.MathUtils.smoothstep(u, 0, 1);
      }
      cab.position.lerpVectors(a, cabEnd, u);
      cab.position.y -= 4.2;
      cab.rotation.y = t * 0.3;
    });
  }

  beach(k) {
    // lifeguard tower
    const { x, z } = POI.lifeguardTower;
    for (const dx of [-1.6, 1.6]) for (const dz of [-1.6, 1.6]) k.cyl(x + dx, 0, z + dz, 0.15, 3, '#e8e2d0', 6);
    k.block(x, 3, z, 4, 2.2, 4, '#d63a2f');
    k.block(x, 5.2, z, 4.6, 0.25, 4.6, '#f1c40f');
    k.block(x + 2.2, 3.5, z, 0.1, 1, 3, '#3d4a55');
    k.cyl(x - 2.5, 0, z + 2.5, 0.06, 6, '#ddd', 6);
    k.block(x - 1.8, 5.2, z + 2.5, 1.4, 0.9, 0.05, '#d63a2f');
    // umbrellas & towels on Camps Bay and Clifton
    const rng = new RNG(5);
    const cols = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#ff7eb6', '#ffffff', '#ff8c42'];
    const spots = [];
    for (let i = 0; i < 16; i++) spots.push([rng.range(-602, -584), rng.range(190, 380)]);
    for (let i = 0; i < 6; i++) spots.push([rng.range(-578, -560), rng.range(60, 150)]);
    for (const [ux, uz] of spots) {
      if (this.grid.typeAt(ux, uz) !== T.SAND) continue;
      const c = rng.pick(cols);
      k.cyl(ux, 0, uz, 0.05, 2.4, '#eee', 6);
      k.cone(ux, 2.0, uz, 1.5, 0.8, c);
      k.block(ux + 1.3, 0.02, uz + 0.3, 0.9, 0.02, 1.9, rng.pick(cols));
    }
    // Sea Point outdoor gym
    const g = POI.gym;
    for (let i = 0; i < 3; i++) {
      const gz = g.z - 3 + i * 3;
      k.cyl(g.x - 1.2, 0, gz, 0.07, 2.4, '#3a6ea5', 6);
      k.cyl(g.x + 1.2, 0, gz, 0.07, 2.4, '#3a6ea5', 6);
      k.add(GEO.cyl8, { x: g.x, y: 2.35, z: gz, sx: 0.12, sy: 2.5, sz: 0.12, rz: Math.PI / 2, color: '#d9d9d9' });
    }
    k.block(g.x + 3, 0, g.z, 1, 0.5, 2.2, '#3a6ea5');
    this.sign('OUTDOOR GYM', g.x + 3.5, 1.6, g.z + 4, Math.PI / 2, 3, 0.7, { bg: '#3a6ea5', fg: '#fff', double: true });
  }

  stadium(k) {
    const { x, z } = POI.stadium;
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(46, 44, 24, 48, 1, true), toonM({ color: '#ffffff' }));
    outer.position.set(x, 12, z);
    outer.castShadow = true;
    this.root.add(outer);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(47.1, 45.1, 25, 48), INK);
    shell.position.set(x, 12, z);
    this.root.add(shell);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(40, 28, 20, 48, 1, true), toonM({ color: '#e0473c', side: THREE.BackSide }));
    inner.position.set(x, 12, z);
    this.root.add(inner);
    k.cyl(x, 0, z, 28.5, 2.2, '#3f8f3a', 24);
    const roof = new THREE.Mesh(new THREE.RingGeometry(30, 46.5, 48), toonM({ color: '#f7f7f7', transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    roof.rotation.x = -Math.PI / 2;
    roof.position.set(x, 24.2, z);
    this.root.add(roof);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      k.block(x + Math.cos(a) * 45.4, 0, z + Math.sin(a) * 45.4, 1.2, 24, 1.2, '#d6d9d8', { ry: -a });
    }
  }

  castle() {
    const { x, z } = POI.castle;
    // pentagon of curtain walls (the five bastions sit on the corners)
    const k = this.kit;
    const R = 23.5, side = 2 * R * Math.sin(Math.PI / 5);
    for (let i = 0; i < 5; i++) {
      const a0 = 0.3 + (i / 5) * Math.PI * 2, a1 = 0.3 + ((i + 1) / 5) * Math.PI * 2;
      const mx = x + ((Math.cos(a0) + Math.cos(a1)) / 2) * R, mz = z + ((Math.sin(a0) + Math.sin(a1)) / 2) * R;
      k.block(mx, 0, mz, side + 3, 9, 7, '#f0c45a', { ry: -(a0 + a1) / 2 + Math.PI / 2 });
    }
    k.cyl(x, 0, z, 19.5, 0.05, '#c9b89a', 24);
    for (let i = 0; i < 5; i++) {
      const a = 0.3 + (i / 5) * Math.PI * 2;
      k.add(GEO.cone4, { x: x + Math.cos(a) * 28, y: 4.5, z: z + Math.sin(a) * 28, sx: 9, sy: 9, sz: 9, rx: 0, ry: -a + Math.PI / 4, color: '#e6b04c' });
    }
    k.block(x, 0, z, 10, 6, 8, '#e3cf9f');
    k.cyl(x - 22, 9, z + 3, 0.08, 6, '#ccc', 6);
    k.block(x - 21.1, 13.5, z + 3, 1.8, 1.1, 0.05, '#c0392b');
  }

  misc(k) {
    // shisa nyama
    const s = POI.shisaNyama;
    k.block(s.x, 0, s.z - 10, 12, 3, 8, '#c25e3c');
    k.block(s.x, 3, s.z - 10, 13, 0.25, 9, '#8f9599');
    for (const dx of [-3, 0, 3]) k.cyl(s.x + dx, 0, s.z - 3, 0.5, 1, '#2b2b2b', 8);
    for (let i = 0; i < 4; i++) k.block(s.x - 6 + i * 4, 0, s.z + 12, 3, 0.8, 1, '#7a5230');
    this.sign('SHISA NYAMA', s.x, 2.4, s.z - 5.9, 0, 7, 1.1, { bg: '#f1c40f', fg: '#5a1d0b' });
    // Lion's Head trail board
    const t = POI.trailhead;
    k.cyl(t.x - 1.5, 0, t.z - 6, 0.12, 2.6, '#6b4f36', 6);
    k.cyl(t.x + 1.5, 0, t.z - 6, 0.12, 2.6, '#6b4f36', 6);
    this.sign("LION'S HEAD TRAIL", t.x, 2.1, t.z - 5.8, 0, 3.6, 1, { bg: '#2f5a33', fg: '#fff' });
    k.block(t.x + 4, 0, t.z, 3, 0.5, 0.8, '#7a5230');
    // gatsby stall
    k.block(52, 0, -185, 6, 2.8, 6, '#f1c40f');
    k.block(51, 2.8, -185, 8, 0.25, 7, '#c0392b');
    this.sign('GATSBY', 48.4, 2.2, -185, -Math.PI / 2, 4, 0.9, { bg: '#c0392b', fg: '#fff' });
    // Langa taxi rank canopies
    for (const z of [22, 50]) {
      for (let i = 0; i <= 4; i++) k.cyl(534 + i * 13, 0, z, 0.12, 3.4, '#6f6f6f', 6);
      k.block(560, 3.4, z, 56, 0.25, 6, '#d2a43a');
    }
    this.sign('LANGA TAXI RANK', 560, 4.5, 53.1, 0, 10, 1.3, { bg: '#d2a43a', fg: '#2a1a05' });
    // soccer pitch
    const f = POI.soccerField;
    const line = '#f4f4f4';
    k.block(f.x, 0.02, f.z - 18, 56, 0.03, 0.4, line);
    k.block(f.x, 0.02, f.z + 18, 56, 0.03, 0.4, line);
    k.block(f.x - 28, 0.02, f.z, 0.4, 0.03, 36, line);
    k.block(f.x + 28, 0.02, f.z, 0.4, 0.03, 36, line);
    k.block(f.x, 0.02, f.z, 0.4, 0.03, 36, line);
    for (const gx of [-28, 28]) {
      k.cyl(f.x + gx, 0, f.z - 3.5, 0.1, 2.4, '#fff', 6);
      k.cyl(f.x + gx, 0, f.z + 3.5, 0.1, 2.4, '#fff', 6);
      k.block(f.x + gx, 2.3, f.z, 0.2, 0.2, 7.2, '#fff');
    }
    this.sign('UBUNTU PARK', f.x, 2.2, f.z - 20, Math.PI, 6, 1, { bg: '#1a7a3c', fg: '#fff', double: true });
  }

  murals() {
    const rng = new RNG(12);
    const cands = this.city.buildings.filter((b) => b.district === 'woodstock' && b.h >= 6);
    let placed = 0;
    for (const b of rng.shuffle(cands)) {
      if (placed >= 12) break;
      const faces = [
        { x: (b.x0 + b.x1) / 2, z: b.z1 + 0.06, ry: 0, w: b.x1 - b.x0, tx: 0, tz: 1.5 },
        { x: (b.x0 + b.x1) / 2, z: b.z0 - 0.06, ry: Math.PI, w: b.x1 - b.x0, tx: 0, tz: -1.5 },
        { x: b.x1 + 0.06, z: (b.z0 + b.z1) / 2, ry: Math.PI / 2, w: b.z1 - b.z0, tx: 1.5, tz: 0 },
        { x: b.x0 - 0.06, z: (b.z0 + b.z1) / 2, ry: -Math.PI / 2, w: b.z1 - b.z0, tx: -1.5, tz: 0 },
      ];
      const f = faces.find((f) => {
        const t = this.grid.typeAt(f.x + f.tx, f.z + f.tz);
        return t === T.WALK || t === T.ROAD;
      });
      if (!f || f.w < 8) continue;
      const w = Math.min(f.w * 0.85, 22), h = Math.min(b.h * 0.8, w / 2);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toonM({ map: makeMuralTexture(rng.int(1, 9999)) }));
      m.position.set(f.x, h / 2 + 0.4, f.z);
      m.rotation.y = f.ry;
      this.root.add(m);
      this.muralSpots.push({ x: f.x, y: h / 2 + 0.4, z: f.z, nx: Math.sign(f.tx), nz: Math.sign(f.tz) });
      placed++;
    }
  }

  boats() {
    const rng = new RNG(21);
    const boatInk = outlineMaterial('#2a1d17', 0.07);
    const mk = (x, z, scale, color) => {
      const g = new THREE.Group();
      const kk = new MeshKit(), ok = new MeshKit();
      const both = (geo, o) => { kk.add(geo, o); ok.add(geo, o); };
      // chubby rounded hull with a pointed bow, a white stripe and a little wheelhouse
      both(roundedBox(2.8, 1.2, 7, 0.45, 2), { x: 0, y: 0.6, z: 0, color });
      both(roundedBox(1.98, 1.2, 1.98, 0.45, 2), { x: 0, y: 0.6, z: 3.4, ry: Math.PI / 4, sz: 1.5, color });
      kk.add(roundedBox(2.86, 0.16, 6.4, 0.08, 1), { x: 0, y: 0.95, z: 0, color: color === '#ffffff' ? '#e2483d' : '#ffffff' });
      both(roundedBox(1.9, 1.4, 2.6, 0.25, 2), { x: 0, y: 1.85, z: -0.8, color: '#fbf6ea' });
      for (const sx of [1, -1]) kk.add(roundedBox(0.04, 0.5, 1.8, 0.02, 1), { x: sx * 0.96, y: 2.0, z: -0.8, color: '#3c6a8c' });
      kk.add(roundedBox(2.0, 0.14, 2.8, 0.06, 1), { x: 0, y: 2.6, z: -0.8, color });
      kk.cyl(0, 2.6, -0.2, 0.06, 4.2, '#e9e4d8', 6);
      kk.add(roundedBox(0.5, 0.3, 0.5, 0.12, 1), { x: 0, y: 1.3, z: -3.2, color: '#f7a92c' }); // life ring box
      const m = new THREE.Mesh(kk.build(), vcMaterial());
      const ink = new THREE.Mesh(ok.build(), boatInk);
      ink.raycast = () => {};
      m.add(ink);
      g.add(m);
      g.position.set(x, -0.2, z);
      g.scale.setScalar(scale);
      g.rotation.y = rng.range(0, Math.PI * 2);
      this.root.add(g);
      const ph = rng.range(0, 6);
      this.anim.push((t) => {
        g.position.y = -0.25 + Math.sin(t * 1.3 + ph) * 0.12;
        g.rotation.z = Math.sin(t * 0.9 + ph) * 0.04;
      });
    };
    for (let i = 0; i < 5; i++) mk(rng.range(110, 170), rng.range(-448, -412), rng.range(0.7, 1), rng.pick(['#ffffff', '#3a8ad4', '#e2483d', '#ffc928']));
    for (let i = 0; i < 4; i++) mk(rng.range(-200, 300), rng.range(-560, -480), rng.range(1, 1.4), rng.pick(['#ffffff', '#ffc928', '#3a8ad4', '#5fd35a']));
    // container ships out in Table Bay
    const shipInk = outlineMaterial('#2a1d17', 0.35);
    for (const [x, z, ry] of [[250, -760, 0.3], [-160, -820, -0.2], [600, -620, 1.2]]) {
      const kk = new MeshKit();
      kk.add(roundedBox(14, 6, 80, 2.4, 2), { x: 0, y: 1, z: 0, color: '#d8433a' });
      kk.add(roundedBox(14.1, 1, 79, 0.5, 1), { x: 0, y: 3.4, z: 0, color: '#fbf6ea' });
      kk.add(roundedBox(12, 9, 10, 1, 2), { x: 0, y: 8.5, z: -32, color: '#fbf6ea' });
      kk.add(roundedBox(12.1, 1.2, 10.1, 0.4, 1), { x: 0, y: 10.5, z: -32, color: '#3c6a8c' });
      const cc = ['#ff8c42', '#3a8ad4', '#5fd35a', '#ffc928', '#a86cf0', '#f25f5c'];
      for (let i = 0; i < 10; i++) {
        const h = rng.range(2.6, 7.8);
        kk.add(roundedBox(12, h, 5, 0.35, 1), { x: rng.range(-1, 1), y: 4 + h / 2, z: -22 + i * 5.5, color: rng.pick(cc) });
      }
      const m = new THREE.Mesh(kk.build(), vcMaterial());
      const ink = new THREE.Mesh(m.geometry, shipInk);
      ink.raycast = () => {};
      m.add(ink);
      m.position.set(x, 0, z);
      m.rotation.y = ry;
      this.root.add(m);
    }
  }

  billboards(k) {
    const boards = [
      { x: 380, z: -92, ry: Math.PI, text: 'MOTHER CITY FM', sub: '94.5 — AMAPIANO ALL DAY', bg: '#ff4f79' },
      { x: 600, z: -92, ry: Math.PI, text: 'SILVERLEAF', sub: 'LUXURY LIVING IS COMING', bg: '#13202b' },
      { x: -330, z: -276, ry: 0, text: 'LEKKER COLA', sub: 'ICE COLD, MY BRU', bg: '#c0392b' },
      { x: 30, z: -372, ry: Math.PI, text: 'KOEKSISTER KING', sub: 'BO-KAAP SINCE 1952', bg: '#f1c40f' },
    ];
    for (const b of boards) {
      k.cyl(b.x - 3, 0, b.z, 0.2, 8, '#555', 6);
      k.cyl(b.x + 3, 0, b.z, 0.2, 8, '#555', 6);
      const fg = b.bg === '#f1c40f' ? '#2a1a05' : '#ffffff';
      const s = this.sign(b.text, b.x, 9, b.z, b.ry, 12, 4, { bg: b.bg, fg, sub: b.sub, double: true });
      s.position.z += b.ry === 0 ? 0.2 : -0.2;
    }
  }

  update(t, env, dt) {
    for (const f of this.anim) f(t, env, dt);
  }
}
