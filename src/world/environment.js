// Sky, sun/moon, fog and the day-night cycle. The sun crosses the NORTHERN sky
// (southern hemisphere) and sets over the Atlantic behind Camps Bay.

import * as THREE from 'three';
import { clamp, lerp } from '../core/util.js';

const KEYS = [
  { h: 0, top: '#070d26', hor: '#17213f', sun: '#9fb2ff', sunI: 0, hemi: 0.32, fog: '#121a33', night: 1 },
  { h: 5, top: '#0d1736', hor: '#2a2d52', sun: '#ffb48a', sunI: 0, hemi: 0.36, fog: '#1c2040', night: 1 },
  { h: 6, top: '#36558f', hor: '#f0a27d', sun: '#ffb27c', sunI: 0.7, hemi: 0.6, fog: '#c99a88', night: 0.55 },
  { h: 7.5, top: '#4d85c8', hor: '#f3d8b8', sun: '#ffe3bd', sunI: 1.8, hemi: 0.95, fog: '#d5d9df', night: 0 },
  { h: 12, top: '#3c7ccc', hor: '#bad6ef', sun: '#fff7ea', sunI: 2.6, hemi: 1.05, fog: '#c2d7ea', night: 0 },
  { h: 16.5, top: '#4882ca', hor: '#d3e0ec', sun: '#fff0d6', sunI: 2.3, hemi: 1.0, fog: '#cdd9e4', night: 0 },
  { h: 18.2, top: '#555ca6', hor: '#ff9a5c', sun: '#ff8c4c', sunI: 1.25, hemi: 0.72, fog: '#e1a07e', night: 0.25 },
  { h: 19.3, top: '#262b62', hor: '#94506d', sun: '#ff6a4a', sunI: 0.15, hemi: 0.45, fog: '#57405c', night: 0.75 },
  { h: 20.5, top: '#0b1533', hor: '#222c55', sun: '#9fb2ff', sunI: 0, hemi: 0.34, fog: '#161e3c', night: 1 },
  { h: 24, top: '#070d26', hor: '#17213f', sun: '#9fb2ff', sunI: 0, hemi: 0.32, fog: '#121a33', night: 1 },
];
const KEYC = KEYS.map((k) => ({ ...k, top: new THREE.Color(k.top), hor: new THREE.Color(k.hor), sun: new THREE.Color(k.sun), fog: new THREE.Color(k.fog) }));

export class Environment {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.hours = 7;
    this.day = 1;
    this.secondsPerHour = 40;
    this.night = 0;
    this.timeScale = 1;

    this.hemi = new THREE.HemisphereLight('#cfe4ff', '#6b6248', 1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.4);
    this.sun.position.set(100, 200, -100);
    scene.add(this.sun, this.sun.target);
    if (quality.shadows) {
      this.sun.castShadow = true;
      const s = this.sun.shadow;
      s.mapSize.set(quality.shadowSize, quality.shadowSize);
      s.camera.left = s.camera.bottom = -75;
      s.camera.right = s.camera.top = 75;
      s.camera.near = 10;
      s.camera.far = 700;
      s.bias = -0.0006;
      s.normalBias = 0.6;
    }
    scene.fog = new THREE.Fog('#c2d7ea', 150, quality.fogFar);

