// Small math + helper toolkit shared by every system.

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const moveTowards = (v, target, maxDelta) =>
  Math.abs(target - v) <= maxDelta ? target : v + Math.sign(target - v) * maxDelta;

export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}
export const dampAngle = (a, b, lambda, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));
export function turnTowards(a, b, maxDelta) {
  const d = wrapAngle(b - a);
  return Math.abs(d) <= maxDelta ? b : a + Math.sign(d) * maxDelta;
}

/** Heading convention used everywhere: heading h faces direction (sin h, cos h) on the XZ plane. */
export const headingTo = (fromX, fromZ, toX, toZ) => Math.atan2(toX - fromX, toZ - fromZ);

export const dist = (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az);
export const dist2 = (ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az;
  return dx * dx + dz * dz;
};

/** Distance from point P to segment AB. Returns {d, t, x, z} (closest point). */
export function segmentDistance(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = clamp(t, 0, 1);
  const x = ax + dx * t, z = az + dz * t;
  return { d: Math.hypot(px - x, pz - z), t, x, z };
}

/** Proper intersection of segments AB and CD (excluding shared endpoints). */
export function segmentIntersection(ax, az, bx, bz, cx, cz, dx, dz) {
  const rX = bx - ax, rZ = bz - az, sX = dx - cx, sZ = dz - cz;
  const denom = rX * sZ - rZ * sX;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((cx - ax) * sZ - (cz - az) * sX) / denom;
  const u = ((cx - ax) * rZ - (cz - az) * rX) / denom;
  const eps = 1e-4;
  if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null;
  return { t, u, x: ax + rX * t, z: az + rZ * t };
}

export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function polyBounds(poly) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const [x, z] of poly) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, minZ, maxX, maxZ };
}

/** Deterministic PRNG so the generated city is identical on every load. */
export class RNG {
  constructor(seed = 1) {
    this.s = seed >>> 0;
  }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) {
    return a + (b - a) * this.next();
  }
  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p) {
    return this.next() < p;
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

/** Unseeded helpers for gameplay randomness. */
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;

export function formatMoney(n) {
  const s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (n < 0 ? '-R ' : 'R ') + s;
}

export function formatClock(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** Simple 2D value noise for terrain wobble. */
export function hashNoise(x, z, seed = 0) {
  const s = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
export function valueNoise(x, z, seed = 0) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hashNoise(xi, zi, seed), b = hashNoise(xi + 1, zi, seed);
  const c = hashNoise(xi, zi + 1, seed), d = hashNoise(xi + 1, zi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
