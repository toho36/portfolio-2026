import { it as test, assert } from 'vitest'
import { createDeckAssist } from './deckAssist.js'
import { coastPosition } from './model.js'

type Input = { type: string; deltaY: number; pointerType?: string; touches?: unknown[]; key?: string }
type Harness = {
  assist: ReturnType<typeof createDeckAssist>
  event(name: string, extra?: Partial<Input>): void
  step(ms?: number): void
  root: { dataset: Record<string, string> }
  doc: { hidden: boolean; querySelector(): unknown }
  options: Map<string, AddEventListenerOptions>
  frames: Map<number, FrameRequestCallback>
  writes: number[]
}

// Controlled native position/RAF harness copied from the read-only study.
function browser(run: (h: Harness) => void, reduced=false, initialY=0, readback=(top: number)=>top, count=3) {
  const saved=new Map<string, PropertyDescriptor | undefined>(),listeners=new Map<string, (event: Input) => void>(),frames=new Map<number, FrameRequestCallback>(),timers=new Map<number, { fn: () => void; at: number }>(),options=new Map<string, AddEventListenerOptions>(),writes: number[]=[]
  let now=0,id=0
  const root={dataset:{} as Record<string, string>},doc={hidden:false,querySelector:(): unknown=>null,
    addEventListener:(name: string,fn: (event: Input)=>void)=>listeners.set(name,fn),removeEventListener:(name: string)=>listeners.delete(name)}
  const values: Record<string, unknown>={scrollY:initialY,innerHeight:1000,document:doc,performance:{now:()=>now},
    addEventListener:(name: string,fn: (event: Input)=>void,opt: AddEventListenerOptions)=>{listeners.set(name,fn);options.set(name,opt)},removeEventListener:(name: string)=>listeners.delete(name),
    requestAnimationFrame:(fn: FrameRequestCallback)=>{frames.set(++id,fn);return id},cancelAnimationFrame:(id: number)=>frames.delete(id),
    setTimeout:(fn: () => void,ms: number)=>{timers.set(++id,{fn,at:now+ms});return id},clearTimeout:(id: number)=>timers.delete(id)}
  values.window={scrollTo:({top}: { top: number })=>{writes.push(top);globalThis.scrollY=readback(top)},setTimeout:values.setTimeout}
  for(const [key,value] of Object.entries(values)){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true})}
  const assist=createDeckAssist(root as unknown as HTMLElement,()=>reduced,count)
  const event=(name: string,extra: Partial<Input>={})=>listeners.get(name)?.({type:name,deltaY:16,...extra})
  const step=(ms=16)=>{now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn()}const pending=[...frames];frames.clear();for(const [,fn] of pending)fn(now)}
  try{run({assist,event,step,root,doc,options,frames,writes})}finally{assist.destroy();for(const [key,d] of saved){if(d)Object.defineProperty(globalThis,key,d);else Reflect.deleteProperty(globalThis,key)}}
}

test('moving native scroll continues on the next frame with the sampled velocity, then only slows',()=>browser(({event,step,root})=>{
  for(let i=0;i<20;i++){event('wheel');globalThis.scrollY+=16;event('scroll');step()}
  const from=scrollY,positions: number[]=[]
  for(let i=0;i<250;i++){step();positions.push(scrollY);event('scroll')}
  const speeds=positions.map((y,i)=>(y-(i?positions[i-1]:from))/16)
  assert.ok(speeds[0]>.9&&speeds[0]<=1,`handoff speed ${speeds[0]}, expected continuous 1 px/ms`)
  assert.ok(speeds.every((v,i)=>v>=0&&(!i||v<=speeds[i-1]+1e-8)),'second acceleration or reversal')
  assert.strictEqual(positions.at(-1),850)
  assert.strictEqual(root.dataset.settling,'false')
}))

test('new reverse input cancels immediately and owns the next displacement',()=>browser(({event,step,root})=>{
  for(let i=0;i<20;i++){event('wheel');globalThis.scrollY+=16;event('scroll');step()}
  step();event('wheel',{deltaY:-16});assert.strictEqual(root.dataset.settling,'false')
  const before=scrollY;globalThis.scrollY-=16;event('scroll');step();step()
  assert.ok(scrollY<before-16)
}))

test('panning pointercancel does not release touchHeld',()=>browser(({event,step,root})=>{
  event('touchstart');event('pointerdown',{pointerType:'touch'})
  globalThis.scrollY=300;event('scroll');event('pointercancel',{pointerType:'touch'})
  for(let i=0;i<60;i++)step()
  assert.strictEqual(scrollY,300);assert.notStrictEqual(root.dataset.settling,'true')
  event('touchend',{touches:[]});for(let i=0;i<150;i++)step()
  assert.strictEqual(scrollY,850)
}))

