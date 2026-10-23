// Sunny-toon vehicles: chunky rounded shells with ink outlines. Body is one vertex-coloured mesh
// (plus an outline hull of its main shells), lights an unlit mesh, wheels a shared instanced pool.

import * as THREE from 'three';
import { MeshKit, vcMaterial } from '../core/meshkit.js';
import { roundedBox, outlineMaterial } from '../core/toon.js';

export const VEHICLES = {
  sedan: { name: 'Sedan', len: 4.5, wid: 1.86, h: 1.45, maxSpeed: 34, accel: 15, brake: 32, reverse: 9, steer: 2.0, grip: 9, mass: 1, health: 100, wheelR: 0.36, colors: ['#e2483d', '#3b5f8a', '#c9d0d6', '#3fae6a', '#f4f1ea', '#9b5cc4', '#f08a2c', '#4a6274', '#8fa0a8'] },
  hatch: { name: 'Hatchback', len: 3.9, wid: 1.76, h: 1.5, maxSpeed: 31, accel: 14, brake: 32, reverse: 9, steer: 2.2, grip: 9.5, mass: 0.85, health: 90, wheelR: 0.33, colors: ['#f05a4a', '#f7b52c', '#3fa0e0', '#f4f1ea', '#22b59a', '#3a3f44', '#ff8fb8'] },
  minibus: { name: 'Minibus Taxi', len: 5.3, wid: 1.96, h: 2.15, maxSpeed: 28, accel: 10.5, brake: 26, reverse: 7, steer: 1.65, grip: 7.5, mass: 1.6, health: 150, wheelR: 0.38, colors: ['#f7f5ef'], stripes: ['#e2483d', '#3a8ad4', '#3fae6a', '#f7a92c'] },
  bakkie: { name: 'Bakkie', len: 5.1, wid: 1.9, h: 1.75, maxSpeed: 31, accel: 13, brake: 30, reverse: 8, steer: 1.8, grip: 8.5, mass: 1.35, health: 135, wheelR: 0.4, colors: ['#f4f1ea', '#e2483d', '#3b4f66', '#a9b3b8', '#e0c08e'] },
  police: { name: 'Police Car', len: 4.6, wid: 1.9, h: 1.5, maxSpeed: 39, accel: 18.5, brake: 36, reverse: 10, steer: 2.15, grip: 10, mass: 1.15, health: 140, wheelR: 0.37, colors: ['#f7f8fa'] },
  suv: { name: 'Luxury SUV', len: 4.9, wid: 2.0, h: 1.8, maxSpeed: 36, accel: 16, brake: 32, reverse: 9, steer: 1.9, grip: 9, mass: 1.7, health: 260, wheelR: 0.42, colors: ['#22262c'] },
  sports: { name: 'Sports Car', len: 4.35, wid: 1.92, h: 1.2, maxSpeed: 45, accel: 23, brake: 38, reverse: 10, steer: 2.3, grip: 10.5, mass: 0.95, health: 90, wheelR: 0.35, colors: ['#f0302c', '#ffd83a', '#2f86ea', '#ffffff', '#ff8a1e'] },
};

export function pickVehicleColor(type) {
  const s = VEHICLES[type];
  return s.colors[Math.floor(Math.random() * s.colors.length)];
}

const GLASS = '#2c4a66', GLASS_HI = '#8fb8d8';
const TRIM = '#34383d', CHROME = '#d4d8dc';

