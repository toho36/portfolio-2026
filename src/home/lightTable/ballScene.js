import { panelGeometry } from './ballGeometry.js'
import { ballMotion } from './ballMotion.js'
import { leatherMaps } from './leatherMaps.js'
import { ballFlight,ballEase,ballPoseQuaternion } from './ballFlow.js'
import { createBallSteps } from './ballSteps.js'

// Source-local pixels shared by the camera and DOM preview/contact frame.
export function ballContactLayout(source,w,h){
  const v=source.viewport??{width:w,height:h},scale=Math.min(w/v.width,h/v.height)
  return {scale,x:(w-v.width*scale)/2,y:(h-v.height*scale)/2}
}
function fanSourceBasis(source){
  if(source.fanBasis)return source.fanBasis
  const o=source.origin,c=source.contact,aspect=source.aspect??source.width/source.height,vertical=Math.max(2.6,2.6/aspect),unit=source.height/vertical,xUnit=source.width/(vertical*aspect),det=o.a*o.d-o.b*o.c
  // Capture once in the same source-camera z=0 plane as support and corner.
  const world=(x,y)=>{const dx=x-o.x,dy=y-o.y;return [c.anchor[0]+((o.d*dx-o.c*dy)/det-source.width/2)/xUnit,c.anchor[1]-((-o.b*dx+o.a*dy)/det-source.height/2)/unit,0]}
  const origin=world(0,0),x=[o.d/det/xUnit,o.b/det/unit,0],y=[-o.c/det/xUnit,-o.a/det/unit,0],card=c.card.affine
  const cardWorld=card?[[0,0],[c.card.width??1,0],[0,c.card.height??1]].map(([px,py])=>world(card.x+card.a*px+card.c*py,card.y+card.b*px+card.d*py)):undefined
  const bounds=source.fanBounds??{left:0,right:source.viewport?.width??source.width,top:0,bottom:source.fanBottom??c.card.cornerScreen?.y??source.height}
  source.fanBasis={origin,x,y,cardWorld,bounds};return source.fanBasis
}
export function ballFanFrame(source,w,h,age){
  const layout=ballContactLayout(source,w,h),shift=ballContactShift(source,w,h,Math.min(age,1.85)),basis=fanSourceBasis(source)
  const vertical=Math.max(2.6,2.6/(source.aspect??source.width/source.height)),targetSpan=Math.max(8.2,9.4/(w/h)),exitAffine=ballEntryFrame(source,w,h,0,1.85),exitScale=Math.hypot(exitAffine.a,exitAffine.b),exitUnit=source.height/vertical*exitScale,targetUnit=h/targetSpan
  // Interpolate the common projected world metric, weighted by the unchanged
  // physical radius so its diameter is monotone too. Bound clearance with the
  // locked clip and largest remaining unit, including resized growing entries.
  const unitAt=t=>{const p=ballEase((t-1.85)/1.25),r=source.contact.radius+(.92-source.contact.radius)*p;return exitUnit+(targetUnit-exitUnit)*.92*p/r}
  const spanAt=t=>source.height*exitScale/Math.max(unitAt(t),targetUnit)
  const exitShift=ballContactShift(source,w,h,1.85),bottom=basis.bounds.bottom*layout.scale+layout.y+exitShift.y
  // One authored up-travel controls only the plane's translation. Its fixed
  // world metric still zooms with the ball's camera. Read exit from that metric.
  const travel=t=>t<=.12?t*t*t/(.12*.12)-t*t*t*t/(2*.12**3):t-.06
  const authoredDistance=t=>bottom*travel(Math.max(0,t-1.85))/travel(.95)
  // CPU counterpart of this specific orthographic entry camera, including its
  // source clip affine. No GPU/library is required for the exact-model fallback.
  const yaw=Math.atan2(7,15)/2,pitch=-Math.atan2(7.4,Math.hypot(7,15))/2,q=[Math.sin(pitch)*Math.cos(yaw),Math.cos(pitch)*Math.sin(yaw),-Math.sin(pitch)*Math.sin(yaw),Math.cos(pitch)*Math.cos(yaw)]
  const theta=Math.acos(q[3]),rotation=p=>{
    const k=Math.sin(theta*p)/Math.sin(theta),[qx,qy,qz]=q.slice(0,3).map(v=>v*k),qw=Math.cos(theta*p)
    return {right:[1-2*(qy*qy+qz*qz),2*(qx*qy+qw*qz)],up:[2*(qx*qy-qw*qz),1-2*(qx*qx+qz*qz)]}
  }
  const sourceAspect=source.aspect??source.width/source.height,{left,right:edgeRight,top,bottom:edgeBottom}=basis.bounds,corners=[[left,top],[edgeRight,top],[left,edgeBottom],[edgeRight,edgeBottom]]
  // Bound EVERY orientation, not only the locked or destination endpoint.
  // Each interval bounds the rotated fixed-world vector by angular travel;
  // the clip weights are monotone (linear / positive linear, and linear).
  // The numerator envelope is constant through up-travel, so its safe exit
  // stays safe as span grows and the whole fan continues upward.
  const weights=p=>[source.origin.b*layout.scale*(1-p)*source.width/(sourceAspect+(source.width/source.height-sourceAspect)*p),-source.origin.d*layout.scale*(1-p)*source.height-h*p]
  let envelope=0
  for(let i=0;i<32;i++){
    const p=(i+.5)/32,{right,up}=rotation(p),a=weights(i/32),b=weights((i+1)/32)
    for(const [px,py] of corners){
      const vx=basis.x[0]*px+basis.y[0]*py,vy=basis.x[1]*px+basis.y[1]*py,pad=Math.hypot(vx,vy)*theta/32
      const R=right[0]*vx+right[1]*vy,U=up[0]*vx+up[1]*vy
      const upper=(j,v)=>Math.max(a[j]*(v-pad),a[j]*(v+pad),b[j]*(v-pad),b[j]*(v+pad))
      envelope=Math.max(envelope,upper(0,R)+upper(1,U))
    }
  }
  // A resized source clip can magnify this plane beyond the captured deck.
  // Add only the clearance it lacks at the authored .95s travel endpoint,
  // smoothly after the first readable .3s. Ball/model center motion is intact.
  const clearance=Math.max(0,envelope/spanAt(2.80)+layout.y+exitShift.y-authoredDistance(2.80)+.02)
  const distance=t=>authoredDistance(t)+clearance*ballEase((t-2.15)/.65)
  const safeBottom=t=>envelope/spanAt(t)+layout.y+exitShift.y-distance(t)
  let lo=1.85,hi=3.02
  for(let i=0;i<28;i++){const mid=(lo+hi)/2;if(safeBottom(mid)>0)lo=mid;else hi=mid}
  const exitTime=hi,orientationP=ballEase((age-exitTime)/(3.02-exitTime)),affine=ballEntryFrame(source,w,h,orientationP,age),span=age<=1.85?vertical:age>=3.10?targetSpan:source.height*Math.hypot(affine.a,affine.b)/unitAt(age)
  const {right,up}=rotation(orientationP),aspect=sourceAspect+(source.width/source.height-sourceAspect)*orientationP,ux=source.width/(span*aspect),uy=source.height/span
  const plane={a:affine.a*ux*right[0]-affine.c*uy*up[0],b:affine.b*ux*right[0]-affine.d*uy*up[0],c:affine.a*ux*right[1]-affine.c*uy*up[1],d:affine.b*ux*right[1]-affine.d*uy*up[1]}
  const a=plane.a*basis.x[0]+plane.c*basis.x[1],b=plane.b*basis.x[0]+plane.d*basis.x[1],c=plane.a*basis.y[0]+plane.c*basis.y[1],d=plane.b*basis.y[0]+plane.d*basis.y[1],x=layout.x+shift.x,y=layout.y+shift.y-distance(age)
  const projectedBottom=Math.max(...corners.map(([px,py])=>b*px+d*py+y))
  return {a,b,c,d,x,y,translation:{x:shift.x,y:shift.y-distance(age)},bottom:projectedBottom,exitTime,span,orientationP,plane,basis}
}
function contactOrigin(source,w,h){
  const layout=ballContactLayout(source,w,h)
  return Object.fromEntries(Object.entries(source.origin).map(([k,v])=>[k,v*layout.scale+(k==='x'?layout.x:k==='y'?layout.y:0)]))
}
export function ballEntryFrame(source,screenWidth,screenHeight,p,age=0){
  const scale=screenHeight/source.height,origin=contactOrigin(source,screenWidth,screenHeight)
  const end={a:scale,b:0,c:0,d:scale,x:(screenWidth-source.width*scale)/2,y:0}
  const shift=ballContactShift(source,screenWidth,screenHeight,age)
  return Object.fromEntries(Object.keys(end).map(k=>[k,(origin[k]+(shift[k]||0))*(1-p)+end[k]*p]))
}
export function ballContactShift(source,w,h,age){
  if(!source.contact)return {x:0,y:0}
  const c=source.contact,span=Math.max(2.6,2.6/(source.aspect??source.width/source.height)),unit=source.height/span,o=contactOrigin(source,w,h)
  const local=c.exit.map((v,i)=>v-c.anchor[i]),px=source.width/2+local[0]*source.width/(span*(source.aspect??source.width/source.height)),py=source.height/2-local[1]*unit
  const x=o.x+o.a*px+o.c*py,y=o.y+o.b*px+o.d*py,r=c.radius*unit*Math.hypot(o.a,o.b)
  const amount=ballEase((age-.30)/1.55)
  if(w>760){
    // Anticipate the captured support/corner/exit outline before support loss.
    // Fitting desktop contact remains stationary; move the entire composition.
    const points=[c.support,c.corner].map(p=>p.map((v,i)=>v+c.normal[i]*c.radius)).concat([c.exit])
    const projected=points.map(p=>{const px=source.width/2+(p[0]-c.anchor[0])*source.width/(span*(source.aspect??source.width/source.height)),py=source.height/2-(p[1]-c.anchor[1])*unit;return {x:o.x+o.a*px+o.c*py,y:o.y+o.b*px+o.d*py}})
    const left=Math.min(...projected.map(p=>p.x-r)),right=Math.max(...projected.map(p=>p.x+r)),top=Math.min(...projected.map(p=>p.y-r)),bottom=Math.max(...projected.map(p=>p.y+r))
    return {x:(left<0?16-left:right>w?w-16-right:0)*amount,y:(top<0?16-top:bottom>h?h-16-bottom:0)*amount}
  }
  return {x:Math.max(0,r+16-x)*amount,y:-Math.max(0,y+r-(h-16),y-h*.77)*amount}
}
// The same authored screen frame drives the live camera and static preview.
export function ballEntryPresentation(source,width,height,age,pose){
  const c=source.contact,flight=ballFlight(age,c,pose),aspect=source.aspect??source.width/source.height,vertical=Math.max(2.6,2.6/aspect),unit=source.height/vertical,xUnit=source.width/(vertical*aspect)
  const {span,orientationP,plane,basis,...fan}=ballFanFrame(source,width,height,age)
  const p=ballEase((age-1.85)/1.25),affine=ballEntryFrame(source,width,height,orientationP,age)
  const pixel=point=>({x:source.width/2+(point[0]-c.anchor[0])*xUnit,y:source.height/2-(point[1]-c.anchor[1])*unit})
  const local=pixel(flight.position)
  let x=affine.x+affine.a*local.x+affine.c*local.y,y=affine.y+affine.b*local.x+affine.d*local.y
  if(age>=1.85){
    const a=ballEntryFrame(source,width,height,0,1.85),exit=pixel(c.exit),ex=a.x+a.a*exit.x+a.c*exit.y,ey=a.y+a.b*exit.x+a.d*exit.y
    const targetX=width*(width>760?.4:.5),targetY=height*(width>760?.55:.57),u=Math.max(0,Math.min(1,(age-1.85)/1.25))
    const vx=a.a*c.exitVelocity[0]*xUnit-a.c*c.exitVelocity[1]*unit,vy=a.b*c.exitVelocity[0]*xUnit-a.d*c.exitVelocity[1]*unit,drift=(age-1.85)*Math.exp(-(age-1.85)/.10)*(1-u)**2
    x=ex+(targetX-ex)*p+vx*drift;y=ey+(targetY-ey)*p+vy*drift+Math.min(height*.07,Math.max(0,targetY+height*.23-ey))*Math.sin(Math.PI*u)**2
    const exitRadius=c.radius*unit*Math.hypot(a.a,a.b)
    x+=Math.max(0,16-(ex-exitRadius))*ballEase((age-1.85)/.06)*(1-p)
    if(age>=3.10)y-=(flight.position[1]-2.62)*Math.hypot(7,15)/Math.hypot(7,7.4,15)*height/span
  }
  const reference=age>=3.10?[-3.45,2.62,0]:flight.position,sx=age>=3.10?width*(width>760?.4:.5):x,sy=age>=3.10?height*(width>760?.55:.57):y
  const dx=fan.x-sx-plane.a*(basis.origin[0]-reference[0])-plane.c*(basis.origin[1]-reference[1]),dy=fan.y-sy-plane.b*(basis.origin[0]-reference[0])-plane.d*(basis.origin[1]-reference[1]),det=plane.a*plane.d-plane.b*plane.c
  const fanTranslation=[(plane.d*dx-plane.c*dy)/det,(-plane.b*dx+plane.a*dy)/det,0],cardWorld=basis.cardWorld?.map(point=>point.map((v,i)=>v+fanTranslation[i]))
  return {x,y,diameter:2*flight.radius/span*source.height*Math.hypot(affine.a,affine.b),span,p,orientationP,affine,fan,fanTranslation,cardBasis:basis.cardWorld,cardWorld}
}

