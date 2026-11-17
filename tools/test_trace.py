"""Check the cushion-path guide against the real simulation, and the bot's snooker escapes.

usage: python3 -I test_trace.py <test index.html>
"""
import json
import math
import pathlib
import sys
import time

from playwright.sync_api import sync_playwright

ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


def wait_for(pg, expr, timeout=60.0, step=60):
    end = time.time() + timeout
    while time.time() < end:
        v = pg.evaluate(expr)
        if v:
            return v
        pg.wait_for_timeout(step)
    return None


SETUP_RACK = "() => { __T.newRack(false); const s=__T.state; s.ballInHand=false; __T.refreshUI(); }"
# A real snooker: the cue ball sits just behind the blue, so no red can be hit directly.
SNOOKER = """() => { __T.newRack(false); const s=__T.state; s.ballInHand=false; const b=__T.balls;
  const blue=b.find(x=>x.type==='blue'); const cue=b.find(x=>x.type==='cue');
  cue.x=blue.x-0.0825-%(dx)f; cue.z=blue.z+%(dz)f; __T.refreshUI(); }"""


def main():
    url = pathlib.Path(sys.argv[1]).resolve().as_uri()
    out = {'cushion_shots': [], 'escapes': []}
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(url)
        pg.wait_for_function('window.__T', timeout=120000)
        pg.evaluate("document.querySelector('.mode[data-mode=bot]').click(); document.getElementById('start-button').click();")
        pg.wait_for_timeout(500)

        # --- A: shots that reach a red only after a cushion; guide vs reality ---
        for power, spinX, spinY in [(55, 0, 0), (70, 0.5, 0.3), (45, -0.4, -0.5)]:
            pg.evaluate(SETUP_RACK)
            found = pg.evaluate(f"""() => {{ const cfg={{power:{power},spinX:{spinX},spinY:{spinY}}};
                for(let i=0;i<1440;i++){{ const a=-Math.PI/2+i*Math.PI/1440; const tr=__T.tracePath(a,cfg,3,true);
                  if(tr&&tr.end==='ball'&&tr.cushions===1&&tr.hit.type==='red') return {{aim:a,cushions:tr.cushions,id:tr.hit.id,contact:tr.contact,cfg}}; }}
                return null; }}""")
            if not found:
                out['cushion_shots'].append({'power': power, 'found': False})
                continue
            pg.evaluate(f"""() => {{ window.__firstContact=null; const s=__T.state; s.current=0; s.aim={found['aim']};
                Object.assign(s.settings[0],{{power:{power},spinX:{spinX},spinY:{spinY}}}); __T.refreshUI(); }}""")
            pg.keyboard.press('Space')
            real = wait_for(pg, 'window.__firstContact', timeout=40, step=20)
            res = {'power': power, 'spin': [spinX, spinY], 'predicted_ball': found['id'], 'predicted_contact': [round(v, 4) for v in found['contact']]}
            if real:
                res['real_ball'] = real['id']
                res['real_contact'] = [round(real['x'], 4), round(real['z'], 4)]
                res['error_mm'] = round(1000 * math.hypot(real['x'] - found['contact'][0], real['z'] - found['contact'][1]), 2)
                res['same_ball'] = real['id'] == found['id']
            out['cushion_shots'].append(res)
            wait_for(pg, '!__T.state.inShot', timeout=60)

        # --- B: bot escapes from real snookers ---
        for dx, dz in [(0.0, 0.0), (0.02, 0.01), (0.05, -0.012)]:
            pg.evaluate(SNOOKER % {'dx': dx, 'dz': dz})
            direct = pg.evaluate("""() => { const cue=__T.cueBall(); let open=0; for(const r of __T.balls.filter(x=>x.type==='red'&&!x.pocketed)){
                  const a=Math.atan2(r.z-cue.z,r.x-cue.x); const tr=__T.tracePath(a,{power:50,spinX:0,spinY:0},0,false); if(tr&&tr.end==='ball'&&tr.hit.type==='red') open++; } return open; }""")
            t0 = time.time()
            plan = pg.evaluate("""async () => { const s=__T.state; s.current=1; __T.ai.plan=null; const t=performance.now(); const p=await __T.chooseBotShot();
                  return p?{kind:p.kind,power:p.power,cushions:p.cushions,window_deg:p.window?p.window*180/Math.PI:null,aim:p.aim,ms:performance.now()-t}:null; }""")
            # Let the bot actually play it.
            pg.evaluate("() => { __T.ai.plan=null; __T.state.current=1; window.__firstContact=null; }")
            first = wait_for(pg, '__T.state.shot && __T.state.shot.first ? __T.state.shot.first : (window.__firstContact ? window.__firstContact.type : null)', timeout=40, step=30)
            wait_for(pg, '!__T.state.inShot && __T.state.shotCount>0', timeout=60)
            hist = pg.evaluate('__T.state.history.slice(0,2).map(h=>h.text)')
            out['escapes'].append({'offset': [dx, dz], 'direct_red_lines': direct, 'plan': plan, 'bot_first_contact': first, 'history': hist})
        out['errors'] = errors
        b.close()
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
