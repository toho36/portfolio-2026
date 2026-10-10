import test from 'node:test'
import assert from 'node:assert/strict'
import { settleSheet, settleEase, coastPosition } from './model.js'

test('quiet scroll advances only after deliberate progress and honours reversal',()=>{
  assert.equal(settleSheet(.1,1),0)
  assert.equal(settleSheet(.3,1),1)
  assert.equal(settleSheet(1.7,-1),1)
  assert.equal(settleSheet(1.95,-1),2)
  assert.equal(settleSheet(2,1),2)
  assert.equal(settleSheet(-1,-1),0)
  assert.equal(settleSheet(1,1),1)
  assert.equal(settleEase(0),0);assert.equal(settleEase(1),1)
  const values=Array.from({length:101},(_,i)=>settleEase(i/100))
  assert.ok(values.every((v,i)=>v>=0&&v<=1&&(!i||v>=values[i-1])))
})

test('coasting preserves incoming velocity, only decelerates and never overshoots in either direction',()=>{
  for(const sign of [-1,1])for(const speed of [.5,1,18]){
    const from=400,target=from+sign*300,velocity=sign*speed,h=.0001
    assert.ok(Math.abs(coastPosition(from,target,velocity,0)-from)<1e-10)
    assert.ok(Math.abs((coastPosition(from,target,velocity,h)-from)/h-velocity)<speed*.0001)
    const duration=Math.max(1050,900/speed),dt=duration/1000
    let previous=from,previousSpeed=speed
    for(let i=1;i<=1000;i++){
      const next=coastPosition(from,target,velocity,i*dt),v=(next-previous)*sign/dt
      assert.ok(v>=-1e-10&&v<=previousSpeed+1e-10)
      assert.ok((next-from)*sign>=0&&(target-next)*sign>=-1e-10)
      previous=next;previousSpeed=v
    }
    assert.equal(previous,target)
  }
})

test('light input keeps its initial velocity but lands within 1.5 seconds without a creeping tail',()=>{
  for(const sign of [-1,1])for(const speed of [.001,.02,.1]){
    const from=400,target=from+sign*530,v=sign*speed,h=.001
    assert.equal(coastPosition(from,target,v,0),from)
    assert.ok(Math.abs((coastPosition(from,target,v,h)-from)/h-v)<.00001)
    assert.equal(coastPosition(from,target,v,1500),target)
    let previous=from,previousSpeed=speed,peaked=false
    for(let t=1;t<=1500;t++){
      const next=coastPosition(from,target,v,t),speedNow=(next-previous)*sign
      assert.ok(speedNow>=-1e-10&&speedNow<1.1,'bounded forward motion')
      assert.ok(Math.abs(speedNow-previousSpeed)<.005,'no velocity jump')
      if(speedNow<previousSpeed-1e-9)peaked=true
      if(peaked)assert.ok(speedNow<=previousSpeed+1e-9,'no stop/restart or second acceleration')
      previous=next;previousSpeed=speedNow
    }
  }
})
