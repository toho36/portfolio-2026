import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { ballPoseQuaternion, captureBallOrientation, bridgeBallSpin, createBallChoreography, ballFlight, advanceBallOrientation, stepBallFlow, ballQuaternionMultiply } from './ballFlow.js'
import { Euler, Quaternion } from 'three'

const directory=new URL('./',import.meta.url)
test('Python probes scope watch dialog/control queries and check all dialogs for selection',()=>{
  for(const name of readdirSync(directory).filter(name=>name.endsWith('.py'))){
    const source=readFileSync(new URL(name,directory),'utf8')
    assert.doesNotMatch(source,/(?:locator|querySelector)\(['"]dialog(?:['"]| )/,`${name}: ambiguous dialog query`)
    assert.doesNotMatch(source,/(?:locator|querySelector)\(['"]\.entry-(?:header|caption)/,`${name}: ambiguous watch control/caption`)
  }
  for(const name of ['watch-flow.py','card-actions.py','verify.py']){
    const source=readFileSync(new URL(name,directory),'utf8')
    assert.match(source,/locator\('dialog\[open\]'\)\.count\(\)==0/,`${name}: selection must assert every dialog is closed`)
  }
})

function probeCheck(data){
  const source=readFileSync(new URL('./ball-flow.py',directory),'utf8')
  const body=source.match(/CHECKS='''([\s\S]*?)'''/)
  assert.ok(body,'actual acceptance checks must be executable independently of the browser runner')
  return new Function(`return (${body[1]})`)()(data)
}
const responsiveReturn=JSON.parse(readFileSync(new URL('./responsiveReturn.fixture.json',directory)))
test('recorded native responsive source restoration changes projection space without changing the model',()=>{
  const result=probeCheck({mode:'screenPair',...structuredClone(responsiveReturn)})
  assert.equal(result.classification,'responsive_relayout')
  assert.ok(result.worldGap<.003)
  assert.ok(result.geometryDifference>1)
})
test('responsive restoration rejects broken physical, framing, clock, identity and restoration contracts',()=>{
  for(const mutate of [
    d=>d.a.trace.position[0]+=.01,
    d=>d.a.trace.velocity[0]+=.1,
    d=>d.end.motion.position[0]+=.01,
    d=>d.end.terminalTrace.velocity[0]+=.01,
    d=>d.end.quaternion=[0,0,0,1],
    d=>d.end.pose.spin.handoff.velocity[0]+=.01,
    d=>d.end.projection.x+=1.01,
    d=>d.end.center.y+=1.01,
    d=>d.end.nativeSourceProjection.x+=1.01,
    d=>d.b.projection.diameter+=1.01,
    d=>d.b.sourceTime-=.2,
    d=>d.b.time-=.2,
    d=>d.b.sameCanvas=false,
    d=>d.b.count=2,
    d=>d.end.sameView=false,
    d=>d.end.connected=false,
    d=>d.b.material.panels='17',
    d=>d.b.spin.yawSpeed+=.031,
    d=>d.end.restoration.scroll+=1,
    d=>d.end.restoration.focus='wrong',
    d=>d.end.restoration.styles.fan='width: 320px;',
    d=>d.b.restoration.styles.surface='width: 320px;',
  ]){
    const broken={mode:'screenPair',...structuredClone(responsiveReturn)};mutate(broken)
    assert.throws(()=>probeCheck(broken))
  }
})
test('source handoffs require geometric evidence and keep unchanged-viewport jump rejection',()=>{
  const same={mode:'screenPair',...structuredClone(responsiveReturn)}
  same.a.projectionSpace.capturedSource.viewport=structuredClone(same.b.viewport)
  same.b.projectionSpace.capturedSource.viewport=structuredClone(same.b.viewport)
  assert.throws(()=>probeCheck(same),/position teleported/)
  const unproven={mode:'screenPair',...structuredClone(responsiveReturn)}
  Object.assign(unproven.a.projectionSpace.capturedSource,{width:603,height:482,aspect:603/482})
  unproven.b.projectionSpace.capturedSource=structuredClone(unproven.a.projectionSpace.capturedSource)
  assert.throws(()=>probeCheck(unproven),/projection geometry/)
  const ordinary={mode:'screenPair',a:structuredClone(responsiveReturn.b),b:structuredClone(responsiveReturn.b)}
  ordinary.b.stamp+=16.7;ordinary.b.center.x+=101
  assert.throws(()=>probeCheck(ordinary),/position teleported/)
  const entry={mode:'screenPair',a:structuredClone(responsiveReturn.a),b:structuredClone(responsiveReturn.a)}
  entry.b.stamp+=16.7;entry.b.center.x+=101
  assert.throws(()=>probeCheck(entry),/position teleported/)
  const physical={mode:'screenPair',...structuredClone(responsiveReturn)}
  physical.a.projectionSpace.capturedSource.viewport=structuredClone(physical.b.viewport)
  physical.b.projectionSpace.capturedSource.viewport=structuredClone(physical.b.viewport)
  physical.a.center=structuredClone(physical.end.center)
  physical.b.center=structuredClone(physical.end.center)
  physical.b.projectionSpace=structuredClone(physical.end.projectionSpace)
  assert.equal(probeCheck(physical).classification,'same_projection')
  physical.a.trace.position[0]+=.095 // original ~17.6px same-viewport world teleport
  assert.throws(()=>probeCheck(physical),/pop current-source position/)
})
test('native orientation check accepts canonical Euler equivalents but rejects a physical reset on any axis',()=>{
  const q=ballPoseQuaternion({time:8.683,x:0,y:0,spin:{pitch:.2878635309863352,yaw:2.08754667033126}})
  const canonical=new Euler().setFromQuaternion(new Quaternion(...q),'XYZ')
  assert.ok(Math.abs(canonical.x-(.2878635309863352+Math.sin(8.683*.55)*.055))>3,'fixture crosses the Euler canonical branch')
  assert.ok(probeCheck({mode:'orientation',a:q,b:new Quaternion().setFromEuler(canonical).toArray()})<1e-12)
  assert.ok(probeCheck({mode:'orientation',a:q,b:q.map(v=>-v)})<1e-12)
  for(let axis=0;axis<3;axis++){
    const changed=[0,0,0,Math.cos(.01)];changed[axis]=Math.sin(.01)
    assert.throws(()=>probeCheck({mode:'orientation',a:[0,0,0,1],b:changed}),/orientation/)
  }
})
test('return check measures the actual bridged finite-difference angular derivative on all axes',()=>{
  const pose={time:8.683,x:.1,y:-.1,spin:{pitch:.2878,yaw:2.0875,pitchSpeed:-.1757,yawSpeed:2.8067}}
  const orientation={quaternion:ballPoseQuaternion(pose),angularVelocity:[.4,-.7,1.2]}
  const returned={...pose,spin:bridgeBallSpin(pose,orientation)}
  const data={mode:'bridge',orientation,pose:returned,quaternion:ballPoseQuaternion(returned)}
  const result=probeCheck(data)
  result.error.forEach(e=>assert.ok(e<2e-4))
  for(let axis=0;axis<3;axis++){
    const broken=structuredClone(data);broken.orientation.angularVelocity[axis]+=.01
    assert.throws(()=>probeCheck(broken),/return derivative/)
  }
  assert.ok(captureBallOrientation(returned).angularVelocity.every((v,i)=>Math.abs(v-orientation.angularVelocity[i])<2e-4))
})
test('trace checks retain actual contact, signed sampler velocity and viewport buffer budgets',()=>{
  const tr={age:1,phase:'rolling',clockVelocity:1,radius:1.18,sourceRadius:1,position:[0,1.18,0],support:[0,0,0],normal:[0,1,0],corner:[-2,0,0],card:{support:[0,0,0],corner:[-2,0,0]},pathVelocity:[-2,0,0],ambientVelocity:[0,0,0],velocity:[-2,0,0],speed:2,distance:.4,rollingAngle:.4/1.18,quaternion:[0,0,0,1],angularVelocity:[0,0,2/1.18],axis:[0,0,1],cameraQuaternion:[0,0,0,1],buffer:{width:390,height:844,pixelRatio:1}}
  const f={open:true,age:1,trace:tr,projection:{x:100,y:100,diameter:40},projectedSupport:{x:100,y:120},measuredCorner:{x:80,y:120},projectedCorner:{x:80,y:120},viewport:{width:390,height:844},fan:{opacity:'1',cards:[{bottom:400}]},deckOpacity:'1'}
  probeCheck({mode:'frame',f})
  for(const mutate of [f=>f.trace.phase='freefall',f=>f.trace.speed=0,f=>f.trace.position[1]+=.01,f=>f.projectedSupport.y+=.03,f=>f.measuredCorner.y-=190,f=>f.projectedCorner.x+=.0201,f=>f.trace.velocity[2]=.01,f=>{f.trace.ambientVelocity[0]=.01;f.trace.velocity[0]+=.01},f=>f.trace.buffer.width=5000,f=>f.trace.cameraQuaternion=[0,0,.01,Math.sqrt(1-.0001)],f=>f.fan.opacity='.9']){
    const broken=structuredClone(f);mutate(broken);assert.throws(()=>probeCheck({mode:'frame',f:broken}))
  }
})
test('native pop checks measure both clocks and exact returned position/velocity without accepting ambient contact',()=>{
  const native=JSON.parse(readFileSync(new URL('./nativeGeometryReturn.fixture.json',directory))),fixture=native.sources['entry-return'],c=createBallChoreography(fixture.card,fixture.pose),pose=native.return.end.pose
  const frame=(age,clockVelocity)=>{
    const f=ballFlight(age,c,pose),tr={...f,age,clockVelocity,sourcePose:fixture.pose,ambientPose:pose,anchor:c.anchor,pathVelocity:f.velocity,velocity:f.velocity.map((v,i)=>v*clockVelocity+f.ambientVelocity[i]),quaternion:[0,0,0,1],angularVelocity:[0,0,1],cameraQuaternion:[0,0,0,1],buffer:{width:1440,height:1000,pixelRatio:1}}
    return {open:true,age,trace:tr,projection:{x:800,y:500,diameter:370},viewport:{width:1440,height:1000},fan:{opacity:'1',cards:[{bottom:900}]},deckOpacity:'1'}
  }
  const f=frame(.00095,-.6992);probeCheck({mode:'frame',f})
  for(let axis=0;axis<3;axis++){
    const broken=structuredClone(f);broken.trace.ambientVelocity[axis]+=.01;broken.trace.velocity[axis]+=.01
    assert.throws(()=>probeCheck({mode:'frame',f:broken}),/pop ambient derivative/)
    const path=structuredClone(f);path.trace.pathVelocity[axis]+=.01;path.trace.velocity[axis]+=.01*path.trace.clockVelocity
    assert.throws(()=>probeCheck({mode:'frame',f:path}),/pop path derivative/)
    const position=structuredClone(f);position.trace.position[axis]+=.01
    assert.throws(()=>probeCheck({mode:'frame',f:position}),/pop current-source position/)
  }
  const terminal=frame(0,0).trace,position=terminal.position.map((v,i)=>v-c.anchor[i]),data={mode:'positionBridge',tr:terminal,pose,position}
  const result=probeCheck(data);assert.ok(result.positionError<1e-10&&result.velocityError<1e-10)
  for(let axis=0;axis<3;axis++){
    const broken=structuredClone(data);broken.tr.position[axis]+=.01
    assert.throws(()=>probeCheck(broken),/return position bridge/)
    const velocity=structuredClone(data);velocity.tr.velocity[axis]+=.01
    assert.throws(()=>probeCheck(velocity),/return position derivative/)
  }
})
test('native loading parity delays the observed dynamic Three prerequisite and preserves the loading/live/last-pose assertions',()=>{
  const source=readFileSync(new URL('./ball-parity.py',directory),'utf8')
  assert.match(source,/page\.route\('\*\*\/assets\/three\.module-\*\.js'/)
  assert.doesNotMatch(source,/assets\/ballScene-/)
  for(const contract of ["assert pending", "=='/ball-preview.png'", "pending[0].continue_()", 'runtime==="webgl"', "startswith('data:image/png;')", "canvas').count()==0"])
    assert.ok(source.includes(contract),`missing loading parity contract: ${contract}`)
  assert.match(source,/pending_urls/,'record the actual held native module request')
})
test('pair checks use full world angular velocity and distance/radius, and reject nonballistic fall',()=>{
  const pose={time:8,spin:{pitch:.3,yaw:2,pitchSpeed:.2,yawSpeed:1},x:0,y:0}
  const choreography=createBallChoreography({support:[0,-.8,0],corner:[-2,-1,0]},pose)
  const entry={choreography,orientation:captureBallOrientation(pose)}
  const frame=(age,stamp)=>{
    advanceBallOrientation(entry,age,.02,1)
    const flight=ballFlight(age,choreography)
    return {open:true,sourceTime:stamp/1000,stamp,quaternion:[...entry.orientation.quaternion],trace:{...flight,pathVelocity:flight.velocity,age,clockVelocity:1,axis:choreography.axis,angularVelocity:[...entry.orientation.angularVelocity]},viewport:{width:390,height:844},fan:{cards:[{bottom:age<1.85?400:400-(age-1.85)*600}]}}
  }
  const a=frame(.9,1000),b=frame(.92,1020)
  probeCheck({mode:'pair',a,b})
  probeCheck({mode:'pair',a:b,b:structuredClone(b)}) // paused native resize repeats this exact clock
  const slip=structuredClone(b);slip.trace.distance+=.01;assert.throws(()=>probeCheck({mode:'pair',a,b:slip}),/slips/)
  for(let axis=0;axis<3;axis++){
    const broken=structuredClone(b);broken.trace.angularVelocity[axis]+=.01
    assert.throws(()=>probeCheck({mode:'pair',a,b:broken}),/full rolling angular velocity/)
  }
  const x=frame(2,2000),y=frame(2.02,2020);probeCheck({mode:'pair',a:x,b:y})
  const reset=structuredClone(y);reset.trace.position[0]+=.01;assert.throws(()=>probeCheck({mode:'pair',a:x,b:reset}),/ballistic position/)
  const fan=structuredClone(y);fan.fan.cards[0].bottom=x.fan.cards[0].bottom;assert.throws(()=>probeCheck({mode:'pair',a:x,b:fan}),/whole fan/)
})
test('native runner invokes the new checks and retains input/lifecycle watchdogs',()=>{
  const source=readFileSync(new URL('./ball-flow.py',directory),'utf8')
  for(const mode of ['orientation','bridge','positionBridge','frame','pair','screenPair','reopenCrossing'])assert.ok(source.includes(`page.evaluate(CHECKS,{'mode':'${mode}'`),`${mode} check must run in native probe`)
  assert.doesNotMatch(source,/motion'\]\['rotation'\].*==/,'Euler canonicalization is not orientation equality')
  for(const contract of ["dt<.16", "dt*9", "<.03", "len(roll)>8", "len(corner)>1", "upward<=", "source_scroll==0", "return_scroll==0", "cold=browser.new_context", "Input.dispatchTouchEvent", "expect_page()", "keyboard.press('Enter')", "go_forward", "pauseSpin===", "loseContext()", "pendingFrame===\"false\"", "sameCanvas", "material"])
    assert.ok(source.includes(contract),`native contract lost: ${contract}`)
  assert.doesNotMatch(source,/force=True|dispatch_event\(['"]click/)
  for(const field of ['projectionSpace','viewFrame','surfaceSize','sourceBounds','sourceCardBounds','sourceMatrix','capturedSource','nativeSourceProjection','expectedStyles','responsive_relayout','endSourceFraming'])
    assert.ok(source.includes(field),`native projection/restoration evidence missing: ${field}`)
  assert.match(source,/footer=deck\.querySelector\('\.table-footer'\)/,'restore must measure the actual footer')
  assert.match(source,/Math\.max\(40,\(b\.stamp-a\.stamp\)\*6\)/,'original screen displacement budget must stay exact')
})

test('native rolling checks verify the transient decay and quaternion composition on every angular axis',()=>{
  const fixture=JSON.parse(readFileSync(new URL('./nativeGeometryReturn.fixture.json',directory))).sources['entry-return']
  const choreography=createBallChoreography(fixture.card,fixture.pose),entry={choreography,orientation:captureBallOrientation(fixture.pose)},dt=.0167
  let clock={time:0,velocity:0},time=0
  const step=target=>{
    clock=stepBallFlow(clock,target,dt);time+=dt;advanceBallOrientation(entry,clock.time,dt,clock.velocity)
    const flight=ballFlight(clock.time,choreography)
    return {open:true,sourceTime:time,stamp:time*1000,quaternion:[...entry.orientation.quaternion],trace:{...flight,pathVelocity:flight.velocity,age:clock.time,clockVelocity:clock.velocity,axis:choreography.axis,angularVelocity:[...entry.orientation.angularVelocity],reopen:structuredClone(entry.orientation.reopen)},viewport:{width:1440,height:1000},fan:{cards:[{bottom:900}]}}
  }
  while(clock.time<.61)step(true)
  while(clock.velocity>-1)step(false)
  while(clock.velocity<0)step(true)
  while(clock.time<.63)step(true)
  const a=step(true),b=step(true)
  assert.equal(a.trace.phase,'rolling');assert.equal(b.trace.phase,'rolling')
  assert.ok(Math.hypot(...b.trace.reopen.velocity.slice(0,2))>.01,'native carry must exercise source x/y axes')
  probeCheck({mode:'pair',a,b})
  for(let axis=0;axis<3;axis++){
    const omega=structuredClone(b);omega.trace.angularVelocity[axis]+=.01
    assert.throws(()=>probeCheck({mode:'pair',a,b:omega}),/full rolling angular velocity/)
    const residual=structuredClone(b);residual.trace.reopen.velocity[axis]+=.01
    assert.throws(()=>probeCheck({mode:'pair',a,b:residual}),/reopen residual/)
  }
  const decay=structuredClone(b);decay.trace.reopen.elapsed+=.001
  assert.throws(()=>probeCheck({mode:'pair',a,b:decay}),/reopen residual/)
  const removed=structuredClone(b);delete removed.trace.reopen
  assert.throws(()=>probeCheck({mode:'pair',a,b:removed}),/reopen residual dropped early/)
  const slip=structuredClone(b);slip.trace.distance+=.01
  assert.throws(()=>probeCheck({mode:'pair',a,b:slip}),/slips/)
  let previous=b
  while(clock.time<1.5){
    const next=step(true);probeCheck({mode:'pair',a:previous,b:next});previous=next
  }
  assert.equal(previous.trace.reopen,undefined,'native check must also enforce pure rolling after the transfer')
})

test('native zero-crossing check finite-differences rendered quaternions and vetoes the original distance-only jump',()=>{
  const fixture=JSON.parse(readFileSync(new URL('./nativeGeometryReturn.fixture.json',directory))).sources['entry-return']
  const choreography=createBallChoreography(fixture.card,fixture.pose),entry={choreography,orientation:captureBallOrientation(fixture.pose)},dt=.0167
  let clock={time:0,velocity:0},time=0;const frames=[]
  const step=target=>{
    clock=stepBallFlow(clock,target,dt);time+=dt;advanceBallOrientation(entry,clock.time,dt,clock.velocity)
    frames.push({sourceTime:time,quaternion:[...entry.orientation.quaternion],trace:{...ballFlight(clock.time,choreography),age:clock.time,clockVelocity:clock.velocity,reopen:structuredClone(entry.orientation.reopen)}})
  }
  while(clock.time<1.25)step(true)
  while(clock.velocity>-1)step(false)
  while(clock.velocity<0)step(true)
  const [a,b,c]=frames.slice(-3),data={mode:'reopenCrossing',a,b,c}
  assert.ok(probeCheck(data).gap<.5)
  const broken=structuredClone(data),travel=(c.trace.distance-b.trace.distance)/choreography.radius/2
  broken.c.quaternion=ballQuaternionMultiply([...choreography.axis.map(v=>v*Math.sin(travel)),Math.cos(travel)],b.quaternion)
  assert.throws(()=>probeCheck(broken),/world angular derivative discontinuity/)
  const noCarry=structuredClone(data);delete noCarry.c.trace.reopen
  assert.throws(()=>probeCheck(noCarry),/zero crossing absent/)
  const source=readFileSync(new URL('./ball-flow.py',directory),'utf8')
  assert.match(source,/clockVelocity<=-1/,'native history must wait for a real negative return clock')
  assert.match(source,/assert len\(crossings\)==1/,'native history must observe the crossing')
})

test('actual ball probe selection/tap waits accept fractional pixel targets and reject unsettled input',()=>{
  const source=readFileSync(new URL('./ball-flow.py',directory),'utf8')
  const waits=[...source.matchAll(/wait_for_function\('(Math\.abs\([^'\n]*)'\)/g)].map(([,js])=>js)
  assert.equal(waits.length,2,'selection and tap waits missing')
  for(const js of waits){
    const dataset={position:'0.999',settling:'false'}
    const ready=new Function('scrollY','innerHeight','document',`return (${js})`)
    const document={querySelector:()=>({dataset})}
    assert.equal(ready(717,844,document),true,'390x844 selection is within .4px of target')
    assert.equal(ready(715,844,document),false,'selection must remain within one actual pixel')
    dataset.settling='true';assert.equal(ready(717,844,document),false,'tap must wait for settling to finish')
  }
})
