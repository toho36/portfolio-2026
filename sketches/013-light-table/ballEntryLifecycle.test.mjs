import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createBallFlow, firstBallPose, BALL_DURATION,createBallChoreography,captureBallOrientation,advanceBallOrientation,bridgeBallSpin,ballEase,ballPoseQuaternion,ballFlight,ballQuaternionMultiply } from './ballFlow.js'
import { stepSpin, followPosition } from './ballMotion.js'
import { ballEntryFrame,ballContactShift,ballEntryPresentation,ballContactLayout } from './ballScene.js'
import { staticLanding } from './ballSteps.js'

const study=readFileSync(new URL('./study.jsx',import.meta.url),'utf8')
const volleyball=readFileSync(new URL('./Volleyball.jsx',import.meta.url),'utf8')
const restoreSource=study.slice(study.indexOf('      function restore(){'),study.indexOf('      function land(p){'))

test('actual detail resize immediately repaints the preserved clock and orientation without waking hidden work',()=>{
  const resizeSource=volleyball.slice(volleyball.indexOf('    const resize'),volleyball.indexOf('    sheet.addEventListener'))
  let callback,viewportCallback,hidden=false,wakes=0;const calls=[],state={time:.73,velocity:-.4},spin={yaw:3,pitch:2,yawSpeed:1,pitchSpeed:2}
  const context={surface:{},doc:{defaultView:{addEventListener(name,fn){assert.equal(name,'resize');viewportCallback=fn}}},innerWidth:390,innerHeight:844,detail:()=>true,eligible:()=>!hidden,
    host:{dataset:{},ballEntry:{started:true,resize:(...args)=>calls.push(['entry',...args]),paint:age=>calls.push(['dom',age])}},
    view:{resizeEntry:(...args)=>calls.push(['view',...args]),resize:()=>assert.fail('detail must not restore source framing'),paintEntry:(...args)=>calls.push(['paint',...args]),entryProjection:{fanFrame:{a:1,b:0,c:0,d:1,x:0,y:-300}}},
    flow:{state,wake(){wakes++}},clockRef:{current:state},timeRef:{current:19},spinRef:{current:spin},positionRef:{current:{x:.23,y:-.17}},reduced:false,stepSpin,firstBallPose,BALL_DURATION,advanceBallOrientation,
    ResizeObserver:class{constructor(fn){callback=fn}observe(){}}}
  const pose={x:.23,y:-.17,time:19,spin},orientation=captureBallOrientation(pose);orientation.age=state.time
  Object.assign(context.host.ballEntry,{pose,choreography:createBallChoreography({support:[.1,-.85,0],corner:[-2,-1.05,0]},pose),orientation})
  const savedOrientation=structuredClone(orientation)
  const drawSource=volleyball.slice(volleyball.indexOf('    function draw('),volleyball.indexOf('    host.captureBallPreview'))
  context.draw=new Function(...Object.keys(context),`${drawSource};return draw`)(...Object.values(context))
  new Function(...Object.keys(context),resizeSource)(...Object.values(context))
  assert.equal(viewportCallback,callback,'fixed presentation dimensions require a viewport resize listener')
  callback()
  assert.deepEqual(calls,[['entry',390,844],['view',390,844],['paint',state.time,.23,-.17,19,spin,context.host.ballEntry],['dom',state.time]],'DOM must receive the current source/camera projection after the actual pose repaint')
  assert.deepEqual(context.spinRef.current,spin);assert.equal(context.timeRef.current,19);assert.equal(context.clockRef.current,state)
  assert.deepEqual(state,{time:.73,velocity:-.4});assert.equal(wakes,0)
  assert.deepEqual(orientation,savedOrientation,'actual resize altered logical quaternion, derivative or sampling age')
  hidden=true;callback();assert.equal(calls.length,4,'hidden resize must preserve paused work')
})

