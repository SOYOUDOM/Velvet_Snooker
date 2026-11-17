"""Generate VELVET's table and crowd sounds -> js/table-sounds.js.

Table sounds are physically modelled (no recordings were available offline):
  * ball-ball click: Hertzian contact pulse of two 52.5 mm resin balls (contact
    time ~0.34 ms * v^-1/5) radiated as acceleration noise (differentiates
    below c/2pi a ~ 2 kHz), second ball's opposite pulse, slate reflection;
  * cue strike: ~1 ms leather-tip pulse plus the cue's longitudinal ring;
  * cushion / pocket: slow rubber or leather pulses exciting damped modes of
    the rail, pocket and bag.
Crowd: applause is granular (each spectator claps at their own rate with a
hand resonance), the "ooh" and the murmur are layers of many Kokoro voices,
all placed in a synthetic arena reverb.

usage: python3 gen_sfx.py <kokoro.onnx> <voices.bin> <out table-sounds.js>
"""
import base64, io, subprocess, sys, wave
import numpy as np
import scipy.signal as sg

SR, OS = 44100, 8
SRO = SR * OS
rng = np.random.default_rng(2026)


def hp(x, fc, sr, order=1):
    b, a = sg.butter(order, fc / (sr / 2), 'high')
    return sg.lfilter(b, a, x)


def lp(x, fc, sr, order=2):
    b, a = sg.butter(order, min(.99, fc / (sr / 2)), 'low')
    return sg.lfilter(b, a, x)


def bp(x, f1, f2, sr, order=2):
    b, a = sg.butter(order, [f1 / (sr / 2), min(.99, f2 / (sr / 2))], 'band')
    return sg.lfilter(b, a, x)


def delay(x, n):
    if n <= 0:
        return x.copy()
    y = np.zeros_like(x)
    y[n:] = x[:-n]
    return y


def half_sine(T, n_total, sr=SRO):
    n = max(3, int(round(T * sr)))
    x = np.zeros(n_total)
    x[:n] = np.sin(np.pi * np.arange(n) / n)
    return x


def modes(spec, dur, T, sr=SR, jitter=.05):
    """Damped modes excited by a half-sine force of duration T."""
    t = np.arange(int(dur * sr)) / sr
    y = np.zeros_like(t)
    for f, tau, amp in spec:
        f *= rng.uniform(1 - jitter, 1 + jitter)
        # excitation level of this mode by the pulse's spectrum
        x = 2 * f * T
        exc = abs(np.cos(np.pi * f * T) / (1 - x * x)) if abs(1 - x * x) > 1e-3 else np.pi / 4
        y += amp * exc * np.exp(-t / tau) * np.sin(2 * np.pi * f * t + rng.uniform(0, 2 * np.pi))
    att = np.minimum(1, t / 0.0006)          # finite attack, no digital step
    return y * att


def fade_out(x, ms=4):
    n = int(SR * ms / 1000)
    x[-n:] *= np.linspace(1, 0, n)
    return x


def norm(x, peak=.89):
    return x * (peak / (np.max(np.abs(x)) + 1e-12))


# ---------------------------------------------------------------- table
def ball_click(v):
    T = .34e-3 * v ** -.2 * rng.uniform(.95, 1.06)
    n = int(SRO * .03)
    p = hp(half_sine(T, n), 2080, SRO)                       # acceleration noise
    p = p - .3 * delay(p, int(rng.uniform(.03, .12) * 1e-3 * SRO))    # the other ball
    p = p + .5 * delay(p, int(rng.uniform(55, 95) * 1e-6 * SRO))     # slate reflection
    p = sg.resample_poly(p, 1, OS)
    tail = .02 * bp(rng.standard_normal(len(p)), 2000, 6000, SR) * np.exp(-np.arange(len(p)) / (SR * .004))
    return fade_out(norm(lp(p + tail * np.max(np.abs(p)), 9000, SR)))


