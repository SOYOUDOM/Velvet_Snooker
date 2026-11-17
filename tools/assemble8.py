"""Step 8: ball-return rails (physics), players (IK stance, chairs, walk-on),
replays of remarkable shots, frame-ball replays and the walk-on intro."""
import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
V, N = ROOT / 'velvet', ROOT / 'newcode'

def rep(text, old, new, label, count=1):
    n = text.count(old)
    if n != count:
        sys.exit(f'anchor {label!r}: found {n}, expected {count}')
    return text.replace(old, new)

def cut(text, start, end, new, label):
    a = text.find(start); b = text.find(end, a)
    if a < 0 or b < 0:
        sys.exit(f'cut {label!r}: start {a} end {b}')
    return text[:a] + new + text[b:]

js = (ROOT / 'step7_game.js').read_text()
js = cut(js, '  // ---- REAL-TIME POCKET BAG CLOTH / BALL RETURN', '  // ---- ARENA PEOPLE: REFEREE & AUDIENCE', (N / 'o_nets.js').read_text(), 'nets')
# players + replay modules after the crowd code
js = rep(js, '  function crowdReact(kind){', (N / 'p_players.js').read_text() + (N / 'q_replay.js').read_text() + '  function crowdReact(kind){', 'modules')
js = rep(js, "    spawnCrowd();\n  }\n  // Spectators for the current venue's seats", "    spawnPlayers(P);\n    spawnCrowd();\n  }\n  // Spectators for the current venue's seats", 'spawn players')
# referee fetches from the tray
js = rep(js, """      if(f){const pk=POCKETS[f.pocketId];
        ref.queue=[{s:loopNearest(pk.x,pk.z),x:pk.x,z:pk.z}];""", """      if(f){
        const cr=NET_CRADLES[f.pocketId];ref.queue=[{s:loopNearest(cr.end[0],cr.end[2]),x:cr.end[0],z:cr.end[2],take:fetchType,pocket:f.pocketId}];""", 'ref net')
js = rep(js, "      if(!ref.task.started){ref.task.started=true;ref.task.until=time+2.7;",
         "      const due=ref.task.take&&!ref.task.started?falling.filter(f=>f.type===ref.task.take).pop():null;\n      if(due&&!due.inTray&&time-(ref.task.arrived=ref.task.arrived||time)<6){}   // the ball is still settling in the net\n      else if(!ref.task.started){ref.task.started=true;ref.task.until=time+2.7;", 'ref waits for ball')
js = rep(js, "      else if(time>ref.task.until){ref.task=null;if(!ref.queue.length)ref.waitUntil=time+1.1;}",
         "      else if(time>ref.task.until){if(ref.task.take){const i=falling.map(f=>f.type).lastIndexOf(ref.task.take);if(i>=0)falling.splice(i,1);}\n        if(ref.task.empty)falling=falling.filter(f=>!(f.pocketId===ref.task.pocket&&f.type==='red'));\n        ref.task=null;if(!ref.queue.length)ref.waitUntil=time+1.1;}", 'ref take')
js = rep(js, "  function resPot(type){\n    falling=falling.filter(f=>f.type!==type);\n", "  function resPot(type){\n", 'resPot keeps rail ball')
js = rep(js, "  function replaceCue(){\n    falling=falling.filter(f=>f.type!=='cue');\n", "  function replaceCue(){\n", 'replaceCue keeps rail ball')
# recording hooks
js = rep(js, "    if(hit>.07)sound('click',hit,(a.x+b.x)/2,(a.z+b.z)/2);", "    if(hit>.07)sound('click',hit,(a.x+b.x)/2,(a.z+b.z)/2);\n    recEvent({k:'hit',a:a.id,b:b.id,v:hit});", 'rec hit')
js = rep(js, "const realCushion=(v,kind,b)=>{if(kind==='jaw'?v>.14:v>.09)sound('cushion',v,b&&b.x,b&&b.z);};",
         "const realCushion=(v,kind,b)=>{if(b)recEvent({k:kind==='jaw'?'jaw':'cush',a:b.id,v});if(kind==='jaw'&&b&&typeof commLive==='function')commLive('jaw',b);if(kind==='jaw'?v>.14:v>.09)sound('cushion',v,b&&b.x,b&&b.z);};", 'rec cushion')
