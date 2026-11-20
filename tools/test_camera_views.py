"""VELVET 7.1 camera: the four views, the shot follow, the controls (mouse, wheel,
keys, touch), keeping out of the table and the stands, frame-rate independence,
resizing and the saved settings.
usage: python3 tools/test_camera_views.py <testcopy>/index.html [screens_dir]"""
import functools, http.server, json, math, pathlib, sys, threading
from playwright.sync_api import sync_playwright

ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
fails, notes = [], []


def check(name, ok, info=''):
    (notes if ok else fails).append(('PASS ' if ok else 'FAIL ') + name + (' ' + str(info) if info else ''))


SETTLE = "(n)=>{n=n||70;for(let i=0;i<n;i++)__T.updateCam(.05);}"
# the camera's view of the play: where the cue ball is on screen, whether the eye is clear of the table, the aim
VIEW = """()=>{const T=__T,c=T.camera,cb=T.cueBall(),p=c.position,V=THREE.Vector3;c.updateMatrixWorld();
  const pr=b=>{const v=new V(b.x,T.K.R+.006,b.z).project(c);return [+v.x.toFixed(3),+v.y.toFixed(3),+v.z.toFixed(4)];};
  const f=new V();c.getWorldDirection(f);const aim=T.state.aim,fa=Math.atan2(f.z,f.x);
  let near=9;for(const b of T.balls){if(!b.pocketed)near=Math.min(near,Math.hypot(b.x-p.x,T.K.R-p.y,b.z-p.z));}
  const dock=document.querySelector('.control-dock').getBoundingClientRect(),H=innerHeight;
  return {eye:[+p.x.toFixed(3),+p.y.toFixed(3),+p.z.toFixed(3)],minY:+T.minEyeY(p.x,p.z).toFixed(3),cue:cb?pr(cb):null,
    aimDiff:+Math.abs(Math.atan2(Math.sin(fa-aim),Math.cos(fa-aim))).toFixed(3),nearBall:+near.toFixed(3),dockNdc:+(1-2*dock.top/H).toFixed(3),
    view:T.cam.view,key:T.cam.key,nan:![p.x,p.y,p.z].every(isFinite)};}"""


