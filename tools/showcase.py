"""Capture showcase stills of the new features (software WebGL, slow but faithful).

usage: python3 -I showcase.py <test index.html> <out dir>
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


def snap(pg, path, preset=None, wait=6000, target=None, el=None, az=None, radius=None):
    js = "() => { const T=__T; "
    if preset is not None:
        js += f"T.setCamera({preset}); "
    if target is not None:
        js += f"T.cam.target=[{target[0]},{target[1]},{target[2]}]; "
    if el is not None:
        js += f"T.cam.el={el}; "
    if az is not None:
        js += f"T.cam.az={az}; "
    if radius is not None:
        js += f"T.cam.radius={radius}; "
    js += "const c=T.cam; c.curAz=c.az; c.curEl=c.el; c.curRadius=c.radius; c.curTarget=c.target.slice(); }"
    pg.evaluate(js)
    pg.evaluate('window.__noRender=false')
    pg.wait_for_timeout(wait)
    pg.screenshot(path=path)
    pg.evaluate('window.__noRender=true')


def main():
    url = pathlib.Path(sys.argv[1]).resolve().as_uri()
    out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
    rep = {}
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = b.new_page(viewport={'width': 1440, 'height': 810})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(url)
        pg.wait_for_function('window.__T', timeout=120000)
        pg.evaluate("document.querySelector('.mode[data-mode=bot]').click(); document.getElementById('start-button').click();")
        pg.wait_for_function('__T.crowd.length>0 && __T.ref.person', timeout=240000)
        pg.evaluate("document.body.classList.add('hud-collapsed')")
        pg.wait_for_timeout(1200)
        snap(pg, str(out / 'a_tv_main.png'), 0)

        # Snookered behind the blue; your FULL guide shows the escape off the cushions.
        pg.evaluate("""async () => { __T.newRack(false); const s=__T.state; s.ballInHand=false; s.current=0;
            const b=__T.balls, blue=b.find(x=>x.type==='blue'), cue=b.find(x=>x.type==='cue'); cue.x=blue.x-0.0825; cue.z=blue.z;
            const e=await __T.escapeShotFor(['red']); s.aim=e.aim; Object.assign(s.settings[0],{power:e.power,spinX:0,spinY:0}); __T.refreshUI(); }""")
        snap(pg, str(out / 'b_escape_overhead.png'), 1)
        snap(pg, str(out / 'c_escape_tv.png'), 0)

        # The bot lining up its own escape: its planned path in gold.
        pg.evaluate("""() => { const s=__T.state; s.current=1; __T.ai.plan=null; }""")
        pg.wait_for_function('!!__T.ai.plan', timeout=20000)
        pg.evaluate("() => { __T.ai.thinkUntil=performance.now()+1e9; }")
        rep['bot_plan'] = pg.evaluate("() => ({kind:__T.ai.plan.kind, cushions:__T.ai.plan.cushions, power:__T.ai.plan.power})")
        snap(pg, str(out / 'd_bot_gold_line.png'), 1)
        pg.evaluate("() => { __T.ai.plan=null; __T.state.current=0; }")

        # The audience applauding, seen from the three-quarter camera.
        pg.evaluate("""() => { const t=__T.time; for(const c of __T.crowd){ c.clapTarget=1; c.clapStart=t; c.clapEnd=t+60; } }""")
        pg.wait_for_timeout(2500)
        snap(pg, str(out / 'e_crowd_applause.png'), 4)

        # The referee walking to a pocket and reaching for the ball.
        pg.evaluate("""() => { const R=__T.ref; R.queue=[{s:R.home+1.6,x:1.78,z:0.89}]; R.task=null; }""")
        pg.wait_for_function('__T.ref.task && __T.ref.task.started', timeout=30000)
        pg.wait_for_timeout(900)
        rep['referee'] = pg.evaluate("() => ({take:+__T.ref.takeW.toFixed(2), x:+__T.ref.person.obj.position.x.toFixed(2), z:+__T.ref.person.obj.position.z.toFixed(2)})")
        snap(pg, str(out / 'f_referee_reach.png'), None, 6000, target=[1.3, .2, .6], el=.32, az=-.35, radius=2.4)
        rep['errors'] = errs
        b.close()
    print(json.dumps(rep, indent=1))


if __name__ == '__main__':
    main()
