# Mechanics handover: what was added after the core game

This file lists the gameplay systems added on top of a working open-world prototype: on-foot movement,
driving, missions, police, HUD and saves. It covers **mechanics only**: controls, input, audio and voice,
animation and combat logic, app packaging and testing. Visual style, art direction, colours, models and
level art are deliberately left out.

Each section gives what the system does, how it works, the numbers that worked, and the pitfalls hit on
the way. The original was plain ES modules + Three.js (no build step), but the ideas are engine-agnostic.

---

## 0. Bug fix that came first: the character vanished when punching

**Symptom:** the player model disappeared for the duration of every punch.
**Cause:** the animation code computed attack progress as `t / attack.dur`, but the attack spec stored its
duration on `attack.spec.dur`. `undefined` gave `NaN`, NaN went into the bone rotations, and a mesh with NaN
transforms simply isn't drawn. Nothing crashed, which made it hard to spot.
**Fix:** use the right field, and clamp the animation parameter defensively:
`const t = Number.isFinite(s.actionT) ? clamp(s.actionT, 0, 1) : 0;`.
**Lesson:** when a skinned / rigged character "disappears", check for NaN in its matrices first. A
headless test now walks the skeleton every frame of an attack and fails if any matrix element is non-finite.

---

## 1. Xbox / standard gamepad support

**Polling.** The Gamepad API is poll-only. Poll the first connected pad (`navigator.getGamepads()`, at least
10 buttons) once at the start of every frame, *including while paused*, so menus still respond.

**Edge detection.** Keep the previous frame's button states and derive `held[action]` and
`pressed[action]` (true only on the frame a button goes down). Merge them into the same `held()` /
`pressed()` / `consume()` API the keyboard and touch buttons use, so gameplay code never knows which device
it's talking to.

**Sticks.** Radial-ish dead zone 0.18, rescaled so input starts at 0 just outside it:
`dz(v) = |v| < 0.18 ? 0 : (v - sign(v)*0.18) / (1 - 0.18)`. Left stick = movement (normalised if the
diagonal exceeds 1). Right stick = camera: `yaw -= rx * 2.6 * dt * sensitivity`,
`pitch += ry * 1.2 * dt * sensitivity`.

**Driving.** Analogue triggers: `throttle = RT - LT` when a trigger is pressed. If a pad is in use and
neither a trigger nor W/S is pressed, throttle is 0 (the stick only steers).

**Mapping (standard layout).**

| Button | On foot | In car | Menus |
|---|---|---|---|
| Left stick / right stick | move / camera | steer / camera | pan map |
| RT / LT | punch / – | gas / brake + reverse | zoom map |
| A | hold to sprint | – | advance dialogue, confirm, set waypoint |
| B | punch (combo) | – | back / close |
| X | jump | – | – |
| Y | enter vehicle | exit vehicle | clear waypoint (map) |
| LB / RB | talk / action | – / handbrake | previous / next tab |
| L3 / R3 | horn / snap camera behind | horn / snap camera | – |
| D-pad ← ↓ → | radio · taxi job · action | radio · taxi job | ↑↓ pick dialogue choice |
| View / Menu | map | map | close |

**Rules that made it feel right:**
- A `usingGamepad` flag flips on with any stick or button activity and off on keyboard or touch input. Use it
  to hide the on-screen touch controls, to swap prompt glyphs (show "LB Talk" instead of "E Talk", with
  Xbox-coloured A/B/X/Y chips), and to switch tutorial hints.
- Dialogue choices: the d-pad moves a highlight and A picks. Overlays (phone messages, flashbacks) close on A
  or B. Consume every overlapping action (`confirm`, `advance`, `attack`, `jump`) when a button closes
  something, or the same press also throws a punch.
- Title screen: A presses the first visible button (Continue / New Game).
- Rumble through `gamepad.vibrationActuator.playEffect('dual-rumble', {duration, strongMagnitude, weakMagnitude})`
  on hits and crashes, falling back to `navigator.vibrate` on phones.
