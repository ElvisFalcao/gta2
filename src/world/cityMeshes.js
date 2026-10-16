// Turns the generated city data into a handful of efficient Three.js meshes.

import * as THREE from 'three';
import { WORLD, LAND, WATER_HOLES, MOUNTAINS } from './mapData.js';
import { T, mountainHeight } from './grid.js';
import { MeshKit, GEO, vcMaterial } from '../core/meshkit.js';
import { RNG, clamp, lerp, valueNoise, smoothstep } from '../core/util.js';
import {
  makeFacade, makeRoadTexture, makeAsphaltTexture, makeZebraTexture, makeSidewalkTexture,
  makeGlowTexture, makeWaterTexture,
} from './textures.js';

const C = (hex) => new THREE.Color(hex);

export class CityMeshes {
  constructor(scene, grid, roads, city, quality) {
    this.scene = scene;
    this.grid = grid;
    this.roads = roads;
    this.city = city;
    this.quality = quality;
    this.root = new THREE.Group();
    this.root.name = 'city';
    scene.add(this.root);
    this.animated = [];
    this.wallMats = [];
  }

  buildAll() {
    this.buildGround();
    this.buildOcean();
    this.buildRoads();
    this.buildBuildings();
    this.buildTrees();
    this.buildLamps();
    this.buildSignals();
    this.buildMountains();
  }

  add(mesh, { cast = false, receive = true } = {}) {
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.root.add(mesh);
    return mesh;
  }

