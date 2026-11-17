import sys, pathlib, json, time
from playwright.sync_api import sync_playwright
ARGS=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=ARGS)
    pg=b.new_page(viewport={'width':1440,'height':810}); pg.set_default_timeout(240000)
    errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    t0=time.time(); pg.goto(pathlib.Path(sys.argv[1]).resolve().as_uri()); pg.wait_for_timeout(4000)
    pg.evaluate("document.querySelector('.mode[data-mode=bot]').click(); const s=document.getElementById('opponent-select'); if(s){s.value='trump'; s.dispatchEvent(new Event('change'));} document.getElementById('start-button').click();")
    pg.wait_for_function("window.VelvetPeople && window.VelvetPeople.ready", timeout=300000); pg.wait_for_timeout(20000)
    pg.screenshot(path=sys.argv[2])
    info=pg.evaluate("({people:!!(window.VelvetPeople&&window.VelvetPeople.ready), avatars:Object.keys((window.VelvetPeople||{}).templates||{}).length, owner:document.getElementById('dock-owner').textContent, quality:document.getElementById('quality-toggle').textContent, gif:document.getElementById('crowd-gif').src.slice(0,22)})")
    print(json.dumps({'errors':errs,'info':info,'seconds':round(time.time()-t0,1)}))
    b.close()