def cue_strike(v):
    T = (1.25e-3 - .1e-3 * v) * rng.uniform(.94, 1.06)
    n = int(SRO * .06)
    p = sg.resample_poly(hp(half_sine(T, n), 2080, SRO), 1, OS)
    pk = np.max(np.abs(p))
    t = np.arange(len(p)) / SR
    ring = modes([(1420, .008, .30), (2880, .005, .12), (520, .008, .05)], len(p) / SR, T, jitter=.04)
    leather = bp(rng.standard_normal(len(p)), 1800, 5200, SR) * np.exp(-t / .0025) * .05
    y = p + pk * (ring / (np.max(np.abs(ring)) + 1e-9) * .22 + leather / (np.max(np.abs(leather)) + 1e-9) * .08)
    return fade_out(norm(y))


RAIL = [(118, .045, 1.0), (205, .035, .8), (338, .025, .7), (612, .016, .6), (985, .01, .45), (1650, .006, .3)]


def cushion(v):
    T = (8.5e-3 - 1.4e-3 * min(v, 3)) * rng.uniform(.92, 1.08)
    dur = .34
    y = modes(RAIL, dur, T)
    t = np.arange(len(y)) / SR
    thump = lp(half_sine(T, len(y), SR), 260, SR) * .6
    slap = bp(rng.standard_normal(len(y)), 700, 3200, SR) * np.exp(-t / .003) * (.04 + .05 * min(v, 3))
    y = y / (np.max(np.abs(y)) + 1e-9) + thump / (np.max(np.abs(thump)) + 1e-9) * .7 + slap / (np.max(np.abs(slap)) + 1e-9) * (.3 + .15 * min(v, 3))
    return fade_out(norm(y))


def pocket(with_ball, hard):
    dur = .62
    n = int(dur * SR)
    y = np.zeros(n)
    t = np.arange(n) / SR

    def hit(at, T, spec, amp):
        k = int(at * SR)
        m = modes(spec, dur - at, T)
        th = lp(half_sine(T, len(m), SR), 240, SR)
        seg = m / (np.max(np.abs(m)) + 1e-9) + .8 * th / (np.max(np.abs(th)) + 1e-9)
        y[k:k + len(seg)] += amp * seg[:n - k]

    at = 0
    if hard:                                     # rattles the jaw on the way in
        hit(0, 5e-3, RAIL, .55)
        at = rng.uniform(.018, .03)
    hit(at, 4.5e-3, [(162, .05, 1), (318, .03, .6), (566, .018, .35), (905, .01, .2)], 1.0)
    drop = at + rng.uniform(.075, .11)
    hit(drop, 6.5e-3, [(118, .05, 1), (236, .03, .5), (410, .016, .25)], .55)
    if with_ball:
        k = int((drop + rng.uniform(.004, .012)) * SR)
        c = ball_click(.45) * .32
        y[k:k + len(c)] += c[:n - k]
    roll = lp(rng.standard_normal(n), 380, SR) * np.exp(-np.maximum(0, t - drop) / .06) * (t > drop)
    y += roll / (np.max(np.abs(roll)) + 1e-9) * .09
    return fade_out(norm(y), 30)


# ---------------------------------------------------------------- arena
def arena_ir(seconds=2.2, rt60=1.55):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = []
    for ch in range(2):
        noise = rng.standard_normal(n)
        lo, mid, hi = lp(noise, 500, SR), bp(noise, 500, 3000, SR), hp(noise, 3000, SR, 2)
        env = lambda r: np.exp(-6.91 * t / r)
        ir = lo * env(rt60 * 1.15) + mid * env(rt60) + .7 * hi * env(rt60 * .55)
        ir[:int(.018 * SR)] *= np.linspace(0, 1, int(.018 * SR)) ** 2
        out.append(ir / np.sqrt(np.sum(ir ** 2)))
    return np.stack(out)


IR = arena_ir()


def reverb(stereo, wet, dry=1.0):
    out = np.zeros((2, stereo.shape[1] + IR.shape[1] - 1))
    for c in range(2):
        out[c, :stereo.shape[1]] += dry * stereo[c]
        out[c] += wet * sg.fftconvolve(stereo[c], IR[c])
    return out


