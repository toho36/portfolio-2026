import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const file=new URL('./ambient-preview.html',import.meta.url);
const html=existsSync(file)?readFileSync(file,'utf8'):'';
const code=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1]??'';
function setup({reduced=false,images=[]}={}){
 const nodes=new Map(),timers=new Map(),requests=[];let serial=0,observer,disconnected=false,clock=0;
 function node(){return {hidden:false,disabled:false,style:{},src:'',currentSrc:'',textContent:'',paused:true,readyState:3,loop:false,
  listeners:{},classList:{add(){},remove(){},toggle(){}},
  addEventListener(t,f){(this.listeners[t]??=[]).push(f);},
  removeEventListener(t,f){this.listeners[t]=(this.listeners[t]??[]).filter(x=>x!==f);},
  fire(t,e={}){for(const f of [...(this.listeners[t]??[])])f(e);},
  play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;},
  load(){this.currentSrc=this.src;if(this.src)requests.push(this.src);},
  removeAttribute(k){this[k]='';},decode(){return Promise.resolve();},
  getBoundingClientRect(){return {width:1000,height:700};},focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;}};}
 for(const id of ['hero','hold','poster','loop','peek','travel','game-copy','lab-copy','end-copy','next','skip','announcement','error','following'])nodes.set(id,node());
 nodes.get('error').hidden=true;
 const document={...node(),hidden:false,getElementById:id=>nodes.get(id)};
 const window=node(),motion={...node(),matches:reduced},portrait={...node(),matches:false};
 class Image {set src(value){this.url=value;}get src(){return this.url;}decode(){const result=images.shift();return result??Promise.resolve();}}
 runInNewContext(code,{document,window,Image,console,matchMedia:q=>q.includes('reduced')?motion:portrait,
  IntersectionObserver:class {constructor(fn){observer=fn;}observe(){}disconnect(){disconnected=true;}},
  ResizeObserver:class {observe(){}disconnect(){}},
  setTimeout(fn,delay){timers.set(++serial,{fn,at:clock+delay});return serial;},clearTimeout:id=>timers.delete(id)});
 const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
 return {nodes,document,window,motion,portrait,requests,images,timers,flush,
  visible(value){observer([{isIntersecting:value}]);},get disconnected(){return disconnected;},
  async tick(ms=150){clock+=ms;for(const [id,t] of [...timers])if(t.at<=clock){timers.delete(id);t.fn();}await flush();}};
}
const click=p=>p.nodes.get('next').fire('click');
async function arrive(p){p.nodes.get('travel').fire('playing');await p.tick();p.nodes.get('travel').fire('ended');await p.flush();}

