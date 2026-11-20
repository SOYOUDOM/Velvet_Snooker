"""Build helpers for the Velvet snooker project.

usage:
  python3 -I build.py standalone <project_dir>          -> rewrites <project_dir>/Velvet_..._Standalone.html
  python3 -I build.py testcopy <project_dir> <out_dir>   -> instrumented copy for browser tests
"""
import base64
import pathlib
import shutil
import sys

STANDALONE_NAME = "Velvet_Snooker_3D_Physics_Studio_Standalone.html"
GIFS = ["crowd-applause.gif", "crowd-cheer.gif", "crowd-gasp.gif"]


def b64(path: pathlib.Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"[build] expected exactly one '{label}' anchor, found {count}")
    return text.replace(old, new)


SCRIPTS = ["js/three.bundle.js", "characters/characters.js", "characters/characters-pack.js", "js/people.js", "js/referee-voice.js", "js/commentary-voice.js", "js/opponents.js", "js/venue-previews.js", "js/studio-merge.js", "js/table-sounds.js", "js/game.js"]
# Written by VELVET Studio.html; read from beside the standalone file, so studio edits apply without a rebuild.
STUDIO_DATA = "characters/studio.js"
BLENDER_DATA = "characters/blender.js"  # written by the Blender add-on


def build_standalone(project: pathlib.Path) -> pathlib.Path:
    html = (project / "index.html").read_text(encoding="utf-8")
    css = (project / "css" / "style.css").read_text(encoding="utf-8")
    gif_uris = {name: b64(project / "assets" / name, "image/gif") for name in GIFS}
    scripts = []
    for rel in SCRIPTS:
        code = (project / rel).read_text(encoding="utf-8")
        if "</script" in code.lower():
            raise SystemExit(f"[build] {rel} contains a closing script tag; cannot inline safely")
        scripts.append(code)
        html = replace_once(html, f'  <script defer src="{rel}"></script>\n', "", f"script tag {rel}")
    html = replace_once(html, '<link rel="stylesheet" href="css/style.css" />', "<style>\n" + css + "\n</style>", "stylesheet link")
    html = replace_once(html, 'src="assets/crowd-applause.gif"', f'src="{gif_uris["crowd-applause.gif"]}"', "crowd gif img")
    html = replace_once(html, f'  <script defer src="{STUDIO_DATA}"></script>\n', "", "studio data tag")
    html = replace_once(html, f'  <script defer src="{BLENDER_DATA}"></script>\n', "", "blender data tag")
    studio_tag = f'<script src="{BLENDER_DATA}"></script>\n<script src="{STUDIO_DATA}"></script>\n'
    parts = ["<script>\n" + code + "\n</script>\n" for code in scripts]
    at = SCRIPTS.index("js/studio-merge.js")
    inline = "".join(parts[:at]) + studio_tag + "".join(parts[at:])
    html = replace_once(html, "</body>", inline + "</body>", "</body>")
    out = project / STANDALONE_NAME
    out.write_text(html, encoding="utf-8")
    return out


