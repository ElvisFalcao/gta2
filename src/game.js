// The Game: owns the renderer, world, systems and the main loop.

import * as THREE from 'three';
import { Grid } from './world/grid.js';
import { RoadGraph, Signals } from './world/roads.js';
import { ROADS, POI, PLATEAU } from './world/mapData.js';
import { buildCity } from './world/cityGen.js';
import { CityMeshes } from './world/cityMeshes.js';
import { Landmarks } from './world/landmarks.js';
import { Environment } from './world/environment.js';
import { Input } from './core/input.js';
import { CameraRig } from './core/cameraRig.js';
import { nextFrame, dist, clamp, formatMoney } from './core/util.js';
import { Player } from './entities/player.js';
import { PedSystem } from './entities/peds.js';
import { WheelPool } from './entities/vehicleModel.js';
import { VehicleSystem } from './systems/vehicles.js';
import { PoliceSystem } from './systems/police.js';
import { Population } from './systems/population.js';
import { Effects } from './systems/effects.js';
import { Audio } from './systems/audio.js';
import { Interactions } from './systems/interactions.js';
import { loadSave, writeSave, clearSave, loadSettings, writeSettings, freshState } from './systems/save.js';
import { WeaponSystem } from './systems/weapons.js';
import { BoxingClub } from './missions/boxing.js';
import { HUD } from './ui/hud.js';
import { VoiceSystem } from './systems/voice.js';
import { Menu } from './ui/menu.js';
import { MissionSystem } from './missions/missionSystem.js';
import { Activities } from './missions/activities.js';

export const QUALITY = {
  low: { name: 'low', pixelRatio: 1, antialias: false, shadows: false, shadowSize: 1024, fogFar: 760, peds: 12, traffic: 8 },
  medium: { name: 'medium', pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5), antialias: false, shadows: false, shadowSize: 1024, fogFar: 1050, peds: 18, traffic: 11 },
  high: { name: 'high', pixelRatio: Math.min(window.devicePixelRatio || 1, 2), antialias: true, shadows: true, shadowSize: 2048, fogFar: 1400, peds: 26, traffic: 15 },
};

class Emitter {
  constructor() {
    this.h = {};
  }
  on(n, f) {
    (this.h[n] ||= []).push(f);
    return () => (this.h[n] = this.h[n].filter((x) => x !== f));
  }
  emit(n, ...a) {
    for (const f of this.h[n] || []) f(...a);
  }
}

class GPS {
  constructor(game) {
    this.game = game;
    this.route = null;
    this.t = 0;
    this.key = '';
  }
  update(dt) {
    const g = this.game, p = g.player;
    if (g.waypoint && dist(p.x, p.z, g.waypoint.x, g.waypoint.z) < 14) {
      g.waypoint = null;
      g.hud.toast('Waypoint reached');
    }
    const tgt = g.missions.gpsTarget() || g.waypoint;
    if (!tgt || p.onPlateau || tgt.plateau) {
      this.route = null;
      return;
    }
    const key = `${Math.round(tgt.x)}_${Math.round(tgt.z)}`;
    this.t -= dt;
    if (this.t > 0 && key === this.key) {
      if (this.route) this.route[0] = { x: p.x, z: p.z };
      return;
    }
    this.t = 1.0;
    this.key = key;
    if (dist(p.x, p.z, tgt.x, tgt.z) < 45) {
      this.route = [{ x: p.x, z: p.z }, { x: tgt.x, z: tgt.z }];
      return;
    }
    const a = g.roads.nearestNode(p.x, p.z), b = g.roads.nearestNode(tgt.x, tgt.z);
    const path = g.roads.path(a.id, b.id);
    if (!path) {
      this.route = [{ x: p.x, z: p.z }, { x: tgt.x, z: tgt.z }];
      return;
    }
    this.route = [{ x: p.x, z: p.z }, ...path.map((id) => ({ x: g.roads.nodes[id].x, z: g.roads.nodes[id].z })), { x: tgt.x, z: tgt.z }];
  }
}

