export function strapGeometry(T){
  const shape=new T.Shape()
  shape.absellipse(0,-1.15,2.35,1.16,0,Math.PI*2,false,0)
  const hole=new T.Path()
  hole.absellipse(0,-1.15,2.21,1.02,0,Math.PI*2,true,0)
  shape.holes.push(hole)
  const g=new T.ExtrudeGeometry(shape,{depth:1.08,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:3,curveSegments:96})
  // Shape axes become y/z; the extrusion becomes the strap's width along x.
  g.applyMatrix4(new T.Matrix4().set(0,0,1,-.54,1,0,0,0,0,1,0,0,0,0,0,1))
  return g
}

export function strapPoint(angle,x=0){return {x,y:2.365*Math.cos(angle),z:-1.15+1.175*Math.sin(angle)}}
export function faceProximity(x,y){
  const t=Math.max(0,Math.min(1,(1.75-Math.hypot(x,y))/.55))
  return t*t*(3-2*t)
}
export function revealStep(amount,target,dt){return amount+(Math.max(0,Math.min(1,target))-amount)*(1-Math.exp(-8*Math.max(0,Math.min(.05,dt))))}
