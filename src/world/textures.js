// Procedurally painted canvas textures. No image assets needed.

import * as THREE from 'three';
import { RNG } from '../core/util.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

export function toTexture(c, { repeat = true, srgb = true, nearest = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) t.magFilter = THREE.NearestFilter;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

// ---------------- facades ----------------
// Each facade tile covers 2 bays x 2 floors. Map = lit by sun, emissive = lit windows at night.
const FACADES = {
  office: { bay: 4, floor: 3.6 },
  apartment: { bay: 4, floor: 3.2 },
  house: { bay: 3.4, floor: 3.4 },
  villa: { bay: 5, floor: 3.4 },
  industrial: { bay: 6, floor: 4.5 },
  township: { bay: 3, floor: 3.2 },
};
export const FACADE_SPECS = FACADES;

export function makeFacade(style, seed = 3) {
  const S = 128;
  const [c, g] = canvas(S, S);
  const [ce, ge] = canvas(S, S);
  const rng = new RNG(seed + style.length * 31);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, S, S);
  ge.fillStyle = '#000000';
  ge.fillRect(0, 0, S, S);
  const cellW = S / 2, cellH = S / 2;
  const lit = () => rng.chance(0.42);
  const litColor = () => rng.pick(['#ffd88a', '#ffe7b0', '#fff2d0', '#ffc977']);

  for (let by = 0; by < 2; by++) {
    for (let bx = 0; bx < 2; bx++) {
      const x0 = bx * cellW, y0 = by * cellH;
      let wx, wy, ww, wh;
      if (style === 'office') {
        // glass curtain wall with mullions
        g.fillStyle = '#5a6c80';
        g.fillRect(x0 + 2, y0 + 6, cellW - 4, cellH - 10);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(x0 + 2, y0 + 6, cellW - 4, 6);
        g.fillStyle = '#e8eef2';
        g.fillRect(x0 + cellW / 2 - 1, y0 + 6, 2, cellH - 10);
        [wx, wy, ww, wh] = [x0 + 2, y0 + 6, cellW - 4, cellH - 10];
      } else if (style === 'apartment') {
        g.fillStyle = '#4f5d68';
        g.fillRect(x0 + 10, y0 + 10, cellW - 20, cellH - 26);
        g.fillStyle = '#d9d9d9';
        g.fillRect(x0 + 4, y0 + cellH - 16, cellW - 8, 5); // balcony rail
        g.fillStyle = '#9aa3a8';
        for (let k = 0; k < 6; k++) g.fillRect(x0 + 6 + k * 9, y0 + cellH - 22, 2, 7);
        [wx, wy, ww, wh] = [x0 + 10, y0 + 10, cellW - 20, cellH - 26];
      } else if (style === 'house') {
        g.fillStyle = '#ffffff';
        g.fillRect(x0 + 16, y0 + 12, cellW - 32, cellH - 26);
        g.fillStyle = '#3b4650';
        g.fillRect(x0 + 19, y0 + 15, cellW - 38, cellH - 32);
        g.fillStyle = '#ffffff';
        g.fillRect(x0 + cellW / 2 - 1, y0 + 15, 2, cellH - 32);
        g.fillRect(x0 + 19, y0 + 15 + (cellH - 32) / 2, cellW - 38, 2);
        [wx, wy, ww, wh] = [x0 + 19, y0 + 15, cellW - 38, cellH - 32];
      } else if (style === 'villa') {
        g.fillStyle = '#486170';
        g.fillRect(x0 + 6, y0 + 10, cellW - 12, cellH - 18);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(x0 + 6, y0 + 10, cellW - 12, 5);
        [wx, wy, ww, wh] = [x0 + 6, y0 + 10, cellW - 12, cellH - 18];
      } else if (style === 'industrial') {
        // brick courses
        for (let r = 0; r < cellH; r += 6) {
          g.fillStyle = r % 12 === 0 ? '#ececec' : '#f6f6f6';
          g.fillRect(x0, y0 + r, cellW, 5);
          g.fillStyle = '#c9c9c9';
          for (let k = (r % 12 === 0 ? 0 : 6); k < cellW; k += 12) g.fillRect(x0 + k, y0 + r, 1, 5);
        }
        g.fillStyle = '#39424a';
        g.fillRect(x0 + 12, y0 + 6, cellW - 24, 14);
        [wx, wy, ww, wh] = [x0 + 12, y0 + 6, cellW - 24, 14];
      } else {
        // township: plain plaster + small window
        g.fillStyle = 'rgba(0,0,0,0.05)';
        g.fillRect(x0, y0 + cellH - 6, cellW, 6);
        g.fillStyle = '#3d4a55';
        g.fillRect(x0 + 20, y0 + 18, 22, 18);
        g.fillStyle = '#ffffff';
        g.fillRect(x0 + 30, y0 + 18, 2, 18);
        [wx, wy, ww, wh] = [x0 + 20, y0 + 18, 22, 18];
      }
      if (lit()) {
        ge.fillStyle = litColor();
        ge.fillRect(wx, wy, ww, wh);
      }
    }
  }
  return { map: toTexture(c), emissive: toTexture(ce), spec: FACADES[style] };
}

