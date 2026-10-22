# Mother City 🇿🇦

**An open-world, GTA-style adventure set in a stylised Cape Town — playable in the browser on your phone or computer.**

Sizwe wakes up on Camps Bay beach with no memory, a cracked phone and one strange message:
*“The lion keeps the key. Don't trust the Jackal's table.”*
Help the people of the Mother City, earn **Respect**, and slowly work out who made a journalist disappear —
and why a property developer called Silverleaf is trying to buy the mayor's office.

Between missions you can do whatever you like: hit the outdoor gym in Sea Point, chill on the beach,
grab a Gatsby on Long Street, ride the cableway up Table Mountain, run minibus-taxi fares,
help strangers with side jobs, or hunt for the 15 hidden proteas.

---

## Play it

No build step and no install — it's plain HTML + JavaScript (Three.js is vendored in `vendor/`).

```bash
# any static web server works, for example:
npx http-server -p 8080 -c-1 .
# or
python3 -m http.server 8080
```

Then open <http://localhost:8080>. To play on your phone, open the same address from a phone on the same Wi-Fi
(using your computer's IP), or host it on GitHub Pages (below). Turn the phone sideways.

### Put it online with GitHub Pages (free)

1. In the repository on GitHub: **Settings → Pages**.
2. *Source*: **Deploy from a branch** → pick the branch (e.g. `main`) and the **/ (root)** folder → **Save**.
3. After a minute it's live at `https://<your-user>.github.io/gta2/`. Open that link on your phone and tap
   **Share → Add to Home Screen** to get a full-screen app icon.

### One-file build

`node tools/build-single.mjs` writes `dist/mother-city.html`: the whole game (CSS, code and Three.js) in a single
~820 KB HTML file you can host anywhere or open offline from a local server.
Add `--cdn` to load Three.js from jsDelivr instead (~300 KB file).

### Controls

| | Phone / tablet | Keyboard & mouse |
|---|---|---|
| Walk / drive | Drag on the **left** half (push up = gas, down = brake/reverse) | **W A S D** / arrows |
| Look around | Drag on the **right** half | Drag with the mouse · **Q / Z** |
| Sprint | Hold **RUN** | **Shift** |
| Jump / handbrake | **JUMP** / **BRAKE** | **Space** |
| Punch (3-hit combo) | **PUNCH** | **J**, **K** or click |
| Get in / out of a car | **CAR / EXIT** | **F** or **Enter** |
| Talk / action | **ACTION** (appears when available) | **E** |
| Horn · radio · taxi job | **HORN · RADIO · TAXI JOB** | **H · R · T** |
| Map · pause | Tap the minimap · **❚❚** | **M** · **Esc** |

**Xbox controller** (or any pad with the standard layout — plug it in or pair it, then press a button):

| | Controller |
|---|---|
| Walk / steer · camera | **Left stick** · **right stick** (click **RS** to snap the camera behind you) |
| Gas · brake / reverse | **RT** · **LT** |
| Sprint · punch · jump | Hold **A** · **B** (or **RT** on foot) · **X** |
| Get in / out of a car | **Y** |
| Talk / action · handbrake | **LB** · **RB** |
| Horn · radio · taxi job | Click **LS** · **D-pad ←** · **D-pad ↓** |
| Dialogue choices | **D-pad ↑ ↓** then **A** |
| Map · pause | **View** · **Menu** (B goes back; LB / RB switch menu tabs; on the map the left stick pans, triggers zoom, **A** sets a waypoint) |

The controller rumbles on hits and crashes. On phones the on-screen buttons use the same A / B / X / Y layout and colours.

Drive on the **left** — this is South Africa. 🚦 Traffic lights ("robots") work, and so do the police.

---

## What's in the prototype

**The city** — a compressed, low-poly Cape Town about 1.6 km across:
Table Mountain (with its "tablecloth" cloud and a working cableway), Lion's Head, Signal Hill and the Noon Gun
(it fires at 12:00 every game day), Devil's Peak, the Twelve Apostles, Camps Bay & Clifton beaches,
the Sea Point promenade and outdoor gym, Green Point stadium and lighthouse, the V&A Waterfront
(big wheel, clock tower, marina), the City Centre grid with Long Street, Company's Garden, City Hall and the
Grand Parade, the Castle of Good Hope, the colourful Bo-Kaap, Woodstock's murals, Observatory and Langa
(taxi rank, shisa nyama, soccer pitch). Day/night cycle with the sun crossing the *northern* sky and setting over the Atlantic.

**Story missions** (unlocked in order, some need Respect):

| # | Mission | Where | What you do |
|---|---|---|---|
| 1 | Wake Up, Mother City | Camps Bay | Intro, walking & driving tutorial |
| 2 | Promenade Problems | Sea Point | Fight the Jackal crew, first clue |
| 3 | Poster Campaign | Grand Parade | Put up posters for Auntie Noma's mayoral campaign (timed), stop vandals |
| 4 | Taxi Talks | Station taxi rank | **Negotiate** with Bra Vusi (respect, bribe or fight), then do a taxi run to Langa |
| 5 | Deeds of the Bo-Kaap | Bo-Kaap → Woodstock | Raid Silverleaf's yard, recover title deeds, discover who Sizwe really is |
| 6 | The Lion's Key | Your safehouse | **Solve three riddles** around the city (hints appear if you're stuck) |
| 7 | Cable Car Confidential | Table Mountain | Persuade a whistle-blower on top of the mountain, protect him, escort him down |
| 8 | Debate Night | Grand Parade | Counter the villain's lies on stage with the right **evidence** from your notebook |
| 9 | Run, Jackal, Run | City Centre | Car chase — ram the villain's SUV, then catch him |
| 10 | Vote Sizwe! | All over | Run for ward councillor: win four communities, then give your speech |