    // sky dome
    this.skyUniforms = {
      top: { value: new THREE.Color() },
      hor: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunVis: { value: 1 },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 hor; uniform vec3 sunColor; uniform vec3 sunDir; uniform float sunVis;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(hor, top, pow(clamp(h, 0.0, 1.0), 0.5));
          if (h < 0.0) col = mix(hor, hor * 0.75, clamp(-h * 5.0, 0.0, 1.0));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          col += sunColor * (pow(s, 900.0) * 4.0 + pow(s, 14.0) * 0.28) * sunVis;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1900, 32, 16), skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    // stars
    const starGeo = new THREE.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 1400; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.acos(Math.random() * 0.95);
      sp.push(Math.sin(v) * Math.cos(u) * 1800, Math.cos(v) * 1800, Math.sin(v) * Math.sin(u) * 1800);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    const moonMat = new THREE.MeshBasicMaterial({ color: '#f2f0e6', fog: false, transparent: true, opacity: 0 });
    this.moon = new THREE.Mesh(new THREE.CircleGeometry(40, 24), moonMat);
    scene.add(this.moon);

    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();
    this.fogColor = new THREE.Color();
    this._tmp = { top: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color(), fog: new THREE.Color() };
    this.apply(new THREE.Vector3());
  }

  advance(dt) {
    this.hours += (dt * this.timeScale) / this.secondsPerHour;
    while (this.hours >= 24) {
      this.hours -= 24;
      this.day++;
    }
  }

  skip(hours) {
    this.hours += hours;
    while (this.hours >= 24) {
      this.hours -= 24;
      this.day++;
    }
  }

  sample() {
    const h = this.hours;
    let i = 0;
    while (i < KEYC.length - 2 && KEYC[i + 1].h <= h) i++;
    const a = KEYC[i], b = KEYC[i + 1];
    const t = clamp((h - a.h) / (b.h - a.h), 0, 1);
    const o = this._tmp;
    o.top.copy(a.top).lerp(b.top, t);
    o.hor.copy(a.hor).lerp(b.hor, t);
    o.sun.copy(a.sun).lerp(b.sun, t);
    o.fog.copy(a.fog).lerp(b.fog, t);
    o.sunI = lerp(a.sunI, b.sunI, t);
    o.hemi = lerp(a.hemi, b.hemi, t);
    o.night = lerp(a.night, b.night, t);
    return o;
  }

  apply(focus, camera = null) {
    const s = this.sample();
    this.night = s.night;
    const a = ((this.hours - 6) / 12) * Math.PI;
    this.sunDir.set(Math.cos(a), Math.sin(a) * 1.1, -0.55).normalize();
    this.moonDir.set(-Math.cos(a) * 0.8, Math.max(0.35, -Math.sin(a)), -0.5).normalize();
    const sunUp = this.sunDir.y > -0.02;
    const dir = sunUp ? this.sunDir : this.moonDir;
    this.sun.intensity = sunUp ? s.sunI : 0.35 * s.night;
    this.sun.color.copy(sunUp ? s.sun : new THREE.Color('#9fb2ff'));
    this.hemi.intensity = s.hemi;
    this.hemi.color.copy(s.top).lerp(new THREE.Color('#ffffff'), 0.55);
    this.hemi.groundColor.set(s.night > 0.5 ? '#2a2a33' : '#6b6248');

    // follow focus so the shadow map covers the player area
    const snap = 2;
    const fx = Math.round(focus.x / snap) * snap, fz = Math.round(focus.z / snap) * snap;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx + dir.x * 300, focus.y + dir.y * 300, fz + dir.z * 300);

    this.scene.fog.color.copy(s.fog);
    this.scene.fog.far = focus.y > 100 ? Math.max(this.quality.fogFar, 1600) : this.quality.fogFar;
    this.fogColor.copy(s.fog);
    const u = this.skyUniforms;
    u.top.value.copy(s.top);
    u.hor.value.copy(s.hor);
    u.sunColor.value.copy(s.sun);
    u.sunDir.value.copy(this.sunDir);
    u.sunVis.value = clamp(this.sunDir.y * 6 + 0.3, 0, 1);
    this.starMat.opacity = clamp(s.night * 1.1 - 0.2, 0, 0.9);
    if (camera) {
      this.sky.position.copy(camera.position);
      this.stars.position.copy(camera.position);
      this.moon.position.copy(camera.position).addScaledVector(this.moonDir, 1500);
      this.moon.lookAt(camera.position);
    }
    this.moon.material.opacity = clamp(s.night * 1.2 - 0.2, 0, 1);
  }
}