  // ------------------------------------------------------------------ ground
  buildGround() {
    const g = this.grid;
    const PX = 2;
    const cv = document.createElement('canvas');
    cv.width = g.w * PX;
    cv.height = g.h * PX;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(cv.width, cv.height);
    const d = img.data;
    const rng = new RNG(99);
    const cache = new Map();
    const rgb = (hex) => {
      if (!cache.has(hex)) {
        const n = parseInt(hex.slice(1), 16);
        cache.set(hex, [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
      }
      return cache.get(hex);
    };
    const landColor = (did) => {
      switch (did) {
        case 'cbd': case 'longst': case 'woodstock': case 'waterfront': return '#b9b3a4';
        case 'bokaap': return '#bdb2a0';
        case 'gardens': case 'observatory': return '#8fa362';
        case 'langa': return '#b49b73';
        case 'campsbay': case 'clifton': case 'seapoint': case 'greenpoint': return '#a2aa76';
        default: return '#7f8e55';
      }
    };
    for (let iz = 0; iz < g.h; iz++) {
      for (let ix = 0; ix < g.w; ix++) {
        const i = iz * g.w + ix;
        const t = g.type[i];
        let col;
        switch (t) {
          case T.WATER: col = '#2b6d8f'; break;
          case T.SAND: {
            const wet = g.isWater(g.cx(ix) - 3, g.cz(iz)) || g.isWater(g.cx(ix) + 3, g.cz(iz)) || g.isWater(g.cx(ix), g.cz(iz) - 3) || g.isWater(g.cx(ix), g.cz(iz) + 3);
            col = wet ? '#d9c792' : '#ecdfb4';
            break;
          }
          case T.PARK: col = '#6c9f48'; break;
          case T.PLAZA: col = (ix + iz) % 2 ? '#cfc6b3' : '#c8bfac'; break;
          case T.WALK: col = '#c4beb2'; break;
          case T.ROAD: col = '#45484c'; break;
          case T.BUILDING: case T.PROP: col = '#9a948a'; break;
          case T.ROCK: col = '#66733f'; break;
          default: {
            const dd = g.district(g.cx(ix), g.cz(iz));
            col = g.height[i] > 0 ? '#6f7d4b' : landColor(dd ? dd.id : null);
          }
        }
        const [r, gg, b] = rgb(col);
        for (let py = 0; py < PX; py++) {
          for (let px = 0; px < PX; px++) {
            const k = ((iz * PX + py) * cv.width + ix * PX + px) * 4;
            const n = t === T.ROAD || t === T.WALK ? 1 : 0.93 + rng.next() * 0.12;
            d[k] = clamp(r * n, 0, 255);
            d[k + 1] = clamp(gg * n, 0, 255);
            d[k + 2] = clamp(b * n, 0, 255);
            d[k + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    this.groundCanvas = cv;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const shape = new THREE.Shape(LAND.map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const h of WATER_HOLES) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
    const geo = new THREE.ShapeGeometry(shape);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = -pos.getY(i);
      uv.setXY(i, (x - g.minX) / (g.w * g.cell), 1 - (z - g.minZ) / (g.h * g.cell));
    }
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
    mesh.name = 'ground';
    this.add(mesh, { receive: true });

    // far land beyond the playable map (Cape Flats, back of the mountain)
    const far = new MeshKit();
    const fl = '#8d935f';
    far.quad([700, -0.05, 4000], [4000, -0.05, 4000], [4000, -0.05, -320], [700, -0.05, -320], fl);
    far.quad([-600, -0.05, 4000], [700, -0.05, 4000], [700, -0.05, 650], [-600, -0.05, 650], fl);
    this.add(new THREE.Mesh(far.build(), vcMaterial()));
  }

  // ------------------------------------------------------------------ ocean
  buildOcean() {
    const tex = makeWaterTexture();
    tex.repeat.set(600, 600);
    const mat = new THREE.MeshPhongMaterial({ color: '#2a7fb0', specular: '#bfe6ff', shininess: 80, map: tex });
    const geo = new THREE.PlaneGeometry(9000, 9000);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = -0.35;
    mesh.name = 'ocean';
    this.add(mesh, { receive: false });
    this.oceanTex = tex;
    this.oceanMat = mat;
  }

  // ------------------------------------------------------------------ roads
  buildRoads() {
    const { roads } = this;
    const roadKit = new MeshKit({ uv: true });
    const discKit = new MeshKit({ uv: true });
    const walkKit = new MeshKit({ uv: true });
    const curbKit = new MeshKit();
    const SW_H = 0.12;

    for (const e of roads.edges) {
      const A = roads.nodes[e.a], B = roads.nodes[e.b];
      const lx = e.dz, lz = -e.dx; // left of a->b
      const hw = e.width / 2;
      const tA = A.junction ? A.maxWidth / 2 : 0, tB = B.junction ? B.maxWidth / 2 : 0;
      const y = 0.02 + (e.id % 5) * 0.003;
      const sx = A.x + e.dx * tA, sz = A.z + e.dz * tA, ex = B.x - e.dx * tB, ez = B.z - e.dz * tB;
      const len = Math.max(0.01, e.len - tA - tB);
      const v1 = len / 32;
      roadKit.quad(
        [sx - lx * hw, y, sz - lz * hw], [ex - lx * hw, y, ez - lz * hw], [ex + lx * hw, y, ez + lz * hw], [sx + lx * hw, y, sz + lz * hw],
        '#ffffff', [[1, 0], [1, v1], [0, v1], [0, 0]],
      );
      // sidewalks both sides
      for (const side of [1, -1]) {
        const trimA = this.sidewalkTrim(e, A, side), trimB = this.sidewalkTrim(e, B, side);
        const s0 = trimA, s1 = e.len - trimB;
        if (s1 - s0 < 0.5) continue;
        const i0 = hw, o0 = hw + e.sidewalk;
        const P = (s, off, yy) => [A.x + e.dx * s + lx * off * side, yy, A.z + e.dz * s + lz * off * side];
        const pIn0 = P(s0, i0, SW_H), pIn1 = P(s1, i0, SW_H), pOut1 = P(s1, o0, SW_H), pOut0 = P(s0, o0, SW_H);
        const uvw = (p) => [p[0] / 4, p[2] / 4];
        if (side === 1) walkKit.quad(pIn0, pIn1, pOut1, pOut0, '#ffffff', [uvw(pIn0), uvw(pIn1), uvw(pOut1), uvw(pOut0)]);
        else walkKit.quad(pIn0, pOut0, pOut1, pIn1, '#ffffff', [uvw(pIn0), uvw(pOut0), uvw(pOut1), uvw(pIn1)]);
        // curb face (towards the road)
        const c0 = P(s0, i0, 0), c1 = P(s1, i0, 0);
        if (side === 1) curbKit.quad(c0, c1, pIn1, pIn0, '#9d978b');
        else curbKit.quad(c1, c0, pIn0, pIn1, '#9d978b');
      }
    }
    for (const n of roads.nodes) {
      if (n.degree < 2) continue;
      const y = n.junction ? 0.045 : 0.04;
      let ring = [];
      if (n.junction) {
        // exact junction polygon from the trimmed road ends
        const r0 = n.maxWidth / 2;
        for (const id of n.edges) {
          const e = roads.edges[id];
          const [dx, dz] = roads.dirFrom(e, n.id);
          const hw = e.width / 2;
          const cx = n.x + dx * r0, cz = n.z + dz * r0;
          ring.push([cx + dz * hw, cz - dx * hw], [cx - dz * hw, cz + dx * hw]);
        }
        ring.sort((a, b) => Math.atan2(a[1] - n.z, a[0] - n.x) - Math.atan2(b[1] - n.z, b[0] - n.x));
      } else {
        const [e1, e2] = n.edges.map((id) => roads.edges[id]);
        const d1 = roads.dirFrom(e1, n.id), d2 = roads.dirFrom(e2, n.id);
        const cos = -(d1[0] * d2[0] + d1[1] * d2[1]);
        const half = Math.acos(clamp(cos, -1, 1)) / 2;
        const r = n.maxWidth / 2 / Math.max(0.5, Math.cos(half));
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          ring.push([n.x + Math.cos(a) * r, n.z + Math.sin(a) * r]);
        }
      }
      for (let k = 0; k < ring.length; k++) {
        const p = ring[k], q = ring[(k + 1) % ring.length];
        discKit.tri([n.x, y, n.z], [q[0], y, q[1]], [p[0], y, p[1]], '#ffffff');
        const L = discKit.uv.length;
        discKit.uv.splice(L - 6, 6, n.x / 8, n.z / 8, q[0] / 8, q[1] / 8, p[0] / 8, p[1] / 8);
      }
    }
    const roadTex = makeRoadTexture();
    const asphalt = makeAsphaltTexture();
    const walkTex = makeSidewalkTexture();
    const roadMesh = new THREE.Mesh(roadKit.build(), new THREE.MeshLambertMaterial({ map: roadTex }));
    const discMesh = new THREE.Mesh(discKit.build(), new THREE.MeshLambertMaterial({ map: asphalt, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    const walkMesh = new THREE.Mesh(walkKit.build(), new THREE.MeshLambertMaterial({ map: walkTex }));
    const curbMesh = new THREE.Mesh(curbKit.build(), vcMaterial());
    roadMesh.name = 'roads';
    for (const m of [roadMesh, discMesh, walkMesh, curbMesh]) this.add(m);

    // zebra crossings at robots
    const zk = new MeshKit({ uv: true });
    for (const c of this.city.crosswalks) {
      const fx = Math.sin(c.ry), fz = Math.cos(c.ry); // along road
      const lx = fz, lz = -fx;
      const hw = c.width / 2, hd = 1.6, y = 0.06;
      zk.quad(
        [c.x - lx * hw - fx * hd, y, c.z - lz * hw - fz * hd], [c.x - lx * hw + fx * hd, y, c.z - lz * hw + fz * hd],
        [c.x + lx * hw + fx * hd, y, c.z + lz * hw + fz * hd], [c.x + lx * hw - fx * hd, y, c.z + lz * hw - fz * hd],
        '#ffffff', [[0, 0], [0, 1], [c.width / 8, 1], [c.width / 8, 0]],
      );
    }
    if (!zk.empty) {
      const zmesh = new THREE.Mesh(zk.build(), new THREE.MeshLambertMaterial({ map: makeZebraTexture(), transparent: true, depthWrite: false }));
      this.add(zmesh);
    }
  }

  sidewalkTrim(e, node, side) {
    if (node.junction) return node.maxWidth / 2 + node.maxSidewalk;
    if (node.degree !== 2) return 0;
    const { roads } = this;
    const other = roads.edges[node.edges[0] === e.id ? node.edges[1] : node.edges[0]];
    const tIn = roads.dirFrom(e, node.id).map((v) => -v);
    const tOut = roads.dirFrom(other, node.id);
    const dot = clamp(tIn[0] * tOut[0] + tIn[1] * tOut[1], -1, 1);
    const theta = Math.acos(dot);
    if (theta < 0.02) return 0;
    const cross = tIn[0] * tOut[1] - tIn[1] * tOut[0];
    const turnRight = cross > 0;
    const travelSide = node.id === e.b ? side : -side; // +1 = left of travel
    const inner = turnRight ? travelSide === -1 : travelSide === 1;
    const k = Math.min(14, (e.width / 2 + e.sidewalk) * Math.tan(theta / 2));
    return inner ? k : -k;
  }

  // ------------------------------------------------------------------ buildings
  buildBuildings() {
    const kits = {};
    const roofKit = new MeshKit();
    const rng = new RNG(4242);
    for (const b of this.city.buildings) {
      const kit = (kits[b.wall] ||= new MeshKit({ uv: true }));
      const spec = FACADE_SPEC[b.wall];
      const { x0, z0, x1, z1, h } = b;
      const L = x1 - x0, D = z1 - z0;
      const uL = L / (2 * spec.bay), uD = D / (2 * spec.bay), v = h / (2 * spec.floor);
      const u0 = b.uOff * 0.5;
      const col = b.color;
      kit.quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], col, [[u0, 0], [u0 + uL, 0], [u0 + uL, v], [u0, v]]);
      kit.quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], col, [[u0 + 0.5, 0], [u0 + 0.5 + uL, 0], [u0 + 0.5 + uL, v], [u0 + 0.5, v]]);
      kit.quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], col, [[u0, 0], [u0 + uD, 0], [u0 + uD, v], [u0, v]]);
      kit.quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], col, [[u0 + 0.5, 0], [u0 + 0.5 + uD, 0], [u0 + 0.5 + uD, v], [u0 + 0.5, v]]);
      this.addRoof(roofKit, b, rng);
    }
    for (const [style, kit] of Object.entries(kits)) {
      const fac = makeFacade(style, 7);
      const mat = new THREE.MeshLambertMaterial({
        map: fac.map, vertexColors: true, emissiveMap: fac.emissive, emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0,
      });
      this.wallMats.push(mat);
      const mesh = new THREE.Mesh(kit.build(), mat);
      mesh.name = 'walls_' + style;
      this.add(mesh, { cast: true, receive: true });
    }
    const roofs = new THREE.Mesh(roofKit.build(), vcMaterial());
    roofs.name = 'roofs';
    this.add(roofs, { cast: true, receive: true });
  }

