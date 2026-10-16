// Wanted level ("heat"), police response on foot and in cars, arrests.

import { ChaseDriver } from './vehicles.js';
import { LOOKS } from '../entities/humanModel.js';
import { clamp, dist, rand, chance } from '../core/util.js';

const CRIME = { assault: 1, runOver: 1, assaultCop: 1.2, stealCop: 1.5, ramCop: 0.6, destroyCop: 2, explosion: 1 };

export class PoliceSystem {
  constructor(game) {
    this.game = game;
    this.heat = 0;
    this.lastCrime = -99;
    this.lastSeen = -99;
    this.spawnT = 0;
    this.arrestT = 0;
    this.cops = new Set();
    this.cars = new Set();
    this.sirenOn = false;
  }

  get stars() {
    return this.heat >= 1 ? Math.min(3, Math.floor(this.heat)) : 0;
  }

  crime(type, mult = 1) {
    const g = this.game;
    if (g.cheats.noPolice || g.missions.suppressPolice) return;
    const before = this.stars;
    this.heat = clamp(this.heat + (CRIME[type] ?? 1) * mult, 0, 3.6);
    if (this.heat > 0 && this.heat < 1) this.heat = 1;
    this.lastCrime = g.time;
    if (this.stars > before) {
      g.hud.wantedFlash();
      g.audio.wanted();
    }
  }

  clear() {
    this.heat = 0;
    this.arrestT = 0;
    for (const c of this.cops) {
      if (c.state !== 'dead') {
        c.ai = 'wander';
        c.kind = 'civ';
        c.reported = true;
      }
    }
    this.cops.clear();
    for (const v of this.cars) {
      v.siren = false;
      if (v.driver === 'npc') v.ai = null;
    }
    this.cars.clear();
  }

  update(dt) {
    const g = this.game, p = g.player;
    // forget removed entities
    for (const c of this.cops) if (c.removeMe || !g.peds.list.includes(c)) this.cops.delete(c);
    for (const v of this.cars) if (v.disposed) this.cars.delete(v);
    const stars = this.stars;
    this.sirenOn = [...this.cars].some((v) => v.siren && dist(v.x, v.z, p.x, p.z) < 120);
    if (stars === 0) {
      this.arrestT = 0;
      return;
    }
    // line of sight-ish: any active cop close by keeps the heat on
    for (const c of this.cops) if (c.state === 'ok' && dist(c.x, c.z, p.x, p.z) < 35) this.lastSeen = g.time;
    for (const v of this.cars) if (v.state === 'ok' && dist(v.x, v.z, p.x, p.z) < 45) this.lastSeen = g.time;
    const calm = 10 + stars * 6;
    if (g.time - this.lastCrime > calm && g.time - this.lastSeen > 7) {
      this.heat = stars - 0.01;
      if (this.heat < 1) {
        this.clear();
        g.hud.toast('You lost the police', 'good');
        return;
      }
      this.lastCrime = g.time;
      g.hud.toast('Heat dropping…');
    }
    // spawn response
    this.spawnT -= dt;
    if (this.spawnT <= 0 && p.state !== 'dead') {
      this.spawnT = 2.2;
      const onFoot = [...this.cops].filter((c) => c.state !== 'dead').length;
      if (onFoot < Math.min(6, stars * 2) && !p.onPlateau) this.spawnCop();
      if (this.cars.size < Math.max(0, stars - 1) + (p.state === 'vehicle' && stars >= 1 ? 1 : 0)) this.spawnCar();
    }
    // police cars deploy officers when the suspect is on foot nearby
    for (const v of this.cars) {
      if (v.state !== 'ok' || v.deployed) continue;
      if (p.state !== 'vehicle' && dist(v.x, v.z, p.x, p.z) < 14 && v.speed < 6) {
        v.deployed = true;
        v.ai = new ChaseDriver(g, v, p, { stopDist: 30 });
        for (let i = 0; i < 2; i++) {
          const o = g.grid.findOpen(v.x + v.right.x * (2 + i), v.z + v.right.z * (2 + i), 6);
          if (o) this.addCop(o.x, o.z);
        }
      }
      if (v.state === 'ok' && v.health < v.maxHealth * 0.2 && v.lastPlayerHit > g.time - 3 && !v.reportedDestroy) {
        v.reportedDestroy = true;
        this.crime('destroyCop', 1);
      }
    }
    // arrests
    let grabbing = false;
    for (const c of this.cops) {
      if (c.state !== 'ok') continue;
      const d = dist(c.x, c.z, p.x, p.z);
      if (p.state === 'foot' || p.state === 'down') {
        if (d < 1.35) grabbing = true;
      } else if (p.state === 'vehicle' && p.vehicle && p.vehicle.speed < 1.5 && p.vehicle.distTo(c.x, c.z) < 1.4) grabbing = true;
    }
    if (grabbing) {
      this.arrestT += dt * (p.state === 'down' ? 2 : 1);
      if (this.arrestT > 1.8) {
        this.arrestT = 0;
        g.onBusted();
      }
    } else this.arrestT = Math.max(0, this.arrestT - dt * 0.6);
    // cleanup far-away units
    for (const c of this.cops) if (dist(c.x, c.z, p.x, p.z) > 200) { this.cops.delete(c); c.removeMe = true; }
    for (const v of this.cars) if (dist(v.x, v.z, p.x, p.z) > 260 && g.player.vehicle !== v) { this.cars.delete(v); g.vehicles.remove(v); }
  }

  addCop(x, z) {
    const g = this.game;
    const c = g.peds.spawn(x, z, { kind: 'police', look: { ...LOOKS.police, skin: rand(0, 1) < 0.5 ? '#6b4129' : '#a8724c' }, ai: this.stars >= 2 ? 'fight' : 'chase', health: 70, runSpeed: rand(6, 7.2), dmgMul: 0.9 });
    c.target = g.player;
    this.cops.add(c);
    return c;
  }

  spawnCop() {
    const g = this.game, p = g.player;
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2), r = rand(28, 45);
      const o = g.grid.findOpen(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, 8);
      if (o && !g.isVisible(o.x, o.z, 35)) {
        this.addCop(o.x, o.z);
        return;
      }
    }
  }

  spawnCar() {
    const g = this.game, p = g.player;
    const e = g.roads.randomEdgeNear(p.x, p.z, 60, 130, { traffic: true });
    if (!e) return;
    const from = chance(0.5) ? e.a : e.b;
    const pt = g.roads.lanePoint(e, from, e.len * 0.5);
    if (g.vehicles.nearest(pt.x, pt.z, 6)) return;
    const v = g.vehicles.spawn('police', pt.x, pt.z, Math.atan2(pt.dx, pt.dz));
    v.driver = 'npc';
    v.npcLook = { ...LOOKS.police };
    v.siren = true;
    v.ai = new ChaseDriver(g, v, p, { speedMul: 0.92 });
    this.cars.add(v);
  }
}
