// Vehicle management: AI drivers (traffic, chase, scripted routes), car-car and car-person collisions.

import { Vehicle } from '../entities/vehicle.js';
import { randomLook } from '../entities/humanModel.js';
import { laneOffsetFor } from '../world/roads.js';
import { clamp, wrapAngle, headingTo, dist, rand, chance, pick } from '../core/util.js';

// ------------------------------------------------------------ drivers
function steerTo(v, tx, tz, gain = 2.2) {
  const want = headingTo(v.x, v.z, tx, tz);
  const diff = wrapAngle(want - v.heading);
  return { steer: clamp(-diff * gain, -1, 1), diff };
}

/** Follows lanes on the road graph, keeps left, obeys robots, yields to obstacles. */
export class TrafficDriver {
  constructor(game, v, edge, from) {
    this.game = game;
    this.v = v;
    this.setEdge(edge, from);
    this.cruise = edge.speed * rand(0.8, 1.02);
    this.stuckT = 0;
    this.reverseT = 0;
    this.waitT = 0;
    this.panicT = 0;
    this.honkT = 0;
    this.ignoreT = 0;
    this.isTraffic = true;
  }
  setEdge(e, from) {
    const R = this.game.roads;
    this.edge = e;
    this.from = from;
    this.to = R.other(e, from);
    this.next = this.chooseNext();
  }
  chooseNext() {
    const R = this.game.roads;
    const node = R.nodes[this.to];
    const [dx, dz] = R.dirFrom(this.edge, this.from);
    const cands = node.edges.map((id) => R.edges[id]).filter((e) => e.id !== this.edge.id && e.traffic);
    if (!cands.length) return { e: this.edge, from: this.to };
    let total = 0;
    const w = cands.map((e) => {
      const [ex, ez] = R.dirFrom(e, this.to);
      const straight = dx * ex + dz * ez;
      const ww = straight > 0.8 ? 2.4 : 1;
      total += ww;
      return ww;
    });
    let r = Math.random() * total;
    for (let i = 0; i < cands.length; i++) {
      r -= w[i];
      if (r <= 0) return { e: cands[i], from: this.to };
    }
    return { e: cands[0], from: this.to };
  }
  onBump(speed) {
    if (speed > 6) this.panicT = 6;
  }
  update(dt) {
    const v = this.v, g = this.game, R = g.roads;
    let A = R.nodes[this.from];
    let [dx, dz] = R.dirFrom(this.edge, this.from);
    let s = (v.x - A.x) * dx + (v.z - A.z) * dz;
    for (let k = 0; k < 3 && s > this.edge.len - 1.2; k++) {
      this.setEdge(this.next.e, this.next.from);
      A = R.nodes[this.from];
      [dx, dz] = R.dirFrom(this.edge, this.from);
      s = (v.x - A.x) * dx + (v.z - A.z) * dz;
    }
    this.panicT -= dt;
    this.ignoreT -= dt;
    const vf = v.fwdSpeed;
    const look = 5 + Math.abs(vf) * 0.45;
    let tgt;
    if (s + look <= this.edge.len) tgt = R.lanePoint(this.edge, this.from, s + look);
    else tgt = R.lanePoint(this.next.e, this.next.from, Math.min(this.next.e.len, s + look - this.edge.len));
    let { steer } = steerTo(v, tgt.x, tgt.z, 2.4);

    // speed planning
    const B = R.nodes[this.to];
    const toNode = this.edge.len - s;
    let desired = this.cruise * (this.panicT > 0 ? 1.35 : 1);
    const [nx, nz] = R.dirFrom(this.next.e, this.next.from);
    const turn = 1 - (dx * nx + dz * nz);
    if (turn > 0.3 && toNode < 26) desired = Math.min(desired, 6.5 + toNode * 0.3);
    if (B.signal && this.panicT <= 0) {
      const col = g.signals.colorFor(this.edge.group);
      const stopD = B.maxWidth / 2 + 3.2;
      if (col !== 'G' && toNode > stopD - 1.5 && toNode < 34) {
        if (!(col === 'Y' && toNode < stopD + 5)) desired = Math.min(desired, Math.max(0, (toNode - stopD) * 0.65));
      }
    }
    const obs = g.vehicles.obstacleAhead(v, 5 + Math.abs(vf) * 1.15);
    if (obs && this.ignoreT <= 0) {
      desired = Math.min(desired, Math.max(0, (obs.d - 3.2) * 0.85));
      if (obs.who === 'player' && Math.abs(vf) < 1) {
        this.honkT -= dt;
        if (this.honkT <= 0) {
          this.honkT = rand(2, 4);
          g.audio.horn(v.x, v.z, true);
        }
      }
    }
    // stuck / reversing
    let thr;
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      thr = -0.7;
      steer = -steer;
    } else {
      thr = clamp((desired - vf) * 0.4, -1, 1);
      if (desired < 0.3 && vf < 1.2) thr = 0;
      if (thr > 0.25 && v.speed < 0.6) {
        this.stuckT += dt;
        if (this.stuckT > 2.2) {
          this.stuckT = 0;
          if (obs) this.ignoreT = 1.5;
          else this.reverseT = 1.1;
        }
      } else this.stuckT = 0;
      if (desired < 0.3 && v.speed < 0.6) {
        this.waitT += dt;
        if (this.waitT > 9 && obs && obs.who !== 'player') {
          this.waitT = 0;
          this.ignoreT = 1.5;
        }
      } else this.waitT = 0;
    }
    v.input.throttle = thr;
    v.input.steer = steer;
    v.input.handbrake = desired < 0.3 && Math.abs(vf) < 1.2;
  }
}

