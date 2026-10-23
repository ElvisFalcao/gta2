// Unified keyboard / mouse / touch / gamepad input. Touch: floating joystick on the left,
// drag anywhere else to turn the camera, contextual buttons on the right.
// Gamepad: standard (Xbox) mapping, GTA-style layout.

const KEYMAP = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  attack: ['KeyJ', 'KeyK', 'ControlLeft'],
  jump: ['Space'],
  brake: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  enter: ['KeyF', 'Enter'],
  action: ['KeyE'],
  horn: ['KeyH'],
  pause: ['Escape', 'KeyP'],
  map: ['KeyM'],
  radio: ['KeyR'],
  weapon: ['Tab'],
  taxi: ['KeyT'],
  advance: ['Space', 'Enter', 'KeyE'],
  camLeft: ['KeyQ'],
  camRight: ['KeyZ'],
};

// Standard-mapping button indices: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT,
// 8 View, 9 Menu, 10 LS click, 11 RS click, 12-15 d-pad up/down/left/right.
const PADMAP = {
  sprint: [0],
  attack: [1, 7],
  jump: [2],
  enter: [3],
  action: [4, 15],
  brake: [5],
  horn: [10],
  camReset: [11],
  map: [8],
  pause: [9],
  radio: [14],
  weapon: [14],
  taxi: [13],
  advance: [0],
  confirm: [0],
  back: [1, 9],
  navUp: [12],
  navDown: [13],
};
export const PAD_GLYPH = { action: 'LB', enter: 'Y', attack: 'B', jump: 'X', sprint: 'A', brake: 'RB', advance: 'A' };
const DEAD = 0.18;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

