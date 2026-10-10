import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import * as T from 'three'
import {createVolleyball,ballEntryFrame,ballEntryPresentation} from './ballScene.js'
import {createBallChoreography,captureBallOrientation,advanceBallOrientation,bridgeBallSpin} from './ballFlow.js'
import {staticLanding} from './ballSteps.js'
import {ballMotion} from './ballMotion.js'

test('one owned presentation retains exact panels/materials and every rotation axis through flight/return',()=>{
  let renderer,count=0
  const disposed=new Map()
  class Renderer{
    constructor(){count++;renderer=this;this.info={render:{triangles:1}};this.shadowMap={};this.domElement={style:{},setAttribute(){},remove(){},toDataURL:()=> 'exact-pose'};this.sizes=0}
    setClearColor(){}setPixelRatio(r){this.pixelRatio=r}getClearAlpha(){return 0}setSize(w,h){this.sizes++;this.width=w;this.height=h;this.domElement.width=Math.floor(w*this.pixelRatio);this.domElement.height=Math.floor(h*this.pixelRatio)}
    setDrawingBufferSize(w,h,r){this.pixelRatio=r;this.setSize(w,h)}
    render(scene,camera){this.scene=scene;this.camera=camera;scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);scene.traverse(o=>{for(const r of [o.geometry,o.material,o.material?.map,o.material?.bumpMap])if(r&&!disposed.has(r)){disposed.set(r,0);r.addEventListener('dispose',()=>disposed.set(r,disposed.get(r)+1))}})}
    dispose(){}forceContextLoss(){}
  }
  const ctx={fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},ellipse(){},fill(){},drawImage(){},createRadialGradient:()=>({addColorStop(){}})}
  const host={clientWidth:600,clientHeight:500,dataset:{},append(){assert.fail('React host must not own canvas')},ownerDocument:{createElement:()=>({getContext:()=>ctx})}}
  const surface={clientWidth:600,clientHeight:500,append(c){this.canvas=c}}
  const saved=Object.getOwnPropertyDescriptor(globalThis,'devicePixelRatio');Object.defineProperty(globalThis,'devicePixelRatio',{value:1,configurable:true})
  let view
  try{
    view=createVolleyball({...T,WebGLRenderer:Renderer},host,surface)
    assert.equal(typeof view.paintEntry,'function','same-scene entry missing')
    const spin={pitch:1.23,yaw:3.14,pitchSpeed:2,yawSpeed:4}
    view.paint(.2,-.3,9,spin)
    const panels=[];renderer.scene.traverse(o=>{if(o.userData.panel)panels.push(o)})
    const ball=panels[0].parent,lights=renderer.scene.children.filter(o=>o.isDirectionalLight),relative=lights.map(l=>l.position.clone().sub(ball.position).toArray()),rotation=ball.rotation.toArray(),materials=panels.map(o=>o.material),canvas=surface.canvas
    const projection=JSON.parse(host.dataset.projection)
    const angle=.17,scale=.83,origin={a:Math.cos(angle)*scale,b:Math.sin(angle)*scale,c:-Math.sin(angle)*scale,d:Math.cos(angle)*scale,x:230,y:170}
    const source={width:600,height:500,origin},pose={x:.2,y:-.3,time:9,spin}
    const entry={source,choreography:createBallChoreography({support:[.1,-.85,0],corner:[-2,-1.05,0]},pose),orientation:captureBallOrientation(pose)}
    source.contact=entry.choreography
    const toScreen=p=>({x:origin.x+origin.a*p.x+origin.c*p.y,y:origin.y+origin.b*p.x+origin.d*p.y,diameter:p.diameter*scale})
    view.extend(1440,1000,source);const expandedSizes=renderer.sizes
    assert.deepEqual([renderer.width,renderer.height],[1440,1000],'entry must allocate viewport dimensions, without padding')
    assert.equal(renderer.domElement.style.cssText,'','canvas must not stretch a padded source buffer')
    view.paintEntry(0,.2,-.3,9,spin,entry)
    const expandedProjection=JSON.parse(host.dataset.projection)
    assert.ok(['x','y','diameter'].every(k=>Math.abs(toScreen(projection)[k]-expandedProjection[k])<1e-9),'viewport projection changed first source-screen frame')
    const worldPoint=ball.position.clone(),projected=view.projectEntry(worldPoint.toArray())
    assert.ok(Math.abs(projected.x-expandedProjection.x)<1e-9&&Math.abs(projected.y-expandedProjection.y)<1e-9,'entry seam must use the actual camera projection')
    assert.equal(view.entryProjection.source,source);assert.deepEqual(view.entryProjection.affine,origin)
    assert.ok(ball.quaternion.angleTo(new T.Quaternion().setFromEuler(new T.Euler(...rotation.slice(0,3))))<1e-7,'first frame changed an orientation axis')
    assert.ok(lights.map(l=>l.position.clone().sub(ball.position).toArray()).every((r,i)=>r.every((v,j)=>Math.abs(v-relative[i][j])<1e-9)),'first frame changed lighting')
    view.paintEntry(.2,.2,-.3,9,spin,entry)
    assert.ok(ball.scale.x>1,'orthographic pop must visibly emerge toward the viewer')
    const contactCamera=renderer.camera.quaternion.toArray()
    for(const time of [.3,.5,.62,.8,1.2,1.7,1.8]){
      advanceBallOrientation(entry,time,.016,1);view.paintEntry(time,.2,-.3,9,spin,entry)
      assert.deepEqual(ball.quaternion.toArray(),entry.orientation.quaternion,'renderer must use retained logical orientation')
      assert.deepEqual(renderer.camera.quaternion.toArray(),contactCamera,'camera orientation moved during contact')
      assert.equal(ball.scale.x,1.18,'contact radius drifted')
      assert.deepEqual(panels.map(o=>o.material),materials);assert.equal(panels.length,18);assert.equal(surface.canvas,canvas);assert.equal(count,1);assert.equal(renderer.sizes,expandedSizes)
      assert.equal(host.dataset.spin,JSON.stringify(spin))
    }
    view.paintEntry(3.55,.2,-.3,9,spin,entry)
    assert.ok(ball.position.distanceTo(new T.Vector3(-3.45,2.62,0))<1e-9)
    assert.equal(host.dataset.treads,'3');assert.equal(host.dataset.landing,'0')
    assert.equal(ball.scale.x,.92)
    const beforeResize={position:ball.position.toArray(),rotation:ball.rotation.toArray(),flight:host.dataset.flight,time:host.dataset.time},beforeCamera=renderer.camera.quaternion.toArray()
    view.resizeEntry(390,844)
    assert.deepEqual([renderer.width,renderer.height],[390,844])
    assert.deepEqual(ball.position.toArray(),beforeResize.position);assert.deepEqual(ball.rotation.toArray(),beforeResize.rotation)
    assert.deepEqual(renderer.camera.quaternion.toArray(),beforeCamera)
    assert.equal(host.dataset.flight,beforeResize.flight);assert.equal(host.dataset.time,beforeResize.time)
    const resized=JSON.parse(host.dataset.projection)
    assert.ok(resized.x>0&&resized.x<390&&resized.y>0&&resized.y<844,'resize must repaint current landing at the new aspect')
    const movingSpin={...spin,yaw:4.2,pitch:1.7}
    view.paintEntry(.73,.2,-.3,21,movingSpin,entry)
    const moving={position:ball.position.toArray(),rotation:ball.rotation.toArray(),scale:ball.scale.x,camera:renderer.camera.quaternion.toArray(),flight:host.dataset.flight},scene=renderer.scene
    view.resizeEntry(1000,900)
    assert.deepEqual(ball.position.toArray(),moving.position);assert.deepEqual(ball.rotation.toArray(),moving.rotation);assert.equal(ball.scale.x,moving.scale)
    assert.deepEqual(renderer.camera.quaternion.toArray(),moving.camera);assert.equal(host.dataset.flight,moving.flight)
    assert.equal(host.dataset.time,'21.000');assert.equal(host.dataset.spin,JSON.stringify(movingSpin))
    assert.equal(renderer.scene,scene);assert.equal(surface.canvas,canvas)
    Object.defineProperty(globalThis,'devicePixelRatio',{value:3,configurable:true})
    for(const [w,h] of [[1440,1000],[390,844],[320,780],[4000,3000]]){
      view.resizeEntry(w,h)
      assert.deepEqual([renderer.width,renderer.height],[w,h]);assert.ok(renderer.pixelRatio<=1.5)
      assert.ok(renderer.domElement.width*renderer.domElement.height<=4000000,'entry exceeded the 4MP buffer cap')
      if(w===1440)assert.equal(renderer.pixelRatio,1.5)
    }
    assert.deepEqual(materials.slice(0,3).map(m=>`#${m.color.getHexString()}`),['#f2ecd9','#2d1755','#dfae16'])
    view.resize();assert.equal(view.frame.padX,0);assert.equal(view.frame.padY,0);view.paint(.2,-.3,9,spin)
    assert.deepEqual(JSON.parse(host.dataset.projection),projection,'return must restore card framing')
    for(const [screenWidth,screenHeight,w,h] of [[1440,1000,600,500],[390,844,264,330],[320,780,217,303]]){
      surface.clientWidth=w;surface.clientHeight=h;view.resize();view.paint(.2,-.3,9,spin)
      const sourcePosition=ball.position.clone(),points=[[0,0,0],[.7,-.3,.2],[-.4,.6,-.2]].map(v=>new T.Vector3(...v).add(sourcePosition))
      const local=points.map(v=>view.projectEntry(v.toArray())),sourceProjection=JSON.parse(host.dataset.projection)
      const cssWidth=w+.4,cssHeight=h+.2,frame={width:cssWidth,height:cssHeight,aspect:w/h,origin:{...origin,x:(screenWidth-cssWidth*scale)/2,y:(screenHeight-cssHeight*scale)/2},contact:createBallChoreography({support:[.1,-.85,0],corner:[-2,-1.05,0]},pose)}
      view.extend(screenWidth,screenHeight,frame)
      const actual=JSON.parse(host.dataset.projection)
      assert.ok(Math.abs(actual.diameter-sourceProjection.diameter*cssHeight/h*scale)<1e-9)
      for(let i=0;i<points.length;i++){
        const sx=local[i].x*cssWidth/w,sy=local[i].y*cssHeight/h
        const expected={x:frame.origin.x+origin.a*sx+origin.c*sy,y:frame.origin.y+origin.b*sx+origin.d*sy}
        const projected=view.projectEntry(points[i].clone().add(new T.Vector3(...view.entryProjection.choreography.anchor)).toArray())
        assert.ok(Math.abs(projected.x-expected.x)<1e-9&&Math.abs(projected.y-expected.y)<1e-9,`${screenWidth}: first source-screen projection changed`)
      }
      assert.equal(surface.canvas,canvas);assert.equal(count,1);assert.deepEqual(panels.map(o=>o.material),materials)
      assert.deepEqual(ball.rotation.toArray(),rotation);assert.deepEqual([renderer.width,renderer.height],[screenWidth,screenHeight])
      view.paintEntry(3.55,.2,-.3,9,spin)
      const cpu=staticLanding(screenWidth/screenHeight,screenWidth),point=view.projectEntry([-4.8,1.7,1.7])
      assert.ok(Math.abs(point.x/screenWidth-cpu.blocks[0][0][0][0])<1e-9&&Math.abs(point.y/screenHeight-cpu.blocks[0][0][0][1])<1e-9,'fractional source dimensions changed static/live tread projection')
    }
    for(const [sw,sh] of [[1440,1000],[1000,900],[768,1024],[390,844],[320,780]]){
      const mobile=sw<=760,cw=mobile?sw*.77:Math.min(sw*.68,930),ch=cw/(mobile?.72:1.5),ox=cw*(mobile?.06:.31),oy=ch*(mobile?.28:.08),w=cw*(mobile?.88:.65),h=ch*(mobile?.54:.78),angle=-5*Math.PI/180,a=Math.cos(angle),b=Math.sin(angle),c=-b,d=a
      const cardX=sw*(mobile?.46:.51)-cw/2,cardY=sh*.54-ch/2,affine={a,b,c,d,x:cardX+cw/2-a*cw/2-c*ch/2,y:cardY+ch/2-b*cw/2-d*ch/2}
      const origin={a,b,c,d,x:affine.x+a*ox+c*oy,y:affine.y+b*ox+d*oy},unit=h/Math.max(2.6,2.6/(w/h)),toWorld=(x,y)=>[(x-ox-w/2)/unit,-(y-oy-h/2)/unit,0]
      const source={width:w,height:h,aspect:w/h,origin,viewport:{width:sw,height:sh}},choreography=createBallChoreography({support:toWorld(ox+w/2,ch*.96-24),corner:toWorld(0,ch),affine,width:cw,height:ch},pose)
      source.fanBottom=Math.max(...[[0,0],[cw,0],[0,ch],[cw,ch]].map(([x,y])=>affine.y+b*x+d*y))+30
      source.fanBounds={left:cardX-30,right:cardX+cw+30,top:cardY-30,bottom:source.fanBottom}
      source.contact=choreography;const entry={source,choreography,orientation:captureBallOrientation(pose)}
      surface.clientWidth=w;surface.clientHeight=h;view.resize();view.paint(pose.x,pose.y,pose.time,pose.spin);view.extend(sw,sh,source)
      // Independent capture: invert the measured DOM affine into the source
      // camera's z=0 plane, with the same pixel units used by support/corner.
      const sourceUnit=h/Math.max(2.6,2.6/source.aspect),sourceXUnit=w/(Math.max(2.6,2.6/source.aspect)*source.aspect),det=origin.a*origin.d-origin.b*origin.c
      const captured=[[0,0],[cw,0],[0,ch]].map(([px,py])=>{
        const sx=affine.x+a*px+c*py-origin.x,sy=affine.y+b*px+d*py-origin.y
        return [choreography.anchor[0]+((origin.d*sx-origin.c*sy)/det-w/2)/sourceXUnit,choreography.anchor[1]-((-origin.b*sx+origin.a*sy)/det-h/2)/sourceUnit,0]
      })
      const anchor=[...choreography.anchor],support=[...choreography.support],corner=[...choreography.corner]
      let upward=0,previousY,previousFanBottom
      for(let t=.30;t<=3.55;t+=.005){
        view.paintEntry(t,pose.x,pose.y,pose.time,pose.spin,entry)
        const projection=JSON.parse(host.dataset.projection),r=projection.diameter/2
        const shared=ballEntryPresentation(source,sw,sh,t)
        const trace=JSON.parse(host.dataset.entryTrace)
        if(trace.fanFrame.bottom>=0)assert.deepEqual(renderer.camera.quaternion.toArray(),[0,0,0,1],`${sw}: camera rotated while fan still visible`)
        if(t>trace.fanFrame.exitTime+.05&&t<2.8)assert.notDeepEqual(renderer.camera.quaternion.toArray(),[0,0,0,1],'destination orientation never starts after exit')
        for(const k of ['a','b','c','d','x','y','bottom','exitTime'])assert.ok(Math.abs(trace.fanFrame[k]-shared.fan[k])<1e-8,'trace must include actual projected fan translation and exit time')
        assert.deepEqual(JSON.parse(JSON.stringify(view.entryProjection.fanFrame)),trace.fanFrame,'DOM must consume this same live plane projection')
        const translation=trace.cardWorld[0].map((v,i)=>v-captured[0][i])
        for(let i=0;i<3;i++)for(let axis=0;axis<3;axis++){
          assert.ok(Math.abs(trace.cardWorld[i][axis]-captured[i][axis]-translation[axis])<1e-8,'captured source-world basis changed with the live camera')
          assert.equal(trace.cardWorld[i][2],0,'card plane must stay on the actual source z=0 plane')
        }
        assert.deepEqual(choreography.anchor,anchor);assert.deepEqual(choreography.support,support);assert.deepEqual(choreography.corner,corner)
        trace.cardBasis.forEach((point,i)=>point.forEach((v,axis)=>assert.ok(Math.abs(v-captured[i][axis])<1e-9,'captured card basis must stay fixed across all paints')))
        for(const [i,local] of [[0,[0,0]],[1,[cw,0]],[2,[0,ch]]]){
          const actual=view.projectEntry(captured[i].map((v,axis)=>v+translation[axis])),f=trace.fanFrame,sx=affine.x+a*local[0]+c*local[1],sy=affine.y+b*local[0]+d*local[1]
          const expected={x:f.a*sx+f.c*sy+f.x,y:f.b*sx+f.d*sy+f.y}
          assert.ok(Math.abs(actual.x-expected.x)<1e-8&&Math.abs(actual.y-expected.y)<1e-8,'DOM must use the fixed translated world basis through the actual live camera')
        }
        if(t<1.85){
          assert.ok(Math.hypot(...translation)<1e-9,'actual contact must not move the captured world plane')
          const corner=view.projectEntry(choreography.corner),f=trace.fanFrame,sx=affine.x+c*ch,sy=affine.y+d*ch
          assert.ok(Math.hypot(corner.x-(f.a*sx+f.c*sy+f.x),corner.y-(f.b*sx+f.d*sy+f.y))<.02,'native source corner projection must retain its actual DOM contact')
          if(t>=.62){
            const support=view.projectEntry(trace.support)
            assert.ok(Math.abs(Math.hypot(projection.x-support.x,projection.y-support.y)-r)<.02,'actual rolling/corner support must retain the projected pop-scaled radius')
          }
        }
        if(t<2.15){
          const ratio=Math.max(2.6,2.6/source.aspect)/trace.span
          for(const k of ['a','d'])assert.ok(Math.abs(trace.fanFrame[k]-ratio)<1e-8,'live camera span must change the fan pixel metric')
          assert.ok(Math.abs(trace.fanFrame.b)<1e-8&&Math.abs(trace.fanFrame.c)<1e-8,'one affine composition must preserve normalized card shape before exit')
        }
        if(t>=1.85&&t<=2.15&&previousFanBottom!==undefined)assert.ok(trace.fanFrame.bottom<previousFanBottom,'whole fan must travel up after support loss')
        if(Math.abs(t-2.15)<.003)assert.ok(trace.fanFrame.bottom>100,`${sw}: lower edge must remain readable for the first .3s of fall (${trace.fanFrame.bottom})`)
        previousFanBottom=trace.fanFrame.bottom
        assert.ok(trace.angularVelocity.length===3,'trace must retain full logical angular velocity')
        for(const key of ['x','y','diameter'])assert.ok(Math.abs(projection[key]-shared[key])<1e-8,`${sw}: static/live ${key} differs during ${t}`)
        assert.ok(projection.x-r>=0&&projection.x+r<=sw&&projection.y-r>=0&&projection.y+r<=sh,`${sw} outline at ${t}: ${JSON.stringify(projection)}`)
        if(t>=1.85&&previousY!==undefined)upward+=Math.max(0,previousY-projection.y)
        previousY=projection.y
      }
      assert.ok(upward<=sh*.25,`${sw}: upward sweep ${upward/sh}`)
      const join=[]
      for(const t of [1.85-.00001,1.85,1.85+.00001]){view.paintEntry(t,pose.x,pose.y,pose.time,pose.spin,entry);join.push(JSON.parse(host.dataset.projection))}
      for(const key of ['x','y'])assert.ok(Math.abs((join[1][key]-join[0][key])/.00001-(join[2][key]-join[1][key])/.00001)<1,`${sw}: screen velocity jumped at corner (${key})`)
      assert.ok(join[2].x<join[1].x&&join[2].y>join[1].y,'air must initially continue left/down')
      view.paintEntry(3.55,pose.x,pose.y,pose.time,pose.spin,entry)
      const final=JSON.parse(host.dataset.projection),fallback=staticLanding(sw/sh,sw)
      assert.ok(Math.abs(final.x/sw-(mobile?.5:.4))<1e-9);assert.ok(Math.abs(final.y/sh-(mobile?.57:.55))<1e-9)
      assert.ok(Math.abs(final.x/sw-fallback.ball.x)<1e-9&&Math.abs(final.y/sh-fallback.ball.y)<1e-9,'static/live landing center differs')
      assert.ok(Math.abs(final.diameter/sh-fallback.ball.diameter)<1e-9,'static/live radius differs')
      view.paintEntry(3.10,pose.x,pose.y,pose.time,pose.spin,entry)
      const landedCamera={position:renderer.camera.position.toArray(),quaternion:renderer.camera.quaternion.toArray()}
      for(const age of [3.18,3.25,3.40,3.55]){
        view.paintEntry(age,pose.x,pose.y,pose.time,pose.spin,entry)
        assert.deepEqual(renderer.camera.position.toArray(),landedCamera.position,'camera moved during landing bounce')
        assert.deepEqual(renderer.camera.quaternion.toArray(),landedCamera.quaternion)
        if(age===3.25)assert.ok(JSON.parse(host.dataset.projection).y<final.y-sh*.01,'landing bounce disappeared behind camera tracking')
      }
      view.paintEntry(1.80,pose.x,pose.y,pose.time,pose.spin,entry)
      const contactPose=ball.position.toArray(),contactOrientation=ball.quaternion.toArray(),fixedBasis=source.fanBasis
      for(const [rw,rh] of [[1000,900],[768,1024],[320,780],[390,844],[844,390],[1440,1000]]){
        view.resizeEntry(rw,rh);const projection=JSON.parse(host.dataset.projection),r=projection.diameter/2
        assert.equal(source.fanBasis,fixedBasis,'viewport resize must keep the once-captured source-world basis')
        assert.deepEqual(JSON.parse(host.dataset.entryTrace).cardBasis,fixedBasis.cardWorld)
        assert.deepEqual(ball.position.toArray(),contactPose);assert.deepEqual(ball.quaternion.toArray(),contactOrientation)
        assert.ok(projection.x-r>=0&&projection.x+r<=rw&&projection.y-r>=0&&projection.y+r<=rh,`${sw} -> ${rw}x${rh}: resized contact outline left viewport`)
      }
      const basisSpin=bridgeBallSpin(pose,entry.orientation)
      view.resize();view.paint(pose.x,pose.y,pose.time,basisSpin);const before=ball.quaternion.clone()
      assert.ok(renderer.scene.children.filter(o=>o.geometry?.type==='PlaneGeometry').every(o=>!o.visible),'source repaint retained an entry contact shadow')
      view.extend(sw,sh,source)
      assert.ok(ball.quaternion.angleTo(before)<1e-7,'second entry first frame discarded source orientation basis')
    }
    {
      const native=JSON.parse(readFileSync(new URL('./nativeGeometryReturn.fixture.json',import.meta.url))),fixture=native.sources['entry-return'],source=fixture.source,choreography=createBallChoreography(fixture.card,fixture.pose),entry={pose:fixture.pose,choreography,orientation:captureBallOrientation(fixture.pose),clockVelocity:native.return.last.trace.clockVelocity}
      source.contact=choreography
      view.resize(603,482);view.paint(fixture.pose.x,fixture.pose.y,fixture.pose.time,fixture.pose.spin);view.extend(1440,1000,source)
      const current=native.return.last.pose,age=native.return.last.trace.age,h=1e-6
      const paint=(age,pose)=>{view.paintEntry(age,pose.x,pose.y,pose.time,pose.spin,entry);return JSON.parse(host.dataset.entryTrace)}
      const last=paint(age,current),position=ball.position.toArray()
      assert.deepEqual(last.position,position,'trace must record the actual rendered world position')
      assert.ok(Math.hypot(last.projection.x-native.return.end.center.x,last.projection.y-native.return.end.center.y)<1,'native rendered near-return still snaps from captured source')
      paint(age+entry.clockVelocity*h,{...current,time:current.time+h})
      ball.position.toArray().forEach((v,i)=>assert.ok(Math.abs((v-position[i])/h-last.velocity[i])<5e-4,`rendered two-clock derivative axis ${i}`))
      for(const want of [false,true,false,true]){
        entry.want=want;const before=paint(age,current)
        assert.deepEqual(before.position,position,'interrupt/reopen must not restart ambient position')
        assert.deepEqual(before.velocity,last.velocity,'want flag must not change either derivative')
      }
      entry.clockVelocity=0;const terminal=paint(0,native.return.end.pose),normal=ballMotion(native.return.end.pose.time,native.return.end.pose.x,native.return.end.pose.y,native.return.end.pose.spin)
      terminal.position.forEach((v,i)=>assert.ok(Math.abs(v-choreography.anchor[i]-normal.position[i])<1e-9,`current source endpoint axis ${i}`))
      const beforeClose=JSON.parse(host.dataset.projection)
      view.resize(603,482);view.paint(native.return.end.pose.x,native.return.end.pose.y,native.return.end.pose.time,native.return.end.pose.spin)
      assert.deepEqual(ball.position.toArray(),normal.position,'ordinary repaint must use this same current endpoint')
      const afterClose=JSON.parse(host.dataset.projection),o=source.origin,sx=afterClose.x*source.width/603,sy=afterClose.y*source.height/482
      assert.ok(Math.hypot(beforeClose.x-(o.x+o.a*sx+o.c*sy),beforeClose.y-(o.y+o.b*sx+o.d*sy))<1e-9,'source-camera endpoint must project exactly through the captured affine')
    }
    {
      const native=JSON.parse(readFileSync(new URL('./orientationResizeGeometry.fixture.json',import.meta.url))),source=structuredClone(native.source),pose=native.pose
      source.contact=createBallChoreography(native.card,pose)
      const entry={choreography:source.contact,orientation:captureBallOrientation(pose)}
      view.resize(215,184);view.paint(pose.x,pose.y,pose.time,pose.spin);view.extend(320,780,source)
      for(const [w,h] of [[390,844],[844,390],[1440,1000],[320,780]]){
        view.resizeEntry(w,h)
        const ages=Array.from({length:251},(_,i)=>1.85+i*.005)
        for(const age of [native.reentry.age,2.63526,...ages,...ages.toReversed(),.90185735]){
          view.paintEntry(age,pose.x,pose.y,pose.time,pose.spin,entry)
          const tr=JSON.parse(host.dataset.entryTrace),f=ballEntryPresentation(source,w,h,age,pose)
          assert.ok(Math.abs(tr.fanFrame.bottom-f.fan.bottom)<1e-8,'actual camera must match the bounded fixed plane')
          if(tr.orientationP>0)assert.ok(tr.fanFrame.bottom<=0,'actual camera permits fan reentry')
          tr.cardBasis.forEach((p,i)=>p.forEach((v,j)=>assert.ok(Math.abs(v-native.cardBasis[i][j])<1e-9,'actual camera rebased captured card')))
          if(age<1.85){
            const projected=view.projectEntry(source.contact.corner),a=tr.cardAffine
            assert.ok(Math.hypot(projected.x-a.x-a.c*native.card.height,projected.y-a.y-a.d*native.card.height)<.02,'paused rolling resize must project the actual card corner')
          }
        }
      }
    }
    view.destroy();view.destroy();assert.ok([...disposed.values()].every(n=>n===1))
  }finally{view?.destroy();if(saved)Object.defineProperty(globalThis,'devicePixelRatio',saved);else delete globalThis.devicePixelRatio}
})

