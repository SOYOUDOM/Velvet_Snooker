"""Step 9 (VELVET 5.9): VELVET Studio support in the game.
Runs assemble8 first, then patches the assembled game for:
characters/studio.js (merged by js/studio-merge.js), each opponent's own body,
your body / player two's body, cue styles, names and nicknames, custom players
in tournaments, the plain "Frame." call and the studio's Test-in-game handoff."""
import pathlib, runpy, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
V = ROOT / 'velvet'
runpy.run_path(str(ROOT / 'tools/assemble8.py'), run_name='__main__')


def rep(text, old, new, label, count=1):
    n = text.count(old)
    if n != count:
        sys.exit(f'anchor {label!r}: found {n}, expected {count}')
    return text.replace(old, new)


js = (V / 'js/game.js').read_text()
js = rep(js, "    P.load(man).then(spawnPeople).catch(e=>console.warn('VELVET: could not load the characters',e));",
         "    const VS=window.VelvetStudio,ready=(VS&&VS.ready)||Promise.resolve();\n"
         "    ready.then(()=>P.load(man)).then(()=>{spawnPeople();if(VS&&VS.test)studioTest(VS.test);}).catch(e=>console.warn('VELVET: could not load the characters',e));",
         'studio ready')
# names
js = rep(js, "$('player-name-0').textContent=state.mode==='practice'?'YOUR SCORE':'YOU';",
         "$('player-name-0').textContent=state.mode==='practice'?'YOUR SCORE':youLabel(0,'YOU');", 'name 0')
js = rep(js, "$('player-name-1').textContent=state.mode==='practice'?'FOUL POINTS':state.mode==='bot'?opponentFull():'PLAYER TWO';",
         "$('player-name-1').textContent=state.mode==='practice'?'FOUL POINTS':state.mode==='bot'?opponentFull():youLabel(1,'PLAYER TWO');", 'name 1')
js = rep(js, "drawScoreboard([(state.mode==='versus'?'PLAYER ONE':'YOU')+fr(0),(state.mode==='practice'?'FOULS':state.mode==='bot'?opponentShort():'PLAYER TWO')+fr(1)]",
         "drawScoreboard([youLabel(0,state.mode==='versus'?'PLAYER ONE':'YOU')+fr(0),(state.mode==='practice'?'FOULS':state.mode==='bot'?opponentShort():youLabel(1,'PLAYER TWO'))+fr(1)]", 'scoreboard names')
js = rep(js, "const playerName=i=>state.mode==='bot'?(i===0?'YOU':opponentFull()):state.mode==='versus'?(i===0?'PLAYER ONE':'PLAYER TWO'):'YOU';",
         "const playerName=i=>state.mode==='bot'?(i===0?'YOU':opponentFull()):state.mode==='versus'?(i===0?youLabel(0,'PLAYER ONE'):youLabel(1,'PLAYER TWO')):'YOU';", 'playerName')
# a custom opponent has no recorded "Frame to ..." call: the referee just says "Frame."
js = rep(js, "const opponentFrameCall=()=>botOpponent.id!=='club'&&window.VELVET_VOICE&&window.VELVET_VOICE['frame_'+botOpponent.id]?'frame_'+botOpponent.id:'frameBot';",
         "const opponentFrameCall=()=>{const V=window.VELVET_VOICE||{};return botOpponent.id!=='club'&&V['frame_'+botOpponent.id]?'frame_'+botOpponent.id:botOpponent.id==='club'||!V.frame?'frameBot':'frame';};", 'frame call')
# tournaments: players you made in the studio can enter (rating decides the seeding)
js = rep(js, "  const TOUR_FIELD=['trump',", "  const TOUR_BASE=['trump',", 'tour base')
js = rep(js, "  const TOUR_RATING={trump:92,", "  const TOUR_RATING0={trump:92,", 'tour rating')
js = rep(js, "  const TOUR_FORMATS=",
         "  const tourRating=id=>{const o=OPPONENTS.find(x=>x.id===id);return o&&o.rating!=null&&!isNaN(+o.rating)?+o.rating:(TOUR_RATING0[id]||84);};\n"
         "  function tourField(shuffle=false){\n"
         "    if(shuffle){const all=OPPONENTS.filter(o=>o.id!=='club').map(o=>o.id).filter((id,k,a)=>a.indexOf(id)===k),must=all.filter(id=>OPPONENTS.find(o=>o.id===id).tour),rest=all.filter(id=>!must.includes(id));\n"
         "      for(let i=rest.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]];}\n"
         "      const f=must.concat(rest).slice(0,15);while(f.length<15)f.push(f.length?f[f.length%Math.max(1,f.length)]:'club');return f;}\n"
         "    const f=TOUR_BASE.filter(id=>OPPONENTS.some(o=>o.id===id));\n"
         "    for(const o of OPPONENTS)if(o.tour&&o.id!=='club'&&!f.includes(o.id))f.push(o.id);\n"
         "    for(const o of OPPONENTS)if(f.length<15&&o.id!=='club'&&!f.includes(o.id))f.push(o.id);\n"
         "    return f.map((id,k)=>[id,k]).sort((a,b)=>tourRating(b[0])-tourRating(a[0])||a[1]-b[1]).map(x=>x[0]).slice(0,15);\n"
         "  }\n  const TOUR_FORMATS=", 'tour field fn')
js = rep(js, "p=1/(1+Math.exp(-((TOUR_RATING[m.a]||84)-(TOUR_RATING[m.b]||84))/7));", "p=1/(1+Math.exp(-(tourRating(m.a)-tourRating(m.b))/7));", 'tour sim')
# the right bodies at the start of a match, and in the chairs when you pick an opponent
js = rep(js, "function beginNewGame(increment=false,match=null,mode=null){state.mode=mode||chosenMode;state.started=true;state.tour=null;",
         "function beginNewGame(increment=false,match=null,mode=null){state.mode=mode||chosenMode;state.started=true;state.tour=null;syncPlayerBodies();", 'bodies at start')
js = rep(js, "sel.addEventListener('change',()=>{botOpponent=OPPONENTS.find(o=>o.id===sel.value)||OPPONENTS[0];if(botOpponent.id!=='club')botLevel='veryhard';save();});",
         "sel.addEventListener('change',()=>{botOpponent=OPPONENTS.find(o=>o.id===sel.value)||OPPONENTS[0];if(botOpponent.id!=='club')botLevel='veryhard';save();if(!state.started)syncPlayerBodies();});", 'bodies on pick')
js = rep(js, "  function updateAimVisuals(){\n    guideN=0;let rings=0;", "  function updateAimVisuals(){\n    syncStrikerCue();guideN=0;let rings=0;", 'striker cue')
(V / 'js/game.js').write_text(js)

html = (V / 'index.html').read_text()
html = rep(html, '  <script defer src="characters/characters-pack.js"></script>\n',
           '  <script defer src="characters/characters-pack.js"></script>\n  <script defer src="characters/studio.js"></script>\n', 'studio data tag')
html = rep(html, '  <script defer src="js/opponents.js"></script>\n',
           '  <script defer src="js/opponents.js"></script>\n  <script defer src="js/studio-merge.js"></script>\n', 'studio merge tag')
(V / 'index.html').write_text(html)
print('step 9 ok', len(js))
