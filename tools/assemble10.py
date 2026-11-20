"""Step 10 (after assemble9): commentary team, MC and their hooks into the
rules, the shot and the frame. Patches velvet/js/game.js in place.
usage: python3 tools/assemble8.py && python3 tools/assemble9.py && python3 tools/assemble10.py"""
import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
V, N = ROOT / 'velvet', ROOT / 'newcode'

def rep(text, old, new, label):
    if text.count(old) != 1:
        sys.exit(f'rep {label!r}: found {text.count(old)}')
    return text.replace(old, new)

js = (V / 'js/game.js').read_text()
js = rep(js, '  // ---- TABLE & ARENA SOUND', (N / 'r_commentary.js').read_text() + '\n  // ---- TABLE & ARENA SOUND', 'commentary module')
js = rep(js, "  function finishShot(){state.shot=null;",
         "  function finishShot(){try{playerReactToShot(state.shot);commAfterShot(state.shot);}catch(e){console.warn('VELVET commentary:',e);}state.shot=null;", 'after shot')
js = rep(js, "    Object.assign(state.shot,rulesCtx);state.touching=null;",
         "    Object.assign(state.shot,rulesCtx);state.touching=null;\n"
         "    Object.assign(state.shot,{by:state.current,kind:byBot&&plan?plan.kind:null,target:byBot&&plan&&plan.target?plan.target.id:null,breakBefore:state.break,reds0:redSpread(),wasSnookered:snookeredOnAll(onTypes)});", 'shot meta')
js = rep(js, "      state.scores[opp]+=value;state.break=0;", "      state.scores[opp]+=value;state.break=0;s.foul=true;", 'foul flag')
js = rep(js, "const realCushion=(v,kind,b)=>{if(b)recEvent({k:kind==='jaw'?'jaw':'cush',a:b.id,v});",
         "const realCushion=(v,kind,b)=>{if(b)recEvent({k:kind==='jaw'?'jaw':'cush',a:b.id,v});if(kind==='jaw'&&b&&state.shot)(state.shot.jaws=state.shot.jaws||[]).push(b.id);", 'jaw hits')
js = rep(js, "      sound('frame');crowdReact('cheer');", "      sound('frame');crowdReact('cheer');try{commFrameEnd(winner);}catch(e){}", 'frame end')
js = rep(js, "      say(['respottedBlack'],.5);", "      say(['respottedBlack'],.5);commSay('respotted_black',.9,null,{delay:2.6,force:true});", 'respot')
js = rep(js, "state.snookCalled=null;", "state.snookCalled=null;commFrameStart(increment);", 'frame start')
js = rep(js, "      const free=snookeredOnAll(ballsOnTypes());if(free)calls.push('freeBall');\n      say(calls,.45);",
         "      const free=snookeredOnAll(ballsOnTypes());if(free)calls.push('freeBall');\n      say(calls,.45);if(free)commSay('free_ball',.6,null,{delay:2.2});", 'free ball')
js = rep(js, "        ai.retryAt=0;ai.plan=plan;ai.thinkUntil=botSkipping()?",
         "        if(mull>1.45&&!botSkipping())commSay('thinking',.45,botOpponent.id,{delay:1.4});\n        ai.retryAt=0;ai.plan=plan;ai.thinkUntil=botSkipping()?", 'thinking')
js = rep(js, "say(['quiet_please'],3.4);", "say(['quiet_please'],3.4);\n    if(kind==='cheer')commSay('crowd',.18,null,{delay:1.4});", 'crowd')
js = rep(js, "    updateStroke(dt);", "    updateStroke(dt);commIdle(dt);", 'idle')
js = rep(js, "  function updateCamera(dt){\n", (N / 's_tv.js').read_text() + "  function updateCamera(dt){\n", 'tv module')
# (the camera controller in k_camera.js calls tvDirect itself)
js = rep(js, "    if(ev.key==='s'||ev.key==='S')skipBotTurn();", "    if(ev.key==='s'||ev.key==='S')skipBotTurn();\n    if(ev.key==='t'||ev.key==='T')toggleTv();", 'key T')
js = rep(js, "  // Watch the best shot of the frame again (Y / REPLAY button).", (N / 't_opening.js').read_text() + "  // Watch the best shot of the frame again (Y / REPLAY button).", 'opening module')
js = rep(js, "    if(cine.kind==='intro')return updateIntro(dt);", "    if(cine.kind==='intro')return updateIntro(dt);\n    if(cine.kind==='opening')return updateOpening(dt);", 'opening dispatch')
js = rep(js, "    spawnPlayers(P);\n    spawnCrowd();\n  }", "    spawnPlayers(P);\n    spawnCrowd();\n    if(!state.started&&!opening.done){opening.done=true;setTimeout(()=>{if(!state.started&&!reducedMotion())startOpening();},300);}\n  }", 'opening at load')
js = rep(js, "setTimeout(startIntro,60);", "{if(walkOnOn())setTimeout(startIntro,60);}", 'walk-on setting')
js = rep(js, "if(!state.started&&!reducedMotion())startOpening();", "if(!state.started&&!reducedMotion()&&!(studio&&studio.on)&&!/^#studio/.test(location.hash))startOpening();", 'no opening in the studio')
js = rep(js, "  newRack(false);resize();applyQuality();startPeople();requestAnimationFrame(frame);\n})();",
         (N / 'w_objects.js').read_text() + "  newRack(false);resize();applyQuality();startPeople();requestAnimationFrame(frame);\n  objectsBoot();\n})();", 'objects studio')
js = rep(js, "    tableIn.connect(audioBus);", "    tableIn.gain.value=mix.table;\n    tableIn.connect(audioBus);", 'mix table')
js = rep(js, "s.connect(g);g.connect(audioBus);s.start(now+.05);crowdSrc={s,g};", "s.connect(g);g.connect(crowdBus(ctx));s.start(now+.05);crowdSrc={s,g};", 'mix crowd 1')
js = rep(js, "s.buffer=ownSfx('murmur')||sfxBuf.murmur;s.loop=true;g.gain.value=0;s.connect(g);g.connect(audioBus);", "s.buffer=ownSfx('murmur')||sfxBuf.murmur;s.loop=true;g.gain.value=0;s.connect(g);g.connect(crowdBus(audioContext));", 'mix crowd 2')
js = rep(js, "    input.connect(dry);input.connect(conv);", "    input.gain.value=mix.ref;refIn=input;\n    input.connect(dry);input.connect(conv);", 'mix referee')
js = rep(js, "const g=ctx.createGain(),hp=ctx.createBiquadFilter(),pr=ctx.createBiquadFilter();g.gain.value=.85;", "const g=ctx.createGain(),hp=ctx.createBiquadFilter(),pr=ctx.createBiquadFilter();g.gain.value=.85*mix.comm;", 'mix commentary')
js = rep(js, "  // ---- TABLE & ARENA SOUND", (N / 'u_settings.js').read_text() + (N / 'v_sounds.js').read_text() + (N / 'x_faces.js').read_text() + "  // ---- TABLE & ARENA SOUND", 'settings module + HD faces')
js = rep(js, "updatePlayers(dt);updateOcclusion(dt);", "updatePlayers(dt);facesTick(dt);updateOcclusion(dt);", 'faces in the loop')
(V / 'js/game.js').write_text(js)
print('step 10 ok', len(js))
