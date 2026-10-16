// Mission engine. Missions are async scripts that await objectives provided by MissionAPI.
// Failing (death, arrest, timers, custom checks) rejects every pending objective.

import * as THREE from 'three';
import { STORY } from './story.js';
import { SideQuests } from './sideQuests.js';
import { dist, clamp, headingTo, formatMoney, rand } from '../core/util.js';
import { LOOKS } from '../entities/humanModel.js';
import { POI } from '../world/mapData.js';

export class MissionFail extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class MissionAPI {
  constructor(sys, def) {
    this.sys = sys;
    this.g = sys.game;
    this.def = def;
    this.waiters = new Set();
    this.failChecks = [];
    this.spawned = { peds: [], vehicles: [], markers: [], interactions: [], meshes: [] };
    this.targets = [];
    this.timeLeft = null;
    this.timerReason = '';
    this.ended = false;
    this.gps = null;
    this.data = {};
    this.counterText = null;
  }

  // ---------------------------------------------------------------- core
  guard() {
    if (this.ended) throw new MissionFail('ended');
  }

  tick(dt) {
    if (this.ended) return;
    if (this.timeLeft !== null) {
      const before = Math.ceil(this.timeLeft);
      this.timeLeft -= dt;
      if (Math.ceil(this.timeLeft) !== before && this.timeLeft < 10 && this.timeLeft > 0) this.g.audio.beep();
      this.g.hud.timer(this.timeLeft);
      if (this.timeLeft <= 0) {
        this.timeLeft = null;
        this.g.hud.timer(null);
        if (this.onTimerExpire) {
          const f = this.onTimerExpire;
          this.onTimerExpire = null;
          f();
        } else {
          this.fail(this.timerReason || 'You ran out of time.');
          return;
        }
      }
    }
    for (const c of this.failChecks) {
      if (c.fn()) {
        this.fail(c.reason);
        return;
      }
    }
    for (const w of [...this.waiters]) {
      if (this.ended) return;
      w.tick(dt);
    }
    for (const a of this.spawned.markers) if (a.followEntity) {
      const e = a.followEntity;
      if (e.state === 'dead' || e.disposed || e.removeMe) a.mesh.visible = false;
      else {
        a.mesh.visible = true;
        a.follow(e.x, (e.y || 0) + (e.halfL ? 3.2 : 2.6), e.z);
      }
    }
  }

  until(fn) {
    this.guard();
    return new Promise((resolve, reject) => {
      const w = {
        tick: (dt) => {
          let v;
          try {
            v = fn(dt);
          } catch (e) {
            this.waiters.delete(w);
            reject(e);
            return;
          }
          if (v) {
            this.waiters.delete(w);
            resolve(v);
          }
        },
        reject,
      };
      this.waiters.add(w);
    });
  }

  wait(sec) {
    let t = 0;
    return this.until((dt) => (t += dt) >= sec);
  }

  fail(reason) {
    if (this.ended) return;
    this.ended = true;
    const err = new MissionFail(reason);
    for (const w of this.waiters) w.reject(err);
    this.waiters.clear();
    this.sys.onFailed(this, reason);
  }

  failIf(fn, reason) {
    const c = { fn, reason };
    this.failChecks.push(c);
    return () => (this.failChecks = this.failChecks.filter((x) => x !== c));
  }

  protect(ped, name) {
    return this.failIf(() => ped.state === 'dead', `${name} was knocked out.`);
  }

  // ---------------------------------------------------------------- talking
  lock(on) {
    const p = this.g.player;
    p.locked = on;
    if (on) {
      p.attack = null;
      p.vx = p.vz = 0;
    }
  }

  async talk(lines, opts = {}) {
    this.guard();
    const g = this.g;
    this.lock(true);
    if (opts.focus) this.frame(opts.focus);
    for (const line of lines) {
      this.guard();
      const [who, text] = line;
      const spk = opts.speakers && opts.speakers[who];
      if (spk && spk.rig && spk.state === 'ok') {
        spk.anim = 'talk';
        spk.face(g.player.x, g.player.z, 1);
      }
      await g.hud.say(who === 'SIZWE' ? 'Sizwe' : who, text, { color: SPEAKER_COLORS[who] });
      if (spk && spk.rig) spk.anim = spk.baseAnim || null;
    }
    this.guard();
    if (opts.focus) g.cameraRig.clearShot();
    if (!opts.keepLocked) this.lock(false);
  }

