// Look-dev page for the "sunny toon" art direction: one Bo-Kaap street, Sizwe and three
// locals, three lighting moods. Drag to orbit, pinch / wheel to zoom, WASD or the
// on-screen stick to walk Sizwe.

import * as THREE from 'three';
import { buildStreet } from './street.js';
import { Person, LOOKS } from './people.js';

const PRESETS = {
  golden: {
    label: 'Golden hour', skyTop: '#2f4f9a', skyMid: '#f08a6a', horizon: '#ffcf8a', sun: '#ffc78a', sunI: 2.4, sunPos: [-70, 34, 80],
    hemiSky: '#ffe1bd', hemiGround: '#7a5a48', hemiI: 1.15, fog: '#f3c9a0', glow: 0.25, lamps: 0, cloud: '#fff1e6', mountains: ['#b88aa6', '#a07a9c', '#7f7f76'],
  },
  midday: {
    label: 'Midday', skyTop: '#2f7ddc', skyMid: '#6fb4ef', horizon: '#d8f0ff', sun: '#fff6e6', sunI: 2.6, sunPos: [30, 90, 50],
    hemiSky: '#cfe9ff', hemiGround: '#9a8a6a', hemiI: 1.25, fog: '#d6ecfb', glow: 0, lamps: 0, cloud: '#ffffff', mountains: ['#9fb0d0', '#8aa0c4', '#6f8f74'],
  },
  night: {
    label: 'Night', skyTop: '#070d24', skyMid: '#1b2350', horizon: '#3a3466', sun: '#9fb4ff', sunI: 0.45, sunPos: [60, 70, 40],
    hemiSky: '#3a4a86', hemiGround: '#1c1626', hemiI: 0.7, fog: '#262648', glow: 1, lamps: 1, cloud: '#8f90b8', mountains: ['#3a3a66', '#30305a', '#262a3a'],
  },
};

const app = document.getElementById('ld');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.3, 1200);

