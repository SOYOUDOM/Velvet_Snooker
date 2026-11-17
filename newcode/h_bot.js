  // ---- OPPONENT AI: LEVELS, PRO STYLES, SIMULATED POSITION & SAFETY PLAY ----
  // The bot tries its options with the real physics on a copy of the table:
  // power and spin for position on the next ball, and safeties that leave the
  // least. Its level sets cueing accuracy and how many options it examines;
  // each pro adds a style (speed, attacking or tactical, long potting).
  const LEVELS={
    easy:{label:'EASY',aim:.0040,power:7,spin:.18,threshold:.12,position:0,safety:0,escape:.45,think:[1300,2200]},
    medium:{label:'MEDIUM',aim:.0024,power:5,spin:.12,threshold:.30,position:2,safety:8,escape:.3,think:[1000,1900]},
    hard:{label:'HARD',aim:.0012,power:3,spin:.08,threshold:.42,position:6,safety:18,escape:.2,think:[900,1700]},
    veryhard:{label:'VERY HARD',aim:.00055,power:2,spin:.05,threshold:.5,position:9,safety:30,escape:.12,think:[800,1500]}};
  const OPPONENTS=window.VELVET_OPPONENTS&&window.VELVET_OPPONENTS.length?window.VELVET_OPPONENTS:[{id:'club',name:'Club Bot',short:'CLUB BOT',style:{}}];
  let botLevel='medium',botOpponent=OPPONENTS[0];
  try{const saved=JSON.parse(localStorage.getItem('velvet.opponent')||'{}');if(LEVELS[saved.level])botLevel=saved.level;botOpponent=OPPONENTS.find(o=>o.id===saved.id)||OPPONENTS[0];}catch(e){}
  function botSkill(){
    const L=LEVELS[botLevel],st=botOpponent.style||{};
    return{...L,aim:L.aim*(st.pot||1),long:st.long||1,threshold:L.threshold+(st.attack||0),
      position:Math.round(L.position*(st.position||1)),safety:Math.round(L.safety*(st.safety||1)),think:L.think.map(t=>t*(st.speed||1))};
  }
  const opponentShort=()=>botOpponent.short||'CLUB BOT';
  const nextTick=()=>new Promise(r=>setTimeout(r,0));
  // Cooperative time slicing: planning yields every ~8 ms so frames keep flowing.
  function budget(){let t=performance.now();return async()=>{if(performance.now()-t>8){await nextTick();t=performance.now();}};}

  function unblockedIn(arr,ax,az,bx,bz,ignoreIds=[],margin=R*2.10){
    const dx=bx-ax,dz=bz-az,den=dx*dx+dz*dz;
    if(den<.00005)return true;
    for(const b of arr){
      if(b.pocketed||ignoreIds.includes(b.id))continue;
      const t=clamp(((b.x-ax)*dx+(b.z-az)*dz)/den,0,1);
      if(t<.035||t>.97)continue;
      if(len2(b.x-(ax+t*dx),b.z-(az+t*dz))<margin)return false;
    }
    return true;
  }
  const unblocked=(ax,az,bx,bz,ignoreIds,margin)=>unblockedIn(balls,ax,az,bx,bz,ignoreIds,margin);
  function normalRandom(){return (Math.random()+Math.random()+Math.random()+Math.random()-2)*.95;}
  // Every geometrically open pot for the given ball types on a table (real or simulated).
  function potOptions(types,arr=balls){
    const cb=arr.find(b=>b.type==='cue'&&!b.pocketed);if(!cb)return[];
    const out=[];
    for(const b of arr){
      if(b.pocketed||!types.includes(b.type))continue;
      for(const pocket of POCKETS){
        const pd=len2(pocket.x-b.x,pocket.z-b.z);if(pd<.10)continue;
        const ux=(pocket.x-b.x)/pd,uz=(pocket.z-b.z)/pd,gx=b.x-ux*2*R,gz=b.z-uz*2*R;
        if(Math.abs(gx)>HX-R*.98||Math.abs(gz)>HZ-R*.98)continue;
        const cd=len2(gx-cb.x,gz-cb.z);if(cd<.10)continue;
        const cut=((gx-cb.x)/cd)*ux+((gz-cb.z)/cd)*uz;if(cut<.12)continue;
        if(!unblockedIn(arr,cb.x,cb.z,gx,gz,[cb.id,b.id],2*R*.96))continue;
        if(!unblockedIn(arr,b.x,b.z,pocket.x,pocket.z,[cb.id,b.id],2*R*.97))continue;
        out.push({target:b,pocket,aim:Math.atan2(gz-cb.z,gx-cb.x),distance:cd,ballDistance:pd,cut,kind:'pot',nominate:b.type});
      }
    }
    return out;
  }
  function plannedShotFor(type){return potOptions([type]).map(o=>({...o,score:3.6-(o.distance*.23+o.ballDistance*.32+(1-o.cut)*1.8)+(o.pocket.corner?0:.08)}));}
  function erf(x){const t=1/(1+.3275911*Math.abs(x)),y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x);return x>=0?y:-y;}
  // Chance that cueing with aim error sigma still sends the object ball in:
  // the error grows with the cue-ball distance and with thinner cuts.
  function potChance(o,sigma,longMult=1){
    const half=(o.pocket.corner?.028:.034)*(.55+.45*o.cut);
    const s=sigma*(o.distance>1.2?longMult:1)*(o.distance/(2*R))/Math.max(.2,o.cut)+1e-7;
    return clamp(erf(Math.atan2(half,o.ballDistance)/(Math.SQRT2*s)),0,1);
  }
  // Pure simulation of a whole shot (all balls) on a copy of the table.
  const noop=()=>{};
  function simulateShot(aim,cfg,src=balls){
    const arr=src.filter(b=>!b.pocketed).map(b=>({id:b.id,type:b.type,x:b.x,z:b.z,vx:0,vz:0,wx:0,wy:0,wz:0,q:[0,0,0,1],pocketed:false}));
    const cue=arr.find(b=>b.type==='cue');if(!cue)return null;
    const st=cueStrikeState(cue,aim,cfg);Object.assign(cue,{vx:st.vx,vz:st.vz,wx:st.wx,wz:st.wz,wy:st.wy});
    const res={first:null,potted:[],cueScratch:false,arr,cue:null};
    const pot=b=>{b.pocketed=true;res.potted.push(b.type);if(b.type==='cue')res.cueScratch=true;};
    for(let i=0;i<180*22;i++){
      for(const b of arr)if(!b.pocketed&&(b.vx||b.vz||b.wx||b.wz)){advanceOnCloth(b,STEP);tableContacts(b,pot,noop);}
      for(let a=0;a<arr.length;a++){const A=arr[a];if(A.pocketed)continue;
        for(let c=a+1;c<arr.length;c++){const B=arr[c];if(B.pocketed)continue;
          if(collideCore(A,B)&&!res.first){if(A===cue)res.first=B.type;else if(B===cue)res.first=A.type;}}}
      if(i%12===11){let e=0;for(const b of arr)if(!b.pocketed)e+=Math.abs(b.vx)+Math.abs(b.vz);if(e<.0015)break;}
    }
    res.cue=cue.pocketed?null:cue;
    return res;
  }
  const simLegal=(res,onTypes,mayPot)=>!!res&&!res.cueScratch&&!!res.first&&onTypes.includes(res.first)&&res.potted.every(t=>mayPot.includes(t));
  function nextOnTypes(arr,pottedType){
    if(state.phase==='red')return COLOR_ORDER.slice();
    if(state.phase==='color')return arr.some(b=>b.type==='red'&&!b.pocketed)?['red']:['yellow'];
    const i=COLOR_ORDER.indexOf(pottedType)+1;return i<6?[COLOR_ORDER[i]]:[];
  }
  function positionValue(arr,types,sigma,longMult=1){
    let best=0;for(const o of potOptions(types,arr)){const v=potChance(o,sigma,longMult)*(COLOR_INFO[o.target.type].score+(o.target.type==='red'?4:0));if(v>best)best=v;}
    return best;
  }
  function clearPathIn(arr,cb,x,z,target,on){
    const dx=x-cb.x,dz=z-cb.z,L2=dx*dx+dz*dz||1e-9;
    for(const b of arr){if(b.pocketed||b===cb||b===target||on.includes(b.type))continue;
      const t=clamp(((b.x-cb.x)*dx+(b.z-cb.z)*dz)/L2,0,1);if(Math.hypot(b.x-(cb.x+dx*t),b.z-(cb.z+dz*t))<2*R-.0005)return false;}
    return true;
  }
  function snookeredIn(arr,types){
    const cb=arr.find(b=>b.type==='cue'&&!b.pocketed);if(!cb)return false;
    const on=arr.filter(b=>!b.pocketed&&types.includes(b.type));
    return on.length>0&&on.every(t=>{const dx=t.x-cb.x,dz=t.z-cb.z,d=Math.hypot(dx,dz);if(d<2*R+.002)return false;
      const px=-dz/d,pz=dx/d,off=2*R*.985;return ![-1,1].every(s=>clearPathIn(arr,cb,t.x+px*off*s,t.z+pz*off*s,t,types));});
  }
  // The real pocket: the cue ball meets the object ball (throw included), then
  // the object ball's own run is tried over a fan of directions with the
  // game's physics; the run of directions that drop is the pocket window, and
  // the cue aim that sends the ball through its centre is found by Newton steps.
  const wrapA=a=>Math.atan2(Math.sin(a),Math.cos(a));
  function launch(cb,t,aim,cfg){
    const c=cueStrikeState(cb,aim,cfg),o={x:t.x,z:t.z,vx:0,vz:0,wx:0,wy:0,wz:0,q:[0,0,0,1]};
    for(let i=0;i<180*10;i++){
      advanceOnCloth(c,STEP);
      if(collideCore(c,o))return{dir:Math.atan2(o.vz,o.vx),o};
      if(!c.vx&&!c.vz)return null;
    }
    return null;
  }
  function travelPots(o0,dir,pocket){
    const sp=Math.hypot(o0.vx,o0.vz),o={x:o0.x,z:o0.z,vx:Math.cos(dir)*sp,vz:Math.sin(dir)*sp,wx:o0.wx,wy:o0.wy,wz:o0.wz,q:[0,0,0,1]};
    let pot=false,cushions=0;const onP=()=>{pot=true;},onC=()=>{cushions++;};
    for(let i=0;i<180*12&&cushions<3;i++){
      advanceOnCloth(o,STEP);
      if(tableContacts(o,onP,onC))break;
      if(!o.vx&&!o.vz)return false;
    }
    return pot&&len2(o.x-pocket.x,o.z-pocket.z)<pocket.radius*1.2;
  }
  function measureWindow(o,cb,cfg){
    o.hw=0;o.hwAim=0;
    const L=launch(cb,o.target,o.aim,cfg);if(!L)return o;
    const step=.003,ok=k=>travelPots(L.o,L.dir+k*step,o.pocket);
    const k0=Math.round(wrapA(Math.atan2(o.pocket.z-o.target.z,o.pocket.x-o.target.x)-L.dir)/step);
    let start=null;
    for(let j=0;j<=12&&start===null;j++){if(ok(k0+j))start=k0+j;else if(j&&ok(k0-j))start=k0-j;}
    if(start===null)return o;
    let lo=start,hi=start;while(hi-start<24&&ok(hi+1))hi++;while(start-lo<24&&ok(lo-1))lo--;
    const centre=L.dir+(lo+hi)/2*step,hw=(hi-lo+1)/2*step;
    const L1=launch(cb,o.target,o.aim+.0006,cfg);if(!L1)return o;
    let slope=wrapA(L1.dir-L.dir)/.0006;if(Math.abs(slope)<2)slope=slope<0?-2:2;
    let a=o.aim,f=wrapA(L.dir-centre);
    for(let i=0;i<4&&Math.abs(f)>hw*.04;i++){a-=f/slope;const Li=launch(cb,o.target,a,cfg);if(!Li)return o;f=wrapA(Li.dir-centre);}
    return Object.assign(o,{aimTrue:a,slope,hw,centre,hwAim:Math.max(0,hw-Math.abs(f))/Math.abs(slope)});
  }
  // Re-centre the aim for another power/spin (throw changes with both).
  function recentre(o,cb,cfg){
    let a=o.aimTrue;
    for(let i=0;i<3;i++){const L=launch(cb,o.target,a,cfg);if(!L)return null;const f=wrapA(L.dir-o.centre);if(Math.abs(f)<o.hw*.04)return a;a-=f/o.slope;}
    return a;
  }
  const windowChance=(o,skill)=>o.hwAim>0?clamp(erf(o.hwAim/(Math.SQRT2*skill.aim*(o.distance>1.2?skill.long:1))),0,1):0;
  // Pot with position: simulate power/spin options and keep the one that pots
  // the ball AND leaves the best chance on the next ball.
  const COMBOS=[[0,0,0],[10,0,.45],[-6,0,-.55],[16,0,-.55],[6,0,.7],[-10,0,0],[24,0,0],[5,.45,0],[5,-.45,0],[14,.35,.3],[14,-.35,.3]];
  const basePower=o=>Math.round(clamp(24+o.distance*8+o.ballDistance*12+(1-o.cut)*14,18,85));
  async function planPot(opts,skill,tick){
    const onT=ballsOnTypes(),cb=cueBall(),val=o=>COLOR_INFO[o.target.type].score;
    for(const o of opts)o.p=potChance(o,skill.aim,skill.long);
    opts.sort((a,b)=>b.p*val(b)-a.p*val(a));
    const top=opts.slice(0,Math.min(opts.length,3+Math.floor(skill.position/2)));
    for(const o of top){measureWindow(o,cb,{power:basePower(o),spinX:0,spinY:0});o.p=windowChance(o,skill);await tick();}
    const live=top.filter(o=>o.hwAim>0).sort((a,b)=>b.p*val(b)-a.p*val(a));
    let best=null;
    for(const o of live.slice(0,skill.position?1+Math.floor(skill.position/3):1)){
      const base=basePower(o),mayPot=state.phase==='red'?['red',o.target.type]:[o.target.type];
      // Easy: aims at the ghost ball (no allowance for throw), one weight.
      if(!skill.position){const s=o.p*val(o);if(!best||s>best.score)best={...o,cfg:{power:base,spinX:0,spinY:0},score:s};continue;}
      for(const [dp,sx,sy] of COMBOS.slice(0,skill.position)){
        const cfg={power:Math.round(clamp(base+dp,12,95)),spinX:sx,spinY:sy},aim=recentre(o,cb,cfg);if(aim==null)continue;
        const res=simulateShot(aim,cfg);await tick();
        if(!simLegal(res,onT,mayPot)||!res.potted.includes(o.target.type))continue;
        const s=o.p*(val(o)+.85*positionValue(res.arr,nextOnTypes(res.arr,o.target.type),skill.aim,skill.long));
        if(!best||s>best.score)best={...o,aim,cfg,score:s};
      }
    }
    return best;
  }
  // Safety: thin and half-ball contacts at several weights, each simulated;
  // keep the one that leaves the opponent the least (a snooker is a bonus).
  async function planSafety(skill,tick,breakOff=false){
    const cb=cueBall();if(!cb)return null;
    const on=ballsOnTypes(),oppOn=state.phase==='color'?(redCount()?['red']:[COLOR_ORDER[0]]):state.phase==='red'?['red']:[onBall()];
    // Contacts the cue ball can really make: the path tracer must reach the
    // intended ball first (a thin edge on the back red passes outside the pack).
    const cands=[];
    for(const b of balls){
      if(b.pocketed||!on.includes(b.type))continue;const d=len2(b.x-cb.x,b.z-cb.z);if(d<.06)continue;
      const base=Math.atan2(b.z-cb.z,b.x-cb.x),half=Math.asin(Math.min(.999,2*R/d));
      // Only as thin as this player can trust (cueing error to spare).
      const fmax=1-(breakOff?2*skill.aim*.8:2.5*skill.aim*1.3)*d/(2*R);
      for(const f of breakOff?[.93,.9,.86,.78,-.93,-.9,-.86,-.78]:[-.85,-.6,-.3,0,.3,.6,.85]){
        if(Math.abs(f)>fmax)continue;
        const aim=base+Math.asin(clamp(f*Math.sin(half),-1,1)),tr=tracePath(aim,{power:40,spinX:0,spinY:0},0,false);
        if(tr&&tr.end==='ball'&&tr.hit===b)cands.push({b,aim,d});
      }
    }
    await tick();
    for(let i=cands.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cands[i],cands[j]]=[cands[j],cands[i]];}
    let best=null;
    for(const c of cands.slice(0,Math.max(4,skill.safety)))for(const [pw,sx] of breakOff?[[86,.45],[86,-.45],[94,.45],[94,-.45],[100,.45],[100,-.45]]:
        [1.4,2.2,3.2].map(k=>[powerFor(c.d*k),0])){
      const sy=breakOff?0:-.1,res=simulateShot(c.aim,{power:pw,spinX:sx,spinY:sy});await tick();
      if(!simLegal(res,on,state.phase==='color'?[c.b.type]:on))continue;
      const cue=res.cue,edge=cue?Math.min(HX-Math.abs(cue.x),HZ-Math.abs(cue.z)):0;
      const score=-positionValue(res.arr,oppOn,.0012)+(snookeredIn(res.arr,oppOn)?1.3:0)+(edge<.06?.35:0)
        +(res.potted.length?2.5:0)+(breakOff&&cue?(cue.x<BAULK_X?1.2:0)+(cue.x<-HX+.35?.5:0):0)+rand(-.02,.02);
      if(!best||score>best.score)best={target:c.b,aim:c.aim,power:pw,spinX:sx,spinY:sy,kind:breakOff?'break':'safety',nominate:c.b.type,score,traced:true};
    }
    return best;
  }
  // Power that rolls the cue ball about this far on its own (cloth + slide).
  function powerFor(dist){const v0=Math.sqrt(.42*dist)*1.4;return Math.round(clamp(Math.pow(Math.max(0,v0-.2)/4.7,1/1.23)*100,15,75));}
  // Simple safety (Easy level): roll up thinly to an open ball on.
  function safetyShotFor(type){
    const cb=cueBall();if(!cb)return null;
    let best=null;
    for(const b of balls){
      if(b.pocketed||b.type!==type)continue;
      const d=len2(b.x-cb.x,b.z-cb.z);
      if(d<.065)continue;
      if(!unblocked(cb.x,cb.z,b.x,b.z,[cb.id,b.id],R*1.9))continue;
      const off=rand(-.012,.012),angle=Math.atan2(b.z-cb.z,b.x-cb.x)+off;
      const choice={target:b,aim:angle,score:-(d*.15)+rand(-.08,.08),distance:d,kind:'safety',nominate:type};
      if(!best||choice.score>best.score)best=choice;
    }
    return best;
  }
  // Snookered: sweep every aim with the cue-ball path tracer (cushions
  // included) and take the widest window of aims whose first contact is a
  // legal ball, so a small cueing error still finds it.
  async function escapeShotFor(types,tick=budget()){
    const cb=cueBall();if(!cb)return null;
    const N=720,legal=new Set(types),windows=[];
    for(const power of [46,62,80]){
      let run=null;
      for(let i=0;i<=N;i++){
        if(i%24===0)await tick();
        const a=-PI+i*TAU/N,tr=i<N?tracePath(a,{power,spinX:0,spinY:0},3,false):null;
        const ok=!!(tr&&tr.end==='ball'&&legal.has(tr.hit.type));
        if(ok&&run&&tr.cushions===run.cushions&&tr.hit===run.hit){run.end=a;continue;}
        if(run)windows.push(run);
        run=ok?{start:a,end:a,cushions:tr.cushions,hit:tr.hit,power}:null;
      }
      if(windows.some(w=>w.cushions<=1&&w.end-w.start>.012))break;
    }
    if(!windows.length)return null;
    for(const w of windows)w.score=(w.end-w.start+TAU/N)*60-w.cushions*.45-w.power*.004;
    windows.sort((a,b)=>b.score-a.score);
    const w=windows[0];
    return{target:w.hit,aim:(w.start+w.end)/2,score:-2-w.cushions*.25,distance:1,kind:'escape',
      nominate:w.hit.type,power:w.power,spinX:0,spinY:0,window:w.end-w.start+TAU/N,cushions:w.cushions};
  }
  function lastResortShot(types){
    const cb=cueBall();if(!cb)return null;
    const targets=balls.filter(b=>!b.pocketed&&types.includes(b.type));if(!targets.length)return null;
    targets.sort((a,b)=>len2(a.x-cb.x,a.z-cb.z)-len2(b.x-cb.x,b.z-cb.z));
    const b=targets[0];return{target:b,aim:Math.atan2(b.z-cb.z,b.x-cb.x),score:-5,distance:len2(b.x-cb.x,b.z-cb.z),kind:'escape',nominate:b.type};
  }
  async function chooseBotShot(){
    if(state.mode!=='bot'||state.current!==1)return null;
    const skill=botSkill(),tick=budget();
    const types=state.freeBall?ballsOnTypes():state.phase==='color'?COLOR_ORDER.slice().reverse():[onBall()];
    const cb0=cueBall(),breakOff=state.shotCount===0&&redCount()===15&&!!cb0&&cueInD(cb0.x,cb0.z);
    const opts=breakOff?[]:potOptions(types);
    const pot=opts.length?await planPot(opts,skill,tick):null;
    let pick=pot&&pot.p>=skill.threshold?pot:null;
    if(!pick)pick=skill.safety?await planSafety(skill,tick,breakOff):types.map(t=>safetyShotFor(t)).filter(Boolean).sort((a,b)=>b.score-a.score)[0];
    if(!pick&&pot)pick=pot;
    if(!pick)pick=await escapeShotFor(types,tick)||lastResortShot(types);
    if(!pick)return null;
    if(state.phase==='color')state.nominated=pick.nominate;
    // Execution: the level's cueing error on aim, power and spin.
    const base=pick.cfg||{power:pick.power!==undefined?pick.power:clamp(18+(pick.distance||1)*9+rand(0,7),17,55),
      spinX:pick.spinX||0,spinY:pick.spinY!==undefined?pick.spinY:rand(-.5,0)};
    const aimSigma=pick.kind==='pot'?skill.aim*((pick.distance||0)>1.2?skill.long:1):pick.kind==='escape'?Math.min(.006,(pick.window||.01)*skill.escape):pick.kind==='break'?skill.aim*.8:skill.aim*1.3;
    return{...pick,aim:pick.aim+aimSigma*normalRandom(),
      power:Math.round(clamp(base.power+normalRandom()*skill.power*(pick.kind==='pot'?1:.6),8,100)),
      spinX:clamp(base.spinX+normalRandom()*skill.spin,-1,1),spinY:clamp(base.spinY+normalRandom()*skill.spin,-1,1)};
  }
  // Ball in hand: break off from beside the yellow; otherwise place the white
  // where the best pot is.
  function placeCueForBot(){
    const skill=botSkill(),cb=cueBall();if(!cb)return;
    if(state.shotCount===0&&canPlaceCue(BAULK_X-.004,D*.55)){moveCueInD(BAULK_X-.004,D*.55);return;}
    const types=state.freeBall?ballsOnTypes():state.phase==='color'?COLOR_ORDER.slice():[onBall()];
    let best=null,bv=-1;const ox=cb.x,oz=cb.z;
    for(let i=0;i<70;i++){
      const x=BAULK_X-rand(.03,D-.03),z=rand(-(D-.03),D-.03);if(!canPlaceCue(x,z))continue;
      cb.x=x;cb.z=z;const v=potOptions(types).reduce((m,o)=>Math.max(m,potChance(o,skill.aim,skill.long)*COLOR_INFO[o.target.type].score),0)+Math.random()*.01;
      if(v>bv){bv=v;best=[x,z];}
    }
    cb.x=ox;cb.z=oz;if(best)moveCueInD(best[0],best[1]);
  }
  function updateBot(now){
    if(state.mode==='bot'&&state.decision&&state.decision.chooser===1&&!isAnyOverlayOpen()&&!state.finished){
      if(!ai.decideAt)ai.decideAt=now+1100;
      if(now>=ai.decideAt){ai.decideAt=0;applyDecision(botDecision(state.decision));}
      return;
    }
    if(state.decision)return;
    if(state.mode!=='bot'||state.current!==1||state.inShot||!state.started||state.finished||isAnyOverlayOpen())return;
    if(!ai.plan){
      if(ai.planning||(ai.retryAt&&now<ai.retryAt))return;
      // Like a professional, the bot concedes when the frame is out of reach.
      const deficit=state.scores[0]-state.scores[1]-pointsRemaining();
      if(deficit>0&&(deficit>=14||(state.phase==='clearance'&&state.clearanceIndex>=4))){concedeFrame(1);return;}
      if(state.ballInHand)placeCueForBot();
      ai.planning=true;
      const token=state.frame+':'+state.shotCount,think=botSkill().think;
      chooseBotShot().then(plan=>{
        ai.planning=false;
        if(token!==state.frame+':'+state.shotCount||state.current!==1||state.inShot||state.decision||state.finished)return;
        if(!plan){ai.retryAt=performance.now()+1500;message(opponentShort()+' HAS NO CLEAR SHOT','THINKING AGAIN');return;}
        ai.retryAt=0;ai.plan=plan;ai.thinkUntil=Math.max(performance.now()+250,now+rand(think[0],think[1]));
        // The bot's choices go into its own settings only; you see them read-only.
        const own=shotSettings(1);own.power=plan.power;own.spinX=plan.spinX;own.spinY=plan.spinY;
        state.aim=plan.aim;
        refreshUI();message(opponentShort()+' IS LINING UP',plan.kind==='pot'?'GOING FOR THE '+plan.target.type.toUpperCase():
          plan.kind==='escape'?'ESCAPING THE SNOOKER':plan.kind==='break'?'BREAKING OFF':'PLAYING SAFE',1300);
      }).catch(e=>{ai.planning=false;ai.retryAt=performance.now()+1500;console.warn('VELVET bot:',e);});
      return;
    }
    if(now>=ai.thinkUntil){
      const plan=ai.plan;
      if(plan&&state.phase==='color')state.nominated=plan.nominate;
      if(plan){state.aim=plan.aim;takeShot(true,plan);}
    }
  }