test('static landing projects the existing top tread and exact-ball preview within narrow viewports',async()=>{
  const steps=await import('./ballSteps.js')
  assert.equal(typeof steps.staticLanding,'function','same-tread fallback missing')
  for(const aspect of [1440/1000,390/844,320/780]){
    const pose=steps.staticLanding(aspect)
    assert.equal(pose.blocks.length,3)
    assert.ok(pose.ball.x>0&&pose.ball.x<1&&pose.ball.y>0&&pose.ball.y<1)
    assert.equal(pose.ball.x,aspect>.76?.4:.5);assert.equal(pose.ball.y,aspect>.76?.55:.57)
    assert.ok(pose.ball.diameter>0&&pose.ball.diameter<.3)
    assert.ok(pose.blocks.every(b=>b.length===3&&b.every(face=>face.length===4)))
  }
})

test('native desktop support-loss fixture retains its entire outline with a smooth shared projection margin',()=>{
  // Measured source frame from the parent's 20261002-155832 native filmstrip.
  const card={support:[0,-1.5147418140368514,0],corner:[-3.183014727097824,-1.7721306541736894,0]}
  const pose={x:0,y:0,time:.4166,spin:{yaw:.546656,pitch:.32,yawSpeed:.16,pitchSpeed:0},radius:1}
  const source={width:603.188,height:482.031,aspect:603/482,origin:{a:.996195,b:-.0871557,c:.0871557,d:.996195,x:528.4705200195312,y:296.7932419760922},viewport:{width:1440,height:1000},contact:createBallChoreography(card,pose)}
  for(let t=1.85;t<3.1;t+=.0001){
    const p=ballEntryPresentation(source,1440,1000,t)
    assert.ok(p.x-p.diameter/2>=0,`desktop outline clipped at ${t}: ${p.x-p.diameter/2}`)
  }
  const h=1e-6,a=ballEntryPresentation(source,1440,1000,1.85-h),b=ballEntryPresentation(source,1440,1000,1.85),c=ballEntryPresentation(source,1440,1000,1.85+h)
  assert.ok(Math.abs((b.x-a.x)/h-(c.x-b.x)/h)<.1,'outline margin must retain corner screen velocity')
  assert.equal(ballEntryPresentation(source,1440,1000,3.02).span,ballEntryPresentation(source,1440,1000,3.1).span,'framing must settle before impact')
})

test('fan pixel metric follows camera span instead of preserving the authored screen metric',()=>{
  const pose={x:0,y:0,time:0},source={width:600,height:500,aspect:1.2,origin:{a:1,b:0,c:0,d:1,x:200,y:200},viewport:{width:1440,height:1000},fanBottom:820,contact:createBallChoreography({support:[0,-.9,0],corner:[-2,-1,0]},pose)}
  const frame=ballEntryPresentation(source,1440,1000,2.15)
  assert.ok(Math.abs(frame.fan.a-2.6/frame.span)<1e-9,'fixed world basis must shrink with the shared live camera')
  const before=ballEntryPresentation(source,1440,1000,frame.fan.exitTime-.00001),after=ballEntryPresentation(source,1440,1000,frame.fan.exitTime+.00001)
  assert.ok(before.fan.bottom<0&&after.fan.bottom<0,'whole handoff envelope must clear before camera orientation begins')
  assert.equal(before.orientationP,0);assert.ok(after.orientationP>0)
  assert.ok(Math.abs(frame.fan.exitTime-2.5)>.01,'exit must be derived with the changed camera metric')
})
