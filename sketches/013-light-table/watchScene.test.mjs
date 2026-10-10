import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from 'three'
import { createWatch } from './watchScene.js'

// Actual Three geometry/camera/materials, with only the GPU and leather canvas
// stubbed. Native pixels and DOM pointer/lifecycle proof belong to watch-reveal.py.
test('assembled scene lifts only its lid, projects within each host and disposes every owned resource once',()=>{
  const resources=new Set(),disposed=new Map()
  let renderer,renderers=0
  class Renderer {
    constructor(){renderers++;renderer=this;this.info={render:{triangles:0}};this.domElement={setAttribute(){},remove(){this.removed=true},toDataURL:()=> 'native-capture-stub'};this.disposed=0;this.lost=0;this.sizeCalls=0}
    setClearColor(){} setPixelRatio(){} setSize(w,h){this.sizeCalls++;this.size=[w,h]}
    render(scene,camera){
      scene.updateMatrixWorld(true);camera.updateMatrixWorld(true)
      scene.traverse(o=>{if(!o.isMesh)return;for(const r of [o.geometry,o.material,o.material.map,o.material.bumpMap])if(r&&!resources.has(r)){resources.add(r);disposed.set(r,0);r.addEventListener('dispose',()=>disposed.set(r,disposed.get(r)+1))}})
    }
    dispose(){this.disposed++} forceContextLoss(){this.lost++}
  }
  const ctx={fillRect(){},beginPath(){},ellipse(){},fill(){},drawImage(){},createRadialGradient:()=>({addColorStop(){}})}
  const host={clientWidth:595,clientHeight:496,dataset:{},append(){},ownerDocument:{createElement:()=>({getContext:()=>ctx})}}
  const previous=Object.getOwnPropertyDescriptor(globalThis,'devicePixelRatio')
  Object.defineProperty(globalThis,'devicePixelRatio',{value:1,configurable:true})
  let view
  try{
    const surface={clientWidth:595,clientHeight:496,append(canvas){this.canvas=canvas},slot:'table'}
    host.append=()=>{throw new Error('renderer must mount only in its owned presentation')}
    view=createWatch({...T,WebGLRenderer:Renderer},host,surface)
    const canvas=surface.canvas
    view.paint(7,.6);const pose=view.geometry()
    for(const slot of ['entering','open','leaving','table','entering','table']){
      surface.slot=slot;view.resize();view.paint(7,.6)
      assert.equal(surface.canvas,canvas);assert.equal(renderers,1)
      assert.equal(renderer.sizeCalls,1,'moving slots must not clear the framebuffer through setSize')
      assert.equal(host.dataset.time,'7.000');assert.equal(host.dataset.openAmount,'0.6000');assert.deepEqual(view.pose,{time:7,open:.6})
      assert.deepEqual(view.geometry(),pose,'moving a presentation must not reset its scene')
    }
    for(const [w,h] of [[595,496],[246,271],[202,223],[700,700]]){
      surface.clientWidth=w;surface.clientHeight=h;view.resize();view.paint(2,0)
      assert.deepEqual(renderer.size,[w,h])
      const closed=view.geometry(),p=view.faceProjection()
      assert.ok(view.proximity(p.x,p.y)>.999)
      assert.equal(view.proximity(-100,-100),0)
      view.paint(2,1);const open=view.geometry()
      assert.equal(open.bezelLift,.38)
      assert.ok(Math.abs(open.glassZ-closed.glassZ-.46)<1e-9)
      assert.deepEqual(open.strap,closed.strap)
      assert.deepEqual(open.rotation,closed.rotation)
      assert.equal(open.balanceSpokes,3)
      view.paint(2.1,1);assert.notEqual(view.geometry().balanceAngle,open.balanceAngle,'balance detail must visibly oscillate')
      for(const b of [closed.projectedBounds,open.projectedBounds])assert.ok(Object.values(b).every(v=>Math.abs(v)<.99),JSON.stringify({w,h,b}))
      view.snapshot(0);assert.equal(view.geometry().bezelLift,.38,'capture must restore current progress')
    }
    view.destroy();view.destroy()
    assert.ok(resources.size>100)
    assert.ok([...disposed.values()].every(n=>n===1),'leaked or double-disposed geometry/material/texture')
    assert.equal(renderer.disposed,1);assert.equal(renderer.lost,1);assert.equal(renderer.domElement.removed,true)
  }finally{view?.destroy();if(previous)Object.defineProperty(globalThis,'devicePixelRatio',previous);else delete globalThis.devicePixelRatio}
})
