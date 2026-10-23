export function revealStep(amount,target,dt){return amount+(Math.max(0,Math.min(1,target))-amount)*(1-Math.exp(-8*Math.max(0,Math.min(.05,dt))))}
