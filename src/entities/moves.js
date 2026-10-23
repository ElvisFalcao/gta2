// Fight moves as keyframed poses. A pose lists joint values; anything a key leaves out is
// taken from GUARD. Joint names:
//   off.px/py/pz/rx   whole-body offset at the feet (lunge, knock-back, falling over)
//   hips.py/ry/rz     hip height, twist, tilt          torso.rx/ry/rz, head.rx/ry/rz
//   armL / armR       .sx .sy .sz shoulder, .ex .ez elbow, .wx wrist   (L = lead arm, +x side)
//   legL / legR       .hx .hz hip, .kx knee, .ax ankle                  (R = rear leg, -x side)
// Signs: shoulder x < 0 raises the arm forward, elbow x < 0 bends the forearm up, knee x > 0 bends,
// hips.ry < 0 turns the left (lead) side forward, torso.ry > 0 brings the right shoulder forward.
// Each key may set `ease`: 'snap' (fast out, slight overshoot) for strikes, otherwise smooth.

export const GUARD = {
  'hips.py': 0.72, 'hips.ry': -0.45, 'hips.rz': 0, 'torso.rx': 0.12, 'torso.ry': 0.15, 'torso.rz': 0,
  'head.rx': -0.06, 'head.ry': 0.3, 'head.rz': 0,
  'armL.sx': -1.0, 'armL.sy': 0, 'armL.sz': -0.3, 'armL.ex': -1.95, 'armL.ez': 0, 'armL.wx': 0.25,
  'armR.sx': -0.8, 'armR.sy': 0, 'armR.sz': 0.38, 'armR.ex': -2.15, 'armR.ez': 0, 'armR.wx': 0.25,
  'legL.hx': -0.38, 'legL.hz': 0.06, 'legL.kx': 0.42, 'legL.ax': -0.04,
  'legR.hx': 0.32, 'legR.hz': -0.1, 'legR.kx': 0.36, 'legR.ax': -0.28,
  'off.px': 0, 'off.py': 0, 'off.pz': 0, 'off.rx': 0,
};

