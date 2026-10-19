import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const file = new URL('./arena-hold-preview.html', import.meta.url);
test('standalone preview exists', () => assert.ok(existsSync(file), 'working two-state page required'));
const html = existsSync(file) ? readFileSync(file,'utf8') : '';
const code = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1] ?? '';
function setup({ reduced = false } = {}) {
 const nodes=new Map(), timers=new Map(); let clock=0, serial=0, observer;
 function node() { return {hidden:false,disabled:false,style:{},dataset:{},src:'',textContent:'',paused:true,
  listeners:{},classList:{add(){},remove(){},toggle(){}},
  addEventListener(t,f){(this.listeners[t]??=[]).push(f);},
  fire(t,e={}){for(const f of this.listeners[t]??[])f(e);},
  play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;},load(){},
  decode(){return Promise.resolve();},getBoundingClientRect(){return {width:1000,height:700};},
  focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;} }; }
 for (const name of ['hero','hold','poster','loop','peek','travel','landing','game-copy','lab-copy','next','announcement','error','following']) nodes.set(name,node());
 const document={...node(),hidden:false,getElementById:id=>nodes.get(id)};
 const motion={...node(),matches:reduced},portrait={...node(),matches:false},window=node();
 const variant={size:[320,180],hold_homography:[.5,0,.25,0,.3,.2,0,0,1],
  poster:'./assets/desktop/poster.png',peek:'./assets/desktop/lab-peek.png',landing:'./assets/desktop/lab-228.png',
  loop:'./assets/desktop/loop.mp4',travel:'./assets/desktop/travel.mp4'};
 class Observer {constructor(fn){observer=fn;}observe(){} }
 runInNewContext(code,{document,window,console,performance:{now:()=>clock},
  matchMedia:q=>q.includes('reduced')?motion:portrait,
  fetch:async()=>({ok:true,json:async()=>({variants:{desktop:variant,mobile:variant}})}),
  IntersectionObserver:Observer,ResizeObserver:class {observe(){}},
  setTimeout(fn,delay){timers.set(++serial,{fn,at:clock+delay});return serial;},
  clearTimeout:id=>timers.delete(id)});
 const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
 return {nodes,document,motion,portrait,window,flush,
  visible(value){observer([{isIntersecting:value}]);},
  async tick(ms){clock+=ms;for(const [id,t]of [...timers])if(t.at<=clock){timers.delete(id);t.fn();}await flush();}};
}
test('manual Next retains hold until travel playing, then settles on native landing',async()=>{
 const p=setup();await p.flush();await p.tick(5000);
 assert.equal(p.nodes.get('lab-copy').hidden,true);
 p.nodes.get('next').fire('click');await p.flush();
 assert.equal(p.nodes.get('hold').hidden,false);
 p.nodes.get('travel').fire('playing');await p.tick(150);
 assert.equal(p.nodes.get('hold').hidden,true);
 p.nodes.get('travel').fire('ended');await p.flush();
 assert.equal(p.nodes.get('lab-copy').hidden,false);
 assert.equal(p.nodes.get('landing').hidden,false);
});
test('hidden and offscreen pause native video and visible fade clock',async()=>{
 const p=setup();await p.flush();await p.tick(500);
 p.document.hidden=true;p.document.fire('visibilitychange');await p.tick(9000);
 assert.equal(p.nodes.get('loop').paused,true);
 assert.equal(p.nodes.get('peek').style.opacity,'0');
 assert.equal(p.nodes.get('peek').style.animationPlayState,'paused');
 p.document.hidden=false;p.document.fire('visibilitychange');await p.tick(1000);
 assert.equal(p.nodes.get('peek').style.opacity,'1');
 p.visible(false);assert.equal(p.nodes.get('loop').paused,true);
 p.visible(true);await p.flush();assert.equal(p.nodes.get('loop').paused,false);
});
test('early Next keeps hold through loading; stall recovery remains manual',async()=>{
 const p=setup();await p.flush();p.nodes.get('next').fire('click');await p.flush();
 assert.equal(p.nodes.get('hold').hidden,false);
 await p.tick(5001);
 assert.equal(p.nodes.get('hold').hidden,false);assert.equal(p.nodes.get('next').disabled,false);
 assert.equal(p.nodes.get('lab-copy').hidden,true);
});
test('leaving during travel pauses and returning resumes without changing chapter',async()=>{
 const p=setup();await p.flush();p.nodes.get('next').fire('click');p.nodes.get('travel').fire('playing');
 await p.tick(150);p.visible(false);
 assert.equal(p.nodes.get('travel').paused,true);
 await p.tick(9000);assert.equal(p.nodes.get('lab-copy').hidden,true);
 p.visible(true);await p.flush();assert.equal(p.nodes.get('travel').paused,false);
});
test('orientation change cancels in-flight transition without stale timer hiding hold',async()=>{
 const p=setup();await p.flush();p.nodes.get('next').fire('click');p.nodes.get('travel').fire('playing');
 p.portrait.matches=true;p.portrait.fire('change');await p.flush();await p.tick(200);
 assert.equal(p.nodes.get('hold').hidden,false);assert.equal(p.nodes.get('next').disabled,false);
 assert.equal(p.nodes.get('travel').hidden,true);
});
test('reduced motion is static and Next needs no video',async()=>{
 const p=setup({reduced:true});await p.flush();
 assert.equal(p.nodes.get('loop').src,'');
 assert.equal(p.nodes.get('peek').style.opacity,'1');
 p.nodes.get('next').fire('click');await p.flush();
 assert.equal(p.nodes.get('travel').src,'');
 assert.equal(p.nodes.get('lab-copy').hidden,false);
});
test('travel failure keeps a valid still and allows manual fallback',async()=>{
 const p=setup();await p.flush();p.nodes.get('next').fire('click');await p.flush();
 p.nodes.get('travel').fire('error');await p.flush();
 assert.equal(p.nodes.get('hold').hidden,false);
 assert.equal(p.nodes.get('error').hidden,false);
 assert.equal(p.nodes.get('next').disabled,false);
 p.nodes.get('next').fire('click');await p.flush();
 assert.equal(p.nodes.get('lab-copy').hidden,false);
});
test('projection includes cover crop and no idle animation loop or app imports',async()=>{
 assert.ok(code.includes('matrix3d'));
 assert.ok(!code.includes('requestAnimationFrame'));
 assert.ok(!code.includes('main.js'));
 const p=setup();await p.flush();
 const transform=p.nodes.get('peek').style.transform;
 assert.ok(transform.startsWith('matrix3d('));
 const m=transform.slice(9,-1).split(',').map(Number);
 assert.equal(m.length,16);assert.ok(m.every(Number.isFinite));
 // 320:180 covering 1000:700 => width 1244.44, horizontal crop 122.22.
 assert.ok(Math.abs(m[12]-(.25*(700*320/180)-(700*320/180-1000)/2))<1e-8);
});

