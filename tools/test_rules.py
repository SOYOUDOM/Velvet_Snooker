import json, pathlib, sys, time
from playwright.sync_api import sync_playwright
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
SHOT = """(o) => { const T=__T, s=T.state; s.inShot=true; s.current=o.cur; const b=o.firstType?T.balls.find(x=>x.type===o.firstType&&!x.pocketed):null;
  s.shot=Object.assign({first:o.firstType||null,firstId:b?b.id:null,potted:o.potted||[],cueScratch:false,difficulty:0,angle:0,cueOrigin:[0,0],
    onTypes:T.ballsOnTypes(),onValue:o.onValue||1,freeBall:s.freeBall,clearLine:o.clear,neededSnookers:false,snapshot:T.snapshotTable(),
    touching:o.touching??null,touchingIsOn:false,closest:o.closest??1}, o.extra||{});
  for(const t of (o.potted||[])){const x=T.balls.find(y=>y.type===t&&!y.pocketed);if(x)x.pocketed=true;}
  T.resolveShot(); return {foul:s.history[0]&&s.history[0].foul, hist:s.history[0]&&s.history[0].text, cur:s.current, decision:s.decision?{chooser:s.decision.chooser,miss:s.decision.miss,free:s.decision.freeBall,value:s.decision.value}:null,
    scores:s.scores.slice(), brk:s.break, phase:s.phase, finished:s.finished, free:s.freeBall, misses:s.misses.slice()}; }"""
