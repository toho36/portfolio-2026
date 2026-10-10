import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import * as T from 'three'
import {createBallChoreography,ballEase} from './ballFlow.js'
import {ballEntryPresentation,ballContactLayout} from './ballScene.js'

const native=JSON.parse(readFileSync(new URL('./orientationResizeGeometry.fixture.json',import.meta.url)))
const capture=()=>{const source=structuredClone(native.source);source.contact=createBallChoreography(native.card,native.pose);return source}

// Independently project the captured plane through the actual Three camera
// orientation, orthographic metric and source clip affine (no inverse rebase).
function projectedFanBottom(source,w,h,age,orientationP){
  const f=ballEntryPresentation(source,w,h,age,native.pose),basis=source.fanBasis
  const camera=new T.OrthographicCamera();camera.position.set(7,8,15);camera.lookAt(0,.6,0)
  const q=new T.Quaternion().slerp(camera.quaternion,orientationP),right=new T.Vector3(1,0,0).applyQuaternion(q),up=new T.Vector3(0,1,0).applyQuaternion(q)
  const layout=ballContactLayout(source,w,h),p=orientationP,aspect=source.aspect+(source.width/source.height-source.aspect)*p
  const B=source.origin.b*layout.scale*(1-p),D=source.origin.d*layout.scale*(1-p)+h/source.height*p
  const {left,right:edge,top,bottom}=basis.bounds
  return Math.max(...[[left,top],[edge,top],[left,bottom],[edge,bottom]].map(([x,y])=>{
    const v=new T.Vector3(...basis.x).multiplyScalar(x).addScaledVector(new T.Vector3(...basis.y),y)
    return B*source.width/(f.span*aspect)*right.dot(v)-D*source.height/f.span*up.dot(v)+f.fan.y
  }))
}

test('captured portrait to desktop handoff never reenters through the full orientation interval',()=>{
  const source=capture(),{age,viewport:{width:w,height:h}}=native.reentry
  const f=ballEntryPresentation(source,w,h,age,native.pose)
  assert.ok(f.fan.bottom<=0,`captured reentry: ${f.fan.bottom}px`)
  const safeAge=f.fan.exitTime+1e-5
  for(let p=0;p<=1;p+=.001)assert.ok(projectedFanBottom(source,w,h,safeAge,p)<=0,`intermediate orientation ${p} reenters`)
  assert.equal(ballEntryPresentation(source,w,h,3.02).orientationP,1)
  assert.equal(ballEntryPresentation(source,w,h,3.02).span,ballEntryPresentation(source,w,h,3.10).span)
})

test('forward and return reuse continuous safe progress and fixed native source metric across resize',()=>{
  const source=capture()
  for(const [w,h] of [[320,780],[390,844],[844,390],[1440,1000],[1000,900],[768,1024]]){
    let previous=0
    for(let age=1.85;age<=3.10;age+=.002){
      const f=ballEntryPresentation(source,w,h,age,native.pose)
      assert.ok(f.orientationP>=previous&&f.orientationP-previous<.03,'orientation jumps')
      if(f.orientationP>0)assert.ok(projectedFanBottom(source,w,h,age,f.orientationP)<=0,`${w}x${h}: visible rotated fan at ${age}`)
      assert.ok(f.x-f.diameter/2>=0&&f.x+f.diameter/2<=w&&f.y-f.diameter/2>=0&&f.y+f.diameter/2<=h,'full outline')
      const reverse=ballEntryPresentation(source,w,h,age,native.pose)
      assert.equal(reverse.orientationP,f.orientationP)
      previous=f.orientationP
    }
    const exit=ballEntryPresentation(source,w,h,2.5).fan.exitTime
    assert.ok(exit<=2.80,'full safe orientation must leave time to ease before impact')
    for(let p=0;p<=1;p+=.005)assert.ok(projectedFanBottom(source,w,h,exit+1e-5,p)<=0,`${w}x${h}: unsafe orientation interval ${p}`)
    for(const age of [exit-1e-6,exit,exit+1e-6])assert.ok(ballEntryPresentation(source,w,h,age).orientationP<1e-8,'orientation onset snaps')
    const firstFall=ballEntryPresentation(source,w,h,2.15)
    assert.equal(firstFall.orientationP,0,'first .3s must retain source orientation')
    const vertical=Math.max(2.6,2.6/source.aspect),layout=ballContactLayout(source,w,h)
    assert.ok(Math.abs(firstFall.fan.a-layout.scale*vertical/firstFall.span)<1e-9,'world metric must zoom')
    source.fanBasis.cardWorld.forEach((v,i)=>v.forEach((x,j)=>assert.ok(Math.abs(x-native.cardBasis[i][j])<1e-9,'source basis changed')))
  }
})

test('actual DOM paint cancels only the measured sticky ancestor origin during paused rolling resize',()=>{
  const study=readFileSync(new URL('./study.jsx',import.meta.url),'utf8'),paintSource=study.slice(study.indexOf('      function paint(age,shared){'),study.indexOf('      function resize(screenWidth,screenHeight){'))
  const source=capture(),fanParentOrigin={x:0,y:0}
  for(const record of [...native.paused].sort((a,b)=>(b.viewport.width===844)-(a.viewport.width===844))){
    let parent={...record.parentOrigin},reads=0
    const fanParent={getBoundingClientRect(){reads++;return parent}},fanLeft=160,fanTop=421.2,fan={style:{}},dialog={dataset:{},style:{setProperty(){}}}
    const context={fan,fanParent,fanParentOrigin,fanLeft,fanTop,previousFanTransform:'translate(-50%,-50%)',sourceFrame:source,host:{dataset:{runtime:'webgl'}},dialog,card:native.card,staticSteps:{style:{}},surface:{querySelector:()=>({style:{},dataset:{}})},ballEntryPresentation,ballContactLayout,ballEase,edgeTime:1.85,edgeY:602.36,BALL_DURATION:3.55,innerWidth:record.viewport.width,innerHeight:record.viewport.height}
    const paint=new Function(...Object.keys(context),`${paintSource};return paint`)(...Object.values(context))
    const expected=ballEntryPresentation(source,context.innerWidth,context.innerHeight,record.age),capturedCorner=native.card.cornerScreen
    for(const offset of [record.parentOrigin,{x:17,y:-93},record.parentOrigin]){
      parent=offset;paint(record.age)
      const [a,b,c,d,x,y]=fan.style.transform.match(/^matrix\(([^)]+)\)/)[1].split(',').map(Number)
      const local={x:capturedCorner.x-fanLeft,y:capturedCorner.y-fanTop}
      const actual={x:parent.x+fanLeft+a*local.x+c*local.y+x,y:parent.y+fanTop+b*local.x+d*local.y+y}
      const f=expected.fan,projected={x:f.a*capturedCorner.x+f.c*capturedCorner.y+f.x,y:f.b*capturedCorner.x+f.d*capturedCorner.y+f.y}
      assert.ok(Math.hypot(actual.x-projected.x,actual.y-projected.y)<.02,`ancestor displaced actual corner by ${actual.y-projected.y}px`)
      assert.deepEqual(JSON.parse(dialog.dataset.fanFrame),JSON.parse(JSON.stringify(f)),'screen/world frame must stay unchanged')
    }
    assert.equal(reads,3,'ancestor origin must be measured every paint')
    assert.ok(Math.abs(record.corner.y+record.parentOrigin.y*-1-(record.cardAffine.y+record.cardAffine.d*native.card.height))<.02,'fixture retains native 190px defect')
  }
})
