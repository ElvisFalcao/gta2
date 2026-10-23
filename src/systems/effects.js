// Pooled particles (smoke, fire, sparks, dust, splashes) and world markers.

import * as THREE from 'three';
import { makeGlowTexture, makeBeamTexture, makeIconTexture } from '../world/textures.js';
import { rand } from '../core/util.js';

const TYPES = {
  smoke: { size: 3.2, blending: THREE.NormalBlending, max: 260, gravity: -1.2, drag: 0.6 },
  fire: { size: 2.4, blending: THREE.AdditiveBlending, max: 200, gravity: -3, drag: 1.2 },
  spark: { size: 0.45, blending: THREE.AdditiveBlending, max: 200, gravity: 9, drag: 0.4 },
  dust: { size: 1.4, blending: THREE.NormalBlending, max: 160, gravity: -0.4, drag: 1.5 },
  splash: { size: 0.8, blending: THREE.NormalBlending, max: 120, gravity: 9, drag: 0.3 },
  confetti: { size: 0.5, blending: THREE.NormalBlending, max: 220, gravity: 3, drag: 1.0 },
};

class ParticlePool {
  constructor(scene, spec, tex) {
    this.spec = spec;
    const n = spec.max;
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 4);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n).fill(1);
    this.base = new Float32Array(n * 3);
    this.cursor = 0;
    for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -9999;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.PointsMaterial({ size: spec.size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: spec.blending, sizeAttenuation: true });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.active = 0;
  }
  emit(x, y, z, vx, vy, vz, life, r, g, b) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.max[i] = life;
    this.base[i * 3] = r; this.base[i * 3 + 1] = g; this.base[i * 3 + 2] = b;
    this.active = Math.max(this.active, 1);
  }
  update(dt) {
    const { pos, vel, life, col, base, max, spec } = this;
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (life[i] <= 0) continue;
      any = true;
      life[i] -= dt;
      if (life[i] <= 0) {
        pos[i * 3 + 1] = -9999;
        col[i * 4 + 3] = 0;
        continue;
      }
      const k = Math.exp(-spec.drag * dt);
      vel[i * 3] *= k;
      vel[i * 3 + 2] *= k;
      vel[i * 3 + 1] = vel[i * 3 + 1] * k - spec.gravity * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const f = life[i] / max[i];
      col[i * 4] = base[i * 3];
      col[i * 4 + 1] = base[i * 3 + 1];
      col[i * 4 + 2] = base[i * 3 + 2];
      col[i * 4 + 3] = Math.min(1, f * 1.6) * (spec.blending === THREE.AdditiveBlending ? 1 : 0.75);
    }
    if (any || this.active) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
      this.active = any ? 1 : 0;
    }
  }
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    const tex = makeGlowTexture();
    this.pools = {};
    for (const [k, spec] of Object.entries(TYPES)) this.pools[k] = new ParticlePool(scene, spec, tex);
    this.flashes = [];
    this.flashMat = new THREE.SpriteMaterial({ map: tex, color: '#ffd28a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.markers = new Set();
    this.beamTex = makeBeamTexture();
    this.iconCache = new Map();
    this.time = 0;
  }

  /** Comic impact burst ("POW!") that pops in, wobbles and fades. */
  pow(x, y, z, heavy = false) {
    const words = heavy ? ['KAPOW!', 'WHAM!'] : ['POW!', 'BAM!', 'WHAP!'];
    const word = words[Math.floor(Math.random() * words.length)];
    if (!this.powTex) this.powTex = {};
    if (!this.powTex[word]) this.powTex[word] = makePowTexture(word, heavy);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.powTex[word], transparent: true, depthTest: false }));
    s.position.set(x, y, z);
    s.renderOrder = 10;
    this.scene.add(s);
    this.pows = this.pows || [];
    this.pows.push({ s, t: 0, size: heavy ? 1.25 : 0.85 });
  }

  smoke(x, y, z, n = 1, dark = 0.4) {
    for (let i = 0; i < n; i++) this.pools.smoke.emit(x + rand(-0.4, 0.4), y, z + rand(-0.4, 0.4), rand(-0.6, 0.6), rand(1, 2.2), rand(-0.6, 0.6), rand(1.4, 2.6), dark, dark, dark * 1.02);
  }
  fire(x, y, z, n = 1) {
    for (let i = 0; i < n; i++) this.pools.fire.emit(x + rand(-0.5, 0.5), y, z + rand(-0.5, 0.5), rand(-0.5, 0.5), rand(1.5, 3), rand(-0.5, 0.5), rand(0.35, 0.7), 1, rand(0.35, 0.6), 0.1);
  }
  sparks(x, y, z, n = 8, color = [1, 0.85, 0.4]) {
    for (let i = 0; i < n; i++) this.pools.spark.emit(x, y, z, rand(-4, 4), rand(1, 5), rand(-4, 4), rand(0.2, 0.45), color[0], color[1], color[2]);
  }
  hit(x, y, z) {
    this.sparks(x, y, z, 6, [1, 1, 0.8]);
    for (let i = 0; i < 3; i++) this.pools.dust.emit(x, y, z, rand(-1, 1), rand(0, 1), rand(-1, 1), 0.3, 1, 1, 1);
  }
  dust(x, y, z, n = 2) {
    for (let i = 0; i < n; i++) this.pools.dust.emit(x + rand(-0.3, 0.3), y, z + rand(-0.3, 0.3), rand(-0.8, 0.8), rand(0.3, 1), rand(-0.8, 0.8), rand(0.5, 0.9), 0.78, 0.72, 0.6);
  }
  splash(x, y, z, n = 10) {
    for (let i = 0; i < n; i++) this.pools.splash.emit(x, y, z, rand(-2, 2), rand(2, 5), rand(-2, 2), rand(0.4, 0.8), 0.92, 0.97, 1);
  }
  confetti(x, y, z, n = 80) {
    const cols = [[1, 0.3, 0.3], [1, 0.85, 0.2], [0.2, 0.8, 0.4], [0.3, 0.6, 1], [1, 0.5, 0.9]];
    for (let i = 0; i < n; i++) {
      const c = cols[i % cols.length];
      this.pools.confetti.emit(x + rand(-2, 2), y + rand(0, 2), z + rand(-2, 2), rand(-4, 4), rand(4, 9), rand(-4, 4), rand(1.5, 2.8), c[0], c[1], c[2]);
    }
  }
  explosion(x, y, z) {
    for (let i = 0; i < 40; i++) this.pools.fire.emit(x + rand(-1, 1), y + rand(0, 1.5), z + rand(-1, 1), rand(-7, 7), rand(2, 9), rand(-7, 7), rand(0.4, 0.9), 1, rand(0.3, 0.7), 0.1);
    for (let i = 0; i < 24; i++) this.pools.smoke.emit(x + rand(-2, 2), y + rand(0, 2), z + rand(-2, 2), rand(-3, 3), rand(2, 5), rand(-3, 3), rand(2, 3.5), 0.2, 0.2, 0.2);
    this.sparks(x, y + 1, z, 30);
    const s = new THREE.Sprite(this.flashMat.clone());
    s.position.set(x, y + 1.5, z);
    s.scale.setScalar(14);
    this.scene.add(s);
    this.flashes.push({ s, t: 0.35, max: 0.35 });
  }

  // ---------------- markers ----------------
  icon(letter, color) {
    const key = letter + color;
    if (!this.iconCache.has(key)) this.iconCache.set(key, makeIconTexture(letter, color));
    return this.iconCache.get(key);
  }

  /** Glowing cylinder marker on the ground (+ optional floating icon). */
  marker(x, z, { color = '#ffd400', radius = 1.6, height = 3, y = 0, icon = null, iconColor = null, pulse = true } = {}) {
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 24, 1, true),
      new THREE.MeshBasicMaterial({ map: this.beamTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }),
    );
    cyl.position.y = height / 2;
    g.add(cyl);
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.85, radius, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    g.add(ring);
    let spr = null;
    if (icon) {
      spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.icon(icon, iconColor || color), depthTest: false, transparent: true }));
      spr.scale.setScalar(1.3);
      spr.position.y = height + 1;
      spr.renderOrder = 10;
      g.add(spr);
    }
    g.position.set(x, y, z);
    this.scene.add(g);
    const m = {
      group: g, cyl, ring, spr, pulse, phase: Math.random() * 6,
      setPos: (nx, nz, ny = y) => g.position.set(nx, ny, nz),
      remove: () => {
        this.scene.remove(g);
        cyl.geometry.dispose();
        ring.geometry.dispose();
        this.markers.delete(m);
      },
    };
    this.markers.add(m);
    return m;
  }

  /** Bobbing arrow that follows an entity (target to chase / collect). */
  arrow(color = '#ff3b3b') {
    const geo = new THREE.ConeGeometry(0.45, 0.9, 4);
    geo.rotateX(Math.PI);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, fog: false, depthTest: false, transparent: true }));
    mesh.renderOrder = 11;
    this.scene.add(mesh);
    const a = {
      mesh, arrow: true, phase: 0,
      follow: (x, y, z) => mesh.position.set(x, y + Math.sin(this.time * 4) * 0.25, z),
      remove: () => {
        this.scene.remove(mesh);
        geo.dispose();
        this.markers.delete(a);
      },
    };
    this.markers.add(a);
    return a;
  }

  update(dt) {
    this.time += dt;
    if (this.pows) {
      for (let i = this.pows.length - 1; i >= 0; i--) {
        const f = this.pows[i];
        f.t += dt;
        const pop = f.t < 0.08 ? f.t / 0.08 : 1 + Math.sin(f.t * 20) * 0.04 * Math.max(0, 1 - f.t * 3);
        f.s.scale.setScalar(f.size * pop * (1 + f.t * 0.3));
        f.s.material.opacity = Math.max(0, 1 - Math.max(0, f.t - 0.3) / 0.25);
        f.s.position.y += dt * 0.3;
        if (f.t > 0.6) {
          this.scene.remove(f.s);
          f.s.material.dispose();
          this.pows.splice(i, 1);
        }
      }
    }
    for (const p of Object.values(this.pools)) p.update(dt);
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t -= dt;
      f.s.material.opacity = Math.max(0, f.t / f.max);
      f.s.scale.setScalar(14 + (1 - f.t / f.max) * 10);
      if (f.t <= 0) {
        this.scene.remove(f.s);
        f.s.material.dispose();
        this.flashes.splice(i, 1);
      }
    }
    for (const m of this.markers) {
      if (m.arrow) {
        m.mesh.rotation.y += dt * 2;
        continue;
      }
      if (m.pulse) {
        const s = 1 + Math.sin(this.time * 3 + m.phase) * 0.06;
        m.cyl.scale.set(s, 1, s);
      }
      if (m.spr) m.spr.position.y = m.cyl.geometry.parameters.height + 1 + Math.sin(this.time * 2.5 + m.phase) * 0.2;
    }
  }
}

function makePowTexture(word, heavy) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  g.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, r = i % 2 ? 70 : 112 + ((i * 37) % 13);
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fillStyle = heavy ? '#ff5a3c' : '#ffd23f';
  g.strokeStyle = '#1b1410';
  g.lineWidth = 10;
  g.fill();
  g.stroke();
  g.rotate(-0.15);
  g.font = `${heavy ? 62 : 58}px "Bebas Neue", Impact, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 9;
  g.strokeText(word, 0, 4);
  g.fillStyle = '#ffffff';
  g.fillText(word, 0, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
