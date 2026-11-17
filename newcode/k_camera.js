  // ---- CAMERA ---------------------------------------------------------------
  // PLAYER VIEW stands behind the cue ball looking along your aim (move the
  // mouse sideways to turn the aim; click a ball to aim straight at it). The TV
  // cameras show the whole table. AUTO DIRECTOR picks for you: the player view
  // while you aim, a view of the D with the white in hand, a view along the
  // opponent's line while it gets down on a shot, and a high TV angle while
  // the balls run. The picture is framed in the space above the shot controls.
  let autoCamera=true, railFadeEnabled=true, focusPicking=false;
  const cam={az:-PI/2,el:.5,radius:5.0,mode:1,fov:30,follow:false,zoom:1,curZoom:1,
    curAz:-PI/2,curEl:.5,curRadius:5.0,curFov:30,target:[0,-.10,0],curTarget:[0,-.10,0],focusName:"TABLE CENTRE",shotKey:'',runSide:-1};
  const presets=[
    {name:'PLAYER VIEW',n:'01',follow:true,el:.36,radius:1.55,fov:44},
    {az:-PI/2,el:.62,radius:4.5,name:'TV MAIN',n:'02'},
    {az:0,el:1.558,radius:4.75,name:'OVERHEAD',n:'03'},
    {az:PI/2,el:.62,radius:4.5,name:'TV REVERSE',n:'04'},
    {az:1.35,el:.62,radius:5.0,name:'SIDE VIEW',n:'05'},
    {az:.42,el:.86,radius:5.15,name:'THREE-QUARTER',n:'06'},
    {az:-.48,el:1.30,radius:4.6,name:'HIGH ANGLE',n:'07'}
  ];
  const OVERHEAD_PRESET=2,PLAYER_PRESET=0;
  const distFor=(r,fov)=>r*Math.tan(21*PI/180)/Math.tan(fov/2*PI/180);
  function cameraLabel(name,n){$('camera-tag').innerHTML='<div class="camera-cross">⌗</div><span>'+name+' <b>'+n+'</b></span>';}
  function setCamera(mode){
    autoCamera=false;cam.mode=(mode+presets.length)%presets.length;
    const a=presets[cam.mode];cam.follow=!!a.follow;cam.fov=a.fov||30;
    if(!a.follow){Object.assign(cam,{az:a.az,el:a.el,radius:a.radius});cam.target=[0,-.10,0];}
    $('auto-camera-button').classList.remove('active');$('auto-camera-button').setAttribute('aria-pressed','false');
    cameraLabel(a.name,a.n);
  }
  function setAutoCamera(on){
    autoCamera=on; $('auto-camera-button').classList.toggle('active',on);
    $('auto-camera-button').setAttribute('aria-pressed',String(on));
    if(on){cameraLabel('AUTO DIRECTOR','●');cam.shotKey='';}
    else{cam.follow=false;cameraLabel('FREE CAMERA','◎');}
  }
  function focusOn(x,z,label='CUSTOM POINT'){
    setAutoCamera(false);cam.target=[clamp(x,-HX-.48,HX+.48),-.06,clamp(z,-HZ-.55,HZ+.55)];
    cam.focusName=label;focusPicking=false;
    $('focus-pick').classList.remove('active');$('focus-current').textContent=label;
    cameraLabel('FOCUS · '+label,'◉');
  }
  // Behind the cue ball along an aim, looking a little ahead of it.
  function lineView(aim,el,radius,fov,ahead){
    const cb=cueBall();if(!cb)return false;
    const dx=Math.cos(aim),dz=Math.sin(aim);
    cam.az=Math.atan2(-dx,-dz);cam.el=el;cam.radius=radius;cam.fov=fov;
    cam.target=[cb.x+dx*ahead,CLOTH_Y,cb.z+dz*ahead];
    return true;
  }
  // Aiming: the camera stands behind the cue ball on the line of aim and
  // frames the whole shot - the cue ball, the ball it will hit and where that
  // ball is going (the pocket, or the cushion) - close for a short shot,
  // higher and wider for a long one, so nothing has to be dragged into view.
  function railHit(x,z,dx,dz){
    let t=4;if(dx>1e-6)t=Math.min(t,(HX-x)/dx);else if(dx<-1e-6)t=Math.min(t,(-HX-x)/dx);
    if(dz>1e-6)t=Math.min(t,(HZ-z)/dz);else if(dz<-1e-6)t=Math.min(t,(-HZ-z)/dz);
    return [x+dx*Math.max(0,t),z+dz*Math.max(0,t)];
  }
  function aimTargets(aim){
    const cb=cueBall();if(!cb)return null;
    const dx=Math.cos(aim),dz=Math.sin(aim),pts=[[cb.x,cb.z]];let hit=null,ht=1e9;
    for(const b of balls){if(b.pocketed||b===cb)continue;
      const ox=b.x-cb.x,oz=b.z-cb.z,t=ox*dx+oz*dz;if(t<=0)continue;
      const d2=ox*ox+oz*oz-t*t;if(d2>=4*R*R)continue;const tc=t-Math.sqrt(4*R*R-d2);if(tc<ht){ht=tc;hit=b;}}
    // with no pocket in line, the far point stops short of the cushion so short shots fill the frame
    const near=(x,z,q,m)=>{const d=Math.hypot(q[0]-x,q[1]-z);return d<=m?q:[x+(q[0]-x)*m/d,z+(q[1]-z)*m/d];};
    if(!hit){pts.push(near(cb.x,cb.z,railHit(cb.x,cb.z,dx,dz),2.2));return pts;}
    let nx=hit.x-(cb.x+dx*ht),nz=hit.z-(cb.z+dz*ht);const nl=Math.hypot(nx,nz)||1;nx/=nl;nz/=nl;
    pts.push([hit.x,hit.z]);
    let best=null,bd=.16;   // the pocket the object ball is sent towards, if any
    for(const q of POCKETS){const px=q.x-hit.x,pz=q.z-hit.z,t=px*nx+pz*nz;if(t<=0)continue;const off=Math.abs(px*nz-pz*nx);if(off<bd){bd=off;best=q;}}
    pts.push(best?[best.x,best.z]:near(hit.x,hit.z,railHit(hit.x,hit.z,nx,nz),.7));
    return pts;
  }
  function shotView(aim){
    const pts=aimTargets(aim);if(!pts)return false;
    const cb=pts[0],far=pts[pts.length-1],D=Math.hypot(far[0]-cb[0],far[1]-cb[1]);
    const a=Math.atan2(-Math.cos(aim),-Math.sin(aim)),el=clamp(.3+.1*D,.3,.6),fov=42;
    const tx=lerp(cb[0],far[0],.42),tz=lerp(cb[1],far[1],.42);
    const asp=width/Math.max(1,height),tf=Math.tan(fov*PI/360),ce=Math.cos(el),se=Math.sin(el),sa=Math.sin(a),ca=Math.cos(a);
    const fits=d=>{const ex=tx+d*ce*sa,ey=CLOTH_Y+d*se,ez=tz+d*ce*ca;
      for(const q of pts){const vx=q[0]-ex,vy=BALL_Y-ey,vz=q[1]-ez,zf=-(vx*ce*sa+vy*se+vz*ce*ca);if(zf<.15)return false;
        const nx=(vx*ca-vz*sa)/(zf*tf*asp),ny=(-vx*se*sa+vy*ce-vz*se*ca)/(zf*tf);
        if(Math.abs(nx)>.8||ny>.6||ny<-.5)return false;}   // clear of the screen edges, the top bar and the shot controls
      return true;};
    let lo=.5,hi=7;for(let i=0;i<18;i++){const m=(lo+hi)/2;if(fits(m))hi=m;else lo=m;}
    cam.az=a;cam.el=el;cam.fov=fov;cam.radius=hi/distFor(1,fov);cam.target=[tx,CLOTH_Y,tz];
    return true;
  }
  function tvView(side,el=.64,radius=4.4,fov=30){
    cam.az=side<0?-PI/2:PI/2;cam.el=el;cam.radius=radius;cam.fov=fov;cam.target=[0,-.10,0];
  }
  function directorPlan(){
    if(!state.started||state.finished)return tvView(-1,.62,4.5,30);
    if(state.inShot&&state.shot){
      // Cut once per shot to the TV side the balls run away from.
      const key=state.shotCount+'';
      if(cam.shotKey!==key){cam.shotKey=key;cam.runSide=Math.cos(state.shot.angle)>=0?-1:1;}
      return tvView(cam.runSide,.72,4.35,30);
    }
    cam.shotKey='';
    if(humanTurn()){
      if(state.ballInHand){cam.az=-PI/2;cam.el=1.0;cam.radius=4.95;cam.fov=42;cam.target=[-.1,CLOTH_Y,0];return;}
      return shotView(state.aim)||lineView(state.aim,.36,1.55,44,.55);
    }
    if(ai.plan){const a=ai.plan.aim,cb=cueBall(),fx=Math.cos(a),fz=Math.sin(a);
      // side-on to the opponent's line: the player and the shot both in view
      cam.az=Math.atan2(-fz,fx);cam.el=.66;cam.radius=2.7;cam.fov=40;cam.target=[cb.x+fx*.55,CLOTH_Y,cb.z+fz*.55];return;}
    const cb=cueBall();tvView(cb&&cb.x>HX*.4?1:-1);
  }
  const dockEl=document.querySelector('.control-dock');
  let viewShift=0;
  function updateCamera(dt){
    // while you aim, the cue ball sits low in the middle of the frame: captions move aside so they never cover it
    const aiming=!!(state.started&&!state.finished&&!state.inShot&&humanTurn()&&!state.ballInHand);
    if(aiming!==cam.aimingUI){cam.aimingUI=aiming;document.body.classList.toggle('aim-cam',aiming);}
    if(autoCamera){directorPlan();cam.focusName='AUTO FOLLOW';if($('focus-current'))$('focus-current').textContent='AUTO FOLLOW';}
    else if(cam.follow){const p=presets[PLAYER_PRESET];
      const aim=humanTurn()||!ai.plan?state.aim:ai.plan.aim;if(!shotView(aim))lineView(aim,p.el,p.radius,p.fov,.55);}
    const t=1-Math.pow(cam.follow||autoCamera&&!state.inShot&&humanTurn()?.0004:.001,dt);
    cam.curAz+=Math.atan2(Math.sin(cam.az-cam.curAz),Math.cos(cam.az-cam.curAz))*t;
    cam.curEl=lerp(cam.curEl,cam.el,t);cam.curRadius=lerp(cam.curRadius,cam.radius,t);cam.curFov=lerp(cam.curFov,cam.fov,t);cam.curZoom=lerp(cam.curZoom,cam.zoom,t);
    for(let j=0;j<3;j++)cam.curTarget[j]=lerp(cam.curTarget[j],cam.target[j],t);
    const r=distFor(cam.curRadius,cam.curFov)*cam.curZoom,a=cam.curAz,e=cam.curEl;
    eye=[cam.curTarget[0]+r*Math.cos(e)*Math.sin(a),cam.curTarget[1]+r*Math.sin(e),cam.curTarget[2]+r*Math.cos(e)*Math.cos(a)];
    camera.position.set(eye[0],eye[1],eye[2]);camera.up.set(0,1,0);camera.lookAt(cam.curTarget[0],cam.curTarget[1],cam.curTarget[2]);
    // Frame the table above the shot controls: shift the image up by half the
    // space they take, keeping the same scale.
    let want=0;
    if(dockEl&&state.started&&!document.body.classList.contains('hud-off')){const rc=dockEl.getBoundingClientRect();
      if(rc.height>0&&rc.top<height)want=clamp((height-rc.top)*.5,0,height*.2);}
    viewShift=lerp(viewShift,want,1-Math.exp(-dt*6));
    // and sideways, to the middle of the free space between the panels down the sides
    let wantX=0;
    if(state.started&&!document.body.classList.contains('hud-off')){const side=(el,left)=>{if(!el||+getComputedStyle(el).opacity<.3)return 0;const rc=el.getBoundingClientRect();
        if(!(rc.width>0&&rc.height>height*.3))return 0;return left?Math.max(0,rc.right):Math.max(0,width-rc.left);};
      wantX=clamp((side(sidePanels[0],true)-side(sidePanels[1],false))*.5,-width*.16,width*.16);}
    viewShiftX=lerp(viewShiftX,wantX,1-Math.exp(-dt*4));
    const s=Math.round(viewShift),sx=Math.round(viewShiftX),fov=2*Math.atan(Math.tan(cam.curFov*PI/360)*(height+2*s)/height)*180/PI;
    if(Math.abs(camera.fov-fov)>.01||!camera.view||!camera.view.enabled||camera.view.offsetY!==2*s||camera.view.fullHeight!==height+2*s||camera.view.fullWidth!==width+2*Math.abs(sx)||camera.view.offsetX!==(sx<0?2*-sx:0)){
      const W=width+2*Math.abs(sx);camera.fov=fov;camera.aspect=W/(height+2*s);camera.setViewOffset(W,height+2*s,sx<0?-2*sx:0,2*s,width,height);
    }
    // The lamp canopy shows only from below (its glowing underside); seen from
    // above it would just be a dark slab over the table, so it is left out.
    canopy.visible=eye[1]<CANOPY_Y-.12;
  }
  // Smart rail fade: only when the camera is low AND a ball sits close to the
  // cushion nearest the camera, that side's rail and cushion dissolve.
  function updateRailFade(dt){
    let want=0;const dir=fadeUniforms.uFadeDir.value;
    const lx=eye[0]-cam.curTarget[0],lz=eye[2]-cam.curTarget[2],ll=Math.hypot(lx,lz)||1;
    if(railFadeEnabled&&cam.curEl<.62){
      const ux=lx/ll,uz=lz/ll;let sx=0,sz=0;
      if(Math.abs(ux)*HZ>Math.abs(uz)*HX)sx=Math.sign(ux);else sz=Math.sign(uz);
      dir.set(sx/(HX+.02)*(sx?1:0),sz/(HZ+.02)*(sz?1:0));
      const near=balls.some(b=>!b.pocketed&&(sx?sx*b.x>HX-.16:sz*b.z>HZ-.16));
      if(near)want=clamp((.62-cam.curEl)*6,0,1);
    }
    fadeUniforms.uFadeAmt.value=lerp(fadeUniforms.uFadeAmt.value,want,1-Math.exp(-dt*5));
    // while any of it is see-through, the rails and cushions draw with their depth laid first (see ghostOf)
    const on=fadeUniforms.uFadeAmt.value>.004;
    if(on!==railGhosts){railGhosts=on;if(on&&!railMeshes){railMeshes=[];scene.traverse(o=>{if(o.isMesh&&!o.userData.ghostOf&&[].concat(o.material).some(mt=>mt&&mt.userData&&mt.userData.fadeable))railMeshes.push(o);});}
      for(const m of railMeshes||[]){for(const mt of [].concat(m.material)){if(mt.transparent!==on){mt.transparent=on;mt.needsUpdate=true;}}
        if(on||m.userData.ghost)ghostOf(m).visible=on;m.renderOrder=on?9:0;}}
  }
  let railGhosts=false,railMeshes=null;
  // See-through: the referee fades when he stands between the camera and a
  // ball; the score panels and controls fade while a ball sits behind them
  // (hover a panel to bring it back).
  const _seg=new T.Vector3(),_scr=new T.Vector3();
  let refFade=1,panelClock=0,viewShiftX=0;
  // Everything drawn over the picture steps out of the way of the balls: it
  // fades almost to nothing while any ball (its whole size on screen, with a
  // margin) is behind it; hover it to bring it back.
  const PANELS=['.scoreboard','.match-panel','.scene-controls','.control-dock','.camera-switcher','.camera-tag','.focus-tag','.comm-caption','.comm-tag',
    '.bot-skip','.control-hint','.toast','.arena-reaction','.top-bar'].map(q=>document.querySelector(q)).filter(Boolean);
  const sidePanels=[document.querySelector('.scene-controls'),document.querySelector('.match-panel')];
  function blocksView(x,z,radius,top){
    for(const b of balls){
      if(b.pocketed)continue;
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
    const p=ref.person;
    if(p){
      const want=blocksView(p.obj.position.x,p.obj.position.z,.34,1.9)?.16:1;
      const next=lerp(refFade,want,1-Math.exp(-dt*7));
      if(Math.abs(next-refFade)>.002||(want===1&&refFade!==1&&next>.995)){refFade=next>.995?1:next;setPersonOpacity(p,refFade);}
    }
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
  let aimMoveX=null,focusTagText='';
  function playerViewActive(){return (cam.follow||autoCamera)&&state.started&&!state.finished&&humanTurn()&&!state.ballInHand&&!state.inShot&&!isAnyOverlayOpen();}
  function paintFocusTag(){
    const t=playerViewActive()?'MOVE THE MOUSE LEFT / RIGHT TO AIM · SHIFT FOR FINE · CLICK A BALL TO AIM AT IT':'AIM WITH YOUR MOUSE';
    if(t!==focusTagText&&$('focus-tag')){focusTagText=t;$('focus-tag').textContent=t;}
  }