  say(who, text) {
    return this.talk([[who, text]]);
  }

  /** Camera two-shot between the player and an entity. */
  frame(e) {
    const p = this.g.player;
    const mx = (p.x + e.x) / 2, mz = (p.z + e.z) / 2;
    const dx = e.x - p.x, dz = e.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    // camera off to the side of the line between them
    const nx = -dz / d, nz = dx / d;
    const side = (this.g.cameraRig.pos.x - mx) * nx + (this.g.cameraRig.pos.z - mz) * nz >= 0 ? 1 : -1;
    const y = (p.onPlateau ? 230 : 0) + 2.3;
    const pos = new THREE.Vector3(mx + nx * side * 5.2 - (dx / d) * 1.2, y + 0.5, mz + nz * side * 5.2 - (dz / d) * 1.2);
    this.g.cameraRig.setShot(pos, new THREE.Vector3(mx, y - 0.6, mz), 2.2);
    // face each other
    p.heading = headingTo(p.x, p.z, e.x, e.z);
    if (e.face) e.heading = headingTo(e.x, e.z, p.x, p.z);
  }

  async choose(prompt, options) {
    this.guard();
    this.lock(true);
    const i = await this.g.hud.choose(prompt, options.map((o) => (typeof o === 'string' ? { text: o } : o)));
    this.guard();
    this.lock(false);
    return i;
  }

  async phone(from, msgs) {
    this.guard();
    this.lock(true);
    await this.g.hud.phone(from, msgs);
    this.guard();
    this.lock(false);
  }

  async memory(text) {
    this.guard();
    this.lock(true);
    await this.g.hud.memory(text);
    this.guard();
    this.lock(false);
  }

  objective(html) {
    this.guard();
    this.g.hud.objective(html);
  }

  toast(msg, kind) {
    this.g.hud.toast(msg, kind);
  }

  counter(text) {
    this.counterText = text;
    this.g.hud.counter(text);
  }

  clue(id, title, text) {
    this.g.addClue(id, title, text);
  }

  flag(k, v = true) {
    this.g.state.flags[k] = v;
  }

  timer(sec, reason, onExpire = null) {
    this.timeLeft = sec;
    this.timerReason = reason;
    this.onTimerExpire = onExpire;
    this.g.hud.timer(sec);
  }

  stopTimer() {
    this.timeLeft = null;
    this.onTimerExpire = null;
    this.g.hud.timer(null);
  }

  clearFails() {
    this.failChecks = [];
  }

  bonus(money = 0, respect = 0) {
    if (money) this.g.addMoney(money);
    if (respect) this.g.addRespect(respect);
  }

  // ---------------------------------------------------------------- spawning
  ped(x, z, o = {}) {
    const g = this.g;
    const spot = o.exact ? { x, z } : g.grid.findOpen(x, z, 10) || { x, z };
    const p = g.peds.spawn(spot.x, spot.z, { mission: true, ...o });
    p.baseAnim = o.anim || null;
    this.spawned.peds.push(p);
    return p;
  }

  enemies(list, o = {}) {
    return list.map(([x, z, extra = {}]) => {
      const e = this.ped(x, z, { kind: 'gang', look: { ...(o.look || LOOKS.gang), skin: rand(0, 1) < 0.5 ? '#6b4129' : '#4f2f1d' }, ai: o.ai || 'fight', health: o.health ?? 55, ...extra });
      e.noReport = true;
      return e;
    });
  }

  vehicle(type, x, z, h, o = {}) {
    const g = this.g;
    const v = g.vehicles.spawn(type, x, z, h, { mission: true, ...o });
    this.spawned.vehicles.push(v);
    return v;
  }

  marker(x, z, o = {}) {
    const m = this.g.effects.marker(x, z, o);
    this.spawned.markers.push(m);
    return m;
  }

  arrowOn(e, color = '#ff3b3b') {
    const a = this.g.effects.arrow(color);
    a.followEntity = e;
    this.spawned.markers.push(a);
    return a;
  }

  removeMarker(m) {
    if (!m) return;
    m.remove();
    this.spawned.markers = this.spawned.markers.filter((x) => x !== m);
  }