export function buildVehicleModel(type, color, opts = {}) {
  const s = VEHICLES[type];
  const k = new MeshKit(); // everything on the body
  const ok = new MeshKit(); // the shells that get an ink outline
  const lk = new MeshKit(); // unlit lights
  const { len: L, wid: W } = s;
  // rounded part centred at (x, y, z); `ink` also adds it to the outline hull
  const rb = (x, y, z, w, h, d, r, c, ink = false, rx = 0) => {
    // big shells get smooth corners; trim, lights and mirrors a cheap chamfer
    const g = roundedBox(w, h, d, r, ink || w * h * d > 0.4 ? 2 : 1);
    k.add(g, { x, y, z, rx, color: c });
    if (ink) ok.add(g, { x, y, z, rx });
  };
  // a block resting on y, like MeshKit.block
  const rbl = (x, y, z, w, h, d, r, c, ink) => rb(x, y + h / 2, z, w, h, d, r, c, ink);
  // shiny streak on a side window
  const shine = (y, z, h, d, halfW) => {
    for (const sx of [1, -1]) k.box(sx * (halfW + 0.004), y, z, 0.01, h, d, GLASS_HI, { rx: 0.5 });
  };
  // big round cartoon headlights, rounded tail lights
  const lights = (y, zFront, zBack, wHalf, hr = 0.14) => {
    for (const sx of [1, -1]) {
      lk.add(roundedBox(0.36, 0.17, 0.08, 0.06, 2), { x: sx * (wHalf - 0.26), y, z: zBack, color: '#ff3a26' });
      lk.add(roundedBox(hr * 2, hr * 2, 0.08, hr * 0.9, 2), { x: sx * (wHalf - 0.3), y, z: zFront, color: '#fff8dc' });
      k.add(roundedBox(hr * 2 + 0.1, hr * 2 + 0.1, 0.06, hr, 2), { x: sx * (wHalf - 0.3), y, z: zFront - 0.02, color: CHROME });
    }
  };
  const bumpers = (y, c = CHROME, front = L / 2, back = -L / 2) => {
    rb(0, y, front, W * 0.98, 0.22, 0.24, 0.1, c);
    rb(0, y, back, W * 0.98, 0.22, 0.24, 0.1, c);
  };
  let mirrorY = 1.05, mirrorZ = L * 0.18, barY = 1.56, barZ = -0.12;
  if (type === 'minibus') {
    // tall box with a short sloping nose, like a Quantum
    rbl(0, 0.3, -0.3, W, 1.62, L - 0.6, 0.26, color, true);
    rbl(0, 0.3, L / 2 - 0.55, W, 0.95, 1.1, 0.24, color, true);
    rbl(0, 1.24, -0.4, W + 0.03, 0.5, L - 1.1, 0.16, GLASS);
    rb(0, 1.52, L / 2 - 0.66, W * 0.86, 0.7, 0.12, 0.06, GLASS, false, -0.38); // raked windscreen
    rb(0, 0.98, 0, W + 0.04, 0.2, L - 0.3, 0.09, opts.stripe || '#e2483d');
    rbl(0, 1.9, -0.2, W * 0.86, 0.1, L * 0.66, 0.04, '#e3e1da'); // roof panel
    rb(0, 0.7, L / 2 + 0.03, W * 0.6, 0.18, 0.06, 0.05, TRIM); // grille
    shine(1.5, -0.2, 0.34, 0.5, W / 2 + 0.015);
    bumpers(0.45, TRIM);
    lights(0.88, L / 2 + 0.03, -L / 2 - 0.02, W / 2);
    mirrorY = 1.35;
    mirrorZ = L / 2 - 0.75;
  } else if (type === 'bakkie') {
    rbl(0, 0.34, 0, W, 0.74, L, 0.2, color, true);
    rbl(0, 0.98, 0.55, W * 0.88, 0.7, L * 0.36, 0.18, GLASS, true);
    rbl(0, 1.6, 0.55, W * 0.9, 0.14, L * 0.32, 0.06, color);
    rb(0, 1.28, 0.55, W * 0.89, 0.62, 0.12, 0.04, color); // B-pillar
    // load bed walls
    for (const sx of [1, -1]) rbl(sx * (W / 2 - 0.07), 1.0, -L * 0.25, 0.14, 0.42, L * 0.46, 0.06, color, true);
    rbl(0, 1.0, -L / 2 + 0.08, W, 0.42, 0.16, 0.06, color);
    k.block(0, 1.06, -L * 0.25, W - 0.26, 0.04, L * 0.44, '#4a4644');
    rb(0, 0.8, L / 2 + 0.02, W * 0.55, 0.2, 0.06, 0.05, TRIM);
    shine(1.32, 0.55, 0.3, 0.4, W * 0.44);
    bumpers(0.5);
    lights(0.9, L / 2 + 0.02, -L / 2 - 0.02, W / 2);
    mirrorY = 1.12;
  } else if (type === 'suv') {
    rbl(0, 0.38, 0, W, 0.84, L, 0.24, color, true);
    rbl(0, 1.12, -0.25, W * 0.9, 0.62, L * 0.62, 0.2, GLASS, true);
    rbl(0, 1.66, -0.25, W * 0.92, 0.14, L * 0.58, 0.06, color);
    rb(0, 1.4, -0.25, W * 0.91, 0.56, 0.14, 0.04, color); // B-pillar
    for (const sx of [1, -1]) k.box(sx * W * 0.36, 1.82, -0.25, 0.06, 0.06, L * 0.5, CHROME); // roof rails
    rb(0, 0.86, L / 2 + 0.02, W * 0.6, 0.24, 0.06, 0.06, CHROME); // grille
    shine(1.44, -0.4, 0.34, 0.6, W * 0.45);
    bumpers(0.55, TRIM);
    lights(0.98, L / 2 + 0.02, -L / 2 - 0.02, W / 2, 0.12);
    mirrorY = 1.2;
    barY = 1.86;
  } else if (type === 'sports') {
    rbl(0, 0.24, 0, W, 0.58, L, 0.26, color, true);
    rbl(0, 0.7, -0.35, W * 0.74, 0.46, L * 0.42, 0.2, GLASS, true);
    rbl(0, 1.08, -0.4, W * 0.7, 0.1, L * 0.28, 0.05, color);
    // spoiler on two struts
    rb(0, 1.0, -L / 2 + 0.22, W * 0.92, 0.07, 0.36, 0.03, TRIM);
    for (const sx of [1, -1]) k.box(sx * W * 0.3, 0.88, -L / 2 + 0.24, 0.06, 0.18, 0.12, TRIM);
    rb(0, 0.5, L / 2 + 0.01, W * 0.5, 0.12, 0.06, 0.04, TRIM); // air intake
    shine(0.92, -0.35, 0.24, 0.5, W * 0.37);
    bumpers(0.38, TRIM);
    lights(0.66, L / 2 + 0.01, -L / 2 - 0.01, W / 2, 0.12);
    mirrorY = 0.86;
  } else {
    // sedan / hatch / police
    const hatch = type === 'hatch';
    const cabLen = hatch ? L * 0.56 : L * 0.47;
    const cabZ = hatch ? -0.25 : -0.12;
    rbl(0, 0.34, 0, W, 0.66, L, 0.22, color, true);
    rbl(0, 0.9, cabZ, W * 0.86, 0.58, cabLen, 0.2, GLASS, true);
    rbl(0, 1.38, cabZ, W * 0.88, 0.12, cabLen * 0.84, 0.05, color);
    rb(0, 1.16, cabZ, W * 0.87, 0.5, 0.12, 0.04, color); // B-pillar
    shine(1.18, cabZ, 0.28, cabLen * 0.36, W * 0.43);
    rb(0, 0.72, L / 2 + 0.01, W * 0.5, 0.14, 0.06, 0.05, TRIM); // grille
    if (type === 'police') {
      rb(0, 0.74, 0, W + 0.03, 0.2, L * 0.94, 0.09, '#2457c8');
      rb(0, 0.6, 0, W + 0.025, 0.07, L * 0.94, 0.03, '#f5c518');
      rbl(0, 1.49, cabZ + cabLen * 0.32, W * 0.5, 0.03, 0.4, 0.015, '#2457c8');
    }
    if (opts.taxiSign) rbl(0, 1.48, cabZ, 0.62, 0.24, 0.26, 0.08, '#f7c51e', true);
    bumpers(0.5);
    lights(0.8, L / 2 + 0.02, -L / 2 - 0.02, W / 2);
    barZ = cabZ;
  }
  // mirrors
  for (const sx of [1, -1]) rb(sx * (W / 2 + 0.1), mirrorY, mirrorZ, 0.16, 0.12, 0.2, 0.05, TRIM);

  const group = new THREE.Group();
  const body = new THREE.Mesh(k.build(), bodyMaterial());
  body.castShadow = true;
  body.receiveShadow = false;
  group.add(body);
  const ink = new THREE.Mesh(ok.build(), carInkMat());
  ink.castShadow = false;
  ink.raycast = () => {};
  body.add(ink);
  const lm = new THREE.Mesh(lk.build(), lightMaterial());
  body.add(lm);
  let lightbar = null;
  if (type === 'police') {
    lightbar = { red: new THREE.MeshBasicMaterial({ color: '#550000' }), blue: new THREE.MeshBasicMaterial({ color: '#000055' }) };
    const pod = roundedBox(0.56, 0.16, 0.32, 0.07, 2);
    const r = new THREE.Mesh(pod.clone(), lightbar.red);
    r.position.set(-0.3, barY, barZ);
    const b = new THREE.Mesh(pod.clone(), lightbar.blue);
    b.position.set(0.3, barY, barZ);
    body.add(r, b);
  }
  // blob shadow under the car
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.15, L * 1.05), carBlobMat());
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.04;
  group.add(blob);
  const wx = W / 2 - 0.12, wz = L / 2 - (type === 'minibus' ? 0.95 : 0.8);
  const wheels = [
    { x: wx, z: wz, front: true }, { x: -wx, z: wz, front: true },
    { x: wx, z: -wz, front: false }, { x: -wx, z: -wz, front: false },
  ];
  return { group, body, wheels, lightbar };
}

