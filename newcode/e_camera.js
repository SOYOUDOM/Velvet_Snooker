  // ---- CAMERA ---------------------------------------------------------------
  // Television camera plan: the main camera sits high behind the baulk end
  // looking down the table; the reverse camera covers play from the top end.
  let autoCamera=true, railFadeEnabled=true, focusPicking=false, tvSide=-1, tvKey=-1;
  const cam={az:-PI/2,el:.5,radius:5.0,mode:0,
    curAz:-PI/2,curEl:.5,curRadius:5.0,target:[0,-.10,0],curTarget:[0,-.10,0],focusName:"TABLE CENTRE"};
  const presets=[
    {az:-PI/2,el:.52,radius:4.45,name:'TV MAIN',n:'01'},
    {az:0,el:1.558,radius:4.75,name:'OVERHEAD',n:'02'},
    {az:PI/2,el:.52,radius:4.45,name:'TV REVERSE',n:'03'},
    {az:1.35,el:.62,radius:5.0,name:'SIDE VIEW',n:'04'},
    {az:.42,el:.86,radius:5.15,name:'THREE-QUARTER',n:'05'},
    {az:-.48,el:1.30,radius:4.6,name:'HIGH ANGLE',n:'06'}
  ];
  const OVERHEAD_PRESET=1;
  function cameraLabel(name,n){$('camera-tag').innerHTML='<div class="camera-cross">⌗</div><span>'+name+' <b>'+n+'</b></span>';}
  function setCamera(mode){
    autoCamera=false;cam.mode=(mode+presets.length)%presets.length;
    const a=presets[cam.mode];Object.assign(cam,{az:a.az,el:a.el,radius:a.radius});
    $('auto-camera-button').classList.remove('active');$('auto-camera-button').setAttribute('aria-pressed','false');
    cameraLabel(a.name,a.n);
  }
  function setAutoCamera(on){
    autoCamera=on; $('auto-camera-button').classList.toggle('active',on);
    $('auto-camera-button').setAttribute('aria-pressed',String(on));
    if(on){cameraLabel('AUTO DIRECTOR','●');tvKey=-1;}
    else cameraLabel('FREE CAMERA','◎');
  }
  function focusOn(x,z,label='CUSTOM POINT'){
    setAutoCamera(false);cam.target=[clamp(x,-HX-.48,HX+.48),-.06,clamp(z,-HZ-.55,HZ+.55)];
    cam.focusName=label;focusPicking=false;
    $('focus-pick').classList.remove('active');$('focus-current').textContent=label;
    cameraLabel('FOCUS · '+label,'◉');
  }
  function updateCamera(dt){
    if(autoCamera){
      // Like a TV director: pick main or reverse once per turn and cut, never swing.
      if(!state.inShot&&tvKey!==state.shotCount){
        tvKey=state.shotCount;const cb=cueBall();const side=cb&&cb.x>HX*.62?1:-1;
        if(side!==tvSide){tvSide=side;const p=presets[side<0?0:2];cam.curAz=p.az;cam.curEl=p.el;cam.curRadius=p.radius;cam.curTarget=[0,-.10,0];}
      }
      const p=presets[tvSide<0?0:2];cam.az=p.az;cam.el=p.el;cam.radius=p.radius;
      cam.target=[0,-.10,0];cam.focusName='AUTO FOLLOW';
      if($('focus-current'))$('focus-current').textContent='AUTO FOLLOW';
    }
    const t=1-Math.pow(.001,dt);
    cam.curAz+=Math.atan2(Math.sin(cam.az-cam.curAz),Math.cos(cam.az-cam.curAz))*t;
    cam.curEl=lerp(cam.curEl,cam.el,t);cam.curRadius=lerp(cam.curRadius,cam.radius,t);
    for(let j=0;j<3;j++)cam.curTarget[j]=lerp(cam.curTarget[j],cam.target[j],t);
    const r=cam.curRadius*RADIUS_SCALE,a=cam.curAz,e=cam.curEl;
    eye=[cam.curTarget[0]+r*Math.cos(e)*Math.sin(a),cam.curTarget[1]+r*Math.sin(e),cam.curTarget[2]+r*Math.cos(e)*Math.cos(a)];
    camera.position.set(eye[0],eye[1],eye[2]);camera.up.set(0,1,0);camera.lookAt(cam.curTarget[0],cam.curTarget[1],cam.curTarget[2]);
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
      // Nearest rail side in the camera's direction.
      const ux=lx/ll,uz=lz/ll;let sx=0,sz=0;
      if(Math.abs(ux)*HZ>Math.abs(uz)*HX)sx=Math.sign(ux);else sz=Math.sign(uz);
      dir.set(sx/(HX+.02)*(sx?1:0),sz/(HZ+.02)*(sz?1:0));
      const near=balls.some(b=>!b.pocketed&&(sx?sx*b.x>HX-.16:sz*b.z>HZ-.16));
      if(near)want=clamp((.62-cam.curEl)*6,0,1);
    }
    fadeUniforms.uFadeAmt.value=lerp(fadeUniforms.uFadeAmt.value,want,1-Math.exp(-dt*5));
  }
  function screenToTable(clientX,clientY){
    const rect=canvas.getBoundingClientRect();const nx=(clientX-rect.left)/rect.width*2-1,ny=1-(clientY-rect.top)/rect.height*2;
    const forward=norm(sub(cam.curTarget,eye)),right=norm(cross(forward,[0,1,0])),up=cross(right,forward);
    const t=Math.tan(FOV_DEG*PI/360),a=width/height;
    const dir=norm([forward[0]+right[0]*nx*t*a+up[0]*ny*t,forward[1]+right[1]*nx*t*a+up[1]*ny*t,forward[2]+right[2]*nx*t*a+up[2]*ny*t]);
    if(dir[1]>=-.001)return null;
    const dist=(BALL_Y-eye[1])/dir[1];if(dist<0)return null;
    return [eye[0]+dir[0]*dist,eye[2]+dir[2]*dist];
  }
  const _size=new T.Vector2();
  function resize(){
    width=canvas.clientWidth||window.innerWidth;height=canvas.clientHeight||window.innerHeight;
    const ratio=Math.min(window.devicePixelRatio||1,QUALITY[quality].ratio);
    if(Math.abs(renderer.getPixelRatio()-ratio)>.01){renderer.setPixelRatio(ratio);if(composer)composer.setPixelRatio(ratio);}
    renderer.getSize(_size);
    if(_size.x!==width||_size.y!==height){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();if(composer)composer.setSize(width,height);}
  }
