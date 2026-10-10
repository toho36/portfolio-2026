import test from 'node:test'
import assert from 'node:assert/strict'
import { stepWatchFlow, createWatchFlow } from './watchFlow.js'

test('entry and return land at rest, with a soft last segment in both directions',()=>{
  for(const target of [1,0]){
    let state={position:1-target,velocity:0},speeds=[]
    for(let i=0;i<60;i++){state=stepWatchFlow(state,target,1/60);speeds.push(Math.abs(state.velocity))}
    assert.deepEqual(state,{position:target,velocity:0})
    const moving=speeds.filter(v=>v>0)
    assert.ok(moving.at(-1)<.02,'hard landing')
    const peak=moving.indexOf(Math.max(...moving))
    assert.ok(moving.slice(peak+1).every((v,i)=>v<=moving[peak+i]),'second acceleration near landing')
  }
})

test('rapid reversals retain position and velocity, stay bounded and reach the requested end',()=>{
  let state={position:0,velocity:0}
  for(let i=0;i<10;i++)state=stepWatchFlow(state,1,1/60)
  const before={...state},reversed=stepWatchFlow(state,0,0)
  assert.deepEqual(reversed,before,'changing target must not reset pose or velocity')
  for(let i=0;i<120;i++){
    const target=i<4?0:i<9?1:i<20?0:1
    const next=stepWatchFlow(state,target,1/120)
    assert.ok(Math.abs(next.position-state.position)<.055,'one-frame jump')
    assert.ok(next.position>=0&&next.position<=1)
    state=next
  }
  for(let i=0;i<90;i++)state=stepWatchFlow(state,1,1/60)
  assert.deepEqual(state,{position:1,velocity:0})
})

test('controller owns one frame, pauses hidden time and disposes without late paints',()=>{
  const saved=new Map(),frames=new Map();let id=0,now=0,paints=[],ends=[]
  const values={requestAnimationFrame:fn=>{frames.set(++id,fn);return id},cancelAnimationFrame:id=>frames.delete(id),performance:{now:()=>now}}
  for(const [k,v] of Object.entries(values)){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,configurable:true})}
  const flow=createWatchFlow(p=>paints.push(p),p=>ends.push(p))
  function tick(){now+=16;const pending=[...frames];frames.clear();for(const [,fn] of pending)fn(now)}
  try{
    flow.set(true);tick();flow.set(false);flow.set(true);assert.equal(frames.size,1)
    flow.pause();const p=paints.at(-1);now+=10000;assert.equal(frames.size,0)
    flow.resume();tick();assert.ok(Math.abs(paints.at(-1)-p)<.06,'hidden time advanced transition')
    flow.set(false,true);assert.equal(paints.at(-1),0);assert.equal(ends.at(-1),0);assert.equal(frames.size,0)
    flow.set(true);const late=[...frames.values()];flow.destroy();flow.destroy();const count=paints.length
    for(const fn of late)fn(now+16)
    flow.set(false);assert.equal(frames.size,0);assert.equal(paints.length,count)
  }finally{flow.destroy();for(const [k,d] of saved){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
})
