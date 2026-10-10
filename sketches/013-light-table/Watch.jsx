import React,{useEffect,useLayoutEffect,useRef} from 'react'
import { revealStep } from './watchModel.js'
export function Watch({active,reduced}) {
  const ref=useRef(null),poseRef=useRef({time:0,amount:0}),previewRef=useRef(null)
  useLayoutEffect(()=>{
    const host=ref.current,surface=document.createElement('div'),image=document.createElement('img')
    surface.className='watch-presentation';image.className='watch-static';image.src='/watch-preview.png';image.alt='Static render of the same skeleton wristwatch'
    surface.append(image);host.append(surface);host.watchSurface=surface
    function fit(){if(previewRef.current)return;const w=surface.clientWidth,h=surface.clientHeight,size=h*6.2/Math.max(6.2,4.2/(w/Math.max(1,h)));image.style.width=image.style.height=`${size}px`}
    const resize=new ResizeObserver(fit);resize.observe(surface);fit()
    return ()=>{resize.disconnect();surface.remove();delete host.watchSurface}
  },[])
  useEffect(()=>{
    const host=ref.current,surface=host.watchSurface;if(!active||reduced)return
    const sheet=host.closest('.sheet'),doc=host.ownerDocument,image=surface.querySelector('img')
    let canceled=false,view=null,frame=0,last=null,lastPaint=0,target=0,pulseStart=poseRef.current.time,loading=false,generation=0,failed=false,wasDetail=false
    const coarse=matchMedia('(pointer: coarse)').matches
    const detail=()=>Boolean(surface.closest('dialog[open]'))
    const eligible=()=>!canceled&&!doc.hidden&&(detail()||(!sheet.closest('[inert]')&&!doc.querySelector('dialog[open]')))
    function stop(){cancelAnimationFrame(frame);frame=0;last=null;host.dataset.pendingFrame='false'}
    function schedule(){if(view&&eligible()&&!frame){frame=requestAnimationFrame(tick);host.dataset.pendingFrame='true'}}
    function tick(stamp){
      frame=0;host.dataset.pendingFrame='false';if(!eligible())return
      const dt=last===null?0:Math.max(0,Math.min(.05,(stamp-last)/1000));last=stamp
      const pose=poseRef.current,inDetail=detail();pose.time+=dt
      if(inDetail&&!wasDetail)pose.amount=view.pose.open
      wasDetail=inDetail
      const age=pose.time-pulseStart
      if(!inDetail)pose.amount=revealStep(pose.amount,coarse?(age>.2&&age<.85?.65:0):target,dt)
      if(stamp-lastPaint>33){view.paint(pose.time,pose.amount);lastPaint=stamp}schedule()
    }
    function pointer(e){
      if(e.pointerType==='touch'||!view||coarse||detail())return
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
      if(view||loading||failed||!eligible())return
      loading=true;const token=++generation
      Promise.all([import('three'),import('./watchScene.js')]).then(([T,{createWatch}])=>{
        if(canceled||token!==generation||!eligible())return
        view=createWatch(T,host,surface);view.paint(poseRef.current.time,poseRef.current.amount);host.watchView=view
        host.dataset.runtime=surface.dataset.runtime='webgl';schedule()
      }).catch(()=>{if(token===generation){failed=true;host.dataset.runtime=surface.dataset.runtime='static'}}).finally(()=>{if(token===generation)loading=false})
    }
    function visibility(){if(doc.hidden)release();else load()}
    function lost(e){e.preventDefault();failed=true;release(false)}
    sheet.addEventListener('pointermove',pointer);sheet.addEventListener('pointerover',pointer);sheet.addEventListener('pointerleave',reset);sheet.addEventListener('focusin',focus);sheet.addEventListener('focusout',reset)
    doc.addEventListener('visibilitychange',visibility);surface.addEventListener('webglcontextlost',lost,true)
    const resize=new ResizeObserver(()=>{if(view?.resize())view.paint(poseRef.current.time,poseRef.current.amount)});resize.observe(surface)
    load()
    return ()=>{canceled=true;release();resize.disconnect();sheet.removeEventListener('pointermove',pointer);sheet.removeEventListener('pointerover',pointer);sheet.removeEventListener('pointerleave',reset);sheet.removeEventListener('focusin',focus);sheet.removeEventListener('focusout',reset);doc.removeEventListener('visibilitychange',visibility);surface.removeEventListener('webglcontextlost',lost,true)}
  },[active,reduced])
  return <div className="watch-view" ref={ref} data-runtime="static" role="img" aria-label="Skeleton wristwatch preview"/>
}
