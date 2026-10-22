---
name: Mother City
category: Personal
client:
type: Game
stage: Building
tools: [Claude Code]
started: 2026-10-16
updated: 2026-10-22
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
- [ ] Smooth on an iPhone 11 Pro at Medium quality
- [ ] New players understand what to do without reading the README
- [ ] Sound and music pass (all generated in code today)
- [ ] Kaaps, Afrikaans and isiXhosa street lines checked by native speakers
- [ ] Real voices recorded for the ★ first-pass lines in `assets/voice/SCRIPT.md`, with a signed release from every speaker

### Ship
- [ ] One home for the game: decide between gta, gta2 and gta3, and archive the others
- [ ] A public name and repo that don't lean on "GTA", which is a trademark
- [ ] Shareable page: title, link preview image, Add to Home Screen icon
- [ ] Shown to first players, with their feedback collected

## Next up
- Review the street lines in `src/data/barks.js` (or `assets/voice/SCRIPT.md`) and get native speakers to check the Kaaps, Afrikaans and isiXhosa.
- Record the ★ first-pass voice lines as `assets/voice/<voice>/<id>.mp3`, then run `node tools/voice-script.mjs` so the game uses them.
- Play the whole story on the iPhone at https://elvisfalcao.github.io/gta2/ and note what breaks.
- Decide which repo is the real Mother City (gta2 is far ahead of gta3; gta is empty).
- Run `npm run playthrough` after changes to check all 10 missions still complete.

## Log
- 2026-10-22 · Claude Code · Street voices: ~170 lines of reactive and ambient dialogue with speech bubbles, text-to-speech placeholders, a recording script and manifest tool, and a Street voices setting.
- 2026-10-21 · Claude Code · Real summary, Definition of Done and Next up written from the README, the code and the commit history.
- 2026-10-21 · Room · Tracking started from the dashboard.
- 2026-10-20 · Claude Code · Xbox controller support and the ABXY touch layout.
- 2026-10-16 · Claude Code · Mother City prototype: city, 10 missions, polish, single-file build.
