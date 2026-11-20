  // ---- CAMERA ---------------------------------------------------------------
  // One controller drives the picture. Four views, from the buttons, C (next
  // view) and P (back to aiming):
  //   AIM   behind the cue ball along your aim: the view to play from. It frames
  //         the whole shot and holds that framing while you turn, so it never
  //         pumps in and out; wheel or pinch for closer or wider, a right drag
  //         (two fingers on a phone) raises it or swings it round a little. It
  //         never turns away from your aim by itself.
  //   TOP   the whole table from above, fitted to the screen (turned upright on
  //         a tall screen); wheel zooms to the pointer, a right drag pans.
  //   TV    the broadcast angles (◀ ▶ to change).
  //   FREE  orbit any point: drag to turn, right drag to pan, wheel to zoom;
  //         focus on the cue ball, a ball (double-click it) or any spot.
  // Over the view, the shot follow (AUTO CAM): when a shot needs it, the camera
  // makes one move to a broadcast angle while the balls run and comes back to
  // your view when they have stopped. Every motion is eased by the frame time,
  // so it feels the same at any frame rate; a change of view is one smooth move
  // along an arc, turning by quaternions; the camera keeps out of the table, the
  // floor and the stands, and anyone standing between it and the play fades.
  let autoCamera=true,railFadeEnabled=true,focusPicking=false;
  const CAM_DEFAULTS={rot:1,zoom:1,pan:1,smooth:.55,trans:.75,zoomMin:.45,zoomMax:2.6,elMin:.09,elMax:1.55,invertY:false,autoTv:true,aimHold:false};
  const camSet=Object.assign({},CAM_DEFAULTS);
  try{const s=JSON.parse(localStorage.getItem('velvet.camera')||'null');
    if(s&&typeof s==='object')for(const k in CAM_DEFAULTS)if(typeof s[k]===typeof CAM_DEFAULTS[k])camSet[k]=s[k];}catch(e){}
  function saveCamSet(){try{localStorage.setItem('velvet.camera',JSON.stringify(camSet));}catch(e){}}
  const cam={az:-PI/2,el:.5,radius:5.0,mode:0,fov:30,follow:true,zoom:1,curZoom:1,
    curAz:-PI/2,curEl:.5,curRadius:5.0,curFov:30,target:[0,-.10,0],curTarget:[0,-.10,0],focusName:'TABLE CENTRE',shotKey:'',runSide:-1,
    view:'aim',tvPreset:1,user:{zoom:1,el:0,side:0},topZoom:1,topPan:[0,0],tvZoom:1,tvt:[0,0],
    blend:null,snap:true,key:'',sf:null,baseFov:30,tvWas:false};
  const presets=[
    {name:'AIMING CAMERA',n:'01',follow:true,el:.36,radius:1.55,fov:44},
    {az:-PI/2,el:.62,radius:4.5,name:'TV MAIN',n:'02'},
    {az:0,el:1.558,radius:4.75,name:'OVERHEAD',n:'03'},
    {az:PI/2,el:.62,radius:4.5,name:'TV REVERSE',n:'04'},
    {az:1.35,el:.62,radius:5.0,name:'SIDE VIEW',n:'05'},
    {az:.42,el:.86,radius:5.15,name:'THREE-QUARTER',n:'06'},
    {az:-.48,el:1.30,radius:4.6,name:'HIGH ANGLE',n:'07'}
  ];
  const OVERHEAD_PRESET=2,PLAYER_PRESET=0,VIEWS=['aim','top','tv','free'];
  const VIEW_LABEL={aim:['AIMING CAMERA','01'],top:['OVERHEAD','03'],free:['FREE CAMERA','◎']};
  const distFor=(r,fov)=>r*Math.tan(21*PI/180)/Math.tan(fov/2*PI/180);
  const setTarget=(x,y,z)=>{const t=cam.target;t[0]=x;t[1]=y;t[2]=z;};
  const viewOfPreset=i=>i<0?'free':i===PLAYER_PRESET?'aim':i===OVERHEAD_PRESET?'top':'tv';
  let labelNow='',uiNow='';
  function cameraLabel(name,n){const h='<div class="camera-cross">⌗</div><span>'+name+' <b>'+n+'</b></span>';if(h!==labelNow){labelNow=h;$('camera-tag').innerHTML=h;}}
  function labelView(){
    if(cam.view==='tv'){const p=presets[cam.tvPreset];cameraLabel(p.name,p.n);}
    else if(cam.view==='free'&&cam.focusName&&cam.focusName!=='TABLE CENTRE')cameraLabel('FOCUS · '+cam.focusName,'◉');
    else{const l=VIEW_LABEL[cam.view];cameraLabel(l[0],l[1]);}
    const ui=cam.view+'|'+JSON.stringify(camSet)+'|'+!!($('cam-panel')&&!$('cam-panel').hidden);
    if(ui!==uiNow){uiNow=ui;paintCamUI();}
  }
  function paintCamUI(){
    document.querySelector('.camera-switcher')?.classList.toggle('tv-on',cam.view==='tv');
    document.querySelectorAll('[data-camview]').forEach(b=>{const on=b.dataset.camview===cam.view;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
    const a=$('auto-camera-button');if(a){a.classList.toggle('active',camSet.autoTv);a.setAttribute('aria-pressed',String(camSet.autoTv));}
    const tg=(id,on,txt)=>{const b=$(id);if(!b)return;b.classList.toggle('active',!!on);b.setAttribute('aria-pressed',String(!!on));if(txt)b.textContent=txt;};
    tg('cam-autotv',camSet.autoTv,'AUTO CAM ON SHOTS · '+(camSet.autoTv?'ON':'OFF'));
    tg('cam-invert',camSet.invertY,'INVERT VERTICAL · '+(camSet.invertY?'ON':'OFF'));
    tg('cam-aimhold',camSet.aimHold,'AIM · '+(camSet.aimHold?'HOLD THE BUTTON':'MOVE THE MOUSE'));
    for(const k of ['rot','zoom','pan','smooth','trans']){const e=$('cam-'+k);if(e&&document.activeElement!==e)e.value=String(camSet[k]);
      const o=$('cam-'+k+'-v');if(o)o.textContent=k==='trans'?camSet[k].toFixed(2)+' s':k==='smooth'?Math.round(camSet[k]*100)+'%':camSet[k].toFixed(2)+'×';}
  }
  // ---- changing view ----
  // A smooth move: from where the camera is now to where the new view wants it,
  // eased in and out, along an arc that lifts over the table, turning by slerp.
  const _bq0=new T.Quaternion(),_bq1=new T.Quaternion(),_bp1=new T.Vector3(),_bm=new T.Matrix4(),_bv=new T.Vector3(),_bt=new T.Vector3(),_bup=new T.Vector3(0,1,0);
  function startBlend(){
    if(!camera||!camera.position)return;
    if(cam.blend){cam.blend.p0.copy(camera.position);cam.blend.q0.copy(camera.quaternion);cam.blend.f0=cam.baseFov;cam.blend.t=0;}
    else cam.blend={t:0,p0:camera.position.clone(),q0:camera.quaternion.clone(),f0:cam.baseFov};
    cam.blend.dur=Math.max(.05,camSet.trans);cam.snap=true;
  }
  // how: undefined = a smooth move; 'cut' = at once; 'keep' = stay where the camera is (to take it by hand)
  function goView(v,how){
    if(!VIEWS.includes(v))v='aim';
    const was=cam.view;cam.view=v;cam.follow=v==='aim';autoCamera=v==='aim';
    cam.mode=v==='aim'?PLAYER_PRESET:v==='top'?OVERHEAD_PRESET:v==='tv'?cam.tvPreset:-1;
    if(v==='free'&&(was!=='free'||how==='keep'))adoptCurrentPose();
    if(v==='top'&&was!=='top'){cam.topZoom=1;cam.topPan=[0,0];}
    if(cam.sf)cam.sf.user=true;                       // a view you choose now replaces the shot follow
    if(how==='cut'){cam.blend=null;cam.snap=true;}
    else if(how!=='keep'&&(was!==v||v==='tv'))startBlend();
    if(v!=='free'){cam.focusName=v==='aim'?'AUTO FOLLOW':'TABLE CENTRE';const fc=$('focus-current');if(fc)fc.textContent=cam.focusName;}
    labelView();
  }
  function setCamera(i,how){
    const n=presets.length;i=((Math.round(i)%n)+n)%n;
    const v=viewOfPreset(i);if(v==='tv'){cam.tvPreset=i;cam.tvZoom=1;}
    goView(v,how);
  }
  function cycleView(d=1){const i=VIEWS.indexOf(cam.view);goView(VIEWS[(i+d+VIEWS.length*4)%VIEWS.length]);}
  // ◀ ▶ step through the broadcast angles (from another view: to the last one used)
  function tvAngle(d){
    const tvs=presets.map((p,i)=>i).filter(i=>viewOfPreset(i)==='tv');let k=Math.max(0,tvs.indexOf(cam.tvPreset));
    if(cam.view==='tv')k=(k+d+tvs.length)%tvs.length;
    setCamera(tvs[k]);
  }
  // the director (AUTO) or your own camera (FREE), as before
  function setAutoCamera(on){goView(on?'aim':'free',on?undefined:'keep');}
  function toggleAutoTv(){
    camSet.autoTv=!camSet.autoTv;saveCamSet();paintCamUI();
    message('AUTO CAM · '+(camSet.autoTv?'ON':'OFF'),camSet.autoTv?'THE CAMERA FOLLOWS EACH SHOT, THEN COMES BACK':'THE CAMERA STAYS ON YOUR VIEW DURING SHOTS',1700);
  }
  function resetCamera(){
    const v=cam.view;
    if(v==='aim')cam.user={zoom:1,el:0,side:0};
    else if(v==='top'){cam.topZoom=1;cam.topPan=[0,0];}
    else if(v==='tv'){cam.tvZoom=1;cam.tvt=[0,0];}
    else{Object.assign(cam,{az:-PI/2,el:.62,radius:4.5,fov:30,zoom:1});cam.target=[0,-.06,0];cam.focusName='TABLE CENTRE';const fc=$('focus-current');if(fc)fc.textContent='TABLE CENTRE';}
    startBlend();labelView();
  }
  function focusOn(x,z,label='CUSTOM POINT',y=-.06){
    if(cam.view!=='free')goView('free','keep');
    cam.target=[clamp(x,-HX-.48,HX+.48),y,clamp(z,-HZ-.55,HZ+.55)];
    cam.focusName=label;focusPicking=false;
    $('focus-pick').classList.remove('active');$('focus-current').textContent=label;
    labelView();
  }
  // Take the camera by hand from wherever it is: its spot and the point it looks at become the orbit.
  function adoptCurrentPose(){
    const p=camera.position;camera.getWorldDirection(_bv);
    let d=3.2;if(_bv.y<-.04){const t=(CLOTH_Y-p.y)/_bv.y;if(t>.35&&t<14)d=t;}
    const tx=p.x+_bv.x*d,ty=p.y+_bv.y*d,tz=p.z+_bv.z*d,fov=cam.baseFov||cam.curFov;
    cam.target=[tx,ty,tz];cam.curTarget=[tx,ty,tz];
    cam.az=cam.curAz=Math.atan2(p.x-tx,p.z-tz);cam.curEl=Math.asin(clamp((p.y-ty)/d,-1,1));cam.el=clamp(cam.curEl,camSet.elMin,camSet.elMax);
    cam.fov=cam.curFov=fov;cam.zoom=cam.curZoom=1;cam.radius=cam.curRadius=d/distFor(1,fov);
    cam.blend=null;cam.snap=false;
  }
  // ---- what each view wants ----
  // Behind the cue ball along an aim, looking a little ahead of it.
  function lineView(aim,el,radius,fov,ahead){
    const cb=cueBall();if(!cb)return false;
    const dx=Math.cos(aim),dz=Math.sin(aim);
    cam.az=Math.atan2(-dx,-dz);cam.el=el;cam.radius=radius;cam.fov=fov;
    cam.target=[cb.x+dx*ahead,CLOTH_Y,cb.z+dz*ahead];
    return true;
  }
  function railHit(x,z,dx,dz){
    let t=4;if(dx>1e-6)t=Math.min(t,(HX-x)/dx);else if(dx<-1e-6)t=Math.min(t,(-HX-x)/dx);
    if(dz>1e-6)t=Math.min(t,(HZ-z)/dz);else if(dz<-1e-6)t=Math.min(t,(-HZ-z)/dz);
    return [x+dx*Math.max(0,t),z+dz*Math.max(0,t)];
  }
  // the cue ball, the ball it will hit and where that ball goes (the pocket, or the cushion)
  function aimTargets(aim){
    const cb=cueBall();if(!cb)return null;
    const dx=Math.cos(aim),dz=Math.sin(aim),pts=[[cb.x,cb.z]];let hit=null,ht=1e9;
    for(const b of balls){if(b.pocketed||b===cb)continue;
      const ox=b.x-cb.x,oz=b.z-cb.z,t=ox*dx+oz*dz;if(t<=0)continue;
      const d2=ox*ox+oz*oz-t*t;if(d2>=4*R*R)continue;const tc=t-Math.sqrt(4*R*R-d2);if(tc<ht){ht=tc;hit=b;}}
    const near=(x,z,q,m)=>{const d=Math.hypot(q[0]-x,q[1]-z);return d<=m?q:[x+(q[0]-x)*m/d,z+(q[1]-z)*m/d];};
    if(!hit){pts.push(near(cb.x,cb.z,railHit(cb.x,cb.z,dx,dz),2.2));return pts;}
    let nx=hit.x-(cb.x+dx*ht),nz=hit.z-(cb.z+dz*ht);const nl=Math.hypot(nx,nz)||1;nx/=nl;nz/=nl;
    pts.push([hit.x,hit.z]);
    let best=null,bd=.16;
    for(const q of POCKETS){const px=q.x-hit.x,pz=q.z-hit.z,t=px*nx+pz*nz;if(t<=0)continue;const off=Math.abs(px*nz-pz*nx);if(off<bd){bd=off;best=q;}}
    pts.push(best?[best.x,best.z]:near(hit.x,hit.z,railHit(hit.x,hit.z,nx,nz),.7));
    return pts;
  }
  // The framing of a shot in the aim's own frame: how high, how far, and the
  // point looked at (along and across the aim from the cue ball). Close for a
  // short shot, higher and wider for a long one, so nothing has to be dragged
  // into view; clear of the screen edges, the top bar and the shot controls.
  function shotFrame(aim){
    const pts=aimTargets(aim);if(!pts)return null;
    const cb=pts[0],far=pts[pts.length-1],D=Math.hypot(far[0]-cb[0],far[1]-cb[1]);
    const a=Math.atan2(-Math.cos(aim),-Math.sin(aim)),el=clamp(.3+.1*D,.3,.6),fov=42;
    const tx=lerp(cb[0],far[0],.42),tz=lerp(cb[1],far[1],.42);
    const asp=width/Math.max(1,height),tf=Math.tan(fov*PI/360),ce=Math.cos(el),se=Math.sin(el),sa=Math.sin(a),ca=Math.cos(a);
    const fits=d=>{const ex=tx+d*ce*sa,ey=CLOTH_Y+d*se,ez=tz+d*ce*ca;
      for(const q of pts){const vx=q[0]-ex,vy=BALL_Y-ey,vz=q[1]-ez,zf=-(vx*ce*sa+vy*se+vz*ce*ca);if(zf<.15)return false;
        const nx=(vx*ca-vz*sa)/(zf*tf*asp),ny=(-vx*se*sa+vy*ce-vz*se*ca)/(zf*tf);
        if(Math.abs(nx)>.8||ny>.6||ny<-.5)return false;}
      return true;};
    let lo=.5,hi=7;for(let i=0;i<18;i++){const m=(lo+hi)/2;if(fits(m))hi=m;else lo=m;}
    const dx=Math.cos(aim),dz=Math.sin(aim),ox=tx-cb[0],oz=tz-cb[1];
    return {el,fov,dist:hi,ahead:ox*dx+oz*dz,side:-ox*dz+oz*dx};
  }
  const af={aim:null,still:0,f:null,moving:false};
  // The aiming camera: turns with the aim at once, but changes its framing only
  // once the aim has settled - and then over a moment - so it never breathes.
  function aimPose(dt,aim){
    const cb=cueBall();if(!cb)return false;
    const turn=af.aim==null?9:Math.abs(Math.atan2(Math.sin(aim-af.aim),Math.cos(aim-af.aim)));af.aim=aim;
    af.still=turn<.0004+.002*dt?af.still+dt:0;
    if(!af.f||cam.snap||af.still>.16){const want=shotFrame(aim);
      if(want){if(!af.f||cam.snap){af.f=want;af.moving=false;}
        else{const f=af.f,off=Math.abs(want.dist-f.dist)/want.dist,shift=Math.hypot(want.ahead-f.ahead,want.side-f.side),del=Math.abs(want.el-f.el);
          // a new framing only when this one no longer suits the shot (another ball, a much longer or shorter
          // shot); then it eases all the way there. Small turns of the aim keep the picture as it is.
          if(!af.moving&&(off>.2||shift>.3||del>.08))af.moving=true;
          if(af.moving){const k=1-Math.exp(-dt*3.2);for(const key of ['el','fov','dist','ahead','side'])f[key]+=(want[key]-f[key])*k;
            if(off<.02&&shift<.03&&del<.01)af.moving=false;}}}}
    if(!af.f)return false;
    // the whole view turns as one piece round the cue ball, following a smoothed aim: never a chord, never a wobble
    if(af.sAim==null||cam.snap)af.sAim=aim;else af.sAim+=Math.atan2(Math.sin(aim-af.sAim),Math.cos(aim-af.sAim))*(1-Math.exp(-dt*camRate()*1.6));
    const f=af.f,sa=af.sAim,dx=Math.cos(sa),dz=Math.sin(sa),u=cam.user;
    cam.az=Math.atan2(-dx,-dz)+u.side;cam.el=clamp(f.el+u.el,camSet.elMin,camSet.elMax);
    cam.fov=f.fov;cam.zoom=u.zoom;cam.radius=f.dist/distFor(1,f.fov);
    setTarget(cb.x+dx*f.ahead-dz*f.side,CLOTH_Y,cb.z+dz*f.ahead+dx*f.side);
    cam.rigid=true;
    return true;
  }
  function tvView(side,el=.64,radius=4.4,fov=30){
    cam.az=side<0?-PI/2:PI/2;cam.el=el;cam.radius=radius;cam.fov=fov;setTarget(0,-.10,0);cam.zoom=1;
  }
  // The whole table from above, as large as the space between the top bar and the shot controls allows.
  let dockTop=0;
  function topPose(){
    const port=height>width*1.05,fov=34,asp=width/Math.max(1,height);
    const ex=OUT_X+.14,ez=OUT_Z+.14,hw=port?ez:ex,hh=port?ex:ez;
    const free=clamp(((dockTop>0?dockTop:height)-64)/Math.max(1,height),.55,1),t=Math.tan(fov*PI/360);
    const d=Math.max(hh/(t*free),hw/(t*asp*.96));
    // then a correction from where the table's corners really land on the screen (side panels, the shift above the controls)
    if(cam.view==='top'&&!cam.blend&&Math.abs(Math.atan2(Math.sin(cam.curAz-(port?-PI/2:0)),Math.cos(cam.curAz-(port?-PI/2:0))))<.02&&cam.curEl>1.5){
      camera.updateMatrixWorld();let m=0;
      for(const [x,z] of [[ex-.1,ez-.1],[-ex+.1,ez-.1],[ex-.1,-ez+.1],[-ex+.1,-ez+.1]]){_bv.set(x-cam.topPan[0]*0,CLOTH_Y,z).project(camera);m=Math.max(m,Math.abs(_bv.x),Math.abs(_bv.y)*(_bv.y>0?1:1));}
      const zm=cam.topZoom;if(zm>.99&&zm<1.01&&isFinite(m)&&m>.05)cam.topK=clamp((cam.topK||1)*Math.pow(m/.93,.35),.6,2.5);}
    cam.az=port?-PI/2:0;cam.el=1.5585;cam.fov=fov;cam.zoom=(cam.topK||1)/cam.topZoom;cam.radius=d/distFor(1,fov);
    setTarget(cam.topPan[0],CLOTH_Y,cam.topPan[1]);
  }
  // The broadcast angles; while the balls run the picture keeps them in view,
  // drifting a little towards the play, never cutting.
  function playDrift(dt,s){
    let mx=0,mz=0,n=0,fast=0;
    for(const b of balls){if(b.pocketed)continue;const v=Math.hypot(b.vx,b.vz);if(v>.04){mx+=b.x;mz+=b.z;n++;fast=Math.max(fast,v);}}
    const tx=n?clamp(mx/n*.35,-HX*.3,HX*.3):0,tz=n?clamp(mz/n*.35,-HZ*.25,HZ*.25):0,k=1-Math.exp(-dt*1.3);
    s.tvt[0]+=(tx-s.tvt[0])*k;s.tvt[1]+=(tz-s.tvt[1])*k;
    const close=n===1&&fast<.45?.86:1;s.close=(s.close??1)+(close-(s.close??1))*(1-Math.exp(-dt*.9));   // one slow ball: a touch closer
  }
  function tvPose(dt){
    const p=presets[cam.tvPreset]||presets[1];
    if(state.inShot)playDrift(dt,cam);else{const k=1-Math.exp(-dt*1.5);cam.tvt[0]*=1-k;cam.tvt[1]*=1-k;cam.close=(cam.close??1)+(1-(cam.close??1))*k;}
    Object.assign(cam,{az:p.az,el:p.el,radius:p.radius*(cam.close??1),fov:p.fov||30,zoom:cam.tvZoom});
    setTarget(cam.tvt[0],-.10,cam.tvt[1]);
  }
  // ---- the shot follow ----
  // At the strike the view stays as it was; if the shot will carry the play out
  // of it, one smooth move to the broadcast angle the balls run away from (a
  // high side angle when they run across the table); back when they stop.
  function pickBroadcast(){
    const sh=state.shot,cb=cueBall(),sp=cb?Math.hypot(cb.vx,cb.vz):0;
    let dx=Math.cos(sh.angle),dz=Math.sin(sh.angle),reach=sp;
    const pts=aimTargets(sh.angle);
    if(pts&&pts.length>2){const a=pts[1],b=pts[2],l=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(l>.05){dx=(b[0]-a[0])/l;dz=(b[1]-a[1])/l;}reach=Math.max(reach,Math.hypot(a[0]-pts[0][0],a[1]-pts[0][1])+l*.5);}
    const across=Math.abs(dz)>Math.abs(dx)*1.35;
    return {need:sp>.75||reach>.6,across,side:across?(dz>=0?-1:1):(dx>=0?-1:1)};
  }
  function broadcastPose(s,dt){
    if(s.across){cam.az=s.side<0?PI:0;cam.el=.92;cam.radius=4.0;}else{cam.az=s.side<0?-PI/2:PI/2;cam.el=.72;cam.radius=4.35;}
    cam.fov=30;cam.zoom=1;playDrift(dt,s);cam.radius*=s.close;setTarget(s.tvt[0],-.10,s.tvt[1]);
  }
  function shotFollow(dt){
    const v=cam.view,on=camSet.autoTv&&(v==='aim'||v==='free');
    let s=cam.sf;
    if(state.inShot&&state.shot){
      if(!s||s.key!==state.shotCount){s=cam.sf={key:state.shotCount,t:0,phase:'hold',user:false,after:0,tvt:[cam.target[0]*.2,cam.target[2]*.2],close:1,...pickBroadcast()};}
      s.t+=dt;
      if(s.user||!on)return null;
      if(s.phase==='hold'){if(!(s.need&&s.t>.42))return null;s.phase='tv';
        if(v==='free')s.saved={az:cam.az,el:cam.el,radius:cam.radius,fov:cam.fov,zoom:cam.zoom,target:cam.target.slice()};}
      broadcastPose(s,dt);return 'shot';
    }
    if(s&&s.phase==='tv'&&!s.user&&on&&s.after<.6){s.after+=dt;broadcastPose(s,dt);return 'shot';}
    if(s){if(s.saved&&v==='free'){Object.assign(cam,s.saved);cam.target=s.saved.target;startBlend();}cam.sf=null;}
    return null;
  }
  // ---- the plan for this frame: what the active view wants ----
  function planView(dt){
    cam.rigid=false;
    const v=cam.view,sf=shotFollow(dt);if(sf)return sf;
    if(v==='top'){topPose();return 'top';}
    if(v==='tv'){tvPose(dt);return 'tv';}
    if(v==='free')return 'free';
    // AIM: the director of the aiming camera
    if(!state.started||state.finished){tvView(-1,.62,4.5,30);return 'menu';}
    if(state.inShot)return cam.key;                       // held exactly where it was at the strike
    if(humanTurn()){
      if(state.ballInHand){cam.az=-PI/2;cam.el=1.0;cam.radius=4.95;cam.fov=42;cam.zoom=cam.user.zoom;setTarget(-.1,CLOTH_Y,0);return 'hand';}
      if(aimPose(dt,state.aim))return 'aim'+state.current;
      tvView(-1);return 'menu';
    }
    if(ai.plan){const a=ai.plan.aim,cb=cueBall(),fx=Math.cos(a),fz=Math.sin(a);
      // side-on to the opponent's line: the player and the shot both in view
      cam.az=Math.atan2(-fz,fx);cam.el=.66;cam.radius=2.7;cam.fov=40;cam.zoom=1;setTarget(cb.x+fx*.55,CLOTH_Y,cb.z+fz*.55);return 'plan';}
    const cb=cueBall(),side=cb&&cb.x>HX*.4?1:-1;tvView(side);return 'wait'+side;
  }
  // ---- keeping out of things ----
  // The lowest the eye may be over a spot: clear of the cloth and the balls,
  // over the rails, and sloping down outside the table so nothing jumps.
  function minEyeY(x,z){
    const ax=Math.abs(x),az=Math.abs(z),d=Math.max(ax-(OUT_X+.05),az-(OUT_Z+.05));
    const top=(ax<IN_X-.01&&az<IN_Z-.01)?BALL_Y+R+.075:RAIL_TOP+.075;
    return d<=0?top:Math.max(FLOOR_Y+.32,top-d*1.6);
  }
  // How far out from the table the camera may go in each direction before the
  // stands, walls, boards or chairs, at a few heights; worked out once per
  // arena, a few rays a frame.
  const arenaRing={key:'',r:null,todo:0,targets:null};
  const RING_N=48,RING_H=[.55,1.15,1.85,2.65,3.6],_rc=new T.Raycaster(),_rgO=new T.Vector3(),_rgD=new T.Vector3();
  function ringTick(){
    const key=(typeof venueId!=='undefined'?venueId:'')+':'+(arenaGroup?arenaGroup.children.length:0)+':'+(stage&&stage.group?1:0);
    if(arenaRing.key!==key){arenaRing.key=key;arenaRing.r=RING_H.map(()=>new Array(RING_N).fill(15));arenaRing.todo=0;arenaRing.targets=[];
      const add=g=>g&&g.traverse(m=>{if((m.isMesh||m.isInstancedMesh)&&!m.isSkinnedMesh)arenaRing.targets.push(m);});
      add(arenaGroup);if(stage&&stage.group)add(stage.group);}
    if(arenaRing.todo>=RING_N*RING_H.length)return;
    for(let n=0;n<10&&arenaRing.todo<RING_N*RING_H.length;n++,arenaRing.todo++){
      const i=arenaRing.todo%RING_N,h=Math.floor(arenaRing.todo/RING_N),a=i/RING_N*TAU;
      _rgO.set(0,FLOOR_Y+RING_H[h],0);_rgD.set(Math.cos(a),0,Math.sin(a));_rc.set(_rgO,_rgD);_rc.far=15;
      let hits=[];try{hits=_rc.intersectObjects(arenaRing.targets,false);}catch(e){}
      for(const hit of hits){const p=hit.point;if(Math.abs(p.x)<OUT_X+.55&&Math.abs(p.z)<OUT_Z+.55)continue;   // the table's own furniture
        arenaRing.r[h][i]=hit.distance;break;}
    }
  }
  function ringLimit(x,y,z){
    if(!arenaRing.r)return 15;
    const f=((Math.atan2(z,x)/TAU*RING_N)%RING_N+RING_N)%RING_N,i=Math.floor(f)%RING_N,u=f-Math.floor(f),j=(i+1)%RING_N;
    const at=h=>lerp(arenaRing.r[h][i],arenaRing.r[h][j],u),hy=y-FLOOR_Y;
    if(hy<=RING_H[0])return at(0);
    for(let h=1;h<RING_H.length;h++)if(hy<=RING_H[h]){const w=(hy-RING_H[h-1])/(RING_H[h]-RING_H[h-1]);return Math.min(at(h-1),lerp(at(h-1),at(h),w));}
    return at(RING_H.length-1);
  }
  const inRing=(x,y,z)=>Math.hypot(x,z)<=Math.max(OUT_X+.6,ringLimit(x,y,z)-.32);
  // p: [x,y,z] or a Vector3. walls: also keep inside the arena, coming in along
  // the line to the point looked at (tg), like a spring arm, so the view keeps its direction.
  function keepOut(p,walls,tg){
    const isV=!Array.isArray(p);let x=isV?p.x:p[0],y=isV?p.y:p[1],z=isV?p.z:p[2];
    if(walls&&!inRing(x,y,z)){
      if(tg&&inRing(tg[0],tg[1],tg[2])){let lo=0,hi=1;const ox=tg[0],oy=tg[1],oz=tg[2];
        for(let i=0;i<9;i++){const m=(lo+hi)/2;if(inRing(ox+(x-ox)*m,oy+(y-oy)*m,oz+(z-oz)*m))lo=m;else hi=m;}
        x=ox+(x-ox)*lo;y=oy+(y-oy)*lo;z=oz+(z-oz)*lo;}
      else{const r=Math.hypot(x,z),lim=Math.max(OUT_X+.6,ringLimit(x,y,z)-.32);x*=lim/r;z*=lim/r;}}
    y=Math.max(y,minEyeY(x,z),FLOOR_Y+.32);
    if(isV)p.set(x,y,z);else{p[0]=x;p[1]=y;p[2]=z;}
  }
  // ---- the camera, every frame ----
  const dockEl=document.querySelector('.control-dock');
  let viewShift=0;
  function camRate(){return lerp(18,3.5,clamp(camSet.smooth,0,1));}
  function updateCamera(dt){
    // while you aim, the cue ball sits low in the middle of the frame: captions move aside so they never cover it
    const aiming=!!(state.started&&!state.finished&&!state.inShot&&humanTurn()&&!state.ballInHand&&cam.view==='aim');
    if(aiming!==cam.aimingUI){cam.aimingUI=aiming;document.body.classList.toggle('aim-cam',aiming);}
    const studioOn=!!(studio&&studio.on),tvLive=!studioOn&&tvDirect(dt);
    if(time-(cam.lastAt??time)>.25&&!tvLive&&!studioOn){startBlend();if(cam.blend)cam.blend.f0=camera.fov;}   // back from a replay or the walk-on
    cam.lastAt=time;
    if(cam.studioWas&&!studioOn)startBlend();cam.studioWas=studioOn;
    if(tvLive){cam.blend=null;}
    else if(!studioOn){
      if(cam.tvWas){cam.snap=true;cam.blend=null;}           // back from the TV cutaways: a cut, like the cutaways
      const key=planView(dt);
      if(key!==cam.key){if(cam.key&&!cam.snap&&key!=='free')startBlend();if(!String(key).startsWith('aim'))af.f=null;
        if(key==='shot')cameraLabel('AUTO CAM · FOLLOWING THE SHOT','●');else if(cam.key==='shot')labelView();
        cam.key=key;}
      if(cam.view==='aim'){cam.focusName='AUTO FOLLOW';const fc=$('focus-current');if(fc&&fc.textContent!=='AUTO FOLLOW')fc.textContent='AUTO FOLLOW';}
    }
    cam.tvWas=tvLive;
    ringTick();
    if(cam.snap){cam.snap=false;cam.curAz=cam.az;cam.curEl=cam.el;cam.curRadius=cam.radius;cam.curFov=cam.fov;cam.curZoom=cam.zoom;for(let j=0;j<3;j++)cam.curTarget[j]=cam.target[j];}
    // (the aiming view smooths its aim itself and turns rigidly: its azimuth and target are taken as they are;
    //  its height, distance and lens still ease, as everywhere else)
    if(cam.rigid&&!tvLive&&!studioOn){cam.curAz=cam.az;for(let j=0;j<3;j++)cam.curTarget[j]=cam.target[j];}
    const t=1-Math.exp(-dt*(studioOn?7:camRate()));
    cam.curAz+=Math.atan2(Math.sin(cam.az-cam.curAz),Math.cos(cam.az-cam.curAz))*t;
    cam.curEl=lerp(cam.curEl,cam.el,t);cam.curRadius=lerp(cam.curRadius,cam.radius,t);cam.curFov=lerp(cam.curFov,cam.fov,t);cam.curZoom=lerp(cam.curZoom,cam.zoom,t);
    for(let j=0;j<3;j++)cam.curTarget[j]=lerp(cam.curTarget[j],cam.target[j],t);
    let r=distFor(cam.curRadius,cam.curFov)*cam.curZoom;
    if(cam.view==='free'&&!studioOn)r=clamp(r,.38,13);
    const a=cam.curAz,e=cam.curEl;
    eye=[cam.curTarget[0]+r*Math.cos(e)*Math.sin(a),cam.curTarget[1]+r*Math.sin(e),cam.curTarget[2]+r*Math.cos(e)*Math.cos(a)];
    if(!studioOn)keepOut(eye,!tvLive&&(cam.view==='free'||cam.view==='top'||cam.view==='aim')&&!cam.sf,cam.curTarget);
    _bp1.set(eye[0],eye[1],eye[2]);_bt.set(cam.curTarget[0],cam.curTarget[1],cam.curTarget[2]);
    let fovNow=cam.curFov;
    if(cam.blend&&!studioOn){const b=cam.blend;b.t+=dt;const u=clamp(b.t/b.dur,0,1),k=u*u*u*(u*(u*6-15)+10);
      _bm.lookAt(_bp1,_bt,_bup);_bq1.setFromRotationMatrix(_bm);
      const lift=Math.min(.9,b.p0.distanceTo(_bp1)*.18)*Math.sin(PI*k);
      camera.position.copy(b.p0).lerp(_bp1,k);camera.position.y+=lift;keepOut(camera.position,false);
      camera.quaternion.copy(b.q0).slerp(_bq1,k);fovNow=lerp(b.f0,cam.curFov,k);
      if(u>=1)cam.blend=null;
    }else{camera.position.copy(_bp1);camera.up.set(0,1,0);camera.lookAt(_bt);}
    eye=[camera.position.x,camera.position.y,camera.position.z];cam.baseFov=fovNow;
    // Frame the table above the shot controls: shift the image up by half the
    // space they take, keeping the same scale.
    let want=0;dockTop=0;
    if(dockEl&&state.started&&!document.body.classList.contains('hud-off')){const rc=dockEl.getBoundingClientRect();
      if(rc.height>0&&rc.top<height){dockTop=rc.top;want=clamp((height-rc.top)*.5,0,height*.2);}}
    {const dh=Math.round(dockTop>0?height-dockTop:0);if(dh!==cam.dockH){cam.dockH=dh;document.documentElement.style.setProperty('--dock-space',dh+'px');}}
    viewShift=lerp(viewShift,want,1-Math.exp(-dt*6));
    // and sideways, to the middle of the free space between the panels down the sides
    let wantX=0;
    if(state.started&&!document.body.classList.contains('hud-off')){const side=(el,left)=>{if(!el||el.hidden||!el.offsetParent&&getComputedStyle(el).position!=='fixed')return 0;
        const w=el.offsetWidth,h=el.offsetHeight,l=el.offsetLeft;if(!(w>0&&h>height*.3))return 0;return left?Math.max(0,l+w):Math.max(0,width-l);};
      wantX=clamp((side(sidePanels[0],true)-side(sidePanels[1],false))*.5,-width*.16,width*.16);}
    viewShiftX=lerp(viewShiftX,wantX,1-Math.exp(-dt*4));
    const s=Math.round(viewShift),sx=Math.round(viewShiftX),fov=2*Math.atan(Math.tan(fovNow*PI/360)*(height+2*s)/height)*180/PI;
    if(Math.abs(camera.fov-fov)>.01||!camera.view||!camera.view.enabled||camera.view.offsetY!==2*s||camera.view.fullHeight!==height+2*s||camera.view.fullWidth!==width+2*Math.abs(sx)||camera.view.offsetX!==(sx<0?2*-sx:0)){
      const W=width+2*Math.abs(sx);camera.fov=fov;camera.aspect=W/(height+2*s);camera.setViewOffset(W,height+2*s,sx<0?-2*sx:0,2*s,width,height);
    }
    // The lamp canopy shows only from below (its glowing underside); seen from
    // above it would just be a dark slab over the table, so it is left out.
    canopy.visible=eye[1]<CANOPY_Y-.12;
  }
  // ---- your hands on the camera ----
  // A hand on the camera stops any move in progress where it is and, during a
  // shot, takes over from the shot follow (it comes back to your view after).
  function camHand(){
    if(cam.blend)adoptCurrentPose();
    if(cam.sf&&state.inShot)cam.sf.user=true;
  }
  const aimView=()=>cam.view==='aim'&&!cam.sf&&state.started&&!state.finished&&!state.inShot&&humanTurn()&&!state.ballInHand;
  function camOrbit(dx,dy,fine){
    const k=.0062*camSet.rot*(fine?.25:1),sy=camSet.invertY?-1:1;
    if(aimView()){   // swing the aiming camera round the cue ball and raise or lower it; the aim itself never moves
      const u=cam.user;u.side=clamp(u.side-dx*k,-.75,.75);u.el=clamp(u.el+dy*k*.8*sy,-.12,.95);return;}
    camHand();if(cam.view!=='free')goView('free','keep');
    cam.az-=dx*k;cam.el=clamp(cam.el+dy*k*.85*sy,camSet.elMin,camSet.elMax);
    if(cam.focusName==='AUTO FOLLOW')cam.focusName='TABLE CENTRE';
    labelView();
  }
  // Pan: the point the camera looks at moves with the pointer, in the plane of the picture (top view: of the table).
  const _pr=new T.Vector3(),_pu=new T.Vector3();
  function camPan(dx,dy,fine){
    const k=camSet.pan*(fine?.3:1);
    if(aimView()){camOrbit(dx*.35,dy,fine);return;}
    camHand();
    const r=distFor(cam.curRadius,cam.curFov)*cam.curZoom,m=2*Math.tan(cam.curFov*PI/360)*r/Math.max(1,height)*k;   // metres per pixel at the target
    camera.updateMatrixWorld();_pr.setFromMatrixColumn(camera.matrixWorld,0);_pu.setFromMatrixColumn(camera.matrixWorld,1);
    if(cam.view==='top'){const ul=Math.hypot(_pu.x,_pu.z)||1,rl=Math.hypot(_pr.x,_pr.z)||1;
      cam.topPan[0]=clamp(cam.topPan[0]-dx*m*_pr.x/rl+dy*m*_pu.x/ul,-HX,HX);cam.topPan[1]=clamp(cam.topPan[1]-dx*m*_pr.z/rl+dy*m*_pu.z/ul,-HZ,HZ);return;}
    if(cam.view!=='free')goView('free','keep');
    const lim=[[-HX-4,HX+4],[FLOOR_Y,FLOOR_Y+4.5],[-HZ-4,HZ+4]],mv=[-dx*m*_pr.x+dy*m*_pu.x,-dx*m*_pr.y+dy*m*_pu.y,-dx*m*_pr.z+dy*m*_pu.z];
    for(let j=0;j<3;j++){const v=clamp(cam.target[j]+mv[j],lim[j][0],lim[j][1]);cam.curTarget[j]+=v-cam.target[j];cam.target[j]=v;}
    cam.focusName='CUSTOM POINT';labelView();
  }
  // Zoom: f > 1 goes closer. At a pointer, the top view keeps the spot under it where it is.
  function camZoom(f,clientX,clientY){
    const lo=camSet.zoomMin,hi=camSet.zoomMax;
    if(cam.view==='top'&&!cam.sf){
      const z0=cam.topZoom,z1=clamp(z0*f,1/hi,1/lo*1.6);if(z1===z0)return;
      if(clientX!=null){const p=screenToTable(clientX,clientY);
        if(p){const c=cam.topPan,q=z0/z1;cam.topPan=[clamp(p[0]-(p[0]-c[0])*q,-HX,HX),clamp(p[1]-(p[1]-c[1])*q,-HZ,HZ)];}}
      cam.topZoom=z1;return;}
    if(aimView()||(cam.view==='aim'&&!cam.sf&&state.ballInHand)){cam.user.zoom=clamp(cam.user.zoom/f,lo,hi);return;}
    if(cam.view==='tv'&&!cam.sf){cam.tvZoom=clamp(cam.tvZoom/f,lo,hi);return;}
    camHand();if(cam.view!=='free')goView('free','keep');
    const d=distFor(cam.radius,cam.fov)*cam.zoom,d1=clamp(d/f,.4,12.5);cam.zoom*=d1/d;
  }
  // ---- see-through ----
  // Smart rail fade: only when the camera is low AND a ball sits close to the
  // cushion nearest the camera, that side's rail and cushion dissolve.
  function updateRailFade(dt){
    let want=0;const dir=fadeUniforms.uFadeDir.value;
    const lx=eye[0]-cam.curTarget[0],lz=eye[2]-cam.curTarget[2],ll=Math.hypot(lx,lz)||1;
    const elNow=Math.atan2(eye[1]-cam.curTarget[1],Math.hypot(lx,lz));
    if(railFadeEnabled&&elNow<.62){
      const ux=lx/ll,uz=lz/ll;let sx=0,sz=0;
      if(Math.abs(ux)*HZ>Math.abs(uz)*HX)sx=Math.sign(ux);else sz=Math.sign(uz);
      dir.set(sx/(HX+.02)*(sx?1:0),sz/(HZ+.02)*(sz?1:0));
      const near=balls.some(b=>!b.pocketed&&(sx?sx*b.x>HX-.16:sz*b.z>HZ-.16));
      if(near)want=clamp((.62-elNow)*6,0,1);
    }
    fadeUniforms.uFadeAmt.value=lerp(fadeUniforms.uFadeAmt.value,want,1-Math.exp(-dt*5));
    // while any of it is see-through, the rails and cushions draw with their depth laid first (see ghostOf)
    const on=fadeUniforms.uFadeAmt.value>.004;
    if(on!==railGhosts){railGhosts=on;if(on&&!railMeshes){railMeshes=[];scene.traverse(o=>{if(o.isMesh&&!o.userData.ghostOf&&[].concat(o.material).some(mt=>mt&&mt.userData&&mt.userData.fadeable))railMeshes.push(o);});}
      for(const m of railMeshes||[]){for(const mt of [].concat(m.material)){if(mt.transparent!==on){mt.transparent=on;mt.needsUpdate=true;}}
        if(on||m.userData.ghost)ghostOf(m).visible=on;m.renderOrder=on?9:0;}}
  }
  let railGhosts=false,railMeshes=null;
  // See-through: the referee and the players fade when they stand between the
  // camera and the play (or the camera is inside them); the score panels and
  // controls fade while a ball sits behind them (hover a panel to bring it back).
  const _seg=new T.Vector3(),_scr=new T.Vector3(),_occ=[null,null];
  let refFade=1,panelClock=0,viewShiftX=0;
  const PANELS=['.scoreboard','.match-panel','.scene-controls','.control-dock','.camera-switcher','.camera-tag','.focus-tag','.comm-caption','.comm-tag',
    '.bot-skip','.control-hint','.toast','.arena-reaction','.top-bar','.cam-panel','.touch-aim','.pull-power'].map(q=>document.querySelector(q)).filter(Boolean);
  const sidePanels=[document.querySelector('.scene-controls'),document.querySelector('.match-panel')];
  function blocksView(x,z,radius,top,only){
    for(const b of only||balls){
      if(!b||b.pocketed)continue;
      const dx=b.x-eye[0],dy=BALL_Y-eye[1],dz=b.z-eye[2],L2=dx*dx+dz*dz;if(L2<1e-6)continue;
      const t=clamp(((x-eye[0])*dx+(z-eye[2])*dz)/L2,0,1);
      if(t>.97)continue;
      const y=eye[1]+dy*t;
      if(y<FLOOR_Y||y>FLOOR_Y+top)continue;
      if(Math.hypot(eye[0]+dx*t-x,eye[2]+dz*t-z)<radius)return true;
    }
    return false;
  }
  // See-through done cleanly: an object fading out of the way first lays down
  // its depth (an invisible copy drawn just before it), then its colour is
  // blended over that, so only its nearest surface shows, evenly: never the
  // inside of a coat, the back of an arm or the far side of a rail through the
  // front. Cut-out hair keeps its shape as it fades.
  function ghostOf(m){
    let g=m.userData.ghost;if(g)return g;
    const mats=(Array.isArray(m.material)?m.material:[m.material]).map(mt=>{const d=mt.clone();d.colorWrite=false;d.transparent=true;d.depthWrite=true;d.opacity=1;
      d.alphaTest=mt.userData.alphaTest0??mt.alphaTest;d.blending=T.NoBlending;return d;});
    const mat=Array.isArray(m.material)?mats:mats[0];
    if(m.isSkinnedMesh){g=new T.SkinnedMesh(m.geometry,mat);g.bind(m.skeleton,m.bindMatrix);g.bindMode=m.bindMode;}
    else g=new T.Mesh(m.geometry,mat);
    if(m.morphTargetInfluences){g.morphTargetInfluences=m.morphTargetInfluences;g.morphTargetDictionary=m.morphTargetDictionary;}
    g.frustumCulled=false;g.castShadow=g.receiveShadow=false;g.renderOrder=8;g.userData.ghostOf=m;g.visible=false;g.raycast=()=>{};
    m.add(g);m.userData.ghost=g;return g;
  }
  function fadeMesh(m,o){
    const tr=o<.99,mats=Array.isArray(m.material)?m.material:[m.material];
    for(const mt of mats){
      if(mt.userData.alphaTest0===undefined)mt.userData.alphaTest0=mt.alphaTest;
      if(mt.userData.transparent0===undefined)mt.userData.transparent0=mt.transparent;
      const want=tr||mt.userData.transparent0;if(mt.transparent!==want){mt.transparent=want;mt.needsUpdate=true;}
      mt.depthWrite=!mt.userData.transparent0||tr;mt.opacity=o;
      if(mt.userData.alphaTest0>0)mt.alphaTest=tr?Math.max(.01,mt.userData.alphaTest0*o):mt.userData.alphaTest0;
      mt.polygonOffset=tr;mt.polygonOffsetFactor=tr?-1:0;mt.polygonOffsetUnits=tr?-1:0;}
    if(tr||m.userData.ghost)ghostOf(m).visible=tr;
    m.renderOrder=tr?9:0;
  }
  function fadePerson(obj,o){
    obj.traverse(m=>{if(!m.isMesh||m.userData.ghostOf)return;fadeMesh(m,o);m.castShadow=o>.5;});
  }
  function setPersonOpacity(p,o){fadePerson(p.obj,o);}
  function updateOcclusion(dt){
    const p=ref.person,cine0=cine.on;
    if(p){
      const x=p.obj.position.x,z=p.obj.position.z,inside=Math.hypot(eye[0]-x,eye[2]-z)<.5&&eye[1]<FLOOR_Y+2.2;
      const want=inside?0:blocksView(x,z,.34,1.9)?.16:1;
      const next=lerp(refFade,want,1-Math.exp(-dt*7));
      if(Math.abs(next-refFade)>.002||(want===1&&refFade!==1&&next>.995)){refFade=next>.995?1:next<.005?0:next;setPersonOpacity(p,refFade);}
    }
    // a player between the camera and the cue ball or the ball it is aimed at (not in the TV close-ups, where he is the picture)
    {const cb=cueBall(),tgt=cb?aimTargets(state.inShot&&state.shot?state.shot.angle:ai.plan&&!humanTurn()?ai.plan.aim:state.aim):null;
      const hitB=tgt&&tgt.length>2?balls.find(b=>!b.pocketed&&Math.abs(b.x-tgt[1][0])<1e-6&&Math.abs(b.z-tgt[1][1])<1e-6):null,only=_occ;_occ[0]=cb;_occ[1]=hitB;
      const close=tv&&tv.active&&['face','chair'].includes(tv.shot);
      for(const pl of PL){if(!pl||!pl.ok)continue;
        const want=!cine0&&!close&&pl.act!=='sit'&&blocksView(pl.x,pl.z,.3,1.85,only)?.22:1;
        pl.block=lerp(pl.block??1,want,1-Math.exp(-dt*7));if(Math.abs(pl.block-want)<.01)pl.block=want;}}
    panelClock-=dt;if(panelClock>0)return;panelClock=.15;
    const pts=[];
    if(state.started)for(const b of balls){if(b.pocketed)continue;_scr.set(b.x,BALL_Y,b.z).project(camera);if(_scr.z>=1)continue;
      const x=(_scr.x+1)/2*width,y=(1-_scr.y)/2*height;_seg.set(b.x,BALL_Y+R,b.z).project(camera);
      pts.push([x,y,Math.max(4,Math.abs((1-_seg.y)/2*height-y))]);}
    for(const el of PANELS){
      if(el.hidden){el.classList.remove('see-through');continue;}
      const rc=el.getBoundingClientRect(),m=10;
      const hit=rc.width>0&&pts.some(([x,y,r])=>x>rc.left-m-r&&x<rc.right+m+r&&y>rc.top-m-r&&y<rc.bottom+m+r);
      el.classList.toggle('see-through',hit);
    }
    paintHint();paintFocusTag();
  }
  const _ray=new T.Raycaster(),_ndc=new T.Vector2(),_tablePlane=new T.Plane(new T.Vector3(0,1,0),-BALL_Y),_hitP=new T.Vector3();
  function screenToTable(clientX,clientY){
    const rect=canvas.getBoundingClientRect();
    _ndc.set((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2);
    _ray.setFromCamera(_ndc,camera);
    if(!_ray.ray.intersectPlane(_tablePlane,_hitP))return null;
    return [_hitP.x,_hitP.z];
  }
  // over the table (the cloth and the cushions): where moving the mouse aims in the aiming view
  function overTable(clientX,clientY){const p=screenToTable(clientX,clientY);return !!p&&Math.abs(p[0])<OUT_X+.02&&Math.abs(p[1])<OUT_Z+.02;}
  // the ball under a point of the screen, if any
  function ballAtScreen(clientX,clientY){
    const p=screenToTable(clientX,clientY);if(!p)return null;
    let best=null,bd=(R*2.4)**2;for(const b of balls){if(b.pocketed)continue;const d=(b.x-p[0])**2+(b.z-p[1])**2;if(d<bd){bd=d;best=b;}}
    return best;
  }
  let aimMoveX=null,focusTagText='';
  function playerViewActive(){return cam.view==='aim'&&!cam.sf&&state.started&&!state.finished&&humanTurn()&&!state.ballInHand&&!state.inShot&&!isAnyOverlayOpen();}
  function paintFocusTag(){
    const touch=document.body.classList.contains('touch');
    const t=playerViewActive()?(touch?'DRAG TO AIM · FINE AIM STRIP · PULL THE CUE TO SHOOT':camSet.aimHold?'HOLD THE LEFT BUTTON AND MOVE TO AIM · SHIFT FOR FINE · CLICK A BALL TO AIM AT IT':'MOVE THE MOUSE OVER THE TABLE TO AIM · SHIFT FOR FINE · CLICK A BALL TO AIM AT IT')
      :cam.view==='free'?(touch?'DRAG TO TURN · PINCH TO ZOOM · TWO FINGERS TO MOVE':'DRAG TO TURN · RIGHT DRAG TO MOVE · WHEEL TO ZOOM'):touch?'TOUCH THE TABLE TO AIM':'AIM WITH YOUR MOUSE';
    if(t!==focusTagText&&$('focus-tag')){focusTagText=t;$('focus-tag').textContent=t;}
  }