// ---------------- roads ----------------
export function makeRoadTexture() {
  const [c, g] = canvas(64, 256);
  g.fillStyle = '#3c3f43';
  g.fillRect(0, 0, 64, 256);
  const rng = new RNG(11);
  for (let i = 0; i < 900; i++) {
    const v = rng.int(48, 78);
    g.fillStyle = `rgb(${v},${v},${v + 3})`;
    g.fillRect(rng.int(0, 63), rng.int(0, 255), 1, 1);
  }
  // edge lines (yellow, SA style) and white centre dashes
  g.fillStyle = '#d9b43a';
  g.fillRect(2, 0, 2, 256);
  g.fillRect(60, 0, 2, 256);
  g.fillStyle = '#f2f2f2';
  for (let y = 0; y < 256; y += 64) g.fillRect(31, y + 8, 2, 34);
  return toTexture(c);
}

export function makeAsphaltTexture() {
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#3c3f43';
  g.fillRect(0, 0, 64, 64);
  const rng = new RNG(5);
  for (let i = 0; i < 300; i++) {
    const v = rng.int(48, 78);
    g.fillStyle = `rgb(${v},${v},${v + 3})`;
    g.fillRect(rng.int(0, 63), rng.int(0, 63), 1, 1);
  }
  return toTexture(c);
}

export function makeZebraTexture() {
  const [c, g] = canvas(64, 16);
  g.clearRect(0, 0, 64, 16);
  g.fillStyle = 'rgba(245,245,245,0.92)';
  for (let x = 2; x < 64; x += 8) g.fillRect(x, 0, 5, 16);
  return toTexture(c);
}

export function makeSidewalkTexture() {
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#c4beb2';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#aea89c';
  for (let i = 0; i <= 64; i += 16) {
    g.fillRect(i, 0, 1, 64);
    g.fillRect(0, i, 64, 1);
  }
  return toTexture(c);
}

// ---------------- misc ----------------
export function makeGlowTexture() {
  const [c, g] = canvas(64, 64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return toTexture(c, { repeat: false });
}

export function makeBeamTexture() {
  const [c, g] = canvas(4, 64);
  const grd = g.createLinearGradient(0, 64, 0, 0);
  grd.addColorStop(0, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 64);
  return toTexture(c, { repeat: false });
}

export function makeWaterTexture() {
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, S, S);
  const rng = new RNG(77);
  for (let i = 0; i < 220; i++) {
    const x = rng.range(0, S), y = rng.range(0, S), w = rng.range(6, 26);
    g.strokeStyle = `rgba(150,200,230,${rng.range(0.25, 0.6)})`;
    g.lineWidth = rng.range(1, 2.2);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + w / 2, y - 3, x + w, y);
    g.stroke();
    // wrap
    if (x + w > S) { g.beginPath(); g.moveTo(x - S, y); g.quadraticCurveTo(x - S + w / 2, y - 3, x - S + w, y); g.stroke(); }
  }
  return toTexture(c, { srgb: true });
}

/** Plain text sign on a coloured panel. */
export function makeSignTexture(text, { bg = '#1d2b3a', fg = '#ffffff', w = 512, h = 128, font = 'bold 64px "Archivo Black", "Arial Black", sans-serif', border = null, sub = null } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = 8;
    g.strokeRect(4, 4, w - 8, h - 8);
  }
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = font;
  let size = parseInt(font.match(/(\d+)px/)[1], 10);
  while (g.measureText(text).width > w * 0.9 && size > 10) {
    size -= 4;
    g.font = font.replace(/\d+px/, size + 'px');
  }
  g.fillText(text, w / 2, sub ? h * 0.4 : h / 2);
  if (sub) {
    g.font = `bold ${Math.round(size * 0.45)}px sans-serif`;
    g.fillText(sub, w / 2, h * 0.78);
  }
  return toTexture(c, { repeat: false });
}

