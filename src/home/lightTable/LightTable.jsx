import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HomePage } from '../../pages/Home'
import { GoalLoopPage } from '../../pages/GoalLoop'
import { GOAL_LOOP } from '../../content/goalLoop'
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

export function LightTable({pathname,onNavigate}) {
  const coldRef=useRef(pathname==='/gameonvb'),coldFragmentRef=useRef(coldRef.current)
  const watchColdRef=useRef(pathname==='/goal-loop'),watchFragmentRef=useRef(watchColdRef.current)
  const [mounted,setMounted]=useState(watchColdRef.current),[desired,setDesired]=useState(watchColdRef.current),[phase,setPhase]=useState(watchColdRef.current?'open':'table')
  const dialogRef=useRef(null),flowRef=useRef(null),restoreRef=useRef(null),desiredRef=useRef(watchColdRef.current),sourceRef=useRef(null),dialogScrollRef=useRef(0),watchBackRef=useRef(null)
  const [position,setPosition]=useState(0),[reduced,setReduced]=useState(false)
  const [ballMounted,setBallMounted]=useState(coldRef.current),[ballDesired,setBallDesired]=useState(coldRef.current),[ballPhase,setBallPhase]=useState(coldRef.current?'open':'table')
  const ballDialogRef=useRef(null),ballDesiredRef=useRef(coldRef.current),ballSourceRef=useRef(null),ballScrollRef=useRef(0),ballRestoreRef=useRef(null)
  const deckRef=useRef(null),assistRef=useRef(null),backRef=useRef(null)
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
    if(want&&!ballDesiredRef.current){assistRef.current?.cancel();if(!ballRestoreRef.current)ballScrollRef.current=scrollY}
    ballDesiredRef.current=want;setBallDesired(want);if(want&&!restoreRef.current)setBallMounted(true);else if(!want&&!ballRestoreRef.current)setBallMounted(false)
    const watchWant=pathname==='/goal-loop'
    if(watchWant&&!desiredRef.current){assistRef.current?.cancel();if(!restoreRef.current)dialogScrollRef.current=scrollY}
    desiredRef.current=watchWant;setDesired(watchWant);if(watchWant&&!ballRestoreRef.current)setMounted(true);else if(!watchWant&&!restoreRef.current)setMounted(false)
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
    const anchor=()=>{if(ballDesiredRef.current||desiredRef.current)scrollStoryAnchor()}
    document.addEventListener('keydown',escape);addEventListener('hashchange',anchor)
    return ()=>{document.removeEventListener('keydown',escape);removeEventListener('hashchange',anchor)}
  },[])
  function select(index){if(assistRef.current)assistRef.current.move(index);else window.scrollTo({top:index*innerHeight*.85,behavior:'instant'})}
  function enter(event){
    const destination=getRouteNavigationUrl({href:event.currentTarget.getAttribute('href'),currentUrl:location.href,button:event.button,defaultPrevented:event.defaultPrevented,altKey:event.altKey,ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:event.shiftKey,target:event.currentTarget.target,download:event.currentTarget.hasAttribute('download')})
    if(destination==='/gameonvb'){assistRef.current?.cancel();ballSourceRef.current=event.currentTarget;if(!ballRestoreRef.current)ballScrollRef.current=scrollY}
    if(destination==='/goal-loop'){assistRef.current?.cancel();sourceRef.current=event.currentTarget;if(!restoreRef.current)dialogScrollRef.current=scrollY}
    onNavigate(event)
  }
  function back(event){
    if(!event){if(desiredRef.current)watchBackRef.current?.click();return}
    const destination=getRouteNavigationUrl({href:'/',currentUrl:location.href,button:event.button,defaultPrevented:event.defaultPrevented,altKey:event.altKey,ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:event.shiftKey,target:event.currentTarget.target,download:false})
    if(!destination)return
    if(!desiredRef.current){event.preventDefault();return}
    desiredRef.current=false;setDesired(false)
    if(!watchColdRef.current&&!location.hash&&history.state?.lightTableFromHome===true){event.preventDefault();history.back()}
    else onNavigate(event)
  }
  function ballBack(event){
    if(!event){if(ballDesiredRef.current)backRef.current?.click();return}
    const destination=getRouteNavigationUrl({href:'/',currentUrl:location.href,button:event.button,defaultPrevented:event.defaultPrevented,altKey:event.altKey,ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:event.shiftKey,target:event.currentTarget.target,download:false})
    if(!destination)return
    if(!ballDesiredRef.current){event.preventDefault();return}
    ballDesiredRef.current=false;setBallDesired(false)
    if(!coldRef.current&&!location.hash&&history.state?.lightTableFromHome===true){event.preventDefault();history.back()}
    else onNavigate(event)
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
        deck.inert=false;deck.removeAttribute('aria-hidden');dialog.close();delete dialog.dataset.ballReady;document.body.style.overflow=previousOverflow;ballRestoreRef.current=null
        host.dispatchEvent(new Event('ballentrychange'))
      }
      function land(p){
        if(p){setBallPhase('open');return}
        restore();coldRef.current=false;setBallMounted(false);setBallPhase('table');window.scrollTo({top:ballScrollRef.current,behavior:'instant'})
        setPosition(deckPosition(scrollY,innerHeight*.85))
        const source=ballSourceRef.current,bounds=source?.getBoundingClientRect(),ctaVisible=source&&!source.hidden&&bounds&&bounds.top>=0&&bounds.bottom<=innerHeight&&Math.abs(ballScrollRef.current/(innerHeight*.85)-1)<=.02
        const focus=ctaVisible?source:deck.querySelector('button[aria-label="Show GameOnVB"]');focus?.focus({preventScroll:true})
        if(desiredRef.current)setMounted(true)

      }
      host.captureBallPreview?.()
      host.ballEntry={paint,resize,land,pose,choreography,orientation,source:sourceFrame,edgeTime,aspect:innerWidth/innerHeight,screenWidth:innerWidth,screenHeight:innerHeight,sourceScale};ballRestoreRef.current=restore
      surface.style.cssText=`position:fixed;inset:auto;left:0;top:0;width:${innerWidth}px;height:${innerHeight}px`
      host.ballView?.extend(innerWidth,innerHeight,sourceFrame);paint(coldRef.current?BALL_DURATION:0);dialog.querySelector('.entry-ball-slot').append(surface)
      if(dialog.open)dialog.close();dialog.show();dialog.scrollTop=0;dialog.dataset.ballReady='true';backRef.current?.focus({preventScroll:true});document.body.style.overflow='hidden';host.dispatchEvent(new Event('ballentrychange'))
      if(coldRef.current)scrollStoryAnchor()
    }
    setBallPhase(ballDesired?'entering':'leaving')
    // The ball component owns the sole RAF for both spin and flight. Layout runs
    // before its passive setup on a cold route; the event starts that setup.
    if(!ballDesired){dialog.scrollTop=0;host.dispatchEvent(new Event('ballentrychange'))}
    host.ballEntry.want=ballDesired;host.ballEntry.reduced=reduced
    host.ballFlow?.set(ballDesired,reduced)
  },[ballMounted,ballDesired,reduced])
  useLayoutEffect(()=>{
    if(!mounted)return
    const dialog=dialogRef.current,deck=deckRef.current,fan=deck.querySelector('.sheet-fan'),host=deck.querySelector('.watch-view'),surface=host.watchSurface
    if(!flowRef.current){
      const sheet=host.closest('.sheet'),box=sheet.getBoundingClientRect(),m=new DOMMatrix(getComputedStyle(sheet.parentElement).transform)
      const style=getComputedStyle(surface),w=parseFloat(style.width),h=parseFloat(style.height),b=surface.getBoundingClientRect()
      const visible=box.bottom>0&&box.top<innerHeight&&!sheet.closest('[inert]')
      const origin=visible?{a:m.a,b:m.b,c:m.c,d:m.d,x:b.x-Math.min(0,m.a*w)-Math.min(0,m.c*h),y:b.y-Math.min(0,m.b*w)-Math.min(0,m.d*h)}:{a:1,b:0,c:0,d:1,x:(innerWidth-w)/2,y:(innerHeight-h)/2}
      const previousOverflow=document.body.style.overflow,previousSurfaceStyle=surface.style.cssText,previousDeckStyle=deck.style.cssText,previousFanStyle=fan.style.cssText,footer=deck.querySelector('.table-footer'),previousFooterStyle=footer.style.cssText
      footer.style.setProperty('visibility','hidden','important')
      if(!sourceRef.current||sourceRef.current.hidden)sourceRef.current=sheet.querySelector('.sheet-cta:not([hidden])')||deck.querySelector('button[aria-label="Show Goal Loop"]')
      function paint(p){
        const scale=Math.min((innerWidth*(innerWidth>760?.64:1)-24)/w,(innerHeight-210)/h)
        const end={a:scale,b:0,c:0,d:scale,x:innerWidth*(innerWidth>760?.64:.5)-w*scale/2,y:innerHeight*.5-h*scale/2}
        const mix=k=>origin[k]+(end[k]-origin[k])*p
        // Transfer only the renderer-owned surface. Keep its canvas/camera backing.
        const affine=Object.fromEntries(['a','b','c','d','x','y'].map(k=>[k,mix(k)]))
        surface.style.transform=`matrix(${affine.a},${affine.b},${affine.c},${affine.d},${affine.x},${affine.y})`
        dialog.style.setProperty('--progress',String(p))
        const t=Math.max(0,Math.min(1,(p-.55)/.45));dialog.style.setProperty('--text',String(t*t*(3-2*t)))
        deck.style.opacity=String(1-p*.8);fan.style.transform=`translate(-50%,-50%) scale(${1-p*.035})`
        dialog.dataset.progress=p.toFixed(5);dialog.dataset.sourceAffine=JSON.stringify(affine)
      }
      function resize(){paint(flowRef.current?.state.position??(watchColdRef.current?1:0))}
      function restore(){
        removeEventListener('resize',resize)
        surface.style.cssText=previousSurfaceStyle;host.append(surface);delete host.watchEntry;const view=host.watchView;if(view?.resize())view.paint(view.pose.time,view.pose.open)
        dialog.close();delete dialog.dataset.watchReady;document.body.style.overflow=previousOverflow
        deck.style.cssText=previousDeckStyle;fan.style.cssText=previousFanStyle;footer.style.cssText=previousFooterStyle
        deck.inert=false;deck.removeAttribute('aria-hidden');restoreRef.current=null
        host.dispatchEvent(new Event('watchentrychange'))
      }
      restoreRef.current=restore
      function land(p){
        if(p){setPhase('open');return}
        restore();flowRef.current?.destroy();flowRef.current=null
        watchColdRef.current=false;setMounted(false);setPhase('table')
        window.scrollTo({top:dialogScrollRef.current,behavior:'instant'});setPosition(deckPosition(scrollY,innerHeight*.85))
        const source=sourceRef.current,bounds=source?.getBoundingClientRect(),ctaVisible=source&&!source.hidden&&bounds&&bounds.top>=0&&bounds.bottom<=innerHeight&&Math.abs(dialogScrollRef.current/(innerHeight*.85))<=.02
        const focus=ctaVisible?source:deck.querySelector('button[aria-label="Show Goal Loop"]');focus?.focus({preventScroll:true})
        if(ballDesiredRef.current)setBallMounted(true)
      }
      // Freeze the exact rendered reveal before focus/leave can change its target.
      host.watchEntry={pose:host.watchView?.pose,paint}
      surface.style.cssText=`position:fixed;inset:auto;left:0;top:0;width:${w}px;height:${h}px;transform-origin:0 0`
      paint(watchColdRef.current?1:0);dialog.querySelector('.entry-watch-slot').append(surface)
      if(dialog.open)dialog.close();dialog.show();dialog.scrollTop=0;dialog.dataset.watchReady='true';watchBackRef.current?.focus({preventScroll:true});document.body.style.overflow='hidden'
      flowRef.current=createWatchFlow(paint,land,{position:watchColdRef.current?1:0,velocity:0});host.watchEntry.flow=flowRef.current
      if(document.hidden)flowRef.current.pause()
      host.dispatchEvent(new Event('watchentrychange'));addEventListener('resize',resize)
      if(watchColdRef.current)scrollStoryAnchor()
    }
    setPhase(desired?'entering':'leaving')
    if(!desired)dialog.scrollTop=0
    flowRef.current.set(desired,reduced)
  },[mounted,desired,reduced])
  useLayoutEffect(()=>()=>{flowRef.current?.destroy();flowRef.current=null;restoreRef.current?.();ballRestoreRef.current?.()},[])
  const active=Math.round(position)
  return <div data-light-table-shell data-pathname={pathname}>
    <section className="light-table" ref={deckRef} data-position={position.toFixed(3)} data-phase={ballPhase} inert={ballRestoreRef.current||restoreRef.current?true:undefined} aria-hidden={ballMounted||mounted?true:undefined}>
      <div className="table-sticky">
        <h1 className="table-title"><span>New tools.</span><span>Old standards.</span></h1>
        <div className="sheet-fan" aria-label="Selected work">
          {sheets.map((sheet,index)=>{
            const p=sheetPose(index,position)
            return <div className="sheet-position" data-sheet={sheet.id} key={sheet.id} style={{'--x':p.x,'--y':p.y,'--rotation':`${p.rotation}deg`,'--scale':p.scale,opacity:p.opacity,zIndex:p.z}} inert={p.opacity===0?true:undefined}>
              <div className="sheet" onClick={event=>{if(!event.target.closest('a,button'))select(index)}}
                onPointerMove={event=>{if(reduced||event.pointerType==='touch')return;const b=event.currentTarget.getBoundingClientRect();event.currentTarget.style.setProperty('--mx',String((event.clientX-b.x)/b.width-.5));event.currentTarget.style.setProperty('--my',String((event.clientY-b.y)/b.height-.5))}}
                onPointerLeave={event=>{event.currentTarget.style.setProperty('--mx','0');event.currentTarget.style.setProperty('--my','0')}}>
                <button className="sheet-select" type="button" aria-label={`Inspect ${sheet.label} card`} aria-pressed={active===index} onClick={()=>select(index)} onFocus={event=>{if(event.currentTarget.matches(':focus-visible')&&!ballDesiredRef.current&&Math.abs(position-index)>.6)select(index)}}/>
                <div className="sheet-top"><span>0{index+1} / 03</span><span>{sheet.label}</span><i aria-hidden="true">+</i></div>
                {index===0?<Watch active={mounted||!!restoreRef.current||position<.7&&!ballMounted} reduced={reduced}/>:index===1?<Volleyball cold={coldRef.current} active={Math.abs(position-1)<.7&&!mounted&&!restoreRef.current||ballMounted} reduced={reduced}/>:<div className="intro-art" aria-hidden="true"><span>HVT</span><i/><i/><i/></div>}
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
        <div className="table-footer"><span>Scroll to deal.<br/>Reverse to collect.</span><nav aria-label="Selected sheets">{sheets.map((s,i)=><button type="button" key={s.id} aria-label={`Show ${s.label}`} aria-current={active===i?'true':undefined} onClick={()=>select(i)}>0{i+1}</button>)}</nav><span>Software.<br/>Systems.</span></div>
      </div>
    </section>
    <div inert={ballMounted||mounted?true:undefined} aria-hidden={ballMounted||mounted?true:undefined}><HomePage onNavigate={onNavigate}/></div>
    <dialog className="goal-entry" ref={dialogRef} open={watchColdRef.current||undefined} onCancel={event=>{event.preventDefault();back()}} aria-labelledby="goal-loop-title" data-phase={phase}>
      {mounted&&<GoalLoopPage onNavigate={event=>event.currentTarget.getAttribute('href')==='/'?back(event):onNavigate(event)} hero={
        <section className="light-table-hero" data-watch-hero aria-labelledby="goal-loop-title">
          <div className="entry-watch-slot" role="img" aria-label="The same skeleton wristwatch, enlarged"><div className="entry-wash" aria-hidden="true"/></div>
          <nav className="entry-header" aria-label="Goal Loop presentation"><a className="target-link" href="/" ref={watchBackRef} onClick={back}>← Back to homepage</a><span>Goal Loop / Run anatomy</span></nav>
          <div className="entry-caption"><h1 id="goal-loop-title">Precision,<br/>in motion.</h1><p>A system, made visible.</p><p>A watch anatomy study in ivory, steel, brass and leather.</p><p>Illustration, not a live Goal Loop run. No agents, project tests or deployments execute.</p><p>{GOAL_LOOP.hero.lede}</p><a className="target-link" href="#run-tape">Read the full run trace ↓</a></div>
        </section>
      }/>}
    </dialog>
    <dialog className="ball-entry" ref={ballDialogRef} open={coldRef.current||undefined} onCancel={event=>{event.preventDefault();ballBack()}} aria-labelledby="voleyevents-title" data-phase={ballPhase}>
      {ballMounted&&<VoleyEventsPage onNavigate={event=>event.currentTarget.getAttribute('href')==='/'?ballBack(event):onNavigate(event)} hero={
        <section className="staircase-entry light-table-hero" data-ball-hero aria-labelledby="voleyevents-title">
          <div className="entry-ball-slot" role="img" aria-label="The same volleyball landing on the upper stone tread">
            <div className="ball-entry-wash" aria-hidden="true"/>
            {coldRef.current&&<div className="cold-ball-fallback" data-cold-ball-fallback aria-hidden="true">
              <picture><source media="(max-width:760px)" srcSet={staticStepImage(staticLanding(.46,390))}/><img className="ball-steps-static" src={staticStepImage(staticLanding(1.44))} alt=""/></picture>
              <img className="cold-ball-static" src={ballPreview} alt=""/>
            </div>}
          </div>
          <nav className="entry-header" aria-label="GameOnVB presentation"><a className="target-link" href="/" ref={backRef} onClick={ballBack}>← Back to homepage</a><span>GameOnVB / Match operations</span></nav>
          <div className="ball-entry-copy">
            <div className="ball-entry-caption"><p>{VOLEYEVENTS.hero.eyebrow}</p><h1 id="voleyevents-title">More time on court.</h1><p>{VOLEYEVENTS.hero.title}</p></div>
            <nav className="ball-story-links" aria-label="Match operations stages">{VOLEYEVENTS.lifecycle.map(stage=><a className="target-link" href={`#${stage.id}`} key={stage.id}>{stage.label}</a>)}</nav>
          </div>
        </section>
      }/>}
    </dialog>
  </div>
}
