// Context-sensitive "ACTION" points: talk to people, start missions, eat, work out...

import { dist } from '../core/util.js';

export class Interactions {
  constructor(game) {
    this.game = game;
    this.points = new Map();
    this.current = null;
  }

  add(id, def) {
    // def: {x, z, r, label, kind, enabled(), onUse(), plateau, priority}
    this.points.set(id, { r: 2.2, priority: 0, ...def, id });
    return id;
  }
  remove(id) {
    this.points.delete(id);
  }
  get(id) {
    return this.points.get(id);
  }

  update() {
    const g = this.game, p = g.player;
    this.current = null;
    if (p.state !== 'foot' || p.locked || p.anim || g.dialogueOpen || g.minigame) {
      g.hud.setAction(null);
      return;
    }
    let best = null, bs = Infinity;
    for (const it of this.points.values()) {
      if (!!it.plateau !== !!p.onPlateau) continue;
      const pos = typeof it.pos === 'function' ? it.pos() : it;
      if (!pos) continue;
      const d = dist(p.x, p.z, pos.x, pos.z);
      if (d > it.r) continue;
      if (it.enabled && !it.enabled()) continue;
      const s = d - it.priority * 10;
      if (s < bs) {
        bs = s;
        best = it;
      }
    }
    this.current = best;
    g.hud.setAction(best ? (typeof best.label === 'function' ? best.label() : best.label) : null);
    if (best && g.input.pressed('action')) {
      g.input.consume('action');
      g.audio.click();
      best.onUse();
    }
  }
}
