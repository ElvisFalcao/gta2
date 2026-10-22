// In-game HUD: stats, rotating minimap with GPS, objectives, dialogue, choices,
// banners, prompts, phone and memory overlays.

import { PAD_GLYPH } from '../core/input.js';
import { T } from '../world/grid.js';
import { WORLD } from '../world/mapData.js';
import { formatMoney, formatClock, clamp } from '../core/util.js';

const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const MAP_COLORS = {
  [T.WATER]: [27, 79, 114],
  [T.LAND]: [110, 124, 88],
  [T.ROAD]: [222, 222, 214],
  [T.WALK]: [176, 172, 160],
  [T.SAND]: [222, 204, 145],
  [T.PARK]: [86, 140, 64],
  [T.PLAZA]: [180, 172, 152],
  [T.BUILDING]: [72, 76, 82],
  [T.ROCK]: [78, 90, 62],
  [T.PROP]: [90, 92, 96],
};

export function buildMapCanvas(grid) {
  const c = document.createElement('canvas');
  c.width = grid.w;
  c.height = grid.h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(grid.w, grid.h);
  for (let i = 0; i < grid.type.length; i++) {
    const t = grid.type[i];
    let col = MAP_COLORS[t] || MAP_COLORS[T.LAND];
    if (t === T.ROCK || (t === T.LAND && grid.height[i] > 0)) {
      const h = grid.height[i];
      const k = clamp(h / 230, 0, 1);
      col = [78 + k * 60, 90 + k * 50, 62 + k * 50];
    }
    img.data[i * 4] = col[0];
    img.data[i * 4 + 1] = col[1];
    img.data[i * 4 + 2] = col[2];
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = $('#hud');
    this.el = {
      clock: $('#clock'), money: $('#money'), health: $('.bar.health i'), stamina: $('.bar.stamina i'),
      respect: $('#respect-val'), respBar: $('.bar.resp i'), wanted: $('#wanted'), timer: $('#timer'), counter: $('#counter'),
      objective: $('#objective'), banner: $('#banner'), bigarea: $('#bigarea'), vehname: $('#vehname'), prompt: $('#prompt'),
      dialogue: $('#dialogue'), choices: $('#choices'), damage: $('#damage'), toasts: $('#toasts'), holdbar: $('#holdbar'),
      arrest: $('#arrest'), fade: $('#fade'), phone: $('#phone'), memory: $('#memory'), touch: $('#touch'),
      actionBtn: $('.b-action'), actionLbl: $('.b-action span'), enterBtn: $('.b-enter'), taxiBtn: $('.b-taxi'),
    };
    this.cache = {};
    this.mm = $('#minimap');
    this.mmCtx = this.mm.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.mmDpr = dpr;
    this.resizeMinimap();
    this.mapImg = null;
    this.dialogueResolve = null;
    this.typeT = 0;
    this.areaT = 0;
    this.vehT = 0;
    this.bannerT = 0;
    this.lastArea = '';
    this.actionLabel = null;
    this.enterAvail = false;
    this.mode = 'foot';
    this.el.dialogue.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.advanceDialogue();
    });
    $('#minimap-wrap').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.game.menu.openMap();
    });
    $('#btn-pause').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.game.menu.open();
    });
    window.addEventListener('resize', () => this.resizeMinimap());
  }

  resizeMinimap() {
    const css = this.mm.getBoundingClientRect().width || 150;
    const px = Math.round(css * this.mmDpr);
    if (this.mm.width !== px) {
      this.mm.width = px;
      this.mm.height = px;
    }
  }

  show(on) {
    this.root.classList.toggle('hidden', !on);
    const inp = this.game.input;
    this.el.touch.classList.toggle('hidden', !on || !inp.touchMode || inp.usingGamepad);
    this.root.classList.toggle('pad', !!inp.usingGamepad);
  }

  set(key, el, val, fn) {
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    fn(el, val);
  }

  update(dt) {
    const g = this.game, p = g.player, st = g.state;
    const E = this.el;
    this.set('clock', E.clock, formatClock(g.env.hours), (el, v) => (el.textContent = v));
    this.set('money', E.money, Math.round(st.money), (el, v) => (el.textContent = formatMoney(v)));
    this.set('hp', E.health, Math.round((p.health / p.maxHealth) * 100), (el, v) => (el.style.transform = `scaleX(${v / 100})`));
    this.set('sta', E.stamina, Math.round(p.stamina), (el, v) => (el.style.transform = `scaleX(${v / 100})`));
    this.set('resp', E.respect, st.respect, (el, v) => (el.textContent = v));
    const nextGoal = g.missions ? g.missions.nextRespectGoal() : 100;
    this.set('respBar', E.respBar, Math.round(clamp(st.respect / Math.max(1, nextGoal), 0, 1) * 100), (el, v) => (el.style.transform = `scaleX(${v / 100})`));
    this.set('wanted', E.wanted, g.police.stars, (el, v) => el.querySelectorAll('b').forEach((b, i) => b.classList.toggle('on', i < v)));
    // arrest indicator
    const ar = g.police.arrestT;
    this.set('arrest', E.arrest, ar > 0.15 ? Math.round(ar * 10) : 0, (el, v) => {
      el.classList.toggle('hidden', !v);
      el.textContent = v ? 'GETTING ARRESTED — BREAK FREE!' : '';
    });
    // area name
    const area = g.grid.areaName(p.x, p.z, p.onPlateau);
    if (area !== this.lastArea) {
      this.lastArea = area;
      if (g.started && !g.cutscene) this.areaName(area);
    }
    if (this.areaT > 0) {
      this.areaT -= dt;
      if (this.areaT <= 0) E.bigarea.classList.add('hidden');
    }
    if (this.vehT > 0) {
      this.vehT -= dt;
      if (this.vehT <= 0) E.vehname.classList.add('hidden');
    }
    // dialogue typewriter
    if (this.dlg && !this.dlg.full) {
      this.typeT += dt * 55;
      const n = Math.min(this.dlg.text.length, Math.floor(this.typeT));
      this.dlgText.textContent = this.dlg.text.slice(0, n);
      if (n >= this.dlg.text.length) this.dlg.full = true;
    }
    if (this.dlg && this.dlg.auto) {
      this.dlg.auto -= dt;
      if (this.dlg.auto <= 0) this.closeDialogue();
    }
    // input mode / buttons
    const mode = p.state === 'vehicle' ? 'car' : 'foot';
    this.set('mode', E.touch, mode, (el, v) => {
      el.classList.toggle('mode-car', v === 'car');
      el.classList.toggle('mode-foot', v === 'foot');
      E.enterBtn.querySelector('.lbl').textContent = v === 'car' ? 'EXIT' : 'CAR';
    });
    const enter = mode === 'car' || !!p.canEnter();
    this.set('enter', E.enterBtn, enter && !g.dialogueOpen, (el, v) => el.classList.toggle('hidden', !v));
    const taxi = mode === 'car' && p.vehicle && p.vehicle.type === 'minibus' && !g.missions.active;
    this.set('taxi', E.taxiBtn, taxi ? (g.activities.taxiActive ? 'STOP TAXI' : 'TAXI JOB') : '', (el, v) => {
      el.classList.toggle('hidden', !v);
      el.textContent = v;
    });
    this.updatePrompt(enter, mode);
    this.drawMinimap();
  }

  updatePrompt(enter, mode) {
    const g = this.game;
    const pad = g.input.usingGamepad;
    const touch = g.input.touchMode && !pad;
    const k = (name, key) => (pad ? `<kbd class="pad pad-${PAD_GLYPH[name]}">${PAD_GLYPH[name]}</kbd>` : `<kbd>${key}</kbd>`);
    let html = '';
    if (this.actionLabel) html = touch ? '' : `${k('action', 'E')}${this.actionLabel}`;
    else if (enter && mode === 'foot' && !touch && !g.dialogueOpen) html = `${k('enter', 'F')}Get in`;
    this.set('prompt', this.el.prompt, html, (el, v) => {
      el.classList.toggle('hidden', !v);
      el.innerHTML = v;
    });
  }

  setAction(label) {
    this.actionLabel = label;
    this.set('action', this.el.actionBtn, label || '', (el, v) => {
      el.classList.toggle('hidden', !v);
      this.el.actionLbl.textContent = v;
    });
  }

  // ---------------------------------------------------------------- minimap
  drawMinimap() {
    const g = this.game, p = g.player;
    if (!this.mapImg) this.mapImg = buildMapCanvas(g.grid);
    const ctx = this.mmCtx, S = this.mm.width, R = S / 2 - 3 * this.mmDpr;
    const cx = S / 2, cy = S / 2;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgb(27,79,114)';
    ctx.fillRect(0, 0, S, S);
    const range = p.state === 'vehicle' ? 165 : 105;
    const scale = R / range;
    const theta = g.cameraRig.yaw + Math.PI;
    this.mmTheta = theta;
    this.mmScale = scale;
    ctx.translate(cx, cy);
    ctx.rotate(theta);
    ctx.scale(scale, scale);
    ctx.translate(-p.x, -p.z);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.mapImg, WORLD.minX, WORLD.minZ, g.grid.w * g.grid.cell, g.grid.h * g.grid.cell);
    // GPS route
    const route = g.gps.route;
    if (route && route.length > 1) {
      ctx.strokeStyle = 'rgba(200, 90, 255, 0.95)';
      ctx.lineWidth = 5 / scale;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(route[0].x, route[0].z);
      for (let i = 1; i < route.length; i++) ctx.lineTo(route[i].x, route[i].z);
      ctx.stroke();
    }
    ctx.restore();
    // blips (kept upright)
    const c = Math.cos(theta), s = Math.sin(theta);
    for (const b of g.collectBlips()) {
      let dx = (b.x - p.x) * scale, dz = (b.z - p.z) * scale;
      let x = dx * c - dz * s, y = dx * s + dz * c;
      const d = Math.hypot(x, y);
      let edge = false;
      if (d > R - 8 * this.mmDpr) {
        if (!b.edge) continue;
        x = (x / d) * (R - 8 * this.mmDpr);
        y = (y / d) * (R - 8 * this.mmDpr);
        edge = true;
      }
      this.drawBlip(ctx, cx + x, cy + y, b, edge, this.mmDpr);
    }
    // north marker
    const nx = -s * -1, ny = c * -1;
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${11 * this.mmDpr}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const nr = R - 9 * this.mmDpr;
    // world north is (0,-1); rotate by theta
    const wx = 0 * c - -1 * s, wy = 0 * s + -1 * c;
    ctx.beginPath();
    ctx.arc(cx + wx * nr, cy + wy * nr, 8 * this.mmDpr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('N', cx + wx * nr, cy + wy * nr + 0.5);
    // player arrow
    const h = p.state === 'vehicle' && p.vehicle ? p.vehicle.heading : p.heading;
    const fx = Math.sin(h), fz = Math.cos(h);
    const ax = fx * c - fz * s, ay = fx * s + fz * c;
    const ang = Math.atan2(ay, ax);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const k = this.mmDpr;
    ctx.beginPath();
    ctx.moveTo(9 * k, 0);
    ctx.lineTo(-6 * k, 6 * k);
    ctx.lineTo(-3 * k, 0);
    ctx.lineTo(-6 * k, -6 * k);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2 * k;
    ctx.stroke();
    ctx.fill();
    ctx.restore();
    // ring
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.lineWidth = 3 * this.mmDpr;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R - 2 * this.mmDpr, 0, Math.PI * 2);
    ctx.lineWidth = 1 * this.mmDpr;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();
  }

  drawBlip(ctx, x, y, b, edge, k) {
    const r = (b.size || 7) * k;
    ctx.beginPath();
    if (b.shape === 'dot') {
      ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.lineWidth = 1.5 * k;
      ctx.strokeStyle = '#000';
      ctx.stroke();
      return;
    }
    if (b.shape === 'square') ctx.rect(x - r, y - r, r * 2, r * 2);
    else ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.lineWidth = 2 * k;
    ctx.strokeStyle = edge ? '#fff' : '#000';
    ctx.stroke();
    if (b.letter) {
      ctx.fillStyle = b.textColor || '#111';
      ctx.font = `bold ${r * 1.25}px "Bebas Neue", Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.letter, x, y + 0.5 * k);
    }
  }

  // ---------------------------------------------------------------- messages
  toast(text, kind = '', ms = 4200) {
    const d = document.createElement('div');
    d.className = 'toast ' + kind;
    d.innerHTML = text;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => d.remove(), ms);
  }

  objective(html) {
    const el = this.el.objective;
    if (!html) {
      el.classList.add('hidden');
      return;
    }
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  timer(sec) {
    const el = this.el.timer;
    if (sec === null || sec === undefined) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    const s = Math.max(0, Math.ceil(sec));
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    el.classList.toggle('low', s <= 10);
  }

  counter(text) {
    const el = this.el.counter;
    if (!text) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    el.textContent = text;
  }

  hold(label, frac) {
    const el = this.el.holdbar;
    if (label === null) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    el.querySelector('span').textContent = label;
    el.querySelector('i').style.width = `${Math.round(frac * 100)}%`;
  }

  areaName(name) {
    const el = this.el.bigarea;
    el.textContent = name;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    this.areaT = 3.2;
  }

  vehicleName(name) {
    const el = this.el.vehname;
    el.textContent = name;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    this.vehT = 2.6;
  }

  damageFlash(a) {
    const el = this.el.damage;
    el.style.transition = 'none';
    el.style.opacity = String(Math.min(1, 0.35 + a));
    void el.offsetWidth;
    el.style.transition = 'opacity 0.6s';
    el.style.opacity = '0';
  }

  wantedFlash() {
    const el = this.el.wanted;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  async banner(title, sub = '', kind = '', ms = 3200) {
    const el = this.el.banner;
    el.className = kind;
    el.querySelector('.title').textContent = title;
    el.querySelector('.sub').textContent = sub;
    el.classList.remove('hidden');
    const token = (this.bannerToken = (this.bannerToken || 0) + 1);
    await wait(ms);
    if (token === this.bannerToken) el.classList.add('hidden');
  }

  hideBanner() {
    this.el.banner.classList.add('hidden');
  }

  fade(on, ms = 600) {
    const el = this.el.fade;
    el.style.transitionDuration = ms + 'ms';
    el.classList.toggle('on', on);
    return wait(ms);
  }

  // ---------------------------------------------------------------- dialogue
  say(who, text, opts = {}) {
    if (this.dlg) this.closeDialogue();
    const el = this.el.dialogue;
    el.classList.remove('hidden');
    const whoEl = el.querySelector('.who');
    whoEl.textContent = who || '';
    whoEl.style.color = opts.color || '';
    this.dlgText = el.querySelector('.text');
    this.dlgText.textContent = '';
    this.typeT = 0;
    if (!opts.bark) this.game.dialogueOpen = true;
    el.classList.toggle('bark', !!opts.bark);
    if (opts.bark && this.game.voice) this.game.voice.sayAs(who, text);
    return new Promise((resolve) => {
      this.dlg = { text, full: false, resolve, auto: opts.auto || 0, bark: !!opts.bark };
    });
  }

  advanceDialogue() {
    if (!this.dlg) return;
    if (!this.dlg.full) {
      this.dlg.full = true;
      this.dlgText.textContent = this.dlg.text;
      return;
    }
    this.closeDialogue();
  }

  closeDialogue() {
    const d = this.dlg;
    this.dlg = null;
    this.el.dialogue.classList.add('hidden');
    if (!d || !d.bark) this.game.dialogueOpen = false;
    if (d) d.resolve();
  }

  choose(prompt, options) {
    const el = this.el.choices;
    el.querySelector('.q').textContent = prompt;
    const box = el.querySelector('.opts');
    box.innerHTML = '';
    this.game.dialogueOpen = true;
    el.classList.remove('hidden');
    return new Promise((resolve) => {
      const pickIt = (i) => {
        if (options[i].disabled) {
          this.toast(options[i].disabledReason || "You can't do that right now.", 'warn');
          return;
        }
        el.classList.add('hidden');
        this.game.dialogueOpen = false;
        this.padUi = null;
        window.removeEventListener('keydown', onKey);
        this.game.audio.click();
        resolve(i);
      };
      const onKey = (e) => {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= options.length) pickIt(n - 1);
      };
      window.addEventListener('keydown', onKey);
      options.forEach((o, i) => {
        const b = document.createElement('button');
        b.innerHTML = `<span class="k">${i + 1}</span>${o.text}`;
        if (o.disabled) b.classList.add('disabled');
        b.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          pickIt(i);
        });
        box.appendChild(b);
      });
      const btns = [...box.children];
      const ui = { i: Math.max(0, options.findIndex((o) => !o.disabled)), pick: () => pickIt(ui.i) };
      ui.move = (d) => {
        ui.i = (ui.i + d + options.length) % options.length;
        ui.mark();
      };
      ui.mark = () => btns.forEach((b, j) => b.classList.toggle('sel', j === ui.i && this.game.input.usingGamepad));
      ui.mark();
      this.padUi = ui;
    });
  }

  phone(from, msgs) {
    const el = this.el.phone;
    el.querySelector('.ph-from').textContent = from;
    el.querySelector('.ph-time').textContent = formatClock(this.game.env.hours);
    const box = el.querySelector('.ph-msgs');
    box.innerHTML = '';
    for (const m of msgs) {
      const d = document.createElement('div');
      d.textContent = m;
      box.appendChild(d);
    }
    el.classList.remove('hidden');
    this.game.audio.phone();
    this.game.dialogueOpen = true;
    return new Promise((resolve) => {
      const close = (e) => {
        e.stopPropagation();
        el.classList.add('hidden');
        el.removeEventListener('pointerdown', close);
        window.removeEventListener('keydown', key);
        this.game.dialogueOpen = false;
        this.padUi = null;
        resolve();
      };
      const key = (e) => { if (['Space', 'Enter', 'KeyE', 'Escape'].includes(e.code)) close(e); };
      setTimeout(() => {
        el.addEventListener('pointerdown', close);
        window.addEventListener('keydown', key);
        this.padUi = { close: () => close({ stopPropagation() {} }) };
      }, 350);
    });
  }

  memory(text) {
    const el = this.el.memory;
    el.querySelector('.txt').textContent = text;
    el.classList.remove('hidden');
    this.game.dialogueOpen = true;
    return new Promise((resolve) => {
      const close = (e) => {
        e.stopPropagation();
        el.classList.add('hidden');
        el.removeEventListener('pointerdown', close);
        window.removeEventListener('keydown', key);
        this.game.dialogueOpen = false;
        this.padUi = null;
        resolve();
      };
      const key = (e) => { if (['Space', 'Enter', 'KeyE', 'Escape'].includes(e.code)) close(e); };
      setTimeout(() => {
        el.addEventListener('pointerdown', close);
        window.addEventListener('keydown', key);
        this.padUi = { close: () => close({ stopPropagation() {} }) };
      }, 500);
    });
  }

  // gamepad: d-pad + A for dialogue choices, A / B to dismiss phone & memory overlays
  handlePad(input) {
    const ui = this.padUi;
    if (!ui || !input.usingGamepad) return;
    const eat = () => ['confirm', 'advance', 'back', 'attack', 'action', 'jump'].forEach((n) => input.consume(n));
    if (ui.close) {
      if (input.pressed('confirm') || input.pressed('back')) {
        eat();
        ui.close();
      }
      return;
    }
    if (input.pressed('navUp')) ui.move(-1);
    if (input.pressed('navDown')) {
      input.consume('taxi');
      ui.move(1);
    }
    ui.mark();
    if (input.pressed('confirm')) {
      eat();
      ui.pick();
    }
  }

  // used by the input layer while a dialogue is open
  handleAdvanceKey(input) {
    if (this.dlg && !this.dlg.bark && input.pressed('advance')) {
      input.consume('advance');
      input.consume('jump');
      input.consume('action');
      this.advanceDialogue();
    }
  }
}
