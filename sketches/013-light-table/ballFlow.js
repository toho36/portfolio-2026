import {ballMotion,stepSpin,ballQuaternionMultiply} from './ballMotion.js'
export {ballQuaternionMultiply} from './ballMotion.js'

export const BALL_DURATION=3.55
export const BALL_BEATS={pop:.30,settle:.62,roll:1.70,corner:1.85,flight:3.10}
const gravity=12,air=1.25,roll=1.08,arc=.15
export const ballEase=p=>{p=Math.max(0,Math.min(1,p));return p*p*(3-2*p)}
const add=(a,b,s=1)=>a.map((v,i)=>v+b[i]*s)
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]

// Card points are measured source-local coordinates, before the world anchor.
export function createBallChoreography(card,pose){
  const sourceRadius=pose.radius??1,radius=sourceRadius*1.18
  const delta=card.corner.map((v,i)=>v-card.support[i]),distance=Math.hypot(...delta),tangent=delta.map(v=>v/distance),normal=[tangent[1],-tangent[0],0]
  const initialSpeed=.08*distance/roll,acceleration=2*(distance-initialSpeed*roll)/(roll*roll),rollSpeed=initialSpeed+acceleration*roll,exitSpeed=rollSpeed*.15,theta=(exitSpeed+(rollSpeed-exitSpeed)/11)*arc/radius
  const exitLocal=add(add(card.corner,normal,radius*Math.cos(theta)),tangent,radius*Math.sin(theta))
  const exitVelocity=tangent.map((v,i)=>exitSpeed*(v*Math.cos(theta)-normal[i]*Math.sin(theta)))
  const anchor=[-3.45,2.62,0].map((v,i)=>v-exitLocal[i]-exitVelocity[i]*air+(i===1?gravity*air*air/2:0))
  return {anchor,support:add(card.support,anchor),corner:add(card.corner,anchor),source:add(ballMotion(pose.time,pose.x,pose.y,pose.spin).position,anchor),tangent,normal,axis:cross(normal,tangent),distance,initialSpeed,acceleration,rollSpeed,exitSpeed,theta,exitVelocity,exit:add(exitLocal,anchor),radius,sourceRadius,card}
}
function hermite(a,b,va,vb,u,duration){
  const u2=u*u,u3=u2*u
  return {position:a.map((v,i)=>(2*u3-3*u2+1)*v+(u3-2*u2+u)*duration*va[i]+(-2*u3+3*u2)*b[i]+(u3-u2)*duration*vb[i]),
    velocity:a.map((v,i)=>((6*u2-6*u)*v+(3*u2-4*u+1)*duration*va[i]+(-6*u2+6*u)*b[i]+(3*u2-2*u)*duration*vb[i])/duration)}
}
export function ballFlight(time,c,pose){
  const t=Math.max(0,Math.min(BALL_DURATION,time)),{tangent,normal,radius}=c
  let phase,position,velocity,support=null,distance=0,speed=0,r=radius,rebound=false,ambientVelocity=[0,0,0]
  if(t<.30){
    phase='pop';position=add(c.source,[0,2*t-6*t*t,.9*Math.sin(Math.PI*t/.6)**2]);velocity=[0,2-12*t,.9*Math.PI/.6*Math.sin(2*Math.PI*t/.6)];r=c.sourceRadius*(1+.18*ballEase(t/.30))
    if(pose){
      // Both entry and return use the same two clocks. Current normal motion
      // owns the source endpoint; the captured world lane owns all contact.
      const current=ballMotion(pose.time,pose.x,pose.y,pose.spin).position,offset=current.map((v,i)=>v-(c.source[i]-c.anchor[i])),u=t/.30,weight=1-ballEase(u),derivative=-6*u*(1-u)/.30
      position=add(position,offset,weight);velocity=add(velocity,offset,derivative)
      ambientVelocity=[.07*.65*Math.cos(pose.time*.65)*weight,.045*.9*Math.cos(pose.time*.9)*weight,0]
    }
  }else if(t<.62){
    phase='settle';support=c.support;speed=c.initialSpeed*ballEase((t-.30)/.32)
    const contact=add(support,normal,radius)
    if(t<.50){
      const p=hermite(add(c.source,[0,.06,.9]),contact,[0,-1.6,0],[0,0,0],(t-.30)/.20,.20);position=p.position;velocity=p.velocity
    }else{
      const u=(t-.50)/.12,h=.035
      position=add(add(contact,normal,4*h*u*(1-u)),tangent,c.initialSpeed*.12*(u*u*u-u*u))
      velocity=add(normal.map(v=>v*4*h*(1-2*u)/.12),tangent,c.initialSpeed*(3*u*u-2*u));rebound=true
    }
  }else if(t<1.70){
    phase='rolling';const age=t-.62
    distance=c.initialSpeed*age+c.acceleration*age*age/2;speed=c.initialSpeed+c.acceleration*age
    support=add(c.support,tangent,distance);position=add(support,normal,radius);velocity=tangent.map(v=>v*speed)
  }else if(t<1.85){
    phase='corner';const age=t-1.70,u=age/arc,theta=(c.exitSpeed*age+(c.rollSpeed-c.exitSpeed)*arc/11*(1-(1-u)**11))/radius
    support=c.corner;distance=c.distance+radius*theta;speed=c.exitSpeed+(c.rollSpeed-c.exitSpeed)*(1-u)**10
    position=add(add(support,normal,radius*Math.cos(theta)),tangent,radius*Math.sin(theta))
    velocity=tangent.map((v,i)=>speed*(v*Math.cos(theta)-normal[i]*Math.sin(theta)))
  }else if(t<3.10){
    phase='freefall';const age=t-1.85
    position=add(c.exit,c.exitVelocity,age);position[1]-=gravity*age*age/2
    velocity=add(c.exitVelocity,[0,-gravity*age,0]);distance=c.distance+radius*c.theta;speed=c.exitSpeed;r=radius+(.92-radius)*ballEase(age/air)
  }else{
    phase=t<BALL_DURATION?'landing':'rest';const age=t-3.10
    position=[-3.45,2.62+(t<BALL_DURATION?2.7*age-6*age*age:0),0];velocity=t<BALL_DURATION?[0,2.7-12*age,0]:[0,0,0];r=.92;rebound=t>3.10&&t<BALL_DURATION
    distance=c.distance+radius*c.theta;speed=c.exitSpeed
  }
  return {phase,position,velocity,ambientVelocity,vy:velocity[1],radius:r,support,distance,speed,rollingAngle:distance/radius,rebound,angularVelocity:c.axis.map(v=>v*speed/radius)}
}