TEST_HOOK = (
    "  window.__T={vxObjects:()=>({OD,cloth:(clothList||[]).map(c=>{let m=0;for(let i=0;i<c.base.length;i++)m=Math.max(m,Math.abs(c.pos.array[i]-c.base[i]));return {bent:c.bent,verts:c.base.length/3,maxd:m};}),custom:customGroup?customGroup.children.length:0,repl:Object.keys(replaceGroups||{}).filter(k=>replaceGroups[k]),studio:!!(studio&&studio.on),stageScreens:stage.screens.length,trophyAt:stage.trophyAt,entrance:VENUES[venueId].entrance,seatModel:!!seatModel}),"
    "VENUES,venueInfo:()=>({id:venueId,group:!!stage.group,rig:!!stage.rig,rigVisible:!!(stage.rig&&stage.rig.visible),cycle:stage.cycle?stage.cycle.length:0,live:stage.screens.length,seats:seats.length,cut:bowlFull.length,cutouts:!!cutouts,children:arenaGroup.children.length}),"
    "faceExpr,faceOf,poseBoneFace,FACE_BONES,FACE_ARKIT,say,shotSettings,NET_CRADLES,setAutoCamera,fadePerson,replaceSound,resetSound,userSfx,commTone:tone,tipSpot,crowdReact,planPath,navField,navSolids,NAV,KIT,kitMeshes,stanceFor,cueAct,greetCrowd,snookerCount,refAvoid,agentsNow,get faces(){return faces},refVoiceLevel,get venueId(){return venueId},state,ai,arena,get balls(){return balls},cueBall,humanTurn,refreshUI,switchTurn,"
    "isAnyOverlayOpen,get time(){return time},tracePath,escapeShotFor,chooseBotShot,ref,crowd,"
    "get quality(){return quality},scene,camera,renderer,setCamera,presets,cam,render,newRack,camSet,CAM_DEFAULTS,goView,cycleView,tvAngle,resetCamera,camOrbit,camPan,camZoom,minEyeY,keepOut,get ring(){return arenaRing},screenToTable,overTable,toggleAutoTv,aimTargets,"
    "get falling(){return falling},loopNearest,resolveShot,applyDecision,finishFrame,concedeFrame,resPot,snookeredOnAll,"
    "ballsOnTypes,pointsRemaining,checkTouching,snapshotTable,simulateShot,potOptions,potChance,botSkill,LEVELS,OPPONENTS,"
    "placeCueForBot,updateCam:updateCamera,noIntro:true,updateCrowd,takeShot,potBall,updateFalling,dropTubes,railCaps,K:{FLOOR_Y,R,HX,HZ,POCKETS,TRAY_Y,CLOTH_Y},cine,rec,playReplay,startIntro,PL,replayBest,stanceFor,get falling(){return falling},TRAY_X,syncPlayerBodies,wantPlayerTpl,studioTest,startReaction,celebrate,get botOpponent(){return botOpponent},set botOpponent(v){botOpponent=v},tourField,tourRating,styleCue,cueGroup,beginNewGame,blocksView,get refFade(){return refFade},get eye(){return eye},setVenue,VENUES,get venueId(){return venueId},useEscapeHint,cleanPot,playerViewActive,tourLoad,tourSave,tourNew,openTournament,tourPlay,get sfxState(){return sfxState},get audioBus(){return audioBus},get audioCtx(){return audioContext},sfxBuf,stroke,playShot,tv,comm,stage,startOpening,opening,setPull:v=>{pullOverride=v;},tableContacts,advanceOnCloth,JAWS,travelPots,measureWindow,pocketHalf,launch,collideCore,cueStrikeState,STEP,setBot:(id,lv)=>{botOpponent=OPPONENTS.find(o=>o.id===id)||OPPONENTS[0];botLevel=lv;},get bot(){return{id:botOpponent.id,level:botLevel}}};\n"
)
SHOT_HOOK_ANCHOR = "    const lineInfo=shootLine();\n"
SHOT_HOOK = (
    "    (window.__shots=window.__shots||[]).push({byBot,current:state.current,velocity,"
    "spinX:cue.spinX,spinY:cue.spinY,wy:cue.wy});\n"
)


def build_testcopy(project: pathlib.Path, out: pathlib.Path) -> pathlib.Path:
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(project, out, ignore=shutil.ignore_patterns(STANDALONE_NAME))
    game = out / "js" / "game.js"
    js = game.read_text(encoding="utf-8")
    js = replace_once(js, "  // ---- MAIN LOOP", TEST_HOOK + "  // ---- MAIN LOOP", "main loop marker")
    js = replace_once(js, SHOT_HOOK_ANCHOR, SHOT_HOOK_ANCHOR + SHOT_HOOK, "shot hook")
    # tests can stop the clock at a moment of their choosing (window.__freezeWhen(), or __freeze) to look at it
    js = replace_once(js, "let dt=clamp((now-previousTime)/1000,0,.05);previousTime=now;time+=dt;",
                      "let dt=clamp((now-previousTime)/1000,0,.05);previousTime=now;if(window.__freezeWhen&&!window.__freeze&&window.__freezeWhen()){window.__freeze=true;window.__freezeWhen=null;}if(window.__freeze)dt=0;time+=dt;", "freeze hook")
    # tests can hold the camera on a close-up: window.__camHook(dt) runs after the game's camera
    js = replace_once(js, "resize();if(!updateCine(dt))updateCamera(dt);",
                      "resize();if(!updateCine(dt))updateCamera(dt);if(window.__camHook)window.__camHook(dt,setCineCamera);", "camera hook")
    # Software WebGL renders ~1 frame/s here; tests can skip drawing so the
    # physics and bot run in real time, and switch it back on for screenshots.
    js = replace_once(js, "    render(dt);requestAnimationFrame(frame);",
                      "    if(!window.__noRender)render(dt);requestAnimationFrame(frame);", "render call")
    js = js.replace("(() => {\n  'use strict';", "window.__noRender=true;\n(() => {\n  'use strict';", 1)
    js = replace_once(js, "if(cue&&target&&!state.shot.first)state.shot.first=target.type;",
                      "if(cue&&target&&!state.shot.first){state.shot.first=target.type;window.__firstContact={x:cue.x,z:cue.z,id:target.id,type:target.type};}",
                      "first contact hook")
    game.write_text(js, encoding="utf-8")
    return out / "index.html"


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "standalone":
        print(build_standalone(pathlib.Path(sys.argv[2])))
    elif len(sys.argv) >= 4 and sys.argv[1] == "testcopy":
        print(build_testcopy(pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])))
    else:
        raise SystemExit(__doc__)
