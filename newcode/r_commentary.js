  // ---- COMMENTARY: a two-person team calls every match ---------------------
  // Two of the twenty commentators in js/commentary-voice.js are drawn for
  // each match. They talk about what really happened on the table: the pot
  // (long, thin cut, under pressure, a fluke), the position, misses and balls
  // in the jaws, safeties and snookers, fouls, a break as it builds, frame and
  // match ball, the result. No line is used twice in a match; they speak only
  // some of the time, never over the referee, and now and then one answers
  // the other. The MC's lines in the same file open the match.
  const COMM=window.VELVET_COMMENTARY||null;
  const comm={pair:[],queue:[],busy:false,used:new Set(),usedThr:new Set(),lastAt:-99,lastCat:{},lead:0,bus:null,buffers:new Map(),flags:{},idle:0,wait:0};
  let commOn=true;try{commOn=localStorage.getItem('velvet.commentary')!=='off';}catch(e){}
  function commNewPair(){
    const t=COMM?Object.keys(COMM.team):[];if(t.length<2)return;
    const a=t[Math.floor(Math.random()*t.length)];let b=a;while(b===a)b=t[Math.floor(Math.random()*t.length)];
    comm.pair=[a,b];comm.used.clear();comm.usedThr.clear();comm.flags={};comm.lastCat={};comm.lead=Math.random()<.5?0:1;paintComm();
  }
  function paintComm(){
    const tag=$('comm-tag');if(tag){const show=commOn&&!!comm.pair.length&&state.started&&state.mode!=='practice';tag.hidden=!show;
      if(show)tag.innerHTML='<span>COMMENTARY</span> '+comm.pair.map(k=>COMM.team[k].name.toUpperCase()).join(' &amp; ');}
    const b=$('commentary-toggle');if(b){b.textContent='COMMENTARY · '+(commOn?'ON':'OFF');b.classList.toggle('active',commOn);b.setAttribute('aria-pressed',String(commOn));}
  }
  $('commentary-toggle')?.addEventListener('click',()=>{commOn=!commOn;try{localStorage.setItem('velvet.commentary',commOn?'on':'off');}catch(e){}
    if(!commOn){comm.queue.length=0;commCaption(null);}paintComm();});
  let captionTimer=0;
  function commCaption(who,text){const el=$('comm-caption');if(!el)return;clearTimeout(captionTimer);
    if(!who){captionTimer=setTimeout(()=>{el.hidden=true;},600);return;}
    el.innerHTML='<b>'+who+'</b> '+text.replace(/[<>&]/g,'');el.hidden=false;}
  function commBus(ctx){
    if(comm.bus)return comm.bus;
    // a dry commentary-box voice: no hall reverb, a little presence, under the table sounds
    const g=ctx.createGain(),hp=ctx.createBiquadFilter(),pr=ctx.createBiquadFilter();g.gain.value=.85;
    hp.type='highpass';hp.frequency.value=120;pr.type='peaking';pr.frequency.value=2800;pr.gain.value=2.5;pr.Q.value=.8;
    g.connect(hp);hp.connect(pr);pr.connect(audioBus||ctx.destination);comm.bus=g;return g;
  }
  function commBuffer(ctx,b64){
    let p=comm.buffers.get(b64);
    if(!p){const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));p=ctx.decodeAudioData(bin.buffer);comm.buffers.set(b64,p);}
    return p;
  }
  // Tone of voice: a little quicker and brighter at the big moments, hushed
  // when it is tense.
  // How it is said follows the moment. A great shot, a big break or a frame won comes quicker, higher, louder
  // and brighter, often after a quick "Oh, yes!" or "Superb!" in the same voice; a fluke more so, with an
  // "Ooh!"; a miss, a ball rattling in the jaws, an in-off or a poor safety drops lower, slower, softer and
  // duller, often after an "Ooh..." or an "Oh dear."; the tense moments (frame ball, the re-spotted black,
  // needing snookers) are hushed. Each recording stays the same; its delivery is shaped as it plays.
  const MOOD={
    thrill:new Set(['pot_long','pot_double','pot_pressure','break_100','break_big','clearance','frame_won','frame_won_close','match_won','escape_good','crowd','live_wow','snooker_laid','pack_split','position_good','safety_good']),
    surprise:new Set(['pot_fluke']),
    gutted:new Set(['miss_easy','miss_hard','jaws','in_off','live_ooh','live_ohno','position_poor','escape_poor','safety_poor','foul_generic','break_off_poor']),
    tense:new Set(['frame_ball','match_ball','max_on','respotted_black','thinking','score_close','needs_snookers'])};
  const TONES={thrill:{rate:1.07,gain:1.4,bright:4.5,lead:['live_wow',/^(Oh, yes!|Shot!|Lovely!|Superb!|Oh, beautiful!)$/],leadP:.45},
    surprise:{rate:1.1,gain:1.5,bright:5.5,lead:['live_ooh',/^(Ooh!)$/,'live_wow',/^(Oh, yes!)$/],leadP:.75},
    gutted:{rate:.93,gain:.9,bright:-6,lead:['live_ooh',/^(Ooh!|Ooh, no!|Ohh, so close!|Oh, rattled!)$/,'live_ohno',/^(Oh, no!|Oh dear\.)$/],leadP:.5},
    tense:{rate:.97,gain:.76,bright:-2.5}};
  const moodOf=cat=>{const c=cat.split('@')[0];for(const k in MOOD)if(MOOD[k].has(c))return k;return null;};
  const tone=cat=>{const m=moodOf(cat),t=m&&TONES[m];return t?{rate:t.rate*(1+(Math.random()-.5)*.025),gain:t.gain,bright:t.bright,mood:m}:{rate:1,gain:1};};
  // A quick reaction in the commentator's own voice before the line (not before the live calls themselves).
  function leadFor(k,cat){
    const c=cat.split('@')[0],t=TONES[moodOf(cat)];if(!t||!t.lead||c.startsWith('live_')||Math.random()>t.leadP)return null;
    const L=[];for(let j=0;j<t.lead.length;j+=2)for(const l of (COMM.team[k].lines[t.lead[j]]||[]))if(t.lead[j+1].test(l[0]))L.push(l);
    if(c==='jaws')for(let j=L.length-1;j>=0;j--)if(/no!|dear/.test(L[j][0]))L.splice(j,1);                 // a near thing, not a disaster
    if(c==='in_off'||c==='foul_generic')for(let j=L.length-1;j>=0;j--)if(/close|rattled/.test(L[j][0]))L.splice(j,1);
    return L.length?L[Math.floor(Math.random()*L.length)]:null;
  }
  // A conversation: one opens, the other answers, and the first may close it.
  function commThread(cat,opt){
    const list=(COMM.threads||[]).filter(t=>t.cat===cat&&!comm.usedThr.has(t.id));if(!list.length)return false;
    const [p0,p1]=comm.pair,opts=[];
    for(const t of list)for(const [a,b] of [[p0,p1],[p1,p0]]){
      const A=COMM.team[a].thr||{},B=COMM.team[b].thr||{};let ok=true;
      for(let j=0;j<t.n&&ok;j++)ok=!!((j%2?B:A)[t.id+'#'+j]);
      if(ok)opts.push([t,a,b]);}
    if(!opts.length)return false;
    const [t,a,b]=opts[Math.floor(Math.random()*opts.length)],tn=tone(cat);comm.usedThr.add(t.id);
    for(let j=0;j<t.n;j++){const k=j%2?b:a;comm.queue.push({k,parts:[COMM.team[k].thr[t.id+'#'+j]],delay:j?.22:(opt.delay??.7),...tn});}
    comm.lastAt=time;comm.lastCat[cat]=time;if(!comm.busy)commPlay();return true;
  }
  // In the moment: a quick word while the balls are still running.
  function commLive(kind,ball){
    if(!COMM||!commOn||!comm.pair.length||!state.sound||state.mode==='practice'||!state.inShot||!state.shot||!ball)return;
    const s=state.shot,quick={force:true,noReply:true,noThread:true,delay:0,cool:3};if(s.live)return;
    if(kind==='pot'){
      if(ball.type==='cue'){s.live=1;commSay('live_ohno',.55,null,quick);return;}
      const b0=(s.snapshot&&s.snapshot.balls||[]).find(b=>b.id===ball.id);if(!b0)return;
      const pk=POCKETS.reduce((m,q)=>{const d=Math.hypot(q.x-ball.x,q.z-ball.z);return d<m.d?{q,d}:m;},{q:null,d:9}).q;
      const d=Math.hypot(b0.x-s.cueOrigin[0],b0.z-s.cueOrigin[1])+(pk?Math.hypot(pk.x-b0.x,pk.z-b0.z):0);
      if(d>2.2){s.live=1;commSay('live_wow',.6,null,quick);}
    }else if(kind==='jaw'&&ball.type!=='cue'&&Math.hypot(ball.vx,ball.vz)<1.2){s.live=1;commSay('live_ooh',.5,null,quick);}
  }
  // Say something from category 'cat' with probability p; 'who' is the
  // player it is about (for a spoken name first); opt: delay, urgent, force, cool.
  function commSay(cat,p=1,who=null,opt={}){
    if(!COMM||!commOn||!comm.pair.length||!state.sound||state.mode==='practice')return false;
    const roll=Math.random()<=p;if(window.__commLog)window.__commLog.push((roll?'':'-')+cat);
    if(!roll)return false;
    if(!opt.force&&time-comm.lastAt<(opt.urgent?2.4:6))return false;
    if((comm.queue.length>1&&!opt.stack)||(comm.lastCat[cat]&&time-comm.lastCat[cat]<(opt.cool||30)))return false;
    // about half the time, a conversation instead of a single line (a player's own lines come first)
    const ownAny=who&&comm.pair.some(k=>(COMM.team[k].lines[cat+'@'+who]||[]).some(l=>!comm.used.has(k+l[0])));
    if(!opt.noThread&&!ownAny&&Math.random()<.5&&commThread(cat,opt))return true;
    const first=Math.random()<.66?comm.lead:1-comm.lead;
    for(const k of [comm.pair[first],comm.pair[1-first]]){
      // a player can have lines of his own ('pot_long@oudom'); they come first, about two times in three
      const t=COMM.team[k],free=ls=>(ls||[]).filter(l=>!comm.used.has(k+l[0])),own=who?free(t.lines[cat+'@'+who]):[];
      const mine=own.length&&(Math.random()<.65||!(t.lines[cat]||[]).length),opts=mine?own:free(t.lines[cat]);if(!opts.length)continue;
      const line=opts[Math.floor(Math.random()*opts.length)];comm.used.add(k+line[0]);
      const parts=[],lead=leadFor(k,cat);if(lead)parts.push(lead);
      if(!mine&&who&&t.names[who]&&Math.random()<.34)parts.push(['',t.names[who]]);
      parts.push(line);
      comm.queue.push({k,parts,delay:opt.delay??.7,...tone(cat)});comm.lastAt=time;comm.lastCat[cat]=time;
      const o=comm.pair[0]===k?comm.pair[1]:comm.pair[0],rep=COMM.team[o].replies.filter(l=>!comm.used.has(o+l[0]));
      if(!opt.noReply&&rep.length&&Math.random()<.12){const r=rep[Math.floor(Math.random()*rep.length)];comm.used.add(o+r[0]);comm.queue.push({k:o,parts:[r],delay:.2});}
      if(!comm.busy)commPlay();
      return true;
    }
    return false;
  }
  function commMC(key,delay=0){   // the MC's own lines (walk-on)
    if(!COMM||!COMM.mc||!COMM.mc[key]||!state.sound)return false;
    comm.queue.push({k:null,mc:true,parts:[COMM.mc[key]],delay});if(!comm.busy)commPlay();return true;
  }
  async function commPlay(){
    const ctx=ensureAudio();if(!ctx){comm.queue.length=0;return;}
    comm.busy=true;
    try{
      while(comm.queue.length){
        const it=comm.queue.shift();await waitSec(it.delay);
        for(let w=0;voicePlaying&&w<40;w++)await waitSec(.15);          // never over the referee
        if(!state.sound||(!it.mc&&!commOn))continue;
        for(const [text,b64] of it.parts){
          const buf=await commBuffer(ctx,b64).catch(()=>null);if(!buf)continue;
          const src=ctx.createBufferSource(),rate=it.rate||1;src.buffer=buf;src.playbackRate.value=rate;let out=src;
          if(it.bright){const f=ctx.createBiquadFilter();f.type='highshelf';f.frequency.value=2400;f.gain.value=it.bright;out.connect(f);out=f;}   // brighter when thrilled, duller when gutted
          if(it.gain&&it.gain!==1){const g=ctx.createGain();g.gain.value=it.gain;out.connect(g);out=g;}
          out.connect(it.mc?voiceInput(ctx):commBus(ctx));src.start();
          if(text)commCaption(it.mc?'MC':COMM.team[it.k].name,text);comm.lastAt=time;
          await waitSec(buf.duration/rate+.1);
        }
        commCaption(null);
      }
    }finally{comm.busy=false;}
  }
  // ---- what happened, read from the shot that has just finished ----
  const commPro=i=>state.mode==='bot'&&i===1?botOpponent.id:null;
  function redSpread(){const r=balls.filter(b=>b.type==='red'&&!b.pocketed);if(r.length<4)return 0;
    let cx=0,cz=0;for(const b of r){cx+=b.x;cz+=b.z;}cx/=r.length;cz/=r.length;let s=0;for(const b of r)s+=(b.x-cx)**2+(b.z-cz)**2;return Math.sqrt(s/r.length);}
  function bestChance(types){let best=0;for(const o of potOptions(types)){const c=potChance(o,LEVELS.hard.aim,1);if(c>best)best=c;}return best;}
  function commAfterShot(s){
    comm.wait=0;comm.flags.thought=0;
    if(!s||!comm.pair.length||state.mode==='practice'||state.finished)return;
    const by=s.by??state.current,who=commPro(by),start=new Map((s.snapshot&&s.snapshot.balls||[]).map(b=>[b.id,b]));
    const spread=redSpread();
    if(s.foul){if(s.cueScratch)commSay('in_off',.7,who,{urgent:true});else commSay('foul_generic',.3,who);return;}
    const scored=state.current===by&&state.break>(s.breakBefore||0);
    if(scored){
      // the pot itself: how long, how thin, how much it mattered, or a fluke
      const ballOn=balls.find(b=>b.pocketed&&s.potted.includes(b.type)&&start.get(b.id)&&!start.get(b.id).pocketed&&b.type!=='cue');
      let kind='pot_routine',pr=.16;
      if(ballOn){
        const b0=start.get(ballOn.id),f=falling.find(x=>x.id===ballOn.id),pk=f?POCKETS[f.pocketId]:null;
        const d1=Math.hypot(b0.x-s.cueOrigin[0],b0.z-s.cueOrigin[1]),d2=pk?Math.hypot(pk.x-b0.x,pk.z-b0.z):.5;
        const cut=pk?Math.abs(wrapA(Math.atan2(pk.z-b0.z,pk.x-b0.x)-s.angle))*180/PI:0;
        const fluke=s.firstId!=null&&s.firstId!==ballOn.id&&(s.kind!=='pot'||s.target!==ballOn.id);
        const lead=state.scores[by]-state.scores[1-by],late=pointsRemaining()<=35;
        if(fluke){kind='pot_fluke';pr=.6;}
        else if(late&&Math.abs(lead)<=10){kind='pot_pressure';pr=.5;}
        else if(d1+d2>2.3||d2>1.5){kind='pot_long';pr=.6;}
        else if(cut>55){kind='pot_cut';pr=.45;}
      }
      const b0=s.breakBefore||0,b1=state.break,crossed=n=>b0<n&&b1>=n;
      if(!comm.flags.breakStart)comm.flags.breakStart=b0;
      if(s.potted.some(t=>COLOR_ORDER.includes(t)&&t!=='black'))comm.flags.notMax=true;
      if(crossed(100))commSay('break_100',1,who,{force:true,delay:1.4});
      else if(b1>=120&&!comm.flags.big){comm.flags.big=1;commSay('break_big',.7,who,{delay:1.2});}
      else if(!comm.flags.notMax&&b1>=56&&!comm.flags.maxOn){comm.flags.maxOn=1;commSay('max_on',.9,who,{delay:1.2,force:true});}
      else if(crossed(70))commSay('break_70',.5,who,{delay:1.2});
      else if(crossed(50))commSay('break_50',.7,who,{delay:1.2});
      else if(crossed(30))commSay('break_30',.35,who,{delay:1.2});
      else if(!commSay(kind,pr,who,{urgent:kind!=='pot_routine'})){
        // the position he has left himself
        const next=bestChance(ballsOnTypes());
        if(next>.85)commSay('position_good',.16,who,{delay:1.6});else if(next<.05)commSay('position_poor',.45,who,{delay:1.6});
      }
      if(spread>.17&&(s.reds0||0)<.11)commSay('pack_split',.5,null,{delay:2.4});
      // frame ball: one more pot and the frame is out of reach
      const left=pointsRemaining();
      if(!comm.flags.frameBall&&state.scores[by]-state.scores[1-by]<=left&&state.scores[by]+7-state.scores[1-by]>left-7&&left<=40){
        comm.flags.frameBall=1;const m=state.match,decides=m&&m.frames[by]+1>=Math.ceil(m.bestOf/2);
        commSay(decides&&m.bestOf>1?'match_ball':'frame_ball',.75,who,{delay:2.2,force:true});}
      return;
    }
    // no pot: the turn has passed
    comm.flags.notMax=false;comm.flags.big=0;comm.flags.maxOn=0;
    const opp=state.current,oppTypes=ballsOnTypes(),leave=bestChance(oppTypes),snooker=snookeredOnAll(oppTypes);
    const objId=s.firstId,jawed=objId!=null&&(s.jaws||[]).includes(objId);
    if((s.breakBefore||0)>=20)commSay('break_end',.35,who,{delay:1.0});
    if(state.shotCount<=1&&s.kind!=='pot'){commSay(leave>.5?'break_off_poor':'break_off',.65,who);return;}
    if(jawed){commSay('jaws',.75,who,{urgent:true});return;}
    // a pot attempt? the bot says so; for you: the ball ran toward a pocket and ended near it
    let attempt=s.kind==='pot';
    if(s.kind==null&&objId!=null){const b0=start.get(objId),b=balls.find(x=>x.id===objId);
      if(b0&&b&&!b.pocketed){const mv=Math.atan2(b.z-b0.z,b.x-b0.x);
        attempt=POCKETS.some(p=>Math.abs(wrapA(Math.atan2(p.az-b0.z,p.ax-b0.x)-mv))<.2&&Math.hypot(p.ax-b.x,p.az-b.z)<.32);}}
    if(s.kind==='escape'||s.wasSnookered){commSay(leave>.5?'escape_poor':'escape_good',.55,who);return;}
    if(attempt){commSay(leave>.6?'miss_easy':'miss_hard',.55,who);return;}
    if(snooker)commSay('snooker_laid',.75,who,{urgent:true});
    else if(leave>.55)commSay('safety_poor',.5,who);
    else if(leave<.25){if(comm.flags.safeties>=2)commSay('safety_exchange',.4);else commSay('safety_good',.4,who);}
    comm.flags.safeties=(comm.flags.safeties||0)+1;
    if(snookersNeeded(opp)&&!comm.flags['snk'+opp]){comm.flags['snk'+opp]=1;commSay('needs_snookers',.5,commPro(opp),{delay:2.5});}
    const diff=Math.abs(state.scores[0]-state.scores[1]);
    if(diff<=8&&pointsRemaining()<=60)commSay('score_close',.12,null,{delay:3});else if(diff>=45)commSay('score_lead',.12,null,{delay:3});
  }
  function commFrameStart(increment){
    if(state.mode==='practice')return;
    if(!increment)commNewPair();comm.flags={};comm.lastAt=time-3;paintComm();
    if(increment)commSay('frame_start',.6,null,{delay:3.5,force:true});
    else{commSay('welcome',1,null,{delay:9,force:true,noReply:false});
      if(commPro(1))commSay('intro',1,commPro(1),{delay:1.2,force:true,noReply:true,stack:true});}   // a player with an introduction of his own
  }
  function commFrameEnd(winner){
    if(winner==null||state.mode==='practice'||!comm.pair.length)return;
    const m=state.match,over=m&&m.over,margin=Math.abs(state.scores[0]-state.scores[1]);
    comm.queue.length=0;
    if(over)commSay('match_won',1,commPro(winner),{force:true,delay:2.4});
    else if(margin<=16||state.phase==='clearance')commSay('frame_won_close',.9,commPro(winner),{force:true,delay:2.4});
    else commSay('frame_won',.85,commPro(winner),{force:true,delay:2.4});
  }
  function commIdle(dt){
    if(!comm.pair.length||state.inShot||!state.started||state.finished||cine.on)return;
    comm.wait+=dt;     // a long think over a shot gets talked about
    if(comm.wait>9&&!comm.flags.thought&&time-comm.lastAt>8){comm.flags.thought=1;commSay('thinking',.65,null,{delay:0});}
    comm.idle+=dt;if(comm.idle<4)return;comm.idle=0;
    if(time-comm.lastAt>26)commSay('filler',.35,null,{delay:0});
  }