test('actual entry paint keeps the source card visible through pop and lower-edge clearance',()=>{
  const paintSource=study.slice(study.indexOf('      function paint(age,shared){'),study.indexOf('      function restore(){'))
  const properties={},image={style:{},dataset:{capture:'ball'}},surface={style:{},querySelector:()=>image},deck={style:{opacity:'.83'}}
  const context={surface,deck,fan:{style:{}},previousFanTransform:'',card:{supportScreen:{x:500,y:650},cornerScreen:{x:200,y:700}},host:{dataset:{runtime:'webgl'}},dialog:{style:{setProperty:(k,v)=>properties[k]=v},dataset:{}},staticSteps:{style:{}},sourceFrame:{width:600,height:500,origin:{a:1,b:0,c:0,d:1,x:200,y:200}},ballEntryFrame,ballContactShift,ballEase,fallback:staticLanding(1440/1000),diameter:1000/2.6,edgeTime:1.85,edgeY:700,innerHeight:1000,innerWidth:1440,w:600,h:500,BALL_DURATION}
  context.card.affine={a:1,b:0,c:0,d:1,x:200,y:200}
  context.fanParent={getBoundingClientRect:()=>({x:0,y:0})};context.fanParentOrigin={x:0,y:0}
  context.unit=500/2.6;context.xUnit=context.unit;context.ballEntryPresentation=ballEntryPresentation;context.ballContactLayout=ballContactLayout;context.fanLeft=500;context.fanTop=450;context.choreography=createBallChoreography({support:[.1,-.85,0],corner:[-2,-1.05,0]},{x:.23,y:-.17,time:19})
  Object.assign(context.choreography.card,{affine:context.card.affine,width:602,height:502})
  context.sourceFrame.fanBounds={left:180,right:830,top:170,bottom:820}
  context.sourceFrame.fanBottom=820
  context.sourceFrame.contact=context.choreography
  const paint=new Function(...Object.keys(context),`${paintSource};return paint`)(...Object.values(context))
  for(const age of [0,.13,.30,.5,.62,1.3,1.7,1.85,2,2.5,3.1,3.55,.5,0]){
    paint(age)
    assert.equal(deck.style.opacity,'.83','whole deck must never fade')
    const f=JSON.parse(context.dialog.dataset.fanFrame)
    if(age<=f.exitTime){
      const metric=2.6/ballEntryPresentation(context.sourceFrame,1440,1000,age).span
      assert.ok(Math.abs(f.a-metric)<1e-9&&Math.abs(f.d-metric)<1e-9&&Math.abs(f.b)<1e-9&&Math.abs(f.c)<1e-9,'one fan composition must keep normalized shape while sharing the camera metric')
    }
    if(age<=context.edgeTime)assert.equal(f.y,0,'desktop cards must stay fixed through contact')
    if(age===2)assert.ok(f.y<0,'whole fan must leave upward immediately after support loss')
  }
  paint(2.15);assert.ok(JSON.parse(context.dialog.dataset.fanFrame).bottom>100,'actual lower edge must still be readable after .3s')
  paint(2.51);assert.ok(JSON.parse(context.dialog.dataset.fanFrame).bottom<0,'all three cards must exit by geometry')
  paint(3.55);assert.ok(parseFloat(properties['--reveal-edge'])<-100,'reduced/rest environment must be fully revealed above the viewport')
  const ys=[2.05,2.15,2.25,2.35].map(age=>{paint(age);return JSON.parse(context.dialog.dataset.fanFrame).y})
  assert.ok(Math.abs((ys[1]-ys[0])-(ys[3]-ys[2]))<1e-8,'up-travel must be near uniform after brief acceleration')
  context.host.dataset.runtime='static'
  for(const age of [0,2,3.55]){
    paint(age)
    const frame=ballEntryPresentation(context.sourceFrame,1440,1000,age).affine
    assert.ok(image.style.transform.startsWith(`matrix(${frame.a},${frame.b},${frame.c},${frame.d},${frame.x},${frame.y})`),'DOM preview must use the same source affine as Three')
    assert.equal(image.style.width,'600px');assert.equal(image.style.height,'500px');assert.equal(image.style.transformOrigin,'0 0')
    assert.equal(surface.style.transform,undefined,'viewport presentation must not CSS-stretch the live canvas')
  }
  const transform=image.style.transform,numbers=transform.match(/translate\(([-.\de]+)px,([-.\de]+)px\) scale\(([-.\de]+)\)/).slice(1).map(Number),[dx,dy,size]=numbers
  const native=context.choreography.source.map((v,i)=>v-context.choreography.anchor[i]),frame=ballEntryFrame(context.sourceFrame,1440,1000,1,3.55)
  const bx=(300+native[0]*context.unit)*size+dx,by=(250-native[1]*context.unit)*size+dy
  assert.ok(Math.abs(frame.x+frame.a*bx+frame.c*by-context.fallback.ball.x*1440)<1e-9,'static landing ignored actual source center')
  assert.ok(Math.abs(frame.y+frame.b*bx+frame.d*by-context.fallback.ball.y*1000)<1e-9,'static landing ignored actual source y')
  for(const age of [0,.30,.62,1.2,1.8]){
    paint(age)
    const [dx,dy,size]=image.style.transform.match(/translate\(([-.\de]+)px,([-.\de]+)px\) scale\(([-.\de]+)\)/).slice(1).map(Number),f=ballFlight(age,context.choreography),local=f.position.map((v,i)=>v-context.choreography.anchor[i])
    assert.ok(Math.abs((300+native[0]*context.unit)*size+dx-(300+local[0]*context.unit))<1e-9,`static ${f.phase} x disagrees with live contact`)
    assert.ok(Math.abs((250-native[1]*context.unit)*size+dy-(250-local[1]*context.unit))<1e-9,`static ${f.phase} y disagrees with live contact`)
    assert.ok(Math.abs(size-f.radius)<1e-9,`static ${f.phase} pop radius differs`)
  }
  context.host.ballEntry={ambientPose:{x:.31,y:.08,time:23}}
  for(const age of [.00095,0]){
    paint(age)
    const [dx,dy,size]=image.style.transform.match(/translate\(([-.\de]+)px,([-.\de]+)px\) scale\(([-.\de]+)\)/).slice(1).map(Number),f=ballFlight(age,context.choreography,context.host.ballEntry.ambientPose),local=f.position.map((v,i)=>v-context.choreography.anchor[i])
    assert.ok(Math.abs((300+native[0]*context.unit)*size+dx-(300+local[0]*context.unit))<1e-9,'static return must bridge to the current normal x')
    assert.ok(Math.abs((250-native[1]*context.unit)*size+dy-(250-local[1]*context.unit))<1e-9,'static return must bridge to the current normal y')
  }
})

