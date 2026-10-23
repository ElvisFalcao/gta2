// Pedestrians, gang members, police officers, mission characters and dogs.

import * as THREE from 'three';
import { HumanRig, randomLook, LOOKS } from './humanModel.js';
import { clamp, damp, turnTowards, headingTo, wrapAngle, dist, rand, chance, pick } from '../core/util.js';
import { T } from '../world/grid.js';
import { PLATEAU } from '../world/mapData.js';

let PID = 1;

export class Ped {
  constructor(game, x, z, o = {}) {
    this.id = PID++;
    this.game = game;
    this.kind = o.kind || 'civ'; // civ | gang | police | npc | dog
    this.look = o.look || randomLook();
    this.isDog = this.kind === 'dog';
    this.rig = this.isDog ? new DogRig(o.dogColor) : new HumanRig(this.look);
    game.scene.add(this.rig.group);
    this.x = x;
    this.z = z;
    this.onPlateau = !!o.onPlateau;
    this.y = this.groundAt(x, z);
    this.heading = o.heading ?? rand(0, Math.PI * 2);
    this.vx = 0;
    this.vz = 0;
    this.radius = this.isDog ? 0.3 : 0.34;
    this.maxHealth = this.health = o.health ?? (this.kind === 'gang' ? 55 : this.kind === 'police' ? 80 : 35);
    this.ai = o.ai || (this.kind === 'civ' ? 'wander' : this.kind === 'gang' ? 'fight' : this.kind === 'police' ? 'chase' : 'idle');
    this.prevAi = this.ai;
    this.target = o.target || null;
    this.weapon = o.weapon || 'fists';
    this.mission = !!o.mission;
    this.persistent = !!o.persistent;
    this.name = o.name || null;
    this.anim = o.anim || null;
    this.home = { x, z, r: o.homeR ?? 8 };
    this.walkSpeed = o.walkSpeed ?? rand(1.25, 1.65);
    this.runSpeed = o.runSpeed ?? rand(5.4, 6.8);
    this.dmgMul = o.dmgMul ?? 1;
    this.tough = o.tough ?? (this.kind === 'civ' && chance(0.2));
    this.state = 'ok'; // ok | down | dead
    this.downT = 0;
    this.downE = 0;
    this.deadT = 0;
    this.deadE = 0;
    this.hitT = 0;
    this.attack = null;
    this.attackCD = rand(0.6, 1.4);
    this.fleeT = 0;
    this.stuckT = 0;
    this.sideT = 0;
    this.sideDir = 1;
    this.route = null;
    this.goal = null;
    this.speedNow = 0;
    this.reported = false;
    this.followDist = o.followDist ?? 2.2;
    this.faceTarget = o.faceTarget ?? (this.kind === 'npc');
    this.defeated = false;
    this.removeMe = false;
    this.icon = null;
    this.onDefeat = o.onDefeat || null;
    this.invulnerable = !!o.invulnerable;
    this.noFight = !!o.noFight;
    this.timer = rand(0, 3);
    if (this.weapon === 'bat' && !this.isDog) this.giveBat();
    this.sync();
  }

  get hostile() {
    return this.state === 'ok' && (this.ai === 'fight' || (this.kind === 'police' && this.ai === 'chase'));
  }

