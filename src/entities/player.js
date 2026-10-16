// Sizwe: on-foot movement, swimming, jumping, combos, entering/exiting vehicles.

import { HumanRig, LOOKS } from './humanModel.js';
import { clamp, damp, turnTowards, headingTo, wrapAngle, dist } from '../core/util.js';
import { T } from '../world/grid.js';
import { PLATEAU } from '../world/mapData.js';

const ATTACKS = {
  punchR: { dur: 0.34, hitAt: 0.12, range: 1.55, dmg: 11, kind: 'light' },
  punchL: { dur: 0.34, hitAt: 0.12, range: 1.55, dmg: 11, kind: 'light' },
  kick: { dur: 0.55, hitAt: 0.24, range: 1.9, dmg: 19, kind: 'heavy' },
};
const COMBO = ['punchR', 'punchL', 'kick'];

export class Player {
  constructor(game) {
    this.game = game;
    this.look = { ...LOOKS.sizwe };
    this.rig = new HumanRig(this.look);
    game.scene.add(this.rig.group);
    this.x = 0;
    this.z = 0;
    this.y = 0;
    this.vy = 0;
    this.vx = 0;
    this.vz = 0;
    this.heading = 0;
    this.radius = 0.38;
    this.health = 100;
    this.maxHealth = 100;
    this.stamina = 100;
    this.state = 'foot'; // foot | vehicle | down | dead
    this.vehicle = null;
    this.attack = null;
    this.comboStep = -1;
    this.comboT = 0;
    this.queued = false;
    this.downT = 0;
    this.lastDamageT = -99;
    this.invulnT = 0;
    this.onPlateau = false;
    this.swimming = false;
    this.airborne = false;
    this.locked = false; // cutscenes / dialogue
    this.anim = null; // {mode, t, liftP}
    this.carry = false;
    this.speedNow = 0;
    this.stepT = 0;
    this.isPlayer = true;
    this.hostile = false;
  }

  get muscle() {
    return this.game.state.stats.muscle;
  }
  get staminaStat() {
    return this.game.state.stats.stamina;
  }

