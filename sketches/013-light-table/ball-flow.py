"""Parent-run Chrome acceptance after isolated rebuild; NEVER run in writer sandbox.
Native click/key/history/tap; touch, hidden, reduced and no-GPU are emulated.
Writes only scratch evidence, never project assets. Physical devices NOT TESTED.
"""
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse
import hashlib,json,math
from playwright.sync_api import sync_playwright
URL='http://127.0.0.1:5186/'
BUILD=Path.home()/'.hermes/cache/scratch/light-table-build'
OUT=Path.home()/'.hermes/cache/scratch/light-table-ball-entry-work'/('browser-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True)
report={'errors':[],'traces':{},'physical_devices':'NOT TESTED','emulated':['touch/coarse','reduced','hidden','no WebGL']}
# Pure checks run on recorded native state; Node executes this exact block too.
CHECKS='''function check(data) {
 const require=(ok,label)=>{if(!ok)throw new Error(label)},norm=a=>Math.hypot(...a),sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const multiply=(a,b)=>{const [x,y,z,w]=a,[X,Y,Z,W]=b;return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z]};
 const delta=(a,b)=>{const q=multiply(b,[-a[0],-a[1],-a[2],a[3]]);return q[3]<0?q.map(v=>-v):q};
 const angle=(a,b)=>{const q=delta(a,b);return 2*Math.atan2(norm(q.slice(0,3)),Math.abs(q[3]))};
 const orientation=(a,b)=>{require(a?.length===4&&b?.length===4&&Math.abs(norm(a)-1)<1e-10&&Math.abs(norm(b)-1)<1e-10,'invalid quaternion');const error=angle(a,b);require(error<1e-10,'orientation reset');return error};
 if(data.mode==='orientation')return orientation(data.a,data.b);
 if(data.mode==='screenPair'){
   const {a,b,end,expectedStyles}=data,dt=b.sourceTime-a.sourceTime,seconds=(b.stamp-a.stamp)/1000;
   require(dt>=-.001&&dt<.16&&b.time-a.time>=-.001&&b.time-a.time<.16,'source handoff clock reset');
   const handoff=a.open&&!b.open,x=a.projectionSpace,y=b.projectionSpace,captured=x?.capturedSource;
   const resized=handoff&&captured&&(captured.viewport.width!==b.viewport.width||captured.viewport.height!==b.viewport.height);
   let geometryDifference=0,classification='same_projection';
   if(resized){
     require(x.mode==='entry'&&y?.mode==='source'&&JSON.stringify(captured)===JSON.stringify(y.capturedSource),'source projection provenance');
     geometryDifference=Math.max(Math.abs(captured.width-y.viewFrame.width),Math.abs(captured.height-y.viewFrame.height));
     require(geometryDifference>1&&captured.sourceBounds&&Math.max(Math.abs(captured.sourceBounds.width-y.sourceBounds.width),Math.abs(captured.sourceBounds.height-y.sourceBounds.height))>1,'responsive source projection geometry unchanged');
     classification='responsive_relayout';
   }else if(a.viewport.width===b.viewport.width&&a.viewport.height===b.viewport.height){
     require(['x','y'].every(k=>Math.abs(a.center[k]-b.center[k])<Math.max(40,(b.stamp-a.stamp)*6)),'position teleported');
   }
   for(const [speed,baseline] of [['yawSpeed',.16],['pitchSpeed',0]])require(Math.abs(b.spin[speed]-(baseline+(a.spin[speed]-baseline)*Math.exp(-1.1*dt)))<.03,'angular momentum discontinuity');
   if(!handoff)return {classification,geometryDifference,seconds,dt};
   require(end&&!end.open&&a.phase==='leaving'&&a.trace.phase==='pop','source handoff endpoint');
   for(const f of [a,end,b])require(f.sameView&&f.sameCanvas&&f.connected&&f.count===1&&f.runtime==='webgl'&&JSON.stringify(f.material)===JSON.stringify(a.material),'source handoff identity/material/canvas');
   require(end.sourceTime>=a.sourceTime&&end.sourceTime<=b.sourceTime&&end.time>=a.time-.001&&end.time<=b.time+.001,'source handoff endpoint clock');
   // Retain the exact model/derivative checks at both sides of age zero.
   check({mode:'frame',f:a});
   const positionBridge=check({mode:'positionBridge',tr:end.terminalTrace,pose:end.pose,position:end.motion.position});
   const bridge=check({mode:'bridge',orientation:end.orientation,pose:end.pose,quaternion:end.quaternion});
   orientation(end.terminalTrace.quaternion,end.quaternion);
   check({mode:'pair',a,b});
   const worldGap=norm(sub(sub(a.trace.position,a.trace.anchor),end.motion.position)),age=a.trace.age;
   require(age>=0&&age<.30&&age<=Math.abs(a.trace.clockVelocity)*(end.sourceTime-a.sourceTime)+24*(end.sourceTime-a.sourceTime)**2,'source handoff flight clock');
   require(worldGap<norm(a.trace.pathVelocity)*age+26*age*age+.062*(end.sourceTime-a.sourceTime)+1e-10,'source handoff world position integration');
   const endSourceFraming=[];
   for(const f of [end,b]){
     const space=f.projectionSpace,{width:w,height:h}=space.viewFrame,m=space.sourceMatrix,r=space.sourceBounds,size=space.surfaceSize;
     require(space.mode==='source'&&w>0&&h>0&&size.width===w&&size.height===h,'normal source view frame');
     const pose=f.pose,normal=[pose.x*.36+Math.sin(pose.time*.65)*.07,pose.y*-.2+Math.sin(pose.time*.9)*.045,0];
     require(norm(sub(f.motion.position,normal))<1e-10,'normal source world position');
     const span=Math.max(2.6,2.6/(w/h)),local={x:w/2+normal[0]*h/span,y:h/2-normal[1]*h/span,diameter:2*h/span};
     const center={x:r.x+r.width/2+m.a*(local.x-w/2)+m.c*(local.y-h/2),y:r.y+r.height/2+m.b*(local.x-w/2)+m.d*(local.y-h/2)};
     require(['x','y','diameter'].every(k=>Math.abs(f.projection[k]-local[k])<1)&&['x','y'].every(k=>Math.abs(f.nativeSourceProjection[k]-local[k])<1&&Math.abs(f.center[k]-center[k])<1),'end source framing parity');
     require(Math.abs(pose.time-f.sourceTime)<1e-10&&Math.abs(f.time-f.sourceTime)<=.00051,'normal source clock');
     endSourceFraming.push({local,center,diameter:local.diameter*Math.hypot(m.a,m.b)});
   }
   for(const f of [end,b]){
     const restored=f.restoration;
     require(restored.scroll===restored.expectedScroll&&restored.focus===restored.expectedFocus,'native scroll/focus restoration');
     require(JSON.stringify(restored.styles)===JSON.stringify(expectedStyles),'exact source style restoration');
   }
   return {classification,geometryDifference,seconds,dt,worldGap,positionBridge,bridge,endSourceFraming};
 }
 if(data.mode==='reopenCrossing'){
   const {a,b,c}=data,dt1=b.sourceTime-a.sourceTime,dt2=c.sourceTime-b.sourceTime;
   require(dt1>0&&dt2>0&&dt1<.16&&dt2<.16,'reopen crossing clocks');
   require(b.trace.clockVelocity<0&&c.trace.clockVelocity>=0&&b.trace.phase==='rolling'&&c.trace.phase==='rolling'&&c.trace.reopen,'native rolling zero crossing absent');
   const velocity=(x,y,dt)=>{const q=delta(x,y),n=norm(q.slice(0,3)),k=n?2*Math.atan2(n,q[3])/n/dt:0;return q.slice(0,3).map(v=>v*k)};
   const before=velocity(a.quaternion,b.quaternion,dt1),after=velocity(b.quaternion,c.quaternion,dt2),gap=norm(sub(after,before));
   require(gap<Math.max(.06,9*(dt1+dt2)),'reopen world angular derivative discontinuity');
   return {dt1,dt2,before,after,gap,residual:c.trace.reopen};
 }
 if(data.mode==='positionBridge'){
   const {pose,tr,position}=data,normal=[pose.x*.36+Math.sin(pose.time*.65)*.07,pose.y*-.2+Math.sin(pose.time*.9)*.045,0],velocity=[.07*.65*Math.cos(pose.time*.65),.045*.9*Math.cos(pose.time*.9),0];
   require(tr.age===0&&tr.clockVelocity===0,'return position clock endpoint');
   require(tr.ambientPose.x===pose.x&&tr.ambientPose.y===pose.y&&tr.ambientPose.time===pose.time,'return current ambient pose');
   require(norm(sub(sub(tr.position,tr.anchor),normal))<1e-10&&norm(sub(position,normal))<1e-10,'return position bridge');
   require(norm(sub(tr.velocity,velocity))<1e-10&&norm(sub(tr.ambientVelocity,velocity))<1e-10,'return position derivative');
   return {positionError:norm(sub(sub(tr.position,tr.anchor),position)),velocityError:norm(sub(tr.velocity,velocity))};
 }
 if(data.mode==='bridge'){
   // Finite-difference the returned source pose including its full basis and
   // decaying handoff. Constants are pinned against actual ballMotion in Node.
   const {pose,orientation:o}=data,h=1e-6;
   const poseQ=(time,s)=>{const r=[s.pitch+Math.sin(time*.55)*.055,s.yaw,-.16+Math.sin(time*.7)*.065].map(v=>v/2),[sx,sy,sz]=r.map(Math.sin),[cx,cy,cz]=r.map(Math.cos);
     let q=[sx*cy*cz+cx*sy*sz,cx*sy*cz-sx*cy*sz,cx*cy*sz+sx*sy*cz,cx*cy*cz-sx*sy*sz];if(s.basis)q=multiply(s.basis,q);if(s.handoff)q=multiply(s.handoff.quaternion,q);return q};
   const s=pose.spin,d=Math.exp(-1.1*h),travel=(1-d)/1.1,next={...s,yaw:s.yaw+.16*h+(s.yawSpeed-.16)*travel,pitch:s.pitch+s.pitchSpeed*travel};
   if(s.handoff){const speed=norm(s.handoff.velocity),a=speed*travel/2,k=speed?Math.sin(a)/speed:0;next.handoff={...s.handoff,quaternion:multiply([...s.handoff.velocity.map(v=>v*k),Math.cos(a)],s.handoff.quaternion)}}
   const q=poseQ(pose.time,s),firstError=orientation(o.quaternion,data.quaternion);orientation(q,data.quaternion);
   const dq=delta(q,poseQ(pose.time+h,next)),velocity=dq.slice(0,3).map(v=>2*v/h),error=velocity.map((v,i)=>Math.abs(v-o.angularVelocity[i]));
   require(error.every(v=>v<2e-4),'return derivative discontinuity');return {firstError,velocity,expected:o.angularVelocity,error};
 }
 if(data.mode==='frame'){
   const f=data.f,tr=f.trace,t=tr.age;
   require(Math.abs(t-f.age)<1e-5,'trace clock correlation');
   const phase=t<.30?'pop':t<.62?'settle':t<1.70?'rolling':t<1.85?'corner':t<3.10?'freefall':t<3.55?'landing':'rest';require(tr.phase===phase,'3.55 beat mismatch');
   for(const v of [tr.position,tr.pathVelocity,tr.ambientVelocity,tr.velocity,tr.quaternion,tr.angularVelocity])require(v?.every(Number.isFinite),'nonfinite trace');
   require(Math.abs(norm(tr.quaternion)-1)<1e-10&&tr.radius>0,'invalid rendered orientation/radius');
   if(tr.reopen)require(tr.reopen.velocity?.length===3&&tr.reopen.velocity.every(Number.isFinite)&&tr.reopen.elapsed>0&&tr.reopen.elapsed<.32,'invalid reopen residual');
   require(Number.isFinite(tr.clockVelocity)&&tr.velocity.every((v,i)=>Math.abs(v-tr.pathVelocity[i]*tr.clockVelocity-tr.ambientVelocity[i])<1e-10),'signed sampler velocity');
   if(phase==='pop'){
     const posePosition=p=>[p.x*.36+Math.sin(p.time*.65)*.07,p.y*-.2+Math.sin(p.time*.9)*.045,0],captured=posePosition(tr.sourcePose),current=posePosition(tr.ambientPose),offset=sub(current,captured),u=t/.30,weight=1-u*u*(3-2*u),derivative=-6*u*(1-u)/.30;
     const ambient=[.07*.65*Math.cos(tr.ambientPose.time*.65)*weight,.045*.9*Math.cos(tr.ambientPose.time*.9)*weight,0],pop=[0,2*t-6*t*t,.9*Math.sin(Math.PI*t/.6)**2],path=[0,2-12*t,.9*Math.PI/.6*Math.sin(2*Math.PI*t/.6)];
     require(tr.position.every((v,i)=>Math.abs(v-tr.anchor[i]-captured[i]-pop[i]-offset[i]*weight)<1e-10),'pop current-source position');
     require(tr.pathVelocity.every((v,i)=>Math.abs(v-path[i]-offset[i]*derivative)<1e-10),'pop path derivative');
     require(tr.ambientVelocity.every((v,i)=>Math.abs(v-ambient[i])<1e-10),'pop ambient derivative');
   }else require(norm(tr.ambientVelocity)===0,'ambient contact motion');
   const buffer=tr.buffer,{width:w,height:h}=f.viewport;
   require(buffer.pixelRatio>0&&buffer.pixelRatio<=1.5&&buffer.width*buffer.height<=4000000,'viewport buffer budget');
   require(Math.abs(buffer.width-Math.floor(w*buffer.pixelRatio))<=1&&Math.abs(buffer.height-Math.floor(h*buffer.pixelRatio))<=1,'viewport backing size');
   require(f.fan.opacity==='1'&&f.deckOpacity==='1','fan opacity fade');
   if(f.fan.cards.some(c=>c.bottom>1))require(angle([0,0,0,1],tr.cameraQuaternion)<1e-6,'camera rotates with visible cards');
   const p=f.projection,r=p.diameter/2;require(p.x-r>=0&&p.x+r<=w&&p.y-r>=0&&p.y+r<=h,'full ball outline clipped');
   if(t>=.30&&t<1.85)require(Math.abs(tr.radius-tr.sourceRadius*1.18)<1e-10,'contact radius changed');
   if(phase==='rolling'||phase==='corner')require(f.projectedCorner&&Math.hypot(f.projectedCorner.x-f.measuredCorner.x,f.projectedCorner.y-f.measuredCorner.y)<.02,'actual DOM card corner');
   if(phase==='rolling'){
     const length=norm(sub(tr.card.corner,tr.card.support)),initial=.08*length/1.08,maximum=initial+2*(length-initial*1.08)/1.08;
     require(tr.speed>=initial-1e-10&&tr.speed<=maximum+1e-10&&tr.distance>=0&&tr.distance<=length,'rolling speed bound');
     require(tr.support&&norm(sub(tr.position,tr.support.map((v,i)=>v+tr.normal[i]*tr.radius)))<1e-10,'world support/radius');
     require(Math.abs(Math.hypot(f.projection.x-f.projectedSupport.x,f.projection.y-f.projectedSupport.y)-f.projection.diameter/2)<.02,'actual contact/radius');
     require(tr.speed>0&&Math.abs(norm(tr.pathVelocity)-tr.speed)<1e-10&&Math.abs(tr.rollingAngle-tr.distance/tr.radius)<1e-10,'rolling speed/distance');
   }
   if(phase==='corner'){
     require(tr.support&&norm(sub(tr.support,tr.corner))<1e-10&&Math.abs(norm(sub(tr.position,tr.corner))-tr.radius)<1e-10&&tr.speed>0,'corner support/speed');
     require(Math.hypot(f.projectedSupport.x-f.measuredCorner.x,f.projectedSupport.y-f.measuredCorner.y)<.02,'actual DOM corner');
   }
   if(phase==='freefall')require(tr.support===null&&tr.pathVelocity[0]<0&&tr.pathVelocity[1]<0,'freefall support/exit velocity');
   if(phase==='landing'||phase==='rest')require(Math.abs(tr.position[0]+3.45)<1e-10&&tr.position[1]>=2.62-1e-10&&tr.position[2]===0&&tr.radius===.92,'upper tread landing');
   if(phase==='rest')require(Math.abs(tr.position[1]-2.62)<1e-10&&norm(tr.pathVelocity)===0,'3.55 rest');
   return {phase};
 }
 if(data.mode==='pair'){
   const {a,b}=data,dt=b.sourceTime-a.sourceTime,seconds=(b.stamp-a.stamp)/1000,q=delta(a.quaternion,b.quaternion),angularDifference=angle(a.quaternion,b.quaternion);
   require(dt>=-.001&&dt<.16,'phase reset');require(angularDifference<Math.max(.06,dt*9),'angular orientation discontinuity');
   if(a.open&&b.open){
     const x=a.trace,y=b.trace;
     if(x.phase==='rolling'&&y.phase==='rolling'&&x.clockVelocity>0&&y.clockVelocity>0&&y.age>x.age&&dt>0){
       require(y.speed>x.speed&&y.distance>x.distance,'rolling not accelerating');
       const travel=(y.distance-x.distance)/x.radius;let rotation=x.axis.map(v=>v*travel),omega=y.axis.map(v=>v*y.speed/y.radius*y.clockVelocity);
       if(x.reopen||y.reopen){
         const r=x.reopen;require(r,'reopen residual missing previous state');
         const elapsed=Math.min(.32,r.elapsed+dt),u=r.elapsed/.32,v=elapsed/.32,integral=p=>p-p*p*p+p*p*p*p/2,decay=1-v*v*(3-2*v);
         if(y.reopen)require(norm(sub(y.reopen.velocity,r.velocity))<1e-10&&Math.abs(y.reopen.elapsed-elapsed)<1e-10,'reopen residual decay/state');
         else require(elapsed===.32,'reopen residual dropped early');
         rotation=rotation.map((n,i)=>n+r.velocity[i]*.32*(integral(v)-integral(u)));
         omega=omega.map((n,i)=>n+r.velocity[i]*decay);
       }
       const n=norm(rotation),k=n?Math.sin(n/2)/n:0,expected=multiply([...rotation.map(v=>v*k),Math.cos(n/2)],a.quaternion);
       require(angle(expected,b.quaternion)<.001,'rolling quaternion slips');
       require(y.angularVelocity.every((v,i)=>Math.abs(v-omega[i])<1e-10),'full rolling angular velocity');
     }else if(dt>0){
       // The owner integrates the full angular vector per draw. RAF records
       // may span two draws; preserve the former .06 rad / dt*9 watchdog.
       const speed=norm(y.angularVelocity),a2=speed*dt/2,k=speed?Math.sin(a2)/speed:0,expected=multiply([...y.angularVelocity.map(v=>v*k),Math.cos(a2)],a.quaternion);
       require(angle(expected,b.quaternion)<.06,'full angular velocity discontinuity');
     }
     if(x.phase==='freefall'&&y.phase==='freefall'){
       const age=y.age-x.age;require(Math.abs(y.position[0]-x.position[0]-x.pathVelocity[0]*age)<1e-10&&Math.abs(y.position[1]-x.position[1]-x.pathVelocity[1]*age+6*age*age)<1e-10,'ballistic position');
       require(Math.abs(y.pathVelocity[0]-x.pathVelocity[0])<1e-10&&Math.abs(y.pathVelocity[1]-x.pathVelocity[1]+12*age)<1e-10,'ballistic velocity');
     }
     if(x.age>=1.85&&y.age<2.5&&y.age>x.age&&a.viewport.width===b.viewport.width&&a.viewport.height===b.viewport.height){
       require(b.fan.cards.every((c,i)=>c.bottom<a.fan.cards[i].bottom),'whole fan must travel up');
     }
   }
   return {seconds,dt,angularDifference,angularDelta:q.slice(0,3).map(v=>2*v)};
 }
 throw new Error('unknown probe check');
}'''
TRACE='''() => {
 const host=document.querySelector('.volleyball-view'),surface=host.ballSurface,dialog=document.querySelector('.ball-entry');
 const canvas=surface.querySelector('canvas'),view=host.ballView;
 const fan=document.querySelector('.sheet-fan'),deck=document.querySelector('.light-table'),footer=deck.querySelector('.table-footer'),image=surface.querySelector('img'),cta=document.querySelector('[data-sheet="gameonvb"] .sheet-cta'),selector=document.querySelector('button[aria-label="Show GameOnVB"]');
 const styles=()=>({fan:fan.style.cssText,deck:deck.style.cssText,footer:footer.style.cssText,surface:surface.style.cssText,image:image.style.cssText,overflow:document.body.style.overflow});
 const expectedStyles=styles(),expectedScroll=scrollY;let capturedSource=null,initialSourceBounds=null;
 const sample=()=>{const fan=document.querySelector('.sheet-fan'),sheet=host.closest('.sheet'),fm=new DOMMatrix(getComputedStyle(fan).transform),cm=fm.multiply(new DOMMatrix(getComputedStyle(sheet.parentElement).transform)),sr=sheet.getBoundingClientRect(),sw=parseFloat(getComputedStyle(sheet).width),sh=parseFloat(getComputedStyle(sheet).height),trace=dialog.open?JSON.parse(host.dataset.entryTrace||'null'):null;
   const measuredCorner={x:sr.x+sr.width/2+cm.a*(-sw/2)+cm.c*sh/2,y:sr.y+sr.height/2+cm.b*(-sw/2)+cm.d*sh/2};
   const s=getComputedStyle(surface),b=surface.getBoundingClientRect(),m=new DOMMatrix(getComputedStyle(dialog.open?surface:sheet.parentElement).transform),p=JSON.parse(host.dataset.projection||'null');
   const center=p?(dialog.open?new DOMPoint(p.x,p.y).matrixTransform(m):new DOMPoint(b.x+b.width/2+m.a*(p.x-surface.clientWidth/2)+m.c*(p.y-surface.clientHeight/2),b.y+b.height/2+m.b*(p.x-surface.clientWidth/2)+m.d*(p.y-surface.clientHeight/2))):null;
   const pose=JSON.parse(host.dataset.sourcePose||'null');
   const sourceBounds={x:b.x,y:b.y,width:b.width,height:b.height};if(!dialog.open&&!capturedSource)initialSourceBounds=sourceBounds;
   if(host.ballEntry&&!capturedSource){const source=host.ballEntry.source;capturedSource={width:source.width,height:source.height,aspect:source.aspect,origin:source.origin,viewport:source.viewport,sourceBounds:initialSourceBounds};}
   const projectionSpace={mode:dialog.open?'entry':'source',viewFrame:{...view.frame},surfaceSize:{width:surface.clientWidth,height:surface.clientHeight},sourceBounds,sourceCardBounds:{x:sr.x,y:sr.y,width:sr.width,height:sr.height},sourceMatrix:{a:cm.a,b:cm.b,c:cm.c,d:cm.d,e:cm.e,f:cm.f},capturedSource};
   const normal=pose?[pose.x*.36+Math.sin(pose.time*.65)*.07,pose.y*-.2+Math.sin(pose.time*.9)*.045,0]:null;
   const cb=cta.getBoundingClientRect(),expectedFocus=!cta.hidden&&cb.top>=0&&cb.bottom<=innerHeight&&Math.abs(expectedScroll/(innerHeight*.85)-1)<=.02?'cta':'selector';
   const restoration=dialog.open?null:{styles:styles(),scroll:scrollY,expectedScroll,focus:document.activeElement===cta?'cta':document.activeElement===selector?'selector':'other',expectedFocus};
   return {stamp:performance.now(),projectionSpace,nativeSourceProjection:!dialog.open&&normal?view.projectEntry(normal):null,restoration,phase:dialog.dataset.phase,open:dialog.open,age:Number(dialog.dataset.flightTime||0),edge:Number(dialog.dataset.edgeY||0),edgeTime:Number(dialog.dataset.edgeTime||0),time:Number(host.dataset.time||0),sourceTime:pose?.time,pose,motion:JSON.parse(host.dataset.motion||'null'),spin:JSON.parse(host.dataset.spin||'null'),quaternion:JSON.parse(host.dataset.quaternion||'null'),orientation:JSON.parse(host.dataset.logicalOrientation||'null'),trace,terminalTrace:dialog.open?null:JSON.parse(host.dataset.entryTrace||'null'),measuredCorner,projectedCorner:trace?view.projectEntry(trace.corner):null,projectedSupport:trace?.support?view.projectEntry(trace.support):null,projection:p,center:center?{x:center.x,y:center.y}:null,viewport:{width:innerWidth,height:innerHeight},fan:{opacity:getComputedStyle(fan).opacity,cards:Array.from(fan.querySelectorAll('.sheet-position')).map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {id:el.dataset.sheet,opacity:s.opacity,transform:s.transform,left:r.left,right:r.right,top:r.top,bottom:r.bottom}})},deckOpacity:getComputedStyle(document.querySelector('.light-table')).opacity,material:{name:host.dataset.material,textureSize:host.dataset.textureSize,panels:host.dataset.panels,clearAlpha:host.dataset.clearAlpha},runtime:host.dataset.runtime,sameView:host.ballView===view,sameCanvas:surface.querySelector('canvas')===canvas,connected:surface.isConnected,count:document.querySelectorAll('.ball-presentation canvas').length,frame:host.dataset.pendingFrame};};
 window.ballProof={frames:[],before:null,first:null,end:null,returnStart:null,sample,expectedStyles};
 document.querySelector('[data-sheet="gameonvb"] .sheet-cta').addEventListener('click',()=>ballProof.before=sample(),{capture:true,once:true});
 // The header is mounted only after entry; delegate native capture and remove
 // this owned listener when the trace ends.
 const onReturn=event=>{if(event.target.closest('.ball-entry .entry-header button'))ballProof.returnStart=sample()};document.addEventListener('click',onReturn,true);
 ballProof.observer=new MutationObserver(()=>{if(dialog.open&&!ballProof.first)ballProof.first=sample();if(!dialog.open&&ballProof.first)ballProof.end=sample()});ballProof.observer.observe(dialog,{attributes:true,attributeFilter:['open']});
 const tick=()=>{ballProof.frames.push(sample());ballProof.frame=requestAnimationFrame(tick)};ballProof.frame=requestAnimationFrame(tick);
 ballProof.stop=()=>{cancelAnimationFrame(ballProof.frame);ballProof.observer.disconnect();document.removeEventListener('click',onReturn,true)};
}'''
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
    context=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
    page=context.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)));pg=page
    def ready(pg=page):pg.wait_for_function('document.querySelector(".volleyball-view").ballView && document.querySelector(".ball-presentation canvas")')
    def opened(pg=page):pg.wait_for_function('document.querySelector(".ball-entry").dataset.phase==="open"')
    def closed(pg=page):pg.wait_for_function('!document.querySelector(".ball-entry").open')
    def select(pg=page):
        pg.locator('button[aria-label="Show GameOnVB"]').click()
        pg.wait_for_function('Math.abs(scrollY-innerHeight*.85)<1 && document.querySelector(".light-table").dataset.settling!=="true"')
    def action(pg=page):return pg.locator('[data-sheet="gameonvb"] .sheet-cta')
    def shot(name):
        # Screenshot capture is asynchronous: bracket its actual elapsed clock,
        # never label a wait threshold as the exact captured frame.
        before=page.evaluate('()=>window.ballProof?.sample()??null')
        page.screenshot(path=str(OUT/f'{name}.png'))
        after=page.evaluate('()=>window.ballProof?.sample()??null')
        report.setdefault('screenshots',{})[name]={'before':before,'after':after}
    def caption_clear(pg=page):
        bounds=pg.evaluate('''() => {
            const host=document.querySelector('.volleyball-view'),surface=host.ballSurface,p=JSON.parse(host.dataset.projection),m=new DOMMatrix(getComputedStyle(surface).transform),center=new DOMPoint(p.x,p.y).matrixTransform(m),radius=p.diameter*Math.hypot(m.a,m.b)/2,c=document.querySelector('.ball-entry-caption').getBoundingClientRect();
            return {viewport:{width:innerWidth,height:innerHeight},caption:{left:c.left,right:c.right,top:c.top,bottom:c.bottom},ball:{left:center.x-radius,right:center.x+radius,top:center.y-radius,bottom:center.y+radius}};
        }''')
        report.setdefault('caption_bounds',[]).append(bounds)
        c,b=bounds['caption'],bounds['ball']
        assert c['right']<=b['left'] or c['left']>=b['right'] or c['bottom']<=b['top'] or c['top']>=b['bottom'],('caption overlaps settled ball',bounds)
        assert 0<=c['left']<c['right']<=bounds['viewport']['width'] and 0<=c['top']<c['bottom']<=bounds['viewport']['height'],('caption outside viewport',bounds)
    def finish(name,edge=True):
        data=page.evaluate('''()=>{ballProof.stop();return {before:ballProof.before,first:ballProof.first,end:ballProof.end,returnStart:ballProof.returnStart,frames:ballProof.frames,expectedStyles:ballProof.expectedStyles}}''');report['traces'][name]=data
        a,b=data['before'],data['first'];assert a and b,(name,'missing first frame')
        data['first_orientation_error']=page.evaluate(CHECKS,{'mode':'orientation','a':a['quaternion'],'b':b['quaternion']})
        assert a['spin']==b['spin'] and a['time']==b['time'],(name,'first spin/phase reset')
        assert all(abs(a['center'][k]-b['center'][k])<1 for k in ['x','y']),(name,'first ball framing jump',a,b)
        assert abs(a['projection']['diameter']*math.hypot(b['trace']['sourceAffine']['a'],b['trace']['sourceAffine']['b'])-b['projection']['diameter'])<1,(name,'source-first diameter parity')
        end=data['end'];assert end and not end['open'],(name,'missing repaint-before-close')
        assert all(f['material']==a['material'] and f['sameView'] and f['sameCanvas'] and f['connected'] and f['count']==1 for f in [b,end]),(name,'before/end identity/material/canvas')
        data['return_bridge']=page.evaluate(CHECKS,{'mode':'bridge','orientation':end['orientation'],'pose':end['pose'],'quaternion':end['quaternion']})
        data['return_position_bridge']=page.evaluate(CHECKS,{'mode':'positionBridge','tr':end['terminalTrace'],'pose':end['pose'],'position':end['motion']['position']})
        if data['returnStart']:data['return_elapsed_ms']=end['stamp']-data['returnStart']['stamp']
        frames=[f for f in data['frames'] if f['stamp']>=b['stamp']]
        assert len(frames)>8
        assert all(f['sameCanvas'] and f['sameView'] and f['connected'] and f['count']==1 and f['runtime']=='webgl' for f in frames),(name,'renderer replaced/vanished/duplicated')
        data['angular_differences']=[]
        data['projection_pairs']=[]
        for f in frames:
            assert f['material']==data['before']['material'],(name,'material changed')
            if f['open']:page.evaluate(CHECKS,{'mode':'frame','f':f})
        for a,b in zip(frames,frames[1:]):
            dt=b['time']-a['time'];assert -.001<=dt<.16,(name,'phase reset',a,b)
            data['angular_differences'].append(page.evaluate(CHECKS,{'mode':'pair','a':a,'b':b}))
            data['projection_pairs'].append(page.evaluate(CHECKS,{'mode':'screenPair','a':a,'b':b,'end':end,'expectedStyles':data['expectedStyles']}))
            # Existing exponential angular drag continues; navigation supplies no spin kick.
            for speed,baseline in [('yawSpeed',.16),('pitchSpeed',0)]:
                expected=baseline+(a['spin'][speed]-baseline)*math.exp(-1.1*dt)
                assert abs(expected-b['spin'][speed])<.03,(name,'angular momentum discontinuity',a,b)
        forward=[f for f in frames if f['open'] and f['phase']!='leaving' and f['trace']['clockVelocity']>=0]
        if edge:
            for phase in ['pop','settle','rolling','corner','freefall','landing','rest']:
                assert any(f['trace']['phase']==phase for f in forward),(name,'missing beat',phase)
            roll=[f for f in forward if .65<=f['age']<=1.69];corner=[f for f in forward if 1.70<=f['age']<1.85];air=[f for f in forward if 1.85<=f['age']<3.10]
            assert len(roll)>8 and len(corner)>1 and len(air)>8,(name,'missing temporal samples')
            initial=forward[0]['fan']['cards']
            assert all([(c['id'],c['opacity'],c['transform']) for c in f['fan']['cards']]==[(c['id'],c['opacity'],c['transform']) for c in initial] for f in forward),(name,'individual fan motion/fade')
            assert any(2.10<=f['age']<=2.20 and max(c['bottom'] for c in f['fan']['cards'])>0 for f in air),(name,'fan vanished before first .3s of fall')
            assert any(f['age']>=2.5 and max(c['bottom'] for c in f['fan']['cards'])<=1 for f in air),(name,'fan did not exit')
            upward=sum(max(0,a['projection']['y']-b['projection']['y']) for a,b in zip(air,air[1:]))
            assert upward<=forward[0]['viewport']['height']*.25,(name,'camera upward sweep',upward)
            assert any(f['trace']['orientationP']>0 for f in air),(name,'destination camera absent')
        assert any(f['open'] and f['age']==3.55 and abs(f['motion']['position'][1]-2.62)<.001 for f in frames),(name,'no 3.55 top landing')
    try:
        page.goto(URL,wait_until='networkidle');select();ready()
        urls=page.evaluate('Array.from(document.scripts).map(s=>s.src).filter(Boolean).concat(performance.getEntriesByType("resource").map(r=>r.name).filter(n=>n.endsWith(".js")))')
        report['served_js']={}
        for url in sorted(set(urls)):
            body=page.request.get(url).body();assert body==(BUILD/urlparse(url).path.lstrip('/')).read_bytes(),('stale JS',url);report['served_js'][url]=hashlib.sha256(body).hexdigest()
        assert action().get_attribute('href')=='#gameonvb'
        modifier='Meta' if page.evaluate('navigator.platform.includes("Mac")') else 'Control'
        for kwargs in [{'modifiers':[modifier]},{'button':'middle'}]:
            with context.expect_page() as popup:action().click(**kwargs)
            pg=popup.value;pg.wait_for_url('**/#gameonvb');opened(pg);pg.close();pg=page;assert not page.locator('.ball-entry').evaluate('e=>e.open')
        # Real brush supplies momentum before entry. No synthetic input handlers.
        box=page.locator('.volleyball-view').bounding_box()
        page.mouse.move(box['x'],box['y']+box['height']/2);page.mouse.move(box['x']+box['width'],box['y']+box['height']/2,steps=8)
        saved_scroll=page.evaluate('scrollY');page.evaluate(TRACE);action().click();shot('start')
        assert page.locator('.ball-entry').evaluate('e=>e.open'),'CTA not immediately acknowledged'
        page.wait_for_function('Number(document.querySelector(".ball-entry").dataset.flightTime)>.13');shot('pop')
        page.wait_for_function('Number(document.querySelector(".ball-entry").dataset.flightTime)>.50');shot('contact')
        page.wait_for_function('Number(document.querySelector(".ball-entry").dataset.flightTime)>.9');shot('roll')
        page.wait_for_function('Number(document.querySelector(".ball-entry").dataset.flightTime)>=1.70');shot('corner')
        page.wait_for_function('Number(document.querySelector(".ball-entry").dataset.flightTime)>=Number(document.querySelector(".ball-entry").dataset.edgeTime)');shot('edge')
        page.wait_for_function('Number(document.querySelector(".ball-entry").dataset.flightTime)>2.15');shot('fall')
        opened();caption_clear();shot('land');assert page.locator('.ball-entry .entry-header a').get_attribute('href')=='http://127.0.0.1:5181/gameonvb'
        assert page.locator('.goal-entry').evaluate('e=>!e.open')
        assert page.locator('.ball-entry .ball-presentation canvas').count()==1
        for _ in range(8):
            page.keyboard.press('Tab');assert page.evaluate('document.activeElement===document.body||!!document.activeElement.closest(".ball-entry")')
        page.locator('.ball-entry .entry-header button').click();shot('return-start')
        page.wait_for_function('Number(document.querySelector(".ball-entry").dataset.flightTime)<.8');shot('return-mid');closed();shot('return-end')
        assert abs(page.evaluate('scrollY')-saved_scroll)<1 and action().evaluate('e=>e===document.activeElement')
        finish('entry-return')
        page.evaluate(TRACE);action().focus();page.keyboard.press('Enter')
        page.wait_for_function('Number(document.querySelector(".ball-entry").dataset.flightTime)>.2');page.keyboard.press('Escape')
        page.wait_for_function('document.querySelector(".ball-entry").dataset.phase==="leaving"');page.go_forward(wait_until='commit');opened();page.go_back(wait_until='commit');closed();finish('interrupted-reopen',False)
        # Same-document native Escape/history interrupts an actual rolling
        # return. Wait for negative velocity, then observe its zero crossing.
        page.evaluate(TRACE);action().click()
        page.wait_for_function('JSON.parse(document.querySelector(".volleyball-view").dataset.entryTrace).age>=1.25');page.keyboard.press('Escape')
        page.wait_for_function('JSON.parse(document.querySelector(".volleyball-view").dataset.entryTrace).clockVelocity<=-1');page.go_forward(wait_until='commit')
        page.wait_for_function('JSON.parse(document.querySelector(".volleyball-view").dataset.entryTrace).clockVelocity>=0 && !!JSON.parse(document.querySelector(".volleyball-view").dataset.entryTrace).reopen')
        opened();page.go_back(wait_until='commit');closed();finish('rolling-reopen',False)
        crossing_frames=report['traces']['rolling-reopen']['frames'];crossings=[]
        for a,b,c in zip(crossing_frames,crossing_frames[1:],crossing_frames[2:]):
            if all(f['open'] for f in [a,b,c]) and b['trace']['clockVelocity']<0<=c['trace']['clockVelocity'] and c['trace'].get('reopen'):
                crossings.append(page.evaluate(CHECKS,{'mode':'reopenCrossing','a':a,'b':b,'c':c}))
        assert len(crossings)==1,('rolling reopen zero crossing not observed',crossings)
        report['traces']['rolling-reopen']['zero_crossings']=crossings
        for width,height in [(1000,900),(768,1024),(390,844),(320,780)]:
            page.set_viewport_size({'width':width,'height':height});select();ready();page.evaluate(TRACE);action().click();shot(f'{width}-start');opened();caption_clear();shot(f'{width}-land')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.keyboard.press('Escape');closed();finish(f'{width}-return')
        # Native viewport resize at a controlled, paused rolling clock proves
        # immediate same-phase repaint without hiding/releasing the live GPU.
        select();ready();resize_saved_scroll=page.evaluate('scrollY');page.evaluate(TRACE);action().click()
        page.wait_for_function('Number(document.querySelector(".ball-entry").dataset.flightTime)>.9')
        resize_before=page.evaluate('()=>{document.querySelector(".volleyball-view").ballFlow.pause();return ballProof.sample()}')
        try:
            for width,height in [(390,844),(844,390),(1440,1000)]:
                page.set_viewport_size({'width':width,'height':height})
                page.wait_for_function('([w,h])=>{const tr=JSON.parse(document.querySelector(".volleyball-view").dataset.entryTrace);return tr.buffer.width===Math.floor(w*tr.buffer.pixelRatio)&&tr.buffer.height===Math.floor(h*tr.buffer.pixelRatio)}',arg=[width,height])
                resized=page.evaluate('()=>ballProof.sample()')
                assert resized['age']==resize_before['age'] and resized['trace']['phase']==resize_before['trace']['phase'],('resize restarted clock/beat',resized)
                assert resized['trace']['position']==resize_before['trace']['position'],('resize changed world pose',resized)
                page.evaluate(CHECKS,{'mode':'orientation','a':resize_before['quaternion'],'b':resized['quaternion']})
                page.evaluate(CHECKS,{'mode':'frame','f':resized})
                assert resized['sameView'] and resized['sameCanvas'] and resized['material']==resize_before['material'],('resize replaced live identity',resized)
                report.setdefault('paused_native_resize',[]).append({'before':resize_before,'after':resized})
        finally:
            page.evaluate('document.querySelector(".volleyball-view").ballFlow.resume()')
        opened();caption_clear();page.keyboard.press('Escape');closed()
        assert abs(page.evaluate('scrollY')-resize_saved_scroll)<1 and page.locator('button[aria-label="Show GameOnVB"]').evaluate('e=>e===document.activeElement'),('resized return scroll/focus')
        finish('same-phase-resize',False)
        # True cold direct entry uses a fresh owned context, not a same-document
        # hash navigation on the main page (whose source scroll must survive).
        main_scroll=page.evaluate('scrollY')
        cold=browser.new_context(viewport={'width':320,'height':780})
        try:
            pg=cold.new_page();pg.on('pageerror',lambda e:report['errors'].append(str(e)))
            pg.goto(URL+'#gameonvb',wait_until='networkidle')
            source_scroll=pg.evaluate('scrollY');assert source_scroll==0,('cold source scroll',source_scroll)
            opened(pg);ready(pg);pg.keyboard.press('Escape');closed(pg)
            return_scroll=pg.evaluate('scrollY');assert return_scroll==0,('cold return scroll',return_scroll)
            report['cold_direct_entry']={'source_scroll':source_scroll,'return_scroll':return_scroll}
        finally:
            cold.close();pg=page
        assert page.evaluate('scrollY')==main_scroll,('cold fixture changed main page',main_scroll)
        # Emulated hidden release preserves the flight clock and spin phase.
        select();ready();action().click();page.wait_for_function('Number(document.querySelector(".ball-entry").dataset.flightTime)>.25')
        page.evaluate('window.pauseAge=document.querySelector(".ball-entry").dataset.flightTime;window.pauseSpin=document.querySelector(".volleyball-view").dataset.spin;Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))')
        assert page.locator('.ball-presentation canvas').count()==0
        page.wait_for_timeout(250);assert page.evaluate('pauseAge===document.querySelector(".ball-entry").dataset.flightTime && pauseSpin===document.querySelector(".volleyball-view").dataset.spin')
        assert page.locator('.volleyball-view').get_attribute('data-pending-frame')=='false'
        page.evaluate('delete document.hidden;document.dispatchEvent(new Event("visibilitychange"))');opened();ready();page.keyboard.press('Escape');closed()
        select();ready();page.evaluate('document.querySelector(".ball-presentation canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()')
        page.wait_for_function('document.querySelector(".volleyball-view").dataset.runtime==="static"');action().click();opened();assert page.locator('.ball-entry .ball-static').is_visible();page.keyboard.press('Escape');closed()
        for reduced,no_gpu in [(True,False),(False,True)]:
            ctx=browser.new_context(viewport={'width':320,'height':780},reduced_motion='reduce' if reduced else 'no-preference')
            if no_gpu:ctx.add_init_script('HTMLCanvasElement.prototype.getContext=new Proxy(HTMLCanvasElement.prototype.getContext,{apply(fn,self,args){return /^webgl/.test(args[0])?null:Reflect.apply(fn,self,args)}})')
            pg=ctx.new_page();pg.on('pageerror',lambda e:report['errors'].append(str(e)));pg.goto(URL+'#gameonvb',wait_until='networkidle');opened(pg)
            assert pg.locator('.ball-entry canvas').count()==0 and pg.locator('.ball-entry .ball-static').is_visible()
            assert pg.locator('.ball-static').get_attribute('src').startswith(('/ball-preview.png','data:image/png'))
            assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth');pg.screenshot(path=str(OUT/f'fallback-{reduced}-{no_gpu}.png'));pg.keyboard.press('Escape');closed(pg);ctx.close();pg=page
        mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        pg=mobile.new_page();pg.on('pageerror',lambda e:report['errors'].append(str(e)));pg.goto(URL,wait_until='networkidle');pg.locator('button[aria-label="Show GameOnVB"]').tap()
        pg.wait_for_function('Math.abs(scrollY-innerHeight*.85)<1 && document.querySelector(".light-table").dataset.settling!=="true"');ready(pg)
        action(pg).tap();opened(pg);pg.locator('.ball-entry .entry-header button').tap();closed(pg);assert action(pg).get_attribute('data-pressed') is None
        # CTA-origin native emulated pan must cancel press without opening detail.
        box=action(pg).bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2;cdp=mobile.new_cdp_session(pg)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
        for dy in [35,70,105,140]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y-dy}]});pg.wait_for_timeout(40)
        pg.wait_for_timeout(200);held_y=pg.evaluate('scrollY');pg.wait_for_timeout(250);assert abs(pg.evaluate('scrollY')-held_y)<2
        assert action(pg).get_attribute('data-pressed') is None and not pg.locator('.ball-entry').evaluate('e=>e.open')
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});mobile.close();pg=page
        page.goto(URL,wait_until='networkidle');select();ready();page.locator('button[aria-label="Show Hoang Viet To"]').click()
        page.wait_for_function('Number(document.querySelector(".light-table").dataset.position)>1.9')
        page.wait_for_function('!document.querySelector(".ball-presentation canvas") && document.querySelector(".volleyball-view").dataset.pendingFrame==="false"')
        assert not report['errors'],report['errors'];report['status']='PASS'
    except Exception as error:
        report.update(status='FAIL',error=str(error))
        try:
            diagnostic_page=pg if pg is not None and not pg.is_closed() else page
            report['failure_state']=diagnostic_page.evaluate('''() => ({url:location.href,y:scrollY,target:innerHeight*.85,viewport:{width:innerWidth,height:innerHeight},main:{...document.querySelector('.light-table')?.dataset},ball:{...document.querySelector('.volleyball-view')?.dataset},dialog:{...document.querySelector('.ball-entry')?.dataset},open:document.querySelector('.ball-entry')?.open,focus:document.activeElement?.outerHTML.slice(0,240)})''')
        except Exception as diagnostic_error:report['diagnostic_error']=str(diagnostic_error)
        try:shot('failure')
        except Exception:pass
        raise
    finally:
        (OUT/'acceptance.json').write_text(json.dumps(report,indent=2));print(json.dumps({'status':report.get('status'),'evidence':str(OUT)}));context.close();browser.close()