def run():
    out = {}
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = b.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(pathlib.Path(sys.argv[1]).resolve().as_uri()); pg.wait_for_function('window.__T', timeout=120000)
        pg.click('.length[data-best="3"]')
        pg.evaluate("document.querySelector('.mode[data-mode=bot]').click(); document.getElementById('start-button').click();")
        pg.wait_for_timeout(400)
        fresh = "() => { __T.newRack(false); const s=__T.state; s.ballInHand=false; s.current=0; s.scores=[0,0]; window.__sayLog=[]; }"
        # 1 Break calls: red then black -> "one", "eight"
        pg.evaluate(fresh)
        r1 = pg.evaluate(SHOT, {'cur': 0, 'firstType': 'red', 'potted': ['red'], 'clear': True})
        pg.evaluate("() => { __T.state.nominated='black'; }")
        r2 = pg.evaluate(SHOT, {'cur': 0, 'firstType': 'black', 'potted': ['black'], 'clear': True, 'onValue': 7})
        pg.wait_for_timeout(3500)
        out['break_calls'] = {'after_red': r1['brk'], 'after_black': r2['brk'], 'voice': pg.evaluate('window.__sayLog')}
        # 2 Foul and a miss: you hit the blue first with a clear line to a red -> bot chooses
        pg.evaluate(fresh)
        r = pg.evaluate(SHOT, {'cur': 0, 'firstType': 'blue', 'clear': True})
        pg.wait_for_timeout(2600)
        out['miss_on_you'] = {'result': r, 'bot_choice_hist': pg.evaluate('__T.state.history[0].text'), 'now_at_table': pg.evaluate('__T.state.current'), 'voice': pg.evaluate('window.__sayLog')}
        # 3 Free ball: you foul and leave the bot snookered behind the blue
        pg.evaluate(fresh)
        pg.evaluate("() => { const b=__T.balls, blue=b.find(x=>x.type==='blue'), cue=b.find(x=>x.type==='cue'); cue.x=blue.x-0.0825; cue.z=blue.z; }")
        r = pg.evaluate(SHOT, {'cur': 0, 'firstType': 'blue', 'clear': False, 'closest': 0.01})
        pg.wait_for_timeout(2600)
        out['free_ball_for_bot'] = {'result': r, 'bot_took_free_ball': pg.evaluate('__T.state.freeBall'), 'hist': pg.evaluate('__T.state.history[0].text'), 'voice': pg.evaluate('window.__sayLog')}
        # 4 The bot misses with a clear line -> your dialog offers replace; choose replace
        pg.evaluate(fresh)
        before = pg.evaluate("() => __T.cueBall().x")
        r = pg.evaluate(SHOT, {'cur': 1, 'firstType': 'pink', 'clear': True, 'extra': {}})
        dialog = pg.evaluate("() => ({open:document.getElementById('decision-screen').classList.contains('active'), buttons:[...document.querySelectorAll('#decision-buttons button')].map(b=>b.dataset.choice), eyebrow:document.getElementById('decision-eyebrow').textContent})")
        pg.evaluate("() => { __T.cueBall().x += 0.3; }")  # pretend the balls moved
        pg.click('#decision-buttons button[data-choice="replace"]')
        out['your_choice_dialog'] = {'result': r, 'dialog': dialog, 'after_replace_at_table': pg.evaluate('__T.state.current'), 'cue_restored': abs(pg.evaluate("() => __T.cueBall().x") - before) < 1e-9}
        # 5 Respotting: black spot covered by a red -> black goes to the highest free spot (pink)
        pg.evaluate(fresh)
        out['respot'] = pg.evaluate("""() => { const T=__T, b=T.balls, black=b.find(x=>x.type==='black'), red=b.find(x=>x.type==='red');
            const sp=[black.x,black.z]; red.x=sp[0]; red.z=sp[1]; black.pocketed=true; T.resPot('black'); const pink=b.find(x=>x.type==='pink');
            return {black:[+black.x.toFixed(3),+black.z.toFixed(3)], pinkSpot:[+pink.x.toFixed(3),+pink.z.toFixed(3)], onPinkSpotBecausePinkIsOnIt: false}; }""")
        # 6 Re-spotted black: scores level after the last black
        pg.evaluate(fresh)
        pg.evaluate("() => { const T=__T, s=T.state; for(const x of T.balls) if(x.type!=='cue'&&x.type!=='black') x.pocketed=true; s.phase='clearance'; s.clearanceIndex=5; s.scores=[47,40]; }")
        r = pg.evaluate(SHOT, {'cur': 1, 'firstType': 'black', 'potted': ['black'], 'clear': True, 'onValue': 7})
        pg.wait_for_timeout(1800)
        out['respotted_black'] = {'result': r, 'respotted': pg.evaluate('__T.state.respottedBlack'), 'black_on_table': pg.evaluate("() => !__T.balls.find(x=>x.type==='black').pocketed"), 'ball_in_hand': pg.evaluate('__T.state.ballInHand'), 'voice': pg.evaluate('window.__sayLog')}
        # 7 Three misses with a clear line forfeit the frame (warning after the second)
        pg.evaluate(fresh)
        pg.evaluate("() => { __T.state.misses=[2,0]; }")
        r = pg.evaluate(SHOT, {'cur': 0, 'firstType': 'blue', 'clear': True})
        pg.wait_for_timeout(3500)
        out['three_misses'] = {'result': r, 'frames': pg.evaluate('__T.state.match.frames'), 'end_title': pg.evaluate("document.getElementById('end-title').textContent"), 'voice': pg.evaluate('window.__sayLog')}
        pg.evaluate("document.getElementById('play-again-button').click()")
        # 8 Touching ball: playing into the touching red is a push foul
        pg.evaluate(fresh)
        pg.evaluate("() => { const T=__T, cue=T.cueBall(), red=T.balls.find(x=>x.type==='red'); cue.x=red.x-2*0.02625-0.0002; cue.z=red.z; T.checkTouching(); }")
        touch = pg.evaluate('__T.state.touching')
        r = pg.evaluate(SHOT, {'cur': 0, 'firstType': 'red', 'clear': True, 'extra': {'touching': touch}})
        pg.wait_for_timeout(1500)
        out['touching'] = {'detected': touch is not None, 'result': r, 'voice': pg.evaluate('window.__sayLog')}
        # 9 Best of 3: a second frame win ends the match; the bot concedes a lost frame
        pg.evaluate(fresh)
        pg.evaluate("() => { const T=__T, s=T.state; s.match.frames=[1,1]; for(const x of T.balls) if(x.type==='red') x.pocketed=true; s.phase='clearance'; s.clearanceIndex=4; s.scores=[70,10]; s.current=1; __T.ai.plan=null; }")
        pg.wait_for_timeout(2500)
        out['bot_concedes_match'] = {'finished': pg.evaluate('__T.state.finished'), 'frames': pg.evaluate('__T.state.match.frames'), 'over': pg.evaluate('__T.state.match.over'),
                                     'title': pg.evaluate("document.getElementById('end-title').textContent"), 'button': pg.evaluate("document.getElementById('play-again-button').textContent"), 'voice': pg.evaluate('window.__sayLog')}
        out['errors'] = errs
        b.close()
    print(json.dumps(out, indent=1))
run()
