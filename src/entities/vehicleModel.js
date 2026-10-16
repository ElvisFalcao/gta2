// Low-poly vehicle models. Body is one vertex-coloured mesh, lights an unlit mesh,
// wheels come from a shared instanced pool.

import * as THREE from 'three';
import { MeshKit, vcMaterial } from '../core/meshkit.js';

export const VEHICLES = {
  sedan: { name: 'Sedan', len: 4.5, wid: 1.86, h: 1.45, maxSpeed: 34, accel: 15, brake: 32, reverse: 9, steer: 2.0, grip: 9, mass: 1, health: 100, wheelR: 0.36, colors: ['#c0392b', '#2c3e50', '#bdc3c7', '#27ae60', '#f1f1f1', '#8e44ad', '#d35400', '#34495e', '#7f8c8d'] },
  hatch: { name: 'Hatchback', len: 3.9, wid: 1.76, h: 1.5, maxSpeed: 31, accel: 14, brake: 32, reverse: 9, steer: 2.2, grip: 9.5, mass: 0.85, health: 90, wheelR: 0.33, colors: ['#e74c3c', '#f39c12', '#3498db', '#ecf0f1', '#16a085', '#2d3436', '#fd79a8'] },
  minibus: { name: 'Minibus Taxi', len: 5.3, wid: 1.96, h: 2.15, maxSpeed: 28, accel: 10.5, brake: 26, reverse: 7, steer: 1.65, grip: 7.5, mass: 1.6, health: 150, wheelR: 0.38, colors: ['#f4f4f4'], stripes: ['#c0392b', '#2980b9', '#27ae60', '#f39c12'] },
  bakkie: { name: 'Bakkie', len: 5.1, wid: 1.9, h: 1.75, maxSpeed: 31, accel: 13, brake: 30, reverse: 8, steer: 1.8, grip: 8.5, mass: 1.35, health: 135, wheelR: 0.4, colors: ['#ecf0f1', '#c0392b', '#2c3e50', '#95a5a6', '#d0b48c'] },
  police: { name: 'Police Car', len: 4.6, wid: 1.9, h: 1.5, maxSpeed: 39, accel: 18.5, brake: 36, reverse: 10, steer: 2.15, grip: 10, mass: 1.15, health: 140, wheelR: 0.37, colors: ['#f4f6f8'] },
  suv: { name: 'Luxury SUV', len: 4.9, wid: 2.0, h: 1.8, maxSpeed: 36, accel: 16, brake: 32, reverse: 9, steer: 1.9, grip: 9, mass: 1.7, health: 260, wheelR: 0.42, colors: ['#14171b'] },
  sports: { name: 'Sports Car', len: 4.35, wid: 1.92, h: 1.2, maxSpeed: 45, accel: 23, brake: 38, reverse: 10, steer: 2.3, grip: 10.5, mass: 0.95, health: 90, wheelR: 0.35, colors: ['#e01b24', '#f6d32d', '#1c71d8', '#ffffff', '#ff7800'] },
};

export function pickVehicleColor(type) {
  const s = VEHICLES[type];
  return s.colors[Math.floor(Math.random() * s.colors.length)];
}

const GLASS = '#26323b';
const TRIM = '#23262a';