  giveBat() {
    const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.95, 6), new THREE.MeshLambertMaterial({ color: '#7a5230' }));
    bat.position.set(0, -0.08, 0.32); // held in the right hand, pointing forward
    bat.rotation.x = Math.PI / 2;
    this.rig.b.armR.add(bat);
  }

  groundAt(x, z) {
    if (this.onPlateau) return PLATEAU.y;
    return this.game.grid.typeAt(x, z) === T.WALK ? 0.12 : 0;
  }

  blocked(x, z) {
    if (this.onPlateau) return !this.game.grid.insidePlateau(x, z, 0.95);
    return this.game.grid.circleBlocked(x, z, this.radius, false);
  }

  tryMove(dx, dz) {
    const ox = this.x, oz = this.z;
    const stuck = this.blocked(this.x, this.z);
    if (stuck || !this.blocked(this.x + dx, this.z)) this.x += dx;
    if (stuck || !this.blocked(this.x, this.z + dz)) this.z += dz;
    return Math.hypot(this.x - ox, this.z - oz);
  }

  /** Steer towards a point; returns remaining distance. */
  moveTo(tx, tz, speed, dt, stopAt = 0.5) {
    let dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    if (d < stopAt) {
      this.vx = damp(this.vx, 0, 10, dt);
      this.vz = damp(this.vz, 0, 10, dt);
      this.tryMove(this.vx * dt, this.vz * dt);
      return d;
    }
    dx /= d;
    dz /= d;
    if (this.sideT > 0) {
      this.sideT -= dt;
      const a = this.sideDir * 1.1;
      const c = Math.cos(a), s = Math.sin(a);
      [dx, dz] = [dx * c + dz * s, dz * c - dx * s];
    }
    this.vx = damp(this.vx, dx * speed, 9, dt);
    this.vz = damp(this.vz, dz * speed, 9, dt);
    this.heading = turnTowards(this.heading, Math.atan2(dx, dz), 10 * dt);
    const moved = this.tryMove(this.vx * dt, this.vz * dt);
    if (moved < speed * dt * 0.25) {
      this.stuckT += dt;
      if (this.stuckT > 0.5) {
        this.stuckT = 0;
        this.sideT = 0.7;
        this.sideDir = chance(0.5) ? 1 : -1;
        if (this.route && chance(0.5)) this.route = null;
      }
    } else this.stuckT = Math.max(0, this.stuckT - dt);
    return d;
  }

  face(x, z, dt) {
    this.heading = turnTowards(this.heading, headingTo(this.x, this.z, x, z), 6 * dt);
  }

  update(dt) {
    const g = this.game;
    this.timer += dt;
    this.hitT -= dt;
    this.attackCD -= dt;
    if (this.state === 'dead') {
      this.deadT -= dt;
      this.deadE += dt;
      this.rig.animate(dt, { mode: 'down', elapsed: this.deadE });
      if (this.deadT < 1.5) this.rig.group.position.y = this.y - (1.5 - this.deadT) * 0.4;
      if (this.deadT <= 0 && !this.mission) this.removeMe = true;
      return;
    }
    if (this.state === 'down') {
      this.downT -= dt;
      this.downE += dt;
      this.vx = damp(this.vx, 0, 3.5, dt);
      this.vz = damp(this.vz, 0, 3.5, dt);
      this.tryMove(this.vx * dt, this.vz * dt);
      this.rig.animate(dt, { mode: 'down', elapsed: this.downE, remaining: this.downT });
      this.sync();
      if (this.downT <= 0) {
        this.state = 'ok';
        if (this.kind === 'civ') this.startFlee(g.player.x, g.player.z, 8);
      }
      return;
    }
    let action = null, actionT = 0;
    switch (this.ai) {
      case 'wander': this.doWander(dt); break;
      case 'roam': this.doRoam(dt); break;
      case 'idle': this.doIdle(dt); break;
      case 'flee': this.doFlee(dt); break;
      case 'fight': this.doFight(dt); break;
      case 'chase': this.doChase(dt); break;
      case 'follow': this.doFollow(dt); break;
      case 'goto': this.doGoto(dt); break;
      case 'cower': this.vx = this.vz = 0; break;
      default: break;
    }
    let mode = null;
    if (this.ai === 'cower') mode = 'handsup';
    else if (this.speedNow < 0.3 && this.anim && (this.ai === 'idle' || this.ai === 'roam')) mode = this.anim;
    if (this.attack) {
      this.attack.t += dt;
      const A = this.attack;
      action = A.t < A.windup ? 'windup' : this.weapon === 'bat' ? 'bat' : A.type;
      actionT = A.t < A.windup ? A.t / A.windup : (A.t - A.windup) / A.dur;
      if (!A.hit && A.t >= A.windup + A.dur * 0.3) {
        A.hit = true;
        this.resolveAttack();
      }
      if (A.t >= A.windup + A.dur) this.attack = null;
    } else if (this.hitT > 0) {
      action = 'hit';
      actionT = 1 - this.hitT / 0.3;
    }
    this.y = this.groundAt(this.x, this.z);
    this.speedNow = Math.hypot(this.vx, this.vz);
    if (this.isDog) this.rig.animate(dt, { speed: this.speedNow, sit: mode === 'sit' });
    else this.rig.animate(dt, { speed: this.speedNow, mode: action ? null : mode, action, actionT, guard: this.state === 'ok' && (this.ai === 'fight' || (this.kind === 'police' && this.ai === 'chase' && this.speedNow < 2)) && !!this.target });
    this.sync();
  }

  sync() {
    this.rig.group.position.set(this.x, this.y, this.z);
    this.rig.group.rotation.y = this.heading;
  }

  // ---------------- behaviours ----------------
  doIdle(dt) {
    this.vx = damp(this.vx, 0, 8, dt);
    this.vz = damp(this.vz, 0, 8, dt);
    const p = this.game.player;
    if (this.faceTarget && dist(this.x, this.z, p.x, p.z) < 7) this.face(p.x, p.z, dt);
    if (this.goal) this.ai = 'goto';
  }

  doRoam(dt) {
    // wander around home point (beaches, plazas, parks)
    if (!this.goal || this.timer > this.goal.t) {
      if (this.anim && chance(0.5)) {
        this.goal = { x: this.x, z: this.z, t: this.timer + rand(4, 9), still: true };
      } else {
        for (let i = 0; i < 6; i++) {
          const a = rand(0, Math.PI * 2), r = rand(0, this.home.r);
          const x = this.home.x + Math.cos(a) * r, z = this.home.z + Math.sin(a) * r;
          if (this.game.grid.isWalkable(x, z) && !this.blocked(x, z)) {
            this.goal = { x, z, t: this.timer + rand(5, 12) };
            break;
          }
        }
      }
    }
    if (this.goal && !this.goal.still) {
      const d = this.moveTo(this.goal.x, this.goal.z, this.walkSpeed, dt, 0.6);
      if (d < 0.7) this.goal.still = true;
    } else {
      this.vx = damp(this.vx, 0, 8, dt);
      this.vz = damp(this.vz, 0, 8, dt);
    }
    this.avoidTraffic(dt);
  }

  doWander(dt) {
    const R = this.game.roads;
    if (!this.route) {
      const ne = R.nearestEdge(this.x, this.z);
      if (!ne || ne.d > 25) {
        this.ai = 'roam';
        this.home = { x: this.x, z: this.z, r: 10 };
        return;
      }
      const e = ne.edge;
      const from = chance(0.5) ? e.a : e.b;
      const lx = e.dz, lz = -e.dx;
      const side = (this.x - ne.x) * lx + (this.z - ne.z) * lz >= 0 ? 1 : -1;
      this.route = { e, from, side: from === e.a ? side : -side };
    }
    const { e, from, side } = this.route;
    const to = R.other(e, from);
    const B = R.nodes[to];
    const end = R.sidewalkPoint(e, from, Math.max(0, e.len - (B.junction ? B.maxWidth / 2 + e.sidewalk : 0)), side);
    const d = this.moveTo(end.x, end.z, this.walkSpeed, dt, 1);
    if (d < 1.2) {
      const opts = B.edges.map((id) => R.edges[id]).filter((x) => x.id !== e.id);
      const ne = opts.length ? pick(opts) : e;
      this.route = { e: ne, from: to, side: chance(0.85) ? side : -side };
      if (ne === e) this.route.from = to;
    }
    this.avoidTraffic(dt);
  }

  avoidTraffic(dt) {
    // dodge fast cars heading for us
    const v = this.game.vehicles.nearest(this.x, this.z, 9);
    if (!v || v.speed < 8) return;
    const { lx, lz } = v.localOf(this.x, this.z);
    const fv = v.fwdSpeed;
    if (Math.abs(lx) < v.halfW + 1.2 && lz * Math.sign(fv) > 0 && Math.abs(lz) < 9) {
      const r = v.right;
      const s = lx >= 0 ? 1 : -1;
      this.vx += r.x * s * 30 * dt;
      this.vz += r.z * s * 30 * dt;
      if (this.kind === 'civ' && chance(dt * 2)) this.game.audio.shout(this.x, this.z);
      if (v.driver === 'player' && this.game.voice) this.game.voice.react(this, 'nearMiss');
    }
  }

  startFlee(fx, fz, t = 6) {
    if (this.mission && this.kind === 'npc') return;
    this.ai = 'flee';
    this.fleeFrom = { x: fx, z: fz };
    this.fleeT = t;
    this.route = null;
  }

  doFlee(dt) {
    this.fleeT -= dt;
    const f = this.fleeFrom;
    let dx = this.x - f.x, dz = this.z - f.z;
    const d = Math.hypot(dx, dz) || 1;
    this.moveTo(this.x + (dx / d) * 10, this.z + (dz / d) * 10, this.runSpeed, dt, 0.1);
    if (this.fleeT <= 0 && d > 15) {
      this.ai = this.kind === 'civ' ? 'wander' : this.prevAi;
      this.route = null;
    }
  }

  doGoto(dt) {
    const gl = this.goal;
    if (!gl) {
      this.ai = 'idle';
      return;
    }
    const d = this.moveTo(gl.x, gl.z, gl.run ? this.runSpeed : this.walkSpeed * 1.2, dt, 0.6);
    if (d < 0.8) {
      this.goal = null;
      this.ai = 'idle';
      if (gl.done) gl.done();
    }
  }

  doFollow(dt) {
    const t = this.target;
    if (!t) return;
    const d = dist(this.x, this.z, t.x, t.z);
    if (t.state === 'vehicle') {
      this.moveTo(t.x, t.z, this.runSpeed, dt, 3);
      return;
    }
    if (d > this.followDist) this.moveTo(t.x, t.z, d > 6 ? this.runSpeed : this.walkSpeed * 1.8, dt, this.followDist);
    else {
      this.vx = damp(this.vx, 0, 8, dt);
      this.vz = damp(this.vz, 0, 8, dt);
      this.face(t.x, t.z, dt);
    }
    if (d > 60 && t === this.game.player && !this.onPlateau) {
      // teleport closer (keeps escorts from getting lost behind buildings)
      const o = this.game.grid.findOpen(t.x - Math.sin(t.heading) * 2, t.z - Math.cos(t.heading) * 2, 8);
      if (o) { this.x = o.x; this.z = o.z; }
    }
  }

  pickTarget() {
    if (this.target && this.target.state !== 'dead' && !this.target.removeMe) return this.target;
    this.target = this.game.player;
    return this.target;
  }

  doFight(dt) {
    const t = this.pickTarget();
    if (!t || t.state === 'dead') {
      this.vx = damp(this.vx, 0, 8, dt);
      this.vz = damp(this.vz, 0, 8, dt);
      return;
    }
    const tx = t.x, tz = t.z;
    const d = dist(this.x, this.z, tx, tz);
    if (t.state === 'vehicle' && t.vehicle) {
      // bang on the car / back off
      if (d > 3.5) this.moveTo(tx, tz, this.runSpeed, dt, 3);
      else this.face(tx, tz, dt);
      return;
    }
    const reach = this.weapon === 'bat' ? 1.7 : 1.35;
    if (this.attack) {
      this.vx = damp(this.vx, 0, 10, dt);
      this.vz = damp(this.vz, 0, 10, dt);
      this.tryMove(this.vx * dt, this.vz * dt);
      this.face(tx, tz, dt);
      return;
    }
    if (d > reach) {
      // circle-strafe a little when several attackers
      this.moveTo(tx, tz, d > 8 ? this.runSpeed : this.runSpeed * 0.75, dt, reach * 0.9);
    } else {
      this.vx = damp(this.vx, 0, 10, dt);
      this.vz = damp(this.vz, 0, 10, dt);
      this.face(tx, tz, dt);
      if (this.attackCD <= 0 && t.state !== 'down') {
        const crowd = this.game.peds.attackersOn(t);
        if (crowd < 2 || chance(0.4)) {
          this.attack = { type: chance(0.5) ? 'punchR' : 'punchL', t: 0, windup: this.weapon === 'bat' ? 0.45 : 0.32, dur: 0.35, hit: false, target: t };
          this.attackCD = rand(1.0, 1.7);
        } else this.attackCD = 0.4;
      }
    }
  }

  resolveAttack() {
    const A = this.attack;
    const t = A.target;
    if (!t || t.state === 'dead') return;
    const d = dist(this.x, this.z, t.x, t.z);
    const reach = (this.weapon === 'bat' ? 2.0 : 1.6) + 0.2;
    const ang = Math.abs(wrapAngle(headingTo(this.x, this.z, t.x, t.z) - this.heading));
    if (d < reach && ang < 1.2) {
      const dx = (t.x - this.x) / (d || 1), dz = (t.z - this.z) / (d || 1);
      const dmg = (this.weapon === 'bat' ? 14 : 7) * this.dmgMul;
      if (t.isPlayer) t.takeHit(dmg, dx, dz, this, this.weapon === 'bat' ? 'heavy' : 'light');
      else t.takeHit(dmg, dx, dz, this, this.weapon === 'bat' ? 'heavy' : 'light');
      this.game.audio.punch(this.weapon === 'bat', this.x, this.z);
    }
  }

  doChase(dt) {
    const p = this.game.player;
    if (p.state === 'dead') {
      this.vx = damp(this.vx, 0, 8, dt);
      return;
    }
    if (p.state === 'vehicle') {
      this.moveTo(p.x, p.z, this.runSpeed, dt, 2.5);
      return;
    }
    this.moveTo(p.x, p.z, this.runSpeed * 1.05, dt, 0.9);
  }

  // ---------------- damage ----------------
  takeHit(dmg, dx, dz, attacker, kind = 'light') {
    if (this.state === 'dead' || this.invulnerable) return;
    const g = this.game;
    this.health -= dmg;
    this.hitT = 0.3;
    this.attack = null;
    const push = kind === 'car' ? 10 : kind === 'heavy' ? 6 : kind === 'explosion' ? 12 : 3.2;
    this.vx = dx * push;
    this.vz = dz * push;
    g.effects.hit(this.x, this.y + (this.isDog ? 0.5 : 1.3), this.z);
    const byPlayer = attacker === g.player || attacker === 'player';
    if (byPlayer) {
      if ((this.kind === 'civ' || this.kind === 'dog') && !this.reported) {
        this.reported = true;
        g.police.crime(kind === 'car' ? 'runOver' : 'assault', 1);
      }
      if (this.kind === 'police') g.police.crime('assaultCop', 1);
    }
    if (this.health <= 0) {
      this.knockOut(kind);
      return;
    }
    if (kind === 'car' || kind === 'explosion' || (kind === 'heavy' && chance(0.45))) {
      if (this.state !== 'down') this.downE = 0;
      this.state = 'down';
      this.downT = kind === 'car' ? 2.8 : 2.2; // fall, lie dazed, get up
    }
    if (this.kind === 'civ' && byPlayer) {
      if (this.tough && kind !== 'car' && !this.noFight) {
        this.prevAi = 'wander';
        this.ai = 'fight';
        this.target = g.player;
      } else this.startFlee(g.player.x, g.player.z, 10);
      g.peds.panicAround(this.x, this.z, 14, this);
    } else if (this.kind === 'police' && byPlayer) {
      this.ai = 'fight';
      this.target = g.player;
    } else if (this.kind === 'npc' && byPlayer && !this.mission) {
      this.startFlee(g.player.x, g.player.z, 8);
    }
    if (g.voice) g.voice.onHit(this, byPlayer);
  }

  knockOut(kind) {
    this.deadE = this.state === 'down' ? this.downE : 0; // already on the ground: don't fall again
    this.state = 'dead';
    this.health = 0;
    this.deadT = this.mission ? 9999 : 14;
    this.attack = null;
    this.defeated = true;
    if (this.icon) {
      this.icon.remove();
      this.icon = null;
    }
    if (this.onDefeat) this.onDefeat(this);
    this.game.events.emit('pedDefeated', this);
  }

  revive(health) {
    this.state = 'ok';
    this.health = health ?? this.maxHealth;
    this.defeated = false;
    this.rig.group.position.y = this.y;
  }

  dispose() {
    if (this.icon) this.icon.remove();
    this.game.scene.remove(this.rig.group);
    if (this.rig.dispose) this.rig.dispose();
  }
}

