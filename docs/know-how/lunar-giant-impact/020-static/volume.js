import {BufferGeometry,Float32BufferAttribute,MeshBasicMaterial} from 'three'
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js'
import {PLANET,PLANET_RADIUS,MOON,MOON_RADIUS} from './geometry.js'
import {surfaceField as baselineField,streamStations} from './baseline-volume.js'
import {crustRelief,plateProfile} from './crust.js'
export {streamStations} from './baseline-volume.js'

const DOMAIN=[3.0,-.8,0],HALF=4.65
const clamp=x=>Math.max(0,Math.min(1,x))
const mix=(a,b,t)=>a+(b-a)*t
function smoothUnion(a,b,k){const h=clamp(.5+.5*(b-a)/k);return mix(a,b,h)+k*h*(1-h)}
const knots=streamStations()

function refineMoon(positions,normals,uv){
  const vertices=new Map(),faces=[],edges=new Map()
  const key=p=>p.map(v=>Math.round(v*10000)).join(',')
  const edgeKey=(a,b)=>a.id<b.id?`${a.id}|${b.id}`:`${b.id}|${a.id}`
  for(let i=0;i<positions.length;i+=9){
    const face=[]
    for(let j=0;j<3;j++){
      const index=i/3+j,p=Array.from(positions.subarray(index*3,index*3+3)),id=key(p)
      if(!vertices.has(id))vertices.set(id,{id,p,n:Array.from(normals.subarray(index*3,index*3+3)),uv:Array.from(uv.subarray(index*2,index*2+2))})
      face.push(vertices.get(id))
    }
    faces.push(face)
    if(face.some(v=>v.p[0]+PLANET[0]<.65&&v.p[1]+PLANET[1]>1.4&&v.p[2]>1.0)){
      for(let j=0;j<3;j++)edges.set(edgeKey(face[j],face[(j+1)%3]),[face[j],face[(j+1)%3]])
    }
  }
  const gradient=p=>p.map((_,i)=>{
    const a=p.slice(),b=p.slice();a[i]+=.004;b[i]-=.004
    return (surfaceField(...a)-surfaceField(...b))/.008
  })
  for(const [id,[a,b]] of edges){
    let p=a.p.map((v,i)=>(v+b.p[i])/2+PLANET[i])
    for(let i=0;i<5;i++){
      const value=surfaceField(...p),g=gradient(p),length=g.reduce((sum,v)=>sum+v*v,0)
      if(length<.001)break
      const step=Math.max(-.04,Math.min(.04,value/length))
      p=p.map((v,j)=>v-step*g[j])
    }
    const n=gradient(p),length=Math.hypot(...n),local=p.map((v,i)=>v-PLANET[i])
    edges.set(id,{id,p:local,n:n.map(v=>-v/length),uv:[.5+Math.atan2(local[2],local[0])/(Math.PI*2),.5+Math.asin(clamp((local[1]/Math.hypot(...local)+1)/2)*2-1)/Math.PI]})
  }
  const refined=[]
  for(const face of faces){
    let [a,b,c]=face,[ab,bc,ca]=[edges.get(edgeKey(a,b)),edges.get(edgeKey(b,c)),edges.get(edgeKey(c,a))]
    const count=Number(!!ab)+Number(!!bc)+Number(!!ca)
    if(count===3)refined.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca])
    else if(count===0)refined.push(face)
    else{
      while(!ab||(count===2&&!bc)){
        [a,b,c]=[b,c,a];[ab,bc,ca]=[bc,ca,ab]
      }
      if(count===1)refined.push([a,ab,c],[ab,b,c])
      else refined.push([b,bc,ab],[a,ab,c],[ab,bc,c])
    }
  }
  if(refined.length>75000)throw new RangeError('Local Moon refinement exceeded original render budget')
  const p=[],n=[],u=[]
  for(const face of refined)for(const v of face){p.push(...v.p);n.push(...v.n);u.push(...v.uv)}
  return {positions:p,normals:n,uv:u}
}

export function surfaceField(x,y,z,joined=true){
  if(!joined)return baselineField(x,y,z,false)
  const dx=x-PLANET[0],dy=y-PLANET[1],dz=z-PLANET[2],radius=Math.hypot(dx,dy,dz)
  const scale=radius>0?PLANET_RADIUS/radius:0
  const offset=radius>0?baselineField(PLANET[0]+dx*scale,PLANET[1]+dy*scale,PLANET[2]+dz*scale,false):0
  let body=PLANET_RADIUS-radius+offset
  if(z>1.8&&Math.abs(body)<.6){
    const {top,cover}=plateProfile(x,y)
    body=mix(body,top-z,cover)
  }
  if(x>-1&&x<2.8&&y>-.2&&y<2.4&&z>.55&&z<1.85){
    let stream=-10
    for(const knot of knots){
      const sx=x-knot.center[0],sy=y-knot.center[1],sz=z-knot.center[2]
      const along=sx*knot.tangent[0]+sy*knot.tangent[1],across=-sx*knot.tangent[1]+sy*knot.tangent[0]
      const distance=(1-Math.sqrt((along/.24)**2+(across/knot.normalRadius)**2+(sz/knot.depthRadius)**2))*Math.min(.24,knot.normalRadius,knot.depthRadius)
      stream=smoothUnion(stream,distance,.09)
    }
    body=smoothUnion(body,stream,.12)
  }
  let moon=MOON_RADIUS-Math.hypot(x-MOON[0],y-MOON[1],z-MOON[2])
  if(z>1.1&&Math.abs(moon)<.35){
    const {top,cover}=plateProfile(x,y,true)
    moon=mix(moon,top-z,cover)
  }
  const joinedBody=smoothUnion(body,moon,.16)
  let profiled=joinedBody
  if(x<.65&&y>1.4&&z>1.05&&Math.abs(joinedBody)<.3){
    const {top,cover}=plateProfile(x,y,'stream')
    profiled=mix(joinedBody,top-z,cover)
  }
  return Math.abs(profiled)<.45?profiled-crustRelief(x,y,z).depth:profiled
}

export function createVolumeGeometry({resolution=112,joined=true}={}){
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
    const refined=joined?refineMoon(cleanPositions,cleanNormals,cleanUvs):{positions:cleanPositions,normals:cleanNormals,uv:cleanUvs}
    geometry.setAttribute('position',new Float32BufferAttribute(refined.positions,3));geometry.setAttribute('normal',new Float32BufferAttribute(refined.normals,3));geometry.setAttribute('uv',new Float32BufferAttribute(refined.uv,2))

    geometry.computeBoundingSphere()
    return geometry
  }finally{effect.geometry.dispose();material.dispose()}
}
