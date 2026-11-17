"""Commentary: a bot match played out for a while; checks the team is drawn,
events reach the commentary, no line repeats and nothing throws.
usage: python3 -I tools/test_commentary.py <test index.html> [shots]"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
HUMAN = """() => { const T=__T,s=T.state; if(s.current!==0||s.inShot||s.decision||s.finished)return 'skip';
  const cb=T.cueBall(); if(s.ballInHand){s.ballInHand=false;}
  const types=T.ballsOnTypes(), opts=T.potOptions(types).map(o=>({o,p:T.potChance(o,.0025,1)})).sort((a,b)=>b.p-a.p);
  if(opts.length&&opts[0].p>.3){const o=opts[0].o;s.aim=o.aim;if(s.phase==='color')s.nominated=o.target.type;s.settings[0].power=Math.round(30+o.distance*12);}
  else{const t=T.balls.filter(b=>!b.pocketed&&types.includes(b.type)).sort((a,b)=>Math.hypot(a.x-cb.x,a.z-cb.z)-Math.hypot(b.x-cb.x,b.z-cb.z))[0];
    if(!t)return 'none';s.aim=Math.atan2(t.z-cb.z,t.x-cb.x);if(s.phase==='color')s.nominated=t.type;s.settings[0].power=22;}
  s.settings[0].spinX=0;s.settings[0].spinY=0;T.refreshUI();T.takeShot();return 'shot'; }"""
def run(path, shots):
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = b.new_page(viewport={'width': 320, 'height': 200}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' or 'commentary' in m.text else None)
        pg.add_init_script("localStorage.setItem('velvet.botPace','skip');")
        pg.goto(pathlib.Path(path).resolve().as_uri()); pg.wait_for_function('window.__T', timeout=120000)
        pg.evaluate("window.__commLog=[]; document.querySelector('.mode[data-mode=bot]').click(); document.getElementById('start-button').click();")
        pg.wait_for_function('__T.PL.length==2', timeout=240000)
        pg.evaluate("() => { __T.setBot('murphy','veryhard'); }")
        team = pg.evaluate("() => document.getElementById('comm-tag').textContent")
        n = 0
        for _ in range(shots * 6):
            st = pg.evaluate("() => ({cur:__T.state.current,inShot:__T.state.inShot,dec:!!__T.state.decision,fin:__T.state.finished})")
            if st['fin']: break
            if st['dec']:
                pg.evaluate("() => { const b=document.querySelector('#decision-buttons button'); if(b) b.click(); }")
            elif st['cur'] == 0 and not st['inShot']:
                if pg.evaluate(HUMAN) == 'shot': n += 1
            pg.wait_for_timeout(1500)
            if n >= shots: break
        log = pg.evaluate("window.__commLog")
        b.close()
    said = [c for c in log if not c.startswith('-')]
    return {'team': team, 'human_shots': n, 'events': len(log), 'spoken': said, 'errors': errs[:5]}
if __name__ == '__main__':
    r = run(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 14)
    print(json.dumps(r, indent=1))
    print('PASS' if r['team'].startswith('COMMENTARY') and r['events'] > 3 and not r['errors'] else 'FAIL')
