"""Second regression pass: two-player settings, practice re-rack, aim guide, camera on bot turn.

usage: python3 -I test_modes.py <index.html> <screens_dir>
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from test_controls import ARGS, wait_for, dock, click_spin, snap  # noqa: E402


def new_page(browser, url, mode):
    pg = browser.new_page(viewport={'width': 1440, 'height': 810}); pg.set_default_timeout(240000)
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.goto(url)
    pg.wait_for_timeout(900)
    pg.click(f'.mode[data-mode="{mode}"]')
    pg.click('#start-button')
    pg.wait_for_timeout(400)
    pg.click('#audience-toggle')
    return pg, errors


def set_power(pg, value):
    pg.evaluate(f"() => {{ const s = document.getElementById('power-slider'); s.value = {value}; s.dispatchEvent(new Event('input', {{bubbles: true}})); }}")


def shoot_and_settle(pg):
    before = pg.evaluate('__T.state.shotCount')
    pg.keyboard.press('Space')
    started = wait_for(pg, f'__T.state.shotCount > {before}', timeout=10, step=20)
    return started


def main():
    url = pathlib.Path(sys.argv[1]).resolve().as_uri()
    screens = pathlib.Path(sys.argv[2])
    out = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)

        # --- Local two player: each player keeps their own settings ---
        pg, errors = new_page(browser, url, 'versus')
        set_power(pg, 33)
        click_spin(pg, 0.70, 0.30)
        p1 = dock(pg)
        shoot_and_settle(pg)
        # While the balls run, nobody can change anything.
        set_power(pg, 90)
        pg.keyboard.press('ArrowUp')
        moving = {'dock': dock(pg), 'p1_saved': pg.evaluate('JSON.parse(JSON.stringify(__T.state.settings[0]))'),
                  'inShot': pg.evaluate('__T.state.inShot')}
        wait_for(pg, '!__T.state.inShot', timeout=90)
        tries = 0
        while pg.evaluate('__T.state.current') == 0 and tries < 3:  # player one potted; play again
            shoot_and_settle(pg)
            wait_for(pg, '!__T.state.inShot', timeout=90)
            tries += 1
        p2_start = dock(pg)
        set_power(pg, 70)
        click_spin(pg, 0.30, 0.70)
        p2_set = dock(pg)
        shoot_and_settle(pg)
        wait_for(pg, '!__T.state.inShot', timeout=90)
        tries = 0
        while pg.evaluate('__T.state.current') == 1 and tries < 3:
            shoot_and_settle(pg)
            wait_for(pg, '!__T.state.inShot', timeout=90)
            tries += 1
        p1_again = dock(pg)
        out['versus'] = {'p1_set': p1, 'while_moving': moving, 'p2_turn_start': p2_start, 'p2_set': p2_set,
                         'p1_turn_again': p1_again, 'errors': errors,
                         'settings': pg.evaluate('JSON.parse(JSON.stringify(__T.state.settings))')}
        pg.keyboard.press('r')
        pg.wait_for_timeout(200)
        out['versus']['r_reracked'] = pg.evaluate('__T.state.shotCount') == 0
        pg.close()

        # --- Practice: R still re-racks; aim guide cycles and is remembered ---
        pg, errors = new_page(browser, url, 'practice')
        shoot_and_settle(pg)
        wait_for(pg, '!__T.state.inShot', timeout=90)
        before = pg.evaluate('__T.state.shotCount')
        pg.keyboard.press('r')
        pg.wait_for_timeout(200)
        practice_rerack = pg.evaluate('__T.state.shotCount') == 0 and before > 0
        guide = []
        for _ in range(3):
            pg.click('#aim-guide-toggle')
            guide.append(pg.inner_text('#aim-guide-toggle'))
        pg.keyboard.press('g')  # FULL -> SHORT
        guide.append(pg.inner_text('#aim-guide-toggle'))
        snap(pg, str(screens / 'fixed_4_short_guide.png'))
        pg.reload()
        pg.wait_for_timeout(900)
        remembered = pg.inner_text('#aim-guide-toggle')
        out['practice'] = {'shots_before_r': before, 'r_reracked': practice_rerack,
                           'guide_cycle': guide, 'guide_after_reload': remembered, 'errors': errors}
        pg.close()

        # --- Bot turn: camera can still be orbited ---
        pg, errors = new_page(browser, url, 'bot')
        for _ in range(4):
            shoot_and_settle(pg)
            wait_for(pg, '!__T.state.inShot', timeout=90)
            if pg.evaluate('__T.state.current') == 1:
                break
        wait_for(pg, '__T.state.current === 1 && !!__T.ai.plan', timeout=20, step=30)
        box = pg.locator('#world').bounding_box()
        cx, cy = box['x'] + box['width'] * 0.55, box['y'] + box['height'] * 0.4
        pg.mouse.move(cx, cy)
        pg.mouse.down(button='right')
        pg.mouse.move(cx + 120, cy + 30, steps=6)
        pg.mouse.up(button='right')
        out['bot_turn_camera'] = {'camera_tag': pg.inner_text('#camera-tag'),
                                  'still_bot_turn': pg.evaluate('__T.state.current') == 1, 'errors': errors}
        pg.close()
        browser.close()
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
