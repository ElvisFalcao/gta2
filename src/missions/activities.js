// Free-roam things to do: gym, beaches, food, cableway, taxi jobs, safehouse,
// hidden proteas and the Noon Gun.

import * as THREE from 'three';
import { POI, PROTEAS, PLATEAU } from '../world/mapData.js';
import { MeshKit, GEO, vcMaterial } from '../core/meshkit.js';
import { makePosterTexture, makeGlowTexture } from '../world/textures.js';
import { dist, rand, chance, pick, clamp, formatMoney, smoothstep } from '../core/util.js';
import { randomLook } from '../entities/humanModel.js';

export const POSTER_SPOTS = [
  { n: 'Long Street', x: 46.5, z: -246 },
  { n: "Company's Garden", x: 75, z: -143.5 },
  { n: 'Wale Street, Bo-Kaap', x: -100, z: -155 },
  { n: 'the taxi rank', x: 158, z: -301 },
  { n: 'the Waterfront', x: 95, z: -397 },
];

let posterTex = null;
export function makePosterBoard() {
  if (!posterTex) posterTex = makePosterTexture();
  const g = new THREE.Group();
  const k = new MeshKit();
  k.cyl(-0.55, 0, 0, 0.04, 2.1, '#3a3a3a', 6);
  k.cyl(0.55, 0, 0, 0.04, 2.1, '#3a3a3a', 6);
  k.box(0, 1.45, -0.03, 1.3, 1.6, 0.04, '#e8e8e8');
  g.add(new THREE.Mesh(k.build(), vcMaterial()));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5), new THREE.MeshLambertMaterial({ map: posterTex }));
  face.position.set(0, 1.45, 0.0);
  const back = face.clone();
  back.rotation.y = Math.PI;
  back.position.z = -0.06;
  g.add(face, back);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function proteaMesh() {
  const k = new MeshKit();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    k.add(GEO.box, { x: Math.sin(a) * 0.16, y: 0.42, z: Math.cos(a) * 0.16, sx: 0.09, sy: 0.38, sz: 0.04, ry: a, rx: 0.55, color: i % 2 ? '#f06292' : '#ec407a' });
  }
  k.add(GEO.cone8, { x: 0, y: 0.45, z: 0, sx: 0.22, sy: 0.3, sz: 0.22, color: '#f8bbd0' });
  k.cyl(0, 0, 0, 0.03, 0.3, '#3e6b38', 6);
  for (const a of [0.5, 2.6, 4.4]) k.add(GEO.box, { x: Math.sin(a) * 0.15, y: 0.15, z: Math.cos(a) * 0.15, sx: 0.06, sy: 0.02, sz: 0.3, ry: a, rx: -0.4, color: '#4f7d34' });
  const m = new THREE.Mesh(k.build(), vcMaterial({ emissive: '#5a1030', emissiveIntensity: 0.4 }));
  m.scale.setScalar(1.6);
  return m;
}

const PLACES = [
  { n: 'Camps Bay beachfront', x: -575, z: 300 }, { n: 'the Sea Point promenade', x: -510, z: -140 }, { n: 'the V&A Waterfront', x: 60, z: -410 },
  { n: 'Long Street', x: 46, z: -200 }, { n: 'the Bo-Kaap', x: -150, z: -160 }, { n: 'Woodstock', x: 400, z: -150 }, { n: 'Observatory', x: 380, z: 6 },
  { n: 'Langa', x: 600, z: 120 }, { n: 'Gardens', x: 80, z: 6 }, { n: 'Green Point', x: -300, z: -300 }, { n: 'City Hospital', x: 296, z: 14 },
  { n: 'the Castle', x: 250, z: -205 }, { n: 'Clifton', x: -545, z: 60 }, { n: 'Kloof Nek', x: -340, z: 205 },
];
export { PLACES };

