"""Tournament flow: start screen, a random draw of the existing players, playing and winning every round
(frames finished via the game's own finishFrame), losing, career totals,
and resuming a match after a page reload.

usage: python3 -I test_tournament.py <test index.html> [screenshot.png]
"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright

ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


def main():
    url = pathlib.Path(sys.argv[1]).resolve().as_uri()
    out, errors = {}, []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        ctx = b.new_context(viewport={'width': 1280, 'height': 800})
        pg = ctx.new_page(); pg.set_default_timeout(240000)
        pg.on('pageerror', lambda e: errors.append(str(e)))
        ready = 'window.__T && window.__T.balls && window.__T.balls.length>0'
        pg.goto(url); pg.wait_for_function(ready, timeout=120000)
        pg.evaluate("()=>['velvet.tournament','velvet.career','velvet.tourFormat'].forEach(k=>localStorage.removeItem(k))")
        pg.click('.mode[data-mode="tournament"]')
        out['start_ui'] = pg.evaluate("""()=>({box:!document.getElementById('opponent-box').hidden,
          select:getComputedStyle(document.getElementById('opponent-select')).display,
          formats:getComputedStyle(document.querySelector('.tour-format')).display,
          length:getComputedStyle(document.getElementById('length-grid')).display,
          label:document.getElementById('opponent-label').textContent})""")
        pg.click('.tformat[data-format="quick"]'); pg.click('.level[data-level="easy"]')
        out['note'] = pg.evaluate("document.getElementById('opponent-note').textContent")
        pg.click('#start-button')
        t = pg.evaluate("__T.tourLoad()")
        out['draw'] = [(m['a'], m['b']) for m in t['rounds'][0]]
        out['draw_checks'] = {'you_once': sum(1 for m in t['rounds'][0] for x in (m['a'], m['b']) if x == 'you') == 1,
                              'distinct': len({x for m in t['rounds'][0] for x in (m['a'], m['b'])}) == 16,
                              'real_players': pg.evaluate("ids=>ids.every(id=>id==='you'||__T.OPPONENTS.some(o=>o.id===id))", [x for m in t['rounds'][0] for x in (m['a'], m['b'])]),
                              'shuffled': pg.evaluate("()=>{const a=[0,1,2,3].map(()=>JSON.stringify(__T.tourNew('quick','easy').rounds[0]));return new Set(a).size>1;}"),
                              'format': t['format'], 'level': t['level']}
        if len(sys.argv) > 2:
            pg.evaluate("()=>{window.__noRender=false}"); pg.wait_for_timeout(1200)
            pg.screenshot(path=sys.argv[2]); pg.evaluate("()=>{window.__noRender=true}")

        def play_match(win):
            pg.click('#tour-play')
            pg.wait_for_function("__T.state.tour", timeout=10000)      # (a pro's own body is read first: a moment at most)
            info = pg.evaluate("""()=>({mode:__T.state.mode,tour:__T.state.tour,best:__T.state.match.bestOf,frames:__T.state.match.frames.slice(),
                name:document.getElementById('player-name-1').textContent})""")
            frames = 0
            while True:
                pg.evaluate("w=>{__T.state.scores=w?[70,12]:[12,70];__T.finishFrame(w?0:1,'test');}", win)
                frames += 1
                pg.wait_for_timeout(1600)
                end = pg.evaluate("()=>({btn:document.getElementById('play-again-button').textContent.trim(),desc:document.getElementById('end-description').textContent})")
                pg.click('#play-again-button')
                if 'DRAW' in end['btn']:
                    break
                if frames > 8:
                    break
            info['end'] = end
            info['frames_played'] = frames
            return info

        rounds = []
        for r in range(4):
            info = play_match(True)
            st = pg.evaluate("""()=>({screen:document.getElementById('tournament-screen').classList.contains('active'),
                title:document.getElementById('tour-title').textContent,info:document.getElementById('tour-info').textContent,
                play:!document.getElementById('tour-play').hidden})""")
            rounds.append({'opp': info['tour']['opp'], 'best': info['best'], 'name': info['name'], 'frames': info['frames_played'],
                           'end': info['end']['desc'][-90:], 'after': st})
        out['title_run'] = rounds
        out['career_after_title'] = pg.evaluate("JSON.parse(localStorage.getItem('velvet.career'))")
        pg.click('#tour-new')
        lose = play_match(False)
        out['knocked_out'] = {'end': lose['end']['desc'][-110:], 'title': pg.evaluate("document.getElementById('tour-title').textContent"),
                              'info': pg.evaluate("document.getElementById('tour-info').textContent"),
                              'career': pg.evaluate("JSON.parse(localStorage.getItem('velvet.career'))")}
        # Resume a best-of-3 after a reload.
        pg.evaluate("()=>document.querySelector('.tformat[data-format=standard]').click()")
        pg.click('#tour-new')
        pg.click('#tour-play')
        pg.evaluate("()=>{__T.state.scores=[70,12];__T.finishFrame(0,'test');}")
        pg.wait_for_timeout(1600)
        pg.reload(); pg.wait_for_function(ready, timeout=120000)
        pg.click('.mode[data-mode="tournament"]'); pg.click('#start-button')
        out['resume_screen'] = pg.evaluate("()=>({info:document.getElementById('tour-info').textContent,btn:document.getElementById('tour-play').textContent.trim()})")
        pg.click('#tour-play')
        out['resumed_match'] = pg.evaluate("()=>({frames:__T.state.match.frames,breaker:__T.state.match.breaker,current:__T.state.current,best:__T.state.match.bestOf})")
        out['errors'] = errors
        b.close()
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
