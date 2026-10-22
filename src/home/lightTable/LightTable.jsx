import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HomePage } from '../../pages/Home'
import { GoalLoopPage } from '../../pages/GoalLoop'
import { createWatchFlow } from './watchFlow.js'
import { VoleyEventsPage } from '../../pages/VoleyEvents'
import { VOLEYEVENTS } from '../../content/voleyevents'
import { getRouteNavigationUrl } from '../../content/routes'
import { Volleyball } from './Volleyball.jsx'
import { Watch } from './Watch.jsx'
import ballPreview from './assets/ball-preview.png'
import { createDeckAssist } from './deckAssist.js'
import { BALL_DURATION,createBallChoreography,captureBallOrientation,ballEase } from './ballFlow.js'
import { ballEntryPresentation,ballContactLayout } from './ballScene.js'
import { staticLanding, staticStepImage } from './ballSteps.js'
import { deckPosition, sheetPose } from './model.js'
import './lightTable.css'

const sheets = [
  { id: 'goal-loop', label: 'Goal Loop', title: <>Precision,<br/>in motion.</>, href: '/goal-loop' },
  { id: 'gameonvb', label: 'GameOnVB', title: <>More time<br/>on court.</>, href: '/gameonvb' },
  { id: 'intro', label: 'Hoang Viet To', title: <>New tools.<br/>Old standards.</>, href: '/#introduction' },
]

const ballIndex=sheets.findIndex(sheet=>sheet.id==='gameonvb'),watchIndex=sheets.findIndex(sheet=>sheet.id==='goal-loop')

