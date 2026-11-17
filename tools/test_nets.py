"""Pocket nets: a ball potted in each of the six pockets drops through the
see-through pocket into that pocket's net, rolls down its rod catcher and
settles; the referee then takes a colour out of the right pocket.
usage: python3 -I tools/test_nets.py <test index.html>"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 320, 'height': 200}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto(pathlib.Path(sys.argv[1]).resolve().as_uri()); pg.wait_for_function('window.__T', timeout=120000)
    pg.evaluate("document.querySelector('.mode[data-mode=bot]').click(); document.getElementById('start-button').click();")
    pg.wait_for_function('__T.ref.person', timeout=240000)
    pg.evaluate("""() => { const T=__T,P=T.K.POCKETS,reds=T.balls.filter(b=>b.type==='red'); T.ref.queue=[];
      P.forEach((p,i)=>{const b=reds[i];b.x=p.x;b.z=p.z;b.vx=.4*p.ux;b.vz=.4*p.uz;T.potBall(b,i);}); }""")
    pg.wait_for_timeout(9000)
    res = pg.evaluate("""() => { const T=__T,K=T.K; return T.falling.map(f=>{const P=K.POCKETS[f.pocketId];
      return {pocket:f.pocketId,settled:!!f.inTray,below:f.y<K.CLOTH_Y-.1,out:+((f.x-P.x)*P.ux+(f.z-P.z)*P.uz).toFixed(2)};}); }""")
    ok = len(res) == 6 and all(r['settled'] and r['below'] and 0 < r['out'] < .4 for r in res)
    print(json.dumps({'balls': res, 'errors': errs}))
    print('PASS' if ok and not errs else 'FAIL')
    b.close()