  mesh(obj) {
    this.g.scene.add(obj);
    this.spawned.meshes.push(obj);
    return obj;
  }

  target(x, z, o = {}) {
    const t = { x, z, color: o.color || '#ff4040', letter: o.letter || null, gps: o.gps ?? true, entity: o.entity || null, plateau: !!o.plateau };
    this.targets.push(t);
    return t;
  }
  untarget(t) {
    this.targets = this.targets.filter((x) => x !== t);
  }

  // ---------------------------------------------------------------- objectives
  async goTo(x, z, o = {}) {
    this.guard();
    const g = this.g;
    const r = o.r ?? 4;
    const plateau = !!o.plateau;
    const m = o.marker === false ? null : this.marker(x, z, { color: o.color || '#ffd400', radius: Math.min(r, o.vehicle ? 4 : 2.2), y: plateau ? 230 : 0, height: o.vehicle ? 5 : 3 });
    const t = this.target(x, z, { color: o.color || '#ffd400', plateau });
    const text = o.text || 'Go to the <em>marker</em>.';
    this.objective(text);
    try {
      await this.until(() => {
        const p = g.player;
        const needCar = o.vehicle === true ? !p.vehicle : o.vehicle && p.vehicle !== o.vehicle;
        if (needCar && o.vehicleText) g.hud.objective(o.vehicleText);
        else g.hud.objective(text);
        if (needCar) return false;
        if (!!p.onPlateau !== plateau) return false;
        if (o.slow && p.vehicle && p.vehicle.speed > 4) return false;
        return dist(p.x, p.z, x, z) < r;
      });
    } finally {
      this.removeMarker(m);
      this.untarget(t);
    }
    if (o.stop && g.player.vehicle) g.player.vehicle.input.handbrake = true;
  }

  async enterVehicle(v, text) {
    this.guard();
    const a = this.arrowOn(v, '#4fc3ff');
    const t = this.target(v.x, v.z, { color: '#4fc3ff', entity: v });
    this.objective(text || 'Get in the <em>vehicle</em>.');
    const off = this.failIf(() => v.state === 'wrecked', 'The vehicle was destroyed.');
    try {
      await this.until(() => this.g.player.vehicle === v);
    } finally {
      this.removeMarker(a);
      this.untarget(t);
      off();
    }
  }

  async defeat(peds, text = 'Beat up the <em>enemies</em>.') {
    this.guard();
    const total = peds.length;
    const arrows = peds.map((p) => this.arrowOn(p, '#ff3b3b'));
    const ts = peds.map((p) => this.target(p.x, p.z, { color: '#ff3b3b', entity: p, gps: false }));
    this.objective(text);
    try {
      await this.until(() => {
        const left = peds.filter((p) => p.state !== 'dead').length;
        this.counter(`${total - left}/${total} down`);
        return left === 0;
      });
    } finally {
      arrows.forEach((a) => this.removeMarker(a));
      ts.forEach((t) => this.untarget(t));
      this.counter(null);
    }
  }

  async hold(x, z, o = {}) {
    this.guard();
    const g = this.g;
    const r = o.r ?? 2;
    const time = o.time ?? 1.6;
    const id = 'mhold_' + Math.random().toString(36).slice(2);
    const m = o.marker === false ? null : this.marker(x, z, { color: o.color || '#ffd400', radius: 1.3, height: 2.5, y: o.plateau ? 230 : 0 });
    const t = this.target(x, z, { color: o.color || '#ffd400', plateau: !!o.plateau });
    if (o.text) this.objective(o.text);
    g.interactions.add(id, { x, z, r, label: o.label || 'Hold', plateau: !!o.plateau, priority: 5, onUse: () => {} });
    this.spawned.interactions.push(id);
    let prog = 0;
    try {
      await this.until((dt) => {
        const p = g.player;
        const near = dist(p.x, p.z, x, z) < r && p.state === 'foot';
        if (near && g.input.held('action')) {
          prog += dt;
          p.anim = { mode: o.anim || 'poster' };
          p.heading = o.face !== undefined ? o.face : p.heading;
          g.hud.hold(o.holdText || 'Hold ACTION…', prog / time);
          if (Math.random() < dt * 3) g.audio.whoosh();
        } else {
          if (p.anim && p.anim.mode === (o.anim || 'poster')) p.anim = null;
          if (prog > 0) prog = Math.max(0, prog - dt * 2);
          g.hud.hold(near && prog > 0 ? o.holdText || 'Hold ACTION…' : null, prog / time);
        }
        return prog >= time;
      });
    } finally {
      g.hud.hold(null);
      if (g.player.anim && g.player.anim.mode === (o.anim || 'poster')) g.player.anim = null;
      g.interactions.remove(id);
      this.removeMarker(m);
      this.untarget(t);
    }
  }