/** Drives straight at a target entity, used by police and gang cars. */
export class ChaseDriver {
  constructor(game, v, target, o = {}) {
    this.game = game;
    this.v = v;
    this.target = target;
    this.ram = o.ram ?? true;
    this.stopDist = o.stopDist ?? 0;
    this.speedMul = o.speedMul ?? 1;
    this.stuckT = 0;
    this.reverseT = 0;
  }
  update(dt) {
    const v = this.v, t = this.target;
    if (!t) return;
    const tv = t.vehicle || (t.vx !== undefined ? t : null);
    const lead = 0.5;
    const tx = t.x + (tv ? tv.vx * lead : 0), tz = t.z + (tv ? tv.vz * lead : 0);
    const d = dist(v.x, v.z, tx, tz);
    let { steer, diff } = steerTo(v, tx, tz, 2.6);
    let thr = 1 * this.speedMul;
    if (Math.abs(diff) > 1.6 && d < 25) thr = 0.6;
    if (this.stopDist && d < this.stopDist) thr = v.fwdSpeed > 1 ? -1 : 0;
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      thr = -0.8;
      steer = -steer;
    } else if (thr > 0.3 && v.speed < 1) {
      this.stuckT += dt;
      if (this.stuckT > 1.4) {
        this.stuckT = 0;
        this.reverseT = 1.2;
      }
    } else this.stuckT = 0;
    v.input.throttle = thr;
    v.input.steer = steer;
    v.input.handbrake = Math.abs(diff) > 1.2 && v.speed > 14;
  }
}

/** Follows a node path quickly (scripted escapes, escorts). */
export class RouteDriver {
  constructor(game, v, nodePath, o = {}) {
    this.game = game;
    this.v = v;
    this.path = nodePath;
    this.i = 0;
    this.speed = o.speed ?? 22;
    this.onArrive = o.onArrive || null;
    this.done = false;
    this.stuckT = 0;
    this.reverseT = 0;
    this.final = o.final || null;
  }
  update(dt) {
    const v = this.v, R = this.game.roads;
    if (this.done) {
      v.input.throttle = v.fwdSpeed > 0.5 ? -1 : 0;
      v.input.steer = 0;
      v.input.handbrake = true;
      return;
    }
    const pts = this.points || (this.points = this.buildPoints());
    let tgt = pts[this.i];
    while (tgt && dist(v.x, v.z, tgt.x, tgt.z) < 7 + v.speed * 0.25) {
      this.i++;
      tgt = pts[this.i];
    }
    if (!tgt) {
      this.done = true;
      if (this.onArrive) this.onArrive();
      return;
    }
    let { steer, diff } = steerTo(v, tgt.x, tgt.z, 2.5);
    let desired = this.speed;
    if (Math.abs(diff) > 0.6) desired = Math.min(desired, 12);
    const obs = this.game.vehicles.obstacleAhead(v, 6 + v.speed * 0.7);
    if (obs && obs.who !== 'player') desired = Math.min(desired, Math.max(4, obs.d));
    let thr = clamp((desired - v.fwdSpeed) * 0.35, -1, 1);
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      thr = -0.8;
      steer = -steer;
    } else if (thr > 0.3 && v.speed < 1) {
      this.stuckT += dt;
      if (this.stuckT > 1.2) {
        this.stuckT = 0;
        this.reverseT = 1.0;
      }
    } else this.stuckT = 0;
    v.input.throttle = thr;
    v.input.steer = steer;
    v.input.handbrake = false;
  }
  buildPoints() {
    const R = this.game.roads;
    const out = [];
    for (let k = 0; k + 1 < this.path.length; k++) {
      const e = R.edgeBetween(this.path[k], this.path[k + 1]);
      if (!e) continue;
      const off = laneOffsetFor(e);
      for (let s = 6; s < e.len; s += 12) out.push(R.lanePoint(e, this.path[k], s, off));
      out.push(R.lanePoint(e, this.path[k], e.len - 2, off));
    }
    if (this.final) out.push(this.final);
    return out;
  }
}

