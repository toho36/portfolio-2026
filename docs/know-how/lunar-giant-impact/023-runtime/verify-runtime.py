import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent;out=ROOT/'final-runtime';out.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
    try:
        context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:5196/',wait_until='domcontentloaded');page.wait_for_function('!!stage.impact.view&&performance.getEntriesByType("resource").filter(r=>r.name.endsWith(".jpg")).length===4')
        assert page.get_by_role('button',name='Play',exact=True).is_disabled()
        assert page.evaluate('stage.impact.view.time')==9.5;page.wait_for_timeout(150);assert page.evaluate('stage.impact.view.time')==9.5
        page.screenshot(path=str(out/'reduced-mobile.png'))
        page.emulate_media(reduced_motion='no-preference');page.get_by_role('button',name='Replay',exact=True).click();page.wait_for_function('stage.impact.view.time>.5')
        page.get_by_role('button',name='Pause',exact=True).click();now=page.evaluate('stage.impact.view.time');page.wait_for_timeout(150);assert page.evaluate('stage.impact.view.time')==now
        page.get_by_role('button',name='Play',exact=True).click();page.wait_for_function('(t)=>stage.impact.view.time>t+.1',arg=now)
        page.emulate_media(reduced_motion='reduce');page.wait_for_function('stage.impact.view.time===9.5');assert page.get_by_role('button',name='Play',exact=True).is_disabled()
        page.evaluate('document.querySelector("canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()');page.wait_for_function('document.querySelectorAll("canvas").length===0');page.wait_for_function('getComputedStyle(document.querySelector("#fallback")).display!=="none"')
        assert not errors,errors;page.screenshot(path=str(out/'lost-context-mobile.png'));context.close()
        context=browser.new_context(viewport={'width':1440,'height':900});context.add_init_script("const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl'||t==='webgl2'?null:g.call(this,t,...a)}")
        page=context.new_page();page.goto('http://127.0.0.1:5196/',wait_until='domcontentloaded');page.wait_for_function('getComputedStyle(document.querySelector("#fallback")).display!=="none"');assert page.locator('canvas').count()==0
        assert page.locator('#ctl').is_hidden();page.screenshot(path=str(out/'no-webgl.png'));context.close()
        (out/'report.json').write_text(json.dumps({'status':'PASS_TECHNICAL_PROTOTYPE','native_controls':'pause/resume/replay actually change/preserve elapsed time','reduced_motion':'loaded0 andlivechange final9.5s static, disabled controls','context_loss':'real WebGL_lose_context, canvas removed and labelled static SVG illustration','no_webgl':'labelled static SVG illustration, no disabled dead live controls shown','page_errors':errors,'artistic_gate':'CHANGES_REQUIRED in evidence004, not final acceptedhero','physical_phone':False},indent=2));print('Native controls and safety fallbacks verified; artistic gate remains changes required')
    finally:browser.close()
