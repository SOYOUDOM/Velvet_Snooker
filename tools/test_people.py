"""VELVET people: Rocketbox people only, faces that move, smoother bodies, clean outfits.
Every person is a Rocketbox model (the MPFB people, characters/hd.js, and the Blender add-on that made them are
gone since 7.3; a PEOPLE · MPFB setting left from before changes nothing and is forgotten).
Their faces move through the face bones: they blink, look round and react (a won frame smiles, anger
lowers the brows), the referee's jaw follows his voice (still when he is quiet). The players and the
referee are smoothed at load (four triangles for one, nothing cracks), the crowd is not. The painted
outfits have no specks left. No console errors.
usage: python3 -I tools/test_people.py <test index.html>"""
import json, pathlib, struct, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from playwright.sync_api import sync_playwright
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
page_path = pathlib.Path(sys.argv[1]).resolve()
root = page_path.parent
results, errs = [], []


def check(name, ok, info=''):
    results.append((name, bool(ok))); print(('PASS ' if ok else 'FAIL ') + name + (f'  {info}' if info else ''), flush=True)


# ---- the files: no MPFB people, and nothing that makes or reads them
gone = [f for f in ['characters/hd.js', 'characters/hd', 'characters/blender.js', 'characters/blender', 'blender'] if (root / f).exists()]
check('no MPFB people: hd.js, characters/hd, blender.js and the Blender add-on are gone', not gone, ', '.join(gone))
index = page_path.read_text(encoding='utf-8')
check('index.html reads no MPFB or Blender people', 'hd.js' not in index and 'blender.js' not in index and 'hd-toggle' not in index)

specks = []
for name in ['player_01', 'pro_m03', 'pro_b04', 'pro_m13', 'pro_m08']:     # the painted waistcoat fronts
    a = np.asarray(Image.open(root / 'characters' / 'textures' / f'{name}_body.jpg').convert('L')).astype(float)
    z = a.shape[0] / 1024                                     # 1K (6.8) or 2K (7.0) textures: the same place, the same specks
    if z > 1: a = np.asarray(Image.fromarray(a.astype(np.uint8)).resize((1024, 1024), Image.LANCZOS)).astype(float)
    a = a[540:690, 430:600]
    salt = (a - ndi.median_filter(a, size=9)) > 70
    lab, k = ndi.label(salt)
    small = int(sum(1 for s in ndi.sum(salt, lab, range(1, k + 1)) if s <= 25)) if k else 0
    if small > 25: specks.append(f'{name}: {small}')        # clean cloth: under 20 (edges); the old paint: 40 to 190
check('the painted waistcoats have no stray specks', not specks, '; '.join(specks))

