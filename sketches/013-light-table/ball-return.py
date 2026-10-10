"""Native leave must ease translation home slowly while spin keeps its momentum."""
import json
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path.home()/'.hermes/cache/scratch'/('light-table-return-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
    page=b.new_page(viewport={'width':1440,'height':1000})
    def state():return page.locator('.volleyball-view').evaluate('el=>({x:Number(el.dataset.pose.split(",")[0]),y:Number(el.dataset.pose.split(",")[1]),spin:JSON.parse(el.dataset.spin)})')
    try:
        page.goto('http://127.0.0.1:5186/',wait_until='domcontentloaded')
        page.locator('button[aria-label="Show GameOnVB"]').click()
        page.wait_for_function('Math.abs(Number(document.querySelector(".light-table").dataset.position)-1)<.01',polling=100)
        page.wait_for_function('!!document.querySelector(".volleyball-view").dataset.spin',polling=100)
        box=page.locator('[data-sheet="gameonvb"] .sheet').bounding_box()
        page.mouse.move(box['x']+box['width']*.88,box['y']+box['height']*.45)
        page.wait_for_function('Number(document.querySelector(".volleyball-view").dataset.pose.split(",")[0])>.32',polling=100)
        before=state();page.mouse.move(1400,70);page.wait_for_timeout(40);early=state()
        assert early['x']>before['x']*.85,('sharp return on first frames',before,early)
        page.wait_for_timeout(400);middle=state()
        assert middle['x']>before['x']*.35 and middle['x']<early['x'],(before,early,middle)
        page.wait_for_timeout(1500);end=state()
        assert abs(end['x'])<before['x']*.1,(before,end)
        assert end['spin']['yaw']>before['spin']['yaw'],'translation return reset rotation'
        (OUT/'observations.json').write_text(json.dumps({'before':before,'early':early,'middle':middle,'end':end},indent=2))
        print(json.dumps({'status':'PASS','evidence':str(OUT)}))
    finally:b.close()
