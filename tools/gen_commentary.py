"""Record the VELVET commentary team (Kokoro, Supertonic 3 and Piper voices) and the MC (Kokoro), all offline.

usage: python3 gen_commentary.py <model.onnx> <voices.bin> <cache dir> <out commentary-voice.js> [--plan]

Each line is recorded by several commentators (more for lines heard often), so
any pair of commentators in a match has plenty to say. Clips are cached as Ogg
Opus files; a re-run only records what is missing, then packs the JS file.
"""
import base64
import hashlib
import json
import os
import random
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from commentary_lines import (COMMENTATORS, DISPLAY, FREQUENT, LINES, MC_LANG, MC_LINES, MC_SPEED, MC_VOICE,
                              PLAYER_LINES, REPLIES, THREADS, LIVE, pace, spoken)
import tts_engines  # noqa: E402

model, voices, cache, out_js = sys.argv[1:5]
plan_only = '--plan' in sys.argv
os.makedirs(cache, exist_ok=True)
OPPONENTS = {  # spoken names (as in js/opponents.js "say")
    'osullivan': "O'Sullivan", 'trump': 'Trump', 'selby': 'Selby', 'higgins': 'Higgins', 'williams': 'Williams', 'ding': 'Ding',
    'robertson': 'Robertson', 'zhao': 'Jow', 'murphy': 'Murphy', 'allen': 'Allen', 'wilson': 'Wilson', 'brecel': 'Bressel',
    'hawkins': 'Hawkins', 'bingham': 'Bingham', 'lisowski': 'Lisowski', 'club': 'The club bot', 'oudom': 'Soy Odom',
}

rng = random.Random(147)
names = [c[0] for c in COMMENTATORS]
jobs = []          # (voice key, kind, category, text)
share = {n: 0 for n in names}
for cat, lines in LINES.items():
    k = 7 if cat in FREQUENT else 4   # 20 voices: each line goes to more of them, so any pair still has plenty to say
    for text in lines:
        pick = sorted(names, key=lambda n: (share[n] + rng.random() * 2))[:k]   # balanced, a little random
        for n in pick:
            share[n] += 1
            jobs.append((n, 'line', cat, text))
for n in names:
    for text in rng.sample(REPLIES, 14):
        jobs.append((n, 'reply', '', text))
    for key, said in OPPONENTS.items():
        jobs.append((n, 'name', key, said + '.'))
    for cat, texts in LIVE.items():                  # quick reactions: everyone
        for text in texts:
            jobs.append((n, 'line', cat, text))
    for pid, cats in PLAYER_LINES.items():          # every commentator has each player's own lines
        for cat, texts in cats.items():
            for text in texts:
                jobs.append((n, 'line', f'{cat}@{pid}', text))
for key, text in MC_LINES.items():
    jobs.append(('mc', 'mc', key, text))
est = sum(len(t[3].split()) for t in jobs) * 0.36
# Conversations: for each thread the team is split in two halves at random (fixed per thread); one half
# records the opening line (and a closing third line), the other half the answer.
threads = []
for cat, ts in THREADS.items():
    for ti, parts in enumerate(ts):
        order = list(names); random.Random(f'{cat}#{ti}').shuffle(order)
        half = (order[:len(order) // 2], order[len(order) // 2:])
        threads.append({'cat': cat, 'id': f'{cat}#{ti}', 'n': len(parts)})
        for j, text in enumerate(parts):
            for n in half[j % 2]:
                jobs.append((n, 'thr', f'{cat}#{ti}#{j}', text))
print(f'{len(jobs)} clips, about {est / 60:.0f} minutes of speech; lines per commentator:', share)
if plan_only:
    sys.exit(0)

tts_engines.kokoro_init(model, voices)
spec = dict(COMMENTATORS)
spec['mc'] = ('ko', MC_VOICE, MC_LANG, MC_SPEED)


def encode(samples, rate, path):
    x = np.asarray(samples, np.float32)
    peak = np.abs(x).max() or 1.0
    idx = np.where(np.abs(x) > peak * 0.02)[0]
    pad = int(0.03 * rate)
    x = x[max(0, idx[0] - pad): min(len(x), idx[-1] + pad)] if len(idx) else x
    rms = np.sqrt(np.mean(x ** 2)) or 1e-6
    x = x * min(10 ** (-20 / 20) / rms, 0.89 / (np.abs(x).max() or 1))
    fade = int(0.008 * rate)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(rate), '-ac', '1', '-i', 'pipe:0', '-ar', '24000',
                    '-c:a', 'libopus', '-b:a', '22k', '-application', 'voip', '-f', 'ogg', path],
                   input=x.tobytes(), check=True)


def job_pace(voice, kind, cat):
    return 1.0 if voice == 'mc' else pace(cat if kind == 'line' else cat.split('#')[0] if kind == 'thr' else '')


def clip_path(voice, kind, cat, text):
    if voice == 'mc':   # the MC is unchanged, so its clips keep their old names
        return os.path.join(cache, 'mc_' + hashlib.sha1(text.encode()).hexdigest()[:12] + '.ogg')
    key = repr((spec[voice], job_pace(voice, kind, cat), spoken(text)))
    return os.path.join(cache, voice + '_' + hashlib.sha1(key.encode()).hexdigest()[:12] + '.ogg')


import time  # noqa: E402
done, t0 = 0, time.time()
for voice, kind, cat, text in sorted(jobs, key=lambda j: j[0]):   # one voice at a time
    path = clip_path(voice, kind, cat, text)
    if not os.path.exists(path):
        samples, rate = tts_engines.speak(spec[voice], spoken(text), job_pace(voice, kind, cat))
        encode(samples, rate, path)
    done += 1
    if done % 100 == 0:
        print(f'{done}/{len(jobs)} {voice} {time.time() - t0:.0f}s', flush=True)

team = {}
for n in names:
    team[n] = {'name': DISPLAY[n], 'lines': {}, 'replies': [], 'names': {}, 'thr': {}}
mc = {}
for voice, kind, cat, text in jobs:
    b64 = base64.b64encode(open(clip_path(voice, kind, cat, text), 'rb').read()).decode('ascii')
    if kind == 'line':
        team[voice]['lines'].setdefault(cat, []).append([text, b64])
    elif kind == 'reply':
        team[voice]['replies'].append([text, b64])
    elif kind == 'name':
        team[voice]['names'][cat] = b64
    elif kind == 'thr':
        team[voice]['thr'][cat] = [text, b64]
    else:
        mc[cat] = [text, b64]
with open(out_js, 'w', encoding='ascii') as f:
    f.write('/* VELVET - commentary team and MC, pre-recorded offline. Ogg Opus clips, embedded so the game works offline.\n'
            '   Voices: Kokoro-82M (Apache-2.0); Supertonic 3 by Supertone (OpenRAIL-M); Piper voices: Alan (Alan Pope, CC BY-SA 4.0),\n'
            '   Cori, John and Bryce (public-domain LibriVox data), Jenny (Dioco), Semaine (CC BY-NC-SA 4.0, non-commercial),\n'
            '   VCTK (CC BY 4.0, University of Edinburgh), LibriTTS-R (CC BY 4.0). */\n')
    f.write('window.VELVET_COMMENTARY=' + json.dumps({'team': team, 'mc': mc, 'threads': threads}, separators=(',', ':')) + ';\n')
print('wrote', out_js, os.path.getsize(out_js) // 1024, 'KB')