def place(buf, mono, at, gain, pan):
    k = int(at * SR)
    if k >= buf.shape[1]:
        return
    m = mono[:buf.shape[1] - k]
    a = (pan + 1) * np.pi / 4
    buf[0, k:k + len(m)] += gain * np.cos(a) * m
    buf[1, k:k + len(m)] += gain * np.sin(a) * m


def clap():
    n = int(.05 * SR)
    t = np.arange(n) / SR
    f, q = rng.uniform(850, 2400), rng.uniform(1.2, 3.2)
    b, a = sg.iirpeak(f / (SR / 2), q)
    x = sg.lfilter(b, a, rng.standard_normal(n)) * np.exp(-t / rng.uniform(.004, .011))
    x += .35 * lp(rng.standard_normal(n), 900, SR) * np.exp(-t / .006)      # palm body
    return x / (np.max(np.abs(x)) + 1e-9)


def applause(seconds, people, peak_at, fade):
    buf = np.zeros((2, int(seconds * SR)))
    for _ in range(people):
        dist = rng.uniform(4, 28)
        start = abs(rng.lognormal(np.log(.25), .55)) + rng.uniform(0, peak_at * .4)
        stop = seconds - fade * rng.uniform(.15, 1.0) - .25
        period = rng.uniform(.19, .31)
        g = rng.uniform(.5, 1) / (1 + dist / 9)
        pan = rng.uniform(-.85, .85)
        cl = [clap() for _ in range(3)]
        tt = start
        while tt < stop:
            prog = min(1, (tt - start) / .35)               # people ease in
            place(buf, cl[rng.integers(3)], tt, g * prog * rng.uniform(.75, 1.1), pan)
            tt += period * rng.uniform(.93, 1.07)
    far = lp(buf.copy(), 2600, SR)                           # distance takes the edge off
    buf = .55 * buf + .45 * far
    out = reverb(buf, wet=.5, dry=.85)
    t = np.arange(out.shape[1]) / SR
    out *= np.clip((seconds + .6 - t) / 1.2, 0, 1)
    return out[:, :int((seconds + .6) * SR)]


