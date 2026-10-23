// Tools and guns: what Sizwe carries, the Woodstock hardware store, pickups lying around the city,
// melee tools, hitscan guns with aim assist (lock-on reticle), and ammo dropped by armed cops.

import * as THREE from 'three';
import { MeshKit, vcMaterial } from '../core/meshkit.js';
import { roundedBox, outlineMaterial } from '../core/toon.js';
import { T } from '../world/grid.js';
import { makeSignTexture } from '../world/textures.js';
import { dist, clamp, headingTo, wrapAngle, rand, chance, formatMoney } from '../core/util.js';

// melee tools reuse the player's attack fields (dur / hitAt / range / dmg / kind); guns are hitscan
export const WEAPONS = {
  fists: { name: 'Fists' },
  bat: { name: 'Cricket bat', melee: true, move: 'bat', dur: 0.6, hitAt: 0.3, range: 1.95, dmg: 24, kind: 'heavy', price: 120 },
  spanner: { name: 'Wheel spanner', melee: true, move: 'swing', dur: 0.46, hitAt: 0.22, range: 1.7, dmg: 17, kind: 'light', price: 70 },
  pistol: { name: 'Pistol', gun: true, dmg: 24, rate: 0.3, range: 34, accuracy: 0.92, spread: 0.035, price: 750, ammo: 36, ammoPrice: 90, respect: 15 },
  smg: { name: 'SMG', gun: true, auto: true, dmg: 10, rate: 0.085, range: 26, accuracy: 0.72, spread: 0.07, price: 2400, ammo: 90, ammoPrice: 160, respect: 80 },
  shotgun: { name: 'Pump shotgun', gun: true, dmg: 13, pellets: 6, rate: 0.95, range: 16, accuracy: 0.85, spread: 0.12, heavy: true, price: 1500, ammo: 12, ammoPrice: 130, respect: 45 },
};
export const ORDER = ['fists', 'bat', 'spanner', 'pistol', 'smg', 'shotgun'];