test('native momentum resuming during assistance is sampled, not overwritten',()=>browser(({event,step})=>{
  for(let i=0;i<20;i++){event('wheel');globalThis.scrollY+=16;event('scroll');step()}
  step();globalThis.scrollY+=40;const native=scrollY;event('scroll');step()
  assert.strictEqual(scrollY,native)
  step();assert.ok(scrollY>native)
}))

test('dialog, outside deck and cancelled frames do not regain ownership',()=>browser(({assist,event,step,doc})=>{
  globalThis.scrollY=300;event('scroll');step();doc.querySelector=()=>({open:true});step()
  assert.strictEqual(scrollY,300)
  doc.querySelector=()=>null;globalThis.scrollY=1750;event('scroll');for(let i=0;i<100;i++)step()
  assert.strictEqual(scrollY,1750)
  assist.move(1);step();assist.cancel();const cancelled=scrollY
  for(let i=0;i<100;i++)step()
  assert.strictEqual(scrollY,cancelled)
}))

test('reduced motion leaves an input burst native, then selects instantly without feedback',()=>browser(({assist,event,step,root})=>{
  for(let i=0;i<20;i++){event('wheel');globalThis.scrollY+=16;event('scroll');step()}
  assert.strictEqual(scrollY,320)
  for(let i=0;i<20;i++)step()
  assert.strictEqual(scrollY,850);event('scroll');for(let i=0;i<100;i++)step()
  assert.strictEqual(scrollY,850);assert.strictEqual(root.dataset.settling,'false')
  assist.move(2);assert.strictEqual(scrollY,1700)
},true))

test('light native input lands promptly and explicit buttons select their exact destination',()=>browser(({assist,event,step,options})=>{
  assert.strictEqual(options.get('wheel')!.passive,true)
  for(let i=0;i<20;i++){event('wheel',{deltaY:1});globalThis.scrollY+=1;event('scroll');step()}
  for(let i=0;i<96;i++){step();event('scroll')}
  assert.strictEqual(scrollY,850)
  assist.move(2);for(let i=0;i<42;i++)step()
  assert.strictEqual(scrollY,1700)
  assist.move(0);for(let i=0;i<42;i++)step()
  assert.strictEqual(scrollY,0)
}))

test.each([
  { start: 0, positions: [350, 803, 1180, 1530], target: 1700 },
  { start: 1700, positions: [1350, 897, 520, 170], target: 0 },
  { start: 0, positions: [20, 1530], target: 1700 },
  { start: 1700, positions: [1680, 170], target: 0 },
  { start: 0, positions: [803, 854], target: 1700 },
  { start: 1700, positions: [897, 846], target: 0 },
])('new native samples rebase a passed frozen edge: $positions → $target',({start,positions,target})=>browser(({event,step,root})=>{
  let previous=start
  for(const y of positions){
    event('wheel',{deltaY:Math.sign(target-start)*350})
    previous=scrollY;globalThis.scrollY=y;event('scroll');step(64)
    assert.strictEqual(scrollY,y,'sampling must not overwrite native displacement')
  }
  const from=scrollY
  step()
  const handoff=scrollY
  for(let i=0;i<160;i++){step();event('scroll')}
  assert.strictEqual(scrollY,target,`fractional stalled endpoint ${scrollY/850}`)
  assert.strictEqual(handoff,coastPosition(from,target,(from-previous)/64,16),'preserve incoming sampled velocity and time')
  assert.strictEqual(root.dataset.settling,'false')
  for(let i=0;i<160;i++){step();event('scroll')}
  assert.strictEqual(scrollY,target,'no second automatic skip')
},false,start))

test('own-write readback and late scroll events never rebase or start another coast',()=>browser(({event,step,writes,root})=>{
  event('wheel');globalThis.scrollY=320;event('scroll');step()
  step();const own=scrollY
  assert.strictEqual(own,Math.round(writes.at(-1)!))
  assert.notStrictEqual(own,writes.at(-1))
  // A delayed event reads the current actual position, not its old event-time position.
  step(48);event('scroll');step();event('scroll')
  assert.ok(scrollY>own&&scrollY<850)
  for(let i=0;i<160;i++){step();event('scroll')}
  assert.strictEqual(scrollY,850);assert.strictEqual(root.dataset.settling,'false')
  const count=writes.length
  for(let i=0;i<160;i++){event('scroll');step()}
  assert.strictEqual(scrollY,850);assert.strictEqual(writes.length,count)
},false,0,Math.round))

