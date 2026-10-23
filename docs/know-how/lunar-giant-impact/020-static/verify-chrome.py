from pathlib import Path
import json
import hashlib
import os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

OUT=Path(__file__).resolve().parent/'blocks'/os.environ.get('LUNAR_BLOCK','001')/'chrome'
OUT.mkdir(parents=True,exist_ok=True)
manifest=json.loads(Path('/Users/vitek/.hermes/cache/scratch/lunar-020-build/.vite/manifest.json').read_text())
entry=next(v['file'] for v in manifest.values() if v.get('isEntry'))
report={'browser':'Owned system Chrome, headless; repaired static volume/material candidate','layouts':[],'checks':[],'errors':[],'animation':'NOT IMPLEMENTED','physical_phone':'NOT TESTED'}
BUILD=Path('/Users/vitek/.hermes/cache/scratch/lunar-020-build')
responses=[]

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
    try:
        context=browser.new_context(viewport={'width':1440,'height':900})
        context.add_init_script('''const original=HTMLCanvasElement.prototype.getContext;const canvases=new WeakSet();window.gpuContexts=0;HTMLCanvasElement.prototype.getContext=function(type,...args){const context=original.call(this,type,...args);if(type.startsWith('webgl')&&context&&!canvases.has(this)){canvases.add(this);window.gpuContexts++}return context}''')
        page=context.new_page()
        cdp=context.new_cdp_session(page);cdp.send('Network.enable');cdp.send('Network.setCacheDisabled',{'cacheDisabled':True})
        page.on('response',lambda response:responses.append(response) if '/assets/' in response.url else None)
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
        document_response=page.goto('http://127.0.0.1:5193/?proof=chrome-final',wait_until='domcontentloaded')
        document_digest=hashlib.sha256(document_response.body()).hexdigest()
        assert document_response.status==200 and document_digest==hashlib.sha256((BUILD/'index.html').read_bytes()).hexdigest()
        assert document_response.headers.get('cache-control')=='no-store'
        report['loaded_document']={'url':document_response.url,'sha256':document_digest,'entry':entry,'cache_control':'no-store'}
        page.wait_for_function('!!document.querySelector(".stage")?.lunar && document.querySelector(".stage").dataset.runtime==="webgl"')
        assert page.locator('script[type="module"]').get_attribute('src').endswith(entry)
        transferred=[]
        for response in responses:
            relative=urlparse(response.url).path.lstrip('/')
            body=response.body();digest=hashlib.sha256(body).hexdigest()
            assert response.status==200 and digest==hashlib.sha256((BUILD/relative).read_bytes()).hexdigest(),relative
            transferred.append({'path':relative,'bytes':len(body),'sha256':digest})
        texture_bytes=sum(item['bytes'] for item in transferred if item['path'].endswith(('.jpg','.bin')) and '/dramatic-' not in item['path'])
        assert sum(item['path'].endswith('.jpg') and '/dramatic-' not in item['path'] for item in transferred)==6
        assert sum(item['path'].endswith('.bin') for item in transferred)==1
        assert texture_bytes<=4_000_000
        report['served_assets']=transferred;report['texture_response_bytes']=texture_bytes
        def state():
            return page.evaluate('''() => ({metrics:JSON.parse(document.querySelector('.stage').dataset.metrics),width:document.querySelector('.stage').clientWidth,height:document.querySelector('.stage').clientHeight,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,scheduled:document.querySelector('.stage').lunar.scheduled,canvases:document.querySelectorAll('.stage canvas').length})''')
        ids=state()['metrics']['ids']
        for width,height in [(1440,900),(768,1024),(390,844)]:
            page.set_viewport_size({'width':width,'height':height})
            page.wait_for_function('!document.querySelector(".stage").lunar.scheduled')
            for index,pose in enumerate(['formation','detached','earth']):
                page.locator('nav button').nth(index).click()
                page.wait_for_function('(pose)=>document.querySelector(".stage").dataset.pose===pose',arg=pose)
                record=state();metrics=record['metrics']
                assert record['overflow']==0,record
                assert record['canvases']==1 and metrics['ids']==ids,record
                assert page.evaluate('window.gpuContexts')==1
                assert metrics['calls']<=80 and metrics['triangles']<=150000 and metrics['buffer']<=2000000,record
                assert all(value>0 if pose=='formation' else value==0 for value in metrics['thermalLights']),record
                assert (metrics['moonFillIntensity']>0 if pose=='formation' else metrics['moonFillIntensity']==0),record
                moon=metrics['moon'];radius=moon['diameter']/2
                assert moon['x']-radius>=-1 and moon['x']+radius<=record['width']+1,record
                assert moon['y']-radius>=-1 and moon['y']+radius<=record['height']+1,record
                before=metrics['renders'];page.wait_for_timeout(200)
                assert state()['metrics']['renders']==before,'Idle rendering continued'
                assert not state()['scheduled']
                page.screenshot(path=str(OUT/f'{pose}-{width}-final.png'))
                report['layouts'].append({'viewport_width':width,**record})
        page.locator('nav button').nth(0).focus();page.keyboard.press('Enter')
        page.wait_for_function('document.querySelector(".stage").dataset.pose==="formation"')
        assert state()['metrics']['ids']==ids
        page.locator('nav button').nth(2).click()
        page.locator('.stage canvas').evaluate('(canvas)=>canvas.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()')
        page.wait_for_function('document.querySelector(".stage").dataset.runtime==="fallback" && document.querySelectorAll(".stage canvas").length===0 && document.querySelector(".captured")?.naturalWidth>0')
        assert page.evaluate('document.querySelector(".captured").src===document.querySelector(".stage").lastSnapshot && document.querySelector(".stage").dataset.selected==="earth"')
        page.screenshot(path=str(OUT/'context-loss-final.png'))
        report['checks'].append('Native three-pose switches and keyboard Enter preserve objects, have zero idle RAF; actual context loss disposes canvas and shows same-pose capture')
        context.close()
        context=browser.new_context(viewport={'width':390,'height':844})
        context.add_init_script('const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith("webgl")?null:original.call(this,type,...args)}')
        page= context.new_page();page.goto('http://127.0.0.1:5193/?proof=no-gpu')
        page.wait_for_function('document.querySelector(".stage")?.dataset.runtime==="unavailable"')
        assert page.locator('.stage canvas').count()==0
        assert page.locator('nav button:disabled').count()==3
        assert page.get_by_text('GPU nedostupné / 3D nebylo ověřeno',exact=True).count()==1
        page.screenshot(path=str(OUT/'no-gpu-final.png'))
        report['checks'].append('Explicit no-GPU fixture exposes unavailable state, not a fabricated renderer or pose')
        context.close()
        assert not report['errors'],report['errors']
    finally:
        browser.close()
        (OUT/'report-chrome.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
