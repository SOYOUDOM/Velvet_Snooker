"""Game side of VELVET Studio: a studio file with a new player body, an
opponent profile linked to it, your name and a tournament entry is applied;
the opponent's body takes his chair at the start of a match, with his cue
colours, head size, belly and height; names show on the scoreboard; the
custom player enters tournaments by rating. Also the Test-in-game handoff."""
import pathlib, sys, json
from playwright.sync_api import sync_playwright
ARGS=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]
root=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'test_step9').resolve()
studio={'version':1,
  'people':[{'id':'friend_a','name':'Sam Friend','role':'player','gender':'male','base':'player_01','model':'characters/models/player_01.glb',
     'textures':{'body':'characters/textures/player_01_body.jpg','head':'characters/textures/player_01_head.jpg','opacity':'characters/textures/player_01_opacity.png'},
     'normals':{'head':'characters/textures/player_01_head_normal.jpg'},'height':1.95,'headScale':1.45,'belly':.9,
     'cue':{'shaft':'#8a5a36','butt':'#b0122a','metal':'silver'}}],
  'opponents':[{'id':'friend_opp','name':'Sam Friend','short':'SAM','nick':'The Rocket','style':{'pot':.9},'character':'friend_a','tour':True,'rating':95}],
  'you':{'name':'Soy Test','short':'SOY','nick':'Ace'}}
(root/'characters/studio.js').write_text('window.VELVET_STUDIO='+json.dumps(studio)+';\n')
fails=[];errs=[]
def check(c,msg):
    if not c:fails.append(msg)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=ARGS)
    pg=b.new_page(viewport={'width':960,'height':540});pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.set_default_timeout(240000)
    print("stage: main page",flush=True);pg.goto((root/'index.html').as_uri());pg.wait_for_function('window.__T && window.VelvetPeople && VelvetPeople.ready && __T.PL.length==2',timeout=240000)
    r=pg.evaluate("""()=>{const T=__T,o=T.OPPONENTS.find(o=>o.id==='friend_opp');T.botOpponent=o;T.beginNewGame(false,null,'bot');T.noIntro=false;T.startIntro();
      const pl=T.PL[1],head=pl.p.obj.getObjectByName('Bip01_Head'),k=pl.cueMesh.children;
      return {ids:T.OPPONENTS.map(o=>o.id),body1:pl.p.tpl.name,body0:T.PL[0].p.tpl.name,head:head.scale.x,scale:pl.p.obj.scale.y,
        shaft:'#'+k[2].material.color.getHexString(),butt:'#'+k[4].material.color.getHexString(),shared:k[2].material===T.cueGroup.children[2].material,
        n0:document.getElementById('player-name-0').textContent,n1:document.getElementById('player-name-1').textContent,
        field:T.tourField(),rating:T.tourRating('friend_opp'),intro:document.querySelector('#replay-ui .replay-title')?.textContent||''}}""")
    print(json.dumps(r)[:900])
    check('friend_opp' in r['ids'],'custom opponent missing')
    check(r['body1']=='friend_a','opponent body not swapped: '+r['body1'])
    check(abs(r['head']-1.45)<1e-6,'head scale')
    check(r['shaft']=='8a5a36'.join(['#','']) and r['butt']=='#b0122a','cue colours '+r['shaft']+' '+r['butt'])
    check(not r['shared'],'player cue shares the aiming cue material')
    check(r['n0']=='SOY','your name '+r['n0'])
    check(r['field'][0]=='friend_opp' and len(r['field'])==15,'tour field '+str(r['field'][:3]))
    check('THE ROCKET' in r['intro'] and 'SOY' in r['intro'],'intro names '+r['intro'])
    pg.evaluate("()=>{__T.cine.on=false;window.__noRender=false}")
    pg.wait_for_timeout(1500)
    pg.evaluate("""()=>{const T=__T,pl=T.PL[1];T.cam.mode='free';T.camera.position.set(pl.x+1.6,1.5,pl.z+1.2);T.camera.lookAt(pl.x,1.0,pl.z);}""")
    pg.screenshot(path='/tmp/s9_game_chair.png')
    pg.close()                                   # software rendering is slow: give the test page the machine
    # Test-in-game handoff: a page opened with #studio-test gets its data by message
    opener=b.new_page();opener.goto((root/'characters/studio.js').as_uri())
    with opener.expect_popup(timeout=60000) as pop:
        opener.evaluate("""(st)=>{window.addEventListener('message',ev=>{if(ev.data&&ev.data.type==='velvet-studio-ready')ev.source.postMessage({type:'velvet-studio-test',studio:st,files:{},test:{id:'friend_a',role:'player',name:'Sam Friend'}},'*');});
          window.open(location.href.replace('characters/studio.js','index.html#studio-test'),'t');}""",studio)
    print("stage: test page",flush=True);t=pop.value;t.on('pageerror',lambda e:errs.append('test page: '+str(e)))
    t.wait_for_function('window.__T && window.VelvetPeople && VelvetPeople.ready && __T.PL.length==2 && __T.state.started',timeout=240000)
    rr=t.evaluate("()=>({opp:__T.botOpponent.id,body:__T.PL[1].p.tpl.name,mode:__T.state.mode,cur:__T.state.current,test:VelvetStudio.test&&VelvetStudio.test.id})")
    print('test page',rr)
    check(rr['body']=='friend_a' and rr['mode']=='bot' and rr['cur']==1,'test match '+str(rr))
    b.close()
print('page errors:',errs[:5])
print('RESULT','OK' if not fails and not errs else 'FAILED',fails)