test('a late native crossing samples velocity from actual own-write readback',()=>browser(({event,step,writes,root})=>{
  event('wheel');globalThis.scrollY=350;event('scroll');step();step()
  const before=scrollY
  assert.strictEqual(before,Math.round(writes.at(-1)!))
  event('wheel');globalThis.scrollY=1180
  step() // Native scroll event arrives a frame after the input cancelled assistance.
  event('scroll');step();assert.strictEqual(scrollY,1180)
  step();assert.strictEqual(scrollY,Math.round(coastPosition(1180,1700,(1180-before)/32,16)))
  event('scroll') // Late own-write event reads lastY and must not become native input.
  for(let i=0;i<320;i++){step();event('scroll')}
  assert.strictEqual(scrollY,1700);assert.strictEqual(root.dataset.settling,'false')
},false,0,Math.round))

test.each([1,-1])('a same-direction burst resumes after an exact endpoint without a stale edge (%s)',sign=>browser(({event,step,root})=>{
  event('wheel',{deltaY:sign*350});globalThis.scrollY=850;event('scroll');step();step()
  assert.strictEqual(scrollY,850);assert.strictEqual(root.dataset.settling,'false')
  // Still within 260ms of the previous input: the old edge remains frozen.
  event('wheel',{deltaY:sign*20});globalThis.scrollY+=sign*20;event('scroll');step()
  for(let i=0;i<160;i++){step();event('scroll')}
  assert.strictEqual(scrollY,sign>0?1700:0);assert.strictEqual(root.dataset.settling,'false')
},false,sign>0?0:1700))

test.each([1,-1])('new input after a completed coast selects one adjacent card (%s)',sign=>browser(({event,step,root})=>{
  event('wheel',{deltaY:sign*320});globalThis.scrollY+=sign*320;event('scroll');step()
  for(let i=0;i<160;i++){step();event('scroll')}
  assert.strictEqual(scrollY,850);assert.strictEqual(root.dataset.settling,'false')
  event('wheel',{deltaY:sign*20});globalThis.scrollY+=sign*20;event('scroll');step()
  for(let i=0;i<320;i++){step();event('scroll')}
  assert.strictEqual(scrollY,sign>0?1700:0);assert.strictEqual(root.dataset.settling,'false')
},false,sign>0?0:1700))

test('a rebased coast reverses immediately on new native input and ends exactly',()=>browser(({event,step,root})=>{
  event('wheel');globalThis.scrollY=803;event('scroll');step()
  event('wheel');globalThis.scrollY=1180;event('scroll');step();step()
  event('wheel',{deltaY:-350});assert.strictEqual(root.dataset.settling,'false')
  globalThis.scrollY-=40;const native=scrollY;event('scroll');step()
  assert.strictEqual(scrollY,native);step();assert.ok(scrollY<native)
  for(let i=0;i<320;i++){step();event('scroll')}
  assert.strictEqual(scrollY,850);assert.strictEqual(root.dataset.settling,'false')
}))

test.each(['hidden','dialog','notes','pointer','key','resize','cancel'])('rebased assistance respects %s interruption',guard=>browser(({assist,event,step,doc,root})=>{
  event('wheel');globalThis.scrollY=803;event('scroll');step()
  event('wheel');globalThis.scrollY=1180;event('scroll');step();step()
  if(guard==='hidden'){doc.hidden=true;event('visibilitychange')}
  if(guard==='dialog')doc.querySelector=()=>({open:true})
  if(guard==='notes'){globalThis.scrollY=1750;event('scroll')}
  if(guard==='pointer')event('pointerdown',{pointerType:'mouse'})
  if(guard==='key')event('keydown',{key:'ArrowDown'})
  if(guard==='resize')event('resize')
  if(guard==='cancel')assist.cancel()
  const stopped=scrollY
  for(let i=0;i<160;i++)step()
  assert.strictEqual(scrollY,stopped);assert.strictEqual(root.dataset.settling,'false')
}))

test('native rebasing uses the actual viewport step captured by the helper',()=>browser(({event,step})=>{
  globalThis.innerHeight=844
  event('wheel');globalThis.scrollY=700;event('scroll');step()
  event('wheel');globalThis.scrollY=730;event('scroll');step()
  for(let i=0;i<320;i++){step();event('scroll')}
  assert.strictEqual(scrollY,844*.85*2)
}))


// Wider synthetic decks above retain the original assistance/interruption checks.
// The actual production count must also clamp and release at its second card.
test('the two-card deck has no third stop and releases native supporting-section scroll',()=>browser(({assist,event,step})=>{
  assist.move(2); for(let i=0;i<50;i++)step()
  assert.strictEqual(scrollY,850)
  globalThis.scrollY=1050;event('scroll');for(let i=0;i<100;i++)step()
  assert.strictEqual(scrollY,1050)
},false,0,top=>top,2))