// Narrow entry quaternion state lives on the logical entry, outside GPU lifetime.
export function ballPoseQuaternion(pose){
  const [x,y,z]=ballMotion(pose.time,pose.x,pose.y,pose.spin).rotation.map(v=>v/2),sx=Math.sin(x),sy=Math.sin(y),sz=Math.sin(z),cx=Math.cos(x),cy=Math.cos(y),cz=Math.cos(z)
  const q=[sx*cy*cz+cx*sy*sz,cx*sy*cz-sx*cy*sz,cx*cy*sz+sx*sy*cz,cx*cy*cz-sx*sy*sz]
  const based=pose.spin?.basis?ballQuaternionMultiply(pose.spin.basis,q):q
  return pose.spin?.handoff?ballQuaternionMultiply(pose.spin.handoff.quaternion,based):based
}
export function captureBallOrientation(pose){
  const q=ballPoseQuaternion(pose),h=.00001,next=ballPoseQuaternion({...pose,time:pose.time+h,spin:pose.spin?stepSpin(pose.spin,h):undefined})
  const delta=ballQuaternionMultiply(next,[-q[0],-q[1],-q[2],q[3]])
  return {quaternion:q,angularVelocity:delta.slice(0,3).map(v=>v*2/h),residual:delta.slice(0,3).map(v=>v*2/h)}
}
export function bridgeBallSpin(pose,orientation){
  const spin={...pose.spin};delete spin.basis;delete spin.handoff
  const native=ballPoseQuaternion({...pose,spin})
  spin.basis=ballQuaternionMultiply(orientation.quaternion,[-native[0],-native[1],-native[2],native[3]])
  const velocity=captureBallOrientation({...pose,spin}).angularVelocity.map((v,i)=>orientation.angularVelocity[i]-v)
  if(Math.hypot(...velocity)>1e-5)spin.handoff={quaternion:[0,0,0,1],velocity}
  return spin
}
export function advanceBallOrientation(entry,age,dt,clockVelocity){
  const state=entry.orientation,c=entry.choreography,flight=ballFlight(age,c)
  if(!(dt>0))return
  const previousAge=state.age??age,reopening=state.clockVelocity<0&&clockVelocity>=0&&age>0,returning=clockVelocity<0||age<previousAge&&!reopening
  state.age=age;state.clockVelocity=clockVelocity
  let omega
  if(age<.30)omega=state.residual
  else if(age<1.85){
    const blend=ballEase((age-.30)/.32),kinematic=flight.angularVelocity,clockScale=returning?1:Math.abs(clockVelocity)
    omega=kinematic.map((v,i)=>v*clockScale*blend+state.residual[i]*(1-blend))
  }else omega=c.axis.map(v=>v*c.exitSpeed/c.radius*(1-ballEase((age-3.10)/.45)))
  // Rewind the path faster while carrying physical angular velocity continuously.
  if(returning){delete state.reopen;omega=state.angularVelocity.map((v,i)=>v+(omega[i]-v)*(1-Math.exp(-dt*8)))}
  // One finite transfer carries every world angular axis across a stopped
  // return clock. Keep it through support loss, including its air derivative.
  if(reopening||state.reopen&&previousAge<1.85&&age>=1.85)state.reopen={velocity:state.angularVelocity.map((v,i)=>v-omega[i]),elapsed:0}
  const path=clockVelocity>=0&&age>=.62&&age<=1.85&&previousAge>=.62&&previousAge<=1.85
  let rotation
  if(state.reopen){
    const transfer=state.reopen,duration=.32,a=Math.min(1,transfer.elapsed/duration),b=Math.min(1,(transfer.elapsed+dt)/duration),integral=u=>u-u*u*u+u*u*u*u/2
    const travel=duration*(integral(b)-integral(a))
    rotation=(path&&age<1.85?c.axis.map(v=>v*(flight.distance-ballFlight(previousAge,c).distance)/c.radius):omega.map(v=>v*dt)).map((v,i)=>v+transfer.velocity[i]*travel)
    omega=omega.map((v,i)=>v+transfer.velocity[i]*(1-ballEase(b)))
    transfer.elapsed=Math.min(duration,transfer.elapsed+dt)
    if(b===1)delete state.reopen
  }
  state.angularVelocity=omega
  if(rotation){
    const angle=Math.hypot(...rotation)/2,k=angle?Math.sin(angle)/(2*angle):0
    state.quaternion=ballQuaternionMultiply([...rotation.map(v=>v*k),Math.cos(angle)],state.quaternion)
  }else if(path){
    const angle=(flight.distance-ballFlight(previousAge,c).distance)/c.radius/2
    state.quaternion=ballQuaternionMultiply([...c.axis.map(v=>v*Math.sin(angle)),Math.cos(angle)],state.quaternion)
  }else{
    const speed=Math.hypot(...omega),angle=speed*dt/2,k=speed?Math.sin(angle)/speed:0
    state.quaternion=ballQuaternionMultiply([...omega.map(v=>v*k),Math.cos(angle)],state.quaternion)
  }
  const norm=Math.hypot(...state.quaternion);state.quaternion=state.quaternion.map(v=>v/norm)
}
export function stepBallFlow(state,target,dt){
  if(!(dt>0))return {...state}
  let {time,velocity}=state
  const count=Math.ceil(Math.min(.05,dt)*240),h=Math.min(.05,dt)/count,end=target?BALL_DURATION:0
  for(let i=0;i<count;i++){
    const distance=end-time,desired=target?1:-Math.min(3.5,Math.sqrt(48*Math.max(0,time))),acceleration=target?6:24
    velocity+=Math.max(-acceleration*h,Math.min(acceleration*h,desired-velocity));time+=velocity*h
    if(target&&time>=end||!target&&time<=0)return {time:end,velocity:0}
    if(Math.abs(distance)<.0005&&Math.abs(velocity)<.08)return {time:end,velocity:0}
  }
  return {time:Math.max(0,Math.min(BALL_DURATION,time)),velocity}
}
export function createBallFlow(paint,land,initial={time:0,velocity:0}){
  let state={...initial},target=0,frame=0,last=null,paused=false,disposed=false,announced=0,pendingReduced=false
  function stop(){cancelAnimationFrame(frame);frame=0;last=null}
  function schedule(){if(!disposed&&!paused&&!frame)frame=requestAnimationFrame(tick)}
  function snap(){pendingReduced=false;stop();state={time:target?BALL_DURATION:0,velocity:0};paint(state,0);announced=target;land(target)}
  function tick(now){
    frame=0;if(disposed||paused)return
    const dt=last===null?0:Math.min(.05,Math.max(0,(now-last)/1000));last=now
    state=stepBallFlow(state,target,dt);const alive=paint(state,dt)
    if(state.time===(target?BALL_DURATION:0)&&!state.velocity&&announced!==target){announced=target;land(target)}
    if(alive||state.time!==(target?BALL_DURATION:0)||state.velocity)schedule();else last=null
  }
  return {
    set(want,reduced=false){if(disposed)return;target=want?1:0;announced=-1;pendingReduced=reduced;if(paused)return;if(reduced)snap();else{paint(state,0);schedule()}},
    wake:schedule,pause(){paused=true;stop()},resume(){if(disposed)return;paused=false;if(pendingReduced)snap();else schedule()},destroy(){disposed=true;pendingReduced=false;stop()},
    get state(){return {...state}},get pending(){return Boolean(frame)},
  }
}
export function firstBallPose(entry,age){
  if(age>0)entry.started=true
  return !entry.started&&age===0?entry.pose:null
}
