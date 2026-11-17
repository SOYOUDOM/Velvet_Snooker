"""Referee calls by name and more of the referee's lines, appended to
referee-voice.js in the same voice (bm_george, en-gb) as the existing calls.
usage: python3 gen_ref_calls.py <kokoro.onnx> <voices.bin> <opponents.js> <referee-voice.js>"""
import base64, re, subprocess, sys
import numpy as np
from kokoro_onnx import Kokoro
# same trimming, level and mp3 settings as the other referee calls (gen_names.py)
def encode(samples, rate):
    x = np.asarray(samples, np.float32); peak = np.abs(x).max() or 1.0
    idx = np.where(np.abs(x) > peak * 0.02)[0]; pad = int(0.03 * rate)
    x = x[max(0, idx[0] - pad): min(len(x), idx[-1] + pad)]
    rms = np.sqrt(np.mean(x ** 2)) or 1e-6; x = x * min(10 ** (-19 / 20) / rms, 0.89 / np.abs(x).max())
    f = int(0.008 * rate); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    return subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(rate), '-ac', '1', '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', '56k', '-f', 'mp3', 'pipe:1'],
                          input=x.tobytes(), capture_output=True, check=True).stdout

model, voices, opp_js, voice_js = sys.argv[1:5]
src = open(opp_js, encoding='utf-8').read()
names = {m.group(1): m.group(3).replace("\\'", "'") for m in re.finditer(r"id: '(\w+)'.*?name: (['\"])((?:\\.|(?!\2).)*)\2", src)}
lines = {f'name_{k}': f'{v},' for k, v in names.items() if k != 'club'}
lines.update({
    'name_club': 'The club bot,', 'name_p1': 'Player one,', 'name_p2': 'Player two,',
    'players_please': 'Players, please.', 'quiet_please': 'Quiet, please. Thank you.', 'thank_you': 'Thank you.',
    'snookers': 'Snookers required.', 'in_hand': 'Ball in hand.', 'play_again': 'Play again.', 'replaced': 'Replace the balls.',
    'mobiles': 'Ladies and gentlemen, please make sure all mobile phones are switched off. Thank you.',
    **{f'call_{c}': c.capitalize() + '.' for c in ('yellow', 'green', 'brown', 'blue', 'pink', 'black')},
})
existing = open(voice_js, encoding='ascii').read()
tts = Kokoro(model, voices)
clips = {}
for key, text in lines.items():
    if f'"{key}"' in existing:
        continue
    s, r = tts.create(text, voice='bm_george', speed=0.92, lang='en-gb')
    clips[key] = base64.b64encode(encode(s, r)).decode('ascii')
with open(voice_js, 'a', encoding='ascii') as f:
    f.write('Object.assign(window.VELVET_VOICE,{' + ','.join(f'"{k}":"{v}"' for k, v in clips.items()) + '});\n')
print(len(clips), 'calls added:', ', '.join(clips))