**Side jobs** — strangers with a blue **?** ask for help: chase a phone snatcher, deliver koeksisters before they
go cold, find a lost dog, give someone a lift, or chase off skollies.

**Free-roam activities** — outdoor gym mini-game (muscle makes you hit harder and Sizwe bulks up), beaches
(heal + pass time), food stalls, cableway + viewpoint, minibus taxi fares, safehouse save & rest, 15 hidden proteas.

**Street voices** — people talk: they greet you, chat about load shedding and the Bokke, call out taxi routes at the
rank, sell Gatsbys, shout when you bump them, nearly run them over, hoot at them, punch them or take their car, and gang
members and cops shout during fights and chases — in English, Kaaps, Afrikaans and isiXhosa (with English subtitles in
the speech bubble). *Pause → Settings → Street voices* switches between voices + bubbles, bubbles only, or off.

**Respect** comes from missions, side jobs, taxi fares, gym sets, proteas and the view from Table Mountain.
Each new story mission shows how much it needs on the map and in the pause menu.

**Police** — punch people or run them over and you get stars. Cops chase on foot and in cars; get grabbed and
you're **BUSTED**. Break line of sight and lie low until the stars fade. Lose all your health and you're **WASTED**.

**Cheats** (Pause → Cheats): `LEKKER` +50 respect · `MOOLAH` +R5 000 · `EISH` clear wanted level ·
`BAKKIE` / `TAXI` / `VROOM` spawn a vehicle · `SUPERSIZWE` god mode · `NOPOLICE` · `DAY` / `NIGHT` ·
`GYMRAT` max muscle · `SKIPMISSION` pass the current mission.

Progress saves automatically (and at the safehouse) in your browser's local storage.
Graphics quality (Low / Medium / High) is in *Pause → Settings*; phones default to Medium.

---

## Project layout