export function buildVehicleModel(type, color, opts = {}) {
  const s = VEHICLES[type];
  const k = new MeshKit();
  const lk = new MeshKit();
  const { len: L, wid: W } = s;
  const hl = '#fff6d8', tl = '#e0251b';
  const lights = (yHead, zFront, zBack, wHalf) => {
    lk.box(wHalf - 0.25, yHead, zFront, 0.38, 0.16, 0.06, hl);
    lk.box(-wHalf + 0.25, yHead, zFront, 0.38, 0.16, 0.06, hl);
    lk.box(wHalf - 0.22, yHead, zBack, 0.32, 0.16, 0.06, tl);
    lk.box(-wHalf + 0.22, yHead, zBack, 0.32, 0.16, 0.06, tl);
  };
  if (type === 'minibus') {
    k.block(0, 0.32, 0, W, 1.55, L, color);
    k.box(0, 1.5, 0.05, W + 0.02, 0.48, L * 0.82, GLASS);
    k.box(0, 1.42, L / 2 - 0.05, W * 0.86, 0.6, 0.12, GLASS);
    k.box(0, 0.95, 0, W + 0.03, 0.18, L - 0.2, opts.stripe || '#c0392b');
    k.block(0, 1.87, -0.2, W * 0.9, 0.08, L * 0.7, '#dcdcdc');
    k.box(0, 0.45, L / 2, W * 0.95, 0.25, 0.16, TRIM);
    k.box(0, 0.45, -L / 2, W * 0.95, 0.25, 0.16, TRIM);
    lights(0.8, L / 2 + 0.01, -L / 2 - 0.01, W / 2);
  } else if (type === 'bakkie') {
    k.block(0, 0.35, 0, W, 0.7, L, color);
    k.block(0, 1.05, 0.55, W * 0.92, 0.65, L * 0.36, GLASS);
    k.block(0, 1.68, 0.55, W * 0.9, 0.08, L * 0.32, color);
    k.box(0, 1.37, 0.55 + L * 0.18 + 0.02, W * 0.88, 0.5, 0.06, GLASS);
    // load bed walls
    k.block(W / 2 - 0.06, 1.05, -L * 0.25, 0.12, 0.4, L * 0.46, color);
    k.block(-W / 2 + 0.06, 1.05, -L * 0.25, 0.12, 0.4, L * 0.46, color);
    k.block(0, 1.05, -L / 2 + 0.06, W, 0.4, 0.12, color);
    k.block(0, 1.0, -L * 0.25, W - 0.24, 0.05, L * 0.44, '#3a3a3a');
    k.box(0, 0.5, L / 2, W, 0.25, 0.18, '#9aa0a6');
    k.box(0, 0.5, -L / 2, W, 0.25, 0.18, '#9aa0a6');
    lights(0.88, L / 2 + 0.01, -L / 2 - 0.02, W / 2);
  } else if (type === 'suv') {
    k.block(0, 0.4, 0, W, 0.8, L, color);
    k.block(0, 1.2, -0.25, W * 0.94, 0.55, L * 0.62, GLASS);
    k.block(0, 1.74, -0.25, W * 0.92, 0.08, L * 0.6, color);
    k.box(0, 1.48, L * 0.06 + 0.02, W * 0.88, 0.5, 0.06, GLASS);
    k.box(0, 0.55, L / 2, W, 0.3, 0.2, '#c9c9c9');
    k.box(0, 0.55, -L / 2, W, 0.3, 0.2, TRIM);
    lights(0.95, L / 2 + 0.01, -L / 2 - 0.01, W / 2);
  } else if (type === 'sports') {
    k.block(0, 0.25, 0, W, 0.55, L, color);
    k.block(0, 0.8, -0.35, W * 0.8, 0.38, L * 0.4, GLASS);
    k.block(0, 1.16, -0.4, W * 0.76, 0.05, L * 0.3, color);
    k.box(0, 0.62, -L / 2 + 0.25, W * 0.9, 0.08, 0.4, TRIM); // spoiler
    k.block(0, 0.85, -L / 2 + 0.2, W * 0.95, 0.06, 0.35, color);
    lights(0.6, L / 2 + 0.01, -L / 2 - 0.01, W / 2);
  } else {
    // sedan / hatch / police
    const hatch = type === 'hatch';
    const cabLen = hatch ? L * 0.55 : L * 0.46;
    const cabZ = hatch ? -0.25 : -0.12;
    k.block(0, 0.35, 0, W, 0.62, L, color);
    k.block(0, 0.97, cabZ, W * 0.9, 0.48, cabLen, GLASS);
    k.block(0, 1.43, cabZ, W * 0.88, 0.07, cabLen * 0.86, color);
    k.box(0, 1.2, cabZ + cabLen / 2 + 0.04, W * 0.86, 0.42, 0.06, GLASS);
    k.box(0, 0.5, L / 2, W, 0.22, 0.16, TRIM);
    k.box(0, 0.5, -L / 2, W, 0.22, 0.16, TRIM);
    if (type === 'police') {
      k.box(0, 0.75, 0, W + 0.02, 0.16, L * 0.9, '#1f4fbf');
      k.box(0, 0.62, 0, W + 0.02, 0.06, L * 0.9, '#f1c40f');
      k.box(0, 1.47, cabZ, W * 0.7, 0.04, 0.5, '#1f4fbf');
    }
    if (opts.taxiSign) k.block(0, 1.46, cabZ, 0.6, 0.22, 0.25, '#f1c40f');
    lights(0.78, L / 2 + 0.01, -L / 2 - 0.01, W / 2);
  }
  // mirrors
  k.box(W / 2 + 0.08, 1.05, L * 0.18, 0.12, 0.1, 0.18, TRIM);
  k.box(-W / 2 - 0.08, 1.05, L * 0.18, 0.12, 0.1, 0.18, TRIM);

  const group = new THREE.Group();
  const body = new THREE.Mesh(k.build(), bodyMaterial());
  body.castShadow = true;
  body.receiveShadow = false;
  group.add(body);
  const lm = new THREE.Mesh(lk.build(), lightMaterial());
  body.add(lm);
  let lightbar = null;
  if (type === 'police') {
    lightbar = { red: new THREE.MeshBasicMaterial({ color: '#550000' }), blue: new THREE.MeshBasicMaterial({ color: '#000055' }) };
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.3), lightbar.red);
    r.position.set(-0.3, 1.56, -0.12);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.3), lightbar.blue);
    b.position.set(0.3, 1.56, -0.12);
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

let _bodyMat = null, _lightMat = null, _blob = null;
export function bodyMaterial() {
  return (_bodyMat ||= vcMaterial());
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

/** One instanced mesh for every wheel in the city. */
export class WheelPool {
  constructor(scene, max = 200) {
    const g = new THREE.CylinderGeometry(1, 1, 1, 10);
    g.rotateZ(Math.PI / 2);
    const k = new MeshKit();
    k.add(g, { sx: 1, sy: 1, sz: 1, color: '#1b1b1d' });
    const hub = new THREE.CylinderGeometry(0.55, 0.55, 1.04, 8);
    hub.rotateZ(Math.PI / 2);
    k.add(hub, { color: '#9aa0a6' });
    this.mesh = new THREE.InstancedMesh(k.build(), vcMaterial(), max);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.free = [];
    for (let i = max - 1; i >= 0; i--) this.free.push(i);
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, this.zero);
    scene.add(this.mesh);
  }
  alloc() {
    return this.free.length ? this.free.pop() : -1;
  }
  release(i) {
    if (i < 0) return;
    this.mesh.setMatrixAt(i, this.zero);
    this.free.push(i);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  set(i, m) {
    if (i >= 0) this.mesh.setMatrixAt(i, m);
  }
  flush() {
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
