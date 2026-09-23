"""Browser acceptance for the real portfolio, not its disposable sketches.

python3 scripts/verify-playable-worlds.py [http://localhost:3001]
Uses existing Python Playwright and dedicated Chrome CDP at localhost:9223.
No installation, app mutation, remote product calls or personal browser profile.
"""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else 'http://localhost:3001'
OUT = Path('/tmp/portfolio-rebuild/proof')
OUT.mkdir(parents=True, exist_ok=True)
ROUTES = ['/', '/gameonvb', '/goal-loop', '/playground']
results = {'base': BASE, 'layouts': [], 'interactions': [], 'page_errors': [], 'console_errors': []}


def save():
    (OUT / 'evidence.json').write_text(json.dumps(results, indent=2))


def wait_goal_state(target, state):
    target.wait_for_function('state => document.querySelector(".shape-and-hole")?.dataset.state === state', arg=state, timeout=12000)

def advance_goal(target, state):
    model = target.locator('.shape-and-hole')
    for _ in range(8):
        if model.get_attribute('data-state') == state:
            return
        target.locator('#send').click()
    assert model.get_attribute('data-state') == state, (state, model.get_attribute('data-state'))

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:9223')
    page = browser.contexts[0].new_page()
    page.on('pageerror', lambda error: results['page_errors'].append(str(error)))
    page.on('console', lambda message: results['console_errors'].append(message.text) if message.type == 'error' else None)
    try:
        for route in ROUTES:
            for width, height in [(320, 780), (390, 844), (768, 1024), (1024, 900), (1440, 1000)]:
                page.set_viewport_size({'width': width, 'height': height})
                response = page.goto(BASE + route, wait_until='networkidle')
                assert response and response.status == 200
                layout = page.evaluate('''() => ({route:location.pathname, width:innerWidth,
                  client:document.documentElement.clientWidth, scroll:document.documentElement.scrollWidth,
                  h1:document.querySelector('h1').innerText,
                  titleRight:document.querySelector('h1').getBoundingClientRect().right,
                  canvases:document.querySelectorAll('canvas').length})''')
                assert layout['scroll'] == layout['client'], layout
                assert layout['titleRight'] <= layout['client'], layout
                assert page.locator('header').count() == 1
                assert page.locator('main').count() == 1
                assert page.locator('.site-nav a:not([aria-current])').evaluate_all('''els => els.every(el => {
                  const expected = document.createElement('span');
                  expected.style.color = getComputedStyle(el.closest('.site-shell')).getPropertyValue('--muted');
                  return getComputedStyle(el).color === expected.style.color;
                })'''), (route, 'inactive navigation ignores theme text color')
                if route not in ['/goal-loop', '/playground']:
                    assert layout['canvases'] == 0, layout
                if route == '/goal-loop':
                    assert layout['canvases'] == 0, layout
                if width == 390:
                    primary = { '/': '[aria-label="Select Goal Loop"]', '/gameonvb': '.playable-court__serve',
                                '/goal-loop': '#send', '/playground': '.field-controls button'}[route]
                    rect = page.locator(primary).bounding_box()
                    assert rect and rect['y'] + rect['height'] <= height, (route, 'primary action below fold', rect)
                if width in [390, 1440]:
                    page.screenshot(path=str(OUT / f'{route.strip("/") or "home"}-{width}.png'))
                results['layouts'].append(layout)
                save()

        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.goto(BASE, wait_until='networkidle')
        page.get_by_role('button', name='Select Goal Loop', exact=True).click()
        assert page.locator('.world-portal h2').inner_text() == 'Goal Loop'
        assert page.locator('.portal-enter').get_attribute('href') == '/goal-loop'
        page.get_by_role('button', name='Select Playground', exact=True).focus()
        page.keyboard.press('Enter')
        assert page.locator('.world-portal h2').inner_text() == 'Playground'
        page.get_by_role('button', name='Select GameOnVB', exact=True).click()
        assert page.locator('.portal-enter').get_attribute('href') == '/gameonvb'
        page.get_by_role('button', name='Swap the displays').click()
        page.wait_for_timeout(300)
        assert page.locator('.display-swap').get_attribute('data-swapped') == 'true'
        first, second = page.locator('.display-window').evaluate_all('els => els.map(el => el.getBoundingClientRect().x)')
        assert first > second
        page.get_by_role('button', name='Swap the displays').click()
        page.wait_for_timeout(300)
        first, second = page.locator('.display-window').evaluate_all('els => els.map(el => el.getBoundingClientRect().x)')
        assert first < second
        results['interactions'].append('Home: world selection by pointer and keyboard, repeated display swap')
        save()

        page.locator('.portal-enter').click()
        page.wait_for_url(BASE + '/gameonvb')
        scroll_samples = page.evaluate('''() => new Promise(resolve => {
          const samples = [];
          function sample() { samples.push(scrollY); if (samples.length === 5) resolve(samples); else requestAnimationFrame(sample); }
          sample();
        })''')
        assert all(value == 0 for value in scroll_samples), ('route entry must not inherit smooth scrolling', scroll_samples)
        assert page.locator('main').evaluate('el => el === document.activeElement')
        court = page.locator('.playable-court')
        page.locator('.playable-court__serve').click()
        page.wait_for_function("Number(document.querySelector('.playable-court').dataset.contacts) > 0", timeout=8000)
        page.keyboard.press('Escape')
        assert court.get_attribute('data-motion') == 'idle'
        page.locator('.playable-court__reset').click()
        ball = page.locator('.playable-court__ball')
        ball.hover()
        box = ball.bounding_box()
        assert box
        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        before = int(court.get_attribute('data-contacts') or 0)
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x - 100, y - 80, steps=10)
        assert court.get_attribute('data-motion') == 'dragging'
        page.mouse.up()
        page.wait_for_function('(n) => Number(document.querySelector(".playable-court").dataset.contacts) > n', arg=before, timeout=8000)
        page.wait_for_function('document.querySelector(".playable-court").dataset.motion === "idle"', timeout=15000)
        ball.focus()
        page.keyboard.press('Space')
        assert court.get_attribute('data-motion') == 'playing'
        page.keyboard.press('Escape')
        results['interactions'].append('Court: navigation focus, actual drag-release, serve, keyboard, cancel and idle settle')
        save()

        page.locator('.site-nav a[href="/goal-loop"]').click()
        page.wait_for_url(BASE + '/goal-loop')
        page.emulate_media(reduced_motion='reduce')
        model = page.locator('.shape-and-hole')
        assert page.locator('iframe').count() == 0
        advance_goal(page, 'returned')
        assert model.get_attribute('data-finding') == 'plan'
        page.locator('#repair').click()
        advance_goal(page, 'built')
        advance_goal(page, 'returned')
        assert model.get_attribute('data-finding') == 'check'
        assert page.locator('#repair').get_attribute('aria-label') == 'Fill the crack'
        assert model.get_attribute('data-repairs') == '1'
        page.locator('#repair').click()
        advance_goal(page, 'built')
        advance_goal(page, 'returned')
        assert model.get_attribute('data-finding') == 'review'
        assert model.get_attribute('data-repairs') == '2'
        page.locator('#repair').click()
        advance_goal(page, 'built')
        advance_goal(page, 'passed')
        assert model.get_attribute('data-verdict') == 'passed'
        assert page.locator('#repair-caption').get_attribute('visibility') == 'hidden'
        page.get_by_role('button', name='Reset', exact=True).click()
        advance_goal(page, 'returned')
        page.locator('#retry').click()
        wait_goal_state(page, 'blocked')
        assert model.get_attribute('data-finding') == 'plan'
        assert page.locator('#solid').get_attribute('visibility') == 'hidden'
        summary = page.locator('.run-reference summary').first
        summary.click()
        assert page.locator('.run-reference').first.get_attribute('open') is not None
        results['interactions'].append('Goal Loop: one native SVG artifact, plan/Check/Review repairs, bounded Pass and plan Block, reset and reference disclosure')
        save()

        page.emulate_media(reduced_motion='no-preference')
        page.locator('.site-nav a[href="/playground"]').click()
        page.wait_for_url(BASE + '/playground')
        page.wait_for_function('document.querySelector(".playground").dataset.systemField === "ready"', timeout=10000)
        assert page.locator('canvas').count() == 1
        scroll = page.evaluate('scrollY')
        page.get_by_role('button', name='Send a pulse').click()
        assert page.locator('.field-feedback').inner_text().startswith('A pulse')
        assert page.evaluate('scrollY') == scroll
        page.locator('.field-controls').get_by_role('link', name='Fold', exact=True).click()
        page.wait_for_function('document.querySelector(".playground").dataset.relayBeat === "relay-fold"', timeout=7000)
        page.screenshot(path=str(OUT / 'playground-fold.png'))
        page.locator('#relay-fold').get_by_role('link', name='Previous beat').click()
        page.wait_for_function('document.querySelector(".playground").dataset.relayBeat === "relay-input"', timeout=7000)
        for _ in range(3):
            page.locator('.brand').click()
            page.wait_for_url(BASE + '/')
            assert page.locator('canvas').count() == 0
            page.locator('.site-nav a[href="/playground"]').click()
            page.wait_for_function('document.querySelector(".playground").dataset.systemField === "ready"', timeout=10000)
            assert page.locator('canvas').count() == 1
        page.go_back(wait_until='networkidle')
        assert page.url.rstrip('/') == BASE
        assert page.locator('canvas').count() == 0
        results['interactions'].append('Field: real pulse without scroll change, forward/reverse shape controls, repeated route teardown and browser Back')
        save()

        page.emulate_media(reduced_motion='reduce')
        for route in ROUTES:
            page.goto(BASE + route, wait_until='networkidle')
            assert page.locator('canvas').count() == 0
        page.get_by_role('button', name='Send a pulse').click()
        assert page.locator('.playground').get_attribute('data-pulse') == 'true'
        assert page.locator('.field-feedback').inner_text().endswith('Static field mode.')
        page.goto(BASE + '/gameonvb', wait_until='networkidle')
        page.locator('.playable-court__serve').click()
        assert page.locator('.playable-court').get_attribute('data-motion') == 'idle'
        assert 'Reduced motion' in page.locator('.playable-court__status').inner_text()
        position = page.locator('.playable-court__ball').get_attribute('style')
        page.wait_for_timeout(250)
        assert page.locator('.playable-court__ball').get_attribute('style') == position
        page.goto(BASE + '/goal-loop', wait_until='networkidle')
        assert page.locator('canvas').count() == 0
        page.locator('#send').click()
        wait_goal_state(page, 'inspect-plan')
        page.locator('#send').click()
        wait_goal_state(page, 'returned')
        page.locator('#retry').click()
        wait_goal_state(page, 'blocked')
        assert page.locator('.shape-and-hole').get_attribute('data-verdict') == 'blocked'
        results['interactions'].append('Reduced motion: native Goal Loop steps block unchanged plan; other routes retain static fallback')

        touch_context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        touch_page = touch_context.new_page()
        touch_page.on('pageerror', lambda error: results['page_errors'].append(str(error)))
        try:
            touch_page.goto(BASE + '/gameonvb', wait_until='networkidle')
            touch_page.locator('.playable-court__serve').tap()
            touch_page.wait_for_function('Number(document.querySelector(".playable-court").dataset.contacts) > 0', timeout=8000)
            touch_page.locator('.playable-court__reset').tap()
            touch_ball = touch_page.locator('.playable-court__ball')
            touch_ball.scroll_into_view_if_needed()
            box = touch_ball.bounding_box()
            assert box
            x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
            before = int(touch_page.locator('.playable-court').get_attribute('data-contacts') or 0)
            cdp = touch_context.new_cdp_session(touch_page)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
            for index in range(1, 6):
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x - index * 10, 'y': y - index * 7}]})
            assert touch_page.locator('.playable-court').get_attribute('data-motion') == 'dragging'
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            touch_page.wait_for_function('(n) => Number(document.querySelector(".playable-court").dataset.contacts) > n', arg=before, timeout=8000)
            touch_page.screenshot(path=str(OUT / 'court-touch.png'))
            touch_page.emulate_media(reduced_motion='reduce')
            touch_page.goto(BASE + '/goal-loop', wait_until='networkidle')
            advance_goal(touch_page, 'returned')
            assert touch_page.locator('.shape-and-hole').get_attribute('data-finding') == 'plan'
            touch_page.locator('#repair').tap()
            advance_goal(touch_page, 'built')
            advance_goal(touch_page, 'returned')
            assert touch_page.locator('.shape-and-hole').get_attribute('data-finding') == 'check'
            touch_page.locator('#repair').tap()
            advance_goal(touch_page, 'built')
            advance_goal(touch_page, 'returned')
            assert touch_page.locator('.shape-and-hole').get_attribute('data-finding') == 'review'
            touch_page.set_viewport_size({'width': 320, 'height': 700})
            touch_page.wait_for_function("innerWidth === 320 && document.querySelector('#drawing')?.getAttribute('viewBox') === '0 0 500 520'")
            geometry = touch_page.evaluate('''() => {
              const box = selector => document.querySelector(selector).getBoundingClientRect();
              return {tableBottom: box('#table').bottom, statusTop: box('.shape-status').top,
                repairBottom: box('#repair').bottom, resetTop: box('#reset').top,
                resetBottom: box('#reset').bottom, feedbackTop: box('#feedback').top,
                scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth};
            }''')
            assert geometry['tableBottom'] < geometry['statusTop'], geometry
            assert geometry['repairBottom'] < geometry['resetTop'], geometry
            assert geometry['resetBottom'] < geometry['feedbackTop'], geometry
            assert geometry['scrollWidth'] <= geometry['viewport'], geometry
            touch_action = touch_page.locator('#send').bounding_box()
            assert touch_action and touch_action['y'] + touch_action['height'] <= 700
            results['interactions'].append('Emulated touch: court gesture, Goal Loop repairs and 320px Review geometry')
        finally:
            touch_context.close()

        fallback_context = browser.new_context(viewport={'width': 390, 'height': 844})
        fallback_context.add_init_script('''const getContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(type, ...args) {
            return type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl'
              ? null : getContext.call(this, type, ...args);
          };''')
        fallback_page = fallback_context.new_page()
        fallback_page.on('pageerror', lambda error: results['page_errors'].append(str(error)))
        try:
            fallback_page.emulate_media(reduced_motion='reduce')
            fallback_page.goto(BASE + '/goal-loop', wait_until='networkidle')
            assert fallback_page.locator('canvas').count() == 0
            advance_goal(fallback_page, 'returned')
            fallback_page.locator('#repair').click()
            advance_goal(fallback_page, 'built')
            fallback_page.goto(BASE + '/playground', wait_until='networkidle')
            fallback_page.wait_for_function('document.querySelector(".playground").dataset.systemField === "static"', timeout=10000)
            assert fallback_page.locator('canvas').count() == 0
            assert float(fallback_page.locator('.system-field-fallback').evaluate('el => getComputedStyle(el).opacity')) > 0
            fallback_page.get_by_role('button', name='Send a pulse').click()
            assert fallback_page.locator('.playground').get_attribute('data-pulse') == 'true'
            assert fallback_page.locator('.field-feedback').inner_text().endswith('Static field mode.')
            fallback_page.screenshot(path=str(OUT / 'playground-no-webgl.png'))
            results['interactions'].append('WebGL unavailable: Goal Loop native SVG plan repair and Playground static pulse remain operable, no canvas or uncaught error')
        finally:
            fallback_context.close()

        assert not results['page_errors'], results['page_errors']
        assert not results['console_errors'], results['console_errors']
        assert {row['route'] for row in results['layouts']} == set(ROUTES)
        assert len(results['layouts']) == len(ROUTES) * 5
        save()
        print(json.dumps({'base': BASE, 'layout_count': len(results['layouts']), 'interactions': results['interactions'],
                          'page_errors': results['page_errors'], 'console_errors': results['console_errors'], 'evidence': str(OUT / 'evidence.json')}, indent=2))
    finally:
        save()
        page.close()
