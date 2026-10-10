export function createSpin(){return {yaw:.48,pitch:.32,yawSpeed:.16,pitchSpeed:0}}
export function followPosition(value,target,seconds,following){
  const dt=Number.isFinite(seconds)?Math.max(0,seconds):0
  return target+(value-target)*Math.exp(-(following?12:1.6)*dt)
}
export function kickSpin(s,dx,dy,seconds,fraction=1){
  if(!Number.isFinite(seconds)||seconds<=0)return s
  const limit=n=>Math.max(-8,Math.min(8,n)),contact=Math.max(0,Math.min(1,fraction))
  const gain=.25+.12*Math.min(12,Math.hypot(dx,dy)/seconds)
  return {...s,yawSpeed:limit(s.yawSpeed+dx*gain*contact),pitchSpeed:limit(s.pitchSpeed+dy*gain*contact)}
}
export function brushSpin(s,from,to,center,radius){
  const dx=to.x-from.x,dy=to.y-from.y,fx=from.x-center.x,fy=from.y-center.y,a=dx*dx+dy*dy
  if(!(radius>0)||a===0)return s
  const b=2*(fx*dx+fy*dy),c=fx*fx+fy*fy-radius*radius,discriminant=b*b-4*a*c
  if(discriminant<=0)return s
  const root=Math.sqrt(discriminant),start=Math.max(0,(-b-root)/(2*a)),end=Math.min(1,(-b+root)/(2*a))
  if(end<=start)return s
  return kickSpin(s,dx/radius,dy/radius,(to.time-from.time)/1000,end-start)
}
export function stepSpin(s,seconds){
  const dt=Math.max(0,Math.min(.1,seconds)),drag=1.1,decay=Math.exp(-drag*dt),travel=(1-decay)/drag
  const next={...s,yaw:s.yaw+.16*dt+(s.yawSpeed-.16)*travel,pitch:s.pitch+s.pitchSpeed*travel,yawSpeed:.16+(s.yawSpeed-.16)*decay,pitchSpeed:s.pitchSpeed*decay}
  if(s.handoff){
    const speed=Math.hypot(...s.handoff.velocity),angle=speed*travel/2,k=speed?Math.sin(angle)/speed:0
    next.handoff={quaternion:ballQuaternionMultiply([...s.handoff.velocity.map(v=>v*k),Math.cos(angle)],s.handoff.quaternion),velocity:s.handoff.velocity.map(v=>v*decay)}
  }
  return next
}
export function ballQuaternionMultiply(a,b){
  const [x,y,z,w]=a,[X,Y,Z,W]=b
  return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z]
}
export function ballMotion(time,x,y,spin) {
  return {position:[x*.36+Math.sin(time*.65)*.07,y*-.2+Math.sin(time*.9)*.045,0],
    rotation:[(spin?.pitch??.32)+Math.sin(time*.55)*.055,spin?.yaw??(.48+time*.16),-.16+Math.sin(time*.7)*.065]}
}
