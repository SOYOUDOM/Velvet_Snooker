  // ---- THE OPENING: a real-time title sequence before the menu ------------
  // First launch: about 45 s — the arena comes out of the dark, the camera
  // runs along the table (cloth, rails, cushions, leather, nets, the rod
  // catchers, the balls, the legs), the referee at the table, a player's walk
  // to the table, a break-off played with the real physics on a copy of the
  // rack (then put back exactly), and up over the arena into the menu.
  // Returning: a 5 s version. Skippable (any key, click or tap); settings can
  // turn it off. Runs on the game's own frame loop via the cinematic system.
  const OPEN_KEY='velvet.opening';
  const opening={rack:null,cueT:-1,shot:false,ui:null,strike:null};
  function openingMode(){let m='full';try{m=localStorage.getItem(OPEN_KEY+'.mode')||(localStorage.getItem(OPEN_KEY+'.seen')?'short':'full');}catch(e){}
    return['full','short','off'].includes(m)?m:'full';}
  function openingUI(){
    if(opening.ui)return opening.ui;
    const el=document.createElement('div');el.id='opening-ui';
    el.innerHTML='<div class="op-black"></div><div class="op-title"><small></small><h2></h2></div><button class="op-skip" type="button">SKIP INTRO <span>ESC</span></button>';
    document.body.appendChild(el);el.querySelector('.op-skip').addEventListener('click',ev=>{ev.stopPropagation();if(cine.on&&cine.kind==='opening')endCine();});
    return opening.ui=el;
  }
  function openingTitle(small,big){const ui=openingUI(),t=ui.querySelector('.op-title');
    if(!big){t.classList.remove('on');return;}t.querySelector('small').textContent=small||'';t.querySelector('h2').textContent=big;t.classList.add('on');}
  function startOpening(force){
    if(window.__T&&!force)return false;          // instrumented test builds: only when asked for
    const mode=force||openingMode();if(mode==='off'||cine.on)return false;
    try{localStorage.setItem(OPEN_KEY+'.seen','1');}catch(e){}
    const ui=openingUI();ui.classList.add('on');ui.querySelector('.op-black').style.opacity='1';
    activeOverlay('welcome-screen',false);document.body.classList.add('opening-on');
    opening.rack=balls.map(b=>({id:b.id,x:b.x,z:b.z,pocketed:b.pocketed,q:b.q?b.q.slice():null}));opening.shot=false;opening.cueT=-1;
    const short=mode==='short';
    Object.assign(cine,{on:true,kind:'opening',t:0,dur:short?5.5:45,short,phase:'',cut:true,label:'',
      onEnd:()=>{openingRestore();openingTitle();
        for(const pl of PL)Object.assign(pl,{act:'sit',t:0,sitLin:1,stLin:0,stance:0,v:0,path:null,x:CHAIRS[pl.i][0],z:CHAIRS[pl.i][1],yaw:0,goal:chairGoal(pl.i),fade:1,fadeTo:1});const u=openingUI();u.classList.remove('on');document.body.classList.remove('opening-on');
        for(let i=comm.queue.length-1;i>=0;i--)if(comm.queue[i].mc)comm.queue.splice(i,1);
        activeOverlay('welcome-screen',true);}});
    return true;
  }
  function openingRestore(){
    if(!opening.rack)return;
    for(const s of opening.rack){const b=balls.find(x=>x.id===s.id);if(!b)continue;Object.assign(b,{x:s.x,z:s.z,pocketed:s.pocketed,vx:0,vz:0,wx:0,wy:0,wz:0});if(s.q)b.q=s.q.slice();}
    falling.length=0;opening.rack=null;cueGroup.visible=false;
  }
  // camera keys: [time, eye xyz, look xyz, fov]
  const OPEN_KEYS=[
    [0,[-9,6.2,7.5],[0,-.3,0],46],[5.5,[-4.2,2.6,3.2],[0,-.2,0],40],                                        // out of the dark onto the table
    [6,[-1.2,.22,.98],[1.4,.02,.92],30],[9.5,[1.25,.2,.98],[1.79,.02,.9],30],                                 // along the cushion to the corner
    [10,[2.15,.55,1.25],[1.79,.03,.9],30],[12,[2.3,-.05,1.35],[1.84,-.16,.95],34],                            // leather, then down to the net and catcher
    [12.5,[.55,.12,.38],[1.35,.04,.02],24],[15,[.92,.1,-.3],[1.38,.04,0],24],                                 // the reds and the black
    [15.5,[-1.4,-.35,-1.6],[-1.62,-.55,-1.0],32],[17,[-1.1,-.6,-1.55],[-1.62,-.55,-1.0],32],                  // a gold leg
    [17.5,null,null,34],[24.5,null,null,36],                                                                  // the referee, then the walk to the table (live)
    [25,[-2.75,.18,.32],[-1.1,.02,0],26],[29.5,[-2.6,.24,.26],[-.6,.02,0],30],                                // low behind the cue ball for the break
    [30,[1.0,1.4,2.2],[.9,0,0],40],[34,[.3,2.6,1.6],[.6,0,0],44],                                            // the balls scatter
    [34.5,[0,4.4,.01],[0,0,0],42],[40,[-7.5,6.4,6.5],[0,-.4,0],48],[45,[-8.6,5.4,7.6],[0,-.3,0],46]];        // up over the arena, into the menu
  const _oa=new T.Vector3(),_ob=new T.Vector3();
  function openingCam(t){
    let i=0;while(i<OPEN_KEYS.length-1&&OPEN_KEYS[i+1][0]<=t)i++;
    const a=OPEN_KEYS[i],b=OPEN_KEYS[Math.min(i+1,OPEN_KEYS.length-1)];
    if(!a[1])return null;
    const span=b[0]-a[0],u=b[1]&&span>.6?ease((t-a[0])/span):0;      // keys under .6 s apart are a cut
    return{pos:new T.Vector3().fromArray(a[1]).lerp(_ob.fromArray(b[1]||a[1]),u),look:new T.Vector3().fromArray(a[2]).lerp(_ob.fromArray(b[2]||a[2]),u),fov:lerp(a[3],b[3],u)};
  }
  function openingBreak(dt){
    // a break-off from the D on the copy of the rack: the same physics, sounds and nets as a real shot
    const cb=cueBall();if(!cb)return;
    if(!opening.shot){
      const red=balls.filter(b=>b.type==='red'&&!b.pocketed).sort((p,q)=>q.x-p.x)[14]||balls.find(b=>b.type==='red');
      cb.x=BAULK_X-.004;cb.z=D*.5;const aim=Math.atan2(red.z+R*1.7-cb.z,red.x-R*1.2-cb.x);
      opening.strike={aim,cfg:{power:68,spinX:-.15,spinY:.2}};opening.shot=true;opening.cueT=0;return;}
    if(opening.cueT>=0){
      // the cue: two feathers, the backswing and through
      opening.cueT+=dt;const k=opening.cueT,a=opening.strike.aim;
      const pull=k<1.6?.03+.025*Math.sin(k*TAU/.8):k<2.1?lerp(.03,.15,ease((k-1.6)/.5)):k<2.25?.15:k<2.35?.15*(1-((k-2.25)/.1)**2):-.08;
      const dx=Math.cos(a),dz=Math.sin(a),tip=R+.009+pull;cueGroup.visible=k<3.2;
      cueGroup.position.set(cb.x-dx*tip,BALL_Y+.004,cb.z-dz*tip);cueGroup.quaternion.setFromUnitVectors(UP,new T.Vector3(-dx*Math.cos(.07),Math.sin(.07),-dz*Math.cos(.07)));
      if(k>=2.35&&!opening.struck){opening.struck=true;const st=cueStrikeState(cb,a,opening.strike.cfg);
        Object.assign(cb,{vx:st.vx,vz:st.vz,wx:st.wx,wz:st.wz,wy:st.wy});sound('shot',st.velocity,cb.x,cb.z);}
    }
    if(opening.struck){const n=Math.min(12,Math.ceil(dt/STEP));for(let i=0;i<n;i++)physicsStep(STEP);}
  }
  function updateOpening(dt){
    cine.t+=dt;const t=cine.t,ui=openingUI(),black=ui.querySelector('.op-black');
    if(cine.short){
      black.style.opacity=String(clamp(1-t/1.2,0,1)*(t<4.2?1:0)+clamp((t-4.6)/.9,0,1)*0);
      const k=ease(clamp(t/5.5,0,1));setCineCamera(_oa.set(lerp(-5.5,-8.6,k),lerp(3.2,5.4,k),lerp(4.2,7.6,k)),_ob.set(0,-.3,0),lerp(40,46,k));
      if(t>.6&&t<4.4)openingTitle(...(VENUES[venueId].title||['THE SNOOKER ROOM','VELVET']));else openingTitle();
      if(t>cine.dur)endCine();return true;
    }
    black.style.opacity=String(clamp(1-t/3.5,0,1));
    // titles
    openingTitle(...(t>1.2&&t<5.4?['','EVERY FRAME IS A BATTLE OF PRECISION']:t>35.5&&t<41?(VENUES[venueId].title||['THE SNOOKER ROOM','VELVET']):[null,null]));
    if(t>.5&&!cine.said){cine.said=1;crowdReact('polite');}
    // the referee and the walk-on are filmed live
    let shot=openingCam(t),phase;
    if(t>=17.5&&t<20.5){phase='ref';const p=ref.person&&ref.person.obj,x=p?p.position.x:0,z=p?p.position.z:0;
      if(!cine.refSent){cine.refSent=1;ref.queue=[{s:loopNearest(1.2,-(OUT_Z+.2)),x:1.2,z:-(OUT_Z+.2)}];}
      shot={pos:new T.Vector3(x+1.1,FLOOR_Y+1.45,z+2.0),look:new T.Vector3(x,FLOOR_Y+1.2,z),fov:30};}
    else if(t>=20.5&&t<25){phase='walk';const pl=PL[0];
      if(pl&&!cine.walkSent){cine.walkSent=1;const e=introEntrance();Object.assign(pl,{fade:1,fadeTo:1,act:'idle',x:e[0],z:e[1],yaw:Math.atan2(-e[0],-e[1]),v:0,sitLin:0,stLin:0,stance:0,step:0,hid:false});
        pl.w.sit=0;startWalk(pl,{kind:'watch',x:-.55,z:-(OUT_Z+.55),yaw:PI,fixed:true});pl.goal={kind:'watch',x:-.55,z:-(OUT_Z+.55),yaw:PI,fixed:true};sound('applause',.6);}
      if(pl){const u=t-20.5,k=ease(clamp((u-.6)/3,0,1)),fx=Math.sin(pl.yaw),fz=Math.cos(pl.yaw),sx=Math.cos(pl.yaw),sz=-Math.sin(pl.yaw);
        shot={pos:new T.Vector3(pl.x+fx*(1.5+.4*k)+sx*(.55+.25*k),FLOOR_Y+.28+1.25*k,pl.z+fz*(1.5+.4*k)+sz*(.55+.25*k)),look:new T.Vector3(pl.x+fx*.3,FLOOR_Y+.18+1.3*k,pl.z+fz*.3),fov:34};}}
    else if(t>=25&&t<34)phase='break';
    else phase='keys';
    if(t>=25&&t<38)openingBreak(dt);
    if(!shot)shot={pos:cine.camPos.clone(),look:cine.camLook.clone(),fov:38};
    const key=phase+(phase==='keys'?OPEN_KEYS.findIndex(k=>k[0]>t):'');
    if(key!==cine.phase){cine.phase=key;cine.cut=true;}
    if(cine.cut){cine.camPos.copy(shot.pos);cine.camLook.copy(shot.look);cine.cut=false;}
    else{const k=1-Math.exp(-dt*(phase==='keys'||phase==='break'?12:5));cine.camPos.lerp(shot.pos,k);cine.camLook.lerp(shot.look,k);}
    setCineCamera(cine.camPos,cine.camLook,shot.fov);
    if(t>cine.dur)endCine();
    return true;
  }