export const MOVES = {
  // 1. lead-hand jab: tiny load, snap out, retract
  jab: {
    dur: 0.36, hit: 0.11, reach: 1.05,
    keys: [
      { t: 0 },
      { t: 0.05, p: { 'armL.sx': -0.85, 'armL.ex': -2.05, 'torso.ry': 0.28, 'hips.ry': -0.38 } },
      { t: 0.11, ease: 'snap', p: { 'armL.sx': -1.62, 'armL.sz': -0.14, 'armL.ex': -0.06, 'armL.wx': 0, 'torso.ry': -0.38, 'hips.ry': -0.62, 'head.ry': 0.55, 'torso.rx': 0.2, 'legR.ax': -0.5, 'off.pz': 0.08 } },
      { t: 0.17, p: { 'armL.sx': -1.58, 'armL.sz': -0.14, 'armL.ex': -0.12, 'armL.wx': 0, 'torso.ry': -0.34, 'hips.ry': -0.6, 'head.ry': 0.52, 'torso.rx': 0.2, 'legR.ax': -0.45, 'off.pz': 0.08 } },
      { t: 0.36 },
    ],
  },
  // 2. rear-hand cross: wind back, rotate hips + shoulders through, rear heel pivots up
  cross: {
    dur: 0.46, hit: 0.16, reach: 1.15,
    keys: [
      { t: 0 },
      { t: 0.07, p: { 'armR.sx': -0.62, 'armR.ex': -2.25, 'torso.ry': 0.4, 'hips.ry': -0.6, 'head.ry': 0.35 } },
      { t: 0.16, ease: 'snap', p: { 'armR.sx': -1.62, 'armR.sz': 0.12, 'armR.ex': -0.04, 'armR.wx': 0, 'torso.ry': 0.9, 'hips.ry': 0.12, 'torso.rx': 0.26, 'head.ry': -0.55, 'legR.hx': 0.22, 'legR.kx': 0.5, 'legR.ax': -0.8, 'legL.kx': 0.55, 'off.pz': 0.2, 'hips.py': 0.69 } },
      { t: 0.24, p: { 'armR.sx': -1.56, 'armR.sz': 0.12, 'armR.ex': -0.12, 'armR.wx': 0, 'torso.ry': 0.84, 'hips.ry': 0.08, 'torso.rx': 0.24, 'head.ry': -0.5, 'legR.hx': 0.22, 'legR.kx': 0.5, 'legR.ax': -0.75, 'legL.kx': 0.55, 'off.pz': 0.2, 'hips.py': 0.69 } },
      { t: 0.46, p: { 'off.pz': 0.2 } },
    ],
    keepOffset: true,
  },
  // 3. rear-leg roundhouse: chamber the knee, turn the hips over, snap the shin through, re-chamber
  kick: {
    dur: 0.78, hit: 0.34, reach: 1.25, heavy: true,
    keys: [
      { t: 0 },
      { t: 0.15, p: { 'legR.hx': -1.15, 'legR.hz': -0.35, 'legR.kx': 2.1, 'legR.ax': 0.3, 'hips.ry': 0.35, 'torso.ry': 0.25, 'torso.rz': -0.15, 'head.ry': -0.1, 'armR.sx': -0.2, 'armR.sz': 0.7, 'armR.ex': -1.2, 'legL.kx': 0.3, 'legL.ax': -0.3, 'hips.py': 0.75 } },
      { t: 0.34, ease: 'snap', p: { 'legR.hx': -0.55, 'legR.hz': -1.3, 'legR.kx': 0.12, 'legR.ax': 0.45, 'hips.ry': 1.3, 'hips.rz': 0.28, 'torso.ry': 0.15, 'torso.rz': -0.5, 'torso.rx': -0.05, 'head.ry': -1.15, 'head.rz': 0.35, 'armR.sx': 0.45, 'armR.sz': 0.9, 'armR.ex': -0.5, 'armL.sx': -1.1, 'armL.ex': -1.9, 'legL.kx': 0.22, 'legL.ax': -0.15, 'hips.py': 0.77, 'off.pz': 0.12 } },
      { t: 0.44, p: { 'legR.hx': -0.6, 'legR.hz': -1.22, 'legR.kx': 0.25, 'legR.ax': 0.4, 'hips.ry': 1.2, 'hips.rz': 0.25, 'torso.ry': 0.15, 'torso.rz': -0.45, 'head.ry': -1.05, 'head.rz': 0.3, 'armR.sx': 0.4, 'armR.sz': 0.85, 'armR.ex': -0.6, 'legL.kx': 0.25, 'hips.py': 0.77, 'off.pz': 0.12 } },
      { t: 0.6, p: { 'legR.hx': -1.0, 'legR.hz': -0.3, 'legR.kx': 1.9, 'legR.ax': 0.2, 'hips.ry': 0.4, 'torso.ry': 0.2, 'armR.sz': 0.6, 'hips.py': 0.75, 'off.pz': 0.12 } },
      { t: 0.78, p: { 'off.pz': 0.12 } },
    ],
    keepOffset: true,
  },
  // getting hit: head snaps back, body rocks, a step back
  hit: {
    dur: 0.42,
    keys: [
      { t: 0 },
      { t: 0.06, ease: 'snap', p: { 'head.rx': -0.55, 'head.ry': 0.6, 'torso.rx': -0.32, 'torso.ry': 0.45, 'armL.sz': 0.45, 'armL.sx': -0.6, 'armR.sz': -0.2, 'armR.sx': -0.4, 'armR.ex': -1.2, 'legL.kx': 0.6, 'off.pz': -0.2 } },
      { t: 0.18, p: { 'head.rx': -0.2, 'torso.rx': -0.12, 'off.pz': -0.24 } },
      { t: 0.42, p: { 'off.pz': -0.24 } },
    ],
    keepOffset: true,
  },
  // knocked down by the kick, a bounce, lying there dazed, then getting up
  knockdown: {
    dur: 3.0,
    keys: [
      { t: 0 },
      { t: 0.12, ease: 'snap', p: { 'off.rx': -0.45, 'off.pz': -0.45, 'torso.rx': -0.45, 'head.rx': -0.6, 'armL.sx': -2.3, 'armL.ex': -0.4, 'armR.sx': -2.1, 'armR.ex': -0.5, 'armL.sz': 0.4, 'armR.sz': -0.4, 'legL.hx': -0.7, 'legL.kx': 0.25, 'legR.hx': -0.2 } },
      { t: 0.42, p: { 'off.rx': -1.5, 'off.py': 0.14, 'off.pz': -1.05, 'hips.ry': 0, 'torso.ry': 0, 'torso.rx': 0.1, 'head.rx': 0.25, 'head.ry': 0, 'armL.sx': -2.7, 'armL.sz': 0.7, 'armL.ex': -0.3, 'armR.sx': -2.6, 'armR.sz': -0.7, 'armR.ex': -0.3, 'legL.hx': -0.45, 'legL.kx': 0.6, 'legR.hx': -0.15, 'legR.kx': 0.3, 'legL.ax': 0.4, 'legR.ax': 0.4 } },
      { t: 0.55, p: { 'off.rx': -1.38, 'off.py': 0.2, 'off.pz': -1.05, 'hips.ry': 0, 'torso.ry': 0, 'torso.rx': 0.05, 'head.rx': 0.1, 'head.ry': 0, 'armL.sx': -2.6, 'armL.sz': 0.8, 'armL.ex': -0.4, 'armR.sx': -2.5, 'armR.sz': -0.8, 'armR.ex': -0.4, 'legL.hx': -0.5, 'legL.kx': 0.7, 'legR.hx': -0.2, 'legR.kx': 0.35, 'legL.ax': 0.4, 'legR.ax': 0.4 } },
      { t: 0.7, p: { 'off.rx': -1.5, 'off.py': 0.14, 'off.pz': -1.05, 'hips.ry': 0, 'torso.ry': 0, 'torso.rx': 0.1, 'head.rx': 0.2, 'head.ry': 0, 'head.rz': 0.3, 'armL.sx': -2.7, 'armL.sz': 0.9, 'armL.ex': -0.5, 'armR.sx': -2.6, 'armR.sz': -0.9, 'armR.ex': -0.5, 'legL.hx': -0.4, 'legL.kx': 0.5, 'legR.hx': -0.1, 'legR.kx': 0.3, 'legL.ax': 0.4, 'legR.ax': 0.4 } },
      { t: 1.8, p: { 'off.rx': -1.5, 'off.py': 0.14, 'off.pz': -1.05, 'hips.ry': 0, 'torso.ry': 0, 'torso.rx': 0.1, 'head.rx': 0.2, 'head.ry': 0, 'head.rz': -0.3, 'armL.sx': -2.7, 'armL.sz': 0.9, 'armL.ex': -0.5, 'armR.sx': -2.6, 'armR.sz': -0.9, 'armR.ex': -0.5, 'legL.hx': -0.4, 'legL.kx': 0.5, 'legR.hx': -0.1, 'legR.kx': 0.3, 'legL.ax': 0.4, 'legR.ax': 0.4 } },
      // roll up onto one knee, hands pushing off the ground
      { t: 2.25, p: { 'off.rx': -0.35, 'off.pz': -1.05, 'hips.py': 0.42, 'hips.ry': 0, 'torso.ry': 0, 'torso.rx': 0.75, 'head.rx': -0.5, 'head.ry': 0, 'armL.sx': -0.6, 'armL.ex': -0.3, 'armR.sx': -0.5, 'armR.ex': -0.3, 'armL.sz': -0.1, 'armR.sz': 0.1, 'legL.hx': -1.5, 'legL.kx': 1.9, 'legL.ax': -0.3, 'legR.hx': 0.2, 'legR.kx': 1.9, 'legR.ax': 0.3 } },
      { t: 2.65, p: { 'off.pz': -1.05, 'hips.py': 0.66, 'torso.rx': 0.35, 'head.rx': -0.2, 'legL.hx': -0.7, 'legL.kx': 0.9, 'legR.hx': 0.1, 'legR.kx': 0.7 } },
      { t: 3.0, p: { 'off.pz': -1.05 } },
    ],
    keepOffset: true,
  },
};

