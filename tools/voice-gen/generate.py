"""Generate AI placeholder voices for the street lines with Kokoro (open-weight, Apache-2.0 TTS).

    python3 -m venv .venv && .venv/bin/pip install -r tools/voice-gen/requirements.txt
    .venv/bin/python tools/voice-gen/generate.py            # the ★ first-pass lines
    .venv/bin/python tools/voice-gen/generate.py --all      # every voice for every line
    .venv/bin/python tools/voice-gen/generate.py --ids greet_howzit,amb_wind --force
    node tools/voice-script.mjs                              # then refresh the manifest

Clips go to assets/voice/ai/<voice>/<id>.mp3. A real recording in assets/voice/<voice>/ always
wins over these. Needs ffmpeg. The model (~330 MB) is downloaded once into tools/voice-gen/models/.

Kokoro has British and American English voices but no South African one, so the accent is only
an approximation. Afrikaans words are pronounced with espeak's Afrikaans rules; espeak has no
isiXhosa, so those words borrow Swahili rules (close for vowels, but there are no clicks).
"""

import argparse
import csv
import os
import re
import subprocess
import sys
import tempfile
import urllib.request

import numpy as np
import soundfile as sf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MODELS = os.path.join(os.path.dirname(__file__), 'models')
OUT = os.path.join(ROOT, 'assets', 'voice', 'ai')
RELEASE = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/'

# voice -> Kokoro style blend, speed, pitch factor (applied with ffmpeg)
VOICES = {
    'aunty': {'blend': {'bf_emma': 0.7, 'af_heart': 0.3}, 'speed': 0.92, 'pitch': 0.97},
    'sisi': {'blend': {'bf_lily': 0.5, 'af_bella': 0.5}, 'speed': 1.05, 'pitch': 1.02},
    'oom': {'blend': {'bm_george': 0.8, 'am_michael': 0.2}, 'speed': 0.9, 'pitch': 0.93},
    'bra': {'blend': {'bm_lewis': 0.6, 'am_puck': 0.4}, 'speed': 1.08, 'pitch': 1.0},
    'thug': {'blend': {'bm_daniel': 0.5, 'am_onyx': 0.5}, 'speed': 1.05, 'pitch': 0.94},
    'cop': {'blend': {'bm_fable': 0.7, 'am_eric': 0.3}, 'speed': 1.0, 'pitch': 0.98},
}

# Whole lines in another language.
AF_LINES = {
    'Ek gaan jou moer, jong!', 'Ek sal jou wys!', 'Goeie môre!', 'Hardloop!', 'Is jy mal?!',
    'Ja, ons is mos hier gebore.', 'Jirre, nou toet hy!', 'Kom, kom, kom! Ons ry!', 'Lekker bly, hoor!',
    'My kar! Bring terug my kar!', 'Pas op, jong!', 'Staan stil!', 'Wat gaan ons vanaand eet?',
    'Kaapstad! Kaapstad! Kaapstad!', 'Voetsek!', 'Private property! Voetsek!',
}
XH_LINES = {
    'Balekani!', 'Hhayi! Uyaphambana?', 'Imoto yam!', 'Kunjani namhlanje?', 'Molweni!', 'Ndiyabulela, mntase.',
    'Umntu ngumntu ngabantu.', 'Unjani?', 'Yima!', 'Suka!', 'Maye babo!', 'Langa, Langa! Siyahamba!',
    'Hayi bo, wena!', 'Molo, bhuti!', 'Yho, mama!',
}
# Single words inside English lines: (language, spelling to feed espeak).
WORDS = {
    'ag': ('af', 'ag'), 'lekker': ('af', 'lekker'), 'jislaaik': ('af', 'jislaaik'), 'ja': ('af', 'ja'), 'nee': ('af', 'nee'),
    'eina': ('af', 'eina'), 'nooit': ('af', 'nooit'), 'haai': ('af', 'haai'), 'jong': ('af', 'jong'), 'môre': ('af', 'môre'),
    'koeksisters': ('af', 'koeksisters'), 'vetkoek': ('af', 'vetkoek'), 'bokke': ('af', 'bokke'), 'voetsek': ('af', 'voetsek'),
    'laaitie': ('af', 'laaitie'), 'grootman': ('af', 'grootman'), 'muizenberg': ('af', 'muizenberg'), 'jirre': ('af', 'jirre'),
    'hayibo': ('xh', 'hayibo'), 'hayi': ('xh', 'hayi'), 'aikona': ('xh', 'aikona'), 'shisa': ('xh', 'shisa'), 'nyama': ('xh', 'nyama'),
    'umngqusho': ('xh', 'umnkusho'), 'sizobonana': ('xh', 'sizobonana'), 'khayelitsha': ('xh', 'kayelitsha'), 'langa': ('xh', 'langa'),
    'bhuti': ('xh', 'buti'), 'maye': ('xh', 'maye'), 'babo': ('xh', 'babo'),
    'eish': ('en', 'aysh'), 'eita': ('en', 'ayta'), 'heita': ('en', 'hayta'), 'howzit': ('en', 'how zit'), 'hoesit': ('en', 'hoo sit'),
    'bru': ('en', 'broo'), 'bra': ('en', 'brah'), 'oke': ('en', 'oak'), 'yoh': ('en', 'yaw'), 'yho': ('en', 'yaw'),
    'sisi': ('en', 'see see'), 'samoosas': ('en', 'suh moo suhs'), 'ey': ('en', 'eh'), 'braai': ('en', 'bry'), 'wynberg': ('en', 'wine berg'),
    'steyn': ('en', 'stain'), 'rashieda': ('en', 'ra sheeda'), 'noma': ('en', 'naw ma'), 'saps': ('en', 'ess, ay, pee, ess'),
    'r15': ('en', 'fifteen rand'), 'now-now': ('en', 'now now'), 'gatsby': ('en', 'gatsby'),
}
ESPEAK = {'en': 'en-gb', 'af': 'af', 'xh': 'sw'}

