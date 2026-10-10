"""Parent-run owned Chrome acceptance. Native actions; touch/visibility/no-GPU are emulated.
Never writes project assets. Capture watch-reveal.py --capture-preview and rebuild first.
"""
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse
import hashlib,json
from playwright.sync_api import sync_playwright

URL='http://127.0.0.1:5186/'
BUILD=Path.home()/'.hermes/cache/scratch/light-table-build'
OUT=Path.home()/'.hermes/cache/scratch'/('light-table-watch-flow-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True)
report={'errors':[],'checks':[],'traces':{},'physical_phone_trackpad':'NOT TESTED','emulated':['touch/coarse','reduced motion','visibility','no WebGL']}
TRACE='''() => {
    const h=document.querySelector('.watch-view'),s=h.watchSurface;
    window.flowProof={canvas:s.querySelector('canvas'),view:h.watchView,frames:[],before:null,first:null};
    function sample(){
        const b=s.getBoundingClientRect(),d=document.querySelector('.goal-entry'),c=s.querySelector('canvas');
        return {t:performance.now(),p:Number(d.dataset.progress||0),phase:d.dataset.phase,dialog:d.open,
            x:b.x,y:b.y,w:b.width,h:b.height,time:Number(h.dataset.time||0),reveal:Number(h.dataset.openAmount||0),
            sameCanvas:c===flowProof.canvas,sameView:h.watchView===flowProof.view,count:document.querySelectorAll('.watch-presentation canvas').length,
            connected:s.isConnected,runtime:s.dataset.runtime,visible:getComputedStyle(s).visibility};
    }
    document.querySelector('[data-sheet="goal-loop"] .sheet-cta').addEventListener('click',()=>flowProof.before=sample(),{capture:true,once:true});
    flowProof.observer=new MutationObserver(()=>{if(!flowProof.first&&document.querySelector('.goal-entry').open)flowProof.first=sample()});
    flowProof.observer.observe(document.querySelector('.goal-entry'),{attributes:true,attributeFilter:['open']});
    function tick(){flowProof.frames.push(sample());flowProof.frame=requestAnimationFrame(tick)}
    flowProof.frame=requestAnimationFrame(tick);
}'''

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
    context=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
    page=context.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)));pg=page
    page.add_init_script('window.focusTrace=[];addEventListener("focusin",e=>focusTrace.push({t:performance.now(),tag:e.target.tagName,cls:e.target.className,label:e.target.getAttribute("aria-label"),sheet:e.target.closest("[data-sheet]")?.dataset.sheet,y:scrollY}),true)')
    def ready(pg=page):pg.wait_for_function('document.querySelector(".watch-view").watchView && document.querySelector(".watch-presentation canvas")')
    def opened(pg=page):pg.wait_for_function('document.querySelector(".goal-entry").dataset.phase==="open"')
    def closed(pg=page):pg.wait_for_function('!document.querySelector(".goal-entry").open && document.querySelector(".light-table").dataset.phase==="table"')
    def select(i):
        page.locator('.table-footer button').nth(i).click()
        page.wait_for_function('i=>Math.abs(Number(document.querySelector(".light-table").dataset.position)-i)<.001 && document.querySelector(".light-table").dataset.settling!=="true"',arg=i)
    def action():return page.locator('[data-sheet="goal-loop"] .sheet-cta')
    def snapshot(name):page.screenshot(path=str(OUT/f'{name}.png'))
    def feedback(link,name):
        page.mouse.move(2,2)
        page.wait_for_function('e=>getComputedStyle(e).backgroundColor==="rgba(0, 0, 0, 0)"',arg=link.element_handle())
        before=link.evaluate('e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return {bg:s.backgroundColor,color:s.color,x:b.x,y:b.y,w:b.width,h:b.height}}')
        link.hover()
        page.wait_for_function('({e,bg})=>getComputedStyle(e).backgroundColor===bg && getComputedStyle(e).color===getComputedStyle(e.closest(".sheet")).backgroundColor',arg={'e':link.element_handle(),'bg':before['color']})
        after=link.evaluate('e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return {bg:s.backgroundColor,color:s.color,x:b.x,y:b.y,w:b.width,h:b.height,arrow:getComputedStyle(e.querySelector("b")).transform}}')
        assert after['bg']!=before['bg'] and after['color']!=before['color'],('missing CTA inversion',name,before,after)
        assert all(abs(before[k]-after[k])<.05 for k in ['x','y','w','h']),('CTA hit target moved',name)
        assert after['arrow']!='none',('arrow did not move',name)
        snapshot(f'cta-{name}-hover')
        b=link.bounding_box();page.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2);page.mouse.down()
        assert link.evaluate('e=>getComputedStyle(e).boxShadow')!='none',('no pressed feedback',name)
        snapshot(f'cta-{name}-pressed')
        page.mouse.move(2,2);page.mouse.up()  # Release outside the link, no navigation.
        assert link.get_attribute('data-pressed') is None,('stuck press after outside release',name)
        link.focus();page.keyboard.press('Shift+Tab');page.keyboard.press('Tab')
        page.wait_for_function('({e,bg})=>getComputedStyle(e).backgroundColor===bg',arg={'e':link.element_handle(),'bg':after['bg']})
        assert link.evaluate('e=>e===document.activeElement && e.matches(":focus-visible")'),('native focus missing',name)
        assert link.evaluate('e=>getComputedStyle(e).backgroundColor')==after['bg'],('focus palette missing',name)
        snapshot(f'cta-{name}-focus')
        report.setdefault('cta',{})[name]={'before':before,'hover':after}
    def trace_done(name):
        data=page.evaluate('''() => {cancelAnimationFrame(flowProof.frame);flowProof.observer.disconnect();const {before,first,frames}=flowProof;return {before,first,frames}}''')
        report['traces'][name]=data
        before,first=data['before'],data['first']
        assert before and first,('missing first-frame proof',name)
        assert all(abs(before[k]-first[k])<1 for k in ['x','y','w','h']),('source framing jumped on entry',name,before,first)
        frames=[f for f in data['frames'] if f['t']>=first['t']]
        assert len(frames)>5,('no temporal samples',name)
        assert all(f['connected'] and f['sameCanvas'] and f['sameView'] and f['count']==1 and f['runtime']=='webgl' and f['visible']=='visible' for f in frames),('watch vanished, duplicated or remounted',name,frames)
        assert max(f['reveal'] for f in frames if f['dialog'])-min(f['reveal'] for f in frames if f['dialog'])<.02,('reveal reset in dialog',name)
        for a,b in zip(frames,frames[1:]):
            dt=b['t']-a['t']
            assert b['time']>=a['time']-.002 and b['time']-a['time']<.16,('watch phase reset/jumped',name,a,b)
            # Dimension changes follow continuous progress, rather than a one-frame new silhouette.
            assert max(abs(a[k]-b[k]) for k in ['x','y','w','h'])<max(24,dt*4),('frame bounds jumped',name,a,b)
        last=frames[-1]
        assert all(abs(before[k]-last[k])<1 for k in ['x','y','w','h']),('return did not land in its exact card',name,before,last)
        moving=[f for f in frames if f['phase']=='leaving' and f['p']>.001]
        if len(moving)>3:
            speed=lambda a,b:abs(b['p']-a['p'])/max(1,b['t']-a['t'])
            assert speed(moving[-2],moving[-1])<speed(moving[0],moving[1])+.0002,('hard return landing',name)
    try:
        page.goto(URL,wait_until='networkidle');ready()
        urls=page.evaluate('Array.from(document.scripts).map(s=>s.src).filter(Boolean).concat(performance.getEntriesByType("resource").map(r=>r.name).filter(n=>n.endsWith(".js")))')
        report['served_js']={}
        for url in sorted(set(urls)):
            response=page.request.get(url);assert response.ok,url
            body=response.body();assert body==(BUILD/urlparse(url).path.lstrip('/')).read_bytes(),('stale served JS',url)
            report['served_js'][url]=hashlib.sha256(body).hexdigest()
        assert page.locator('[data-calibre],img[src="/calibre.jpg"]').count()==0
        for i,name in enumerate(['goal-loop','gameonvb','intro']):
            select(i);feedback(page.locator(f'[data-sheet="{name}"] .sheet-cta'),name)
        select(0);ready()
        # Start before the deck, not at the footer where Tab first scrolls to the notes.
        page.locator('.table-header a').last.focus()
        page.keyboard.press('Tab');page.keyboard.press('Tab')
        assert action().evaluate('e=>e===document.activeElement && e.matches(":focus-visible")')
        assert action().evaluate('e=>getComputedStyle(e).outlineStyle')!='none'
        page.wait_for_function('Number(document.querySelector(".watch-view").dataset.openAmount)>.9')
        report['checks'].append('All three native links invert on hover/focus/press with stable targets; Goal Loop focus invites the watch')
        # Native modifier/middle clicks retain ordinary new-tab navigation.
        modifier='Meta' if page.evaluate('navigator.platform.includes("Mac")') else 'Control'
        with context.expect_page() as popup_info:action().click(modifiers=[modifier])
        popup=popup_info.value;popup.wait_for_url('**/#goal-loop');opened(popup);popup.close()
        assert page.locator('dialog[open]').count()==0
        with context.expect_page() as popup_info:action().click(button='middle')
        popup=popup_info.value;popup.wait_for_url('**/#goal-loop');opened(popup);popup.close()
        assert page.locator('dialog[open]').count()==0
        report['checks'].append('Modifier and middle-click open the native hash link in a separate tab')
        # Seed a small non-zero scroll while the actual CTA is held, then release it.
        # This scroll seed is programmatic; native passive wheel/touch coasting has its own scripts.
        b=action().bounding_box();page.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2);page.mouse.down()
        page.evaluate('scrollTo(0,8)');page.wait_for_function('scrollY===8 && Number(document.querySelector(".light-table").dataset.position)>0')
        page.evaluate(TRACE);page.mouse.up()
        saved_scroll=page.evaluate('scrollY');snapshot('enter-start')
        page.wait_for_function('Number(document.querySelector(".goal-entry").dataset.progress)>.4');snapshot('enter-middle')
        opened();snapshot('enter-end')
        assert page.locator('.goal-entry .watch-presentation canvas').count()==1 and page.locator('.watch-view canvas').count()==0
        report['modal_focus_steps']=[]
        for _ in range(8):
            page.keyboard.press('Tab')
            focus=page.evaluate('document.activeElement.closest(".goal-entry[open]")?"dialog":document.activeElement===document.body?"browser":"outside"')
            assert focus!='outside','focus reached an interactive background element'
            assert focus!='browser' or not report['modal_focus_steps'] or report['modal_focus_steps'][-1]!='browser','focus failed to cycle back into the modal'
            report['modal_focus_steps'].append(focus)
        page.locator('.goal-entry .entry-header button').click();snapshot('return-start')
        page.wait_for_function('Number(document.querySelector(".goal-entry").dataset.progress)<.65');snapshot('return-middle')
        closed();page.wait_for_timeout(60);snapshot('return-end')
        assert abs(page.evaluate('scrollY')-saved_scroll)<1,'return scroll lost'
        assert action().evaluate('e=>document.activeElement===e'),'originating CTA focus lost'
        assert page.evaluate('document.body.style.overflow')==''
        trace_done('enter-back');report['checks'].append('Same renderer/canvas, frozen reveal, continuous phase and first/middle/end framing; exact card/scroll/focus return')
        # Return to zero before the interruption probes so native actionability is stable.
        select(0);ready();page.evaluate(TRACE);action().click()
        page.wait_for_function('document.querySelector(".goal-entry").open && Number(document.querySelector(".goal-entry").dataset.progress)>.08')
        assert page.locator('.goal-entry').get_attribute('data-phase')=='entering'
        page.keyboard.press('Escape');page.wait_for_url(URL,wait_until='commit')
        page.wait_for_function('document.querySelector(".goal-entry").dataset.phase==="leaving"')
        # Real browser Forward reverses the still-running leave without recreating anything.
        page.go_forward(wait_until='commit');opened();snapshot('rapid-reopen')
        page.go_back(wait_until='commit');closed();page.wait_for_timeout(60);trace_done('escape-reopen-browser-back')
        report['checks'].append('Escape during entry, rapid history reversal and browser Back continue the current progress/velocity')
        # Normal browser Back/Forward and direct hash fallback.
        action().click();opened();page.go_back(wait_until='commit');closed();page.go_forward(wait_until='commit');opened();page.keyboard.press('Escape');closed()
        page.goto(URL+'#goal-loop',wait_until='networkidle');opened();ready();page.keyboard.press('Escape');closed()
        assert not page.url.endswith('#goal-loop') and action().evaluate('e=>document.activeElement===e')
        report['checks'].append('Browser Back/Forward and direct hash return are usable with native dialog semantics')
        # Narrow widths use the same exact surface and retain the renderer through return.
        for width,height in [(390,844),(320,780)]:
            page.set_viewport_size({'width':width,'height':height});select(0);ready();page.evaluate(TRACE)
            action().click();snapshot(f'enter-{width}-start');page.wait_for_function('Number(document.querySelector(".goal-entry").dataset.progress)>.4');snapshot(f'enter-{width}-middle');opened();snapshot(f'enter-{width}-end')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            bounds=page.evaluate('document.querySelector(".watch-view").watchView.geometry().projectedBounds')
            assert all(-.99<v<.99 for v in bounds.values()),('clipped watch',width,bounds)
            page.keyboard.press('Escape');closed();page.wait_for_timeout(60);trace_done(f'width-{width}')
        # Hidden releases its GPU, preserving phase/reveal in an exact last-pose image.
        page.evaluate('window.hiddenTime=Number(document.querySelector(".watch-view").dataset.time);Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))')
        assert page.locator('.watch-presentation canvas').count()==0
        page.wait_for_timeout(200);assert page.evaluate('Number(document.querySelector(".watch-view").dataset.time)===hiddenTime')
        page.evaluate('delete document.hidden;document.dispatchEvent(new Event("visibilitychange"))');ready()
        page.emulate_media(reduced_motion='reduce');page.wait_for_function('!document.querySelector(".watch-presentation canvas")')
        action().click();opened();snapshot('reduced-detail')
        assert page.locator('.goal-entry .watch-static').is_visible() and page.locator('.goal-entry canvas').count()==0
        page.keyboard.press('Escape');closed()
        # Loss releases resources; the same-model fallback enters/returns with no second scene.
        page.emulate_media(reduced_motion='no-preference');ready()
        page.evaluate('document.querySelector(".watch-presentation canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()')
        page.wait_for_function('document.querySelector(".watch-view").dataset.runtime==="static"')
        action().click();opened();assert page.locator('.goal-entry .watch-static').is_visible();page.keyboard.press('Escape');closed()
        for width,height in [(390,844),(320,780)]:
            fallback=browser.new_context(viewport={'width':width,'height':height})
            fallback.add_init_script('HTMLCanvasElement.prototype.getContext=new Proxy(HTMLCanvasElement.prototype.getContext,{apply(fn,self,args){return /^webgl/.test(args[0])?null:Reflect.apply(fn,self,args)}})')
            pg=fallback.new_page();pg.on('pageerror',lambda e:report['errors'].append(str(e)));pg.goto(URL+'#goal-loop',wait_until='networkidle');opened(pg)
            assert pg.locator('.goal-entry canvas').count()==0 and pg.locator('.goal-entry .watch-static').is_visible()
            assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth')
            pg.screenshot(path=str(OUT/f'no-gpu-{width}.png'));pg.keyboard.press('Escape');closed(pg);fallback.close()
        # Native emulated touch must show explicit held feedback even without UA :active.
        mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        mobile.add_init_script('window.ctaPointerTrace=[];for(const name of ["pointerdown","pointercancel","pointerup","touchend","touchcancel"])addEventListener(name,e=>ctaPointerTrace.push({name,cta:!!e.target.closest?.(".sheet-cta"),y:scrollY}),true)')
        pg=mobile.new_page();pg.on('pageerror',lambda e:report['errors'].append(str(e)));pg.goto(URL,wait_until='networkidle');ready(pg)
        cdp=mobile.new_cdp_session(pg)
        def touch_select(i):
            pg.locator('.table-footer button').nth(i).tap()
            pg.wait_for_function('i=>Math.abs(scrollY-i*innerHeight*.85)<1 && document.querySelector(".light-table").dataset.settling!=="true"',arg=i)
        def touch_press(link):
            before=link.evaluate('e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return {bg:s.backgroundColor,color:s.color,paper:getComputedStyle(e.closest(".sheet")).backgroundColor,x:b.x,y:b.y,w:b.width,h:b.height}}')
            assert link.get_attribute('data-pressed') is None and link.evaluate('e=>getComputedStyle(e).boxShadow==="none"'),'press was already stuck'
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':before['x']+before['w']/2,'y':before['y']+before['h']/2}]})
            pg.wait_for_function('({e,bg,color})=>e.dataset.pressed==="true" && getComputedStyle(e).backgroundColor===bg && getComputedStyle(e).color===color && getComputedStyle(e.querySelector("b")).transform==="matrix(1, 0, 0, 1, 1, -1)"',arg={'e':link.element_handle(),'bg':before['color'],'color':before['paper']})
            held=link.evaluate('e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return {pressed:e.dataset.pressed,bg:s.backgroundColor,color:s.color,shadow:s.boxShadow,arrow:getComputedStyle(e.querySelector("b")).transform,x:b.x,y:b.y,w:b.width,h:b.height}}')
            assert held['pressed']=='true' and 'inset' in held['shadow'],('missing explicit touch press',before,held)
            assert held['bg']==before['color'] and held['color']==before['paper'] and held['bg']!=before['bg'] and held['color']!=before['color'],('touch palette did not invert',before,held)
            assert held['arrow']=='matrix(1, 0, 0, 1, 1, -1)',('missing pressed arrow',held)
            assert all(abs(before[k]-held[k])<.05 for k in ['x','y','w','h']),('touch hit target moved',before,held)
            return before,held
        # Explicit native cancellation clears every CTA without following its link.
        report['touch_cta']={}
        for i,name in enumerate(['goal-loop','gameonvb','intro']):
            touch_select(i);link=pg.locator(f'[data-sheet="{name}"] .sheet-cta')
            before,held=touch_press(link);pg.screenshot(path=str(OUT/f'touch-{name}-pressed.png'))
            cancels=pg.evaluate('ctaPointerTrace.filter(e=>e.name==="pointercancel"&&e.cta).length')
            cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
            pg.wait_for_function('n=>ctaPointerTrace.filter(e=>e.name==="pointercancel"&&e.cta).length>n',arg=cancels)
            pg.wait_for_function('e=>!e.dataset.pressed && getComputedStyle(e).boxShadow==="none" && getComputedStyle(e).backgroundColor==="rgba(0, 0, 0, 0)"',arg=link.element_handle())
            assert pg.url==URL and pg.locator('dialog[open]').count()==0,'cancel navigated'
            report['touch_cta'][name]={'before':before,'held':held}
        # Pan from the CTA: native scroll cancels its press, but not independent touchHeld.
        touch_select(0);link=pg.locator('[data-sheet="goal-loop"] .sheet-cta')
        before,_=touch_press(link);start_y=pg.evaluate('scrollY')
        cancels=pg.evaluate('ctaPointerTrace.filter(e=>e.name==="pointercancel"&&e.cta).length')
        for dy in [35,70,105,140,175,210]:
            cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':before['x']+before['w']/2,'y':before['y']+before['h']/2-dy}]})
            pg.wait_for_timeout(40)
        pg.wait_for_function('({n,y})=>ctaPointerTrace.filter(e=>e.name==="pointercancel"&&e.cta).length>n && scrollY>y+80',arg={'n':cancels,'y':start_y},polling=100)
        pg.wait_for_timeout(120);held_y=pg.evaluate('scrollY');pg.wait_for_timeout(320)
        assert abs(pg.evaluate('scrollY')-held_y)<2,'deck moved while canceled pointer still had a held touch'
        assert pg.locator('.light-table').get_attribute('data-settling')!='true','deck assistance started before touchend'
        assert link.get_attribute('data-pressed') is None and link.evaluate('e=>getComputedStyle(e).boxShadow==="none"'),'pan left stuck press'
        assert pg.url==URL and pg.locator('dialog[open]').count()==0 and pg.evaluate('document.body.style.overflow')=='','pan jailed scroll or entered dialog'
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});pg.wait_for_timeout(180)
        assert pg.url==URL and pg.locator('dialog[open]').count()==0,'pan release navigated'
        report['touch_pan']={'start_y':start_y,'held_y':held_y,'events':pg.evaluate('ctaPointerTrace')}
        report['checks'].append('All three CTAs visibly invert while held; native touchCancel and CTA pan clear press, preserve held-touch scrolling and never navigate')
        # A normal tap still enters and returns without any stale pressed state.
        touch_select(0);ready(pg);touch_press(link)
        pg.screenshot(path=str(OUT/'touch-pressed.png'))
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});opened(pg)
        assert pg.locator('.sheet-cta[data-pressed]').count()==0,'tap entry left a stuck press'
        assert pg.locator('.goal-entry .watch-presentation canvas').count()==1
        pg.locator('.goal-entry .entry-header button').tap();closed(pg)
        assert pg.locator('.sheet-cta[data-pressed]').count()==0,'return left a stuck press'
        mobile.close()
        report['checks'].append('390/320 continuity/bounds; emulated hidden disposal, reduced/context-loss/no-GPU and native emulated touch entry/back')
        assert not report['errors'],report['errors'];report['status']='PASS'
    except Exception as error:
        report.update(status='FAIL',error=str(error))
        report['focus_trace']=page.evaluate('focusTrace')
        try:
            if pg is not None:
                report['mobile_failure']=pg.evaluate('({url:location.href,y:scrollY,position:document.querySelector(".light-table")?.dataset.position,settling:document.querySelector(".light-table")?.dataset.settling,dialog:document.querySelector(".goal-entry")?.open,events:window.ctaPointerTrace,focus:document.activeElement.outerHTML.slice(0,180)})')
                pg.screenshot(path=str(OUT/'mobile-failure.png'))
        except Exception:pass
        try:snapshot('failure')
        except Exception:pass
        raise
    finally:
        (OUT/'acceptance.json').write_text(json.dumps(report,indent=2))
        print(json.dumps({'status':report.get('status'),'evidence':str(OUT)}))
        context.close();browser.close()
