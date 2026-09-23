"""Smoke-test the disposable studies against local Vite + dedicated CDP Chrome.

Run: python3 sketches/verify.py
Requires the already-installed Python Playwright; installs nothing.
Evidence is written outside the repository, under /tmp/portfolio-studies.
"""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = 'http://localhost:3001/sketches/'
STUDIES = ['001-playable-worlds', '002-court', '003-instrument']
OUT = Path('/tmp/portfolio-studies')
OUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:9223')
    page = browser.contexts[0].new_page()
    errors = []
    console_errors = []
    failed_requests = []
    evidence = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
    page.on('requestfailed', lambda request: failed_requests.append(request.url))
    try:
        for study in STUDIES:
            for width, height in [(1440, 1000), (390, 844), (320, 780)]:
                page.set_viewport_size({'width': width, 'height': height})
                page.goto(BASE + study + '/index.html', wait_until='networkidle')
                layout = page.evaluate('''() => ({
                    width: document.documentElement.clientWidth,
                    scroll: document.documentElement.scrollWidth,
                    title: document.querySelector('h1').innerText,
                    headingRight: document.querySelector('h1').getBoundingClientRect().right
                })''')
                assert layout['scroll'] == layout['width'], (study, width, layout)
                assert layout['headingRight'] <= layout['width'], (study, width, layout)
                assert page.locator('header nav a').evaluate_all('elements => elements.every(el => el.getBoundingClientRect().width >= 44 && el.getBoundingClientRect().height >= 44)')
                page.screenshot(path=str(OUT / f'{study}-{width}.png'), full_page=True)
                evidence.append({'study': study, 'viewport': [width, height], **layout})

        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.goto(BASE + STUDIES[0] + '/index.html', wait_until='networkidle')
        page.locator('[data-choice="1"]').click()
        assert page.locator('#portal').get_attribute('data-world') == '1'
        assert (page.locator('#enter').get_attribute('href') or '').endswith('/003-instrument/')
        page.locator('#world').focus()
        page.keyboard.press('ArrowRight')
        assert page.locator('#project-title').inner_text() == 'Playground'
        assert page.locator('[data-choice="2"]').get_attribute('aria-pressed') == 'true'
        page.locator('[data-choice="0"]').click()
        assert page.locator('#project-title').inner_text() == 'VoleyEvents'
        page.mouse.move(1250, 420)
        assert '0deg' != page.locator('#portal').evaluate("el => el.style.getPropertyValue('--tilt')")
        page.screenshot(path=str(OUT / 'index-selected.png'))
        page.locator('#enter').click()
        page.wait_for_url('**/002-court/')
        assert page.locator('#serve').is_visible()

        page.locator('#serve').click()
        page.wait_for_function("Number(document.getElementById('hits').textContent) > 0", timeout=7000)
        page.screenshot(path=str(OUT / 'court-in-play.png'))
        page.locator('#reset').click()
        assert page.locator('#hits').inner_text() == '00'
        bounds = page.locator('#ball').bounding_box()
        assert bounds
        x, y = bounds['x'] + bounds['width'] / 2, bounds['y'] + bounds['height'] / 2
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x - 110, y - 60, steps=12)
        page.mouse.up()
        page.wait_for_function("Number(document.getElementById('hits').textContent) > 0", timeout=7000)
        page.wait_for_function('frame === 0', timeout=15000)
        assert page.locator('#status').inner_text() == 'Nice. Want another?'
        page.locator('#reset').click()
        page.locator('#ball').focus()
        page.keyboard.press('Enter')
        page.wait_for_function("Number(document.getElementById('hits').textContent) > 0", timeout=7000)
        page.emulate_media(reduced_motion='reduce')
        page.locator('#reset').click()
        page.locator('#serve').click()
        assert page.locator('#hits').inner_text() == '01'
        reduced_position = page.locator('#ball').get_attribute('style')
        page.wait_for_timeout(250)
        assert page.locator('#ball').get_attribute('style') == reduced_position
        page.set_viewport_size({'width': 390, 'height': 844})
        page.locator('#court').scroll_into_view_if_needed()
        page.screenshot(path=str(OUT / 'court-mobile-reduced.png'))

        page.goto(BASE + STUDIES[2] + '/index.html', wait_until='networkidle')
        page.locator('#fault').check()
        for _ in range(4):
            page.locator('#next').click()
        assert page.locator('#state').inner_text() == 'Back to repair.'
        assert page.locator('#revisions').inner_text() == 'Repair returns: 1 / 2'
        page.locator('#repair').click()
        assert not page.locator('#fault').is_checked()
        for _ in range(3):
            page.locator('#next').click()
        assert page.locator('#state').inner_text() == 'Ready for handoff.'
        assert page.locator('#next').is_disabled()
        page.locator('#previous').click()
        assert page.locator('#state').inner_text() == 'A second pair of eyes.'
        page.locator('#reset').click()
        page.locator('#fault').check()
        for _ in range(8):
            page.locator('#next').click()
        assert page.locator('#state').inner_text() == 'Stop means stop.'
        assert page.locator('#next').is_disabled()
        assert page.locator('#previous').is_disabled()
        assert page.locator('#revisions').inner_text() == 'Repair returns: 2 / 2'
        page.screenshot(path=str(OUT / 'instrument-blocked-mobile.png'), full_page=True)
        page.locator('#reset').click()
        assert page.locator('#state').inner_text() == 'Bound the work.'
        assert page.locator('#previous').is_disabled()
        assert not page.locator('#fault').is_checked()
        assert page.locator('.slot').first.evaluate("el => getComputedStyle(el, '::after').transitionDuration") == '0s'
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.emulate_media(reduced_motion='no-preference')
        page.locator('#fault').check()
        for _ in range(4):
            page.locator('#next').click()
        page.screenshot(path=str(OUT / 'instrument-repair-desktop.png'), full_page=True)
        assert not errors, errors
        assert not console_errors, console_errors
        assert not failed_requests, failed_requests
        assert {row['study'] for row in evidence} == set(STUDIES)
        result = {'studies_verified': sorted(set(row['study'] for row in evidence)),
                  'layouts': evidence,
                  'interactions': ['index pointer selection, keyboard range, preview navigation',
                                   'court serve, reset, real drag-release, keyboard, reduced-motion placement',
                                   'instrument repair, pass, rewind, bounded block, reset, reduced motion'],
                  'page_errors': errors, 'console_errors': console_errors,
                  'failed_requests': failed_requests}
        (OUT / 'evidence.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result, indent=2))
    finally:
        page.close()
