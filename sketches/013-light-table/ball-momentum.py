"""Native pointer passes must add momentum and never reset ball orientation on exit."""
import json
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path.home()/'.hermes/cache/scratch'/('light-table-momentum-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
    page=b.new_page(viewport={'width':1440,'height':1000})
    def spin():return page.locator('.volleyball-view').evaluate('el=>JSON.parse(el.dataset.spin)')
    def setup():
        page.goto('http://127.0.0.1:5186/',wait_until='domcontentloaded')
        page.locator('button[aria-label="Show GameOnVB"]').click()
        page.wait_for_function('Math.abs(Number(document.querySelector(".light-table").dataset.position)-1)<.01',polling=100)
        page.wait_for_function('!!document.querySelector(".volleyball-view").dataset.spin',polling=100)
    def pass_ball(slow=False):
        box=page.locator('.volleyball-view').bounding_box();cx=box['x']+box['width']/2;cy=box['y']+box['height']/2
        page.mouse.move(cx-box['width']*.25,cy)
        page.wait_for_timeout(40)
        if slow:
            for i in range(1,11):
                page.mouse.move(cx-box['width']*.25+box['width']*.5*i/10,cy);page.wait_for_timeout(40)
        else:page.mouse.move(cx+box['width']*.25,cy)
        page.wait_for_timeout(45)
        return spin()
    try:
        setup();slow=pass_ball(True)
        setup();fast=pass_ball(False)
        assert fast['yawSpeed']>slow['yawSpeed'],(slow,fast)
        outside=page.locator('.volleyball-view').bounding_box()
        page.mouse.move(outside['x']+outside['width']*.85,outside['y']+outside['height']*.8)
        exit_spin=spin();page.wait_for_timeout(180);coast=spin()
        assert coast['yaw']>exit_spin['yaw'] and coast['yaw']>.5,(exit_spin,coast)
        assert abs(coast['yawSpeed'])>.16
        # Re-enter on a path outside the circle, then brush in the same direction.
        box=page.locator('.volleyball-view').bounding_box();cx=box['x']+box['width']/2;cy=box['y']+box['height']/2
        page.mouse.move(cx-box['width']*.25,box['y']+box['height']*.9)
        page.mouse.move(cx-box['width']*.25,cy)
        before=spin();again=pass_ball(False)
        assert again['yawSpeed']>before['yawSpeed'],(before,again)
        page.mouse.move(1400,80);page.wait_for_timeout(200);away=spin()
        assert away['yaw']>again['yaw'],'pointer leave restored the old orientation'
        page.screenshot(path=str(OUT/'coasting-after-exit.png'))
        observations={'slow':slow,'fast':fast,'exit':exit_spin,'coast':coast,'before_repeat':before,'repeat':again,'away':away}
        (OUT/'observations.json').write_text(json.dumps(observations,indent=2))
        print(json.dumps({'status':'PASS','evidence':str(OUT)}))
    except Exception as e:
        page.screenshot(path=str(OUT/'failure.png'));print(json.dumps({'status':'FAIL','error':str(e),'evidence':str(OUT)}));raise
    finally:b.close()
