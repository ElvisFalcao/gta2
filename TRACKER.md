---
name: Mother City
category: Personal
client:
type: Game
stage: Building
tools: [Claude Code]
started: 2026-10-16
updated: 2026-10-23
target:
live: https://elvisfalcao.github.io/gta2/
repo: https://github.com/ElvisFalcao/gta2
plan: README.md
---

## Summary
An open-world adventure in a stylised, low-poly Cape Town that you play in the browser, on a phone or a computer. Sizwe wakes up on Camps Bay beach with no memory and works out who made a journalist disappear, through 10 story missions that end on election day. Between missions there are side jobs, a gym, beaches, the cableway, taxi fares and 15 hidden proteas. It's plain HTML and JavaScript with Three.js, with no build step; every model and sound is generated in code. It's live on GitHub Pages. `gta3` is a separate, smaller attempt at the same idea.

## Definition of Done
Done means a stranger can open the link on their phone, play the whole story without help, and want to share it. Items ticked on 2026-10-21 come from the README and the code layout; nobody had played it start to finish yet.

### Game
- [x] Stylised Cape Town about 1.6 km across, with its landmarks and a day/night cycle
- [x] Walking, driving on the left with working traffic lights, and fighting
- [x] Controls for phone touch, keyboard and mouse, and Xbox controller
- [x] 10 story missions, from Camps Bay to the ward election
- [x] Side jobs, free-roam activities, 15 hidden proteas and Respect
- [x] Police and wanted stars, busted and wasted
- [x] Saves automatically in the browser
- [x] Automated smoke test and a full story playthrough (Playwright)
- [x] Street voices: people greet, chat and react out loud, with speech bubbles (text-to-speech placeholders for now)

### Quality
- [ ] Played start to finish by a person, on the iPhone and on the PC, with what broke written down and fixed
- [x] Touch controls resized for small phones (iPhone 11 Pro), with GAS / BRAKE pedals for driving
- [ ] Touch controls confirmed comfortable on the iPhone 11 Pro by a person
- [ ] Smooth on an iPhone 11 Pro at Medium quality
- [x] Art direction chosen (A: sunny toon) and a look test built: one Bo-Kaap street + Sizwe and three locals (`lookdev.html`)
- [x] City, people, cars and HUD restyled in the game to match the look test (sunny toon)
- [ ] Sunny-toon restyle approved on the iPhone by a person
- [ ] New players understand what to do without reading the README
- [ ] Sound and music pass (all generated in code today)
- [ ] Kaaps, Afrikaans and isiXhosa street lines checked by native speakers
- [x] AI placeholder voices (Kokoro) for the ★ first-pass lines, checked with speech recognition
- [ ] Real voices recorded for the ★ first-pass lines in `assets/voice/SCRIPT.md`, with a signed release from every speaker

### Ship
- [ ] One home for the game: decide between gta, gta2 and gta3, and archive the others
- [ ] A public name and repo that don't lean on "GTA", which is a trademark
- [x] Installable app: Add to Home Screen icon, full screen from the home screen, works offline
- [ ] Shareable page: link preview image for WhatsApp / social
- [ ] Shown to first players, with their feedback collected

## Next up
- The sunny-toon restyle is live in all four stages (people + fighting, city, cars, HUD). Play it on the iPhone at https://elvisfalcao.github.io/gta2/ and note what looks off or runs slowly. If the old look still shows, reload once: the offline cache updates in the background.
- Possible polish next: toon colours on the minimap and big map. Medium quality is now about 770k triangles in Bo-Kaap and 990k in the city centre; if the iPhone stutters, drop tree outlines on Medium too (`buildTrees` in `src/world/cityMeshes.js`).
- Check the restyled city on the iPhone at Medium quality; Bo-Kaap is about 600k triangles and the city centre about 830k, so watch the frame rate there.
- On the iPhone: Add to Home Screen from https://elvisfalcao.github.io/gta2/ and play full screen; note anything about the touch buttons that still feels wrong.
- Play with sound on and listen to the AI street voices (`assets/voice/ai/`); fix spellings in `WORDS` in `tools/voice-gen/generate.py` and regenerate with `--ids <id> --force`.
- Get native speakers to check the Kaaps, Afrikaans and isiXhosa lines in `src/data/barks.js`.
- Record the ★ first-pass voice lines as `assets/voice/<voice>/<id>.mp3`, then run `node tools/voice-script.mjs`.
- Decide which repo is the real Mother City (gta2 is far ahead of gta3; gta is empty).
- Run `npm run playthrough` after changes to check all 10 missions still complete.

