  function switchTurn(){state.break=0;if(state.mode==='versus'||state.mode==='bot')state.current=1-state.current;state.nominated=null;state.nominationManual=false;state.freeBall=false;ai.plan=null;ai.thinkUntil=0;}

  // ---- RULES HELPERS (WPBSA-style) -------------------------------------------
  const playerName=i=>state.mode==='bot'?(i===0?'YOU':'THE CLUB BOT'):state.mode==='versus'?(i===0?'PLAYER ONE':'PLAYER TWO'):'YOU';
  function ballsOnTypes(){
    if(state.freeBall)return state.phase==='red'?['red',...COLOR_ORDER]:COLOR_ORDER.slice(Math.min(5,state.clearanceIndex));
    if(state.phase==='red')return['red'];
    if(state.phase==='color')return state.nominated?[state.nominated]:COLOR_ORDER.slice();
    return[COLOR_ORDER[Math.min(5,state.clearanceIndex)]];
  }
  function onBallValue(){return state.phase==='red'?1:state.phase==='color'?(COLOR_INFO[state.nominated]?.score||7):COLOR_INFO[COLOR_ORDER[Math.min(5,state.clearanceIndex)]].score;}
  function pointsRemaining(){
    if(state.phase==='clearance'){let s=0;for(let i=state.clearanceIndex;i<6;i++)s+=COLOR_INFO[COLOR_ORDER[i]].score;return s;}
    return redCount()*8+27+(state.phase==='color'?7:0);
  }
  const snookersNeeded=p=>state.scores[1-p]-state.scores[p]>pointsRemaining();
  // Straight path of the cue ball's centre to (x,z): is it blocked by a ball
  // that is NOT on? (Another ball on in the way is not a snooker.)
  function clearPath(cb,x,z,target,onTypes=[]){
    const dx=x-cb.x,dz=z-cb.z,L2=dx*dx+dz*dz||1e-9;
    for(const b of balls){if(b.pocketed||b===cb||b===target||onTypes.includes(b.type))continue;
      const t=clamp(((b.x-cb.x)*dx+(b.z-cb.z)*dz)/L2,0,1);
      if(Math.hypot(b.x-(cb.x+dx*t),b.z-(cb.z+dz*t))<2*R-.0005)return false;}
    return true;
  }
  // Snookered on a ball = cannot hit BOTH of its extreme edges in a straight line.
  function bothEdgesVisible(cb,t,onTypes){
    const dx=t.x-cb.x,dz=t.z-cb.z,d=Math.hypot(dx,dz);if(d<2*R+.002)return true;
    const px=-dz/d,pz=dx/d,off=2*R*.985;
    return [-1,1].every(s=>clearPath(cb,t.x+px*off*s,t.z+pz*off*s,t,onTypes));
  }
  function snookeredOnAll(types){
    const cb=cueBall();if(!cb||state.ballInHand)return false;
    const on=balls.filter(b=>!b.pocketed&&types.includes(b.type));
    return on.length>0&&on.every(b=>!bothEdgesVisible(cb,b,types));
  }
  const clearFullBall=types=>{const cb=cueBall();return !!cb&&balls.some(b=>!b.pocketed&&b!==cb&&types.includes(b.type)&&clearPath(cb,b.x,b.z,b,types));};
  function touchingBall(){const cb=cueBall();if(!cb)return null;for(const b of balls)if(!b.pocketed&&b!==cb&&len2(b.x-cb.x,b.z-cb.z)<2*R+.0007)return b;return null;}
  function checkTouching(){
    if(state.finished||state.ballInHand){state.touching=null;return;}
    const t=touchingBall();state.touching=t?t.id:null;
    if(t){say(['touching'],.5);message('TOUCHING BALL','PLAY AWAY WITHOUT MOVING THE '+t.type.toUpperCase(),2600);}
  }
  // The cue ball's closest approach to any ball on before the first contact
  // (how good an attempt a missed escape was).
  function trackApproach(){
    const s=state.shot,cb=cueBall();if(!cb)return;
    for(const b of balls){if(b.pocketed||b===cb||!s.onTypes.includes(b.type))continue;
      const g=Math.hypot(b.x-cb.x,b.z-cb.z)-2*R;if(g<s.closest)s.closest=g;}
  }
  function snapshotTable(){return{balls:balls.map(b=>({id:b.id,x:b.x,z:b.z,pocketed:b.pocketed})),phase:state.phase,nominated:state.nominated,
    clearanceIndex:state.clearanceIndex,ballInHand:state.ballInHand,respottedBlack:state.respottedBlack};}
  function restoreTable(snap){
    for(const sb of snap.balls){const b=balls.find(x=>x.id===sb.id);if(!b)continue;
      Object.assign(b,{x:sb.x,z:sb.z,pocketed:sb.pocketed,vx:0,vz:0,wx:0,wy:0,wz:0,q:[0,0,0,1]});
      if(!sb.pocketed)falling=falling.filter(f=>f.id!==b.id);}
    Object.assign(state,{phase:snap.phase,nominated:snap.nominated,clearanceIndex:snap.clearanceIndex,ballInHand:snap.ballInHand,respottedBlack:snap.respottedBlack});
  }
  // Re-spotting (official order): its own spot; if covered, the highest-value
  // free spot; if none, as near as possible to its own spot toward the top
  // cushion (then toward baulk). Higher-value colours are spotted first.
  function spotIsFree(x,z,except){return balls.every(b=>b===except||b.pocketed||len2(b.x-x,b.z-z)>=2*R+.0008);}
  function resPot(type){
    falling=falling.filter(f=>f.type!==type);
    const ball=balls.find(b=>b.type===type);if(!ball)return;
    const own=SPOTS[type];let pos=spotIsFree(own[0],own[1],ball)?own:null;
    if(!pos)for(const t of ['black','pink','blue','brown','green','yellow']){const s=SPOTS[t];if(spotIsFree(s[0],s[1],ball)){pos=s;break;}}
    if(!pos)for(const dir of [1,-1]){for(let x=own[0];Math.abs(x)<HX-R-.002;x+=dir*.001)if(spotIsFree(x,own[1],ball)){pos=[x,own[1]];break;}if(pos)break;}
    pos=pos||own;
    Object.assign(ball,{x:pos[0],z:pos[1],vx:0,vz:0,wx:0,wy:0,wz:0,spinX:0,spinY:0,q:[0,0,0,1],pocketed:false});
  }
  const respotColours=types=>types.slice().sort((a,b)=>COLOR_INFO[b].score-COLOR_INFO[a].score).forEach(resPot);
  function replaceCue(){
    falling=falling.filter(f=>f.type!=='cue');
    let found=null;const candidates=[[-.20,.11],[-.20,-.10],[-.15,0],[-.25,0],[-.10,.18],[-.1,-.18],[0,0]];
    for(const [dx,z] of candidates){const x=BAULK_X+dx;if(x>BAULK_X||len2(x-BAULK_X,z)>D-.015)continue;
      if(balls.every(b=>b.type==='cue'||b.pocketed||len2(b.x-x,b.z-z)>2*R+.02)){found=[x,z];break;}}
    if(!found)found=[BAULK_X-.16,0];
    const cue=balls.find(b=>b.type==='cue');cue.x=found[0];cue.z=found[1];cue.vx=cue.vz=cue.wx=cue.wy=cue.wz=0;cue.spinX=cue.spinY=0;cue.q=[0,0,0,1];cue.pocketed=false;state.ballInHand=true;
  }

  // ---- FRAME & MATCH END ----------------------------------------------------
  // Scores level at the end -> re-spotted black: black on its spot, ball in
  // hand, players toss for who plays; the next score or foul ends the frame.
  function endFrameOrRespot(){
    if(state.mode!=='practice'&&state.scores[0]===state.scores[1]){
      state.respottedBlack=true;state.phase='clearance';state.clearanceIndex=5;resPot('black');replaceCue();
      state.current=Math.random()<.5?0:1;state.break=0;state.freeBall=false;state.decision=null;ai.plan=null;
      say(['respottedBlack'],.5);addHistory('Scores level · re-spotted black');
      message('RE-SPOTTED BLACK','SCORES LEVEL · '+playerName(state.current)+' WIN THE TOSS · BALL IN HAND',4200);
      return false;
    }
    finishFrame();return true;
  }
  function finishFrame(winner=null,why=''){
    if(winner===null)winner=state.scores[0]>state.scores[1]?0:state.scores[1]>state.scores[0]?1:-1;
    state.finished=true;state.decision=null;activeOverlay('decision-screen',false);
    const m=state.match,match=state.mode!=='practice';
    if(match&&winner>=0){m.frames[winner]++;m.over=m.frames[winner]>Math.floor(m.bestOf/2);}
    refreshUI();revealHUD(8000);
    if(match&&winner>=0){
      say([state.mode==='bot'&&winner===1?'frameBot':winner===0?'frameP1':'frameP2',...(m.over?['frameMatch']:[])],.9);
      const who=playerName(winner);
      $('end-title').innerHTML=(m.over?(m.bestOf>1?'MATCH TO ':'FRAME TO ')+who:'FRAME TO '+who)+'<span>.</span>';
      $('end-description').textContent=(why?why+' · ':'')+`Frame score ${state.scores[0]}–${state.scores[1]}.`+(m.bestOf>1?` Frames ${m.frames[0]}–${m.frames[1]} (best of ${m.bestOf}).`:'');
      $('play-again-button').firstChild.textContent=m.over?'NEW MATCH ':'NEXT FRAME ';
    }else{
      $('end-title').innerHTML='WELL PLAYED<span>.</span>';
      $('end-description').textContent=`Your final score: ${state.scores[0]} points.`;
      $('play-again-button').firstChild.textContent='PLAY ANOTHER FRAME ';
    }
    setTimeout(()=>$('end-screen').classList.add('active'),1400);
  }
  function concedeFrame(player){
    if(!state.started||state.finished||state.mode==='practice')return;
    addHistory(playerName(player)+' concede'+(state.mode==='bot'&&player===1?'s':'')+' the frame');
    finishFrame(1-player,playerName(player)+(player===1&&state.mode==='bot'?' CONCEDES':' CONCEDED'));
  }

  // ---- AFTER A FOUL: THE OPPONENT'S CHOICE -----------------------------------
  // Play from where the balls lie (or play a free ball), make the offender play
  // again, or - after a foul and a miss - have the balls replaced.
  function offerDecision(d){
    state.decision=d;state.current=d.chooser;ai.plan=null;
    if(state.mode==='bot'&&d.chooser===1){ai.decideAt=performance.now()+1100;refreshUI();return;}
    const opts=[['play',d.freeBall?'PLAY FROM HERE (NO FREE BALL)':'PLAY FROM HERE']];
    if(d.freeBall)opts.unshift(['free','PLAY THE FREE BALL']);
    opts.push(['back',(state.mode==='bot'?'MAKE THE BOT':'MAKE '+playerName(d.offender))+' PLAY AGAIN']);
    if(d.miss)opts.push(['replace','REPLACE THE BALLS · '+(state.mode==='bot'?'BOT':playerName(d.offender))+' PLAYS AGAIN']);
    $('decision-eyebrow').textContent=(d.miss?'FOUL AND A MISS':'FOUL')+' · '+d.value+' POINTS TO '+playerName(d.chooser)+(d.freeBall?' · FREE BALL':'');
    $('decision-title').innerHTML=(state.mode==='versus'?playerName(d.chooser)+'’S':'YOUR')+' CHOICE<span>.</span>';
    $('decision-text').textContent=d.freeBall?'You are snookered: with a free ball any ball can be played as the ball on.'
      :d.miss?'The referee called a miss. You can have the balls put back where they were.':'Play on from here, or put your opponent back in.';
    $('decision-buttons').innerHTML=opts.map(([k,l])=>`<button class="dialog-${k==='play'||k==='free'?'primary':'secondary'}" data-choice="${k}">${l}</button>`).join('');
    activeOverlay('decision-screen',true);refreshUI();
  }
  function botDecision(d){
    if(d.freeBall)return 'free';
    const types=ballsOnTypes(),best=types.flatMap(t=>plannedShotFor(t)).sort((a,b)=>b.score-a.score)[0];
    if(best&&best.score>2.55)return 'play';
    return d.miss?'replace':'back';
  }
  function applyDecision(choice){
    const d=state.decision;if(!d)return;state.decision=null;activeOverlay('decision-screen',false);
    if(choice==='replace'){restoreTable(d.snapshot);state.current=d.offender;}
    else if(choice==='back')state.current=d.offender;
    else state.current=d.chooser;
    if(choice!=='replace')state.misses[d.offender]=0;
    state.freeBall=choice==='free';
    state.break=0;state.nominated=null;state.nominationManual=false;ai.plan=null;ai.thinkUntil=0;
    const who=playerName(state.current);
    message(choice==='free'?'FREE BALL':choice==='replace'?'BALLS REPLACED':choice==='back'?who+' TO PLAY AGAIN':who+' TO PLAY',
      choice==='free'?'ANY BALL CAN BE PLAYED AS THE BALL ON':choice==='replace'?'FROM THE ORIGINAL POSITION':'FROM WHERE THE BALLS LIE',2400);
    if(state.mode==='bot'&&d.chooser===1)addHistory('Bot chose: '+({play:'play on',free:'free ball',back:'you play again',replace:'balls replaced'}[choice]));
    checkTouching();refreshUI();revealHUD(3000);
  }

  // ---- SHOT RESOLUTION -------------------------------------------------------
  function resolveShot(){
    if(!state.inShot)return;
    state.inShot=false;
    const s=state.shot,stage=state.phase,cur=state.current,opp=1-cur;
    const potted=s.potted,colorsPotted=potted.filter(t=>t!=='red'&&t!=='cue'),redsPotted=potted.filter(t=>t==='red').length;
    const legal=t=>s.onTypes.includes(t);
    const onType=stage==='clearance'?COLOR_ORDER[Math.min(5,state.clearanceIndex)]:null;
    const fbType=s.freeBall&&s.first&&s.first!=='red'&&s.first!==onType?s.first:null; // the ball played as the free ball
    const mayPot=t=>stage==='red'?(t==='red'||t===fbType):stage==='color'?t===state.nominated:(t===onType||t===fbType);
    let foul=false,reason='',value=Math.max(4,s.onValue);
    const involve=t=>{if(t&&t!=='cue'&&t!==fbType)value=Math.max(value,COLOR_INFO[t].score);};
    if(s.cueScratch){foul=true;reason='CUE BALL IN-OFF';}
    if(s.touching!=null&&s.firstId===s.touching){foul=true;reason=reason||'PUSH SHOT · TOUCHING BALL MOVED';involve(s.first);}
    if(!s.first){if(!s.touchingIsOn){foul=true;reason=reason||'NO BALL HIT';}}
    else if(!legal(s.first)){foul=true;reason=reason||'WRONG BALL FIRST';involve(s.first);}
    const unexpected=potted.filter(t=>t!=='cue'&&!mayPot(t));
    if(unexpected.length){foul=true;reason=reason||'WRONG BALL POTTED';unexpected.forEach(involve);}
    reactToShot(redsPotted+colorsPotted.length,foul);
    state.freeBall=false;
    if(foul){
      // Foul and a miss: the ball on was not hit and either there was a clear
      // full-ball line to it, or the escape attempt was not a good one. Never
      // called when the striker needed snookers before the shot.
      const missedOn=(!s.first&&!s.touchingIsOn)||(s.first&&!legal(s.first));
      const miss=state.mode!=='practice'&&missedOn&&!s.neededSnookers&&(s.clearLine||s.closest>.06);
      if(miss&&s.clearLine)state.misses[cur]++;else state.misses[cur]=0;
      // Reds stay down; colours go back on their spots; in-off = ball in hand.
      respotColours(colorsPotted);
      if(s.cueScratch)replaceCue();
      state.scores[opp]+=value;state.break=0;
      addHistory((miss?'FOUL AND A MISS':'FOUL')+' · '+reason+' · +'+value+' to '+(state.mode==='practice'?'foul points':'opponent'),true);
      message((miss?'FOUL AND A MISS · ':'FOUL · ')+value,reason,3200);
      sound('foul',.5);
      if(stage==='color')state.phase=redCount()>0?'red':'clearance';
      if(stage==='red'&&redCount()===0)state.phase='color';
      state.nominated=null;state.nominationManual=false;
      const calls=[(miss?'miss':'foul')+value];
      // Final black (or re-spotted black): a foul ends the frame.
      if(stage==='clearance'&&state.clearanceIndex>=5){say(calls,.45);refreshUI();endFrameOrRespot();finishShot();return;}
      if(state.misses[cur]>=3){say(calls,.45);refreshUI();finishFrame(opp,'THREE MISSES · FRAME FORFEITED');finishShot();return;}
      if(state.misses[cur]===2)calls.push('missWarning');
      if(state.mode==='practice'){
        state.freeBall=snookeredOnAll(ballsOnTypes());if(state.freeBall)calls.push('freeBall');
        say(calls,.45);finishShot();checkTouching();return;
      }
      state.current=opp;state.nominated=null;
      const free=snookeredOnAll(ballsOnTypes());if(free)calls.push('freeBall');
      say(calls,.45);
      offerDecision({offender:cur,chooser:opp,miss,freeBall:free,value,snapshot:s.snapshot});
      finishShot();return;
    }
    // ---- legal shot ----
    state.misses[cur]=0;
    let scored=0;
    if(stage==='red'){
      scored=redsPotted+(fbType&&potted.includes(fbType)?1:0);
      if(fbType&&potted.includes(fbType))resPot(fbType);
      if(scored){state.phase='color';addHistory(scored+(fbType&&potted.includes(fbType)?' (free ball)':'')+' · +'+scored+' POINT'+(scored>1?'S':''));
        message(fbType&&potted.includes(fbType)?'FREE BALL POTTED':'RED POTTED','+'+scored+' · NOMINATE A COLOUR');sound('score',.55);}
    }else if(stage==='color'){
      if(potted.includes(state.nominated)){scored=COLOR_INFO[state.nominated].score;addHistory(state.nominated.toUpperCase()+' · +'+scored+' POINTS');
        message(state.nominated.toUpperCase()+' POTTED','+'+scored+' POINTS · '+(redCount()?'BACK TO THE REDS':'COLOUR CLEARANCE'));sound('score',.7);}
      respotColours(colorsPotted);
      if(redCount()>0)state.phase='red';else{state.phase='clearance';state.clearanceIndex=0;}
    }else{
      const value=COLOR_INFO[onType].score;
      if(potted.includes(onType)){scored=value;state.clearanceIndex++;if(fbType&&potted.includes(fbType))resPot(fbType);}
      else if(fbType&&potted.includes(fbType)){scored=value;resPot(fbType);}
      if(scored){addHistory(onType.toUpperCase()+(potted.includes(onType)?'':' (free ball)')+' · +'+scored+' POINTS');message(onType.toUpperCase()+' POTTED','+'+scored+' POINTS');sound('score',.65);}
    }
    state.nominated=null;state.nominationManual=false;
    if(scored){
      state.scores[cur]+=scored;state.break+=scored;
      if(state.break>0&&state.break<=160)say(['n'+state.break],.55);
      if(stage==='clearance'&&(state.clearanceIndex>=6||state.respottedBlack)){refreshUI();endFrameOrRespot();finishShot();return;}
    }else{
      addHistory(stage==='clearance'?'No pot · '+onType+' remains':'No pot · turn complete');
      switchTurn();message('NO POT',stage==='clearance'?onType.toUpperCase()+' STILL ON':'NEXT PLAYER');
    }
    finishShot();checkTouching();
  }
  function finishShot(){state.shot=null;state.shotRest=0;refreshUI();revealHUD(3200);}

  // ---- REFEREE VOICE ---------------------------------------------------------
  // Pre-recorded calls (Kokoro neural voice) played through a light hall reverb.
  const voiceBuffers={},voiceQueue=[];let voicePlaying=false,voiceIn=null,voiceAn=null,voiceData=null;
  function refVoiceLevel(){        // 0..~0.3: how loud the referee is right now (his HD face moves its mouth with it)
    if(!voiceAn||!voicePlaying)return 0;voiceAn.getFloatTimeDomainData(voiceData);
    let s=0;for(let i=0;i<voiceData.length;i++)s+=voiceData[i]*voiceData[i];return Math.sqrt(s/voiceData.length);}
  const waitSec=s=>new Promise(r=>setTimeout(r,s*1000));
  function voiceInput(ctx){
    if(voiceIn)return voiceIn;
    const input=ctx.createGain(),dry=ctx.createGain(),wet=ctx.createGain(),conv=ctx.createConvolver();
    const len=Math.floor(ctx.sampleRate*1.2),ir=ctx.createBuffer(2,len,ctx.sampleRate);
    for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=i<ctx.sampleRate*.015?0:(Math.random()*2-1)*Math.pow(1-i/len,3.4);}
    conv.buffer=ir;dry.gain.value=1.05;wet.gain.value=.14;
    input.connect(dry);input.connect(conv);conv.connect(wet);dry.connect(audioBus);wet.connect(audioBus);
    voiceAn=ctx.createAnalyser();voiceAn.fftSize=512;voiceData=new Float32Array(voiceAn.fftSize);input.connect(voiceAn);
    return voiceIn=input;
  }
  async function voiceBuffer(ctx,key){
    if(voiceBuffers[key])return voiceBuffers[key];
    const b64=window.VELVET_VOICE&&window.VELVET_VOICE[key];if(!b64)return null;
    const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    return voiceBuffers[key]=await ctx.decodeAudioData(u.buffer);
  }
  function say(keys,delay=.4){
    if(window.__sayLog)window.__sayLog.push(...keys);
    if(!state.sound||!window.VELVET_VOICE)return;
    const ctx=ensureAudio();if(!ctx)return;
    voiceQueue.push({keys,delay});if(!voicePlaying)playVoice(ctx);
  }
  async function playVoice(ctx){
    voicePlaying=true;
    try{while(voiceQueue.length){const item=voiceQueue.shift();await waitSec(item.delay);
      for(const k of item.keys){const buf=await voiceBuffer(ctx,k).catch(()=>null);if(!buf||!state.sound)continue;
        const src=ctx.createBufferSource();src.buffer=buf;src.connect(voiceInput(ctx));src.start();
        await waitSec(buf.duration+.2);}}}
    finally{voicePlaying=false;}
  }

