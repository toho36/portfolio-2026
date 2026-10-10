import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CONTACT } from '../../src/content/systems'
import { Volleyball } from './Volleyball.jsx'
import { Watch } from './Watch.jsx'
import { createDeckAssist } from './deckAssist.js'
import { createWatchFlow } from './watchFlow.js'
import { BALL_DURATION,createBallChoreography,captureBallOrientation,ballEase } from './ballFlow.js'
import { ballEntryPresentation,ballContactLayout } from './ballScene.js'
import { staticLanding, staticStepImage } from './ballSteps.js'
import { deckPosition, sheetPose } from './model.js'
import './study.css'

const sheets = [
  { id: 'goal-loop', label: 'Goal Loop', title: <>Precision,<br/>in motion.</>, href: '#goal-loop' },
  { id: 'gameonvb', label: 'GameOnVB', title: <>More time<br/>on court.</>, href: '#gameonvb' },
  { id: 'intro', label: 'Hoang Viet To', title: <>New tools.<br/>Old standards.</>, href: 'http://127.0.0.1:5181/' },
]

function App() {
  const [position,setPosition] = useState(0)
  const [reduced,setReduced] = useState(false)
  const [mounted,setMounted] = useState(false)
  const [desired,setDesired] = useState(false)
  const [ballMounted,setBallMounted]=useState(false),[ballDesired,setBallDesired]=useState(false),[ballPhase,setBallPhase]=useState('table')
  const ballDialogRef=useRef(null),ballDesiredRef=useRef(false),ballSourceRef=useRef(null),ballScrollRef=useRef(0),ballRestoreRef=useRef(null)
  const dialogRef = useRef(null), flowRef = useRef(null), sourceRef = useRef(null)
  const desiredRef = useRef(false), dialogScrollRef = useRef(0)
  const deckRef=useRef(null),assistRef=useRef(null),restoreRef=useRef(null)

  const [phase,setPhase] = useState('table')
  useEffect(() => {
    const media=matchMedia('(prefers-reduced-motion: reduce)')
    const assist=createDeckAssist(deckRef.current,()=>media.matches);assistRef.current=assist
    const update=()=>{if(!ballRestoreRef.current)setPosition(deckPosition(scrollY,innerHeight*.85))}
    const preference=()=>setReduced(media.matches)
    const sync=()=>{const want=location.hash==='#goal-loop';if(want&&!desiredRef.current){assist.cancel();if(!dialogRef.current.open)dialogScrollRef.current=scrollY}desiredRef.current=want;setDesired(want);if(want&&!ballRestoreRef.current)setMounted(true);const ballWant=location.hash==='#gameonvb';if(ballWant&&!ballDesiredRef.current){assist.cancel();if(!ballDialogRef.current.open)ballScrollRef.current=scrollY}ballDesiredRef.current=ballWant;setBallDesired(ballWant);if(ballWant&&!restoreRef.current)setBallMounted(true)}
    preference();update();sync()
    addEventListener('scroll',update,{passive:true});addEventListener('resize',update);addEventListener('popstate',sync);addEventListener('hashchange',sync);media.addEventListener('change',preference)
    return ()=>{assist.destroy();assistRef.current=null;removeEventListener('scroll',update);removeEventListener('resize',update);removeEventListener('popstate',sync);removeEventListener('hashchange',sync);media.removeEventListener('change',preference)}
  },[])
  function select(index) { if(assistRef.current)assistRef.current.move(index);else window.scrollTo({top:index*innerHeight*.85,behavior:'instant'}) }
  function enter(event) {
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return
    assistRef.current?.cancel();event.preventDefault()
    if(event.currentTarget.closest('[data-sheet]').dataset.sheet==='gameonvb'){
      ballSourceRef.current=event.currentTarget;if(!ballDialogRef.current.open)ballScrollRef.current=scrollY
      history.pushState({lightTable:true},'','#gameonvb');ballDesiredRef.current=true;setBallDesired(true);if(!restoreRef.current)setBallMounted(true);return
    }
    sourceRef.current=event.currentTarget
    if(!dialogRef.current.open)dialogScrollRef.current=scrollY
    history.pushState({lightTable:true},'', '#goal-loop');desiredRef.current=true;setDesired(true);if(!ballRestoreRef.current)setMounted(true)
  }
  function back() {
    if(!desiredRef.current)return
    desiredRef.current=false;setDesired(false)
    if(history.state?.lightTable)history.back()
    else history.replaceState(null,'',location.pathname+location.search)
  }
  function ballBack(){
    if(!ballDesiredRef.current)return
    ballDesiredRef.current=false;setBallDesired(false)
    if(history.state?.lightTable)history.back();else history.replaceState(null,'',location.pathname+location.search)
  }
  useLayoutEffect(()=>{
    if(!ballMounted)return
    const dialog=ballDialogRef.current,deck=deckRef.current,host=deck.querySelector('.volleyball-view'),surface=host.ballSurface
    if(!host.ballEntry){
      const sheet=host.closest('.sheet'),box=sheet.getBoundingClientRect(),positionStyle=getComputedStyle(sheet.parentElement),m=new DOMMatrix(positionStyle.transform),style=getComputedStyle(surface),w=parseFloat(style.width),h=parseFloat(style.height),sourceBox=surface.getBoundingClientRect()
      const visible=box.bottom>0&&box.top<innerHeight&&!sheet.closest('[inert]')
      const fan=deck.querySelector('.sheet-fan'),fanBox=fan.getBoundingClientRect(),previousFanTransform=fan.style.transform
      const footer=deck.querySelector('.table-footer'),previousFooterStyle=footer.style.cssText,previousFanStyle=fan.style.cssText,previousSurfaceStyle=surface.style.cssText,previousImageStyle=surface.querySelector('img').style.cssText
      footer.style.setProperty('visibility','hidden','important')
      const previousFanFrame=Object.fromEntries(['width','height','left','top'].map(k=>[k,fan.style[k]])),fanStyle=getComputedStyle(fan)
      const previousFanOrigin=fan.style.transformOrigin,fanLeft=parseFloat(fanStyle.left),fanTop=parseFloat(fanStyle.top)
      const fanParent=fan.parentElement,fanParentOrigin=fanParent.getBoundingClientRect()
      // Keep the captured contact layout through a real viewport resize. Only
      // the shared contact translation moves it; responsive CSS resumes on return.
      for(const k of Object.keys(previousFanFrame))fan.style[k]=fanStyle[k]
      const [centerX,centerY]=positionStyle.transformOrigin.split(' ').map(parseFloat),center={x:centerX,y:centerY}
      // Transform actual layout points, including the card's translation and
      // transform origin. A rotated AABB is never a contact measurement.
      const cardAffine={a:m.a,b:m.b,c:m.c,d:m.d,x:fanBox.x+center.x+m.e-m.a*center.x-m.c*center.y,y:fanBox.y+center.y+m.f-m.b*center.x-m.d*center.y}
      const screen=(x,y)=>({x:cardAffine.x+m.a*x+m.c*y,y:cardAffine.y+m.b*x+m.d*y})
      // Retain step 1's exact source affine (including fractional CSS sizes).
      // Invert that point through the actual card affine for the contact lane.
      const screenOrigin={x:sourceBox.x-Math.min(0,m.a*w)-Math.min(0,m.c*h),y:sourceBox.y-Math.min(0,m.b*w)-Math.min(0,m.d*h)},det=m.a*m.d-m.b*m.c,dx=screenOrigin.x-cardAffine.x,dy=screenOrigin.y-cardAffine.y
      const localOrigin={x:(m.d*dx-m.c*dy)/det,y:(-m.b*dx+m.a*dy)/det}
      const origin=visible?{a:m.a,b:m.b,c:m.c,d:m.d,...screenOrigin}:{a:1,b:0,c:0,d:1,x:(innerWidth-w)/2,y:(innerHeight-h)/2}
      const frame=host.ballView?.frame
      const sourceFrame={width:w,height:h,origin,aspect:(frame?.width??surface.clientWidth??w)/(frame?.height??surface.clientHeight??h),viewport:{width:innerWidth,height:innerHeight}}
      const fanCards=[...fan.querySelectorAll('.sheet-position')].map(card=>card.getBoundingClientRect())
      sourceFrame.fanBottom=Math.max(...fanCards.map(card=>card.bottom))
      sourceFrame.fanBounds={left:Math.min(...fanCards.map(card=>card.left)),right:Math.max(...fanCards.map(card=>card.right)),top:Math.min(...fanCards.map(card=>card.top)),bottom:sourceFrame.fanBottom}
      const pose=host.dataset.sourcePose?JSON.parse(host.dataset.sourcePose):{x:0,y:0,time:0}
      const bandStyle=getComputedStyle(sheet.querySelector('.sheet-bottom'))
      // The label and CTA share this measured flex-content center. Border and
      // padding belong to the band; its separator is not a new support ledge.
      const bandY=sheet.clientTop+parseFloat(bandStyle.top)+(parseFloat(bandStyle.height)+parseFloat(bandStyle.paddingTop)+parseFloat(bandStyle.borderTopWidth)-parseFloat(bandStyle.paddingBottom)-parseFloat(bandStyle.borderBottomWidth))/2
      const supportLocal={x:localOrigin.x+w/2,y:bandY},cornerLocal={x:0,y:parseFloat(positionStyle.height)}
      const vertical=Math.max(2.6,2.6/sourceFrame.aspect),unit=h/vertical,xUnit=w/(vertical*sourceFrame.aspect),world=p=>[(p.x-localOrigin.x-w/2)/xUnit,-(p.y-localOrigin.y-h/2)/unit,0]
      const card={support:world(supportLocal),corner:world(cornerLocal),affine:cardAffine,width:parseFloat(positionStyle.width),height:parseFloat(positionStyle.height),supportScreen:screen(supportLocal.x,supportLocal.y),cornerScreen:screen(cornerLocal.x,cornerLocal.y)}
      const length=Math.hypot(card.cornerScreen.x-card.supportScreen.x,card.cornerScreen.y-card.supportScreen.y)
      card.tangentScreen=[(card.cornerScreen.x-card.supportScreen.x)/length,(card.cornerScreen.y-card.supportScreen.y)/length]
      card.normalScreen=[-card.tangentScreen[1],card.tangentScreen[0]]
      const choreography=createBallChoreography(card,pose),orientation=captureBallOrientation(pose);sourceFrame.contact=choreography
      let fallback=staticLanding(innerWidth/innerHeight,innerWidth)
      const staticSteps=document.createElement('img');staticSteps.className='ball-steps-static';staticSteps.alt='';staticSteps.src=staticStepImage(fallback)
      dialog.querySelector('.entry-ball-slot').append(staticSteps)
      const sourceScale=Math.hypot(origin.a,origin.b),previousOverflow=document.body.style.overflow
      const edgeTime=1.85,edgeY=card.cornerScreen.y,diameter=2*(pose.radius??1)*unit
      if(!ballSourceRef.current||ballSourceRef.current.hidden)ballSourceRef.current=sheet.querySelector('.sheet-cta:not([hidden])')||deck.querySelector('button[aria-label="Show GameOnVB"]')
      function paint(age,shared){
        const p=ballEase((age-edgeTime)/1.25)
        const projection=ballEntryPresentation(sourceFrame,innerWidth,innerHeight,age,host.ballEntry?.ambientPose),frame=shared?.affine??projection.affine,layout=ballContactLayout(sourceFrame,innerWidth,innerHeight),fanFrame=shared?.fanFrame??projection.fan
        const parent=fanParent.getBoundingClientRect(),left=fanLeft+fanParentOrigin.x,top=fanTop+fanParentOrigin.y
        fan.style.transformOrigin='0 0';fan.style.transform=`matrix(${fanFrame.a},${fanFrame.b},${fanFrame.c},${fanFrame.d},${fanFrame.x+(fanFrame.a-1)*left+fanFrame.c*top+fanParentOrigin.x-parent.x},${fanFrame.y+fanFrame.b*left+(fanFrame.d-1)*top+fanParentOrigin.y-parent.y}) ${previousFanTransform||'translate(-50%,-50%)'}`
        dialog.dataset.sourceAffine=JSON.stringify(frame);dialog.dataset.contactLayout=JSON.stringify(layout);dialog.dataset.fanFrame=JSON.stringify(fanFrame);dialog.dataset.cardAffine=JSON.stringify(shared?.cardAffine??{a:fanFrame.a*card.affine.a+fanFrame.c*card.affine.b,b:fanFrame.b*card.affine.a+fanFrame.d*card.affine.b,c:fanFrame.a*card.affine.c+fanFrame.c*card.affine.d,d:fanFrame.b*card.affine.c+fanFrame.d*card.affine.d,x:fanFrame.a*card.affine.x+fanFrame.c*card.affine.y+fanFrame.x,y:fanFrame.b*card.affine.x+fanFrame.d*card.affine.y+fanFrame.y});dialog.dataset.contactFrame=JSON.stringify(card)
        dialog.style.setProperty('--progress',String(p));dialog.style.setProperty('--reveal-edge',`${fanFrame.bottom}px`)
        dialog.dataset.progress=(age/BALL_DURATION).toFixed(5);dialog.dataset.flightTime=age.toFixed(5);dialog.dataset.edgeTime=String(edgeTime);dialog.dataset.edgeY=String(edgeY)
        // A last-pose capture already contains its scene. Cold fallback remains
        // the exact card ball preview; never introduce a different model.
        const image=surface.querySelector('img')
        staticSteps.style.opacity=host.dataset.runtime==='webgl'||image.dataset.capture==='scene'?'0':String(p)
        if(host.dataset.runtime!=='webgl'&&image.dataset.capture!=='scene'){
          const projection=ballEntryPresentation(sourceFrame,innerWidth,innerHeight,age,host.ballEntry?.ambientPose),det=frame.a*frame.d-frame.b*frame.c,lx=(frame.d*(projection.x-frame.x)-frame.c*(projection.y-frame.y))/det,ly=(-frame.b*(projection.x-frame.x)+frame.a*(projection.y-frame.y))/det
          const size=projection.diameter/(diameter*Math.hypot(frame.a,frame.b)),cx=w/2+(choreography.source[0]-choreography.anchor[0])*xUnit,cy=h/2-(choreography.source[1]-choreography.anchor[1])*unit
          image.style.width=`${w}px`;image.style.height=`${h}px`;image.style.transformOrigin='0 0'
          image.style.transform=`matrix(${frame.a},${frame.b},${frame.c},${frame.d},${frame.x},${frame.y}) translate(${lx-size*cx}px,${ly-size*cy}px) scale(${size})`
        }
      }
      function resize(screenWidth,screenHeight){
        host.ballEntry.screenWidth=screenWidth;host.ballEntry.screenHeight=screenHeight;host.ballEntry.aspect=screenWidth/screenHeight
        surface.style.width=`${screenWidth}px`;surface.style.height=`${screenHeight}px`
        fallback=staticLanding(screenWidth/screenHeight,screenWidth);staticSteps.src=staticStepImage(fallback)
        const image=surface.querySelector('img')
        if(image.dataset.capture==='scene'){image.style.width=`${screenWidth}px`;image.style.height=`${screenHeight}px`}
      }
      function restore(){
        host.bridgeBallOrientation?.()
        Object.assign(fan.style,previousFanFrame);fan.style.transform=previousFanTransform;fan.style.transformOrigin=previousFanOrigin
        fan.style.cssText=previousFanStyle;footer.style.cssText=previousFooterStyle
        staticSteps.remove();surface.style.cssText=previousSurfaceStyle;surface.querySelector('img').style.cssText=previousImageStyle;host.append(surface);delete host.ballEntry;host.ballView?.resize()
        const pose=host.dataset.sourcePose?JSON.parse(host.dataset.sourcePose):null
        if(pose)host.ballView?.paint(pose.x,pose.y,pose.time,pose.spin)
        dialog.close();document.body.style.overflow=previousOverflow;ballRestoreRef.current=null
        host.dispatchEvent(new Event('ballentrychange'))
      }
      function land(p){
        if(p){setBallPhase('open');return}
        restore();setBallMounted(false);setBallPhase('table');window.scrollTo({top:ballScrollRef.current,behavior:'instant'})
        setPosition(deckPosition(scrollY,innerHeight*.85))
        const source=ballSourceRef.current,bounds=source?.getBoundingClientRect(),ctaVisible=source&&!source.hidden&&bounds&&bounds.top>=0&&bounds.bottom<=innerHeight&&Math.abs(ballScrollRef.current/(innerHeight*.85)-1)<=.02
        const focus=ctaVisible?source:deck.querySelector('button[aria-label="Show GameOnVB"]');focus?.focus({preventScroll:true})
        if(desiredRef.current)setMounted(true)
      }
      host.captureBallPreview?.()
      host.ballEntry={paint,resize,land,pose,choreography,orientation,source:sourceFrame,edgeTime,aspect:innerWidth/innerHeight,screenWidth:innerWidth,screenHeight:innerHeight,sourceScale};ballRestoreRef.current=restore
      surface.style.cssText=`position:fixed;inset:auto;left:0;top:0;width:${innerWidth}px;height:${innerHeight}px`
      host.ballView?.extend(innerWidth,innerHeight,sourceFrame);paint(0);dialog.querySelector('.entry-ball-slot').append(surface)
      dialog.showModal();dialog.scrollTop=0;document.body.style.overflow='hidden';host.dispatchEvent(new Event('ballentrychange'))
    }
    setBallPhase(ballDesired?'entering':'leaving')
    // The ball component owns the sole RAF for both spin and flight. Layout runs
    // before its passive setup on direct hashes; the event starts that setup.
    host.ballEntry.want=ballDesired;host.ballEntry.reduced=reduced
    host.ballFlow?.set(ballDesired,reduced)
  },[ballMounted,ballDesired,reduced])
  useLayoutEffect(()=>()=>{ballRestoreRef.current?.()},[])
  useLayoutEffect(() => {
    if(!mounted)return
    const dialog=dialogRef.current,deck=deckRef.current,fan=deck.querySelector('.sheet-fan'),host=deck.querySelector('.watch-view'),surface=host.watchSurface
    if(!flowRef.current){
      const sheet=host.closest('.sheet'),box=sheet.getBoundingClientRect(),m=new DOMMatrix(getComputedStyle(sheet.parentElement).transform)
      const style=getComputedStyle(surface),w=parseFloat(style.width),h=parseFloat(style.height),b=surface.getBoundingClientRect()
      const visible=box.bottom>0&&box.top<innerHeight&&!sheet.closest('[inert]')
      const origin=visible?{a:m.a,b:m.b,c:m.c,d:m.d,x:b.x-Math.min(0,m.a*w)-Math.min(0,m.c*h),y:b.y-Math.min(0,m.b*w)-Math.min(0,m.d*h)}:{a:1,b:0,c:0,d:1,x:(innerWidth-w)/2,y:(innerHeight-h)/2}
      const previousOverflow=document.body.style.overflow
      if(!sourceRef.current||sourceRef.current.hidden)sourceRef.current=sheet.querySelector('.sheet-cta:not([hidden])')||deck.querySelector('.table-footer button')
      function paint(p){
        const scale=Math.min((innerWidth*(innerWidth>760?.64:1)-24)/w,(innerHeight-210)/h)
        const end={a:scale,b:0,c:0,d:scale,x:innerWidth*(innerWidth>760?.64:.5)-w*scale/2,y:innerHeight*.5-h*scale/2}
        const mix=k=>origin[k]+(end[k]-origin[k])*p
        // Only this imperative presentation moves. Its canvas size/camera never changes mid-flight.
        surface.style.transform=`matrix(${mix('a')},${mix('b')},${mix('c')},${mix('d')},${mix('x')},${mix('y')})`
        dialog.style.setProperty('--progress',String(p))
        const t=Math.max(0,Math.min(1,(p-.55)/.45));dialog.style.setProperty('--text',String(t*t*(3-2*t)))
        deck.style.opacity=String(1-p*.8);fan.style.transform=`translate(-50%,-50%) scale(${1-p*.035})`
        dialog.dataset.progress=p.toFixed(5)
      }
      function restore(){
        // Put the renderer-owned surface back before exposing the exact source sheet.
        surface.style.cssText='';host.append(surface);host.watchView?.resize()
        dialog.close();document.body.style.overflow=previousOverflow;deck.style.opacity='';fan.style.transform=''
        restoreRef.current=null
      }
      restoreRef.current=restore
      function land(p){
        if(p){setPhase('open');return}
        restore();flowRef.current?.destroy();flowRef.current=null
        setMounted(false);setPhase('table')
        window.scrollTo({top:dialogScrollRef.current,behavior:'instant'});sourceRef.current?.focus({preventScroll:true})
        if(ballDesiredRef.current)setBallMounted(true)
      }
      surface.style.cssText=`position:fixed;inset:auto;left:0;top:0;width:${w}px;height:${h}px;transform-origin:0 0`
      paint(0);dialog.querySelector('.entry-watch-slot').append(surface)
      dialog.showModal();dialog.scrollTop=0;document.body.style.overflow='hidden'
      // showModal may change focus and provoke pointerleave; the captured reveal stays intact.
      host.watchView?.resize()
      flowRef.current=createWatchFlow(paint,land)
      if(document.hidden)flowRef.current.pause()
    }
    setPhase(desired?'entering':'leaving');flowRef.current.set(desired,reduced)
  },[mounted,desired,reduced])
  useLayoutEffect(()=>()=>{flowRef.current?.destroy();flowRef.current=null;restoreRef.current?.()},[])
  useEffect(()=>{
    function visibility(){if(document.hidden)flowRef.current?.pause();else flowRef.current?.resume()}
    document.addEventListener('visibilitychange',visibility)
    return ()=>{document.removeEventListener('visibilitychange',visibility);flowRef.current?.destroy();flowRef.current=null}
  },[])
  const active=Math.round(position)
  return <>
    <main className="light-table" ref={deckRef} data-position={position.toFixed(3)} data-phase={phase}>
      <div className="table-sticky">
        <header className="table-header"><a href="http://127.0.0.1:5181/">Hoang Viet To</a><span>Light table / study 013</span><a href={CONTACT[0].href}>Contact ↗</a></header>
        <h1 className="table-title"><span>New tools.</span><span>Old standards.</span></h1>
        <div className="sheet-fan" aria-label="Three-sheet direction study">
          {sheets.map((sheet,index)=>{
            const p=sheetPose(index,position)
            return <div className="sheet-position" data-sheet={sheet.id} key={sheet.id} style={{'--x':p.x,'--y':p.y,'--rotation':`${p.rotation}deg`,'--scale':p.scale,opacity:p.opacity,zIndex:p.z}} inert={p.opacity===0?true:undefined}>
              <div className="sheet" onClick={event=>{if(!event.target.closest('a,button'))select(index)}}
                onPointerMove={event=>{if(reduced||event.pointerType==='touch')return;const b=event.currentTarget.getBoundingClientRect();event.currentTarget.style.setProperty('--mx',String((event.clientX-b.x)/b.width-.5));event.currentTarget.style.setProperty('--my',String((event.clientY-b.y)/b.height-.5))}}
                onPointerLeave={event=>{event.currentTarget.style.setProperty('--mx','0');event.currentTarget.style.setProperty('--my','0')}}>
                <button className="sheet-select" type="button" aria-label={`Inspect ${sheet.label} card`} aria-pressed={active===index} onClick={()=>select(index)} onFocus={event=>{if(event.currentTarget.matches(':focus-visible')&&!desiredRef.current&&!ballDesiredRef.current&&Math.abs(position-index)>.6)select(index)}}/>
                <div className="sheet-top"><span>0{index+1} / 03</span><span>{sheet.label}</span><i aria-hidden="true">+</i></div>
                {index===0?<Watch active={(position<.7||mounted)&&!ballMounted} reduced={reduced}/>:index===1?<Volleyball active={(Math.abs(position-1)<.7&&!mounted)||ballMounted} reduced={reduced}/>:<div className="intro-art" aria-hidden="true"><span>HVT</span><i/><i/><i/></div>}
                <h2>{sheet.title}</h2>
                <div className="sheet-bottom"><span>{index===0?'Anatomy / movement':index===1?'Recreational volleyball':'Software / systems'}</span><a className="sheet-cta" href={sheet.href} hidden={Math.abs(position-index)>.02} onClick={index<2?enter:undefined}
                  onPointerDown={event=>{if(event.isPrimary&&event.button===0)event.currentTarget.dataset.pressed='true'}}
                  onPointerUp={event=>{delete event.currentTarget.dataset.pressed}}
                  onPointerCancel={event=>{delete event.currentTarget.dataset.pressed}}
                  onPointerLeave={event=>{delete event.currentTarget.dataset.pressed}}
                  onBlur={event=>{delete event.currentTarget.dataset.pressed}}>View project <b aria-hidden="true">↗</b></a></div>
              </div>
            </div>
          })}
        </div>
        <footer className="table-footer"><span>Scroll to deal.<br/>Reverse to collect.</span><nav aria-label="Study sheets">{sheets.map((s,i)=><button type="button" key={s.id} aria-label={`Show ${s.label}`} aria-current={active===i?'true':undefined} onClick={()=>select(i)}>0{i+1}</button>)}</nav><span>DOM sheets.<br/>Illustrative watch.</span></footer>
      </div>
    </main>
    <aside className="study-notes"><span>Isolated direction proof. The portfolio is unchanged.</span><details><summary>Artwork credits</summary><p>Watch cover: live illustrative skeleton wristwatch, not a real-time clock. The prototype detail keeps the same watch renderer alive; the full case study is separate. Volleyball: live curved 3D panels, pebbled leather and angular momentum. Static previews are native captures of their models. Sheets: DOM/CSS transforms with interruptible scroll assistance. No agents or project checks execute here.</p></details></aside>
    <dialog className="goal-entry" ref={dialogRef} onCancel={event=>{event.preventDefault();back()}} aria-labelledby="entry-title" data-phase={phase}>
      {mounted&&<>
        <div className="entry-wash" aria-hidden="true"/>
        <header className="entry-header"><button type="button" autoFocus onClick={back}>← Back to table</button><span>Goal Loop / watch continuity prototype</span><a href="http://127.0.0.1:5181/goal-loop">Separate full case study ↗</a></header>
        <div className="entry-watch-slot" role="img" aria-label="The same skeleton wristwatch, enlarged"/>
        <div className="entry-caption"><h1 id="entry-title">Precision,<br/>in motion.</h1><p>A watch anatomy study in ivory, steel, brass and leather.</p><p>Illustrative movement. This prototype runs no agents or project checks.</p></div>
      </>}
    </dialog>
    <dialog className="ball-entry" ref={ballDialogRef} onCancel={event=>{event.preventDefault();ballBack()}} aria-labelledby="ball-entry-title" data-phase={ballPhase}>
      {ballMounted&&<>
        <div className="ball-entry-wash" aria-hidden="true"/>
        <header className="entry-header"><button type="button" autoFocus onClick={ballBack}>← Back to table</button><span>GameOnVB / landing prototype</span><a href="http://127.0.0.1:5181/gameonvb">Separate full case study ↗</a></header>
        <div className="entry-ball-slot" role="img" aria-label="The same volleyball landing on the upper stone tread"/>
        <div className="ball-entry-caption"><p>GameOnVB / match operations</p><h1 id="ball-entry-title">More time on court.</h1><p>Same ball. One upper-tread landing.</p></div>
      </>}
    </dialog>
  </>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
