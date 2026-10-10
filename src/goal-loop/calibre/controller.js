import { PARTS, GEARS, approachOpen, gearOutline, layers } from './model'
import { createCalibre } from './view.js'
import { loadCalibreView } from './loadView'
export function mountCalibre(root) {
const document = root.ownerDocument, window = document.defaultView
const $ = id => root.querySelector(`[data-calibre="${id}"]`)
const stage = $('stage')
const requestAnimationFrame = window.requestAnimationFrame.bind(window), cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
const matchMedia = window.matchMedia.bind(window)
const IntersectionObserver = window.IntersectionObserver, ResizeObserver = window.ResizeObserver
let view=null, frame=0, frames=0, generation=0, destroyed=false, visible=stage.getBoundingClientRect().bottom>0&&stage.getBoundingClientRect().top<window.innerHeight
let open=0, targetOpen=0, playing=true, selected=null, time=0, trainTime=0, lastStamp=null, lastPaint=0, cameraMoving=false
let staticAngle=0, staticZoom=1, pointer=null, rendered=null, cachedCamera=null
const media=matchMedia('(prefers-reduced-motion: reduce)')
let reduced=media.matches, loading=false
const removers=[]
function listen(target,name,callback,options){target.addEventListener(name,callback,options);removers.push(()=>target.removeEventListener(name,callback,options))}
function info(){
  const part=PARTS.find(p=>p.id===selected)
  $('part-name').textContent=part?.name||'A living anatomy.'
  $('part-text').textContent=part?.text||'One recognisable whole, opened into its working parts.'
  $('part').value=selected||''
  $('part-card').hidden=!$('labels').checked
  $('open').firstChild.textContent=targetOpen?'Assemble movement ':'Open movement '
  $('open').setAttribute('aria-pressed',String(Boolean(targetOpen)))
  $('motion').textContent=reduced?'Static motion':playing?'Pause motion':'Animate movement'
  $('motion').disabled=reduced
  $('motion').setAttribute('aria-pressed',String(playing&&!reduced))
}
function svgPaint(){
  const pose=layers(open)
  $('fallback').style.transform=`scale(${staticZoom}) rotate(${staticAngle}deg)`
  $('static-barrel').innerHTML=`<ellipse cx="285" cy="${234-pose.barrel*32}" rx="69" ry="50" fill="url(#${root.dataset.brass})" stroke="#8a774d" stroke-width="2"/><ellipse cx="285" cy="${234-pose.barrel*32}" rx="43" ry="31" fill="none" stroke="#727b7b" stroke-width="2"/><circle cx="285" cy="${234-pose.barrel*32}" r="7" fill="#82304e"/>`
  $('static-train').innerHTML=GEARS.map(g=>{const x=365+g.x*59,y=293-g.y*43-pose.train*26;return `<path d="M${gearOutline(g.radius*59,g.teeth).map(([px,py])=>`${x+px} ${y+py*.72}`).join(' L')}Z" fill="url(#${root.dataset.brass})" stroke="#8e7c50"/><ellipse cx="${x}" cy="${y}" rx="${g.radius*25}" ry="${g.radius*18}" fill="#c3c9c3"/><circle cx="${x}" cy="${y}" r="5" fill="#81354d"/>`}).join('')
  const y=345-pose.balance*28
  $('static-balance').innerHTML=`<ellipse cx="441" cy="${y}" rx="70" ry="50" fill="none" stroke="#b9a265" stroke-width="7"/><ellipse cx="441" cy="${y}" rx="51" ry="36" fill="none" stroke="#68767b" stroke-width="2"/>${Array.from({length:6},(_,i)=>`<ellipse cx="441" cy="${y}" rx="${10+i*6}" ry="${7+i*4}" fill="none" stroke="#68767b" stroke-width="1"/>`).join('')}<circle cx="441" cy="${y}" r="8" fill="#8b304d"/>`
  $('static-bridges').innerHTML=`<path d="M229 ${359-pose.bridges*32} Q194 ${260-pose.bridges*32} 257 ${173-pose.bridges*32} L313 ${155-pose.bridges*32} Q355 ${179-pose.bridges*32} 324 ${235-pose.bridges*32} L302 ${285-pose.bridges*32} Q310 ${349-pose.bridges*32} 260 ${372-pose.bridges*32} Z" fill="url(#${root.dataset.silver})" stroke="#9ba8a2"/><path d="M412 ${176-pose.bridges*32} L473 ${170-pose.bridges*32} L520 ${214-pose.bridges*32} L512 ${274-pose.bridges*32} L482 ${282-pose.bridges*32} L467 ${231-pose.bridges*32} Z" fill="url(#${root.dataset.silver})" stroke="#9ba8a2"/>`
  for(const part of PARTS)$(`static-${part.id}`).style.opacity=selected&&selected!==part.id?'.8':'1'
  return {moving:false,bounds:null,triangles:0,balanceAngle:0,trainAngles:[]}
}
function paint(){
  rendered=view?view.render(time,open,selected,trainTime):svgPaint()
  cameraMoving=Boolean(rendered?.moving);frames++
  stage.dataset.ready='true';stage.dataset.open=open.toFixed(4)
}
function schedule(){if(!frame&&!destroyed&&visible&&!document.hidden)frame=requestAnimationFrame(tick)}
function tick(stamp){
  frame=0
  if(destroyed||!visible||document.hidden)return
  if(lastStamp===null)lastStamp=stamp
  const dt=Math.min(.1,Math.max(0,(stamp-lastStamp)/1000));lastStamp=stamp
  open=approachOpen(open,targetOpen,dt,reduced||!view)
  if(playing&&!reduced&&view){time+=dt;trainTime+=dt*Math.max(0,1-open/.14)}
  if(!(playing&&!reduced&&view)||stamp-lastPaint>=33||!rendered){paint();lastPaint=stamp}
  if(open!==targetOpen||cameraMoving||(playing&&!reduced&&view))schedule()
}
listen($('open'),'click',()=>{targetOpen=1-targetOpen;info();schedule()})
listen($('motion'),'click',()=>{playing=!playing;info();lastStamp=null;schedule()})
listen($('part'),'change',()=>{selected=$('part').value||null;info();schedule()})
listen($('labels'),'change',info)
listen($('reset'),'click',()=>{view?.reset();staticAngle=0;staticZoom=1;schedule()})
function orbit(amount){if(view)view.orbitBy(amount);else staticAngle+=amount*70;schedule()}
function zoom(amount){if(view)view.zoomBy(amount);else staticZoom=Math.max(.65,Math.min(2.4,staticZoom*amount));schedule()}
for(const button of root.querySelectorAll('[data-orbit]'))listen(button,'click',()=>orbit(Number(button.dataset.orbit)))
for(const button of root.querySelectorAll('[data-zoom]'))listen(button,'click',()=>zoom(Number(button.dataset.zoom)))
listen(stage,'keydown',event=>{
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();orbit(event.key==='ArrowLeft'?-.15:.15)}
  if(event.key==='+'||event.key==='='||event.key==='-'){event.preventDefault();zoom(event.key==='-'?.88:1.14)}
})
listen(stage,'wheel',event=>{
  if(view){if(view.atZoomLimit(event.deltaY))event.stopImmediatePropagation();return}
  const before=staticZoom,next=Math.max(.65,Math.min(2.4,before*(event.deltaY<0?1.08:.92)))
  if(next!==before){event.preventDefault();staticZoom=next;schedule()}
},{capture:true,passive:false})
listen(stage,'pointerdown',event=>{if(!event.isPrimary)return;pointer={id:event.pointerId,x:event.clientX,y:event.clientY,angle:staticAngle,moved:false};stage.focus({preventScroll:true})})
listen(document,'pointermove',event=>{
  if(!pointer||pointer.id!==event.pointerId)return
  if(Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>4)pointer.moved=true
  if(!view){staticAngle=pointer.angle+(event.clientX-pointer.x)*.18;schedule()}
})
listen(document,'pointerup',event=>{
  if(!pointer||pointer.id!==event.pointerId)return
  const p=pointer;pointer=null
  if(!p.moved&&view){selected=view.pick(event.clientX,event.clientY);info();schedule()}
})
listen(document,'pointercancel',()=>{pointer=null})
function stop(){cancelAnimationFrame(frame);frame=0;lastStamp=null;pointer=null}
listen(document,'visibilitychange',()=>{if(document.hidden)stop();else {initialize();schedule()}})
const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible)stop();else {initialize();schedule()}});observer.observe(stage)
let width=stage.clientWidth,height=stage.clientHeight
const resize=new ResizeObserver(()=>{if(stage.clientWidth===width&&stage.clientHeight===height)return;width=stage.clientWidth;height=stage.clientHeight;view?.resize();lastStamp=null;schedule()});resize.observe(stage)
function fallback(message){generation++;loading=false;stop();const old=view;view=null;old?.destroy();stage.dataset.runtime='static';$('capability').hidden=false;$('capability').textContent=message;info();paint()}
async function initialize(){
  if(destroyed||loading||view||!visible||document.hidden||!root.isConnected)return
  if(reduced){fallback('Reduced motion: static anatomy, same opening and inspection controls.');return}
  loading=true
  const epoch=++generation
  const result=await loadCalibreView({
    isCanceled:()=>destroyed||reduced||epoch!==generation||!visible||document.hidden||!root.isConnected,
    createView:(three,orbit)=>createCalibre(three,orbit,stage,schedule),
  })
  if(destroyed||epoch!==generation){if(result.status==='created')result.view.destroy();return}
  loading=false
  if(result.status==='canceled')return
  if(result.status==='failed'){fallback('3D unavailable. Static anatomy remains open to inspection.');return}
  view=result.view
  if(cachedCamera){view.restoreCamera(cachedCamera);cachedCamera=null}
  stage.dataset.runtime='webgl';$('capability').hidden=true
  info();paint();lastStamp=null;schedule()
}
listen(media,'change',event=>{reduced=event.matches;if(reduced)fallback('Reduced motion: your current anatomy and selection are preserved.');else initialize()})
listen(stage,'webglcontextlost',event=>{event.preventDefault();if(!destroyed)fallback('3D context lost. Current anatomy is preserved in the schematic.')},true)
function dispose(){if(destroyed)return;stop();destroyed=true;generation++;observer.disconnect();resize.disconnect();removers.forEach(remove=>remove());view?.destroy();view=null;stage.dataset.ready='false'}
listen(window,'pagehide',event=>{
  if(!event.persisted){dispose();return}
  stop();generation++;loading=false;cachedCamera=view?.cameraState()||null
  const old=view;view=null;old?.destroy();stage.dataset.runtime='static';paint()
})
listen(window,'pageshow',event=>{if(event.persisted&&!destroyed){lastStamp=null;initialize()}})
Object.defineProperty(root,'calibre',{configurable:true,value:Object.freeze({
  get state(){return {open,targetOpen,playing,reduced,selected,time,frames,scheduled:Boolean(frame),runtime:stage.dataset.runtime,camera:view?.cameraState()||{angle:staticAngle,zoom:staticZoom},rendered:structuredClone(rendered),destroyed}},dispose,
})})
info();paint();initialize()
return root.calibre
}
