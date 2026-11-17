"""VELVET Studio · objects & textures, end to end.
Pictures and videos on any material; .glb out with VX_ markers (table, nets, venue, trophy) and
back in (a new venue from markers, your own model, a new look for the table); banners; the nets'
cloth; undo; saving objects.js and the game picking it up on the next start; no console errors.
usage: python3 -I tools/test_studio_objects.py <test index.html> <image> <video>"""
import base64, json, pathlib, shutil, sys
from playwright.sync_api import sync_playwright
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
page_path, IMG, VID = pathlib.Path(sys.argv[1]).resolve(), sys.argv[2], sys.argv[3]
OUT = pathlib.Path('/tmp/studio_test'); shutil.rmtree(OUT, ignore_errors=True); OUT.mkdir()
results, errs = [], []
def check(name, ok, info=''):
    results.append((name, bool(ok))); print(('PASS ' if ok else 'FAIL ') + name + (f'  {info}' if info else ''), flush=True)
MATS = """(key) => { const out=[]; __T.scene.traverse(o=>{ if(o.material) for(const m of [].concat(o.material)) if(m&&m.userData.vxKey===key) out.push(m); }); return out; }"""
def mat_info(pg, key):
    return pg.evaluate("(key) => { const f=" + MATS + "; const ms=f(key); const m=ms[0]; if(!m) return null; const t=m.map;"
                       " return {n:ms.length, video:!!(t&&t.isVideoTexture), blob:!!(t&&t.image&&t.image.src&&t.image.src.startsWith('blob:')), glow:m.emissiveIntensity, own:!!m.userData.vxOwn}; }", key)
PARSE = """async (b64) => { const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); const g=await new Promise((res,rej)=>new THREE.GLTFLoader().parse(bin.buffer,'',res,rej));
  const names=[]; let meshes=0; g.scene.traverse(o=>{ if(o.name&&o.name.startsWith('VX_')) names.push(o.name.split('.')[0].replace(/_\d+$/,'')); if(o.isMesh&&!(o.name||'').startsWith('VX_')) meshes++; });
  const count={}; for(const n of names) count[n]=(count[n]||0)+1; return {meshes, markers:count}; }"""
def pick(pg, selector, path):
    with pg.expect_file_chooser() as fc: pg.click(selector)
    fc.value.set_files(path)
def download(pg, selector, name, menu=None):
    if menu: pg.click(menu)
    with pg.expect_download() as dl: pg.click(selector)
    p = OUT / name; dl.value.save_as(str(p)); return p
def slot(pg, key, sel):
    return f'.os-slot[data-key="{key}"] {sel}'