  addRoof(k, b, rng) {
    const { x0, z0, x1, z1, h } = b;
    const L = x1 - x0, D = z1 - z0;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (b.roof === 'gable') {
      const r = Math.min(Math.min(L, D) * 0.32, 3.2);
      const o = 0.35;
      if (L >= D) {
        const zm = cz;
        k.quad([x1 + o, h, z0 - o], [x0 - o, h, z0 - o], [x0 - o, h + r, zm], [x1 + o, h + r, zm], b.roofColor);
        k.quad([x0 - o, h, z1 + o], [x1 + o, h, z1 + o], [x1 + o, h + r, zm], [x0 - o, h + r, zm], b.roofColor);
        k.tri([x0, h, z0], [x0, h, z1], [x0, h + r, zm], b.color);
        k.tri([x1, h, z1], [x1, h, z0], [x1, h + r, zm], b.color);
      } else {
        const xm = cx;
        k.quad([x0 - o, h, z0 - o], [x0 - o, h, z1 + o], [xm, h + r, z1 + o], [xm, h + r, z0 - o], b.roofColor);
        k.quad([x1 + o, h, z1 + o], [x1 + o, h, z0 - o], [xm, h + r, z0 - o], [xm, h + r, z1 + o], b.roofColor);
        k.tri([x1, h, z0], [x0, h, z0], [xm, h + r, z0], b.color);
        k.tri([x0, h, z1], [x1, h, z1], [xm, h + r, z1], b.color);
      }
      if (rng.chance(0.3)) k.block(x0 + L * 0.25, h, cz, 0.7, r + 1.2, 0.7, '#7a6f66'); // chimney
      return;
    }
    if (b.roof === 'slab') {
      k.block(cx, h, cz, L + 0.6, 0.22, D + 0.6, b.roofColor);
      return;
    }
    // flat roof with parapet
    k.quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], b.roofColor);
    const p = 0.7, t = 0.35;
    if (b.wall !== 'township') {
      k.block(cx, h, z0 + t / 2, L, p, t, b.color);
      k.block(cx, h, z1 - t / 2, L, p, t, b.color);
      k.block(x0 + t / 2, h, cz, t, p, D - 2 * t, b.color);
      k.block(x1 - t / 2, h, cz, t, p, D - 2 * t, b.color);
    }
    if ((b.wall === 'office' || b.wall === 'apartment') && L > 8 && D > 8) {
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i++) {
        k.block(lerp(x0 + 3, x1 - 3, rng.next()), h, lerp(z0 + 3, z1 - 3, rng.next()), rng.range(1.5, 3), rng.range(1, 2), rng.range(1.5, 3), '#b3b3ad');
      }
      if (b.h > 40 && rng.chance(0.5)) k.block(cx, h, cz, L * 0.5, 4, D * 0.5, b.color);
      if (b.h > 50 && rng.chance(0.6)) k.cyl(cx, h + (b.h > 40 ? 4 : 0), cz, 0.15, 8, '#dddddd', 8);
    }
    if (b.style === 'bokaap' && rng.chance(0.25)) k.block(cx, h, cz, 1.6, 1.2, 1.6, '#e8e8e8'); // water tank
  }

  // ------------------------------------------------------------------ trees
  buildTrees() {
    const T_ = this.city.trees;
    const dummy = new THREE.Object3D();
    const trunkMat = new THREE.MeshLambertMaterial({ color: '#6b4f36' });
    const leafMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    const rng = new RNG(31);
    const make = (list, trunkGeo, crownGeo, trunkH, crownY, crownScale, palette) => {
      if (!list.length) return;
      const tm = new THREE.InstancedMesh(trunkGeo, trunkMat, list.length);
      const cm = new THREE.InstancedMesh(crownGeo, leafMat, list.length);
      list.forEach((t, i) => {
        dummy.position.set(t.x, 0, t.z);
        dummy.rotation.set(0, t.r, 0);
        dummy.scale.setScalar(t.s);
        dummy.updateMatrix();
        tm.setMatrixAt(i, dummy.matrix);
        cm.setMatrixAt(i, dummy.matrix);
        cm.setColorAt(i, C(rng.pick(palette)));
      });
      tm.castShadow = cm.castShadow = true;
      cm.receiveShadow = true;
      this.root.add(tm, cm);
    };
    const trunk = (h, r) => {
      const g = new THREE.CylinderGeometry(r * 0.75, r, h, 6);
      g.translate(0, h / 2, 0);
      return g;
    };
    const oakCrown = new THREE.IcosahedronGeometry(2.6, 1);
    oakCrown.scale(1, 0.85, 1);
    oakCrown.translate(0, 4.2, 0);
    make(T_.oak, trunk(3, 0.3), oakCrown, 3, 4.2, 1, ['#4f7d34', '#5b8a3c', '#467030', '#6a9444']);
    const pineCrown = new THREE.IcosahedronGeometry(3.4, 1);
    pineCrown.scale(1, 0.4, 1);
    pineCrown.translate(0, 6.2, 0);
    make(T_.pine, trunk(6, 0.32), pineCrown, 6, 6.2, 1, ['#3e6b38', '#365f33', '#46773e']);
    // palms: drooping fronds
    const pk = new MeshKit();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      pk.add(GEO.box, { x: Math.sin(a) * 1.4, y: 7.6, z: Math.cos(a) * 1.4, sx: 0.5, sy: 0.08, sz: 3.2, ry: a, rx: 0.42, color: '#ffffff' });
    }
    pk.add(GEO.ico, { x: 0, y: 7.8, z: 0, sx: 0.9, sy: 0.7, sz: 0.9, color: '#9c8a55' });
    const palmTrunk = new THREE.CylinderGeometry(0.18, 0.28, 7.8, 6);
    palmTrunk.translate(0, 3.9, 0);
    make(T_.palm, palmTrunk, pk.build(), 7.8, 7.6, 1, ['#4c8a3a', '#5a9a40', '#3f7a33']);
    // fynbos bushes (no trunk)
    if (T_.bush.length) {
      const bush = new THREE.IcosahedronGeometry(1, 0);
      bush.scale(1, 0.65, 1);
      bush.translate(0, 0.45, 0);
      const bm = new THREE.InstancedMesh(bush, leafMat, T_.bush.length);
      T_.bush.forEach((t, i) => {
        dummy.position.set(t.x, 0, t.z);
        dummy.rotation.set(0, t.r, 0);
        dummy.scale.setScalar(t.s);
        dummy.updateMatrix();
        bm.setMatrixAt(i, dummy.matrix);
        bm.setColorAt(i, C(rng.pick(['#5d6b3a', '#6f7a41', '#7d7a46', '#566b3f', '#8a6f5a', '#b86b7b'])));
      });
      bm.receiveShadow = true;
      this.root.add(bm);
    }
  }

  // ------------------------------------------------------------------ lamps
  buildLamps() {
    const L = this.city.lamps;
    if (!L.length) return;
    const pk = new MeshKit();
    pk.cyl(0, 0, 0, 0.09, 6.2, '#4a4f55', 8);
    pk.box(0, 6.15, 0.7, 0.08, 0.08, 1.5, '#4a4f55');
    const poles = new THREE.InstancedMesh(pk.build(), vcMaterial(), L.length);
    const headGeo = new THREE.BoxGeometry(0.5, 0.16, 0.34);
    headGeo.translate(0, 6.08, 1.45);
    this.lampHeadMat = new THREE.MeshBasicMaterial({ color: '#d8d8d0' });
    const heads = new THREE.InstancedMesh(headGeo, this.lampHeadMat, L.length);
    const poolGeo = new THREE.PlaneGeometry(9, 9);
    poolGeo.rotateX(-Math.PI / 2);
    poolGeo.translate(0, 0.16, 1.45);
    this.poolMat = new THREE.MeshBasicMaterial({ map: makeGlowTexture(), color: '#ffcf80', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const pools = new THREE.InstancedMesh(poolGeo, this.poolMat, L.length);
    const dummy = new THREE.Object3D();
    L.forEach((l, i) => {
      dummy.position.set(l.x, 0, l.z);
      dummy.rotation.set(0, l.ry, 0);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);
      heads.setMatrixAt(i, dummy.matrix);
      pools.setMatrixAt(i, dummy.matrix);
    });
    poles.castShadow = true;
    pools.renderOrder = 2;
    this.lampPools = pools;
    this.root.add(poles, heads, pools);
  }

  // ------------------------------------------------------------------ robots
  buildSignals() {
    const S = this.city.signals;
    if (!S.length) return;
    const hk = new MeshKit();
    hk.cyl(0, 0, 0, 0.1, 3.3, '#2f3337', 8);
    hk.box(0, 2.75, 0, 0.42, 1.15, 0.32, '#1f2226');
    const housings = new THREE.InstancedMesh(hk.build(), vcMaterial(), S.length);
    const dummy = new THREE.Object3D();
    S.forEach((s, i) => {
      dummy.position.set(s.x, 0, s.z);
      dummy.rotation.set(0, s.ry, 0);
      dummy.updateMatrix();
      housings.setMatrixAt(i, dummy.matrix);
    });
    this.root.add(housings);
    this.bulbMats = {};
    const bulbGeo = new THREE.BoxGeometry(0.24, 0.24, 0.06);
    const ys = { R: 3.12, Y: 2.76, G: 2.4 };
    for (const group of ['NS', 'EW']) {
      const list = S.filter((s) => s.group === group);
      for (const c of ['R', 'Y', 'G']) {
        const mat = new THREE.MeshBasicMaterial({ color: '#222' });
        this.bulbMats[group + c] = mat;
        if (!list.length) continue;
        const g = bulbGeo.clone();
        g.translate(0, ys[c], 0.17);
        const im = new THREE.InstancedMesh(g, mat, list.length);
        list.forEach((s, i) => {
          dummy.position.set(s.x, 0, s.z);
          dummy.rotation.set(0, s.ry, 0);
          dummy.updateMatrix();
          im.setMatrixAt(i, dummy.matrix);
        });
        this.root.add(im);
      }
    }
  }

  // ------------------------------------------------------------------ mountains
  buildMountains() {
    const kit = new MeshKit();
    for (const m of MOUNTAINS) this.addMountain(kit, m);
    const geo = kit.build().toNonIndexed();
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, vcMaterial({ flatShading: true }));
    mesh.name = 'mountains';
    this.add(mesh, { cast: true, receive: true });

    // Table Mountain's famous "tablecloth" cloud
    const tm = MOUNTAINS[0];
    const ck = new MeshKit();
    const rng = new RNG(8);
    for (let i = 0; i < 26; i++) {
      const a = Math.PI + (i / 25) * Math.PI; // north half of the plateau edge
      const x = tm.cx + Math.cos(a) * tm.topRx * rng.range(0.75, 1.02);
      const z = tm.cz + Math.sin(a) * tm.topRz * rng.range(0.6, 1.05);
      ck.add(GEO.ico1, { x, y: tm.height + rng.range(4, 12), z, sx: rng.range(22, 40), sy: rng.range(8, 14), sz: rng.range(18, 30), color: '#ffffff' });
      if (rng.chance(0.6)) ck.add(GEO.ico1, { x, y: tm.height - rng.range(10, 40), z: z - rng.range(8, 20), sx: rng.range(18, 28), sy: rng.range(10, 22), sz: rng.range(10, 16), color: '#f4f6f8' });
    }
    this.cloth = new THREE.Mesh(ck.build(), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.88, emissive: '#9aa4ad', emissiveIntensity: 0.35, depthWrite: false }));
    this.cloth.renderOrder = 3;
    this.root.add(this.cloth);
  }

  addMountain(kit, m) {
    const rng = new RNG(m.cx * 7 + m.cz * 13);
    const seg = m.rx > 200 ? 72 : 40;
    let rings;
    if (m.profile === 'mesa') {
      // k: 0 = base ellipse, 1 = plateau edge
      rings = [[-0.02, -2], [0.22, 0.08], [0.45, 0.2], [0.62, 0.34], [0.7, 0.42], [0.76, 0.68], [0.82, 0.9], [0.9, 0.98], [1, 1], [1.3, 1], [1.65, 1.0], [2, 1.0]];
    } else if (m.profile === 'lion') {
      rings = [[0, -2], [0.18, 0.1], [0.36, 0.22], [0.5, 0.36], [0.6, 0.56], [0.68, 0.74], [0.76, 0.86], [0.84, 0.94], [0.92, 0.99], [1, 1]];
    } else if (m.profile === 'peak') {
      rings = [[0, -2], [0.2, 0.22], [0.4, 0.45], [0.58, 0.64], [0.74, 0.8], [0.88, 0.93], [0.97, 0.99], [1, 1]];
    } else {
      rings = [[0, -2], [0.2, 0.36], [0.42, 0.66], [0.66, 0.88], [0.86, 0.98], [1, 1]];
    }
    const pts = rings.map(([k, yf], ri) => {
      const row = [];
      for (let j = 0; j < seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        let rx, rz, y;
        if (m.profile === 'mesa') {
          if (k <= 1) {
            rx = lerp(m.rx * 1.02, m.topRx, Math.max(0, k));
            rz = lerp(m.rz * 1.02, m.topRz, Math.max(0, k));
          } else {
            const s = 1 - (k - 1);
            rx = m.topRx * s;
            rz = m.topRz * s;
          }
          y = yf < 0 ? -2 : m.height * yf;
        } else {
          const e = 1.02 * (1 - k);
          rx = m.rx * e;
          rz = m.rz * e;
          y = yf < 0 ? -2 : m.height * yf;
        }
        const n = valueNoise(Math.cos(a) * 3 + m.cx, Math.sin(a) * 3 + ri * 1.7, 3) * 2 - 1;
        const wob = ri === 0 ? 0.03 : m.profile === 'mesa' && k >= 1 ? 0.01 : 0.07;
        const jitterY = ri === 0 || (m.profile === 'mesa' && k >= 0.9) ? 0 : n * m.height * 0.035;
        row.push([m.cx + Math.cos(a) * rx * (1 + n * wob), y + jitterY + (m.profile === 'mesa' && k > 1 ? rng.range(-0.6, 0.6) : 0), m.cz + Math.sin(a) * rz * (1 + n * wob)]);
      }
      return row;
    });
    const H = m.height;
    const colorFn = (x, y, z) => {
      const f = clamp(y / H, 0, 1);
      if (m.profile === 'mesa') {
        if (f < 0.25) return colLerp('#4a6834', '#587040', f / 0.25);
        if (f < 0.4) return colLerp('#587040', '#7f7c63', (f - 0.25) / 0.15);
        if (f < 0.985) {
          const band = Math.sin(y * 0.38 + Math.sin(x * 0.05) * 1.5) * 0.5 + 0.5;
          return colLerp('#9a9284', '#7d776b', band);
        }
        return C('#858a68');
      }
      if (m.profile === 'lion') {
        if (f < 0.5) return colLerp('#4f6b39', '#667744', f / 0.5);
        const band = Math.sin(y * 0.5) * 0.5 + 0.5;
        return colLerp('#938b7a', '#7b7568', band);
      }
      if (f < 0.55) return colLerp('#506c3a', '#677848', f / 0.55);
      if (f < 0.85) return colLerp('#677848', '#86836f', (f - 0.55) / 0.3);
      return colLerp('#8b897c', '#9a978a', (f - 0.85) / 0.15);
    };
    for (let r = 0; r + 1 < pts.length; r++) {
      for (let j = 0; j < seg; j++) {
        const a = pts[r][j], b = pts[r][(j + 1) % seg], c = pts[r + 1][(j + 1) % seg], d = pts[r + 1][j];
        kitTri(kit, a, d, c, colorFn);
        kitTri(kit, a, c, b, colorFn);
      }
    }
    // cap
    const last = pts[pts.length - 1];
    const top = [m.cx, m.profile === 'mesa' ? H : H * 1.0 + 2, m.cz];
    for (let j = 0; j < seg; j++) kitTri(kit, last[j], top, last[(j + 1) % seg], colorFn);
  }

  // ------------------------------------------------------------------ per-frame
  update(dt, time, env, signals) {
    if (this.oceanTex) {
      this.oceanTex.offset.x = (time * 0.0016) % 1;
      this.oceanTex.offset.y = (time * 0.0009) % 1;
    }
    const night = env.night;
    for (const m of this.wallMats) m.emissiveIntensity = night * 0.95;
    if (this.lampHeadMat) this.lampHeadMat.color.set(night > 0.3 ? '#ffe2a8' : '#cfcfc6');
    if (this.poolMat) this.poolMat.opacity = night * 0.55;
    if (this.bulbMats && signals) {
      for (const g of ['NS', 'EW']) {
        const s = signals.colorFor(g);
        this.bulbMats[g + 'R'].color.set(s === 'R' ? '#ff2a1a' : '#3a1210');
        this.bulbMats[g + 'Y'].color.set(s === 'Y' ? '#ffc21a' : '#3a2e10');
        this.bulbMats[g + 'G'].color.set(s === 'G' ? '#2aff6a' : '#103a1c');
      }
    }
    if (this.cloth) {
      this.cloth.position.y = Math.sin(time * 0.1) * 2;
      this.cloth.position.z = Math.sin(time * 0.05) * 4;
      this.cloth.material.opacity = 0.75 + Math.sin(time * 0.07) * 0.1;
    }
  }
}

const FACADE_SPEC = {
  office: { bay: 4, floor: 3.6 },
  apartment: { bay: 4, floor: 3.2 },
  house: { bay: 3.4, floor: 3.4 },
  villa: { bay: 5, floor: 3.4 },
  industrial: { bay: 6, floor: 4.5 },
  township: { bay: 3, floor: 3.2 },
};

const _ca = new THREE.Color(), _cb = new THREE.Color();
function colLerp(a, b, t) {
  return _ca.set(a).clone().lerp(_cb.set(b), clamp(t, 0, 1));
}

function kitTri(kit, a, b, c, colorFn) {
  // triangle with per-vertex colour
  const base = kit.count;
  const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2];
  const bx = c[0] - a[0], by = c[1] - a[1], bz = c[2] - a[2];
  let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
  const l = Math.hypot(nx, ny, nz) || 1;
  for (const p of [a, b, c]) {
    kit.pos.push(p[0], p[1], p[2]);
    kit.nor.push(nx / l, ny / l, nz / l);
    const cc = colorFn(p[0], p[1], p[2]);
    kit.col.push(cc.r, cc.g, cc.b);
  }
  kit.idx.push(base, base + 1, base + 2);
  kit.count += 3;
}