  async collect(x, z, o = {}) {
    this.guard();
    const g = this.g;
    const pk = this.pickupMesh(o.color || '#4fc3ff', o.shape);
    pk.position.set(x, (o.plateau ? 230 : 0) + 0.9, z);
    this.mesh(pk);
    const t = this.target(x, z, { color: o.color || '#4fc3ff', plateau: !!o.plateau });
    if (o.text) this.objective(o.text);
    try {
      await this.until((dt) => {
        pk.rotation.y += dt * 2.5;
        pk.position.y = (o.plateau ? 230 : 0) + 0.9 + Math.sin(g.time * 3) * 0.15;
        const p = g.player;
        return p.state === 'foot' && dist(p.x, p.z, x, z) < (o.r ?? 1.6);
      });
    } finally {
      g.scene.remove(pk);
      this.untarget(t);
    }
    g.audio.pickup();
    g.effects.sparks(x, 1, z, 10, [0.5, 0.8, 1]);
  }

  pickupMesh(color, shape) {
    const grp = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.5 });
    const geo = shape === 'folder' ? new THREE.BoxGeometry(0.6, 0.08, 0.45) : shape === 'usb' ? new THREE.BoxGeometry(0.15, 0.08, 0.45) : new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const m = new THREE.Mesh(geo, mat);
    if (shape === 'folder' || shape === 'usb') m.rotation.x = -0.6;
    grp.add(m);
    const glow = this.g.effects.marker(0, 0, { color, radius: 0.6, height: 1.2, pulse: true });
    this.g.scene.remove(glow.group);
    glow.group.position.set(0, -0.9, 0);
    grp.add(glow.group);
    this.g.effects.markers.delete(glow);
    return grp;
  }

  // ---------------------------------------------------------------- cleanup
  cleanup(keep = []) {
    const g = this.g;
    for (const p of this.spawned.peds) if (!keep.includes(p) && g.peds.list.includes(p)) g.peds.remove(p);
    for (const v of this.spawned.vehicles) {
      if (keep.includes(v) || v.disposed) continue;
      if (g.player.vehicle === v) {
        v.mission = false; // let the player keep driving it
        continue;
      }
      g.vehicles.remove(v);
    }
    for (const m of this.spawned.markers) m.remove();
    for (const id of this.spawned.interactions) g.interactions.remove(id);
    for (const o of this.spawned.meshes) g.scene.remove(o);
    this.spawned = { peds: [], vehicles: [], markers: [], interactions: [], meshes: [] };
    this.targets = [];
    g.hud.objective(null);
    g.hud.timer(null);
    g.hud.counter(null);
    g.hud.hold(null);
    g.cameraRig.clearShot();
    g.player.locked = false;
    if (g.player.anim && g.player.anim.mode !== 'handsup') g.player.anim = null;
    g.player.carry = false;
    this.sys.suppressPolice = false;
    this.sys.wideCam = false;
    g.cutscene = false;
    g.population.enabled = true;
    if (!g.hud.root.classList.contains('hidden') || g.started) g.hud.show(true);
  }
}

const SPEAKER_COLORS = {
  SIZWE: '#ffcf33', Kyle: '#ff8a5c', Zanele: '#ff7eb6', 'Auntie Noma': '#74e36b', 'Bra Vusi': '#ff5a5a', 'Aunty Rashieda': '#c98bff',
  Pieter: '#8ec5ff', 'Victor Steyn': '#bfbfbf', Thug: '#ff9f43', Guard: '#ff9f43', Marshal: '#ffd84a', Jade: '#3fc1c9', 'Uncle Bheki': '#e0a060',
  Passenger: '#9fd8ff', Stranger: '#9fd8ff', Reporter: '#9fd8ff', Crowd: '#ffffff',
};