def main():
    url = pathlib.Path(sys.argv[1]).resolve().as_uri()
    shots = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        ctx = b.new_context(viewport={'width': 1280, 'height': 720}, has_touch=True)
        pg = ctx.new_page(); pg.set_default_timeout(240000)
        pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
        pg.add_init_script("try{localStorage.setItem('velvet.quality','low');localStorage.setItem('velvet.walkon','off')}catch(e){}")
        pg.goto(url)
        pg.wait_for_function('window.__T && window.__T.balls && window.__T.balls.length>0', timeout=120000)
        if pg.evaluate("()=>{const had=!!localStorage.getItem('velvet.camera');localStorage.removeItem('velvet.camera');return had}"):
            pg.reload(); pg.wait_for_function('window.__T && window.__T.balls && window.__T.balls.length>0', timeout=120000)
        pg.click('.mode[data-mode="practice"]'); pg.click('#start-button')
        pg.wait_for_function("__T.state.started&&!__T.cine.on", timeout=60000); pg.wait_for_timeout(600)
        pg.evaluate("()=>{__T.state.current=0;__T.state.ballInHand=false;__T.ai.plan=null;__T.refreshUI();}")
        T = lambda: pg.evaluate(VIEW)

        # 1. The aiming camera: the cue ball near every cushion and pocket, aims along, across and away;
        #    the eye stays out of the table and the balls, the cue ball is in the picture above the
        #    controls, and the camera looks along the aim.
        spots = []
        HX, HZ = 1.7845, .889
        for (x, z) in [(-HX + .05, 0), (HX - .05, 0), (0, -HZ + .05), (0, HZ - .05), (-.5, .3),
                       (-HX + .07, -HZ + .07), (HX - .07, -HZ + .07), (-HX + .07, HZ - .07), (HX - .07, HZ - .07), (0, -HZ + .07), (0, HZ - .07)]:
            for aim in [0, math.pi / 2, math.pi, -math.pi / 2, .7, 2.4]:
                spots.append((x, z, aim))
        bad = []
        for (x, z, aim) in spots:
            pg.evaluate("([x,z,a])=>{const s=__T.state,cb=__T.cueBall();cb.x=x;cb.z=z;cb.vx=cb.vz=0;s.aim=a;s.inShot=false;s.ballInHand=false;s.current=0;__T.goView('aim','cut');}", [x, z, aim])
            pg.evaluate(SETTLE)
            v = T()
            cue = v['cue']
            ok = (not v['nan'] and v['eye'][1] >= v['minY'] - 1e-3 and v['nearBall'] > .1 and cue and abs(cue[0]) < 1 and -1 < cue[1] < 1 and cue[2] < 1
                  and cue[1] > v['dockNdc'] - .02 and v['aimDiff'] < .85)
            if not ok:
                bad.append({'spot': [round(x, 2), round(z, 2), round(aim, 2)], **v})
        check(f'aiming camera frames the cue ball and the aim from {len(spots)} positions by every cushion and pocket', not bad, json.dumps(bad[:3]))

        # a ball right in front of the white: still clear of it, both in the picture
        pg.evaluate("()=>{const s=__T.state,cb=__T.cueBall(),r=__T.balls.find(b=>b.type==='red'&&!b.pocketed);cb.x=-.4;cb.z=.1;r.x=-.4+2*__T.K.R+.004;r.z=.1;s.aim=0;__T.goView('aim','cut');}")
        pg.evaluate(SETTLE); v = T()
        check('a ball touching distance from the white: eye clear, both in view', v['nearBall'] > .1 and abs(v['cue'][0]) < .9, json.dumps(v))
        if shots: pg.evaluate("()=>{window.__noRender=false}"); pg.wait_for_timeout(700); pg.screenshot(path=str(shots / 'cam_aim_close.png')); pg.evaluate("()=>{window.__noRender=true}")
        pg.evaluate("()=>{__T.newRack(false);const s=__T.state;s.ballInHand=false;s.current=0;const cb=__T.cueBall();cb.x=-1.1;cb.z=.2;s.aim=.15;__T.refreshUI();__T.goView('aim','cut');}")
        pg.evaluate(SETTLE)

        # 2. The aim never moves because of the camera; the framing does not pump while you turn.
        a0 = pg.evaluate("__T.state.aim")
        box = pg.locator('#world').bounding_box(); cx, cy = box['x'] + box['width'] * .5, box['y'] + box['height'] * .4
        pg.mouse.move(cx, cy); pg.mouse.down(button='right'); pg.mouse.move(cx + 80, cy + 40, steps=6); pg.mouse.up(button='right')
        for _ in range(3): pg.mouse.wheel(0, -200)
        pg.keyboard.press('Home'); pg.wait_for_timeout(200)
        a1 = pg.evaluate("__T.state.aim")
        u = pg.evaluate("()=>__T.cam.user")
        check('right drag, wheel and Home move the aiming camera, never the aim', abs(a1 - a0) < 1e-9 and u['zoom'] == 1 and u['el'] == 0, json.dumps({'a0': a0, 'a1': a1, 'user': u}))
        # turning the aim across balls: the distance holds while turning
        pg.evaluate(SETTLE)
        dists = pg.evaluate("""()=>{const out=[],s=__T.state;for(let i=0;i<40;i++){s.aim+=.012;__T.updateCam(1/60);
            const c=__T.camera.position,cb=__T.cueBall();out.push(Math.hypot(c.x-cb.x,c.y,c.z-cb.z));}return out;}""")
        spread = max(dists) - min(dists)
        check('while the aim turns the camera keeps its distance (no pumping)', spread < .06, f'{spread:.3f} m')

        # 3. Every view, repeatedly: C, the buttons, the TV angles; smooth moves that end; no NaN.
        seq = []
        for i in range(12):
            pg.keyboard.press('c'); pg.wait_for_timeout(60)
            seq.append(pg.evaluate("__T.cam.view"))
        for sel in ['#view-aim', '#angle-top', '#view-tv', '#angle-next', '#angle-next', '#angle-back', '#view-free', '#view-aim']:
            pg.click(sel); pg.wait_for_timeout(80)
        pg.evaluate(SETTLE)
        st = pg.evaluate("()=>({view:__T.cam.view,blend:!!__T.cam.blend,tv:__T.cam.tvPreset})"); v = T()
        check('C cycles AIM → TOP → TV → FREE and the buttons switch views; moves finish', seq[:4] == ['top', 'tv', 'free', 'aim'] and st['view'] == 'aim' and not st['blend'] and not v['nan'], json.dumps({'seq': seq[:5], **st}))
        # a change of view is one smooth move: the eye never jumps between frames
        jumps = pg.evaluate("""()=>{__T.goView('top');const P=[];for(let i=0;i<60;i++){__T.updateCam(1/60);const c=__T.camera.position;P.push([c.x,c.y,c.z]);}
            __T.goView('aim');for(let i=0;i<60;i++){__T.updateCam(1/60);const c=__T.camera.position;P.push([c.x,c.y,c.z]);}
            let m=0;for(let i=1;i<P.length;i++)m=Math.max(m,Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1],P[i][2]-P[i-1][2]));return m;}""")
        check('view changes glide (largest step between frames at 60 fps)', jumps < .35, f'{jumps:.3f} m')
        # the overhead fits the whole table, upright on a tall screen
        pg.evaluate("()=>__T.goView('top','cut')"); pg.evaluate(SETTLE)
        fit = pg.evaluate("""()=>{const c=__T.camera;c.updateMatrixWorld();const V=THREE.Vector3,X=1.7845+.17,Z=.889+.17;let m=0;
            for(const [x,z] of [[X,Z],[-X,Z],[X,-Z],[-X,-Z]]){const v=new V(x,0,z).project(c);m=Math.max(m,Math.abs(v.x),Math.abs(v.y));}return {m:+m.toFixed(3),az:+__T.cam.az.toFixed(2)};}""")
        check('overhead shows the whole table', fit['m'] < 1.0 and fit['az'] == 0, json.dumps(fit))

        # 4. Zooming fast in and out in every view stays inside the limits, out of the table and the stands.
        zoomed = []
        for view in ['aim', 'top', 'tv', 'free']:
            pg.evaluate(f"()=>__T.goView('{view}','cut')")
            pg.mouse.move(cx, cy)
            for k in range(10): pg.mouse.wheel(0, -400 if k % 2 == 0 else 380)
            for k in range(14): pg.mouse.wheel(0, -500)
            pg.evaluate(SETTLE); zin = T()
            for k in range(30): pg.mouse.wheel(0, 600)
            pg.evaluate(SETTLE); zout = T()
            inring = pg.evaluate("()=>{const p=__T.camera.position;return Math.hypot(p.x,p.z)}")
            zoomed.append({'view': view, 'in_ok': (not zin['nan'] and zin['eye'][1] >= zin['minY'] - 1e-3 and zin['nearBall'] > .1),
                           'out_ok': (not zout['nan'] and zout['eye'][1] >= zout['minY'] - 1e-3), 'out_r': round(inring, 2)})
        check('rapid zooming in every view: no clipping into balls or table, no NaN', all(z['in_ok'] and z['out_ok'] for z in zoomed), json.dumps(zoomed))

        # 5. The free camera near the arena boundaries: orbit far out and low all round.
        pg.evaluate("()=>{__T.goView('free','cut');}")
        pg.mouse.move(cx, cy)
        for k in range(20): pg.mouse.wheel(0, 700)
        ring = []
        for k in range(16):
            pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 140, cy + 60, steps=4); pg.mouse.up()
            pg.evaluate("(n)=>{for(let i=0;i<n;i++)__T.updateCam(.05);}", 12)
            ring.append(pg.evaluate("""()=>{const T=__T,p=T.camera.position,r=T.ring;let lim=15;
              if(r.r){const N=r.r[0].length,f=((Math.atan2(p.z,p.x)/(2*Math.PI)*N)%N+N)%N,i=Math.floor(f)%N;
                const hy=p.y-T.K.FLOOR_Y;let h=0;while(h<4&&hy>[.55,1.15,1.85,2.65,3.6][h])h++;lim=Math.min(r.r[Math.max(0,h-1)][i],r.r[Math.min(4,h)][i],r.r[Math.max(0,h-1)][(i+1)%N],r.r[Math.min(4,h)][(i+1)%N]);}
              return {r:+Math.hypot(p.x,p.z).toFixed(2),lim:+lim.toFixed(2),y:+p.y.toFixed(2),floor:p.y>=T.K.FLOOR_Y+.3}}"""))
        check('orbiting far out keeps the camera inside the arena and above the floor', all(q['floor'] and q['r'] <= q['lim'] + .05 for q in ring), json.dumps(ring[:6]))
        # left drag in the free view turns it and leaves the aim alone; Shift makes it finer
        a0 = pg.evaluate("__T.state.aim"); az0 = pg.evaluate("__T.cam.az")
        pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 100, cy, steps=5); pg.mouse.up()
        az1 = pg.evaluate("__T.cam.az")
        pg.keyboard.down('Shift'); pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 100, cy, steps=5); pg.mouse.up(); pg.keyboard.up('Shift')
        az2 = pg.evaluate("__T.cam.az"); a1 = pg.evaluate("__T.state.aim")
        check('free camera: drag turns it, Shift drag turns it about a quarter as much, the aim stays', abs(az1 - az0) > .3 and .1 < abs(az2 - az1) / abs(az1 - az0) < .4 and abs(a1 - a0) < 1e-9,
              json.dumps([round(az1 - az0, 3), round(az2 - az1, 3)]))
        # right drag pans the free camera
        t0 = pg.evaluate("__T.cam.target.slice()")
        pg.mouse.move(cx, cy); pg.mouse.down(button='right'); pg.mouse.move(cx - 120, cy + 50, steps=5); pg.mouse.up(button='right')
        t1 = pg.evaluate("__T.cam.target.slice()")
        check('free camera: right drag moves the point it looks at', math.dist(t0, t1) > .1, json.dumps([t0, t1]))
        # double-click a ball to focus on it
        pg.evaluate("()=>__T.goView('top','cut')"); pg.evaluate(SETTLE)
        bp = pg.evaluate("""()=>{const b=__T.balls.find(x=>x.type==='pink'),v=new THREE.Vector3(b.x,__T.K.R,b.z).project(__T.camera),r=document.getElementById('world').getBoundingClientRect();
            return [r.left+(v.x+1)/2*r.width,r.top+(1-v.y)/2*r.height,b.x,b.z];}""")
        pg.mouse.dblclick(bp[0], bp[1]); pg.wait_for_timeout(200)
        foc = pg.evaluate("()=>({view:__T.cam.view,t:__T.cam.target,name:__T.cam.focusName})")
        check('double-click a ball: the free camera focuses on it', foc['view'] == 'free' and abs(foc['t'][0] - bp[2]) < .02 and 'PINK' in foc['name'], json.dumps(foc))

        # 6. Frame-rate independence: the same second at 30 and at 144 frames per second.
        fr = pg.evaluate("""()=>{const T=__T,run=(dt,n)=>{T.goView('aim','cut');for(let i=0;i<30;i++)T.updateCam(.05);T.goView('top');
              for(let i=0;i<n;i++)T.updateCam(dt);const p=T.camera.position;return [p.x,p.y,p.z,T.cam.curEl];};
            const a=run(1/30,24),b=run(1/144,115);return {a,b,d:Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])};}""")
        check('the same move at 30 and 144 fps ends in the same place', fr['d'] < .04, f"{fr['d']:.4f} m")

        # 7. The shot follow: the view holds at the strike, one move to a broadcast angle, back after the balls stop.
        pg.evaluate("()=>{__T.newRack(false);const s=__T.state;s.ballInHand=false;s.current=0;s.mode='practice';const cb=__T.cueBall();cb.x=-1.2;cb.z=0;s.aim=0;__T.goView('aim','cut');}")
        pg.evaluate(SETTLE)
        log = pg.evaluate("""async()=>{const T=__T,s=T.state,keys=[];let last='';s.settings[0].power=70;T.takeShot(false);
            const t0=performance.now();while((s.inShot||performance.now()-t0<600)&&performance.now()-t0<40000){await new Promise(r=>setTimeout(r,50));
              const k=T.cam.key;if(k!==last){keys.push(k);last=k;}}
            await new Promise(r=>setTimeout(r,1800));keys.push(T.cam.key);return {keys,view:T.cam.view,inShot:s.inShot};}""")
        k = log['keys']
        check('shot follow: aim view at the strike, one broadcast move, back to aiming after', k[0].startswith('aim') and k.count('shot') == 1 and k[-1].startswith('aim') and log['view'] == 'aim', json.dumps(log))
        # a hand on the camera during a shot takes over; back to the aiming view after
        log2 = pg.evaluate("""async()=>{const T=__T,s=T.state;s.ballInHand=false;s.current=0;const cb=T.cueBall();s.aim=Math.PI;T.takeShot(false);
            await new Promise(r=>setTimeout(r,900));T.camOrbit(60,10,false);const during=T.cam.view,user=T.cam.sf&&T.cam.sf.user;
            const t0=performance.now();while(s.inShot&&performance.now()-t0<40000)await new Promise(r=>setTimeout(r,60));
            await new Promise(r=>setTimeout(r,1600));return {during,user,after:T.cam.view};}""")
        check('moving the camera while the balls run: yours until they stop', log2['during'] == 'free' and log2['after'] in ('free', 'aim'), json.dumps(log2))
        # AUTO CAM off: the view stays put through the shot
        pg.evaluate("()=>{__T.goView('aim','cut');if(__T.camSet.autoTv)__T.toggleAutoTv();}")
        log3 = pg.evaluate("""async()=>{const T=__T,s=T.state,keys=new Set();s.ballInHand=false;s.current=0;s.aim=.4;T.takeShot(false);
            const t0=performance.now();while((s.inShot||performance.now()-t0<600)&&performance.now()-t0<40000){await new Promise(r=>setTimeout(r,50));keys.add(T.cam.key);}
            return [...keys];}""")
        check('AUTO CAM off: no broadcast move during the shot', 'shot' not in log3, json.dumps(log3))
        pg.evaluate("()=>{if(!__T.camSet.autoTv)__T.toggleAutoTv();}")

        # 8. Touch: one finger aims, a pinch zooms, two fingers move the camera, a tap on a ball aims at it.
        cdp = ctx.new_cdp_session(pg)
        def touch(kind, pts):
            cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})
        pg.evaluate("()=>{__T.newRack(false);const s=__T.state;s.ballInHand=false;s.current=0;s.mode='practice';const cb=__T.cueBall();cb.x=-1.1;cb.z=.2;s.aim=.1;__T.goView('aim','cut');}")
        pg.evaluate(SETTLE)
        a0 = pg.evaluate("__T.state.aim")
        touch('touchStart', [(cx, cy)])
        for i in range(1, 7): touch('touchMove', [(cx + i * 15, cy)])
        touch('touchEnd', [])
        a1 = pg.evaluate("__T.state.aim")
        z0 = pg.evaluate("__T.cam.user.zoom")
        touch('touchStart', [(cx - 60, cy), (cx + 60, cy)])
        for i in range(1, 7): touch('touchMove', [(cx - 60 - i * 18, cy), (cx + 60 + i * 18, cy)])
        touch('touchEnd', [])
        z1 = pg.evaluate("__T.cam.user.zoom"); a2 = pg.evaluate("__T.state.aim")
        e0 = pg.evaluate("__T.cam.user.el")
        touch('touchStart', [(cx - 50, cy), (cx + 50, cy)])
        for i in range(1, 7): touch('touchMove', [(cx - 50, cy + i * 12), (cx + 50, cy + i * 12)])
        touch('touchEnd', [])
        e1 = pg.evaluate("__T.cam.user.el"); a3 = pg.evaluate("__T.state.aim")
        body_touch = pg.evaluate("document.body.classList.contains('touch')")
        check('touch: a finger turns the aim; a pinch zooms and two fingers raise the camera, both without moving the aim',
              abs(a1 - a0) > .05 and z1 < z0 - .1 and abs(a2 - a1) < 1e-9 and e1 > e0 + .05 and abs(a3 - a2) < 1e-9 and body_touch,
              json.dumps([round(a1 - a0, 3), round(z0, 2), round(z1, 2), round(e1 - e0, 3), round(a3 - a2, 6)]))
        # a tap on a ball aims at it (from the overhead view)
        pg.evaluate("()=>__T.goView('top','cut')"); pg.evaluate(SETTLE)
        bp = pg.evaluate("""()=>{const b=__T.balls.find(x=>x.type==='blue'),cb=__T.cueBall(),v=new THREE.Vector3(b.x,__T.K.R,b.z).project(__T.camera),r=document.getElementById('world').getBoundingClientRect();
            return [r.left+(v.x+1)/2*r.width,r.top+(1-v.y)/2*r.height,Math.atan2(b.z-cb.z,b.x-cb.x)];}""")
        touch('touchStart', [(bp[0], bp[1])]); touch('touchEnd', [])
        pg.wait_for_timeout(100)
        check('touch: a tap on a ball aims at it', abs(pg.evaluate("__T.state.aim") - bp[2]) < .03, json.dumps([pg.evaluate("__T.state.aim"), bp[2]]))
        # the pull-back power: pull down, let go, the shot is played at that power
        pg.evaluate("()=>{__T.goView('aim','cut');const s=__T.state;s.inShot=false;}")
        pp = pg.locator('#pull-power').bounding_box()
        shots_before = pg.evaluate("__T.state.shotCount")
        if pp:
            x0, y0 = pp['x'] + pp['width'] / 2, pp['y'] + 20
            touch('touchStart', [(x0, y0)])
            for i in range(1, 8): touch('touchMove', [(x0, y0 + i * pp['height'] * .07)])
            power = pg.evaluate("__T.state.settings[0].power")
            touch('touchEnd', [])
            pg.wait_for_function("__T.state.inShot||__T.state.shotCount>%d" % shots_before, timeout=15000)
            check('touch: pulling the cue sets the power and letting go plays the shot', 30 < power < 70, power)
        else:
            check('touch: the pull-back power control is shown on touch screens', False)
        pg.wait_for_function("!__T.state.inShot", timeout=60000)

        # 9. Resizing: views refit, the overhead turns upright on a tall screen.
        sizes = []
        for (w, h) in [(800, 600), (390, 844), (1600, 900)]:
            pg.set_viewport_size({'width': w, 'height': h}); pg.wait_for_timeout(300)
            pg.evaluate("()=>__T.goView('top','cut')"); pg.evaluate(SETTLE)
            f = pg.evaluate("""()=>{const c=__T.camera;c.updateMatrixWorld();const V=THREE.Vector3,X=1.7845+.17,Z=.889+.17;let m=0;
                for(const [x,z] of [[X,Z],[-X,Z],[X,-Z],[-X,-Z]]){const v=new V(x,0,z).project(c);m=Math.max(m,Math.abs(v.x),Math.abs(v.y));}return {m:+m.toFixed(3),az:+__T.cam.az.toFixed(2)};}""")
            pg.evaluate("()=>{const s=__T.state;s.ballInHand=false;s.current=0;const cb=__T.cueBall();cb.x=-1;cb.z=.1;s.aim=.2;__T.goView('aim','cut');}"); pg.evaluate(SETTLE)
            v = T()
            sizes.append({'size': [w, h], 'top': f, 'cue': v['cue'], 'ok': f['m'] < 1.0 and (f['az'] == -1.57 if h > w else f['az'] == 0) and abs(v['cue'][0]) < 1 and abs(v['cue'][1]) < 1})
        check('after resizing: the whole table in the overhead (upright when tall), the cue ball in the aiming view', all(s['ok'] for s in sizes), json.dumps(sizes))
        pg.set_viewport_size({'width': 1280, 'height': 720})

        # 9b. The mouse round the screen, again and again (over the table, the side panels, the scoreboard's
        #     corner, the controls): the picture never slides and no view moves by itself; the aiming view
        #     turns only with the mouse over the table (with AIM · HOLD THE BUTTON, only while it is held),
        #     and small turns of the aim do not re-frame it.
        POSE = "()=>{const c=__T.camera,v=c.view||{};return [c.position.x,c.position.y,c.position.z,c.quaternion.x,c.quaternion.y,c.quaternion.z,c.quaternion.w,c.fov,v.fullWidth||0,v.offsetX||0,v.offsetY||0].map(x=>+x.toFixed(4))}"
        tour = [(60, 360), (1230, 360), (1180, 220), (1230, 520), (640, 40), (640, 690), (100, 120), (1250, 650), (60, 600), (640, 360)]
        def round_trip(times=2):
            for _ in range(times):
                for (x, y) in tour: pg.mouse.move(x, y, steps=14); pg.wait_for_timeout(60)
            pg.wait_for_timeout(900)
        pg.evaluate("()=>{const s=__T.state;s.inShot=false;s.ballInHand=false;s.current=0;const cb=__T.cueBall();cb.x=-.9;cb.z=.25;cb.vx=cb.vz=0;s.aim=.35;}")
        slid = {}
        for v in ['tv', 'top', 'free']:
            pg.evaluate("v=>__T.goView(v,'cut')", v); pg.wait_for_timeout(1500)
            p0 = pg.evaluate(POSE); round_trip(); p1 = pg.evaluate(POSE)
            slid[v] = round(max(abs(a - b) for a, b in zip(p0, p1)), 4)
        check('the mouse round the screen again and again: no view moves or slides by itself', all(d < 1e-3 for d in slid.values()), json.dumps(slid))
        pg.evaluate("()=>{__T.goView('aim','cut');__T.resetCamera();}"); pg.wait_for_timeout(1500)
        rows = pg.evaluate("()=>{const out={off:null,on:null};for(let y=12;y<700;y+=12){const xs=[];for(let x=120;x<=1160;x+=40)xs.push(__T.overTable(x,y));"
                           "if(out.off==null&&xs.every(v=>!v))out.off=y;if(out.on==null&&xs.slice(8,19).every(v=>v)&&y>200)out.on=y;}return out;}")
        if rows['off'] is not None: pg.mouse.move(120, rows['off'], steps=1); pg.wait_for_timeout(400)   # straight there, not across the table
        a0, p0 = pg.evaluate("__T.state.aim"), pg.evaluate(POSE)
        if rows['off'] is not None:
            for _ in range(3):
                pg.mouse.move(120, rows['off'], steps=20); pg.mouse.move(1160, rows['off'], steps=20)
        pg.wait_for_timeout(600)
        a1, p1 = pg.evaluate("__T.state.aim"), pg.evaluate(POSE)
        pg.mouse.move(560, rows['on'] or 360, steps=1); pg.wait_for_timeout(200); a1b = pg.evaluate("__T.state.aim")
        pg.mouse.move(700, rows['on'] or 360, steps=12); pg.wait_for_timeout(500)
        a2 = pg.evaluate("__T.state.aim") - (a1b - a1)
        check('aiming view: the mouse away from the table leaves the aim and the camera; over the table it turns the aim',
              rows['off'] is not None and abs(a1 - a0) < 1e-9 and max(abs(x - y) for x, y in zip(p0, p1)) < 1e-3 and abs(a2 - a1) > .05,
              json.dumps({'rows': rows, 'off': round(a1 - a0, 5), 'on': round(a2 - a1, 4)}))
        pg.evaluate("()=>{__T.camSet.aimHold=true}"); pg.wait_for_timeout(200)
        y = rows['on'] or 360
        a0 = pg.evaluate("__T.state.aim"); pg.mouse.move(500, y, steps=6); pg.mouse.move(780, y, steps=12); a1 = pg.evaluate("__T.state.aim")
        pg.mouse.move(600, y); pg.mouse.down(); pg.mouse.move(760, y, steps=12); pg.mouse.up(); a2 = pg.evaluate("__T.state.aim")
        tgt = pg.evaluate("y=>{const cb=__T.cueBall();for(const x of [420,860,640]){const p=__T.screenToTable(x,y);"
                          "if(p&&__T.overTable(x,y)&&Math.hypot(p[0]-cb.x,p[1]-cb.z)>.3)return {x,y,want:Math.atan2(p[1]-cb.z,p[0]-cb.x),ok:true};}return {ok:false}}", y)
        if tgt['ok']: pg.mouse.click(tgt['x'], tgt['y'])
        a3 = pg.evaluate("__T.state.aim")
        pg.evaluate("()=>{__T.camSet.aimHold=false}")
        check('AIM · HOLD THE BUTTON: moving alone leaves the aim, a held drag turns it, a click aims at the spot',
              abs(a1 - a0) < 1e-9 and abs(a2 - a1) > .05 and tgt['ok'] and abs(math.atan2(math.sin(a3 - tgt['want']), math.cos(a3 - tgt['want']))) < .06,
              json.dumps([round(a1 - a0, 5), round(a2 - a1, 4), round(a3, 4), tgt]))
        pg.evaluate("()=>{__T.state.aim=.35}"); pg.wait_for_timeout(1500)
        r0 = pg.evaluate("[__T.cam.radius,__T.cam.el]")
        for d in [.012, -.02, .015, -.01]:
            pg.evaluate("d=>{__T.state.aim+=d}", d); pg.wait_for_timeout(450)
        r1 = pg.evaluate("[__T.cam.radius,__T.cam.el]")
        check('aiming view: small turns of the aim keep the framing (no re-framing after every pause)',
              abs(r1[0] - r0[0]) / r0[0] < .01 and abs(r1[1] - r0[1]) < .005, json.dumps([r0, r1]))

        # 10. The settings panel: saved, restored after a reload, reset to defaults. (Over a local web server:
        #     headless Chrome can lose what a file:// page saved just before a reload.)
        srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(pathlib.Path(sys.argv[1]).resolve().parent)))
        srv.RequestHandlerClass.log_message = lambda *a: None
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/index.html'); pg.wait_for_function('window.__T && window.__T.balls && window.__T.balls.length>0', timeout=120000)
        pg.click('.mode[data-mode="practice"]'); pg.click('#start-button'); pg.wait_for_timeout(500)
        pg.click('#cam-settings'); pg.wait_for_timeout(100)
        pg.evaluate("()=>{const e=document.getElementById('cam-rot');e.value='1.8';e.dispatchEvent(new Event('input',{bubbles:true}));}")
        pg.click('#cam-invert')
        saved = pg.evaluate("JSON.parse(localStorage.getItem('velvet.camera')||'{}')")
        pg.evaluate("()=>{localStorage.setItem('velvet.quality','low')}")
        pg.reload(); pg.wait_for_load_state('load'); pg.wait_for_function('window.__T && window.__T.balls && window.__T.balls.length>0', timeout=120000); pg.wait_for_timeout(300)
        after = pg.evaluate("()=>({rot:__T.camSet.rot,inv:__T.camSet.invertY})")
        pg.click('.mode[data-mode="practice"]'); pg.click('#start-button'); pg.wait_for_timeout(500)
        pg.click('#cam-settings'); pg.click('#cam-reset')
        reset = pg.evaluate("()=>({rot:__T.camSet.rot,inv:__T.camSet.invertY})")
        check('camera settings are saved, come back after a reload and reset to defaults', saved.get('rot') == 1.8 and saved.get('invertY') is True and after == {'rot': 1.8, 'inv': True} and reset == {'rot': 1, 'inv': False},
              json.dumps({'saved': saved, 'after': after, 'reset': reset}))
        if shots:
            pg.evaluate("()=>{window.__noRender=false}"); pg.wait_for_timeout(1500); pg.screenshot(path=str(shots / 'cam_panel.png'))
        check('no page errors', not errors, json.dumps(errors[:4]))
        b.close()
    print('\n'.join(notes + fails))
    print('RESULT', 'OK' if not fails else 'FAILED', f'{len(notes)}/{len(notes) + len(fails)}')


if __name__ == '__main__':
    main()
