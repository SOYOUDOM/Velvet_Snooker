"""Cameras and see-through: the director's views (aim, ball in hand, opponent,
balls running), referee fading when he blocks the view, panel fading, the
escape hint (user once per match) and the bot's escape allowance.

usage: python3 -I test_camera.py <test index.html> <shot prefix>
"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright

ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
SETTLE = "()=>{const c=__T.cam;for(let i=0;i<3;i++){__T.updateCam(1);}Object.assign(c,{curAz:c.az,curEl:c.el,curRadius:c.radius,curFov:c.fov,curZoom:c.zoom});c.curTarget=[...c.target];__T.updateCam(.016);__T.render(.016);}"


def main():
    url = pathlib.Path(sys.argv[1]).resolve().as_uri(); pre = sys.argv[2]
    out, errors = {}, []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = b.new_page(viewport={'width': 1280, 'height': 720}); pg.set_default_timeout(240000)
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(url)
        pg.wait_for_function('window.__T && window.__T.balls && window.__T.balls.length>0 && window.VelvetPeople && VelvetPeople.ready && __T.crowd.length>0', timeout=120000)
        pg.click('.mode[data-mode="bot"]'); pg.click('#start-button')
        views = {}
        def shot(name):
            pg.evaluate(SETTLE); pg.screenshot(path=f'{pre}_{name}.png')
            views[name] = pg.evaluate("()=>({az:+__T.cam.az.toFixed(2),el:+__T.cam.el.toFixed(2),fov:+__T.cam.fov.toFixed(0),follow:__T.playerViewActive()})")
        # Ball in hand at the start: the D view.
        shot('ball_in_hand')
        # Aiming: player view.
        pg.evaluate("()=>{const s=__T.state;s.ballInHand=false;s.current=0;const cb=__T.cueBall();cb.x=-.7;cb.z=.25;s.aim=.12;__T.refreshUI();}")
        shot('aim')
        # Mouse turns the aim sideways in the player view.
        a0 = pg.evaluate("__T.state.aim")
        pg.mouse.move(600, 360); pg.mouse.move(700, 360)
        out['aim_turned_by_mouse'] = round(pg.evaluate("__T.state.aim") - a0, 3)
        # Opponent planning view.
        pg.evaluate("()=>{const s=__T.state;s.current=1;__T.ai.plan={aim:2.6,power:40,spinX:0,spinY:0,kind:'pot',target:__T.balls[3]};}")
        shot('opponent')
        pg.evaluate("()=>{__T.ai.plan=null;__T.state.current=0;}")
        pg.wait_for_function("!__T.state.inShot", timeout=60000)
        # Referee between the camera and the balls fades.
        pg.evaluate("""()=>{const s=__T.state,r=__T.ref,cb=__T.cueBall();s.current=0;s.ballInHand=false;cb.x=-1.5;cb.z=0;s.aim=0;r.queue.length=0;r.task=null;
          r.home=r.s=r.targetS=__T.loopNearest(-3,0);}""")
        pg.evaluate(SETTLE)
        pg.wait_for_timeout(1500)
        out['referee_opacity_blocking'] = pg.evaluate("()=>{let o=1;__T.ref.person.obj.traverse(m=>{if(m.isMesh)o=Math.min(o,m.material.opacity)});return +o.toFixed(2)}")
        # Panels fade when a ball is behind them.
        out['see_through'] = pg.evaluate("()=>[...document.querySelectorAll('.see-through')].map(e=>e.className.split(' ')[0])")
        # Escape hint: not snookered -> kept; snookered -> used once.
        pg.evaluate("()=>{const s=__T.state;s.current=0;s.ballInHand=false;s.phase='red';__T.refreshUI();}")
        pg.keyboard.press('e'); pg.wait_for_timeout(300)
        out['hint_when_open'] = pg.evaluate("__T.state.hints.slice()")
        pg.evaluate("""()=>{__T.newRack(false);const s=__T.state;Object.assign(s,{ballInHand:false,current:0,shotCount:4,phase:'red'});
          const b=__T.balls,blue=b.find(x=>x.type==='blue'),cb=__T.cueBall();cb.x=blue.x-.06;cb.z=blue.z;__T.refreshUI();}""")
        out['snookered'] = pg.evaluate("__T.snookeredOnAll(['red'])")
        pg.keyboard.press('e'); pg.wait_for_timeout(2500)
        out['hint_after_use'] = pg.evaluate("__T.state.hints.slice()")
        pg.evaluate(SETTLE); pg.evaluate("()=>{window.__noRender=false}"); pg.wait_for_timeout(800); pg.screenshot(path=f'{pre}_hint.png')
        pg.keyboard.press('e'); pg.wait_for_timeout(500)
        out['hint_second_try'] = pg.evaluate("__T.state.hints.slice()")
        # The bot: exact escape once, then by eye.
        out['bot_escapes'] = pg.evaluate("""async()=>{const r=[];const s=__T.state;s.mode='bot';s.current=1;s.finished=true;
          for(let i=0;i<3;i++){const p=await __T.chooseBotShot();r.push(p?{kind:p.kind,cushions:p.cushions||0,window:+(p.window||0).toFixed(4)}:null);}
          s.finished=false;return {plans:r,left:__T.ai.escapes};}""")
        out['views'] = views
        out['errors'] = errors
        b.close()
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