export class Game {
  constructor() {
    const s = loadSettings();
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.settings = { quality: touch ? 'medium' : 'high', sfx: 0.8, music: 0.6, sens: 1, touch: 'auto', voices: 'on', aimAssist: 'strong', ...s };
    const qp = new URLSearchParams(location.search).get('quality');
    if (qp) this.settings.quality = qp;
    if (!QUALITY[this.settings.quality]) this.settings.quality = 'medium';
    this.quality = QUALITY[this.settings.quality];
    this.time = 0;
    this.paused = false;
    this.started = false;
    this.dialogueOpen = false;
    this.minigame = null;
    this.cutscene = false;
    this.cheats = { god: false, noPolice: false, tank: false };
    this.events = new Emitter();
    this.waypoint = null;
    this.state = freshState();
    this.saveT = 30;
    this.fps = 60;
    this.frustum = new THREE.Frustum();
    this._m4 = new THREE.Matrix4();
    this._v3 = new THREE.Vector3();
    this.titleT = 0;
  }

  async init(progress) {
    const step = async (msg, f) => {
      progress(msg, f);
      await nextFrame();
      await nextFrame();
    };
    await step('Waking up the Mother City…', 0.05);
    const q = this.quality;
    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: q.antialias, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(q.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('viewport').appendChild(renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.3, 2600);

    await step('Surveying the coastline…', 0.12);
    this.grid = new Grid();
    this.roads = new RoadGraph(ROADS);
    await step('Laying out streets and robots…', 0.25);
    this.city = buildCity(this.grid, this.roads);
    await step('Painting the Bo-Kaap…', 0.42);
    this.meshes = new CityMeshes(this.scene, this.grid, this.roads, this.city, q);
    this.meshes.buildAll();
    await step('Raising Table Mountain…', 0.66);
    this.landmarks = new Landmarks(this.meshes.root, this.grid, this.city);
    this.landmarks.build();
    const ct = POI.cableTop;
    this.world = { cableTopRect: [ct.x - 7.5, ct.z + 5.2, ct.x + 7.5, ct.z + 14.8] };
    this.env = new Environment(this.scene, q);
    this.signals = new Signals();
    this.effects = new Effects(this.scene);
    this.wheels = new WheelPool(this.scene, 240);

    await step('Calling the locals…', 0.82);
    this.input = new Input(document.getElementById('app'));
    this.input.attachSurface(renderer.domElement, document.getElementById('joy-zone'), document.getElementById('joy-base'), document.getElementById('joy-knob'));
    this.input.bindButtons(document.getElementById('btns'));
    this.input.onTouchDetected = () => this.applySettings();
    this.input.onGamepadChange = (on) => {
      if (this.hud) this.hud.show(this.started && !this.hud.root.classList.contains('hidden'));
      if (on && !this._padToast && this.hud) {
        this._padToast = true;
        this.hud.toast('🎮 Controller connected', '', 2200);
      }
    };
    this.cameraRig = new CameraRig(this.camera, this.grid);
    this.player = new Player(this);
    this.player.rig.group.visible = false;
    this.peds = new PedSystem(this);
    this.vehicles = new VehicleSystem(this);
    this.police = new PoliceSystem(this);
    this.population = new Population(this);
    this.audio = new Audio(this);
    this.hud = new HUD(this);
    this.voice = new VoiceSystem(this);
    this.menu = new Menu(this);
    this.gps = new GPS(this);
    this.interactions = new Interactions(this);
    this.activities = new Activities(this);
    this.weapons = new WeaponSystem(this);
    this.boxing = new BoxingClub(this);
    this.missions = new MissionSystem(this);
    this.applySettings();

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.started && !this.paused) this.menu.open();
    });
    // warm up shaders with one render
    this.titleCamera(0);
    renderer.render(this.scene, this.camera);
    await step('Ready. Lekker!', 1);
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.hud.resizeMinimap();
  }

  applySettings() {
    const s = this.settings;
    if (this.audio) this.audio.setVolumes(s.sfx, s.music);
    if (this.input) {
      this.input.sensitivity = s.sens;
      if (s.touch === 'on') this.input.touchMode = true;
      if (s.touch === 'off') this.input.touchMode = false;
    }
    if (this.hud && this.started) this.hud.show(true);
  }

  saveSettings() {
    writeSettings(this.settings);
  }

  // ------------------------------------------------------------------ game flow
  hasSave() {
    return !!loadSave();
  }

  newGame() {
    clearSave();
    this.state = freshState();
    this.env.hours = 7;
    this.env.day = 1;
    this.player.place(POI.spawn.x, POI.spawn.z, POI.spawn.h);
    this.player.health = 100;
    this.begin();
    this.missions.startIntro();
  }

  continueGame() {
    const s = loadSave();
    if (!s) return this.newGame();
    const f = freshState();
    this.state = { ...f, ...s, stats: { ...f.stats, ...s.stats }, totals: { ...f.totals, ...s.totals }, weapons: { ...f.weapons, ...s.weapons } };
    this.env.hours = s.time?.hours ?? 9;
    this.env.day = s.time?.day ?? 1;
    const pos = s.pos;
    if (pos && !pos.plateau) this.player.place(pos.x, pos.z, pos.h || 0);
    else if (this.state.flags.safehouse) this.player.place(POI.safehouse.x, POI.safehouse.z + 2, 0);
    else this.player.place(POI.spawn.x, POI.spawn.z, POI.spawn.h);
    this.begin();
    this.hud.toast(`Welcome back, Sizwe. Day ${this.env.day}.`, 'good');
  }

  begin() {
    this.started = true;
    this.player.rig.group.visible = true;
    this.player.revive();
    this.cameraRig.first = true;
    this.cameraRig.yaw = this.player.heading;
    this.hud.show(true);
    document.getElementById('title').classList.add('hidden');
    document.getElementById('rotate-hint').classList.add('ingame');
    this.audio.init();
    this.missions.refreshGivers();
    this.activities.refresh();
    this.hud.updateWeapon();
  }

  save() {
    const p = this.player;
    const s = this.state;
    s.time = { hours: this.env.hours, day: this.env.day };
    if (!this.missions.active && p.state !== 'dead') {
      s.pos = { x: p.x, z: p.z, h: p.heading, plateau: p.onPlateau };
    }
    return writeSave(s);
  }

  /** Save and go back to the title screen. A mission in progress is dropped (missions only save when passed). */
  quitToTitle() {
    this.save();
    location.reload(); // the title screen comes back with Continue
  }

  resetSave() {
    clearSave();
    location.reload();
  }

  setPaused(on) {
    this.paused = on;
    if (on && this.voice) this.voice.stop();
    if (this.audio.ctx) {
      if (on) {
        this.audio.engGain.gain.value = 0;
        this.audio.music.gain.value = 0;
      }
    }
    if (!on) this.last = performance.now();
  }

  // ------------------------------------------------------------------ economy
  addMoney(n, silent = false) {
    this.state.money = Math.max(0, this.state.money + n);
    if (!silent && n !== 0) {
      this.hud.toast(`${n > 0 ? '+' : '-'}${formatMoney(Math.abs(n)).replace('R ', 'R')}`, 'cash', 2600);
      if (n > 0) this.audio.cash();
    }
  }
  addRespect(n, silent = false) {
    if (!n) return;
    const before = this.state.respect;
    this.state.respect = Math.max(0, Math.min(999, this.state.respect + n));
    if (!silent) this.hud.toast(`Respect ${n > 0 ? '+' : ''}${n}`, 'resp', 2600);
    this.missions.onRespectChanged(before, this.state.respect);
  }
  addClue(id, title, text) {
    if (this.state.clues.some((c) => c.id === id)) return;
    this.state.clues.push({ id, title, text });
    this.hud.toast(`Notebook updated: <b>${title}</b>`, 'good', 5000);
  }
  hasClue(id) {
    return this.state.clues.some((c) => c.id === id);
  }

  // ------------------------------------------------------------------ events
  onEnterVehicle(v) {
    this.audio.init();
    if (this.audio.radioOn) this.hud.toast(`📻 Mother City FM — amapiano all day (${this.input.usingGamepad ? 'D-pad ←' : 'R / RADIO'} to switch off)`, '', 3000);
  }
  onExitVehicle(v) {
    if (this.activities.taxiActive) this.activities.stopTaxi('You left the taxi.');
  }

  onExplosion(x, z, r, source) {
    this.cameraRig.shake(clamp(1.2 - dist(x, z, this.player.x, this.player.z) / 40, 0, 1.2));
    for (const p of this.peds.near(x, z, r)) {
      const d = Math.max(0.5, dist(x, z, p.x, p.z));
      p.takeHit(60 * (1 - d / r) + 10, (p.x - x) / d, (p.z - z) / d, source && source.lastPlayerHit > this.time - 5 ? this.player : null, 'explosion');
    }
    const pl = this.player;
    const dp = dist(x, z, pl.x, pl.z);
    if (pl.vehicle === source) pl.die('explosion');
    else if (dp < r && pl.state !== 'vehicle') pl.takeHit(70 * (1 - dp / r), (pl.x - x) / Math.max(dp, 0.5), (pl.z - z) / Math.max(dp, 0.5), null, 'explosion');
    for (const v of this.vehicles.list) {
      if (v === source) continue;
      const d = v.distTo(x, z);
      if (d < r) {
        v.damage(80 * (1 - d / r));
        const k = 8 * (1 - d / r);
        v.vx += ((v.x - x) / Math.max(1, d)) * k;
        v.vz += ((v.z - z) / Math.max(1, d)) * k;
      }
    }
    if (source && source.type === 'police' && source.lastPlayerHit > this.time - 6) this.police.crime('destroyCop', 1);
  }

  async onPlayerWasted(cause) {
    if (this.respawning) return;
    this.respawning = true;
    this.state.totals.wasted++;
    this.audio.wasted();
    this.vibrate([100, 50, 200]);
    this.missions.failActive('You were wasted.', true);
    this.activities.cancelAll();
    this.hud.banner('WASTED', '', 'wasted', 3200);
    await new Promise((r) => setTimeout(r, 2600));
    await this.hud.fade(true, 700);
    this.police.clear();
    const fee = Math.min(this.state.money, 100);
    this.state.money -= fee;
    this.peds.clearNonMission();
    this.player.onPlateau = false;
    this.player.place(POI.hospital.x, POI.hospital.z, Math.PI);
    this.player.revive();
    this.cameraRig.first = true;
    this.cameraRig.yaw = 0;
    this.env.skip(1);
    this.respawning = false;
    await this.hud.fade(false, 700);
    this.hud.toast(`City Hospital patched you up. Medical bill: ${formatMoney(fee)}`, 'warn', 5000);
  }

  async onBusted() {
    if (this.respawning) return;
    this.respawning = true;
    this.state.totals.busted++;
    this.audio.failed();
    this.missions.failActive('You got busted.', true);
    this.activities.cancelAll();
    const p = this.player;
    if (p.vehicle) p.exitVehicle(true);
    p.locked = true;
    p.anim = { mode: 'handsup' };
    this.hud.banner('BUSTED', '', 'busted', 3200);
    await new Promise((r) => setTimeout(r, 2600));
    await this.hud.fade(true, 700);
    const fine = Math.min(this.state.money, 100 * Math.max(1, this.police.stars));
    this.state.money -= fine;
    this.weapons.confiscate();
    this.police.clear();
    this.peds.clearNonMission();
    p.anim = null;
    p.locked = false;
    p.onPlateau = false;
    p.place(POI.policeStation.x, POI.policeStation.z + 2, Math.PI);
    p.revive();
    this.cameraRig.first = true;
    this.cameraRig.yaw = Math.PI;
    this.env.skip(2);
    this.respawning = false;
    await this.hud.fade(false, 700);
    this.hud.toast(`Released with a warning and a fine of ${formatMoney(fine)}.`, 'warn', 5000);
  }

  // ------------------------------------------------------------------ helpers
  vibrate(p) {
    if (this.input && this.input.usingGamepad) {
      const ms = Array.isArray(p) ? p.reduce((a, b) => a + b, 0) : p;
      this.input.rumble(Math.min(600, ms), 0.8, 0.5);
      return;
    }
    if (this.input && this.input.touchMode && navigator.vibrate) {
      try {
        navigator.vibrate(p);
      } catch {
        /* ignore */
      }
    }
  }

  isVisible(x, z, maxDist = 80) {
    const c = this.camera.position;
    if (dist(c.x, c.z, x, z) > maxDist) return false;
    return this.frustum.containsPoint(this._v3.set(x, 1.5, z));
  }

  collectBlips(full = false) {
    const out = [];
    this.missions.blips(out, full);
    this.activities.blips(out, full);
    for (const c of this.police.cops) if (c.state !== 'dead') out.push({ x: c.x, z: c.z, color: '#3b7bff', shape: 'dot', size: 6 });
    for (const v of this.police.cars) out.push({ x: v.x, z: v.z, color: Math.floor(this.time * 4) % 2 ? '#ff3b3b' : '#3b7bff', shape: 'square', size: 5 });
    if (this.waypoint) out.push({ x: this.waypoint.x, z: this.waypoint.z, color: '#c85aff', letter: 'W', edge: true, size: 8 });
    return out;
  }

  cheat(code) {
    const p = this.player;
    const spawnNear = (type) => {
      const f = { x: Math.sin(p.heading), z: Math.cos(p.heading) };
      const o = this.grid.findOpen(p.x + f.x * 6, p.z + f.z * 6, 14, (x, z) => this.grid.isDrivable(x, z) && !this.grid.circleBlocked(x, z, 3, true));
      if (!o || p.onPlateau) return 'No space here.';
      this.vehicles.spawn(type, o.x, o.z, p.heading, { persistent: true });
      return `${type} delivered. Sharp sharp!`;
    };
    switch (code) {
      case 'LEKKER': this.addRespect(50); return 'Respect +50. Lekker!';
      case 'MOOLAH': this.addMoney(5000); return 'R5 000 in your pocket.';
      case 'EISH': this.police.clear(); return 'Wanted level cleared.';
      case 'BAKKIE': return spawnNear('bakkie');
      case 'TAXI': return spawnNear('minibus');
      case 'VROOM': return spawnNear('sports');
      case 'SUPERSIZWE': this.cheats.god = !this.cheats.god; this.cheats.tank = this.cheats.god; return `God mode ${this.cheats.god ? 'ON' : 'OFF'}.`;
      case 'NOPOLICE': this.cheats.noPolice = !this.cheats.noPolice; if (this.cheats.noPolice) this.police.clear(); return `Police ${this.cheats.noPolice ? 'ignore you' : 'are back on duty'}.`;
      case 'DAY': this.env.hours = 11; return 'Good morning, Cape Town.';
      case 'NIGHT': this.env.hours = 21; return 'The city lights up.';
      case 'GYMRAT': Object.assign(this.state.stats, { muscle: 100, stamina: 100, fat: 0 }); return 'Max muscle & stamina, zero fat. Jislaaik!';
      case 'GATSBY': this.state.stats.fat = 100; return 'One gatsby too many… Sizwe is very heavy.';
      case 'ARMED': this.weapons.giveAll(); return 'Tools and guns, fully loaded. Careful now.';
      case 'BOXER': this.state.boxing = 3; return 'Coach Mzi taught you everything: hook, uppercut and body shots.';
      case 'SKIPMISSION': return this.missions.debugPass() ? 'Mission passed.' : 'No mission active.';
      default: return 'Nothing happens. Eish.';
    }
  }

  /** Test hook: advance the simulation without rendering (lets promises settle between steps). */
  async simulate(sec, dt = 1 / 30) {
    const n = Math.ceil(sec / dt);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      this.input.pollGamepad(dt);
      if (!this.paused) this.update(dt);
      await null;
      if (i % 30 === 29) await new Promise((r) => setTimeout(r, 0));
    }
    return (performance.now() - t0) / n;
  }

  // ------------------------------------------------------------------ loop
  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt));
    const dt = Math.min(0.05, Math.max(0, (t - this.last) / 1000));
    this.last = t;
    this.fps = this.fps * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05;
    this.input.pollGamepad(dt);
    if (!this.started) {
      this.titleUpdate(dt);
      this.input.endFrame();
    } else if (this.testFreeze) this.input.endFrame(); // tests step the game with simulate() and only render here
    else if (!this.paused) this.update(dt);
    else {
      this.menu.handleInput(this.input, dt);
      this.input.endFrame();
      return; // keep the last frame frozen
    }
    this.renderer.render(this.scene, this.camera);
  }

  titleCamera(dt) {
    this.titleT += dt;
    const a = this.titleT * 0.04 + 2.2;
    const cx = -60, cz = -80;
    this.camera.position.set(cx + Math.cos(a) * 520, 190 + Math.sin(this.titleT * 0.1) * 20, cz + Math.sin(a) * 520);
    this.camera.lookAt(-40, 40, 150);
  }

  titleUpdate(dt) {
    this.titleCamera(dt);
    if (this.input.pressed('confirm') && window.__ready) {
      const b = [...document.querySelectorAll('#title-btns button')].find((x) => !x.classList.contains('hidden') && x.offsetParent);
      if (b) b.click();
    }
    this.time += dt;
    this.env.hours = 17.6 + Math.sin(this.titleT * 0.02) * 0.3;
    this.env.apply(this._v3.set(0, 0, 0), this.camera);
    this.camera.updateMatrixWorld();
    this.meshes.update(dt, this.time, this.env, this.signals);
    this.landmarks.update(this.time, this.env, dt);
    this.effects.update(dt);
  }

  update(dt) {
    const p = this.player, input = this.input;
    this.time += dt;
    this.hud.handlePad(input);
    if (this.dialogueOpen) this.hud.handleAdvanceKey(input);
    if (input.pressed('pause')) {
      input.consume('pause');
      this.menu.open();
    }
    if (input.pressed('map')) {
      input.consume('map');
      this.menu.openMap();
    }
    if (input.pressed('enter') && !this.dialogueOpen && !p.locked && !this.minigame && !this.cutscene) {
      if (p.state === 'vehicle') p.exitVehicle();
      else {
        const v = p.canEnter();
        if (v) p.enterVehicle(v);
      }
    }
    if (input.pressed('radio') && p.state === 'vehicle') {
      const on = this.audio.toggleRadio();
      this.hud.toast(on ? '📻 Mother City FM' : '📻 Radio off', '', 1800);
    }
    if (input.pressed('taxi') && p.vehicle && p.vehicle.type === 'minibus') this.activities.toggleTaxi();

    if (!this.cutscene) this.env.advance(dt);
    this.signals.update(dt);
    // hit-stop: fighters (player and people) nearly freeze for a moment when a punch lands
    let fdt = dt;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      fdt = dt * 0.04;
    }
    this.weapons.update(dt);
    p.update(fdt, input);
    this.vehicles.update(dt);
    this.peds.update(fdt);
    this.police.update(dt);
    this.population.update(dt);
    this.missions.update(dt);
    this.activities.update(dt);
    this.boxing.update();
    this.interactions.update();
    this.gps.update(dt);
    this.effects.update(dt);

    // camera
    let yawIn = input.yawDelta;
    if (input.keyHeld('camLeft')) yawIn += dt * 2;
    if (input.keyHeld('camRight')) yawIn -= dt * 2;
    if (input.pressed('camReset')) this.cameraRig.snapBehind(p.vehicle ? p.vehicle.heading : p.heading);
    const v = p.vehicle;
    this.cameraRig.update(dt, {
      x: p.x, y: p.y, z: p.z, heading: v ? v.heading : p.heading, speed: v ? v.fwdSpeed : p.speedNow,
      inVehicle: !!v, vehicleLen: v ? v.spec.len : 0, yawInput: this.cutscene ? 0 : yawIn, pitchInput: this.cutscene ? 0 : input.pitchDelta,
      moving: p.speedNow > 1, onPlateau: p.onPlateau, groundY: p.onPlateau ? PLATEAU.y : 0, wide: this.missions.wideCam, block: this.world.cableTopRect,
    });
    this.camera.updateMatrixWorld();
    this._m4.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this._m4);
    this.env.apply(this._v3.set(p.x, p.y, p.z), this.camera);
    this.meshes.update(dt, this.time, this.env, this.signals);
    this.landmarks.update(this.time, this.env, dt);
    this.hud.update(dt);
    this.audio.update(dt);
    this.voice.update(dt);

    this.saveT -= dt;
    if (this.saveT <= 0) {
      this.saveT = 45;
      if (!this.missions.active && p.state === 'foot') this.save();
    }
    input.endFrame();
  }
}