export function createVolleyball(T,host,surface=host) {
  const resources=new Set(),own=r=>{resources.add(r);return r}
  let renderer,disposed=false
  function destroy(){if(disposed)return;disposed=true;for(const r of resources)r.dispose();renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove()}
  try {
    renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'})
    renderer.setClearColor(0,0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5))
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15
    renderer.domElement.setAttribute('aria-hidden','true');surface.append(renderer.domElement)
    const scene=new T.Scene(),ball=new T.Group();scene.add(ball)
    let steps=null
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap
    const camera=new T.OrthographicCamera(-1.4,1.4,1.4,-1.4,.1,20);camera.position.set(0,0,6)
    scene.add(new T.HemisphereLight('#fff5dd','#514765',1.2))
    const key=new T.DirectionalLight('#fff2dd',3.8);key.position.set(-3,4,5);key.castShadow=false;own(key.shadow);key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-8,right:8,top:9,bottom:-9,near:.1,far:40});key.shadow.bias=-.001;scene.add(key)
    const fill=new T.DirectionalLight('#d8ddf6',1.1);fill.position.set(4,1,2);scene.add(fill)
    const rim=new T.DirectionalLight('#fff8ec',2.4);rim.position.set(2,3,-4);scene.add(rim)
    for(const light of [key,fill,rim])scene.add(light.target)
    function lights(base,p=0){
      const originals=[[-3,4,5],[4,1,2],[2,3,-4]],ends=[[-4,10,7],[4,1,2],[8,4,-6]]
      ;[key,fill,rim].forEach((light,i)=>{light.position.set(...originals[i]).lerp(new T.Vector3(...ends[i]),p).add(base);light.target.position.copy(base)})
      key.castShadow=p>0
    }
    const leather=leatherMaps(T,host.ownerDocument,own)
    const palette=['#f2ecd9','#dfae16','#2d1755','#f2ecd9','#dfae16','#2d1755']
    const materials=palette.map(color=>own(new T.MeshPhysicalMaterial({color,roughness:.72,metalness:0,map:leather.color,bumpMap:leather.bump,bumpScale:.022,clearcoat:.06,clearcoatRoughness:.8,side:T.DoubleSide})))
    host.dataset.material='pebbled-leather';host.dataset.textureSize='1024'
    const core=new T.Mesh(own(new T.SphereGeometry(.994,48,32)),own(new T.MeshStandardMaterial({color:'#554838',roughness:.9})));core.castShadow=true;ball.add(core)
    for(let face=0;face<6;face++)for(let band=0;band<3;band++){
      const data=panelGeometry(face,band,22),g=own(new T.BufferGeometry())
      g.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(data.normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(data.uvs,2));g.setIndex(data.indices)
      const mesh=new T.Mesh(g,materials[(face+band*2)%6]);mesh.userData.panel=true;mesh.castShadow=true;ball.add(mesh)
    }
    let width=0,height=0,vertical=2.6,entrySource=null,lastPose=[0,0,0,undefined],lastEntry=null,entryAffine=null,pixelRatio=0
    function buffer(w,h){
      const ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(4000000/(w*h)))
      if(w===width&&h===height&&ratio===pixelRatio)return
      width=w;height=h;pixelRatio=ratio;renderer.setDrawingBufferSize(w,h,ratio)
      renderer.domElement.style&&(renderer.domElement.style.cssText='')
    }
    function framing(span,p=0,age=0){
      const w=entrySource?.width??width,h=entrySource?.height??height,sourceAspect=entrySource?.aspect??w/h,aspect=sourceAspect+(w/h-sourceAspect)*p
      camera.left=-span*aspect/2;camera.right=-camera.left
      camera.top=span/2;camera.bottom=-camera.top;camera.updateProjectionMatrix()
      if(entrySource){
        entryAffine=ballEntryFrame(entrySource,width,height,p,age)
        const {a,b,c,d,x,y}=entryAffine
        const clip=new T.Matrix4().set(a*w/width,-c*h/width,0,2*(x+a*w/2+c*h/2)/width-1,
          -b*w/height,d*h/height,0,1-2*(y+b*w/2+d*h/2)/height,0,0,1,0,0,0,0,1)
        camera.projectionMatrix.premultiply(clip);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
      }
    }
    function resize(w=surface.clientWidth,h=surface.clientHeight){
      w=Math.max(1,w);h=Math.max(1,h);entrySource=null;entryAffine=null;lastEntry=null
      vertical=Math.max(2.6,2.6/(w/h));buffer(w,h);framing(vertical)
    }
    function extend(screenWidth,screenHeight,source){
      entrySource=source;vertical=Math.max(2.6,2.6/(source.aspect??source.width/source.height));buffer(screenWidth,screenHeight)
      paintEntry(0,...lastPose)
    }
    function resizeEntry(screenWidth,screenHeight){
      if(!entrySource)return
      buffer(screenWidth,screenHeight)
      if(lastEntry)paintEntry(...lastEntry)
    }
    function projectEntry(point){
      const p=new T.Vector3(...point).project(camera)
      return {x:(p.x+1)*width/2,y:(1-p.y)*height/2}
    }
    function record(x,y,time,spin,motion){
      host.dataset.triangles=String(renderer.info.render.triangles);host.dataset.panels='18'
      host.dataset.pose=`${x.toFixed(4)},${y.toFixed(4)}`;host.dataset.diameter=String(2/vertical*(entrySource?.height??height))
      host.dataset.sourcePose=JSON.stringify({x,y,time,spin,radius:ball.scale.x});host.dataset.clearAlpha=String(renderer.getClearAlpha());host.dataset.motion=JSON.stringify(motion);host.dataset.time=time.toFixed(3)
      host.dataset.quaternion=JSON.stringify(ball.quaternion.toArray())
      if(spin)host.dataset.spin=JSON.stringify(spin)
      host.dataset.projection=JSON.stringify({...projectEntry(ball.position.toArray()),diameter:2*ball.scale.x/(camera.top-camera.bottom)*(entrySource?.height??height)*(entryAffine?Math.hypot(entryAffine.a,entryAffine.b):1)})
    }
    function paint(x,y,time=0,spin){
      if(disposed)return
      lastPose=[x,y,time,spin]
      const motion=ballMotion(time,x,y,spin);ball.position.set(...motion.position);ball.rotation.set(...motion.rotation);if(spin?.basis)ball.quaternion.fromArray(ballPoseQuaternion({x,y,time,spin}));ball.scale.setScalar(1)
      if(contactShadow)contactShadow.visible=false
      steps?.reveal(0);lights(new T.Vector3());camera.far=20;camera.position.set(0,0,6);camera.quaternion.identity();framing(vertical)
      renderer.render(scene,camera);record(x,y,time,spin,motion)
    }
    const endCamera=new T.OrthographicCamera();endCamera.position.set(7,8,15);endCamera.lookAt(0,.6,0)
    const zAxis=new T.Vector3(0,0,1),startQuaternion=new T.Quaternion(),right=new T.Vector3(),up=new T.Vector3(),forward=new T.Vector3()
    let contactShadow=null,entryFanFrame=null,entryCardAffine=null
    function paintEntry(age,x,y,time,spin,entry={}){
      if(disposed)return
      lastEntry=[age,x,y,time,spin,entry]
      if(!steps){steps=createBallSteps(T,host.ownerDocument,own);scene.add(steps.group)}
      const c=entry.choreography??entrySource.contact,pose={x,y,time,spin},flight=ballFlight(age,c,pose),motion=ballMotion(time,x,y,spin),presentation=ballEntryPresentation(entrySource,width,height,age,pose),{p,span,orientationP}=presentation
      ball.position.set(...flight.position)
      if(entry.orientation)ball.quaternion.fromArray(entry.orientation.quaternion);else if(spin?.basis)ball.quaternion.fromArray(ballPoseQuaternion({x,y,time,spin}));else ball.rotation.set(...motion.rotation)
      ball.scale.setScalar(flight.radius)
      // After landing the hero is the old staircase world: the visitor may throw the same ball down the treads.
      if(entry.play&&age>=3.10){ball.position.set(entry.play.x,entry.play.y,0);ball.rotateOnWorldAxis(zAxis,entry.play.angle-.3)}
      camera.position.set(...c.anchor).add(new T.Vector3(0,0,6));camera.quaternion.copy(startQuaternion).slerp(endCamera.quaternion,orientationP)
      camera.far=80;lights(new T.Vector3(...c.anchor).multiplyScalar(1-p),p)
      framing(span,orientationP,age)
      if(age>=1.85){
        // Solve the camera translation from the shared affine. The world flight
        // stays ballistic while its screen center follows a bounded slow arc.
        const {x:sx,y:sy}=age>=3.10?{x:width*(width>760?.4:.5),y:height*(width>760?.55:.57)}:presentation
        const {a:A,b:B,c:C,d:D,x:X,y:Y}=entryAffine,det=A*D-B*C,lx=(D*(sx-X)-C*(sy-Y))/det,ly=(-B*(sx-X)+A*(sy-Y))/det
        right.set(1,0,0).applyQuaternion(camera.quaternion);up.set(0,1,0).applyQuaternion(camera.quaternion);forward.set(0,0,1).applyQuaternion(camera.quaternion)
        const sourceAspect=entrySource.aspect??entrySource.width/entrySource.height,projectionAspect=sourceAspect+(entrySource.width/entrySource.height-sourceAspect)*orientationP
        camera.position.copy(age>=3.10?new T.Vector3(-3.45,2.62,0):ball.position).addScaledVector(right,-(lx/entrySource.width-.5)*span*projectionAspect).addScaledVector(up,-(.5-ly/entrySource.height)*span).addScaledVector(forward,18)
      }
      if(!contactShadow){
        const canvas=host.ownerDocument.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(32,32,2,32,32,32)
        g.addColorStop(0,'rgba(20,8,2,.4)');g.addColorStop(1,'rgba(20,8,2,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64)
        contactShadow=new T.Mesh(own(new T.PlaneGeometry(1,1)),own(new T.MeshBasicMaterial({map:own(new T.CanvasTexture(canvas)),transparent:true,depthWrite:false})));scene.add(contactShadow)
      }
      contactShadow.visible=age>=.30&&age<1.85
      if(flight.support){contactShadow.position.set(...flight.support);contactShadow.position.z=.002;contactShadow.rotation.z=Math.atan2(c.tangent[1],c.tangent[0]);contactShadow.scale.set(2.4,.20,1);contactShadow.material.opacity=age<.5?ballEase((age-.30)/.20):age>1.70?1-(age-1.70)/.15:1}
      steps.reveal(p);host.dataset.treads='3';host.dataset.landing='0';host.dataset.flight=JSON.stringify(flight)
      renderer.render(scene,camera);record(x,y,time,spin,{position:ball.position.toArray(),rotation:ball.rotation.toArray().slice(0,3)})
      const shift=ballContactShift(entrySource,width,height,age),layout=ballContactLayout(entrySource,width,height),card=c.card.affine,fanFrame=presentation.fan
      // Translate the captured source-world plane as one composition, then
      // obtain its DOM affine from the actual live camera. Never rebuild its
      // basis from this frame's desired screen points.
      const cardWorld=presentation.cardWorld
      const projected=cardWorld?.map(projectEntry),cardAffine=projected?{a:(projected[1].x-projected[0].x)/(c.card.width??1),b:(projected[1].y-projected[0].y)/(c.card.width??1),c:(projected[2].x-projected[0].x)/(c.card.height??1),d:(projected[2].y-projected[0].y)/(c.card.height??1),x:projected[0].x,y:projected[0].y}:undefined
      entryCardAffine=cardAffine
      if(cardAffine){
        const det=card.a*card.d-card.b*card.c,A=(cardAffine.a*card.d-cardAffine.c*card.b)/det,B=(cardAffine.b*card.d-cardAffine.d*card.b)/det,C=(-cardAffine.a*card.c+cardAffine.c*card.a)/det,D=(-cardAffine.b*card.c+cardAffine.d*card.a)/det
        const x=cardAffine.x-A*card.x-C*card.y,y=cardAffine.y-B*card.x-D*card.y,{left,right,top,bottom}=entrySource.fanBasis.bounds
        entryFanFrame={...fanFrame,a:A,b:B,c:C,d:D,x,y,bottom:Math.max(...[[left,top],[right,top],[left,bottom],[right,bottom]].map(([px,py])=>B*px+D*py+y))}
      }else entryFanFrame=fanFrame
      host.dataset.entryTrace=JSON.stringify({...flight,position:ball.position.toArray(),age,clockVelocity:entry.clockVelocity,pathVelocity:flight.velocity,velocity:flight.velocity.map((v,i)=>v*(entry.clockVelocity??1)+flight.ambientVelocity[i]),ambientPose:pose,sourcePose:entry.pose??{x,y,time,spin,radius:c.sourceRadius},sourceRadius:c.sourceRadius,quaternion:ball.quaternion.toArray(),angularVelocity:entry.orientation?.angularVelocity,reopen:entry.orientation?.reopen,anchor:c.anchor,tangent:c.tangent,normal:c.normal,axis:c.axis,corner:c.corner,card:c.card,sourceAffine:entryAffine,cardAffine,cardBasis:presentation.cardBasis,cardWorld,fanTranslation:presentation.fanTranslation,fanFrame:entryFanFrame,span,orientationP,contactShift:shift,contactLayout:layout,cameraPosition:camera.position.toArray(),cameraQuaternion:camera.quaternion.toArray(),projection:JSON.parse(host.dataset.projection),buffer:{width:renderer.domElement.width,height:renderer.domElement.height,pixelRatio}})
    }
    resize();paint(0,0)
    return {resize,extend,resizeEntry,projectEntry,paint,paintEntry,destroy,get frame(){return {width,height,padX:0,padY:0}},get entryProjection(){return {source:entrySource,affine:entryAffine,choreography:entrySource?.contact,fanFrame:entryFanFrame,cardAffine:entryCardAffine}},snapshotPose(){renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png')},snapshot(x=0,y=0,time=0,spin){paint(x,y,time,spin);return renderer.domElement.toDataURL('image/png')},alphaCorners(){paint(0,0);const gl=renderer.getContext(),pixel=new Uint8Array(4),result=[];for(const [x,y] of [[0,0],[gl.drawingBufferWidth-1,0],[0,gl.drawingBufferHeight-1],[gl.drawingBufferWidth-1,gl.drawingBufferHeight-1]]){gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);result.push(pixel[3])}return result}}
  } catch(error){destroy();throw error}
}