  place(x, z, heading = this.heading, plateau = false) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.onPlateau = plateau;
    this.y = this.groundAt(x, z);
    this.vx = this.vz = this.vy = 0;
    this.rig.group.position.set(this.x, this.y, this.z);
  }

  groundAt(x, z) {
    if (this.onPlateau) return PLATEAU.y;
    const t = this.game.grid.typeAt(x, z);
    return t === T.WALK ? 0.12 : 0;
  }

  blocked(x, z) {
    if (this.onPlateau) {
      if (!this.game.grid.insidePlateau(x, z, 0.95)) return true;
      const ct = this.game.world.cableTopRect;
      return x > ct[0] && x < ct[2] && z > ct[1] && z < ct[3];
    }
    return this.game.grid.circleBlocked(x, z, this.radius, false);
  }

  tryMove(dx, dz) {
    const nx = this.x + dx, nz = this.z + dz;
    const stuck = this.blocked(this.x, this.z);
    if (stuck || !this.blocked(nx, this.z)) this.x = nx;
    if (stuck || !this.blocked(this.x, nz)) this.z = nz;
    const g = this.game.grid;
    this.x = clamp(this.x, g.minX + 2, g.maxX - 2);
    this.z = clamp(this.z, g.minZ + 2, g.maxZ - 2);
  }

  update(dt, input) {
    const g = this.game;
    this.comboT -= dt;
    this.invulnT -= dt;
    if (this.state === 'dead') {
      this.rig.animate(dt, { mode: 'down' });
      return;
    }
    if (this.state === 'vehicle') {
      this.updateDriving(dt, input);
      return;
    }
    if (this.state === 'down') {
      this.downT -= dt;
      this.vx = damp(this.vx, 0, 4, dt);
      this.vz = damp(this.vz, 0, 4, dt);
      this.tryMove(this.vx * dt, this.vz * dt);
      this.y = this.groundAt(this.x, this.z);
      this.rig.animate(dt, { mode: 'down' });
      this.syncRig();
      if (this.downT <= 0) this.state = 'foot';
      return;
    }

    const grid = g.grid;
    this.swimming = !this.onPlateau && grid.isWater(this.x, this.z);
    const mv = this.locked || this.anim ? { x: 0, y: 0, mag: 0 } : input.move;
    const { f, r } = g.cameraRig.basis();
    let tvx = 0, tvz = 0, moving = false, sprint = false;
    if (mv.mag > 0.05) {
      let dx = f.x * mv.y + r.x * mv.x, dz = f.z * mv.y + r.z * mv.x;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      sprint = input.held('sprint') && this.stamina > 3 && !this.swimming;
      let sp;
      if (this.swimming) sp = 2.6 + this.staminaStat * 0.01;
      else if (sprint) sp = 9.2 + this.staminaStat * 0.025;
      else if (mv.keyboard) sp = 5.6;
      else sp = mv.mag < 0.55 ? 2.4 * (mv.mag / 0.55) + 0.6 : 5.8;
      if (this.carry) sp = Math.min(sp, 4.5);
      if (this.attack) sp *= 0.25;
      tvx = dx * sp;
      tvz = dz * sp;
      moving = true;
      this.heading = turnTowards(this.heading, Math.atan2(dx, dz), (this.attack ? 4 : 13) * dt);
    }
    const accel = this.airborne ? 2 : 11;
    this.vx = damp(this.vx, tvx, accel, dt);
    this.vz = damp(this.vz, tvz, accel, dt);
    // stamina
    if (sprint && moving) this.stamina = Math.max(0, this.stamina - (15 - this.staminaStat * 0.1) * dt);
    else if (this.swimming && moving) this.stamina = Math.max(0, this.stamina - 3 * dt);
    else this.stamina = Math.min(100, this.stamina + 20 * dt);
    if (sprint && moving && Math.random() < dt * 0.4) g.state.stats.staminaXp = (g.state.stats.staminaXp || 0) + 1;

    // jump
    if (!this.locked && !this.anim && input.pressed('jump') && !this.airborne && !this.swimming) {
      this.vy = 5.8;
      this.airborne = true;
      g.audio.jump();
    }
    this.vy -= 18 * dt;
    this.y += this.vy * dt;
    const gy = this.swimming ? 0 : this.groundAt(this.x, this.z);
    if (this.y <= gy) {
      if (this.airborne && this.vy < -9) g.effects.dust(this.x, gy + 0.1, this.z, 4);
      this.y = gy;
      this.vy = 0;
      this.airborne = false;
    }

    this.tryMove(this.vx * dt, this.vz * dt);
    this.speedNow = Math.hypot(this.vx, this.vz);
    if (this.swimming && moving && Math.random() < dt * 6) g.effects.splash(this.x, 0, this.z, 2);
    // footsteps
    if (!this.swimming && !this.airborne && this.speedNow > 1) {
      this.stepT -= dt * this.speedNow;
      if (this.stepT <= 0) {
        this.stepT = 1.7;
        g.audio.step(sprint);
      }
    }

    // attack / combos
    if (!this.locked && !this.anim && !this.swimming && input.pressed('attack')) this.startAttack();
    if (this.attack) this.updateAttack(dt);

    // health regen
    if (g.time - this.lastDamageT > 6 && this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + 2.5 * dt);

    // animate
    const a = this.attack;
    if (this.anim) this.rig.animate(dt, { mode: this.anim.mode, liftP: this.anim.liftP });
    else if (this.swimming) this.rig.animate(dt, { mode: 'swim' });
    else this.rig.animate(dt, { speed: this.speedNow, airborne: this.airborne, action: a ? a.type : null, actionT: a ? a.t / a.dur : 0, carry: this.carry });
    this.rig.setMuscle(1 + this.muscle / 100 * 0.32);
    this.syncRig();
  }

  syncRig() {
    const gr = this.rig.group;
    gr.position.set(this.x, this.y, this.z);
    gr.rotation.y = this.heading;
    this.rig.blob.position.y = 0.03 + (this.groundAt(this.x, this.z) - this.y);
  }

  startAttack() {
    if (this.attack) {
      if (this.attack.t > this.attack.spec.dur * 0.45) this.queued = true;
      return;
    }
    const step = this.comboT > 0 ? (this.comboStep + 1) % 3 : 0;
    const type = COMBO[step];
    this.comboStep = step;
    const spec = ATTACKS[type];
    // auto-aim at nearest valid target
    const tgt = this.game.peds.bestMeleeTarget(this.x, this.z, this.heading, 3.4);
    if (tgt) this.heading = headingTo(this.x, this.z, tgt.x, tgt.z);
    this.attack = { type, spec, t: 0, hit: false };
    this.game.audio.whoosh();
  }

  updateAttack(dt) {
    const a = this.attack;
    a.t += dt;
    if (!a.hit && a.t >= a.spec.hitAt) {
      a.hit = true;
      const mult = 1 + (this.muscle / 100) * 0.9;
      const landed = this.game.peds.meleeFrom(this, a.spec.range, a.spec.dmg * mult, a.spec.kind, 70);
      if (landed) {
        this.game.audio.punch(a.type === 'kick');
        this.game.cameraRig.shake(a.type === 'kick' ? 0.25 : 0.12);
      }
      // punching cars dents them a little
      const v = this.game.vehicles.nearest(this.x, this.z, 2.2);
      if (!landed && v && v.distTo(this.x + Math.sin(this.heading), this.z + Math.cos(this.heading)) < 0.6) {
        v.damage(2, 'player');
        this.game.audio.punch(false);
      }
    }
    if (a.t >= a.spec.dur) {
      this.attack = null;
      this.comboT = 0.45;
      if (this.queued) {
        this.queued = false;
        this.startAttack();
      }
    }
  }

  takeHit(dmg, dirX, dirZ, source, kind = 'light') {
    if (this.state === 'dead' || this.invulnT > 0) return;
    if (this.state === 'vehicle') {
      this.takeDamage(dmg * 0.3, kind);
      return;
    }
    this.takeDamage(dmg, kind);
    const push = kind === 'heavy' ? 5 : kind === 'car' ? 9 : 2.5;
    this.vx += dirX * push;
    this.vz += dirZ * push;
    this.attack = null;
    if ((kind === 'heavy' && Math.random() < 0.45) || kind === 'car' || kind === 'explosion') {
      this.state = 'down';
      this.downT = kind === 'car' ? 1.6 : 1.1;
      this.invulnT = 0.5;
    }
    this.game.effects.hit(this.x, this.y + 1.3, this.z);
  }

  takeDamage(dmg, kind) {
    if (this.state === 'dead') return;
    if (this.game.cheats.god) dmg = 0;
    this.health -= dmg;
    this.lastDamageT = this.game.time;
    if (dmg > 0) {
      this.game.hud.damageFlash(Math.min(1, dmg / 25));
      this.game.vibrate(30);
    }
    if (this.health <= 0) {
      this.health = 0;
      this.die(kind);
    }
  }

  die(cause) {
    if (this.vehicle) this.exitVehicle(true);
    this.state = 'dead';
    this.attack = null;
    this.game.onPlayerWasted(cause);
  }

  revive() {
    this.state = 'foot';
    this.health = this.maxHealth;
    this.stamina = 100;
    this.anim = null;
    this.carry = false;
    this.locked = false;
    this.rig.group.visible = true;
  }

  // ---------------- vehicles ----------------
  canEnter() {
    if (this.state !== 'foot' || this.swimming || this.onPlateau) return null;
    const v = this.game.vehicles.nearestEnterable(this.x, this.z, 2.2);
    return v;
  }

  enterVehicle(v) {
    if (!v || v.state === 'wrecked') return;
    if (v.driver === 'npc') this.game.peds.ejectDriver(v);
    if (v.type === 'police' && !v.mission) this.game.police.crime('stealCop', 2);
    v.driver = 'player';
    v.ai = null;
    this.vehicle = v;
    this.state = 'vehicle';
    this.attack = null;
    this.rig.group.visible = false;
    this.game.hud.vehicleName(v.label);
    this.game.audio.door();
    this.game.onEnterVehicle(v);
  }

  exitVehicle(force = false) {
    const v = this.vehicle;
    if (!v) return;
    const sp = v.speed;
    const r = v.right, f = v.fwd;
    const cands = [
      [v.x + r.x * (v.halfW + 0.7) + f.x * 0.3, v.z + r.z * (v.halfW + 0.7) + f.z * 0.3],
      [v.x - r.x * (v.halfW + 0.7) + f.x * 0.3, v.z - r.z * (v.halfW + 0.7) + f.z * 0.3],
      [v.x + f.x * (v.halfL + 0.8), v.z + f.z * (v.halfL + 0.8)],
      [v.x - f.x * (v.halfL + 0.8), v.z - f.z * (v.halfL + 0.8)],
    ];
    let spot = cands.find(([x, z]) => !this.game.grid.circleBlocked(x, z, this.radius, false));
    if (!spot) {
      const o = this.game.grid.findOpen(v.x, v.z, 12);
      spot = o ? [o.x, o.z] : [v.x, v.z + 3];
    }
    v.driver = null;
    v.input.throttle = 0;
    v.input.steer = 0;
    v.siren = false;
    this.vehicle = null;
    this.state = 'foot';
    this.place(spot[0], spot[1], v.heading);
    this.rig.group.visible = true;
    this.game.audio.door();
    this.game.onExitVehicle(v);
    if (!force && sp > 9) {
      this.vx = v.vx * 0.5;
      this.vz = v.vz * 0.5;
      this.state = 'down';
      this.downT = 1.2;
      this.takeDamage(Math.min(20, sp * 0.4), 'bail');
    }
  }

  updateDriving(dt, input) {
    const v = this.vehicle;
    if (!v || v.disposed) {
      this.state = 'foot';
      this.vehicle = null;
      this.rig.group.visible = true;
      return;
    }
    const mv = this.locked ? { x: 0, y: 0 } : input.move;
    v.input.throttle = mv.y;
    v.input.steer = mv.x;
    v.input.handbrake = !this.locked && input.held('brake');
    this.x = v.x;
    this.z = v.z;
    this.y = 0;
    this.heading = v.heading;
    if (g_hornPressed(input) && !this.locked) this.game.audio.horn();
    if (g_regen(this)) this.health = Math.min(this.maxHealth, this.health + 2.5 * dt);
    this.rig.group.position.set(this.x, this.y, this.z);
  }

  get position() {
    return { x: this.x, y: this.y, z: this.z };
  }
}

function g_hornPressed(input) {
  return input.pressed('horn');
}
function g_regen(p) {
  return p.game.time - p.lastDamageT > 6 && p.health < p.maxHealth;
}