export const COMBO = ['jab', 'cross', 'kick'];

// two-handed overhead bat swing (gang members with a bat)
MOVES.bat = {
  dur: 0.6, hit: 0.3, reach: 1.5, heavy: true,
  keys: [
    { t: 0 },
    { t: 0.22, p: { 'armR.sx': -2.7, 'armR.sz': 0.3, 'armR.ex': -1.2, 'armL.sx': -2.6, 'armL.sz': -0.3, 'armL.ex': -1.3, 'torso.ry': 0.55, 'torso.rx': -0.15, 'hips.ry': -0.2 } },
    { t: 0.32, ease: 'snap', p: { 'armR.sx': -0.9, 'armR.sz': 0.25, 'armR.ex': -0.2, 'armL.sx': -0.85, 'armL.sz': -0.25, 'armL.ex': -0.25, 'torso.ry': -0.35, 'torso.rx': 0.35, 'hips.ry': 0.1, 'legL.kx': 0.6 } },
    { t: 0.6 },
  ],
};

// Falling over and getting up, cut from the knockdown so all three line up exactly.
const KD = MOVES.knockdown.keys;
MOVES.fall = { dur: 0.7, keys: KD.filter((k) => k.t <= 0.7) };
MOVES.getup = { dur: 1.2, keys: KD.filter((k) => k.t >= 1.8).map((k) => ({ ...k, t: k.t - 1.8 })) };
export const LYING_T = 1.8; // time in the knockdown where the body lies still
