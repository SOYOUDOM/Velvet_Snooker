"""Headless-browser regression test for shot-control fairness.

usage: python3 -I test_controls.py <index.html> <label> [--screens <dir>]
Prints a JSON report.
"""
import json
import pathlib
import sys
import time

from playwright.sync_api import sync_playwright

ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
        "--autoplay-policy=no-user-gesture-required"]


def wait_for(pg, expr, timeout=60.0, step=80):
    end = time.time() + timeout
    while time.time() < end:
        value = pg.evaluate(expr)
        if value:
            return value
        pg.wait_for_timeout(step)
    return None


def dock(pg):
    return pg.evaluate("""() => ({
        slider: +document.getElementById('power-slider').value,
        sliderDisabled: document.getElementById('power-slider').disabled,
        powerText: document.getElementById('power-value').textContent,
        top: document.getElementById('topspin-value').textContent,
        side: document.getElementById('sidespin-value').textContent,
        owner: (document.getElementById('dock-owner')||{}).textContent || null,
        dockLocked: document.querySelector('.control-dock').classList.contains('locked'),
        hint: document.getElementById('shoot-hint').textContent
    })""")


def internal(pg):
    return pg.evaluate("""() => { const s = __T.state; return {
        current: s.current, inShot: s.inShot, shotCount: s.shotCount, scores: s.scores.slice(),
        power: s.power, spinX: s.spinX, spinY: s.spinY,
        settings: s.settings ? JSON.parse(JSON.stringify(s.settings)) : null,
        plan: __T.ai.plan ? {power: __T.ai.plan.power, spinX: __T.ai.plan.spinX, spinY: __T.ai.plan.spinY, kind: __T.ai.plan.kind} : null
    }; }""")


def snap(pg, path):
    pg.evaluate('window.__noRender = false')
    pg.wait_for_timeout(2600)
    pg.screenshot(path=path)
    pg.evaluate('window.__noRender = true')


def click_spin(pg, fx, fy):
    box = pg.locator('#spin-pad').bounding_box()
    pg.mouse.click(box['x'] + box['width'] * fx, box['y'] + box['height'] * fy)


def main():
    page_path = pathlib.Path(sys.argv[1]).resolve()
    label = sys.argv[2]
    screens = None
    if '--screens' in sys.argv:
        screens = pathlib.Path(sys.argv[sys.argv.index('--screens') + 1])
        screens.mkdir(parents=True, exist_ok=True)
    report = {'label': label, 'errors': []}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = browser.new_page(viewport={'width': 1440, 'height': 810})
        pg.on('pageerror', lambda e: report['errors'].append(str(e)))
        pg.on('console', lambda m: report['errors'].append(m.text) if m.type == 'error' else None)
        pg.goto(page_path.as_uri())
        pg.wait_for_timeout(1200)
        report['fps'] = pg.evaluate("""() => new Promise(r => { let n = 0; const t0 = performance.now();
            const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else r(Math.round(n / 2)); };
            requestAnimationFrame(tick); })""")
        pg.click('.mode[data-mode="bot"]')
        pg.click('#start-button')
        pg.wait_for_timeout(600)
        pg.click('#audience-toggle')  # fewer draw calls -> faster software rendering

        # 1. The human chooses their own settings.
        pg.evaluate("() => { const s = document.getElementById('power-slider'); s.value = 33; s.dispatchEvent(new Event('input', {bubbles: true})); }")
        click_spin(pg, 0.70, 0.30)
        report['human_settings_before'] = dock(pg)
        if screens:
            snap(pg, str(screens / f'{label}_1_your_turn.png'))

        # 2. Play until it is the bot's turn.
        for _ in range(4):
            before = pg.evaluate('__T.state.shotCount')
            pg.keyboard.press('Space')
            wait_for(pg, f'__T.state.shotCount > {before} && !__T.state.inShot', timeout=90)
            if pg.evaluate('__T.state.current') == 1:
                break
        report['bot_turn_reached'] = pg.evaluate('__T.state.current') == 1

        # 3. While the bot lines up, try every way of changing the controls.
        wait_for(pg, '__T.state.current === 1 && !!__T.ai.plan && !__T.state.inShot', timeout=30, step=40)
        report['bot_plan'] = internal(pg)['plan']
        pg.evaluate("() => { const s = document.getElementById('power-slider'); s.value = 100; s.dispatchEvent(new Event('input', {bubbles: true})); }")
        box = pg.locator('#world').bounding_box()
        pg.mouse.move(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.45)
        for _ in range(4):
            pg.mouse.wheel(0, -120)
        for _ in range(3):
            pg.keyboard.press('ArrowUp')
        click_spin(pg, 0.5, 0.06)
        report['during_bot_turn_after_tampering'] = {'dock': dock(pg), 'internal': internal(pg)}
        if screens:
            snap(pg, str(screens / f'{label}_2_bot_turn.png'))

        # 4. What did the bot actually play?
        shot = wait_for(pg, '(window.__shots||[]).find(s => s.byBot) || null', timeout=30, step=40)
        plan = report['bot_plan']
        if shot and plan:
            expected_v = 0.20 + 4.7 * (plan['power'] / 100) ** 1.23
            shot['expected_velocity_from_bot_plan'] = round(expected_v, 4)
            shot['bot_shot_matches_its_own_plan'] = (abs(shot['velocity'] - expected_v) < 1e-6
                                                     and abs(shot['spinX'] - plan['spinX']) < 1e-9
                                                     and abs(shot['spinY'] - plan['spinY']) < 1e-9)
        report['bot_shot'] = shot

        # 5. Back to the human: are their own settings restored?
        back = wait_for(pg, '__T.state.current === 0 && !__T.state.inShot && !__T.ai.plan', timeout=150)
        report['human_turn_again'] = bool(back)
        report['human_settings_after'] = dock(pg)
        if screens:
            snap(pg, str(screens / f'{label}_3_your_turn_again.png'))

        # 6. Does R re-rack in the middle of a match?
        shots_before = pg.evaluate('__T.state.shotCount')
        pg.keyboard.press('r')
        pg.wait_for_timeout(300)
        report['r_key'] = {'shotCount_before': shots_before, 'shotCount_after': pg.evaluate('__T.state.shotCount'),
                           'reracked': pg.evaluate('__T.state.shotCount') == 0 and shots_before > 0}
        browser.close()
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
