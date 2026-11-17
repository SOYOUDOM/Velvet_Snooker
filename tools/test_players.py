"""Players walk round the table: over a bot match (the human side plays random
shots once its player is down), the players never stand inside the table,
never jump (no teleports outside replays), never walk through each other, and
the bot strikes only once its player is down on the shot."""
import pathlib, sys, json, math
from playwright.sync_api import sync_playwright
ARGS=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]
url=pathlib.Path(next((a for a in sys.argv[1:] if not a.startswith('--')),'test_step8/index.html')).resolve().as_uri()
GAME_SECONDS=float(next((a[6:] for a in sys.argv[1:] if a.startswith('--secs')),'90'))
fails=[];errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=ARGS)
    pg=b.new_page(viewport={'width':800,'height':450});pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(url);pg.wait_for_function('window.__T && window.__T.balls && window.__T.balls.length>0 && window.VelvetPeople && VelvetPeople.ready',timeout=180000)
    pg.click('.mode[data-mode="bot"]');pg.click('#start-button');pg.wait_for_timeout(300)
    # sampled inside the page every frame so nothing is missed
    pg.evaluate("""()=>{const T=__T,K=T.K,log=window.__plog={n:0,inTable:[],jumps:[],overlap:[],botShots:[],humanShots:0,acts:{}};
      let last=null,lastShots=0,lastT=T.time;
      const tick=()=>{requestAnimationFrame(tick);
        const t=T.time,dt=t-lastT;lastT=t;if(T.cine.on){last=null;return;}
        const P=T.PL.map(p=>({x:p.x,z:p.z,a:p.act,f:p.fade}));log.n++;
        P.forEach((p,i)=>{log.acts[p.a]=(log.acts[p.a]||0)+1;
          if(p.f>.5&&Math.abs(p.x)<K.HX+.22&&Math.abs(p.z)<K.HZ+.22)log.inTable.push([i,+p.x.toFixed(2),+p.z.toFixed(2),p.a]);
          if(last&&dt>0&&dt<.2){const d=Math.hypot(p.x-last[i].x,p.z-last[i].z);if(d>1.25*dt+.03&&!(p.a==='down'&&last[i].a==='down'))log.jumps.push([i,+d.toFixed(3),+dt.toFixed(3),last[i].a,p.a]);}});
        if(P[0].f>.5&&P[1].f>.5&&P[0].a!=='sit'&&P[1].a!=='sit'){const d=Math.hypot(P[0].x-P[1].x,P[0].z-P[1].z);if(d<.4)log.overlap.push(+d.toFixed(2));}
        const n=(window.__shots||[]).length;
        if(n>lastShots){const s=window.__shots[n-1];if(s.byBot)log.botShots.push(T.PL[1].act);else log.humanShots++;lastShots=n;}
        last=P;};
      tick();}""")
    t0=pg.evaluate("()=>__T.time");handover=False
    while True:
        pg.wait_for_timeout(400)
        st=pg.evaluate("()=>({t:__T.time,cur:__T.state.current,inShot:__T.state.inShot,fin:__T.state.finished,dec:!!__T.state.decision,bih:__T.state.ballInHand,a0:__T.PL[0].act,since:__T.PL[0].t})")
        if st['t']-t0>GAME_SECONDS:break
        if '--verbose' in sys.argv:print(st,pg.evaluate("()=>({ph:__T.state.phase,nom:__T.state.nominated,ov:__T.isAnyOverlayOpen(),on:__T.ballsOnTypes(),ht:__T.humanTurn(),h:(__T.state.history||[]).slice(0,3).map(h=>h.text).join(' | ')})"))
        if st['fin']:
            pg.evaluate("()=>{document.getElementById('end-screen').classList.remove('active');document.getElementById('play-again-button')?.click()}");continue
        if st['dec'] and not handover:
            pg.evaluate("()=>{const d=__T.state.decision;if(d&&d.chooser===0)__T.applyDecision('play')}");continue
        if st['cur']==0 and not st['inShot'] and handover:
            # the test only needs the human side to play a shot: hand the turn to the bot
            pg.evaluate("()=>{const s=__T.state;s.decision=null;s.current=1;s.ballInHand=false;__T.refreshUI()}");handover=False;continue
        if st['cur']==0 and not st['inShot']:
            if st['bih']:pg.evaluate("()=>{__T.state.ballInHand=false;__T.refreshUI()}");continue
            if st['a0']=='down' and st['since']>.6:
                pg.evaluate("""()=>{const T=__T,s=T.state,cb=T.cueBall();const on=T.ballsOnTypes?T.ballsOnTypes():['red'];let cand=T.balls.filter(b=>!b.pocketed&&b.type!=='cue'&&on.includes(b.type));
                  if(!cand.length)cand=T.balls.filter(b=>!b.pocketed&&b.type!=='cue');cand.sort((a,b)=>Math.hypot(a.x-cb.x,a.z-cb.z)-Math.hypot(b.x-cb.x,b.z-cb.z));
                  const R=T.K.R,clear=tg=>T.balls.every(b=>{if(b===tg||b.type==='cue'||b.pocketed)return true;const dx=tg.x-cb.x,dz=tg.z-cb.z,L=Math.hypot(dx,dz),u=((b.x-cb.x)*dx+(b.z-cb.z)*dz)/L;
                    if(u<0||u>L)return true;return Math.abs((b.z-cb.z)*dx-(b.x-cb.x)*dz)/L>2.1*R;});
                  const tg=cand.find(clear)||cand[0];if(s.phase==='color')s.nominated=tg.type;s.aim=Math.atan2(tg.z-cb.z,tg.x-cb.x);s.settings[0].power=30+Math.random()*40;T.takeShot();}""")
                handover=True
    log=pg.evaluate("()=>window.__plog")
    b.close()
print(json.dumps({k:(v if not isinstance(v,list) else v[:8]) for k,v in log.items()}))
def check(name,cond):
    print(('PASS ' if cond else 'FAIL ')+name)
    if not cond:fails.append(name)
check('never inside the table (%d samples)'%log['n'],not log['inTable'])
check('no jumps outside replays',not log['jumps'])
check('never walk through each other',not log['overlap'])
check('bot strikes only when down (%d bot shots)'%len(log['botShots']),all(a=='down' for a in log['botShots']) and len(log['botShots'])>0)
check('walks happened',log['acts'].get('walk',0)>50)
print('errors',errs[:5]);print('RESULT','OK' if not fails and not errs else 'FAILED')
