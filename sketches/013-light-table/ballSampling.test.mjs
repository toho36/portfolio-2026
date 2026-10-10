import test from 'node:test'
import assert from 'node:assert/strict'
import * as motion from './ballMotion.js'
const {createSpin,kickSpin,brushSpin}=motion

test('sub-8ms pointer sampling does not change impulse',()=>{
  const speeds=[1,10,25,100].map(count=>{
    let s=createSpin()
    for(let i=0;i<count;i++)s=kickSpin(s,.6/count,0,.1/count)
    return s.yawSpeed
  })
  assert.ok(speeds.every(v=>Math.abs(v-speeds[0])<1e-9),JSON.stringify(speeds))
  assert.deepEqual(kickSpin(createSpin(),1,0,0),createSpin())
})
test('only the segment inside the ball contributes, independent of event splits',()=>{
  const crossing=[1,4,20,100].map(count=>{
    let s=createSpin()
    for(let i=0;i<count;i++)s=brushSpin(s,{x:-2+4*i/count,y:0,time:200*i/count},{x:-2+4*(i+1)/count,y:0,time:200*(i+1)/count},{x:0,y:0},1)
    return s.yawSpeed
  })
  assert.ok(crossing.every(v=>Math.abs(v-crossing[0])<1e-9),JSON.stringify(crossing))
  assert.deepEqual(brushSpin(createSpin(),{x:-2,y:2,time:0},{x:2,y:2,time:200},{x:0,y:0},1),createSpin())
})
