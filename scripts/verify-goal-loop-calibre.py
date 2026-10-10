"""Native acceptance for the compiled portfolio /goal-loop route.
Run: python3 scripts/verify-goal-loop-calibre.py [http://127.0.0.1:5181]
Uses installed Playwright and an owned system Chrome, not the user's profile.
"""
import json
import sys
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5181').rstrip('/')
OUT = Path.home() / '.hermes/cache/scratch' / ('calibre-portfolio-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True)
STAGE = '[data-calibre="stage"]'
STATE = 'document.querySelector(".calibre").calibre.state'
report = {'base': BASE, 'checks': [], 'layouts': [], 'errors': [], 'console_errors': [], 'physical_phone': 'NOT TESTED', 'native_hidden_tab': 'NOT TESTED'}

def passed(name):
    report['checks'].append(name)

def ready(page, runtime='webgl'):
    page.wait_for_function('(runtime)=>document.querySelector("[data-calibre=stage]")?.dataset.runtime===runtime && !!document.querySelector(".calibre")?.calibre', arg=runtime, polling=100)

def settled(page):
    page.wait_for_function('!' + STATE + '.scheduled', polling=100)

def state(page):
    return page.evaluate(STATE)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless=True, ignore_default_args=['--disable-back-forward-cache'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = context.new_page()
    requested = []
    page.on('request', lambda r: requested.append(r.url))
    page.on('pageerror', lambda e: report['errors'].append(str(e)))
    page.on('console', lambda m: report['console_errors'].append(m.text) if m.type == 'error' else None)
    cdp = context.new_cdp_session(page)
    cdp.send('Network.enable'); cdp.send('Network.setCacheDisabled', {'cacheDisabled': True})
    try:
        for width, height in [(1440, 1000), (768, 1024), (390, 844), (320, 780)]:
            page.set_viewport_size({'width': width, 'height': height})
            response = page.goto(BASE + '/goal-loop', wait_until='domcontentloaded'); ready(page)
            assert response.status == 200
            assert page.title() == 'Goal Loop Run Anatomy — Hoang Viet To'
            assert page.locator('.calibre canvas').count() == 1
            assert page.locator('.run-reference').count() == 6
            assert page.locator('.run-history-row').count() == 3
            assert page.locator('.site-header').count() == 1
            assert page.locator('.site-nav [aria-current="page"]').get_attribute('href') == '/goal-loop'
            assert page.locator('.shape-and-hole').count() == 0
            geometry = page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})')
            assert geometry['scroll'] <= geometry['client'], geometry
            colors = page.evaluate('''() => {
                const root=document.querySelector('.calibre');
                const selectors=['.calibre-eyebrow','.calibre-lede','[data-calibre="motion"]','.calibre-view-strip','.calibre-part-card p','.calibre-access','.calibre-disclaimer','.calibre-capability'];
                return {background:getComputedStyle(root).backgroundColor,text:selectors.map(selector=>({selector,color:getComputedStyle(root.querySelector(selector)).color}))};
            }''')
            def luminance(rgb):
                channels = [float(v)/255 for v in rgb.removeprefix('rgb(').removesuffix(')').split(',')]
                return sum(weight*(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for weight,v in zip([.2126,.7152,.0722],channels))
            for text in colors['text']:
                ratio=(luminance(colors['background'])+.05)/(luminance(text['color'])+.05)
                assert ratio>=4.5,(width,text,ratio)
            report.setdefault('contrast',[]).append({'width':width,**colors})
            for selector in ['[data-calibre="open"]', '[data-calibre="motion"]', '[data-calibre="part"]']:
                box = page.locator(selector).bounding_box()
                assert box and box['width'] >= 44 and box['height'] >= 44, (selector, box)
            page.locator('[data-calibre="motion"]').click(); settled(page)
            page.screenshot(path=str(OUT / f'assembled-{width}.png'))
            page.locator('[data-calibre="open"]').click()
            page.wait_for_function(STATE + '.open===1', polling=100); settled(page)
            page.screenshot(path=str(OUT / f'opened-{width}.png'))
            assert state(page)['rendered']['triangles'] > 0
            report['layouts'].append(geometry)
        passed('Compiled /goal-loop renders real GPU anatomy, native opening and intact story at 1440/768/390/320px')
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.goto(BASE + '/goal-loop/', wait_until='domcontentloaded'); ready(page)
        page.wait_for_function(STATE + '.time>.08', polling=100)
        before = state(page)['time']
        page.wait_for_function('(t)=>document.querySelector(".calibre").calibre.state.time>t', arg=before + .08, polling=100)
        page.locator('[data-calibre="motion"]').click(); settled(page)
        before = state(page)
        page.wait_for_timeout(180)
        assert state(page)['frames'] == before['frames']
        passed('Trailing-slash direct load, autonomous motion and idle pause work')
        box = page.locator(STAGE).bounding_box(); x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x + 90, y + 35, steps=12); page.mouse.up(); settled(page)
        assert state(page)['camera']['position'] != before['camera']['position']
        before = state(page)['camera']; page.mouse.wheel(0, -140); settled(page)
        assert state(page)['camera'] != before
        page.locator(STAGE).focus(); before = state(page)['camera']; page.keyboard.press('ArrowRight'); settled(page)
        assert state(page)['camera'] != before
        page.locator('.calibre-access summary').click()
        page.locator('[data-zoom="1.15"]').click(); settled(page)
        page.locator('[data-calibre="reset"]').click(); settled(page)
        passed('Native drag, wheel, arrow keys and view controls operate inside React')
        page.locator('[data-calibre="open"]').click()
        page.wait_for_function(STATE + '.open>.05 && ' + STATE + '.open<1', polling=50)
        page.locator('[data-calibre="open"]').click()
        page.wait_for_function(STATE + '.open===0', polling=100); settled(page)
        page.locator('[data-calibre="part"]').select_option('balance'); settled(page)
        assert page.locator('[data-calibre="part-name"]').inner_text() == 'Balance and escapement'
        page.locator('[data-calibre="labels"]').uncheck()
        assert page.locator('[data-calibre="part-card"]').is_hidden()
        page.locator('[data-calibre="labels"]').check()
        passed('Mid-animation reversal, optional native part selection and label toggle work without a goal')
        page.locator('[data-calibre="open"]').click(); page.wait_for_function(STATE + '.open===1', polling=100); settled(page)
        before = state(page)
        page.evaluate('''window.historyEvents=[]; addEventListener('pageshow',e=>historyEvents.push(e.persisted)); addEventListener('pagehide',e=>sessionStorage.setItem('calibre-history',JSON.stringify({persisted:e.persisted,state:document.querySelector('.calibre').calibre.state})));''')
        page.goto('about:blank', wait_until='domcontentloaded'); page.go_back(wait_until='commit'); ready(page); settled(page)
        after = state(page)
        exit_record = page.evaluate('JSON.parse(sessionStorage.getItem("calibre-history"))')
        assert exit_record['persisted'] and page.evaluate('window.historyEvents.includes(true)')
        assert not after['destroyed'] and after['open'] == 1 and after['selected'] == 'balance'
        assert after['rendered']['trainAngles'] == before['rendered']['trainAngles']
        assert max(abs(a-b) for a,b in zip(after['camera']['position'], before['camera']['position'])) < 1e-6
        assert page.locator('.calibre canvas').count() == 1
        page.locator('[data-calibre="open"]').click(); page.wait_for_function(STATE + '.open===0', polling=100); settled(page)
        report['bfcache'] = {'native': True, 'before': before, 'after': after}
        page.evaluate('sessionStorage.removeItem("calibre-history")')
        passed('Native BFCache return retains assembly, part, camera, paused phase and working controls')
        for _ in range(3):
            page.evaluate('window.oldCalibre=document.querySelector(".calibre")')
            page.locator('.site-nav a[href="/playground"]').click(); page.wait_for_url('**/playground', wait_until='commit')
            assert page.evaluate('window.oldCalibre.calibre.state.destroyed && !window.oldCalibre.calibre.state.scheduled && window.oldCalibre.querySelectorAll("canvas").length===0')
            assert page.locator('.calibre').count() == 0
            page.locator('.site-nav a[href="/goal-loop"]').click(); page.wait_for_url('**/goal-loop', wait_until='commit'); ready(page)
            assert page.locator('.calibre canvas').count() == 1
        page.go_back(wait_until='commit'); page.wait_for_url('**/playground', wait_until='commit')
        page.go_forward(wait_until='commit'); ready(page)
        passed('Repeated SPA teardown/remount and browser Back/Forward leave exactly one live viewer')
        page.locator('[data-calibre="motion"]').click(); settled(page)
        page.locator('.calibre-meaning a').click(); page.wait_for_url('**#run-tape', wait_until='commit')
        page.wait_for_function('!document.querySelector(".calibre").calibre.state.scheduled', polling=100)
        assert page.locator('#run-tape').bounding_box()['y'] >= -2
        page.locator('.run-reference summary').first.click()
        assert page.locator('.run-reference').first.get_attribute('open') is not None
        passed('Existing run-trace fragment and native reference disclosures stay usable; offscreen viewer stops')
        page.emulate_media(reduced_motion='reduce'); requested.clear()
        page.goto(BASE + '/goal-loop', wait_until='domcontentloaded'); ready(page, 'static'); settled(page)
        assert not any('three.module' in u or 'OrbitControls-' in u for u in requested), requested
        assert page.locator('.calibre canvas').count() == 0
        page.locator('[data-calibre="open"]').click(); page.wait_for_function(STATE + '.open===1', polling=100); settled(page)
        page.locator('[data-calibre="part"]').select_option('train'); settled(page)
        assert page.locator('[data-calibre="part-name"]').inner_text() == 'Gear train'
        assert page.locator('[data-calibre="motion"]').is_disabled()
        page.screenshot(path=str(OUT / 'reduced-motion.png'))
        page.emulate_media(reduced_motion='no-preference'); ready(page)
        page.emulate_media(reduced_motion='reduce'); ready(page, 'static'); settled(page)
        assert state(page)['open'] == 1 and state(page)['selected'] == 'train' and page.locator('.calibre canvas').count() == 0
        passed('Cold reduced motion skips both GPU imports; live preference changes preserve anatomy and selection')
        page.emulate_media(reduced_motion='no-preference'); ready(page)
        page.evaluate('document.querySelector(".calibre canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()')
        ready(page, 'static'); settled(page)
        page.locator('[data-calibre="open"]').click(); page.wait_for_function(STATE + '.open===0', polling=100)
        assert page.locator('.calibre canvas').count() == 0
        passed('Real GPU context loss retains usable schematic and case study')
        for route in ['/', '/playground', '/gameonvb']:
            requested.clear(); page.goto(BASE + route, wait_until='domcontentloaded')
            page.wait_for_function('document.querySelector("main")!==null')
            assert page.locator('.calibre').count() == 0
            page.wait_for_timeout(250)
            assert not any('/assets/controller-' in u or 'OrbitControls-' in u for u in requested), (route, requested)
        passed('Homepage, Playground and GameOnVB do not mount or fetch the calibre runtime/OrbitControls')
        page.goto(BASE + '/goal-loop', wait_until='domcontentloaded'); ready(page)
        page.set_viewport_size({'width': 390, 'height': 844})
        page.locator('[data-calibre="motion"]').click(); settled(page)
        box = page.locator(STAGE).bounding_box(); x, y = box['x'] + box['width']*.45, box['y'] + box['height']*.45
        before = state(page)['camera']
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x+50, 'y': y+15}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); settled(page)
        assert state(page)['camera'] != before
        passed('Native emulated touch orbits on the integrated mobile route; not physical-phone proof')
        # Delay the actual production chunk, then leave through the real SPA nav.
        page.set_viewport_size({'width': 1440, 'height': 1000})
        pending_routes = []
        page.route('**/assets/OrbitControls-*.js', lambda route: pending_routes.append(route))
        page.goto(BASE + '/goal-loop', wait_until='domcontentloaded')
        page.wait_for_function('!!document.querySelector(".calibre")?.calibre', polling=100)
        page.wait_for_function('document.querySelector("[data-calibre=stage]").dataset.runtime==="static"', polling=100)
        page.wait_for_timeout(100)
        assert len(pending_routes) == 1, 'the actual delayed GPU request was not observed'
        page.evaluate('window.pendingCalibre=document.querySelector(".calibre")')
        page.locator('.site-nav a[href="/playground"]').click(); page.wait_for_url('**/playground', wait_until='commit')
        pending_routes[0].continue_()
        page.unroute_all(behavior='ignoreErrors')
        page.wait_for_timeout(200)
        assert page.evaluate('window.pendingCalibre.calibre.state.destroyed && window.pendingCalibre.querySelectorAll("canvas").length===0')
        passed('Leaving during real GPU chunk loading cannot attach a stale canvas')
        no_gpu = browser.new_context(viewport={'width':390,'height':844})
        no_gpu.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind.includes('webgl')?null:original.call(this,kind,...args)}")
        fallback_page = no_gpu.new_page()
        fallback_errors = []
        fallback_page.on('pageerror', lambda e: fallback_errors.append(str(e)))
        fallback_page.goto(BASE + '/goal-loop', wait_until='domcontentloaded'); ready(fallback_page, 'static')
        fallback_page.wait_for_function('!document.querySelector("[data-calibre=capability]").hidden', polling=100)
        fallback_page.locator('[data-calibre="open"]').click()
        fallback_page.wait_for_function(STATE + '.open===1', polling=100); settled(fallback_page)
        fallback_page.locator('[data-calibre="part"]').select_option('balance'); settled(fallback_page)
        assert fallback_page.locator('.calibre canvas').count()==0 and fallback_page.locator('.run-reference').count()==6
        assert not fallback_errors, fallback_errors
        fallback_page.screenshot(path=str(OUT/'no-webgl.png'))
        no_gpu.close()
        passed('A browser without WebGL retains real opening/inspection controls and all case-study evidence')
        assert not report['errors'], report['errors']
        assert not report['console_errors'], report['console_errors']
        report['status'] = 'PASS'
        (OUT / 'acceptance.json').write_text(json.dumps(report, indent=2))
        print(json.dumps({'status': 'PASS', 'checks': len(report['checks']), 'evidence': str(OUT), 'errors': report['errors'], 'console_errors': report['console_errors']}))
    except Exception as error:
        report.update(status='FAIL', error=str(error), url=page.url)
        (OUT / 'acceptance.json').write_text(json.dumps(report, indent=2))
        page.screenshot(path=str(OUT / 'failure.png'), full_page=True)
        print(json.dumps({'status': 'FAIL', 'error': str(error), 'evidence': str(OUT)}))
        raise
    finally:
        context.close(); browser.close()