export class Activities {
  constructor(game) {
    this.game = game;
    this.taxi = null;
    this.ride = null;
    this.posterBoards = [];
    this.proteaMeshes = new Map();
    this.lastHour = game.env.hours;
    const I = game.interactions;
    const g = game;
    I.add('gym', { x: POI.gym.x, z: POI.gym.z, r: 3, label: '💪 Work out', onUse: () => this.gym() });
    I.add('beachCamps', { x: POI.beachCamps.x, z: POI.beachCamps.z, r: 3, label: '🏖 Chill on the beach', onUse: () => this.beach('Camps Bay') });
    I.add('beachClifton', { x: POI.beachClifton.x, z: POI.beachClifton.z, r: 3, label: '🏖 Chill on the beach', onUse: () => this.beach('Clifton') });
    I.add('gatsby', { x: 47.6, z: -185, r: 2.6, label: '🥖 Gatsby — R45', onUse: () => this.eat('a massive Gatsby', 45, 60) });
    I.add('fish', { x: 60, z: -400.6, r: 2.6, label: '🐟 Fish & chips — R55', onUse: () => this.eat('fish & chips at the Waterfront', 55, 70) });
    I.add('shisa', { x: 640, z: 115.2, r: 2.6, label: '🍖 Braai plate — R60', onUse: () => this.eat('a shisa nyama braai plate', 60, 100) });
    I.add('koek', { x: -165, z: -169, r: 2.4, label: '🍩 Koeksisters — R15', enabled: () => g.missions.isDone('m5'), onUse: () => this.eat("Aunty Rashieda's koeksisters", 15, 25) });
    I.add('cableUp', { x: POI.cableLower.x + 6, z: POI.cableLower.z - 6, r: 2.6, label: '🚡 Cableway up — R80', onUse: () => this.rideCable(true) });
    I.add('cableDown', { x: POI.cableTop.x, z: POI.cableTop.z, r: 3, plateau: true, label: '🚡 Cableway down', onUse: () => this.rideCable(false) });
    I.add('viewpoint', { x: POI.viewpoint.x, z: POI.viewpoint.z + 1, r: 3.2, plateau: true, label: '🔭 Enjoy the view', enabled: () => !g.missions.active, onUse: () => this.enjoyView() });
    I.add('safehouse', { x: POI.safehouse.x + 3.5, z: POI.safehouse.z + 1.2, r: 2.4, label: '💾 Save & rest', enabled: () => !!g.state.flags.safehouse, onUse: () => this.rest() });
    // proteas
    this.proteaSpots = [];
    PROTEAS.forEach((p, i) => {
      const plateau = p.length > 2;
      let x = p[0], z = p[1];
      if (!plateau) {
        const o = g.grid.findOpen(x, z, 20);
        if (o) ({ x, z } = o);
      }
      this.proteaSpots.push({ i, x, z, plateau });
    });
  }

  refresh() {
    const g = this.game;
    // proteas
    for (const s of this.proteaSpots) {
      const has = g.state.proteas.includes(s.i);
      if (!has && !this.proteaMeshes.has(s.i)) {
        const m = proteaMesh();
        m.position.set(s.x, s.plateau ? PLATEAU.y : 0, s.z);
        g.scene.add(m);
        this.proteaMeshes.set(s.i, m);
      } else if (has && this.proteaMeshes.has(s.i)) {
        g.scene.remove(this.proteaMeshes.get(s.i));
        this.proteaMeshes.delete(s.i);
      }
    }
    // Noma's posters stay up after the mission
    if (g.state.flags.postersUp && !this.posterBoards.length) {
      for (const s of POSTER_SPOTS) {
        const o = g.grid.findOpen(s.x, s.z, 6) || s;
        const b = makePosterBoard();
        b.position.set(o.x, 0, o.z);
        b.rotation.y = Math.random() * Math.PI * 2;
        g.scene.add(b);
        this.posterBoards.push(b);
      }
    }
  }

  get taxiActive() {
    return !!this.taxi;
  }

  blips(out, full) {
    const g = this.game;
    const near = (x, z) => full || dist(x, z, g.player.x, g.player.z) < 170;
    const add = (x, z, color, letter) => near(x, z) && out.push({ x, z, color, letter, size: 6.5 });
    add(POI.gym.x, POI.gym.z, '#7be37b', 'G');
    add(POI.beachCamps.x, POI.beachCamps.z, '#7be37b', 'B');
    add(POI.beachClifton.x, POI.beachClifton.z, '#7be37b', 'B');
    add(47.6, -185, '#ff9f43', 'F');
    add(60, -400, '#ff9f43', 'F');
    add(640, 115, '#ff9f43', 'F');
    add(POI.cableLower.x, POI.cableLower.z, '#7be37b', 'C');
    if (g.state.flags.safehouse) add(POI.safehouse.x, POI.safehouse.z, '#ff6bd6', 'H');
    add(POI.hospital.x, POI.hospital.z, '#ffffff', '+');
    add(POI.policeStation.x, POI.policeStation.z, '#3b7bff', 'P');
    if (this.taxi && this.taxi.target) out.push({ x: this.taxi.target.x, z: this.taxi.target.z, color: '#ffd400', letter: this.taxi.stage === 'pickup' ? '!' : '★', edge: true, size: 8 });
  }

