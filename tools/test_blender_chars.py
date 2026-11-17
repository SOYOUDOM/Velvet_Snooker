"""Characters exported from Blender (characters/blender.js) in the game: every
one loads on the game skeleton, no vertex is left without a bone or thrown
out of the body (at rest and in the idle pose); the opponent made in Blender
walks to the table and gets down on his shots; audience members sit in the
stands. usage: python3 tools/test_blender_chars.py [test_dir] [opponent_id]"""
import pathlib, sys, json, base64, time
from playwright.sync_api import sync_playwright
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'test_bl').resolve()
opp = sys.argv[2] if len(sys.argv) > 2 else None
fails, errs = [], []
SHOT = """(v)=>{const T=__T,c=T.camera,o=v.crowd!=null?T.crowd[v.crowd].p.obj:T.PL[v.i].p.obj,hd=o.getObjectByName('Bip01_Head').getWorldPosition(new THREE.Vector3()),pv=o.getObjectByName('Bip01_Pelvis').getWorldPosition(new THREE.Vector3());
  const tgt=pv.clone().lerp(hd,v.k==null?.4:v.k);c.position.set(tgt.x+v.dx,tgt.y+v.dy,tgt.z+v.dz);c.lookAt(tgt);c.fov=v.fov||40;c.updateProjectionMatrix();
  T.renderer.render(T.scene,c);return T.renderer.domElement.toDataURL('image/png');}"""
def save(url, name): open(name, 'wb').write(base64.b64decode(url.split(',')[1]))
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 900, 'height': 640}); pg.set_default_timeout(240000); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto((root / 'index.html').as_uri()); pg.wait_for_function('window.__T && window.VelvetPeople && VelvetPeople.ready && __T.PL.length==2')
    rep = pg.evaluate("""()=>{const P=VelvetPeople,T=THREE,out={};
      for(const [id,t] of Object.entries(P.templates)){if(t.entry.source!=='blender')continue;
        const per=P.spawn(id),bb=new T.Box3(),res={role:t.role,rocketbox:t.rocketbox,canSit:P.canSit(t),zero:0,stray:0,bones:0};
        per.obj.traverse(o=>{if(o.isBone)res.bones++;});
        for(const pose of ['rest','idle']){if(pose==='idle'){per.play('idle');per.mixer.update(0.6);}per.obj.updateMatrixWorld(true);
          per.obj.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();const g=o.geometry,pa=g.attributes.position,sw=g.attributes.skinWeight,v=new T.Vector3();
            for(let i=0;i<pa.count;i++){if(pose==='rest'&&sw.getX(i)+sw.getY(i)+sw.getZ(i)+sw.getW(i)<0.5)res.zero++;o.getVertexPosition(i,v);v.applyMatrix4(o.matrixWorld);if(Math.abs(v.x)>0.75||Math.abs(v.z)>0.75||v.y<-0.03||v.y>2.2)res.stray++;}});}
        out[id]=res;}
      out._errors=P.errors;return out;}""")
    print(json.dumps(rep))
    for cid, r in rep.items():
        if cid.startswith('_'): continue
        if not r['rocketbox'] or r['bones'] < 80 or r['zero'] or r['stray'] or (r['role'] == 'audience' and not r['canSit']):
            fails.append(cid + ' ' + json.dumps(r))
    if rep['_errors']: fails.append('load errors ' + str(rep['_errors']))
    if opp:
        pg.evaluate("()=>{const T=__T;T.botOpponent=T.OPPONENTS.find(o=>o.id==='club');T.beginNewGame(false,{bestOf:1,frames:[0,0],breaker:1,over:false},'bot');}")
        body = pg.evaluate("()=>({body:__T.PL[1].p.tpl.name,ok:__T.PL[1].ok})")
        if body['body'] != opp or not body['ok']: fails.append('opponent body ' + json.dumps(body))
        t0 = time.time(); st = {}
        while time.time() - t0 < 240:
            st = pg.evaluate("()=>({a:__T.PL[1].act,st:__T.PL[1].stance,shots:(window.__shots||[]).length})")
            if st['a'] == 'down' and st['st'] > .97: break
            pg.wait_for_timeout(250)
        if st.get('a') != 'down': fails.append('opponent never got down ' + json.dumps(st))
        save(pg.evaluate(SHOT, {'i': 1, 'dx': -0.35, 'dy': 0.45, 'dz': 1.6}), '/tmp/tbc_down.png')
        save(pg.evaluate(SHOT, {'i': 1, 'dx': 1.5, 'dy': 0.3, 'dz': 0.25}), '/tmp/tbc_side.png')
        save(pg.evaluate(SHOT, {'i': 1, 'dx': -0.6, 'dy': 0.5, 'dz': 1.0, 'k': 0.85, 'fov': 24}), '/tmp/tbc_arm.png')
        # wait for his shot to be played: the bot strikes only once down
        t0 = time.time()
        while time.time() - t0 < 120 and pg.evaluate("()=>(window.__shots||[]).filter(s=>s.byBot).length") < 1: pg.wait_for_timeout(300)
        if pg.evaluate("()=>(window.__shots||[]).filter(s=>s.byBot).length") < 1: fails.append('the bot never struck')
    k = pg.evaluate("()=>__T.crowd.findIndex(c=>c.p.tpl.entry.source==='blender')")
    if k >= 0:
        save(pg.evaluate(SHOT, {'crowd': k, 'dx': 0.9, 'dy': 0.35, 'dz': 0.9, 'k': 0.6}), '/tmp/tbc_crowd.png')
        save(pg.evaluate(SHOT, {'crowd': k, 'dx': 0.5, 'dy': 0.25, 'dz': -0.9, 'k': 0.6}), '/tmp/tbc_crowd2.png')
        save(pg.evaluate(SHOT, {'crowd': k, 'dx': 0.35, 'dy': 0.1, 'dz': -0.9, 'k': 0.7, 'fov': 22}), '/tmp/tbc_crowd3.png')
    print('crowd seat with a Blender character:', k)
    b.close()
print('errors:', errs[:5])
print('RESULT', 'OK' if not fails and not errs else 'FAILED', fails)