_backends = {}


def phonemize(text, lang):
    from phonemizer.backend import EspeakBackend
    if lang not in _backends:
        _backends[lang] = EspeakBackend(ESPEAK[lang], preserve_punctuation=True, with_stress=True)
    if lang == 'xh':  # no clicks in espeak: c/q/x clicks become k
        text = re.sub(r'(?i)n?g?[cqx](h?)', 'k', text)
    return _backends[lang].phonemize([text], strip=True)[0]


def to_phonemes(text):
    if text in AF_LINES:
        return phonemize(text, 'af')
    if text in XH_LINES:
        return phonemize(text, 'xh')
    # split into runs of words in the same language, keeping punctuation with them
    runs = []
    for tok in re.findall(r"[\w'’\-]+|[^\w\s]+|\s+", text):
        key = tok.lower().strip("'’")
        lang, spell = WORDS.get(key, ('en', tok)) if re.match(r'[\w]', tok) else (None, tok)
        if lang is None or (runs and runs[-1][0] == lang):
            if runs:
                runs[-1][1] += spell
            else:
                runs.append(['en', spell])
        else:
            runs.append([lang, spell])
    return ' '.join(phonemize(t, lang) for lang, t in runs if t.strip()).replace('  ', ' ')


def ensure_models():
    os.makedirs(MODELS, exist_ok=True)
    for f in ('kokoro-v1.0.onnx', 'voices-v1.0.bin'):
        p = os.path.join(MODELS, f)
        if not os.path.exists(p):
            print('downloading', f, '…', flush=True)
            urllib.request.urlretrieve(RELEASE + f, p + '.part')
            os.replace(p + '.part', p)
    return os.path.join(MODELS, 'kokoro-v1.0.onnx'), os.path.join(MODELS, 'voices-v1.0.bin')


def rows(all_voices, ids):
    with open(os.path.join(ROOT, 'assets', 'voice', 'script.csv'), newline='') as f:
        for r in csv.DictReader(f):
            vid = os.path.splitext(os.path.basename(r['file']))[0]
            if ids and vid not in ids:
                continue
            if all_voices or r['first_pass'] == 'yes':
                yield r['voice'], vid, r['line']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--all', action='store_true', help='every voice for every line, not just the first pass')
    ap.add_argument('--ids', default='', help='comma-separated line ids')
    ap.add_argument('--force', action='store_true', help='regenerate clips that already exist')
    a = ap.parse_args()

    import espeakng_loader
    from phonemizer.backend.espeak.wrapper import EspeakWrapper
    EspeakWrapper.set_library(espeakng_loader.get_library_path())
    EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
    from kokoro_onnx import Kokoro

    model, voices = ensure_models()
    k = Kokoro(model, voices)
    styles = {v: sum(k.get_voice_style(n) * w for n, w in cfg['blend'].items()) for v, cfg in VOICES.items()}
    ids = set(filter(None, a.ids.split(',')))
    todo = [r for r in rows(a.all, ids) if a.force or not os.path.exists(os.path.join(OUT, r[0], r[1] + '.mp3'))]
    print(f'{len(todo)} clips to generate', flush=True)
    for i, (voice, vid, text) in enumerate(todo, 1):
        cfg = VOICES[voice]
        ph = to_phonemes(text)
        audio, sr = k.create(ph, voice=styles[voice], speed=cfg['speed'], is_phonemes=True)
        audio = np.concatenate([np.zeros(int(sr * 0.08), np.float32), audio, np.zeros(int(sr * 0.12), np.float32)])
        dest = os.path.join(OUT, voice, vid + '.mp3')
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
            sf.write(tmp.name, audio, sr)
            p = cfg['pitch']
            af = f'asetrate={int(sr * p)},aresample={sr},atempo={1 / p:.4f},' if p != 1 else ''
            af += 'highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=7'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp.name, '-af', af, '-ac', '1', '-ar', '24000',
                            '-codec:a', 'libmp3lame', '-b:a', '48k', dest], check=True)
        print(f'[{i}/{len(todo)}] {voice}/{vid}: {text}  ->  {ph}', flush=True)


if __name__ == '__main__':
    sys.exit(main())
