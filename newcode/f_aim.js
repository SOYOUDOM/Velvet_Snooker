  // Straight-line reach of the current aim (used to rate a shot's difficulty).
  function shootLine(){
    const cue=cueBall();if(!cue)return null;
    const dx=Math.cos(state.aim),dz=Math.sin(state.aim);
    let reach=2.2,hit=null;
    for(const b of balls){if(b.pocketed||b.type==='cue')continue;
      const ax=b.x-cue.x,az=b.z-cue.z,forward=ax*dx+az*dz;
      if(forward<=0)continue;
      const perp2=ax*ax+az*az-forward*forward,min=(2*R)*(2*R);
      if(perp2>min)continue;
      const t=forward-Math.sqrt(Math.max(0,min-perp2));
      if(t>0&&t<reach){reach=t;hit=b;}
    }
    for(const boundary of [{d:dx,limit:HX-R,x:true},{d:-dx,limit:HX-R,x:true},{d:dz,limit:HZ-R,x:false},{d:-dz,limit:HZ-R,x:false}]){
      const source=boundary.x?(boundary.d===dx?cue.x:-cue.x):(boundary.d===dz?cue.z:-cue.z);
      if(boundary.d>.0001){const t=(boundary.limit-source)/boundary.d;if(t>0)reach=Math.min(reach,t);}
    }
    return {dx,dz,reach:Math.max(.02,reach),hit};
  }
  // ---- CUE-BALL PATH PREDICTION (aiming guide + bot planning) ---------------
  // Runs the game's own physics on a private copy of the cue ball, every other
  // ball held still, until it touches a ball, drops into a pocket, stops, or
  // has used its cushions. Before the first contact only the cue ball moves,
  // so this is exactly the path the real shot will take - cushions included.
  function cueStrikeState(cue,aim,cfg){
    const p=cfg.power/100,velocity=.20+4.7*Math.pow(p,1.23),forwardSpin=velocity/R*(1+cfg.spinY*2.4);
    return{x:cue.x,z:cue.z,vx:Math.cos(aim)*velocity,vz:Math.sin(aim)*velocity,
      wx:Math.sin(aim)*forwardSpin,wz:-Math.cos(aim)*forwardSpin,wy:cfg.spinX*52,q:[0,0,0,1],velocity};
  }
  function contactT(ax,az,bx,bz,ox,oz){
    const dx=bx-ax,dz=bz-az,fx=ax-ox,fz=az-oz,a=dx*dx+dz*dz,b=2*(fx*dx+fz*dz),c=fx*fx+fz*fz-4*R*R;
    if(c<=0)return 0;if(a<1e-14)return 1;const disc=b*b-4*a*c;if(disc<0)return 1;
    return clamp((-b-Math.sqrt(disc))/(2*a),0,1);
  }
  function tracePath(aim,cfg,maxCushions=3,record=true){
    const cue=cueBall();if(!cue)return null;
    const b=cueStrikeState(cue,aim,cfg),others=balls.filter(o=>!o.pocketed&&o!==cue);
    const pts=record?[[b.x,b.z]]:null;let cushions=0,bounced=false,potted=false,lx=b.x,lz=b.z;
    const onPocket=()=>{potted=true;},onCushion=()=>{cushions++;bounced=true;};
    for(let i=0;i<180*14;i++){
      const px=b.x,pz=b.z;bounced=false;
      advanceOnCloth(b,STEP);
      if(tableContacts(b,onPocket,onCushion)){if(pts)pts.push([b.x,b.z]);return{pts,end:'pocket',cushions};}
      let hit=null,ht=2;
      for(const o of others){const dx=b.x-o.x,dz=b.z-o.z;if(dx*dx+dz*dz<4*R*R){const t=contactT(px,pz,b.x,b.z,o.x,o.z);if(t<ht){ht=t;hit=o;}}}
      if(hit){const contact=[px+(b.x-px)*ht,pz+(b.z-pz)*ht];if(pts)pts.push(contact);return{pts,end:'ball',hit,contact,cushions};}
      if(pts&&(bounced||Math.hypot(b.x-lx,b.z-lz)>.025)){pts.push([b.x,b.z]);lx=b.x;lz=b.z;}
      if(cushions>maxCushions)return{pts,end:'limit',cushions};
      if(b.vx===0&&b.vz===0){if(pts)pts.push([b.x,b.z]);return{pts,end:'stop',cushions};}
    }
    return{pts,end:'limit',cushions};
  }
  // Is a first contact with this ball legal for the striker right now?
  function legalFirst(type){
    if(!type)return false;
    if(state.freeBall)return true;
    if(state.phase==='red')return type==='red';
    if(state.phase==='color')return state.nominated?type===state.nominated:COLOR_ORDER.includes(type);
    return type===onBall();
  }

  // ---- AIM, CUE & BALL VISUALS ----------------------------------------------
  const AIM_GUIDES=['full','short','off'];
  let aimGuide=(()=>{try{const v=localStorage.getItem('velvet.aimGuide');return AIM_GUIDES.includes(v)?v:'full';}catch(e){return 'full';}})();
  // Guide ribbons: one dynamic mesh of flat quads lying on the cloth.
  const GUIDE_MAX=1600,guidePos=new Float32Array(GUIDE_MAX*12),guideCol=new Float32Array(GUIDE_MAX*16),guideIdx=new Uint16Array(GUIDE_MAX*6);
  for(let i=0;i<GUIDE_MAX;i++){const a=i*4;guideIdx.set([a,a+2,a+1,a+1,a+2,a+3],i*6);}
  const guideGeo=new T.BufferGeometry();
  guideGeo.setAttribute('position',new T.BufferAttribute(guidePos,3).setUsage(T.DynamicDrawUsage));
  guideGeo.setAttribute('color',new T.BufferAttribute(guideCol,4).setUsage(T.DynamicDrawUsage));
  guideGeo.setIndex(new T.BufferAttribute(guideIdx,1));
  const guideMesh=new T.Mesh(guideGeo,new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,toneMapped:false,side:T.DoubleSide}));
  guideMesh.frustumCulled=false;guideMesh.renderOrder=3;scene.add(guideMesh);
  let guideN=0;const GUIDE_Y=CLOTH_Y+.0016;
  function guideSeg(x1,z1,x2,z2,w,c,a1,a2=a1){
    if(guideN>=GUIDE_MAX)return;const dx=x2-x1,dz=z2-z1,l=Math.hypot(dx,dz);if(l<1e-5)return;
    const nx=-dz/l*w/2,nz=dx/l*w/2,o=guideN*12,k=guideN*16;
    guidePos.set([x1+nx,GUIDE_Y,z1+nz,x1-nx,GUIDE_Y,z1-nz,x2+nx,GUIDE_Y,z2+nz,x2-nx,GUIDE_Y,z2-nz],o);
    guideCol.set([c[0],c[1],c[2],a1,c[0],c[1],c[2],a1,c[0],c[1],c[2],a2,c[0],c[1],c[2],a2],k);
    guideN++;
  }
  function guideRing(x,z,r,w,c,a){const n=40;for(let i=0;i<n;i++){const a0=i/n*TAU,a1=(i+1)/n*TAU;guideSeg(x+Math.cos(a0)*r,z+Math.sin(a0)*r,x+Math.cos(a1)*r,z+Math.sin(a1)*r,w,c,a);}}
  function guideFlush(){guideGeo.setDrawRange(0,guideN*6);guideGeo.attributes.position.needsUpdate=true;guideGeo.attributes.color.needsUpdate=true;}
  const WHITE=[1,1,.97],GOLD=[1,.68,.16],LEGAL=[.55,1,.62],FOUL=[1,.3,.26];
  let guideCache={key:'',trace:null};
  function drawGuide(cue,aim,cfg,col,full){
    const w=clamp(Math.hypot(eye[0]-cue.x,eye[1],eye[2]-cue.z)*.0009,.0028,.0068);
    const key=[aim.toFixed(5),cfg.power,cfg.spinX.toFixed(3),cfg.spinY.toFixed(3),cue.x.toFixed(4),cue.z.toFixed(4),state.shotCount,state.phase,state.nominated,full].join('|');
    if(guideCache.key!==key)guideCache={key,trace:tracePath(aim,cfg,full?3:0)};
    const tr=guideCache.trace;if(!tr||!tr.pts||tr.pts.length<2)return;
    // Path: start just off the cue ball; SHORT stops after 36 cm.
    let travelled=0;const limit=full?1e9:.36;
    for(let i=1;i<tr.pts.length;i++){
      const a=tr.pts[i-1],b=tr.pts[i],seg=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(travelled+seg<=R*1.05){travelled+=seg;continue;}
      let ax=a[0],az=a[1],bx=b[0],bz=b[1];
      if(travelled<R*1.05){const t=(R*1.05-travelled)/seg;ax=lerp(a[0],b[0],t);az=lerp(a[1],b[1],t);}
      if(travelled+seg>limit){const t=(limit-travelled)/seg;bx=lerp(a[0],b[0],t);bz=lerp(a[1],b[1],t);}
      const fadeA=full?.92:.92*(1-travelled/limit),fadeB=full?.92:.92*(1-Math.min(1,(travelled+seg)/limit));
      guideSeg(ax,az,bx,bz,w,col,Math.max(.12,fadeA),Math.max(.05,fadeB));
      travelled+=seg;if(travelled>=limit)break;
    }
    if(!full)return;
    if(tr.end==='ball'){
      const ok=legalFirst(tr.hit.type),rc=ok?LEGAL:FOUL;
      guideRing(tr.contact[0],tr.contact[1],R*.98,w*.85,rc,.95);
      const ox=tr.hit.x-tr.contact[0],oz=tr.hit.z-tr.contact[1],od=Math.hypot(ox,oz)||1;
      for(let i=0;i<5;i++){const a=R+i*.06,b=R+(i+1)*.06;
        guideSeg(tr.hit.x+ox/od*a,tr.hit.z+oz/od*a,tr.hit.x+ox/od*b,tr.hit.z+oz/od*b,w*.9,rc,.8-i*.15,.8-(i+1)*.15);}
    }else if(tr.end==='pocket'){const e=tr.pts[tr.pts.length-1];guideRing(e[0],e[1],R*1.1,w*1.1,FOUL,.95);}
    else if(tr.end==='stop'){const e=tr.pts[tr.pts.length-1];guideRing(e[0],e[1],R*.6,w*.8,col,.8);}
  }

  // The cue: ash shaft, ebony butt with splice, brass ferrule, chalked tip.
  const cueGroup=new T.Group();scene.add(cueGroup);
  (()=>{
    const ash=new T.MeshPhysicalMaterial({color:'#e2c59a',roughness:.38,clearcoat:.5,clearcoatRoughness:.3});
    const ebony=new T.MeshPhysicalMaterial({color:'#1a100b',roughness:.32,clearcoat:.7,clearcoatRoughness:.2});
    const brass=new T.MeshStandardMaterial({color:'#c9a45c',roughness:.28,metalness:.85});
    const tipMat=new T.MeshStandardMaterial({color:'#3a6f8a',roughness:.9});
    const seg=(r0,r1,len,y0,mat)=>{const m=new T.Mesh(new T.CylinderGeometry(r0,r1,len,28),mat);m.position.y=y0+len/2;m.castShadow=true;cueGroup.add(m);};
    seg(.0048,.0048,.006,0,tipMat);seg(.0049,.0049,.022,.006,brass);
    seg(.0050,.0098,.84,.028,ash);seg(.0098,.0128,.30,.868,ebony);seg(.0128,.0148,.27,1.168,ebony);seg(.0149,.0149,.012,1.438,brass);
  })();
  // Thin markers: nomination rings around colours and the cue-ball-in-hand ring.
  const markerMat=new T.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false,toneMapped:false});
  const ringPool=[];
  function ringMarker(i,x,z,r,color,alpha){
    let m=ringPool[i];
    if(!m){m=new T.Mesh(new T.TorusGeometry(1,.06,6,64).rotateX(PI/2),markerMat.clone());m.renderOrder=4;scene.add(m);ringPool[i]=m;}
    m.visible=true;m.position.set(x,CLOTH_Y+.0025,z);m.scale.set(r,r*.6,r);m.material.color.setRGB(color[0],color[1],color[2]);m.material.opacity=alpha;
  }
  function updateAimVisuals(){
    guideN=0;let rings=0;
    cueGroup.visible=false;
    const striking=state.inShot&&state.cueAnimation>0&&state.shot;
    const show=state.started&&!state.finished&&(striking||(!state.inShot&&(humanTurn()||ai.plan)));
    const activeCue=cueBall();
    if(show&&activeCue){
      const cue=(state.inShot&&state.shot)?{...activeCue,x:state.shot.cueOrigin[0],z:state.shot.cueOrigin[1]}:activeCue;
      const human=humanTurn();
      if(state.phase==='color'&&!state.inShot&&human){
        for(const b of balls){if(b.pocketed||!COLOR_ORDER.includes(b.type))continue;
          const chosen=state.nominated===b.type;ringMarker(rings++,b.x,b.z,R*1.55,chosen?[1,.82,.45]:[.75,.92,.78],chosen?.9:.4);}
      }
      if(state.ballInHand&&human&&!state.inShot)ringMarker(rings++,cue.x,cue.z,R*1.8,[1,.9,.62],.8);
      // Guide: yours in white; the bot's planned shot in gold, so you can see
      // how it intends to play (including its snooker escapes).
      if(!state.inShot&&aimGuide!=='off'){
        if(human)drawGuide(cue,state.aim,shotSettings(),WHITE,aimGuide==='full');
        else if(ai.plan)drawGuide(cue,ai.plan.aim,{power:ai.plan.power,spinX:ai.plan.spinX,spinY:ai.plan.spinY},GOLD,aimGuide==='full');
      }
      const aim=striking?state.shot.angle:human?state.aim:(ai.plan?ai.plan.aim:state.aim);
      const pull=state.cueAnimation>0?.10*(state.cueAnimation/.25):0;
      const dx=Math.cos(aim),dz=Math.sin(aim),elev=.07,tip=R+.009+pull;
      cueGroup.visible=true;
      cueGroup.position.set(cue.x-dx*tip,BALL_Y+.004,cue.z-dz*tip);
      cueGroup.quaternion.setFromUnitVectors(UP,new T.Vector3(-dx*Math.cos(elev),Math.sin(elev),-dz*Math.cos(elev)));
    }
    for(let i=rings;i<ringPool.length;i++)ringPool[i].visible=false;
    guideFlush();
  }
  // Balls: one mesh per ball (plus soft contact shadow), and the balls that
  // are dropping or resting in the pocket nets.
  const ballMeshes=new Map(),fallingMeshes=[];
  function ballMesh(id,type){
    let e=ballMeshes.get(id);
    if(!e||e.type!==type){
      if(e){scene.remove(e.mesh,e.blob);}
      const mesh=new T.Mesh(ballGeo,ballMats[type]);mesh.castShadow=true;mesh.receiveShadow=true;
      const blob=new T.Mesh(blobGeo,blobMat);blob.renderOrder=2;scene.add(mesh,blob);e={mesh,blob,type};ballMeshes.set(id,e);
    }
    return e;
  }
  function syncBalls(){
    const live=new Set();
    for(const b of balls){const e=ballMesh(b.id,b.type);live.add(b.id);
      e.mesh.visible=e.blob.visible=!b.pocketed;
      if(!b.pocketed){e.mesh.position.set(b.x,BALL_Y,b.z);e.mesh.quaternion.set(b.q[0],b.q[1],b.q[2],b.q[3]);e.blob.position.set(b.x,CLOTH_Y+.0008,b.z);}}
    for(const [id,e] of ballMeshes)if(!live.has(id)){scene.remove(e.mesh,e.blob);ballMeshes.delete(id);}
    falling.forEach((f,i)=>{let m=fallingMeshes[i];if(!m){m=new T.Mesh(ballGeo,ballMats.red);m.castShadow=true;scene.add(m);fallingMeshes[i]=m;}
      m.visible=true;m.material=ballMats[f.type];m.position.set(f.x,f.y,f.z);});
    for(let i=falling.length;i<fallingMeshes.length;i++)fallingMeshes[i].visible=false;
  }
  // ---- quality ----
  function applyQuality(){
    const q=QUALITY[quality];
    keyLight.castShadow=q.shadow>0;
    if(q.shadow>0&&keyLight.shadow.mapSize.x!==q.shadow){keyLight.shadow.mapSize.set(q.shadow,q.shadow);if(keyLight.shadow.map){keyLight.shadow.map.dispose();keyLight.shadow.map=null;}}
    if(q.bloom)ensureComposer();
    for(const c of crowd)c.p.obj.visible=c.rank<q.crowd;
    resize();
    const b=$('quality-toggle');if(b){b.textContent='QUALITY · '+quality.toUpperCase();b.classList.toggle('active',quality==='high');}
  }
  // Automatic step-down once if the first seconds of play run slowly.
  let perf={t:0,frames:0,checked:false};
  function watchPerformance(dt){
    if(qualityChosen||perf.checked||!state.started)return;
    perf.t+=dt;perf.frames++;
    if(perf.t>6){perf.checked=true;const fps=perf.frames/perf.t;
      if(fps<34&&quality!=='low'){quality=quality==='high'?'medium':'low';applyQuality();message('QUALITY · '+quality.toUpperCase(),'LOWERED AUTOMATICALLY FOR SMOOTH PLAY',2600);}}
  }
  function render(dt){
    syncBalls();syncNets();updateAimVisuals();updateRailFade(dt);
    if(QUALITY[quality].bloom&&ensureComposer())composer.render(dt);else renderer.render(scene,camera);
  }