test('intentional pending-play interruption is not a media failure',async()=>{
 for(const mode of ['loop','travel','Escape']){
  const p=setup(),video=p.nodes.get(mode==='loop'?'loop':'travel');let reject;
  p.nodes.get('error').hidden=true;
  video.play=function(){this.paused=false;return new Promise((resolve,fail)=>{reject=fail;});};
  video.pause=function(){this.paused=true;reject?.(Object.assign(new Error('intentional pause'),{name:'AbortError'}));reject=null;};
  await p.flush();
  if(mode!=='loop')p.nodes.get('next').fire('click');
  if(mode==='Escape')p.window.fire('keydown',{key:'Escape'});
  else{p.document.hidden=true;p.document.fire('visibilitychange');}
  await p.flush();
  assert.equal(p.nodes.get('error').hidden,true,mode);
  if(mode==='Escape')assert.equal(p.nodes.get('lab-copy').hidden,false);
  else{
   if(mode==='travel')assert.equal(p.nodes.get('next').disabled,true);
   p.document.hidden=false;p.document.fire('visibilitychange');await p.flush();
   assert.equal(video.paused,false);
   if(mode==='travel'){
    video.fire('playing');video.fire('ended');await p.flush();
    assert.equal(p.nodes.get('lab-copy').hidden,false);
   }
  }
 }
});

test('a genuine play rejection still preserves the manual static fallback',async()=>{
 const p=setup();p.nodes.get('error').hidden=true;await p.flush();
 p.nodes.get('travel').play=()=>Promise.reject(Object.assign(new Error('bad media'),{name:'NotSupportedError'}));
 p.nodes.get('next').fire('click');await p.flush();
 assert.equal(p.nodes.get('error').hidden,false);
 assert.equal(p.nodes.get('hold').hidden,false);
 assert.equal(p.nodes.get('next').disabled,false);
 p.nodes.get('next').fire('click');await p.flush();
 assert.equal(p.nodes.get('lab-copy').hidden,false);
});