js = rep(js, "    sound('pocket',speed,ball.x,ball.z);\n", "    sound('pocket',speed,ball.x,ball.z);\n    recEvent({k:'pot',a:ball.id,p:pocketId,v:speed});\n", 'rec pot')
js = rep(js, "    if(state.shot&&!state.shot.first)trackApproach();\n  }", "    if(state.shot&&!state.shot.first)trackApproach();\n    recPhysics();\n  }", 'rec step')
js = rep(js, "    state.inShot=true;state.shotRest=0;state.shotCount++;state.cueAnimation=.25;",
         "    state.inShot=true;state.shotRest=0;state.shotCount++;state.cueAnimation=.25;\n    recStart();{const sh=PL[state.current];if(sh){snapDown(sh);sh.downUntil=time+.8;}}", 'rec start')
js = rep(js, "  function resolveShot(){\n    if(!state.inShot)return;\n    state.inShot=false;", "  function resolveShot(){\n    if(!state.inShot)return;\n    state.inShot=false;rec.tail=1.3;", 'rec tail')
# frame ball replay before the end screen
js = rep(js, "    if(state.tour&&match&&winner>=0)tourFrameDone(winner);\n    setTimeout(()=>$('end-screen').classList.add('active'),1400);",
         "    if(state.tour&&match&&winner>=0)tourFrameDone(winner);\n    const showEnd=()=>setTimeout(()=>$('end-screen').classList.add('active'),cine.on?0:450);\n    if(!why&&rec.cur&&winner>=0)rec.ending={label:match&&m.over?'MATCH BALL':'FRAME BALL',done:showEnd};\n    else setTimeout(()=>$('end-screen').classList.add('active'),1400);", 'ending replay')
# intro at the start of a match
js = rep(js, "    message('THE TABLE IS YOURS',", "    if(state.mode!=='practice'&&state.match.frames[0]+state.match.frames[1]===0&&!increment)setTimeout(startIntro,60);\n    message('THE TABLE IS YOURS',", 'intro')
# frame loop: cinematics first, game paused while they run
js = rep(js, "    resize();updateCamera(dt);\n    if(state.started&&!isAnyOverlayOpen()){updatePhysics(dt);updateBot(now);}",
         "    resize();if(!updateCine(dt))updateCamera(dt);\n    if(state.started&&!isAnyOverlayOpen()&&!cine.on){updatePhysics(dt);updateBot(now);}\n    recTail(dt);", 'loop 1')
js = rep(js, "updateReferee(dt);updateCrowd(dt);updateOcclusion(dt);", "updateReferee(dt);updateCrowd(dt);updatePlayers(dt);updateOcclusion(dt);", 'loop 2')
# balls and cue in replays
js = rep(js, "  function syncBalls(){\n", "  function syncBalls(){\n    if(cine.on&&cine.data){syncReplayBalls();return;}\n", 'sync replay')
js = rep(js, "m.visible=true;m.material=ballMats[f.type];m.position.set(f.x,f.y,f.z);});",
         "m.visible=true;m.material=ballMats[f.type];m.position.set(f.x,f.y,f.z);if(f.qq)m.quaternion.copy(f.qq);else m.quaternion.identity();});", 'rail ball spin')
js = rep(js, "const pull=cuePull();", "const pull=cuePull();pullNow=pull;", 'pull')
js = rep(js, "  function updateAimVisuals(){\n    guideN=0;let rings=0;\n    cueGroup.visible=false;",
         "  function updateAimVisuals(){\n    guideN=0;let rings=0;\n    cueGroup.visible=false;\n    if(cine.on){for(const m of ringPool)if(m)m.visible=false;guideFlush();if(cine.data)replayCue();return;}", 'aim visuals')
