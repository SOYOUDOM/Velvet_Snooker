"""VELVET 7.1 physics: squirt, throw, the nap and miscues.
usage: python3 tools/test_physics_feel.py <testcopy>/index.html"""
import json, math, pathlib, sys
from playwright.sync_api import sync_playwright
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
fails, notes = [], []
def check(name, ok, info=''):
    (notes if ok else fails).append(('PASS ' if ok else 'FAIL ') + name + (' ' + str(info) if info else ''))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1000, 'height': 600}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:200]))
    pg.add_init_script("try{localStorage.setItem('velvet.quality','low');localStorage.setItem('velvet.walkon','off')}catch(e){}")
    pg.goto(pathlib.Path(sys.argv[1]).resolve().as_uri()); pg.wait_for_function('window.__T && __T.balls && __T.balls.length', timeout=120000)
    pg.click('.mode[data-mode="practice"]'); pg.click('#start-button'); pg.wait_for_function("__T.state.started&&!__T.cine.on", timeout=60000)
    # squirt: the white leaves to the left of the aim with right-hand side, to the right with left-hand side, straight with none
    sq = pg.evaluate("""()=>{const T=__T,s=T.state,out={};T.newRack(false);const cb=T.cueBall();s.ballInHand=false;
      for(const sx of [1,0,-1]){cb.x=-1;cb.z=0;s.aim=0;cb.vx=cb.vz=0;s.inShot=false;s.settings[0].power=50;s.settings[0].spinX=sx;s.settings[0].spinY=0;
        T.takeShot(false);out[sx]=+(Math.atan2(cb.vz,cb.vx)*180/Math.PI).toFixed(3);s.inShot=false;cb.vx=cb.vz=0;cb.wx=cb.wy=cb.wz=0;}
      return out;}""")
    check('squirt: about 1.6° off line, away from the side used', -2.2 < sq['1'] < -1.0 and abs(sq['0']) < 1e-6 and 1.0 < sq['-1'] < 2.2, json.dumps(sq))
    # throw: a half-ball cut sends the object ball a little off the line of centres, more when slow
    # (run the real physics frame by frame and read the blue's direction just after contact)
    thr = {}
    for pw in [12, 35, 90]:
        r = pg.evaluate("""async(pw)=>{const T=__T;T.newRack(false);const s=T.state,cb=T.cueBall();s.ballInHand=false;
          for(const b of T.balls)if(b!==cb&&b.type!=='blue'){b.pocketed=true;b.x=9;b.z=9;}
          const ob=T.balls.find(b=>b.type==='blue');ob.x=0;ob.z=0;cb.x=-.5;cb.z=0;const R=T.K.R;
          // the ghost ball for a 30° cut: the white's centre at contact is 2R from the blue along 30°
          const gx=-2*R*Math.cos(Math.PI/6),gz=2*R*Math.sin(Math.PI/6);s.aim=Math.atan2(gz-cb.z,gx-cb.x);
          s.settings[0].power=pw;s.settings[0].spinX=0;s.settings[0].spinY=0;s.inShot=false;T.takeShot(false);
          const t0=performance.now();while(Math.hypot(ob.vx,ob.vz)<1e-4&&performance.now()-t0<8000)await new Promise(r=>setTimeout(r,5));
          const dir=Math.atan2(ob.vz,ob.vx)*180/Math.PI,line=-30;   // line of centres: from the ghost to the blue
          const t1=performance.now();while(s.inShot&&performance.now()-t1<30000)await new Promise(r=>setTimeout(r,40));
          return +(dir-line).toFixed(2);}""", pw)
        thr[pw] = r
    # (thrown forwards, along the white's travel: a cut is made a little thinner, as on a real table)
    check('throw: the object ball is thrown off the line of centres, more on a slow cut', all(v > 0 for v in thr.values()) and thr[12] > thr[35] > thr[90] and 2 < thr[12] < 6.5 and .3 < thr[90] < 2.5, json.dumps(thr))
    # the nap: a slow ball rolled across the table drifts towards the black end
    nap = pg.evaluate("""async()=>{const T=__T;T.newRack(false);const s=T.state,cb=T.cueBall();s.ballInHand=false;
        for(const b of T.balls)if(b!==cb){b.pocketed=true;b.x=9;b.z=9;}cb.x=-.3;cb.z=-.6;s.aim=Math.PI/2;
        s.settings[0].power=14;s.settings[0].spinX=0;s.settings[0].spinY=0;s.inShot=false;T.takeShot(false);
        const t0=performance.now();while(s.inShot&&performance.now()-t0<30000)await new Promise(r=>setTimeout(r,40));
        return {dx:+(cb.x+.3).toFixed(4),dz:+(cb.z+.6).toFixed(3)};}""")
    check('the nap: a slow ball rolled across the table drifts a little towards the black', .004 < nap['dx'] < .08 and nap['dz'] > .3, json.dumps(nap))
    # miscues: never in the middle of the white, sometimes at its very edge, with the warning on the spin pad
    mis = pg.evaluate("""()=>{const T=__T,s=T.state,res={};T.newRack(false);const cb=T.cueBall();s.ballInHand=false;
        for(const [name,sx,sy] of [['centre',0,0],['strong',.7,0],['edge',1,0]]){window.__miscues=0;
          for(let i=0;i<300;i++){cb.x=-1;cb.z=0;cb.vx=cb.vz=0;s.aim=0;s.inShot=false;s.settings[0].power=90;s.settings[0].spinX=sx;s.settings[0].spinY=sy;T.takeShot(false);s.inShot=false;cb.vx=cb.vz=0;}
          res[name]=window.__miscues;}
        s.settings[0].spinX=1;s.settings[0].spinY=0;return res;}""")
    pg.evaluate("()=>{const e=document.getElementById('spin-pad');const r=e.getBoundingClientRect();}")
    check('miscues: never from the middle or moderate side, sometimes from the edge', mis['centre'] == 0 and mis['strong'] == 0 and 40 < mis['edge'] < 140, json.dumps(mis))
    check('no page errors', not errors, json.dumps(errors[:3]))
    b.close()
print('\n'.join(notes + fails)); print('RESULT', 'OK' if not fails else 'FAILED', f'{len(notes)}/{len(notes)+len(fails)}')
