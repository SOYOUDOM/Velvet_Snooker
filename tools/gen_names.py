"""Add 'Frame to <surname>.' calls for every opponent to referee-voice.js (same voice settings)."""
import base64, re, subprocess, sys, json
import numpy as np
from kokoro_onnx import Kokoro
sys.path.insert(0, '/home/claude/work/tools')
model, voices, opp_js, voice_js = sys.argv[1:5]
src = open(opp_js, encoding='utf-8').read()
items = re.findall(r"id: '(\w+)'.*?say: (['\"])(.*?)\2", src)
tts = Kokoro(model, voices)
def encode(samples, rate):
    x = np.asarray(samples, np.float32); peak = np.abs(x).max() or 1.0
    idx = np.where(np.abs(x) > peak * 0.02)[0]; pad = int(0.03 * rate)
    x = x[max(0, idx[0] - pad): min(len(x), idx[-1] + pad)]
    rms = np.sqrt(np.mean(x ** 2)) or 1e-6; x = x * min(10 ** (-19 / 20) / rms, 0.89 / np.abs(x).max())
    f = int(0.008 * rate); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    return subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(rate), '-ac', '1', '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', '56k', '-f', 'mp3', 'pipe:1'],
                          input=x.tobytes(), capture_output=True, check=True).stdout
clips = {}
existing = open(voice_js, encoding='ascii').read()
for oid, _, say in items:
    if oid == 'club' or f'"frame_{oid}"' in existing:
        continue
    s, r = tts.create(f'Frame to {say}.', voice='bm_george', speed=0.92, lang='en-gb')
    clips['frame_' + oid] = base64.b64encode(encode(s, r)).decode('ascii')
with open(voice_js, 'a', encoding='ascii') as f:
    f.write('Object.assign(window.VELVET_VOICE,{' + ','.join(f'"{k}":"{v}"' for k, v in clips.items()) + '});\n')
print(len(clips), 'name calls added:', ', '.join(clips))