def voices_layer(k, lines, seconds, count, spread, speeds, circular=False, seed_gain=1.0):
    names = ['bm_lewis', 'bm_daniel', 'bm_fable', 'bm_george', 'bf_emma', 'bf_alice', 'bf_isabella', 'bf_lily',
             'am_michael', 'am_adam', 'am_eric', 'am_liam', 'am_onyx', 'af_sarah', 'af_nicole', 'af_bella', 'af_heart']
    buf = np.zeros((2, int(seconds * SR)))
    for i in range(count):
        txt = lines[rng.integers(len(lines))]
        s, sr = k.create(txt, voice=names[rng.integers(len(names))], speed=float(rng.uniform(*speeds)), lang='en-gb')
        s = sg.resample_poly(np.asarray(s, dtype=np.float64), SR // 300, sr // 300)   # 24 kHz -> 44.1 kHz
        s = s / (np.max(np.abs(s)) + 1e-9)
        dist = rng.uniform(3, 20)
        s = lp(s, 5200 - dist * 150, SR)
        at = spread(i)
        g = seed_gain * rng.uniform(.6, 1) / (1 + dist / 6)
        if circular:
            k0 = int(at * SR) % buf.shape[1]
            m = s[:buf.shape[1]]
            end = k0 + len(m)
            a = (rng.uniform(-.9, .9) + 1) * np.pi / 4
            for c, w in ((0, np.cos(a)), (1, np.sin(a))):
                if end <= buf.shape[1]:
                    buf[c, k0:end] += g * w * m
                else:
                    cut = buf.shape[1] - k0
                    buf[c, k0:] += g * w * m[:cut]
                    buf[c, :end - buf.shape[1]] += g * w * m[cut:]
        else:
            place(buf, s, at, g, rng.uniform(-.9, .9))
    return buf


def wav_b64(x):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    bio = io.BytesIO()
    with wave.open(bio, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return base64.b64encode(bio.getvalue()).decode()


def mp3_b64(stereo, kbps=112):
    stereo = stereo / (np.max(np.abs(stereo)) + 1e-9) * .9
    pcm = (stereo.T * 32767).astype('<i2').tobytes()
    out = subprocess.run(['ffmpeg', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', 'pipe:0',
                          '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', '-f', 'mp3', 'pipe:1'],
                         input=pcm, capture_output=True, check=True).stdout
    return base64.b64encode(out).decode()


def main():
    model, voices, out_js = sys.argv[1:4]
    clips, layers = {}, {'click': [.15, .5, 1.4, 3.5], 'cue': [.7, 1.6, 3.0, 4.6], 'cushion': [.3, 1.0, 2.6]}
    for i, v in enumerate(layers['click']):
        for j in range(3):
            clips[f'click_{i}_{j}'] = wav_b64(ball_click(v))
    for i, v in enumerate(layers['cue']):
        for j in range(2):
            clips[f'cue_{i}_{j}'] = wav_b64(cue_strike(v))
    for i, v in enumerate(layers['cushion']):
        for j in range(2):
            clips[f'cushion_{i}_{j}'] = wav_b64(cushion(v))
    for j, (wb, hard) in enumerate([(False, False), (True, False), (False, True), (True, True)]):
        clips[f'pocket_0_{j}'] = wav_b64(pocket(wb, hard))
    layers['pocket'] = [1.0]
    import os, json
    cache = os.path.join(os.path.dirname(out_js), 'crowd_cache.json')
    if os.path.exists(cache):
        clips.update(json.load(open(cache)))
        return write(out_js, clips, layers)
    crowd = {'applause_polite': applause(2.6, 70, .3, 1.2), 'applause_big': applause(5.0, 150, .4, 2.0),
             'applause_frame': applause(8.5, 190, .5, 3.0)}
    from kokoro_onnx import Kokoro
    k = Kokoro(model, voices)
    ooh = voices_layer(k, ['Ooh!', 'Oooooh.', 'Ohhh!', 'Oh!', 'Oooh.', 'Aww.'], 2.6, 42,
                       lambda i: abs(rng.normal(.05, .07)), (.62, .9))
    o = reverb(ooh, wet=.55, dry=.8)[:, :int(3.2 * SR)]
    o[:, -int(.4 * SR):] *= np.linspace(1, 0, int(.4 * SR))
    crowd['ooh'] = o
    chat = ['What a shot that was.', 'He needs this frame.', 'I think he goes for the blue.', 'Lovely cue ball control.',
            'It is very tight, is it not?', 'Shall we get a drink after?', 'He has been brilliant tonight.',
            'Did you see that last red?', 'That safety was superb.', 'I would have played the pink.', 'Great atmosphere in here.',
            'Who do you fancy for this one?', 'He missed an easy one earlier.', 'Long way to go yet.', 'Look at the scoreboard.',
            'Same again next year?', 'He is so quick around the table.', 'That was unlucky.', 'Quiet now, he is down.']
    seconds = 16.0
    mur = voices_layer(k, chat, seconds, 54, lambda i: i * seconds / 54 + rng.uniform(0, .25), (.95, 1.15), circular=True, seed_gain=.8)
    wet = np.zeros_like(mur)
    for c in range(2):                       # circular reverb so the loop has no seam
        full = sg.fftconvolve(np.concatenate([mur[c], mur[c]]), IR[c])
        wet[c] = full[mur.shape[1]:2 * mur.shape[1]]
    crowd['murmur'] = lp(.75 * mur + .6 * wet, 3600, SR)
    cc = {key: mp3_b64(st, 96 if key == 'murmur' else 112) for key, st in crowd.items()}
    json.dump(cc, open(cache, 'w'))
    clips.update(cc)
    write(out_js, clips, layers)


def write(out_js, clips, layers):
    js = '/* VELVET table & crowd sounds: physically modelled table sounds, granular applause, Kokoro crowd voices. Generated by tools/gen_sfx.py. */\n'
    js += 'window.VELVET_SFX={layers:' + str(layers).replace("'", '"') + ',clips:{\n'
    js += ',\n'.join(f'{k}:"{v}"' for k, v in clips.items()) + '}};\n'
    open(out_js, 'w').write(js)
    print('clips', len(clips), 'bytes', len(js))


if __name__ == '__main__':
    main()
