// Road graph built from the polylines in mapData. Handles crossings, lane maths
// (South Africa drives on the LEFT), traffic-light ("robot") groups and A* routing.

import { segmentIntersection, segmentDistance, dist } from '../core/util.js';

export class RoadGraph {
  constructor(defs) {
    this.nodes = [];
    this.edges = [];
    this.bucket = 64;
    this.buckets = new Map();
    this.build(defs);
  }

  build(defs) {
    // 1. Raw segments
    const segs = [];
    for (const d of defs) {
      for (let i = 0; i + 1 < d.pts.length; i++) {
        const [ax, az] = d.pts[i], [bx, bz] = d.pts[i + 1];
        if (Math.hypot(bx - ax, bz - az) < 0.5) continue;
        segs.push({ ax, az, bx, bz, def: d, cuts: [] });
      }
    }
    // 2. Find crossings and T-junctions
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      for (let j = i + 1; j < segs.length; j++) {
        const o = segs[j];
        if (Math.max(s.ax, s.bx) < Math.min(o.ax, o.bx) - 1 || Math.min(s.ax, s.bx) > Math.max(o.ax, o.bx) + 1) continue;
        if (Math.max(s.az, s.bz) < Math.min(o.az, o.bz) - 1 || Math.min(s.az, s.bz) > Math.max(o.az, o.bz) + 1) continue;
        const hit = segmentIntersection(s.ax, s.az, s.bx, s.bz, o.ax, o.az, o.bx, o.bz);
        if (hit) {
          s.cuts.push(hit.t);
          o.cuts.push(hit.u);
        }
      }
    }
    for (const s of segs) {
      for (const o of segs) {
        if (o === s) continue;
        for (const [px, pz] of [[o.ax, o.az], [o.bx, o.bz]]) {
          const r = segmentDistance(px, pz, s.ax, s.az, s.bx, s.bz);
          if (r.d < 0.75 && r.t > 0.001 && r.t < 0.999) s.cuts.push(r.t);
        }
      }
    }
    // 3. Emit sub-segments as edges between merged nodes
    const seen = new Map();
    for (const s of segs) {
      const ts = [0, ...s.cuts.sort((a, b) => a - b), 1];
      for (let k = 0; k + 1 < ts.length; k++) {
        if (ts[k + 1] - ts[k] < 1e-4) continue;
        const ax = s.ax + (s.bx - s.ax) * ts[k], az = s.az + (s.bz - s.az) * ts[k];
        const bx = s.ax + (s.bx - s.ax) * ts[k + 1], bz = s.az + (s.bz - s.az) * ts[k + 1];
        const a = this.nodeAt(ax, az), b = this.nodeAt(bx, bz);
        if (a === b) continue;
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        const existing = seen.get(key);
        if (existing) {
          if (s.def.width > existing.width) Object.assign(existing, edgeProps(s.def));
          continue;
        }
        const e = this.addEdge(a, b, s.def);
        seen.set(key, e);
      }
    }
    // 4. Per-node data
    for (const n of this.nodes) {
      const es = n.edges.map((id) => this.edges[id]);
      n.maxWidth = Math.max(...es.map((e) => e.width));
      n.maxSidewalk = Math.max(...es.map((e) => e.sidewalk));
      n.degree = es.length;
      n.junction = n.degree >= 3;
      n.clearance = n.junction ? n.maxWidth / 2 + 1 : 0;
      n.signal = n.junction && es.every((e) => e.traffic && e.width >= 10);
    }
    for (const e of this.edges) this.indexEdge(e);
  }

  nodeAt(x, z) {
    for (const n of this.nodes) if (Math.abs(n.x - x) < 1 && Math.abs(n.z - z) < 1) return n.id;
    const id = this.nodes.length;
    this.nodes.push({ id, x, z, edges: [] });
    return id;
  }

  addEdge(a, b, def) {
    const A = this.nodes[a], Bn = this.nodes[b];
    const len = Math.hypot(Bn.x - A.x, Bn.z - A.z);
    const e = {
      id: this.edges.length, a, b, len,
      dx: (Bn.x - A.x) / len, dz: (Bn.z - A.z) / len,
      ...edgeProps(def),
    };
    e.group = Math.abs(e.dz) >= Math.abs(e.dx) ? 'NS' : 'EW';
    this.edges.push(e);
    A.edges.push(e.id);
    Bn.edges.push(e.id);
    return e;
  }

  indexEdge(e) {
    const A = this.nodes[e.a], B = this.nodes[e.b];
    const pad = e.width / 2 + e.sidewalk + 2;
    const x0 = Math.floor((Math.min(A.x, B.x) - pad) / this.bucket), x1 = Math.floor((Math.max(A.x, B.x) + pad) / this.bucket);
    const z0 = Math.floor((Math.min(A.z, B.z) - pad) / this.bucket), z1 = Math.floor((Math.max(A.z, B.z) + pad) / this.bucket);
    for (let bx = x0; bx <= x1; bx++) for (let bz = z0; bz <= z1; bz++) {
      const k = bx * 10007 + bz;
      if (!this.buckets.has(k)) this.buckets.set(k, []);
      this.buckets.get(k).push(e.id);
    }
  }

  edgesNear(x, z, r = 0) {
    const out = new Set();
    const x0 = Math.floor((x - r) / this.bucket), x1 = Math.floor((x + r) / this.bucket);
    const z0 = Math.floor((z - r) / this.bucket), z1 = Math.floor((z + r) / this.bucket);
    for (let bx = x0; bx <= x1; bx++) for (let bz = z0; bz <= z1; bz++) {
      const list = this.buckets.get(bx * 10007 + bz);
      if (list) for (const id of list) out.add(id);
    }
    return [...out].map((id) => this.edges[id]);
  }

  nearestEdge(x, z, opts = {}) {
    let best = null;
    for (let r = 0; r <= 256 && !best; r += 64) {
      for (const e of this.edgesNear(x, z, r)) {
        if (opts.traffic && !e.traffic) continue;
        const A = this.nodes[e.a], B = this.nodes[e.b];
        const s = segmentDistance(x, z, A.x, A.z, B.x, B.z);
        if (!best || s.d < best.d) best = { edge: e, d: s.d, t: s.t, x: s.x, z: s.z };
      }
    }
    return best;
  }

  nearestNode(x, z, opts) {
    const ne = this.nearestEdge(x, z, opts);
    if (!ne) return this.nodes[0];
    const e = ne.edge;
    return ne.t < 0.5 ? this.nodes[e.a] : this.nodes[e.b];
  }

  /** True if (x,z) is on a road surface (not sidewalk). */
  onRoad(x, z) {
    for (const e of this.edgesNear(x, z)) {
      const A = this.nodes[e.a], B = this.nodes[e.b];
      if (segmentDistance(x, z, A.x, A.z, B.x, B.z).d < e.width / 2) return true;
    }
    return false;
  }

  other(e, nodeId) {
    return e.a === nodeId ? e.b : e.a;
  }

  /** Unit travel direction along e when leaving `fromNode`. */
  dirFrom(e, fromNode) {
    return e.a === fromNode ? [e.dx, e.dz] : [-e.dx, -e.dz];
  }

  /** Point on the left-hand lane at distance s from `fromNode`. */
  lanePoint(e, fromNode, s, laneOffset = null) {
    const n = this.nodes[fromNode];
    const [dx, dz] = this.dirFrom(e, fromNode);
    const off = laneOffset ?? laneOffsetFor(e);
    // left of travel direction (x east, z south): (dz, -dx)
    return { x: n.x + dx * s + dz * off, z: n.z + dz * s - dx * off, dx, dz };
  }

  sidewalkPoint(e, fromNode, s, side) {
    const n = this.nodes[fromNode];
    const [dx, dz] = this.dirFrom(e, fromNode);
    const off = (e.width / 2 + e.sidewalk / 2) * side;
    return { x: n.x + dx * s + dz * off, z: n.z + dz * s - dx * off };
  }

  /** A* over the node graph. Returns array of node ids or null. */
  path(fromId, toId, opts = {}) {
    if (fromId === toId) return [fromId];
    const nodes = this.nodes;
    const goal = nodes[toId];
    const g = new Map([[fromId, 0]]);
    const came = new Map();
    const open = [{ id: fromId, f: dist(nodes[fromId].x, nodes[fromId].z, goal.x, goal.z) }];
    const closed = new Set();
    let iter = 0;
    while (open.length && iter++ < 5000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur.id === toId) {
        const out = [toId];
        let c = toId;
        while (came.has(c)) { c = came.get(c); out.push(c); }
        return out.reverse();
      }
      if (closed.has(cur.id)) continue;
      closed.add(cur.id);
      for (const eid of nodes[cur.id].edges) {
        const e = this.edges[eid];
        if (opts.traffic && !e.traffic) continue;
        const nb = this.other(e, cur.id);
        if (closed.has(nb)) continue;
        const cost = g.get(cur.id) + e.len * (e.width >= 12 ? 0.85 : 1);
        if (cost < (g.get(nb) ?? Infinity)) {
          g.set(nb, cost);
          came.set(nb, cur.id);
          open.push({ id: nb, f: cost + dist(nodes[nb].x, nodes[nb].z, goal.x, goal.z) });
        }
      }
    }
    return null;
  }

  edgeBetween(a, b) {
    for (const id of this.nodes[a].edges) {
      const e = this.edges[id];
      if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) return e;
    }
    return null;
  }

  randomEdgeNear(x, z, rMin, rMax, opts = {}) {
    const cands = this.edgesNear(x, z, rMax).filter((e) => {
      if (opts.traffic && !e.traffic) return false;
      const A = this.nodes[e.a], B = this.nodes[e.b];
      const d = segmentDistance(x, z, A.x, A.z, B.x, B.z).d;
      return d < rMax && Math.max(dist(x, z, A.x, A.z), dist(x, z, B.x, B.z)) > rMin;
    });
    if (!cands.length) return null;
    let total = 0;
    for (const e of cands) total += e.len;
    let r = Math.random() * total;
    for (const e of cands) { r -= e.len; if (r <= 0) return e; }
    return cands[cands.length - 1];
  }
}

