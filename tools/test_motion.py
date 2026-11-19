"""VELVET 6.9: people who move like people, real rests, your own sounds.
Checks: every body and face has a relief (normal) map; looping clips end where they start; paths go round
the table and keep clear of it; in a bot match nobody walks through anybody or into the table; the tip
addresses the cue ball where the spin is set; snookers required are counted; the referee brings the rest
and hands it over; a fading person is drawn with its depth first; a cheer plays once and runs on into
clapping; tournament draws are random; the commentary's delivery follows the moment; a sound of your own
replaces a built-in one and RESET brings it back; no console errors.
usage: python3 -I tools/test_motion.py <test index.html>"""
import json, pathlib, sys, time
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
page_path = pathlib.Path(sys.argv[1]).resolve()
root = page_path.parent
results, errs = [], []


def check(name, ok, info=''):
    results.append((name, bool(ok))); print(('PASS ' if ok else 'FAIL ') + name + (f'  {info}' if info else ''), flush=True)


# ---- relief maps: every body and face in characters.js has one (a person may share another's, as Soy Oudom
# shares player_01's face relief), and each is a real normal map
import subprocess
man = json.loads(subprocess.run(['node', '-e', "global.window={};require(process.argv[1]);console.log(JSON.stringify(window.VELVET_CHARACTERS))",
                                 str(root / 'characters' / 'characters.js')], capture_output=True, text=True, check=True).stdout)
bad = []
for e in man['people']:
    for part in ('body', 'head'):
        if part not in (e.get('textures') or {}): continue
        nrm = (e.get('normals') or {}).get(part)
        n = root / nrm if nrm else None
        if not n or not n.is_file():
            bad.append(f"{e['id']} {part}"); continue
        a = np.asarray(Image.open(n).convert('RGB'), dtype=float)
        if not (a[..., 2].mean() > 200 and abs(a[..., 0].mean() - 128) < 12 and abs(a[..., 1].mean() - 128) < 12):
            bad.append(n.name + ' not a normal map')
check('every body and face has a relief map listed in characters.js', not bad, ', '.join(bad[:6]))

