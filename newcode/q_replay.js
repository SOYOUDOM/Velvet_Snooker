  // ---- REPLAYS, THE WALK-ON AND THE FRAME-BALL REPLAY -----------------------------
  // Every shot is recorded (all balls, the return rails, every impact). After a
  // remarkable shot (a fluke, a plant, a double, a long pot, two balls at once,
  // a multi-cushion escape, a wild in-off) the broadcast cuts to a slow-motion
  // replay: the player down on the shot from the side, a tracking shot of the
  // key ball, the pocket camera as it drops, then the player's reaction. The
  // frame-winning shot is replayed before the frame ends, and a match opens
  // with the players walking on to applause. Click or press any key to skip.
  const rec={cur:null,last:null,best:null,tail:0,ending:null};
  const cine={on:false,kind:'',t:0,dur:0,speed:1,data:null,label:'',onEnd:null,shooter:0,cam:null,camPos:new T.Vector3(),camLook:new T.Vector3(),cut:true,events:0,fx:{}};
  function recStart(){
    const cb=cueBall();if(!cb)return;
    rec.cur={ids:balls.map(b=>b.id),types:balls.map(b=>b.type),shooter:state.current,aim:state.aim,cfg:{...shotSettings()},cue0:[cb.x,cb.z],
      frames:[],events:[],t:0,step:0,frame:state.frame,snookered:snookeredOnAll(ballsOnTypes()),onTypes:ballsOnTypes()};
    recFrame();
  }
  function recFrame(){
    const r=rec.cur;if(!r)return;
    const f=new Float32Array(r.ids.length*8);
    balls.forEach((b,i)=>{const o=i*8;
      if(!b.pocketed){f[o]=b.x;f[o+1]=BALL_Y;f[o+2]=b.z;f[o+3]=b.q[0];f[o+4]=b.q[1];f[o+5]=b.q[2];f[o+6]=b.q[3];f[o+7]=1;return;}
      const fl=falling.find(x=>x.id===b.id);
      if(fl){f[o]=fl.x;f[o+1]=fl.y;f[o+2]=fl.z;const q=fl.qq;f[o+3]=q?q.x:0;f[o+4]=q?q.y:0;f[o+5]=q?q.z:0;f[o+6]=q?q.w:1;f[o+7]=1;}
    });
    r.frames.push({t:r.t,f});
  }
  function recEvent(e){const r=rec.cur;if(r&&r.frames.length<3000){e.t=r.t;r.events.push(e);}}
  function recPhysics(){const r=rec.cur;if(!r)return;r.t+=STEP;if(++r.step%2===0)recFrame();}
  // Called every frame: after the balls stop, keep filming the pocketed balls for a moment.
  function recTail(dt){
    const r=rec.cur;if(!r||state.inShot)return;
    r.t+=dt;recFrame();rec.tail-=dt;
    if(rec.tail<=0)recEnd();
  }
  // What made the shot remarkable.
  function drama(r){
    const pots=r.events.filter(e=>e.k==='pot'),firstHit=r.events.find(e=>e.k==='hit'&&(r.types[r.ids.indexOf(e.a)]==='cue'||r.types[r.ids.indexOf(e.b)]==='cue'));
    const typeOf=id=>r.types[r.ids.indexOf(id)];
    const cueId=r.ids[r.types.indexOf('cue')],firstObj=firstHit?(firstHit.a===cueId?firstHit.b:firstHit.a):null;
    let score=0,label='',key=null,keyPot=null;const tags=[];
    const objPots=pots.filter(p=>p.a!==cueId);
    for(const p of objPots){
      const before=r.events.filter(e=>e.t<=p.t&&(e.a===p.a||e.b===p.a));
      const cush=before.filter(e=>e.k==='cush').length,hits=before.filter(e=>e.k==='hit'&&e.a!==cueId&&e.b!==cueId).length;
      let s=1,tag='';
      if(p.a!==firstObj){s+=4;tag=hits?'PLANT':'FLUKE';}
      if(cush>=1){s+=3+cush;tag=cush>1?cush+'-CUSHION DOUBLE':'DOUBLE';}
      const i0=r.ids.indexOf(p.a);let travel=0;
      for(let k=1;k<r.frames.length&&r.frames[k].t<=p.t;k++){const a=r.frames[k-1].f,b=r.frames[k].f;travel+=Math.hypot(b[i0*8]-a[i0*8],b[i0*8+2]-a[i0*8+2]);}
      if(travel>2.1&&!tag){s+=2;tag='LONG POT';}
      if(s>(keyPot?keyPot.s:0)){keyPot={...p,s};key=p.a;label=tag;}
      score=Math.max(score,s);if(tag)tags.push(tag);
    }
    if(objPots.length>=2){score+=3;label=label||(objPots.length+' BALLS IN ONE SHOT');}
    if(r.snookered&&firstHit){const cush=r.events.filter(e=>e.k==='cush'&&e.a===cueId&&e.t<firstHit.t).length;
      if(cush>=2&&r.onTypes.includes(typeOf(firstObj))){const s=2+cush;if(s>score){score=s;label=cush+'-CUSHION ESCAPE';key=cueId;keyPot=null;}}}
    const inoff=pots.find(p=>p.a===cueId);
    if(inoff){const cush=r.events.filter(e=>e.k==='cush'&&e.a===cueId&&e.t<inoff.t).length;if(cush>=2&&score<4){score=4;label='IN-OFF';key=cueId;keyPot=inoff;}}
    return{score,label:label||(objPots.length?'POT':'SHOT'),key:key||(objPots[0]?objPots[0].a:cueId),keyPot:keyPot||objPots[0]||null};
  }
  function recEnd(){
    const r=rec.cur;rec.cur=null;if(!r||r.frames.length<4)return;
    r.d=drama(r);rec.last=r;
    if(!rec.best||rec.best.frame!==r.frame||r.d.score>=rec.best.d.score)rec.best=r.d.score>=4||!rec.best||rec.best.frame!==r.frame?r:rec.best;
    if(rec.ending){const e=rec.ending;rec.ending=null;
      if(r.events.some(x=>x.k==='pot'))return playReplay(r,e.label,e.done,'ending');
      return e.done();}
    if(r.d.score>=4&&state.started&&!state.finished&&!isAnyOverlayOpen())playReplay(r,r.d.label,null,'shot');
  }

  // ---- playback ----
  const replayUI=document.createElement('div');replayUI.id='replay-ui';
  replayUI.innerHTML='<div class="bar top"></div><div class="bar bottom"></div><div class="replay-tag"><i></i><span>REPLAY</span><b></b></div><div class="replay-title"></div><div class="replay-skip">CLICK OR PRESS ANY KEY TO SKIP</div>';
  document.body.appendChild(replayUI);
  function frameAt(r,t){
    const fr=r.frames;if(t<=fr[0].t)return[fr[0].f,fr[0].f,0];
    let lo=0,hi=fr.length-1;if(t>=fr[hi].t)return[fr[hi].f,fr[hi].f,0];
    while(hi-lo>1){const m=(lo+hi)>>1;if(fr[m].t<=t)lo=m;else hi=m;}
    return[fr[lo].f,fr[hi].f,(t-fr[lo].t)/((fr[hi].t-fr[lo].t)||1)];
  }
  const _rqa=new T.Quaternion(),_rqb=new T.Quaternion();
  // Ball meshes from the recording (called from syncBalls while a replay runs).
  function syncReplayBalls(){
    const r=cine.data,t=clamp(cine.t,0,1e9),[a,b,k]=frameAt(r,t);
    r.ids.forEach((id,i)=>{const e=ballMesh(id,r.types[i]),o=i*8,vis=(k<.5?a:b)[o+7]>.5;
      e.mesh.visible=vis;e.blob.visible=vis&&(k<.5?a:b)[o+1]>BALL_Y-.01;
      if(!vis)return;
      const x=lerp(a[o],b[o],k),y=lerp(a[o+1],b[o+1],k),z=lerp(a[o+2],b[o+2],k);
      e.mesh.position.set(x,y,z);_rqa.set(a[o+3],a[o+4],a[o+5],a[o+6]);_rqb.set(b[o+3],b[o+4],b[o+5],b[o+6]);e.mesh.quaternion.copy(_rqa).slerp(_rqb,k);
      e.blob.position.set(x,CLOTH_Y+.0008,z);});
    for(const m of fallingMeshes)m.visible=false;
  }
  function ballAt(r,id,t){const [a,b,k]=frameAt(r,t),o=r.ids.indexOf(id)*8;return new T.Vector3(lerp(a[o],b[o],k),lerp(a[o+1],b[o+1],k),lerp(a[o+2],b[o+2],k));}
  function playReplay(r,label,onEnd,kind){
    const d=r.d||drama(r),last=r.frames[r.frames.length-1].t;
    Object.assign(cine,{on:true,kind,data:r,label,onEnd,t:-1.25,dur:last,shooter:r.shooter,events:0,cut:true,react:d.score>=4||kind==='ending',keyId:d.key,keyPot:d.keyPot});
    // The replay is a cut-away: the players are posed for the recorded shot and
    // put back exactly as they were when it ends.
    if(!cine.snap)cine.snap=playersSnapshot();
    const sh=PL[r.shooter];
    for(const pl of PL){Object.assign(pl,{fade:Math.max(pl.fade,.99),fadeTo:1,path:null,v:0,feet:null,feetNow:null,t:0});
      if(pl===sh){const st=stanceFor(pl,r.aim,r.cue0[0],r.cue0[1],0);
        Object.assign(pl,{act:'down',stLin:1,stance:1,sitLin:0,aim:r.aim,cue:r.cue0,pull:0,goal:{kind:'shot'},
          x:(st.feet[0].x+st.feet[1].x)/2,z:(st.feet[0].z+st.feet[1].z)/2,yaw:Math.atan2(st.F.x,st.F.z)});pl.w.sit=0;pl.w.walk=0;}
      else{Object.assign(pl,{act:'sit',stLin:0,stance:0,sitLin:1,x:CHAIRS[pl.i][0],z:CHAIRS[pl.i][1],yaw:0,goal:chairGoal(pl.i)});pl.w.walk=0;}}
    replayUI.querySelector('.replay-tag b').textContent=label?'· '+label:'';
    replayUI.querySelector('.replay-title').textContent=kind==='ending'?label:'';
    document.body.classList.add('replay-on');
    if(kind==='ending')sound('gasp');
  }
  function endCine(){
    if(!cine.on)return;
    const cb=cine.onEnd;cine.on=false;cine.data=null;
    document.body.classList.remove('replay-on','intro-on','intro-late');
    playersRestore(cine.snap);cine.snap=null;
    ai.thinkUntil=Math.max(ai.thinkUntil,performance.now()+700);
    cam.shotKey='';
    if(cb)cb();
  }
  const skipCine=ev=>{if(cine.on&&cine.t>.15-1.25){ev.preventDefault?.();ev.stopPropagation?.();endCine();}};
  window.addEventListener('keydown',ev=>{if(cine.on)skipCine(ev);},{capture:true});
  window.addEventListener('pointerdown',ev=>{if(cine.on)skipCine(ev);},{capture:true});
  // Replay camera: side-on at the strike, tracking the key ball, the pocket
  // camera as it drops, then the player's reaction.
  function replayCamera(dt){
    const r=cine.data,t=cine.t,sh=PL[cine.shooter],aim=r.aim,F=new T.Vector3(Math.cos(aim),0,Math.sin(aim)),Rt=new T.Vector3(-F.z,0,F.x);
    const cue0=new T.Vector3(r.cue0[0],BALL_Y,r.cue0[1]);
    const pot=cine.keyPot,tPot=pot?pot.t:null,end=cine.dur;
    let pos,look,fov=38,phase;
    if(t<.22){phase='strike';
      const side=Math.abs(cue0.z+Rt.z*1.2)<OUT_Z+2.5?1:-1;
      pos=cue0.clone().addScaledVector(F,-.55).addScaledVector(Rt,1.25*side).add(_v4.set(0,.42,0));
      look=cue0.clone().addScaledVector(F,-.5).add(_v4.set(0,.16,0));fov=40;}
    else if(tPot!==null&&t>tPot-.55&&t<tPot+1.4){phase='pocket';
      const p=POCKETS[pot.p],from=ballAt(r,cine.keyId,tPot-.5),dir=new T.Vector3(p.x-from.x,0,p.z-from.z).normalize();
      pos=new T.Vector3(p.x,0,p.z).addScaledVector(dir,.42).add(_v4.set(0,CLOTH_Y+.2,0));
      look=new T.Vector3(p.x,CLOTH_Y,p.z).addScaledVector(dir,-.35);
      if(t>tPot+.15)look.y-=Math.min(.25,(t-tPot-.15)*.5);fov=44;}
    else if(t<=end+.2&&(!tPot||t<tPot)){phase='track';
      const id=t<.6&&tPot!==null?r.ids[r.types.indexOf('cue')]:cine.keyId,b=ballAt(r,id,t),b2=ballAt(r,id,t+.12);
      const v=b2.clone().sub(b);v.y=0;let dir=v.lengthSq()>1e-7?v.normalize():F.clone();
      cine.trackDir=cine.trackDir?cine.trackDir.lerp(dir,1-Math.exp(-dt*3)).normalize():dir;
      pos=b.clone().addScaledVector(cine.trackDir,-.95).addScaledVector(new T.Vector3(-cine.trackDir.z,0,cine.trackDir.x),.32).add(_v4.set(0,.42,0));
      look=b.clone().addScaledVector(cine.trackDir,.55);fov=42;}
    else{phase='react';
      const hp=new T.Vector3(sh.x,FLOOR_Y+1.45,sh.z),fwd=new T.Vector3(Math.sin(sh.yaw),0,Math.cos(sh.yaw));
      pos=hp.clone().addScaledVector(fwd,1.9).add(_v4.set(0,.05,0));look=hp.clone().add(_v4.set(0,-.12,0));fov=34;}
    if(phase!==cine.phase){cine.phase=phase;cine.cut=true;}
    if(cine.cut){cine.camPos.copy(pos);cine.camLook.copy(look);cine.cut=false;}
    else{const k=1-Math.exp(-dt*(phase==='track'?5:3));cine.camPos.lerp(pos,k);cine.camLook.lerp(look,k);}
    setCineCamera(cine.camPos,cine.camLook,fov);
  }
  function setCineCamera(pos,look,fov){
    eye=[pos.x,pos.y,pos.z];camera.position.copy(pos);camera.up.set(0,1,0);camera.lookAt(look);
    if(camera.view)camera.clearViewOffset();
    camera.aspect=width/height;if(Math.abs(camera.fov-fov)>.01||true){camera.fov=fov;camera.updateProjectionMatrix();}
    canopy.visible=pos.y<CANOPY_Y-.12;
  }
  // Recorded impacts are heard again at their moment.
  function replaySounds(prevT,t){
    const r=cine.data;
    for(const e of r.events){if(e.t<=prevT||e.t>t)continue;
      const p=ballAt(r,e.a,e.t);
      if(e.k==='hit')sound('click',e.v,p.x,p.z);else if(e.k==='cush'||e.k==='jaw')sound('cushion',e.v,p.x,p.z);else if(e.k==='pot')sound('pocket',e.v,p.x,p.z);}
  }
  function cueReplayPull(t){
    // feathering, the final backswing, the strike and the follow-through
    if(t<-.55)return .035+.025*Math.sin((t+1.25)*9);
    if(t<-.12)return .035+(.13-.035)*clamp((t+.55)/.3,0,1);
    if(t<0)return .13*(1-((t+.12)/.12)**2)-.0;
    return -Math.min(.16,t*1.6);
  }
  function updateCine(dt){
    if(!cine.on)return false;
    if(cine.kind==='intro')return updateIntro(dt);
    const r=cine.data,tPot=cine.keyPot?cine.keyPot.t:null;
    const slow=cine.t<0?.85:tPot!==null&&Math.abs(cine.t-tPot)<.5?.28:.5;
    const prev=cine.t;cine.t+=dt*slow;
    if(prev>=0||cine.t>=0)replaySounds(Math.max(prev,-1),cine.t);
    const sh=PL[cine.shooter];
    if(sh){sh.pull=cueReplayPull(cine.t);
      if(cine.t>.5&&sh.goal.kind==='shot')sh.goal={kind:'hold'};      // stands up and watches it go
      const reactAt=cine.dur+.15;
      if(cine.t>reactAt&&cine.react&&sh.act!=='cheer'&&sh.stLin<=0){sh.act='cheer';sh.t=0;sh.acts.cheer.time=1.2;
        if(cine.kind==='ending')sound('frame');else sound('cheer');}}
    replayCamera(dt);
    if(cine.t>cine.dur+(cine.react?2.6:1.0))endCine();
    return true;
  }
  // The cue drawn in replays (the live cue code draws the cue for play).
  function replayCue(){
    const r=cine.data,sh=PL[cine.shooter];if(!r||cine.t>.55){cueGroup.visible=false;return;}
    const aim=r.aim,pull=sh?sh.pull:0,dx=Math.cos(aim),dz=Math.sin(aim),elev=.07,tip=R+.009+pull;
    cueGroup.visible=true;cueGroup.position.set(r.cue0[0]-dx*tip,BALL_Y,r.cue0[1]-dz*tip);
    const dir=new T.Vector3(-dx*Math.cos(elev),Math.sin(elev),-dz*Math.cos(elev));cueGroup.quaternion.setFromUnitVectors(UPV,dir);
  }

  // ---- the walk-on before a match ----
  // ---- THE WALK-ON ----
  // As on the tour: the MC welcomes the arena; each player is announced in
  // turn and walks out from the entrance (the camera on his shoes, rising to
  // his face as he comes), stops at the table to acknowledge the crowd, then
  // goes to his chair; the referee is introduced; quiet please, and play.
  const WALK_GAP=10.5;
  function introEntrance(){const v=VENUES[venueId];return v.entrance?v.entrance.slice():venueId==='stage'?[0,-(VENUES.stage.bowl.r0+1.6)]:[-OUT_X-1.6,-(OUT_Z+2.2)];}
  function startIntro(){
    if(window.__T&&window.__T.noIntro)return;   // instrumented test builds only
    if(!PL.length||!state.started)return;
    const e=introEntrance(),solo=state.mode==='practice';
    // the star walks last: in a match against a pro, you are announced first
    const order=solo?[0]:[0,1];
    PL.forEach((pl,i)=>{const hid=solo&&i===1;
      Object.assign(pl,{fade:0,fadeTo:0,act:'idle',t:0,v:0,sitLin:0,stLin:0,stance:0,feet:null,feetNow:null,stopping:false,
        x:e[0]+(i?.5:-.5),z:e[1],yaw:Math.atan2(-e[0],-e[1]),pi:0,path:null,goal:{kind:'hold',fixed:true},hid,step:0});
      pl.head=pl.yaw;pl.w.sit=0;});
    const names=[introName(0),solo?'':introName(1)];
    Object.assign(cine,{on:true,kind:'intro',t:0,dur:6+order.length*WALK_GAP+7.5,label:'',order,names,said:{},cut:true,phase:'',
      onEnd:()=>{for(let i=comm.queue.length-1;i>=0;i--)if(comm.queue[i].mc)comm.queue.splice(i,1);
        for(const pl of PL)Object.assign(pl,{act:'sit',t:0,sitLin:1,stLin:0,stance:0,v:0,path:null,x:CHAIRS[pl.i][0],z:CHAIRS[pl.i][1],yaw:0,goal:chairGoal(pl.i),fade:pl.hid?0:1,fadeTo:pl.hid?0:1});}});
    replayUI.querySelector('.replay-tag b').textContent='';
    replayUI.querySelector('.replay-title').innerHTML=VENUES[venueId].event+'<small>'+names.filter(Boolean).join('  ·  vs  ·  ')+'</small>';
    document.body.classList.add('intro-on');
    crowdReact('polite');if(!(VENUES[venueId].mc&&commMC(VENUES[venueId].mc,.8)))commMC('mc_welcome',.8);
  }
  const _ia=new T.Vector3(),_ib=new T.Vector3();
  function introPlayer(i,u,dt){   // player i, u seconds after his name is called
    const pl=PL[i];if(!pl||pl.hid)return;
    const table=[-(OUT_X+.55)*.0+(i?.55:-.55),-(OUT_Z+.55)];       // where he stops to greet the crowd
    if(pl.step===0&&u>=1.2){pl.step=1;pl.fadeTo=1;pl.fade=1;startWalk(pl,{kind:'watch',x:table[0],z:table[1],yaw:Math.PI,fixed:true});
      pl.goal={kind:'watch',x:table[0],z:table[1],yaw:Math.PI,fixed:true};sound('applause',.75);crowdReact('cheer');}
    else if(pl.step===1&&pl.act==='idle'&&Math.hypot(pl.x-table[0],pl.z-table[1])<.3){pl.step=2;setAct(pl,'cheer');}
    else if(pl.step===2&&pl.act!=='cheer'){pl.step=3;pl.goal={...chairGoal(i),fixed:true};}
  }
  function updateIntro(dt){
    cine.t+=dt;const t=cine.t,order=cine.order;
    // the announcements
    order.forEach((i,n)=>{const t0=6+n*WALK_GAP,k='walk'+i;if(t>=t0-.2&&!cine.said[k]){cine.said[k]=1;
      let key=state.mode==='bot'&&i===1?'mc_'+botOpponent.id:['mc_generic3','mc_generic1','mc_generic2'][(n+(i?1:0))%3];
      if(COMM&&COMM.mc&&COMM.mc[key+'_short']&&typeof openingMode==='function'&&openingMode()==='short')key+='_short';   // the short announcement
      commMC(key,0);}
      introPlayer(i,t-t0,dt);});
    const tRef=6+order.length*WALK_GAP;
    if(t>=tRef&&!cine.said.ref){cine.said.ref=1;commMC('mc_referee',0);sound('applause',.45);
      const p=ref.person&&ref.person.obj;if(p)ref.queue=[{s:loopNearest(0,-(OUT_Z+.2)),x:0,z:-(OUT_Z+.2)}];}
    if(t>=tRef+4&&!cine.said.quiet){cine.said.quiet=1;commMC('mc_quiet',0);}
    // the pictures
    let pos,look,fov=38,phase;
    const walker=order.map((i,n)=>[i,t-(6+n*WALK_GAP)]).filter(([i,u])=>u>=1&&u<WALK_GAP+1).pop();
    const wv=VENUES[venueId].walls,rmax=Math.min(-wv[0],wv[1],wv[2])-1.3;
    if(t<7){phase='arena';const a=-2.4+t*.05,r=Math.min(rmax,9.5-t*.45);pos=_ia.set(Math.cos(a)*r,FLOOR_Y+4.2-t*.25,Math.sin(a)*r*.8);look=_ib.set(0,-.2,0);fov=42;}
    else if(walker){
      const [i,u]=walker,pl=PL[i],fx=Math.sin(pl.yaw),fz=Math.cos(pl.yaw),sx=Math.cos(pl.yaw),sz=-Math.sin(pl.yaw);
      if(u<4.2){phase='walk'+i;const k=clamp((u-1.6)/2.6,0,1),e=k*k*(3-2*k);   // shoes first, rising to the face
        pos=_ia.set(pl.x+fx*(1.5+.4*e)+sx*(.55+.25*e),FLOOR_Y+.28+1.25*e,pl.z+fz*(1.5+.4*e)+sz*(.55+.25*e));
        look=_ib.set(pl.x+fx*.3,FLOOR_Y+.18+1.3*e,pl.z+fz*.3);fov=34;}
      else if(u<7.6){phase='greet'+i;pos=_ia.set(pl.x+2.6,FLOOR_Y+1.9,pl.z+3.3);look=_ib.set(pl.x*.6,FLOOR_Y+1.0,pl.z*.6);fov=40;}
      else{phase='chair'+i;pos=_ia.set(CHAIRS[i][0]+1.4,FLOOR_Y+1.35,CHAIRS[i][1]+2.3);look=_ib.set(CHAIRS[i][0],FLOOR_Y+.9,CHAIRS[i][1]);fov=36;}
    }
    else if(t<tRef+4){phase='referee';const p=ref.person&&ref.person.obj,x=p?p.position.x:0,z=p?p.position.z:0;
      pos=_ia.set(x+1.2,FLOOR_Y+1.55,z+2.2);look=_ib.set(x,FLOOR_Y+1.25,z);fov=32;}
    else{phase='high';const k=clamp((t-tRef-4)/3.5,0,1);pos=_ia.set(-1.6-2.6*k,FLOOR_Y+3.4+.8*k,3.2+.4*k);look=_ib.set(0,-.25,0);fov=40;}
    if(phase!==cine.phase){cine.phase=phase;cine.cut=true;
      // broadcast graphics: the event title over the arena, then a name strap for each walk-on
      document.body.classList.toggle('intro-late',phase!=='arena');
      let strap=replayUI.querySelector('.intro-strap');if(!strap){strap=document.createElement('div');strap.className='intro-strap';strap.innerHTML='<b></b><span></span>';replayUI.appendChild(strap);}
      const m=/^(walk|greet)(\d)$/.exec(phase);strap.classList.toggle('on',!!m);
      if(m){const i=+m[2],key=state.mode==='bot'&&i===1?'mc_'+botOpponent.id:'';const said=key&&COMM&&COMM.mc&&COMM.mc[key]?COMM.mc[key][0].split('...'):[];
        const land=state.mode==='bot'&&i===1&&botOpponent.country||'';   // under the name: the nickname, or the country he represents
        strap.querySelector('b').textContent=(cine.names[i]||'').toUpperCase();strap.querySelector('span').textContent=(said.length>2?said[1].trim():land||(i?'THE OPPONENT':'THE CHALLENGER')).toUpperCase();}}
    if(cine.cut){cine.camPos.copy(pos);cine.camLook.copy(look);cine.cut=false;}
    else{const k=1-Math.exp(-dt*(phase.startsWith('walk')?6:2.5));cine.camPos.lerp(pos,k);cine.camLook.lerp(look,k);}
    setCineCamera(cine.camPos,cine.camLook,fov);
    if(t>cine.dur)endCine();
    return true;
  }
  // Watch the best shot of the frame again (Y / REPLAY button).
  function replayBest(){
    if(cine.on||state.inShot||isAnyOverlayOpen())return;
    const r=rec.best&&rec.best.frame===state.frame?rec.best:rec.last;
    if(!r){message('NO REPLAY YET','PLAY A SHOT FIRST',1400);return;}
    playReplay(r,r.d.label,null,'shot');
  }
