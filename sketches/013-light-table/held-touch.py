"""Native panning pointercancel must not settle before the held touch ends."""
from pathlib import Path
from datetime import datetime
import json
from playwright.sync_api import sync_playwright
OUT=Path.home()/'.hermes/cache/scratch'/('light-table-held-touch-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
    context=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page=context.new_page()
    page.add_init_script("window.touchProof=[];for(const name of ['pointercancel','touchstart','touchend'])addEventListener(name,e=>touchProof.push({name,y:scrollY}),true)")
    c=context.new_cdp_session(page)
    try:
        page.goto('http://127.0.0.1:5186/',wait_until='domcontentloaded')
        c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':170,'y':630}]})
        c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':170,'y':390}]})
        page.wait_for_function('touchProof.some(e=>e.name==="pointercancel") && scrollY>100',polling=100)
        before=page.evaluate('({y:scrollY,events:touchProof.slice(),settling:document.querySelector(".light-table").dataset.settling})')
        page.wait_for_timeout(650)
        held=page.evaluate('({y:scrollY,events:touchProof.slice(),settling:document.querySelector(".light-table").dataset.settling})')
        assert held['settling']!='true' and abs(held['y']-before['y'])<2,('assist started with finger held',before,held)
        assert not any(e['name']=='touchend' for e in held['events'])
        c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        page.wait_for_function('Math.abs(Number(document.querySelector(".light-table").dataset.position)-1)<.01 && document.querySelector(".light-table").dataset.settling!=="true"',polling=100)
        after=page.evaluate('({y:scrollY,events:touchProof.slice()})')
        (OUT/'observations.json').write_text(json.dumps({'before':before,'held':held,'after':after},indent=2))
        print(json.dumps({'status':'PASS','evidence':str(OUT)}))
    except Exception as e:
        page.screenshot(path=str(OUT/'failure.png'));print(json.dumps({'status':'FAIL','error':str(e),'evidence':str(OUT)}));raise
    finally:b.close()
