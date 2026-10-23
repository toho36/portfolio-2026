import {BufferGeometry,Float32BufferAttribute,MeshBasicMaterial} from 'three'
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js'
import {PLANET,PLANET_RADIUS} from './geometry.js'

const DOMAIN=[3.15,-.8,0],HALF=4.5
const clamp=x=>Math.max(0,Math.min(1,x))
const mix=(a,b,t)=>a+(b-a)*t
const hash=(x,y,z)=>{
  let n=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(z,1274126177)
  n=Math.imul(n^(n>>>13),1274126177)
  return ((n^(n>>>16))>>>0)/4294967295
}
function noise(x,y,z){
  const a=Math.floor(x),b=Math.floor(y),c=Math.floor(z)
  x-=a;y-=b;z-=c;x=x*x*(3-2*x);y=y*y*(3-2*y);z=z*z*(3-2*z)
  return mix(mix(mix(hash(a,b,c),hash(a+1,b,c),x),mix(hash(a,b+1,c),hash(a+1,b+1,c),x),y),mix(mix(hash(a,b,c+1),hash(a+1,b,c+1),x),mix(hash(a,b+1,c+1),hash(a+1,b+1,c+1),x),y),z)
}
function smoothUnion(a,b,k){const h=clamp(.5+.5*(b-a)/k);return mix(a,b,h)+k*h*(1-h)}

export function streamStations(){
  return Array.from({length:19},(_,i)=>{
    const u=i/18,v=1-u
    const center=[v*v*2.05+2*v*u*.50+u*u*(-.43),v*v*.65+2*v*u*1.58+u*u*1.90,v*v*1.30+2*v*u*1.33+u*u*1.04]
    const dx=2*v*(.50-2.05)+2*u*(-.43-.50),dy=2*v*(1.58-.65)+2*u*(1.90-1.58),length=Math.hypot(dx,dy)
    return {u,center,tangent:[dx/length,dy/length],normalRadius:(.48*v**1.5+.13)*(1+.10*Math.sin(u*16)),depthRadius:.23*v**1.4+.105}
  })
}
const knots=streamStations()
export function surfaceField(x,y,z,joined=true){
  const radial=Math.hypot(x-PLANET[0],y-PLANET[1],z-PLANET[2])
  let body=PLANET_RADIUS-radial
  if(Math.abs(body)<.22){
    const macro=noise(x*.53+7,y*.53-2,z*.53+3),fault=Math.abs(noise(x*.78,y*.78+4,z*.78-3)-.48)
    const trench=.07*(1-clamp(fault/.055))
    body+=.09*(macro-.5)-trench
  }
  if(!joined||x<-1||x>2.8||y<-.2||y>2.4||z<.55||z>1.85)return body
  let stream=-10
  for(const knot of knots){
    const dx=x-knot.center[0],dy=y-knot.center[1],dz=z-knot.center[2]
    const along=dx*knot.tangent[0]+dy*knot.tangent[1],across=-dx*knot.tangent[1]+dy*knot.tangent[0]
    const radius=knot.normalRadius,depth=knot.depthRadius
    const distance=(1-Math.sqrt((along/.24)**2+(across/radius)**2+(dz/depth)**2))*Math.min(.24,radius,depth)
    stream=smoothUnion(stream,distance,.09)
  }
  return smoothUnion(body,stream,.12)
}

export function createVolumeGeometry({resolution=104,joined=true}={}){
  if(!Number.isInteger(resolution)||resolution<32||resolution>128)throw new RangeError('Unsupported extraction resolution')
  const material=new MeshBasicMaterial(),effect=new MarchingCubes(resolution,material,false,false,80000)
  effect.isolation=0
  try{
    const step=2*HALF/resolution
    for(let z=0;z<resolution;z++)for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
      const point=[DOMAIN[0]-HALF+x*step,DOMAIN[1]-HALF+y*step,DOMAIN[2]-HALF+z*step]
      effect.field[(z*resolution+y)*resolution+x]=surfaceField(...point,joined)
    }
    effect.update()
    if(effect.count>240000)throw new RangeError('Extraction exceeded its fixed buffer')
    const positions=new Float32Array(effect.count*3),normals=effect.normalArray.slice(0,effect.count*3),uv=new Float32Array(effect.count*2)
    for(let i=0;i<effect.count;i++){
      const x=effect.positionArray[i*3]*HALF+DOMAIN[0]-PLANET[0],y=effect.positionArray[i*3+1]*HALF+DOMAIN[1]-PLANET[1],z=effect.positionArray[i*3+2]*HALF+DOMAIN[2]-PLANET[2]
      positions.set([x,y,z],i*3)
      uv.set([.5+Math.atan2(z,x)/(Math.PI*2),.5+Math.asin(Math.max(-1,Math.min(1,y/Math.hypot(x,y,z))))/Math.PI],i*2)
    }
    const welded=new Map(),vertexIds=[]
    for(let i=0;i<effect.count;i++){
      const key=[positions[i*3],positions[i*3+1],positions[i*3+2]].map(value=>Math.round(value*10000)).join(',')
      if(!welded.has(key))welded.set(key,i)
      vertexIds.push(welded.get(key))
    }
    const retained=[]
    for(let i=0;i<effect.count;i+=3){
      const a=vertexIds[i],b=vertexIds[i+1],c=vertexIds[i+2]
      if(a!==b&&b!==c&&a!==c)retained.push(a,b,c)
    }
    const cleanPositions=new Float32Array(retained.length*3),cleanNormals=new Float32Array(retained.length*3),cleanUvs=new Float32Array(retained.length*2)
    for(let i=0;i<retained.length;i++){
      const id=retained[i]
      cleanPositions.set(positions.subarray(id*3,id*3+3),i*3);cleanNormals.set(normals.subarray(id*3,id*3+3),i*3);cleanUvs.set(uv.subarray(id*2,id*2+2),i*2)
    }
    const geometry=new BufferGeometry()
    geometry.setAttribute('position',new Float32BufferAttribute(cleanPositions,3));geometry.setAttribute('normal',new Float32BufferAttribute(cleanNormals,3));geometry.setAttribute('uv',new Float32BufferAttribute(cleanUvs,2))
    geometry.computeBoundingSphere()
    return geometry
  }finally{effect.geometry.dispose();material.dispose()}
}
