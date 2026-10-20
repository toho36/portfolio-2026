import { createBall, launchBall, stepBall, constrainPosition, surfaceAt, clamp, RADIUS } from '../../gameonvb/stairBall'
import { BALL_DURATION } from './ballFlow.js'

// Screen point -> world point on the ball plane (z=0). The hero camera is orthographic, so three projected points define it.
export function screenToWorld(project,x,y){
  const o=project([0,0,0]),ux=project([1,0,0]),uy=project([0,1,0])
  const a=ux.x-o.x,b=ux.y-o.y,c=uy.x-o.x,d=uy.y-o.y,det=a*d-b*c,dx=x-o.x,dy=y-o.y
  if(!det)return {x:NaN,y:NaN}
  return {x:(d*dx-c*dy)/det,y:(-b*dx+a*dy)/det}
}

// After the card ball lands on the GameOnVB stairs, a grab handle lets mouse or finger throw it down the treads.
export function createBallPlay(surface,{view,entry,wake}){
  const doc=surface.ownerDocument,handle=doc.createElement('button')
  handle.type='button';handle.className='ball-play-handle';handle.hidden=true
  handle.setAttribute('aria-label','Volleyball. Drag and let go to throw it down the stairs, or press Enter to give it a push.')
  surface.append(handle)
  let drag=null,suppressClick=false
  const ready=state=>Boolean(view()&&entry()&&state.time>=BALL_DURATION&&state.velocity>=0)
  // Phones show only part of the stairs: the screen edges act as soft walls so the ball never leaves the view.
  function keepVisible(ball){
    const v=view(),o=v.projectEntry([0,0,0]),ux=v.projectEntry([1,0,0]),uy=v.projectEntry([0,1,0]),a=ux.x-o.x,c=uy.x-o.x,r=Math.abs(a)*RADIUS
    const width=surface.clientWidth||surface.getBoundingClientRect().width,min=(r+8-o.x-c*ball.y)/a,max=(width-r-8-o.x-c*ball.y)/a
    if(!a)return ball
    let next=ball
    if(ball.x>max)next={...ball,x:max,vx:ball.vx>0?-ball.vx*.4:ball.vx}
    else if(ball.x<min)next={...ball,x:min,vx:ball.vx<0?-ball.vx*.4:ball.vx}
    // A riser always wins over the wall, so the ball never sinks into the stone.
    return next===ball?ball:{...next,...constrainPosition(ball,next.x,next.y)}
  }
  function local(event){const r=surface.getBoundingClientRect();return screenToWorld(view().projectEntry,event.clientX-r.left,event.clientY-r.top)}
  function play(){const e=entry();return e.play??(e.play=createBall())}
  function launch(vx,vy){const e=entry();if(!e)return;e.play=launchBall(play(),vx,vy);wake()}
  function down(event){
    if(!view()||!entry()||!event.isPrimary||event.button>0)return
    event.preventDefault();handle.setPointerCapture?.(event.pointerId)
    const p=local(event),ball=play()
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return
    drag={id:event.pointerId,ox:p.x-ball.x,oy:p.y-ball.y,time:performance.now(),vx:0,vy:0,moved:false,start:{x:ball.x,y:ball.y}}
    entry().play={...ball,vx:0,vy:0,resting:true};handle.dataset.held='true';wake()
  }
  function move(event){
    if(!drag||event.pointerId!==drag.id||!entry())return
    const ball=play(),p=local(event),now=performance.now(),dt=Math.max((now-drag.time)/1000,.008)
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return
    const {x,y}=constrainPosition(ball,p.x-drag.ox,p.y-drag.oy)
    drag.vx=clamp((x-ball.x)/dt,-6,6);drag.vy=clamp((y-ball.y)/dt,-8,8);drag.time=now
    drag.moved||=Math.hypot(x-drag.start.x,y-drag.start.y)>.05
    entry().play={...ball,x,y,angle:ball.angle-(x-ball.x)/RADIUS,landing:surfaceAt(x).index};wake()
  }
  function up(event){
    if(!drag||event.pointerId!==drag.id)return
    const held=drag;drag=null;suppressClick=true;delete handle.dataset.held
    const fresh=performance.now()-held.time<120
    if(held.moved)launch(fresh?held.vx:0,fresh?held.vy:0);else launch()
  }
  function cancel(event){if(drag&&event.pointerId===drag.id){drag=null;delete handle.dataset.held;launch(0,0)}}
  function click(event){if(event.detail>0&&suppressClick){suppressClick=false;return}launch()}
  handle.addEventListener('pointerdown',down);handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',cancel);handle.addEventListener('click',click)
  return {
    // Called from the single ball RAF before the entry paint.
    step(state,dt){
      const e=entry()
      if(!ready(state)){
        if(drag&&handle.hasPointerCapture?.(drag.id))handle.releasePointerCapture(drag.id)
        drag=null;delete handle.dataset.held;handle.hidden=true
        if(!e)return
        // Leaving: glide a thrown ball back to the landing spot before the reverse flight takes over at 3.10 s.
        if(e.play&&state.time>=3.10){e.leaveFrom??={...e.play};const t=(state.time-3.10)/(BALL_DURATION-3.10),rest=createBall();e.play={...e.leaveFrom,x:rest.x+(e.leaveFrom.x-rest.x)*t,y:rest.y+(e.leaveFrom.y-rest.y)*t,angle:rest.angle+(e.leaveFrom.angle-rest.angle)*t,resting:true}}
        else{e.play=null;e.leaveFrom=null}
        return
      }
      e.leaveFrom=null
      if(e.play&&!drag)e.play=stepBall(e.play,dt)
      if(e.play)e.play=keepVisible(e.play)
      const ball=e.play??createBall(),v=view(),c=v.projectEntry([ball.x,ball.y,0]),edge=v.projectEntry([ball.x+RADIUS,ball.y,0])
      const size=Math.max(48,2*Math.hypot(edge.x-c.x,edge.y-c.y))
      handle.hidden=false;handle.style.cssText=`left:${c.x-size/2}px;top:${c.y-size/2}px;width:${size}px;height:${size}px`
    },
    get moving(){return Boolean(drag||entry()?.play&&!entry().play.resting)},
    destroy(){handle.remove()},
  }
}
