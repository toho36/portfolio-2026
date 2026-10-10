"""Owned native renderer proof; run outside the worker sandbox. Capture, rebuild, verify."""
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse
import argparse,base64,hashlib,json,struct
from playwright.sync_api import sync_playwright

args=argparse.ArgumentParser()
args.add_argument('--capture-preview',action='store_true')
capture=args.parse_args().capture_preview
ROOT=Path(__file__).resolve().parent
BUILD=Path.home()/'.hermes/cache/scratch/light-table-build'
OUT=Path.home()/'.hermes/cache/scratch'/('light-table-reveal-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True)
report={'errors':[],'physical_phone':'NOT TESTED','capture_only':capture}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
    try:
        page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        def ready():page.wait_for_function('document.querySelector(".watch-view").watchView && document.querySelector(".watch-view").dataset.runtime==="webgl"')
        def amount():return float(page.locator('.watch-view').get_attribute('data-open-amount'))
        def face_point():
            return page.evaluate('''() => {
                const h=document.querySelector('.watch-view'),s=h.closest('.sheet'),b=s.getBoundingClientRect();
                const q=h.watchView.faceProjection(),m=new DOMMatrix(getComputedStyle(s.parentElement).transform);
                const x=h.offsetLeft+q.x-s.clientWidth/2,y=h.offsetTop+q.y-s.clientHeight/2;
                return {x:b.x+b.width/2+m.a*x+m.c*y,y:b.y+b.height/2+m.b*x+m.d*y};
            }''')
        def enter():
            q=face_point();page.mouse.move(q['x'],q['y'])
        page.goto('http://127.0.0.1:5186/',wait_until='networkidle');ready()
        # Read actual served entry/chunks and compare bytes with this isolated build.
        urls=page.evaluate('Array.from(document.scripts).map(s=>s.src).filter(Boolean).concat(performance.getEntriesByType("resource").map(r=>r.name).filter(n=>n.endsWith(".js")))')
        report['served_js']={}
        for url in sorted(set(urls)):
            response=page.request.get(url);assert response.ok,url
            body=response.body();local=BUILD/urlparse(url).path.lstrip('/')
            assert body==local.read_bytes(),('stale served build',url)
            report['served_js'][url]=hashlib.sha256(body).hexdigest()
        if capture:
            data=page.evaluate('''() => {const h=document.querySelector('.watch-view');h.style.width=h.style.height='700px';h.watchView.resize();return h.watchView.snapshot(0)}''')
            png=base64.b64decode(data.split(',')[1])
            assert struct.unpack('>II',png[16:24])==(700,700)
            corners=page.evaluate('''async src=>{const i=new Image();i.src=src;await i.decode();const c=document.createElement('canvas');c.width=c.height=700;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);return [[0,0],[699,0],[0,699],[699,699]].map(([x,y])=>ctx.getImageData(x,y,1,1).data[3])}''',data)
            assert corners==[0,0,0,0],('preview lost transparency',corners)
            # Capture the exact new model, closed, at time zero, on transparent canvas.
            (ROOT/'public/watch-preview.png').write_bytes(png)
            (OUT/'watch-native-closed.png').write_bytes(png)
            report['preview']=str(ROOT/'public/watch-preview.png')
            report['next']='Rebuild isolated output before verification; served PNG is still the previous build.'
        else:
            page.mouse.move(40,500)
            page.wait_for_function('Number(document.querySelector(".watch-view").dataset.openAmount)<.002')
            page.screenshot(path=str(OUT/'watch-1440-closed.png'))
            initial=page.evaluate('document.querySelector(".watch-view").watchView.geometry()')
            report['closed_geometry']=initial
            assert initial['strap']['max']['z']-initial['strap']['min']['z']>2.2
            enter();page.wait_for_function('Number(document.querySelector(".watch-view").dataset.openAmount)>.3')
            before=amount();page.mouse.move(40,500);page.wait_for_timeout(50);closing=amount()
            assert 0<closing<before,('leave snapped or failed',before,closing)
            enter();page.wait_for_timeout(50);assert amount()>closing,'reenter restarted instead of reversing'
            page.wait_for_function('Number(document.querySelector(".watch-view").dataset.openAmount)>.97')
            opened=page.evaluate('document.querySelector(".watch-view").watchView.geometry()')
            assert .37<opened['bezelLift']<=.38
            assert opened['rotation']==initial['rotation'],'watch rotates with pointer'
            assert opened['strap']==initial['strap'],'strap moved apart during reveal'
            page.screenshot(path=str(OUT/'watch-1440-open.png'))
            closed_png,open_png=page.evaluate('''() => {const v=document.querySelector('.watch-view').watchView;return [v.snapshot(0),v.snapshot(1)]}''')
            for name,data in [('closed',closed_png),('open',open_png)]:
                (OUT/f'watch-native-{name}.png').write_bytes(base64.b64decode(data.split(',')[1]))
            pixels=page.evaluate('''async images => {
                const read=async src=>{const i=new Image();i.src=src;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);return {w:i.width,h:i.height,data:ctx.getImageData(0,0,i.width,i.height).data}};
                const [a,b]=await Promise.all(images.map(read));let changed=0,minX=a.w,minY=a.h,maxX=0,maxY=0;
                for(let i=0;i<a.data.length;i+=4){const x=(i/4)%a.w,y=Math.floor(i/4/a.w);if(a.data[i+3]>8){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}if(Math.max(...[0,1,2,3].map(j=>Math.abs(a.data[i+j]-b.data[i+j])))>12)changed++}
                return {changed,w:a.w,h:a.h,minX,minY,maxX,maxY,corners:[0,(a.w-1)*4,(a.h-1)*a.w*4,(a.w*a.h-1)*4].map(i=>a.data[i+3])};
            }''',[closed_png,open_png])
            assert pixels['changed']>500,'no visible renderer geometry difference between open/closed'
            assert pixels['corners']==[0,0,0,0],'canvas lost transparency'
            assert pixels['minX']>1 and pixels['minY']>1 and pixels['maxX']<pixels['w']-2 and pixels['maxY']<pixels['h']-2,'native silhouette clipped'
            report.update(open_geometry=opened,pixel_proof=pixels)
            page.mouse.move(40,500);page.wait_for_function('Number(document.querySelector(".watch-view").dataset.openAmount)<.002')
            # Pointer elsewhere on the card must leave the watch closed.
            title=page.locator('[data-sheet="goal-loop"] h2').bounding_box()
            page.mouse.move(title['x']+title['width']/2,title['y']+title['height']/2);page.wait_for_timeout(150)
            assert amount()<.01,'whole-card hover triggered reveal'
            page.locator('[data-sheet="goal-loop"] .sheet-cta').click()
            page.wait_for_function('document.querySelector(".goal-entry").dataset.phase==="open"')
            assert page.url.endswith('#goal-loop') and page.locator('.goal-entry .watch-presentation canvas').count()==1
            assert page.locator('.watch-view').evaluate('h=>Boolean(h.watchView)')
            assert page.locator('.watch-view').get_attribute('data-pending-frame')=='true'
            page.keyboard.press('Escape');page.wait_for_function('!document.querySelector(".goal-entry").open');ready();page.keyboard.press('Tab')
            page.locator('button[aria-label="Show GameOnVB"]').click()
            page.wait_for_function('scrollY===850 && document.querySelector(".light-table").dataset.settling==="false"')
            assert page.locator('.watch-view canvas').count()==0
            page.locator('button[aria-label="Show Goal Loop"]').click()
            page.wait_for_function('scrollY===0 && document.querySelector(".light-table").dataset.settling==="false"');ready()
            # Hidden time does not advance or own a pending frame. This is a visibility
            # lifecycle probe; physical background-tab behaviour remains unclaimed.
            page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))')
            hidden_time=page.locator('.watch-view').get_attribute('data-time');page.wait_for_timeout(250)
            assert page.locator('.watch-view').get_attribute('data-time')==hidden_time
            assert page.locator('.watch-view').get_attribute('data-pending-frame')=='false'
            assert page.locator('.watch-view canvas').count()==0,'hidden watch retained GPU resources'
            page.evaluate('delete document.hidden;document.dispatchEvent(new Event("visibilitychange"))');ready()
            for width,height in [(390,844),(320,780)]:
                page.set_viewport_size({'width':width,'height':height});page.mouse.move(2,2)
                page.wait_for_function('Number(document.querySelector(".watch-view").dataset.openAmount)<.002')
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                page.screenshot(path=str(OUT/f'watch-{width}-closed.png'))
                enter();page.wait_for_function('Number(document.querySelector(".watch-view").dataset.openAmount)>.97')
                page.screenshot(path=str(OUT/f'watch-{width}-open.png'))
                bounds=page.evaluate('document.querySelector(".watch-view").watchView.geometry().projectedBounds')
                assert all(-.99<v<.99 for v in bounds.values()),('mobile geometry clipped',width,bounds)
                report[f'bounds_{width}']=bounds
            canonical=page.evaluate('''() => {const h=document.querySelector('.watch-view'),style=h.style.cssText;h.style.width=h.style.height='700px';h.watchView.resize();const png=h.watchView.snapshot(0);h.style.cssText=style;h.watchView.resize();return png}''')
            assert base64.b64decode(canonical.split(',')[1])==(ROOT/'public/watch-preview.png').read_bytes(),'preview is not the exact current closed native renderer; capture first'
            page.emulate_media(reduced_motion='reduce')
            page.wait_for_function('document.querySelector(".watch-view").dataset.runtime==="static"')
            assert page.locator('.watch-view canvas').count()==0 and page.locator('.watch-static').is_visible()
            assert page.request.get('http://127.0.0.1:5186/watch-preview.png').body()==(ROOT/'public/watch-preview.png').read_bytes(),'rebuild after PNG capture'
            page.screenshot(path=str(OUT/'watch-reduced.png'))
            page.emulate_media(reduced_motion='no-preference');ready()
            page.evaluate('document.querySelector(".watch-view canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()')
            page.wait_for_function('document.querySelector(".watch-view").dataset.runtime==="static"')
            assert page.locator('.watch-view canvas').count()==0 and page.locator('.watch-static').is_visible()
            assert page.locator('.watch-view').get_attribute('data-pending-frame')=='false'
            coarse=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
            mobile=coarse.new_page();mobile.on('pageerror',lambda e:report['errors'].append(str(e)));mobile.goto('http://127.0.0.1:5186/',wait_until='domcontentloaded')
            mobile.wait_for_function('Number(document.querySelector(".watch-view").dataset.openAmount)>.3')
            mobile.screenshot(path=str(OUT/'watch-coarse-reveal.png'))
            mobile.wait_for_function('Number(document.querySelector(".watch-view").dataset.time)>1.7 && Number(document.querySelector(".watch-view").dataset.openAmount)<.01')
            mobile.emulate_media(reduced_motion='reduce');mobile.wait_for_function('!document.querySelector(".watch-view canvas")')
            coarse.close()
            no_gpu=browser.new_context()
            no_gpu.add_init_script('HTMLCanvasElement.prototype.getContext=new Proxy(HTMLCanvasElement.prototype.getContext,{apply(fn,self,args){return /^webgl/.test(args[0])?null:Reflect.apply(fn,self,args)}})')
            fallback=no_gpu.new_page();fallback.on('pageerror',lambda e:report['errors'].append(str(e)));fallback.goto('http://127.0.0.1:5186/',wait_until='networkidle')
            assert fallback.locator('.watch-view canvas').count()==0 and fallback.locator('.watch-static').is_visible()
            fallback.screenshot(path=str(OUT/'watch-no-webgl.png'));no_gpu.close()
        assert not report['errors'],report['errors']
        report['status']='PASS'
    except Exception as error:
        report.update(status='FAIL',error=str(error))
        if 'page' in locals():page.screenshot(path=str(OUT/'failure.png'))
        raise
    finally:
        (OUT/'acceptance.json').write_text(json.dumps(report,indent=2))
        print(json.dumps({'status':report.get('status'),'evidence':str(OUT),'capture_only':capture}))
        browser.close()
