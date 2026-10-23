// Merges many primitives into one vertex-coloured BufferGeometry (one draw call).

import * as THREE from 'three';
import { RAMP_SOFT } from './toon.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _n = new THREE.Matrix3();
const _c = new THREE.Color();

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cyl24: new THREE.CylinderGeometry(0.5, 0.5, 1, 24),
  cone8: new THREE.ConeGeometry(0.5, 1, 8),
  cone4: new THREE.ConeGeometry(0.5, 1, 4),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
  ico1: new THREE.IcosahedronGeometry(0.5, 1),
  sphere: new THREE.SphereGeometry(0.5, 10, 8),
};

export class MeshKit {
  constructor({ uv = false } = {}) {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.uv = uv ? [] : null;
    this.idx = [];
    this.count = 0;
  }

  add(geo, o = {}) {
    const m = o.matrix || _m.compose(
      _p.set(o.x || 0, o.y || 0, o.z || 0),
      _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')),
      _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1),
    );
    _n.getNormalMatrix(m);
    const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
    _c.set(o.color ?? '#ffffff');
    const r = _c.r, g = _c.g, b = _c.b;
    const base = this.count;
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(m);
      this.pos.push(_v.x, _v.y, _v.z);
      if (o.colorFn) {
        const cc = o.colorFn(_v.x, _v.y, _v.z);
        this.col.push(cc.r, cc.g, cc.b);
      } else this.col.push(r, g, b);
      _v.fromBufferAttribute(N, i).applyMatrix3(_n).normalize();
      this.nor.push(_v.x, _v.y, _v.z);
      if (this.uv) {
        if (U) this.uv.push(U.getX(i) * (o.uScale ?? 1), U.getY(i) * (o.vScale ?? 1));
        else this.uv.push(0, 0);
      }
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) this.idx.push(base + geo.index.getX(i));
    else for (let i = 0; i < P.count; i++) this.idx.push(base + i);
    this.count += P.count;
    return this;
  }

  box(x, y, z, sx, sy, sz, color, o = {}) {
    return this.add(GEO.box, { ...o, x, y, z, sx, sy, sz, color });
  }
  /** Box resting on y (bottom at y). */
  block(x, y, z, sx, sy, sz, color, o = {}) {
    return this.add(GEO.box, { ...o, x, y: y + sy / 2, z, sx, sy, sz, color });
  }
  cyl(x, y, z, r, h, color, seg = 12, o = {}) {
    const g = seg <= 8 ? GEO.cyl8 : seg <= 12 ? GEO.cyl12 : GEO.cyl24;
    return this.add(g, { ...o, x, y: y + h / 2, z, sx: r * 2, sy: h, sz: r * 2, color });
  }
  cone(x, y, z, r, h, color, o = {}) {
    return this.add(o.four ? GEO.cone4 : GEO.cone8, { ...o, x, y: y + h / 2, z, sx: r * 2, sy: h, sz: r * 2, color });
  }

  /** Raw quad (4 points, counter-clockwise when seen from the front). */
  quad(p0, p1, p2, p3, color, uvs = null) {
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p3[0] - p0[0], by = p3[1] - p0[1], bz = p3[2] - p0[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    _c.set(color);
    const base = this.count;
    for (const p of [p0, p1, p2, p3]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.col.push(_c.r, _c.g, _c.b);
    }
    if (this.uv) {
      const u = uvs || [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (const t of u) this.uv.push(t[0], t[1]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.count += 4;
    return this;
  }

  tri(p0, p1, p2, color) {
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1;
    _c.set(color);
    const base = this.count;
    for (const p of [p0, p1, p2]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx / l, ny / l, nz / l);
      this.col.push(_c.r, _c.g, _c.b);
      if (this.uv) this.uv.push(0, 0);
    }
    this.idx.push(base, base + 1, base + 2);
    this.count += 3;
    return this;
  }

  get empty() {
    return this.count === 0;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// sunny-toon shading everywhere; flat-shaded things (mountains) keep Lambert, which supports flatShading
export const vcMaterial = (opts = {}) =>
  opts.flatShading ? new THREE.MeshLambertMaterial({ vertexColors: true, ...opts }) : new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: RAMP_SOFT, ...opts });
