"""VELVET Studio end to end, in headless Chrome (software WebGL):
create an opponent with the New dialog, give him a face from a photo, an
outfit colour, a sticker and paint; undo/redo; save (download); reload the
studio and find it all again; the game loads him (his textures, his profile,
his body at the table); Test in game from the studio; export and import.
usage: python3 tools/test_studio.py [test_dir]"""
import pathlib, sys, json, time
from playwright.sync_api import sync_playwright
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'test_step9').resolve()
(root / 'characters/studio.js').write_text('window.VELVET_STUDIO = null;\n')
fails, errs, notes = [], [], []
def check(c, msg):
    if not c: fails.append(msg)
READY = "window.__studio && __studio.cur.id===%r && __studio.cur.parts && Object.keys(__studio.cur.parts).length>0 && document.getElementById('busy').hidden"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    ctx = b.new_context(viewport={'width': 1440, 'height': 860}, accept_downloads=True)
    pg = ctx.new_page(); pg.set_default_timeout(240000)
    pg.on('pageerror', lambda e: errs.append('studio: ' + str(e)))
    t0 = time.time(); pg.goto((root / 'VELVET Studio.html').as_uri())
    pg.wait_for_function("window.__studio && __studio.cur.parts && Object.keys(__studio.cur.parts).length>0")
    notes.append('studio ready %.1fs' % (time.time() - t0))
    # a photo: another character's evenly lit face image, eyes and mouth found from his face bones
    pg.evaluate("()=>__studio.select('char','female_adult_09')"); pg.wait_for_function(READY % 'female_adult_09')
    photo = pg.evaluate("""()=>{const S=__studio,T=THREE,lm=S.cur.lm,head=S.cur.parts.head;
      const uvAt=v=>{const h=S.X.raycast([head],new T.Ray(v.clone().addScaledVector(lm.F,0.3),lm.F.clone().negate()));return [(h.uv[0]%1)*head.W,(h.uv[1]%1)*head.H];};
      const cv=document.createElement('canvas');cv.width=head.W;cv.height=head.H;cv.getContext('2d').putImageData(head.base,0,0);
      return {url:cv.toDataURL('image/jpeg',.95),pts:[uvAt(lm.eyeR),uvAt(lm.eyeL),uvAt(lm.mouth)]};}""")
    # New dialog: an opponent called Sam Lee, from Snooker player 2
    pg.click('#new-btn'); pg.fill('#n-name', 'Sam Lee'); pg.check('input[name=nb][value=player_02]'); pg.click('#n-ok')
    pg.wait_for_function("window.__studio && __studio.cur.id && __studio.cur.id.startsWith('my_sam_lee') && document.getElementById('busy').hidden && __studio.cur.parts && __studio.cur.parts.head")
    cid = pg.evaluate("()=>__studio.cur.id")
    d = pg.evaluate("()=>JSON.parse(JSON.stringify(__studio.D))")
    opp = [o for o in d['opponents'] if o.get('character') == cid]
    check(len(opp) == 1 and opp[0]['name'] == 'Sam Lee' and opp[0].get('tour'), 'new opponent profile ' + json.dumps(opp))
    # shape
    pg.evaluate("()=>{const S=__studio,e=S.D.people.find(x=>x.id===S.cur.id);e.height=1.88;e.headScale=1.12;e.belly=.6;S.applyShape();}")
    # face from the photo
    t = time.time()
    pg.evaluate("""async (ph)=>{const S=__studio;S.tab='face';const img=await S.X.loadImage(ph.url);await S.setPhoto(img,false);
      const f=S.faceSet();f.pts=ph.pts.map(q=>q.slice());f.even=0;S.bakeFace(true);S.renderPanel();}""", photo)
    notes.append('photo bake %.2fs' % (time.time() - t))
    # outfit colour (waistcoat), a moustache, a paint dab
    r = pg.evaluate("""()=>{const S=__studio,T=THREE,lm=S.cur.lm,parts=Object.values(S.cur.parts);
      const ray=(p,dir)=>S.X.raycast(parts,new T.Ray(p.clone().addScaledVector(dir,0.4),dir.clone().negate()));
      const hb=ray(new T.Vector3(0.06,1.12,0),new T.Vector3(0,0,1));S.pickRegion(hb,false);const reg=hb.part.regions.at(-1);reg.color='#7d1520';hb.part.highlight=null;
      S.startSticker('moustache');const hm=ray(lm.mouth.clone().addScaledVector(lm.up,0.014),lm.F);S.placeSticker(hm);S.stopSticker(false);
      S.setTool('paint');S.toolOpt.color='#2f7fd0';const hp=ray(lm.eyeL.clone().lerp(lm.mouth,.5).addScaledVector(lm.X,.03),lm.F);S.edit('t');S.brushAt(hp);S.setTool(null);
      return {outfit:hb.part.key,sticker:hm.part.key,paint:hp.part.key,undo:document.getElementById('undo-btn').disabled};}""")
    check(r['outfit'] == 'body' and r['sticker'] == 'head' and not r['undo'], 'tools ' + json.dumps(r))
    # undo the paint dab, redo it
    paintSum = "()=>{const p=__studio.cur.parts.head.paint;let s=0;if(p)for(let i=3;i<p.length;i+=4)s+=p[i];return s}"
    a = pg.evaluate(paintSum); pg.click('#undo-btn'); pg.wait_for_timeout(300); u = pg.evaluate(paintSum); pg.click('#redo-btn'); pg.wait_for_timeout(300); rr = pg.evaluate(paintSum)
    check(u < a and rr == a, 'undo/redo paint %s %s %s' % (a, u, rr))
    pg.evaluate("()=>__studio.camPreset('face',true)"); pg.wait_for_timeout(900); pg.screenshot(path='/tmp/ts_face.png')
    pg.evaluate("()=>{__studio.tab='character';__studio.camPreset('front',true)}"); pg.wait_for_timeout(900); pg.screenshot(path='/tmp/ts_char.png')
    # save as a download
    with pg.expect_download() as dl:
        pg.click('#save-more'); pg.click('#save-menu button[data-act=download]')
    path = dl.value.path(); text = pathlib.Path(path).read_text()
    (root / 'characters/studio.js').write_text(text)
    notes.append('studio.js %d KB' % (len(text) // 1024))
    pg.click('#m-ok')
    check('Saved' in pg.text_content('#status'), 'status after save: ' + pg.text_content('#status'))
    # export, for the import check later
    with pg.expect_download() as dl2:
        pg.evaluate("(id)=>__studio.select('char',id)", cid); pg.click('#export-btn')
    exported = json.loads(pathlib.Path(dl2.value.path()).read_text())
    check(exported['format'] == 'velvet-character' and exported['profile'] and len(exported['files']) >= 4, 'export file: files=%d' % len(exported['files']))
    # reload: everything comes back
    pg.reload(); pg.wait_for_function("window.__studio && __studio.cur.parts && Object.keys(__studio.cur.parts).length>0")
    pg.evaluate("(id)=>__studio.select('char',id)", cid); pg.wait_for_function(READY % cid)
    r = pg.evaluate("()=>{const c=__studio.cur.parts,e=__studio.cur.entry;return{face:!!c.head.face,paint:!!c.head.paint,regions:c.body.regions.length,photo:!!__studio.cur.photo,h:e.height,head:e.headScale,belly:e.belly}}")
    check(r['face'] and r['paint'] and r['regions'] == 1 and r['photo'] and r['h'] == 1.88, 'after reload ' + json.dumps(r))
    # import the exported file: a second Sam Lee with his own id and profile
    pg.evaluate("(j)=>__studio.importChar(j)", exported)
    pg.wait_for_function("window.__studio && __studio.cur.id && __studio.cur.id!==%r && __studio.cur.id.startsWith('my_sam_lee') && document.getElementById('busy').hidden && __studio.cur.parts && __studio.cur.parts.head" % cid)
    r = pg.evaluate("()=>{const S=__studio,o=S.D.opponents.filter(x=>x.name==='Sam Lee');return{id:S.cur.id,face:!!S.cur.parts.head.face,profiles:o.length,linked:o.map(x=>x.character)}}")
    check(r['face'] and r['profiles'] == 2 and r['id'] in r['linked'], 'import ' + json.dumps(r))
    # Test in game from the studio: the game opens and plays against him
    pg.evaluate("(id)=>__studio.select('char',id)", cid); pg.wait_for_function(READY % cid)
    with pg.expect_popup(timeout=60000) as pop:
        pg.click('#test-btn')
    g = pop.value; g.on('pageerror', lambda e: errs.append('test game: ' + str(e)))
    g.wait_for_function("window.__T && window.VelvetPeople && VelvetPeople.ready && __T.PL.length==2 && __T.state.started", timeout=240000)
    r = g.evaluate("()=>({body:__T.PL[1].p.tpl.name,opp:__T.botOpponent.name,map:(()=>{let s='';__T.PL[1].p.obj.traverse(o=>{if(o.isMesh&&/head/i.test(o.material.name)&&o.material.map)s=String(o.material.map.image&&o.material.map.image.src||'').slice(0,22)});return s})()})")
    check(r['body'] == cid and r['opp'] == 'Sam Lee' and r['map'].startswith('data:image/jpeg'), 'test in game ' + json.dumps(r))
    g.evaluate("()=>{__T.cine.on=false;window.__noRender=false;}"); g.wait_for_timeout(1500)
    g.evaluate("""()=>{const pl=__T.PL[1],c=__T.camera,h=pl.p.obj.getObjectByName('Bip01_Head').getWorldPosition(new THREE.Vector3());
      __T.cam.mode='free';__T.render=()=>{};c.position.set(h.x+0.55,h.y+0.05,h.z+0.75);c.lookAt(h);c.fov=40;c.updateProjectionMatrix();}""")
    b.close()
print('\n'.join(notes))
print('errors:', errs[:6])
print('RESULT', 'OK' if not fails and not errs else 'FAILED', fails)