  cancelAll() {
    if (this.taxi) this.stopTaxi(null);
  }

  // ---------------------------------------------------------------- simple activities
  eat(what, price, heal) {
    const g = this.game;
    if (g.state.money < price) return g.hud.toast(`Not enough money. ${what} costs ${formatMoney(price)}.`, 'warn');
    g.addMoney(-price);
    g.player.health = Math.min(g.player.maxHealth, g.player.health + heal);
    g.audio.pickup();
    g.hud.toast(`You enjoyed ${what}. Lekker! (+${heal} health)`, 'good');
  }

  async beach(name) {
    const g = this.game, p = g.player, st = g.state.stats;
    if (g.missions.active) return g.hud.toast('No time to chill — you have a job to do!');
    p.locked = true;
    p.anim = { mode: 'sunbathe' };
    g.minigame = true;
    await new Promise((r) => setTimeout(r, 900));
    await g.hud.fade(true, 800);
    g.env.skip(2);
    p.health = p.maxHealth;
    p.stamina = 100;
    await new Promise((r) => setTimeout(r, 400));
    await g.hud.fade(false, 800);
    p.anim = null;
    p.locked = false;
    g.minigame = false;
    if (st.beachDay !== g.env.day) {
      st.beachDay = g.env.day;
      g.addRespect(1);
      g.hud.toast(`You chilled on ${name} beach for two hours. Fully rested. The locals respect a man who knows how to relax.`, 'good', 5000);
    } else g.hud.toast(`You chilled on ${name} beach for two hours. Fully rested.`, 'good');
  }

  /** Postcard shot from the edge of Table Mountain. */
  async enjoyView(seconds = 7) {
    const g = this.game, p = g.player;
    p.locked = true;
    g.cutscene = true;
    const vp = POI.viewpoint;
    g.cameraRig.setShot(new THREE.Vector3(vp.x, PLATEAU.y + 7, vp.z - 4), new THREE.Vector3(80, 10, -230), 1.2);
    g.hud.toast('The Mother City at your feet: the City Bowl, Lion\'s Head, Signal Hill and Table Bay beyond.', 'good', 6500);
    await new Promise((r) => setTimeout(r, seconds * 1000));
    g.cameraRig.clearShot();
    g.cutscene = false;
    p.locked = false;
    if (!g.state.flags.viewSeen) {
      g.state.flags.viewSeen = true;
      g.addRespect(2);
    }
  }

  async rest() {
    const g = this.game, p = g.player;
    if (g.missions.active) return g.hud.toast('Finish your job first.');
    g.minigame = true;
    p.locked = true;
    await g.hud.fade(true, 700);
    const h = g.env.hours;
    g.env.skip(h < 8 ? 8 - h : 24 - h + 8);
    p.health = p.maxHealth;
    g.police.clear();
    g.state.pos = { x: POI.safehouse.x, z: POI.safehouse.z + 2, h: 0 };
    const ok = g.save();
    await g.hud.fade(false, 700);
    p.locked = false;
    g.minigame = false;
    g.hud.banner('GAME SAVED', `Day ${g.env.day} — 08:00`, 'title-card', 2200);
    if (!ok) g.hud.toast('Could not write the save (storage blocked).', 'warn');
  }

  async gym() {
    const g = this.game, st = g.state.stats;
    if (g.missions.active) return g.hud.toast('Finish your job first.');
    if (st.gymDay !== g.env.day) {
      st.gymDay = g.env.day;
      st.gymSets = 0;
    }
    if (st.gymSets >= 4) return g.hud.toast("Your muscles are cooked for today. Come back tomorrow, champ.", 'warn');
    const ok = await this.liftGame({ reps: 8, time: 20, title: 'OUTDOOR GYM' });
    if (!ok) return g.hud.toast("Eish, couldn't finish the set. Try again!");
    st.gymSets++;
    g.state.totals.gymSets++;
    const gain = Math.max(1, Math.round(5 * (1 - st.muscle / 130)));
    st.muscle = Math.min(100, st.muscle + gain);
    st.stamina = Math.min(100, st.stamina + 2);
    g.hud.toast(`Set complete! Muscle +${gain}% · Stamina +2%`, 'good');
    if (st.gymSets <= 3) g.addRespect(1);
  }

