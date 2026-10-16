// Third-person chase camera with occlusion against buildings / mountains,
// auto-alignment behind vehicles and scripted cutscene shots.

import * as THREE from 'three';
import { clamp, damp, dampAngle, wrapAngle, lerp } from './util.js';

const _look = new THREE.Vector3();
const _want = new THREE.Vector3();

export class CameraRig {
  constructor(camera, grid) {
    this.camera = camera;
    this.grid = grid;
    this.yaw = 0;
    this.pitch = 0.4;
    this.pitchOffset = 0;
    this.dist = 8;
    this.manualT = 0;
    this.shakeAmt = 0;
    this.pos = new THREE.Vector3(0, 10, -10);
    this.look = new THREE.Vector3();
    this.shot = null; // {pos, look, speed}
    this.shotBlend = 0;
    this.first = true;
  }

  shake(a) {
    this.shakeAmt = Math.min(1.5, this.shakeAmt + a);
  }

  setShot(pos, look, speed = 2.5) {
    this.shot = { pos: pos.clone(), look: look.clone(), speed };
  }
  clearShot() {
    this.shot = null;
  }
  snapBehind(heading) {
    this.yaw = heading;
    this.manualT = 0;
  }

  update(dt, c) {
    // c: {x,y,z, heading, speed, inVehicle, vehicleLen, yawInput, pitchInput, moving, reversing}
    if (c.yawInput) {
      this.yaw += c.yawInput;
      this.manualT = 1.8;
    }
    if (c.pitchInput) {
      this.pitchOffset = clamp(this.pitchOffset + c.pitchInput, -0.25, 0.5);
      this.manualT = 1.8;
    }
    this.manualT -= dt;
    if (this.manualT <= 0) {
      this.pitchOffset = damp(this.pitchOffset, 0, 1.5, dt);
      if (c.inVehicle && Math.abs(c.speed) > 2.5) {
        const behind = c.speed < -2 ? c.heading + Math.PI : c.heading;
        this.yaw = dampAngle(this.yaw, behind, c.speed < -2 ? 1.2 : 2.6, dt);
      } else if (!c.inVehicle && c.moving) {
        this.yaw = dampAngle(this.yaw, c.heading, 0.55, dt);
      }
    }
    const wantPitch = (c.inVehicle ? 0.3 : 0.4) + this.pitchOffset;
    this.pitch = damp(this.pitch, wantPitch, 4, dt);
    const wantDist = c.inVehicle ? clamp(8.5 + (c.vehicleLen || 4.5) * 0.6 + Math.abs(c.speed) * 0.12, 9, 17) : c.wide ? 11 : 7.6;
    this.dist = damp(this.dist, wantDist, 2.2, dt);

    _look.set(c.x, c.y + (c.inVehicle ? 1.7 : 1.55), c.z);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    _want.set(
      _look.x - Math.sin(this.yaw) * this.dist * cp,
      _look.y + this.dist * sp,
      _look.z - Math.cos(this.yaw) * this.dist * cp,
    );
    // occlusion
    if (!c.onPlateau) {
      const t = this.grid.raycast(_look.x, _look.y, _look.z, _want.x, _want.y, _want.z);
      if (t < 1) {
        const tt = Math.max(0.12, t - 0.06);
        _want.lerpVectors(_look, _want, tt);
        _want.y = Math.max(_want.y, _look.y + 0.6);
      }
    }
    _want.y = Math.max(_want.y, (c.groundY ?? 0) + 0.8);

    if (this.first) {
      this.pos.copy(_want);
      this.look.copy(_look);
      this.first = false;
    }
    if (this.shot) {
      this.shotBlend = Math.min(1, this.shotBlend + dt * this.shot.speed);
      this.pos.lerp(this.shot.pos, 1 - Math.exp(-this.shot.speed * 2 * dt));
      this.look.lerp(this.shot.look, 1 - Math.exp(-this.shot.speed * 2 * dt));
    } else {
      this.shotBlend = 0;
      // pull in fast, ease out slow
      const closer = _want.distanceTo(_look) < this.pos.distanceTo(_look);
      const k = 1 - Math.exp(-(closer ? 20 : 9) * dt);
      this.pos.lerp(_want, k);
      this.look.lerp(_look, 1 - Math.exp(-18 * dt));
    }
    this.camera.position.copy(this.pos);
    if (this.shakeAmt > 0.001) {
      const s = this.shakeAmt * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
    }
    this.camera.lookAt(this.look);
    const fovWant = c.inVehicle ? 62 + clamp(Math.abs(c.speed) - 20, 0, 20) * 0.4 : 60;
    if (Math.abs(this.camera.fov - fovWant) > 0.05) {
      this.camera.fov = damp(this.camera.fov, fovWant, 3, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  /** World-space forward / right on the ground plane for camera-relative controls. */
  basis() {
    const f = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
    return { f, r: { x: -f.z, z: f.x } };
  }
}
