// Rasterised world: one byte per 2x2m cell describing what is there.
// Used for collisions, minimap, building placement, camera occlusion and AI.

import { WORLD, LAND, WATER_HOLES, MOUNTAINS, ZONES, DISTRICTS, RESERVED, RESERVED_RECTS, PLATEAU } from './mapData.js';
import { pointInPoly, clamp, segmentDistance } from '../core/util.js';

export const T = { WATER: 0, LAND: 1, ROAD: 2, WALK: 3, SAND: 4, PARK: 5, PLAZA: 6, BUILDING: 7, ROCK: 8, PROP: 9 };
const ZONE_TYPE = { sand: T.SAND, park: T.PARK, plaza: T.PLAZA, walk: T.WALK };

export class Grid {
  constructor() {
    this.cell = WORLD.cell;
    this.minX = WORLD.minX;
    this.minZ = WORLD.minZ;
    this.maxX = WORLD.maxX;
    this.maxZ = WORLD.maxZ;
    this.w = Math.ceil((this.maxX - this.minX) / this.cell);
    this.h = Math.ceil((this.maxZ - this.minZ) / this.cell);
    const n = this.w * this.h;
    this.type = new Uint8Array(n);
    this.height = new Uint8Array(n);
    this.reserved = new Uint8Array(n);
    this.coarse = 16;
    this.cw = Math.ceil((this.maxX - this.minX) / this.coarse);
    this.ch = Math.ceil((this.maxZ - this.minZ) / this.coarse);
    this.districtIdx = new Int8Array(this.cw * this.ch).fill(-1);
  }

  ix(x) { return Math.floor((x - this.minX) / this.cell); }
  iz(z) { return Math.floor((z - this.minZ) / this.cell); }
  cx(ix) { return this.minX + (ix + 0.5) * this.cell; }
  cz(iz) { return this.minZ + (iz + 0.5) * this.cell; }
  inBounds(ix, iz) { return ix >= 0 && iz >= 0 && ix < this.w && iz < this.h; }
  idxAt(x, z) {
    const ix = this.ix(x), iz = this.iz(z);
    return this.inBounds(ix, iz) ? iz * this.w + ix : -1;
  }
  typeAt(x, z) {
    const i = this.idxAt(x, z);
    return i < 0 ? -1 : this.type[i];
  }
  heightAt(x, z) {
    const i = this.idxAt(x, z);
    return i < 0 ? 0 : this.height[i];
  }

