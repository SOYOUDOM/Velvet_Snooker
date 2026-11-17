"""VELVET people: classic faces, smoother bodies, clean outfits, and the MPFB people as an option.
By default the game uses the classic (Rocketbox) players and referee and does not read characters/hd.js.
Their faces move through the face bones: they blink, look round and react (a won frame smiles, anger
lowers the brows), the referee's jaw follows his voice (still when he is quiet). The players and the
referee are smoothed at load (four triangles for one, nothing cracks), the crowd is not. The painted
outfits have no specks left. PEOPLE · MPFB loads the twelve MPFB looks after a reload, with morph-target
faces; a character edited in VELVET Studio keeps the classic model; no console errors.
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
IDS = ['player_01', 'player_02', 'pro_m08', 'pro_m07', 'pro_m03', 'pro_b04', 'pro_b02', 'pro_m13', 'pro_oudom', 'referee', 'referee_m2', 'referee_f1']
FACE = ['blink', 'browsDown', 'browsUp', 'browsWorry', 'frown', 'open', 'press', 'pucker', 'smile', 'sneer', 'squint', 'wide']


def check(name, ok, info=''):
    results.append((name, bool(ok))); print(('PASS ' if ok else 'FAIL ') + name + (f'  {info}' if info else ''), flush=True)


# ---- the files
hd_js = (root / 'characters' / 'hd.js').read_text(encoding='utf-8')
looks = json.loads(next(l for l in hd_js.splitlines() if l.startswith('window.VELVET_HD='))[len('window.VELVET_HD='):-1])
check('hd.js lists the twelve MPFB players and referees', sorted(looks) == sorted(IDS), ','.join(sorted(looks)))
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
    if names != set(FACE): bad.append(cid + ': face ' + ','.join(sorted(names)))
    if not {'Bip01 Head', 'Bip01 LEye', 'Bip01 REye'} <= nodes: bad.append(cid + ': skeleton')
    if 'EXT_meshopt_compression' not in (js.get('extensionsUsed') or []): bad.append(cid + ': not compressed')
check('each MPFB model: twelve face shapes, the game skeleton with eyes, compressed', not bad, '; '.join(bad))
index = page_path.read_text(encoding='utf-8')
check('index.html does not load hd.js up front', '<script defer src="characters/hd.js">' not in index)

specks = []
for name in ['player_01', 'pro_m03', 'pro_b04', 'pro_m13', 'pro_m08']:     # the painted waistcoat fronts
    a = np.asarray(Image.open(root / 'characters' / 'textures' / f'{name}_body.jpg').convert('L')).astype(float)[540:690, 430:600]
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
      return {hdData:!!window.VELVET_HD, hd:tp.filter(t=>t.hd).length,
        pl:T.PL.map(p=>{const f=T.faceOf(p.p);return {hd:p.p.tpl.hd,bones:f&&f.bones?Object.keys(f.bones).length:0,eyes:f?f.eyes.length:0,ok:p.ok};}),
        ref:(()=>{const f=T.faceOf(T.ref.person);return {hd:T.ref.person.tpl.hd,bones:f&&f.bones?Object.keys(f.bones).length:0,eyes:f?f.eyes.length:0};})(),
        smoothed:tp.filter(t=>t.role==='player'||t.role==='referee').every(smooth), crowdPlain:tp.filter(t=>t.role==='audience').every(t=>!smooth(t)),
        tris:{player:tris(P.templates.player_01),referee:tris(P.templates.referee)},
        button:(document.getElementById('hd-toggle')||{}).textContent}; }""")
    check('classic by default: hd.js not read, no MPFB models, the settings show PEOPLE · CLASSIC',
          not st['hdData'] and st['hd'] == 0 and st['button'] == 'PEOPLE · CLASSIC', json.dumps([st['hdData'], st['hd'], st['button']]))
    check('both players and the referee have bone faces (18 face bones, two eyes)',
          all(p['bones'] >= 18 and p['eyes'] == 2 and p['ok'] for p in st['pl']) and st['ref']['bones'] >= 18 and st['ref']['eyes'] == 2, json.dumps([st['pl'], st['ref']]))
    check('players and referees are smoothed at load, the crowd is not', st['smoothed'] and st['crowdPlain'] and st['tris']['player'] > 20000, json.dumps(st['tris']))

    live = pg.evaluate("""() => new Promise(res => { const T=__T,f=T.faceOf(T.PL[0].p),r=T.faceOf(T.ref.person);
      const lid=x=>x.bones.LEyeBlinkTop,rest=x=>lid(x).pos;let maxBlink=0,rBlink=0,moves=0,last=null;const t0=performance.now();
      const step=()=>{ maxBlink=Math.max(maxBlink,lid(f).b.position.distanceTo(rest(f)));rBlink=Math.max(rBlink,lid(r).b.position.distanceTo(rest(r)));
        const q=f.eyes[0].b.quaternion.toArray().map(v=>v.toFixed(4)).join();if(last&&q!==last)moves++;last=q;
        if(performance.now()-t0<9000)requestAnimationFrame(step);else res({maxBlink:+(maxBlink*1000).toFixed(1),rBlink:+(rBlink*1000).toFixed(1),moves}); };step(); })""")
    check('the faces blink (lids swing several mm, a player and the referee) and the eyes move',
          live['maxBlink'] > 4 and live['rBlink'] > 4 and live['moves'] > 20, json.dumps(live))

    eyes = pg.evaluate("""() => { const T=__T,TH=THREE,f=T.faceOf(T.PL[0].p);
      const e=f.eyes[0],p=e.b.getWorldPosition(new TH.Vector3()),q=e.b.getWorldQuaternion(new TH.Quaternion());
      const fwd=e.fwd.clone().applyQuaternion(q).normalize(),to=f.gaze.clone().sub(p).normalize(),head=f.head.fwd.clone().applyQuaternion(f.head.b.getWorldQuaternion(new TH.Quaternion()));
      return {toTarget:+fwd.angleTo(to).toFixed(3),fromHead:+fwd.angleTo(head).toFixed(3)}; }""")
    check('the eyes look at the play, within what eyes can turn', eyes['toTarget'] < .5 and eyes['fromHead'] < .47, json.dumps(eyes))

    pg.evaluate("() => { const T=__T; T.faceExpr(T.PL[0].p,'win',2.2,0); T.faceExpr(T.PL[1].p,'anger',2.2,0); }")
    pg.wait_for_timeout(1300)
    ex = pg.evaluate("""() => { const T=__T,a=T.faceOf(T.PL[0].p),b=T.faceOf(T.PL[1].p),mm=(f,n)=>+(f.bones[n].b.position.distanceTo(f.bones[n].pos)*1000).toFixed(1);
      return {smile:+a.w.smile.toFixed(2),corner:mm(a,'LMouthCorner'),brows:+b.w.browsDown.toFixed(2),press:+b.w.press.toFixed(2)}; }""")
    check('expressions: a won frame smiles (the mouth corners move), anger lowers the brows and presses the lips',
          ex['smile'] > .6 and ex['corner'] > 5 and ex['brows'] > .6 and ex['press'] > .4, json.dumps(ex))
    pg.wait_for_timeout(3500)
    ex2 = pg.evaluate("() => { const T=__T,a=T.faceOf(T.PL[0].p); return {smile:+a.w.smile.toFixed(2),corner:+(a.bones.LMouthCorner.b.position.distanceTo(a.bones.LMouthCorner.pos)*1000).toFixed(1)}; }")
    check('the expression fades when it is over', ex2['smile'] < .15 and ex2['corner'] < 2, json.dumps(ex2))
    quiet = pg.evaluate("() => { const r=__T.faceOf(__T.ref.person); return {voice:__T.refVoiceLevel(),jaw:+r.bones.MJaw.b.quaternion.angleTo(r.bones.MJaw.q).toFixed(4)}; }")
    check('the referee is quiet: voice level 0, his jaw shut', quiet['voice'] == 0 and quiet['jaw'] < .01, json.dumps(quiet))

    pg.evaluate("() => localStorage.setItem('velvet.hdPeople','on')")
    pg.reload(); pg.wait_for_function(WAIT, timeout=400000); pg.wait_for_timeout(1500)
    on = pg.evaluate("""() => { const P=VelvetPeople,T=__T,f=T.faceOf(T.PL[0].p);
      const base=(window.VelvetStudio&&VelvetStudio.basePeople||[]).find(e=>e.id==='player_01'),mine=Object.assign({},base,{textures:Object.assign({},base.textures)});
      return {hd:Object.values(P.templates).filter(t=>t.hd).map(t=>t.name),crowdHd:Object.values(P.templates).filter(t=>t.hd&&t.role==='audience').length,
        players:T.PL.every(p=>p.p.tpl.hd),ref:T.ref.person.tpl.hd,morphs:!!(f&&f.meshes.length&&!f.bones),
        base:!!P.hdLook(base),edited:!!P.hdLook(mine),button:(document.getElementById('hd-toggle')||{}).textContent}; }""")
    check('PEOPLE · MPFB: after a reload the twelve MPFB looks load (not the crowd), with morph-target faces',
          sorted(on['hd']) == sorted(IDS) and on['crowdHd'] == 0 and on['players'] and on['ref'] and on['morphs'] and on['button'] == 'PEOPLE · MPFB',
          json.dumps({k: v for k, v in on.items() if k != 'hd'}))
    check('a character edited in VELVET Studio keeps the classic model', on['base'] and not on['edited'], json.dumps([on['base'], on['edited']]))
    pg.evaluate("() => localStorage.removeItem('velvet.hdPeople')")
    b.close()

check('no console errors', not errs, ' | '.join(errs[:4]))
print('%d/%d passed' % (sum(ok for _n, ok in results), len(results)))
sys.exit(0 if all(ok for _n, ok in results) else 1)
