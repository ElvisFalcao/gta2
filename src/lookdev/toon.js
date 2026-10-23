// Look-dev "sunny toon" kit: banded toon shading, ink outlines, rounded shapes and
// hand-painted canvas textures. Everything stays vertex-coloured so a whole street
// merges into a few draw calls (phones stay fast).

import * as THREE from 'three';

// Light bands: deep shade, shade, lit, highlight. Nearest filtering keeps the steps crisp.
function gradient(steps) {
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const t = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
export const RAMP = gradient([92, 150, 215, 255]);
export const RAMP_SOFT = gradient([130, 185, 235, 255]);

export const toon = (o = {}) => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: o.soft ? RAMP_SOFT : RAMP, ...o, soft: undefined });

/** Ink outline: the back faces of the mesh, pushed out along the normals. */
export function outlineMaterial(color = '#2a1e1a', width = 0.035) {
  return new THREE.ShaderMaterial({
    vertexShader: `uniform float uWidth;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position + normal * uWidth, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uColor;
      #include <common>
      #include <fog_pars_fragment>
      void main() { gl_FragColor = vec4(uColor, 1.0);
        #include <fog_fragment>
      }`,
    side: THREE.BackSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: new THREE.Color(color) }, uWidth: { value: width } }]),
  });
}

/** A mesh plus its outline hull, sharing one geometry. */
export function inked(geo, mat, outline) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (outline) {
    const o = new THREE.Mesh(geo, outline);
    o.castShadow = false;
    o.raycast = () => {};
    m.add(o);
  }
  return m;
}

// ---------------------------------------------------------------- rounded shapes
const _cache = new Map();
/** Box with rounded edges (corners spherified), centred on the origin. */
export function roundedBox(w, h, d, r, seg = 3) {
  const key = [w, h, d, r, seg].map((v) => v.toFixed(3)).join();
  if (_cache.has(key)) return _cache.get(key);
  r = Math.min(r, w / 2, h / 2, d / 2);
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const P = g.attributes.position, N = g.attributes.normal;
  const ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r;
  const v = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    c.set(THREE.MathUtils.clamp(v.x, -ix, ix), THREE.MathUtils.clamp(v.y, -iy, iy), THREE.MathUtils.clamp(v.z, -iz, iz));
    n.subVectors(v, c);
    if (n.lengthSq() < 1e-10) n.fromBufferAttribute(N, i);
    n.normalize();
    P.setXYZ(i, c.x + n.x * r, c.y + n.y * r, c.z + n.z * r);
    N.setXYZ(i, n.x, n.y, n.z);
  }
  g.computeBoundingSphere();
  _cache.set(key, g);
  return g;
}

export const SHAPES = {
  sphere: new THREE.SphereGeometry(0.5, 16, 12),
  sphereLo: new THREE.SphereGeometry(0.5, 10, 8),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  cylLo: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cone: new THREE.ConeGeometry(0.5, 1, 12),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 6, 12),
  torus: new THREE.TorusGeometry(0.5, 0.12, 8, 20),
  skirt: new THREE.CylinderGeometry(0.28, 0.5, 1, 16),
};

/** Merge geometries that carry no colour attribute into one coloured geometry (like MeshKit, for any geometry). */
export class Merger {
  constructor() {
    this.parts = [];
  }
  add(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, matrix } = {}) {
    const m = matrix || new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    this.parts.push({ geo, color: new THREE.Color(color), m });
    return this;
  }
  build() {
    let nv = 0, ni = 0;
    for (const p of this.parts) {
      nv += p.geo.attributes.position.count;
      ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count;
    }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let ov = 0, oi = 0;
    const v = new THREE.Vector3(), nm = new THREE.Matrix3();
    for (const p of this.parts) {
      const P = p.geo.attributes.position, N = p.geo.attributes.normal, U = p.geo.attributes.uv;
      nm.getNormalMatrix(p.m);
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(p.m);
        pos.set([v.x, v.y, v.z], (ov + i) * 3);
        v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
        nor.set([v.x, v.y, v.z], (ov + i) * 3);
        col.set([p.color.r, p.color.g, p.color.b], (ov + i) * 3);
        if (U) uv.set([U.getX(i), U.getY(i)], (ov + i) * 2);
      }
      if (p.geo.index) for (let i = 0; i < p.geo.index.count; i++) idx[oi++] = ov + p.geo.index.getX(i);
      else for (let i = 0; i < P.count; i++) idx[oi++] = ov + i;
      ov += P.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ---------------------------------------------------------------- painted textures
export function canvasTex(w, h, draw, { repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/** Rounded cobbles, warm grey with a little colour noise. */
export function cobbleTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5b5550';
    g.fillRect(0, 0, w, h);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const rows = 8, cols = 8, cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + (r % 2 ? cw / 2 : 0), y = r * ch;
        const l = 52 + rnd() * 16, hue = 20 + rnd() * 20;
        g.fillStyle = `hsl(${hue}, 10%, ${l}%)`;
        for (const dx of [0, -w]) {
          g.beginPath();
          g.roundRect(x + dx + 2, y + 2, cw - 4, ch - 4, 9);
          g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.beginPath();
        g.roundRect(x + 5, y + 4, cw - 14, 5, 3);
        g.fill();
      }
    }
  }, { repeat: [10, 2] });
}