```
index.html            page shell, HUD markup, touch controls, title screen
css/style.css         all UI styling (responsive, phone-first)
vendor/               three.module.min.js (r160, MIT)
src/main.js           boot + title screen
src/game.js           Game: renderer, systems, main loop, respawns, cheats
src/core/             util maths, input (touch/keyboard/mouse/gamepad), chase camera, mesh merging
src/world/            mapData (hand-made Cape Town layout), grid rasteriser, road graph,
                      procedural city generation, meshes, landmarks, sky/day-night
src/entities/         player, people (skinned blocky humans + dogs), vehicles
src/systems/          traffic & vehicles, police, population, particles/markers, audio, street voices, save
src/data/barks.js     every street line (with ids for the voice recordings)
assets/voice/         recording script, manifest and (once recorded) the voice clips
src/missions/         mission engine, story missions, side jobs, activities
src/ui/               HUD + minimap + GPS, pause menu + full map
tools/                headless smoke tests and an automatic story playthrough (Playwright)
```

### Recording real voices

Until someone records them, street lines are spoken by the browser's text-to-speech (a South African English voice
when the device has one). To replace them with real voices:

1. Run `node tools/voice-script.mjs`. It writes `assets/voice/SCRIPT.md` (a recording script per voice) and
   `assets/voice/script.csv`. Start with the **★ first-pass** lines: one woman's and one man's take of each line,
   which the other voices of the same gender borrow until their own takes exist.
2. Record each line as `assets/voice/<voice>/<id>.mp3` (`.m4a`, `.ogg` or `.wav` also work): mono, short, a little
   silence either side. Get a signed release from every speaker, and have native speakers check the Kaaps,
   Afrikaans and isiXhosa first.
3. Run `node tools/voice-script.mjs` again: it updates `assets/voice/manifest.json`, and the game plays the clips
   (panned towards the speaker) instead of text-to-speech. Anything still missing keeps using text-to-speech.

All lines live in `src/data/barks.js` — add a category or a line there and re-run the script.
The one-file build has no audio files, so it always uses text-to-speech.

### Writing a new mission

Missions are async functions that `await` objectives. Add one to `src/missions/story.js`:

```js
{
  id: 'm11', title: 'Surf Lesson', where: 'Muizenberg', after: ['m10'], respect: 160,
  reward: { respect: 10, money: 500 },
  giver: { x: -590, z: 300, look: LOOKS.kyle, name: 'Kyle', letter: 'K' },
  async run(api, kyle) {
    await api.talk([['Kyle', 'Bru! Ever surfed?']], { focus: kyle });
    await api.goTo(-600, 320, { text: 'Paddle out to the <em>marker</em>.' });
    const thugs = api.enemies([[-598, 318], [-596, 322]]);
    await api.defeat(thugs, 'Chase off the <em>board thieves</em>.');
  },
}
```

The `api` also has `choose()` (dialogue choices), `hold()` (hold ACTION at a spot), `collect()`, `enterVehicle()`,
`timer()`, `failIf()`, `phone()`, `memory()`, `vehicle()`, `ped()`, `marker()` and more — see
`src/missions/missionSystem.js`. If the player dies, gets busted or a fail condition triggers,
every pending objective is rejected and everything the mission spawned is cleaned up.

### Tests

```bash
npm i -D playwright            # once
npx http-server -p 8080 -c-1 . &
node tools/smoke.mjs "http://localhost:8080/index.html?quality=low" ./shots basic   # boots + intro
node tools/smoke.mjs "http://localhost:8080/index.html?quality=low" ./shots story   # plays all 10 missions automatically
node tools/smoke.mjs "http://localhost:8080/index.html?quality=low" ./shots gamepad # drives the game with a fake Xbox pad
node tools/smoke.mjs "http://localhost:8080/index.html?quality=low" ./shots voice   # street voices, bubbles, recorded clips
```

---

## Notes

* This is a prototype: everything (models, textures, sound, music) is generated in code — no asset files.
* Places are real Cape Town landmarks; all characters, companies and events are fictional.
* Three.js © its authors, MIT licence (`vendor/three.LICENSE`).