export function makeMuralTexture(seed) {
  const [c, g] = canvas(256, 128);
  const rng = new RNG(seed);
  const pal = ['#ff4f79', '#ffd23f', '#3fc1c9', '#5b5bd6', '#ff8c42', '#2ec27e', '#f8f4e3', '#1e1e24'];
  g.fillStyle = rng.pick(pal);
  g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 14; i++) {
    g.fillStyle = rng.pick(pal);
    g.beginPath();
    const kind = rng.int(0, 2);
    if (kind === 0) g.arc(rng.range(0, 256), rng.range(0, 128), rng.range(10, 50), 0, Math.PI * 2);
    else if (kind === 1) {
      g.moveTo(rng.range(0, 256), rng.range(0, 128));
      for (let k = 0; k < 4; k++) g.lineTo(rng.range(0, 256), rng.range(0, 128));
    } else g.rect(rng.range(0, 220), rng.range(0, 100), rng.range(20, 80), rng.range(10, 40));
    g.fill();
  }
  // a stylised face / protea motif
  g.fillStyle = rng.pick(pal);
  g.beginPath();
  g.arc(128, 64, 30, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1e1e24';
  g.fillRect(114, 56, 8, 8);
  g.fillRect(134, 56, 8, 8);
  g.font = 'bold 28px "Archivo Black", sans-serif';
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.fillText(rng.pick(['UBUNTU', 'KAAPSTAD', 'LEKKER', 'MZANSI', 'SHARP!', 'WOODSTOCK']), 128, 118);
  return toTexture(c, { repeat: false });
}

export function makeStripesTexture(a = '#d6362b', b = '#ffffff', n = 6, diagonal = true) {
  const [c, g] = canvas(64, 128);
  g.fillStyle = b;
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = a;
  const step = 128 / n;
  for (let i = -n; i < n * 2; i++) {
    g.beginPath();
    if (diagonal) {
      g.moveTo(0, i * step);
      g.lineTo(64, i * step - 32);
      g.lineTo(64, i * step - 32 + step / 2);
      g.lineTo(0, i * step + step / 2);
    } else g.rect(0, i * step, 64, step / 2);
    g.fill();
  }
  return toTexture(c);
}

export function makePosterTexture() {
  const [c, g] = canvas(256, 360);
  g.fillStyle = '#ffd400';
  g.fillRect(0, 0, 256, 360);
  g.fillStyle = '#1a7a3c';
  g.fillRect(0, 250, 256, 110);
  // portrait silhouette
  g.fillStyle = '#5b3a22';
  g.beginPath();
  g.arc(128, 118, 52, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#c0392b';
  g.beginPath();
  g.ellipse(128, 76, 62, 26, 0, Math.PI, 0);
  g.fill(); // doek
  g.fillStyle = '#1a7a3c';
  g.fillRect(64, 176, 128, 70);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.font = 'bold 40px "Archivo Black", "Arial Black", sans-serif';
  g.fillText('VOTE', 128, 292);
  g.font = 'bold 34px "Archivo Black", "Arial Black", sans-serif';
  g.fillText('AUNTIE NOMA', 128, 332);
  g.fillStyle = '#1a1a1a';
  g.font = 'bold 18px sans-serif';
  g.fillText('A CITY FOR ALL OF US', 128, 228 + 6);
  return toTexture(c, { repeat: false });
}

export function makeIconTexture(letter, color = '#ffcc00', ring = '#1b1b1b') {
  const [c, g] = canvas(64, 64);
  g.beginPath();
  g.arc(32, 32, 28, 0, Math.PI * 2);
  g.fillStyle = ring;
  g.fill();
  g.beginPath();
  g.arc(32, 32, 24, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.fillStyle = '#111';
  g.font = 'bold 34px "Archivo Black", "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 32, 34);
  return toTexture(c, { repeat: false });
}

export function makeClockTexture() {
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#f4efe1';
  g.beginPath();
  g.arc(32, 32, 30, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#222';
  g.lineWidth = 3;
  g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.fillStyle = '#222';
    g.fillRect(32 + Math.cos(a) * 24 - 1, 32 + Math.sin(a) * 24 - 1, 3, 3);
  }
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(32, 32);
  g.lineTo(32, 14);
  g.moveTo(32, 32);
  g.lineTo(44, 36);
  g.stroke();
  return toTexture(c, { repeat: false });
}
