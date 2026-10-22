import React,{useEffect,useLayoutEffect,useRef} from 'react'
// The Goal Loop card object. Historically a watch; now the owner-approved cloche (clocheScene.js).
import clochePreview from './assets/cloche-preview.png'
import { revealStep } from './watchModel.js'
export function Watch({active,reduced}) {
  const ref=useRef(null),poseRef=useRef({time:0,amount:0}),previewRef=useRef(null)
  useLayoutEffect(()=>{
    const host=ref.current,surface=document.createElement('div'),image=document.createElement('img')
    surface.className='watch-presentation';image.className='watch-static';image.src=clochePreview;image.alt='Static render of the same silver cloche on a plate'
    surface.append(image);host.append(surface);host.watchSurface=surface
    // The preview was captured at the desktop art box (aspect 1.2): fill its height, or its width when narrower.
    function fit(){if(previewRef.current)return;const wide=surface.clientWidth/Math.max(1,surface.clientHeight)>=1.2;image.style.height=wide?'100%':'auto';image.style.width=wide?'auto':'100%'}
    const resize=new ResizeObserver(fit);resize.observe(surface);fit()
    return ()=>{resize.disconnect();surface.remove();delete host.watchSurface}
  },[])
  useEffect(()=>{
    const host=ref.current,surface=host.watchSurface;if(!active)return
    const sheet=host.closest('.sheet'),doc=host.ownerDocument,image=surface.querySelector('img')
    let canceled=false,view=null,frame=0,last=null,lastPaint=0,target=0,pulseStart=poseRef.current.time,loading=false,generation=0,failed=false,onScreen=true
    const coarse=matchMedia('(pointer: coarse)').matches
    const eligible=()=>!canceled&&!doc.hidden&&onScreen&&!sheet.closest('[inert]')&&!doc.querySelector('dialog[open]')
    function stop(){cancelAnimationFrame(frame);frame=0;last=null;host.dataset.pendingFrame='false'}
    function schedule(){if(view&&eligible()&&!frame){frame=requestAnimationFrame(tick);host.dataset.pendingFrame='true'}}
    function tick(stamp){
      frame=0;host.dataset.pendingFrame='false';if(!eligible())return
      const dt=last===null?0:Math.max(0,Math.min(.05,(stamp-last)/1000));last=stamp
      const pose=poseRef.current;pose.time+=dt
      const age=pose.time-pulseStart
      pose.amount=revealStep(pose.amount,coarse?(age>.2&&age<.85?.65:0):target,dt)
      if(stamp-lastPaint>33){view.paint(pose.time,pose.amount);lastPaint=stamp}schedule()
    }
    function pointer(e){
      if(e.pointerType==='touch'||!view||coarse)return
      if(e.target.closest('.sheet-cta')||sheet.querySelector('.sheet-cta')===doc.activeElement){target=1;return}
      const b=sheet.getBoundingClientRect(),m=new DOMMatrix(getComputedStyle(sheet.parentElement).transform);m.e=m.f=0
      const p=new DOMPoint(e.clientX-b.x-b.width/2,e.clientY-b.y-b.height/2).matrixTransform(m.inverse())
      target=view.proximity(p.x+sheet.clientWidth/2-host.offsetLeft,p.y+sheet.clientHeight/2-host.offsetTop)
    }
    function focus(e){if(e.target.closest('.sheet-cta'))target=1}
    function reset(e){target=sheet.querySelector('.sheet-cta')===(e.type==='focusout'?e.relatedTarget:doc.activeElement)?1:0}
    function release(capture=true){
      stop();generation++;loading=false
      const old=view;view=null;delete host.watchView
      try{if(old&&capture){previewRef.current=old.snapshotPose();image.src=previewRef.current;image.style.width=image.style.height='100%'}}catch{/* Retain the last same-model preview. */}
      finally{old?.destroy();host.dataset.runtime=surface.dataset.runtime='static'}
    }
    function load(){
      if(view||loading||failed||reduced||!eligible())return
      loading=true;const token=++generation
      Promise.all([import('three'),import('./clocheScene.js')]).then(([T,{createCloche}])=>{
        if(canceled||token!==generation||!eligible())return
        view=createCloche(T,host,surface);view.paint(poseRef.current.time,poseRef.current.amount);host.watchView=view
        host.dataset.runtime=surface.dataset.runtime='webgl';schedule()
      }).catch(()=>{if(token===generation){failed=true;host.dataset.runtime=surface.dataset.runtime='static'}}).finally(()=>{if(token===generation)loading=false})
    }
    const intersection=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
      onScreen=entries.some(entry=>entry.isIntersecting);reconcile()
    })
    intersection?.observe(host)
    // The arena intro keeps the page inert; nothing else re-checks when it closes, so watch the gate.
    const gate=sheet.closest('[inert]'),gateObserver=gate&&typeof MutationObserver!=='undefined'?new MutationObserver(()=>reconcile()):null
    gateObserver?.observe(gate,{attributes:true,attributeFilter:['inert']})
    function reconcile(){
      if(!eligible())release()
      else load()
    }
    function visibility(){reconcile()}
    function lost(e){e.preventDefault();failed=true;release(false)}
    sheet.addEventListener('pointermove',pointer);sheet.addEventListener('pointerover',pointer);sheet.addEventListener('pointerleave',reset);sheet.addEventListener('focusin',focus);sheet.addEventListener('focusout',reset)
    doc.addEventListener('visibilitychange',visibility);surface.addEventListener('webglcontextlost',lost,true)
    const resize=new ResizeObserver(()=>{if(view?.resize())view.paint(poseRef.current.time,poseRef.current.amount)});resize.observe(surface)
    reconcile()
    return ()=>{canceled=true;release();resize.disconnect();intersection?.disconnect();gateObserver?.disconnect();sheet.removeEventListener('pointermove',pointer);sheet.removeEventListener('pointerover',pointer);sheet.removeEventListener('pointerleave',reset);sheet.removeEventListener('focusin',focus);sheet.removeEventListener('focusout',reset);doc.removeEventListener('visibilitychange',visibility);surface.removeEventListener('webglcontextlost',lost,true)}
  },[active,reduced])
  return <div className="watch-view" ref={ref} data-runtime="static" role="img" aria-label="A silver cloche on a plate, with a service bell"/>
}