function edgeProps(def) {
  return {
    width: def.width,
    sidewalk: def.sidewalk,
    traffic: def.traffic,
    name: def.name,
    speed: def.width >= 14 ? 22 : def.width >= 12 ? 17 : def.width >= 10 ? 14 : 10,
  };
}

export function laneOffsetFor(e) {
  return e.width >= 14 ? e.width * 0.3 : e.width * 0.25;
}

// Global robot cycle: NS green, NS amber, all red, EW green, EW amber, all red.
const CYCLE = [
  { ns: 'G', ew: 'R', t: 10 },
  { ns: 'Y', ew: 'R', t: 2 },
  { ns: 'R', ew: 'R', t: 1.5 },
  { ns: 'R', ew: 'G', t: 10 },
  { ns: 'R', ew: 'Y', t: 2 },
  { ns: 'R', ew: 'R', t: 1.5 },
];
const CYCLE_LEN = CYCLE.reduce((s, c) => s + c.t, 0);

export class Signals {
  constructor() {
    this.time = 0;
    this.state = { ns: 'G', ew: 'R' };
  }
  update(dt) {
    this.time = (this.time + dt) % CYCLE_LEN;
    let t = this.time;
    for (const c of CYCLE) {
      if (t < c.t) { this.state = c; break; }
      t -= c.t;
    }
  }
  colorFor(group) {
    return group === 'NS' ? this.state.ns : this.state.ew;
  }
}
