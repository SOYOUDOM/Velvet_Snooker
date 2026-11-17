  function spawnPeople(){
    const P=window.VelvetPeople;if(!P||!P.ready)return;
    const refTpl=P.list('referee')[0];
    if(refTpl){
      const rp=P.spawn(refTpl.name);
      // Own materials, so he can fade on his own when he blocks the view.
      rp.obj.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.castShadow=true;o.receiveShadow=true;}});
      scene.add(rp.obj);ref.person=rp;
      ref.acts={idle:rp.play('idle',{weight:1}),walk:rp.play('walk',{weight:0}),take:rp.play('take',{weight:0})};
      ref.acts.take.setLoop(T.LoopOnce,1);ref.acts.take.clampWhenFinished=true;ref.acts.take.stop();
    }
    spawnCrowd();
  }
  // Spectators for the current venue's seats, from the 'audience' characters.
  function spawnCrowd(){
    const P=window.VelvetPeople;if(!P||!P.ready)return;
    for(const c of crowd)crowdGroup.remove(c.p.obj);crowd.length=0;
    const pool=P.list('audience').filter(t=>P.canSit(t));if(!pool.length)return;
    const males=pool.filter(t=>!t.female),females=pool.filter(t=>t.female);
    const pick=(list,r)=>{let tot=0;for(const t of list)tot+=t.weight;let x=r*tot;for(const t of list){x-=t.weight;if(x<=0)return t;}return list[list.length-1];};
    let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
    for(const st of seats){
      const female=rnd()<.38,list=(female&&females.length)||!males.length?females:males,tpl=pick(list,rnd());
      const p=P.spawn(tpl.name);
      p.obj.position.set(st.x+Math.sin(st.yaw)*.05,st.y,st.z+Math.cos(st.yaw)*.05);p.obj.rotation.y=st.yaw;
      p.obj.scale.multiplyScalar(.97+rnd()*.06);
      p.obj.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
      const idle=p.clip('sit',Math.floor(rnd()*5)),t0=rnd()*30;
      crowd.push({p,yaw:st.yaw,rank:rnd(),acc:rnd()*.06,look:.3,clapAmt:0,clapTarget:0,clapStart:0,clapEnd:0,
        idle:p.play(idle,{time:t0}),body:p.play(idle,{part:'body',time:t0,weight:0}),
        clap:p.play('clap',{part:'arms',time:.4+rnd()*5,weight:0,timeScale:.95+rnd()*.2})});
      crowdGroup.add(p.obj);
    }
    applyQuality();
  }
  function startPeople(){
    const P=window.VelvetPeople,man=window.VELVET_CHARACTERS;
    if(!P||!man){console.warn('VELVET: characters/characters.js not found; playing without referee and audience.');return;}
    P.load(man).then(spawnPeople).catch(e=>console.warn('VELVET: could not load the characters',e));
  }
  function setVenue(id){
    if(!VENUES[id])return;venueId=id;
    try{localStorage.setItem('velvet.venue',id);}catch(e){}
    buildArena(VENUES[id]);spawnCrowd();
    if($('venue-select'))$('venue-select').value=id;
    refreshUI();
  }