test('standalone actual handlers exist',()=>assert.ok(code.length>1000));
test('ambient holds stay manual indefinitely',async()=>{
 const p=setup();await p.flush();await p.tick();
 assert.ok(p.requests.some(x=>x.endsWith('gameon-ambient.mp4')));
 assert.equal(p.nodes.get('lab-copy').hidden,true);
 p.nodes.get('loop').fire('ended');await p.flush();assert.equal(p.nodes.get('lab-copy').hidden,true);
});
test('Next preserves current hold until actual travel playing',async()=>{
 const p=setup();await p.flush();p.nodes.get('loop').fire('playing');click(p);await p.flush();
 assert.equal(p.nodes.get('hold').hidden,false);assert.equal(p.nodes.get('travel').style.opacity,'0');
 assert.ok(p.nodes.get('travel').src.endsWith('segB.mp4'));assert.equal(p.nodes.get('travel').loop,false);
 p.nodes.get('travel').fire('playing');await p.tick();assert.equal(p.nodes.get('hold').hidden,true);
 p.nodes.get('travel').fire('ended');await p.flush();assert.equal(p.nodes.get('lab-copy').hidden,false);
 assert.ok(p.nodes.get('loop').src.endsWith('goal-loop-ambient.mp4'));
});
test('second Next plays accepted C once and settles on stop3',async()=>{
 const p=setup();await p.flush();click(p);await arrive(p);click(p);
 assert.ok(p.nodes.get('travel').src.endsWith('segC.mp4'));assert.equal(p.nodes.get('travel').loop,false);
 await arrive(p);assert.equal(p.nodes.get('end-copy').hidden,false);
 assert.ok(p.nodes.get('poster').src.endsWith('stop-3.webp'));assert.equal(p.nodes.get('loop').paused,true);
 click(p);assert.equal(p.nodes.get('following').scrolled,true);
});
test('early Next never waits for image or ornament decode',async()=>{
 const pending=new Promise(()=>{}),p=setup({images:[pending]});click(p);await p.flush();
 assert.ok(p.nodes.get('travel').src.endsWith('segB.mp4'));assert.equal(p.nodes.get('hold').hidden,false);
});
test('reduced starts static without any movie request and routes both stills',async()=>{
 const p=setup({reduced:true});await p.flush();assert.equal(p.requests.length,0);
 click(p);await p.flush();assert.equal(p.nodes.get('lab-copy').hidden,false);
 click(p);await p.flush();assert.equal(p.nodes.get('end-copy').hidden,false);assert.equal(p.requests.length,0);
});
test('hidden and offscreen pause both channels and resume correct story',async()=>{
 const p=setup();await p.flush();p.visible(false);assert.equal(p.nodes.get('loop').paused,true);
 p.visible(true);await p.flush();assert.equal(p.nodes.get('loop').paused,false);
 click(p);p.nodes.get('travel').fire('playing');await p.tick();
 p.document.hidden=true;p.document.fire('visibilitychange');assert.equal(p.nodes.get('travel').paused,true);
 p.document.hidden=false;p.document.fire('visibilitychange');await p.flush();assert.equal(p.nodes.get('travel').paused,false);
});
test('real travel failure preserves valid hold and offers manual static route',async()=>{
 const p=setup();await p.flush();click(p);p.nodes.get('travel').fire('error');await p.flush();
 assert.equal(p.nodes.get('hold').hidden,false);assert.equal(p.nodes.get('error').hidden,false);
 assert.equal(p.nodes.get('next').disabled,false);click(p);await p.flush();assert.equal(p.nodes.get('lab-copy').hidden,false);
});
test('intentional Abort on pause does not become real failure',async()=>{
 const p=setup();await p.flush();let reject;
 const video=p.nodes.get('travel');video.play=()=>new Promise((_,r)=>{reject=r;});
 video.pause=()=>{video.paused=true;reject?.(Object.assign(Error('paused'),{name:'AbortError'}));};
 click(p);p.visible(false);await p.flush();assert.equal(p.nodes.get('error').hidden,true);
});
test('genuine play rejection enables fallback',async()=>{
 const p=setup();await p.flush();p.nodes.get('travel').play=()=>Promise.reject(Error('unsupported'));
 click(p);await p.flush();assert.equal(p.nodes.get('error').hidden,false);assert.equal(p.nodes.get('hold').hidden,false);
});
test('stale non-Abort play rejection after visibility resume is ignored',async()=>{
 const p=setup();await p.flush();let reject;const video=p.nodes.get('loop');
 video.pause();video.play=()=>new Promise((_,r)=>{reject=r;});p.visible(true);
 const oldReject=reject;p.visible(false);video.play=()=>Promise.resolve();p.visible(true);
 oldReject(Error('stale'));await p.flush();assert.equal(p.nodes.get('error').hidden,true);
});
test('stale still decode after orientation cannot overwrite current variant',async()=>{
 let release;const pending=new Promise(r=>{release=r;});const p=setup({images:[pending]});
 p.portrait.matches=true;p.portrait.fire('change');await p.flush();
 release();await p.flush();assert.ok(p.nodes.get('poster').src.includes('/mobile/'));
});
test('orientation during travel restores idle without stale hide timer',async()=>{
 const p=setup();await p.flush();click(p);p.nodes.get('travel').fire('playing');
 p.portrait.matches=true;p.portrait.fire('change');await p.flush();await p.tick();
 assert.equal(p.nodes.get('hold').hidden,false);assert.equal(p.nodes.get('travel').hidden,true);
 assert.equal(p.nodes.get('game-copy').hidden,false);
});
test('reduced change during travel settles static and clears movie sources',async()=>{
 const p=setup();await p.flush();click(p);p.motion.matches=true;p.motion.fire('change');await p.flush();
 assert.equal(p.nodes.get('lab-copy').hidden,false);assert.equal(p.nodes.get('loop').src,'');assert.equal(p.nodes.get('travel').src,'');
});
test('Escape during travel settles destination; visible Skip exits and releases listeners',async()=>{
 const p=setup();await p.flush();click(p);p.window.fire('keydown',{key:'Escape'});await p.flush();
 assert.equal(p.nodes.get('lab-copy').hidden,false);assert.equal(p.nodes.get('hero').focused,true);
 p.nodes.get('skip').fire('click');assert.equal(p.nodes.get('following').focused,true);assert.equal(p.disconnected,true);
 assert.equal(p.nodes.get('loop').paused,true);
 assert.equal(p.document.listeners.visibilitychange.length,0);
});
test('pagehide releases observers, timers and all media callbacks',async()=>{
 const p=setup();await p.flush();click(p);p.window.fire('pagehide');
 assert.equal(p.disconnected,true);assert.equal(p.timers.size,0);
 assert.equal(Object.values(p.nodes.get('travel').listeners).flat().length,0);
});
test('still decode failure retains previous valid poster and never blanks',async()=>{
 const p=setup();await p.flush();const previous=p.nodes.get('poster').src;
 p.images.push(Promise.reject(Error('missing still')));click(p);await arrive(p);
 assert.equal(p.nodes.get('poster').src,previous);assert.equal(p.nodes.get('hold').hidden,false);
 assert.equal(p.nodes.get('error').hidden,false);
});
test('no app import, idle RAF, network manifest, fake counter or story loop',()=>{
 assert.ok(!code.includes('requestAnimationFrame'));assert.ok(!code.includes('fetch('));assert.ok(!code.includes('main.js'));
 assert.ok(html.includes('id="skip"'));assert.ok(!code.includes('travel.loop=true'));
});
test('hidden initial decode starts no loop until document is visible',async()=>{
 const p=setup();p.document.hidden=true;await p.flush();assert.equal(p.requests.length,0);
 p.document.hidden=false;p.document.fire('visibilitychange');await p.flush();
 assert.ok(p.requests.some(x=>x.endsWith('gameon-ambient.mp4')));
});
test('loading stall recovers manually; hidden time does not consume stall timeout',async()=>{
 const p=setup();await p.flush();click(p);p.visible(false);await p.tick(9000);
 assert.equal(p.nodes.get('error').hidden,true);assert.equal(p.nodes.get('next').disabled,true);
 p.visible(true);await p.tick(6001);assert.equal(p.nodes.get('hold').hidden,false);
 assert.equal(p.nodes.get('next').disabled,false);assert.equal(p.nodes.get('error').hidden,false);
});
test('travel final frame remains until destination still decode completes',async()=>{
 const p=setup();await p.flush();click(p);p.nodes.get('travel').fire('playing');await p.tick();
 let release;p.images.push(new Promise(r=>{release=r;}));p.nodes.get('travel').fire('ended');await p.flush();
 assert.equal(p.nodes.get('travel').hidden,false);assert.equal(p.nodes.get('travel').style.opacity,'1');
 release();await p.flush();assert.equal(p.nodes.get('hold').hidden,false);assert.equal(p.nodes.get('travel').hidden,true);
});
test('old ended callback after orientation cannot change chapter',async()=>{
 const p=setup();await p.flush();click(p);const old=p.nodes.get('travel').listeners.ended[0];
 p.portrait.matches=true;p.portrait.fire('change');await p.flush();old();await p.flush();
 assert.equal(p.nodes.get('game-copy').hidden,false);assert.equal(p.nodes.get('lab-copy').hidden,true);
});
test('offscreen Escape preserves native focus and held chapter',async()=>{
 const p=setup();await p.flush();p.visible(false);p.window.fire('keydown',{key:'Escape'});
 assert.equal(p.nodes.get('following').focused,undefined);assert.equal(p.disconnected,false);
 assert.equal(p.nodes.get('game-copy').hidden,false);
});

