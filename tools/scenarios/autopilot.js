// Injected into the page: drives missions automatically for testing.
window.__auto = {
  log: [],
  prefer: ['title deeds', 'Jackal crew, paid', 'bribed the taxi', 'press badge', 'Protection', 'Noma grew up', "I'll fix them", 'spray can', 'Molo, Cape Town', 'Homes for families', 'Ubuntu', "Sure, I'll help"],
  step() {
    const g = window.__game;
    const p = g.player;
    const hud = g.hud;
    // overlays
    if (hud.dlg) { hud.advanceDialogue(); hud.advanceDialogue(); return 'dlg'; }
    const ch = document.querySelector('#choices');
    if (!ch.classList.contains('hidden')) {
      const btns = [...ch.querySelectorAll('button')];
      let b = btns.find((x) => this.prefer.some((s) => x.textContent.includes(s)) && !x.classList.contains('disabled'));
      if (!b) b = btns.find((x) => !x.classList.contains('disabled'));
      this.log.push('choice: ' + b.textContent.slice(0, 60));
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return 'choice';
    }
    for (const id of ['#phone', '#memory']) {
      const el = document.querySelector(id);
      if (!el.classList.contains('hidden')) { el.dispatchEvent(new PointerEvent('pointerdown')); return id; }
    }
    const mg = document.querySelector('#minigame .tap');
    if (mg) { for (let i = 0; i < 3; i++) mg.dispatchEvent(new PointerEvent('pointerdown')); return 'tap'; }
    g.input.btnHeld.action = true;
    const m = g.missions.active;
    if (!m) return 'idle';
    const api = m.api;
    const ts = api.targets;
    if (!ts.length) return 'wait';
    // enemies first
    const enemy = ts.find((t) => t.entity && !t.entity.halfL && t.entity.state !== 'dead' && t.color === '#ff3b3b');
    if (enemy) { enemy.entity.knockOut('light'); return 'ko'; }
    const evehicle = ts.find((t) => t.entity && t.entity.halfL && t.color === '#ff3b3b');
    if (evehicle) {
      const v = evehicle.entity;
      v.damage(40, 'player');
      if (p.state === 'vehicle') { p.vehicle.x = v.x - 8; p.vehicle.z = v.z; } else p.place(v.x - 6, v.z);
      return 'ram';
    }
    const car = ts.find((t) => t.entity && t.entity.halfL && t.color === '#4fc3ff');
    if (car) {
      if (p.state === 'vehicle' && p.vehicle !== car.entity) p.exitVehicle(true);
      if (p.state !== 'vehicle') p.enterVehicle(car.entity);
      return 'enter';
    }
    const objText = document.querySelector('#objective').textContent;
    if (p.state === 'vehicle' && !/drive|taxi|vehicle|car|passenger|chase|ram|bakkie/i.test(objText)) { p.exitVehicle(true); return 'exit'; }
    const t = ts[ts.length - 1];
    const tx = t.entity ? t.entity.x : t.x, tz = t.entity ? t.entity.z : t.z;
    const d = Math.hypot(p.x - tx, p.z - tz);
    if (d < 1.2) return 'at';
    if (p.state === 'vehicle') {
      const v = p.vehicle;
      v.x = tx; v.z = tz; v.vx = v.vz = 0; p.x = tx; p.z = tz;
    } else {
      // keep vehicle requirement: if objective mentions vehicle and we have one nearby, fine
      const o = t.plateau ? { x: tx, z: tz } : (g.grid.findOpen(tx, tz, 6) || { x: tx, z: tz });
      p.place(o.x, o.z, p.heading, !!t.plateau);
    }
    return 'tp';
  },
};
