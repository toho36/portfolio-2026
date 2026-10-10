const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo))
export function deckPosition(scroll, step) { return clamp(scroll / (step > 0 ? step : 1), 0, 2) }
export function settleSheet(position,direction){
  const p=clamp(position,0,2),low=Math.floor(p),fraction=p-low
  if(fraction<.001)return low
  return clamp(direction>0?(fraction>.18?low+1:low):direction<0?(fraction<.82?low:low+1):Math.round(p),0,2)
}
export function settleEase(progress){const p=clamp(progress,0,1);return p*p*p*(p*(p*6-15)+10)}
export function coastPosition(from,target,velocity,elapsed){
  const distance=target-from,speed=Math.abs(velocity)
  if(!distance||!speed||Math.sign(distance)!==Math.sign(velocity))return from
  const travel=Math.abs(distance),t=Math.max(0,elapsed)
  if(speed<=45*travel/(32*480)){
    const duration=Math.min(1500,45*travel/(32*speed)),u=Math.min(1,t/duration)
    if(u===1)return target
    // Preserve initial velocity and zero initial acceleration. A light gesture needs
    // one smooth speed hump to cover the remaining distance in a bounded time.
    const extra=Math.max(0,30*(travel/duration-speed*32/45))
    return from+Math.sign(distance)*duration*(speed*(u-2*u**5/5+u**9/9)+extra*(u**3/3-u**4/2+u**5/5))
  }
  // Two decreasing velocity terms: their initial sum is speed, their total travel is distance.
  const fast=Math.min(45,travel/speed/2),slow=Math.max(180,travel/speed)
  const tail=(travel-speed*fast)/(slow-fast),head=speed-tail
  return target-Math.sign(distance)*(head*fast*Math.pow(Math.max(0,1-t/(3*fast)),3)+tail*slow*Math.pow(Math.max(0,1-t/(3*slow)),3))
}
export function sheetPose(index, position) {
  const d = index - clamp(position, 0, 2)
  const behind = Math.max(0, d), leaving = Math.min(0, d)
  return { x: behind * .115 + leaving * 1.18, y: -behind * .078 + leaving * .10,
    rotation: -5 + behind * 11 + leaving * 16, scale: 1 - Math.min(behind, 2) * .075,
    opacity: Math.max(0, 1 + Math.min(0, d + .85) * 3), z: 3 - index }
}
