import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createBallChoreography,captureBallOrientation,advanceBallOrientation,stepBallFlow,ballFlight,ballQuaternionMultiply} from './ballFlow.js'

const fixture=JSON.parse(readFileSync(new URL('./nativeGeometryReturn.fixture.json',import.meta.url))).sources['entry-return']
const worldOmega=(a,b,dt)=>{
  let q=ballQuaternionMultiply(b,[-a[0],-a[1],-a[2],a[3]])
  if(q[3]<0)q=q.map(v=>-v)
  const n=Math.hypot(...q.slice(0,3)),scale=n?2*Math.atan2(n,q[3])/n/dt:0
  return q.slice(0,3).map(v=>v*scale)
}
const gap=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))
function crossing(dt,until=1.25){
  const entry={choreography:createBallChoreography(fixture.card,fixture.pose),orientation:captureBallOrientation(fixture.pose)}
  let clock={time:0,velocity:0},previous
  const step=target=>{
    const before=structuredClone(entry.orientation),prior={...clock}
    clock=stepBallFlow(clock,target,dt);advanceBallOrientation(entry,clock.time,dt,clock.velocity)
    const after=structuredClone(entry.orientation),measured=worldOmega(before.quaternion,after.quaternion,dt)
    const result={prior,clock:{...clock},before,after,measured,previous};previous=measured
    assert.ok(Math.hypot(...after.angularVelocity)<9,'reopen exceeded the original omega ceiling')
    assert.ok(Math.hypot(...measured)*dt<Math.max(.06,dt*9),'reopen exceeded the original quaternion watchdog')
    return result
  }
  while(clock.time<until)step(true)
  while(clock.velocity>-1)step(false)
  for(let i=0;i<10000;i++){
    const sample=step(true)
    if(sample.prior.velocity<0&&sample.clock.velocity>=0)return {entry,step,sample}
  }
  throw new Error('native fixture never crossed zero')
}

test('native rolling RETURN -> REOPEN quaternion derivative gap tends to zero with physical dt',()=>{
  const coarse=crossing(.0167).sample,fine=crossing(.001).sample
  const coarseGap=gap(coarse.previous,coarse.measured),fineGap=gap(fine.previous,fine.measured)
  console.log(JSON.stringify({coarse:{dt:.0167,gap:coarseGap,before:coarse.previous,after:coarse.measured},fine:{dt:.001,gap:fineGap,before:fine.previous,after:fine.measured}}))
  assert.ok(coarseGap<.5,`native coarse derivative jump ${coarseGap}`)
  assert.ok(fineGap<.08&&fineGap<coarseGap*.1,`native derivative plateau ${fineGap}`)
  assert.ok(gap(fine.after.angularVelocity,fine.measured)<.02,'advertised omega disagrees with rendered derivative')
})

test('corner reopen carries the remaining derivative into air before its transfer finishes',()=>{
  const {entry,step}=crossing(.001,1.90)
  for(let i=0;i<1000;i++){
    const sample=step(true)
    if(sample.prior.time<1.85&&sample.clock.time>=1.85){
      assert.ok(sample.before.reopen,'native corner must still have a transient at support loss')
      assert.ok(gap(sample.previous,sample.measured)<.03,'air endpoint dropped the carried angular derivative')
      // Also pin the exact authored endpoint, rather than only the first
      // sampled age just beyond it. Ordinary pure corner rolling stays exact.
      const endpoint={choreography:entry.choreography,orientation:structuredClone(sample.before)},h=1e-6,prior=structuredClone(endpoint.orientation)
      endpoint.orientation.age=1.85-sample.prior.velocity*h
      advanceBallOrientation(endpoint,1.85,h,sample.prior.velocity)
      assert.ok(gap(worldOmega(prior.quaternion,endpoint.orientation.quaternion,h),prior.angularVelocity)<1e-5,'exact support-loss frame dropped carried derivative')
      return
    }
  }
  throw new Error('corner never entered air')
})

for(const [phase,until] of [['pop',.28],['settle',.61],['corner',1.90],['freefall',2.3]])test(`${phase} reopen carries every world angular axis through zero`,()=>{
  const {entry,sample}=crossing(.001,until)
  assert.equal(ballFlight(sample.clock.time,entry.choreography).phase,phase)
  assert.ok(gap(sample.previous,sample.measured)<.08,`${phase} derivative reset`)
  assert.ok(gap(sample.after.angularVelocity,sample.measured)<.02,`${phase} advertised derivative reset`)
  if(phase==='pop'||phase==='settle')assert.ok(Math.hypot(...sample.previous.slice(0,2))>.01,'fixture must exercise source x/y spin')
})

test('reopen transfer expires into strict distance/radius rolling and survives dt-zero logical recreation',()=>{
  const {entry,step}=crossing(.0167)
  assert.ok(entry.orientation.reopen,'carried reopen residual missing')
  const frozen=structuredClone(entry.orientation),recreated=JSON.parse(JSON.stringify(entry))
  advanceBallOrientation(entry,.2,0,-3.5);assert.deepEqual(entry.orientation,frozen,'pause/resize reset residual or previous clock')
  advanceBallOrientation(recreated,.2,0,0);assert.deepEqual(recreated.orientation,frozen,'hidden/reduced recreation reset logical transfer')
  for(let i=0;i<28;i++)step(true)
  assert.equal(entry.orientation.reopen,undefined,'reopen residual must finish, not become additive permanent spin')
  const next=step(true),c=entry.choreography,angle=(ballFlight(next.clock.time,c).distance-ballFlight(next.prior.time,c).distance)/c.radius/2
  const expected=ballQuaternionMultiply([...c.axis.map(v=>v*Math.sin(angle)),Math.cos(angle)],next.before.quaternion)
  assert.ok(gap(expected,next.after.quaternion)<1e-10,'settled reopen must keep exact path rotation')
  assert.ok(gap(next.after.angularVelocity,ballFlight(next.clock.time,c).angularVelocity.map(v=>v*next.clock.velocity))<1e-10,'settled reopen must keep strict kinematic omega')
})
