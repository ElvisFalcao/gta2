// Pause menu (missions, stats, notebook, settings, cheats, help) and the full-screen map.

import { buildMapCanvas } from './hud.js';
import { WORLD, PROTEAS } from '../world/mapData.js';
import { formatMoney, formatClock, clamp } from '../core/util.js';

const $ = (s) => document.querySelector(s);

export class Menu {
  constructor(game) {
    this.game = game;
    this.el = $('#menu');
    this.body = this.el.querySelector('.menu-body');
    this.tab = 'missions';
    this.isOpen = false;
    this.el.querySelectorAll('.menu-nav button').forEach((b) =>
      b.addEventListener('click', () => {
        this.game.audio.click();
        const t = b.dataset.tab;
        if (t === 'resume') return this.close();
        if (t === 'map') {
          this.close();
          return this.openMap();
        }
        this.show(t);
      }),
    );
    this.el.querySelector('.menu-close').addEventListener('click', () => this.close());
    // map
    this.mapEl = $('#mapview');
    this.mapCanvas = $('#bigmap');
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.mapZoom = 1;
    this.mapPan = { x: 0, z: 0 };
    this.mapEl.querySelectorAll('.map-btns button').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const z = b.dataset.z;
        if (z === 'in') this.mapZoom = clamp(this.mapZoom * 1.5, 1, 6);
        if (z === 'out') this.mapZoom = clamp(this.mapZoom / 1.5, 1, 6);
        if (z === 'clear') this.game.waypoint = null;
        if (z === 'close') this.closeMap();
        this.drawMap();
      }),
    );
    this.bindMapGestures();
  }

  open(tab = this.tab) {
    const g = this.game;
    if (!g.started || this.isOpen) return;
    this.isOpen = true;
    g.setPaused(true);
    this.el.classList.remove('hidden');
    this.show(tab);
  }

  close() {
    this.isOpen = false;
    this.el.classList.add('hidden');
    this.game.setPaused(false);
  }

  show(tab) {
    this.tab = tab;
    this.el.querySelectorAll('.menu-nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    const fn = this['tab_' + tab];
    this.body.innerHTML = '';
    if (fn) fn.call(this, this.body);
    this.body.scrollTop = 0;
  }

  tab_missions(el) {
    const g = this.game;
    const list = g.missions.storyStatus();
    el.innerHTML = `<h2>Story</h2><ul class="mission-list">${list
      .map((m) => {
        const st = m.done ? '✓' : m.available ? '▸' : '•';
        const cls = m.done ? 'done' : m.available ? 'open' : 'locked';
        const meta = m.done ? 'Complete' : m.available ? `${m.where}` : m.reason;
        return `<li class="${cls}"><span class="st">${st}</span><span><b>${m.title}</b><br><span class="muted">${m.done || m.available ? m.blurb : '???'}</span></span><span class="meta">${meta}</span></li>`;
      })
      .join('')}</ul>
      <h3>Free roam</h3>
      <p>• <b>Gym</b> — Sea Point outdoor gym: build muscle (hit harder) and earn respect.<br>
      • <b>Beaches</b> — Camps Bay &amp; Clifton: chill to heal and pass time.<br>
      • <b>Food</b> — Gatsby on Long St, fish &amp; chips at the Waterfront, shisa nyama in Langa.<br>
      • <b>Cableway</b> — ride up Table Mountain for the view (and maybe a protea).<br>
      • <b>Taxi jobs</b> — get into any minibus taxi and tap TAXI JOB.<br>
      • <b>Side jobs</b> — people with a blue <b>?</b> marker need help.<br>
      • <b>Proteas</b> — ${g.state.proteas.length}/${PROTEAS.length} hidden flowers found.</p>`;
  }

  tab_stats(el) {
    const g = this.game, s = g.state;
    const stat = (k, v, bar) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div>${bar !== undefined ? `<div class="bar resp" style="width:100%"><i style="transform:scaleX(${bar})"></i></div>` : ''}</div>`;
    el.innerHTML = `<h2>Sizwe</h2><div class="stat-grid">
      ${stat('Money', formatMoney(s.money))}
      ${stat('Respect', s.respect)}
      ${stat('Muscle', Math.round(s.stats.muscle) + '%', s.stats.muscle / 100)}
      ${stat('Stamina', Math.round(s.stats.stamina) + '%', s.stats.stamina / 100)}
      ${stat('Story missions', `${s.done.filter((d) => d.startsWith('m')).length}/${g.missions.story.length}`)}
      ${stat('Side jobs done', s.totals.sideQuests)}
      ${stat('Taxi fares', s.totals.fares)}
      ${stat('Gym sets', s.totals.gymSets)}
      ${stat('Proteas', `${s.proteas.length}/${PROTEAS.length}`)}
      ${stat('Day', `${g.env.day} · ${formatClock(g.env.hours)}`)}
      ${stat('Wasted', s.totals.wasted)}
      ${stat('Busted', s.totals.busted)}
    </div>`;
  }

  tab_notebook(el) {
    const s = this.game.state;
    if (!s.clues.length) {
      el.innerHTML = '<h2>Notebook</h2><p class="muted">Empty. Sizwe can\'t remember a thing… yet.</p>';
      return;
    }
    el.innerHTML = '<h2>Notebook</h2>' + s.clues.map((c) => `<div class="clue"><b>${c.title}</b>${c.text}</div>`).join('');
  }

  tab_settings(el) {
    const g = this.game, st = g.settings;
    el.innerHTML = `<h2>Settings</h2>
      <div class="setting"><span>Graphics quality<br><span class="muted">Changing this reloads the game (progress is saved)</span></span>
        <select id="set-q"><option value="low">Low (fastest)</option><option value="medium">Medium</option><option value="high">High (shadows)</option></select></div>
      <div class="setting"><span>Sound effects</span><input id="set-sfx" type="range" min="0" max="1" step="0.05"></div>
      <div class="setting"><span>Radio / music</span><input id="set-music" type="range" min="0" max="1" step="0.05"></div>
      <div class="setting"><span>Camera sensitivity</span><input id="set-sens" type="range" min="0.4" max="2" step="0.1"></div>
      <div class="setting"><span>Touch controls</span><select id="set-touch"><option value="auto">Auto</option><option value="on">Always on</option><option value="off">Off</option></select></div>
      <div class="btn-row"><button class="btn primary" id="set-save">Save game</button><button class="btn danger" id="set-reset">Delete save &amp; restart</button></div>
      <p class="muted" id="set-msg"></p>`;
    const q = el.querySelector('#set-q');
    q.value = st.quality;
    q.addEventListener('change', () => {
      st.quality = q.value;
      g.saveSettings();
      g.save();
      location.reload();
    });
    const sfx = el.querySelector('#set-sfx'), mus = el.querySelector('#set-music'), sens = el.querySelector('#set-sens'), tch = el.querySelector('#set-touch');
    sfx.value = st.sfx;
    mus.value = st.music;
    sens.value = st.sens;
    tch.value = st.touch;
    const apply = () => {
      st.sfx = +sfx.value;
      st.music = +mus.value;
      st.sens = +sens.value;
      st.touch = tch.value;
      g.applySettings();
      g.saveSettings();
    };
    [sfx, mus, sens].forEach((i) => i.addEventListener('input', apply));
    tch.addEventListener('change', apply);
    el.querySelector('#set-save').addEventListener('click', () => {
      const ok = g.save();
      el.querySelector('#set-msg').textContent = ok ? 'Saved.' : 'Could not save (storage blocked?).';
    });
    let armed = false;
    const reset = el.querySelector('#set-reset');
    reset.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        reset.textContent = 'Tap again to delete everything';
        return;
      }
      g.resetSave();
    });
  }

  tab_cheats(el) {
    el.innerHTML = `<h2>Cheats</h2><p class="muted">Every GTA needs cheat codes. Type one and press Enter.</p>
      <div class="cheat-input"><input id="cheat" placeholder="e.g. LEKKER" maxlength="20" autocomplete="off" autocapitalize="characters"><button class="btn primary" id="cheat-go">Go</button></div>
      <p id="cheat-msg" class="muted"></p>
      <h3>Known codes</h3>
      <p><b>LEKKER</b> +50 respect · <b>MOOLAH</b> +R5 000 · <b>EISH</b> clear wanted level · <b>BAKKIE</b> spawn a bakkie · <b>TAXI</b> spawn a minibus taxi · <b>VROOM</b> spawn a sports car · <b>SUPERSIZWE</b> god mode · <b>NOPOLICE</b> police ignore you · <b>DAY</b> / <b>NIGHT</b> change time · <b>GYMRAT</b> max muscle · <b>SKIPMISSION</b> pass current mission</p>`;
    const inp = el.querySelector('#cheat');
    const go = () => {
      const msg = this.game.cheat(inp.value.trim().toUpperCase());
      el.querySelector('#cheat-msg').textContent = msg;
      inp.value = '';
    };
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') go();
    });
    el.querySelector('#cheat-go').addEventListener('click', go);
    setTimeout(() => inp.focus(), 50);
  }

  tab_help(el) {
    el.innerHTML = `<h2>Controls</h2>
      <h3>Touch</h3><table class="kbd-table">
      <tr><td>Left side drag</td><td>Walk / run · steer &amp; accelerate in cars (push up = gas, down = brake/reverse)</td></tr>
      <tr><td>Right side drag</td><td>Look around</td></tr>
      <tr><td>PUNCH</td><td>Tap repeatedly for a 3-hit combo (auto-aims at enemies)</td></tr>
      <tr><td>RUN</td><td>Hold to sprint (uses stamina)</td></tr>
      <tr><td>CAR / EXIT</td><td>Get in or out of the nearest vehicle</td></tr>
      <tr><td>ACTION</td><td>Talk, start missions, eat, work out, chill…</td></tr>
      <tr><td>Minimap</td><td>Tap it to open the full map and set a waypoint</td></tr></table>
      <h3>Keyboard &amp; mouse</h3><table class="kbd-table">
      <tr><td>W A S D / arrows</td><td>Move · drive</td></tr>
      <tr><td>Mouse drag · Q / Z</td><td>Camera</td></tr>
      <tr><td>Shift</td><td>Sprint</td></tr>
      <tr><td>Space</td><td>Jump · handbrake</td></tr>
      <tr><td>J / K / click</td><td>Punch</td></tr>
      <tr><td>F / Enter</td><td>Enter / exit vehicle</td></tr>
      <tr><td>E</td><td>Action / talk / advance dialogue</td></tr>
      <tr><td>H · R · T</td><td>Horn · radio · taxi job</td></tr>
      <tr><td>M · Esc</td><td>Map · pause</td></tr></table>
      <h3>Tips</h3><p>Respect unlocks new story missions — earn it from missions, side jobs, the gym, taxi fares and proteas. If the police are after you, break line of sight and lie low until the stars fade. Lekker!</p>`;
  }

  // ---------------------------------------------------------------- big map
  openMap() {
    const g = this.game;
    if (!g.started) return;
    if (!this.mapImg) this.mapImg = buildMapCanvas(g.grid);
    g.setPaused(true);
    this.mapOpen = true;
    this.mapEl.classList.remove('hidden');
    this.mapPan = { x: g.player.x, z: g.player.z };
    this.mapZoom = 1.5;
    const legend = this.mapEl.querySelector('.map-legend');
    legend.innerHTML = [
      ['#ffd400', 'S', 'Story mission'], ['#4fc3ff', '?', 'Side job'], ['#7be37b', 'G', 'Gym / beach / cableway'],
      ['#ff9f43', 'F', 'Food'], ['#ff6bd6', 'H', 'Safehouse'], ['#c85aff', 'W', 'Waypoint'], ['#ff4040', '!', 'Target'],
    ].map(([c, l, t]) => `<div><i style="background:${c}">${l}</i>${t}</div>`).join('');
    this.resizeMap();
    this.drawMap();
  }

  closeMap() {
    this.mapOpen = false;
    this.mapEl.classList.add('hidden');
    this.game.setPaused(false);
  }

  resizeMap() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.mapCanvas.width = Math.round(window.innerWidth * dpr);
    this.mapCanvas.height = Math.round(window.innerHeight * dpr);
    this.mapDpr = dpr;
  }

  mapView() {
    const W = this.mapCanvas.width, H = this.mapCanvas.height;
    const worldW = WORLD.maxX - WORLD.minX, worldH = WORLD.maxZ - WORLD.minZ;
    const base = Math.min(W / worldW, H / worldH);
    const s = base * this.mapZoom;
    return { W, H, s, ox: W / 2 - this.mapPan.x * s, oz: H / 2 - this.mapPan.z * s };
  }

  drawMap() {
    if (!this.mapOpen) return;
    const g = this.game, ctx = this.mapCtx;
    const { W, H, s, ox, oz } = this.mapView();
    ctx.fillStyle = '#0b2233';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = this.mapZoom < 3;
    ctx.drawImage(this.mapImg, ox + WORLD.minX * s, oz + WORLD.minZ * s, g.grid.w * g.grid.cell * s, g.grid.h * g.grid.cell * s);
    const k = this.mapDpr;
    // labels for districts
    ctx.font = `${16 * k}px "Bebas Neue", Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const labels = [['CAMPS BAY', -520, 300], ['SEA POINT', -470, -180], ['GREEN POINT', -260, -390], ['BO-KAAP', -170, -190], ['CITY CENTRE', 110, -250], ['V&A WATERFRONT', 140, -440], ['WOODSTOCK', 410, -230], ['GARDENS', 0, 60], ['OBSERVATORY', 400, 60], ['LANGA', 660, 60], ['TABLE MOUNTAIN', -20, 430], ["LION'S HEAD", -430, 80], ['SIGNAL HILL', -350, -170], ['CLIFTON', -560, 80], ["DEVIL'S PEAK", 330, 390], ['TABLE BAY', 300, -560], ['ATLANTIC OCEAN', -720, 100]];
    for (const [t, x, z] of labels) {
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3 * k;
      ctx.strokeText(t, ox + x * s, oz + z * s);
      ctx.fillText(t, ox + x * s, oz + z * s);
    }
    const route = g.gps.route;
    if (route && route.length > 1) {
      ctx.strokeStyle = 'rgba(200, 90, 255, 0.95)';
      ctx.lineWidth = 4 * k;
      ctx.beginPath();
      ctx.moveTo(ox + route[0].x * s, oz + route[0].z * s);
      for (const p of route) ctx.lineTo(ox + p.x * s, oz + p.z * s);
      ctx.stroke();
    }
    for (const b of g.collectBlips(true)) g.hud.drawBlip(ctx, ox + b.x * s, oz + b.z * s, { ...b, size: (b.size || 7) * 1.25 }, false, k);
    // player
    const p = g.player;
    const h = p.vehicle ? p.vehicle.heading : p.heading;
    ctx.save();
    ctx.translate(ox + p.x * s, oz + p.z * s);
    ctx.rotate(Math.atan2(Math.cos(h), Math.sin(h)));
    ctx.beginPath();
    ctx.moveTo(12 * k, 0);
    ctx.lineTo(-8 * k, 8 * k);
    ctx.lineTo(-4 * k, 0);
    ctx.lineTo(-8 * k, -8 * k);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2 * k;
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  bindMapGestures() {
    const c = this.mapCanvas;
    const pts = new Map();
    let moved = false, startDist = 0, startZoom = 1;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
      moved = false;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        startDist = Math.hypot(a.x - b.x, a.y - b.y);
        startZoom = this.mapZoom;
      }
    });
    c.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 6) moved = true;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.mapZoom = clamp(startZoom * (d / Math.max(1, startDist)), 1, 6);
      } else if (moved) {
        const { s } = this.mapView();
        this.mapPan.x -= (dx * this.mapDpr) / s;
        this.mapPan.z -= (dy * this.mapDpr) / s;
      }
      this.drawMap();
    });
    const up = (e) => {
      const p = pts.get(e.pointerId);
      pts.delete(e.pointerId);
      if (p && !moved && pts.size === 0) {
        const { s, ox, oz } = this.mapView();
        const x = (e.clientX * this.mapDpr - ox) / s, z = (e.clientY * this.mapDpr - oz) / s;
        const n = this.game.roads.nearestEdge(x, z);
        this.game.waypoint = n && n.d < 40 ? { x: n.x, z: n.z } : { x, z };
        this.game.audio.click();
        this.drawMap();
      }
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', (e) => pts.delete(e.pointerId));
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.mapZoom = clamp(this.mapZoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, 6);
      this.drawMap();
    }, { passive: false });
    window.addEventListener('resize', () => {
      if (this.mapOpen) {
        this.resizeMap();
        this.drawMap();
      }
    });
  }
}
