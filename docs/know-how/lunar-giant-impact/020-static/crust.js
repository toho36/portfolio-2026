import {PLANET,MOON,PLANET_RADIUS,MOON_RADIUS} from './geometry.js'
import {streamStations,surfaceField as baselineField} from './baseline-volume.js'

export const HEAT_SIZE=[160,160,64]
export const HEAT_MIN=[-1.45,-4.55,0]
export const HEAT_SPAN=[8.85,7.6,3.5]

const clamp=x=>Math.max(0,Math.min(1,x))
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)}
const mix=(a,b,t)=>a+(b-a)*t
// Width changes are authored openings and intact rock bridges, not emissive stripes.
const planetPaths=[
  [[1.45,.85,.26],[1.64,.53,.32],[1.82,.22,.19],[1.96,.04,.28],[1.94,-.25,.07],[2.00,-.48,.16],[2.30,-.78,.29],[2.39,-1.05,.20],[2.28,-1.30,.045],[2.48,-1.55,.16],[2.78,-1.91,.018]],
  [[1.90,.11,.18],[2.30,.28,.12],[2.60,.40,.025],[2.83,.39,.11],[3.30,.27,.012]],
  [[2.31,-.80,.15],[2.72,-.97,.025],[3.00,-1.10,.13],[3.49,-1.45,.015]],
  [[2.36,-1.15,.10],[1.91,-1.47,.14],[1.72,-1.73,.025],[1.73,-2.11,.08],[1.94,-2.35,.012]],
  [[2.44,1.68,.012],[2.79,1.28,.14],[3.13,1.20,.035],[3.44,1.03,.18],[3.91,.55,.02]],
  [[3.00,-2.75,.012],[3.27,-2.45,.09],[3.54,-2.34,.025],[3.86,-2.42,.12],[4.25,-2.65,.014]],
  [[3.43,1.01,.10],[3.74,.46,.06],[3.62,.03,.15],[3.78,-.33,.025],[4.30,-.51,.10],[4.71,-.93,.012]],
  [[3.63,.03,.09],[3.13,-.12,.04],[2.93,-.43,.065],[3.05,-.72,.012]],
]
const plates=[
  {rim:[[1.91,-.26],[2.24,-.17],[2.63,.16],[3.04,.10],[3.21,-.21],[2.98,-.58],[2.70,-.79],[2.31,-.60],[2.11,-.49],[1.87,-.38]],tilt:[.45,-.35],height:3.10},
  {rim:[[2.57,-1.08],[2.90,-1.01],[3.20,-1.20],[3.29,-1.55],[2.98,-1.80],[2.70,-1.61],[2.51,-1.35]],tilt:[.28,-.20],height:3.27},
  {rim:[[2.98,1.34],[3.37,1.42],[3.76,1.10],[3.87,.80],[3.44,.81],[3.11,1.01]],tilt:[.13,-.10],height:2.77},
]
const moonPlates=[
  {rim:[[-.95,2.11],[-.83,2.34],[-.68,2.33],[-.57,2.13],[-.65,2.00],[-.84,1.98]],tilt:[.30,-.24],height:1.40},
  {rim:[[-1.14,2.31],[-1.03,2.50],[-.89,2.49],[-.91,2.33],[-1.02,2.24]],tilt:[.20,-.15],height:1.24},
]
const streamPlates=[
  {rim:[[-.69,2.11],[-.48,2.05],[-.30,2.00],[-.12,1.94],[.05,1.86],[.24,1.78],[.40,1.72],[.64,1.60],[.59,1.53],[.48,1.56],[.34,1.57],[.22,1.70],[.09,1.73],[-.04,1.79],[-.21,1.82],[-.32,1.95],[-.50,1.90],[-.65,1.99]],tilt:[.16,-.10],height:1.33},
]
export function plateProfile(x,y,moon=false){
  let top=0,cover=0
  for(const {rim,tilt,height} of moon==='stream'?streamPlates:moon?moonPlates:plates){
    let inside=false,distance=Infinity
    for(let i=0,j=rim.length-1;i<rim.length;j=i++){
      const a=rim[j],b=rim[i],dx=b[0]-a[0],dy=b[1]-a[1]
      if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside
      const t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy))
      distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy))
    }
    const mask=smooth(-.035,.055,inside?distance:-distance)
    if(mask>cover){top=height+(x-rim[0][0])*tilt[0]+(y-rim[0][1])*tilt[1];cover=mask}
  }
  return {top,cover}
}
const moonPaths=[
  [[-.43,1.94,.23],[-.56,2.09,.20],[-.57,2.29,.08],[-.70,2.48,.11],[-.87,2.61,.018]],
  [[-.57,2.08,.12],[-.88,2.04,.11],[-1.15,2.16,.035]],
  [[-1.14,2.29,.022],[-1.03,2.48,.07],[-.82,2.51,.014]],
  [[-.91,1.72,.012],[-.77,1.86,.055],[-.55,1.96,.07]],
]

