import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createBallFlow,BALL_DURATION,createBallChoreography,captureBallOrientation,ballEase} from './ballFlow.js'
import {createWatchFlow} from './watchFlow.js'
import {staticLanding,staticStepImage} from './ballSteps.js'
import {ballEntryFrame,ballContactShift,ballEntryPresentation,ballContactLayout} from './ballScene.js'
import {deckPosition,sheetPose} from './model.js'

// Execute the current handlers/effects, with controlled React state commits,
// DOM surface ownership and the real flow controllers. No browser/GPU claim.
const source=readFileSync(new URL('./study.jsx',import.meta.url),'utf8')
const updateSource=source.slice(source.indexOf('    const update='),source.indexOf('    const preference='))
const syncSource=source.slice(source.indexOf('    const sync='),source.indexOf('    preference();'))
const handlers=source.slice(source.indexOf('  function enter('),source.indexOf('  useLayoutEffect(()=>{'))
const ballEffect=source.slice(source.indexOf('  useLayoutEffect(()=>{')+ '  useLayoutEffect(()=>{'.length,source.indexOf('  },[ballMounted,ballDesired,reduced])'))
const watchStart=source.indexOf('  useLayoutEffect(() => {')
const watchEffect=source.slice(watchStart+'  useLayoutEffect(() => {'.length,source.indexOf('  },[mounted,desired,reduced])'))
const watchActive=source.match(/<Watch active=\{(.*?)\} reduced/)[1]
const run=(code,context)=>new Function('context',`with(context){${code}}`)(context)
const ref=current=>({current})

