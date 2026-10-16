// Unified keyboard / mouse / touch input. Touch: floating joystick on the left,
// drag anywhere else to turn the camera, contextual buttons on the right.

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
  taxi: ['KeyT'],
  advance: ['Space', 'Enter', 'KeyE'],
  camLeft: ['KeyQ'],
  camRight: ['KeyZ'],
};

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

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressedKeys.add(e.code);
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

  setTouch() {
    if (!this.touchMode) {
      this.touchMode = true;
      if (this.onTouchDetected) this.onTouchDetected();
    }
  }

  resetJoy() {
    this.joy.active = false;
    this.joy.id = null;
    this.joy.x = this.joy.y = 0;
    if (this.joyBase) this.joyBase.classList.remove('on');
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
    return this.keyHeld(name) || !!this.btnHeld[name];
  }
  pressed(name) {
    if (name === 'attack' && this.clickAttack) return true;
    return this.keyPressed(name) || !!this.btnPressed[name];
  }
  consume(name) {
    this.btnPressed[name] = false;
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
    return { x: 0, y: 0, mag: 0 };
  }

  endFrame() {
    this.pressedKeys.clear();
    this.btnPressed = {};
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.clickAttack = false;
  }
}
