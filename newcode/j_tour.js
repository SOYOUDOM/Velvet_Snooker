  // ---- TOURNAMENT: 16-PLAYER KNOCKOUT, WST STYLE ----------------------------
  // You enter a seeded 16-player draw of tour professionals: seeds 1-8 are
  // kept apart, you and the other unseeded players are drawn against them.
  // Your matches are played at the table against the drawn pro (their style,
  // your chosen level); every other match is simulated frame by frame from the
  // players' strengths. Each round's match length follows the chosen format.
  // The draw, your current match score, prize money and career totals are
  // saved, so a tournament can be finished over several sittings.
  const TOUR_FIELD=['trump','zhao','wilson','osullivan','selby','higgins','williams','murphy','allen','robertson','ding','brecel','hawkins','bingham','lisowski'];
  const TOUR_RATING={trump:92,osullivan:92,zhao:89,selby:89,wilson:88,higgins:87,williams:86,murphy:86,allen:86,robertson:86,ding:85,brecel:85,hawkins:83,bingham:82,lisowski:81};
  const TOUR_FORMATS={quick:{label:'QUICK',best:[1,1,3,3]},standard:{label:'STANDARD',best:[3,3,5,7]},pro:{label:'PRO',best:[5,7,9,11]}};
  const TOUR_ROUNDS=['LAST 16','QUARTER-FINALS','SEMI-FINALS','FINAL'];
  const TOUR_EXIT=['the last 16','the quarter-finals','the semi-finals','the final'];
  const TOUR_PRIZE=[5000,10000,20000,40000,100000];      // out in L16, QF, SF, runner-up, champion
  const DRAW_ORDER=[1,16,8,9,5,12,4,13,3,14,6,11,7,10,2,15];
  const money=n=>'£'+n.toLocaleString('en-GB');
  let tourFormat='standard';
  try{const f=localStorage.getItem('velvet.tourFormat');if(TOUR_FORMATS[f])tourFormat=f;}catch(e){}
  function tourLoad(){try{const t=JSON.parse(localStorage.getItem('velvet.tournament')||'null');return t&&t.v===1?t:null;}catch(e){return null;}}
  function tourSave(t){try{localStorage.setItem('velvet.tournament',JSON.stringify(t));}catch(e){}}
  function careerLoad(){try{return JSON.parse(localStorage.getItem('velvet.career')||'null')||{events:0,titles:0,finals:0,earnings:0};}catch(e){return{events:0,titles:0,finals:0,earnings:0};}}
  const tourName=id=>id==='you'?'YOU':((OPPONENTS.find(o=>o.id===id)||{}).name||'—').toUpperCase();
  const tourUserMatch=t=>t&&!t.done&&t.rounds[t.round]?t.rounds[t.round].find(m=>!m.w&&(m.a==='you'||m.b==='you')):null;
  function tourNew(format,level){
    const pool=TOUR_FIELD.slice(8).concat('you');
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    const draw=DRAW_ORDER.map(s=>s<=8?TOUR_FIELD[s-1]:pool.pop());
    const t={v:1,name:'VELVET OPEN',format,level,round:0,current:null,done:false,champion:null,out:null,rounds:[[],[],[],[]]};
    for(let i=0;i<16;i+=2)t.rounds[0].push({a:draw[i],b:draw[i+1],fa:0,fb:0,w:null});
    return t;
  }
  function simMatch(m,best){
    const need=(best+1)/2,p=1/(1+Math.exp(-((TOUR_RATING[m.a]||84)-(TOUR_RATING[m.b]||84))/7));
    m.fa=m.fb=0;
    while(m.fa<need&&m.fb<need){if(Math.random()<p)m.fa++;else m.fb++;}
    m.w=m.fa>m.fb?m.a:m.b;
  }
  // Complete the round (and, once you are out, the rest of the event).
  function tourAdvance(t){
    for(;;){
      const r=t.round;
      for(const m of t.rounds[r])if(!m.w)simMatch(m,TOUR_FORMATS[t.format].best[r]);
      if(r===3){t.champion=t.rounds[3][0].w;t.done=true;return;}
      const next=[];
      for(let i=0;i<t.rounds[r].length;i+=2)next.push({a:t.rounds[r][i].w,b:t.rounds[r][i+1].w,fa:0,fb:0,w:null});
      t.rounds[r+1]=next;t.round=r+1;
      if(next.some(m=>m.a==='you'||m.b==='you'))return;
    }
  }
  function careerAdd(stage){
    const c=careerLoad();c.events++;c.earnings+=TOUR_PRIZE[stage];
    if(stage===4)c.titles++;if(stage>=3)c.finals++;
    try{localStorage.setItem('velvet.career',JSON.stringify(c));}catch(e){}
  }
  function renderTour(t){
    const fmt=TOUR_FORMATS[t.format],um=tourUserMatch(t);
    $('tour-eyebrow').textContent=t.name+' · '+fmt.label+' FORMAT · '+(LEVELS[t.level]||LEVELS.medium).label;
    $('tour-title').innerHTML=(t.done?(t.champion==='you'?'CHAMPION':'TOURNAMENT OVER'):um?TOUR_ROUNDS[t.round]:'KNOCKED OUT')+'<span>.</span>';
    $('tour-bracket').innerHTML=TOUR_ROUNDS.map((name,r)=>{
      const list=t.rounds[r].length?t.rounds[r]:Array.from({length:8>>r},()=>({a:null,b:null}));
      return '<div class="tour-col"><h4>'+name+' · BEST OF '+fmt.best[r]+'</h4><div class="tour-list">'+list.map(m=>{
        const live=um===m&&t.current,ya=m.a==='you',showF=m.w||live;
        const row=(id,f)=>'<div class="tour-row'+(id==='you'?' you':'')+(m.w&&m.w===id?' win':m.w?' lost':'')+'"><span>'+(id?tourName(id):'—')+'</span><b>'+(showF?f:'')+'</b></div>';
        const fa=live?(ya?t.current.frames[0]:t.current.frames[1]):m.fa,fb=live?(ya?t.current.frames[1]:t.current.frames[0]):m.fb;
        return '<div class="tour-match'+(um===m?' next':'')+'">'+row(m.a,fa)+row(m.b,fb)+'</div>';}).join('')+'</div></div>';
    }).join('');
    let info;
    if(um){
      const opp=um.a==='you'?um.b:um.a,f=t.current&&t.current.frames;
      info=(f&&f[0]+f[1]?'Your match continues':'Your next match')+': '+TOUR_ROUNDS[t.round].toLowerCase()+' against '+tourName(opp)+
        ', best of '+fmt.best[t.round]+(f&&f[0]+f[1]?' · frames '+f[0]+'–'+f[1]:'')+'. Winner takes '+money(TOUR_PRIZE[4])+'.';
    }else if(t.champion==='you')info='You are the '+t.name+' champion! Prize money '+money(TOUR_PRIZE[4])+'.';
    else info='You went out in '+TOUR_EXIT[t.out]+' ('+money(TOUR_PRIZE[t.out])+'). '+(t.done?'Champion: '+tourName(t.champion)+'.':'');
    $('tour-info').textContent=info;
    $('tour-play').hidden=!um;
    if(um)$('tour-play').firstChild.textContent=t.current&&t.current.frames[0]+t.current.frames[1]?'CONTINUE MATCH ':'PLAY MATCH ';
    const c=careerLoad();
    $('tour-career').textContent='CAREER · '+c.events+' EVENT'+(c.events===1?'':'S')+' · '+c.titles+' TITLE'+(c.titles===1?'':'S')+' · '+c.finals+' FINAL'+(c.finals===1?'':'S')+' · '+money(c.earnings);
  }
  function openTournament(fromStart=false){
    let t=tourLoad();
    if(!t&&fromStart){t=tourNew(tourFormat,botLevel);tourSave(t);}
    if(!t)return;
    ['welcome-screen','menu-screen','end-screen'].forEach(id=>activeOverlay(id,false));
    renderTour(t);activeOverlay('tournament-screen',true);
  }
  // A frame of your tournament match has ended: save the score; at the end of
  // the match record the result, play out the round and update the end screen.
  function tourFrameDone(winner){
    const t=tourLoad(),um=tourUserMatch(t);
    if(!um||!state.tour||t.round!==state.tour.round)return;
    const m=state.match,ya=um.a==='you';
    if(!m.over){t.current={frames:m.frames.slice()};tourSave(t);return;}
    um.fa=ya?m.frames[0]:m.frames[1];um.fb=ya?m.frames[1]:m.frames[0];um.w=winner===0?'you':state.tour.opp;
    t.current=null;
    const r=t.round;
    if(winner!==0)t.out=r;
    tourAdvance(t);
    let line;
    if(winner===0&&t.done){line='CHAMPION! You win the '+t.name+' and '+money(TOUR_PRIZE[4])+'.';careerAdd(4);}
    else if(winner===0)line='Into '+TOUR_EXIT[t.round]+'.';
    else{line=(r===3?'Runner-up':'Out in '+TOUR_EXIT[r])+' · '+money(TOUR_PRIZE[r])+'. Champion: '+tourName(t.champion)+'.';careerAdd(r);}
    tourSave(t);
    $('end-description').textContent+=' '+line;
    $('play-again-button').firstChild.textContent='BACK TO THE DRAW ';
  }
  function tourPlay(){
    const t=tourLoad(),um=tourUserMatch(t);if(!um)return;
    const opp=um.a==='you'?um.b:um.a,best=TOUR_FORMATS[t.format].best[t.round],frames=t.current?t.current.frames.slice():[0,0];
    botOpponent=OPPONENTS.find(o=>o.id===opp)||OPPONENTS[0];botLevel=t.level;
    activeOverlay('tournament-screen',false);
    beginNewGame(false,{bestOf:best,frames,breaker:(frames[0]+frames[1])%2,over:false},'bot');
    state.tour={round:t.round,opp};
    message(TOUR_ROUNDS[t.round]+' · BEST OF '+best,'VS '+opponentFull()+(frames[0]+frames[1]?' · FRAMES '+frames[0]+'–'+frames[1]:'')+' · '+playerName(state.current)+' TO BREAK',3800);
  }
  function tourStartNote(){
    const t=tourLoad(),f=TOUR_FORMATS[tourFormat];
    document.querySelectorAll('.tformat').forEach(b=>b.classList.toggle('active',b.dataset.format===tourFormat));
    $('opponent-note').textContent='Best of '+f.best.join('–')+' · winner '+money(TOUR_PRIZE[4])+' · '+LEVELS[botLevel].label+
      (t&&!t.done?' · event in progress':'');
  }
  document.querySelectorAll('.tformat').forEach(b=>b.addEventListener('click',()=>{
    tourFormat=b.dataset.format;try{localStorage.setItem('velvet.tourFormat',tourFormat);}catch(e){}tourStartNote();}));
  $('tour-play').addEventListener('click',tourPlay);
  $('tour-menu').addEventListener('click',()=>{activeOverlay('tournament-screen',false);activeOverlay('welcome-screen',true);});
  $('tour-new').addEventListener('click',ev=>{
    const b=ev.currentTarget,t=tourLoad();
    if(t&&!t.done&&!b.dataset.sure){b.dataset.sure='1';b.textContent='CLICK AGAIN TO START OVER';
      setTimeout(()=>{delete b.dataset.sure;b.textContent='NEW TOURNAMENT';},3000);return;}
    delete b.dataset.sure;b.textContent='NEW TOURNAMENT';
    const n=tourNew(tourFormat,botLevel);tourSave(n);renderTour(n);
  });
