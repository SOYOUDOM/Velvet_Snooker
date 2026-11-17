  // ---- ESCAPE HINT: on request, once per player in each match ----------------
  // The cushion-path line is no longer drawn on its own. When you are
  // snookered you may ask (button or E) for an escape once per match: the game
  // finds one, lines you up on it and shows the white's path round the
  // cushions for that shot. The bot has the same single use of its exact
  // escape planner; its other escapes are judged by eye.
  let hintShot=-1,hintToast=-1;
  const hintActive=()=>hintShot===state.shotCount&&!state.inShot;
  const hintOwner=()=>state.mode==='bot'?0:state.current;
  function paintHint(){
    const b=$('escape-hint');if(!b)return;
    const left=(state.hints||[0,0])[hintOwner()]||0;
    const snook=state.started&&!state.finished&&!state.inShot&&humanTurn()&&!state.decision&&snookeredOnAll(ballsOnTypes());
    b.textContent='ESCAPE HINT · '+left+' LEFT';
    b.classList.toggle('active',snook&&left>0);b.classList.toggle('used',left<=0);
    if(snook&&left>0&&hintToast!==state.shotCount&&!hintActive()){
      hintToast=state.shotCount;message('YOU ARE SNOOKERED','PRESS E OR “ESCAPE HINT” FOR AN ESCAPE LINE · '+left+' LEFT THIS MATCH',3000);}
  }
  async function useEscapeHint(){
    if(!state.started||state.finished||state.inShot||!humanTurn()||state.decision)return;
    const who=hintOwner();
    if(!state.hints[who]){message('NO ESCAPE HINT LEFT','ONE PER PLAYER IN EACH MATCH',1800);return;}
    const on=ballsOnTypes();
    if(!snookeredOnAll(on)){message('YOU ARE NOT SNOOKERED','THE HINT IS KEPT FOR A SNOOKER',1800);return;}
    message('FINDING AN ESCAPE','',900);
    const key=state.shotCount,plan=await escapeShotFor(on);
    if(key!==state.shotCount||state.inShot)return;
    if(!plan){message('NO CLEAN ESCAPE FOUND','YOUR HINT IS KEPT',1800);return;}
    state.hints[who]--;hintShot=state.shotCount;
    state.aim=plan.aim;state.aimKnown=true;
    const own=shotSettings();own.power=plan.power;own.spinX=0;own.spinY=0;
    refreshUI();paintHint();
    message('ESCAPE LINE SHOWN',(plan.cushions?plan.cushions+'-CUSHION ESCAPE':'STRAIGHT ESCAPE')+' · '+state.hints[who]+' LEFT THIS MATCH',2800);
  }
  $('escape-hint')?.addEventListener('click',useEscapeHint);