// ---------------------------------------------------------------- dog
class DogRig {
  constructor(color = '#b07a45') {
    this.group = new THREE.Group();
    const m = new THREE.MeshLambertMaterial({ color });
    const dark = new THREE.MeshLambertMaterial({ color: '#2b1d12' });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.8), m);
    body.position.y = 0.5;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.32), m);
    head.position.set(0, 0.75, 0.5);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.18), dark);
    snout.position.set(0, 0.7, 0.72);
    const earL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.07), dark);
    earL.position.set(0.1, 0.94, 0.44);
    const earR = earL.clone();
    earR.position.x = -0.1;
    this.tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.35), m);
    this.tail.position.set(0, 0.65, -0.52);
    this.tail.rotation.x = -0.6;
    this.legs = [];
    for (const [x, z] of [[0.12, 0.3], [-0.12, 0.3], [0.12, -0.3], [-0.12, -0.3]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.36, 0.09), m);
      l.geometry.translate(0, -0.18, 0);
      l.position.set(x, 0.38, z);
      this.legs.push(l);
    }
    this.group.add(body, head, snout, earL, earR, this.tail, ...this.legs);
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.phase = 0;
    this.b = {};
  }
  animate(dt, s) {
    this.phase += dt * (s.speed * 3 + 2);
    const sw = Math.sin(this.phase) * Math.min(0.7, s.speed * 0.25);
    this.legs[0].rotation.x = sw;
    this.legs[3].rotation.x = sw;
    this.legs[1].rotation.x = -sw;
    this.legs[2].rotation.x = -sw;
    this.tail.rotation.y = Math.sin(this.phase * 2.2) * 0.6;
  }
  setMuscle() {}
}