# keys and button
js = rep(js, "    if(ev.key==='e'||ev.key==='E')useEscapeHint();", "    if(ev.key==='e'||ev.key==='E')useEscapeHint();\n    if(ev.key==='y'||ev.key==='Y')replayBest();", 'key Y')
js = rep(js, "  $('escape-hint')?.addEventListener('click',useEscapeHint);", "  $('escape-hint')?.addEventListener('click',useEscapeHint);\n  $('replay-button')?.addEventListener('click',()=>replayBest());", 'replay btn')
STANDS = r'''    const all=seatSpots.concat(proxySpots);venueSpots=all;const m=new T.Matrix4(),q=new T.Quaternion(),one=new T.Vector3(1,1,1),Y=new T.Vector3(0,1,0);
    // One batch per stand, so a stand out of shot is skipped as a whole.
    const nStands=v.bowl?v.bowl.sections:v.glb?8:v.stands.length+(v.u?2*v.u.aisles.length+5:0),byStand=list=>Array.from({length:nStands},(_,si)=>list.filter(s=>s.si===si)).filter(l=>l.length);
    const sGeo=seatModel?seatModel.geo:seatGeo,sMat=seatModel?seatModel.mat:seatMat;
    if(!v.glb)for(const list of byStand(all)){const inst=new T.InstancedMesh(sGeo,sMat,list.length);inst.userData.vxObj='seat';
      list.forEach((s,i)=>{q.setFromAxisAngle(Y,s.yaw);m.compose(new T.Vector3(s.x,s.y,s.z),q,one);inst.setMatrixAt(i,m);});
      inst.computeBoundingSphere();inst.receiveShadow=true;arenaGroup.add(inst);}
    // Rows behind the animated spectators: seated figures in the half-dark.
    const full=proxySpots.filter(s=>s.full);
    if(full.length){
      const bodyGeo=T.BufferGeometryUtils.mergeGeometries([new T.BoxGeometry(.4,.56,.26).translate(0,.78,-.08),new T.BoxGeometry(.36,.16,.42).translate(0,.5,.08)]);
      const headGeo=new T.SphereGeometry(.105,12,10).translate(0,1.16,-.06);
      const bodyMat=vmat('#Back-row figures',new T.MeshStandardMaterial({roughness:.9})),headMat=vmat('#Back-row figures (heads)',new T.MeshStandardMaterial({roughness:.7}));
      const cloth=['#1b1d22','#2a2c33','#3a3f4a','#1d2a3a','#4a2a2a','#2d3a2d','#5a5148','#111214','#6b6f78'],skin=['#c99a7a','#a8765a','#e0b49a','#7a5038','#d6a483'];
      const col=new T.Color();
      for(const list of byStand(full)){const bodies=new T.InstancedMesh(bodyGeo,bodyMat,list.length),heads=new T.InstancedMesh(headGeo,headMat,list.length);
        list.forEach((s,i)=>{q.setFromAxisAngle(Y,s.yaw);m.compose(new T.Vector3(s.x+Math.sin(s.yaw)*.05,s.y,s.z+Math.cos(s.yaw)*.05),q,one);
          bodies.setMatrixAt(i,m);heads.setMatrixAt(i,m);
          bodies.setColorAt(i,col.set(cloth[Math.floor(rnd()*cloth.length)]));heads.setColorAt(i,col.set(skin[Math.floor(rnd()*skin.length)]));});
        bodies.computeBoundingSphere();heads.computeBoundingSphere();arenaGroup.add(bodies,heads);proxyMeshes.push(bodies,heads);}
      if(v.bowl||v.cut)bowlFull=full;
    }
'''
# ---- step 8.1: players walk round the table; only what the camera sees is drawn ----
js = cut(js, '  // ---- CAMERA ----', '  const _size=new T.Vector2();', (N / 'k_camera.js').read_text(), 'camera')
js = rep(js, "OUT_X=IN_X+RAIL_W, OUT_Z=IN_Z+RAIL_W;", "OUT_X=IN_X+RAIL_W, OUT_Z=IN_Z+RAIL_W, CHAIR_Z=-(OUT_Z+1.22);", 'chair row')
js = rep(js, "    if(now>=ai.thinkUntil){\n      const plan=ai.plan;",
         "    if(now>=ai.thinkUntil){\n      if(!botSkipping()&&!playerReady(1)&&now<ai.thinkUntil+20000)return;   // still walking to the shot or getting down\n      const plan=ai.plan;", 'bot waits for its player')
