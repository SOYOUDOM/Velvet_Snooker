"""Render a preview of every venue for the venue card in the menu.
usage: python3 -I tools/make_venue_previews.py <test index.html> <project dir>
Writes <project dir>/js/venue-previews.js (JPEG data URIs, one per venue) and a contact sheet in /tmp."""
import base64, io, json, pathlib, sys
from PIL import Image
from playwright.sync_api import sync_playwright
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
VIEW = {'default': {'az': -1.82, 'el': .2, 'radius': 11, 'fov': 50, 'target': [1.6, .5, 0]},
        'stage': {'az': -1.95, 'el': .2, 'radius': 15, 'fov': 54, 'target': [1.0, 1.2, 0]},
        'world-championship-arena': {'az': -1.5708, 'el': .17, 'radius': 13, 'fov': 50, 'target': [2.6, .9, 0]}}
page, project = sys.argv[1], pathlib.Path(sys.argv[2])
out, sheet = {}, []
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 720}); pg.set_default_timeout(600000)
    pg.add_init_script("try{localStorage.setItem('velvet.quality','high')}catch(e){}")
    pg.goto(pathlib.Path(page).resolve().as_uri()); pg.wait_for_function('window.__T', timeout=120000)
    venues = pg.evaluate("() => [...document.querySelectorAll('#venue-select option')].map(o=>o.value)")
    pg.evaluate("() => { document.querySelector('.mode[data-mode=practice]')?.click(); document.getElementById('start-button').click(); }")
    pg.wait_for_function("window.VelvetPeople&&VelvetPeople.ready&&__T.crowd.length>0", timeout=300000)
    pg.evaluate("() => { const st=document.createElement('style');st.textContent='body *{visibility:hidden!important} #world{visibility:visible!important}';document.head.appendChild(st); }")
    for v in venues:
        cam = VIEW.get(v, VIEW['default'])
        pg.evaluate("([v,c]) => { const s=document.getElementById('venue-select'); s.value=v; s.dispatchEvent(new Event('change')); __T.setCamera(1); Object.assign(__T.cam,c,{zoom:1,mode:-1,follow:false}); window.__noRender=false; }", [v, cam])
        pg.wait_for_function("__T.crowd.length>0", timeout=120000); pg.wait_for_timeout(3500)
        png = pg.screenshot(); pg.evaluate("() => { window.__noRender=true; }")
        im = Image.open(io.BytesIO(png)).convert('RGB').resize((384, 216), Image.LANCZOS)
        buf = io.BytesIO(); im.save(buf, 'JPEG', quality=80, optimize=True)
        out[v] = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode('ascii'); sheet.append(im)
    b.close()
(project / 'js' / 'venue-previews.js').write_text('/* VELVET - venue previews for the menu: renders of each venue, made by tools/make_venue_previews.py */\n'
                                                   'window.VELVET_VENUE_PREVIEWS=' + json.dumps(out, separators=(',', ':')) + ';\n')
cs = Image.new('RGB', (384 * 2, 216 * ((len(sheet) + 1) // 2)), (10, 10, 10))
for i, im in enumerate(sheet): cs.paste(im, ((i % 2) * 384, (i // 2) * 216))
cs.save('/tmp/venue_previews_sheet.jpg', quality=85)
print(len(out), 'previews,', sum(len(x) for x in out.values()) // 1024, 'KB')
