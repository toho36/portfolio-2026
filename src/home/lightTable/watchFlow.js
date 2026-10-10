// Critically damped progress: changing the destination keeps the current velocity.
export function stepWatchFlow(state,target,dt){
  if(!dt)return {...state}
  const omega=target?16:20,t=Math.max(0,dt),x=state.position-target,c=state.velocity+omega*x,e=Math.exp(-omega*t)
  const position=target+(x+c*t)*e,velocity=(state.velocity-omega*c*t)*e
  if(Math.abs(position-target)<.0005&&Math.abs(velocity)<.01)return {position:target,velocity:0}
  return {position:Math.max(0,Math.min(1,position)),velocity}
}
export function createWatchFlow(paint,land,initial={position:0,velocity:0}){
  let state={...initial},target=0,frame=0,last=null,paused=false,disposed=false,pendingReduced=false
  function stop(){cancelAnimationFrame(frame);frame=0;last=null}
  function schedule(){if(!disposed&&!paused&&!frame)frame=requestAnimationFrame(tick)}
  function snap(){pendingReduced=false;stop();state={position:target,velocity:0};paint(target);land(target)}
  function tick(now){
    frame=0;if(disposed||paused)return
    const dt=last===null?0:Math.min(.05,Math.max(0,(now-last)/1000));last=now
    state=stepWatchFlow(state,target,dt);paint(state.position)
    if(state.position===target&&!state.velocity){last=null;land(target)}else schedule()
  }
  return {
    set(want,reduced=false){if(disposed)return;target=want?1:0;pendingReduced=reduced;if(paused)return;if(reduced)snap();else{paint(state.position);schedule()}},
    pause(){paused=true;stop()},resume(){if(disposed)return;paused=false;if(pendingReduced)snap();else schedule()},
    destroy(){disposed=true;pendingReduced=false;stop()},
    get state(){return {...state}},get pending(){return Boolean(frame)},
  }
}