js = rep(js, "    const p=ref.person;if(!p)return;\n    p.obj.position.set(at.x,FLOOR_Y,at.z);p.obj.rotation.y=ref.yaw;",
         "    const p=ref.person;if(!p)return;\n    // step back out of a player's way\n    let near=0;for(const pl of PL)if(pl.fade>.5&&pl.act!=='sit'){const d=Math.hypot(pl.x-at.x,pl.z-at.z);near=Math.max(near,clamp((1-d)/.5,0,1));}\n    ref.push=lerp(ref.push||0,near,1-Math.exp(-dt*2.5));const ol=Math.hypot(at.x,at.z)||1;\n    p.obj.position.set(at.x+at.x/ol*.5*ref.push,FLOOR_Y,at.z+at.z/ol*.5*ref.push);p.obj.rotation.y=ref.yaw;", 'referee makes way')
js = rep(js, "      crowd.push({p,yaw:st.yaw,rank:rnd(),", "      crowd.push({p,sph:new T.Sphere(new T.Vector3(st.x,st.y+.7,st.z),1.05),yaw:st.yaw,rank:rnd(),", 'crowd sphere')
js = rep(js, """  function updateCrowd(dt){
    if(!crowd.length||!crowdGroup.visible)return;
    const step=1/QUALITY[quality].crowdHz,fp=focusPoint(),interest=state.inShot?.85:.35;
    for(const c of crowd){
      if(!c.p.obj.visible)continue;
""", """  // Spectators out of shot are neither drawn nor animated (they cast no
  // shadows, so nothing on screen depends on them); back in shot they carry on.
  const _fr=new T.Frustum(),_fm=new T.Matrix4();
  function updateCrowd(dt){
    if(!crowd.length||!crowdGroup.visible)return;
    camera.updateMatrixWorld();_fr.setFromProjectionMatrix(_fm.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    const step=1/QUALITY[quality].crowdHz,fp=focusPoint(),interest=state.inShot?.85:.35,share=QUALITY[quality].crowd;
    for(const c of crowd){
      const on=c.rank<share&&_fr.intersectsSphere(c.sph);
      if(c.p.obj.visible!==on){c.p.obj.visible=on;c.p.obj.matrixWorldAutoUpdate=on;if(on)c.acc=step;}
      if(!on)continue;
""", 'crowd culling')
js = rep(js, "    for(const st of v.stands){\n      const total=st.rows+st.extra;", "    for(const [si,st] of v.stands.entries()){\n      const total=st.rows+st.extra;", 'stand index')
js = rep(js, "yaw:Math.atan2(st.face[0],st.face[1]),row:r};", "yaw:Math.atan2(st.face[0],st.face[1]),row:r,si};", 'spot stand')
js = cut(js, "    const all=seatSpots.concat(proxySpots);", "    seats.push(...seatSpots);", STANDS, 'stand batches')
js = js.replace('-(OUT_Z+1.1)', 'CHAIR_Z')
js = rep(js, "syncBalls();syncNets();updateAimVisuals();", "syncBalls();syncNets();updateAimVisuals();placePlayerCues();", 'player cues')
(V / 'js/game.js').write_text(js)