// ------------------------------------------------------------------------ system
export class MissionSystem {
  constructor(game) {
    this.game = game;
    this.story = STORY;
    this.active = null;
    this.givers = new Map();
    this.suppressPolice = false;
    this.wideCam = false;
    this.side = new SideQuests(game, this);
  }

  isDone(id) {
    return this.game.state.done.includes(id);
  }

  prereqsMet(def) {
    return (def.after || []).every((id) => this.isDone(id));
  }

  available(def) {
    return !this.isDone(def.id) && this.prereqsMet(def) && this.game.state.respect >= (def.respect || 0);
  }

  storyStatus() {
    return this.story.map((d) => ({
      id: d.id, title: d.title, blurb: d.blurb, where: d.where,
      done: this.isDone(d.id), available: this.available(d),
      reason: !this.prereqsMet(d) ? 'Locked' : `Needs ${d.respect} respect`,
    }));
  }

  nextRespectGoal() {
    for (const d of this.story) if (!this.isDone(d.id) && (d.respect || 0) > this.game.state.respect) return d.respect;
    return Math.ceil((this.game.state.respect + 1) / 50) * 50;
  }

  onRespectChanged(before, after) {
    for (const d of this.story) {
      if (this.isDone(d.id) || !this.prereqsMet(d) || !d.respect) continue;
      if (before < d.respect && after >= d.respect) {
        this.game.hud.toast(`New story mission unlocked: <b>${d.title}</b>`, 'good', 6000);
      }
    }
    this.refreshGivers();
  }

  refreshGivers() {
    const g = this.game;
    const want = new Set();
    for (const d of this.story) {
      if (!d.giver || this.isDone(d.id) || !this.prereqsMet(d) || d.auto) continue;
      if (this.active && this.active.def === d) continue;
      want.add(d.id);
      if (this.givers.has(d.id)) continue;
      const gv = d.giver;
      let ped = null;
      if (gv.look) {
        const o = g.grid.findOpen(gv.x, gv.z, 6) || gv;
        ped = g.peds.spawn(o.x, o.z, { kind: 'npc', look: { ...gv.look }, ai: 'idle', mission: true, heading: gv.h ?? 0, anim: gv.anim || null, name: gv.name, invulnerable: true, faceTarget: true });
        ped.baseAnim = gv.anim || null;
      }
      const mk = g.effects.marker(gv.mx ?? gv.x, gv.mz ?? gv.z, { color: '#ffd400', radius: 1.1, height: 2.4, icon: gv.letter || 'S', iconColor: '#ffd400' });
      const iid = 'giver_' + d.id;
      g.interactions.add(iid, {
        x: gv.mx ?? gv.x, z: gv.mz ?? gv.z, r: 3,
        label: () => (this.available(d) ? `▶ ${d.title}` : `🔒 ${d.respect} respect`),
        onUse: () => {
          if (this.active) return g.hud.toast('Finish your current job first.');
          if (!this.available(d)) return g.hud.toast(`<b>${d.title}</b> needs <b>${d.respect}</b> respect. You have ${g.state.respect}. Do side jobs, taxi fares, gym sets or find proteas.`, 'warn', 6000);
          this.start(d);
        },
      });
      this.givers.set(d.id, { ped, mk, iid, def: d });
    }
    for (const [id, gvr] of this.givers) {
      if (want.has(id)) continue;
      this.removeGiver(id);
    }
  }

  removeGiver(id) {
    const gvr = this.givers.get(id);
    if (!gvr) return;
    const g = this.game;
    if (gvr.ped && g.peds.list.includes(gvr.ped) && !gvr.keepPed) g.peds.remove(gvr.ped);
    gvr.mk.remove();
    g.interactions.remove(gvr.iid);
    this.givers.delete(id);
  }

  /** Hand the giver ped over to a starting mission so it can keep talking. */
  takeGiverPed(def) {
    const gvr = this.givers.get(def.id);
    if (!gvr) return null;
    gvr.keepPed = true;
    const p = gvr.ped;
    this.removeGiver(def.id);
    return p;
  }