export class Input {
  constructor(root) {
    this.root = root;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.btnHeld = {};
    this.btnPressed = {};
    this.joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.look = { id: null, lx: 0, ly: 0 };
    this.mouse = { down: false, moved: false, sx: 0, sy: 0, lx: 0, ly: 0 };
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.clickAttack = false;
    this.touchMode = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.sensitivity = 1;
    this.onTouchDetected = null;
    this.onGamepadChange = null;
    this.pad = null; // {lx, ly, rx, ry, lt, rt}
    this.padHeld = {};
    this.padPressed = {};
    this.usingGamepad = false;
    this._padPrev = [];
    window.addEventListener('gamepadconnected', () => this.pollGamepad(0));

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressedKeys.add(e.code);
      this.setGamepad(false);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.btnHeld = {};
      this.resetJoy();
    });
  }

  attachSurface(surface, joyZone, joyBase, joyKnob) {
    this.joyBase = joyBase;
    this.joyKnob = joyKnob;
    // Joystick
    joyZone.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      e.preventDefault();
      this.setTouch();
      if (this.joy.active) return;
      this.joy.active = true;
      this.joy.id = e.pointerId;
      this.joy.ox = e.clientX;
      this.joy.oy = e.clientY;
      this.joy.x = this.joy.y = 0;
      joyZone.setPointerCapture(e.pointerId);
      joyBase.style.left = e.clientX + 'px';
      joyBase.style.top = e.clientY + 'px';
      joyBase.classList.add('on');
      joyKnob.style.transform = 'translate(-50%,-50%)';
    });
    joyZone.addEventListener('pointermove', (e) => {
      if (!this.joy.active || e.pointerId !== this.joy.id) return;
      const R = 56;
      let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        // let the base follow the finger a bit for comfort
        this.joy.ox += (dx / d) * (d - R);
        this.joy.oy += (dy / d) * (d - R);
        joyBase.style.left = this.joy.ox + 'px';
        joyBase.style.top = this.joy.oy + 'px';
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      this.joy.x = dx / R;
      this.joy.y = -dy / R;
      joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    });
    const endJoy = (e) => {
      if (e.pointerId !== this.joy.id) return;
      this.resetJoy();
    };
    joyZone.addEventListener('pointerup', endJoy);
    joyZone.addEventListener('pointercancel', endJoy);

    // Camera look (touch drag / mouse drag)
    surface.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button !== 0) return;
        this.mouse.down = true;
        this.mouse.moved = false;
        this.mouse.sx = this.mouse.lx = e.clientX;
        this.mouse.sy = this.mouse.ly = e.clientY;
        return;
      }
      this.setTouch();
      if (this.look.id !== null) return;
      this.look.id = e.pointerId;
      this.look.lx = e.clientX;
      this.look.ly = e.clientY;
      surface.setPointerCapture(e.pointerId);
    });
    surface.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        if (!this.mouse.down) return;
        const dx = e.clientX - this.mouse.lx, dy = e.clientY - this.mouse.ly;
        if (Math.hypot(e.clientX - this.mouse.sx, e.clientY - this.mouse.sy) > 5) this.mouse.moved = true;
        if (this.mouse.moved) {
          this.yawDelta -= dx * 0.005 * this.sensitivity;
          this.pitchDelta += dy * 0.003 * this.sensitivity;
        }
        this.mouse.lx = e.clientX;
        this.mouse.ly = e.clientY;
        return;
      }
      if (e.pointerId !== this.look.id) return;
      this.yawDelta -= (e.clientX - this.look.lx) * 0.009 * this.sensitivity;
      this.pitchDelta += (e.clientY - this.look.ly) * 0.005 * this.sensitivity;
      this.look.lx = e.clientX;
      this.look.ly = e.clientY;
    });
    const endLook = (e) => {
      if (e.pointerType === 'mouse') {
        if (this.mouse.down && !this.mouse.moved) this.clickAttack = true;
        this.mouse.down = false;
        return;
      }
      if (e.pointerId === this.look.id) this.look.id = null;
    };
    surface.addEventListener('pointerup', endLook);
    surface.addEventListener('pointercancel', endLook);
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  bindButtons(container) {
    container.querySelectorAll('[data-btn]').forEach((el) => {
      const name = el.dataset.btn;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.pointerType !== 'mouse') this.setTouch();
        try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        this.btnHeld[name] = true;
        this.btnPressed[name] = true;
        el.classList.add('down');
      });
      const up = () => {
        this.btnHeld[name] = false;
        el.classList.remove('down');
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
    });
  }

  /** Read the first connected gamepad once per frame (Gamepad API is poll-only). */
  pollGamepad(dt) {
    let gp = null;
    try {
      for (const g of navigator.getGamepads ? navigator.getGamepads() : []) {
        if (g && g.connected && g.buttons.length >= 10) {
          gp = g;
          break;
        }
      }
    } catch {
      /* not allowed in this context */
    }
    if (!gp) {
      if (this.pad) {
        this.pad = null;
        this.padHeld = {};
        this.setGamepad(false);
      }
      return;
    }
    this.gamepad = gp;
    const b = (i) => {
      const x = gp.buttons[i];
      return x ? (typeof x === 'object' ? x.pressed || x.value > 0.5 : x > 0.5) : false;
    };
    const val = (i) => {
      const x = gp.buttons[i];
      return x ? (typeof x === 'object' ? x.value : x) : 0;
    };
    const ax = gp.axes;
    const pad = { lx: dz(ax[0] || 0), ly: -dz(ax[1] || 0), rx: dz(ax[2] || 0), ry: dz(ax[3] || 0), lt: val(6), rt: val(7) };
    const now = [];
    let any = Math.abs(pad.lx) + Math.abs(pad.ly) + Math.abs(pad.rx) + Math.abs(pad.ry) + pad.lt + pad.rt > 0.1;
    for (let i = 0; i < gp.buttons.length; i++) {
      now[i] = b(i);
      if (now[i]) any = true;
    }
    for (const name in PADMAP) {
      const h = PADMAP[name].some((i) => now[i]);
      const edge = PADMAP[name].some((i) => now[i] && !this._padPrev[i]);
      this.padHeld[name] = h;
      if (edge) this.padPressed[name] = true;
    }
    this._padPrev = now;
    this.pad = pad;
    if (any) this.setGamepad(true);
    if (dt > 0 && (pad.rx || pad.ry)) {
      this.yawDelta -= pad.rx * 2.6 * dt * this.sensitivity;
      this.pitchDelta += pad.ry * 1.2 * dt * this.sensitivity;
    }
  }

  setGamepad(on) {
    if (this.usingGamepad === on) return;
    this.usingGamepad = on;
    if (this.onGamepadChange) this.onGamepadChange(on);
  }

  rumble(ms = 120, strong = 0.6, weak = 0.4) {
    const a = this.gamepad && this.gamepad.vibrationActuator;
    if (!a || !this.usingGamepad) return;
    try {
      a.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak });
    } catch {
      /* unsupported */
    }
  }

  setTouch() {
    this.setGamepad(false);
    if (!this.touchMode) {
      this.touchMode = true;
      if (this.onTouchDetected) this.onTouchDetected();
    }
  }

  resetJoy() {
    this.joy.active = false;
    this.joy.id = null;
    this.joy.x = this.joy.y = 0;
    if (this.joyBase) {
      this.joyBase.classList.remove('on');
      this.joyBase.style.left = this.joyBase.style.top = ''; // back to its resting spot
    }
    if (this.joyKnob) this.joyKnob.style.transform = 'translate(-50%,-50%)';
  }

  keyHeld(name) {
    const ks = KEYMAP[name];
    return ks ? ks.some((k) => this.keys.has(k)) : false;
  }
  keyPressed(name) {
    const ks = KEYMAP[name];
    return ks ? ks.some((k) => this.pressedKeys.has(k)) : false;
  }
  held(name) {
    return this.keyHeld(name) || !!this.btnHeld[name] || !!this.padHeld[name];
  }
  pressed(name) {
    if (name === 'attack' && this.clickAttack) return true;
    return this.keyPressed(name) || !!this.btnPressed[name] || !!this.padPressed[name];
  }
  consume(name) {
    this.btnPressed[name] = false;
    this.padPressed[name] = false;
    const ks = KEYMAP[name];
    if (ks) ks.forEach((k) => this.pressedKeys.delete(k));
    if (name === 'attack') this.clickAttack = false;
  }

  get move() {
    let x = 0, y = 0;
    if (this.keyHeld('left')) x -= 1;
    if (this.keyHeld('right')) x += 1;
    if (this.keyHeld('up')) y += 1;
    if (this.keyHeld('down')) y -= 1;
    if (x || y) {
      const l = Math.hypot(x, y);
      return { x: x / l, y: y / l, mag: 1, keyboard: true };
    }
    if (this.joy.active) {
      const m = Math.min(1, Math.hypot(this.joy.x, this.joy.y));
      if (m < 0.12) return { x: 0, y: 0, mag: 0 };
      return { x: this.joy.x, y: this.joy.y, mag: m };
    }
    if (this.pad && (this.pad.lx || this.pad.ly)) {
      const { lx: x, ly: y } = this.pad;
      const h = Math.hypot(x, y), k = Math.max(1, h);
      return { x: x / k, y: y / k, mag: Math.min(1, h) };
    }
    return { x: 0, y: 0, mag: 0 };
  }

  /** Driving: GAS / BRAKE pedals on touch, RT / LT on a pad, otherwise W / S. The touch stick only steers. */
  get throttle() {
    if (this.btnHeld.gas || this.btnHeld.reverse) return (this.btnHeld.gas ? 1 : 0) - (this.btnHeld.reverse ? 1 : 0);
    if (this.joy.active && !this.keyHeld('up') && !this.keyHeld('down')) return 0;
    if (this.pad && (this.pad.rt > 0.05 || this.pad.lt > 0.05)) return this.pad.rt - this.pad.lt;
    if (this.pad && this.usingGamepad && !this.keyHeld('up') && !this.keyHeld('down')) return 0;
    return this.move.y;
  }

  endFrame() {
    this.pressedKeys.clear();
    this.btnPressed = {};
    this.padPressed = {};
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.clickAttack = false;
  }
}
