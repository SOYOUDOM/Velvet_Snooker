"""VELVET HD people, end to end.
characters/hd.js lists twelve HD looks (players and referees) with their face shapes; the game loads them
for its own characters, the players and the referee get faces that blink, look round and react (a won
frame smiles, a reaction kind shows on the face), the referee's mouth follows his voice level (0 when he
is quiet), PEOPLE · HD / CLASSIC switches to the classic models after a reload, a character edited in
VELVET Studio keeps the classic model, the HD models are light enough (triangles, file size), and there
are no console errors.
usage: python3 -I tools/test_hd_people.py <test index.html>"""
import json, pathlib, struct, sys
from playwright.sync_api import sync_playwright
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
page_path = pathlib.Path(sys.argv[1]).resolve()
root = page_path.parent
results, errs = [], []
IDS = ['player_01', 'player_02', 'pro_m08', 'pro_m07', 'pro_m03', 'pro_b04', 'pro_b02', 'pro_m13', 'pro_oudom', 'referee', 'referee_m2', 'referee_f1']
FACE = ['blink', 'browsDown', 'browsUp', 'browsWorry', 'frown', 'open', 'press', 'pucker', 'smile', 'sneer', 'squint', 'wide']


def check(name, ok, info=''):
    results.append((name, bool(ok))); print(('PASS ' if ok else 'FAIL ') + name + (f'  {info}' if info else ''), flush=True)


