  // ---- TABLE & ARENA SOUND -----------------------------------------------
  // WebAudio starts only after a user gesture. The sounds come from
  // js/table-sounds.js: physically modelled ball clicks, cue strikes, cushion
  // and pocket sounds (several takes per strength), granular applause, a crowd
  // "ooh" and the arena's murmur. Each table sound is chosen by impact speed,
  // panned to where it happens on screen, and partly sent through the arena
  // reverb. The referee's voice replaces the old score and foul beeps.
  let audioBus=null,audioUnlocked=false,sfxState='',tableIn=null,ambience=null,ambTarget=-1;
  let crowdLast=-9,crowdRank=0,crowdSrc=null,voicesActive=0;
  const sfxBuf={},sfxLastAt={},SFX=window.VELVET_SFX||null;
  function ensureAudio(){
    if(!state.sound)return null;
    try{
      if(!audioContext){
        audioContext=new(window.AudioContext||window.webkitAudioContext)();
        audioBus=audioContext.createDynamicsCompressor();
        audioBus.threshold.value=-16;audioBus.knee.value=10;
        audioBus.ratio.value=3;audioBus.attack.value=.002;audioBus.release.value=.2;
        audioBus.connect(audioContext.destination);
      }
      if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
      audioUnlocked=true;
      if(!sfxState)loadSfx(audioContext);
      return audioContext;
    }catch(e){console.warn('Web Audio not available:',e);return null;}
  }
  function b64Buffer(b64){const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u.buffer;}
  async function loadSfx(ctx){
    sfxState='loading';
    if(!SFX){sfxState='none';return;}
    tableIn=ctx.createGain();
    const wet=ctx.createGain(),conv=ctx.createConvolver(),len=Math.floor(ctx.sampleRate*1.5),ir=ctx.createBuffer(2,len,ctx.sampleRate);
    for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=i<ctx.sampleRate*.011?0:(Math.random()*2-1)*Math.pow(1-i/len,4.4);}
    conv.buffer=ir;wet.gain.value=.17;
    tableIn.connect(audioBus);tableIn.connect(conv);conv.connect(wet);wet.connect(audioBus);
    await Promise.all(Object.entries(SFX.clips).map(async([k,b64])=>{
      try{sfxBuf[k]=await ctx.decodeAudioData(b64Buffer(b64));}catch(e){console.warn('VELVET sound',k,e);}
    }));
    sfxState='ready';
  }
  const soundSpot=new T.Vector3();
  // Stereo position and nearness of a table sound for the current camera.
  function soundPlace(x,z){
    if(x===undefined||x===null||!camera)return[0,1];
    soundSpot.set(x,CLOTH_Y+R,z);
    const d=camera.position.distanceTo(soundSpot);soundSpot.project(camera);
    return[clamp(soundSpot.x*.65,-.75,.75),clamp(3.4/Math.max(1,d),.5,1.3)];
  }
  function sound(type,velocity=1,x,z){
    if(!state.sound)return;
    const ctx=ensureAudio();if(!ctx||sfxState!=='ready')return;
    if(type==='score'||type==='foul')return;
    if(type==='cheer'||type==='applause'||type==='gasp'||type==='frame'){crowdSound(ctx,type);return;}
    const fam={click:'click',shot:'cue',cushion:'cushion',pocket:'pocket'}[type];if(!fam)return;
    const v=Math.max(.02,Math.abs(velocity)),now=ctx.currentTime,L=SFX.layers[fam]||[1];
    if(now-(sfxLastAt[fam]||0)<.007||voicesActive>16)return;
    sfxLastAt[fam]=now;
    let li=0;for(let i=1;i<L.length;i++)if(Math.abs(Math.log(v/L[i]))<Math.abs(Math.log(v/L[li])))li=i;
    const takes=fam==='pocket'?4:fam==='click'?3:2,buf=sfxBuf[fam+'_'+li+'_'+Math.floor(Math.random()*takes)];
    if(!buf)return;
    const [pan,near]=soundPlace(x,z);
    const strength=fam==='pocket'?.55+.45*clamp(v/1.5,0,1):Math.pow(L[li]/L[L.length-1],.6)*Math.pow(clamp(v/L[li],.25,3),.85);
    const src=ctx.createBufferSource(),g=ctx.createGain();
    src.buffer=buf;src.playbackRate.value=1+(Math.random()-.5)*.06;
    g.gain.value={click:1,cue:.6,cushion:.62,pocket:.85}[fam]*near*strength;
    src.connect(g);
    let out=g;
    if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=pan;g.connect(p);out=p;}
    out.connect(tableIn);
    voicesActive++;src.onended=()=>{voicesActive--;};
    src.start(now+.003);
  }
  // Applause and the "ooh": a bigger reaction replaces a smaller one.
  function crowdSound(ctx,type){
    const key=type==='frame'?'applause_frame':type==='cheer'?'applause_big':type==='applause'?'applause_polite':'ooh';
    const rank={ooh:1,applause_polite:2,applause_big:3,applause_frame:4}[key],now=ctx.currentTime;
    if(now-crowdLast<2.2&&rank<=crowdRank)return;
    const buf=sfxBuf[key];if(!buf)return;
    if(crowdSrc&&now-crowdLast<2.2){try{crowdSrc.g.gain.setTargetAtTime(0,now,.12);crowdSrc.s.stop(now+.6);}catch(e){}}
    crowdLast=now;crowdRank=rank;
    const s=ctx.createBufferSource(),g=ctx.createGain();
    s.buffer=buf;s.playbackRate.value=1+(Math.random()-.5)*.04;
    g.gain.value={ooh:.42,applause_polite:.32,applause_big:.42,applause_frame:.46}[key];
    s.connect(g);g.connect(audioBus);s.start(now+.05);crowdSrc={s,g};
  }
  // Arena murmur: chatter before the match and between frames, near silence
  // while a frame is in progress (as in a real arena).
  function updateAmbience(){
    if(sfxState!=='ready'||!audioContext)return;
    if(!ambience&&sfxBuf.murmur){
      const s=audioContext.createBufferSource(),g=audioContext.createGain();
      s.buffer=sfxBuf.murmur;s.loop=true;g.gain.value=0;s.connect(g);g.connect(audioBus);s.start();ambience=g;
    }
    if(!ambience)return;
    const target=!state.sound?0:(!state.started||state.finished||isAnyOverlayOpen())?.2:.02;
    if(target!==ambTarget){ambTarget=target;ambience.gain.setTargetAtTime(target,audioContext.currentTime,target>.1?.9:.5);}
  }
