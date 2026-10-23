import json,base64,subprocess,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'evidence'/sys.argv[1];OUT.mkdir(parents=True,exist_ok=False)
report=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
    try:
        for w,h in [(1440,900),(390,844)]:
            context=browser.new_context(viewport={'width':w,'height':h},reduced_motion='reduce',record_video_dir=str(OUT/'video'),record_video_size={'width':w,'height':h})
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            page.goto('http://127.0.0.1:5196/',wait_until='domcontentloaded');page.wait_for_function('!!globalThis.stage?.impact?.view&&performance.getEntriesByType("resource").filter(r=>r.name.endsWith(".jpg")).length===4')
            page.get_by_role('button',name='Play',exact=True).wait_for();page.screenshot(path=str(OUT/f'final-reduced-{w}.png'))
            assert page.evaluate('stage.impact.view.time===9.5')
            page.emulate_media(reduced_motion='no-preference');page.get_by_role('button',name='Replay',exact=True).click()
            shots=[];cdp=context.new_cdp_session(page)
            for i,target in enumerate([.8,1.6,2.25,2.9,3.7,4.8,6.5,8.,9.6]):
                page.wait_for_function('(t)=>stage.impact.view.time>=t',arg=target)
                page.get_by_role('button',name='Pause',exact=True).click()
                data=cdp.send('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
                (OUT/f'native-{w}-{i:02d}.png').write_bytes(base64.b64decode(data['data']))
                metrics=page.evaluate('stage.impact.metrics');assert metrics['calls']<=80 and metrics['triangles']<=150000 and metrics['buffer'][0]*metrics['buffer'][1]<=2000000
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                shots.append({'file':f'native-{w}-{i:02d}.png','metrics':metrics})
                if i<8:page.get_by_role('button',name='Play',exact=True).click()
            assert not errors,errors
            video=page.video;context.close();video.save_as(str(OUT/f'native-{w}.webm'))
            subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(OUT/f'native-{w}-%02d.png'),'-vf','scale=400:280:force_original_aspect_ratio=decrease,pad=400:280:(ow-iw)/2:(oh-ih)/2,tile=3x3','-frames:v','1',str(OUT/f'filmstrip-{w}.jpg')],check=True)
            report.append({'viewport':[w,h],'shots':shots,'errors':errors})
        (OUT/'metrics.json').write_text(json.dumps(report,indent=2));print('Native replay captured, budget/overflow/error assertions passed on desktop and mobile')
    finally:browser.close()
