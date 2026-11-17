"""Pre-record the referee's calls with Kokoro (open neural TTS, British male 'bm_george').

usage: python3 gen_voice.py <model.onnx> <voices.bin> <out referee-voice.js>
"""
import base64
import subprocess
import sys

import numpy as np
from kokoro_onnx import Kokoro

model, voices, out_js = sys.argv[1:4]
VOICE, SPEED = 'bm_george', 0.92

ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'zero ten twenty thirty forty fifty sixty seventy eighty ninety'.split()


def words(n):
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ('' if n % 10 == 0 else '-' + ONES[n % 10])
    rest = n % 100
    return 'one hundred' + ('' if rest == 0 else ' and ' + words(rest))


lines = {f'n{n}': words(n).capitalize() + '.' for n in range(1, 161)}
for v in range(4, 8):
    lines[f'foul{v}'] = f'Foul, {words(v)}.'
    lines[f'miss{v}'] = f'Foul and a miss, {words(v)}.'
lines.update({
    'freeBall': 'Free ball.',
    'touching': 'Touching ball.',
    'respottedBlack': 'Re-spotted black.',
    'missWarning': 'If you miss again, the frame will be awarded to your opponent.',
    'frameP1': 'Frame to player one.',
    'frameP2': 'Frame to player two.',
    'frameBot': 'Frame to the club bot.',
    'frameMatch': 'Frame and match.',
    'frame': 'Frame.',  # players made in VELVET Studio have no recorded name
})

tts = Kokoro(model, voices)


def encode(samples, rate):
    x = np.asarray(samples, np.float32)
    peak = np.abs(x).max() or 1.0
    idx = np.where(np.abs(x) > peak * 0.02)[0]
    pad = int(0.03 * rate)
    x = x[max(0, idx[0] - pad): min(len(x), idx[-1] + pad)] if len(idx) else x
    rms = np.sqrt(np.mean(x ** 2)) or 1e-6
    x = x * min(10 ** (-19 / 20) / rms, 0.89 / np.abs(x).max())  # even loudness, peak below -1 dBFS
    fade = int(0.008 * rate)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    mp3 = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(rate), '-ac', '1', '-i', 'pipe:0',
                          '-c:a', 'libmp3lame', '-b:a', '56k', '-f', 'mp3', 'pipe:1'],
                         input=x.tobytes(), capture_output=True, check=True).stdout
    return mp3, len(x) / rate


clips, total = {}, 0
for key, text in lines.items():
    samples, rate = tts.create(text, voice=VOICE, speed=SPEED, lang='en-gb')
    mp3, dur = encode(samples, rate)
    clips[key] = base64.b64encode(mp3).decode('ascii')
    total += len(mp3)
    if key in ('n1', 'n47', 'n147', 'foul4', 'miss7', 'missWarning'):
        print(f'{key:12s} {dur:4.2f}s  {text}')

with open(out_js, 'w', encoding='ascii') as f:
    f.write('/* VELVET - referee calls, pre-recorded with the open Kokoro-82M neural voice model\n'
            '   (Apache-2.0, voice "bm_george", British English). Embedded so it works offline. */\n')
    f.write('window.VELVET_VOICE={')
    f.write(','.join(f'"{k}":"{v}"' for k, v in clips.items()))
    f.write('};\n')
print(len(clips), 'clips,', total // 1024, 'KB of MP3')