test('actual ball restore repaints the latest source pose after resize and before close',()=>{
  const calls=[],pose={x:.23,y:-.17,time:19,spin:{yaw:3,pitch:2,yawSpeed:4,pitchSpeed:1}}
  const entry={started:true,pose:{x:0,y:0,time:0}},image={style:{}},surface={style:{},querySelector:()=>image}
  let painted=true
  const host={ballEntry:entry,dataset:{sourcePose:JSON.stringify(pose)},append(){calls.push('append')},dispatchEvent(){calls.push('event')},ballView:{
    resize(){painted=false;calls.push('resize')},
    paint(...args){assert.deepEqual(args,[pose.x,pose.y,pose.time,pose.spin]);painted=true;calls.push('paint')},
  }}
  const dialog={close(){calls.push(`close(painted=${painted})`)}},document={body:{style:{overflow:'hidden'}}},deck={style:{opacity:'0'}},ballRestoreRef={current:()=>{}}
  const context={staticSteps:{remove(){}},surface,host,dialog,document,previousOverflow:'scroll',deck,ballRestoreRef,fan:{style:{transform:'entry-shift'}},previousFanFrame:{width:'',height:'',left:'',top:''},previousFanOrigin:'',previousFanTransform:'translate(-50%,-50%) scale(.99)',previousFanStyle:'transform: translate(-50%,-50%) scale(.99);',footer:{style:{}},previousFooterStyle:'color: red;',previousSurfaceStyle:'overflow: clip;',previousImageStyle:'object-fit: contain;'}
  new Function(...Object.keys(context),`${restoreSource};restore()`)(...Object.values(context))
  assert.deepEqual(calls,['append','resize','paint','close(painted=true)','event'])
  assert.equal(entry.started,true,'final return must not reset the initial-entry latch')
  assert.equal(document.body.style.overflow,'scroll');assert.equal(ballRestoreRef.current,null)
  assert.equal(context.fan.style.transform,context.previousFanTransform)
})

