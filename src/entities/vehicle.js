// Arcade car physics with grid collisions, damage, fire and explosions.

import * as THREE from 'three';
import { VEHICLES, buildVehicleModel, pickVehicleColor } from './vehicleModel.js';
import { clamp, moveTowards, rand, pick } from '../core/util.js';
import { vcMaterial } from '../core/meshkit.js';

let VID = 1;
const _m = new THREE.Matrix4();
const _w = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
let wreckMat = null;

export class Vehicle {
  constructor(game, type, x, z, heading, opts = {}) {
    this.id = VID++;
    this.game = game;
    this.type = type;
    this.spec = VEHICLES[type];
    this.color = opts.color || pickVehicleColor(type);
    const stripe = type === 'minibus' ? opts.stripe || pick(this.spec.stripes) : null;
    const model = buildVehicleModel(type, this.color, { stripe, taxiSign: opts.taxiSign });
    this.group = model.group;
    this.body = model.body;
    this.wheelDefs = model.wheels;
    this.lightbar = model.lightbar;
    this.wheelSlots = this.wheelDefs.map(() => game.wheels.alloc());
    this.x = x;
    this.z = z;
    this.y = 0;
    this.heading = heading;
    this.vx = 0;
    this.vz = 0;
    this.steer = 0;
    this.input = { throttle: 0, steer: 0, handbrake: false };
    this.health = this.spec.health * (opts.healthMul || 1);
    this.maxHealth = this.health;
    this.state = 'ok';
    this.fireT = 0;
    this.wreckT = 0;
    this.driver = null; // 'player' | 'npc' | null
    this.npcLook = null;
    this.ai = null;
    this.mission = !!opts.mission;
    this.persistent = !!opts.persistent;
    this.parkedId = opts.parkedId || null;
    this.halfL = this.spec.len / 2;
    this.halfW = this.spec.wid / 2;
    this.radius = Math.hypot(this.halfL, this.halfW);
    this.mass = this.spec.mass;
    this.spin = 0;
    this.siren = false;
    this.lastImpact = 0;
    this.lastPlayerHit = -10;
    this.smokeT = 0;
    this.invulnerable = !!opts.invulnerable;
    this.label = opts.label || this.spec.name;
    game.scene.add(this.group);
    this.sync(0);
  }

