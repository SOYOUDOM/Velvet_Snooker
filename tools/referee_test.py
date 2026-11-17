"""Referee choreography: walk to the pocket, take the ball out, walk to the spot, re-spot, go home."""
import json, pathlib, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from showcase import snap, ARGS
url = pathlib.Path(sys.argv[1]).resolve().as_uri(); out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
rep = {'track': []}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 720}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_function('window.__T', timeout=120000)
    pg.evaluate("document.querySelector('.mode[data-mode=bot]').click(); document.getElementById('start-button').click();")
    pg.wait_for_function('__T.crowd.length>0 && __T.ref.person', timeout=240000)
    pg.evaluate("document.body.classList.add('hud-collapsed')")
    # Exactly what reactToShot queues after the pink drops into the top-right corner pocket.
    pg.evaluate("""() => { const R=__T.ref, pk={x:1.7345,z:0.839}, sp=[0.89225,0];
        R.queue=[{s:__T.loopNearest(pk.x,pk.z),x:pk.x,z:pk.z},{s:__T.loopNearest(sp[0],sp[1]),x:sp[0],z:sp[1]}]; R.task=null; R.waitUntil=0; }""")
    shots = {'pocket': False, 'spot': False}
    t0 = time.time()
    while time.time() - t0 < 150:
        st = pg.evaluate("""() => { const R=__T.ref, o=R.person.obj.position; return {t:+__T.time.toFixed(1), x:+o.x.toFixed(2), z:+o.z.toFixed(2), v:+R.v.toFixed(2), take:+R.takeW.toFixed(2), queue:R.queue.length, task:R.task?[R.task.x,R.task.z]:null, home:Math.abs(R.s-R.home)<.05&&!R.task&&!R.queue.length}; }""")
        rep['track'].append(st)
        if st['take'] > .85 and st['task'] and not shots['pocket'] and st['task'][0] > 1.5:
            snap(pg, str(out / 'ref_at_pocket.png'), None, 5000, target=[st['x'] - .6, .35, st['z'] - .4], el=.3, az=-2.3, radius=1.9); shots['pocket'] = True
        if st['take'] > .85 and st['task'] and not shots['spot'] and st['task'][0] < 1.0:
            snap(pg, str(out / 'ref_at_spot.png'), None, 5000, target=[st['x'] - .2, .35, st['z'] - .5], el=.25, az=-2.6, radius=2.0); shots['spot'] = True
        if shots['spot'] and st['home']:
            break
        pg.wait_for_timeout(300)
    rep['errors'] = errs
    b.close()
tr = rep['track']
print('samples', len(tr), '| first', tr[0], '\n| max take', max(s['take'] for s in tr), '| returned home:', tr[-1]['home'], '| last', tr[-1])
print('pocket visit:', any(s['task'] and s['task'][0] > 1.5 and s['take'] > .5 for s in tr), '| spot visit:', any(s['task'] and s['task'][0] < 1.0 and s['take'] > .5 for s in tr), '| errors', rep['errors'])
