"""Real WebGL mesh, transparent pixels, responsive bounds and pointer-rotation proof."""
from pathlib import Path
from datetime import datetime
import json
from playwright.sync_api import sync_playwright
OUT=Path.home()/'.hermes/cache/scratch'/('light-table-ball3d-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True)
report={'checks':[],'errors':[],'console_errors':[],'physical_phone':'NOT TESTED'}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
    page=browser.new_page()
    requested=[]
    page.on('request',lambda r:requested.append(r.url))
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.on('console',lambda m:report['console_errors'].append(m.text) if m.type=='error' else None)
    def ready():page.wait_for_function('document.querySelector(".volleyball-view").dataset.runtime==="webgl"',polling=100)
    def settled():page.wait_for_function('Number(document.querySelector(".volleyball-view").dataset.time)>.1',polling=100)
    try:
        for width,height in [(1440,1000),(1000,900),(768,1024),(760,900),(390,844),(320,780)]:
            page.set_viewport_size({'width':width,'height':height})
            page.goto('http://127.0.0.1:5186/',wait_until='domcontentloaded')
            page.locator('button[aria-label="Show GameOnVB"]').click()
            page.wait_for_function('Math.abs(Number(document.querySelector(".light-table").dataset.position)-1)<.01',polling=100)
            ready();settled()
            assert page.locator('[data-sheet="gameonvb"] img:not(.ball-static)').count()==0
            assert page.locator('.ball-static').get_attribute('alt')=='Static render of the same volleyball model'
            assert page.locator('.volleyball-view').get_attribute('data-texture-size')=='1024'
            assert page.locator('.volleyball-view canvas').count()==1
            assert page.locator('.volleyball-view').get_attribute('data-panels')=='18'
            assert int(page.locator('.volleyball-view').get_attribute('data-triangles'))>10000
            assert page.evaluate('document.querySelector(".volleyball-view").ballView.alphaCorners()')==[0,0,0,0]
            box=page.locator('[data-sheet="gameonvb"] .sheet').bounding_box()
            poses=[]
            for label,fx,fy in [('center',.5,.5),('upper-left',.1,.1),('upper-right',.9,.1),('lower-left',.1,.9),('lower-right',.9,.9)]:
                page.mouse.move(box['x']+box['width']*fx,box['y']+box['height']*fy);page.wait_for_timeout(180)
                values=page.locator('.volleyball-view').evaluate('el=>({width:el.clientWidth,height:el.clientHeight,diameter:Number(el.dataset.diameter),pose:el.dataset.pose,motion:JSON.parse(el.dataset.motion),triangles:el.dataset.triangles})')
                assert values['diameter']<min(values['width'],values['height'])-10,values
                assert (abs(values['motion']['position'][0])+1)*values['diameter']<values['width']-4,values
                assert (abs(values['motion']['position'][1])+1)*values['diameter']<values['height']-4,values
                poses.append(values['pose']);report['checks'].append({'viewport':width,'pointer':label,**values})
            assert len(set(poses))>1,('pointer did not rotate real mesh',width,poses)
            if width in [1440,390,320]:page.screenshot(path=str(OUT/f'ball3d-{width}.png'))
        assert not any('volleyball.jpg' in u for u in requested)
        before=page.locator('.volleyball-view').get_attribute('data-motion')
        clock=float(page.locator('.volleyball-view').get_attribute('data-time'))
        page.wait_for_function('t=>Number(document.querySelector(".volleyball-view").dataset.time)>t+.4',arg=clock,polling=100)
        assert page.locator('.volleyball-view').get_attribute('data-motion')!=before,'ball has no idle drift/spin'
        page.evaluate('window.oldBall=document.querySelector(".volleyball-view")')
        page.locator('button[aria-label="Show Goal Loop"]').click()
        page.wait_for_function('window.oldBall.querySelectorAll("canvas").length===0 && window.oldBall.dataset.pendingFrame==="false"',polling=100)
        page.wait_for_function('Number(document.querySelector(".light-table").dataset.position)<.01',polling=100)
        page.emulate_media(reduced_motion='reduce')
        page.locator('button[aria-label="Show GameOnVB"]').click()
        page.wait_for_function('Math.abs(Number(document.querySelector(".light-table").dataset.position)-1)<.01',polling=100)
        assert page.locator('.volleyball-view canvas').count()==0 and page.locator('.ball-static').is_visible()
        assert page.get_by_role('img',name='Volleyball preview',exact=True).count()==1,'static alternative has a misleading 3D accessible name'
        page.emulate_media(reduced_motion='no-preference');ready();settled()
        page.evaluate('document.querySelector(".volleyball-view canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()')
        page.wait_for_function('document.querySelector(".volleyball-view").dataset.runtime==="static"',polling=100)
        assert page.locator('.volleyball-view canvas').count()==0 and page.locator('.ball-static').is_visible()
        assert page.get_by_role('img',name='Volleyball preview',exact=True).count()==1,'context loss retained a misleading 3D accessible name'
        assert not report['errors'],report['errors'];assert not report['console_errors'],report['console_errors']
        report['status']='PASS';(OUT/'acceptance.json').write_text(json.dumps(report,indent=2))
        print(json.dumps({'status':'PASS','mesh_bound_checks':len(report['checks']),'evidence':str(OUT),'errors':report['errors']}))
    except Exception as e:
        report.update(status='FAIL',error=str(e));(OUT/'acceptance.json').write_text(json.dumps(report,indent=2));page.screenshot(path=str(OUT/'failure.png'))
        print(json.dumps({'status':'FAIL','error':str(e),'evidence':str(OUT)}));raise
    finally:
        browser.close()
