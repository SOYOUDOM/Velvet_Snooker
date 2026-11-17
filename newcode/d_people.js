  // ---- ARENA PEOPLE: REFEREE & AUDIENCE --------------------------------------
  // Realistic rigged people (Microsoft Rocketbox library, MIT licence) with
  // motion-captured clips. The referee walks around the table, retrieves
  // colours and the cue ball from the pockets and re-spots them; the audience
  // sits, breathes, follows the play with their heads and applauds good shots.
  const arena={kind:'quiet',until:0,started:0,intensity:0,show:true};
  const crowd=[],crowdGroup=new T.Group();scene.add(crowdGroup);
  const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
  // The referee's walking loop around the table, sampled every 2 cm.
  const loop=(()=>{const base=roundedRect(OUT_X+.55,OUT_Z+.55,.42);base.push(base[0]);const pts=[];
    for(let i=0;i<base.length-1;i++){const a=base[i],b=base[i+1],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.02));
      for(let k=0;k<n;k++)pts.push([lerp(a[0],b[0],k/n),lerp(a[1],b[1],k/n)]);}
    const cum=[0];for(let i=1;i<=pts.length;i++){const a=pts[i-1],b=pts[i%pts.length];cum.push(cum[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1]));}
    return{pts,cum,len:cum[pts.length]};})();
  function loopAt(s){
    s=((s%loop.len)+loop.len)%loop.len;let lo=0,hi=loop.pts.length-1;
    while(lo<hi){const mid=(lo+hi+1)>>1;if(loop.cum[mid]<=s)lo=mid;else hi=mid-1;}
    const a=loop.pts[lo],b=loop.pts[(lo+1)%loop.pts.length],seg=(loop.cum[lo+1]-loop.cum[lo])||1,t=(s-loop.cum[lo])/seg;
    return{x:lerp(a[0],b[0],t),z:lerp(a[1],b[1],t),dx:(b[0]-a[0])/seg,dz:(b[1]-a[1])/seg};
  }
  function loopNearest(x,z){let best=0,bd=1e9;loop.pts.forEach((p,i)=>{const d=(p[0]-x)**2+(p[1]-z)**2;if(d<bd){bd=d;best=i;}});return loop.cum[best];}
  const ref={s:0,v:0,home:0,targetS:0,queue:[],task:null,waitUntil:0,person:null,yaw:PI,acts:null,takeW:0,walkW:0};
  ref.home=ref.s=ref.targetS=loopNearest(-.85,OUT_Z+.55);

  const _tq=new T.Quaternion(),_pq=new T.Quaternion(),_iq=new T.Quaternion(),_hp=new T.Vector3(),UP=new T.Vector3(0,1,0);
  // Turn neck and head about the vertical toward a point on the table.
  function turnHead(p,bodyYaw,tx,tz,amount){
    if(!p.head||amount<=.01)return;
    p.head.getWorldPosition(_hp);
    const yaw=clamp(wrapAngle(Math.atan2(tx-_hp.x,tz-_hp.z)-bodyYaw),-1.15,1.15)*amount;
    for(const [bone,share] of [[p.neck,.4],[p.head,.6]]){
      if(!bone)continue;bone.parent.getWorldQuaternion(_pq);_iq.copy(_pq).invert();_tq.setFromAxisAngle(UP,yaw*share);
      bone.quaternion.premultiply(_pq).premultiply(_tq).premultiply(_iq);
    }
  }
  function focusPoint(){
    const moving=balls.filter(b=>!b.pocketed&&Math.hypot(b.vx,b.vz)>.06);
    if(state.inShot&&moving.length){let x=0,z=0;for(const b of moving){x+=b.x;z+=b.z;}return[x/moving.length,z/moving.length];}
    const cb=cueBall();return cb?[cb.x,cb.z]:[0,0];
  }

  function spawnPeople(){
    const P=window.VelvetPeople;if(!P||!P.ready)return;
    const rp=P.spawn('Business_Male_06');scene.add(rp.obj);ref.person=rp;
    rp.obj.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    ref.acts={idle:rp.play('m_idle_neutral_01',{weight:1}),walk:rp.play('m_walk_neutral_01',{weight:0}),take:rp.play('m_documents_take',{weight:0})};
    ref.acts.take.setLoop(T.LoopOnce,1);ref.acts.take.clampWhenFinished=true;ref.acts.take.stop();
    const males=['Business_Male_02','Business_Male_04','Male_Adult_03','Male_Adult_04','Male_Adult_07','Male_Adult_08','Male_Adult_13'];
    const females=['Business_Female_01','Business_Female_03','Female_Adult_04','Female_Adult_09','Female_Adult_13'];
    const mIdle=['m_sit_chair_idle_neutral_01','m_sit_chair_idle_relaxed_01','m_sit_chair_breathe_01','m_sit_chair_idle_look_around','m_sit_chair_gestic_thoughtful'];
    const fIdle=['f_sit_chair_idle_neutral_01','f_sit_chair_breathe_01','f_sit_chair_idle_look_around'];
    let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
    for(const st of seats){
      const female=rnd()<.38,pool=female?females:males,name=pool[Math.floor(rnd()*pool.length)];
      const p=P.spawn(name);
      p.obj.position.set(st.x+Math.sin(st.yaw)*.05,st.y,st.z+Math.cos(st.yaw)*.05);p.obj.rotation.y=st.yaw;
      p.obj.scale.setScalar(.97+rnd()*.06);
      p.obj.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
      const idles=female?fIdle:mIdle,idle=idles[Math.floor(rnd()*idles.length)],t0=rnd()*30;
      crowd.push({p,yaw:st.yaw,rank:rnd(),acc:rnd()*.06,look:.3,clapAmt:0,clapTarget:0,clapStart:0,clapEnd:0,
        idle:p.play(idle,{time:t0}),body:p.play(idle,{part:'body',time:t0,weight:0}),
        clap:p.play('m_claphands_01',{part:'arms',time:.4+rnd()*5,weight:0,timeScale:.95+rnd()*.2})});
      crowdGroup.add(p.obj);
    }
    applyQuality();
  }
  function startPeople(){
    const P=window.VelvetPeople,data=window.VELVET_PEOPLE_DATA;
    if(!P||!data){console.warn('VELVET: people data not found; playing without referee and audience.');return;}
    P.load(data).then(spawnPeople).catch(e=>console.warn('VELVET: could not load the people',e));
  }

  function updateReferee(dt){
    if(!ref.task&&ref.queue.length){ref.task=ref.queue.shift();ref.task.started=false;ref.targetS=ref.task.s;}
    let delta=ref.targetS-ref.s;delta-=Math.round(delta/loop.len)*loop.len;
    ref.v=lerp(ref.v,clamp(delta*2.0,-.95,.95),1-Math.exp(-dt*4.2));
    if(Math.abs(delta)<.012&&Math.abs(ref.v)<.05)ref.v=0;
    ref.s+=ref.v*dt;
    const at=loopAt(ref.s),speed=Math.abs(ref.v);
    if(ref.task&&Math.abs(delta)<.03&&speed<.08){
      if(!ref.task.started){ref.task.started=true;ref.task.until=time+2.7;
        if(ref.acts){const a=ref.acts.take;a.reset();a.setEffectiveTimeScale(1.75);a.play();}}
      else if(time>ref.task.until){ref.task=null;if(!ref.queue.length)ref.waitUntil=time+1.1;}
    }
    if(!ref.task&&!ref.queue.length&&ref.waitUntil&&time>ref.waitUntil){ref.targetS=ref.home;ref.waitUntil=0;}
    const fp=focusPoint();
    const face=speed>.07?Math.atan2(at.dx*Math.sign(ref.v),at.dz*Math.sign(ref.v))
      :ref.task?Math.atan2(ref.task.x-at.x,ref.task.z-at.z):Math.atan2(fp[0]*.4-at.x,fp[1]*.4-at.z);
    ref.yaw+=wrapAngle(face-ref.yaw)*(1-Math.exp(-dt*5.5));
    const p=ref.person;if(!p)return;
    p.obj.position.set(at.x,FLOOR_Y,at.z);p.obj.rotation.y=ref.yaw;
    const taking=!!(ref.task&&ref.task.started&&time<ref.task.until);
    ref.takeW=lerp(ref.takeW,taking?1:0,1-Math.exp(-dt*(taking?5:3.5)));
    ref.walkW=lerp(ref.walkW,clamp((speed-.05)/.3,0,1),1-Math.exp(-dt*8));
    const {idle,walk,take}=ref.acts;
    take.setEffectiveWeight(ref.takeW);walk.setEffectiveWeight((1-ref.takeW)*ref.walkW);idle.setEffectiveWeight((1-ref.takeW)*(1-ref.walkW));
    walk.setEffectiveTimeScale(clamp(speed/1.01,.55,1.3));
    p.mixer.update(dt);
    const look=ref.task?[ref.task.x,ref.task.z]:fp;
    turnHead(p,ref.yaw,look[0],look[1],.8);
  }
  function updateCrowd(dt){
    if(!crowd.length||!crowdGroup.visible)return;
    const step=1/QUALITY[quality].crowdHz,fp=focusPoint(),interest=state.inShot?.85:.35;
    for(const c of crowd){
      if(!c.p.obj.visible)continue;
      c.acc+=dt;if(c.acc<step*.98)continue;const d=Math.min(c.acc,.25);c.acc=0;
      const want=time>=c.clapStart&&time<c.clapEnd?c.clapTarget:0;
      c.clapAmt+=(want-c.clapAmt)*(1-Math.exp(-d*6));
      c.idle.setEffectiveWeight(1-c.clapAmt);c.body.setEffectiveWeight(c.clapAmt);c.clap.setEffectiveWeight(c.clapAmt);
      c.p.mixer.update(d);
      c.look+=(interest-c.look)*(1-Math.exp(-d*1.8));
      turnHead(c.p,c.yaw,fp[0],fp[1],c.look);
    }
  }
  function crowdReact(kind){
    const chance=kind==='cheer'?.97:kind==='polite'?.6:0;
    for(const c of crowd){
      if(Math.random()>=chance)continue;
      c.clapTarget=kind==='cheer'?1:.9;c.clapStart=time+rand(.06,.6);
      c.clapEnd=time+(kind==='cheer'?rand(3.6,5.6):rand(1.6,3.0));
      c.clap.setEffectiveTimeScale(kind==='cheer'?rand(1.2,1.45):rand(.9,1.1));
    }
  }
  function reactToShot(potCount, foul=false){
    if(!state.started)return;
    const s=state.shot;const dist=s?.difficulty||0;
    let kind='quiet',intensity=0,messageText='';
    if(foul&&s?.cueScratch){kind='gasp';intensity=.30;messageText='A RARE IN-OFF · A HUSH IN THE ROOM';}
    else if(potCount>0){
      if(potCount>=2||dist>1.75){kind='cheer';intensity=1;messageText='WHAT A POT! · THE CROWD RISES';}
      else if(dist>.92){kind='polite';intensity=.43;messageText='A BEAUTIFUL POT · POLITE APPLAUSE';}
      // An ordinary short pot remains quiet, as at an actual snooker match.
    }
    arena.kind=kind;arena.intensity=intensity;arena.started=time;arena.until=time+(kind==='cheer'?4.6:kind==='gasp'?1.8:kind==='polite'?2.5:.2);
    $('crowd-reaction').classList.toggle('visible',intensity>0);
    $('crowd-reaction').textContent=messageText;
    $('crowd-gif').hidden=true; // the 3D audience reacts now; the old 2D clip stays hidden
    crowdReact(kind);
    // The referee retrieves colours (and an in-off cue ball) and re-spots them.
    const potted=s?.potted||[],stage=state.phase;
    const spotted=potted.filter(t=>COLOR_ORDER.includes(t)&&(foul||stage!=='clearance'));
    const fetchType=spotted[0]||(s?.cueScratch?'cue':null);
    if(fetchType){
      const f=[...falling].reverse().find(x=>x.type===fetchType)||falling[falling.length-1];
      if(f){const pk=POCKETS[f.pocketId];
        ref.queue=[{s:loopNearest(pk.x,pk.z),x:pk.x,z:pk.z}];
        const dest=fetchType==='cue'?[BAULK_X-.15,0]:SPOTS[fetchType];
        ref.queue.push({s:loopNearest(dest[0],dest[1]),x:dest[0],z:dest[1]});
        ref.task=null;ref.waitUntil=0;}
    }
    if(kind==='cheer')sound('cheer',.82);
    else if(kind==='polite')sound('applause',.40);
    else if(kind==='gasp')sound('gasp',.43);
  }