// stroke icons in the same style as the touch buttons
export const ICONS = {
  fists: '<path d="M7 11V8.5a1.5 1.5 0 0 1 3 0V8a1.5 1.5 0 0 1 3 0v.5a1.5 1.5 0 0 1 3 0V9a1.5 1.5 0 0 1 3 0v4.5a6.5 6.5 0 0 1-6.5 6.5h-.8A5.7 5.7 0 0 1 6 14.3V13a2 2 0 0 1 2-2h3"/>',
  bat: '<path d="M4.5 19.5l2-2M6.5 17.5l9.8-9.8a2.5 2.5 0 0 1 3.5 3.5L10 21"/>',
  spanner: '<path d="M14.5 3.5a4.5 4.5 0 0 0 5.6 5.6L9 20.2a2 2 0 0 1-2.8-2.8L17.3 6.3"/><circle cx="17" cy="7" r="1"/>',
  pistol: '<path d="M3 7h16v4h-8l-1.5 7H6l1.5-7H3zM11 11v2h2"/>',
  smg: '<path d="M2 8h19v3h-6l-1 3h-2l-1 5H8l1.5-8H4zM14 14h2v3"/>',
  shotgun: '<path d="M2 9h20v2.5H10l-3 5.5H3.5l2.5-5.5H2zM13 11.5l1 2h3"/>',
};
export const iconSvg = (type) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[type] || ICONS.fists}</svg>`;

const INK = '#2a1d17';
let _ink = null;
const inkMat = () => (_ink ||= outlineMaterial(INK, 0.012));

/**
 * A held weapon, built in its own space: grip at the origin; tools run along +y (they point forward when the
 * arm hangs), guns' barrels along +z (they point at the ground at rest and forward when aiming).
 * Attach to the wrist bone with rotation.x = PI / 2.
 */
export function weaponMesh(type) {
  const k = new MeshKit();
  const rb = (x, y, z, w, h, d, r, c) => k.add(roundedBox(w, h, d, r, 1), { x, y, z, color: c });
  if (type === 'bat') {
    rb(0, 0.08, 0, 0.045, 0.24, 0.045, 0.02, '#2a2a2e'); // taped handle
    rb(0, 0.55, 0, 0.11, 0.7, 0.05, 0.025, '#e8c98a'); // flat willow blade
    rb(0, 0.55, 0.028, 0.08, 0.6, 0.006, 0.003, '#c9a46a');
  } else if (type === 'spanner') {
    rb(0, 0.2, 0, 0.04, 0.42, 0.025, 0.012, '#9aa3ab');
    rb(0, 0.44, 0, 0.12, 0.1, 0.03, 0.03, '#9aa3ab');
    rb(0, 0.5, 0, 0.05, 0.04, 0.032, 0.01, '#5d656c');
  } else if (type === 'pistol') {
    rb(0, 0, -0.01, 0.045, 0.12, 0.06, 0.015, '#2f3338'); // grip
    rb(0, 0.07, 0.07, 0.05, 0.06, 0.24, 0.015, '#3d434a'); // slide
    rb(0, 0.07, 0.2, 0.02, 0.02, 0.02, 0.005, '#16181b');
  } else if (type === 'smg') {
    rb(0, 0, 0, 0.045, 0.12, 0.06, 0.015, '#2f3338');
    rb(0, 0.07, 0.08, 0.06, 0.08, 0.32, 0.02, '#3d434a');
    rb(0, -0.02, 0.12, 0.035, 0.16, 0.05, 0.012, '#2a2d31'); // magazine
    rb(0, 0.07, 0.28, 0.025, 0.025, 0.1, 0.008, '#16181b');
  } else if (type === 'shotgun') {
    rb(0, 0, 0, 0.045, 0.12, 0.06, 0.015, '#6b4a30');
    rb(0, 0.07, 0.2, 0.05, 0.06, 0.62, 0.02, '#3d434a'); // barrel
    rb(0, 0.04, 0.24, 0.06, 0.05, 0.22, 0.02, '#8a5a36'); // pump
    rb(0, 0.04, -0.16, 0.06, 0.09, 0.28, 0.025, '#8a5a36'); // stock
  }
  const geo = k.build();
  const m = new THREE.Mesh(geo, vcMaterial());
  const ink = new THREE.Mesh(geo, inkMat());
  ink.raycast = () => {};
  m.add(ink);
  m.rotation.x = Math.PI / 2;
  m.position.set(0, -0.06, 0.01);
  return m;
}

export class WeaponSystem {
  constructor(game) {
    this.game = game;
    this.held = null; // mesh in Sizwe's hand
    this.heldType = null;
    this.cool = 0;
    this.recoil = 0;
    this.aimW = 0;
    this.aimT = 0; // keeps the gun up for a moment after a shot
    this.target = null;
    this.crimeT = 0;
    this.emptyT = 0;
    this.tracers = [];
    this.pickups = [];
    this.reticle = document.getElementById('reticle');
    this.tracerMat = new THREE.LineBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.9 });
    this.flashMat = new THREE.SpriteMaterial({ map: flashTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.buildStore();
    this.placePickups();
  }

  get inv() {
    const s = this.game.state;
    if (!s.weapons) s.weapons = { owned: { fists: true }, ammo: {}, current: 'fists' };
    return s.weapons;
  }
  get current() {
    const c = this.inv.current;
    return this.inv.owned[c] ? c : 'fists';
  }
  get spec() {
    return WEAPONS[this.current];
  }
  ammo(type = this.current) {
    return this.inv.ammo[type] || 0;
  }

  give(type, ammo = 0, equip = true) {
    const inv = this.inv, spec = WEAPONS[type], fresh = !inv.owned[type];
    inv.owned[type] = true;
    if (spec.gun) inv.ammo[type] = Math.min(999, (inv.ammo[type] || 0) + ammo);
    if (equip && fresh) this.equip(type);
    this.game.hud.updateWeapon();
  }
  giveAll() {
    for (const t of ORDER) if (t !== 'fists') this.give(t, WEAPONS[t].gun ? WEAPONS[t].ammo * 3 : 0, false);
    this.equip('pistol');
  }
  /** Busted: the police keep the guns, Sizwe keeps his tools. */
  confiscate() {
    const inv = this.inv;
    let any = false;
    for (const t of ORDER) if (WEAPONS[t].gun && inv.owned[t]) {
      delete inv.owned[t];
      inv.ammo[t] = 0;
      any = true;
    }
    if (any) {
      this.equip('fists');
      this.game.hud.toast('The police confiscated your guns.', 'warn', 4000);
    }
  }

  equip(type) {
    const inv = this.inv;
    if (!inv.owned[type]) return;
    inv.current = type;
    this.cool = 0.2;
    this.target = null;
    this.game.player.attack = null;
    this.syncHeld();
    this.game.hud.updateWeapon();
  }
  cycle(dir = 1) {
    const owned = ORDER.filter((t) => this.inv.owned[t]);
    if (owned.length < 2) return this.game.hud.toast('Only your fists. Find tools around town or visit the hardware store in Woodstock.', '', 3200);
    const i = owned.indexOf(this.current);
    this.equip(owned[(i + dir + owned.length) % owned.length]);
    this.game.audio.click();
  }

  /** Keep the right mesh in Sizwe's hand. */
  syncHeld() {
    const type = this.current === 'fists' ? null : this.current;
    if (type === this.heldType) return;
    if (this.held) this.held.parent?.remove(this.held);
    this.held = type ? weaponMesh(type) : null;
    this.heldType = type;
    if (this.held) this.game.player.rig.b.armR.add(this.held);
  }

  // ---------------------------------------------------------------- the hardware store
  buildStore() {
    const g = this.game;
    const exclude = new Set(g.landmarks.muralBuildings || []);
    const f = frontage(g.city, g.grid, 'woodstock', 340, -232, exclude);
    if (!f) return;
    this.store = f;
    const root = g.meshes.root, k = new MeshKit();
    const { x, z, ry, w } = f;
    const along = (d) => [x + Math.cos(ry) * d, z - Math.sin(ry) * d];
    // shopfront: dark doorway, a window either side, striped awning
    const put = (d, y, out, sx, sy, sz, c) => {
      const [px, pz] = along(d);
      k.add(roundedBox(sx, sy, sz, Math.min(sx, sy, sz) * 0.3, 1), { x: px + Math.sin(ry) * out, y, z: pz + Math.cos(ry) * out, ry, color: c });
    };
    put(0, 1.2, 0.05, 1.6, 2.4, 0.12, '#2a2d31');
    for (const s of [-1, 1]) put(s * 2.3, 1.5, 0.05, 2.2, 1.6, 0.12, '#3c6a8c');
    for (let j = 0; j < 8; j++) put(-3.5 + j + 0.5, 2.9, 0.75, 1, 0.14, 1.5, j % 2 ? '#ffffff' : '#ff8c42');
    const mesh = new THREE.Mesh(k.build(), vcMaterial());
    const ink = new THREE.Mesh(mesh.geometry, outlineMaterial(INK, 0.04));
    mesh.add(ink);
    root.add(mesh);
    const tex = makeSignTexture("SIPHO'S HARDWARE", { w: 512, h: 96, bg: '#1e3b5a', fg: '#ffc928' });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.9, 8), 1.4), new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(x + Math.sin(ry) * 0.12, 4.1, z + Math.cos(ry) * 0.12);
    sign.rotation.y = ry;
    root.add(sign);
    const door = { x: x + Math.sin(ry) * 1.6, z: z + Math.cos(ry) * 1.6 };
    this.storeDoor = door;
    g.interactions.add('hardware', { x: door.x, z: door.z, r: 2.4, label: "🔧 Sipho's Hardware — tools & guns", onUse: () => this.openStore() });
  }

  async openStore() {
    const g = this.game, inv = this.inv, resp = g.state.respect;
    const items = [];
    for (const t of ORDER) {
      if (t === 'fists') continue;
      const s = WEAPONS[t];
      if (!inv.owned[t]) {
        const locked = s.respect && resp < s.respect;
        items.push({ text: `${s.name} — ${formatMoney(s.price)}${locked ? ` (needs ${s.respect} respect)` : ''}`, disabled: locked || g.state.money < s.price, buy: () => this.give(t, s.ammo || 0), price: s.price });
      } else if (s.gun) items.push({ text: `${s.name} ammo ×${s.ammo} — ${formatMoney(s.ammoPrice)}`, disabled: g.state.money < s.ammoPrice, buy: () => this.give(t, s.ammo, false), price: s.ammoPrice });
    }
    items.push({ text: 'Just looking, thanks' });
    const i = await g.hud.choose("Sipho: \"Hammers, spanners… and the other stuff under the counter. What you need, my bru?\"", items);
    const it = items[i];
    if (!it || !it.buy) return;
    if (g.state.money < it.price) return g.hud.toast('Not enough money.', 'warn');
    g.addMoney(-it.price);
    it.buy();
    g.audio.cash();
  }

  // ---------------------------------------------------------------- pickups
  placePickups() {
    const g = this.game;
    // tools lying around: a cricket bat by the Langa shisa nyama, a spanner in the Woodstock yard
    for (const [type, x, z] of [['bat', 652, 124], ['spanner', 474, -150]]) {
      const o = g.grid.findOpen(x, z, 12);
      if (o) this.addPickup(type, o.x, o.z, { respawn: true });
    }
  }
  addPickup(type, x, z, { ammo = 0, respawn = false, life = Infinity } = {}) {
    const g = this.game;
    const grp = new THREE.Group();
    const m = weaponMesh(type);
    m.position.set(0, 0, 0);
    m.rotation.set(WEAPONS[type].gun ? 0 : -Math.PI / 2.4, 0, WEAPONS[type].gun ? 0 : 0.6);
    m.scale.setScalar(WEAPONS[type].gun ? 2.2 : 1.6);
    grp.add(m);
    const glow = new THREE.Sprite(this.flashMat.clone());
    glow.material.color.set(WEAPONS[type].gun ? '#ffd24a' : '#7be3ff');
    glow.material.opacity = 0.5;
    glow.scale.setScalar(1.6);
    grp.add(glow);
    grp.position.set(x, 0.9, z);
    g.scene.add(grp);
    this.pickups.push({ type, x, z, ammo, respawn, life, grp });
  }
  /** Armed cops drop their pistol ammo when knocked out. */
  dropAmmo(x, z, type = 'pistol', n = 12) {
    this.addPickup(type, x + rand(-0.4, 0.4), z + rand(-0.4, 0.4), { ammo: n, life: 30 });
  }
  updatePickups(dt) {
    const g = this.game, p = g.player;
    for (const k of this.pickups) {
      // a tool lying around only shows while Sizwe doesn't have one
      k.grp.visible = !(k.respawn && this.inv.owned[k.type]);
      if (!k.grp.visible) continue;
      k.life -= dt;
      k.grp.rotation.y += dt * 1.6;
      k.grp.position.y = 0.9 + Math.sin(g.time * 2.4 + k.x) * 0.12;
      if (k.life <= 0) {
        k.dead = true;
        continue;
      }
      if (p.state === 'foot' && !p.onPlateau && dist(p.x, p.z, k.x, k.z) < 1.3) {
        const spec = WEAPONS[k.type], had = !!this.inv.owned[k.type];
        this.give(k.type, k.ammo || (spec.gun ? spec.ammo : 0));
        g.audio.pickup();
        const how = g.input.usingGamepad ? ' — D-pad ◀ to switch' : g.input.touchMode ? ' — tap the weapon button to switch' : ' — Tab or 1–6 to switch';
        g.hud.toast(had ? `+${k.ammo} ${spec.name.toLowerCase()} rounds` : `Picked up: <b>${spec.name}</b>${how}`, 'good', 3600);
        if (!k.respawn) k.dead = true;
      }
    }
    for (const k of this.pickups) if (k.dead) g.scene.remove(k.grp);
    this.pickups = this.pickups.filter((k) => !k.dead);
  }

  // ---------------------------------------------------------------- aiming
  /** Which way Sizwe wants to shoot: the stick direction while moving, otherwise where the camera looks. */
  aimHeading() {
    const g = this.game, mv = g.input.move;
    const { f, r } = g.cameraRig.basis();
    if (mv.mag > 0.2) return Math.atan2(f.x * mv.y + r.x * mv.x, f.z * mv.y + r.z * mv.x);
    return Math.atan2(f.x, f.z);
  }
  clearShot(ax, az, bx, bz) {
    return this.game.grid.raycast(ax, 1.4, az, bx, 1.2, bz) >= 1;
  }
  /** Aim assist: lock onto the best target in a cone (hostiles first), sticky while it stays in view. */
  pickTarget(spec) {
    const g = this.game, p = g.player, mode = g.settings.aimAssist || 'strong';
    if (mode === 'off') return null;
    const cone = mode === 'strong' ? 1.3 : 0.5;
    const want = this.aimHeading();
    let best = null, bs = Infinity;
    for (const q of g.peds.list) {
      if (q.state === 'dead' || q.invulnerable || q.removeMe || !!q.onPlateau !== !!p.onPlateau) continue;
      const d = dist(p.x, p.z, q.x, q.z);
      if (d > spec.range || d < 0.4) continue;
      const ang = Math.abs(wrapAngle(headingTo(p.x, p.z, q.x, q.z) - want));
      const sticky = q === this.target ? 1.4 : 1;
      if (ang > cone * sticky) continue;
      const score = d * 0.5 + ang * 9 + (q.hostile ? 0 : 7) - (q === this.target ? 4 : 0);
      if (score < bs && this.clearShot(p.x, p.z, q.x, q.z)) {
        bs = score;
        best = q;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- shooting
  /** Trigger pressed (or held for the SMG). */
  pull() {
    const g = this.game, p = g.player, spec = this.spec, type = this.current;
    if (!spec.gun || this.cool > 0 || p.state !== 'foot' || p.locked || p.swimming) return;
    if (this.ammo() <= 0) {
      this.cool = 0.35;
      g.audio.dryFire();
      if (this.emptyT <= 0) {
        this.emptyT = 3;
        g.hud.toast(`Out of ${spec.name.toLowerCase()} ammo. Sipho's Hardware in Woodstock sells more.`, 'warn', 3000);
      }
      return;
    }
    this.inv.ammo[type]--;
    this.cool = spec.rate;
    this.recoil = 1;
    this.aimT = 1.6;
    const tgt = this.target;
    const head = tgt ? headingTo(p.x, p.z, tgt.x, tgt.z) : this.aimHeading();
    p.heading = head;
    const mx = p.x + Math.sin(head) * 0.75, mz = p.z + Math.cos(head) * 0.75, my = p.y + 1.42;
    for (let i = 0; i < (spec.pellets || 1); i++) {
      // assisted shots land on the locked target most of the time; the rest go where the barrel points
      if (tgt && tgt.state !== 'dead' && chance(spec.accuracy) && (spec.pellets ? chance(0.75) : true)) {
        this.hitPed(tgt, spec, mx, mz, my);
        continue;
      }
      const a = head + rand(-spec.spread, spec.spread);
      this.castShot(mx, my, mz, a, spec);
    }
    this.flash(mx, my, mz, head);
    g.audio.gunshot(type);
    g.cameraRig.shake(spec.heavy ? 0.22 : 0.08);
    g.vibrate(spec.heavy ? 50 : 20);
    // gunfire empties the street; police nearby or any civilian who sees it brings the heat
    if (this.crimeT <= 0) {
      const copsNear = [...g.police.cops].some((c) => c.state === 'ok' && dist(c.x, c.z, p.x, p.z) < 45);
      const witness = g.peds.list.some((q) => q.kind === 'civ' && q.state === 'ok' && dist(q.x, q.z, p.x, p.z) < 30);
      if (copsNear || witness || g.police.stars > 0) {
        this.crimeT = 4;
        g.police.crime('gunfire', 1);
      }
    }
    g.peds.panicAround(p.x, p.z, 32);
    g.hud.updateWeapon();
  }

  hitPed(q, spec, mx, mz, my) {
    const g = this.game, p = g.player;
    const d = dist(p.x, p.z, q.x, q.z);
    const fall = clamp(1.25 - d / spec.range, 0.45, 1);
    const dx = (q.x - p.x) / (d || 1), dz = (q.z - p.z) / (d || 1);
    q.takeHit(spec.dmg * fall, dx, dz, p, spec.heavy && d < 6 ? 'heavy' : 'bullet');
    this.tracer(mx, my, mz, q.x, (q.y || 0) + 1.2, q.z);
  }

  /** A free shot along heading a: first ped, car or wall it meets. */
  castShot(mx, my, mz, a, spec) {
    const g = this.game, p = g.player;
    const sx = Math.sin(a), sz = Math.cos(a);
    const wallT = g.grid.raycast(mx, my, mz, mx + sx * spec.range, my, mz + sz * spec.range);
    let end = wallT * spec.range, hit = null;
    for (const q of g.peds.list) {
      if (q.state === 'dead' || q.invulnerable) continue;
      const rx = q.x - mx, rz = q.z - mz, along = rx * sx + rz * sz;
      if (along < 0 || along > end) continue;
      if (Math.abs(rx * sz - rz * sx) < 0.42) {
        end = along;
        hit = q;
      }
    }
    let car = null;
    for (const v of g.vehicles.list) {
      if (v === p.vehicle || v.disposed) continue;
      const rx = v.x - mx, rz = v.z - mz, along = rx * sx + rz * sz;
      if (along < 0 || along > end + v.radius) continue;
      for (let s = Math.max(0, along - v.radius); s < Math.min(end, along + v.radius); s += 0.4) {
        if (v.distTo(mx + sx * s, mz + sz * s) < 0.05) {
          end = s;
          car = v;
          hit = null;
          break;
        }
      }
    }
    const ex = mx + sx * end, ez = mz + sz * end;
    if (hit) {
      const d = dist(p.x, p.z, hit.x, hit.z);
      hit.takeHit(spec.dmg * clamp(1.25 - d / spec.range, 0.45, 1), sx, sz, p, spec.heavy && d < 6 ? 'heavy' : 'bullet');
    } else if (car) {
      car.damage(spec.dmg * 0.4, 'player');
      g.effects.sparks(ex, my - 0.4, ez, 5);
    } else if (end < spec.range - 0.5) g.effects.dust(ex, my, ez, 2);
    this.tracer(mx, my, mz, ex, hit ? 1.2 : my, ez);
  }

  /** NPC shooting (armed cops): returns true if the shot hit. */
  npcShot(shooter, target, accuracy, dmg) {
    const g = this.game;
    const h = headingTo(shooter.x, shooter.z, target.x, target.z);
    const mx = shooter.x + Math.sin(h) * 0.7, mz = shooter.z + Math.cos(h) * 0.7, my = (shooter.y || 0) + 1.4;
    this.flash(mx, my, mz, h);
    g.audio.gunshot('pistol', shooter.x, shooter.z);
    const clear = this.clearShot(shooter.x, shooter.z, target.x, target.z);
    if (clear && chance(accuracy)) {
      const d = dist(shooter.x, shooter.z, target.x, target.z) || 1;
      target.takeHit(dmg, (target.x - shooter.x) / d, (target.z - shooter.z) / d, shooter, 'bullet');
      this.tracer(mx, my, mz, target.x, (target.y || 0) + 1.2, target.z);
      return true;
    }
    const a = h + rand(-0.12, 0.12);
    this.tracer(mx, my, mz, target.x + Math.sin(a) * 3, my - rand(0, 0.6), target.z + Math.cos(a) * 3);
    return false;
  }

  tracer(ax, ay, az, bx, by, bz) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz)]);
    const line = new THREE.Line(geo, this.tracerMat);
    this.game.scene.add(line);
    this.tracers.push({ o: line, t: 0.08 });
  }
  flash(x, y, z, h) {
    const s = new THREE.Sprite(this.flashMat);
    s.position.set(x + Math.sin(h) * 0.15, y, z + Math.cos(h) * 0.15);
    s.scale.setScalar(0.9);
    this.game.scene.add(s);
    this.tracers.push({ o: s, t: 0.05 });
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const g = this.game, p = g.player, input = g.input, spec = this.spec;
    this.cool -= dt;
    this.crimeT -= dt;
    this.emptyT -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 9);
    this.aimT -= dt;
    for (const t of this.tracers) {
      t.t -= dt;
      if (t.t <= 0) {
        g.scene.remove(t.o);
        if (t.o.geometry && t.o.isLine) t.o.geometry.dispose();
      }
    }
    this.tracers = this.tracers.filter((t) => t.t > 0);
    this.updatePickups(dt);
    this.syncHeld();
    const free = p.state === 'foot' && !p.locked && !p.anim && !g.dialogueOpen && !g.minigame && !g.cutscene;
    // switching: Tab / 1–6, D-pad left, or the touch weapon button
    if (free) {
      if (input.pressed('weapon')) this.cycle(1);
      for (let i = 0; i < ORDER.length; i++) if (input.keys.has('Digit' + (i + 1)) && input.pressedKeys.has('Digit' + (i + 1)) && this.inv.owned[ORDER[i]]) this.equip(ORDER[i]);
    }
    // guns: hold for the SMG, tap for the others
    if (spec.gun && free) {
      this.target = this.pickTarget(spec);
      if (spec.auto ? input.held('attack') : input.pressed('attack')) this.pull();
    } else this.target = null;
    const aiming = spec.gun && p.state === 'foot' && !p.swimming && !p.anim && (this.target || this.aimT > 0);
    this.aimW += ((aiming ? 1 : 0) - this.aimW) * Math.min(1, dt * 12);
    this.updateReticle();
  }

  updateReticle() {
    const el = this.reticle, t = this.target;
    if (!el) return;
    if (!t || this.aimW < 0.5) {
      el.classList.add('hidden');
      return;
    }
    const v = new THREE.Vector3(t.x, (t.y || 0) + 1.25, t.z).project(this.game.camera);
    if (v.z > 1) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    el.classList.toggle('hostile', !!t.hostile);
    el.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px) translate(-50%, -50%)`;
  }
}

/** The street-facing middle of a building wall in a district, nearest to (nx, nz). */
export function frontage(city, grid, district, nx, nz, exclude = new Set(), { minH = 5, minW = 9, walk = [T.WALK] } = {}) {
  let best = null, bs = Infinity;
  for (const b of city.buildings) {
    if (b.district !== district || b.h < minH || exclude.has(b)) continue;
    const faces = [
      { x: (b.x0 + b.x1) / 2, z: b.z1 + 0.06, ry: 0, w: b.x1 - b.x0, ox: 0, oz: 1 },
      { x: (b.x0 + b.x1) / 2, z: b.z0 - 0.06, ry: Math.PI, w: b.x1 - b.x0, ox: 0, oz: -1 },
      { x: b.x1 + 0.06, z: (b.z0 + b.z1) / 2, ry: Math.PI / 2, w: b.z1 - b.z0, ox: 1, oz: 0 },
      { x: b.x0 - 0.06, z: (b.z0 + b.z1) / 2, ry: -Math.PI / 2, w: b.z1 - b.z0, ox: -1, oz: 0 },
    ];
    for (const f of faces) {
      if (f.w < minW) continue;
      // open ground in front of the door, and room to stand a few metres out
      const tw = grid.typeAt(f.x + f.ox * 1.5, f.z + f.oz * 1.5), tr = grid.typeAt(f.x + f.ox * 4.5, f.z + f.oz * 4.5);
      if (!walk.includes(tw) || grid.blocksFoot(tr) || grid.circleBlocked(f.x + f.ox * 2, f.z + f.oz * 2, 0.8)) continue;
      const d = dist(f.x, f.z, nx, nz);
      if (d < bs) {
        bs = d;
        best = { ...f, b };
      }
    }
  }
  return best;
}

let _flashTex = null;
function flashTexture() {
  if (_flashTex) return _flashTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,230,1)');
  grd.addColorStop(0.35, 'rgba(255,210,90,0.9)');
  grd.addColorStop(1, 'rgba(255,140,30,0)');
  g.fillStyle = grd;
  // a star-shaped muzzle burst
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, r = i % 2 ? 12 : 31;
    g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  g.fill();
  _flashTex = new THREE.CanvasTexture(c);
  _flashTex.colorSpace = THREE.SRGBColorSpace;
  return _flashTex;
}
