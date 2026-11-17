"""Venues: every venue loads; the World Championship Arena is in the menu and builds its own
environment and branding; switching venues frees what the last one used; the table, the
players, the referee, the crowd and the cameras all work there; the walk-on stays clear of
the barrier; no console errors.
usage: python3 -I tools/test_venues.py <test index.html>"""
import json, math, pathlib, sys
from playwright.sync_api import sync_playwright
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
NEW = 'world-championship-arena'
BARRIER = [[[4.0, -2.5], [4.0, 2.5]], [[4.0, 2.5], [3.0, 3.5]], [[3.0, 3.5], [-4.6, 3.5]], [[-4.6, 3.5], [-4.6, -2.4]], [[-3.4, -3.5], [3.0, -3.5]], [[3.0, -3.5], [4.0, -2.5]]]

def seg_dist(p, a, b):
    ax, az = a; bx, bz = b; dx, dz = bx - ax, bz - az
    t = max(0, min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / (dx * dx + dz * dz)))
    return math.hypot(p[0] - ax - t * dx, p[1] - az - t * dz)

results, errs = [], []
def check(name, ok, info=''):
    results.append((name, bool(ok))); print(('PASS ' if ok else 'FAIL ') + name + (f'  {info}' if info else ''))

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 320, 'height': 180}); pg.set_default_timeout(600000)
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' else None)
    pg.add_init_script("try{localStorage.setItem('velvet.quality','medium');localStorage.setItem('velvet.venue','velvet')}catch(e){}")
    pg.goto(pathlib.Path(sys.argv[1]).resolve().as_uri()); pg.wait_for_function('window.__T', timeout=120000)
    opts = pg.evaluate("() => [...document.querySelectorAll('#venue-select option')].map(o=>[o.value,o.textContent])")
    check('new venue in the venue menu', [NEW, 'WORLD CHAMPIONSHIP ARENA'] in opts, f'{len(opts)} venues')
    check('existing venues all still offered', all(k in [o[0] for o in opts] for k in ['velvet', 'theatre', 'palace', 'arena', 'dome', 'stage']))
    pg.evaluate("() => { document.querySelector('.mode[data-mode=practice]').click(); document.getElementById('start-button').click(); }")
    pg.wait_for_function("window.VelvetPeople&&VelvetPeople.ready&&__T.crowd.length>0&&__T.PL.length>0", timeout=300000)
    SWITCH = "async (v) => { const s=document.getElementById('venue-select'); s.value=v; s.dispatchEvent(new Event('change')); window.__noRender=false; await new Promise(r=>setTimeout(r,700)); window.__noRender=true; const m=__T.renderer.info.memory; return Object.assign(__T.venueInfo(),{crowd:__T.crowd.length,geo:m.geometries,tex:m.textures}); }"
    # 1. every venue loads (and 8. switching frees the last venue's resources)
    seen = {}
    for v, _ in opts:
        seen[v] = pg.evaluate(SWITCH, v)
    for v, _ in opts:
        a = seen[v]
        check(f'{v} loads', a['children'] > 5 and a['crowd'] > 10 and a['seats'] > 10, f"crowd {a['crowd']} seats {a['seats']} parts {a['children']}")
    base = pg.evaluate(SWITCH, 'velvet'); again = None
    for k in range(2):
        pg.evaluate(SWITCH, NEW); pg.evaluate(SWITCH, 'stage'); again = pg.evaluate(SWITCH, 'velvet')
    check('switching venues does not leak GPU memory', again['geo'] <= base['geo'] + 2 and again['tex'] <= base['tex'] + 2,
          f"velvet before: {base['geo']} geometries {base['tex']} textures; after 2 more rounds: {again['geo']} / {again['tex']}")
    heap = pg.evaluate("() => performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576) : -1")
    # 3. the new venue builds its own environment; 4. its branding is its own
    pg.evaluate("() => { window.__texts=[]; const f=CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText=function(t,...a){ window.__texts.push(String(t)); return f.call(this,t,...a); }; }")
    arena = pg.evaluate(SWITCH, NEW)
    texts = pg.evaluate("() => window.__texts")
    check('arena builds its stage, rig, screens and cut-out crowd', arena['group'] and arena['rig'] and arena['cycle'] == 2 and arena['cut'] > 150 and arena['cutouts'],
          f"seats {arena['seats']} cut-outs {arena['cut']} live crowd {arena['crowd']}")
    check('arena graphics carry its own branding, not VELVET', any('WORLD CHAMPIONSHIP' in t for t in texts) and not any('VELVET' in t.upper() for t in texts), f'{len(texts)} texts drawn')
    card = pg.evaluate("() => ({name:document.getElementById('venue-name').textContent, shot:!document.getElementById('venue-shot').hidden, brand:document.querySelector('.brand-name').textContent, event:__T.VENUES[__T.venueId].event})")
    check('venue card shows the arena; the game is still VELVET', card['name'] == 'WORLD CHAMPIONSHIP ARENA' and card['shot'] and card['brand'].startswith('VELVET') and card['event'] == 'WORLD CHAMPIONSHIP', json.dumps(card))
    # 9. cameras: every preset frames from a sane place, clear of spectators; the rig gets out of the way of high views
    cams = []
    for i in range(7):
        c = pg.evaluate("async (i) => { __T.setCamera(i); window.__noRender=false; await new Promise(r=>setTimeout(r,1400)); window.__noRender=true; const p=__T.camera.position;"
                        "let near=99;for(const c of __T.crowd){if(!c.p.obj.visible&&false)continue;const o=c.p.obj.position;near=Math.min(near,Math.hypot(o.x-p.x,o.y+1.1-p.y,o.z-p.z));}"
                        "return {i,x:+p.x.toFixed(2),y:+p.y.toFixed(2),z:+p.z.toFixed(2),near:+near.toFixed(2),rig:__T.venueInfo().rigVisible}; }", i)
        cams.append(c)
    check('match cameras stay clear of the audience', all(c['near'] > .6 and math.isfinite(c['x']) for c in cams), json.dumps([(c['i'], c['near']) for c in cams]))
    check('lighting rig hides for views from above', all((not c['rig']) == (c['y'] > -0.854 + 6.0 - .3) for c in cams), json.dumps([(c['i'], c['y'], c['rig']) for c in cams]))
    # 5. table and gameplay; 6. players and referee
    shot = pg.evaluate("""async () => { const T=__T,s=T.state,cb=T.cueBall(),x0=cb.x,z0=cb.z;s.ballInHand=false;
        const red=T.balls.find(b=>b.type==='red'&&!b.pocketed);s.aim=Math.atan2(red.z-cb.z,red.x-cb.x);s.settings[0].power=55;T.refreshUI();T.takeShot();
        const t0=performance.now();while((s.inShot||performance.now()-t0<800)&&performance.now()-t0<25000)await new Promise(r=>setTimeout(r,200));
        const c2=T.cueBall()||cb;return {moved:Math.hypot(c2.x-x0,c2.z-z0),still:!s.inShot,nan:T.balls.some(b=>!isFinite(b.x)||!isFinite(b.z)),
          ref:!!(T.ref&&T.ref.person),pl:T.PL.map(p=>p.act)}; }""")
    check('shot plays out on the arena table', shot['moved'] > .2 and shot['still'] and not shot['nan'], json.dumps(shot))
    check('player and referee are animated', shot['ref'] and len(shot['pl']) >= 1)
    acts = pg.evaluate("async () => { const seen=new Set();__T.setCamera(1);window.__noRender=false;await new Promise(r=>setTimeout(r,1500));window.__noRender=true;for(let i=0;i<40;i++){for(const p of __T.PL)seen.add(p.act);await new Promise(r=>setTimeout(r,150));}"
                       "return {acts:[...seen],crowdOn:__T.crowd.filter(c=>c.p.obj.visible).length,cutouts:__T.venueInfo().cutouts}; }")
    check('audience is drawn', acts['crowdOn'] > 10 and acts['cutouts'], json.dumps(acts))
    # the walk-on: players come in through the players' entrance and go to their chairs clear of the barrier
    walk = pg.evaluate("""async () => { const T=__T;T.noIntro=false;T.state.mode='practice';T.startIntro();const pts=[];
        for(let i=0;i<120;i++){for(const p of T.PL)if(p.fade>.3&&!p.hid)pts.push([+p.x.toFixed(2),+p.z.toFixed(2),p.act]);await new Promise(r=>setTimeout(r,250));}
        return pts; }""")
    clear = min((min(seg_dist((x, z), a, c) for a, c in BARRIER) for x, z, _ in walk), default=9)
    check('walk-on stays clear of the barrier', walk and clear > .18, f'{len(walk)} samples, closest {clear:.2f} m, first {walk[:1]}')
    b.close()
check('no console errors', not errs, '; '.join(errs[:4]))
print(f'JS heap after switching: {heap} MB')
print('RESULT', sum(ok for _, ok in results), '/', len(results))
