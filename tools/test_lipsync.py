"""VELVET 7.1 lip-sync: the referee's mouth takes speech shapes from his voice;
the players mouth their reactions.
usage: python3 tools/test_lipsync.py <testcopy>/index.html"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
fails, notes = [], []
def check(name, ok, info=''):
    (notes if ok else fails).append(('PASS ' if ok else 'FAIL ') + name + (' ' + str(info) if info else ''))
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1000, 'height': 600}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:200]))
    pg.add_init_script("try{localStorage.setItem('velvet.quality','low');localStorage.setItem('velvet.walkon','off')}catch(e){}")
    pg.goto(pathlib.Path(sys.argv[1]).resolve().as_uri()); pg.wait_for_function('window.__T && VelvetPeople.ready', timeout=180000)
    pg.click('.mode[data-mode="bot"]'); pg.click('#start-button'); pg.wait_for_function("__T.state.started&&!__T.cine.on&&__T.ref.person&&__T.faceOf(__T.ref.person)", timeout=90000)
    pg.mouse.click(500, 300); pg.wait_for_timeout(300)
    r = pg.evaluate("""async()=>{const T=__T,f=T.faceOf(T.ref.person);T.state.sound=true;T.say(['n8','n1'],0);const peak={},seen=new Set();
        const t0=performance.now();while(performance.now()-t0<3500){await new Promise(r=>setTimeout(r,30));
          if(f.vis)for(const k in f.vis){if(f.vis[k]>(peak[k]||0))peak[k]=f.vis[k];if(f.vis[k]>.12)seen.add(k);}}
        const m=f.meshes&&f.meshes[0],d=m&&m.morphTargetDictionary;
        return {arkit:!!f.arkit,peak:Object.fromEntries(Object.entries(peak).map(([k,v])=>[k,+v.toFixed(2)])),shapes:[...seen],hasVis:!!(d&&d.VI_aa!==undefined)};}""")
    check('the referee has speech shapes and his mouth takes several of them as he speaks', r['arkit'] and r['hasVis'] and len(r['shapes']) >= 2, json.dumps(r))
    w = pg.evaluate("""async()=>{const T=__T,pl=T.PL[0],f=T.faceOf(pl.p);if(!f||!f.arkit)return {skip:true};
        const peak={};for(let n=0;n<6&&!Object.keys(peak).length;n++){T.faceExpr(pl.p,'win',2,0);
          const t0=performance.now();while(performance.now()-t0<1300){await new Promise(r=>setTimeout(r,30));if(f.vis)for(const k in f.vis)if(f.vis[k]>.15)peak[k]=Math.max(peak[k]||0,+f.vis[k].toFixed(2));}}
        return {peak};}""")
    check('a player mouths his reaction (YES!)', w.get('skip') or any(k in w['peak'] for k in ('I', 'E', 'SS')), json.dumps(w))
    check('no page errors', not errors, json.dumps(errors[:3]))
    b.close()
print('\n'.join(notes + fails)); print('RESULT', 'OK' if not fails else 'FAILED', f'{len(notes)}/{len(notes)+len(fails)}')