  start(def, opts = {}) {
    if (this.active) return;
    const g = this.game;
    g.activities.cancelAll();
    const api = new MissionAPI(this, def);
    const giverPed = this.takeGiverPed(def);
    if (giverPed) api.spawned.peds.push(giverPed);
    api.giver = giverPed;
    this.active = { def, api };
    this.refreshGivers();
    if (!opts.silent) g.hud.banner(def.title, def.kind === 'side' ? 'Side job' : 'Story mission', 'title-card', 2400);
    g.events.emit('missionStart', def);
    Promise.resolve()
      .then(() => def.run(api, giverPed))
      .then(() => {
        if (api.ended) return;
        api.ended = true;
        this.onPassed(api);
      })
      .catch((e) => {
        if (!(e instanceof MissionFail)) {
          console.error(e);
          if (!api.ended) api.fail('Something went wrong.');
          return;
        }
        if (!api.ended) api.fail(e.reason);
      });
  }

  onPassed(api) {
    const g = this.game, def = api.def;
    api.cleanup(api.keep || []);
    this.active = null;
    const rw = def.reward || {};
    const resp = rw.respect || 0, money = rw.money || 0;
    if (def.kind !== 'side') {
      g.state.done.push(def.id);
      g.state.totals.missions++;
    } else g.state.totals.sideQuests++;
    g.state.money += money;
    g.addRespect(resp, true);
    g.audio.passed();
    g.effects.confetti(g.player.x, g.player.y + 2, g.player.z);
    g.hud.banner('MISSION PASSED!', `${resp ? `RESPECT +${resp}` : ''}${resp && money ? '   ' : ''}${money ? formatMoney(money) : ''}`, 'passed', 3600);
    if (def.onPass) def.onPass(g);
    g.save();
    this.refreshGivers();
    g.activities.refresh();
    g.events.emit('missionPassed', def);
    const next = def.next && this.story.find((d) => d.id === def.next);
    if (next && next.auto) setTimeout(() => !this.active && this.start(next), 3800);
  }

  onFailed(api, reason) {
    const g = this.game;
    g.hud.closeDialogue();
    document.querySelector('#choices').classList.add('hidden');
    g.dialogueOpen = false;
    api.cleanup();
    this.active = null;
    if (reason !== 'ended') {
      g.audio.failed();
      g.hud.banner('MISSION FAILED', reason, 'failed', 3600);
    }
    this.refreshGivers();
    g.events.emit('missionFailed', api.def);
  }

  failActive(reason) {
    if (this.active) this.active.api.fail(reason);
  }

  debugPass() {
    if (!this.active) return false;
    const api = this.active.api;
    api.ended = true;
    for (const w of api.waiters) w.reject(new MissionFail('ended'));
    api.waiters.clear();
    this.onPassed(api);
    return true;
  }

  startIntro() {
    const first = this.story[0];
    if (!this.isDone(first.id)) this.start(first, { silent: true });
  }

  update(dt) {
    if (this.active) this.active.api.tick(dt);
    this.side.update(dt);
    // giver idle animations face the player
    for (const gvr of this.givers.values()) {
      if (gvr.ped && gvr.ped.state === 'ok' && !gvr.ped.anim && gvr.ped.baseAnim) gvr.ped.anim = gvr.ped.baseAnim;
    }
  }

  gpsTarget() {
    if (!this.active) return null;
    const ts = this.active.api.targets.filter((t) => t.gps);
    if (!ts.length) return null;
    const t = ts[ts.length - 1];
    if (t.entity) return { x: t.entity.x, z: t.entity.z };
    return t;
  }

  blips(out, full) {
    const g = this.game;
    if (this.active) {
      for (const t of this.active.api.targets) {
        const e = t.entity;
        if (e && (e.state === 'dead' || e.disposed)) continue;
        out.push({ x: e ? e.x : t.x, z: e ? e.z : t.z, color: t.color, letter: t.letter, edge: true, size: e && !e.halfL ? 5.5 : 7 });
      }
    } else {
      for (const gvr of this.givers.values()) {
        const d = gvr.def;
        const ok = this.available(d);
        out.push({ x: d.giver.mx ?? d.giver.x, z: d.giver.mz ?? d.giver.z, color: ok ? '#ffd400' : '#8a7a30', letter: d.giver.letter || 'S', edge: ok, size: 8 });
      }
    }
    this.side.blips(out, full);
  }
}
