"""Replays: a plant triggers the automatic slow-motion replay (with the shooter
animated on the shot); the frame-winning black is replayed as FRAME BALL before
the end screen; Y replays the frame's best shot. Saves a contact sheet."""
import pathlib, sys, io, json
from playwright.sync_api import sync_playwright
from PIL import Image
ARGS=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]
url=pathlib.Path(next((a for a in sys.argv[1:] if not a.startswith('--')),'test_step8/index.html')).resolve().as_uri()
SHOTS='--shots' in sys.argv
errs=[];ok=[];frames=[]
def check(name,cond):
    ok.append((name,bool(cond)));print(('PASS ' if cond else 'FAIL ')+name)
def snap(pg):
    if SHOTS:
        pg.evaluate("()=>{window.__noRender=false}");pg.wait_for_timeout(450)
        frames.append(Image.open(io.BytesIO(pg.screenshot())));pg.evaluate("()=>{window.__noRender=true}")
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=ARGS)
    pg=b.new_page(viewport={'width':800,'height':450});pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(url);pg.wait_for_function('window.__T && window.__T.balls && window.__T.balls.length>0 && window.VelvetPeople && VelvetPeople.ready',timeout=180000)
    pg.evaluate("()=>{__T.noIntro=false}");pg.click('.mode[data-mode="bot"]');pg.click('#start-button');pg.wait_for_timeout(500)
    check('intro plays at match start',pg.evaluate("()=>__T.cine.on&&__T.cine.kind==='intro'"))
    pg.keyboard.press('x');pg.wait_for_timeout(300)
    check('intro skips on a key',pg.evaluate("()=>!__T.cine.on"))
    # --- a plant: red B into red A, A into the corner pocket ---
    pg.evaluate("""()=>{const T=__T,s=T.state,K=T.K;s.current=0;s.ballInHand=false;s.phase='red';s.decision=null;
      const P=K.POCKETS.find(p=>p.x>0&&p.z>0),l=Math.hypot(P.x,P.z),ux=-P.x/l,uz=-P.z/l;
      const reds=T.balls.filter(b=>b.type==='red'&&!b.pocketed),A=reds[0],B=reds[1],cb=T.cueBall();
      A.x=P.x+ux*.30;A.z=P.z+uz*.30;B.x=A.x+ux*(2*K.R+.001);B.z=A.z+uz*(2*K.R+.001);cb.x=B.x+ux*.25;cb.z=B.z+uz*.25;
      for(const b of [A,B,cb]){b.vx=b.vz=0;}
      s.aim=Math.atan2(-uz,-ux);s.settings[0].power=30;s.settings[0].spinX=0;s.settings[0].spinY=-.42;T.refreshUI();T.takeShot();}""")
    pg.wait_for_function("()=>__T.cine.on||(!__T.state.inShot&&!__T.rec.cur&&__T.rec.last)",timeout=60000)
    pg.wait_for_function("()=>__T.cine.on",timeout=8000) if not pg.evaluate("()=>__T.cine.on") else None
    info=pg.evaluate("()=>({on:__T.cine.on,kind:__T.cine.kind,label:__T.rec.last&&__T.rec.last.d.label,score:__T.rec.last&&__T.rec.last.d.score,frames:__T.rec.last&&__T.rec.last.frames.length,shooter:__T.cine.shooter})")
    print(info,pg.evaluate("()=>(window.__shots||[]).map(s=>s.current+(s.byBot?'b':'h')).join(',')"))
    check('plant detected and auto-replayed',info['on'] and info['kind']=='shot' and info['label']=='PLANT')
    seen=set()
    for k in range(80):
        st=pg.evaluate("()=>({on:__T.cine.on,t:__T.cine.t,ph:__T.cine.phase||'',m:__T.PL[0].act,stance:__T.PL[0].stance,ui:document.body.classList.contains('replay-on')})")
        if not st['on']:break
        seen.add(st['ph'])
        if SHOTS and len(frames)<4 and st['t']>[-.9,.15,.7,1.6][len(frames)]:snap(pg)
        pg.wait_for_timeout(250)
        if k==2:check('shooter is down on the shot in the replay',st['m'] in ('down','getup') and st['stance']>.5)
    print('phases',seen)
    check('replay ends and hands back to play',not pg.evaluate("()=>__T.cine.on||document.body.classList.contains('replay-on')"))
    # --- frame ball: only the black left ---
    pg.wait_for_function("()=>!__T.state.inShot",timeout=30000)
    pg.evaluate("""()=>{const T=__T,s=T.state,K=T.K;s.current=0;s.ballInHand=false;s.decision=null;s.phase='clearance';s.clearanceIndex=5;s.scores=[60,10];
      for(const b of T.balls)if(b.type!=='cue'&&b.type!=='black'){b.pocketed=true;b.x=b.z=9;}
      const bk=T.balls.find(b=>b.type==='black'),cb=T.cueBall();bk.pocketed=false;bk.x=K.HX-.324;bk.z=0;
      const P=K.POCKETS.find(p=>p.x>0&&p.z>0),dx=bk.x-P.x,dz=bk.z-P.z,l=Math.hypot(dx,dz);
      cb.pocketed=false;cb.x=bk.x+dx/l*.3;cb.z=bk.z+dz/l*.3;s.aim=Math.atan2(-dz,-dx);s.settings[0].power=42;s.settings[0].spinY=-.42;T.refreshUI();T.takeShot();}""")
    pg.wait_for_function("()=>__T.cine.on&&__T.cine.kind==='ending'",timeout=60000)
    check('frame ball replay label',pg.evaluate("()=>document.querySelector('#replay-ui .replay-title').textContent.match(/(FRAME|MATCH) BALL/)"))
    check('end screen waits for the replay',not pg.evaluate("()=>document.getElementById('end-screen').classList.contains('active')"))
    pg.wait_for_timeout(1500);snap(pg)
    pg.wait_for_function("()=>!__T.cine.on",timeout=90000);pg.wait_for_timeout(700)
    check('end screen after the frame ball replay',pg.evaluate("()=>document.getElementById('end-screen').classList.contains('active')"))
    # --- Y: best shot of the frame ---
    best=pg.evaluate("()=>__T.rec.best&&__T.rec.best.d.label")
    pg.evaluate("()=>document.getElementById('end-screen').classList.remove('active')")
    pg.evaluate("()=>__T.replayBest()");pg.wait_for_timeout(300)
    check('Y replays the best shot (%s)'%best,pg.evaluate("()=>__T.cine.on&&__T.cine.kind!=='intro'"))
    pg.wait_for_timeout(1200);snap(pg)
    b.close()
if SHOTS and frames:
    W,H=400,225;sheet=Image.new('RGB',(W*3,H*((len(frames)+2)//3)))
    for i,im in enumerate(frames):sheet.paste(im.resize((W,H)),((i%3)*W,(i//3)*H))
    sheet.save('/tmp/shots/replay_sheet.png')
print('errors',errs[:5]);print('RESULT',sum(1 for _,c in ok if c),'/',len(ok))
