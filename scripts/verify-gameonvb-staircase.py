"""Acceptance for the integrated GameOnVB React route, not the standalone study.
Run: python3 scripts/verify-gameonvb-staircase.py [http://127.0.0.1:5181]
Uses installed Python Playwright and the existing dedicated Chrome CDP.
"""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5181').rstrip('/')
OUT = Path.home() / '.hermes/cache/scratch/gameonvb-staircase-proof'
OUT.mkdir(parents=True, exist_ok=True)
results = {'base': BASE, 'layouts': [], 'checks': [], 'errors': [], 'console_errors': [], 'expected_capability_errors': [], 'physical_phone': 'NOT TESTED'}
with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:9223')
    page = browser.contexts[0].new_page()
    transport = page.context.new_cdp_session(page)
    transport.send('Network.enable')
    transport.send('Network.setCacheDisabled', {'cacheDisabled': True})
    requested = []
    expected_context_failure = False
    page.on('request', lambda request: requested.append(request.url))
    page.on('pageerror', lambda error: results['errors'].append(str(error)))
    def console_message(message):
        if message.type != 'error': return
        expected = expected_context_failure and 'WebGLRenderer' in message.text and 'Error creating WebGL context' in message.text
        results['expected_capability_errors' if expected else 'console_errors'].append(message.text)
    page.on('console', console_message)
    def ready(runtime='webgl'):
        page.wait_for_function('value=>document.querySelector("[data-stair-root]")?.dataset.runtime===value',arg=runtime,polling=100)
    def state():
        return page.locator('[data-stair-root]').evaluate('el=>({...el.dataset})')
    def reset():
        page.locator('[data-stair-reset]').click()
    def center():
        box = page.locator('[data-stair-ball]').bounding_box()
        assert box
        return box['x']+box['width']/2,box['y']+box['height']/2
    try:
        for route in ['/', '/goal-loop', '/playground', '/gameonvb']:
            for width,height in [(320,780),(390,844),(768,1024),(1440,1000)]:
                page.set_viewport_size({'width':width,'height':height})
                requested.clear()
                response=page.goto(BASE+route,wait_until='networkidle')
                assert response and response.status==200
                assert page.locator('.site-header').count()==1 and page.locator('main').count()==1
                geometry=page.evaluate('''() => ({path:location.pathname,width:innerWidth,client:document.documentElement.clientWidth,
                    scroll:document.documentElement.scrollWidth,heading:document.querySelector('h1')?.innerText??document.querySelector('.wire-topline')?.innerText??document.title})''')
                assert geometry['scroll']==geometry['client'],geometry
                if route!='/gameonvb':
                    assert page.locator('[data-stair-root]').count()==0
                    assert not any('staircaseController' in url for url in requested),(route,requested)
                else:
                    ready()
                    assert page.locator('.staircase canvas').count()==1
                    assert page.locator('[data-lifecycle-stage]').count()==4
                    assert page.locator('.staircase-links a').evaluate_all('els=>els.every(el=>el.offsetWidth>=44&&el.offsetHeight>=44)')
                    if width in [320,390]:
                        action=page.locator('[data-stair-release]').bounding_box()
                        assert action and action['y']+action['height']<=height,action
                    page.screenshot(path=str(OUT/f'gameonvb-{width}.png'))
                results['layouts'].append(geometry)
        results['checks'].append('All four routes render; staircase chunks stay off other routes')
        page.set_viewport_size({'width':1440,'height':1000})
        page.goto(BASE+'/gameonvb',wait_until='networkidle');ready()
        first=state()['frames'];page.wait_for_timeout(250)
        assert state()['frames']==first and state()['pendingFrame']=='false'
        page.locator('[data-stair-release]').click()
        for landing in [0,1,2]:
            page.wait_for_function('i=>document.querySelector("[data-stair-root]").dataset.chapter===String(i)&&Number(document.querySelector("[data-stair-root]").dataset.floorContacts)>0',arg=landing)
            ids=page.locator('.lifecycle-stage[data-highlighted="true"]').evaluate_all('els=>els.map(el=>el.id)')
            assert ids==[['event-opens','player-registers'],['payment-matches'],['attendance-resolves']][landing]
        page.wait_for_function('document.querySelector("[data-stair-root]").dataset.mode==="idle"&&document.querySelector("[data-stair-root]").dataset.pendingFrame==="false"',timeout=20000)
        assert page.locator('[data-stair-stage]').get_attribute('data-draws')=='29'
        results['checks'].append('Three real floor landings highlight the original four-stage HTML; zero idle RAF')
        reset()
        x,y=center();page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+90,y-55,steps=15)
        held=state();assert held['mode']=='held' and float(held['x'])>-3.45
        page.keyboard.press('Escape');page.mouse.up()
        assert float(state()['x'])==-3.45 and state()['pendingFrame']=='false'
        for attempt in range(6):
            reset();x,y=center()
            page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+80,y-50,steps=12);page.mouse.up()
            page.wait_for_function('document.querySelector("[data-stair-root]").dataset.mode==="flight"')
            x,y=center();page.mouse.move(x,y);page.mouse.down()
            assert state()['mode']=='held' and state()['pendingFrame']=='false'
            page.mouse.move(x+20,y-20,steps=6);page.mouse.up()
            assert state()['mode']=='flight'
        reset()
        page.evaluate("window.stairPointer=null;document.addEventListener('pointerdown',e=>window.stairPointer=e.pointerId)")
        x,y=center();page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+90,y-55,steps=15)
        held=state()
        page.evaluate("document.querySelector('[data-stair-stage]').releasePointerCapture(window.stairPointer)")
        page.mouse.move(x+110,y-65,steps=4)
        assert state()['mode']=='held' and float(state()['x'])>=float(held['x'])
        page.mouse.up();assert state()['mode']=='flight'
        reset();x,y=center();page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+80,y-45,steps=12)
        held=state()
        page.evaluate("document.querySelector('[data-stair-stage]').releasePointerCapture(window.stairPointer);window.dropStairUp=e=>e.stopImmediatePropagation();window.dropStairClick=e=>e.stopImmediatePropagation();document.addEventListener('pointerup',window.dropStairUp,{capture:true,once:true});document.addEventListener('click',window.dropStairClick,{capture:true,once:true})")
        page.mouse.up()
        assert state()['mode']=='held'
        page.evaluate("document.removeEventListener('pointerup',window.dropStairUp,true);document.removeEventListener('click',window.dropStairClick,true)")
        x,y=center();page.mouse.move(x,y);page.mouse.down();page.keyboard.press('Escape');page.mouse.up()
        assert float(state()['x'])==float(held['x']), 'a missing release left the next catch using its stale saved pose'
        reset();page.locator('[data-stair-ball]').focus();page.keyboard.press('Space')
        assert state()['mode']=='flight'
        results['checks'].append('Native repeated throws/recatch, Escape, capture-loss and missed-release recovery, and Space work inside React')
        reset();before=state()
        page.locator('.staircase-links a').nth(2).click();page.wait_for_url('**#attendance-resolves')
        assert state()['contacts']==before['contacts'] and state()['chapter']=='0'
        page.locator('#attendance-resolves').scroll_into_view_if_needed()
        page.wait_for_function('Number(getComputedStyle(document.querySelector("#attendance-resolves")).opacity)>=.99')
        assert page.locator('#attendance-resolves').evaluate('el=>getComputedStyle(el).opacity')=='1'
        page.screenshot(path=str(OUT/'reading-story.png'))
        page.locator('.site-nav a[href="/gameonvb"]').click()
        page.goto(BASE+'/gameonvb',wait_until='networkidle');ready()
        for _ in range(3):
            page.evaluate("window.oldStair=document.querySelector('[data-stair-root]')")
            page.locator('.site-nav a[href="/goal-loop"]').click();page.wait_for_url('**/goal-loop')
            page.wait_for_function('window.oldStair.dataset.mode==="disposed"')
            assert page.evaluate('window.oldStair.querySelectorAll("canvas").length')==0
            assert page.evaluate('window.oldStair.dataset.pendingFrame')=='false'
            page.locator('.site-nav a[href="/gameonvb"]').click();page.wait_for_url('**/gameonvb');ready()
            assert page.locator('.staircase canvas').count()==1
        page.go_back(wait_until='domcontentloaded');page.wait_for_url('**/goal-loop')
        assert page.locator('[data-stair-root]').count()==0
        page.go_forward(wait_until='domcontentloaded');ready()
        page.goto(BASE+'/voleyevents/',wait_until='networkidle');ready()
        assert page.title()=='GameOnVB Match Operations — Hoang Viet To'
        results['checks'].append('Fragments read without playing; repeated React teardown, Back/Forward and legacy alias remain valid')
        page.locator('[data-stair-release]').click();page.emulate_media(reduced_motion='reduce');ready('static')
        assert page.locator('.staircase canvas').count()==0 and state()['pendingFrame']=='false'
        reset()
        for index in [1,2,0]:
            page.locator('[data-stair-release]').click()
            assert state()['chapter']==str(index) and state()['contacts']=='0'
        page.emulate_media(reduced_motion='no-preference');ready()
        assert page.locator('.staircase canvas').count()==1
        page.evaluate("document.querySelector('.staircase canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
        ready('static');page.locator('[data-stair-release]').click()
        assert page.locator('[data-lifecycle-stage]').count()==4
        results['checks'].append('Live reduced motion, instant placement, reactivation and context-loss fallback remain usable')
        page.emulate_media(reduced_motion='reduce');requested.clear()
        page.goto(BASE+'/gameonvb',wait_until='networkidle');ready('static')
        assert not any('three.module' in url for url in requested),requested
        results['checks'].append('Cold reduced-motion visit does not fetch Three')
        page.emulate_media(reduced_motion='no-preference');page.goto(BASE+'/gameonvb',wait_until='networkidle');ready()
        page.set_viewport_size({'width':390,'height':844});reset()
        x,y=center();cdp=page.context.new_cdp_session(page)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
        cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+35,'y':y-35}]})
        assert state()['mode']=='held'
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        assert state()['mode']=='flight'
        reset();expected_context_failure=True
        page.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind.includes('webgl')?null:original.call(this,kind,...args)}")
        page.goto(BASE+'/gameonvb',wait_until='networkidle');ready('static')
        page.locator('[data-stair-release]').click()
        assert state()['chapter']=='1' and state()['contacts']=='0'
        assert page.locator('.staircase canvas').count()==0 and page.locator('[data-lifecycle-stage]').count()==4
        results['checks'].append('Emulated native touch and no-WebGL placement work; not physical-phone proof')
        assert not results['errors'],results['errors']
        assert not results['console_errors'],results['console_errors']
        (OUT/'acceptance.json').write_text(json.dumps(results,indent=2))
        print(json.dumps({'status':'PASS',**results,'evidence':str(OUT)},indent=2))
    except Exception:
        page.screenshot(path=str(OUT/'failure.png'),full_page=True)
        print(json.dumps({'status':'FAIL','url':page.url,'state':page.evaluate('document.querySelector("[data-stair-root]")?.dataset'),**results},indent=2))
        raise
    finally:
        page.close()