export function LightTable({pathname,onNavigate}) {
  const coldRef=useRef(pathname==='/gameonvb'),coldFragmentRef=useRef(coldRef.current)
  const watchColdRef=useRef(pathname==='/goal-loop'),watchFragmentRef=useRef(watchColdRef.current)
  const [mounted,setMounted]=useState(watchColdRef.current),[desired,setDesired]=useState(watchColdRef.current),[phase,setPhase]=useState(watchColdRef.current?'open':'table')
  const dialogRef=useRef(null),flowRef=useRef(null),restoreRef=useRef(null),desiredRef=useRef(watchColdRef.current),sourceRef=useRef(null),watchBackRef=useRef(null)
  const [position,setPosition]=useState(0),[reduced,setReduced]=useState(false)
  const [ballMounted,setBallMounted]=useState(coldRef.current),[ballDesired,setBallDesired]=useState(coldRef.current),[ballPhase,setBallPhase]=useState(coldRef.current?'open':'table')
  const ballDialogRef=useRef(null),ballDesiredRef=useRef(coldRef.current),ballSourceRef=useRef(null),ballRestoreRef=useRef(null)
  const deckRef=useRef(null),assistRef=useRef(null),backRef=useRef(null),pendingFocusRef=useRef(null)
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)')
    const assist=createDeckAssist(deckRef.current,()=>media.matches);assistRef.current=assist
    const update=()=>{if(!ballRestoreRef.current&&!restoreRef.current)setPosition(deckPosition(scrollY,innerHeight*.85))}
    const preference=()=>setReduced(media.matches)
    preference();if(!coldRef.current)update()
    addEventListener('scroll',update,{passive:true});addEventListener('resize',update);media.addEventListener('change',preference)
    return ()=>{assist.destroy();assistRef.current=null;removeEventListener('scroll',update);removeEventListener('resize',update);media.removeEventListener('change',preference)}
  },[])
  useLayoutEffect(()=>{
    const want=pathname==='/gameonvb'
    pendingFocusRef.current=null
    if(want&&!ballDesiredRef.current)assistRef.current?.cancel()
    ballDesiredRef.current=want;setBallDesired(want);if(want&&!restoreRef.current)setBallMounted(true);else if(!want&&!ballRestoreRef.current){setBallMounted(false);if(ballDialogRef.current?.open)ballDialogRef.current.close()}
    const watchWant=pathname==='/goal-loop'
    if(watchWant&&!desiredRef.current)assistRef.current?.cancel()
    desiredRef.current=watchWant;setDesired(watchWant);if(watchWant&&!ballRestoreRef.current)setMounted(true);else if(!watchWant&&!restoreRef.current){setMounted(false);if(dialogRef.current?.open)dialogRef.current.close()}
    const dialog=ballDialogRef.current,header=deckRef.current.closest('.site-shell')?.querySelector(':scope > .site-header')
    if(!header)return
    const measure=()=>{const height=`${header.getBoundingClientRect().height}px`;dialog.style.setProperty('--shell-header-height',height);dialogRef.current.style.setProperty('--shell-header-height',height)}
    measure()
    const observer=new ResizeObserver(measure);observer.observe(header)
    return ()=>observer.disconnect()
  },[pathname])
  function scrollStoryAnchor(){
    if(!location.hash)return
    try{const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(ballDesiredRef.current&&ballDialogRef.current?.contains(target)||desiredRef.current&&dialogRef.current?.contains(target))target.scrollIntoView()}catch{/* An invalid fragment has no target. */}
  }
  useLayoutEffect(()=>{
    if(pathname!=='/gameonvb'){coldFragmentRef.current=false;return}
    const hash=location.hash
    if(!coldRef.current||!coldFragmentRef.current||!hash)return
    let frame=null
    const remove=()=>{removeEventListener('load',restore);removeEventListener('pageshow',restore)}
    const restore=()=>{
      if(frame!==null||document.readyState!=='complete')return
      remove()
      // Let one paint finish before restoring after native document/focus reset.
      frame=requestAnimationFrame(()=>{
        frame=requestAnimationFrame(()=>{
          coldFragmentRef.current=false
          if(coldRef.current&&ballDesiredRef.current&&location.pathname.replace(/\/+$/,'')==='/gameonvb'&&location.hash===hash)scrollStoryAnchor()
        })
      })
    }
    if(document.readyState==='complete')restore()
    else{addEventListener('load',restore);addEventListener('pageshow',restore)}
    return ()=>{remove();if(frame!==null)cancelAnimationFrame(frame)}
  },[pathname])
  useLayoutEffect(()=>{
    if(pathname!=='/goal-loop'){watchFragmentRef.current=false;return}
    const hash=location.hash
    if(!watchColdRef.current||!watchFragmentRef.current||!hash)return
    let frame=null
    const remove=()=>{removeEventListener('load',restore);removeEventListener('pageshow',restore)}
    const restore=()=>{
      if(frame!==null||document.readyState!=='complete')return
      remove()
      // Let one paint finish before restoring after native document/focus reset.
      frame=requestAnimationFrame(()=>{
        frame=requestAnimationFrame(()=>{
          watchFragmentRef.current=false
          if(watchColdRef.current&&desiredRef.current&&location.pathname.replace(/\/+$/,'')==='/goal-loop'&&location.hash===hash)scrollStoryAnchor()
        })
      })
    }
    if(document.readyState==='complete')restore()
    else{addEventListener('load',restore);addEventListener('pageshow',restore)}
    return ()=>{remove();if(frame!==null)cancelAnimationFrame(frame)}
  },[pathname])
  useEffect(()=>{
    const escape=event=>{if(event.key==='Escape'&&!event.defaultPrevented&&ballDesiredRef.current){event.preventDefault();ballBack()}else if(event.key==='Escape'&&!event.defaultPrevented&&desiredRef.current){event.preventDefault();back()}}
    const anchor=()=>{if(location.pathname==='/'&&location.hash==='#contact')assistRef.current?.cancel();if(ballDesiredRef.current||desiredRef.current)scrollStoryAnchor()}
    const contactClick=event=>{
      const link=event.target.closest?.('a[href="/#contact"]')
      if(!link||!getRouteNavigationUrl({href:'/',currentUrl:location.href,button:event.button,defaultPrevented:event.defaultPrevented,altKey:event.altKey,ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:event.shiftKey,target:link.target,download:link.hasAttribute('download')}))return
      assistRef.current?.cancel();document.dispatchEvent(new Event('homecontactready'))
    }
    document.addEventListener('keydown',escape);document.addEventListener('click',contactClick);addEventListener('hashchange',anchor)
    return ()=>{document.removeEventListener('keydown',escape);document.removeEventListener('click',contactClick);removeEventListener('hashchange',anchor)}
  },[])
  function select(index){if(assistRef.current)assistRef.current.move(index);else window.scrollTo({top:index*innerHeight*.85,behavior:'instant'})}
  function enter(event){
    const destination=getRouteNavigationUrl({href:event.currentTarget.getAttribute('href'),currentUrl:location.href,button:event.button,defaultPrevented:event.defaultPrevented,altKey:event.altKey,ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:event.shiftKey,target:event.currentTarget.target,download:event.currentTarget.hasAttribute('download')})
    if(destination==='/gameonvb'){assistRef.current?.cancel();ballSourceRef.current=event.currentTarget;pendingFocusRef.current=null}
    if(destination==='/goal-loop'){assistRef.current?.cancel();sourceRef.current=event.currentTarget;pendingFocusRef.current=null}
    onNavigate(event)
  }
  function back(event){
    if(!event){if(desiredRef.current)watchBackRef.current?.click();return}
    const contact=event.currentTarget.getAttribute?.('href')==='/#contact'
    const destination=getRouteNavigationUrl({href:'/',currentUrl:location.href,button:event.button,defaultPrevented:event.defaultPrevented,altKey:event.altKey,ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:event.shiftKey,target:event.currentTarget.target,download:false})
    if(!destination)return
    if(!desiredRef.current){event.preventDefault();return}
    desiredRef.current=false;setDesired(false)
    if(!contact&&!location.hash&&history.state?.lightTableFromHome===true){event.preventDefault();history.back()}
    else onNavigate(event)
  }
  function ballBack(event){
    if(!event){if(ballDesiredRef.current)backRef.current?.click();return}
    const contact=event.currentTarget.getAttribute?.('href')==='/#contact'
    const destination=getRouteNavigationUrl({href:'/',currentUrl:location.href,button:event.button,defaultPrevented:event.defaultPrevented,altKey:event.altKey,ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:event.shiftKey,target:event.currentTarget.target,download:false})
    if(!destination)return
    if(!ballDesiredRef.current){event.preventDefault();return}
    ballDesiredRef.current=false;setBallDesired(false)
    if(!contact&&!location.hash&&history.state?.lightTableFromHome===true){event.preventDefault();history.back()}
    else onNavigate(event)
  }
  useLayoutEffect(()=>{
    if(!ballMounted)return
    const dialog=ballDialogRef.current,deck=deckRef.current,host=deck.querySelector('.volleyball-view'),surface=host.ballSurface
    if(!host.ballEntry){
      if(!ballDesiredRef.current||restoreRef.current)return
      assistRef.current?.cancel()
      // Capture the authored source only after its front pose has committed.
      // A cold route is already mounted, so mounting alone is no render boundary.
      if(Math.abs(position-ballIndex)>.02){
        window.scrollTo({top:ballIndex*innerHeight*.85,behavior:'instant'});setPosition(ballIndex);return
      }
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
        deck.inert=false;deck.removeAttribute('aria-hidden');dialog.close();delete dialog.dataset.ballReady;document.body.style.overflow=previousOverflow;ballRestoreRef.current=null
        host.dispatchEvent(new Event('ballentrychange'))
      }
      function land(p){
        if(p){setBallPhase('open');return}
        restore();coldRef.current=false;setBallMounted(false);setBallPhase('table');window.scrollTo({top:ballIndex*innerHeight*.85,behavior:'instant'})
        setPosition(ballIndex)
        pendingFocusRef.current=desiredRef.current?null:{id:'gameonvb',entry:false}
        if(desiredRef.current){watchColdRef.current=true;setMounted(true)}

      }
      host.captureBallPreview?.()
      host.ballEntry={paint,resize,land,pose,choreography,orientation,source:sourceFrame,edgeTime,aspect:innerWidth/innerHeight,screenWidth:innerWidth,screenHeight:innerHeight,sourceScale};ballRestoreRef.current=restore
      surface.style.cssText=`position:fixed;inset:auto;left:0;top:0;width:${innerWidth}px;height:${innerHeight}px`
      host.ballView?.extend(innerWidth,innerHeight,sourceFrame);paint(coldRef.current?BALL_DURATION:0);dialog.querySelector('.entry-ball-slot').append(surface)
      if(dialog.open)dialog.close();dialog.show();dialog.scrollTop=0;dialog.dataset.ballReady='true';pendingFocusRef.current={id:'gameonvb',entry:true};document.body.style.overflow='hidden';host.dispatchEvent(new Event('ballentrychange'))
      if(coldRef.current)scrollStoryAnchor()
    }
    setBallPhase(ballDesired?'entering':'leaving')
    // The ball component owns the sole RAF for both spin and flight. Layout runs
    // before its passive setup on a cold route; the event starts that setup.
    if(!ballDesired){dialog.scrollTop=0;host.dispatchEvent(new Event('ballentrychange'))}
    host.ballEntry.want=ballDesired;host.ballEntry.reduced=reduced
    // Leaving straight for Goal Loop (or arriving from it) snaps; the deck never shows.
    host.ballFlow?.set(ballDesired,reduced||(!ballDesired&&desiredRef.current)||(ballDesired&&coldRef.current))
  },[ballMounted,ballDesired,reduced,position])
  useLayoutEffect(()=>{
    if(!mounted)return
    const dialog=dialogRef.current,deck=deckRef.current,fan=deck.querySelector('.sheet-fan'),host=deck.querySelector('.watch-view')
    if(!flowRef.current){
      if(!desiredRef.current||ballRestoreRef.current)return
      const sheet=host.closest('.sheet')
      const previousOverflow=document.body.style.overflow,previousDeckStyle=deck.style.cssText,previousFanStyle=fan.style.cssText,footer=deck.querySelector('.table-footer'),previousFooterStyle=footer.style.cssText
      footer.style.setProperty('visibility','hidden','important')
      if(!sourceRef.current||sourceRef.current.hidden)sourceRef.current=sheet.querySelector('.sheet-cta:not([hidden])')||deck.querySelector('button[aria-label="Show Goal Loop"]')
      function paint(p){
        dialog.style.setProperty('--progress',String(p))
        deck.style.opacity=String(1-p*.8);fan.style.transform=`translate(-50%,-50%) scale(${1-p*.035})`
        dialog.dataset.progress=p.toFixed(5)
      }
      function visibility(){if(document.hidden)flowRef.current?.pause();else flowRef.current?.resume()}
      function restore(){
        document.removeEventListener('visibilitychange',visibility)
        dialog.close();delete dialog.dataset.watchReady;document.body.style.overflow=previousOverflow
        deck.style.cssText=previousDeckStyle;fan.style.cssText=previousFanStyle;footer.style.cssText=previousFooterStyle
        deck.inert=false;deck.removeAttribute('aria-hidden');restoreRef.current=null
      }
      restoreRef.current=restore
      function land(p){
        if(p){setPhase('open');return}
        restore();flowRef.current?.destroy();flowRef.current=null
        watchColdRef.current=false;setMounted(false);setPhase('table')
        window.scrollTo({top:watchIndex*innerHeight*.85,behavior:'instant'});setPosition(watchIndex)
        pendingFocusRef.current=ballDesiredRef.current?null:{id:'goal-loop',entry:false}
        if(ballDesiredRef.current){coldRef.current=true;setBallMounted(true)}
      }
      paint(watchColdRef.current?1:0)
      if(dialog.open)dialog.close();dialog.show();dialog.scrollTop=0;dialog.dataset.watchReady='true';pendingFocusRef.current={id:'goal-loop',entry:true};document.body.style.overflow='hidden'
      flowRef.current=createWatchFlow(paint,land,{position:watchColdRef.current?1:0,velocity:0})
      document.addEventListener('visibilitychange',visibility);visibility()
      if(watchColdRef.current)scrollStoryAnchor()
    }
    setPhase(desired?'entering':'leaving')
    if(!desired)dialog.scrollTop=0
    flowRef.current.set(desired,reduced||(!desired&&ballDesiredRef.current)||(desired&&watchColdRef.current))
  },[mounted,desired,reduced])
  useLayoutEffect(()=>{
    const pending=pendingFocusRef.current
    if(!pending)return
    let target
    if(pending.entry){
      const ball=pending.id==='gameonvb'
      if(!(ball?ballDesiredRef.current:desiredRef.current)){pendingFocusRef.current=null;return}
      if(!(ball?ballMounted:mounted)||!(ball?ballDialogRef.current:dialogRef.current)?.open)return
      target=(ball?backRef:watchBackRef).current
    }else{
      if(ballDesiredRef.current||desiredRef.current){pendingFocusRef.current=null;return}
      // Land may run synchronously under reduced motion. Hidden CTAs and inert
      // homepage content must commit before focus is resolved from the live DOM.
      if(ballMounted||mounted||ballRestoreRef.current||restoreRef.current)return
      if(location.hash==='#contact'){
        pendingFocusRef.current=null
        document.dispatchEvent(new Event('homecontactready'))
        return
      }
      const deck=deckRef.current,source=deck.querySelector(`[data-sheet="${pending.id}"] .sheet-cta`),bounds=source?.getBoundingClientRect()
      const visible=source&&!source.hidden&&!source.closest('[inert]')&&bounds.top>=0&&bounds.bottom<=innerHeight
      target=visible?source:deck.querySelector(`button[aria-label="Show ${sheets.find(sheet=>sheet.id===pending.id).label}"]`)
    }
    if(!target||target.hidden||target.closest('[inert]'))return
    pendingFocusRef.current=null;target.focus({preventScroll:true})
  })
  useLayoutEffect(()=>()=>{pendingFocusRef.current=null;flowRef.current?.destroy();flowRef.current=null;restoreRef.current?.();ballRestoreRef.current?.()},[])
  const active=Math.round(position)
  // A sideways finger swipe or mouse/pen drag deals the next or previous card; vertical scroll stays native.
  const swipeRef=useRef(null),draggedRef=useRef(false),activeRef=useRef(active),selectRef=useRef(select)
  activeRef.current=active;selectRef.current=select
  function swipeStart(event){draggedRef.current=false;swipeRef.current=event.isPrimary&&(event.pointerType==='touch'||event.button===0)?{x:event.clientX,y:event.clientY}:null}
  // The release can land outside the fan, so one window listener finishes (or drops) every gesture.
  useEffect(()=>{
    let timer=0,expire=0
    function end(event){
      const start=swipeRef.current;swipeRef.current=null;if(!start)return
      const dx=event.clientX-start.x,dy=event.clientY-start.y
      if(Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy)*1.5)return
      // A mouse drag ends with a click on whatever is under the pointer; swallow only that click so a drag never opens a project.
      if(event.pointerType!=='touch'){draggedRef.current=true;clearTimeout(expire);expire=setTimeout(()=>{draggedRef.current=false},0)}
      const next=Math.max(0,Math.min(sheets.length-1,activeRef.current+(dx<0?1:-1)))
      // Run after the deck assist's own touchend settle, which would otherwise snap back.
      clearTimeout(timer);timer=setTimeout(()=>selectRef.current(next),0)
    }
    function cancel(){swipeRef.current=null}
    addEventListener('pointerup',end);addEventListener('pointercancel',cancel)
    return ()=>{removeEventListener('pointerup',end);removeEventListener('pointercancel',cancel);clearTimeout(timer);clearTimeout(expire);swipeRef.current=null;draggedRef.current=false}
  },[])
  return <div data-light-table-shell data-pathname={pathname}>
    <section className="light-table" ref={deckRef} data-position={position.toFixed(3)} data-phase={ballPhase} inert={ballRestoreRef.current||restoreRef.current?true:undefined} aria-hidden={ballMounted||mounted?true:undefined}>
      <div className="table-sticky">
        <h1 className="table-title"><span>New tools.</span><span>Old standards.</span></h1>
        <div className="sheet-fan" aria-label="Selected work" style={{touchAction:'pan-y'}} onPointerDown={swipeStart}
          onClickCapture={event=>{if(draggedRef.current){draggedRef.current=false;event.preventDefault();event.stopPropagation()}}} onDragStart={event=>event.preventDefault()}>
          {sheets.map((sheet,index)=>{
            const p=sheetPose(index,position)
            return <div className="sheet-position" data-sheet={sheet.id} key={sheet.id} style={{'--x':p.x,'--y':p.y,'--rotation':`${p.rotation}deg`,'--scale':p.scale,opacity:p.opacity,zIndex:p.z}} inert={p.opacity===0?true:undefined}>
              <div className="sheet" onClick={event=>{if(!event.target.closest('a,button'))select(index)}}
                onPointerMove={event=>{if(reduced||event.pointerType==='touch')return;const b=event.currentTarget.getBoundingClientRect();event.currentTarget.style.setProperty('--mx',String((event.clientX-b.x)/b.width-.5));event.currentTarget.style.setProperty('--my',String((event.clientY-b.y)/b.height-.5))}}
                onPointerLeave={event=>{event.currentTarget.style.setProperty('--mx','0');event.currentTarget.style.setProperty('--my','0')}}>
                <button className="sheet-select" type="button" aria-label={`Inspect ${sheet.label} card`} aria-pressed={active===index} onClick={()=>select(index)} onFocus={event=>{if(event.currentTarget.matches(':focus-visible')&&!ballDesiredRef.current&&Math.abs(position-index)>.6)select(index)}}/>
                <div className="sheet-top"><span>0{index+1} / 03</span><span>{sheet.label}</span><i aria-hidden="true">+</i></div>
                {index===0?<Watch active={position<.7&&!mounted&&!restoreRef.current&&!ballMounted} reduced={reduced}/>:index===1?<Volleyball cold={coldRef.current} active={Math.abs(position-1)<.7&&!mounted&&!restoreRef.current||ballMounted} reduced={reduced}/>:<div className="intro-art" aria-hidden="true"><span>HVT</span><i/><i/><i/></div>}
                <h2>{sheet.title}</h2>
                <div className="sheet-bottom"><span>{index===0?'Anatomy / movement':index===1?'Recreational volleyball':'Software / systems'}</span><a className="target-link sheet-cta" href={sheet.href} hidden={Math.abs(position-index)>.02} onClick={index<2?enter:undefined}
                  onPointerDown={event=>{if(event.isPrimary&&event.button===0)event.currentTarget.dataset.pressed='true'}}
                  onPointerUp={event=>{delete event.currentTarget.dataset.pressed}}
                  onPointerCancel={event=>{delete event.currentTarget.dataset.pressed}}
                  onPointerLeave={event=>{delete event.currentTarget.dataset.pressed}}
                  onBlur={event=>{delete event.currentTarget.dataset.pressed}}>View project <b aria-hidden="true">↗</b></a></div>
              </div>
            </div>
          })}
        </div>
        <div className="table-footer"><span>Scroll or swipe to deal.<br/>Reverse to collect.</span><nav aria-label="Selected sheets">{sheets.map((s,i)=><button type="button" key={s.id} aria-label={`Show ${s.label}`} aria-current={active===i?'true':undefined} onClick={()=>select(i)}>0{i+1}</button>)}</nav><span>Software.<br/>Systems.</span></div>
      </div>
    </section>
    <div inert={ballMounted||mounted?true:undefined} aria-hidden={ballMounted||mounted?true:undefined}><HomePage onNavigate={onNavigate}/></div>
    <dialog className="goal-entry" ref={dialogRef} open={watchColdRef.current||undefined} onCancel={event=>{event.preventDefault();back()}} aria-labelledby="goal-loop-title" data-phase={phase}>
      {mounted&&<GoalLoopPage backRef={watchBackRef} onNavigate={event=>['/','/#contact'].includes(event.currentTarget.getAttribute('href'))?back(event):onNavigate(event)}/>}
    </dialog>
    <dialog className="ball-entry" ref={ballDialogRef} open={coldRef.current||undefined} onCancel={event=>{event.preventDefault();ballBack()}} aria-labelledby="voleyevents-title" data-phase={ballPhase}>
      {ballMounted&&<VoleyEventsPage onNavigate={event=>['/','/#contact'].includes(event.currentTarget.getAttribute('href'))?ballBack(event):onNavigate(event)} hero={
        <section className="staircase-entry light-table-hero" data-ball-hero aria-label="GameOnVB: the volleyball on the stairs">
          <div className="entry-ball-slot" role="group" aria-label="The same volleyball landing on the upper stone tread">
            <div className="ball-entry-wash" aria-hidden="true"/>
            {coldRef.current&&<div className="cold-ball-fallback" data-cold-ball-fallback aria-hidden="true">
              <picture><source media="(max-width:760px)" srcSet={staticStepImage(staticLanding(.46,390))}/><img className="ball-steps-static" src={staticStepImage(staticLanding(1.44))} alt=""/></picture>
              <img className="cold-ball-static" src={ballPreview} alt=""/>
            </div>}
          </div>
          <nav className="entry-header" aria-label="GameOnVB presentation"><a className="target-link" href="/" ref={backRef} onClick={ballBack}>← Back to homepage</a><span>GameOnVB / Match operations</span></nav>
          <div className="ball-entry-copy">
            <div className="ball-entry-caption"><p className="ball-play-hint">{VOLEYEVENTS.hero.play}</p></div>
          </div>
        </section>
      }/>}
    </dialog>
  </div>
}
