"""Native browser acceptance for the isolated light-table prototype."""
import json
from datetime import datetime
from pathlib import Path
from time import monotonic
from playwright.sync_api import sync_playwright
OUT=Path.home()/'.hermes/cache/scratch'/('light-table-proof-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True)
report={'checks':[],'errors':[],'console_errors':[],'input_trace':[],'physical_phone':'NOT TESTED'}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
    context=browser.new_context(viewport={'width':1440,'height':1000})
    page=context.new_page()
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.on('console',lambda m:report['console_errors'].append(m.text) if m.type=='error' else None)
    def home():
        page.goto('http://127.0.0.1:5186/',wait_until='domcontentloaded')
        page.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)')
        page.wait_for_function('document.querySelector(".table-title").getAnimations({subtree:true}).every(a=>a.playState==="finished")',polling=100)
    def entered():
        page.wait_for_function('document.querySelector(".goal-entry").dataset.phase==="open" && document.querySelector(".goal-entry .watch-presentation")',polling=100)
    def closed():
        page.wait_for_function('!document.querySelector(".goal-entry").open && document.querySelector(".watch-presentation").parentElement===document.querySelector(".watch-view")',polling=100)
    try:
        home()
        for width,height in [(1440,1000),(390,844),(320,780)]:
            page.set_viewport_size({'width':width,'height':height});page.evaluate('window.scrollTo(0,0)')
            page.wait_for_function('Number(document.querySelector(".light-table").dataset.position)===0')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.wait_for_function('document.querySelector(".watch-view").dataset.runtime==="webgl"',polling=100)
            assert page.locator('.sheet').count()==3 and page.locator('.calibre canvas').count()==0
            assert page.locator('.watch-view canvas').count()==1
            page.screenshot(path=str(OUT/f'fan-{width}.png'))
        report['checks'].append('Animated wristwatch fan at desktop and 390/320; the same watch moves into the detail')
        page.set_viewport_size({'width':1440,'height':1000})
        first=page.locator('[data-sheet="goal-loop"]').evaluate('el=>getComputedStyle(el).transform')
        page.mouse.move(750,620);page.mouse.wheel(0,410)
        page.wait_for_function('Number(document.querySelector(".light-table").dataset.position)>.2')
        assert page.locator('[data-sheet="goal-loop"]').evaluate('el=>getComputedStyle(el).transform')!=first
        page.screenshot(path=str(OUT/'dealing.png'))
        page.mouse.wheel(0,-410);page.wait_for_function('Number(document.querySelector(".light-table").dataset.position)<.01')
        page.locator('button[aria-label="Show GameOnVB"]').click()
        page.wait_for_function('Math.abs(Number(document.querySelector(".light-table").dataset.position)-1)<.01')
        page.screenshot(path=str(OUT/'gameonvb.png'))
        page.locator('button[aria-label="Show Goal Loop"]').click()
        page.wait_for_function('Number(document.querySelector(".light-table").dataset.position)<.01')
        report['checks'].append('Native forward/reverse wheel changes actual sheet pose; native navigation selects sheets')
        card=page.locator('[data-sheet="goal-loop"] .sheet')
        action=page.locator('[data-sheet="goal-loop"] .sheet-cta')
        box=card.bounding_box();page.mouse.move(box['x']+box['width']*.7,box['y']+box['height']*.5)
        assert card.evaluate('el=>parseFloat(el.style.getPropertyValue("--mx"))')!=0
        action.click();entered()
        assert page.locator('.goal-entry .watch-presentation canvas').count()==1 and page.url.endswith('#goal-loop')
        page.screenshot(path=str(OUT/'entered-1440.png'))
        first_time=float(page.locator('.watch-view').get_attribute('data-time'))
        page.wait_for_function('t=>Number(document.querySelector(".watch-view").dataset.time)>t+.3',arg=first_time)
        page.screenshot(path=str(OUT/'opened-1440.png'))
        page.evaluate('window.previousCanvas=document.querySelector(".watch-presentation canvas");window.previousViewer=document.querySelector(".watch-view").watchView')
        page.locator('.goal-entry .entry-header button').click();closed()
        assert page.evaluate('previousCanvas===document.querySelector(".watch-view canvas") && previousViewer===document.querySelector(".watch-view").watchView')
        assert page.evaluate('document.body.style.overflow')==''
        report['checks'].append('Native card entry keeps the same 3D watch, its quiet motion and identity; back restores its surface and removes scroll lock')
        action.click();page.wait_for_function('document.querySelector(".goal-entry").open')
        page.keyboard.press('Escape');closed()
        action.click();entered();page.go_back(wait_until='commit');closed();page.go_forward(wait_until='commit');entered()
        page.keyboard.press('Escape');closed()
        report['checks'].append('Interrupted entrance, Escape and actual Back/Forward remain reversible')
        page.set_viewport_size({'width':390,'height':844});page.locator('button[aria-label="Show Goal Loop"]').click()
        action.click();entered();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(OUT/'entered-390.png'))
        page.keyboard.press('Escape');closed()
        home()
        transport=context.new_cdp_session(page)
        def touch(kind,points):
            report['input_trace'].append({'stamp':monotonic(),'kind':kind,'points':points})
            transport.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':points})
        report['touch_capabilities']=page.evaluate('''() => ({width:innerWidth,height:innerHeight,touchPoints:navigator.maxTouchPoints,coarse:matchMedia('(pointer: coarse)').matches})''')
        report['touch_fixture']='Native CDP touch on desktop capabilities at mobile viewport'
        assert page.locator('.table-header a').last.get_attribute('href').startswith('mailto:')
        before=page.locator('.light-table').get_attribute('data-position')
        touch('touchStart',[{'x':170,'y':650}])
        touch('touchMove',[{'x':170,'y':300}])
        touch('touchEnd',[])
        page.wait_for_function('Number(document.querySelector(".light-table").dataset.position)>.15',polling=100)
        assert page.locator('.light-table').get_attribute('data-position')!=before
        box=page.locator('button[aria-label="Show Goal Loop"]').bounding_box()
        point={'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}
        touch('touchStart',[point])
        touch('touchEnd',[])
        page.wait_for_function('scrollY<1 && document.querySelector(".light-table").dataset.settling!=="true"',polling=100)
        box=page.locator('[data-sheet="goal-loop"] .sheet').bounding_box()
        x,y=box['x']+box['width']*.5,box['y']+box['height']*.55
        touch('touchStart',[{'x':x,'y':y}])
        touch('touchEnd',[])
        assert page.locator('dialog[open]').count()==0, 'touching a sheet must only select it'
        box=action.bounding_box();x,y=box['x']+box['width']/2,box['y']+box['height']/2
        touch('touchStart',[{'x':x,'y':y}])
        touch('touchEnd',[]);entered()
        page.keyboard.press('Escape');closed()
        report['checks'].append('Native CDP touch scroll and tap on desktop capabilities at mobile viewport; physical phone not tested')
        page.emulate_media(reduced_motion='reduce');home()
        page.screenshot(path=str(OUT/'reduced-fan.png'))
        action.focus();page.keyboard.press('Enter');entered()
        assert page.locator('.calibre canvas').count()==0
        assert page.locator('.goal-entry .watch-static').is_visible()
        page.keyboard.press('Escape');closed()
        report['checks'].append('Mobile entry, keyboard Enter and reduced-motion same-watch detail works without GPU')
        fallback=context.browser.new_context(viewport={'width':390,'height':844})
        fallback.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind.includes('webgl')?null:original.call(this,kind,...args)}")
        fallback_page=fallback.new_page()
        fallback_page.goto('http://127.0.0.1:5186/#goal-loop',wait_until='domcontentloaded')
        fallback_page.wait_for_function('document.querySelector(".goal-entry").dataset.phase==="open"',polling=100)
        assert fallback_page.locator('.calibre canvas').count()==0
        assert fallback_page.locator('.goal-entry .watch-static').is_visible()
        fallback_page.keyboard.press('Escape')
        fallback_page.wait_for_function('!document.querySelector(".goal-entry").open',polling=100)
        fallback.close()
        report['checks'].append('Direct entry and no-WebGL same-model preview remain usable, including Escape')
        assert not report['errors'],report['errors']
        assert not report['console_errors'],report['console_errors']
        report['status']='PASS'
        (OUT/'acceptance.json').write_text(json.dumps(report,indent=2))
        print(json.dumps({'status':'PASS','checks':len(report['checks']),'evidence':str(OUT)}))
    except Exception as error:
        report.update(status='FAIL',error=str(error),url=page.url)
        try:
            report['failure_state']=page.evaluate('''() => ({stamp:performance.now(),y:scrollY,viewport:{width:innerWidth,height:innerHeight},touchPoints:navigator.maxTouchPoints,coarse:matchMedia('(pointer: coarse)').matches,main:{...document.querySelector('.light-table')?.dataset},watch:{...document.querySelector('.watch-view')?.dataset},goal:{...document.querySelector('.goal-entry')?.dataset},open:Array.from(document.querySelectorAll('dialog[open]')).map(d=>d.className),overflow:document.body.style.overflow,focus:document.activeElement?.outerHTML.slice(0,240)})''')
        except Exception as diagnostic_error:report['diagnostic_error']=str(diagnostic_error)
        (OUT/'acceptance.json').write_text(json.dumps(report,indent=2));page.screenshot(path=str(OUT/'failure.png'),full_page=True)
        print(json.dumps({'status':'FAIL','error':str(error),'evidence':str(OUT)}));raise
    finally:
        context.close();browser.close()
