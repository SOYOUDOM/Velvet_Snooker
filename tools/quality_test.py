import json, pathlib, sys
from playwright.sync_api import sync_playwright
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
url = pathlib.Path(sys.argv[1]).resolve().as_uri(); out = pathlib.Path(sys.argv[2])
res = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 720}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(url); pg.wait_for_function('window.__T', timeout=120000)
    pg.evaluate("document.querySelector('.mode[data-mode=practice]').click(); document.getElementById('start-button').click();")
    pg.wait_for_function('__T.crowd.length>0', timeout=240000)
    for i in range(3):
        pg.evaluate("document.getElementById('quality-toggle').click()")
        info = pg.evaluate("""() => { __T.render(0.016); const r=__T.renderer.info.render; return {quality:__T.quality, label:document.getElementById('quality-toggle').textContent,
             crowdVisible:__T.crowd.filter(c=>c.p.obj.visible).length, shadows:__T.scene.children.some(o=>o.isDirectionalLight&&o.castShadow), pixelRatio:__T.renderer.getPixelRatio(),
             calls:r.calls, triangles:r.triangles}; }""")
        pg.evaluate('window.__noRender=false'); pg.wait_for_timeout(2500)
        pg.screenshot(path=str(out / f"quality_{info['quality']}.png")); pg.evaluate('window.__noRender=true')
        res.append(info)
    print(json.dumps({'levels': res, 'errors': errs}, indent=1))
    b.close()