html = (ROOT / 'step7_index.html').read_text()
html = rep(html, '<div class="scene-control-row"><button id="escape-hint" class="hint-button" title="When you are snookered: show an escape line (once per match)">ESCAPE HINT · 1 LEFT</button></div>',
           '<div class="scene-control-row"><button id="escape-hint" class="hint-button" title="When you are snookered: show an escape line (once per match)">ESCAPE HINT · 1 LEFT</button><button id="replay-button" title="Watch the best shot of this frame again (Y)">REPLAY</button></div>', 'replay button')
html = rep(html, '<span><kbd>E</kbd> ESCAPE HINT</span>', '<span><kbd>E</kbd> ESCAPE HINT</span><span><kbd>Y</kbd> REPLAY</span>', 'keys')
html = rep(html, '<div><kbd>H</kbd><span>Pin / unpin the score panels; otherwise they hide automatically.</span></div>',
          '<div><kbd>H</kbd><span>Pin / unpin the score panels; otherwise they hide automatically.</span></div><div><kbd>Y</kbd><span>Replay the best shot of the frame. Remarkable shots and the frame ball are replayed automatically; click or press any key to skip a replay or the walk-on.</span></div>', 'help Y')
(V / 'index.html').write_text(html)

css = (ROOT / 'step7_style.css').read_text()
css += ('#replay-ui{position:fixed;inset:0;pointer-events:none;z-index:30;display:none}body.replay-on #replay-ui,body.intro-on #replay-ui{display:block}'
        '#replay-ui .bar{position:absolute;left:0;right:0;height:9vh;background:#000}#replay-ui .bar.top{top:0}#replay-ui .bar.bottom{bottom:0}'
        '#replay-ui .replay-tag{position:absolute;top:calc(9vh + 18px);left:28px;display:flex;align-items:center;gap:9px;font:800 12px/1 Arial,sans-serif;letter-spacing:2.2px;color:#fff;text-shadow:0 1px 6px #000}'
        '#replay-ui .replay-tag i{width:10px;height:10px;border-radius:50%;background:#e8352c;box-shadow:0 0 10px #e8352c}#replay-ui .replay-tag b{color:#f4dfaa;font-weight:800}'
        'body.intro-on #replay-ui .replay-tag{display:none}'
        '#replay-ui .replay-title{position:absolute;left:0;right:0;bottom:calc(9vh + 26px);text-align:center;font:400 44px/1.1 Georgia,serif;color:#f4e7c6;text-shadow:0 2px 18px #000;letter-spacing:1px}'
        '#replay-ui .replay-title small{display:block;margin-top:10px;font:700 12px/1 Arial,sans-serif;letter-spacing:3px;color:#e9e4d2}'
        '#replay-ui .replay-skip{position:absolute;bottom:calc(9vh - 26px);right:26px;font:700 9px/1 Arial,sans-serif;letter-spacing:2px;color:#9a9a9a}'
        'body.replay-on .top-bar,body.intro-on .top-bar,body.replay-on .control-dock,body.replay-on .scene-controls,body.replay-on .scoreboard,body.replay-on .match-panel,body.replay-on .camera-switcher,body.replay-on .camera-tag,body.replay-on .focus-tag,body.replay-on .control-hint,body.replay-on #toast,'
        'body.intro-on .control-dock,body.intro-on .scene-controls,body.intro-on .scoreboard,body.intro-on .match-panel,body.intro-on .camera-switcher,body.intro-on .camera-tag,body.intro-on .focus-tag,body.intro-on .control-hint,body.intro-on #toast{display:none!important}\n')
(V / 'css/style.css').write_text(css)

b = (ROOT / 'tools/build.py').read_text()
if 'playReplay' not in b:
    b = rep(b, 'placeCueForBot,updateCam:updateCamera,', 'placeCueForBot,updateCam:updateCamera,cine,rec,playReplay,startIntro,PL,replayBest,stanceFor,get falling(){return falling},TRAY_X,', 'hook')
    (ROOT / 'tools/build.py').write_text(b)
print('ok', len(js))