// ------------------------------------------------------------ system
export class VehicleSystem {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  spawn(type, x, z, heading, o = {}) {
    const v = new Vehicle(this.game, type, x, z, heading, o);
    this.list.push(v);
    return v;
  }

  spawnTraffic(edge, from, s, type) {
    const g = this.game;
    const p = g.roads.lanePoint(edge, from, s);
    const v = this.spawn(type, p.x, p.z, Math.atan2(p.dx, p.dz));
    v.driver = 'npc';
    v.npcLook = randomLook();
    v.ai = new TrafficDriver(g, v, edge, from);
    const sp = edge.speed * 0.7;
    v.vx = p.dx * sp;
    v.vz = p.dz * sp;
    return v;
  }

  remove(v) {
    const i = this.list.indexOf(v);
    if (i >= 0) this.list.splice(i, 1);
    if (this.game.player.vehicle === v) this.game.player.exitVehicle(true);
    v.dispose();
  }

  nearest(x, z, r) {
    let best = null, bd = r;
    for (const v of this.list) {
      const d = v.distTo(x, z);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  nearestEnterable(x, z, r) {
    let best = null, bd = r;
    for (const v of this.list) {
      if (v.state === 'wrecked' || v.driver === 'player' || v.locked) continue;
      if (v.speed > 6) continue;
      const d = v.distTo(x, z);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  /** Closest thing in v's driving corridor: {d, who}. */
  obstacleAhead(v, range) {
    const s = Math.sin(v.heading), c = Math.cos(v.heading);
    let best = null;
    const test = (x, z, hw, hl, who) => {
      const dx = x - v.x, dz = z - v.z;
      if (Math.abs(dx) > range + 6 || Math.abs(dz) > range + 6) return;
      const lz = dx * s + dz * c;
      if (lz <= 0) return;
      const lx = -dx * c + dz * s;
      if (Math.abs(lx) > v.halfW + hw + 0.35) return;
      const d = lz - v.halfL - hl;
      if (d < range && (!best || d < best.d)) best = { d: Math.max(0, d), who };
    };
    for (const o of this.list) if (o !== v) test(o.x, o.z, o.halfW, o.halfL * 0.8, 'car');
    const p = this.game.player;
    if (p.state !== 'vehicle' && p.state !== 'dead') test(p.x, p.z, 0.4, 0.3, 'player');
    for (const ped of this.game.peds.list) test(ped.x, ped.z, 0.4, 0.3, 'ped');
    return best;
  }

  update(dt) {
    const g = this.game;
    for (const v of this.list) if (v.ai && v.driver && v.state === 'ok') v.ai.update(dt);
    for (const v of this.list) v.update(dt);
    this.collideCars();
    this.collidePeople();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i];
      if (v.state === 'wrecked' && v.wreckT <= 0 && g.player.vehicle !== v && !v.mission) {
        this.list.splice(i, 1);
        v.dispose();
      }
    }
    g.wheels.flush();
  }

  collideCars() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const rr = a.radius + b.radius;
        if (dx * dx + dz * dz > rr * rr) continue;
        // two circles per car along its length
        const ca = carCircles(a), cb = carCircles(b);
        for (const p of ca) for (const q of cb) {
          const ddx = q.x - p.x, ddz = q.z - p.z;
          const r = p.r + q.r;
          const d2 = ddx * ddx + ddz * ddz;
          if (d2 >= r * r || d2 < 1e-6) continue;
          const d = Math.sqrt(d2);
          const nx = ddx / d, nz = ddz / d;
          const over = r - d;
          const ma = a.state === 'wrecked' ? a.mass * 2 : a.mass, mb = b.state === 'wrecked' ? b.mass * 2 : b.mass;
          const ta = mb / (ma + mb), tb = ma / (ma + mb);
          a.x -= nx * over * ta;
          a.z -= nz * over * ta;
          b.x += nx * over * tb;
          b.z += nz * over * tb;
          const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
          if (rel < 0) {
            const jimp = (-(1 + 0.25) * rel) / (1 / ma + 1 / mb);
            a.vx -= (jimp / ma) * nx;
            a.vz -= (jimp / ma) * nz;
            b.vx += (jimp / mb) * nx;
            b.vz += (jimp / mb) * nz;
            const imp = -rel;
            if (imp > 3) {
              const px = (p.x + q.x) / 2, pz = (p.z + q.z) / 2;
              a.onImpact(imp * 0.9, px, pz);
              b.onImpact(imp * 0.9, px, pz);
              if (a.driver === 'player' || b.driver === 'player') {
                const other = a.driver === 'player' ? b : a;
                other.lastPlayerHit = this.game.time;
                if (other.type === 'police' && imp > 6) this.game.police.crime('ramCop', 1);
              }
            }
          }
        }
      }
    }
  }

  collidePeople() {
    const g = this.game;
    const people = g.peds.list;
    const pl = g.player;
    for (const v of this.list) {
      const sp = v.speed;
      const check = (who) => {
        if (who.state === 'dead') return;
        const dx = who.x - v.x, dz = who.z - v.z;
        if (Math.abs(dx) > v.radius + 1 || Math.abs(dz) > v.radius + 1) return;
        if (who.onPlateau) return;
        const { lx, lz } = v.localOf(who.x, who.z);
        const pad = who.radius;
        if (Math.abs(lx) > v.halfW + pad || Math.abs(lz) > v.halfL + pad) return;
        // velocity of the car towards the person
        const rvx = v.vx, rvz = v.vz;
        const towards = sp > 0.1 ? (dx * rvx + dz * rvz) / (Math.hypot(dx, dz) * sp || 1) : 0;
        if (sp > 4.5 && towards > -0.2 && who.state !== 'down') {
          const r = v.right;
          const side = lx >= 0 ? 1 : -1;
          const dirx = rvx / sp * 0.7 + r.x * side * 0.5, dirz = rvz / sp * 0.7 + r.z * side * 0.5;
          const dmg = sp * 2.6;
          const attacker = v.driver === 'player' ? pl : null;
          if (who === pl) pl.takeHit(dmg * 0.6, dirx, dirz, v, 'car');
          else who.takeHit(dmg, dirx, dirz, attacker, 'car');
          g.audio.thud(v.x, v.z);
          v.vx *= 0.93;
          v.vz *= 0.93;
          if (v.driver === 'player') g.cameraRig.shake(0.2);
        } else {
          // push the person out of the car footprint
          const ex = v.halfW + pad - Math.abs(lx), ez = v.halfL + pad - Math.abs(lz);
          const r = v.right, f = v.fwd;
          if (ex < ez) {
            const s = lx >= 0 ? 1 : -1;
            who.tryMove(r.x * s * ex, r.z * s * ex);
          } else {
            const s = lz >= 0 ? 1 : -1;
            who.tryMove(f.x * s * ez, f.z * s * ez);
          }
        }
      };
      if (pl.state === 'foot' || pl.state === 'down') check(pl);
      for (const p of people) check(p);
    }
  }

  clearNonMission(keep = null) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i];
      if (v === keep || v.mission || v.persistent || this.game.player.vehicle === v) continue;
      this.list.splice(i, 1);
      v.dispose();
    }
  }
}

function carCircles(v) {
  const f = v.fwd;
  const off = Math.max(0, v.halfL - v.halfW);
  const r = v.halfW + 0.05;
  return [
    { x: v.x + f.x * off, z: v.z + f.z * off, r },
    { x: v.x - f.x * off, z: v.z - f.z * off, r },
  ];
}