// ---------------------------------------------------------------- system
export class PedSystem {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  spawn(x, z, o = {}) {
    const p = new Ped(this.game, x, z, o);
    this.list.push(p);
    return p;
  }

  remove(p) {
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
    p.dispose();
  }

  count(filter) {
    let n = 0;
    for (const p of this.list) if (!filter || filter(p)) n++;
    return n;
  }

  near(x, z, r) {
    const out = [];
    for (const p of this.list) if (Math.abs(p.x - x) < r && Math.abs(p.z - z) < r && dist(p.x, p.z, x, z) < r) out.push(p);
    return out;
  }

  attackersOn(t) {
    let n = 0;
    for (const p of this.list) if (p.attack && p.attack.target === t) n++;
    return n;
  }

  bestMeleeTarget(x, z, heading, r) {
    let best = null, bs = Infinity;
    for (const p of this.list) {
      if (p.state === 'dead') continue;
      const d = dist(x, z, p.x, p.z);
      if (d > r) continue;
      const ang = Math.abs(wrapAngle(headingTo(x, z, p.x, p.z) - heading));
      const hostile = p.hostile ? 0 : 3;
      if (!p.hostile && (ang > 0.9 || d > 2)) continue;
      if (ang > 1.9) continue;
      const score = d + ang * 1.2 + hostile;
      if (score < bs) {
        bs = score;
        best = p;
      }
    }
    return best;
  }