test('orientation or reduced change during destination decode keeps the completed destination',async()=>{
 for(const mode of ['orientation','reduced']){
  const p=setup();await p.flush();click(p);p.nodes.get('travel').fire('playing');await p.tick();
  let release;p.images.push(new Promise(resolve=>{release=resolve;}));
  p.nodes.get('travel').fire('ended');await p.flush();
  if(mode==='orientation'){p.portrait.matches=true;p.portrait.fire('change');}
  else{p.motion.matches=true;p.motion.fire('change');}
  await p.flush();release();await p.flush();
  assert.equal(p.nodes.get('lab-copy').hidden,false,mode);
  assert.ok(p.nodes.get('poster').src.endsWith('stop-2.webp'));
 }
});

test('orientation hides the obsolete projected atlas before replacement still decoding',async()=>{
 const p=setup();await p.flush();assert.equal(p.nodes.get('peek').hidden,false);
 p.images.push(new Promise(()=>{}));p.portrait.matches=true;p.portrait.fire('change');
 assert.equal(p.nodes.get('peek').hidden,true);
});

test('persisted pagehide pauses but restored controls and media remain usable',async()=>{
 const p=setup();await p.flush();p.window.fire('pagehide',{persisted:true});
 assert.equal(p.disconnected,false);assert.equal(p.nodes.get('loop').paused,true);
 p.window.fire('pageshow',{persisted:true});await p.flush();
 assert.equal(p.nodes.get('loop').paused,false);click(p);
 assert.ok(p.nodes.get('travel').src.endsWith('segB.mp4'));
});

test('reduced change while the destination still is pending retains the final travel pixels',async()=>{
 const p=setup();await p.flush();click(p);p.nodes.get('travel').fire('playing');await p.tick();
 let release;p.images.push(new Promise(resolve=>{release=resolve;}));
 p.nodes.get('travel').fire('ended');await p.flush();
 p.motion.matches=true;p.motion.fire('change');
 assert.equal(p.nodes.get('travel').hidden,false);
 assert.equal(p.nodes.get('travel').style.opacity,'1');
 assert.equal(p.nodes.get('hold').hidden,true);
 await p.flush();release();await p.flush();
 assert.equal(p.nodes.get('lab-copy').hidden,false);
 assert.equal(p.nodes.get('travel').hidden,true);
});
