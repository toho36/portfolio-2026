import test from 'node:test'
import assert from 'node:assert/strict'
import { ballMotion, createSpin, kickSpin, stepSpin } from './ballMotion.js'

test('ball drifts and rolls without pointer input, stays bounded under pointer extremes', () => {
  const a=ballMotion(0,0,0),b=ballMotion(2,0,0)
  assert.notDeepEqual(a.position,b.position)
  assert.notDeepEqual(a.rotation,b.rotation)
  for(let t=0;t<40;t+=.25)for(const x of [-.5,.5])for(const y of [-.5,.5]){
    const p=ballMotion(t,x,y)
    assert.ok(Math.abs(p.position[0])+1<1.3)
    assert.ok(Math.abs(p.position[1])+1<1.3)
  }
})

test('fast passes add angular momentum, repeat passes accumulate and exit never restores orientation',()=>{
  const slow=kickSpin(createSpin(),.25,0,.15),fast=kickSpin(createSpin(),.25,0,.015)
  assert.ok(fast.yawSpeed>slow.yawSpeed)
  const moving=stepSpin(fast,.1),repeat=kickSpin(moving,.25,0,.015)
  assert.ok(repeat.yawSpeed>moving.yawSpeed)
  const coasting=stepSpin(repeat,.5)
  assert.ok(coasting.yaw>repeat.yaw)
  assert.ok(coasting.yawSpeed<repeat.yawSpeed&&coasting.yawSpeed>.16)
  assert.notEqual(coasting.yaw,createSpin().yaw)
  assert.ok(Math.abs(kickSpin(repeat,100,100,.001).yawSpeed)<=8)
  const once=kickSpin(createSpin(),1.2,0,.1)
  let sampled=createSpin()
  for(let i=0;i<10;i++)sampled=kickSpin(sampled,.12,0,.01)
  assert.ok(Math.abs(once.yawSpeed-sampled.yawSpeed)<1e-9,'event frequency changes the impulse')
})

test('orientation bridge basis survives normal damping and brush momentum unchanged',()=>{
  const base=createSpin(),basis=[.2,.3,.1,Math.sqrt(.86)],bridged={...base,basis}
  assert.deepEqual(stepSpin(bridged,.05),{...stepSpin(base,.05),basis})
  assert.deepEqual(kickSpin(bridged,.2,.1,.03),{...kickSpin(base,.2,.1,.03),basis})
  assert.deepEqual(ballMotion(9,.2,-.3,bridged),ballMotion(9,.2,-.3,base))
})
