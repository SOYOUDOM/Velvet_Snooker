  // ---- PLAYERS: IN THEIR CHAIRS, WALKING ROUND THE TABLE, DOWN ON THE SHOT ----
  // Two player characters (role 'player' in characters/characters.js). Each
  // has a goal from the state of play (sit in the chair, play the shot, watch)
  // and gets there the way a person would: leans forward and pushes up off the
  // arm of the chair, walks round the table and the furniture (never through
  // it, the referee or the other player: people steer round each other, and
  // someone standing in the way steps aside), turns on the spot, then gets
  // down on the shot (feet first, then the bridge hand, then the head) or sits
  // back down. Down on the shot the body is posed by inverse kinematics every
  // frame: the bridge hand on the cloth with the cue in the V of the thumb, the
  // chin over the cue, the fist closed round the butt, the cue arm swinging
  // from the elbow; the tip addresses the cue ball where the spin is set. Shots
  // out of reach are played with the rest, which the referee brings and takes
  // back, and a butt extension the player screws on. Between shots he chalks,
  // leans on his cue, rubs his chin, looks round. A model that brings its own
  // 'cue' clip (see characters.js) plays that instead of the computed pose.
  const PL=[];
  const CHAIRS=[[-.95,CHAIR_Z+.06],[.95,CHAIR_Z+.06]],CHAIR_FRONT=.4;
  const RISE_T=1.6,SIT_T=1.5,DOWN_T=1.05,UP_T=.75,WALK_V=1.15,CLIP_V=1.01,BODY_R=.24;
  const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const sstep=(a,b,x)=>ease((x-a)/(b-a));
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
  // An arm reaching for a point, eased in by 'w' from where its animation has it.
  const _ra1=new T.Vector3();
  function reachArm(ua,fa,hand,target,w,pole){if(w<.002)return;hand.getWorldPosition(_ra1);_ra1.lerp(target,clamp(w,0,1));twoBone(ua,fa,hand,_ra1,pole);}
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
    rig.lfing=fing('L');rig.rfing=fing('R');rig.lth0=g('L_Finger0');rig.rth0=g('R_Finger0');rig.lth1=g('L_Finger01');
    const ok=!!tpl.rocketbox&&Object.values(rig).every(v=>Array.isArray(v)?v.flat().every(Boolean):!!v);
    const ownCue=!!(tpl.clipMap&&tpl.clipMap.cue&&tpl.own[tpl.clipMap.cue]);
    const acts={sit:p.play(p.clip('sit',i*2)||'idle',{weight:1}),idle:p.play('idle',{weight:0}),walk:p.play('walk',{weight:0}),cheer:p.play('cheer',{weight:0})};
    if(ownCue)acts.cue=p.play('cue',{weight:0});
    const pl={i,p,rig,ok,ownCue,acts,w:{sit:1,idle:0,walk:0,cheer:0,cue:0},
      act:'sit',t:0,x:CHAIRS[i][0],z:CHAIRS[i][1],px:CHAIRS[i][0],pz:CHAIRS[i][1],vx:0,vz:0,yaw:0,v:0,path:null,pi:0,pathEnd:null,goal:chairGoal(i),
      sitLin:1,stLin:0,stance:0,feet:null,feetNow:null,ox:0,oz:0,turning:false,watchTurn:false,wait:0,slow:1,blockT:0,yieldGoal:null,
      fade:1,fadeTo:1,hip:(tpl.rootY||.92)*p.obj.scale.y,
      sb:STANCE_BONES.map(n=>rig[n]).concat(ok?[...rig.lfing.flat(),...rig.rfing.flat()]:[]),
      downUntil:0,aim:0,cue:[0,0],pull:0,cueMesh:null,st:null,
      kit:{rest:'none',ext:0,screw:0},gripFix:new T.Vector3(),bridgeFix:new T.Vector3(),aimSet:null,aimPrev:null,aimV:0,aimSweep:false,cueAct:null,lookAt:null,lookUntil:0};
    if(ok){const m=cueGroup.clone();m.visible=false;styleCue(m,tpl.entry.cue);scene.add(m);pl.cueMesh=m;}
    return pl;
  }
  function spawnPlayers(P){
    kitMeshes();
    if(!P.list('player').length)return;
    for(let i=0;i<2;i++)PL.push(makePlayer(P,i,wantPlayerTpl(P,i)));
  }
  // At the start of a match (and when you pick another opponent) the right
  // bodies take the chairs.
  function syncPlayerBodies(){
    resetKit();                                       // a new match: the rest back on its hooks, extensions off
    const P=window.VelvetPeople;if(!P||!P.ready||PL.length<2)return;
    for(let i=0;i<2;i++){
      const tpl=wantPlayerTpl(P,i);if(!tpl||PL[i].p.tpl===tpl)continue;
      const old=PL[i];scene.remove(old.p.obj);if(old.cueMesh)scene.remove(old.cueMesh);
      const nw=makePlayer(P,i,tpl);nw.fade=old.fade;nw.fadeTo=old.fadeTo;nw.kit=old.kit;PL[i]=nw;
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
    if(!nick)return name;const w=String(name).split(' '),q='“'+String(nick).toUpperCase()+'”';
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

  // ---- THE REST, THE BUTT EXTENSION AND THE CHALK ----
  // A brass cross-head rest on a long ash shaft (it hangs on hooks under the
  // baulk-end rail until the referee fetches it), a screw-on butt extension
  // for each player (brass thread, black sleeve, rubber bumper) and a cube of
  // blue chalk. Built on first use.
  const REST_L=1.52,EXT_L=.44,BUTT_Y=1.452;
  const KIT={rest:null,ext:[],chalk:null,at:'hooks',holder:null,hookA:new T.Vector3(),hookB:new T.Vector3()};
  function kitMeshes(){
    if(KIT.rest)return KIT;
    const brass=new T.MeshStandardMaterial({color:'#c9a45c',roughness:.28,metalness:.88}),wood=new T.MeshPhysicalMaterial({color:'#8a5f37',roughness:.4,clearcoat:.55,clearcoatRoughness:.3}),
      black=new T.MeshPhysicalMaterial({color:'#141112',roughness:.34,clearcoat:.7,clearcoatRoughness:.2}),rubber=new T.MeshStandardMaterial({color:'#0b0b0c',roughness:.8});
    const lathe=(g,pts,mat,seg=24)=>{const m=new T.Mesh(new T.LatheGeometry(pts.map(q=>new T.Vector2(q[0],q[1])),seg),mat);m.castShadow=true;g.add(m);return m;};
    // the rest, along +Y from its rubber end (0) to the head (REST_L); the cross stands across the shaft, its V toward +Z
    const rest=new T.Group();
    lathe(rest,[[0,0],[.0128,0],[.0128,.014],[.0118,.02]],rubber);
    lathe(rest,[[.0118,.02],[.0113,.32],[.0094,REST_L-.04],[.0092,REST_L-.036]],wood);
    lathe(rest,[[.0092,REST_L-.04],[.0104,REST_L-.035],[.0104,REST_L-.009],[.007,REST_L-.002],[0,REST_L-.002]],brass);
    for(const a of [PI/4,-PI/4]){const bar=new T.Mesh(new T.BoxGeometry(.112,.007,.0065),brass);bar.position.y=REST_L+.002;bar.rotation.y=a;bar.castShadow=true;rest.add(bar);}
    for(const sx of [-1,1]){const tip=new T.Mesh(new T.SphereGeometry(.0045,10,8),brass);tip.position.set(sx*.0395,REST_L+.002,.0395);rest.add(tip);}
    rest.visible=false;scene.add(rest);KIT.rest=rest;
    const ext=new T.Group();
    lathe(ext,[[0,0],[.0149,0],[.0152,.004],[.0152,.017],[.0148,.019]],brass,32);
    lathe(ext,[[.0148,.019],[.0153,.2],[.0159,EXT_L-.012],[.0159,EXT_L-.01]],black,32);
    lathe(ext,[[.0157,EXT_L-.01],[.0152,EXT_L-.002],[.009,EXT_L+.002],[0,EXT_L+.002]],rubber,24);
    for(let i=0;i<2;i++){const e=i?ext.clone():ext;e.visible=false;scene.add(e);KIT.ext.push(e);}
    const chalk=new T.Mesh(new T.BoxGeometry(.021,.018,.021),[1,2,3,4,5,6].map(k=>new T.MeshStandardMaterial({color:k===3?'#5d93c9':'#2f6fb2',roughness:.92})));
    chalk.visible=false;scene.add(chalk);KIT.chalk=chalk;
    KIT.hookA.set(-(OUT_X-.04),CLOTH_Y-.118,-REST_L/2);KIT.hookB.set(-(OUT_X-.04),CLOTH_Y-.118,REST_L/2);
    return KIT;
  }
  function resetKit(){
    KIT.at='hooks';KIT.holder=null;for(const pl of PL){pl.kit={rest:'none',ext:0,screw:0};pl.cueAct=null;}
    ref.queue=ref.queue.filter(t=>!kitTask(t));if(kitTask(ref.task))ref.task=null;
  }
  // Lay an object's +Y axis from 'from' to 'to', its +Z as near 'upHint' as it can be.
  const _k1=new T.Vector3(),_k2=new T.Vector3(),_k3=new T.Vector3(),_km=new T.Matrix4();
  function alongY(obj,from,to,upHint){
    _k1.copy(to).sub(from);if(_k1.lengthSq()<1e-10)_k1.set(0,1,0);_k1.normalize();
    _k2.copy(upHint).addScaledVector(_k1,-upHint.dot(_k1));if(_k2.lengthSq()<1e-6)_k2.set(_k1.y,-_k1.x,0);_k2.normalize();
    _k3.crossVectors(_k1,_k2);_km.makeBasis(_k3,_k1,_k2);obj.quaternion.setFromRotationMatrix(_km);obj.position.copy(from);
  }
  // Where the tip meets the cue ball: off centre by the spin set for the shot
  // (above for top, below for screw, to a side for side), half a radius at most.
  function tipSpot(i){
    const sh=state.inShot&&state.shot&&state.shot.spin&&state.shot.by===i?state.shot.spin:null,s=sh?{spinX:sh[0],spinY:sh[1]}:(shotSettings(i)||{});
    return[clamp(+s.spinX||0,-1,1)*R*.5,clamp(+s.spinY||0,-1,1)*R*.5];
  }
  // Where the body goes for a shot along 'aim' at a cue ball (x,z).
  function stanceFor(pl,aim,cx,cz,pull){
    const dx=Math.cos(aim),dz=Math.sin(aim),F=new T.Vector3(dx,0,dz),Rt=new T.Vector3(-dz,0,dx),elev=.07;
    // the body is set from the address (tip at the ball, where the spin puts it); only the cue and the
    // cue hand follow the stroke ('pull': back is positive)
    const [sl,su]=tipSpot(pl.i),deep=Math.sqrt(Math.max(R*R-sl*sl-su*su,0));
    const tip0=new T.Vector3(cx-dx*(deep+.009)+Rt.x*sl,BALL_Y+su,cz-dz*(deep+.009)+Rt.z*sl),tip=tip0.clone().addScaledVector(F,-pull);
    const cueAt=(s,lat=0,lift=0)=>tip.clone().addScaledVector(F,-s*Math.cos(elev)).addScaledVector(Rt,lat).add(_v4.set(0,s*Math.sin(elev)+lift,0));
    let sEdge=0;for(;sEdge<4;sEdge+=.02){const x=tip0.x-dx*sEdge,z=tip0.z-dz*sEdge;if(Math.abs(x)>OUT_X+.03||Math.abs(z)>OUT_Z+.03)break;}
    const back=Math.max(0,sEdge+.12-1.0),rest=back>.34;
    const at=(s,lat,y)=>tip0.clone().addScaledVector(F,-s).addScaledVector(Rt,lat).setY(y);
    const h=pl.hip;
    if(!rest){
      const k=back;
      return{rest,ext:back>.24,F,Rt,tip,elev,cueAt,
        feet:[at(1.0+k,-.30,FLOOR_Y+.085),at(1.56+k,-.03,FLOOR_Y+.085)],
        hips:at(1.22+k,-.11,FLOOR_Y+h*.9),
        neck:at(.82+k*.8,-.055,BALL_Y+.205+su*.6),head:at(.63+k*.8,-.02,BALL_Y+.17+su*.6),
        lw:at(.33,-.024,CLOTH_Y+.05+su*.8),rw:cueAt(1.12,.012,.085),bridgeS:.255};
    }
    const sG=sEdge+.26,ext=sEdge>.62;
    return{rest,ext,F,Rt,tip,elev,cueAt,sEdge,sG:sG+(ext?.3:0),
      feet:[at(sEdge+.22+(ext?.25:0),-.24,FLOOR_Y+.085),at(sEdge+.62+(ext?.25:0),.02,FLOOR_Y+.085)],
      hips:at(sEdge+.42+(ext?.25:0),-.07,FLOOR_Y+h*.97),
      neck:at(sEdge+.12,-.05,BALL_Y+.5),head:at(sEdge-.02,-.02,BALL_Y+.5),
      lw:at(sEdge-.03,-.22,RAIL_TOP+.05),rw:cueAt(sG+(ext?.3:0),.012,.08),restHead:cueAt(.44,0,-.0085)};
  }
  // The hollow of the cue hand's fist (where the cue runs through it).
  const _gp1=new T.Vector3(),_gp2=new T.Vector3();
  function gripPoint(pl,out){
    const r=pl.rig;
    r.rfing[1][0].getWorldPosition(_gp1);r.rfing[2][0].getWorldPosition(_gp2);out.copy(_gp1).add(_gp2).multiplyScalar(.5);
    r.rfing[1][1].getWorldPosition(_gp1);r.rfing[2][1].getWorldPosition(_gp2);_gp1.add(_gp2).multiplyScalar(.5);
    return out.lerp(_gp1,.55);
  }
  // The V of the bridge hand (between the thumb and the first knuckle), where the cue lies.
  function bridgeV(pl,out){
    const r=pl.rig;r.lth1.getWorldPosition(_gp1);r.lfing[0][0].getWorldPosition(_gp2);
    return out.copy(_gp1).lerp(_gp2,.45).add(_v4.set(0,.008,0));
  }
  const _cl=new T.Vector3();
  function closestOnLine(p,a,dir,out){return out.copy(p).sub(a).projectOnVector(dir).add(a);}
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
    const cueDir=_C.set(-st.F.x*Math.cos(st.elev),Math.sin(st.elev),-st.F.z*Math.cos(st.elev));   // from the tip toward the butt
    // the bridge hand: flat on the cloth, its V moved under the cue (measured, so it holds for any body)
    _v1.copy(st.lw).add(st.rest?_v4.set(0,0,0):pl.bridgeFix);
    r.lua.getWorldPosition(_v2);
    twoBone(r.lua,r.lfa,r.lh,_v1,_v3.copy(_v2).addScaledVector(st.Rt,-.6).add(_v4.set(0,-.15,0)));
    r.lh.getWorldPosition(_v2);aimBone(r.lh,r.lf,_v3.copy(_v2).addScaledVector(st.F,.12).add(_v4.set(0,-.025,0)));
    if(!st.rest){twistTo(r.lh,r.lf,r.lfing[0][0],r.lfing[3][0],st.Rt);curl(r.lfing,_N.set(0,-1,0),[-.25,-.1,.15]);
      bridgeV(pl,_v2);aimBone(r.lth0,r.lth1,_v3.copy(_v2).addScaledVector(st.F,.05).add(_v4.set(0,.012,0)));   // the thumb up along the cue
      bridgeV(pl,_v2);closestOnLine(_v2,st.tip,cueDir,_cl);_cl.y-=.0055;_cl.sub(_v2);
      pl.bridgeFix.addScaledVector(_cl,.5);if(pl.bridgeFix.length()>.07)pl.bridgeFix.setLength(.07);pl.bridgeFix.y=clamp(pl.bridgeFix.y,-.012,.03);}
    else{curl(r.lfing,leftPalm(pl,_N),[.9,1.1,.7]);}   // a fist round the rest's shaft
    // the cue hand: its fist closed round the butt, moved onto the cue line the same way
    _v1.copy(st.rw).add(pl.gripFix);
    twoBone(r.rua,r.rfa,r.rh,_v1,_v3.copy(st.rw).add(_v4.set(0,.7,0)).addScaledVector(st.F,-.25).addScaledVector(st.Rt,.08));
    r.rh.getWorldPosition(_v2);aimBone(r.rh,r.rf,_v3.copy(_v2).add(_v4.set(0,-.09,0)).addScaledVector(st.F,.03));
    twistTo(r.rh,r.rf,r.rfing[0][0],r.rfing[3][0],st.F);
    curl(r.rfing,_v3.copy(st.Rt).negate(),[.95,1.2,.7]);
    gripPoint(pl,_v2);closestOnLine(_v2,st.tip,cueDir,_cl).sub(_v2);
    pl.gripFix.addScaledVector(_cl,.5);if(pl.gripFix.length()>.09)pl.gripFix.setLength(.09);
    // legs: feet planted on the floor
    const feet=pl.feetNow||st.feet;
    for(const [th,ca,ft,to,foot,lat] of [[r.lth,r.lca,r.lft,r.lto,feet[0],-.06],[r.rth,r.rca,r.rft,r.rto,feet[1],.04]]){
      th.getWorldPosition(_v2);twoBone(th,ca,ft,foot,_v3.copy(_v2).addScaledVector(st.F,1).addScaledVector(st.Rt,lat));
      ft.getWorldPosition(_v2);aimBone(ft,to,_v3.copy(_v2).addScaledVector(st.F,.16).addScaledVector(st.Rt,lat).setY(FLOOR_Y+.01));
    }
    // getting down: the feet are set first, then the cue arm and the bridge hand go down as the back
    // bends, the head last; getting up runs the other way
    const s=pl.stLin;
    if(s<.999){
      const wl=ease(s/.55),ws=ease((s-.1)/.75),wh=ease((s-.3)/.7),wa=ease((s-.18)/.62),wr=ease((s-.05)/.8);
      const gw=i=>i<4?ws:i<6?wh:i<9?wa:i<12?wr:i<18?wl:i<30?wa:wr;
      pl.sb.forEach((b,i)=>{_q1.copy(b.quaternion);b.quaternion.copy(before[i]).slerp(_q1,gw(i));});
      r.root.position.lerpVectors(rootBefore,r.root.position,(wl+ws)/2);
    }
    obj.updateMatrixWorld(true);
  }
  // A person (or a rail) fading out of the way: see fadePerson.
  function setPlayerOpacity(pl,o){fadePerson(pl.p.obj,o);pl.p.obj.visible=o>.02;}

  // ---- WHERE PEOPLE CAN WALK ----
  // The floor round the table as a grid of 8 cm cells. Solid: the table, both
  // chairs (and the legs of whoever sits in one), the drinks table, the trophy,
  // the TV cameras and objects placed in VELVET Studio, each with a person's
  // half-width kept clear. Paths are found on the grid (A*, keeping to open
  // floor where it can) and pulled straight where the way is clear.
  const NAV={cell:.08,x0:-(OUT_X+3.2),z0:-(OUT_Z+3.4),nx:0,nz:0,cache:new Map()};
  NAV.nx=Math.ceil(-2*NAV.x0/NAV.cell)+1;NAV.nz=Math.ceil(-2*NAV.z0/NAV.cell)+1;
  const seated=p=>p&&p.fade>.5&&(p.act==='sit'||p.act==='rise'||p.act==='sitdown');
  function navSolids(self){
    const S=[{x:0,z:0,hx:OUT_X,hz:OUT_Z,r:.1},{x:0,z:CHAIR_Z,c:.27}];   // the table (corners rounded), the drinks table
    CHAIRS.forEach((c,j)=>{if(j===self)return;S.push({x:c[0],z:CHAIR_Z,hx:.3,hz:.28,r:0});
      if(seated(PL[j]))S.push({x:c[0],z:CHAIR_Z+.44,hx:.25,hz:.22,r:0});});   // his knees and feet
    if(stage.trophyAt)S.push({x:stage.trophyAt[0],z:stage.trophyAt[2],hx:.24,hz:.24,r:0});
    const bb=new T.Box3(),add=o=>{try{bb.setFromObject(o);}catch(e){return;}if(bb.isEmpty()||bb.min.y>FLOOR_Y+1.6)return;
      const x=(bb.min.x+bb.max.x)/2,z=(bb.min.z+bb.max.z)/2,hx=(bb.max.x-bb.min.x)/2,hz=(bb.max.z-bb.min.z)/2;
      if(hx<2.2&&hz<2.2&&Math.abs(x)<-NAV.x0&&Math.abs(z)<-NAV.z0)S.push({x,z,hx,hz,r:0});};
    arenaGroup.traverse(o=>{if(o.userData&&o.userData.vxObj==='tvcam')add(o);});
    if(customGroup)for(const o of customGroup.children)add(o);
    return S;
  }
  // Clearance (metres to the nearest solid) at every cell, for one walker.
  function navField(self){
    const key=venueId+'|'+self+'|'+(seated(PL[0])?1:0)+(seated(PL[1])?1:0)+'|'+arenaGroup.children.length+'|'+(customGroup?customGroup.children.length:0)+'|'+(stage.trophyAt?1:0);
    let F=NAV.cache.get(key);if(F)return F;
    if(NAV.cache.size>12)NAV.cache.clear();
    const S=navSolids(self),{cell,x0,z0,nx,nz}=NAV;F=new Float32Array(nx*nz);
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=x0+i*cell,z=z0+j*cell;let d=9;
      for(const s of S){let e;
        if(s.c)e=Math.hypot(x-s.x,z-s.z)-s.c;
        else{const qx=Math.abs(x-s.x)-s.hx+s.r,qz=Math.abs(z-s.z)-s.hz+s.r;e=Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0)-s.r;}
        if(e<d)d=e;}
      F[j*nx+i]=d;}
    NAV.cache.set(key,F);return F;
  }
  const navCell=(x,z)=>{const i=Math.round((x-NAV.x0)/NAV.cell),j=Math.round((z-NAV.z0)/NAV.cell);return i<0||j<0||i>=NAV.nx||j>=NAV.nz?-1:j*NAV.nx+i;};
  function clearAt(self,x,z){const c=navCell(x,z);return c<0?9:navField(self)[c];}
  function nearestFree(F,c0,min){
    const {nx,nz}=NAV,seen=new Uint8Array(nx*nz),q=[c0];seen[c0]=1;
    for(let h=0;h<q.length&&h<9000;h++){const c=q[h];if(F[c]>min)return c;const i=c%nx,j=(c-i)/nx;
      for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=nx||b>=nz)continue;const n=b*nx+a;if(!seen[n]){seen[n]=1;q.push(n);}}}
    return -1;
  }
  // A path from (ax,az) to (bx,bz) for player 'self': waypoints, the last one the goal itself.
  function planPath(ax,az,bx,bz,self,extra){
    const {nx,nz,cell,x0,z0}=NAV,pt=c=>{const i=c%nx;return[x0+i*cell,z0+(c-i)/nx*cell];};
    let F=navField(self);
    if(extra&&extra.length){F=Float32Array.from(F);          // people standing in the way, as solids this once
      for(const o of extra){const R=o.c+.7,i0=Math.max(0,Math.floor((o.x-R-x0)/cell)),i1=Math.min(nx-1,Math.ceil((o.x+R-x0)/cell)),
          j0=Math.max(0,Math.floor((o.z-R-z0)/cell)),j1=Math.min(nz-1,Math.ceil((o.z+R-z0)/cell));
        for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const e=Math.hypot(x0+i*cell-o.x,z0+j*cell-o.z)-o.c,k=j*nx+i;if(e<F[k])F[k]=e;}}}
    let s=navCell(ax,az),g=navCell(bx,bz);
    if(s<0||g<0)return[[bx,bz]];
    const MIN=BODY_R+.01;if(F[s]<=MIN)s=nearestFree(F,s,MIN);if(F[g]<=MIN)g=nearestFree(F,g,MIN);
    if(s<0||g<0)return[[bx,bz]];
    const N=nx*nz,G=new Float32Array(N).fill(Infinity),from=new Int32Array(N).fill(-1),done=new Uint8Array(N),heap=[],gi=g%nx,gj=(g-gi)/nx;
    const hcost=c=>{const i=c%nx,j=(c-i)/nx,dx=Math.abs(i-gi),dz=Math.abs(j-gj);return(Math.max(dx,dz)+.414*Math.min(dx,dz))*cell;};
    const push=(f,c)=>{heap.push([f,c]);let k=heap.length-1;while(k){const p=(k-1)>>1;if(heap[p][0]<=heap[k][0])break;[heap[p],heap[k]]=[heap[k],heap[p]];k=p;}};
    const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let k=0;for(;;){const a=2*k+1,b=a+1;let m=k;
      if(a<heap.length&&heap[a][0]<heap[m][0])m=a;if(b<heap.length&&heap[b][0]<heap[m][0])m=b;if(m===k)break;[heap[m],heap[k]]=[heap[k],heap[m]];k=m;}}return top;};
    G[s]=0;push(hcost(s),s);
    const ok=c=>F[c]>MIN,pen=c=>1+1.6*clamp((.62-F[c])/.38,0,1);   // open floor is cheaper: people keep a little away from things
    while(heap.length){const [,c]=pop();if(done[c])continue;done[c]=1;if(c===g)break;
      const i=c%nx,j=(c-i)/nx;
      for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){if(!di&&!dj)continue;const a=i+di,b=j+dj;if(a<0||b<0||a>=nx||b>=nz)continue;
        const n=b*nx+a;if(done[n]||!ok(n))continue;if(di&&dj&&(!ok(j*nx+a)||!ok(b*nx+i)))continue;
        const gn=G[c]+(di&&dj?1.414:1)*cell*pen(n);if(gn<G[n]){G[n]=gn;from[n]=c;push(gn+hcost(n),n);}}}
    if(!done[g])return[[bx,bz]];
    const cells=[];for(let c=g;c>=0;c=from[c])cells.push(c);cells.reverse();
    // pull the path straight where it can keep half a metre from things (less only close to where it starts
    // and ends, which may be right by the table or a chair)
    const clear=(a,b)=>{const pa=pt(cells[a]),pb=pt(cells[b]),fa=F[cells[a]],fb=F[cells[b]];
      const L=Math.hypot(pb[0]-pa[0],pb[1]-pa[1]),n=Math.ceil(L/.04);
      for(let k=1;k<n;k++){const t=k/n,c=navCell(pa[0]+(pb[0]-pa[0])*t,pa[1]+(pb[1]-pa[1])*t);if(c<0)return false;
        const need=Math.min(.48,Math.max(MIN,Math.min(fa+L*t*.9,fb+L*(1-t)*.9)));if(F[c]<need-.01)return false;}return true;};
    const out=[];let a=0;
    while(a<cells.length-1){let b=cells.length-1;while(b>a+1&&!clear(a,b))b--;out.push(pt(cells[b]));a=b;}
    if(Math.hypot(out.length?out[out.length-1][0]-bx:9,out.length?out[out.length-1][1]-bz:9)>.02)out.push([bx,bz]);
    if(navCell(ax,az)!==s)out.unshift(pt(s));
    return out.length?out:[[bx,bz]];
  }
  function pathLeft(pl){let s=0,x=pl.x,z=pl.z;for(let i=pl.pi;i<pl.path.length;i++){const p=pl.path[i];s+=Math.hypot(p[0]-x,p[1]-z);x=p[0];z=p[1];}return s;}
  function pathAhead(pl,dist){let x=pl.x,z=pl.z;
    for(let i=pl.pi;i<pl.path.length;i++){const p=pl.path[i],d=Math.hypot(p[0]-x,p[1]-z);if(d>=dist){const k=dist/d;return[x+(p[0]-x)*k,z+(p[1]-z)*k];}dist-=d;x=p[0];z=p[1];}
    return[x,z];}
  // ---- PEOPLE ROUND EACH OTHER ----
  // Everyone on the floor (both players and the referee) with where they are
  // heading. A walker looks ahead: anyone he would pass too close to in the
  // next second and a half, he steers round (on the side that person is not
  // on, by his right when they meet head on, never into the furniture), slowing
  // if he must; someone standing still in his way steps aside for him. Whatever
  // overlap is left is pushed apart, so bodies never pass through each other.
  const agentsNow=[];
  function gatherAgents(dt){
    agentsNow.length=0;
    for(const p of PL){
      const k=1-Math.exp(-dt*10),ivx=(p.x-p.px)/Math.max(dt,1e-3),ivz=(p.z-p.pz)/Math.max(dt,1e-3);
      p.vx+=(clamp(ivx,-3,3)-p.vx)*k;p.vz+=(clamp(ivz,-3,3)-p.vz)*k;p.px=p.x;p.pz=p.z;
      if(p.fade<.5)continue;
      agentsNow.push({who:p,x:p.x,z:p.z,vx:p.vx,vz:p.vz,r:p.act==='down'||p.act==='getdown'?.32:seated(p)?.3:BODY_R});}
    const rp=ref.person&&ref.person.obj;
    if(rp&&refFade>.5){const x=rp.position.x,z=rp.position.z,k=1-Math.exp(-dt*10);
      if(ref.wx!=null){ref.wvx=(ref.wvx||0)+((x-ref.wx)/Math.max(dt,1e-3)-(ref.wvx||0))*k;ref.wvz=(ref.wvz||0)+((z-ref.wz)/Math.max(dt,1e-3)-(ref.wvz||0))*k;}
      ref.wx=x;ref.wz=z;agentsNow.push({who:ref,x,z,vx:clamp(ref.wvx||0,-3,3),vz:clamp(ref.wvz||0,-3,3),r:BODY_R});}
  }
  const radiusOf=o=>{const a=agentsNow.find(q=>q.who===o);return a?a.r:BODY_R;};
  // The heading (hx,hz) a walker wants, bent round the people ahead; also how much he must slow.
  const _st=[0,0,1];
  function steer(pl,hx,hz){
    let turn=0,slow=1;const v=Math.max(pl.v,.7);
    for(const o of agentsNow){if(o.who===pl)continue;
      const rx=o.x-pl.x,rz=o.z-pl.z,d=Math.hypot(rx,rz);if(d>2.6)continue;
      const R2=BODY_R+o.r+.12,ux=hx*v-o.vx,uz=hz*v-o.vz,uu=ux*ux+uz*uz;
      const t=uu>1e-6?clamp((rx*ux+rz*uz)/uu,0,1.6):0,mx=rx-ux*t,mz=rz-uz*t,miss=Math.hypot(mx,mz),ahead=rx*hx+rz*hz;
      if(ahead<-.15&&d>R2)continue;                                    // behind him: not his problem
      if(miss<R2){
        const urg=(1-t/1.6)*clamp((R2-miss)/R2+.25,0,1);
        let side=Math.sign(hx*rz-hz*rx);                                 // <0: the other is on his left, so he bears right
        if(Math.abs(hx*rz-hz*rx)<.08*d)side=-1;                          // head on: both bear right
        let a=(side<0?-1:1)*urg*1.1;
        // not into the furniture: try the other way, or just slow down
        const ta=Math.atan2(hx,hz)+a,headOn=Math.abs(hx*rz-hz*rx)<.08*d;
        if(clearAt(pl.i,pl.x+Math.sin(ta)*.45,pl.z+Math.cos(ta)*.45)<BODY_R+.04){a=headOn?-a*.8:0;const tb=Math.atan2(hx,hz)+a;
          if(a&&clearAt(pl.i,pl.x+Math.sin(tb)*.45,pl.z+Math.cos(tb)*.45)<BODY_R+.04)a=0;}
        if(Math.abs(a)>Math.abs(turn))turn=a;
      }
      // someone standing in the way steps aside
      if(ahead>0&&d<R2+.6&&o.who!==ref&&o.who.act!=='down'&&o.who.act!=='getdown'&&!seated(o.who)&&Math.hypot(o.vx,o.vz)<.15&&pl.blockT>.5&&!o.who.yieldGoal)stepAside(o.who,pl);
      if(ahead>0&&d<R2+.6&&o.who===ref&&pl.blockT>.5)ref.yieldFrom=time;
    }
    // how fast, on the course he has taken: easing off to brush past someone, stopping short only if he would walk into him
    const a=Math.atan2(hx,hz)+turn,sx=Math.sin(a),sz=Math.cos(a);
    for(const o of agentsNow){if(o.who===pl)continue;
      const rx=o.x-pl.x,rz=o.z-pl.z,d=Math.hypot(rx,rz),ahead=rx*sx+rz*sz;if(ahead<=0||d>1.6)continue;
      const R0=BODY_R+o.r+.01,lat=Math.abs(rx*sz-rz*sx);
      slow=Math.min(slow,lat<R0?clamp((d-R0)/.45,0,1):clamp(.45+(d-R0)/.6,.45,1));}
    _st[0]=sx;_st[1]=sz;_st[2]=slow;return _st;
  }
  // Out of a walker's way: to the side he is not heading for, or back.
  function stepAside(pl,w){
    const hx=Math.sin(w.yaw),hz=Math.cos(w.yaw),cr=hx*(pl.z-w.z)-hz*(pl.x-w.x),L=[hz,-hx],Rr=[-hz,hx],first=cr<0?L:Rr,second=cr<0?Rr:L;
    for(const d of [first,second,[hx,hz]]){const x=pl.x+d[0]*.62,z=pl.z+d[1]*.62;
      if(clearAt(pl.i,x,z)>BODY_R+.06){pl.yieldGoal={kind:'watch',x,z,yaw:pl.yaw,fixed:true,until:time+3,from:w};return;}}
  }
  // What overlap is left: pushed apart (those who are sitting, getting up or down, or down on a shot stand
  // firm), and a walker is kept out of the furniture.
  function separate(dt){
    const movable=p=>p.act==='walk'||p.act==='idle'||p.act==='cheer',cap=Math.max(.012,1.1*dt);   // (a firm shuffle, never a jump)
    const nudge=(p,x,z)=>{const L=Math.hypot(x,z);if(L>cap){x*=cap/L;z*=cap/L;}p.x+=x;p.z+=z;};
    for(let a=0;a<agentsNow.length;a++)for(let b=a+1;b<agentsNow.length;b++){
      const A=agentsNow[a],B=agentsNow[b],ma=A.who!==ref&&movable(A.who)?1:0,mb=B.who!==ref&&movable(B.who)?1:0;if(!ma&&!mb)continue;
      const dx=B.who.x-A.who.x,dz=B.who.z-A.who.z;if(A.who===ref||B.who===ref){
        const P=A.who===ref?B.who:A.who,rx=P.x-ref.wx,rz=P.z-ref.wz,d=Math.hypot(rx,rz)||1e-6,min=A.r+B.r;
        if(d<min&&movable(P))nudge(P,rx/d*(min-d),rz/d*(min-d));continue;}
      const d=Math.hypot(dx,dz)||1e-6,min=A.r+B.r;
      if(d<min){const k=(min-d)/(ma+mb);if(ma)nudge(A.who,-dx/d*k,-dz/d*k);if(mb)nudge(B.who,dx/d*k,dz/d*k);}
    }
    for(const p of PL){if(p.fade<.5||p.act!=='walk'||!p.path)continue;
      const e=p.path[p.path.length-1];if(Math.hypot(e[0]-p.x,e[1]-p.z)<.45)continue;     // (goals by the table or a chair are allowed)
      const c=clearAt(p.i,p.x,p.z);if(c>=BODY_R)continue;
      const gx=clearAt(p.i,p.x+.04,p.z)-clearAt(p.i,p.x-.04,p.z),gz=clearAt(p.i,p.x,p.z+.04)-clearAt(p.i,p.x,p.z-.04),gl=Math.hypot(gx,gz)||1;
      nudge(p,gx/gl*(BODY_R-c),gz/gl*(BODY_R-c));}
  }
  // Turn toward a heading at a steady rate (always the short way round), easing
  // in at the end; the feet step on the spot while turning (see the weights below).
  function turnTo(pl,yaw,dt,rate=3.2){
    pl.yaw=wrapAngle(pl.yaw);
    const d=wrapAngle(yaw-pl.yaw),w=Math.min(rate,Math.max(1,Math.abs(d)*6)),s=Math.sign(d)*Math.min(Math.abs(d),w*dt);
    pl.yaw+=s;if(Math.abs(s)>.5*dt)pl.turning=true;return Math.abs(d)<.05;
  }
  function walkStep(pl,dt){
    while(pl.pi<pl.path.length-1&&Math.hypot(pl.path[pl.pi][0]-pl.x,pl.path[pl.pi][1]-pl.z)<.32)pl.pi++;
    const left=pathLeft(pl),ah=pathAhead(pl,.45);
    let hx=ah[0]-pl.x,hz=ah[1]-pl.z;const hl=Math.hypot(hx,hz);
    if(hl>.03){const s=steer(pl,hx/hl,hz/hl);pl.head=Math.atan2(s[0],s[1]);pl.slow=s[2];}else pl.slow=1;
    pl.blockT=pl.slow<.45?pl.blockT+dt:Math.max(0,pl.blockT-dt*2);
    if(pl.blockT>1.2&&time>(pl.replanAt||0)){pl.replanAt=time+1.5;      // held up: another way round whoever stands in it
      const ex=agentsNow.filter(o=>o.who!==pl&&Math.hypot(o.vx,o.vz)<.25&&Math.hypot(o.x-pl.x,o.z-pl.z)<2.2).map(o=>({x:o.x,z:o.z,c:o.r+.04}));
      if(ex.length){const e=pl.path[pl.path.length-1];pl.path=planPath(pl.x,pl.z,e[0],e[1],pl.i,ex);pl.pi=0;pl.blockT=.6;}}
    const off=Math.abs(wrapAngle(pl.head-pl.yaw));turnTo(pl,pl.head,dt,off>1?3:4.4);
    // set off once roughly facing the way, ease up to walking pace, ease down to stop on the spot
    const vmax=off>1.15?0:Math.min(WALK_V,Math.sqrt(2.4*left))*clamp(1.6-off,.35,1)*pl.slow;
    pl.v=pl.v<vmax?Math.min(vmax,pl.v+1.5*dt):Math.max(vmax,pl.v-2.5*dt);
    const e=pl.path[pl.path.length-1],de=Math.hypot(e[0]-pl.x,e[1]-pl.z),s=pl.v*dt;
    if(de<.3&&pl.pi>=pl.path.length-1){if(de<=s){pl.x=e[0];pl.z=e[1];pl.pi=pl.path.length;}else{pl.x+=(e[0]-pl.x)/de*s;pl.z+=(e[1]-pl.z)/de*s;}}
    else{pl.x+=Math.sin(pl.yaw)*s;pl.z+=Math.cos(pl.yaw)*s;}     // he walks the way he faces
    return pl.pi>=pl.path.length||de<.02;
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
  function startWalk(pl,g){pl.path=planPath(pl.x,pl.z,g.x,g.z,pl.i);pl.pi=0;pl.pathEnd=[g.x,g.z];pl.head=pl.yaw;pl.stopping=false;pl.blockT=0;setAct(pl,'walk');}
  function watchTurn(pl,dt,yaw){
    const fp=focusPoint(),want=yaw!=null?yaw:Math.atan2(fp[0]-pl.x,fp[1]-pl.z);
    if(pl.watchTurn||Math.abs(wrapAngle(want-pl.yaw))>(yaw!=null?.05:.95))pl.watchTurn=!turnTo(pl,want,dt,2.4);
  }
  function follow(pl,g,dt){const k=1-Math.exp(-dt*5);pl.x+=(g.x-pl.x)*k;pl.z+=(g.z-pl.z)*k;pl.yaw=wrapAngle(pl.yaw+wrapAngle(g.yaw-pl.yaw)*k);}
  // Before getting down: the extension screwed on if the shot needs it, and the
  // rest in his hand (the referee brings it).
  function kitReady(pl,st){
    const K=pl.kit;
    if(st.ext&&K.ext<1){if(K.screw<=0)K.screw=1;return false;}
    if(!st.rest)return true;
    if(K.rest==='hand')return true;
    if(K.rest==='none')askForRest(pl);
    return false;
  }
  function stepPlayer(pl,dt,st){
    pl.t+=dt;pl.turning=false;const g=pl.goal,c=CHAIRS[pl.i];
    switch(pl.act){
      case 'sit':
        if(g.kind!=='chair'&&g.kind!=='hold'){pl.x=c[0];setAct(pl,'rise');}
        break;
      case 'rise':{   // lean forward, push up off the arm of the chair, step forward
        const u=clamp(pl.t/RISE_T,0,1);
        pl.z=c[1]+CHAIR_FRONT*ease((u-.32)/.6);pl.sitLin=1-ease((u-.2)/.6);pl.yaw=0;
        if(pl.t>=RISE_T)setAct(pl,'idle');
        break;}
      case 'sitdown':{   // a step back to the chair, a hand back on its arm, lower down
        const u=clamp(pl.t/SIT_T,0,1);
        pl.x+=(c[0]-pl.x)*Math.min(1,dt*8);pl.z=c[1]+CHAIR_FRONT*(1-ease(u/.45));pl.sitLin=ease((u-.22)/.62);turnTo(pl,0,dt);
        if(pl.t>=SIT_T)setAct(pl,'sit');
        break;}
      case 'idle':
        if(g.kind==='hold'){watchTurn(pl,dt,null);break;}
        if(Math.hypot(g.x-pl.x,g.z-pl.z)>.06){startWalk(pl,g);break;}
        if(g.kind==='watch'){watchTurn(pl,dt,g.yaw);break;}
        if(turnTo(pl,g.yaw,dt)){if(g.kind==='chair')setAct(pl,'sitdown');
          else if(g.kind==='shot'&&(!st||!pl.ok||pl.ownCue||kitReady(pl,st))){pl.feet=null;setAct(pl,'getdown');}}
        break;
      case 'walk':
        if(g.kind==='hold'){if(!pl.stopping){const sd=pl.v*pl.v/5;pl.path=[[pl.x+Math.sin(pl.yaw)*sd,pl.z+Math.cos(pl.yaw)*sd]];pl.pi=0;pl.stopping=true;}}
        else if(!g.fixed&&Math.hypot(g.x-pl.pathEnd[0],g.z-pl.pathEnd[1])>.2){const v=pl.v,h=pl.head;startWalk(pl,g);pl.v=v;pl.head=h;}
        else if(g.fixed&&Math.hypot(g.x-pl.pathEnd[0],g.z-pl.pathEnd[1])>.05){const v=pl.v,h=pl.head;startWalk(pl,g);pl.v=v;pl.head=h;}
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
    // now and then he chalks his cue before he gets down
    if(r&&!r.chalked&&pl.ok&&pl.act==='idle'&&!pl.cueAct&&pl.goal.kind==='shot'){r.chalked=true;if(Math.random()<.55){cueAct(pl,'chalk',rand(2.2,3));pl.holdUntil=time+2.2;}}
    return{kind:'shot'};
  }
  // Live plan: each player's goal for the current state of play.
  let pullNow=0;
  function livePlan(pl,dt){
    if(state.mode==='practice'&&pl.i===1){pl.fadeTo=0;pl.goal={kind:'hold'};return;}   // practice: one player
    pl.fadeTo=1;
    const K=pl.kit;
    if(K.rest==='return'){pl.goal={kind:'hold'};return;}
    if(pl.holdUntil>time&&!state.inShot&&pl.act!=='sit'){pl.goal={kind:'hold'};return;}
    const cb=cueBall(),active=state.started&&!state.finished&&(state.mode==='practice'?pl.i===0:state.current===pl.i);
    if(!active||!cb){pl.goal=chairGoal(pl.i);pl.wait=0;if(K.ext>0&&K.screw===0)K.screw=-1;if(K.rest==='asked')dropRestRequest(pl);
      if(K.rest==='hand'&&pl.act!=='sit'&&pl.act!=='sitdown'){giveBackRest(pl);pl.goal={kind:'hold'};}   // the rest goes back first
      return;}
    const human=state.mode==='versus'||pl.i===0,shot=state.inShot&&state.shot;
    if(human&&!shot){
      // you aim; small changes are followed at once, but while you swing the aim round he waits for it to settle
      const a=state.aim;if(pl.aimSet==null)pl.aimSet=a;
      const dv=Math.abs(wrapAngle(a-(pl.aimPrev??a)))/Math.max(dt,1e-3);pl.aimPrev=a;pl.aimV+=(dv-pl.aimV)*(1-Math.exp(-dt*5));
      const big=Math.abs(wrapAngle(a-pl.aimSet));
      if(big<.25||pl.aimV<.35)pl.aimSet=a;
      pl.aimSweep=big>=.25&&pl.aimV>=.35;pl.aim=pl.aimSet;
    }else{pl.aimSweep=false;pl.aim=shot?state.shot.angle:human?state.aim:(ai.plan?botAimNow():pl.aim);pl.aimSet=null;}
    pl.cue=shot?state.shot.cueOrigin:[cb.x,cb.z];pl.pull=pullNow;
    let g;
    if(state.inShot)g=time<pl.downUntil?{kind:'shot'}:{kind:'hold'};
    else if(state.decision)g={kind:'hold'};
    else if(state.ballInHand&&human)g={kind:'watch',x:-(OUT_X+.42),z:clamp(cb.z,-.5,.5),yaw:PI/2};
    else if(human)g=pl.aimSweep?{kind:'hold'}:{kind:'shot'};
    else if(ai.plan&&!ai.planning)g=botGoal(pl,dt);
    else g={kind:'hold'};
    // the player coming to the table lets the other one get back to his chair first
    const o=PL[1-pl.i];
    if(g.kind!=='hold'&&pl.act==='sit'&&o&&o.fade>.5&&o.goal.kind==='chair'&&o.act!=='sit'&&o.act!=='sitdown'&&
      Math.hypot(o.x-CHAIRS[o.i][0],o.z-CHAIRS[o.i][1]-CHAIR_FRONT)>1.6&&pl.wait<3.5){pl.wait+=dt;g={kind:'hold'};}
    // the rest goes back to the referee once he has finished with it (he waits for him, holding it);
    // an extension he no longer needs comes off
    if(g.kind==='shot'&&cb&&(K.rest==='hand'||K.ext>0)&&!state.inShot&&pl.act!=='down'&&pl.act!=='getdown'){const s0=stanceFor(pl,pl.aim,pl.cue[0],pl.cue[1],0);
      if(K.rest==='hand'&&!s0.rest){giveBackRest(pl);g={kind:'hold'};}
      if(K.ext>=1&&!s0.ext&&K.screw===0&&!s0.rest)K.screw=-1;}
    if(K.rest==='asked'&&g.kind!=='shot'&&g.kind!=='hold')dropRestRequest(pl);
    // the rest is asked for as soon as the shot clearly needs it, so the referee is on his way while the
    // player walks over (and the request is dropped if the shot changes for a while)
    if(g.kind==='shot'&&cb&&pl.ok&&!state.inShot&&(K.rest==='none'||K.rest==='asked')){const s1=stanceFor(pl,pl.aim,pl.cue[0],pl.cue[1],0),need=s1.rest;
      pl.restNo=need?0:(pl.restNo||0)+dt;
      const near=Math.hypot((s1.feet[0].x+s1.feet[1].x)/2-pl.x,(s1.feet[0].z+s1.feet[1].z)/2-pl.z)<1.6;
      if(need&&K.rest==='none'&&(!human||near||pl.act==='idle'))askForRest(pl);
      else if(!need&&K.rest==='asked'&&pl.restNo>1.5)dropRestRequest(pl);}
    // stepping aside for someone walking past
    if(pl.yieldGoal){const y=pl.yieldGoal,w=y.from;
      if(time>y.until||(w&&Math.hypot(w.x-pl.x,w.z-pl.z)>1.3&&time>y.until-2.4)||g.kind==='shot'&&pl.act!=='idle')pl.yieldGoal=null;
      else if(g.kind!=='shot'||pl.act==='idle')g=y;}
    pl.goal=g;
  }
  const CUE_LEN=1.45;
  function updatePlayers(dt){
    if(!PL.length)return;
    gatherAgents(dt);
    if(!cine.on)for(const pl of PL)livePlan(pl,dt);
    const stances=PL.map(pl=>{
      let st=null;
      if(pl.goal.kind==='shot'||pl.stLin>0||pl.act==='idle'&&pl.goal.kind==='shot'){st=stanceFor(pl,pl.aim,pl.cue[0],pl.cue[1],pl.pull);
        if(pl.goal.kind==='shot'){const g=pl.goal;g.x=(st.feet[0].x+st.feet[1].x)/2;g.z=(st.feet[0].z+st.feet[1].z)/2;g.yaw=Math.atan2(st.F.x,st.F.z);}}
      pl.restNeeded=!!(st&&st.rest);pl.st=st;
      stepPlayer(pl,dt,st);return st;});
    separate(dt);
    kitTick(dt);
    PL.forEach((pl,n)=>{
      const st=stances[n],K=pl.kit;
      if(K.screw){K.ext=clamp(K.ext+K.screw*dt/1.9,0,1);if(K.ext<=0||K.ext>=1)K.screw=0;}
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
      if(pl.act!=='walk'&&pl.stance<.999){
        // he follows the play, but now and then looks somewhere else: the crowd, the scoreboard, the other player
        if(time>pl.lookUntil+rand(0,2)&&Math.random()<dt*.12){const a=pl.yaw+rand(-1.4,1.4),d=rand(2,6);pl.lookAt=[pl.x+Math.sin(a)*d,pl.z+Math.cos(a)*d];pl.lookUntil=time+rand(1.2,2.8);}
        const fp=time<pl.lookUntil&&pl.lookAt?pl.lookAt:focusPoint();
        turnHead(pl.p,pl.yaw,fp[0],fp[1],(pl.act==='sit'?.45:.7)*(1-pl.stance));}
      if(pl.ok&&!pl.ownCue&&(pl.act==='rise'||pl.act==='sitdown'))supportPose(pl);
      updateHabits(pl,dt);if(pl.react)applyReaction(pl,dt);
      if(pl.reach&&pl.ok){const R2=pl.rig;R2.lua.getWorldPosition(_v2);reachArm(R2.lua,R2.lfa,R2.lh,pl.reach.pt,pl.reach.w,_v3.copy(_v2).add(_v4.set(Math.cos(pl.yaw)*.35,-.4,-Math.sin(pl.yaw)*.35)));pl.reach=null;}
      setPlayerOpacity(pl,pl.fade*(pl.block||1));
    });
  }
  // Getting up and sitting down the way people do: lean forward over the feet,
  // the left hand pushing on the arm of the chair (the cue, its butt on the
  // floor, steadies him on the right), then up; the reverse to sit.
  const _sa=new T.Vector3(),_sb=new T.Vector3(),_sl=new T.Vector3(),_sf=new T.Vector3();
  function supportPose(pl){
    const r=pl.rig,u=pl.act==='rise'?clamp(pl.t/RISE_T,0,1):1-clamp(pl.t/SIT_T,0,1),c=CHAIRS[pl.i];   // 0 sitting .. 1 standing
    const lean=Math.sin(clamp(u/.85,0,1)*PI)*.6;
    _sl.set(Math.cos(pl.yaw),0,-Math.sin(pl.yaw));_sf.set(Math.sin(pl.yaw),0,Math.cos(pl.yaw));   // his left, forward
    rotWorld(r.spine,_sl,lean*.42);rotWorld(r.spine1,_sl,lean*.3);rotWorld(r.spine2,_sl,lean*.16);
    rotWorld(r.neck,_sl,-lean*.38);rotWorld(r.head,_sl,-lean*.3);                                  // his eyes stay up
    const w=sstep(0,.16,u)*(1-sstep(.5,.78,u));if(w<.01)return;
    _sb.set(c[0]+.28,FLOOR_Y+.755,CHAIR_Z+.13);                                                   // the front of the chair's left arm
    r.lua.getWorldPosition(_sa);_sa.addScaledVector(_sl,.35).addScaledVector(_sf,-.25);_sa.y-=.3;
    reachArm(r.lua,r.lfa,r.lh,_sb,w,_sa);
    r.lh.getWorldPosition(_sa);aimBone(r.lh,r.lf,_sb.copy(_sa).addScaledVector(_sf,.1).setY(_sa.y-.03));   // palm down on it
    curl(r.lfing,leftPalm(pl,_N),[.35*w,.45*w,.25*w]);
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
    acknowledge:{dur:2.8,w:1,arm:'raise',f:(k,u)=>({hp:-.12*k,hy:.14*k*Math.sin(Math.min(u/2.2,1)*PI)})},
    // to the crowd: a small bow, a wave round the room
    bow:{dur:2.0,w:1,f:(k,u)=>{const b=Math.sin(clamp(u/1.7,0,1)*PI);return{sp:.3*k*b,np:.12*k*b,hp:.1*k*b};}},
    wave:{dur:3.0,w:1,arm:'raise',f:(k,u)=>({hp:-.1*k,hy:.3*k*Math.sin(u*1.9)})}};
  // How a player takes his good and bad moments: '' (the usual mix) or
  // 'composed' (opponents.js react): calm on easy pots, a nod for a hard
  // one, brief disappointment at a miss, a fist pump for a frame.
  const reactProfile=i=>state.mode==='bot'&&i===1&&botOpponent&&botOpponent.react||'';
  function startReaction(i,pool,delay=.35,amp=1,next=null,force=false){
    const pl=PL[i];if(!pl||!pl.ok||pl.fade<.5||(cine.on&&!force))return;
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
  // Something done with the cue while he waits or greets the crowd: chalking
  // the tip, leaning on the cue, raising it to the room.
  function cueAct(pl,kind,dur){pl.cueAct={kind,t0:time,dur};}
  // Habits while he waits: a hand to his chin, a wipe of the brow, a tug at
  // the bow tie, a hand on the hip, another way of standing, a roll of the
  // neck, chalking his cue, leaning on it.
  const HAB_STAND=['chin','brow','collar','hip','alt','alt','chalk','chalk','lean','lean'],HAB_SIT=['chin','brow','collar','sitroll','chin'];
  function updateHabits(pl,dt){
    if(!pl.ok||pl.ownCue)return;
    if(pl.cueAct&&time>pl.cueAct.t0+pl.cueAct.dur)pl.cueAct=null;
    const standing=(pl.act==='idle'||pl.act==='watch')&&pl.stance<.05&&!pl.turning,seated2=pl.act==='sit'&&pl.sitLin>.98;
    if(pl.cueAct&&pl.cueAct.kind==='lean'&&!standing)pl.cueAct.dur=Math.min(pl.cueAct.dur,time-pl.cueAct.t0+.45);   // he lets go of it as he moves off
    if(pl.layer){const L=pl.layer,on=time>=L.from&&time<L.until&&(L.seat?seated2:standing);
      L.amt+=((on?1:0)-L.amt)*(1-Math.exp(-dt*(on?2.6:3.2)));
      if(!on&&time>=L.from&&L.amt<.02){L.act.setEffectiveWeight(0);L.act.stop();pl.layer=null;}}
    if(pl.react||pl.layer||pl.cueAct||pl.kit.screw||!(standing||seated2)||cine.on||pl.fade<.5)return;
    if(pl.habAt===undefined)pl.habAt=time+rand(4,10);
    if(time<pl.habAt)return;
    pl.habAt=time+rand(seated2?7:4.5,seated2?18:11);
    const pool=(seated2?HAB_SIT:HAB_STAND).filter(k=>k!==pl.lastHab),k=pool[Math.floor(Math.random()*pool.length)];pl.lastHab=k;
    const M=(window.VelvetPeople&&VelvetPeople.motions)||{};
    if(k==='chalk'){cueAct(pl,'chalk',rand(2.2,3.2));return;}
    if(k==='lean'){if(pl.goal.kind!=='shot')cueAct(pl,'lean',rand(4,8));return;}
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
  // To the crowd, at the walk-on or after a replay: never the same way twice in a row.
  function greetCrowd(i,pool=['acknowledge','wave','salute','fistpump','bow','nod']){
    const pl=PL[i];if(!pl||!pl.ok)return 1;
    const opts=pool.filter(k=>k!==pl.lastGreet),k=opts[Math.floor(Math.random()*opts.length)];pl.lastGreet=k;
    if(k==='salute'){cueAct(pl,'salute',2.4);if(typeof faceExpr==='function')faceExpr(pl.p,'satisfied',2.2,.2);return 2.6;}
    startReaction(i,[k],.1,1,null,true);return(REACTS[k].dur||2)+.4;
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
  function playerReactToShot(s){
    if(!s)return;
    const by=s.by??state.current,calm=reactProfile(by)==='composed';
    if(s.foul){if(calm)startReaction(by,['sigh','regret','c_shrug'],.5,.7);else startReaction(by,['anger','regret','sigh','facepalm','c_headshake','hiphand'],.5);return;}
    const scored=state.current===by&&state.break>(s.breakBefore||0);
    if(scored){
      if(calm){if(state.break>=100&&(s.breakBefore||0)<100)startReaction(by,['acknowledge'],.6);   // a century: a hand to the crowd
        else if((s.difficulty||0)>1.7&&Math.random()<.6)startReaction(by,['nod','c_nodyes'],.2,.8);return;}
      if(state.break>=100&&(s.breakBefore||0)<100){startReaction(by,['acknowledge','wave'],.6);return;}
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
      act:'down',t:0,stLin:1,stance:1,sitLin:0,v:0,path:null,feet:null,feetNow:null,aim:state.aim,cue:[cb.x,cb.z],goal:{kind:'shot'},cueAct:null});
    pl.w.sit=0;pl.w.walk=0;
    // what he needs, in his hands at once
    if(st.ext){pl.kit.ext=1;pl.kit.screw=0;}
    if(st.rest&&pl.kit.rest!=='hand'){dropRestRequest(pl);pl.kit.rest='hand';KIT.at='player';KIT.holder=pl.i;}
  }
  // The bot strikes only once its player is down on the shot.
  const playerReady=i=>{const pl=PL[i];return!pl||(!pl.ok&&!pl.ownCue)||pl.fade<.5||pl.act==='down';};
  const playersSnapshot=()=>PL.map(pl=>({...pl,goal:{...pl.goal},w:{...pl.w},path:pl.path&&pl.path.slice(),feet:null,feetNow:null}));
  const playersRestore=s=>{if(s)s.forEach((o,i)=>Object.assign(PL[i],o));};

  // ---- THE REST CHANGES HANDS ----
  // The referee fetches the rest from its hooks, walks it to the player who
  // asked, and both reach for it (arms by inverse kinematics) while it passes
  // from hand to hand; afterwards he takes it back and hangs it up again.
  const kitTask=t=>t&&(t.give!=null||t.collect!=null||t.fetchRest||t.stow);
  const hookTask=()=>({s:loopNearest(-(OUT_X+.3),0),x:-(OUT_X),z:0});
  function askForRest(pl){
    kitMeshes();pl.kit.rest='asked';
    const has=KIT.at==='ref',q=ref.queue.filter(t=>!(t.give===pl.i)&&!t.fetchRest&&!t.stow);   // (it goes to him, not back to its hooks)
    ref.queue=[...(has?[]:[{...hookTask(),fetchRest:true}]),{s:refSpotNear(pl.x,pl.z),x:pl.x,z:pl.z,give:pl.i},...q];
    if(ref.task&&!ref.task.started&&!kitTask(ref.task)){ref.queue.push(ref.task);ref.task=null;}
    if(ref.task&&ref.task.stow&&!ref.task.passed)ref.task=null;      // still in his hand: it goes to the player instead
    ref.waitUntil=0;
  }
  function dropRestRequest(pl){ref.queue=ref.queue.filter(t=>t.give!==pl.i);if(ref.task&&ref.task.give===pl.i)ref.task=null;if(pl.kit.rest==='asked')pl.kit.rest='none';}
  function giveBackRest(pl){
    pl.kit.rest='return';
    ref.queue=[{s:refSpotNear(pl.x,pl.z),x:pl.x,z:pl.z,collect:pl.i},{...hookTask(),stow:true},...ref.queue.filter(t=>t.collect!==pl.i&&!t.stow)];
    if(ref.task&&!ref.task.started&&!kitTask(ref.task)){ref.queue.push(ref.task);ref.task=null;}
    ref.waitUntil=0;
  }
  // A place on the referee's way round the table an arm's length from (x,z), on the side he comes from.
  function refSpotNear(x,z){
    let best=null,bd=1e9;const P=loop.pts;
    for(let i=0;i<P.length;i+=3){const d=Math.hypot(P[i][0]-x,P[i][1]-z);if(d<.7||d>1.15)continue;
      let ds=loop.cum[i]-ref.s;ds-=Math.round(ds/loop.len)*loop.len;if(Math.abs(ds)<bd){bd=Math.abs(ds);best=loop.cum[i];}}
    return best??loopNearest(x,z);
  }
  function refRig(){
    const p=ref.person;if(!p)return null;if(p.rig!==undefined)return p.rig;const g=n=>p.obj.getObjectByName('Bip01_'+n);
    const r={rua:g('R_UpperArm'),rfa:g('R_Forearm'),rh:g('R_Hand'),rf:g('R_Finger2'),f1:g('R_Finger1'),f4:g('R_Finger4')};
    return p.rig=Object.values(r).every(Boolean)?r:null;
  }
  const _ka=new T.Vector3(),_kb=new T.Vector3(),_kc=new T.Vector3(),_kd=new T.Vector3();
  function kitTick(dt){
    if(!KIT.rest)return;
    const t=ref.task,rr=refRig();
    // nothing gets lost: a request that fell out of the referee's list is made again
    for(const pl of PL){const K=pl.kit,inQ=x=>ref.queue.some(x)||(ref.task&&x(ref.task));
      if(K.rest==='asked'&&!inQ(q=>q.give===pl.i))askForRest(pl);
      if(K.rest==='return'&&!inQ(q=>q.collect===pl.i))giveBackRest(pl);}
    if(KIT.at==='ref'&&!ref.queue.some(q=>q.stow||q.give!=null)&&!(t&&(t.stow||t.give!=null)))ref.queue.push({...hookTask(),stow:true});
    if(!t||!rr)return;
    // a trip to the hooks only if there is something to take or hang up there
    if((t.stow&&KIT.at!=='ref')||(t.fetchRest&&KIT.at!=='hooks')){ref.task=null;return;}
    if(t.give!=null&&KIT.at==='hooks'&&PL[t.give]){ref.task=null;askForRest(PL[t.give]);return;}   // he has to fetch it first
    if(t.give!=null||t.collect!=null){
      const pl=PL[t.give??t.collect];if(!pl)return;
      t.x=pl.x;t.z=pl.z;                                  // he faces the player
      if(!t.started)return;
      if(!pl.ok){if(!t.passed){t.passed=1;if(t.give!=null){KIT.at='player';KIT.holder=pl.i;pl.kit.rest='hand';}else{KIT.at='ref';KIT.holder=null;pl.kit.rest='none';}}return;}
      const u=clamp(1-(t.until-time)/1.4,0,1),w=Math.sin(clamp(u/.92,0,1)*PI);    // out, the hand-over, back
      pl.rig.lua.getWorldPosition(_ka);rr.rua.getWorldPosition(_kb);_kc.copy(_ka).lerp(_kb,.5);_kc.y=Math.min(_ka.y,_kb.y)-.26;
      const ry=ref.yaw;_kd.copy(_kb).add(_v4.set(-Math.cos(ry)*.35,-.42,Math.sin(ry)*.35));
      reachArm(rr.rua,rr.rfa,rr.rh,_kc,w,_kd);
      pl.reach={pt:_kc.clone(),w};
      if(u>.5&&!t.passed){t.passed=1;if(t.give!=null){KIT.at='player';KIT.holder=pl.i;pl.kit.rest='hand';}else{KIT.at='ref';KIT.holder=null;pl.kit.rest='none';}}
    }
    else if((t.fetchRest||t.stow)&&t.started&&!t.passed&&time>t.until-1.05){t.passed=1;if(t.fetchRest)KIT.at='ref';else{KIT.at='hooks';KIT.holder=null;}}
  }
  // The referee keeps out of the players' way: he stands off from anyone close
  // to him (outward, never into the table) and waits while a player crosses in
  // front of him. Returns his offset from his path round the table.
  const _ro=[0,0];
  function refAvoid(at,dt){
    let ox=0,oz=0,slow=1;const sv=Math.sign(ref.v),tx=at.dx*sv,tz=at.dz*sv;
    const ex=at.x/(OUT_X*OUT_X),ez=at.z/(OUT_Z*OUT_Z),el=Math.hypot(ex,ez)||1,nx=ex/el,nz=ez/el;     // outward from the table
    const cur=ref.off||(ref.off=[0,0]),t=ref.task;
    for(const pl of PL){if(pl.fade<.5||pl.act==='sit')continue;
      if(t&&(t.give===pl.i||t.collect===pl.i))continue;                                   // (the one he is handing the rest to)
      const rx=at.x-pl.x,rz=at.z-pl.z,d=Math.hypot(rx,rz)||1e-3,min=BODY_R+(pl.act==='down'||pl.act==='getdown'?.34:BODY_R)+.14;
      if(d<min+.3){const k=(min+.3-d);ox+=rx/d*k;oz+=rz/d*k;}
      if(sv){const ax=pl.x-at.x,az=pl.z-at.z,along=ax*tx+az*tz,lat=Math.abs(ax*tz-az*tx);if(along>0&&along<1.3&&lat<.6&&pl.act==='walk')slow=Math.min(slow,clamp((along-.55)/.7,0,1));}}
    if(ref.yieldFrom&&time-ref.yieldFrom<1.5){ox+=nx*.5;oz+=nz*.5;}                          // a player wants by: he steps back
    const inn=ox*nx+oz*nz;if(inn<0){ox-=inn*nx;oz-=inn*nz;}                               // never toward the table
    const L=Math.hypot(ox,oz);if(L>.9){ox*=.9/L;oz*=.9/L;}
    const k=1-Math.exp(-dt*4);cur[0]+=(ox-cur[0])*k;cur[1]+=(oz-cur[1])*k;
    ref.slow=slow;_ro[0]=cur[0];_ro[1]=cur[1];return _ro;
  }

  // ---- each player's own cue ----
  // Carried in the right hand, tip forward and up beside him (nearly upright,
  // butt on the floor, when he sits): the hand turns to hold it, so cue and
  // hand move as one, the same frame. As he gets down on the shot it is
  // brought down onto the line, and it is then the cue you see striking.
  // Without a player model (or in the player view, where your own body is
  // hidden) the usual aiming cue is drawn instead.
  const _ca=new T.Vector3(),_cb=new T.Vector3(),_cc=new T.Vector3(),_cd=new T.Vector3(),_cq=new T.Quaternion(),_ctp=new T.Vector3(),_cx=new T.Vector3();
  function rightPalm(pl,out){   // palm normal of the right hand
    const r=pl.rig;r.rh.getWorldPosition(_ca);r.rf.getWorldPosition(_cb);_cc.copy(_cb).sub(_ca).normalize();
    r.rfing[0][0].getWorldPosition(_cd);r.rfing[3][0].getWorldPosition(out);_cd.sub(out);
    return out.crossVectors(_cd,_cc).normalize();
  }
  const _g1=new T.Vector3(),_g2=new T.Vector3(),_g3=new T.Vector3(),_hf=new T.Vector3(),_hl=new T.Vector3(),_hr=new T.Vector3();
  // Turn the cue hand so its fist runs along 'dir' (by at most 'max' radians); returns the fist's own line.
  function holdAlong(pl,dir,max=1.45){
    const r=pl.rig;r.rfing[0][0].getWorldPosition(_g1);r.rfing[3][0].getWorldPosition(_g2);_cc.copy(_g1).sub(_g2);
    if(_cc.lengthSq()<1e-10)return _cc.copy(dir);_cc.normalize();
    const ang=_cc.angleTo(dir);if(ang>1e-3){_cx.crossVectors(_cc,dir);if(_cx.lengthSq()>1e-10){_cx.normalize();rotWorld(r.rh,_cx,Math.min(ang,max));}}
    r.rfing[0][0].getWorldPosition(_g1);r.rfing[3][0].getWorldPosition(_g2);return _cc.copy(_g1).sub(_g2).normalize();
  }
  // The cue's tip from the grip along its line, and its frame (+Y from the tip to the butt).
  function cueFrom(grip,dir,tipDist,pos,quat){pos.copy(grip).addScaledVector(dir,tipDist);quat.setFromUnitVectors(UPV,_ca.copy(dir).negate());}
  const _ab=new T.Vector3(),_ac=new T.Vector3();
  function placePlayerCues(){
    if(!PL.length)return;
    const sh=cine.on?cine.shooter:(state.started&&!state.finished?state.current:-1);
    if(KIT.chalk)KIT.chalk.visible=false;
    for(const pl of PL){
      const m=pl.cueMesh;if(!m)continue;
      const shown=pl.p.obj.visible&&pl.fade>=.5;
      if(shown)poseCue(pl,m,pl.i===sh);else m.visible=false;
      if(pl.i===sh&&shown)cueGroup.visible=false;   // his own cue is the one at the ball
      placeExt(pl,m,shown);
    }
    placeRest();
  }
  function poseCue(pl,m,striker){
    const r=pl.rig,fx=Math.sin(pl.yaw),fz=Math.cos(pl.yaw),sit=pl.w.sit;
    _hf.set(fx,0,fz);_hl.set(fz,0,-fx);_hr.copy(_hl).negate();                 // forward, left, right
    const k=striker?pl.stance:0;
    // what he is doing with it: chalking, leaning on it, raising it, screwing on the extension, or just carrying it
    const A=pl.cueAct,K=pl.kit,screw=K.screw!==0||(K.ext>0&&K.ext<1);
    const ta=A?time-A.t0:0,amt=A?sstep(0,.4,ta)*(1-sstep(A.dur-.45,A.dur,ta))*(1-k):0;
    const el=lerp(1.08,1.42,sit)+.035*Math.sin(time*.9+pl.i*1.7);
    const carry=_cx.copy(_hf).multiplyScalar(Math.cos(el)).addScaledVector(_hr,.2).add(_v4.set(0,Math.sin(el),0)).normalize();
    let dir=_cd,tipDist=lerp(1.1,.86,sit),kind=amt>.001?A.kind:screw&&k<.5?'screw':'carry';
    const sx=K.screw>0?K.ext:1-K.ext,sAmt=kind==='screw'?Math.min(sstep(0,.18,sx),1-sstep(.85,1,sx)):0,blend=kind==='screw'?sAmt:amt;
    if(kind==='carry')dir.copy(carry);
    else if(kind==='chalk'){   // the hand up by his chest, the tip up by his face
      r.rua.getWorldPosition(_ab);_ac.copy(_ab).addScaledVector(_hf,.3).addScaledVector(_hl,.06);_ac.y-=.42;
      _ab.addScaledVector(_hr,.35).addScaledVector(_hf,-.1);_ab.y-=.45;reachArm(r.rua,r.rfa,r.rh,_ac,amt,_ab);
      dir.copy(_hf).multiplyScalar(Math.cos(1.22)).addScaledVector(_hl,.1).add(_v4.set(0,Math.sin(1.22),0)).normalize();tipDist=lerp(1.1,.44,amt);}
    else if(kind==='salute'){   // raised to the room
      r.rua.getWorldPosition(_ab);_ac.copy(_ab).addScaledVector(_hf,.16).addScaledVector(_hr,.1);_ac.y+=.32;
      _ab.addScaledVector(_hr,.4);_ab.y-=.2;reachArm(r.rua,r.rfa,r.rh,_ac,amt,_ab);
      dir.set(0,1,0).addScaledVector(_hf,.12).normalize();tipDist=lerp(1.1,.95,amt);}
    else if(kind==='lean'){     // its butt on the floor in front of him, both hands on top
      _ab.set(pl.x,FLOOR_Y+.012,pl.z).addScaledVector(_hf,.36).addScaledVector(_hr,.13);
      r.rua.getWorldPosition(_ac);_ac.addScaledVector(_hf,.28).addScaledVector(_hl,.08);_ac.y=FLOOR_Y+1.0;
      _g3.copy(_ac).sub(_ab).normalize();_ac.copy(_ab).addScaledVector(_g3,FLOOR_Y+1.0-_ab.y);
      r.rua.getWorldPosition(_g1);_g1.addScaledVector(_hr,.3).addScaledVector(_hf,-.15);_g1.y-=.4;reachArm(r.rua,r.rfa,r.rh,_ac,amt,_g1);
      dir.copy(_g3);rotWorld(r.spine1,_hl,.09*amt);}
    else if(kind==='screw'){   // the cue upside down in front of him, the butt up by his chest
      r.pelvis.getWorldPosition(_ac);_ac.addScaledVector(_hf,.3).addScaledVector(_hr,.1);_ac.y+=.1;
      r.rua.getWorldPosition(_ab);_ab.addScaledVector(_hr,.3).addScaledVector(_hf,-.1);_ab.y-=.4;
      reachArm(r.rua,r.rfa,r.rh,_ac,sAmt,_ab);
      dir.copy(_hf).multiplyScalar(.25).addScaledVector(_hr,.12).add(_v4.set(0,-.95,0)).normalize();}
    if(kind!=='carry'){dir.lerp(carry,1-blend);if(dir.lengthSq()<1e-6)dir.copy(carry);dir.normalize();}   // eased in and out of the carry
    // the hand turns to hold it (less and less as he gets down on the shot: there the cue is on the line)
    const line=holdAlong(pl,dir,(kind==='carry'?1.45:1.45+1.15*blend)*(1-k));
    dir.copy(line);
    gripPoint(pl,_g3);
    if(kind==='lean'){_ab.set(pl.x,FLOOR_Y+.012,pl.z).addScaledVector(_hf,.36).addScaledVector(_hr,.13);dir.copy(_g3).sub(_ab).normalize();tipDist=CUE_LEN-_g3.distanceTo(_ab)+.01;}
    cueFrom(_g3,dir,tipDist,_ctp,_cq);
    // the left hand: at the tip with the chalk, on top of the cue when he leans, round the extension when he screws it on
    if(kind==='chalk'){const rub=ta>.5&&ta<A.dur-.6?1:0,ph=time*TAU*3.2;
      _ac.copy(_ctp).addScaledVector(dir,-.012).add(_v4.set(Math.cos(ph)*.006*rub,0,Math.sin(ph)*.006*rub));
      r.lua.getWorldPosition(_ab);_ab.addScaledVector(_hl,.35).addScaledVector(_hf,-.05);_ab.y-=.4;reachArm(r.lua,r.lfa,r.lh,_ac,amt,_ab);
      curl(r.lfing,leftPalm(pl,_N),[.6*amt,.75*amt,.5*amt]);
      const c=kitMeshes().chalk;c.visible=amt>.35;if(c.visible){c.position.copy(_ctp).addScaledVector(dir,-.01);c.quaternion.setFromUnitVectors(UPV,_ab.copy(dir).negate());c.rotateY(ph*.15);}}
    else if(kind==='lean'){_ac.copy(_g3).addScaledVector(dir,.09).addScaledVector(_hl,.012);
      r.lua.getWorldPosition(_ab);_ab.addScaledVector(_hl,.35).addScaledVector(_hf,-.1);_ab.y-=.4;reachArm(r.lua,r.lfa,r.lh,_ac,amt,_ab);curl(r.lfing,leftPalm(pl,_N),[.8*amt,1*amt,.7*amt]);}
    // down on the shot: the cue on the line (tip at the spin spot, drawn back by the stroke)
    if(k>0){const dx=Math.cos(pl.aim),dz=Math.sin(pl.aim),elev=.07,[sl,su]=tipSpot(pl.i),deep=Math.sqrt(Math.max(R*R-sl*sl-su*su,0)),tip=deep+.009+pl.pull;
      _ca.set(pl.cue[0]-dx*tip-dz*sl,BALL_Y+su,pl.cue[1]-dz*tip+dx*sl);_cc.set(-dx*Math.cos(elev),Math.sin(elev),-dz*Math.cos(elev));
      m.position.lerpVectors(_ctp,_ca,k);m.quaternion.slerpQuaternions(_cq,_q1.setFromUnitVectors(UPV,_cc),k);}
    else{m.position.copy(_ctp);m.quaternion.copy(_cq);}
    m.visible=true;m.updateMatrixWorld();
    pl.cuePose=kind;
  }
  // The extension: in his hand from his pocket, screwed on (turning) or off, then part of the cue.
  const _em=new T.Matrix4(),_eq=new T.Quaternion();
  function placeExt(pl,m,shown){
    const K=pl.kit;if(!K.ext&&!K.screw){if(KIT.ext[pl.i])KIT.ext[pl.i].visible=false;return;}
    const e=kitMeshes().ext[pl.i],r=pl.rig;e.visible=shown;if(!shown)return;
    const p=K.ext;
    if(p<.25&&pl.ok){   // on its way from his pocket to the butt
      const u=p/.25;m.localToWorld(_ab.set(0,BUTT_Y+.07,0));r.pelvis.getWorldPosition(_ac);_ac.add(_v4.set(Math.cos(pl.yaw)*.17,.02,-Math.sin(pl.yaw)*.17));
      _ac.lerp(_ab,ease(u));r.lua.getWorldPosition(_g1);_g1.add(_v4.set(Math.cos(pl.yaw)*.3,-.4,-Math.sin(pl.yaw)*.3));reachArm(r.lua,r.lfa,r.lh,_ac,1,_g1);
      r.lh.getWorldPosition(_ac);_g2.set(0,1,0).applyQuaternion(m.quaternion);
      e.position.copy(_ac).addScaledVector(_g2,-.06);e.quaternion.copy(m.quaternion);return;}
    const u=clamp((p-.25)/.75,0,1);
    e.position.set(0,BUTT_Y+(1-u)*.055,0).applyQuaternion(m.quaternion).add(m.position);
    e.quaternion.copy(m.quaternion).multiply(_eq.setFromAxisAngle(UPV,(1-u)*5*TAU));
    if(pl.ok&&(K.screw||u<1)&&pl.cuePose==='screw'){e.localToWorld(_ac.set(0,.1,0));r.lua.getWorldPosition(_g1);_g1.add(_v4.set(Math.cos(pl.yaw)*.3,-.4,-Math.sin(pl.yaw)*.3));
      reachArm(r.lua,r.lfa,r.lh,_ac,1,_g1);curl(r.lfing,leftPalm(pl,_N),[.8,1,.7]);}
  }
  // The rest: on its hooks, in the referee's hand, in the player's, or down on the table under his cue.
  const _rh=new T.Vector3(),_rb=new T.Vector3(),_rd=new T.Vector3();
  function placeRest(){
    if(!KIT.rest)return;const rest=KIT.rest;rest.visible=true;
    if(KIT.at==='hooks'){alongY(rest,KIT.hookA,KIT.hookB,UPV);return;}
    const inHand=(hand,yaw)=>{hand.getWorldPosition(_rh);_rd.set(Math.sin(yaw)*.1,1,Math.cos(yaw)*.1).normalize();_rb.copy(_rh).addScaledVector(_rd,-.5);
      _rh.copy(_rb).addScaledVector(_rd,REST_L);alongY(rest,_rb,_rh,_v4.set(Math.sin(yaw),0,Math.cos(yaw)));};
    if(KIT.at==='ref'){const rr=refRig();if(rr)inHand(rr.rh,ref.yaw);else rest.visible=false;return;}
    const pl=PL[KIT.holder];if(!pl){KIT.at='hooks';return;}
    if(!pl.ok){rest.visible=false;return;}
    const st=pl.st,k=st&&st.rest?pl.stance:0;
    if(k<.02){inHand(pl.rig.lh,pl.yaw);return;}
    // down: the head on the cloth under the cue, the shaft back to his hand at the rail
    _rh.copy(st.restHead);pl.rig.lh.getWorldPosition(_rd);_rd.sub(_rh).normalize();
    _rb.copy(_rh).addScaledVector(_rd,REST_L);
    if(k>=.98){alongY(rest,_rb,_rh,UPV);return;}
    alongY(rest,_rb,_rh,UPV);const pa=rest.position.clone(),qa=rest.quaternion.clone();
    inHand(pl.rig.lh,pl.yaw);rest.position.lerp(pa,k);rest.quaternion.slerp(qa,k);
  }