  // ---------- rasterisation helpers ----------
  fillPoly(poly, fn) {
    let minZ = Infinity, maxZ = -Infinity;
    for (const p of poly) { minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]); }
    const iz0 = clamp(this.iz(minZ), 0, this.h - 1), iz1 = clamp(this.iz(maxZ), 0, this.h - 1);
    const xs = [];
    for (let iz = iz0; iz <= iz1; iz++) {
      const z = this.cz(iz);
      xs.length = 0;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i], [xj, zj] = poly[j];
        if (zi > z !== zj > z) xs.push(xi + ((z - zi) / (zj - zi)) * (xj - xi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const ixa = Math.max(0, Math.ceil((xs[k] - this.minX) / this.cell - 0.5));
        const ixb = Math.min(this.w - 1, Math.floor((xs[k + 1] - this.minX) / this.cell - 0.5));
        for (let ix = ixa; ix <= ixb; ix++) fn(iz * this.w + ix, ix, iz);
      }
    }
  }
  fillRect(x0, z0, x1, z1, fn) {
    const ix0 = clamp(Math.ceil((x0 - this.minX) / this.cell - 0.5), 0, this.w - 1);
    const ix1 = clamp(Math.floor((x1 - this.minX) / this.cell - 0.5), 0, this.w - 1);
    const iz0 = clamp(Math.ceil((z0 - this.minZ) / this.cell - 0.5), 0, this.h - 1);
    const iz1 = clamp(Math.floor((z1 - this.minZ) / this.cell - 0.5), 0, this.h - 1);
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) fn(iz * this.w + ix, ix, iz);
  }
  fillCircle(x, z, r, fn) {
    this.fillRect(x - r, z - r, x + r, z + r, (i, ix, iz) => {
      const dx = this.cx(ix) - x, dz = this.cz(iz) - z;
      if (dx * dx + dz * dz <= r * r) fn(i, ix, iz);
    });
  }
  fillSegment(ax, az, bx, bz, halfW, fn) {
    this.fillRect(Math.min(ax, bx) - halfW, Math.min(az, bz) - halfW, Math.max(ax, bx) + halfW, Math.max(az, bz) + halfW, (i, ix, iz) => {
      if (segmentDistance(this.cx(ix), this.cz(iz), ax, az, bx, bz).d <= halfW) fn(i, ix, iz);
    });
  }

  // ---------- build the base terrain ----------
  buildTerrain() {
    const { type, height } = this;
    this.fillPoly(LAND, (i) => (type[i] = T.LAND));
    for (const hole of WATER_HOLES) this.fillPoly(hole, (i) => (type[i] = T.WATER));
    for (const z of ZONES) {
      const t = ZONE_TYPE[z.type];
      this.fillPoly(z.poly, (i) => { if (type[i] !== T.WATER) type[i] = t; });
    }
    for (const m of MOUNTAINS) this.rasterMountain(m);
    for (const r of RESERVED) this.fillCircle(r.x, r.z, r.r, (i) => (this.reserved[i] = 1));
    for (const r of RESERVED_RECTS) this.fillRect(r[0], r[1], r[2], r[3], (i) => (this.reserved[i] = 1));
    // coarse district lookup
    for (let cz = 0; cz < this.ch; cz++) {
      for (let cx = 0; cx < this.cw; cx++) {
        const x = this.minX + (cx + 0.5) * this.coarse, z = this.minZ + (cz + 0.5) * this.coarse;
        this.districtIdx[cz * this.cw + cx] = DISTRICTS.findIndex((d) => inDistrict(d, x, z));
      }
    }
  }

  rasterMountain(m) {
    const { type, height } = this;
    this.fillRect(m.cx - m.rx, m.cz - m.rz, m.cx + m.rx, m.cz + m.rz, (i, ix, iz) => {
      const dx = this.cx(ix) - m.cx, dz = this.cz(iz) - m.cz;
      const e = Math.sqrt((dx * dx) / (m.rx * m.rx) + (dz * dz) / (m.rz * m.rz));
      if (e >= 1) return;
      const h = mountainHeight(m, dx, dz, e);
      if (h > height[i]) height[i] = Math.min(255, Math.round(h));
      if (e < 0.93 && type[i] !== T.WATER) type[i] = T.ROCK;
    });
  }

  district(x, z) {
    const cx = Math.floor((x - this.minX) / this.coarse), cz = Math.floor((z - this.minZ) / this.coarse);
    if (cx < 0 || cz < 0 || cx >= this.cw || cz >= this.ch) return null;
    const d = this.districtIdx[cz * this.cw + cx];
    return d >= 0 ? DISTRICTS[d] : null;
  }

  areaName(x, z, onPlateau = false) {
    if (onPlateau) return 'Table Mountain';
    for (const m of MOUNTAINS) {
      const dx = x - m.cx, dz = z - m.cz;
      const e = (dx * dx) / (m.rx * m.rx) + (dz * dz) / (m.rz * m.rz);
      if (e < 1.35) return m.name;
    }
    const t = this.typeAt(x, z);
    if (t === T.WATER || t < 0) return z < -300 ? 'Table Bay' : 'Atlantic Ocean';
    const d = this.district(x, z);
    return d ? d.name : 'Cape Town';
  }

  // ---------- queries ----------
  static solidType(t) { return t >= T.BUILDING || t < 0; }
  blocksFoot(t) { return t >= T.BUILDING || t < 0; }
  blocksCar(t) { return t >= T.BUILDING || t <= T.WATER; }

  circleBlocked(x, z, r, forCar = false) {
    const ix0 = this.ix(x - r), ix1 = this.ix(x + r), iz0 = this.iz(z - r), iz1 = this.iz(z + r);
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        const t = this.inBounds(ix, iz) ? this.type[iz * this.w + ix] : -1;
        if (!(forCar ? this.blocksCar(t) : this.blocksFoot(t))) continue;
        const bx0 = this.minX + ix * this.cell, bz0 = this.minZ + iz * this.cell;
        const nx = clamp(x, bx0, bx0 + this.cell), nz = clamp(z, bz0, bz0 + this.cell);
        const dx = x - nx, dz = z - nz;
        if (dx * dx + dz * dz < r * r) return true;
      }
    }
    return false;
  }
  pointBlockedCar(x, z) {
    return this.blocksCar(this.typeAt(x, z));
  }
  isWater(x, z) {
    const t = this.typeAt(x, z);
    return t === T.WATER;
  }
  isWalkable(x, z) {
    const t = this.typeAt(x, z);
    return t > T.WATER && t < T.BUILDING;
  }
  isDrivable(x, z) {
    const t = this.typeAt(x, z);
    return t > T.WATER && t < T.BUILDING;
  }

  /** Spiral out from (x,z) to the nearest cell satisfying pred (default: dry walkable). */
  findOpen(x, z, maxR = 40, pred = null, clearance = 1) {
    const test = pred || ((px, pz) => this.isWalkable(px, pz) && !this.circleBlocked(px, pz, clearance, false));
    if (test(x, z)) return { x, z };
    for (let r = this.cell; r <= maxR; r += this.cell) {
      const steps = Math.max(8, Math.round((r * Math.PI * 2) / this.cell));
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (test(px, pz)) return { x: px, z: pz };
      }
    }
    return null;
  }

  /** March along a 3D ray and return the fraction where it first enters solid volume. */
  raycast(x0, y0, z0, x1, y1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(2, Math.ceil(len / (this.cell * 0.5)));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = y0 + (y1 - y0) * t;
      const i = this.idxAt(x, z);
      if (i < 0) continue;
      const ty = this.type[i];
      if ((ty === T.BUILDING || ty === T.ROCK || ty === T.PROP) && this.height[i] + 0.6 > y) return t;
    }
    return 1;
  }

  /** Approximate distance to the nearest water cell (for ambient ocean sound). */
  waterNearby(x, z, r = 30) {
    let n = 0, total = 0;
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      for (const d of [r * 0.4, r]) {
        total++;
        if (this.isWater(x + Math.cos(ang) * d, z + Math.sin(ang) * d)) n++;
      }
    }
    return n / total;
  }

  insidePlateau(x, z, margin = 0.96) {
    const dx = (x - PLATEAU.cx) / PLATEAU.rx, dz = (z - PLATEAU.cz) / PLATEAU.rz;
    return dx * dx + dz * dz < margin * margin;
  }
}

export function inDistrict(d, x, z) {
  if (d.rect) return x >= d.rect[0] && z >= d.rect[1] && x <= d.rect[2] && z <= d.rect[3];
  return pointInPoly(x, z, d.poly);
}

export function mountainHeight(m, dx, dz, e) {
  if (m.profile === 'mesa') {
    const eT = Math.sqrt((dx * dx) / (m.topRx * m.topRx) + (dz * dz) / (m.topRz * m.topRz));
    if (eT <= 1) return m.height;
    const eEdge = e / eT; // base-normalised radius of the plateau edge in this direction
    const t = clamp((1 - e) / Math.max(0.001, 1 - eEdge), 0, 1);
    return m.height * Math.pow(t, 0.75);
  }
  if (m.profile === 'peak') return m.height * Math.pow(1 - e, 1.25);
  if (m.profile === 'lion') return m.height * clamp(e < 0.5 ? 1 - e * 0.9 : (1 - e) * 1.1, 0, 1);
  return m.height * Math.sqrt(Math.max(0, 1 - e * e));
}