  /** Tap fast to keep the bar rising; fill it to complete a rep. */
  liftGame({ reps = 8, time = 20, title = 'GYM', api = null }) {
    const g = this.game, p = g.player;
    const box = document.getElementById('minigame');
    box.innerHTML = `<div class="mg"><h2>${title}</h2><p>Tap (or mash <b>A</b>) as fast as you can to push the bar into the green zone!</p>
      <div class="meter"><div class="zone" style="left:80%;right:0"></div><i></i></div>
      <div class="reps">0 / ${reps}</div><div class="time" style="font-size:13px;color:#a9b4bf;margin-bottom:8px">${time.toFixed(1)}s</div>
      <button class="tap">TAP!</button><div class="row"><button class="quit">Give up</button></div></div>`;
    box.classList.remove('hidden');
    g.minigame = true;
    p.locked = true;
    p.anim = { mode: 'lift', liftP: 0 };
    p.heading = Math.PI / 2;
    const bar = box.querySelector('.meter i'), repEl = box.querySelector('.reps'), tEl = box.querySelector('.time');
    let power = 0, done = 0, left = time, finished = false;
    const strength = 0.115 + (g.state.stats.muscle / 100) * 0.05;
    return new Promise((resolve) => {
      const end = (ok) => {
        if (finished) return;
        finished = true;
        box.classList.add('hidden');
        box.innerHTML = '';
        g.minigame = false;
        p.locked = false;
        p.anim = null;
        window.removeEventListener('keydown', key);
        resolve(ok);
      };
      const tap = () => {
        if (finished) return;
        power += strength;
        g.audio.lift();
        if (power >= 1) {
          power = 0;
          done++;
          repEl.textContent = `${done} / ${reps}`;
          g.audio.pickup();
          if (done >= reps) setTimeout(() => end(true), 250);
        }
      };
      const key = (e) => {
        if (['Space', 'KeyE', 'Enter', 'KeyJ'].includes(e.code) && !e.repeat) {
          e.preventDefault();
          tap();
        }
        if (e.code === 'Escape') end(false);
      };
      window.addEventListener('keydown', key);
      box.querySelector('.tap').addEventListener('pointerdown', (e) => {
        e.preventDefault();
        tap();
      });
      box.querySelector('.quit').addEventListener('click', () => end(false));
      let last = performance.now(), padWas = true;
      const loop = (t) => {
        if (finished) return;
        const dt = Math.min(0.05, (t - last) / 1000);
        last = t;
        // gamepad: A / B / X / RT all count as a tap (edge-detected here; this loop runs outside the game frame)
        const ph = g.input.padHeld, padNow = !!(ph.confirm || ph.attack || ph.jump);
        if (padNow && !padWas) tap();
        padWas = padNow;
        if (!g.paused) {
          left -= dt;
          power = Math.max(0, power - dt * 0.55);
          bar.style.width = `${Math.round(power * 100)}%`;
          tEl.textContent = `${Math.max(0, left).toFixed(1)}s`;
          if (p.anim) p.anim.liftP = power;
          if (left <= 0) return end(false);
          if (api && api.ended) return end(false);
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
  }

  // ---------------------------------------------------------------- cableway
  rideCable(up, api = null) {
    const g = this.game, p = g.player;
    if (this.ride) return Promise.resolve();
    if (!api) {
      if (g.missions.active) {
        g.hud.toast('Finish your job first.');
        return Promise.resolve();
      }
      if (up && g.state.money < 80) {
        g.hud.toast('The cableway costs R80.', 'warn');
        return Promise.resolve();
      }
      if (up) g.addMoney(-80);
    }
    if (p.vehicle) p.exitVehicle(true);
    return new Promise((resolve) => {
      this.ride = { up, t: -1, dur: 12, resolve, stage: 'fadeout' };
      p.locked = true;
      g.cutscene = true;
      g.hud.fade(true, 450).then(() => {
        if (!this.ride) return;
        p.rig.group.visible = false;
        this.ride.stage = 'ride';
        this.ride.t = 0;
        g.landmarks.cabinOverride = up ? 0 : 1;
        g.hud.fade(false, 450);
        g.hud.toast(up ? 'Riding up 1 067 m… well, almost. Enjoy the view!' : 'Heading back down to the city.', '', 4000);
      });
    });
  }

  updateRide(dt) {
    const r = this.ride, g = this.game, p = g.player;
    if (!r || r.stage !== 'ride') return;
    r.t += dt;
    const u = smoothstep(0, 1, Math.min(1, r.t / r.dur));
    const k = r.up ? u : 1 - u;
    g.landmarks.cabinOverride = k;
    const cab = g.landmarks.cabin.position;
    // camera: off to the west of the cable, looking at the cabin with mountain/city behind
    const pos = new THREE.Vector3(cab.x - 34, cab.y + 6 + (r.up ? 4 : 2), cab.z - 26);
    g.cameraRig.setShot(pos, cab.clone(), 3);
    p.x = cab.x;
    p.z = cab.z;
    if (r.t >= r.dur && r.stage === 'ride') {
      r.stage = 'arrive';
      g.hud.fade(true, 450).then(() => {
        const top = POI.cableTop, low = POI.cableLower;
        if (r.up) p.place(top.x, top.z, Math.PI, true);
        else {
          p.onPlateau = false;
          p.place(low.x + 1, low.z - 8, Math.PI, false);
        }
        p.rig.group.visible = true;
        g.cameraRig.clearShot();
        g.cameraRig.first = true;
        g.cameraRig.yaw = r.up ? Math.PI : Math.PI;
        g.landmarks.cabinOverride = null;
        g.cutscene = false;
        p.locked = false;
        this.ride = null;
        g.hud.fade(false, 450);
        if (r.up) g.hud.toast('Welcome to the top of <b>Table Mountain</b>. Walk around — the view of the Mother City is something else.', 'good', 6000);
        r.resolve();
      });
    }
  }

  // ---------------------------------------------------------------- taxi job
  toggleTaxi() {
    if (this.taxi) this.stopTaxi('Taxi job ended.');
    else this.startTaxi();
  }

  startTaxi() {
    const g = this.game, v = g.player.vehicle;
    if (!v || v.type !== 'minibus') return g.hud.toast('You need a minibus taxi for taxi jobs.');
    if (g.missions.active) return g.hud.toast('Finish your mission first.');
    this.taxi = { v, stage: 'pickup', fares: 0, pax: null, target: null, timeLeft: null, earned: 0 };
    g.hud.toast('🚐 Taxi job started! Pick up passengers (yellow ! on the map) and drop them off quickly.', 'good', 5000);
    this.nextFare();
  }

  stopTaxi(reason) {
    const g = this.game, t = this.taxi;
    if (!t) return;
    if (t.marker) t.marker.remove();
    if (t.pax && g.peds.list.includes(t.pax)) g.peds.remove(t.pax);
    this.taxi = null;
    g.hud.objective(null);
    g.hud.timer(null);
    if (reason) g.hud.toast(`${reason} Fares: ${t.fares} · Earned ${formatMoney(t.earned)}`);
  }

  nextFare() {
    const g = this.game, t = this.taxi, p = g.player;
    if (t.marker) t.marker.remove();
    let spot = null;
    for (let i = 0; i < 12 && !spot; i++) {
      const e = g.roads.randomEdgeNear(p.x, p.z, 60, 220, { traffic: true });
      if (!e || e.len < 20) continue;
      const from = chance(0.5) ? e.a : e.b;
      const s = rand(8, e.len - 8);
      const side = chance(0.5) ? 1 : -1;
      const w = g.roads.sidewalkPoint(e, from, s, side);
      if (!g.grid.isWalkable(w.x, w.z)) continue;
      const lane = g.roads.lanePoint(e, from, s, (e.width / 4) * side);
      spot = { w, lane };
    }
    if (!spot) return this.stopTaxi('No passengers around here.');
    t.stage = 'pickup';
    t.pax = g.peds.spawn(spot.w.x, spot.w.z, { kind: 'npc', look: randomLook(), ai: 'idle', anim: 'wave', mission: true, invulnerable: true });
    t.target = { x: spot.lane.x, z: spot.lane.z };
    t.marker = g.effects.marker(t.target.x, t.target.z, { color: '#ffd400', radius: 3.2, height: 4 });
    t.timeLeft = null;
    g.hud.timer(null);
    g.hud.objective('🚐 Pick up the <em>passenger</em> — stop next to them.');
  }

  updateTaxi(dt) {
    const t = this.taxi, g = this.game, p = g.player;
    if (!t) return;
    if (p.vehicle !== t.v || t.v.state !== 'ok') return this.stopTaxi('Taxi job ended.');
    if (t.timeLeft !== null) {
      t.timeLeft -= dt;
      g.hud.timer(t.timeLeft);
      if (t.timeLeft <= 0) {
        g.hud.toast('Too slow! The passenger got out in a huff.', 'warn');
        g.hud.timer(null);
        return this.nextFare();
      }
    }
    const d = dist(p.x, p.z, t.target.x, t.target.z);
    if (t.stage === 'pickup') {
      if (d < 7 && t.v.speed < 3) {
        if (t.pax && g.peds.list.includes(t.pax)) g.peds.remove(t.pax);
        t.pax = null;
        g.audio.door();
        // destination
        const far = PLACES.filter((pl) => dist(pl.x, pl.z, p.x, p.z) > 180);
        const dest = pick(far.length ? far : PLACES);
        const ne = g.roads.nearestEdge(dest.x, dest.z, { traffic: true });
        t.target = { x: ne.x, z: ne.z, name: dest.n };
        t.stage = 'drop';
        t.marker.remove();
        t.marker = g.effects.marker(t.target.x, t.target.z, { color: '#ffd400', radius: 3.5, height: 4 });
        const dd = dist(p.x, p.z, t.target.x, t.target.z);
        t.timeLeft = Math.round(dd / 10 + 25);
        t.startDist = dd;
        g.hud.objective(`🚐 Take the passenger to <em>${dest.n}</em>.`);
        g.hud.say('Passenger', pick(['Molo! ' + dest.n + ', please. Quickly!', 'Howzit driver. ' + dest.n + ', and no funny business!', 'Sharp, ' + dest.n + ' please. I\'m late!', 'Eish, ' + dest.n + '. My boss will kill me!']), { auto: 2.8, bark: true });
      }
    } else if (d < 9 && t.v.speed < 3.5) {
      const pay = Math.round(25 + t.startDist * 0.12 + Math.max(0, t.timeLeft) * 1.5);
      t.fares++;
      t.earned += pay;
      g.state.totals.fares++;
      g.addMoney(pay);
      if (t.fares % 2 === 0) g.addRespect(1);
      g.hud.toast(`Fare complete! Tip included. (${t.fares} fares)`, 'good', 2500);
      this.nextFare();
    }
  }

  // ---------------------------------------------------------------- per-frame
  update(dt) {
    const g = this.game, p = g.player;
    this.updateRide(dt);
    this.updateTaxi(dt);
    // proteas
    for (const [i, m] of this.proteaMeshes) {
      m.rotation.y += dt * 1.2;
      const s = this.proteaSpots[i];
      if (!!s.plateau !== !!p.onPlateau) continue;
      if (p.state === 'foot' && dist(p.x, p.z, s.x, s.z) < 1.8) {
        g.scene.remove(m);
        this.proteaMeshes.delete(i);
        g.state.proteas.push(i);
        g.audio.pickup();
        g.effects.sparks(s.x, (s.plateau ? PLATEAU.y : 0) + 1, s.z, 16, [1, 0.5, 0.8]);
        const n = g.state.proteas.length, total = PROTEAS.length;
        g.addMoney(100, true);
        g.addRespect(2, true);
        g.hud.toast(`🌸 Protea found! <b>${n}/${total}</b> · +R100 · Respect +2`, 'good', 4000);
        if (n === total) {
          g.addMoney(5000);
          g.addRespect(20);
          g.hud.banner('PROTEA HUNTER', 'All 15 proteas found! +R5 000', 'passed', 4000);
        }
        g.save();
      }
    }
    // the Noon Gun fires at 12:00 every day
    const h = g.env.hours;
    if (this.lastHour < 12 && h >= 12 && h < 12.5) {
      const gun = POI.noonGun;
      const d = dist(p.x, p.z, gun.x, gun.z);
      g.effects.smoke(gun.x, 1.5, gun.z - 2, 14, 0.85);
      if (d < 200) g.cameraRig.shake(clamp(0.6 - d / 400, 0.05, 0.6));
      g.audio.noonGun(clamp(1 - d / 900, 0.25, 1));
      g.hud.toast('💥 BOOM! The <b>Noon Gun</b> on Signal Hill — it\'s 12:00. Cape Town checks its watches.', '', 5000);
    }
    this.lastHour = h;
  }
}
