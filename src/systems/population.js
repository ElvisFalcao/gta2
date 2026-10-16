// Keeps the streets alive around the player: pedestrians, traffic, parked cars and crowds.

import { PARKING } from '../world/mapData.js';
import { randomLook } from '../entities/humanModel.js';
import { dist, rand, chance, pick } from '../core/util.js';

const CROWDS = [
  { x: -596, z: 270, r: 40, n: 8, anims: ['sunbathe', 'sit', 'sit', null], beach: true },
  { x: -568, z: 100, r: 16, n: 3, anims: ['sunbathe', 'sit'], beach: true },
  { x: -508, z: -200, r: 55, n: 5, anims: [null], fast: true },
  { x: -440, z: -376, r: 16, n: 3, anims: [null, 'sit'] },
  { x: 60, z: -425, r: 28, n: 6, anims: [null, null, 'talk'] },
  { x: 215, z: -244, r: 20, n: 6, anims: [null, 'talk'] },
  { x: 75, z: -115, r: 22, n: 5, anims: [null, 'sit'] },
  { x: 641, z: 133, r: 9, n: 7, anims: ['dance', 'dance', 'dance', 'talk'] },
  { x: 560, z: 40, r: 24, n: 5, anims: [null, 'talk'] },
  { x: 720, z: 200, r: 24, n: 8, anims: [null], fast: true },
  { x: 145, z: -316, r: 20, n: 5, anims: [null, 'talk'] },
  { x: -150, z: -162, r: 18, n: 3, anims: [null, 'talk'] },
  { x: -82, z: -165, r: 14, n: 3, anims: [null] },
];

export class Population {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.crowdPeds = new Map();
    this.parked = PARKING.map((p) => ({ ...p, vehicle: null, cooldown: 0 }));
    this.enabled = true;
  }

  get pedTarget() {
    return this.game.quality.peds;
  }
  get trafficTarget() {
    return this.game.quality.traffic;
  }

  update(dt) {
    if (!this.enabled) return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.35;
    const g = this.game, p = g.player;
    const px = p.x, pz = p.z;
    // ---- despawn far things
    for (const ped of g.peds.list) {
      if (ped.mission || ped.persistent || ped.crowd || g.police.cops.has(ped)) continue;
      if (dist(ped.x, ped.z, px, pz) > 140) ped.removeMe = true;
    }
    for (const v of [...g.vehicles.list]) {
      if (v.mission || v.persistent || p.vehicle === v || g.police.cars.has(v)) continue;
      const d = dist(v.x, v.z, px, pz);
      if (v.parkedId !== null && v.parkedSpot) {
        if (d > 240 && v.driver !== 'player') {
          v.parkedSpot.vehicle = null;
          g.vehicles.remove(v);
        }
        continue;
      }
      if (d > 230 && !g.isVisible(v.x, v.z, 300)) g.vehicles.remove(v);
    }
    // ---- crowds
    for (const c of CROWDS) {
      const d = dist(c.x, c.z, px, pz);
      let list = this.crowdPeds.get(c) || [];
      list = list.filter((q) => !q.removeMe && g.peds.list.includes(q));
      if (d < 150 && list.length < c.n && !p.onPlateau) {
        for (let i = list.length; i < c.n; i++) {
          const a = rand(0, Math.PI * 2), r = rand(0, c.r);
          const o = g.grid.findOpen(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, 6);
          if (!o) continue;
          const look = randomLook();
          if (c.beach && chance(0.6)) {
            look.shirt = look.skin;
            look.sleeves = 'short';
            look.hat = chance(0.3) ? 'cap' : 'none';
          }
          const q = g.peds.spawn(o.x, o.z, { kind: 'civ', look, ai: 'roam', anim: pick(c.anims), homeR: c.r, walkSpeed: c.fast ? rand(3.2, 4.4) : undefined });
          q.home = { x: c.x, z: c.z, r: c.r };
          q.crowd = true;
          list.push(q);
        }
      } else if (d > 190 && list.length) {
        for (const q of list) if (!q.mission) q.removeMe = true;
        list = [];
      }
      this.crowdPeds.set(c, list);
    }
    if (p.onPlateau) return;
    // ---- pedestrians on sidewalks
    const walkers = g.peds.count((q) => q.kind === 'civ' && !q.crowd && !q.mission);
    if (walkers < this.pedTarget) {
      for (let k = 0; k < 2; k++) {
        const e = g.roads.randomEdgeNear(px, pz, 35, 110);
        if (!e) break;
        const from = chance(0.5) ? e.a : e.b;
        const pt = g.roads.sidewalkPoint(e, from, rand(4, Math.max(5, e.len - 4)), chance(0.5) ? 1 : -1);
        if (!g.grid.isWalkable(pt.x, pt.z) || g.grid.circleBlocked(pt.x, pt.z, 0.5)) continue;
        if (g.isVisible(pt.x, pt.z, 45)) continue;
        const ped = g.peds.spawn(pt.x, pt.z, { kind: 'civ', ai: 'wander' });
        ped.route = null;
      }
    }
    // ---- traffic
    const traffic = g.vehicles.list.filter((v) => v.driver === 'npc' && v.ai && v.ai.isTraffic).length;
    if (traffic < this.trafficTarget) {
      const e = g.roads.randomEdgeNear(px, pz, 70, 180, { traffic: true });
      if (e && e.len > 18) {
        const from = chance(0.5) ? e.a : e.b;
        const s = rand(6, e.len - 6);
        const pt = g.roads.lanePoint(e, from, s);
        if (!g.vehicles.nearest(pt.x, pt.z, 12) && !g.isVisible(pt.x, pt.z, 70)) {
          const type = pick(['sedan', 'sedan', 'hatch', 'hatch', 'minibus', 'minibus', 'bakkie', 'suv', 'sports']);
          g.vehicles.spawnTraffic(e, from, s, type);
        }
      }
    }
    // ---- parked cars
    for (const spot of this.parked) {
      if (spot.vehicle && spot.vehicle.disposed) spot.vehicle = null;
      if (spot.vehicle) {
        if (spot.vehicle.driver === 'player' || dist(spot.vehicle.x, spot.vehicle.z, spot.x, spot.z) > 8) {
          // it has been taken: release the spot
          spot.vehicle.parkedSpot = null;
          spot.vehicle.parkedId = null;
          spot.vehicle = null;
          spot.cooldown = 60;
        }
        continue;
      }
      spot.cooldown -= 0.35;
      if (spot.cooldown > 0) continue;
      const d = dist(spot.x, spot.z, px, pz);
      if (d < 150 && d > 20 && !g.vehicles.nearest(spot.x, spot.z, 3)) {
        if (spot.id === 'kyleBakkie' && !g.state.flags.kyleBakkieFree) continue;
        const v = g.vehicles.spawn(spot.type, spot.x, spot.z, spot.h, { parkedId: spot.id || 'p' });
        v.parkedSpot = spot;
        spot.vehicle = v;
      }
    }
  }

  clearCrowds() {
    for (const [c, list] of this.crowdPeds) for (const q of list) q.removeMe = true;
    this.crowdPeds.clear();
  }
}
