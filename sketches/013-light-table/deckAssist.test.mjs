import test from 'node:test'
import assert from 'node:assert/strict'
import { createDeckAssist } from './deckAssist.js'

function browser(run,reduced=false) {
  const saved=new Map(),listeners=new Map(),frames=new Map(),timers=new Map(),options=new Map()
  let now=0,id=0
  const root={dataset:{}},doc={hidden:false,querySelector:()=>null,addEventListener(){},removeEventListener(){}}
  const values={scrollY:0,innerHeight:1000,document:doc,performance:{now:()=>now},
    addEventListener:(name,fn,opt)=>{listeners.set(name,fn);options.set(name,opt)},removeEventListener:name=>listeners.delete(name),
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id},clearTimeout:id=>timers.delete(id)}
  values.window={scrollTo:({top})=>{globalThis.scrollY=top},setTimeout:values.setTimeout}
  for(const [key,value] of Object.entries(values)){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true})}
  const assist=createDeckAssist(root,()=>reduced)
  const event=(name,extra={})=>listeners.get(name)?.({type:name,deltaY:16,...extra})
  const step=()=>{now+=16;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn()}const pending=[...frames];frames.clear();for(const [,fn] of pending)fn(now)}
  try{run({assist,event,step,root,doc,options,frames})}finally{assist.destroy();for(const [key,d] of saved){if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key]}}
}

test('moving native scroll continues on the next frame with the sampled velocity, then only slows',()=>browser(({event,step,root})=>{
  for(let i=0;i<20;i++){event('wheel');globalThis.scrollY+=16;event('scroll');step()}
  const from=scrollY,positions=[]
  for(let i=0;i<250;i++){step();positions.push(scrollY);event('scroll')}
  const speeds=positions.map((y,i)=>(y-(i?positions[i-1]:from))/16)
  assert.ok(speeds[0]>.9&&speeds[0]<=1,`handoff speed ${speeds[0]}, expected continuous 1 px/ms`)
  assert.ok(speeds.every((v,i)=>v>=0&&(!i||v<=speeds[i-1]+1e-8)),'second acceleration or reversal')
  assert.equal(positions.at(-1),850)
  assert.equal(root.dataset.settling,'false')
}))

test('new reverse input cancels immediately and owns the next displacement',()=>browser(({event,step,root})=>{
  for(let i=0;i<20;i++){event('wheel');globalThis.scrollY+=16;event('scroll');step()}
  step();event('wheel',{deltaY:-16});assert.equal(root.dataset.settling,'false')
  const before=scrollY;globalThis.scrollY-=16;event('scroll');step();step()
  assert.ok(scrollY<before-16)
}))

test('panning pointercancel does not release touchHeld',()=>browser(({event,step,root})=>{
  event('touchstart');event('pointerdown',{pointerType:'touch'})
  globalThis.scrollY=300;event('scroll');event('pointercancel',{pointerType:'touch'})
  for(let i=0;i<60;i++)step()
  assert.equal(scrollY,300);assert.notEqual(root.dataset.settling,'true')
  event('touchend',{touches:[]});for(let i=0;i<150;i++)step()
  assert.equal(scrollY,850)
}))

test('native momentum resuming during assistance is sampled, not overwritten',()=>browser(({event,step})=>{
  for(let i=0;i<20;i++){event('wheel');globalThis.scrollY+=16;event('scroll');step()}
  step();globalThis.scrollY+=40;const native=scrollY;event('scroll');step()
  assert.equal(scrollY,native)
  step();assert.ok(scrollY>native)
}))

test('dialog, outside deck and cancelled frames do not regain ownership',()=>browser(({assist,event,step,doc})=>{
  globalThis.scrollY=300;event('scroll');step();doc.querySelector=()=>({open:true});step()
  assert.equal(scrollY,300)
  doc.querySelector=()=>null;globalThis.scrollY=1750;event('scroll');for(let i=0;i<100;i++)step()
  assert.equal(scrollY,1750)
  assist.move(1);step();assist.cancel();const cancelled=scrollY
  for(let i=0;i<100;i++)step()
  assert.equal(scrollY,cancelled)
}))

test('reduced motion leaves an input burst native, then selects instantly without feedback',()=>browser(({assist,event,step,root})=>{
  for(let i=0;i<20;i++){event('wheel');globalThis.scrollY+=16;event('scroll');step()}
  assert.equal(scrollY,320)
  for(let i=0;i<20;i++)step()
  assert.equal(scrollY,850);event('scroll');for(let i=0;i<100;i++)step()
  assert.equal(scrollY,850);assert.equal(root.dataset.settling,'false')
  assist.move(2);assert.equal(scrollY,1700)
},true))

test('light native input lands promptly and explicit buttons select their exact destination',()=>browser(({assist,event,step,options})=>{
  assert.equal(options.get('wheel').passive,true)
  for(let i=0;i<20;i++){event('wheel',{deltaY:1});globalThis.scrollY+=1;event('scroll');step()}
  for(let i=0;i<96;i++){step();event('scroll')}
  assert.equal(scrollY,850)
  assist.move(2);for(let i=0;i<42;i++)step()
  assert.equal(scrollY,1700)
  assist.move(0);for(let i=0;i<42;i++)step()
  assert.equal(scrollY,0)
}))