// sky dome with a three-stop gradient and a soft sun glow
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, glow: { value: 0 } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top, mid, hor, sunDir; uniform float glow; varying vec3 vP;
    void main(){ float h = clamp(vP.y, 0.0, 1.0);
      vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, h)); c = mix(c, top, smoothstep(0.18, 0.75, h));
      float s = max(dot(normalize(vP), normalize(sunDir)), 0.0);
      c += vec3(1.0, 0.75, 0.45) * pow(s, 18.0) * 0.55 * (1.0 - glow * 0.9) + vec3(1.0, 0.95, 0.8) * smoothstep(0.9975, 0.999, s) * (1.0 - glow);
      gl_FragColor = vec4(c, 1.0); }`,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat));

const hemi = new THREE.HemisphereLight();
scene.add(hemi);
const sun = new THREE.DirectionalLight();
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 24, bottom: -24, near: 1, far: 260 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
scene.fog = new THREE.Fog('#ffffff', 60, 260);

// painted signs need the display font loaded first
await Promise.race([document.fonts.load('80px "Bebas Neue"'), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
const street = buildStreet(scene);
// night: warm pools of light under the lamps
const lampLights = street.lamps.map((p) => {
  const l = new THREE.PointLight('#ffb45c', 0, 14, 1.6);
  l.position.copy(p);
  scene.add(l);
  return l;
});

// people
const sizwe = new Person(LOOKS.sizwe);
sizwe.root.position.set(-4, 0.2, 4.6);
const aunty = new Person(LOOKS.aunty);
aunty.root.position.set(-7.8, 0.2, -4.8);
const oom = new Person(LOOKS.oom);
oom.root.position.set(-3, 0.2, 5.7);
oom.root.rotation.y = Math.PI;
const sisi = new Person(LOOKS.sisi);
sisi.root.position.set(6, 0.2, -4.6);
for (const p of [sizwe, aunty, oom, sisi]) scene.add(p.root);
// oom sits on the bench
oom.hips.position.y = 0.58;
for (const l of oom.legs) l.rotation.x = -1.45;

let preset = 'golden';
function applyPreset(name) {
  preset = name;
  const P = PRESETS[name];
  skyMat.uniforms.top.value.set(P.skyTop);
  skyMat.uniforms.mid.value.set(P.skyMid);
  skyMat.uniforms.hor.value.set(P.horizon);
  skyMat.uniforms.glow.value = P.glow;
  sun.color.set(P.sun);
  sun.intensity = P.sunI;
  sun.position.set(...P.sunPos);
  skyMat.uniforms.sunDir.value.set(...P.sunPos).normalize();
  hemi.color.set(P.hemiSky);
  hemi.groundColor.set(P.hemiGround);
  hemi.intensity = P.hemiI;
  scene.fog.color.set(P.fog);
  street.glass.material.emissiveIntensity = P.lamps ? 1.3 : 0;
  street.glass.material.color.set(P.lamps ? '#ffcf8a' : '#ffffff');
  street.lampGlass.material.color.set(P.lamps ? '#ffe9a8' : '#e9e2cf');
  lampLights.forEach((l) => (l.intensity = P.lamps * 14));
  // mountains: their colour at the top, fading into the haze at the foot
  const haze = new THREE.Color(P.fog), top = new THREE.Color(), c = new THREE.Color();
  street.backdrop.forEach((m, i) => {
    top.set(P.mountains[i]);
    const pos = m.geometry.attributes.position, col = m.geometry.attributes.color;
    for (let k = 0; k < pos.count; k++) {
      const t = THREE.MathUtils.clamp((pos.getY(k) + 30) / (m.userData.top + 30), 0, 1);
      c.copy(haze).lerp(top, 0.35 + 0.65 * Math.pow(t, 0.7));
      col.setXYZ(k, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  });
  street.cloud.children.forEach((c) => c.material.color.set(P.cloud));
  document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('on', b.dataset.preset === name));
}

// ---------------------------------------------------------------- controls
const cam = { yaw: -0.35, pitch: 0.22, dist: 11, target: new THREE.Vector3() };
const keys = new Set();
window.addEventListener('keydown', (e) => keys.add(e.code));
window.addEventListener('keyup', (e) => keys.delete(e.code));
const pointers = new Map();
let pinch0 = 0, dist0 = 0;
const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const knob = document.getElementById('ld-knob'), base = document.getElementById('ld-stick');
renderer.domElement.addEventListener('pointerdown', (e) => {
  const touchStick = e.pointerType !== 'mouse' && e.clientX < window.innerWidth * 0.4 && stick.id === null;
  if (touchStick) {
    Object.assign(stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
    base.style.left = e.clientX + 'px';
    base.style.top = e.clientY + 'px';
    base.classList.add('on');
  } else pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
    dist0 = cam.dist;
  }
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerId === stick.id) {
    const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, d = Math.hypot(dx, dy), R = 50, k = d > R ? R / d : 1;
    stick.x = (dx * k) / R;
    stick.y = (-dy * k) / R;
    knob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
    return;
  }
  const p = pointers.get(e.pointerId);
  if (!p) return;
  if (pointers.size === 2) {
    p.x = e.clientX;
    p.y = e.clientY;
    const [a, b] = [...pointers.values()];
    cam.dist = THREE.MathUtils.clamp((dist0 * pinch0) / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 3, 40);
    return;
  }
  cam.yaw -= (e.clientX - p.x) * 0.006;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + (e.clientY - p.y) * 0.004, -0.05, 1.2);
  p.x = e.clientX;
  p.y = e.clientY;
  touring = false;
});
const up = (e) => {
  if (e.pointerId === stick.id) {
    stick.id = null;
    stick.x = stick.y = 0;
    base.classList.remove('on');
    knob.style.transform = 'translate(-50%,-50%)';
  }
  pointers.delete(e.pointerId);
};
renderer.domElement.addEventListener('pointerup', up);
renderer.domElement.addEventListener('pointercancel', up);
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam.dist = THREE.MathUtils.clamp(cam.dist * (e.deltaY > 0 ? 1.1 : 0.9), 3, 40);
}, { passive: false });
document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.preset)));
let touring = false, autoWalk = true;
document.getElementById('ld-tour').addEventListener('click', () => (touring = !touring));
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ---------------------------------------------------------------- loop
let last = performance.now(), time = 0, walkDir = 1, fps = 60;
const fpsEl = document.getElementById('ld-fps');
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  renderer.render(scene, camera);
  fps = fps * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05;
  if (fpsEl) fpsEl.textContent = `${Math.round(fps)} fps`;
  requestAnimationFrame(frame);
}

function step(dt) {
  time += dt;
  // Sizwe: player input, otherwise strolls up and down the pavement
  let mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + stick.x;
  let my = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + stick.y;
  const manual = Math.hypot(mx, my) > 0.1;
  if (manual) autoWalk = false;
  let speed = 0;
  if (manual) {
    const f = new THREE.Vector3(Math.sin(cam.yaw), 0, Math.cos(cam.yaw)).multiplyScalar(-1);
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const dir = f.multiplyScalar(my).add(r.multiplyScalar(-mx));
    const run = keys.has('ShiftLeft') ? 2 : 1;
    speed = Math.min(1, dir.length()) * 1.6 * run;
    dir.normalize();
    sizwe.root.position.addScaledVector(dir, speed * dt);
    sizwe.root.rotation.y = Math.atan2(dir.x, dir.z);
  } else if (autoWalk) {
    speed = 1.3;
    sizwe.root.position.x += walkDir * speed * dt;
    if (sizwe.root.position.x > 14) walkDir = -1;
    if (sizwe.root.position.x < -18) walkDir = 1;
    sizwe.root.rotation.y += ((walkDir > 0 ? Math.PI / 2 : -Math.PI / 2) - sizwe.root.rotation.y) * Math.min(1, dt * 5);
  }
  const p = sizwe.root.position;
  p.x = THREE.MathUtils.clamp(p.x, -34, 34);
  p.z = THREE.MathUtils.clamp(p.z, -5.6, 5.6);
  p.y = Math.abs(p.z) > 3.5 ? 0.2 : 0;
  sizwe.update(dt, { speed });
  aunty.update(dt, { wave: Math.sin(time * 0.5) > 0.2 });
  aunty.root.rotation.y = 0.3 + Math.sin(time * 0.4) * 0.2;
  oom.update(dt, {});
  for (const l of oom.legs) l.rotation.x = -1.45;
  sisi.root.position.x = 6 + Math.sin(time * 0.15) * 10;
  sisi.root.rotation.y = Math.cos(time * 0.15) > 0 ? Math.PI / 2 : -Math.PI / 2;
  sisi.update(dt, { speed: Math.abs(Math.cos(time * 0.15)) * 1.5 + 0.2 });
  // ambient life: hadedas bob, washing sways, taxi idles
  street.birds.forEach((b, i) => (b.rotation.z = Math.sin(time * 2 + i) * 0.08));
  street.clothes.forEach((c, i) => (c.rotation.x = Math.sin(time * 1.7 + i * 0.7) * 0.18));
  street.taxi.position.y = Math.sin(time * 30) * 0.008;
  street.cloud.children.forEach((c, i) => {
    if (!c.userData.flow) return;
    const t = ((time * 0.08 + i * 0.37) % 1); // wisps pour over the edge and fade
    c.position.y = c.userData.y0 - t * 16;
    c.material.opacity = 0.75 * Math.sin(t * Math.PI);
  });
  // camera
  if (touring) cam.yaw += dt * 0.12;
  cam.target.lerp(new THREE.Vector3(p.x, 1.4, p.z), 1 - Math.exp(-dt * 4));
  const cp = Math.cos(cam.pitch);
  camera.position.set(cam.target.x + Math.sin(cam.yaw) * cam.dist * cp, cam.target.y + Math.sin(cam.pitch) * cam.dist + 0.6, cam.target.z + Math.cos(cam.yaw) * cam.dist * cp);
  camera.lookAt(cam.target.x, cam.target.y + 0.4, cam.target.z);
  // keep the shadow box around the action
  sun.target.position.set(cam.target.x, 0, -1);
  sun.position.set(cam.target.x + PRESETS[preset].sunPos[0], PRESETS[preset].sunPos[1], PRESETS[preset].sunPos[2]);
}

applyPreset(new URLSearchParams(location.search).get('mood') || 'golden');
window.__ld = { scene, camera, cam, sizwe, applyPreset, step, renderer, setAutoWalk: (v) => (autoWalk = v) };
requestAnimationFrame(frame);
