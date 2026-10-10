import test from 'node:test'
import assert from 'node:assert/strict'
import { panelGeometry } from './ballGeometry.js'

test('eighteen real curved panels wrap a unit sphere with radial normals and seams', () => {
  for(let face=0;face<6;face++)for(let band=0;band<3;band++){
    const {positions,normals,uvs,indices}=panelGeometry(face,band,18)
    assert.equal(positions.length,19*19*3)
    assert.equal(uvs.length,19*19*2)
    assert.equal(indices.length,18*18*6)
    for(let i=0;i<positions.length;i+=3){
      assert.ok(Math.abs(Math.hypot(...positions.slice(i,i+3))-1)<1e-6)
      assert.deepEqual(normals.slice(i,i+3),positions.slice(i,i+3))
    }
    assert.ok(indices.every(i=>i>=0&&i<positions.length/3))
    for(let i=0;i<indices.length;i+=3){
      const a=positions.slice(indices[i]*3,indices[i]*3+3),b=positions.slice(indices[i+1]*3,indices[i+1]*3+3),c=positions.slice(indices[i+2]*3,indices[i+2]*3+3)
      const u=b.map((v,j)=>v-a[j]),v=c.map((n,j)=>n-a[j]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
      assert.ok(cross.reduce((sum,n,j)=>sum+n*a[j],0)>0,`inward winding face ${face}`)
    }
  }
})
