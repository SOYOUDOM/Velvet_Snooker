"""Referee calls for one player, in the referee's voice (bm_george, en-gb), added to referee-voice.js:
name_<id> (before his break: "<name>, twenty-four"), frame_<id> ("Frame to <name>.") and
match_<id> ("Frame and match, <name>."). Existing calls are kept.

usage: python3 gen_player_ref.py <kokoro.onnx> <voices.bin> <referee-voice.js> <opponent id> "<name as spoken>"
"""
import base64
import subprocess
import sys

import numpy as np
from kokoro_onnx import Kokoro


def encode(samples, rate):   # the same trim, level and mp3 settings as the other referee calls
    x = np.asarray(samples, np.float32)
    peak = np.abs(x).max() or 1.0
    idx = np.where(np.abs(x) > peak * 0.02)[0]
    pad = int(0.03 * rate)
    x = x[max(0, idx[0] - pad): min(len(x), idx[-1] + pad)]
    rms = np.sqrt(np.mean(x ** 2)) or 1e-6
    x = x * min(10 ** (-19 / 20) / rms, 0.89 / np.abs(x).max())
    f = int(0.008 * rate)
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    return subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(rate), '-ac', '1', '-i', 'pipe:0',
                           '-c:a', 'libmp3lame', '-b:a', '56k', '-f', 'mp3', 'pipe:1'],
                          input=x.tobytes(), capture_output=True, check=True).stdout


model, voices, voice_js, oid, said = sys.argv[1:6]
lines = {f'name_{oid}': f'{said},', f'frame_{oid}': f'Frame to {said}.', f'match_{oid}': f'Frame and match, {said}.'}
existing = open(voice_js, encoding='ascii').read()
tts = Kokoro(model, voices)
clips = {}
for key, text in lines.items():
    if f'"{key}"' in existing:
        continue
    s, r = tts.create(text, voice='bm_george', speed=0.92, lang='en-gb')
    clips[key] = base64.b64encode(encode(s, r)).decode('ascii')
if clips:
    with open(voice_js, 'a', encoding='ascii') as f:
        f.write('Object.assign(window.VELVET_VOICE,{' + ','.join(f'"{k}":"{v}"' for k, v in clips.items()) + '});\n')
print(len(clips), 'calls added:', ', '.join(clips) or '-')