## Log
- 2026-10-23 · Claude Code · Waterfront, boats and murals restyle: the Wharf gets shopfront glass, upper windows and striped awnings; brighter clock tower, aquarium with portholes and fish-and-chips canopy; rounded outlined gondolas on the big wheel; chubby inked harbour boats and container ships; Woodstock murals repainted as cartoon murals (protea, Table Mountain, a face or a snoek, plus a slogan) with ink frames.
- 2026-10-23 · Claude Code · Polish pass: smooth toon mountains with ink silhouettes and brighter fynbos / sandstone colours, a fuller tablecloth cloud, puffy outlined tree crowns and rounder bushes (no tree outlines on Low quality), toon landmarks with ink shells (stadium, castle rebuilt as five walls, cable car, lighthouse). `tools/scenarios/landmarks.mjs` screenshots them.
- 2026-10-23 · Claude Code · HUD and menus restyle (stage 4): cream sticker panels with ink borders and hard drop shadows, ink-outlined numbers, Lilita One for big titles, comic speech bubbles, restyled touch buttons, menu and title screen. `tools/scenarios/hudsheet.mjs` screenshots the HUD, a choice and the menu.
- 2026-10-23 · Claude Code · Cars restyle (stage 3): every vehicle rebuilt from rounded toon shells with ink outlines, big round headlights, chrome bumpers, a Quantum-style taxi nose and outlined chunky wheels; same sizes and handling. `tools/scenarios/carsheet.mjs` makes a line-up contact sheet.
- 2026-10-23 · Claude Code · City restyle (stage 2): toon buildings with cartoon window frames, Cape Dutch gables on Bo-Kaap and Victorian rows, ink outlines on every building, brighter palettes; ground, roads and trees toon-shaded. `tools/scenarios/tour.mjs` and `perf.mjs` for screenshots and triangle counts.
- 2026-10-23 · Claude Code · Game people restyle (stage 1): everyone in the game is now a sunny-toon skinned character with bending joints, the jab / cross / kick combo, guard stance, knockdown and get-up, hit-stop and POW bursts.
- 2026-10-23 · Claude Code · Look test: fighting — guard stance, jab / cross / roundhouse-kick combo with input buffering, hit reactions, knockdown and get-up, hit-stop, camera shake and POW bursts (`src/lookdev/moves.js`, `tools/lookdev-fight.mjs`). Mechanics handover in `docs/mechanics-handover.md`.
- 2026-10-23 · Claude Code · Look test: characters now bend at elbows, wrists, knees and ankles, with a real walk and run cycle, idle weight shifts, an elbow wave and a proper sitting pose; `tools/lookdev-anim.mjs` makes filmstrips.
- 2026-10-23 · Claude Code · Look test for art direction A (sunny toon): `lookdev.html` + `src/lookdev/` — toon shading, ink outlines, rounded characters with painted faces, Bo-Kaap street, golden hour / midday / night.
- 2026-10-22 · Claude Code · Mobile: compact icon touch buttons sized for small phones, GAS/BRAKE pedals, joystick resting ring; installable app (icons, manifest, service worker, iPhone Add to Home Screen hint, offline); compact title screen on short screens.
- 2026-10-22 · Claude Code · AI placeholder voices for the 303 first-pass street lines (Kokoro, generated locally; real recordings override them); generator in tools/voice-gen.
- 2026-10-22 · Claude Code · Street voices: ~170 lines of reactive and ambient dialogue with speech bubbles, text-to-speech placeholders, a recording script and manifest tool, and a Street voices setting.
- 2026-10-21 · Claude Code · Real summary, Definition of Done and Next up written from the README, the code and the commit history.
- 2026-10-21 · Room · Tracking started from the dashboard.
- 2026-10-20 · Claude Code · Xbox controller support and the ABXY touch layout.
- 2026-10-16 · Claude Code · Mother City prototype: city, 10 missions, polish, single-file build.
