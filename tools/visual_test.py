"""Render the rebuilt arena from several cameras (software WebGL) and report errors.

usage: python3 -I visual_test.py <index.html> <out_dir> [w h] [presets...]
"""
import json
import pathlib
import sys
import time

from playwright.sync_api import sync_playwright

ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


def main():
    page = pathlib.Path(sys.argv[1]).resolve().as_uri()
    out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
    w, h = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (1440, 810)
    wanted = sys.argv[5:] or ['0', '1', '3', '4']
    report = {'errors': []}
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = b.new_page(viewport={'width': w, 'height': h})
        pg.on('pageerror', lambda e: report['errors'].append('PAGEERROR ' + str(e)))
        pg.on('console', lambda m: report['errors'].append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        t0 = time.time()
        pg.goto(page)
        pg.wait_for_function('window.__T', timeout=120000)
        pg.evaluate("document.querySelector('.mode[data-mode=bot]').click(); document.getElementById('start-button').click();")
        ok = pg.wait_for_function('window.__T.crowd.length>0 && window.__T.ref.person', timeout=240000)
        report['people_ready_s'] = round(time.time() - t0, 1)
        report['crowd'] = pg.evaluate('__T.crowd.length')
        report['visible_crowd'] = pg.evaluate('__T.crowd.filter(c=>c.p.obj.visible).length')
        report['quality'] = pg.evaluate('__T.quality')
        pg.wait_for_timeout(1500)  # let the clips run a little
        for idx in wanted:
            i = int(idx)
            pg.evaluate(f"""() => {{ const T=__T; if({i}<0) return; T.setCamera({i}); const c=T.cam; c.curAz=c.az; c.curEl=c.el; c.curRadius=c.radius; c.curTarget=c.target.slice(); }}""")
            pg.evaluate('window.__noRender=false')
            pg.wait_for_timeout(5000)
            pg.screenshot(path=str(out / f'view_{idx}.png'))
            pg.evaluate('window.__noRender=true')
        info = pg.evaluate("""() => { const r=__T.renderer.info; return {calls:r.render.calls, triangles:r.render.triangles, programs:r.programs.length, geometries:r.memory.geometries, textures:r.memory.textures}; }""")
        report['renderer'] = info
        b.close()
    print(json.dumps(report, indent=1)[:4000])


if __name__ == '__main__':
    main()
