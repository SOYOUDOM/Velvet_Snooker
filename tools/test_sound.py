"""Sound check: the clips decode, real shots trigger table sounds, the crowd
and murmur play, and the master mix neither clips nor drowns the table.
Records the master output during a bot break-off and a frame win.

usage: python3 -I test_sound.py <test index.html> [out.wav]
"""
import json, pathlib, sys, time, wave
import numpy as np
from playwright.sync_api import sync_playwright

ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
        "--autoplay-policy=no-user-gesture-required"]

TAP = """() => { const ctx=__T.audioCtx, bus=__T.audioBus; window.__rec=[];
  const sp=ctx.createScriptProcessor(4096,2,2); bus.connect(sp); sp.connect(ctx.destination);
  const g=ctx.createGain(); g.gain.value=0; sp.disconnect(); sp.connect(g); g.connect(ctx.destination);
  sp.onaudioprocess=e=>{const a=e.inputBuffer.getChannelData(0),b=e.inputBuffer.getChannelData(1);
    const m=new Float32Array(a.length);for(let i=0;i<a.length;i++)m[i]=(a[i]+b[i])/2;window.__rec.push(m);};
  window.__sp=sp; return ctx.sampleRate; }"""


def main():
    url = pathlib.Path(sys.argv[1]).resolve().as_uri()
    out, errors = {}, []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = b.new_page(viewport={'width': 1280, 'height': 800})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'warning' and 'VELVET sound' in m.text else None)
        pg.goto(url)
        pg.wait_for_function('window.__T && window.__T.balls && window.__T.balls.length>0', timeout=120000)
        pg.click('.mode[data-mode="bot"]')
        pg.click('#start-button')
        pg.wait_for_function("__T.sfxState==='ready'", timeout=30000)
        out['decoded'] = pg.evaluate("Object.keys(__T.sfxBuf).length")
        out['durations'] = pg.evaluate("Object.fromEntries(Object.entries(__T.sfxBuf).filter(([k])=>!/_\\d_[1-9]$/.test(k)).map(([k,v])=>[k,+v.duration.toFixed(2)]))")
        sr = pg.evaluate(TAP)
        pg.wait_for_timeout(1500)                               # murmur fades down once play starts
        pg.evaluate("()=>{window.__mark=[];__T.state.current=1;__T.ai.plan=null;__T.refreshUI();}")
        t0 = time.time()
        pg.wait_for_function("__T.state.inShot", timeout=40000)
        out['break_started_after_s'] = round(time.time() - t0, 1)
        pg.wait_for_function("!__T.state.inShot", timeout=60000)
        pg.wait_for_timeout(800)
        n_break = pg.evaluate("window.__rec.length")
        pg.evaluate("()=>{__T.state.scores=[10,80];__T.finishFrame(1,'test');}")
        pg.wait_for_timeout(6000)
        rec = pg.evaluate("Array.from(window.__rec.flatMap(a=>Array.from(a)))")
        b.close()
    x = np.array(rec, dtype=np.float32)
    split = n_break * 4096
    win = int(sr * .05)

    def stats(seg):
        if len(seg) < win:
            return {}
        r = np.sqrt(np.mean(seg[:len(seg) // win * win].reshape(-1, win) ** 2, axis=1))
        return {'peak': round(float(np.max(np.abs(seg))), 3), 'rms_max_50ms': round(float(r.max()), 3),
                'rms_median_50ms': round(float(np.median(r)), 4), 'seconds': round(len(seg) / sr, 1)}
    out['mix_break'] = stats(x[:split])
    out['mix_frame_applause'] = stats(x[split:])
    out['clipping_samples'] = int(np.sum(np.abs(x) >= .999))
    out['errors'] = errors
    if len(sys.argv) > 2:
        with wave.open(sys.argv[2], 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(int(sr))
            w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