  meleeFrom(attacker, range, dmg, kind, arcDeg) {
    let n = 0;
    const arc = (arcDeg * Math.PI) / 180;
    for (const p of this.list) {
      if (p.state === 'dead') continue;
      const d = dist(attacker.x, attacker.z, p.x, p.z);
      if (d > range + p.radius) continue;
      const ang = Math.abs(wrapAngle(headingTo(attacker.x, attacker.z, p.x, p.z) - attacker.heading));
      if (ang > arc) continue;
      const dx = (p.x - attacker.x) / (d || 1), dz = (p.z - attacker.z) / (d || 1);
      p.takeHit(dmg, dx, dz, attacker, kind);
      n++;
    }
    return n;
  }

  panicAround(x, z, r, except) {
    for (const p of this.near(x, z, r)) {
      if (p === except || p.kind !== 'civ' || p.ai !== 'wander' && p.ai !== 'roam') continue;
      if (chance(0.7)) p.startFlee(x, z, rand(5, 9));
      if (this.game.voice && chance(0.5)) this.game.voice.react(p, 'witness');
    }
  }

  ejectDriver(v) {
    const r = v.right, f = v.fwd;
    const x = v.x + r.x * (v.halfW + 0.7), z = v.z + r.z * (v.halfW + 0.7);
    const o = this.game.grid.findOpen(x, z, 6) || { x, z };
    const p = this.spawn(o.x, o.z, { kind: 'civ', look: v.npcLook || undefined, ai: 'flee' });
    p.startFlee(this.game.player.x, this.game.player.z, 10);
    p.state = 'down';
    p.downT = 1.6;
    p.downE = 0;
    v.driver = null;
    v.ai = null;
    v.npcLook = null;
    this.game.audio.shout(o.x, o.z);
    if (this.game.voice) this.game.voice.react(p, 'carjacked', { force: true });
    return p;
  }

  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.update(dt);
      if (p.removeMe) {
        L.splice(i, 1);
        p.dispose();
      }
    }
    // soft separation (people don't overlap each other or the player)
    const pl = this.game.player;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (a.state === 'dead') continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (b.state === 'dead') continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const rr = a.radius + b.radius;
        if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
        const d = Math.hypot(dx, dz);
        if (d < rr && d > 0.001) {
          const push = (rr - d) * 0.5;
          const nx = dx / d, nz = dz / d;
          a.tryMove(-nx * push, -nz * push);
          b.tryMove(nx * push, nz * push);
        }
      }
      if (pl.state === 'foot' || pl.state === 'down') {
        const dx = a.x - pl.x, dz = a.z - pl.z;
        const rr = a.radius + pl.radius;
        const d = Math.hypot(dx, dz);
        if (d < rr && d > 0.001) {
          const push = rr - d;
          a.tryMove((dx / d) * push * 0.7, (dz / d) * push * 0.7);
          pl.tryMove((-dx / d) * push * 0.3, (-dz / d) * push * 0.3);
          if (pl.speedNow > 3.5 && a.kind === 'civ' && a.state === 'ok' && this.game.voice) this.game.voice.react(a, 'bumped');
        }
      }
    }
  }

  clearNonMission() {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (!p.mission && !p.persistent) {
        this.list.splice(i, 1);
        p.dispose();
      }
    }
  }
}
