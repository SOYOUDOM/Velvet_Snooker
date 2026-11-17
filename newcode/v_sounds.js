  // ---- YOUR OWN SOUNDS ----
  // Any of the game's sound effects can be replaced with a file of your own
  // (MP3, WAV, OGG, M4A: whatever this browser plays): SOUNDS in the scene
  // controls. Files are kept in this browser (IndexedDB), not uploaded
  // anywhere; RESET goes back to the built-in sound. A table sound of your
  // own still follows the play (louder for a harder hit, placed left or right
  // where the ball is).
  const SOUND_SLOTS=[['click','Ball on ball'],['cue','Cue on the cue ball'],['cushion','Ball off a cushion'],['pocket','Ball into a pocket'],
    ['applause_polite','Polite applause'],['applause_big','Big applause'],['applause_frame','Applause for a frame'],['ooh','Crowd: "ooh"'],['murmur','Arena murmur (loops)']];
  const userSfx={};
  const SFX_DB='velvet-sounds';
  function sfxDb(){return new Promise((ok,no)=>{if(!window.indexedDB){no(new Error('no IndexedDB'));return;}
    const r=indexedDB.open(SFX_DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('clips');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
  async function sfxDbAll(){const db=await sfxDb();return new Promise((ok,no)=>{const out={},c=db.transaction('clips','readonly').objectStore('clips').openCursor();
    c.onsuccess=()=>{const cur=c.result;if(cur){out[cur.key]=cur.value;cur.continue();}else ok(out);};c.onerror=()=>no(c.error);});}
  async function sfxDbPut(k,v){const db=await sfxDb();return new Promise((ok,no)=>{const tx=db.transaction('clips','readwrite'),st=tx.objectStore('clips');
    if(v==null)st.delete(k);else st.put(v,k);tx.oncomplete=()=>ok();tx.onerror=()=>no(tx.error);});}
  // Your sounds, decoded once audio starts (and again whenever one is changed).
  async function loadUserSfx(ctx){
    let all={};try{all=await sfxDbAll();}catch(e){return;}
    for(const k of Object.keys(userSfx))if(!all[k])delete userSfx[k];
    for(const [k,v] of Object.entries(all)){
      if(userSfx[k]&&userSfx[k].name===v.name&&userSfx[k].buf)continue;
      try{userSfx[k]={name:v.name,buf:await ctx.decodeAudioData(v.data.slice(0))};}catch(e){userSfx[k]={name:v.name,buf:null,bad:true};}
    }
    restartAmbience();paintSounds();
  }
  const ownSfx=k=>userSfx[k]&&userSfx[k].buf||null;
  function restartAmbience(){if(ambSrc){try{ambSrc.stop();}catch(e){}ambSrc=null;ambience=null;ambTarget=-1;}}
  function paintSounds(){
    const own=SOUND_SLOTS.filter(([k])=>userSfx[k]).length;
    const b=$('sounds-button');if(b){b.textContent='SOUNDS · '+(own?own+' OF YOURS':'BUILT-IN');b.classList.toggle('active',own>0);}
    const rows=$('sounds-rows');if(!rows)return;
    if(!rows.children.length)rows.innerHTML=SOUND_SLOTS.map(([k,label])=>'<div class="sound-row" data-k="'+k+'"><span class="sound-name">'+label+'</span><span class="sound-file"></span>'+
      '<button class="sound-play" title="Listen">▶</button><label class="sound-load" title="Choose a sound file">REPLACE<input type="file" accept="audio/*" hidden></label><button class="sound-reset" title="Back to the built-in sound">RESET</button></div>').join('');
    for(const row of rows.children){const k=row.dataset.k,u=userSfx[k];
      row.querySelector('.sound-file').textContent=u?(u.bad?'CAN’T PLAY: ':'')+u.name:'BUILT-IN';row.classList.toggle('own',!!u);row.querySelector('.sound-reset').disabled=!u;}
  }
  function previewSound(k){
    const ctx=ensureAudio();if(!ctx)return message('SOUND IS OFF','TURN THE SOUND ON (THE SPEAKER, TOP RIGHT) TO LISTEN',2200);
    const L=SFX&&SFX.layers[k],buf=ownSfx(k)||sfxBuf[L?k+'_'+Math.floor(L.length/2)+'_0':k];if(!buf)return;
    const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=buf;g.gain.value=.7;s.connect(g);g.connect(audioBus);s.start();
    if(k==='murmur')s.stop(ctx.currentTime+Math.min(4,buf.duration));
  }
  async function replaceSound(k,file){
    if(!file)return;
    if(file.size>12e6){message('TOO BIG','KEEP A SOUND UNDER 12 MB',2400);return;}
    const data=await file.arrayBuffer(),ctx=ensureAudio();
    if(ctx){try{await ctx.decodeAudioData(data.slice(0));}catch(e){message('CAN’T PLAY THAT FILE','TRY AN MP3, WAV, OGG OR M4A',2600);return;}}
    try{await sfxDbPut(k,{name:file.name,type:file.type,data});}catch(e){message('COULD NOT SAVE','THIS BROWSER WOULD NOT KEEP THE FILE',2600);return;}
    delete userSfx[k];if(ctx)await loadUserSfx(ctx);else{userSfx[k]={name:file.name,buf:null};paintSounds();}
    message('SOUND REPLACED',SOUND_SLOTS.find(s=>s[0]===k)[1].toUpperCase()+' · '+file.name.toUpperCase().slice(0,40),2000);
    if(ctx)previewSound(k);
  }
  async function resetSound(k){
    try{await sfxDbPut(k,null);}catch(e){}
    delete userSfx[k];if(k==='murmur')restartAmbience();paintSounds();
  }
  $('sounds-button')?.addEventListener('click',()=>{paintSounds();activeOverlay('sounds-screen',true);const ctx=ensureAudio();if(ctx)loadUserSfx(ctx);});
  for(const id of ['close-sounds','sounds-done'])$(id)?.addEventListener('click',()=>activeOverlay('sounds-screen',false));
  $('sounds-reset-all')?.addEventListener('click',async()=>{for(const [k] of SOUND_SLOTS)if(userSfx[k])await resetSound(k);message('BUILT-IN SOUNDS','EVERY SOUND IS BACK TO THE ORIGINAL',1800);});
  $('sounds-rows')?.addEventListener('click',ev=>{const row=ev.target.closest('.sound-row');if(!row)return;
    if(ev.target.closest('.sound-play'))previewSound(row.dataset.k);
    else if(ev.target.closest('.sound-reset'))resetSound(row.dataset.k);});
  $('sounds-rows')?.addEventListener('change',ev=>{const row=ev.target.closest('.sound-row');if(row&&ev.target.files)replaceSound(row.dataset.k,ev.target.files[0]);ev.target.value='';});
  // the names show on the button even before any sound plays
  sfxDbAll().then(all=>{for(const [k,v] of Object.entries(all))if(!userSfx[k])userSfx[k]={name:v.name,buf:null};paintSounds();}).catch(()=>{});