function curve(paths){
  return paths.flatMap((path,pathId)=>path.slice(1).flatMap((b,i)=>{
    const a=path[i],before=path[Math.max(0,i-1)],after=path[Math.min(path.length-1,i+2)]
    return Array.from({length:8},(_,j)=>{
      const t=j/8,s=(j+1)/8
      const point=u=>a.map((v,k)=>k===2?mix(v,b[k],smooth(0,1,u)):.5*((2*v)+(-before[k]+b[k])*u+(2*before[k]-5*v+4*b[k]-after[k])*u*u+(-before[k]+3*v-3*b[k]+after[k])*u*u*u))
      return {a:point(t),b:point(s),pathId}
    })
  }))
}
const planetCuts=curve(planetPaths),moonCuts=curve(moonPaths),knots=streamStations()

function fractures(point,segments,depth){
  let deepest=0,heat=0
  for(const {a,b,pathId} of segments){
    const dx=b[0]-a[0],dy=b[1]-a[1]
    const t=clamp(((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy))
    const width=mix(a[2],b[2],t)
    const across=((point[0]-a[0])*dy-(point[1]-a[1])*dx)/Math.hypot(dx,dy)
    const distance=Math.hypot(point[0]-a[0]-dx*t,point[1]-a[1]-dy*t)
    const edge=width*(1+.12*Math.sin(point[0]*9+point[1]*7+pathId))
    const opening=1-smooth(.18,1,distance/edge)
    const localDepth=depth*opening*clamp(width/.18)
    const shelf=1-smooth(.35,.85,Math.abs(across)/edge)
    const temperature=.40+.30*smooth(-.8,.8,Math.sin(point[0]*5.1+point[1]*3.7+pathId*2.3))
    if(localDepth>deepest){deepest=localDepth;heat=shelf*temperature*smooth(.035,.12,width)}
  }
  return {depth:deepest,heat}
}

export function crustRelief(x,y,z){
  const point=[x,y,z]
  let cut={depth:0,heat:0}
  for(const [center,radius,segments,depth] of [[PLANET,PLANET_RADIUS,planetCuts,.22],[MOON,MOON_RADIUS,moonCuts,.085]]){
    const delta=point.map((value,i)=>value-center[i]),distance=Math.hypot(...delta)
    if(distance>0&&Math.abs(distance-radius)<.55&&delta[2]>0){
      const projected=delta.map((value,i)=>center[i]+value*radius/distance)
      const sample=fractures(projected,segments,depth)
      const offset=center===PLANET?baselineField(...projected,false):0
      const floor=center===MOON?1:sample.depth>0?smooth(.30,.84,(radius+offset-distance)/sample.depth):0
      sample.heat*=floor
      if(sample.depth>cut.depth)cut=sample
    }
  }
  if(x>-.85&&x<2.1&&y>.20&&y<2.5&&z>.65&&z<2.10){
    let nearest=null,best=Infinity
    for(let i=1;i<knots.length;i++){
      const a=knots[i-1],b=knots[i],dx=b.center[0]-a.center[0],dy=b.center[1]-a.center[1]
      const t=clamp(((x-a.center[0])*dx+(y-a.center[1])*dy)/(dx*dx+dy*dy))
      const center=a.center.map((v,k)=>mix(v,b.center[k],t))
      const metric=Math.hypot(x-center[0],y-center[1])
      if(metric<best){best=metric;nearest={u:mix(a.u,b.u,t),center,normalRadius:mix(a.normalRadius,b.normalRadius,t),depthRadius:mix(a.depthRadius,b.depthRadius,t),across:((x-center[0])*-dy+(y-center[1])*dx)/Math.hypot(dx,dy)}}
    }
    const {u,center,across,normalRadius,depthRadius}=nearest
    const front=smooth(-.03,.08,z-center[2])
    const patch=.55+.18*Math.sin(u*17+across*13)+.15*Math.sin(u*31-across*7)
    const opening=(1-smooth(.44,.95,Math.abs(across/normalRadius+.18*Math.sin(u*9))))*front
    const bridge=1-.84*Math.exp(-(((u-.49)/.045)**2))*smooth(-.2,.5,across/normalRadius)
    const depth=Math.min(.065,depthRadius*.32)*opening*bridge
    const weight=smooth(-.85,-.45,x)*(1-smooth(1.30,1.95,x))*(1-smooth(1.8,2.1,z))
    cut={depth:mix(cut.depth,depth,weight),heat:mix(cut.heat,opening*bridge*patch,weight)}
  }
  const radius=Math.hypot(x-PLANET[0],y-PLANET[1],z-PLANET[2])
  if(Math.abs(radius-PLANET_RADIUS)<.45&&z>1.8){
    const {cover}=plateProfile(x,y)
    cut={depth:cut.depth*(1-cover),heat:cut.heat*(1-cover)}
  }
  if(x<- .35&&y>1.7&&z>1.1){
    const {cover}=plateProfile(x,y,true)
    cut={depth:cut.depth*(1-cover),heat:cut.heat*(1-cover)}
  }
  if(x<.65&&y>1.4&&z>1.05){
    const {cover}=plateProfile(x,y,'stream')
    cut={depth:cut.depth*(1-cover),heat:cut.heat*(1-cover)}
  }
  return cut
}
