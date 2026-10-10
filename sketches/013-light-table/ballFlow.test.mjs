import test from 'node:test'
import assert from 'node:assert/strict'
import * as flow from './ballFlow.js'
import {stepSpin,brushSpin,createSpin} from './ballMotion.js'

const card={support:[.2,-.9,0],corner:[-2,-1.05,0]},pose={x:.23,y:-.17,time:9,spin:{yaw:3,pitch:1,yawSpeed:2,pitchSpeed:.7}}
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`)
const frame=()=>flow.createBallChoreography(card,pose)
test('return bridge preserves finite-difference world velocity on all axes and second entry capture',()=>{
  const entry={choreography:frame(),orientation:flow.captureBallOrientation(pose)}
  for(let t=.01;t<2.5;t+=.01)flow.advanceBallOrientation(entry,t,.01,1)
  for(let t=2.5;t>=0;t-=.01)flow.advanceBallOrientation(entry,Math.max(0,t),.005,-2)
  const prior=[...entry.orientation.quaternion],dt=.00001
  flow.advanceBallOrientation(entry,0,dt,-.01)
  const h=1e-6,before=[...entry.orientation.quaternion],omega=[...entry.orientation.angularVelocity]
  const previousDelta=flow.ballQuaternionMultiply(before,[-prior[0],-prior[1],-prior[2],prior[3]]),beforeVelocity=previousDelta.slice(0,3).map(v=>v*2/dt)
  const bridged=flow.bridgeBallSpin(pose,entry.orientation),returned={...pose,spin:bridged}
  const after=flow.ballPoseQuaternion({...returned,time:pose.time+h,spin:stepSpin(bridged,h)})
  const delta=flow.ballQuaternionMultiply(after,[-before[0],-before[1],-before[2],before[3]])
  delta.slice(0,3).forEach((v,i)=>{near(v*2/h,omega[i],2e-4);near(v*2/h,beforeVelocity[i],2e-4)})
  flow.captureBallOrientation(returned).angularVelocity.forEach((v,i)=>near(v,omega[i],2e-4))
  const brush=[{x:-2,y:0,time:0},{x:2,y:.1,time:16},{x:0,y:0},1]
  const ordinary=brushSpin(createSpin(),...brush),withResidual=brushSpin(bridged,...brush)
  near(withResidual.yawSpeed-bridged.yawSpeed,ordinary.yawSpeed-createSpin().yawSpeed)
  near(withResidual.pitchSpeed-bridged.pitchSpeed,ordinary.pitchSpeed)
  const same=flow.captureBallOrientation(pose)
  assert.equal(flow.bridgeBallSpin(pose,same).handoff,undefined,'ordinary matching momentum needs no residual')
  const reconstructed=JSON.parse(JSON.stringify(returned))
  assert.deepEqual(flow.captureBallOrientation(reconstructed),flow.captureBallOrientation(returned),'hidden/reduced serialization must preserve every handoff axis')
  const brushOrdinary=brushSpin(createSpin(),...brush),hStep=.05,decay=Math.exp(-1.1*hStep),travel=(1-decay)/1.1
  assert.deepEqual(stepSpin(brushOrdinary,hStep),{...brushOrdinary,yaw:brushOrdinary.yaw+.16*hStep+(brushOrdinary.yawSpeed-.16)*travel,pitch:brushOrdinary.pitch+brushOrdinary.pitchSpeed*travel,yawSpeed:.16+(brushOrdinary.yawSpeed-.16)*decay,pitchSpeed:brushOrdinary.pitchSpeed*decay},'ordinary brush sampling/damping must remain numerically unchanged')
})
test('captured card supports pop-scaled radius, accelerating distance and a real corner arc',()=>{
  assert.equal(typeof flow.createBallChoreography,'function','captured card choreography missing')
  assert.equal(flow.BALL_DURATION,3.55)
  const c=frame(),start=flow.ballFlight(0,c),pop=flow.ballFlight(.2,c)
  assert.ok(pop.position[1]>start.position[1]);assert.ok(pop.position[2]>0);assert.ok(pop.radius>start.radius)
  let previous=0,speed=0
  for(let t=.62;t<1.7;t+=.01){
    const p=flow.ballFlight(t,c);assert.equal(p.phase,'rolling');near(p.radius,1.18)
    p.position.forEach((v,i)=>near(v,p.support[i]+c.normal[i]*p.radius))
    assert.ok(p.distance>=previous);assert.ok(p.speed>=speed);near(p.rollingAngle,p.distance/p.radius)
    previous=p.distance;speed=p.speed
  }
  const corner=flow.ballFlight(1.7,c),arc=flow.ballFlight(1.8,c),air=flow.ballFlight(1.85,c)
  assert.equal(arc.phase,'corner');near(Math.hypot(...arc.position.map((v,i)=>v-c.corner[i])),1.18)
  assert.ok(arc.speed>0);assert.equal(air.support,null);assert.equal(air.phase,'freefall')
  corner.support.forEach((v,i)=>near(v,c.corner[i]))
})
test('backward source anchor yields exact ballistic velocity joins and one upper-tread bounce',()=>{
  const c=frame(),exit=flow.ballFlight(1.85,c),dt=1e-5
  for(const join of [1.7,1.85]){
    const a=flow.ballFlight(join-dt,c),b=flow.ballFlight(join,c),d=flow.ballFlight(join+dt,c)
    b.position.forEach((v,i)=>{near(v,a.position[i],.0002);near(v,d.position[i],.0002);near((d.position[i]-a.position[i])/(2*dt),b.velocity[i],.002)})
  }
  for(let age=0;age<1.25;age+=.01){
    const p=flow.ballFlight(1.85+age,c)
    near(p.position[0],exit.position[0]+exit.velocity[0]*age)
    near(p.position[1],exit.position[1]+exit.velocity[1]*age-6*age*age)
    near(p.velocity[0],exit.velocity[0]);near(p.velocity[1],exit.velocity[1]-12*age)
    assert.ok(p.position[1]>=2.62)
  }
  const before=flow.ballFlight(3.1-dt,c),hit=flow.ballFlight(3.1,c),end=flow.ballFlight(3.55,c)
  hit.position.forEach((v,i)=>near(v,before.position[i],.001))
  assert.deepEqual(hit.position,[-3.45,2.62,0]);assert.ok(flow.ballFlight(3.25,c).rebound)
  assert.deepEqual(end.position,hit.position);assert.deepEqual(end.velocity,[0,0,0]);assert.equal(end.radius,.92)
  assert.deepEqual(flow.ballFlight(10,c),end,'never roll to next step')
})
test('contact radius includes the actual captured source scale before the uniform pop',()=>{
  const c=flow.createBallChoreography(card,{...pose,radius:.85})
  near(flow.ballFlight(0,c).radius,.85)
  for(const t of [.3,.62,1.2,1.7,1.8])near(flow.ballFlight(t,c).radius,.85*1.18)
})
test('logical quaternion retains all source axes, bounded residual spin and forward return continuity',()=>{
  const c=frame(),entry={choreography:c,orientation:flow.captureBallOrientation(pose)}
  const original=[...entry.orientation.quaternion]
  flow.advanceBallOrientation(entry,0,0,0);assert.deepEqual(entry.orientation.quaternion,original)
  for(let t=.01;t<=3.55;t+=.01)flow.advanceBallOrientation(entry,t,.01,1)
  const landed=[...entry.orientation.quaternion],omega=[...entry.orientation.angularVelocity]
  assert.notDeepEqual(landed,original);near(Math.hypot(...landed),1)
  flow.advanceBallOrientation(entry,3.55,0,0);assert.deepEqual(entry.orientation.quaternion,landed)
  flow.advanceBallOrientation(entry,3.54,.01,-.1)
  assert.ok(Math.abs(entry.orientation.quaternion.reduce((s,v,i)=>s+v*landed[i],0))>.99,'return reset source pose')
  assert.ok(entry.orientation.angularVelocity.every((v,i)=>Math.abs(v-omega[i])<1),'return discarded exit angular velocity')
  for(let t=3.5;t>=0;t-=.02)flow.advanceBallOrientation(entry,t,.01,-3.4)
  near(Math.hypot(...entry.orientation.quaternion),1);assert.notDeepEqual(entry.orientation.quaternion,original)
  assert.ok(Math.hypot(...entry.orientation.angularVelocity)<12,'residual became additive unbounded spin')
})
test('actual rolling quaternion advances exactly by distance/radius after residual transfer',()=>{
  const c=frame(),entry={choreography:c,orientation:flow.captureBallOrientation(pose)}
  flow.advanceBallOrientation(entry,.62,.01,1)
  const initial=[...entry.orientation.quaternion]
  for(let i=1;i<=108;i++)flow.advanceBallOrientation(entry,.62+i*.01,.01,1)
  const angle=c.distance/c.radius,expected=flow.ballQuaternionMultiply([...c.axis.map(v=>v*Math.sin(angle/2)),Math.cos(angle/2)],initial)
  near(Math.abs(entry.orientation.quaternion.reduce((s,v,i)=>s+v*expected[i],0)),1,1e-10)
})
test('full return is bounded near 1.3 seconds and preserves velocity on interruption',()=>{
  let s={time:3.55,velocity:0},elapsed=0
  while(s.time>0&&elapsed<2){s=flow.stepBallFlow(s,0,.005);elapsed+=.005}
  assert.ok(elapsed>1.1&&elapsed<1.5,`return took ${elapsed}`)
  const moving={time:2,velocity:1};assert.deepEqual(flow.stepBallFlow(moving,0,0),moving)
  assert.ok(flow.stepBallFlow(moving,0,.005).time>moving.time)
})

test('reversal/reopen retain the current clock and velocity and return softly',()=>{
  assert.equal(typeof flow.stepBallFlow,'function','interruptible clock missing')
  let state={time:.45,velocity:1}
  assert.deepEqual(flow.stepBallFlow(state,0,0),state)
  const next=flow.stepBallFlow(state,0,1/120);assert.ok(next.time>state.time,'reversal reset current velocity');state=next
  for(let i=0;i<180;i++)state=flow.stepBallFlow(state,i<16?0:1,1/120)
  for(let i=0;i<500;i++)state=flow.stepBallFlow(state,1,1/120)
  assert.deepEqual(state,{time:flow.BALL_DURATION,velocity:0})
  for(let i=0;i<400;i++)state=flow.stepBallFlow(state,0,1/120)
  assert.deepEqual(state,{time:0,velocity:0})
})

test('one pending frame, hidden time pause and no late paint after teardown',()=>{
  assert.equal(typeof flow.createBallFlow,'function','frame owner missing')
  const frames=new Map();let id=0,now=0,painted=[]
  const saved=['requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])
  globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id};globalThis.cancelAnimationFrame=id=>frames.delete(id)
  let runner
  const tick=()=>{now+=16;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now))}
  try{
    runner=flow.createBallFlow((s,dt)=>{painted.push({s,dt});return true},()=>{})
    runner.set(true);tick();runner.set(false);runner.set(true);assert.equal(frames.size,1)
    runner.pause();assert.equal(frames.size,0);const before=runner.state;now+=10000;runner.resume();tick();assert.deepEqual(runner.state,before);assert.equal(painted.at(-1).dt,0)
    const late=[...frames.values()];runner.destroy();const count=painted.length;late.forEach(fn=>fn(now+16));assert.equal(painted.length,count);assert.equal(frames.size,0)
  }finally{runner?.destroy();for(const [k,d] of saved){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
})

test('first-frame pose is used only on entry, never the last frame of return or reopen',()=>{
  assert.equal(typeof flow.firstBallPose,'function','source pose latch missing')
  const entry={pose:{time:9,spin:{yaw:2,pitch:1}}}
  assert.equal(flow.firstBallPose(entry,0),entry.pose)
  assert.equal(flow.firstBallPose(entry,.1),null)
  assert.equal(flow.firstBallPose(entry,0),null,'return reset to source orientation/time')
  assert.equal(flow.firstBallPose(entry,.1),null,'interrupted reopen reset phase')
})

for(const wantAtResume of [true,false])for(const reducedAtResume of [true,false])test(`paused reduced request preserves clock until resume (${wantAtResume?'entry':'return'}, ${reducedAtResume?'instant':'regular'})`,()=>{
  const frames=new Map();let id=0,now=0,paints=0;const landed=[]
  const saved=['requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])
  globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id};globalThis.cancelAnimationFrame=id=>frames.delete(id)
  const tick=()=>{now+=16;const queued=[...frames.values()];frames.clear();queued.forEach(fn=>fn(now))}
  const initial={time:.4,velocity:1};let runner
  try{
    runner=flow.createBallFlow(()=>{paints++;return false},p=>landed.push(p),initial)
    runner.pause();runner.set(true,true)
    assert.deepEqual(runner.state,initial,'reduced set advanced hidden clock');assert.equal(paints,0);assert.deepEqual(landed,[])
    runner.set(false,true)
    assert.deepEqual(runner.state,initial,'latest endpoint advanced hidden clock');assert.equal(paints,0);assert.deepEqual(landed,[])
    runner.set(wantAtResume,reducedAtResume)
    assert.deepEqual(runner.state,initial,'preference toggle advanced hidden clock');assert.equal(paints,0);assert.deepEqual(landed,[])
    assert.equal(frames.size,0)
    runner.resume()
    if(!reducedAtResume){assert.deepEqual(runner.state,initial);tick();assert.deepEqual(runner.state,initial);assert.deepEqual(landed,[])}
    for(let i=0;i<300;i++)tick()
    const endpoint=wantAtResume?1:0
    assert.deepEqual(runner.state,{time:endpoint?flow.BALL_DURATION:0,velocity:0});assert.deepEqual(landed,[endpoint])
    runner.pause();runner.set(!wantAtResume,true);const before=runner.state,count=paints
    runner.destroy();runner.resume();tick()
    assert.deepEqual(runner.state,before);assert.equal(paints,count);assert.deepEqual(landed,[endpoint]);assert.equal(frames.size,0)
  }finally{runner?.destroy();for(const [k,d] of saved){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
})

test('native full return carries bounded quaternion travel and omega through the terminal clock sample',()=>{
  const source={x:.29035405191718433,y:.008350040767996732,time:8.766200000000024,spin:{yaw:2.1010448205026644,pitch:.2881224985458187,yawSpeed:2.810715882911154,pitchSpeed:-.17434412487497997},radius:1}
  const c=flow.createBallChoreography({support:[0,-1.5147418140368514,0],corner:[-3.183014727097824,-1.7721306541736894,0]},source)
  const entry={choreography:c,orientation:flow.captureBallOrientation(source)},dt=.0167
  let clock={time:0,velocity:0}
  while(clock.time<flow.BALL_DURATION){clock=flow.stepBallFlow(clock,1,dt);flow.advanceBallOrientation(entry,clock.time,dt,clock.velocity)}
  let elapsed=0,terminalDelta,maxOmegaChange=0
  while(clock.time>0){
    const before=structuredClone(entry.orientation)
    clock=flow.stepBallFlow(clock,0,dt);flow.advanceBallOrientation(entry,clock.time,dt,clock.velocity);elapsed+=dt
    const after=entry.orientation,dot=Math.abs(before.quaternion.reduce((s,v,i)=>s+v*after.quaternion[i],0)),angle=2*Math.acos(Math.min(1,dot))
    assert.ok(angle<Math.max(.06,dt*9),`native quaternion watchdog exceeded at ${clock.time}: ${angle}`)
    assert.ok(Math.hypot(...after.angularVelocity)<9,'return clock amplified current omega')
    maxOmegaChange=Math.max(maxOmegaChange,Math.hypot(...after.angularVelocity.map((v,i)=>v-before.angularVelocity[i])))
    terminalDelta=flow.ballQuaternionMultiply(after.quaternion,[-before.quaternion[0],-before.quaternion[1],-before.quaternion[2],before.quaternion[3]])
  }
  assert.ok(elapsed>1.1&&elapsed<1.5,`return took ${elapsed}`)
  assert.ok(maxOmegaChange<=9*(1-Math.exp(-dt*8)),`current omega jumped on return: ${maxOmegaChange}`)
  const frozen=structuredClone(entry.orientation)
  flow.advanceBallOrientation(entry,.1,0,-3.5)
  assert.deepEqual(entry.orientation,frozen,'zero physical dt must freeze quaternion, omega and sampling age')
  const h=1e-6,spin=flow.bridgeBallSpin(source,entry.orientation),before=entry.orientation.quaternion,after=flow.ballPoseQuaternion({...source,spin:stepSpin(spin,h),time:source.time+h})
  const delta=flow.ballQuaternionMultiply(after,[-before[0],-before[1],-before[2],before[3]])
  delta.slice(0,3).forEach((v,i)=>near(v*2/h,terminalDelta[i]*2/dt,2e-4))
})

test('interrupted forward rolling keeps clock-scaled omega and exact distance rotation',()=>{
  const c=frame(),entry={choreography:c,orientation:flow.captureBallOrientation(pose)},dt=.0167,velocity=.4
  flow.advanceBallOrientation(entry,.9,dt,velocity)
  const before=[...entry.orientation.quaternion],age=.9+dt*velocity
  flow.advanceBallOrientation(entry,age,dt,velocity)
  flow.ballFlight(age,c).angularVelocity.forEach((v,i)=>near(entry.orientation.angularVelocity[i],v*velocity))
  const angle=(flow.ballFlight(age,c).distance-flow.ballFlight(.9,c).distance)/c.radius/2,expected=flow.ballQuaternionMultiply([...c.axis.map(v=>v*Math.sin(angle)),Math.cos(angle)],before)
  near(Math.abs(expected.reduce((s,v,i)=>s+v*entry.orientation.quaternion[i],0)),1,1e-10)
})