// Run the real effect body with an unavailable DOM/GPU and an explicit RAF queue.
const effectSource=volleyball.slice(volleyball.indexOf('  useEffect(()=>{')+'  useEffect(()=>{'.length,volleyball.indexOf('  },[active,reduced])'))
function hiddenEffect(reduced,clock,frames,previous){
  const listeners=new Map(),image={style:{},dataset:{}},surface={dataset:{},querySelector:()=>image,addEventListener(){},removeEventListener(){}}
  const doc={hidden:true,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),querySelector:()=>null}
  const sheet={closest:()=>null,addEventListener(){},removeEventListener(){}}
  const landed=[],painted=[],samples=[],host={ballSurface:surface,ownerDocument:doc,closest:()=>sheet,dataset:{},ballEntry:previous?.host.ballEntry??{want:true,resize(){}},addEventListener(){},removeEventListener(){}}
  host.ballEntry.paint=age=>{assert.equal(doc.hidden,false,'hidden flow painted');painted.push(age);samples.push(structuredClone(host.ballEntry.orientation))}
  host.ballEntry.land=p=>{assert.equal(doc.hidden,false,'hidden flow landed');landed.push(p)}
  const pose={x:.2,y:.1,time:8,spin:{yaw:2,pitch:1,yawSpeed:1,pitchSpeed:0}}
  if(!previous)Object.assign(host.ballEntry,{pose,choreography:createBallChoreography({support:[.2,-.9,0],corner:[-2,-1.05,0]},pose),orientation:captureBallOrientation(pose)})
  const context={ref:{current:host},timeRef:{current:8},spinRef:{current:pose.spin},previewRef:{current:'/ball-preview.png'},clockRef:clock,positionRef:{current:{x:.2,y:.1}},innerWidth:1440,innerHeight:1000,active:true,reduced,createBallFlow,firstBallPose,BALL_DURATION,stepSpin,followPosition,advanceBallOrientation,bridgeBallSpin,brushSpin(){},ResizeObserver:class{observe(){}disconnect(){}}}
  if(previous)for(const k of ['timeRef','spinRef','positionRef','previewRef'])context[k]=previous.context[k]
  const cleanup=new Function(...Object.keys(context),effectSource)(...Object.values(context))
  return {host,context,landed,painted,samples,cleanup,show(){doc.hidden=false;listeners.get('visibilitychange')()},frames}
}