def idle(pg, ms=600): pg.wait_for_function("!document.getElementById('os-busy')||document.getElementById('os-busy').hidden", timeout=300000); pg.wait_for_timeout(ms)

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 720}, accept_downloads=True); pg.set_default_timeout(300000)
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' and 'GL Driver' not in m.text else None)
    pg.add_init_script("try{localStorage.setItem('velvet.venue','velvet');localStorage.setItem('velvet.quality','medium')}catch(e){}")
    pg.goto(page_path.as_uri() + '#studio'); pg.wait_for_function('window.__T', timeout=120000)
    pg.wait_for_function("window.VelvetPeople&&VelvetPeople.ready&&document.querySelector('.os-item')&&document.querySelectorAll('.os-gh').length>=6", timeout=300000); idle(pg)
    groups = pg.evaluate("() => [...document.querySelectorAll('.os-gh')].map(e=>e.childNodes[0].textContent)")
    check('studio opens with every group', groups[:5] == ['PEOPLE', 'TABLE', 'BALLS & CUE', 'VENUE · THE VELVET ROOM', 'PROPS'] and groups[-1] == 'YOUR OBJECTS', str(groups))
    n_slots = pg.evaluate("() => document.querySelectorAll('.os-slot').length")
    # 1. a picture on the cloth, then make it glow (one undo step each)
    pick(pg, slot(pg, 'table.cloth', '[data-act="pic"]'), IMG); idle(pg)
    mi = mat_info(pg, 'table.cloth')
    check('image on the table cloth', mi and mi['blob'] and mi['own'], json.dumps(mi))
    pg.evaluate("""() => { const r=document.querySelector('.os-slot[data-key="table.cloth"] [data-t="glow"]'); r.value=1.2; r.dispatchEvent(new Event('input',{bubbles:true})); r.dispatchEvent(new Event('change',{bubbles:true})); }"""); idle(pg, 300)
    check('glow slider lights it up', abs((mat_info(pg, 'table.cloth') or {}).get('glow', 0) - 1.2) < 1e-6)
    # 2. people: a character's materials are listed and take a picture
    pg.click('.os-item[data-id^="people/"]'); idle(pg)
    pkey = pg.evaluate("() => document.querySelector('.os-slot') && document.querySelector('.os-slot').dataset.key")
    pick(pg, slot(pg, pkey, '[data-act="pic"]'), IMG); idle(pg)
    pm = pg.evaluate("(key) => { const P=VelvetPeople,cid=key.split('.')[1],t=P.templates[cid];let ok=false,flip=null;t.scene.traverse(o=>{if(o.material)for(const m of [].concat(o.material))if(m.userData.vxKey===key&&m.map&&m.map.image&&String(m.map.image.src).startsWith('blob:')){ok=true;flip=m.map.flipY;}});return {ok,flip}; }", pkey)
    check('picture on a character (all copies of it)', pm['ok'] and pm['flip'] is False, f'{pkey} {pm}')
    # 3. the World Championship Arena: a video on its main LED screen
    pg.select_option('#os-venue', 'world-championship-arena'); idle(pg, 1500)
    pg.click('.os-item[data-id="venue"]'); idle(pg)
    key = 'venue.world-championship-arena.main-led-screen'
    pick(pg, slot(pg, key, '[data-act="pic"]'), VID); idle(pg, 1500)
    vi = mat_info(pg, key); vt = pg.evaluate("(key) => { const f=" + MATS + "; const v=f(key)[0].map.image; return v&&v.currentTime; }", key)
    check('video on the arena\'s main screen', vi and vi['video'] and vt > 0, f'{vi} t={vt}')
    # 4. .glb out, with markers
    p = download(pg, '[data-act="exportglb"]', 'venue.glb'); idle(pg)
    venue = pg.evaluate(PARSE, base64.b64encode(p.read_bytes()).decode())
    mk = venue['markers']
    check('venue .glb has seats, entrance, trophy, cameras, live screens, table and keep-clear markers',
          mk.get('VX_SEAT', 0) > 300 and mk.get('VX_ENTRANCE') == 1 and mk.get('VX_TROPHY') == 1 and mk.get('VX_TVCAM') == 3 and mk.get('VX_SCREEN_LIVE') == 2 and mk.get('VX_TABLE') == 1 and mk.get('VX_KEEP_CLEAR') == 1,
          f"{venue['meshes']} meshes, {json.dumps(mk)}")
    pg.click('.os-item[data-id="trophy"]'); idle(pg)
    trophy = download(pg, '[data-act="exportglb"]', 'trophy.glb'); idle(pg)
    pg.click('.os-item[data-id="table"]'); idle(pg)
    table = download(pg, '[data-act="exportglb"]', 'table.glb'); idle(pg)
    tb = pg.evaluate(PARSE, base64.b64encode(table.read_bytes()).decode())
    check('table .glb has VX_TABLE, six pockets and keep-clear', tb['markers'].get('VX_TABLE') == 1 and sum(v for k, v in tb['markers'].items() if k.startswith('VX_POCKET')) == 6 and tb['meshes'] > 5, json.dumps(tb))
    pg.click('.os-item[data-id="nets"]'); idle(pg)
    nets = pg.evaluate(PARSE, base64.b64encode(download(pg, '[data-act="exportglb"]', 'nets.glb').read_bytes()).decode()); idle(pg)
    check('nets .glb marks the cloth (VX_CLOTH)', nets['markers'].get('VX_CLOTH') == 1, json.dumps(nets))
    # 5. back in: the venue as a new venue, built from its markers
    pick(pg, '[data-act="addvenue"]', str(p)); idle(pg, 2500)
    nv = pg.evaluate("() => ({id:__T.venueId, mine:!!__T.VENUES[__T.venueId].mine, info:__T.venueInfo(), crowd:__T.crowd.length, vx:__T.vxObjects()})")
    check('imported venue joins the menu and seats its crowd at VX_SEAT', nv['mine'] and nv['info']['seats'] > 20 and nv['info']['cut'] > 100 and nv['crowd'] > 20,
          f"{nv['id']} seats {nv['info']['seats']} cut-outs {nv['info']['cut']} crowd {nv['crowd']}")
    check('imported venue: entrance, trophy and live screens from markers', nv['vx']['entrance'] and nv['vx']['trophyAt'] and nv['vx']['stageScreens'] == 2, json.dumps({k: nv['vx'][k] for k in ['entrance', 'trophyAt', 'stageScreens']}))
    # 6. your own model and a video banner
    pick(pg, '[data-act="addmodel"]', str(trophy)); idle(pg, 1200)
    pg.fill('[data-f="x"]', '2.5'); pg.dispatch_event('[data-f="x"]', 'change'); idle(pg, 300)
    cm = pg.evaluate("() => { const v=__T.vxObjects(); const e=v.OD.custom[v.OD.custom.length-1]; return {n:v.custom, x:e.pos[0], kind:e.kind}; }")
    check('your own .glb model is placed and moves', cm['n'] == 1 and abs(cm['x'] - 2.5) < 1e-6 and cm['kind'] == 'model', json.dumps(cm))
    pg.click('[data-act="addbanner"]'); idle(pg)
    bkey = pg.evaluate("() => document.querySelector('.os-slot').dataset.key")
    pick(pg, slot(pg, bkey, '[data-act="pic"]'), VID); idle(pg, 1200)
    bi = mat_info(pg, bkey)
    check('banner plays a video', bi and bi['video'], f'{bkey} {bi}')
    # 7. a new look for the table (the exported table, read back)
    pg.click('.os-item[data-id="table"]'); idle(pg)
    pick(pg, '[data-act="replace"]', str(table)); idle(pg, 1500)
    rp = pg.evaluate("() => { let hidden=0,shown=0; __T.scene.children.forEach(o=>{ if(o.userData.vxObj==='table'){ if(o.visible)shown++; else hidden++; } }); return {hidden,shown,repl:__T.vxObjects().repl}; }")
    check('your table model replaces the look (physics table unchanged)', rp['hidden'] > 5 and rp['shown'] == 0 and 'table' in rp['repl'], json.dumps(rp))
    # 8. undo takes the table model back off; redo puts it on again
    pg.click('[data-act="undo"]'); idle(pg, 1200)
    u1 = pg.evaluate("() => __T.vxObjects().repl")
    pg.click('[data-act="redo"]'); idle(pg, 1200)
    u2 = pg.evaluate("() => __T.vxObjects().repl")
    check('undo and redo', 'table' not in u1 and 'table' in u2, f'{u1} -> {u2}')
    # 9. the nets stretch round a ball in them
    pg.evaluate("() => { const bl=__T.balls.find(b=>b.type==='red'&&!b.pocketed); __T.potBall(bl,0); }"); pg.wait_for_timeout(4000)
    cl = pg.evaluate("() => __T.vxObjects().cloth")
    check('cloth: the net stretches round the ball', cl and max(c['maxd'] for c in cl) > .002, json.dumps(cl))
    # 10. save (download) -> the game reads it on the next start
    saved = download(pg, '[data-act="download"]', 'objects.js', menu='[data-act="savemenu"]'); pg.wait_for_timeout(500)
    text = saved.read_text()
    check('objects.js written with everything in it', text.startswith('/* VELVET Studio') and 'window.VELVET_OBJECTS=' in text and '"b64"' in text, f'{len(text)//1024} KB')
    shutil.copy(saved, page_path.parent / 'objects' / 'objects.js')
    pg.goto('about:blank'); pg.goto(page_path.as_uri()); pg.wait_for_function('window.__T', timeout=120000)
    pg.wait_for_function("window.VelvetPeople&&VelvetPeople.ready", timeout=300000); pg.wait_for_timeout(4000)
    st = pg.evaluate("() => { const v=__T.vxObjects(); const mine=Object.keys(__T.VENUES).filter(k=>__T.VENUES[k].mine); return {custom:v.custom, repl:v.repl, mine, venue:__T.venueId, studio:v.studio}; }")
    cloth2 = mat_info(pg, 'table.cloth')
    check('the game starts with your pictures, models, banner and venue', cloth2 and cloth2['blob'] and st['custom'] == 2 and 'table' in st['repl'] and len(st['mine']) == 1 and not st['studio'], json.dumps(st))
    b.close()
check('no console errors', not errs, '; '.join(errs[:4]))
print('RESULT', sum(ok for _, ok in results), '/', len(results))
