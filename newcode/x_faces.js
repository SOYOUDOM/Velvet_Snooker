  // ---- FACES -----------------------------------------------------------------
  // The players and the referee have faces that move. They blink, show how a
  // shot went (the same moments as the body reactions), narrow their eyes over
  // a shot, follow the play with their eyes (small saccades, never further than
  // eyes can turn), and the referee's mouth moves with his voice.
  // Rocketbox people do it with their own face bones: eyelids that swing round
  // the eyeball, brows, mouth corners, lips, cheeks and jaw. HD people
  // (characters/hd.js) do it with morph targets.
  const FACE_KEYS=['blink','squint','wide','browsUp','browsDown','browsWorry','smile','frown','press','open','pucker','sneer'];
  const FACE_LOOKS={
    fistpump:{smile:.95,browsUp:.3},acknowledge:{smile:.8,browsUp:.25},satisfied:{smile:.55,press:.15},nod:{smile:.35,press:.1},c_nodyes:{smile:.3},
    anger:{browsDown:1,press:.75,sneer:.35,squint:.35},regret:{browsWorry:.85,frown:.6,press:.35},sigh:{browsWorry:.55,frown:.35,squint:.2,open:.06},
    facepalm:{browsWorry:.75,frown:.5,squint:.45},c_headshake:{frown:.55,browsDown:.45,press:.5},disbelief:{browsUp:.85,wide:.45,open:.22},
    c_shrug:{browsUp:.6,press:.5,frown:.25},chinrub:{browsDown:.35,squint:.3,press:.3},lookup:{browsWorry:.55,browsUp:.25},hiphand:{press:.45,browsDown:.3},
    win:{smile:1,browsUp:.4},lose:{browsWorry:.65,frown:.45,press:.35}
  };
  const FACE_FOCUS={squint:.24,browsDown:.3,press:.22};
  // The same expressions on Rocketbox face bones. move: metres along the face's own axes (x to the person's left,
  // y up, z forward); lid: radians the eyelids swing round the eyeball (+ down); jaw: radians it opens.
  const FACE_BONES={
    blink:{lid:[.88,-.14]},squint:{lid:[.26,-.28],move:{LCheek:[0,.003,.001],RCheek:[0,.003,.001]}},wide:{lid:[-.2,.06]},
    browsUp:{move:{LInnerEyebrow:[0,.007,0],RInnerEyebrow:[0,.007,0],MMiddleEyebrow:[0,.005,0],LOuterEyebrow:[0,.007,0],ROuterEyebrow:[0,.007,0]}},
    browsDown:{move:{LInnerEyebrow:[-.003,-.005,.001],RInnerEyebrow:[.003,-.005,.001],MMiddleEyebrow:[0,-.005,.002],LOuterEyebrow:[0,-.002,0],ROuterEyebrow:[0,-.002,0]}},
    browsWorry:{move:{LInnerEyebrow:[-.001,.008,0],RInnerEyebrow:[.001,.008,0],MMiddleEyebrow:[0,.005,0],LOuterEyebrow:[0,-.002,0],ROuterEyebrow:[0,-.002,0]}},
    smile:{move:{LMouthCorner:[.007,.01,-.004],RMouthCorner:[-.007,.01,-.004],LCheek:[.001,.005,.001],RCheek:[-.001,.005,.001]}},
    frown:{move:{LMouthCorner:[.002,-.008,0],RMouthCorner:[-.002,-.008,0],LMouthBottom:[0,-.002,0],RMouthBottom:[0,-.002,0]}},
    press:{move:{MUpperLip:[0,-.0025,0],MBottomLip:[0,.003,0],LMouthCorner:[-.001,0,0],RMouthCorner:[.001,0,0]}},
    open:{jaw:.24},
    pucker:{move:{LMouthCorner:[-.007,0,.003],RMouthCorner:[.007,0,.003],MUpperLip:[0,0,.003],MBottomLip:[0,0,.003]}},
    sneer:{move:{MUpperLip:[0,.003,0],LCheek:[0,.004,.001],RCheek:[0,.004,.001]},lid:[.1,-.15]}
  };
  const _xbq=new T.Quaternion(),_xbv=new T.Vector3(),_xbs=new T.Vector3(),_xbm=new T.Matrix4(),_xbr=new T.Quaternion();
  // A Rocketbox face: its bones' rest pose, and the face's own axes (measured from the eyes and the mouth, as rigs
  // differ in which way is up) and the eye centres, in each bone's parent frame; fwd, up: the face's axes, bound.
  function boneFace(p,sk){
    const get=n=>p.obj.getObjectByName('Bip01_'+n);
    const bind=b=>{const i=b?sk.bones.indexOf(b):-1;if(i<0)return null;     // where a bone sat when the body was bound
      _xbm.copy(sk.boneInverses[i]).invert().decompose(_xbv,_xbq,_xbs);return {p:_xbv.clone(),q:_xbq.clone(),s:_xbs.x||1};};
    const le=bind(get('LEye')),re=bind(get('REye')),lc=bind(get('LMouthCorner')),rc=bind(get('RMouthCorner')),hb=bind(get('Head'));
    if(!le||!re||!lc||!rc||!hb||!get('LEyeBlinkTop')||!get('MJaw'))return null;
    const X=le.p.clone().sub(re.p).normalize(),eyes=le.p.clone().add(re.p).multiplyScalar(.5);
    const U=eyes.clone().sub(lc.p.clone().add(rc.p).multiplyScalar(.5));U.addScaledVector(X,-U.dot(X)).normalize();
    const F=new T.Vector3().crossVectors(X,U);if(F.dot(eyes.clone().sub(hb.p))<0)F.negate();
    const down=new T.Vector3().crossVectors(U,F).normalize();                // turning + about this swings a lid or the jaw down
    const names=new Set(['LEyeBlinkTop','REyeBlinkTop','LEyeBlinkBottom','REyeBlinkBottom','MJaw']);
    for(const k in FACE_BONES)for(const n in FACE_BONES[k].move||{})names.add(n);
    const bones={};
    for(const n of names){const b=get(n),pb=b&&b.parent&&bind(b.parent);if(!pb)continue;
      const inv=pb.q.clone().invert(),k=1/pb.s,ax=v=>v.clone().applyQuaternion(inv).multiplyScalar(k);
      bones[n]={b,pos:b.position.clone(),q:b.quaternion.clone(),X:ax(X),U:ax(U),F:ax(F),axis:down.clone().applyQuaternion(inv).normalize(),
        toLocal:v=>ax(v.clone().sub(pb.p))};}
    for(const [s,e] of [['L',le],['R',re]])for(const k of ['Top','Bottom']){const x=bones[s+'EyeBlink'+k];if(x)x.eye=x.toLocal(e.p);}
    return Object.keys(bones).length>8?{bones,fwd:F,up:U}:null;
  }
  function poseBoneFace(f,blink){
    const B=f.bones,w=f.w;
    for(const n in B){B[n].b.position.copy(B[n].pos);B[n].b.quaternion.copy(B[n].q);}
    let top=0,bottom=0,jaw=0;
    for(const k of FACE_KEYS){const e=FACE_BONES[k],v=k==='blink'?Math.max(blink,w.blink):w[k];if(!e||v<.001)continue;
      if(e.lid){top+=e.lid[0]*v;bottom+=e.lid[1]*v;}
      if(e.jaw)jaw+=e.jaw*v;
      for(const n in e.move||{}){const x=B[n],m=e.move[n];if(x)x.b.position.addScaledVector(x.X,m[0]*v).addScaledVector(x.U,m[1]*v).addScaledVector(x.F,m[2]*v);}}
    const g=f.pitch||0;top+=g>0?g*.85:g*.5;bottom+=g>0?g*.3:g*.2;   // the lids follow the eyes up and down
    top=Math.min(top,.9);
    for(const [n,a] of [['LEyeBlinkTop',top],['REyeBlinkTop',top],['LEyeBlinkBottom',bottom],['REyeBlinkBottom',bottom]]){
      const x=B[n];if(!x||!x.eye||Math.abs(a)<.001)continue;       // the lid swings round the eyeball
      _xbr.setFromAxisAngle(x.axis,a);x.b.position.sub(x.eye).applyQuaternion(_xbr);
      const shut=Math.max(0,n.endsWith('Top')?a/.88:-a/.3);             // a closing lid rides out over the cornea
      x.b.position.multiplyScalar(1+.17*shut*shut).add(x.eye);x.b.quaternion.premultiply(_xbr);}
    if(B.MJaw&&jaw>.001)B.MJaw.b.quaternion.premultiply(_xbr.setFromAxisAngle(B.MJaw.axis,Math.min(jaw,.3)));
  }
  const faces=[],_xfz=new T.Vector3(0,0,1),_xfy=new T.Vector3(0,1,0),_xhu=new T.Vector3(),_xfm=new T.Matrix4(),_xfs=new T.Vector3(),_xfp0=new T.Vector3(),_xfq0=new T.Quaternion();
  const _xeq=new T.Quaternion(),_xeq2=new T.Quaternion(),_xpq=new T.Quaternion(),_xhf=new T.Vector3(),_xep=new T.Vector3(),_xew=new T.Vector3(),_xec=new T.Vector3();
  // A person's face, made on first use (null for people with neither morph targets nor face bones).
  function faceOf(p){
    if(!p)return null;
    if(p.face!==undefined)return p.face;
    const meshes=[];p.obj.traverse(o=>{if(o.isMesh&&o.morphTargetDictionary&&o.morphTargetInfluences)meshes.push(o);});
    let bones=null,fwd=_xfz,up=_xfy;
    if(!meshes.length){const s=[];p.obj.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton)s.push(o.skeleton);});
      const bf=s[0]&&boneFace(p,s[0]);if(bf){bones=bf.bones;fwd=bf.fwd;up=bf.up;}}
    if(!meshes.length&&!bones)return p.face=null;
    const f={p,meshes,bones,w:{},want:{},cur:null,next:null,blinkAt:time+1+Math.random()*3,blinkT:-1,eyes:[],head:null,
      target:new T.Vector3(),gaze:null,saccAt:0,sacc:new T.Vector3(),focus:false,talks:false,talk:0};
    for(const k of FACE_KEYS){f.w[k]=0;f.want[k]=0;}
    let sk=(meshes.find(m=>m.isSkinnedMesh&&m.skeleton)||{}).skeleton;
    if(!sk)p.obj.traverse(o=>{if(!sk&&o.isSkinnedMesh&&o.skeleton)sk=o.skeleton;});
    const bindFwd=(b,d=fwd)=>{const i=sk?sk.bones.indexOf(b):-1;if(i<0)return null;   // one of the face's axes in the bone's own frame
      _xfm.copy(sk.boneInverses[i]).invert().decompose(_xfp0,_xfq0,_xfs);return d.clone().applyQuaternion(_xfq0.invert()).normalize();};
    for(const n of ['Bip01_LEye','Bip01_REye']){const b=p.obj.getObjectByName(n),fwd=b&&bindFwd(b);if(fwd)f.eyes.push({b,fwd});}
    const h=p.obj.getObjectByName('Bip01_Head'),hf=h&&bindFwd(h);if(hf)f.head={b:h,fwd:hf,up:bindFwd(h,up)};
    p.face=f;faces.push(f);return f;
  }
  // Show an expression (a key of FACE_LOOKS) for a while, after a delay.
  function faceExpr(p,kind,dur=2.5,delay=0){
    const f=faceOf(p),look=FACE_LOOKS[kind];if(!f||!look)return;
    f.next={look,at:time+delay,until:time+delay+Math.max(.8,dur)};
  }
  function lookEyes(f,dt){
    if(time>f.saccAt){f.saccAt=time+.35+Math.random()*1.8;f.sacc.set((Math.random()-.5)*.08,(Math.random()-.5)*.04,(Math.random()-.5)*.08);}
    _xew.copy(f.target).add(f.sacc);
    if(!f.gaze)f.gaze=_xew.clone();else f.gaze.lerp(_xew,1-Math.exp(-dt*16));
    f.head.b.getWorldQuaternion(_xeq);_xhf.copy(f.head.fwd).applyQuaternion(_xeq).normalize();_xhu.copy(f.head.up).applyQuaternion(_xeq).normalize();
    let pitch=null;
    for(const e of f.eyes){
      e.b.getWorldPosition(_xep);_xew.copy(f.gaze).sub(_xep).normalize();
      const ang=_xhf.angleTo(_xew),lim=.42;                 // eyes turn about 24 degrees; the head does the rest
      if(ang>lim){const t=lim/ang;_xew.multiplyScalar(t).addScaledVector(_xhf,1-t).normalize();}
      if(pitch===null)pitch=Math.asin(clamp(-_xew.dot(_xhu),-1,1));     // + looking down
      e.b.getWorldQuaternion(_xeq2);_xec.copy(e.fwd).applyQuaternion(_xeq2).normalize();
      _xpq.setFromUnitVectors(_xec,_xew);_xeq2.premultiply(_xpq);
      e.b.parent.getWorldQuaternion(_xeq);e.b.quaternion.copy(_xeq.invert().multiply(_xeq2));
    }
    if(pitch!==null)f.pitch=(f.pitch||0)+(pitch-(f.pitch||0))*(1-Math.exp(-dt*14));
  }
  function facesTick(dt){
    if(!faces.length&&!(PL.length||ref.person))return;
    const fp=focusPoint(),by=CLOTH_Y+R,cb=cueBall();
    for(const pl of PL){const f=faceOf(pl.p);if(!f)continue;
      const down=pl.act==='down'||pl.act==='getdown';f.focus=pl.act==='down';
      if(down&&cb)f.target.set(cb.x,by,cb.z);else f.target.set(fp[0],by,fp[1]);}
    if(ref.person){const f=faceOf(ref.person);if(f){f.talks=true;
      if(ref.task)f.target.set(ref.task.x,by,ref.task.z);else f.target.set(fp[0],by,fp[1]);}}
    const voice=typeof refVoiceLevel==='function'?refVoiceLevel():0;
    for(let n=faces.length-1;n>=0;n--){
      const f=faces[n],p=f.p;
      if(!p.obj.parent){faces.splice(n,1);continue;}       // gone: a new venue, a new match
      const shown=p.obj.visible;                            // out of shot: the face keeps time, nothing is posed
      if(f.next&&time>=f.next.at){f.cur=f.next;f.next=null;}
      if(f.cur&&time>f.cur.until)f.cur=null;
      for(const k of FACE_KEYS){let v=f.cur&&f.cur.look[k]||0;if(f.focus&&FACE_FOCUS[k])v=Math.max(v,FACE_FOCUS[k]);f.want[k]=v;}
      if(f.talks){f.talk+=(voice-f.talk)*(1-Math.exp(-dt*30));
        f.want.open=Math.max(f.want.open,clamp(f.talk*3.4,0,.42));f.want.pucker=Math.max(f.want.pucker,clamp(f.talk*1.4,0,.16));}
      const r=1-Math.exp(-dt*6),rt=1-Math.exp(-dt*22);
      for(const k of FACE_KEYS)f.w[k]+=(f.want[k]-f.w[k])*(f.talks&&(k==='open'||k==='pucker')?rt:r);
      if(f.blinkT<0&&time>=f.blinkAt){f.blinkT=0;f.blinkAt=time+(Math.random()<.14?.34:2+Math.random()*4.5);}
      let b=0;
      if(f.blinkT>=0){f.blinkT+=dt;const u=f.blinkT/.18;b=u<.35?u/.35:u<1?1-(u-.35)/.65:0;if(u>=1)f.blinkT=-1;}
      if(!shown)continue;
      for(const m of f.meshes){const d=m.morphTargetDictionary,inf=m.morphTargetInfluences;
        for(const k of FACE_KEYS){const i=d[k];if(i!==undefined)inf[i]=k==='blink'?Math.max(b,Math.min(1,f.w.blink+Math.max(0,f.pitch||0)*1.1)):f.w[k];}}
      if(f.bones)poseBoneFace(f,b);
      if(f.eyes.length&&f.head)lookEyes(f,dt);
    }
  }