for(const toggle of [false,true])test(`actual effect pauses a flow created hidden${toggle?' after a reduced toggle':''}`,()=>{
  const frames=new Map();let id=0,now=0
  const saved=['requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])
  globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id};globalThis.cancelAnimationFrame=id=>frames.delete(id)
  const tick=()=>{now+=16;const queued=[...frames.values()];frames.clear();queued.forEach(fn=>fn(now))}
  const clock={current:{time:.4,velocity:1}};let effect
  try{
    const before={...clock.current}
    if(toggle){
      effect=hiddenEffect(false,clock,frames)
      assert.deepEqual(effect.host.ballFlow.state,before);assert.deepEqual(clock.current,before)
      assert.deepEqual(effect.landed,[]);assert.deepEqual(effect.painted,[])
      effect.cleanup();assert.deepEqual(clock.current,before,'normal hidden cleanup advanced clock')
      effect=hiddenEffect(true,clock,frames)
      assert.deepEqual(effect.host.ballFlow.state,before,'reduced recreation advanced hidden clock')
      assert.deepEqual(clock.current,before);assert.deepEqual(effect.landed,[]);assert.deepEqual(effect.painted,[])
      effect.cleanup();assert.deepEqual(clock.current,before,'reduced cleanup advanced hidden clock')
    }
    effect=hiddenEffect(false,clock,frames)
    const quaternion=[...effect.host.ballEntry.orientation.quaternion]
    for(let i=0;i<180;i++)tick()
    assert.deepEqual(effect.host.ballFlow.state,before,'hidden setup advanced flight')
    assert.deepEqual(clock.current,before);assert.deepEqual(effect.landed,[]);assert.deepEqual(effect.painted,[]);assert.equal(frames.size,0)
    assert.deepEqual(effect.host.ballEntry.orientation.quaternion,quaternion,'GPU-free hidden entry lost logical orientation')
    effect.show();assert.equal(frames.size,1,'existing visibility handler must resume')
    tick();assert.deepEqual(clock.current,before,'resume must start from preserved clock/velocity')
    for(let i=0;i<300;i++)tick()
    assert.deepEqual(clock.current,{time:BALL_DURATION,velocity:0});assert.deepEqual(effect.landed,[1]);assert.equal(effect.painted.at(-1),BALL_DURATION)
    const entry=effect.host.ballEntry,orientation=[...entry.orientation.quaternion]
    effect.host.bridgeBallOrientation()
    const bridged=ballPoseQuaternion({...effect.context.positionRef.current,time:effect.context.timeRef.current,spin:effect.context.spinRef.current})
    assert.ok(Math.abs(bridged.reduce((s,v,i)=>s+v*orientation[i],0))>1-1e-10,'actual source bridge discarded an orientation axis')
    const late=[...frames.values()];effect.cleanup();late.forEach(fn=>fn(now+16));assert.equal(frames.size,0)
  }finally{effect?.cleanup();for(const [k,d] of saved){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
})

test('actual hidden/reduced effect reconstruction preserves an active reopen transfer and its previous clock',()=>{
  const frames=new Map();let id=0,now=0,effect
  const saved=['requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])
  globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id};globalThis.cancelAnimationFrame=id=>frames.delete(id)
  const tick=()=>{now+=16;const queued=[...frames.values()];frames.clear();queued.forEach(fn=>fn(now))},clock={current:{time:.890004,velocity:.004}}
  try{
    effect=hiddenEffect(false,clock,frames);const entry=effect.host.ballEntry
    advanceBallOrientation(entry,.9,.016,1);advanceBallOrientation(entry,.89,.016,-.002);advanceBallOrientation(entry,.890004,.001,.004)
    assert.ok(entry.orientation.reopen,'actual effect must preserve a real active transfer')
    const logical=structuredClone(entry.orientation)
    effect.cleanup();effect=hiddenEffect(true,clock,frames,effect)
    assert.deepEqual(effect.host.ballEntry.orientation,logical,'hidden reduced recreation discarded reopen state')
    for(let i=0;i<20;i++)tick()
    assert.deepEqual(effect.host.ballEntry.orientation,logical,'hidden frames aged the reopen decay')
    effect.cleanup();effect=hiddenEffect(false,clock,frames,effect);effect.show();tick()
    assert.deepEqual(effect.host.ballEntry.orientation,logical,'dt-zero resume reset carried omega/clock/decay')
    const replay=JSON.parse(JSON.stringify(entry));tick()
    advanceBallOrientation(replay,clock.current.time,.016,clock.current.velocity)
    assert.deepEqual(entry.orientation,replay.orientation,'visible reconstruction changed transfer evolution')
  }finally{effect?.cleanup();for(const [k,d] of saved){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
})

test('actual hidden/reduced effect reconstruction carries return momentum into the first ordinary source paint',()=>{
  const frames=new Map();let id=0,now=0,effect
  const saved=['requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])
  globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id};globalThis.cancelAnimationFrame=id=>frames.delete(id)
  const tick=()=>{now+=16;const queued=[...frames.values()];frames.clear();queued.forEach(fn=>fn(now))},clock={current:{time:2.3,velocity:-2}}
  try{
    effect=hiddenEffect(false,clock,frames);const entry=effect.host.ballEntry
    advanceBallOrientation(entry,2.3,.05,1);advanceBallOrientation(entry,2.28,.016,-2)
    const logical=structuredClone(entry.orientation),spin=effect.context.spinRef.current,time=effect.context.timeRef.current
    effect.cleanup();effect=hiddenEffect(true,clock,frames,effect)
    assert.deepEqual(effect.host.ballEntry.orientation,logical,'hidden reduced recreation discarded logical momentum')
    assert.deepEqual(effect.context.spinRef.current,spin);assert.equal(effect.context.timeRef.current,time)
    effect.cleanup();effect=hiddenEffect(false,clock,frames,effect)
    effect.host.ballEntry.want=false;effect.host.ballFlow.set(false,false);effect.show()
    for(let i=0;i<250;i++)tick()
    assert.equal(clock.current.time,0)
    const samples=effect.samples,before=samples.at(-2).quaternion,terminal=samples.at(-1),dt=.016
    const delta=ballQuaternionMultiply(terminal.quaternion,[-before[0],-before[1],-before[2],before[3]]),previousVelocity=delta.slice(0,3).map(v=>v*2/dt)
    effect.host.bridgeBallOrientation()
    const pose={...effect.context.positionRef.current,time:effect.context.timeRef.current,spin:effect.context.spinRef.current},h=1e-6
    const q=ballPoseQuaternion({...pose,time:pose.time+h,spin:stepSpin(pose.spin,h)}),d=ballQuaternionMultiply(q,[-terminal.quaternion[0],-terminal.quaternion[1],-terminal.quaternion[2],terminal.quaternion[3]])
    d.slice(0,3).forEach((v,i)=>assert.ok(Math.abs(v*2/h-previousVelocity[i])<2e-4,`actual return derivative jumped on axis ${i}`))
    const captured=captureBallOrientation(pose);captured.angularVelocity.forEach((v,i)=>assert.ok(Math.abs(v-terminal.angularVelocity[i])<2e-4,'second entry lost residual velocity'))
  }finally{effect?.cleanup();for(const [k,d] of saved){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
})

for(const detail of [true,false])for(const captureThrows of [false,true])test(`actual release preserves observed ${detail?'entry':'offsheet'} pose through ${captureThrows?'failed':'successful'} preview capture`,()=>{
  const releaseSource=volleyball.slice(volleyball.indexOf('    function release('),volleyball.indexOf('    function load('))
  const pose={x:.2,y:.1,time:8,spin:{yaw:2,pitch:1,yawSpeed:1,pitchSpeed:0}},entry={source:{width:600,height:500},orientation:captureBallOrientation(pose)}
  advanceBallOrientation({...entry,choreography:createBallChoreography({support:[.2,-.9,0],corner:[-2,-1.05,0]},pose)},.9,.016,1)
  const dataset={pose:'.2000,.1000',spin:JSON.stringify(pose.spin),time:'7.984',sourcePose:JSON.stringify({...pose,time:7.984,radius:1.18}),quaternion:JSON.stringify(entry.orientation.quaternion),motion:'last motion',diameter:'384',projection:'last projection',logicalOrientation:JSON.stringify(entry.orientation),runtime:'webgl',pendingFrame:'true'}
  // clearAlpha is deliberately absent: capture must not introduce live metadata.
  const observed=structuredClone(dataset),logical=structuredClone(entry.orientation),image={src:'old',dataset:{},style:{}},surface={dataset:{runtime:'webgl'}},calls=[]
  const host={dataset,...(detail?{ballEntry:entry}:{})},timeRef={current:8},spinRef={current:pose.spin},clockRef={current:{time:.9,velocity:1}},previewRef={current:'old preview'}
  let destroyed=0,paused=0
  const view={frame:{width:1440,height:1000},snapshotPose(){calls.push('scene');return 'exact scene'},resize(w,h){calls.push(['resize',w,h]);dataset.diameter='capture diameter'},snapshot(x,y,time,spin){
    calls.push(['ball',x,y,time,spin]);dataset.pose='capture pose';dataset.spin=JSON.stringify(spin);dataset.time=String(time);dataset.sourcePose=JSON.stringify({x,y,time,spin,radius:1});dataset.quaternion=JSON.stringify(ballPoseQuaternion({x,y,time,spin}));dataset.motion='capture motion';dataset.projection='capture projection';dataset.clearAlpha='0';dataset.triangles='77';dataset.panels='18'
    if(captureThrows)throw Error('capture unavailable')
    return 'exact bridged ball'
  },destroy(){destroyed++}}
  host.ballView=view
  const context={host,surface,image,view,generation:0,loading:true,flow:{pause(){paused++}},positionRef:{current:{x:pose.x,y:pose.y}},timeRef,spinRef,previewRef,detail:()=>detail,bridgeBallSpin}
  const state=new Function(...Object.keys(context),`${releaseSource};release();return {view,generation,loading}`)(...Object.values(context))
  for(const [key,value] of Object.entries(observed))if(!['runtime','pendingFrame'].includes(key))assert.equal(dataset[key],value,`${key} changed during release`)
  assert.equal(dataset.clearAlpha,undefined,'absent pose metadata leaked from capture')
  assert.equal(dataset.runtime,'static');assert.equal(surface.dataset.runtime,'static');assert.equal(dataset.pendingFrame,'false');assert.equal(host.ballView,undefined)
  assert.equal(destroyed,1);assert.equal(paused,1);assert.deepEqual(state,{view:null,generation:1,loading:false})
  assert.deepEqual(entry.orientation,logical);assert.equal(timeRef.current,8);assert.equal(spinRef.current,pose.spin);assert.deepEqual(clockRef.current,{time:.9,velocity:1})
  const captured=calls.find(c=>Array.isArray(c)&&c[0]==='ball'),spin=captured[4]
  if(detail){
    assert.deepEqual(calls.slice(0,2),['scene',['resize',600,500]])
    const q=ballPoseQuaternion({...pose,spin});assert.ok(Math.abs(q.reduce((s,v,i)=>s+v*entry.orientation.quaternion[i],0))>1-1e-10,'return preview lost full bridged orientation')
    assert.equal(image.src,'exact scene')
  }else{assert.equal(spin,pose.spin);if(!captureThrows)assert.equal(image.src,'exact bridged ball')}
  assert.equal(previewRef.current,captureThrows?'old preview':'exact bridged ball')
  assert.equal(dataset.triangles,'77','pose restoration must not roll back renderer/resource diagnostics')
})