  get speed() {
    return Math.hypot(this.vx, this.vz);
  }
  get fwdSpeed() {
    return this.vx * Math.sin(this.heading) + this.vz * Math.cos(this.heading);
  }
  get fwd() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }
  get right() {
    return { x: -Math.cos(this.heading), z: Math.sin(this.heading) };
  }

  /** Is world point inside this car's footprint (expanded by pad)? */
  contains(px, pz, pad = 0) {
    const dx = px - this.x, dz = pz - this.z;
    const s = Math.sin(this.heading), c = Math.cos(this.heading);
    const lz = dx * s + dz * c, lx = -dx * c + dz * s;
    return Math.abs(lz) < this.halfL + pad && Math.abs(lx) < this.halfW + pad;
  }
  localOf(px, pz) {
    const dx = px - this.x, dz = pz - this.z;
    const s = Math.sin(this.heading), c = Math.cos(this.heading);
    return { lz: dx * s + dz * c, lx: -dx * c + dz * s };
  }
  distTo(px, pz) {
    const { lx, lz } = this.localOf(px, pz);
    const ex = Math.max(0, Math.abs(lx) - this.halfW), ez = Math.max(0, Math.abs(lz) - this.halfL);
    return Math.hypot(ex, ez);
  }

  samplesBlocked(x, z, h) {
    const grid = this.game.grid;
    const s = Math.sin(h), c = Math.cos(h);
    const L = this.halfL - 0.05, W = this.halfW - 0.05;
    let hx = 0, hz = 0, n = 0;
    for (const [lx, lz] of SAMPLE_OFFSETS) {
      const ox = lx * W, oz = lz * L;
      const wx = x + ox * -c + oz * s, wz = z + ox * s + oz * c;
      if (grid.pointBlockedCar(wx, wz)) {
        hx += wx - x;
        hz += wz - z;
        n++;
      }
    }
    return n ? { n, hx, hz } : null;
  }

  update(dt) {
    if (this.state === 'wrecked') {
      this.vx *= Math.exp(-3 * dt);
      this.vz *= Math.exp(-3 * dt);
      this.integrate(dt);
      this.wreckT -= dt;
      if (Math.random() < dt * 4) this.game.effects.smoke(this.x, 1.2, this.z, 1, 0.15);
      this.sync(dt);
      return;
    }
    const S = this.spec;
    let thr = 0, st = 0, hb = false;
    if (this.driver) {
      thr = clamp(this.input.throttle, -1, 1);
      st = clamp(this.input.steer, -1, 1);
      hb = this.input.handbrake;
    } else hb = this.speed < 1.5;
    if (this.state === 'burning') thr *= 0.4;

    const h0 = this.heading;
    let vf = this.vx * Math.sin(h0) + this.vz * Math.cos(h0);
    // steering
    this.steer = moveTowards(this.steer, st, 3.8 * dt);
    const spd = Math.abs(vf);
    const sf = clamp(spd / 5, 0, 1) * (1 - 0.48 * clamp(spd / S.maxSpeed, 0, 1));
    let yawRate = -this.steer * S.steer * sf * (vf >= 0 ? 1 : -1);
    if (hb && spd > 4) yawRate *= 1.5;
    const dh = yawRate * dt;
    // rotate heading (revert if that rotates us into a wall)
    let h = h0 + dh;
    if (this.samplesBlocked(this.x, this.z, h) && !this.samplesBlocked(this.x, this.z, h0)) h = h0;
    const applied = h - h0;
    this.heading = h;
    // velocity follows the heading according to grip
    const follow = hb ? 0.35 : 0.94;
    const a = applied * follow;
    const ca = Math.cos(a), sa = Math.sin(a);
    const nvx = this.vx * ca + this.vz * sa, nvz = this.vz * ca - this.vx * sa;
    const fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
    vf = nvx * fx + nvz * fz;
    let vr = nvx * rx + nvz * rz;
    // engine / brakes
    if (thr > 0.05) {
      if (vf < -0.5) vf += S.brake * thr * dt;
      else vf += S.accel * thr * dt * (1 - Math.pow(clamp(vf / S.maxSpeed, 0, 1), 2) * 0.95);
    } else if (thr < -0.05) {
      if (vf > 0.5) vf -= S.brake * -thr * dt;
      else vf = Math.max(-S.reverse, vf - S.accel * 0.7 * -thr * dt);
    } else {
      vf = moveTowards(vf, 0, (1.6 + Math.abs(vf) * 0.06) * dt);
    }
    if (hb) vf = moveTowards(vf, 0, 11 * dt);
    vf = clamp(vf, -S.reverse, S.maxSpeed * 1.05);
    const grip = hb ? 1.3 : S.grip * (1 - 0.3 * clamp(Math.abs(vf) / S.maxSpeed, 0, 1));
    vr *= Math.exp(-grip * dt);
    this.vx = fx * vf + rx * vr;
    this.vz = fz * vf + rz * vr;
    this.drifting = hb && Math.abs(vr) > 3;
    this.integrate(dt);

    // damage states
    if (this.state === 'ok' && this.health < this.maxHealth * 0.3) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.15;
        const f = this.fwd;
        this.game.effects.smoke(this.x + f.x * this.halfL * 0.8, 1.3, this.z + f.z * this.halfL * 0.8, 1, this.health < this.maxHealth * 0.15 ? 0.15 : 0.55);
      }
    }
    if (this.state === 'burning') {
      this.fireT -= dt;
      const f = this.fwd;
      this.game.effects.fire(this.x + f.x * this.halfL * 0.7, 1.2, this.z + f.z * this.halfL * 0.7, 2);
      if (Math.random() < 0.3) this.game.effects.smoke(this.x, 1.8, this.z, 1, 0.12);
      if (this.fireT <= 0) this.explode();
    }
    if (this.lightbar) {
      const on = this.siren && Math.floor(this.game.time * 7) % 2 === 0;
      this.lightbar.red.color.set(this.siren ? (on ? '#ff2020' : '#400000') : '#550000');
      this.lightbar.blue.color.set(this.siren ? (on ? '#000040' : '#2050ff') : '#000055');
    }
    this.sync(dt);
  }

  integrate(dt) {
    const sp = this.speed;
    const steps = clamp(Math.ceil((sp * dt) / 0.7), 1, 6);
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      const nx = this.x + this.vx * sdt, nz = this.z + this.vz * sdt;
      const hit = this.samplesBlocked(nx, nz, this.heading);
      if (!hit) {
        this.x = nx;
        this.z = nz;
        continue;
      }
      if (this.samplesBlocked(this.x, this.z, this.heading)) {
        // already stuck inside something: let it slide free
        this.unstick();
        break;
      }
      // collision normal points away from the obstacle
      let nlx = -hit.hx, nlz = -hit.hz;
      const l = Math.hypot(nlx, nlz) || 1;
      nlx /= l;
      nlz /= l;
      const vn = this.vx * nlx + this.vz * nlz;
      if (vn < 0) {
        this.vx -= 1.3 * vn * nlx;
        this.vz -= 1.3 * vn * nlz;
        this.vx *= 0.78;
        this.vz *= 0.78;
        this.onImpact(-vn, this.x - nlx * this.halfW, this.z - nlz * this.halfW);
      } else {
        this.vx *= 0.9;
        this.vz *= 0.9;
      }
      break;
    }
  }

  unstick() {
    for (let r = 0.5; r <= 4; r += 0.5) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const nx = this.x + Math.cos(a) * r, nz = this.z + Math.sin(a) * r;
        if (!this.samplesBlocked(nx, nz, this.heading)) {
          this.x = nx;
          this.z = nz;
          return;
        }
      }
    }
  }

  onImpact(speed, px, pz) {
    if (speed < 2) return;
    const now = this.game.time;
    if (speed > 4 && now - this.lastImpact > 0.15) {
      this.lastImpact = now;
      this.game.effects.sparks(px, 0.6, pz, Math.min(20, Math.round(speed)));
      this.game.audio.crash(Math.min(1, speed / 25), this.x, this.z);
      if (this.driver === 'player') {
        this.game.cameraRig.shake(Math.min(0.8, speed / 30));
        this.game.vibrate(Math.min(80, speed * 3));
      }
    }
    const dmg = speed > 8 ? ((speed - 8) * 1.6) / Math.sqrt(this.mass) : 0;
    if (dmg > 0) this.damage(dmg);
    if (this.driver === 'player' && speed > 22) this.game.player.takeDamage((speed - 22) * 0.6, 'crash');
    if (this.ai && this.ai.onBump) this.ai.onBump(speed);
  }

  damage(amount, source = null) {
    if (this.invulnerable || this.state !== 'ok') return;
    if (this.game.cheats && this.game.cheats.tank && this.driver === 'player') return;
    this.health -= amount;
    if (source === 'player') this.lastPlayerHit = this.game.time;
    if (this.health <= 0) {
      this.health = 0;
      this.state = 'burning';
      this.fireT = 4.5;
      if (this.driver === 'player') this.game.hud.toast('Your car is on fire — get out!', 'warn');
    }
  }

  explode() {
    if (this.state === 'wrecked') return;
    this.state = 'wrecked';
    this.wreckT = 25;
    this.siren = false;
    if (!wreckMat) wreckMat = vcMaterial({ color: '#2a2a2a' });
    this.body.material = wreckMat;
    this.vx *= 0.3;
    this.vz *= 0.3;
    this.y = 0;
    this.game.effects.explosion(this.x, 0.8, this.z);
    this.game.audio.explosion(this.x, this.z);
    this.game.onExplosion(this.x, this.z, 7, this);
  }

  sync(dt) {
    const g = this.group;
    g.position.set(this.x, this.y, this.z);
    g.rotation.y = this.heading;
    const vf = this.fwdSpeed;
    const r = this.right;
    const vr = this.vx * r.x + this.vz * r.z;
    this.body.rotation.z = clamp(vr * 0.012, -0.06, 0.06);
    this.body.rotation.x = clamp(-this.input.throttle * 0.012 * Math.sign(vf || 1), -0.03, 0.03);
    g.updateMatrix();
    g.matrixWorld.copy(g.matrix);
    this.spin += (vf * dt) / this.spec.wheelR;
    const R = this.spec.wheelR;
    _s.set(0.26, R, R);
    for (let i = 0; i < this.wheelDefs.length; i++) {
      const w = this.wheelDefs[i];
      _e.set(this.spin, w.front ? this.steer * -0.5 : 0, 0, 'YXZ');
      _q.setFromEuler(_e);
      _p.set(w.x, R, w.z);
      _m.compose(_p, _q, _s);
      _w.multiplyMatrices(g.matrixWorld, _m);
      this.game.wheels.set(this.wheelSlots[i], _w);
    }
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.body.geometry.dispose();
    for (const c of this.body.children) if (c.geometry) c.geometry.dispose();
    for (const s of this.wheelSlots) this.game.wheels.release(s);
    this.wheelSlots = [];
    this.disposed = true;
  }
}

const SAMPLE_OFFSETS = [
  [1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 0.5], [-1, 0.5], [1, -0.5], [-1, -0.5],
];
