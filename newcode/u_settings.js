  // ---- PRESENTATION & AUDIO SETTINGS ---------------------------------------
  // The opening (auto: full the first time, then short; or full, short, off),
  // the walk-on before a match, reduced motion (no opening, no walk-on, no TV
  // cuts) and the audio mix: table, crowd, referee and commentary volumes.
  const prefersReduced=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)').matches:false;
  const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}};
  const lsSet=(k,v)=>{try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch(e){}};
  const reducedMotion=()=>lsGet('velvet.motion',prefersReduced?'reduced':'full')==='reduced';
  const walkOnOn=()=>!reducedMotion()&&lsGet('velvet.walkon','on')!=='off';
  const mix=(()=>{const d={table:1,crowd:1,ref:1,comm:1};try{return Object.assign(d,JSON.parse(localStorage.getItem('velvet.mix')||'{}'));}catch(e){return d;}})();
  let refIn=null,crowdGain=null;
  function crowdBus(ctx){if(!crowdGain){crowdGain=ctx.createGain();crowdGain.gain.value=mix.crowd;crowdGain.connect(audioBus);}return crowdGain;}
  function applyMix(){
    if(tableIn)tableIn.gain.value=mix.table;if(crowdGain)crowdGain.gain.value=mix.crowd;if(refIn)refIn.gain.value=mix.ref;
    if(comm.bus)comm.bus.gain.value=.85*mix.comm;lsSet('velvet.mix',JSON.stringify(mix));
  }
  function paintSettings(){
    const set=(id,txt,on)=>{const b=$(id);if(!b)return;b.textContent=txt;b.classList.toggle('active',!!on);b.setAttribute('aria-pressed',String(!!on));};
    const m=lsGet(OPEN_KEY+'.mode','auto');
    set('intro-mode','INTRO · '+m.toUpperCase(),m!=='off');
    set('walkon-toggle','WALK-ON · '+(walkOnOn()?'ON':'OFF'),walkOnOn());
    set('motion-toggle','MOTION · '+(reducedMotion()?'REDUCED':'FULL'),!reducedMotion());
    const hdOn=lsGet('velvet.hdPeople','off')==='on';
    set('hd-toggle','PEOPLE · '+(hdOn?'MPFB':'CLASSIC'),hdOn);
    for(const k of Object.keys(mix)){const r=$('mix-'+k);if(r&&+r.value!==Math.round(mix[k]*100))r.value=Math.round(mix[k]*100);}
  }
  $('intro-mode')?.addEventListener('click',()=>{const order=['auto','full','short','off'],m=lsGet(OPEN_KEY+'.mode','auto');
    const n=order[(order.indexOf(m)+1)%order.length];lsSet(OPEN_KEY+'.mode',n==='auto'?null:n);paintSettings();});
  $('walkon-toggle')?.addEventListener('click',()=>{lsSet('velvet.walkon',walkOnOn()?'off':'on');paintSettings();});
  $('motion-toggle')?.addEventListener('click',()=>{lsSet('velvet.motion',reducedMotion()?'full':'reduced');if(reducedMotion()&&tvOn)toggleTv();paintSettings();});
  $('hd-toggle')?.addEventListener('click',()=>{
    lsSet('velvet.hdPeople',lsGet('velvet.hdPeople','off')==='on'?'off':'on');paintSettings();
    if(state.started)message('PEOPLE','CHANGES WHEN YOU NEXT OPEN THE GAME',2200);else location.reload();});
  $('watch-intro')?.addEventListener('click',()=>{if(!state.started&&!cine.on)startOpening('full');else message('THE INTRO','AVAILABLE FROM THE MAIN MENU',1600);});
  for(const k of ['table','crowd','ref','comm'])$('mix-'+k)?.addEventListener('input',ev=>{mix[k]=clamp(+ev.target.value/100,0,1.5);applyMix();});
  paintSettings();
