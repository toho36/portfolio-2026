"""Native regression: sheet selection must not navigate; only project CTA does."""
import json
from pathlib import Path
from datetime import datetime
from playwright.sync_api import sync_playwright
URL='http://127.0.0.1:5186/'
OUT=Path.home()/'.hermes/cache/scratch'/('light-table-actions-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1000})
    try:
        page.goto(URL,wait_until='domcontentloaded')
        page.wait_for_function('Array.from(document.images).every(i=>i.complete)')
        point=page.evaluate('''() => {
            const element=document.querySelector('[data-sheet="gameonvb"] .sheet'),b=element.getBoundingClientRect();
            for(let y=Math.max(80,b.top+8);y<Math.min(innerHeight-90,b.bottom);y+=10)
                for(let x=Math.max(0,b.left+8);x<Math.min(innerWidth,b.right);x+=10)
                    if(document.elementFromPoint(x,y)?.closest('.sheet')?.closest('[data-sheet]')?.dataset.sheet==='gameonvb')return {x,y};
            throw new Error('No visible GameOnVB selection surface');
        }''')
        page.mouse.click(point['x'],point['y'])

        assert page.url==URL, 'clicking the second sheet navigated instead of selecting'
        page.wait_for_function('Math.abs(Number(document.querySelector(".light-table").dataset.position)-1)<.01',polling=100)
        assert page.locator('dialog[open]').count()==0
        action=page.locator('[data-sheet="gameonvb"] .sheet-cta')
        assert action.is_visible() and action.get_attribute('href')=='#gameonvb'
        page.screenshot(path=str(OUT/'selected-second.png'))
        action.click();page.wait_for_url('**/#gameonvb',wait_until='commit')
        page.wait_for_function('document.querySelector(".ball-entry").dataset.phase==="open"')
        assert page.locator('.ball-entry .entry-header a').get_attribute('href')=='http://127.0.0.1:5181/gameonvb'
        page.keyboard.press('Escape');page.wait_for_function('!document.querySelector(".ball-entry").open')
        assert action.evaluate('e=>e===document.activeElement')
        page.goto(URL,wait_until='domcontentloaded')
        page.locator('[data-sheet="goal-loop"] .sheet-select').click()
        assert page.url==URL and page.locator('dialog[open]').count()==0
        page.locator('[data-sheet="goal-loop"] .sheet-cta').click()
        page.wait_for_function('document.querySelector(".goal-entry").dataset.phase==="open"',polling=100)
        assert page.url.endswith('#goal-loop')
        page.keyboard.press('Escape');page.wait_for_function('!document.querySelector(".goal-entry").open',polling=100)
        page.locator('button[aria-label="Show Hoang Viet To"]').click()
        page.wait_for_function('Number(document.querySelector(".light-table").dataset.position)>1.99',polling=100)
        assert page.url==URL
        page.locator('[data-sheet="intro"] .sheet-select').focus();page.keyboard.press('Enter')
        assert page.url==URL
        page.locator('[data-sheet="intro"] .sheet-cta').focus();page.keyboard.press('Enter')
        page.wait_for_url('http://127.0.0.1:5181/',wait_until='commit')
        print(json.dumps({'status':'PASS','evidence':str(OUT)}))
    except Exception as error:
        page.screenshot(path=str(OUT/'failure.png'))
        print(json.dumps({'status':'FAIL','error':str(error),'url':page.url,'evidence':str(OUT)}));raise
    finally:
        browser.close()