- Show a "Controller connected" toast once.
- Minigames with their own loop must do their own edge detection on `held`, because the shared `pressed`
  flags may already be cleared by the time their loop runs.

**Testing.** Stub `navigator.getGamepads` with a fake pad object (17 buttons with `pressed`/`value`, 4 axes,
a `vibrationActuator`) and assert each binding: stick moves the player, RT accelerates, LT brakes, Y
enters and exits, Menu pauses, RB switches tabs, View opens the map, A sets a waypoint, and so on.
Pitfall: when the test browser renders slowly, a 250 ms fake tap can start and end inside one frame and never
be polled. Hold test presses for longer than a slow frame.

---

## 2. Mobile touch controls (redesign after phone testing)

Feedback on a small phone (iPhone 11 Pro, 812×375 landscape) was "confusing" and "buttons too big".
The fixes:

- **Size from the screen height, not fixed pixels:** primary button `clamp(54px, 16vh, 74px)`, secondary
  `clamp(44px, 11.5vh, 54px)` (44 px is Apple's minimum touch target), gaps `clamp(6px, 2vh, 10px)`. The
  cluster went from about half the screen height to about a quarter.
- **Icons with tiny labels** instead of letter buttons; the gamepad letters belong to the gamepad only.
- **Context-sensitive:** only show what the player can do right now. The "Car" button appears only next to an
  enterable car, the action pill only when there's something to interact with, and the taxi button only in a
  minibus.
- **On foot:** PUNCH (primary, corner), JUMP left of it, RUN above it, CAR above JUMP, ACTION pill further left.
- **Driving with pedals:** GAS (tall primary) and BRAKE (hold to reverse) on the right; the left stick only
  *steers*. Pushing the stick up to accelerate was the main source of confusion. Small HANDBRAKE, HORN,
  RADIO and EXIT buttons sit above or beside the pedals. Input rule: pedal state beats everything; while the
  touch stick is active and no pedal or W/S is held, throttle = 0.
- **Joystick:** floating (appears where the thumb lands), with a faint resting ring at its home spot so new
  players know where to put their thumb. On release it returns home; its size is also `vh`-based.
- **Safe areas:** offset everything by `env(safe-area-inset-*)`, which the notch on landscape iPhones needs.
- **Short-screen layout** (`@media (max-height: 500px)`): compact title screen with buttons in a row and the
  logo scaled to the height.

---

## 3. Installable app (PWA): home screen, full screen, offline

- **Manifest:** `display: "fullscreen"` with `display_override: ["fullscreen","standalone"]`,
  `orientation: "landscape"`, PNG icons 192 / 512, plus a maskable 512 with ~10 % padding (SVG icons alone
  aren't enough for iOS or Android installs).
- **iOS meta:** `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`,
  `apple-mobile-web-app-title`, and `apple-touch-icon` as a 180×180 PNG.
- **Key iOS fact:** iPhone Safari does not allow element fullscreen inside the browser, so "Add to Home
  Screen" is the only way to get true full screen. Detect iOS Safari when it isn't running standalone
  (`navigator.standalone`, or `matchMedia('(display-mode: standalone)')`) and show a one-line hint on the title
  screen: "tap Share, then Add to Home Screen".
- **Android / desktop Chrome:** capture `beforeinstallprompt`, `preventDefault()` it, and show your own
  "Install the app" button that calls `prompt()`.
- **Service worker:** precache the core files; serve everything stale-while-revalidate (cached response
  immediately, refresh in the background), so an update appears on the next launch. Navigations fall back to
  the cached `index.html` when offline.
  - Don't register it on `localhost` unless a `?sw` flag is set. Otherwise it serves stale code while you
    edit, and automated tests run old builds.
  - Don't register it inside an iframe either.
- **Test:** load once with the SW on, reload while it controls the page, set the browser context offline,
  reload again, and assert the game still boots.

---

## 4. Street voices: reactive and ambient NPC dialogue

**What it does:** pedestrians talk. They greet the player, chat in the background, and react out loud when
bumped, nearly run over, hooted at, punched, carjacked or chased. Gang members taunt and cops shout during
chases. A speech bubble follows the speaker, with a translation line for non-English slang.

**Data:** one file holds every line, grouped by category. Each line is `[id, text, gloss?, voicesOnly?]`, so it
has a stable id for audio files and an optional subtitle translation. Each category also has:
- `voices`: which voice types may say it
- `cooldown`: seconds before the category can fire again
- `area`: optional, district-only lines

Categories used:
- ambient and night ambient
- greet, bumped, near-miss, honked
- hurt, fight-back, witness, wanted
- carjacked
- beach, food, taxi rank
- two district-specific sets
- gang taunt and gang hurt
- cop chase and cop hurt

The first set came to ~170 lines.

**Voice types:** older woman, young woman, older man, young man, gang member, cop. Pick a pedestrian's voice
deterministically from their appearance and id: gang → thug, police → cop, otherwise gender cues plus a
hash for age. Named mission characters map to fixed voices.

**Triggers (hooks):**
- Taking a hit from the player → hurt / fight-back / gang hurt / cop hurt.
- The panic radius around a fight → witness (50 % chance per bystander, still subject to cooldowns).
- Dodging a car the player drives → near-miss.
- Horn → the nearest pedestrian *in front of the car* answers (try candidates in distance order, because the
  closest one may be on cooldown).
- Sprinting into someone → bumped.
- Being dragged out of a car → carjacked (forced).
- Scripted mission "barks" go through the same system under the character's voice.
- **Ambient scheduler:** every 4–9 s (when nothing is playing and no cutscene or dialogue is open), pick one of
  the 3 nearby civilians who spoke longest ago (within 16 m), then roll context categories in order:
  wanted > greet (player within 4.5 m) > taxi rank > food stall > beach > district > night or day ambient.

**Rules that matter:**
- One speaker at a time. Every line has a priority (ambient 1 … hurt and carjack 5, scripted 6); a
  higher-priority line interrupts a lower one, never the reverse.
- Per-category cooldowns, a per-person cooldown (6 s), and "don't repeat the last 14 lines".
- Only within hearing range (30 m); volume falls off with distance, and recorded clips are stereo-panned by
  the speaker's side relative to the camera.
- Stop all voices when pausing. Setting: voices + bubbles / bubbles only / off.

**Playback chain** (best first):
1. a human recording for this voice
2. a human recording from a same-gender voice
3. an AI clip for this voice
4. browser `speechSynthesis`

TTS details:
- Prefer an `en-ZA` voice, then `en-GB`/`IE`/`AU`/`NZ`, then any English voice.
- Split voices into male and female by name.
- Vary pitch and rate per person with a hash.
- Unlock TTS from the first user tap (iOS requires a gesture).

A `manifest.json` maps `voice → { lineId → path }` so the game knows which clips exist without probing the
network.

**Recording pipeline:** a script generates a per-voice recording script (Markdown + CSV) from the line data,
including the fixed-text mission barks it finds in the mission code. It marks a "first pass" of one female
and one male take per line (303 of 563 clips), because the borrow rule covers the rest. After recording, it
rebuilds the manifest; recorded lines get ✅ and AI ones 🤖.

---

## 5. AI placeholder voices (generated offline, not cloned)

- No cloud keys were available, so lines were generated locally with an open-weight TTS model (Kokoro-82M,
  Apache-2.0, ONNX runtime). Six voice types were made by **blending** built-in voice style vectors
  (weighted average), plus a per-type speed and an ffmpeg pitch factor
  (`asetrate=sr*p,aresample=sr,atempo=1/p`).
- **Pronunciation per word:** split each line into runs by language.
  - English words go through espeak `en-gb`.
  - Afrikaans words and lines use espeak `af`.
  - Words from a language espeak lacks (isiXhosa) borrow a close language's rules (Swahili: vowels match,
    clicks are approximated as k).
  - Slang is respelled for English phonemes, e.g. "Ey" → "eh", "bru" → "broo", "braai" → "bry".
  - Phonemes are passed straight to the model.
- **Post-processing:** 80 ms lead and 120 ms tail silence, high-pass at 70 Hz, loudness-normalised
  (`loudnorm I=-16`), mono 24 kHz, MP3 48 kbps (~14 KB per clip, ~4 MB for 303).
- **QA without listening:** run every clip through speech recognition (Whisper base.en via sherpa-onnx) and
  score the transcript against the script. That caught "Ey" being read as "I" and a mispronounced word.
  - Gotcha: the int8 quantised recogniser occasionally hallucinates ("the the the…") on clean clips; recheck
    those with the full-precision model before regenerating anything.
- Real recordings always override AI clips (separate folder, checked first).

---

## 6. Jointed characters and procedural locomotion

**Rig:** hips → spine → head, shoulder → elbow → wrist, hip → knee → ankle. Each rigid segment is one
mesh parented to a pivot group, so there's no skinning. A ball at the shoulder, elbow and knee hides the seams.
An extra **offset group at the feet** sits between the root and the hips; moves use it for lunges, knock-back
and falling over (it rotates around the feet).

**Walk / run cycle (all procedural):**
- Phase advances with *distance*, not time: `phase += 2π · speed / strideLength · dt`. Stride length is
  1.4 m walking, blending to 2.4 m running. This stops foot sliding.
- Walk-to-run blend `run = clamp((speed - 2) / 1.5, 0, 1)`; standing-to-walking blend `k = min(1, speed / 1.2)`.
- Per leg (legs half a cycle apart):
  - thigh `= -sin(φ) · (0.5 + 0.35·run) · k`
  - knee `= (0.08 + max(0, cos φ)^1.5 · (0.95 + 0.7·run)) · k`; the knee folds while the leg swings
    forward and stays nearly straight in stance
  - ankle `= -(thigh + knee) · 0.75`, plus a toe-off flick behind and a heel strike in front
- Hips:
  - bob `|cos φ| · (0.045 + 0.06·run)`, lowest at double support
  - side sway, plus a twist `-sin φ · 0.14`
- Shoulders counter-twist `sin φ · (0.26 + 0.1·run)`. Forward lean is `0.06 + 0.22·run`.
- Arms swing opposite the legs. Elbows are always slightly bent and bend more on the forward swing, and a lot
  when running (`elbow = -(0.18 + 0.25k + max(0, fwd)·0.45k + 0.9·run)`). Wrists follow.
- Head counter-rotates to stay level and looking ahead.
- Idle: slow weight shift between the feet (one knee relaxes), breathing, glancing around.
- Extra poses: an elbow wave (upper arm out, forearm up, waving from the elbow) and sitting (thighs forward,
  knees ~90°, hands on thighs).
- Smooth the speed input (`speed += (target - speed) · min(1, dt·6)`) so gait changes blend.
- Run input: Shift, or the touch stick pushed fully (> 0.95).

**Testing:** render filmstrips (side view, 6 phases of one stride) for walk and run, and look at them.
Gotcha: a test helper that forgot to pass the speed argument made the dt `NaN`, and the character vanished
(see §0).

---

## 7. Combat: stance, 3-hit combo, reactions, impact feel

**Pose system:**
- Every move is a list of keyframes `{ t, ease?, p: { 'armL.sx': -1.6, 'hips.ry': -0.6, … } }` over named
  joints. Anything a key leaves out comes from the GUARD pose.
- Interpolation is smoothstep; strike keys use a "snap" ease, fast out with ~1.3 back-overshoot:
  `u' = 1 + 2.3·(u-1)³ + 1.3·(u-1)²`.
- Blend order each frame: locomotion pose → fight stance (weight ramps in when fighting) → current move
  (weight ramps in over 60 ms).
- Out of stance, the move fades out over its last 120 ms.
- While moving in a stance, the legs keep the locomotion cycle (a shuffle) and the upper body keeps the guard.

**Stance:** knees bent, lead foot forward, hips turned ~25°, hands up, light bounce (`sin(7.5t)·1.2 cm`),
small sway.

**The combo:** repeated presses chain jab → cross → kick. The combo resets if there's no press within 0.7 s
after a move ends. A press during a move is **buffered** and fires the next move as soon as the current one
ends, which is the difference between "mashy" and "fluid".
- **Jab** (lead hand): 0.36 s, hit at 0.11 s. A small load, snap out with the torso turning into it, a short
  hold, retract.
- **Cross** (rear hand): 0.46 s, hit at 0.16 s.
  - Wind-up: the shoulder goes back.
  - Hips and shoulders rotate through (hips −0.6 → +0.12, torso → +0.9).
  - Rear heel pivots up; small lunge forward.
- **Roundhouse kick** (rear leg): 0.78 s, hit at 0.34 s, heavy.
  - Chamber: knee up, folded ~2.1 rad.
  - Snap: hips turn over ~1.3 rad, leg out to the side and extended, torso leans away, arms counterbalance.
  - Then re-chamber and return to guard.
- **Hit timing:** fire the hit callback *after* that frame's pose is applied and the matrices are updated,
  so the impact position (fist or foot world position) is current. Reading it before was one frame stale,
  and the effect spawned next to the attacker.
- **Reach check:** the hit lands only if the fighters are within `reach + 0.25 m`
  (jab 1.05, cross 1.15, kick 1.25). Otherwise it whiffs.
- **Hit reaction** (0.42 s): head snaps back and turns, torso rocks back, arms fly up, a 24 cm step back.
- **Knockdown** (kick, 3 s):
  - Thrown back about 1 m.
  - Fall: the offset group rotates −1.5 rad around the feet.
  - A small bounce, then lying dazed with the head rolling side to side.
  - Rolls up onto one knee with hands pushing off, stands back into guard.
- **Root motion:** steps taken inside a move live in the offset group; at the end of moves flagged
  `keepOffset`, bake the offset into the real position (rotated by the facing) and zero it, so there's no
  snap back.
- Between moves, both fighters face each other, and the attacker shuffles back to 1.12 m spacing (the legs use
  the walk cycle at the shuffle speed).

**Impact feel** (cheap and high-value):
- **Hit-stop:** freeze both fighters' animation for 70 ms on punches and 130 ms on the kick; the world and
  camera keep running.
- **Camera shake:** amplitude 0.1 (punch) / 0.22 (kick), decaying at 1.2 per second.
- **Burst sprite** at the contact point ("POW!", "BAM!", "KAPOW!" for the kick): pop in over 80 ms with a
  wobble, drift up, fade by 0.55 s.
- **Rumble** on a gamepad (see §1).

**Demo mode:** if the player does nothing for 1.6 s in fight mode, the character throws the combo by itself.
Useful for showing it off and for testing.

**Testing:** a contact sheet that triggers the combo and samples a frame every 0.12 s (30 frames) shows the
whole sequence at a glance: jab, cross, kick, the knockdown and the get-up.

---

## 8. Testing approach used throughout

- A headless browser (Playwright, software WebGL) drives the game through a test hook,
  `game.simulate(seconds)`, which steps the fixed-timestep update without real time.
- Each scenario prints PASS / FAIL lines:
  - **story:** an autopilot plays every mission in order
  - **punch:** NaN and visibility check through 6 attacks
  - **gamepad:** every binding
  - **voice:** a stubbed `speechSynthesis` checks ambient, every trigger, bubbles, the recorded-clip path
    (serve a generated WAV for one line) and the "off" setting
  - **mobile:** a phone viewport with real touch events on the pedals
- Screenshot and filmstrip tools exist for anything visual or motion-related; look at the images, because
  numbers alone missed half the problems.
