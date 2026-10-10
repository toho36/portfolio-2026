import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from 'three'
import { strapGeometry, strapPoint, faceProximity, revealStep } from './watchModel.js'

test('leather is one beveled closed oval with a hollow centre and real thickness',()=>{
  const g=strapGeometry(T)
  g.computeBoundingBox()
  const {min,max}=g.boundingBox
  assert.ok(max.x-min.x>1&&max.x-min.x<1.3)
  assert.ok(max.y-min.y>4.5&&max.y-min.y<5)
  assert.ok(max.z-min.z>2.2&&max.z<=.06)
  assert.ok(g.parameters.options.bevelEnabled&&g.parameters.options.bevelSegments>=3)
  assert.equal(g.parameters.shapes.holes.length,1)
  const vertices=g.getAttribute('position')
  for(let i=0;i<vertices.count;i++){
    const y=vertices.getY(i),z=vertices.getZ(i)+1.15
    assert.ok((y/2.1)**2+(z/.95)**2>1,'no leather filling the empty wrist space')
  }
  const a=strapPoint(0),b=strapPoint(Math.PI*2)
  assert.ok(Math.hypot(a.y-b.y,a.z-b.z)<1e-10,'stitched seam closes')
  for(const sign of [-1,1]){
    const p=strapPoint(Math.acos(sign*1.53/2.35))
    assert.ok(Math.abs(p.z+.26)<.04,'front band meets the lug pin')
  }
  g.dispose()
})

test('face proximity is local, bounded, and reveal reverses from its current progress',()=>{
  assert.equal(faceProximity(0,0),1)
  assert.equal(faceProximity(2,0),0)
  assert.equal(faceProximity(0,2),0)
  assert.ok(faceProximity(1.4,0)>0&&faceProximity(1.4,0)<1)
  let amount=0
  for(let i=0;i<10;i++)amount=revealStep(amount,1,1/60)
  const open=amount
  amount=revealStep(amount,0,1/60)
  assert.ok(amount<open&&amount>0,'leave must not snap closed')
  const closing=amount
  amount=revealStep(amount,1,1/60)
  assert.ok(amount>closing&&amount<open+.1,'reenter must not restart')
  assert.equal(revealStep(amount,1,0),amount)
  for(let i=0;i<300;i++)amount=revealStep(amount,0,1/60)
  assert.ok(amount<1e-8)
})
