import test from 'node:test'
import assert from 'node:assert/strict'
import { followPosition } from './ballMotion.js'

test('position returns slowly on exit without a first-frame jump',()=>{
  const first=followPosition(.5,0,1/60,false)
  assert.ok(first>.48&&first<.5)
  const following=followPosition(.5,0,1/60,true)
  assert.ok(following<first)
  const outcomes=[30,60,144].map(hz=>{
    let x=.5
    for(let i=0;i<hz;i++)x=followPosition(x,0,1/hz,false)
    return x
  })
  assert.ok(outcomes.every(x=>x>.09&&x<.12))
  assert.ok(outcomes.every(x=>Math.abs(x-outcomes[0])<1e-10))
  assert.equal(followPosition(.5,0,0,false),.5)
})