function harness(initialOverflow=''){
  const frames=new Map();let frameId=0,now=0,maxOpen=0,cleaned=false
  const saved=['requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])
  globalThis.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId}
  globalThis.cancelAnimationFrame=id=>frames.delete(id)
  const style=()=>({setProperty(k,v){this[k]=v}})
  const surface=()=>({style:style(),image:{style:style(),dataset:{}},getBoundingClientRect:()=>({x:200,y:200}),querySelector(){return this.image}})
  const ballSurface=surface(),watchSurface=surface(),focus=[]
  ballSurface.getBoundingClientRect=()=>({x:201,y:201})
  const makeHost=(surface,id)=>{
    const cta={hidden:false,closest:()=>({dataset:{sheet:id}}),focus:()=>focus.push(id)}
    const label={offsetTop:20,offsetHeight:16},band={offsetTop:450,querySelector:()=>label}
    cta.getBoundingClientRect=()=>({top:660,bottom:700,left:650,right:790})
    const sheet={clientLeft:1,clientTop:1,clientWidth:600,clientHeight:500,parentElement:{clientWidth:602,clientHeight:502},getBoundingClientRect:()=>({x:200,y:200,top:200,bottom:700,width:600,height:500}),closest:()=>null,querySelector:q=>q==='.sheet-bottom'?band:cta}
    return {sheet,cta,dataset:{runtime:'webgl',diameter:'380',sourcePose:JSON.stringify({x:.2,y:-.3,time:9})},offsetLeft:0,offsetTop:0,closest:()=>sheet,append(s){s.parentElement=this},dispatchEvent(){}}
  }
  const ballHost=makeHost(ballSurface,'gameonvb'),watchHost=makeHost(watchSurface,'goal-loop')
  ballHost.ballSurface=ballSurface;ballHost.ballView={resize(){},extend(){},paint(){}};ballHost.append(ballSurface)
  watchHost.watchSurface=watchSurface;watchHost.watchView={resize(){}};watchHost.append(watchSurface)
  const makeDialog=()=>{
    const slot={append(s){s.parentElement=this}}
    return {slot,open:false,dataset:{},style:style(),querySelector:()=>slot,showModal(){this.open=true;maxOpen=Math.max(maxOpen,Number(ballDialog.open)+Number(watchDialog.open))},close(){this.open=false}}
  }
  const ballDialog=makeDialog(),watchDialog=makeDialog(),fan={style:{...style(),width:'',height:'',left:'',top:'',transform:''},getBoundingClientRect:()=>({x:200,y:200}),querySelectorAll:()=>[{getBoundingClientRect:()=>({left:200,right:802,top:200,bottom:702})},{getBoundingClientRect:()=>({left:180,right:820,top:170,bottom:750})},{getBoundingClientRect:()=>({left:210,right:830,top:180,bottom:730})}]},ballNavigation={focus:()=>focus.push('gameonvb-navigation')}
  const footer={style:{...style(),visibility:'',cssText:''}}
  const deck={style:style(),querySelector:q=>q==='.volleyball-view'?ballHost:q==='.watch-view'?watchHost:q==='.sheet-fan'?fan:q==='.table-footer'?footer:q==='button[aria-label="Show GameOnVB"]'?ballNavigation:watchHost.cta}
  const context={mounted:false,ballMounted:false,desired:false,ballDesired:false,reduced:false,position:0,scrollY:663,innerWidth:1440,innerHeight:1000,
    desiredRef:ref(false),ballDesiredRef:ref(false),restoreRef:ref(null),ballRestoreRef:ref(null),flowRef:ref(null),
    sourceRef:ref(null),ballSourceRef:ref(null),dialogScrollRef:ref(0),ballScrollRef:ref(0),dialogRef:ref(watchDialog),ballDialogRef:ref(ballDialog),deckRef:ref(deck),
    assist:{cancel(){}},assistRef:ref({cancel(){}}),location:{hash:'',pathname:'/',search:''},
    document:{hidden:false,body:{style:{overflow:initialOverflow}},createElement:()=>({style:style(),remove(){}})},
    window:{scrollTo({top}){context.scrollY=top}},getComputedStyle:o=>o===fan?{width:'602px',height:'502px',left:'501px',top:'451px'}:o===ballHost.sheet.parentElement?{width:'602px',height:'502px',transform:'none',transformOrigin:'301px 251px'}:o===ballHost.sheet.querySelector('.sheet-bottom')?{top:'450px',height:'44px',paddingTop:'12px',paddingBottom:'0px',borderTopWidth:'0px',borderBottomWidth:'0px'}:{width:'600',height:'500',transform:'none'},
    DOMMatrix:class{constructor(){Object.assign(this,{a:1,b:0,c:0,d:1,e:0,f:0})}},Event:class{},createWatchFlow,BALL_DURATION,staticLanding,staticStepImage,ballEntryFrame,ballContactShift,ballEntryPresentation,ballContactLayout,createBallChoreography,captureBallOrientation,ballEase,
    deckPosition,setPosition(value){context.position=value},setPhase(){},setBallPhase(){}}
  for(const key of ['mounted','ballMounted','desired','ballDesired'])context[`set${key[0].toUpperCase()+key.slice(1)}`]=value=>{context[key]=value}
  fan.parentElement={getBoundingClientRect:()=>({x:0,y:context.innerHeight===390?-190:0})}
  const history=[''];let cursor=0
  context.history={state:null,pushState(state,unused,hash){this.state=state;history.splice(++cursor);history.push(hash);context.location.hash=hash},replaceState(state,unused,url){this.state=state;context.location.hash=url.startsWith('#')?url:''},back(){if(cursor>0)context.location.hash=history[--cursor]}}
  ballHost.ballFlow=createBallFlow(state=>{ballHost.ballEntry?.paint(state.time);return false},p=>ballHost.ballEntry?.land(p))
  const sync=run(`${syncSource};return sync`,context)
  const update=run(`${updateSource};return update`,context)
  const actions=run(`${handlers};return {enter,back,ballBack}`,context)
  let ballDeps,watchDeps
  function commit(){
    for(let i=0;i<10;i++){
      const b=[context.ballMounted,context.ballDesired,context.reduced].join(),w=[context.mounted,context.desired,context.reduced].join()
      if(b===ballDeps&&w===watchDeps)return
      if(b!==ballDeps){ballDeps=b;run(ballEffect,context)}
      if(w!==watchDeps){watchDeps=w;run(watchEffect,context)}
    }
    assert.fail('state commit did not settle')
  }
  function invariant(){
    assert.ok(maxOpen<=1,'incoming opened before outgoing restored')
    const open=Number(ballDialog.open)+Number(watchDialog.open)
    assert.ok(open<=1)
    assert.equal(context.document.body.style.overflow,open?'hidden':initialOverflow,'modal scroll lock ownership')
    if(context.restoreRef.current)assert.equal(run(`return ${watchActive}`,context),true,'pending ball disabled returning watch')
  }
  function tick(){now+=16;const queued=[...frames.values()];frames.clear();queued.forEach(fn=>fn(now));commit();invariant()}
  function settle(){for(let i=0;i<400;i++)tick()}
  function hash(id){context.location.hash=id?`#${id}`:'';sync();commit();invariant()}
  function escape(id){actions[id==='gameonvb'?'ballBack':'back']();sync();commit();invariant()}
  function cleanup(){if(cleaned)return;cleaned=true;context.flowRef.current?.destroy();ballHost.ballFlow.destroy();context.restoreRef.current?.();context.ballRestoreRef.current?.();for(const [k,d] of saved){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
  return {context,hash,tick,settle,escape,actions,commit,invariant,cleanup,frames,update,ballHost,watchHost,ballDialog,watchDialog,ballSurface,watchSurface,focus}
}

for(const returning of [false,true])test(`actual App resize preserves captured source position during paused ball ${returning?'return':'entry'}`,()=>{
  const h=harness(),c=h.context
  try{
    c.innerWidth=320;c.innerHeight=780;h.update()
    assert.equal(c.position,1)
    h.hash('gameonvb');while(h.ballHost.ballFlow.state.time<1.2)h.tick()
    if(returning)h.hash('')
    h.ballHost.ballFlow.pause()
    assert.equal(c.ballDesired,!returning);assert.ok(c.ballRestoreRef.current)
    const position=c.position,poses=[0,1,2].map(i=>sheetPose(i,position)),entry=h.ballHost.ballEntry,clock={...h.ballHost.ballFlow.state},orientation=structuredClone(entry.orientation)
    for(const [width,height] of [[390,844],[844,390],[1440,1000]]){
      c.innerWidth=width;c.innerHeight=height;h.update();h.commit()
      entry.paint(clock.time)
      assert.equal(c.position,position,'native resize must not change the captured source deck position')
      assert.deepEqual([0,1,2].map(i=>sheetPose(i,c.position)),poses,'every source card must retain its rotation/scale/translation')
      assert.equal(h.ballHost.ballEntry,entry);assert.deepEqual(h.ballHost.ballFlow.state,clock);assert.deepEqual(entry.orientation,orientation)
      assert.equal(c.scrollY,663);assert.equal(c.ballScrollRef.current,663)
    }
  }finally{h.cleanup()}
})

for(const height of [1000,780])test(`actual ball land resumes source position at ${height}px height without a same-Y scroll event`,()=>{
  const h=harness(),c=h.context
  try{
    c.innerWidth=320;c.innerHeight=780;h.update();h.hash('gameonvb');h.settle()
    c.innerWidth=1440;c.innerHeight=height
    // The controlled scrollTo sets native Y but emits no scroll event.
    h.hash('');h.settle()
    assert.equal(c.ballRestoreRef.current,null)
    assert.equal(c.scrollY,663);assert.equal(c.ballScrollRef.current,663)
    assert.equal(c.position,deckPosition(663,height*.85),'release must explicitly resume current native viewport geometry')
    assert.equal(h.focus.at(-1),height===780?'gameonvb':'gameonvb-navigation')
    c.scrollY=340;h.update();assert.equal(c.position,deckPosition(340,height*.85),'ordinary native scroll resumes')
    c.innerHeight=900;h.update();assert.equal(c.position,deckPosition(340,900*.85),'ordinary resize resumes')
  }finally{h.cleanup()}
})

test('actual entry captures lower label support and lower-left corner from the card affine',()=>{
  const h=harness()
  try{
    h.hash('gameonvb')
    const entry=h.ballHost.ballEntry
    assert.ok(entry.choreography,'actual DOM contact capture missing')
    const card=entry.choreography.card
    assert.deepEqual(card.affine,{a:1,b:0,c:0,d:1,x:200,y:200})
    assert.deepEqual(card.supportScreen,{x:501,y:679})
    assert.deepEqual(card.cornerScreen,{x:200,y:702})
    assert.equal(entry.orientation.quaternion.length,4)
    assert.equal(entry.source.contact,entry.choreography)
    assert.deepEqual(['width','height','left','top'].map(k=>h.context.deckRef.current.querySelector('.sheet-fan').style[k]),['602px','502px','501px','451px'],'responsive relayout must not detach the captured contact frame')
    h.hash('');h.settle()
    assert.deepEqual(['width','height','left','top','transform'].map(k=>h.context.deckRef.current.querySelector('.sheet-fan').style[k]),['','','','',''],'return must restore the exact fan styles')
  }finally{h.cleanup()}
})
for(const age of [.13,.5,.9,1.78,2.15,2.6,3.25,3.55])for(const exit of ['escape','history','cleanup'])test(`actual ${exit} at ${age} restores nonempty fan/deck/footer/source styles`,()=>{
  const h=harness('scroll'),deck=h.context.deckRef.current,fan=deck.querySelector('.sheet-fan'),footer=deck.querySelector('.table-footer')
  const nodes=[fan,deck,footer,h.ballSurface,h.ballSurface.image]
  const saved=['transform: translate(-49%,-51%) !important; transform-origin: 12px 14px; width: 602px;','opacity: .83; overflow: visible;','visibility: visible !important; color: red;','left: 2px; overflow: clip;','object-fit: contain; opacity: .91;']
  nodes.forEach((n,i)=>n.style.cssText=saved[i]);fan.style.transform='translate(-49%,-51%)';deck.style.opacity='.83'
  try{
    h.hash('gameonvb');while(h.ballHost.ballFlow.state.time<age)h.tick()
    assert.equal(footer.style.visibility,'hidden','entry must hide source pagination and scroll hints')
    assert.equal(deck.style.opacity,'.83','deck must not fade')
    if(exit==='cleanup')h.cleanup()
    else{if(exit==='escape')h.escape('gameonvb');else h.hash('');h.settle()}
    nodes.forEach((n,i)=>assert.equal(n.style.cssText,saved[i],`exact inline restoration node ${i}`))
    assert.equal(h.ballSurface.parentElement,h.ballHost);assert.equal(h.context.document.body.style.overflow,'scroll')
    h.cleanup();assert.equal(h.frames.size,0)
  }finally{h.cleanup()}
})
test('actual return after changed viewport keeps exact scroll and focuses visible GameOnVB navigation',()=>{
  const h=harness()
  try{
    h.hash('gameonvb');h.settle();h.context.innerHeight=1100
    h.hash('');h.settle()
    assert.equal(h.context.scrollY,663)
    assert.equal(h.focus.at(-1),'gameonvb-navigation','source CTA is hidden at the new viewport-relative sheet position')
  }finally{h.cleanup()}
})
test('actual rotated fractional DOM frame retains the accepted first source projection',()=>{
  const h=harness(),angle=-.087,scale=.83,a=Math.cos(angle)*scale,b=Math.sin(angle)*scale,c=-b,d=a,cx=301.2,cy=251.1
  const affine={a,b,c,d,x:200+cx+100-a*cx-c*cy,y:200+cy-20-b*cx-d*cy},origin={a,b,c,d,x:affine.x+a*1.4+c*1.2,y:affine.y+b*1.4+d*1.2}
  h.context.DOMMatrix=class{constructor(){Object.assign(this,{a,b,c,d,e:100,f:-20})}}
  const originalStyle=h.context.getComputedStyle
  h.context.getComputedStyle=o=>o===h.ballHost.sheet.parentElement?{width:'602.4px',height:'502.2px',transform:'matrix',transformOrigin:'301.2px 251.1px'}:originalStyle(o)
  h.ballSurface.getBoundingClientRect=()=>({x:origin.x+Math.min(0,a*600)+Math.min(0,c*500),y:origin.y+Math.min(0,b*600)+Math.min(0,d*500)})
  try{
    h.hash('gameonvb');const entry=h.ballHost.ballEntry
    for(const key of Object.keys(origin))assert.ok(Math.abs(entry.source.origin[key]-origin[key])<1e-9,`fractional first source frame changed ${key}`)
    for(const key of Object.keys(affine))assert.ok(Math.abs(entry.choreography.card.affine[key]-affine[key])<1e-9,`card transform origin rounded ${key}`)
    assert.ok(Math.abs(entry.choreography.card.cornerScreen.y-(affine.y+d*502.2))<1e-9,'actual corner rounded')
  }finally{h.cleanup()}
})

for(const [outgoing,incoming] of [['gameonvb','goal-loop'],['goal-loop','gameonvb']]){
  for(const reverse of [false,true])test(`actual hash handoff ${outgoing} -> ${incoming}${reverse?' -> interrupted reversal':''}`,()=>{
    const h=harness()
    try{
      h.hash(outgoing);h.settle()
      const entry=h.ballHost.ballEntry,flow=h.context.flowRef.current,ballView=h.ballHost.ballView,watchView=h.watchHost.watchView
      h.hash(incoming)
      assert.equal(h.context[outgoing==='gameonvb'?'mounted':'ballMounted'],false,'pending incoming must defer mount')
      for(let i=0;i<8;i++)h.tick()
      if(reverse){
        const time=h.ballHost.ballFlow.state,transform=h.watchSurface.style.transform
        h.hash(outgoing)
        assert.deepEqual(h.ballHost.ballFlow.state,time,'reversal reset clock/velocity')
        assert.equal(h.watchSurface.style.transform,transform,'reversal reset current watch pose')
        assert.equal(h.ballHost.ballEntry,entry);assert.equal(h.context.flowRef.current,flow)
      }
      h.settle()
      const final=reverse?outgoing:incoming
      assert.equal(h.ballDialog.open,final==='gameonvb');assert.equal(h.watchDialog.open,final==='goal-loop')
      assert.equal(h.ballHost.ballView,ballView);assert.equal(h.watchHost.watchView,watchView)
      h.escape(final);h.settle()
      assert.equal(h.context.scrollY,663,'same-document hash return must preserve source scroll')
      assert.equal(h.context.mounted,false);assert.equal(h.context.ballMounted,false)
      assert.equal(h.ballSurface.parentElement,h.ballHost);assert.equal(h.watchSurface.parentElement,h.watchHost)
      assert.equal(h.context.restoreRef.current,null);assert.equal(h.context.ballRestoreRef.current,null)
      h.cleanup();assert.equal(h.frames.size,0)
    }finally{h.cleanup()}
  })
}

for(const age of [.13,.5,.9,1.78,2.15,2.6,3.25,3.55])test(`actual history serial handoff at ${age} restores ball before mounting watch`,()=>{
  const h=harness('scroll'),deck=h.context.deckRef.current,fan=deck.querySelector('.sheet-fan'),footer=deck.querySelector('.table-footer')
  fan.style.cssText='transform: translate(-49%,-51%);';footer.style.cssText='visibility: visible;'
  let restored=false
  h.ballHost.ballView.resize=()=>{
    assert.equal(h.context.mounted,false,'watch mounted before source projection/style restore')
    assert.equal(fan.style.cssText,'transform: translate(-49%,-51%);');assert.equal(footer.style.cssText,'visibility: visible;')
    assert.equal(h.ballSurface.parentElement,h.ballHost);restored=true
  }
  try{
    h.hash('gameonvb');while(h.ballHost.ballFlow.state.time<age)h.tick()
    const entry=h.ballHost.ballEntry
    h.hash('goal-loop');assert.equal(h.context.mounted,false);assert.equal(h.ballHost.ballEntry,entry)
    h.settle();assert.ok(restored);assert.equal(h.ballDialog.open,false);assert.equal(h.watchDialog.open,true)
  }finally{h.cleanup()}
})

for(const id of ['goal-loop','gameonvb'])test(`actual ${id} CTA/back/forward and cleanup preserve overflow`,()=>{
  const h=harness('scroll')
  try{
    h.context.scrollY=0
    const currentTarget=id==='gameonvb'?h.ballHost.cta:h.watchHost.cta
    h.actions.enter({button:0,currentTarget,preventDefault(){}});h.commit();h.invariant();h.settle()
    h.escape(id);h.settle();assert.equal(h.context.scrollY,0)
    h.hash(id);for(let i=0;i<8;i++)h.tick()
    h.hash('');for(let i=0;i<4;i++)h.tick()
    h.hash(id);h.settle();h.hash('');h.settle()
    assert.equal(h.context.document.body.style.overflow,'scroll')
    h.hash(id);h.cleanup();assert.equal(h.frames.size,0)
    assert.equal(h.context.document.body.style.overflow,'scroll')
  }finally{h.cleanup()}
})