/** Hand-painted shop sign. */
export function signTexture(text, { bg = '#1e7a3c', fg = '#ffe9a8', sub = '', w = 512, h = 128, font = 'Bebas Neue, Impact, sans-serif' } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(0, 0, w, h, 18);
    g.fill();
    g.strokeStyle = fg;
    g.lineWidth = 6;
    g.beginPath();
    g.roundRect(9, 9, w - 18, h - 18, 12);
    g.stroke();
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = sub ? 64 : 80;
    g.font = `${size}px ${font}`;
    while (g.measureText(text).width > w - 50 && size > 20) g.font = `${(size -= 2)}px ${font}`;
    g.fillText(text, w / 2, sub ? h * 0.42 : h / 2 + 4);
    if (sub) {
      g.font = `600 26px Inter, Arial, sans-serif`;
      g.fillText(sub, w / 2, h * 0.78);
    }
  });
}

/** Street mural: bold shapes and a word, Woodstock style. */
export function muralTexture() {
  return canvasTex(1024, 384, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, w, 0);
    bg.addColorStop(0, '#ffcf33');
    bg.addColorStop(0.5, '#ff6b6b');
    bg.addColorStop(1, '#a970ff');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    const blob = (x, y, r, c) => {
      g.fillStyle = c;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    };
    blob(140, 120, 110, '#1e7a3c');
    blob(900, 300, 140, '#1b2a4a');
    blob(560, 40, 80, '#3cc9c9');
    // protea-ish flower
    g.save();
    g.translate(170, 250);
    for (let i = 0; i < 12; i++) {
      g.rotate(Math.PI / 6);
      g.fillStyle = i % 2 ? '#ff5fa2' : '#ffd1e3';
      g.beginPath();
      g.ellipse(0, -60, 22, 60, 0, 0, Math.PI * 2);
      g.fill();
    }
    blob(0, 0, 34, '#ffe9a8');
    g.restore();
    g.font = '170px Bebas Neue, Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 14;
    g.strokeStyle = '#1b1410';
    g.strokeText('UBUNTU', 600, 210);
    g.fillStyle = '#ffffff';
    g.fillText('UBUNTU', 600, 210);
    g.font = '600 34px Inter, Arial, sans-serif';
    g.fillStyle = '#1b1410';
    g.fillText('I am because we are', 600, 320);
  });
}

/** Face for the cartoon heads: eyes, brows, smile on a transparent canvas (front of the head). */
export function faceTexture({ skin = '#6b4129', brow = '#1a120c', lip = '#7a3b2e', lashes = false, smile = 0.6 } = {}) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = skin;
    g.fillRect(0, 0, w, h);
    // eyes live in the middle third of the texture (the front of the sphere)
    for (const s of [-1, 1]) {
      const x = w / 2 + s * 22, y = h * 0.47;
      g.fillStyle = '#fffdf6';
      g.beginPath();
      g.ellipse(x, y, 11, 14, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2b1a10';
      g.beginPath();
      g.ellipse(x + s * 1.5, y + 2, 7, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(x + s * 1.5 - 2.5, y - 2, 2.6, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = brow;
      g.lineWidth = lashes ? 4 : 6;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x - 11, y - 22 + s * -1);
      g.quadraticCurveTo(x, y - 28, x + 11, y - 21 + s * 1);
      g.stroke();
      if (lashes) {
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x + s * 10, y - 9);
        g.lineTo(x + s * 15, y - 13);
        g.stroke();
      }
    }
    // smile
    g.strokeStyle = lip;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(w / 2 - 14, h * 0.64);
    g.quadraticCurveTo(w / 2, h * 0.64 + 12 * smile, w / 2 + 14, h * 0.64);
    g.stroke();
    // cheeks
    g.fillStyle = 'rgba(255,120,100,0.18)';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(w / 2 + s * 34, h * 0.58, 9, 0, Math.PI * 2);
      g.fill();
    }
  });
}
