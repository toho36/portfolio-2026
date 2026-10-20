import React,{useEffect,useLayoutEffect,useRef} from 'react'
import ballPreview from './assets/ball-preview.png'
import { createSpin, brushSpin, stepSpin, followPosition } from './ballMotion.js'
import { createBallFlow, BALL_DURATION, firstBallPose,advanceBallOrientation,bridgeBallSpin } from './ballFlow.js'
import { createBallPlay } from './ballPlay.js'

export function Volleyball({active,reduced,cold=false}) {
  const ref=useRef(null),timeRef=useRef(0),spinRef=useRef(createSpin()),previewRef=useRef(ballPreview),clockRef=useRef({time:cold?BALL_DURATION:0,velocity:0}),positionRef=useRef({x:0,y:0})
  useLayoutEffect(()=>{
    const host=ref.current,surface=document.createElement('div'),image=document.createElement('img')
    surface.className='ball-presentation';surface.dataset.runtime='static';image.className='ball-static';image.src=previewRef.current;image.alt='Static render of the same volleyball model'
    surface.append(image);host.append(surface);host.ballSurface=surface
    return ()=>{surface.remove();delete host.ballSurface}
  },[])
  useEffect(()=>{
    const host=ref.current,surface=host.ballSurface,image=surface.querySelector('img'),sheet=host.closest('.sheet'),doc=host.ownerDocument
    let canceled=false,view=null,tx=0,ty=0,lastPointer=null,following=false,loading=false,generation=0,failed=false,lastPaint=0,entryVisible=true
    const detail=()=>Boolean(host.ballEntry)
    const eligible=()=>!canceled&&!doc.hidden&&(detail()&&entryVisible||!detail()&&(active&&!sheet.closest('[inert]')&&!doc.querySelector('dialog[open]')))
    const deck=sheet.closest('.light-table')
    const sourceReady=()=>detail()||sheet.querySelector('.sheet-cta')?.hidden===false&&deck?.dataset.settling!=='true'
    function draw(state,dt){
      clockRef.current=state;host.dataset.pendingFrame='false';if(!eligible())return false
      timeRef.current+=dt;spinRef.current=stepSpin(spinRef.current,dt)
      const pos=positionRef.current,entry=host.ballEntry
      if(!entry){pos.x=followPosition(pos.x,tx,dt,following);pos.y=followPosition(pos.y,ty,dt,following);if(Math.abs(tx-pos.x)<.001)pos.x=tx;if(Math.abs(ty-pos.y)<.001)pos.y=ty}
      if(entry){advanceBallOrientation(entry,state.time,dt,state.velocity);entry.clockVelocity=state.velocity;host.dataset.logicalOrientation=JSON.stringify(entry.orientation);const initial=firstBallPose(entry,state.time),pose=initial??{...pos,time:timeRef.current,spin:spinRef.current};entry.ambientPose=pose;host.ballPlay?.step(state,dt);view?.paintEntry(state.time,pose.x,pose.y,pose.time,pose.spin,entry);entry.paint(state.time,view?.entryProjection)}
      else if(view&&timeRef.current-lastPaint>=.033){view.paint(pos.x,pos.y,timeRef.current,spinRef.current);lastPaint=timeRef.current}
      host.dataset.pendingFrame=String(Boolean(view&&!reduced||entry&&state.time>0&&state.time<BALL_DURATION))
      return Boolean(view&&!reduced)
    }
    host.captureBallPreview=()=>{if(view){previewRef.current=view.snapshotPose();image.src=previewRef.current;image.dataset.capture='ball'}}
    host.bridgeBallOrientation=()=>{
      const entry=host.ballEntry;if(!entry)return
      const pose={...positionRef.current,time:timeRef.current,spin:spinRef.current}
      spinRef.current=bridgeBallSpin(pose,entry.orientation)
      host.dataset.sourcePose=JSON.stringify({...pose,spin:spinRef.current})
    }
    const flow=createBallFlow(draw,p=>host.ballEntry?.land(p),clockRef.current)
    if(doc.hidden)flow.pause()
    host.ballFlow=flow
    function pointer(event){
      if(event.pointerType==='touch'||!view||detail())return
      following=true
      const b=sheet.getBoundingClientRect();tx=Math.max(-.5,Math.min(.5,(event.clientX-b.x)/b.width-.5));ty=Math.max(-.5,Math.min(.5,(event.clientY-b.y)/b.height-.5))
      const current={x:event.clientX,y:event.clientY,time:event.timeStamp}
      if(lastPointer){
        const box=host.getBoundingClientRect(),radius=Number(host.dataset.diameter)*box.height/host.clientHeight/2,motion=JSON.parse(host.dataset.motion)
        const cx=box.x+box.width/2+motion.position[0]*radius,cy=box.y+box.height/2-motion.position[1]*radius
        spinRef.current=brushSpin(spinRef.current,lastPointer,current,{x:cx,y:cy},radius)
      }
      lastPointer=current;flow.wake()
    }
    function reset(){if(detail())return;following=false;lastPointer=null;tx=ty=0;flow.wake()}
    function release(capture=true){
      generation++;loading=false;flow.pause();host.dataset.pendingFrame='false'
      const poseMetadata=Object.fromEntries(['pose','spin','time','sourcePose','quaternion','motion','diameter','projection','clearAlpha'].map(key=>[key,host.dataset[key]]))
      const old=view;view=null;delete host.ballView
      try{if(old&&capture){const pos=positionRef.current;if(detail()){const f=old.frame;image.src=old.snapshotPose();image.dataset.capture='scene';image.style.cssText=`left:0;top:0;width:${f.width}px;height:${f.height}px;object-fit:fill`;old.resize(host.ballEntry.source.width,host.ballEntry.source.height);previewRef.current=old.snapshot(pos.x,pos.y,timeRef.current,bridgeBallSpin({...pos,time:timeRef.current,spin:spinRef.current},host.ballEntry.orientation))}else{previewRef.current=old.snapshot(pos.x,pos.y,timeRef.current,spinRef.current);image.src=previewRef.current;image.dataset.capture='ball'}}}catch{/* Keep exact same-model preview. */}
      finally{for(const [key,value] of Object.entries(poseMetadata)){if(value===undefined)delete host.dataset[key];else host.dataset[key]=value}old?.destroy();if(!capture){image.src=previewRef.current;image.dataset.capture='ball';image.style.cssText=''}host.dataset.runtime=surface.dataset.runtime='static'}
    }
    function load(){
      if(!eligible())return
      if(host.ballEntry)host.ballEntry.resize(innerWidth,innerHeight)
      flow.resume();if(reduced||view||loading||failed||!sourceReady())return
      loading=true;const token=++generation
      Promise.all([import('three'),import('./ballScene.js')]).then(([T,{createVolleyball}])=>{
        if(canceled||token!==generation||!eligible()||!sourceReady())return
        view=createVolleyball(T,host,surface);host.ballView=view
        const pos=positionRef.current,entry=host.ballEntry
        if(entry){
          const initial=firstBallPose(entry,flow.state.time),pose=initial??{...pos,time:timeRef.current,spin:spinRef.current}
          view.resize(entry.source.width,entry.source.height);view.paint(pose.x,pose.y,pose.time,pose.spin)
          view.extend(entry.screenWidth,entry.screenHeight,entry.source);view.paintEntry(flow.state.time,pose.x,pose.y,pose.time,pose.spin,entry)
          entry.paint(flow.state.time,view.entryProjection)
        }else view.paint(pos.x,pos.y,timeRef.current,spinRef.current)
        host.dataset.runtime=surface.dataset.runtime='webgl';flow.wake()
      }).catch(()=>{if(token===generation){failed=true;host.dataset.runtime=surface.dataset.runtime='static'}}).finally(()=>{if(token===generation){loading=false;retrySource()}})
    }
    function visibility(){if(doc.hidden)release();else load()}
    function contextLost(event){event.preventDefault();failed=true;release(false);load()}
    function retrySource(){if(!view&&!loading&&!reduced&&!failed&&eligible()&&sourceReady())load()}
    const sourceObserver=deck?new MutationObserver(retrySource):null
    sourceObserver?.observe(deck,{attributes:true,attributeFilter:['data-position','data-settling']})
    const intersection=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
      const next=entries[0]?.isIntersecting??true;if(next===entryVisible)return
      entryVisible=next;if(next)load();else release()
    })
    function observeEntry(){intersection?.disconnect();entryVisible=true;if(detail())intersection?.observe(surface.closest('.entry-ball-slot'))}
    function entryChanged(){observeEntry();lastPointer=null;following=false;tx=ty=0;if(!detail()){image.src=previewRef.current;image.dataset.capture='ball'}load()}
    const resizePresentation=()=>{
      if(detail()){
        if(!eligible())return
        host.ballEntry.resize(innerWidth,innerHeight);view?.resizeEntry(innerWidth,innerHeight);draw(flow.state,0)
      }else{view?.resize();flow.wake()}
    }
    const resize=new ResizeObserver(resizePresentation);resize.observe(surface)
    doc.defaultView?.addEventListener('resize',resizePresentation)
    sheet.addEventListener('pointermove',pointer);sheet.addEventListener('pointerleave',reset);doc.addEventListener('visibilitychange',visibility);surface.addEventListener('webglcontextlost',contextLost,true);host.addEventListener('ballentrychange',entryChanged)
    if(reduced){image.src=previewRef.current;image.dataset.capture='ball';image.style.cssText=''}
    observeEntry();load()
    if(host.ballEntry)flow.set(host.ballEntry.want,reduced)
    return ()=>{canceled=true;sourceObserver?.disconnect();release();flow.destroy();intersection?.disconnect();resize.disconnect();doc.defaultView?.removeEventListener('resize',resizePresentation);sheet.removeEventListener('pointermove',pointer);sheet.removeEventListener('pointerleave',reset);doc.removeEventListener('visibilitychange',visibility);surface.removeEventListener('webglcontextlost',contextLost,true);host.removeEventListener('ballentrychange',entryChanged);if(host.ballFlow===flow){delete host.ballFlow;delete host.captureBallPreview;delete host.bridgeBallOrientation}}
  },[active,reduced])
  useEffect(()=>{
    // The landed hero ball can be thrown down the stairs; the ball RAF steps it via host.ballPlay.
    const host=ref.current,play=createBallPlay(host.ballSurface,{view:()=>reduced?null:host.ballView,entry:()=>host.ballEntry,wake:()=>host.ballFlow?.wake()})
    host.ballPlay=play
    return ()=>{play.destroy();if(host.ballPlay===play)delete host.ballPlay}
  },[reduced])
  return <div className="volleyball-view" ref={ref} data-runtime="static" role="img" aria-label="Volleyball preview"/>
}
