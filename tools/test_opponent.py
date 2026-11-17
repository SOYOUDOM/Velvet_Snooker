"""Real play against a chosen pro: start-screen choice, names, async planning
(frame gaps), several real bot visits, and the referee's frame call.

usage: python3 -I test_opponent.py <test index.html> [screenshot.png]
"""
import json, pathlib, sys, time
from playwright.sync_api import sync_playwright

ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


def wait_for(pg, expr, timeout=60.0, step=100):
    end = time.time() + timeout
    while time.time() < end:
        v = pg.evaluate(expr)
        if v:
            return v
        pg.wait_for_timeout(step)
    return None


def main():
    url = pathlib.Path(sys.argv[1]).resolve().as_uri()
    out, errors = {}, []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = b.new_page(viewport={'width': 1280, 'height': 800}); pg.set_default_timeout(240000)
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(url)
        pg.wait_for_function('window.__T && window.__T.balls && window.__T.balls.length>0', timeout=120000)
        pg.evaluate("() => { try{localStorage.removeItem('velvet.opponent')}catch(e){} }")
        out['box_hidden_in_practice'] = pg.evaluate("$=>document.getElementById('opponent-box').hidden", None)
        pg.click('.mode[data-mode="bot"]')
        out['box_hidden_in_bot'] = pg.evaluate("()=>document.getElementById('opponent-box').hidden")
        out['options'] = pg.evaluate("()=>[...document.querySelectorAll('#opponent-select option')].map(o=>o.textContent)")
        pg.select_option('#opponent-select', 'osullivan')
        out['after_pick'] = pg.evaluate("()=>({bot:__T.bot,active:document.querySelector('.level.active').dataset.level,note:document.getElementById('opponent-note').textContent})")
        pg.click('.level[data-level="hard"]')
        pg.click('.level[data-level="veryhard"]')
        out['saved'] = pg.evaluate("()=>localStorage.getItem('velvet.opponent')")
        if len(sys.argv) > 2:
            pg.evaluate("()=>{window.__noRender=false}")
            pg.wait_for_timeout(1500)
            pg.screenshot(path=sys.argv[2])
            pg.evaluate("()=>{window.__noRender=true}")
        pg.click('#start-button')
        pg.wait_for_timeout(500)
        out['hud'] = pg.evaluate("()=>({name1:document.getElementById('player-name-1').textContent,cap1:document.getElementById('player-caption-1').textContent})")
        # Frame-gap monitor while the bot plans and plays.
        pg.evaluate("""()=>{window.__gaps=[];let last=performance.now();const f=t=>{window.__gaps.push(t-last);last=t;requestAnimationFrame(f);};requestAnimationFrame(f);}""")
        # The pro breaks off, then gets further visits (your turns are handed back).
        pg.evaluate("()=>{__T.state.current=1;__T.ai.plan=null;__T.refreshUI();}")
        visits = []
        for k in range(6):
            if not wait_for(pg, "__T.state.inShot || __T.state.finished || !!__T.state.decision", timeout=40):
                visits.append({'stuck': pg.evaluate("()=>({cur:__T.state.current,planning:__T.ai.planning,plan:!!__T.ai.plan,msg:document.body.innerText.slice(0,0)})")})
                break
            plan_msg = pg.evaluate("()=>{const m=document.querySelector('.message, #message, .toast');return m?m.textContent:''}")
            wait_for(pg, "!__T.state.inShot", timeout=60)
            pg.wait_for_timeout(400)
            st = pg.evaluate("()=>({cur:__T.state.current,scores:__T.state.scores,shots:__T.state.shotCount,phase:__T.state.phase,hist:__T.state.history.slice(0,1).map(h=>h.text),decision:!!__T.state.decision,finished:__T.state.finished})")
            st['msg'] = plan_msg
            visits.append(st)
            if st['finished']:
                break
            if st['decision']:
                pg.evaluate("()=>__T.applyDecision('back')")
            if pg.evaluate("__T.state.current") == 0:
                pg.evaluate("()=>{__T.switchTurn();__T.refreshUI();}")
        out['visits'] = visits
        gaps = pg.evaluate("window.__gaps")
        gaps = sorted(gaps[2:])
        out['frame_gap_ms'] = {'p50': round(gaps[len(gaps) // 2], 1), 'p99': round(gaps[int(len(gaps) * .99)], 1), 'max': round(gaps[-1], 1), 'n': len(gaps)}
        # Referee's frame call for the pro.
        pg.evaluate("()=>{window.__sayLog=[];__T.state.scores=[0,80];__T.finishFrame(1,'test');}")
        pg.wait_for_timeout(300)
        out['frame_call'] = pg.evaluate("window.__sayLog")
        out['scoreboard_names'] = pg.evaluate("()=>__T.state.mode")
        out['errors'] = errors
        b.close()
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
