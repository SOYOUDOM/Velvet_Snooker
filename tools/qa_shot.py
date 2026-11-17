import sys, json
from playwright.sync_api import sync_playwright
ARGS=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]
url, out = sys.argv[1], sys.argv[2]
w, h = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (1280, 720)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': w, 'height': h})
    logs = []
    pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERROR ' + str(e)))
    pg.goto(url)
    pg.wait_for_function('window.__ready || window.__error', timeout=240000)
    err = pg.evaluate('window.__error || null')
    rep = pg.evaluate('window.__report || null')
    pg.wait_for_timeout(500)
    pg.screenshot(path=out)
    print(json.dumps({'error': err, 'report': rep, 'logs': logs[:12]}, indent=0)[:3000])
    b.close()