WAIT = "window.__T&&window.VelvetPeople&&VelvetPeople.ready&&__T.PL&&__T.PL.length===2&&__T.ref.person"
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    ctx = b.new_context(viewport={'width': 1280, 'height': 720})
    pg = ctx.new_page(); pg.set_default_timeout(600000)
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' else None)
    pg.add_init_script("try{localStorage.setItem('velvet.quality','low');localStorage.setItem('velvet.opening.mode','off')}catch(e){}")
    pg.goto(page_path.as_uri()); pg.wait_for_function(WAIT, timeout=600000)

    r = pg.evaluate("""()=>{const P=VelvetPeople,t=P.templates.player_01||Object.values(P.templates).find(x=>x.rocketbox),c=P.fit(t,'m_idle_neutral_01')||P.fit(t,Object.keys(P.clips).find(k=>/idle/.test(k)));
      let worst=0;for(const tr of c.tracks){const n=tr.getValueSize(),v=tr.values,L=v.length;for(let k=0;k<n;k++)worst=Math.max(worst,Math.abs(v[k]-v[L-n+k]));}
      return {name:c.name,worst};}""")
    check('a looping idle ends exactly where it starts (no jump back)', r['worst'] < 1e-5, json.dumps(r))

    r = pg.evaluate("""()=>{const T=__T,K=T.K,p=T.planPath(.2,-1.35,.2,1.5,1),F=T.navField(1),N=T.NAV;let worst=9,x=.2,z=-1.35;
      for(const q of p){const L=Math.hypot(q[0]-x,q[1]-z),n=Math.ceil(L/.03);for(let k=1;k<=n;k++){const a=x+(q[0]-x)*k/n,b=z+(q[1]-z)*k/n,i=Math.round((a-N.x0)/N.cell),j=Math.round((b-N.z0)/N.cell);
        if(i>=0&&j>=0&&i<N.nx&&j<N.nz)worst=Math.min(worst,F[j*N.nx+i]);}x=q[0];z=q[1];}
      return {n:p.length,worst:+worst.toFixed(3)};}""")
    check('a path to the far side goes round the table, clear of it', r['n'] > 2 and r['worst'] > .2, json.dumps(r))

    # a bot match: nobody passes through anybody, nobody walks into the table
    pg.click('.mode[data-mode="bot"]'); pg.click('#start-button'); pg.wait_for_timeout(300)
    pg.evaluate("""()=>{const T=__T,K=T.K,log=window.__mlog={minPP:9,minPR:9,inTable:0,frames:0};
      const tick=()=>{requestAnimationFrame(tick);if(T.cine.on)return;log.frames++;const P=T.PL,rp=T.ref.person.obj.position;
        for(const p of P){if(p.fade<.5)continue;if(p.act==='walk'&&Math.abs(p.x)<K.HX+.06&&Math.abs(p.z)<K.HZ+.06)log.inTable++;
          if(p.act!=='sit')log.minPR=Math.min(log.minPR,Math.hypot(p.x-rp.x,p.z-rp.z));}
        if(P[0].fade>.5&&P[1].fade>.5&&P[0].act!=='sit'&&P[1].act!=='sit')log.minPP=Math.min(log.minPP,Math.hypot(P[0].x-P[1].x,P[0].z-P[1].z));};tick();}""")
    t0 = pg.evaluate("__T.time")
    while pg.evaluate("__T.time") - t0 < 70:
        pg.wait_for_timeout(500)
        st = pg.evaluate("()=>({cur:__T.state.current,inShot:__T.state.inShot,fin:__T.state.finished,dec:!!__T.state.decision,bih:__T.state.ballInHand,a0:__T.PL[0].act})")
        if st['fin']: break
        if st['dec']: pg.evaluate("()=>{const d=__T.state.decision;if(d&&d.chooser===0)__T.applyDecision('play')}"); continue
        if st['cur'] == 0 and not st['inShot'] and st['bih']: pg.evaluate("()=>{__T.state.ballInHand=false;__T.refreshUI()}")
        elif st['cur'] == 0 and not st['inShot'] and st['a0'] == 'down': pg.evaluate("()=>__T.takeShot(false)")
    m = pg.evaluate("window.__mlog")
    check('in a bot match nobody walks through anybody or into the table', m['minPP'] > .42 and m['minPR'] > .42 and m['inTable'] == 0 and m['frames'] > 500, json.dumps(m))

    r = pg.evaluate("""()=>{const T=__T,s=T.shotSettings(0),old={...s},was=T.state.inShot;T.state.inShot=false;s.spinX=0;s.spinY=1;const a=T.tipSpot(0);s.spinX=-1;s.spinY=-1;const b=T.tipSpot(0);
      Object.assign(s,old);T.state.inShot=was;return {top:a,screw:b,R:T.K.R};}""")
    check('the tip meets the cue ball where the spin is set', r['top'][1] > .4 * r['R'] and r['screw'][1] < -.4 * r['R'] and r['screw'][0] < 0, json.dumps(r))

    r = pg.evaluate("""()=>{const T=__T,s=T.state,old=s.scores.slice();s.scores=[0,40];const rem=T.pointsRemaining?T.pointsRemaining():null;
      s.scores=[0,rem+9];const n=T.snookerCount(0);s.scores=old;return {rem,n};}""")
    check('snookers required are counted', r['n'] == 3, json.dumps(r))

    # practice: the cue ball in the middle, out of reach: the referee brings the rest
    pg.evaluate("()=>{document.getElementById('menu-screen')?.classList.remove('active')}")
    pg.evaluate("()=>__T.beginNewGame(false,null,'practice')"); pg.wait_for_timeout(500)
    pg.evaluate("()=>{const T=__T,cb=T.cueBall();cb.x=.15;cb.z=.12;T.state.ballInHand=false;T.state.aim=.05;T.refreshUI();}")
    seen = set(); t0 = time.time(); r = {}
    while time.time() - t0 < 120:
        pg.wait_for_timeout(400)
        r = pg.evaluate("()=>({at:__T.KIT.at,rest:__T.PL[0].kit.rest,ext:__T.PL[0].kit.ext,act:__T.PL[0].act,task:__T.ref.task?Object.keys(__T.ref.task).join(','):''})")
        seen.add(r['at'])
        if r['act'] == 'down' and r['rest'] == 'hand': break
    check('the referee fetches the rest and hands it over; the player gets down with it and the extension', {'ref', 'player'} <= seen and r['act'] == 'down' and r['ext'] == 1, json.dumps(r) + ' ' + ','.join(sorted(seen)))

    r = pg.evaluate("""()=>{const T=__T,o=T.ref.person.obj;T.fadePerson(o,.3);let g=0,v=0,m=0;o.traverse(x=>{if(x.userData&&x.userData.ghostOf){g++;if(x.visible)v++;}else if(x.isMesh)m++;});
      T.fadePerson(o,1);let after=0,tr=0;o.traverse(x=>{if(x.userData&&x.userData.ghostOf&&x.visible)after++;if(x.isMesh&&!x.userData.ghostOf)for(const mt of [].concat(x.material))if(mt.transparent&&!mt.userData.transparent0)tr++;});return {m,g,v,after,tr};}""")
    check('a fading person lays its depth first (a hidden copy per mesh), and is opaque again after', r['g'] == r['m'] and r['v'] == r['m'] and r['after'] == 0 and r['tr'] == 0, json.dumps(r))

    r = pg.evaluate("""async()=>{const T=__T,C=T.crowd;T.crowdReact('cheer');await new Promise(r=>setTimeout(r,400));
      const cheer=C.filter(c=>c.cheer).length,once=C.filter(c=>c.cheer&&c.cheer.loop===THREE.LoopOnce).length,arms=C.filter(c=>c.arm).length;
      await new Promise(r=>setTimeout(r,9000));return {n:C.length,cheer,once,arms,left:C.filter(c=>c.cheer&&c.p.obj.visible).length};}""")
    check('a cheer plays once and runs on into clapping, then it is over', r['cheer'] > 0 and r['once'] == r['cheer'] and r['arms'] > r['n'] * .6 and r['left'] == 0, json.dumps(r))

    r = pg.evaluate("""()=>{const T=__T,draws=[0,1,2,3].map(()=>T.tourNew('quick','easy').rounds[0].flatMap(m=>[m.a,m.b]));
      return {distinct:new Set(draws.map(d=>d.join())).size,ok:draws.every(d=>new Set(d).size===16&&d.includes('you')&&d.every(id=>id==='you'||T.OPPONENTS.some(o=>o.id===id)))};}""")
    check('tournament draws are random, from the players there are', r['distinct'] > 1 and r['ok'], json.dumps(r))

    r = pg.evaluate("""()=>{const t=__T.commTone,a=t('pot_long'),b=t('miss_easy'),c=t('frame_ball');return {a,b,c};}""")
    check('the commentary is quicker and brighter for a great shot, slower and duller for a miss, hushed when tense',
          r['a']['rate'] > 1.04 and r['a']['bright'] > 0 and r['b']['rate'] < .96 and r['b']['bright'] < 0 and r['c']['gain'] < .9, json.dumps(r))

    r = pg.evaluate("""async()=>{const T=__T;T.state.sound=true;
      const sr=22050,n=Math.floor(sr/4),buf=new ArrayBuffer(44+n*2),d=new DataView(buf),w=(o,s)=>{for(let i=0;i<s.length;i++)d.setUint8(o+i,s.charCodeAt(i));};
      w(0,'RIFF');d.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,sr,true);d.setUint32(28,sr*2,true);d.setUint16(32,2,true);d.setUint16(34,16,true);w(36,'data');d.setUint32(40,n*2,true);
      for(let i=0;i<n;i++)d.setInt16(44+i*2,Math.sin(i/sr*2*Math.PI*440)*8000*(1-i/n),true);
      await T.replaceSound('click',new File([buf],'my-click.wav',{type:'audio/wav'}));
      const own=T.userSfx.click,label=document.getElementById('sounds-button').textContent,rows=document.querySelectorAll('#sounds-rows .sound-row').length;
      await T.resetSound('click');return {name:own&&own.name,decoded:!!(own&&own.buf),label,rows,after:!!T.userSfx.click,label2:document.getElementById('sounds-button').textContent};}""")
    check('a sound of your own replaces a built-in one, and RESET brings it back', r['name'] == 'my-click.wav' and r['decoded'] and '1 OF YOURS' in r['label'] and r['rows'] == 9 and not r['after'] and 'BUILT-IN' in r['label2'], json.dumps(r))

    real = [e for e in errs if 'GL Driver' not in e and 'GPU stall' not in e and 'AudioContext' not in e]
    check('no console errors', not real, ' | '.join(real[:4]))
    b.close()
n = sum(ok for _, ok in results)
print(f'{n}/{len(results)} passed')
sys.exit(0 if n == len(results) else 1)