# ---- the files
hd_js = (root / 'characters' / 'hd.js').read_text(encoding='utf-8')
looks = json.loads(next(l for l in hd_js.splitlines() if l.startswith('window.VELVET_HD='))[len('window.VELVET_HD='):-1])
check('hd.js lists the twelve players and referees', sorted(looks) == sorted(IDS), ','.join(sorted(looks)))
bad = []
for cid in IDS:
    p = root / 'characters' / 'hd' / (cid + '.glb')
    if not p.is_file():
        bad.append(cid + ': no file'); continue
    b = p.read_bytes(); n = struct.unpack('<I', b[12:16])[0]; js = json.loads(b[20:20 + n])
    names = set()
    for m in js['meshes']:
        names.update((m.get('extras') or {}).get('targetNames') or [])
    nodes = {x.get('name') for x in js['nodes']}
    tris = sum(js['accessors'][pr['indices']]['count'] // 3 for m in js['meshes'] for pr in m['primitives'] if 'indices' in pr)
    if names != set(FACE): bad.append(cid + ': face ' + ','.join(sorted(names)))
    if not {'Bip01 Head', 'Bip01 LEye', 'Bip01 REye', 'Bip01 R Hand', 'Bip01 L Finger2'} <= nodes: bad.append(cid + ': skeleton')
    if 'EXT_meshopt_compression' not in (js.get('extensionsUsed') or []): bad.append(cid + ': not compressed')
    if tris > 110000 or len(b) > 1.2e6: bad.append('%s: %d triangles, %.1f MB' % (cid, tris, len(b) / 1e6))
check('each HD model: twelve face shapes, the game skeleton with eyes, compressed, under 110k triangles and 1.2 MB', not bad, '; '.join(bad))

WAIT = "window.__T&&window.VelvetPeople&&VelvetPeople.ready&&__T.PL&&__T.PL.length===2&&__T.ref.person"
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    ctx = b.new_context(viewport={'width': 1280, 'height': 720})
    pg = ctx.new_page(); pg.set_default_timeout(600000)
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' and 'GL Driver' not in m.text else None)
    pg.add_init_script("try{localStorage.setItem('velvet.quality','medium');localStorage.setItem('velvet.open.mode','off')}catch(e){}")
    pg.goto(page_path.as_uri()); pg.wait_for_function(WAIT, timeout=400000); pg.wait_for_timeout(1500)

    st = pg.evaluate("""() => { const P=VelvetPeople,T=__T;
      return {hd:Object.values(P.templates).filter(t=>t.hd).map(t=>t.name), crowdHd:Object.values(P.templates).filter(t=>t.hd&&t.role==='audience').length,
        pl:T.PL.map(p=>({hd:p.p.tpl.hd,face:!!T.faceOf(p.p),eyes:(T.faceOf(p.p)||{eyes:[]}).eyes.length,ok:p.ok})),
        ref:{hd:T.ref.person.tpl.hd,face:!!T.faceOf(T.ref.person)}, button:(document.getElementById('hd-toggle')||{}).textContent}; }""")
    check('the game loads the twelve HD looks (the crowd stays classic)', sorted(st['hd']) == sorted(IDS) and st['crowdHd'] == 0, ','.join(st['hd']))
    check('both players and the referee are HD, with faces and two eyes', all(p['hd'] and p['face'] and p['eyes'] == 2 and p['ok'] for p in st['pl']) and st['ref']['hd'] and st['ref']['face'], json.dumps(st['pl']))
    check('the settings show PEOPLE · HD', st['button'] == 'PEOPLE · HD', st['button'])

    live = pg.evaluate("""() => new Promise(res => { const T=__T,f=T.faceOf(T.PL[0].p),r=T.faceOf(T.ref.person);
      let maxBlink=0,moves=0,last=null,rBlink=0;const t0=performance.now();
      const step=()=>{ for(const m of f.meshes){const i=m.morphTargetDictionary.blink;if(i!==undefined)maxBlink=Math.max(maxBlink,m.morphTargetInfluences[i]);}
        for(const m of r.meshes){const i=m.morphTargetDictionary.blink;if(i!==undefined)rBlink=Math.max(rBlink,m.morphTargetInfluences[i]);}
        const q=f.eyes[0].b.quaternion.toArray().map(v=>v.toFixed(4)).join();if(last&&q!==last)moves++;last=q;
        if(performance.now()-t0<9000)requestAnimationFrame(step);else res({maxBlink,rBlink,moves}); };step(); })""")
    check('the faces blink (a player and the referee) and the eyes move', live['maxBlink'] > .5 and live['rBlink'] > .5 and live['moves'] > 20, json.dumps(live))

    eyes = pg.evaluate("""() => { const T=__T,TH=THREE,f=T.faceOf(T.PL[0].p);   // the eyes point at what the player looks at
      const e=f.eyes[0],p=e.b.getWorldPosition(new TH.Vector3()),q=e.b.getWorldQuaternion(new TH.Quaternion());
      const fwd=e.fwd.clone().applyQuaternion(q).normalize(),to=f.gaze.clone().sub(p).normalize(),head=f.head.fwd.clone().applyQuaternion(f.head.b.getWorldQuaternion(new TH.Quaternion()));
      return {toTarget:+fwd.angleTo(to).toFixed(3),fromHead:+fwd.angleTo(head).toFixed(3)}; }""")
    check('the eyes look at the play, within what eyes can turn', eyes['toTarget'] < .5 and eyes['fromHead'] < .47, json.dumps(eyes))

    pg.evaluate("() => { const T=__T; T.faceExpr(T.PL[0].p,'win',2.2,0); T.faceExpr(T.PL[1].p,'anger',2.2,0); }")
    pg.wait_for_timeout(1300)
    ex = pg.evaluate("() => { const T=__T,a=T.faceOf(T.PL[0].p),b=T.faceOf(T.PL[1].p); return {smile:+a.w.smile.toFixed(2),brows:+b.w.browsDown.toFixed(2),press:+b.w.press.toFixed(2)}; }")
    check('expressions: a won frame smiles, anger lowers the brows and presses the lips', ex['smile'] > .6 and ex['brows'] > .6 and ex['press'] > .4, json.dumps(ex))
    pg.wait_for_timeout(3500)
    ex2 = pg.evaluate("() => { const T=__T,a=T.faceOf(T.PL[0].p); return {smile:+a.w.smile.toFixed(2)}; }")
    check('the expression fades when it is over', ex2['smile'] < .15, json.dumps(ex2))
    check('the referee is quiet: his voice level is 0', pg.evaluate("() => __T.refVoiceLevel()") == 0)

    edited = pg.evaluate("""() => { const P=VelvetPeople,base=(window.VelvetStudio&&VelvetStudio.basePeople||[]).find(e=>e.id==='player_01');
      const mine=Object.assign({},base,{textures:Object.assign({},base.textures)});   // what VELVET Studio puts in the list for an edited character
      return {base:!!P.hdLook(base), edited:!!P.hdLook(mine)}; }""")
    check('a character edited in VELVET Studio keeps the classic model', edited['base'] and not edited['edited'], json.dumps(edited))

    pg.evaluate("() => localStorage.setItem('velvet.hdPeople','off')")
    pg.reload(); pg.wait_for_function(WAIT, timeout=400000); pg.wait_for_timeout(1000)
    off = pg.evaluate("""() => ({hd:Object.values(VelvetPeople.templates).filter(t=>t.hd).length, faces:__T.faces.length,
      face:!!__T.faceOf(__T.PL[0].p), button:(document.getElementById('hd-toggle')||{}).textContent})""")
    check('PEOPLE · CLASSIC: no HD models and no faces after a reload', off['hd'] == 0 and off['faces'] == 0 and not off['face'] and off['button'] == 'PEOPLE · CLASSIC', json.dumps(off))
    pg.evaluate("() => localStorage.removeItem('velvet.hdPeople')")
    b.close()

check('no console errors', not errs, ' | '.join(errs[:4]))
print('%d/%d passed' % (sum(ok for _n, ok in results), len(results)))
sys.exit(0 if all(ok for _n, ok in results) else 1)
