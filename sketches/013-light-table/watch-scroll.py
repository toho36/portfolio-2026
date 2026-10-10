"""Live recognisable watch and interruptible gentle scroll assistance."""
from pathlib import Path
from datetime import datetime
import json,time
from playwright.sync_api import sync_playwright
OUT=Path.home()/'.hermes/cache/scratch'/('light-table-watch-scroll-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True)
report={'checks':[],'errors':[],'physical_phone':'NOT TESTED'}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
    page=b.new_page(viewport={'width':1440,'height':1000})
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    def position():return float(page.locator('.light-table').get_attribute('data-position'))
    def ready():page.wait_for_function('document.querySelector(".watch-view").dataset.runtime==="webgl"',polling=100)
    def target(i):page.wait_for_function('i=>Math.abs(Number(document.querySelector(".light-table").dataset.position)-i)<.01 && document.querySelector(".light-table").dataset.settling!=="true"',arg=i,polling=100)
    try:
        page.goto('http://127.0.0.1:5186/',wait_until='domcontentloaded');ready()
        assert page.locator('.watch-view').get_attribute('data-hands')=='3'
        assert page.locator('.watch-view').get_attribute('data-markers')=='12'
        assert page.locator('.watch-view').get_attribute('data-identity')=='wristwatch'
        first=float(page.locator('.watch-view').get_attribute('data-time'))
        page.wait_for_function('t=>Number(document.querySelector(".watch-view").dataset.time)>t+.3',arg=first,polling=100)
        page.screenshot(path=str(OUT/'watch-desktop.png'))
        page.mouse.move(730,640);start=time.monotonic();page.mouse.wheel(0,280)
        page.wait_for_function('document.querySelector(".light-table").dataset.settling==="true"',polling=50)
        assert 0<position()<1
        target(1);elapsed=time.monotonic()-start
        assert .2<elapsed<1.8,('landing outside the brisk non-abrupt budget',elapsed)
        page.wait_for_timeout(400);assert abs(position()-1)<.01,'assistance advanced again without input'
        report['checks'].append('Native free wheel then brisk assisted next-card settle, no repeated skip')
        page.mouse.wheel(0,-300)
        page.wait_for_function('document.querySelector(".light-table").dataset.settling==="true"',polling=50)
        before=position();page.mouse.wheel(0,210)
        page.wait_for_function('document.querySelector(".light-table").dataset.settling!=="true"',polling=50)
        assert position()>=before-.05,'new forward input failed to interrupt reverse settling'
        target(1)
        report['checks'].append('New input interrupts and reverses settling instead of scroll jail')
        page.locator('button[aria-label="Show Goal Loop"]').click();target(0);ready()
        page.locator('[data-sheet="goal-loop"] .sheet-cta').click()
        page.wait_for_function('document.querySelector(".goal-entry").dataset.phase==="open"',polling=100)
        assert page.locator('.goal-entry .watch-presentation canvas').count()==1
        assert page.locator('.watch-view').evaluate('h=>Boolean(h.watchView)')
        page.keyboard.press('Escape');page.wait_for_function('!document.querySelector(".goal-entry").open',polling=100);ready()
        report['checks'].append('Explicit project CTA keeps the same watch alive through the dialog and return')
        for width,height in [(390,844),(320,780)]:
            page.set_viewport_size({'width':width,'height':height});page.locator('button[aria-label="Show Goal Loop"]').click();target(0);ready()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.screenshot(path=str(OUT/f'watch-{width}.png'))
        page.emulate_media(reduced_motion='reduce')
        page.wait_for_function('document.querySelector(".watch-view").dataset.runtime==="static"',polling=100)
        preview=page.locator('.watch-static');assert preview.is_visible()
        assert preview.get_attribute('src').startswith('data:image/png;'),'reduced motion lost the captured live pose'
        assert preview.evaluate('async e=>{await e.decode();const c=document.createElement("canvas");c.width=c.height=32;const ctx=c.getContext("2d");ctx.drawImage(e,0,0,32,32);return ctx.getImageData(0,0,32,32).data.some((v,i)=>i%4===3&&v>32)}'),'captured fallback is blank'
        page.locator('button[aria-label="Show GameOnVB"]').click();target(1)
        assert page.locator('.volleyball-view canvas').count()==0
        report['checks'].append('Watch recognition/mobile bounds and same-model reduced preview; instant accessible selection')
        assert not report['errors'],report['errors']
        report.update(status='PASS',settle_seconds=elapsed);(OUT/'acceptance.json').write_text(json.dumps(report,indent=2))
        print(json.dumps({'status':'PASS','checks':len(report['checks']),'evidence':str(OUT)}))
    except Exception as e:
        report.update(status='FAIL',error=str(e),position=position());(OUT/'acceptance.json').write_text(json.dumps(report,indent=2));page.screenshot(path=str(OUT/'failure.png'))
        print(json.dumps({'status':'FAIL','error':str(e),'evidence':str(OUT)}));raise
    finally:b.close()
