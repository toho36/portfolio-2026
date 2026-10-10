"""Native wheel/trackpad-like input with per-frame position and velocity evidence."""
from datetime import datetime
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

OUT=Path.home()/'.hermes/cache/scratch'/('light-table-continuity-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True)
report={'traces':{},'errors':[],'physical_trackpad_and_phone':'NOT TESTED'}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
    try:
        # Leave runway for the reverse handoff instead of finishing the native burst at scrollY=0.
        for name,deltas in [('wheel',[280]),('trackpad',[35,45,55,50,40,30,20,12,8]),('reverse',[-35,-45,-55,-50,-40,-30]),('light',[2]*10)]:
            page=browser.new_page(viewport={'width':1440,'height':1000})
            page.on('pageerror',lambda e:report['errors'].append(str(e)))
            page.goto('http://127.0.0.1:5186/',wait_until='networkidle')
            if name=='reverse':
                page.locator('button[aria-label="Show GameOnVB"]').click()
                page.wait_for_function('scrollY===850 && document.querySelector(".light-table").dataset.settling==="false"')
            page.evaluate('''() => {
                window.trace={frames:[],inputs:[]};let previous;
                function tick(t){setTimeout(()=>{
                    const f={t:performance.now(),raf:t,y:scrollY,position:Number(document.querySelector('.light-table').dataset.position),settling:document.querySelector('.light-table').dataset.settling};
                    if(previous&&f.t-previous.t<4)return;
                    f.v=previous?(f.y-previous.y)/(f.t-previous.t):0;previous=f;trace.frames.push(f);
                },0);window.traceFrame=requestAnimationFrame(tick)}
                traceFrame=requestAnimationFrame(tick);
                addEventListener('wheel',e=>trace.inputs.push({t:performance.now(),dy:e.deltaY}),{passive:true});
            }''')
            page.mouse.move(730,640)
            for delta in deltas:
                page.mouse.wheel(0,delta)
                page.wait_for_timeout(17)
            target=0 if name=='reverse' else 850
            page.wait_for_function('target=>scrollY===target && document.querySelector(".light-table").dataset.settling==="false"',arg=target,polling=50)
            page.wait_for_timeout(300)
            trace=page.evaluate('cancelAnimationFrame(traceFrame);trace')
            report['traces'][name]=trace
            frames=trace['frames'];last_input=trace['inputs'][-1]['t']
            landing=next(f for f in frames if f['t']>=last_input and f['y']==target and f['settling']=='false')
            trace['landing_ms_after_last_input']=landing['t']-last_input
            assert 0<trace['landing_ms_after_last_input']<1800,(name,'unbounded settling tail',trace['landing_ms_after_last_input'])
            after=[f for f in frames if f['t']>=last_input and abs(f['y']-target)>2]
            assert after,(name,'missing moving handoff samples')
            # Integer scrollY can repeat near rest, but must not pause and restart mid-travel.
            still=0
            for f in after:
                still=still+1 if f['v']==0 else 0
                assert still<2 or abs(f['y']-target)<10,(name,'pause before landing',f)
                assert f['v']*(1 if target else -1)>=0,(name,'overshoot/reversal',f)
            assert all(-1<=f['y']<=851 for f in frames),(name,'skipped a card')
            signed=1 if target else -1
            bins=[];start=after[0]
            for f in after[1:]:
                if f['t']-start['t']>=90:
                    bins.append(signed*(f['y']-start['y'])/(f['t']-start['t']));start=f
            if name=='light':
                # Low incoming speed cannot cover the remaining sheet by only
                # slowing. Keep the no-pause/reversal gates above; require one
                # bounded smooth hump, never a second acceleration after its peak.
                peak=max(range(len(bins)),key=lambda i:bins[i])
                assert max(bins)<1.2,(name,'velocity jump',bins)
                assert all(bins[i]-bins[i-1]<.25 for i in range(1,len(bins))),(name,'abrupt acceleration',bins)
                assert all(bins[i]<=bins[i-1]+.03 for i in range(peak+1,len(bins))),(name,'stop/restart after peak',bins)
            else:
                assert all(v<=bins[i-1]+.03 for i,v in enumerate(bins) if i),(name,'second acceleration',bins)
            trace['speed_bins_px_per_ms']=bins
            print(json.dumps({'case':name,'moving_frames_after_input':len(after),'end':frames[-1]['y'],'landing_ms':trace['landing_ms_after_last_input']}))
            page.close()
        page=browser.new_page(viewport={'width':1440,'height':1000})
        page.goto('http://127.0.0.1:5186/',wait_until='networkidle')
        page.mouse.wheel(0,280)
        page.wait_for_function('document.querySelector(".light-table").dataset.settling==="true"')
        before=page.evaluate('scrollY')
        page.mouse.wheel(0,-180)
        page.wait_for_timeout(50)
        assert page.evaluate('scrollY')<before,'reverse input did not take control'
        page.wait_for_function('scrollY===0 && document.querySelector(".light-table").dataset.settling==="false"',polling=50)
        page.locator('button[aria-label="Show Hoang Viet To"]').click()
        page.wait_for_function('scrollY===1700 && document.querySelector(".light-table").dataset.settling==="false"',polling=50)
        page.mouse.wheel(0,500);page.wait_for_timeout(100)
        below=page.evaluate('scrollY');assert below>1702
        page.wait_for_timeout(1200);assert page.evaluate('scrollY')==below,'pulled back from notes'
        report['interrupt_reverse_and_free_notes']='PASS'
        assert not report['errors'],report['errors']
        report['status']='PASS'
    except Exception as error:
        report.update(status='FAIL',error=str(error))
        raise
    finally:
        (OUT/'trace.json').write_text(json.dumps(report,indent=2))
        print(json.dumps({'status':report.get('status'),'evidence':str(OUT)}))
        browser.close()
