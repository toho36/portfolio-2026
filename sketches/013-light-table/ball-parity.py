"""The inactive/loading ball must use the same rendered model, never the old SVG."""
from pathlib import Path
from datetime import datetime
import json
from playwright.sync_api import sync_playwright
OUT=Path.home()/'.hermes/cache/scratch'/('light-table-ball-parity-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
    page=b.new_page(viewport={'width':390,'height':844})
    pending=[];pending_urls=[]
    try:
        # study statically imports the narrow scene projection helper. The
        # observed GPU prerequisite is now three.module-DXsC02Ky.js; retain
        # the content-hash glob so a rebuild cannot silently bypass this hold.
        page.route('**/assets/three.module-*.js',lambda route:(pending.append(route),pending_urls.append(route.request.url)))
        page.goto('http://127.0.0.1:5186/',wait_until='domcontentloaded')
        assert page.locator('.volleyball-view svg').count()==0
        page.locator('button[aria-label="Show GameOnVB"]').click()
        page.wait_for_function('Math.abs(Number(document.querySelector(".light-table").dataset.position)-1)<.01',polling=100)
        page.wait_for_function('document.querySelector(".ball-static").complete&&document.querySelector(".ball-static").naturalWidth>0',polling=100)
        assert page.locator('.ball-static').is_visible()
        assert page.locator('.ball-static').get_attribute('src')=='/ball-preview.png'
        page.screenshot(path=str(OUT/'loading-same-model.png'))
        assert pending,'real loader request not observed'
        pending[0].continue_();page.unroute_all(behavior='ignoreErrors')
        page.wait_for_function('document.querySelector(".volleyball-view").dataset.runtime==="webgl"',polling=100)
        page.wait_for_function('Number(document.querySelector(".volleyball-view").dataset.time)>.15',polling=100)
        page.screenshot(path=str(OUT/'live-same-model.png'))
        page.locator('button[aria-label="Show Goal Loop"]').click()
        page.wait_for_function('document.querySelector(".volleyball-view").dataset.runtime==="static"',polling=100)
        assert page.locator('.ball-static').get_attribute('src').startswith('data:image/png;'),'last native pose not preserved'
        assert page.locator('.volleyball-view canvas').count()==0
        page.screenshot(path=str(OUT/'inactive-frozen-pose.png'))
        print(json.dumps({'status':'PASS','evidence':str(OUT),'pending_urls':pending_urls}))
    finally:
        b.close()