WAIT = "window.__T&&window.VelvetPeople&&VelvetPeople.ready&&__T.PL&&__T.PL.length===2&&__T.ref.person"
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    ctx = b.new_context(viewport={'width': 1280, 'height': 720})
    pg = ctx.new_page(); pg.set_default_timeout(600000)
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' and 'GL Driver' not in m.text else None)
    pg.add_init_script("try{localStorage.setItem('velvet.quality','medium');localStorage.setItem('velvet.open.mode','off')}catch(e){}")
    pg.goto(page_path.as_uri()); pg.wait_for_function(WAIT, timeout=400000); pg.wait_for_timeout(1500)

    st = pg.evaluate("""() => { const P=VelvetPeople,T=__T,tp=Object.values(P.templates);
      const tris=t=>{let n=0;t.scene.traverse(o=>{if(o.isSkinnedMesh&&!o.material.alphaTest)n+=o.geometry.index.count/3;});return n;};
      const smooth=t=>{let s=0,all=0;t.scene.traverse(o=>{if(o.isSkinnedMesh&&!o.material.alphaTest){all++;if(o.geometry.userData.smoothed)s++;}});return s===all&&all>0;};
      return {hdData:!!window.VELVET_HD, notRocketbox:tp.filter(t=>!t.rocketbox).map(t=>t.name),
        pl:T.PL.map(p=>{const f=T.faceOf(p.p);return {hd:p.p.tpl.hd,arkit:!!(f&&f.arkit),shapes:f&&f.meshes[0]?Object.keys(f.meshes[0].morphTargetDictionary).length:0,eyes:f?f.eyes.length:0,ok:p.ok};}),
        ref:(()=>{const f=T.faceOf(T.ref.person);return {hd:T.ref.person.tpl.hd,arkit:!!(f&&f.arkit),shapes:f&&f.meshes[0]?Object.keys(f.meshes[0].morphTargetDictionary).length:0,eyes:f?f.eyes.length:0};})(),
        smoothed:tp.filter(t=>t.role==='player'||t.role==='referee').every(smooth), crowdPlain:tp.filter(t=>t.role==='audience').every(t=>!smooth(t)),
        tris:{player:tris(P.templates.player_01),referee:tris(P.templates.referee)},
        button:!!document.getElementById('hd-toggle')}; }""")
    check('every person is a Rocketbox model; no PEOPLE · MPFB in the settings',
          not st['hdData'] and not st['notRocketbox'] and not st['button'], json.dumps([st['hdData'], st['notRocketbox'], st['button']]))
    check('both players and the referee have face shapes (52 ARKit + 15 speech shapes, two eyes)',
          all(p['arkit'] and p['shapes'] == 67 and p['eyes'] == 2 and p['ok'] for p in st['pl']) and st['ref']['arkit'] and st['ref']['shapes'] == 67 and st['ref']['eyes'] == 2,
          json.dumps([st['pl'], st['ref']]))
    check('players and referees are smoothed at load, the crowd is not', st['smoothed'] and st['crowdPlain'] and st['tris']['player'] > 20000, json.dumps(st['tris']))

    live = pg.evaluate("""() => new Promise(res => { const T=__T,f=T.faceOf(T.PL[0].p),r=T.faceOf(T.ref.person);
      const lid=x=>{const m=x.meshes[0];return m.morphTargetInfluences[m.morphTargetDictionary.EyeBlinkLeft];};let maxBlink=0,rBlink=0,moves=0,last=null;const t0=performance.now();
      const step=()=>{ maxBlink=Math.max(maxBlink,lid(f));rBlink=Math.max(rBlink,lid(r));
        const q=f.eyes[0].b.quaternion.toArray().map(v=>v.toFixed(4)).join();if(last&&q!==last)moves++;last=q;
        if(performance.now()-t0<9000)requestAnimationFrame(step);else res({maxBlink:+maxBlink.toFixed(2),rBlink:+rBlink.toFixed(2),moves}); };step(); })""")
    check('the faces blink (the lids close, a player and the referee) and the eyes move',
          live['maxBlink'] > .8 and live['rBlink'] > .8 and live['moves'] > 20, json.dumps(live))

    eyes = pg.evaluate("""() => { const T=__T,TH=THREE,f=T.faceOf(T.PL[0].p);
      const e=f.eyes[0],p=e.b.getWorldPosition(new TH.Vector3()),q=e.b.getWorldQuaternion(new TH.Quaternion());
      const fwd=e.fwd.clone().applyQuaternion(q).normalize(),to=f.gaze.clone().sub(p).normalize(),head=f.head.fwd.clone().applyQuaternion(f.head.b.getWorldQuaternion(new TH.Quaternion()));
      return {toTarget:+fwd.angleTo(to).toFixed(3),fromHead:+fwd.angleTo(head).toFixed(3)}; }""")
    check('the eyes look at the play, within what eyes can turn', eyes['toTarget'] < .5 and eyes['fromHead'] < .47, json.dumps(eyes))
    # the corneas point at what the eyes watch (7.0: aimed by the cornea, not by the face's tilted axes)
    aim = pg.evaluate("""() => { const T=__T,TH=THREE,f=T.faceOf(T.PL[0].p),out=[];
      for (const e of f.eyes) { const p=e.b.getWorldPosition(new TH.Vector3()),q=e.b.getWorldQuaternion(new TH.Quaternion());
        const fwd=e.fwd.clone().applyQuaternion(q),to=f.gaze.clone().sub(p).normalize(),head=f.head.fwd.clone().applyQuaternion(f.head.b.getWorldQuaternion(new TH.Quaternion()));
        out.push({deg:+(fwd.angleTo(to)*57.3).toFixed(1),free:to.angleTo(head)<.4}); }
      return out; }""")
    check('the eyes aim at their target (a cornea within 4 degrees of it, when the target is within reach)',
          all(a['deg'] < 4 for a in aim if a['free']), json.dumps(aim))

    pg.evaluate("() => { const T=__T; T.faceExpr(T.PL[0].p,'win',2.2,0); T.faceExpr(T.PL[1].p,'anger',2.2,0); }")
    pg.wait_for_timeout(1300)
    sh = "(f,n)=>{const m=f.meshes[0];return +m.morphTargetInfluences[m.morphTargetDictionary[n]].toFixed(2);}"
    ex = pg.evaluate("""() => { const T=__T,a=T.faceOf(T.PL[0].p),b=T.faceOf(T.PL[1].p),s=""" + sh + """;
      return {smile:+a.w.smile.toFixed(2),shape:s(a,'MouthSmileLeft'),cheek:s(a,'CheekSquintLeft'),brows:+b.w.browsDown.toFixed(2),press:+b.w.press.toFixed(2)}; }""")
    check('expressions: a won frame smiles (smile and cheek shapes), anger lowers the brows and presses the lips',
          ex['smile'] > .6 and ex['shape'] > .6 and ex['cheek'] > .3 and ex['brows'] > .6 and ex['press'] > .4, json.dumps(ex))
    pg.wait_for_timeout(3500)
    ex2 = pg.evaluate("() => { const T=__T,a=T.faceOf(T.PL[0].p),s=" + sh + "; return {smile:+a.w.smile.toFixed(2),shape:s(a,'MouthSmileLeft')}; }")
    check('the expression fades when it is over', ex2['smile'] < .15 and ex2['shape'] < .15, json.dumps(ex2))
    quiet = pg.evaluate("() => { const r=__T.faceOf(__T.ref.person),s=" + sh + "; return {voice:__T.refVoiceLevel(),jaw:s(r,'JawOpen')}; }")
    check('the referee is quiet: voice level 0, his jaw shut', quiet['voice'] == 0 and quiet['jaw'] < .02, json.dumps(quiet))
    # 7.0: the people at the table at full quality, and their textures given back when they leave it
    full = pg.evaluate("""() => { const P=VelvetPeople,T=__T,R=T.renderer,out={bad:[]};
      for (const t of Object.values(P.templates)) { if (t.role!=='player'&&t.role!=='referee'||t.name.startsWith('__')) continue;
        const parts={};t.scene.traverse(o=>{if(o.isMesh)parts[o.material.name.split('_').pop()]=o;});
        const h=parts.head,b=parts.body,w=x=>x&&x.material.map&&x.material.map.image&&x.material.map.image.width;
        const own=t.name==='pro_oudom';
        if (!(w(b)===2048&&(own||w(h)===2048)&&h.material.normalMap&&h.material.normalMap.image.width===2048&&b.material.normalMap&&h.material.roughnessMap))
          out.bad.push(t.name+': '+[w(b),w(h),!!h.material.normalMap,!!h.material.roughnessMap].join('/'));
        if (!(h.geometry.userData.smoothed&&(h.geometry.morphAttributes.position||[]).length===67)) out.bad.push(t.name+': head not smoothed with its shapes'); }
      const keep=[T.PL[0].p.tpl,T.PL[1].p.tpl,T.ref.person.tpl],other=Object.values(P.templates).find(t=>t.role==='player'&&!keep.includes(t));
      const maps=[];other.scene.traverse(o=>{if(o.isMesh)for(const k of ['map','normalMap','roughnessMap'])if(o.material[k])maps.push(o.material[k]);});
      for (const m of maps) R.initTexture(m);
      let kept=0,gone=0;const mine=[];for (const t of keep) t.scene.traverse(o=>{if(o.isMesh&&o.material.map)mine.push(o.material.map);});
      for (const m of mine) m.addEventListener('dispose',()=>kept++); for (const m of maps) m.addEventListener('dispose',()=>gone++);
      const up=R.info.memory.textures, freed=P.release(keep), down=R.info.memory.textures;
      out.release={other:other.name,maps:maps.length,up,freed,down,gone,keptDisposed:kept};
      return out; }""")
    check('the people at the table: 2K textures, real normal and shine maps, heads smoothed with their 67 shapes', not full['bad'], '; '.join(full['bad'][:6]))
    check('players and referees away from the table give their textures back to the graphics card, the ones at the table keep theirs',
          full['release']['gone'] == full['release']['maps'] > 0 and full['release']['down'] <= full['release']['up'] - full['release']['maps'] and full['release']['keptDisposed'] == 0,
          json.dumps(full['release']))

    # a PEOPLE · MPFB setting saved by an older version: still the Rocketbox people, and the setting is forgotten
    pg.evaluate("() => localStorage.setItem('velvet.hdPeople','on')")
    pg.reload(); pg.wait_for_function(WAIT, timeout=400000); pg.wait_for_timeout(1500)
    old = pg.evaluate("""() => { const P=VelvetPeople,T=__T,f=T.faceOf(T.PL[0].p),r=T.faceOf(T.ref.person);
      return {hdData:!!window.VELVET_HD,notRocketbox:Object.values(P.templates).filter(t=>!t.rocketbox).map(t=>t.name),
        faces:!!(f&&f.arkit&&r&&r.arkit),setting:localStorage.getItem('velvet.hdPeople')}; }""")
    check('an old PEOPLE · MPFB setting: still the Rocketbox people with their faces, and the setting is forgotten',
          not old['hdData'] and not old['notRocketbox'] and old['faces'] and old['setting'] is None, json.dumps(old))
    b.close()

check('no console errors', not errs, ' | '.join(errs[:4]))
print('%d/%d passed' % (sum(ok for _n, ok in results), len(results)))
sys.exit(0 if all(ok for _n, ok in results) else 1)
