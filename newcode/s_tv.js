  // ---- TV CAMERAS: a broadcast director ------------------------------------
  // With TV CAMERAS on, the opponent's turn and every shot are cut like a
  // broadcast: close on the player thinking, down the line behind the cue
  // ball, the wide and the overhead while the balls run, the reaction, the
  // opponent waiting in his chair, the referee, the crowd and the arena. Hard
  // cuts, varied holds, never the same shot twice running. Your own turn is
  // always left in your hands, with your camera as you had it.
  let tvOn=false;try{tvOn=localStorage.getItem('velvet.tv')==='on';}catch(e){}
  const tv={active:false,shot:'',until:0,key:-1,after:0,saved:null,recent:[]};
  const _tv=new T.Vector3();
  function paintTv(){const b=$('tv-director-toggle');if(!b)return;b.textContent='TV CAMERAS · '+(tvOn?'ON':'OFF');b.classList.toggle('active',tvOn);b.setAttribute('aria-pressed',String(tvOn));}
  function toggleTv(){tvOn=!tvOn;try{localStorage.setItem('velvet.tv',tvOn?'on':'off');}catch(e){}paintTv();}
  $('tv-director-toggle')?.addEventListener('click',toggleTv);
  paintTv();
  function boneAt(pl,name,out){const r=pl&&pl.rig;if(!r||!r[name])return null;r[name].getWorldPosition(out);return out;}
  function tvCut(kind,az,el,radius,fov,target,hold){
    Object.assign(cam,{az,el,radius,fov,target:target.slice(),follow:false,zoom:1});
    cam.curAz=az;cam.curEl=el;cam.curRadius=radius;cam.curFov=fov;cam.curTarget=target.slice();cam.curZoom=1;
    tv.shot=kind;tv.until=time+hold;tv.recent.push(kind);if(tv.recent.length>4)tv.recent.shift();
  }
  function tvPick(opts){
    const fresh=opts.filter(o=>o[1]>0&&!tv.recent.slice(-2).includes(o[0])),list=fresh.length?fresh:opts.filter(o=>o[1]>0);
    let sum=0;for(const o of list)sum+=o[1];let r=Math.random()*sum;for(const o of list){r-=o[1];if(r<=0)return o[0];}return list[0][0];
  }
  function tvFrame(kind){
    const cb=cueBall(),cur=PL[state.current],other=PL[1-state.current];
    const aim=state.inShot&&state.shot?state.shot.angle:ai.plan?ai.plan.aim:state.aim;
    switch(kind){
      case 'wide':return tvCut(kind,-PI/2+rand(-.12,.12),.6,4.4,30,[0,-.1,0],rand(4,6));
      case 'reverse':return tvCut(kind,PI/2+rand(-.12,.12),.62,4.4,30,[0,-.1,0],rand(3.5,5));
      case 'overhead':return tvCut(kind,0,1.55,4.7,30,[0,-.1,0],rand(3,5));
      case 'line':{if(!cb)return tvFrame('wide');
        return tvCut(kind,Math.atan2(-Math.cos(aim),-Math.sin(aim)),.2,.95,34,[cb.x+Math.cos(aim)*.35,CLOTH_Y+.02,cb.z+Math.sin(aim)*.35],rand(3,4.5));}
      case 'face':{const h=cur&&cur.fade>.5?boneAt(cur,'head',_tv):null;if(!h)return tvFrame('line');
        return tvCut(kind,cur.yaw+rand(-.45,.45),.05,.62,24,[h.x,h.y-.02,h.z],rand(2.4,3.6));}
      case 'chair':{const h=other&&other.fade>.5?boneAt(other,'head',_tv):null;if(!h)return tvFrame('wide');
        return tvCut(kind,other.yaw+rand(-.4,.4),.04,.8,24,[h.x,h.y-.04,h.z],rand(2.4,3.4));}
      case 'referee':{const p=ref.person&&ref.person.obj;if(!p)return tvFrame('wide');
        return tvCut(kind,ref.yaw+rand(-.6,.6),.12,1.5,28,[p.position.x,FLOOR_Y+1.25,p.position.z],rand(2.4,3.4));}
      case 'crowd':{const sp=seats.length?seats[Math.floor(Math.random()*seats.length)]:null;if(!sp)return tvFrame('wide');
        return tvCut(kind,Math.atan2(-sp.x,-sp.z)+rand(-.25,.25),.06,1.9,30,[sp.x,sp.y+.95,sp.z],rand(2.2,3));}
      case 'trophy':return tvCut(kind,-2.1+rand(-.2,.2),.12,1.1,24,(stage.trophyAt||[3.05,FLOOR_Y+1.35,2.2]),rand(2.4,3.2));
      case 'arena':return tvCut(kind,-PI/2-.35+rand(-.2,.2),.3,8.5,40,[1.2,.4,0],rand(3,4.5));
    }
  }
  function tvDirect(dt){
    const want=tvOn&&state.started&&!state.finished&&!cine.on&&!isAnyOverlayOpen()&&!state.decision&&(state.inShot||!humanTurn());
    if(!want){
      if(tv.active){tv.active=false;tv.key=-1;if(tv.saved){Object.assign(cam,tv.saved);tv.saved=null;}}
      return false;
    }
    if(!tv.active){tv.active=true;tv.until=0;tv.recent.length=0;
      tv.saved={az:cam.az,el:cam.el,radius:cam.radius,fov:cam.fov,target:cam.target.slice(),follow:cam.follow,zoom:cam.zoom};}
    const stageOn=!!(stage&&stage.group);
    if(state.inShot){
      // the strike from the line or the wide, then follow the balls
      if(tv.key!==state.shotCount){tv.key=state.shotCount;if(tv.shot!=='line'&&tv.shot!=='wide')tvFrame('wide');tv.until=time+1.1;tv.after=1;}
      else if(time>tv.until&&!['overhead','reverse'].includes(tv.shot)){tvFrame(tvPick([['overhead',3],['reverse',2],['wide',1.5]]));tv.until=time+60;}
      return true;
    }
    if(tv.after){tv.after=0;tvFrame(Math.random()<.7?'face':'chair');return true;}       // the reaction
    if(stroke.on&&!['line','wide','reverse'].includes(tv.shot)){tvFrame('line');return true;}  // see him strike it
    if(time>tv.until)tvFrame(tvPick([['face',3],['line',3],['wide',2],['chair',1.2],['crowd',.8],['referee',ref.task?2.2:.35],
      ['trophy',stageOn&&stage.trophyAt?.6:0],['arena',stageOn?.8:0],['reverse',.8]]));
    return true;
  }
