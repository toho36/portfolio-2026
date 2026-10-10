import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {ballMotion} from './ballMotion.js'
import {ballFlight,createBallChoreography,stepBallFlow} from './ballFlow.js'
import {ballEntryPresentation,ballContactShift} from './ballScene.js'

const native=JSON.parse(readFileSync(new URL('./nativeGeometryReturn.fixture.json',import.meta.url)))
const captured=name=>{const f=structuredClone(native.sources[name]);f.source.contact=createBallChoreography(f.card,f.pose);return f}
const near=(a,b,epsilon=1e-9)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<epsilon,`axis ${i}: ${v} != ${b[i]}`))

test('captured 1000x900 native corner retains the full outline during contact',()=>{
  const {source,corner}=captured('1000-return')
  const p=ballEntryPresentation(source,1000,900,corner.age)
  const shift=ballContactShift(source,1000,900,corner.age)
  assert.ok(Math.abs(p.x-shift.x-corner.projection.x)<1e-9,'replay must use the actually captured corner geometry')
  assert.ok(Math.abs(p.diameter-corner.projection.diameter)<1e-9,'native projected radius changed')
  assert.ok(p.x-p.diameter/2>=0,`native left outline ${p.x-p.diameter/2}px`)
  assert.equal(p.fan.translation.x,shift.x,'ball and whole fan must share contact translation')
})

test('captured desktop contact stays stationary when it fits and retains strict outlines through viewport/orientation resize',()=>{
  for(const name of ['entry-return','1000-return']){
    const {source,pose,first}=captured(name),initial=ballEntryPresentation(source,source.viewport.width,source.viewport.height,0,pose)
    near(['x','y','diameter'].map(k=>initial[k]),['x','y','diameter'].map(k=>first[k]))
    for(const [w,h] of [[1440,1000],[1000,900],[768,1024],[390,844],[320,780],[844,390]]){
      for(let age=0;age<3.55;age+=.005){
        const p=ballEntryPresentation(source,w,h,age,pose),r=p.diameter/2
        assert.ok(p.x-r>=0&&p.x+r<=w&&p.y-r>=0&&p.y+r<=h,`${name} -> ${w}x${h} outline at ${age}`)
        if(name==='entry-return'&&w===1440&&age<1.85)assert.deepEqual(ballContactShift(source,w,h,age),{x:0,y:0},'accepted 1440 contact fits without translation')
      }
      for(const join of [.30,1.70,1.85]){
        const hStep=1e-6,a=ballEntryPresentation(source,w,h,join-hStep),b=ballEntryPresentation(source,w,h,join),c=ballEntryPresentation(source,w,h,join+hStep)
        for(const axis of ['x','y'])assert.ok(Math.abs((b[axis]-a[axis])/hStep-(c[axis]-b[axis])/hStep)<.1,`${w}x${h} ${join} ${axis} projection speed jump`)
      }
    }
  }
})

test('captured native near-return converges to the current ordinary pose on all position axes',()=>{
  const {source}=captured('entry-return'),c=source.contact,{last,end}=native.return
  const f=ballFlight(last.trace.age,c,last.pose),p=ballEntryPresentation(source,1440,1000,last.trace.age,last.pose)
  assert.ok(Math.hypot(p.x-end.center.x,p.y-end.center.y)<1,'captured return still snaps 17.589px to current normal motion')
  const atZero=ballFlight(0,c,end.pose),normal=ballMotion(end.pose.time,end.pose.x,end.pose.y,end.pose.spin).position
  near(atZero.position.map((v,i)=>v-c.anchor[i]),normal)
  assert.ok(Math.hypot(...f.position.map((v,i)=>v-c.anchor[i]-normal[i]))<.003,'last actual native pop remains near current source')
})

test('pop-only position and signed velocity meet the ordinary pose through return and interruption/reopen',()=>{
  const {source,pose}=captured('entry-return'),c=source.contact,current=native.return.end.pose,h=1e-6
  const sample=(age,now=current)=>ballFlight(age,c,now)
  const ordinary=now=>ballMotion(now.time,now.x,now.y,now.spin).position
  const normalVelocity=ordinary({...current,time:current.time+h}).map((v,i)=>(v-ordinary(current)[i])/h)
  const zero=sample(0)
  near(zero.position.map((v,i)=>v-c.anchor[i]),ordinary(current))
  near(zero.ambientVelocity,normalVelocity,1e-7)
  near(sample(0,pose).position,ballFlight(0,c).position)
  for(const age of [0,.00095,.1,.29999,.30,.62,1.2,1.70,1.80,1.85,2.15]){
    const f=sample(age)
    if(age>=.30){near(f.position,ballFlight(age,c).position);near(f.velocity,ballFlight(age,c).velocity);near(f.ambientVelocity,[0,0,0])}
    if(age<.30){
      const clock=age===0?0:-Math.sqrt(48*age),next=sample(Math.max(0,age+clock*h),{...current,time:current.time+h})
      const measured=next.position.map((v,i)=>(v-f.position[i])/h),signed=f.velocity.map((v,i)=>v*clock+f.ambientVelocity[i])
      near(measured,signed,5e-4)
    }
  }
  // Target changes keep the same logical clock and current ambient clock.
  let state={time:.1,velocity:-.8},elapsed=0
  for(const target of [0,1,0,1,1,1]){
    const now={...current,time:current.time+elapsed},before=sample(state.time,now),unchanged=stepBallFlow(state,target,0)
    near(sample(unchanged.time,now).position,before.position)
    state=stepBallFlow(state,target,h);elapsed+=h
    const after=sample(state.time,{...current,time:current.time+elapsed})
    near(after.position.map((v,i)=>(v-before.position[i])/h),before.velocity.map((v,i)=>v*unchanged.velocity+before.ambientVelocity[i]),5e-4)
  }
  const below=sample(.30-h),join=sample(.30),above=sample(.30+h)
  near(below.position,join.position,2e-6);near(below.velocity,join.velocity,5e-5);near(above.velocity,join.velocity,2e-4)
})
