# Voice test: Google Flow

Three test clips to see whether Google Flow's voices beat the Kokoro placeholders. Each character is made as a still image with Nano Banana, then animated in Flow so they speak three street lines from `src/data/barks.js`, with a pause between lines. `tools/voice-flow.mjs` cuts the audio at those pauses and saves each line where the game finds it.

| # | Game voice | Character | Lines (ids) | Tests |
|---|---|---|---|---|
| 1 | `bra` | Young Black South African man from Langa, isiXhosa speaker | `greet_molo`, `amb_loadshedding`, `greet_howzit_bru` | isiXhosa greeting, township English |
| 2 | `aunty` | Cape Malay aunty from the Bo-Kaap | `bk_mos`, `greet_aunty_baby`, `bump_jislaaik` | Kaaps |
| 3 | `oom` | Older coloured oom from Woodstock, Afrikaans speaker | `greet_oom_youngster`, `amb_ja_nee`, `miss_mal` | Afrikaans |

## How to make each clip

1. **Image:** paste the image prompt into Nano Banana and keep the best portrait.
2. **Video:** in Flow, start a video from that image (as the first frame), choose 8 seconds with sound on, and paste the video prompt.
3. Download the MP4. Keep the portrait too: it could become the character's face in the dialogue box.

The images use the game's sunny-toon look, so the portraits match the game. If a voice comes out too cartoony, run the same prompts again with "photorealistic portrait" in place of the style sentence, and compare.

---

### 1 · `bra`, young Black South African man

**Image prompt**

> A stylised 3D cartoon character portrait in a sunny toon style: rounded, chunky proportions, soft cel shading, bold dark ink outlines, bright saturated colours and a painted, expressive face, like a modern animated film. A young Black South African man of about 25 from Langa, Cape Town: warm dark-brown skin, short twists, a light goatee and a broad, friendly grin. He wears a yellow-and-green tracksuit top over a white T-shirt and a navy bucket hat. Chest-up, facing the camera, relaxed, mouth closed. Behind him, out of focus, a sunny township street with brightly painted houses and Table Mountain in the distance. 16:9.

**Video prompt**

> The young man looks into the camera and chats like he's greeting a friend on the street: relaxed, warm, a little loud. He is an isiXhosa-speaking man from Cape Town and has a natural South African township accent, not American and not British. He says three short lines, with a clear one-second pause between them.
> He says: "Molo, bhuti!"
> He pauses, nods, then says: "Eish, load shedding again tonight. Stage four!"
> He pauses, grins, then says: "Howzit, bru."
> Static camera. Only his voice: no music, no background chatter, no sound effects, no subtitles.

---

### 2 · `aunty`, Cape Malay aunty from the Bo-Kaap

**Image prompt**

> A stylised 3D cartoon character portrait in a sunny toon style: rounded, chunky proportions, soft cel shading, bold dark ink outlines, bright saturated colours and a painted, expressive face, like a modern animated film. A Cape Malay aunty in her sixties from the Bo-Kaap, Cape Town: warm light-brown skin, laugh lines, round glasses, a bright patterned headscarf and a cardigan over a floral dress. A motherly, slightly teasing smile. Chest-up, facing the camera, mouth closed. Behind her, out of focus, the bright pink, green and yellow houses of the Bo-Kaap. 16:9.

**Video prompt**

> The aunty looks into the camera and talks like she's on her front stoep chatting to a neighbour's boy: warm, motherly, a bit bossy. She is from the Bo-Kaap in Cape Town and speaks with a natural Cape Coloured (Kaaps) accent, not American and not British. She says three short lines, with a clear one-second pause between them.
> She says, proudly, in Afrikaans: "Ja, ons is mos hier gebore."
> She pauses, tilts her head, then says kindly: "Shame, you look hungry, my baby."
> She pauses, then jumps back startled and says: "Jislaaik! Careful!"
> Static camera. Only her voice: no music, no background chatter, no sound effects, no subtitles.

---

### 3 · `oom`, older Afrikaans-speaking oom from Woodstock

**Image prompt**

> A stylised 3D cartoon character portrait in a sunny toon style: rounded, chunky proportions, soft cel shading, bold dark ink outlines, bright saturated colours and a painted, expressive face, like a modern animated film. A Cape Coloured oom in his sixties from Woodstock, Cape Town: warm brown skin, a thick grey moustache, bushy eyebrows, a flat cap and a brown knitted cardigan over a collared shirt. A stern face with a hint of humour. Chest-up, facing the camera, mouth closed. Behind him, out of focus, an old Woodstock street with Victorian terrace houses and a colourful mural. 16:9.

**Video prompt**

> The older man looks into the camera and talks like an uncle telling off a youngster on the street: deep, slow, gravelly, dry humour. He is an Afrikaans-speaking man from Cape Town and has a natural Cape Afrikaans accent, not American and not British. He says three short lines, with a clear one-second pause between them.
> He says, wagging a finger: "Môre, jong. Behave yourself, hey."
> He pauses, shrugs, then says: "Ja nee. That's life."
> He pauses, then shouts, outraged, in Afrikaans: "Is jy mal?!"
> Static camera. Only his voice: no music, no background chatter, no sound effects, no subtitles.

---

## What to listen for

- **Accent:** does it sound like Cape Town, or like the US or the UK?
- **Words:** are "Molo, bhuti", "Ja, ons is mos hier gebore" and "Is jy mal" said properly, or mangled?
- **Script:** does it say exactly the lines? Flow sometimes adds or changes words.
- **Gaps:** are there clear pauses between the three lines? Without them the clip can't be cut.
- **Clean audio:** no music or crowd noise under the voice.
- **Same person:** if you make a second clip of a character, does it sound like the same person? The game needs about 90 lines per voice, so this matters most if Flow is going to replace all of them.

## Bringing a clip into the game

Send the MP4s (and the portraits) in the chat, or upload them to `assets/voice/flow/src/` on GitHub. Then:

```bash
node tools/voice-flow.mjs bra.mp4 bra greet_molo,amb_loadshedding,greet_howzit_bru
```

```bash
node tools/voice-flow.mjs aunty.mp4 aunty bk_mos,greet_aunty_baby,bump_jislaaik
```

```bash
node tools/voice-flow.mjs oom.mp4 oom greet_oom_youngster,amb_ja_nee,miss_mal
```

Each line becomes `assets/voice/flow/<voice>/<id>.mp3` and the manifest is refreshed. In the game a Flow clip takes the place of the Kokoro one, and a real recording in `assets/voice/<voice>/` still wins over both. If the cut lands in the wrong place (for example the clip has background noise), try `--noise -30` or `--gap 0.2`.
