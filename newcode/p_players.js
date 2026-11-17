  // ---- PLAYERS: IN THEIR CHAIRS, WALKING ROUND THE TABLE, DOWN ON THE SHOT ----
  // Two player characters (role 'player' in characters/characters.js). Each
  // has a goal from the state of play (sit in the chair, play the shot, watch)
  // and gets there the way a person would: stands up out of the chair, walks
  // round the table (never through it), turns on the spot, then gets down on
  // the shot or sits back down. Every change of motion is a timed, eased blend
  // and the walk is matched to the stride, so nothing slides, fades or floats.
  // Down on the shot the body is posed by inverse kinematics every frame
  // (bridge hand on the cloth, chin over the cue, cue arm swinging from the
  // elbow); the feet stay planted and step when the aim moves. Shots out of
  // reach are played with the rest and an extension. A model that brings its
  // own 'cue' clip (see characters.js) plays that instead of the computed pose.
  const PL=[];
  const CHAIRS=[[-.95,CHAIR_Z+.06],[.95,CHAIR_Z+.06]],CHAIR_FRONT=.4;
  const RISE_T=1.0,SIT_T=1.05,DOWN_T=.8,UP_T=.6,WALK_V=1.15,CLIP_V=1.01;
  const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const chairGoal=i=>({kind:'chair',x:CHAIRS[i][0],z:CHAIRS[i][1]+CHAIR_FRONT,yaw:0});
  const _v1=new T.Vector3(),_v2=new T.Vector3(),_v3=new T.Vector3(),_v4=new T.Vector3(),_q1=new T.Quaternion(),_q2=new T.Quaternion(),_q3=new T.Quaternion();
  const UPV=new T.Vector3(0,1,0),_N=new T.Vector3();
  function aimBone(bone,child,target){
    bone.getWorldPosition(_v1);child.getWorldPosition(_v2);
    _v2.sub(_v1);const l=_v2.length();if(l<1e-6)return;_v2.divideScalar(l);
    _v3.copy(target).sub(_v1);const t=_v3.length();if(t<1e-6)return;_v3.divideScalar(t);
    if(_v2.dot(_v3)>.999999)return;
    _q1.setFromUnitVectors(_v2,_v3);
    bone.getWorldQuaternion(_q2);_q2.premultiply(_q1);
    bone.parent.getWorldQuaternion(_q3);bone.quaternion.copy(_q3.invert().multiply(_q2));
    bone.updateMatrixWorld(true);
  }
  const _A=new T.Vector3(),_Bv=new T.Vector3(),_C=new T.Vector3(),_D=new T.Vector3(),_E=new T.Vector3(),_P=new T.Vector3();
  function twoBone(up,lo,end,target,pole){
    up.getWorldPosition(_A);lo.getWorldPosition(_Bv);end.getWorldPosition(_C);
    const la=_A.distanceTo(_Bv),lb=_Bv.distanceTo(_C);
    _D.copy(target).sub(_A);let d=_D.length();if(d<1e-6)return;_D.divideScalar(d);
    d=clamp(d,Math.abs(la-lb)+1e-4,la+lb-1e-4);
    const x=(la*la-lb*lb+d*d)/(2*d),h=Math.sqrt(Math.max(0,la*la-x*x));
    _P.copy(pole).sub(_A);_P.addScaledVector(_D,-_P.dot(_D));if(_P.lengthSq()<1e-8)_P.set(0,1,0);_P.normalize();
    _E.copy(_A).addScaledVector(_D,x).addScaledVector(_P,h);
    aimBone(up,lo,_E);
    _E.copy(_A).addScaledVector(_D,d);aimBone(lo,end,_E);
  }
  function rotWorld(bone,axis,ang){
    _q1.setFromAxisAngle(axis,ang);bone.getWorldQuaternion(_q2);_q2.premultiply(_q1);
    bone.parent.getWorldQuaternion(_q3);bone.quaternion.copy(_q3.invert().multiply(_q2));bone.updateMatrixWorld(true);
  }
  // Turn a hand about its own length so its knuckle line (index - little
  // finger) points along 'want': palm toward the cue, or flat on the cloth.
  function twistTo(bone,tipB,a,b,want){
    bone.getWorldPosition(_v1);tipB.getWorldPosition(_v2);_v2.sub(_v1).normalize();
    a.getWorldPosition(_v3);b.getWorldPosition(_v4);_v3.sub(_v4);
    _v3.addScaledVector(_v2,-_v3.dot(_v2));_E.copy(want).addScaledVector(_v2,-want.dot(_v2));
    if(_v3.lengthSq()<1e-8||_E.lengthSq()<1e-8)return;_v3.normalize();_E.normalize();
    rotWorld(bone,_v2,Math.atan2(_P.crossVectors(_v3,_E).dot(_v2),_v3.dot(_E)));
  }
  // Curl the fingers toward the palm side 'n' (negative angles open them).
  function curl(chains,n,angs){
    chains[0][0].getWorldPosition(_v1);chains[3][0].getWorldPosition(_v2);_v4.copy(_v1).sub(_v2).normalize();
    chains[1][0].getWorldPosition(_v1);chains[1][1].getWorldPosition(_v2);_v2.sub(_v1);
    _D.copy(_v4).multiplyScalar(Math.sign(_v3.crossVectors(_v4,_v2).dot(n))||1);
    for(const ch of chains)for(let j=0;j<ch.length;j++)rotWorld(ch[j],_D,angs[j]);
  }
  const STANCE_BONES=['pelvis','spine','spine1','spine2','neck','head','lua','lfa','lh','rua','rfa','rh','lth','lca','lft','rth','rca','rft'];
  // Which body stands at the table: VELVET Studio can give you, player two
  // and each opponent a character of their own; otherwise the first two
  // 'player' characters of the people data file are used.
  function wantPlayerTpl(P,i){
    const tpls=P.list('player');if(!tpls.length)return null;
    const L=(window.VelvetStudio&&VelvetStudio.links)||{},has=id=>id&&P.templates[id]&&P.templates[id].role==='player'?P.templates[id]:null;
    const you=has(L.you&&L.you.character)||tpls[0];
    if(i===0)return you;
    const own=state.mode==='versus'?has(L.two&&L.two.character):has(botOpponent&&botOpponent.character);
    const rest=tpls.filter(t=>t!==you);
    return own||rest.find(t=>t.name==='player_02')||rest[0]||tpls[0];
  }
  function makePlayer(P,i,tpl){
    const p=P.spawn(tpl.name);
    p.obj.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.castShadow=true;o.receiveShadow=true;}});
    scene.add(p.obj);
    const g=n=>p.obj.getObjectByName('Bip01_'+n);
    const rig={root:p.obj.getObjectByName('Bip01'),pelvis:g('Pelvis'),spine:g('Spine'),spine1:g('Spine1'),spine2:g('Spine2'),neck:g('Neck'),head:g('Head'),eye:g('REye'),
      lua:g('L_UpperArm'),lfa:g('L_Forearm'),lh:g('L_Hand'),lf:g('L_Finger2'),rua:g('R_UpperArm'),rfa:g('R_Forearm'),rh:g('R_Hand'),rf:g('R_Finger2'),
      lth:g('L_Thigh'),lca:g('L_Calf'),lft:g('L_Foot'),lto:g('L_Toe0'),rth:g('R_Thigh'),rca:g('R_Calf'),rft:g('R_Foot'),rto:g('R_Toe0')};
    const fing=s=>[1,2,3,4].map(k=>[g(s+'_Finger'+k),g(s+'_Finger'+k+'1'),g(s+'_Finger'+k+'2')]);
    rig.lfing=fing('L');rig.rfing=fing('R');rig.lth0=g('L_Finger0');rig.rth0=g('R_Finger0');
    const ok=!!tpl.rocketbox&&Object.values(rig).every(v=>Array.isArray(v)?v.flat().every(Boolean):!!v);
    const ownCue=!!(tpl.clipMap&&tpl.clipMap.cue&&tpl.own[tpl.clipMap.cue]);
    const acts={sit:p.play(p.clip('sit',i*2)||'idle',{weight:1}),idle:p.play('idle',{weight:0}),walk:p.play('walk',{weight:0}),cheer:p.play('cheer',{weight:0})};
    if(ownCue)acts.cue=p.play('cue',{weight:0});
    const pl={i,p,rig,ok,ownCue,acts,w:{sit:1,idle:0,walk:0,cheer:0,cue:0},
      act:'sit',t:0,x:CHAIRS[i][0],z:CHAIRS[i][1],yaw:0,v:0,path:null,pi:0,pathEnd:null,goal:chairGoal(i),
      sitLin:1,stLin:0,stance:0,feet:null,feetNow:null,ox:0,oz:0,turning:false,watchTurn:false,wait:0,
      fade:1,fadeTo:1,hip:(tpl.rootY||.92)*p.obj.scale.y,
      sb:STANCE_BONES.map(n=>rig[n]).concat(ok?[...rig.lfing.flat(),...rig.rfing.flat()]:[]),
      downUntil:0,aim:0,cue:[0,0],pull:0,cueMesh:null};
    if(ok){const m=cueGroup.clone();m.visible=false;styleCue(m,tpl.entry.cue);scene.add(m);pl.cueMesh=m;}
    return pl;
  }
  function spawnPlayers(P){
    if(!P.list('player').length)return;
    for(let i=0;i<2;i++)PL.push(makePlayer(P,i,wantPlayerTpl(P,i)));
  }
  // At the start of a match (and when you pick another opponent) the right
  // bodies take the chairs.
  function syncPlayerBodies(){
    const P=window.VelvetPeople;if(!P||!P.ready||PL.length<2)return;
    for(let i=0;i<2;i++){
      const tpl=wantPlayerTpl(P,i);if(!tpl||PL[i].p.tpl===tpl)continue;
      const old=PL[i];scene.remove(old.p.obj);if(old.cueMesh)scene.remove(old.cueMesh);
      const nw=makePlayer(P,i,tpl);nw.fade=old.fade;nw.fadeTo=old.fadeTo;PL[i]=nw;
    }
    cueStyled='';
  }
  // Each player's own cue (VELVET Studio: shaft wood, butt colour, fittings).
  const CUE_METAL={brass:['#c9a45c',.85,.28],silver:['#d6d9dc',.9,.22],gold:['#e6bc52',.95,.2],black:['#1c1c1f',.4,.38]};
  const ownCueMats=new WeakSet();
  function styleCue(group,c){
    const k=group&&group.children;if(!k||k.length<6)return;c=c||{};
    if(!ownCueMats.has(group)){for(const m of k)m.material=m.material.clone();ownCueMats.add(group);}
    k[0].material.color.set(c.tip||'#3a6f8a');k[2].material.color.set(c.shaft||'#e2c59a');
    k[4].material.color.set(c.butt||'#1a100b');      // the spliced section keeps its own woods
    const mt=CUE_METAL[c.metal]||CUE_METAL.brass;
    for(const j of [1,5]){k[j].material.color.set(mt[0]);k[j].material.metalness=mt[1];k[j].material.roughness=mt[2];}
  }
  // The cue drawn at the ball (your view, replays) is the striker's own.
  let cueStyled='';
  function syncStrikerCue(){
    const i=cine.on&&cine.shooter!=null?cine.shooter:state.current,pl=PL[i],key=pl?pl.p.tpl.name:'-';
    if(key===cueStyled)return;cueStyled=key;styleCue(cueGroup,pl&&pl.p.tpl.entry.cue);
  }
  // Names from VELVET Studio: yours and player two's, with nicknames on the walk-on.
  const studioLink=i=>(((window.VelvetStudio&&VelvetStudio.links)||{})[i?'two':'you'])||{};
  const youLabel=(i,dflt)=>{const l=studioLink(i);return String(l.short||l.name||'').toUpperCase()||dflt;};
  function withNick(name,nick){
    if(!nick)return name;const w=String(name).split(' '),q='\u201c'+String(nick).toUpperCase()+'\u201d';
    return w.length>1?w[0]+' '+q+' '+w.slice(1).join(' '):name+' '+q;
  }
  function introName(i){
    if(state.mode==='bot'&&i===1)return withNick(opponentFull(),botOpponent.nick);
    const l=studioLink(i);return l.name?withNick(String(l.name).toUpperCase(),l.nick):playerName(i);
  }
  // A character sent from VELVET Studio's "Test in game" button: a one-frame
  // match against him (the bot breaks), or with him as referee or crowd.
  function studioTest(t){
    const P=window.VelvetPeople,tpl=P&&P.templates[t.id];
    if(!tpl&&!t.opp){message('STUDIO TEST','THE CHARACTER COULD NOT BE LOADED',3000);return;}
    const named=t.opp&&OPPONENTS.find(o=>o.id===t.opp);
    if(named)botOpponent=named;
    else if(tpl&&tpl.role==='player'&&!t.asYou){
      let opp=OPPONENTS.find(o=>o.character===t.id);
      if(!opp){opp={id:'studio_test',name:t.name||'Studio test',short:String(t.name||'TEST').toUpperCase().slice(0,14),nick:t.nick||'',style:{},character:t.id};OPPONENTS.push(opp);}
      botOpponent=opp;
    }
    chosenBestOf=1;
    beginNewGame(false,{bestOf:1,frames:[0,0],breaker:1,over:false},'bot');
  }
  // Cue rest and extension, shown when a shot is out of normal reach.
  const restGroup=new T.Group(),extMesh=new T.Mesh(new T.CylinderGeometry(.0145,.0148,1,14),new T.MeshPhysicalMaterial({color:'#15100c',roughness:.35,clearcoat:.6}));
  (()=>{const brass=new T.MeshStandardMaterial({color:'#c9a45c',roughness:.3,metalness:.85}),wood=new T.MeshStandardMaterial({color:'#5a3b22',roughness:.5});
    const shaft=new T.Mesh(new T.CylinderGeometry(.008,.011,1,10),wood);shaft.name='shaft';restGroup.add(shaft);
    const head=new T.Group();head.name='head';
    for(const s of [-1,1]){const arm=new T.Mesh(new T.BoxGeometry(.006,.006,.12),brass);arm.rotation.x=s*.75;head.add(arm);}
    restGroup.add(head);})();
  restGroup.visible=extMesh.visible=false;scene.add(restGroup,extMesh);
  const segBetween=(m,a,b)=>{const l=a.distanceTo(b);m.position.copy(a).add(b).multiplyScalar(.5);m.scale.set(1,l,1);m.quaternion.setFromUnitVectors(UPV,_v4.copy(b).sub(a).normalize());};
  // Where the body goes for a shot along 'aim' at a cue ball (x,z).
  function stanceFor(pl,aim,cx,cz,pull){
    const dx=Math.cos(aim),dz=Math.sin(aim),F=new T.Vector3(dx,0,dz),Rt=new T.Vector3(-dz,0,dx),elev=.07;
    // the body is set from the address (tip at the ball); only the cue and
    // the cue hand follow the stroke ('pull': back is positive)
    const tip0=new T.Vector3(cx-dx*(R+.009),BALL_Y,cz-dz*(R+.009)),tip=tip0.clone().addScaledVector(F,-pull);
    const cueAt=(s,lat=0,lift=0)=>tip.clone().addScaledVector(F,-s*Math.cos(elev)).addScaledVector(Rt,lat).add(_v4.set(0,s*Math.sin(elev)+lift,0));
    let sEdge=0;for(;sEdge<4;sEdge+=.02){const x=tip0.x-dx*sEdge,z=tip0.z-dz*sEdge;if(Math.abs(x)>OUT_X+.03||Math.abs(z)>OUT_Z+.03)break;}
    const back=Math.max(0,sEdge+.12-1.0),rest=back>.34;
    const at=(s,lat,y)=>tip0.clone().addScaledVector(F,-s).addScaledVector(Rt,lat).setY(y);
    const h=pl.hip;
    if(!rest){
      const k=back;
      return{rest,F,Rt,tip,cueAt,
        feet:[at(1.0+k,-.30,FLOOR_Y+.085),at(1.56+k,-.03,FLOOR_Y+.085)],
        hips:at(1.22+k,-.11,FLOOR_Y+h*.9),
        neck:at(.82+k*.8,-.055,BALL_Y+.205),head:at(.63+k*.8,-.02,BALL_Y+.17),
        lw:at(.33,-.024,CLOTH_Y+.05),rw:cueAt(1.12,.012,.085)};
    }
    const sG=sEdge+.26;
    return{rest,F,Rt,tip,cueAt,sEdge,sG,
      feet:[at(sEdge+.22,-.24,FLOOR_Y+.085),at(sEdge+.62,.02,FLOOR_Y+.085)],
      hips:at(sEdge+.42,-.07,FLOOR_Y+h*.97),
      neck:at(sEdge+.12,-.05,BALL_Y+.5),head:at(sEdge-.02,-.02,BALL_Y+.5),
      lw:at(sEdge-.03,-.22,RAIL_TOP+.05),rw:cueAt(sG,.012,.08),restHead:at(.44,0,CLOTH_Y+.012)};
  }
  function applyStance(pl,st){
    const r=pl.rig,obj=pl.p.obj;
    const before=pl.sb.map(b=>b.quaternion.clone()),rootBefore=r.root.position.clone();
    obj.updateMatrixWorld(true);
    // hips
    _v1.copy(st.hips);r.root.parent.worldToLocal(_v1);r.root.position.copy(_v1);r.root.updateMatrixWorld(true);
    // torso bends down toward the cue, head looks along it
    const neck=st.neck;
    r.pelvis.getWorldPosition(_v2);
    aimBone(r.spine,r.spine1,_v3.copy(_v2).lerp(neck,.36));
    aimBone(r.spine1,r.spine2,_v3.copy(_v2).lerp(neck,.68));
    aimBone(r.spine2,r.neck,neck);
    aimBone(r.neck,r.head,st.head);
    r.head.getWorldPosition(_v2);aimBone(r.head,r.eye,_v3.copy(_v2).addScaledVector(st.F,.09).add(_v4.set(0,st.rest?.0:.035,0)));
    // arms: bridge hand and cue hand
    r.lua.getWorldPosition(_v2);
    twoBone(r.lua,r.lfa,r.lh,st.lw,_v3.copy(_v2).addScaledVector(st.Rt,-.6).add(_v4.set(0,-.15,0)));
    r.lh.getWorldPosition(_v2);aimBone(r.lh,r.lf,_v3.copy(_v2).addScaledVector(st.F,.12).add(_v4.set(0,-.025,0)));
    if(!st.rest){twistTo(r.lh,r.lf,r.lfing[0][0],r.lfing[3][0],st.Rt);curl(r.lfing,_N.set(0,-1,0),[-.25,-.1,.15]);}
    twoBone(r.rua,r.rfa,r.rh,st.rw,_v3.copy(st.rw).add(_v4.set(0,.7,0)).addScaledVector(st.F,-.25).addScaledVector(st.Rt,.08));
    r.rh.getWorldPosition(_v2);aimBone(r.rh,r.rf,_v3.copy(_v2).add(_v4.set(0,-.09,0)).addScaledVector(st.F,.03));
    twistTo(r.rh,r.rf,r.rfing[0][0],r.rfing[3][0],st.F);
    curl(r.rfing,_C.copy(st.Rt).negate(),[.95,1.2,.7]);
    // legs: feet planted on the floor
    const feet=pl.feetNow||st.feet;
    for(const [th,ca,ft,to,foot,lat] of [[r.lth,r.lca,r.lft,r.lto,feet[0],-.06],[r.rth,r.rca,r.rft,r.rto,feet[1],.04]]){
      th.getWorldPosition(_v2);twoBone(th,ca,ft,foot,_v3.copy(_v2).addScaledVector(st.F,1).addScaledVector(st.Rt,lat));
      ft.getWorldPosition(_v2);aimBone(ft,to,_v3.copy(_v2).addScaledVector(st.F,.16).addScaledVector(st.Rt,lat).setY(FLOOR_Y+.01));
    }
    const w=pl.stance;
    if(w<.999){
      pl.sb.forEach((b,i)=>{_q1.copy(b.quaternion);b.quaternion.copy(before[i]).slerp(_q1,w);});
      r.root.position.lerpVectors(rootBefore,r.root.position,w);
    }
    obj.updateMatrixWorld(true);
  }
  // Rest and extension for out-of-reach shots (only for the player down on it).
  function placeRest(st,show){
    restGroup.visible=extMesh.visible=!!(show&&st&&st.rest);
    if(!restGroup.visible)return;
    const head=restGroup.getObjectByName('head'),shaft=restGroup.getObjectByName('shaft');
    head.position.copy(st.restHead);head.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),st.F);
    segBetween(shaft,st.restHead,st.lw);
    segBetween(extMesh,st.cueAt(1.44),st.cueAt(st.sG+.14));
  }
  function setPlayerOpacity(pl,o){
    pl.p.obj.visible=o>.02;
    pl.p.obj.traverse(m=>{if(!m.isMesh)return;for(const mt of Array.isArray(m.material)?m.material:[m.material]){
      const tr=o<.99;if(mt.transparent!==tr){mt.transparent=tr;mt.depthWrite=!tr;mt.needsUpdate=true;}mt.opacity=o;}m.castShadow=o>.5;});
  }
  // ---- walking: a lane round the table, paths along it, eased starts and stops ----
  const RING=(()=>{const base=roundedRect(OUT_X+.36,OUT_Z+.36,.42);base.push(base[0]);const pts=[];
    for(let i=0;i<base.length-1;i++){const a=base[i],b=base[i+1],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.02));
      for(let k=0;k<n;k++)pts.push([lerp(a[0],b[0],k/n),lerp(a[1],b[1],k/n)]);}
    return pts;})();
  function ringNear(x,z){let best=0,bd=1e9;for(let i=0;i<RING.length;i++){const d=(RING[i][0]-x)**2+(RING[i][1]-z)**2;if(d<bd){bd=d;best=i;}}return best;}
  const offTable=(x,z)=>Math.abs(x)>OUT_X+.17||Math.abs(z)>OUT_Z+.17;
  function clearWalk(ax,az,bx,bz){for(let k=1;k<16;k++){const t=k/16;if(!offTable(ax+(bx-ax)*t,az+(bz-az)*t))return false;}return true;}
  // A short hop goes straight; anything else goes out to the lane, round the
  // table the shorter way and in to the spot.
  function planPath(ax,az,bx,bz){
    if(Math.hypot(bx-ax,bz-az)<1.3&&clearWalk(ax,az,bx,bz))return[[bx,bz]];
    const n=RING.length,i0=ringNear(ax,az),i1=ringNear(bx,bz),f=(i1-i0+n)%n,dir=f<=n/2?1:-1,steps=dir>0?f:n-f,out=[];
    for(let k=Math.min(10,steps);k<steps;k+=6)out.push(RING[(i0+dir*k+n)%n]);
    out.push(RING[i1],[bx,bz]);return out;
  }
  function pathLeft(pl){let s=0,x=pl.x,z=pl.z;for(let i=pl.pi;i<pl.path.length;i++){const p=pl.path[i];s+=Math.hypot(p[0]-x,p[1]-z);x=p[0];z=p[1];}return s;}
  function pathAhead(pl,dist){let x=pl.x,z=pl.z;
    for(let i=pl.pi;i<pl.path.length;i++){const p=pl.path[i],d=Math.hypot(p[0]-x,p[1]-z);if(d>=dist){const k=dist/d;return[x+(p[0]-x)*k,z+(p[1]-z)*k];}dist-=d;x=p[0];z=p[1];}
    return[x,z];}
  // Turn toward a heading at a steady rate, easing in at the end; the feet
  // step on the spot while turning (see the weights below).
  function turnTo(pl,yaw,dt,rate=3.2){
    const d=wrapAngle(yaw-pl.yaw),w=Math.min(rate,Math.max(1,Math.abs(d)*6)),s=Math.sign(d)*Math.min(Math.abs(d),w*dt);
    pl.yaw+=s;if(Math.abs(s)>.5*dt)pl.turning=true;return Math.abs(d)<.05;
  }
  function walkStep(pl,dt){
    const left=pathLeft(pl),ah=pathAhead(pl,.45);
    if(Math.hypot(ah[0]-pl.x,ah[1]-pl.z)>.03)pl.head=Math.atan2(ah[0]-pl.x,ah[1]-pl.z);
    const off=Math.abs(wrapAngle(pl.head-pl.yaw));turnTo(pl,pl.head,dt,off>1?3:4.4);
    // set off once roughly facing the way, ease up to walking pace, ease down to stop on the spot
    const vmax=off>1.15?0:Math.min(WALK_V,Math.sqrt(2.4*left))*clamp(1.6-off,.35,1);
    pl.v=pl.v<vmax?Math.min(vmax,pl.v+1.5*dt):Math.max(vmax,pl.v-2.5*dt);
    let s=pl.v*dt;
    while(s>1e-6&&pl.pi<pl.path.length){const p=pl.path[pl.pi],dx=p[0]-pl.x,dz=p[1]-pl.z,d=Math.hypot(dx,dz);
      if(d<=s){pl.x=p[0];pl.z=p[1];s-=d;pl.pi++;}else{pl.x+=dx/d*s;pl.z+=dz/d*s;s=0;}}
    return pl.pi>=pl.path.length;
  }
  // Feet stay planted while down on the shot; when the aim moves one foot at a
  // time steps to its new place.
  function plantedFeet(pl,st,dt){
    if(!pl.feet)pl.feet=st.feet.map(f=>({p:f.clone(),a:f.clone(),b:f.clone(),t:1}));
    for(let i=0;i<2;i++){const f=pl.feet[i],want=st.feet[i],o=pl.feet[1-i];
      if(f.t<1){f.t=Math.min(1,f.t+dt/.3);f.p.lerpVectors(f.a,f.b,ease(f.t));f.p.y+=.05*Math.sin(PI*f.t);}
      else if(o.t>=1&&f.b.distanceTo(want)>.1){f.a.copy(f.p);f.b.copy(want);f.t=0;}}
    return pl.feetNow=[pl.feet[0].p,pl.feet[1].p];
  }

  // ---- what each player is doing ----
  // Acts: sit, rise, idle, walk, getdown, down, getup, sitdown, cheer.
  // Goals: chair, shot (where the stance puts the feet), watch (a spot and a
  // heading), hold (stay where you are and follow the play).
  function setAct(pl,a){pl.act=a;pl.t=0;}
  function startWalk(pl,g){pl.path=planPath(pl.x,pl.z,g.x,g.z);pl.pi=0;pl.pathEnd=[g.x,g.z];pl.head=pl.yaw;pl.stopping=false;setAct(pl,'walk');}
  function watchTurn(pl,dt,yaw){
    const fp=focusPoint(),want=yaw!=null?yaw:Math.atan2(fp[0]-pl.x,fp[1]-pl.z);
    if(pl.watchTurn||Math.abs(wrapAngle(want-pl.yaw))>(yaw!=null?.05:.95))pl.watchTurn=!turnTo(pl,want,dt,2.4);
  }
  function follow(pl,g,dt){const k=1-Math.exp(-dt*5);pl.x+=(g.x-pl.x)*k;pl.z+=(g.z-pl.z)*k;pl.yaw+=wrapAngle(g.yaw-pl.yaw)*k;}
  function stepPlayer(pl,dt){
    pl.t+=dt;pl.turning=false;const g=pl.goal,c=CHAIRS[pl.i];
    switch(pl.act){
      case 'sit':
        if(g.kind!=='chair'&&g.kind!=='hold'){pl.x=c[0];setAct(pl,'rise');}
        break;
      case 'rise':   // up out of the chair and a step forward
        pl.z=c[1]+CHAIR_FRONT*ease(pl.t/RISE_T);pl.sitLin=1-clamp(pl.t/RISE_T,0,1);pl.yaw=0;
        if(pl.t>=RISE_T)setAct(pl,'idle');
        break;
      case 'sitdown':   // back into the chair
        pl.x+=(c[0]-pl.x)*Math.min(1,dt*8);pl.z=c[1]+CHAIR_FRONT*(1-ease(pl.t/SIT_T));pl.sitLin=clamp(pl.t/SIT_T,0,1);turnTo(pl,0,dt);
        if(pl.t>=SIT_T)setAct(pl,'sit');
        break;
      case 'idle':
        if(g.kind==='hold'){watchTurn(pl,dt,null);break;}
        if(Math.hypot(g.x-pl.x,g.z-pl.z)>.06){startWalk(pl,g);break;}
        if(g.kind==='watch'){watchTurn(pl,dt,g.yaw);break;}
        if(turnTo(pl,g.yaw,dt)){if(g.kind==='chair')setAct(pl,'sitdown');else if(g.kind==='shot'){pl.feet=null;setAct(pl,'getdown');}}
        break;
      case 'walk':
        if(g.kind==='hold'){if(!pl.stopping){const sd=pl.v*pl.v/5;pl.path=[[pl.x+Math.sin(pl.yaw)*sd,pl.z+Math.cos(pl.yaw)*sd]];pl.pi=0;pl.stopping=true;}}
        else if(!g.fixed&&Math.hypot(g.x-pl.pathEnd[0],g.z-pl.pathEnd[1])>.2){const v=pl.v,h=pl.head;startWalk(pl,g);pl.v=v;pl.head=h;}
        if(walkStep(pl,dt)&&pl.v<.15){pl.v=0;pl.path=null;setAct(pl,'idle');}
        break;
      case 'getdown':
        if(g.kind!=='shot'){setAct(pl,'getup');break;}
        pl.stLin=Math.min(1,pl.stLin+dt/DOWN_T);follow(pl,g,dt);
        if(pl.stLin>=1)setAct(pl,'down');
        break;
      case 'down':
        if(g.kind!=='shot'||Math.hypot(g.x-pl.x,g.z-pl.z)>.6){setAct(pl,'getup');break;}
        follow(pl,g,dt);
        break;
      case 'getup':
        pl.stLin=Math.max(0,pl.stLin-dt/UP_T);
        if(pl.stLin<=0){pl.feet=pl.feetNow=null;setAct(pl,'idle');}
        break;
      case 'cheer':
        if(pl.t>2.6)setAct(pl,'idle');
        break;
    }
    pl.stance=ease(pl.stLin);
  }
  // The bot's way to the shot: look down the line from behind the object
  // ball first if he wants to, stand up off the shot and step back if he is
  // not happy, then get down.
  function botGoal(pl,dt){
    const r=ai.routine;
    if(r&&r.survey&&!r.surveyed){
      if(Math.hypot(pl.x-r.survey.x,pl.z-r.survey.z)<.35&&pl.act!=='walk'){r.surveyT+=dt;if(r.surveyT>r.surveyFor)r.surveyed=true;}
      if(!r.surveyed)return{kind:'watch',x:r.survey.x,z:r.survey.z,yaw:r.survey.yaw};
    }
    if(r&&r.resetUntil>time){
      if(!r.back)r.back={x:pl.x-Math.sin(pl.yaw)*.45,z:pl.z-Math.cos(pl.yaw)*.45,yaw:pl.yaw};
      return{kind:'watch',x:r.back.x,z:r.back.z,yaw:r.back.yaw};
    }
    return{kind:'shot'};
  }
  // Live plan: each player's goal for the current state of play.
  let pullNow=0;
  function livePlan(pl,dt){
    if(state.mode==='practice'&&pl.i===1){pl.fadeTo=0;pl.goal={kind:'hold'};return;}   // practice: one player
    pl.fadeTo=1;
    if(pl.holdUntil>time&&!state.inShot&&pl.act!=='sit'){pl.goal={kind:'hold'};return;}
    const cb=cueBall(),active=state.started&&!state.finished&&(state.mode==='practice'?pl.i===0:state.current===pl.i);
    if(!active||!cb){pl.goal=chairGoal(pl.i);pl.wait=0;return;}
    const human=state.mode==='versus'||pl.i===0,shot=state.inShot&&state.shot;
    pl.aim=shot?state.shot.angle:human?state.aim:(ai.plan?botAimNow():pl.aim);
    pl.cue=shot?state.shot.cueOrigin:[cb.x,cb.z];pl.pull=pullNow;
    let g;
    if(state.inShot)g=time<pl.downUntil?{kind:'shot'}:{kind:'hold'};
    else if(state.decision)g={kind:'hold'};
    else if(state.ballInHand&&human)g={kind:'watch',x:-(OUT_X+.42),z:clamp(cb.z,-.5,.5),yaw:PI/2};
    else if(human)g={kind:'shot'};
    else if(ai.plan&&!ai.planning)g=botGoal(pl,dt);
    else g={kind:'hold'};
    // the player coming to the table lets the other one get back to his chair first
    const o=PL[1-pl.i];
    if(g.kind!=='hold'&&pl.act==='sit'&&o&&o.fade>.5&&o.goal.kind==='chair'&&o.act!=='sit'&&o.act!=='sitdown'&&
      Math.hypot(o.x-CHAIRS[o.i][0],o.z-CHAIRS[o.i][1]-CHAIR_FRONT)>1.6&&pl.wait<3.5){pl.wait+=dt;g={kind:'hold'};}
    pl.goal=g;
  }
  const CUE_LEN=1.45;
  function updatePlayers(dt){
    if(!PL.length)return;
    if(!cine.on)for(const pl of PL)livePlan(pl,dt);
    const stances=PL.map(pl=>{
      let st=null;
      if(pl.goal.kind==='shot'||pl.stLin>0){st=stanceFor(pl,pl.aim,pl.cue[0],pl.cue[1],pl.pull);
        if(pl.goal.kind==='shot'){const g=pl.goal;g.x=(st.feet[0].x+st.feet[1].x)/2;g.z=(st.feet[0].z+st.feet[1].z)/2;g.yaw=Math.atan2(st.F.x,st.F.z);}}
      stepPlayer(pl,dt);return st;});
    // personal space: two people never walk through each other
    if(PL.length===2&&PL[0].fade>.5&&PL[1].fade>.5){const [a,b]=PL,dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz)||1e-6;
      const free=p=>p.act==='walk'||p.act==='idle'?1:0,fa=free(a),fb=free(b);
      if(d<.55&&fa+fb){const push=(.55-d)/(fa+fb)*Math.min(1,dt*6);a.x-=dx/d*push*fa;a.z-=dz/d*push*fa;b.x+=dx/d*push*fb;b.z+=dz/d*push*fb;}}
    PL.forEach((pl,n)=>{
      const st=stances[n];
      // the human player's own body would fill the screen in the player view
      let vis=pl.fadeTo;
      if(!cine.on&&pl.i===state.current&&playerViewActive()&&(state.mode==='versus'||pl.i===0))vis=0;
      if(Math.hypot(eye[0]-pl.x,eye[2]-pl.z)<.8&&eye[1]<FLOOR_Y+2.3)vis=0;      // camera inside the body
      pl.fade=lerp(pl.fade,vis,1-Math.exp(-dt*9));if(Math.abs(pl.fade-vis)<.01)pl.fade=vis;
      // motion weights: every change is a short eased blend; the walk is
      // played at the speed the body moves, so the feet do not slide
      const w=pl.w,k=1-Math.exp(-dt*8);
      w.walk+=((pl.act==='walk'?clamp(pl.v/.32,0,1):pl.turning?.4:0)-w.walk)*k;
      w.cheer+=((pl.act==='cheer'?1:0)-w.cheer)*(1-Math.exp(-dt*5));
      w.sit=ease(pl.sitLin);w.cue=pl.ownCue?pl.stance:0;
      const up=1-w.sit,walk=w.walk*up,cheer=w.cheer*up,cue=w.cue*up;w.idle=Math.max(0,up-walk-cheer-cue);
      const ly=pl.layer,la=ly?ly.amt:0;
      if(ly)ly.act.setEffectiveWeight((ly.seat?w.sit:w.idle)*la);
      pl.acts.sit.setEffectiveWeight(w.sit*(ly&&ly.seat?1-la:1));pl.acts.idle.setEffectiveWeight(w.idle*(ly&&!ly.seat?1-la:1));pl.acts.walk.setEffectiveWeight(walk);pl.acts.cheer.setEffectiveWeight(cheer);
      if(pl.acts.cue)pl.acts.cue.setEffectiveWeight(cue);
      pl.acts.walk.setEffectiveTimeScale(pl.act==='walk'&&pl.v>.05?clamp(pl.v/CLIP_V,.45,1.2):.6);
      pl.acts.idle.setEffectiveTimeScale(1-.97*pl.stance);      // still on the shot: no idle sway under the stance
      pl.p.obj.position.set(pl.x,FLOOR_Y,pl.z);pl.p.obj.rotation.y=pl.yaw;
      pl.p.mixer.update(dt);
      if(st&&pl.ok&&pl.stance>.002&&!pl.ownCue){plantedFeet(pl,st,dt);applyStance(pl,st);}
      if(pl.cueMesh&&pl.stance<.999){const c=1-pl.stance;curl(pl.rig.rfing,rightPalm(pl,_N),[.95*c,1.2*c,.7*c]);}
      else if(pl.act!=='walk'){const fp=focusPoint();turnHead(pl.p,pl.yaw,fp[0],fp[1],pl.act==='sit'?.45:.7);}
      updateHabits(pl,dt);if(pl.react)applyReaction(pl,dt);
      if(pl.i===(cine.on?cine.shooter:state.current))placeRest(st,pl.stance>.5&&pl.fade>.5);
      setPlayerOpacity(pl,pl.fade*(pl.block||1));
    });
  }
  // ---- reactions: how a player takes a shot that has just gone wrong (or
  // right), layered on whatever he is doing: head down and a slow shake,
  // a look up at the lights, a stare at the pocket, a sigh, a small nod.
  // Each player avoids repeating his last reaction.
  const REACTS={
    regret:{dur:2.7,w:3,f:(k,u)=>({hp:.42*k,np:.14*k,sp:.12*k,hy:Math.sin(u*TAU*1.4)*.2*k})},
    anger:{dur:2.1,w:2,f:(k,u)=>({hp:-.3*k,np:-.08*k,hy:.42*k*Math.sin(Math.min(u,1)*PI*.5),sp:-.06*k})},
    disbelief:{dur:2.5,w:2,f:(k,u)=>({hp:.12*k,hr:.24*k,hy:-.3*k,sy:.14*k})},
    sigh:{dur:2.3,w:2,f:(k,u)=>{const b=Math.sin(Math.min(1,u/1.6)*PI);return{sp:.14*k*b,hp:-.24*k*b,np:-.06*k*b};}},
    nod:{dur:1.5,w:1,f:(k,u)=>({hp:Math.sin(u*TAU*1.3)*.17*k})},
    satisfied:{dur:1.8,w:1,f:(k,u)=>({hp:-.1*k,hy:.18*k*Math.sin(u*PI),sp:-.04*k})},
    // with the free (left) hand: a small fist pump, and a hand raised to the crowd
    fistpump:{dur:1.7,w:1,arm:'pump',f:(k,u)=>({hp:-.05*k,sp:-.03*k})},
    // more ways to take a miss or a good shot, and some motion-captured ones (his cue arm stays still)
    facepalm:{dur:1.9,w:.8,hold:true,arm:'brow',f:(k,u)=>({hp:.22*k,sp:.05*k})},
    hiphand:{dur:2.6,w:1,hold:true,arm:'hip',f:(k,u)=>({hp:.18*k,hy:.1*k*Math.sin(u*2)})},
    chinrub:{dur:2.4,w:.9,hold:true,arm:'chin',f:(k,u)=>({hp:.05*k,hy:-.08*k})},
    lookup:{dur:1.8,w:.8,hold:true,f:(k,u)=>({hp:-.42*k,sp:-.05*k,hr:.05*k})},
    c_shrug:{dur:1.8,w:1,clip:'shrug',f:()=>({})},
    c_headshake:{dur:3.0,w:1.1,clip:'headshake',f:()=>({})},
    c_nodyes:{dur:2.2,w:1,clip:'nodyes',f:()=>({})},
    // habits while he waits (also seated)
    h_chin:{dur:3.2,w:1,sit:true,arm:'chin',f:(k,u)=>({hp:.04*k})},
    h_brow:{dur:1.6,w:1,sit:true,arm:'brow',f:(k,u)=>({hp:.06*k})},
    h_collar:{dur:1.5,w:1,sit:true,arm:'collar',f:(k,u)=>({hp:.1*k})},
    h_hip:{dur:4.5,w:1,arm:'hip',f:(k,u)=>({hy:.12*k*Math.sin(u*1.3)})},
    acknowledge:{dur:2.8,w:1,arm:'raise',f:(k,u)=>({hp:-.12*k,hy:.14*k*Math.sin(Math.min(u/2.2,1)*PI)})}};
  // How a player takes his good and bad moments: '' (the usual mix) or
  // 'composed' (opponents.js react): calm on easy pots, a nod for a hard
  // one, brief disappointment at a miss, a fist pump for a frame.
  const reactProfile=i=>state.mode==='bot'&&i===1&&botOpponent&&botOpponent.react||'';
  function startReaction(i,pool,delay=.35,amp=1,next=null){
    const pl=PL[i];if(!pl||!pl.ok||pl.fade<.5||cine.on)return;
    const opts=pool.length>1?pool.filter(k=>k!==pl.lastReact):pool;let sum=0;for(const k of opts)sum+=REACTS[k].w;
    let r=Math.random()*sum,kind=opts[0];for(const k of opts){r-=REACTS[k].w;if(r<=0){kind=k;break;}}
    pl.react={kind,t:-delay,amp,dur:REACTS[kind].dur*(.85+Math.random()*.3)};pl.lastReact=kind;pl.reactNext=next;
    if(typeof faceExpr==='function')faceExpr(pl.p,kind,pl.react.dur*.9,delay);
    const clip=REACTS[kind].clip&&(((window.VelvetPeople&&VelvetPeople.motions)||{}).react_male||{})[REACTS[kind].clip];
    if(clip&&!pl.layer)startLayer(pl,clip,pl.react.dur+delay,false,delay);
    if(clip||REACTS[kind].hold)pl.holdUntil=time+delay+pl.react.dur*.9;   // he stands and takes it in before walking off
  }
  // A motion-capture clip blended over his idle for a while (his cue arm keeps still).
  function startLayer(pl,clip,dur,seat,delay=0){
    const a=pl.p.play(clip,{weight:0,part:'noRight'});if(!a||!a.getClip)return false;a.reset();a.play();
    pl.layer={act:a,amt:0,from:time+delay,until:time+delay+Math.min(dur,a.getClip().duration-.2),seat};return true;
  }
  // Habits while he waits: a hand to his chin, a wipe of the brow, a tug at
  // the bow tie, a hand on the hip, another way of standing, a roll of the neck.
  const HAB_STAND=['chin','brow','collar','hip','alt','alt'],HAB_SIT=['chin','brow','collar','sitroll','chin'];
  function updateHabits(pl,dt){
    if(!pl.ok||pl.ownCue)return;
    const standing=(pl.act==='idle'||pl.act==='watch')&&pl.stance<.05&&!pl.turning,seated=pl.act==='sit'&&pl.sitLin>.98;
    if(pl.layer){const L=pl.layer,on=time>=L.from&&time<L.until&&(L.seat?seated:standing);
      L.amt+=((on?1:0)-L.amt)*(1-Math.exp(-dt*(on?2.6:3.2)));
      if(!on&&time>=L.from&&L.amt<.02){L.act.setEffectiveWeight(0);L.act.stop();pl.layer=null;}}
    if(pl.react||pl.layer||!(standing||seated)||cine.on||pl.fade<.5)return;
    if(pl.habAt===undefined)pl.habAt=time+rand(4,10);
    if(time<pl.habAt)return;
    pl.habAt=time+rand(seated?7:5,seated?18:12);
    const pool=(seated?HAB_SIT:HAB_STAND).filter(k=>k!==pl.lastHab),k=pool[Math.floor(Math.random()*pool.length)];pl.lastHab=k;
    const M=(window.VelvetPeople&&VelvetPeople.motions)||{};
    if(k==='alt'){const L=(M.stand_male||[]).filter(c=>c!=='m_idle_neutral_01');if(L.length)startLayer(pl,L[Math.floor(Math.random()*L.length)],rand(6,12),false);return;}
    if(k==='sitroll'){startLayer(pl,'m_sit_chair_idle_roll_head',rand(5,8),true);return;}
    startReaction(pl.i,['h_'+k],0);
  }
  // A composed player's frame and match: a small fist pump, and after the
  // match a hand raised to thank the crowd.
  function celebrate(i,kind){
    if(reactProfile(i)!=='composed')return;
    startReaction(i,['fistpump'],.5,1,kind==='match'?'acknowledge':null);
  }
  const _la=new T.Vector3(),_lb=new T.Vector3(),_lc=new T.Vector3(),_lt=new T.Vector3(),_lp=new T.Vector3(),_ln=new T.Vector3();
  function leftPalm(pl,out){   // palm normal of the left hand (the right hand's, mirrored)
    const r=pl.rig;r.lh.getWorldPosition(_la);r.lf.getWorldPosition(_lb);_lc.copy(_lb).sub(_la).normalize();
    r.lfing[0][0].getWorldPosition(_lb);r.lfing[3][0].getWorldPosition(out);_lb.sub(out);
    return out.crossVectors(_lc,_lb).normalize();
  }
  function reactArm(pl,kind,k,u){
    const r=pl.rig,left=_rx,fwd=_rf;r.lua.getWorldPosition(_la);r.lh.getWorldPosition(_lb);
    if(kind==='chin'||kind==='brow'||kind==='collar'){   // a hand to the face or the bow tie
      r.head.getWorldPosition(_lp);
      if(kind==='chin'){_lt.copy(_lp).addScaledVector(fwd,.15).addScaledVector(left,.012*Math.sin(u*TAU*1.5)*k);_lt.y-=.15;}
      else if(kind==='brow'){const s=ease(clamp(u/1.4,0,1));_lt.copy(_lp).addScaledVector(fwd,.15).addScaledVector(left,.06-.12*s);_lt.y+=.02;}
      else{r.neck.getWorldPosition(_lp);_lt.copy(_lp).addScaledVector(fwd,.16).addScaledVector(left,.01*Math.sin(u*TAU*2)*k);_lt.y-=.12;}
      _lt.lerp(_lb,1-k);_lp.copy(_la).addScaledVector(left,.16).addScaledVector(fwd,.06);_lp.y-=.4;
      twoBone(r.lua,r.lfa,r.lh,_lt,_lp);curl(r.lfing,leftPalm(pl,_ln),kind==='chin'?[.55*k,.7*k,.4*k]:[.12*k,.15*k,.08*k]);return;
    }
    if(kind==='hip'){     // a hand on the hip, the elbow out
      r.pelvis.getWorldPosition(_lp);_lt.copy(_lp).addScaledVector(left,.2).addScaledVector(fwd,-.01);_lt.y+=.09;
      _lt.lerp(_lb,1-k);_lp.copy(_la).addScaledVector(left,.45).addScaledVector(fwd,-.22);_lp.y-=.15;
      twoBone(r.lua,r.lfa,r.lh,_lt,_lp);curl(r.lfing,leftPalm(pl,_ln),[.25*k,.3*k,.2*k]);return;
    }
    if(kind==='pump'){   // fist in front of the chest, one short pump down
      const pump=u>.5&&u<.95?Math.sin((u-.5)/.45*PI):0;
      _lt.copy(_la).addScaledVector(fwd,.27).addScaledVector(left,-.05);_lt.y+=-.13-.07*pump;
    }else{               // hand up at the side of the head, a little wave
      _lt.copy(_la).addScaledVector(fwd,.2).addScaledVector(left,.2+.025*Math.sin(u*TAU*1.1)*k);_lt.y+=.3;
    }
    _lt.lerp(_lb,1-k);   // eased in from where the hand already is
    _lp.copy(_la).addScaledVector(left,.25).addScaledVector(fwd,-.08);_lp.y-=.35;
    twoBone(r.lua,r.lfa,r.lh,_lt,_lp);
    if(kind==='pump')curl(r.lfing,leftPalm(pl,_ln),[1.05*k,1.3*k,.9*k]);else curl(r.lfing,leftPalm(pl,_ln),[.1*k,.1*k,.05*k]);
  }
  const _rx=new T.Vector3(),_ry=new T.Vector3(0,1,0),_rf=new T.Vector3();
  function applyReaction(pl,dt){
    const R=pl.react;
    if(pl.stance>.3){R.t=Math.min(R.t,0);return;}                 // it comes as he gets up off the shot
    R.t+=dt;if(R.t<0)return;
    if(R.t>R.dur||(pl.act==='sit'&&!REACTS[R.kind].sit)){pl.react=null;const nx=pl.reactNext;pl.reactNext=null;if(nx&&pl.act!=='sit')startReaction(pl.i,[nx],.15);return;}
    const k=Math.min(1,R.t/.3)*Math.min(1,(R.dur-R.t)/.45),k2=k*k*(3-2*k),a=REACTS[R.kind].f(k2*(R.amp??1),R.t),r=pl.rig;
    _rx.set(Math.cos(pl.yaw),0,-Math.sin(pl.yaw));_rf.set(Math.sin(pl.yaw),0,Math.cos(pl.yaw));   // left (pitch: + looks down), forward
    if(a.sp)rotWorld(r.spine2,_rx,a.sp);if(a.sy)rotWorld(r.spine2,_ry,a.sy);
    if(a.np)rotWorld(r.neck,_rx,a.np);
    if(a.hp)rotWorld(r.head,_rx,a.hp);if(a.hy)rotWorld(r.head,_ry,a.hy);if(a.hr)rotWorld(r.head,_rf,a.hr);
    if(REACTS[R.kind].arm)reactArm(pl,REACTS[R.kind].arm,k2,R.t);
  }
  // After each shot: the striker's reaction to what happened.
  function reactToShot(s){
    if(!s)return;
    const by=s.by??state.current,calm=reactProfile(by)==='composed';
    if(s.foul){if(calm)startReaction(by,['sigh','regret','c_shrug'],.5,.7);else startReaction(by,['anger','regret','sigh','facepalm','c_headshake','hiphand'],.5);return;}
    const scored=state.current===by&&state.break>(s.breakBefore||0);
    if(scored){
      if(calm){if(state.break>=100&&(s.breakBefore||0)<100)startReaction(by,['acknowledge'],.6);   // a century: a hand to the crowd
        else if((s.difficulty||0)>1.7&&Math.random()<.6)startReaction(by,['nod','c_nodyes'],.2,.8);return;}
      if((s.difficulty||0)>1.7&&Math.random()<.45)startReaction(by,['nod','satisfied','c_nodyes'],.2);return;}
    if(s.kind==='safety'||s.kind==='escape'||state.shotCount<=1)return;
    if(calm){if(s.kind==='pot'||Math.random()<.4)startReaction(by,['sigh','regret','c_shrug','chinrub'],.45,.65);return;}
    if(s.kind==='pot'||Math.random()<.55)startReaction(by,['regret','anger','disbelief','sigh','facepalm','hiphand','lookup','c_headshake','c_shrug','chinrub'],.45);
  }
  // A shot struck before the player has finished walking to it: put him
  // straight down on it (rare: only when the shot is played at once).
  function snapDown(pl){
    if(!pl||pl.act==='down'||(!pl.ok&&!pl.ownCue))return;
    const cb=cueBall();if(!cb)return;
    const st=stanceFor(pl,state.aim,cb.x,cb.z,0);
    Object.assign(pl,{x:(st.feet[0].x+st.feet[1].x)/2,z:(st.feet[0].z+st.feet[1].z)/2,yaw:Math.atan2(st.F.x,st.F.z),
      act:'down',t:0,stLin:1,stance:1,sitLin:0,v:0,path:null,feet:null,feetNow:null,aim:state.aim,cue:[cb.x,cb.z],goal:{kind:'shot'}});
    pl.w.sit=0;pl.w.walk=0;
  }
  // The bot strikes only once its player is down on the shot.
  const playerReady=i=>{const pl=PL[i];return!pl||(!pl.ok&&!pl.ownCue)||pl.fade<.5||pl.act==='down';};
  const playersSnapshot=()=>PL.map(pl=>({...pl,goal:{...pl.goal},w:{...pl.w},path:pl.path&&pl.path.slice(),feet:null,feetNow:null}));
  const playersRestore=s=>{if(s)s.forEach((o,i)=>Object.assign(PL[i],o));};
  // ---- each player's own cue ----
  // Carried in the right hand, tip forward and up (nearly upright, butt on the
  // floor, when he sits); as he gets down on the shot it is brought down onto
  // the line, and it is then the cue you see striking. Without a player model
  // (or in the player view, where your own body is hidden) the usual aiming cue
  // is drawn instead.
  const _ca=new T.Vector3(),_cb=new T.Vector3(),_cc=new T.Vector3(),_cd=new T.Vector3(),_cq=new T.Quaternion(),_ctp=new T.Vector3();
  function rightPalm(pl,out){   // palm normal of the right hand
    const r=pl.rig;r.rh.getWorldPosition(_ca);r.rf.getWorldPosition(_cb);_cc.copy(_cb).sub(_ca).normalize();
    r.rfing[0][0].getWorldPosition(_cd);r.rfing[3][0].getWorldPosition(out);_cd.sub(out);
    return out.crossVectors(_cd,_cc).normalize();
  }
  // Carried: the cue lies in the hollow of the fist (between the knuckles and
  // the curled fingers), along the knuckle line tipped up toward upright; when
  // he sits it stands upright beside his knee.
  const _g1=new T.Vector3(),_g2=new T.Vector3(),_g3=new T.Vector3();
  function carryPose(pl,pos,quat){
    const r=pl.rig,fx=Math.sin(pl.yaw),fz=Math.cos(pl.yaw),sit=pl.w.sit;
    r.rfing[0][0].getWorldPosition(_g1);r.rfing[3][0].getWorldPosition(_g2);
    _cc.copy(_g1).sub(_g2);if(_cc.lengthSq()<1e-8)_cc.set(fx,0,fz);_cc.normalize();     // knuckle line, little to index
    if(_cc.x*fx+_cc.z*fz<0)_cc.negate();                                                // tip forward
    _cc.y+=.9;_cc.normalize();
    r.rfing[1][0].getWorldPosition(_g1);r.rfing[2][0].getWorldPosition(_g2);_g3.copy(_g1).add(_g2).multiplyScalar(.5);
    r.rfing[1][1].getWorldPosition(_g1);r.rfing[2][1].getWorldPosition(_g2);_g1.add(_g2).multiplyScalar(.5);
    pos.copy(_g3).lerp(_g1,.55);                                                         // the hollow of the fist
    if(sit>0){_ca.set(fx*Math.cos(1.42),Math.sin(1.42),fz*Math.cos(1.42));_cc.lerp(_ca,sit).normalize();}
    quat.setFromUnitVectors(UPV,_ca.copy(_cc).negate());                                 // cue frame: +Y from the tip to the butt
    pos.addScaledVector(_cc,lerp(1.1,.86,sit));                                          // origin at the tip
  }
  function placePlayerCues(){
    if(!PL.length)return;
    const sh=cine.on?cine.shooter:(state.started&&!state.finished?state.current:-1);
    for(const pl of PL){
      const m=pl.cueMesh;if(!m)continue;
      if(!pl.p.obj.visible||pl.fade<.5){m.visible=false;continue;}
      carryPose(pl,_ctp,_cq);
      const k=pl.i===sh?pl.stance:0;
      if(k>0){const dx=Math.cos(pl.aim),dz=Math.sin(pl.aim),elev=.07,tip=R+.009+pl.pull;
        _ca.set(pl.cue[0]-dx*tip,BALL_Y+.004,pl.cue[1]-dz*tip);_cc.set(-dx*Math.cos(elev),Math.sin(elev),-dz*Math.cos(elev));
        m.position.lerpVectors(_ctp,_ca,k);m.quaternion.slerpQuaternions(_cq,_q1.setFromUnitVectors(UPV,_cc),k);}
      else{m.position.copy(_ctp);m.quaternion.copy(_cq);}
      m.visible=true;
      if(pl.i===sh)cueGroup.visible=false;   // his own cue is the one on the line
    }
  }
