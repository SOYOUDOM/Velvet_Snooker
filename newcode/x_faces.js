  // ---- HD FACES --------------------------------------------------------------
  // HD people (characters/hd.js, made with the Blender add-on) have a face that
  // moves: morph targets for blinks and expressions, and eye bones. Here they
  // blink, show how a shot went (the same moments as the body reactions),
  // narrow their eyes over a shot, follow the play with their eyes (small
  // saccades, never further than eyes can turn), and the referee's mouth moves
  // with his voice. Rocketbox people have no morph targets and are left alone.
  const FACE_KEYS=['blink','squint','wide','browsUp','browsDown','browsWorry','smile','frown','press','open','pucker','sneer'];
  const FACE_LOOKS={
    fistpump:{smile:.95,browsUp:.3},acknowledge:{smile:.8,browsUp:.25},satisfied:{smile:.55,press:.15},nod:{smile:.35,press:.1},c_nodyes:{smile:.3},
    anger:{browsDown:1,press:.75,sneer:.35,squint:.35},regret:{browsWorry:.85,frown:.6,press:.35},sigh:{browsWorry:.55,frown:.35,squint:.2,open:.06},
    facepalm:{browsWorry:.75,frown:.5,squint:.45},c_headshake:{frown:.55,browsDown:.45,press:.5},disbelief:{browsUp:.85,wide:.45,open:.22},
    c_shrug:{browsUp:.6,press:.5,frown:.25},chinrub:{browsDown:.35,squint:.3,press:.3},lookup:{browsWorry:.55,browsUp:.25},hiphand:{press:.45,browsDown:.3},
    win:{smile:1,browsUp:.4},lose:{browsWorry:.65,frown:.45,press:.35}
  };
  const FACE_FOCUS={squint:.24,browsDown:.3,press:.22};
  const faces=[],_xfz=new T.Vector3(0,0,1),_xfm=new T.Matrix4(),_xfs=new T.Vector3(),_xfp0=new T.Vector3(),_xfq0=new T.Quaternion();
  const _xeq=new T.Quaternion(),_xeq2=new T.Quaternion(),_xpq=new T.Quaternion(),_xhf=new T.Vector3(),_xep=new T.Vector3(),_xew=new T.Vector3(),_xec=new T.Vector3();
  // A person's face, made on first use (null for people without morph targets).
  function faceOf(p){
    if(!p)return null;
    if(p.face!==undefined)return p.face;
    const meshes=[];p.obj.traverse(o=>{if(o.isMesh&&o.morphTargetDictionary&&o.morphTargetInfluences)meshes.push(o);});
    if(!meshes.length)return p.face=null;
    const f={p,meshes,w:{},want:{},cur:null,next:null,blinkAt:time+1+Math.random()*3,blinkT:-1,eyes:[],head:null,
      target:new T.Vector3(),gaze:null,saccAt:0,sacc:new T.Vector3(),focus:false,talks:false,talk:0};
    for(const k of FACE_KEYS){f.w[k]=0;f.want[k]=0;}
    const sk=(meshes.find(m=>m.isSkinnedMesh&&m.skeleton)||{}).skeleton;
    const bindFwd=b=>{const i=sk?sk.bones.indexOf(b):-1;if(i<0)return null;   // the face's forward axis (+Z of the model) in the bone's own frame
      _xfm.copy(sk.boneInverses[i]).invert().decompose(_xfp0,_xfq0,_xfs);return _xfz.clone().applyQuaternion(_xfq0.invert()).normalize();};
    for(const n of ['Bip01_LEye','Bip01_REye']){const b=p.obj.getObjectByName(n),fwd=b&&bindFwd(b);if(fwd)f.eyes.push({b,fwd});}
    const h=p.obj.getObjectByName('Bip01_Head'),hf=h&&bindFwd(h);if(hf)f.head={b:h,fwd:hf};
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
    f.head.b.getWorldQuaternion(_xeq);_xhf.copy(f.head.fwd).applyQuaternion(_xeq).normalize();
    for(const e of f.eyes){
      e.b.getWorldPosition(_xep);_xew.copy(f.gaze).sub(_xep).normalize();
      const ang=_xhf.angleTo(_xew),lim=.42;                 // eyes turn about 24 degrees; the head does the rest
      if(ang>lim){const t=lim/ang;_xew.multiplyScalar(t).addScaledVector(_xhf,1-t).normalize();}
      e.b.getWorldQuaternion(_xeq2);_xec.copy(e.fwd).applyQuaternion(_xeq2).normalize();
      _xpq.setFromUnitVectors(_xec,_xew);_xeq2.premultiply(_xpq);
      e.b.parent.getWorldQuaternion(_xeq);e.b.quaternion.copy(_xeq.invert().multiply(_xeq2));
    }
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
        for(const k of FACE_KEYS){const i=d[k];if(i!==undefined)inf[i]=k==='blink'?Math.max(b,f.w.blink):f.w[k];}}
      if(f.eyes.length&&f.head)lookEyes(f,dt);
    }
  }