let _bodyMat = null, _lightMat = null, _blob = null, _ink = null;
export function bodyMaterial() {
  return (_bodyMat ||= vcMaterial());
}
function carInkMat() {
  return (_ink ||= outlineMaterial('#2a1d17', 0.045));
}
function lightMaterial() {
  return (_lightMat ||= new THREE.MeshBasicMaterial({ vertexColors: true }));
}
function carBlobMat() {
  if (!_blob) {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(16, 32, 4, 16, 32, 30);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 64);
    _blob = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
  }
  return _blob;
}

/** One instanced mesh for every wheel in the city (plus one for their ink outlines). */
export class WheelPool {
  constructor(scene, max = 200) {
    // chunky tyre: a rounded drum, cream hubcap
    const tyre = new THREE.CylinderGeometry(1, 1, 1, 14);
    tyre.rotateZ(Math.PI / 2);
    const k = new MeshKit();
    k.add(tyre, { color: '#2a2a2e' });
    const hub = new THREE.CylinderGeometry(0.58, 0.58, 1.04, 12);
    hub.rotateZ(Math.PI / 2);
    k.add(hub, { color: '#e9e4d8' });
    const cap = new THREE.CylinderGeometry(0.22, 0.22, 1.08, 8);
    cap.rotateZ(Math.PI / 2);
    k.add(cap, { color: '#8a8f96' });
    this.mesh = new THREE.InstancedMesh(k.build(), vcMaterial(), max);
    this.ink = new THREE.InstancedMesh(tyre, outlineMaterial('#2a1d17', 0.12), max);
    this.free = [];
    for (let i = max - 1; i >= 0; i--) this.free.push(i);
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const m of [this.mesh, this.ink]) {
      m.frustumCulled = false;
      for (let i = 0; i < max; i++) m.setMatrixAt(i, this.zero);
      scene.add(m);
    }
    this.mesh.castShadow = true;
    this.ink.raycast = () => {};
  }
  alloc() {
    return this.free.length ? this.free.pop() : -1;
  }
  release(i) {
    if (i < 0) return;
    this.mesh.setMatrixAt(i, this.zero);
    this.ink.setMatrixAt(i, this.zero);
    this.free.push(i);
    this.flush();
  }
  set(i, m) {
    if (i < 0) return;
    this.mesh.setMatrixAt(i, m);
    this.ink.setMatrixAt(i, m);
  }
  flush() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.ink.instanceMatrix.needsUpdate = true;
  }
}
