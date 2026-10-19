// Pure timeline for a stylized 9.5s story. Author-driven: capture, mass formation and
// time compression are art direction, NOT validated scientific physics.
import { Quaternion, Euler, Vector3 } from 'three';
import { crustAt,fbm,fragmentGeometry } from './terrain.js';
export const DUR = 9.5, TC = 2.2, RE = 3.45, RT = 1.5, RM = 0.6, RO = 5.3, GM = 14, DT = 0.05;
export const PLANET = [3.9, -1.05, 0.2];
const n0 = [-0.75, 0.48, 0.3], nl = Math.hypot(...n0);
export const N = n0.map(v => v / nl);
const add = (a, b, s = 1) => a.map((v, i) => v + b[i] * s);
const sub = (a, b) => a.map((v, i) => v - b[i]);
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const CONTACT = add(PLANET, N, RE);
const START = [-1.8, 4.2, 3.6];
const HIT = add(PLANET, N, RE + RT * 0.95); // slight overlap = real contact
export const IMPACT_TANGENT=(()=>{const v=sub(HIT,START),dot=v.reduce((sum,x,i)=>sum+x*N[i],0),t=v.map((x,i)=>x-dot*N[i]),length=Math.hypot(...t);return t.map(x=>x/length);})();
const axis=[.32,.95,0], axisLength=Math.hypot(...axis);
export const EARTH_AXIS=axis.map(v=>v/axisLength);
const smoothIntegral=(a,b,t)=>{const u=clamp((t-a)/(b-a));return (b-a)*(u**3-.5*u**4)+Math.max(0,t-b);};
function rotate(v,angle){
  const [x,y,z]=EARTH_AXIS,c=Math.cos(angle),s=Math.sin(angle),dot=v[0]*x+v[1]*y+v[2]*z;
  const cross=[y*v[2]-z*v[1],z*v[0]-x*v[2],x*v[1]-y*v[0]];
  return v.map((value,i)=>value*c+cross[i]*s+EARTH_AXIS[i]*dot*(1-c));
}
export function earthFrame(t){
  const x=Math.max(0,t-TC-.05),tau=1/(1/.18+1/1.2);
  const angle=.10*t-.04*smoothIntegral(6,DUR,t)+.52*(1.2*(1-Math.exp(-x/1.2))-tau*(1-Math.exp(-x/tau)));
  const impulse=.175*ss(0,.12,x)*(x/.44)*Math.exp(1-x/.44)+.04*ss(0,2.5,x);
  const flat=1-.02*ss(0,.14,x)*(1-ss(.35,.95,x))+.008*ss(.65,.9,x)*(1-ss(1.1,1.6,x));
  const incoming=[HIT[0]-START[0],HIT[1]-START[1],0],length=Math.hypot(...incoming);
  return {center:add(PLANET,incoming,impulse/length),axis:EARTH_AXIS,angle,flat,s:1/Math.sqrt(flat)};
}
export const N_BODY=rotate(N,-earthFrame(TC).angle);
const T_BODY=rotate(IMPACT_TANGENT,-earthFrame(TC).angle);
function strain(p,t,inverse=false){const f=earthFrame(t),s=inverse?1/f.s:f.s,flat=inverse?1/f.flat:f.flat,dot=p.reduce((sum,v,i)=>sum+v*N_BODY[i],0);return p.map((v,i)=>v*s+N_BODY[i]*dot*(flat-s));}
export const bodyToWorld=(p,t)=>add(earthFrame(t).center,rotate(strain(p,t),earthFrame(t).angle));
export const worldToBody=(p,t)=>strain(rotate(sub(p,earthFrame(t).center),-earthFrame(t).angle),t,true);
export const contactPoint=t=>bodyToWorld(N_BODY.map(v=>v*RE),t);
// crustAt is bounded by the convex noise ranges; include a tessellation margin.
export const IMPACTOR_BOUND = RT + .17 * (1 - .45) + .035 * .5;
export const IMPACTOR_INNER_BOUND=RT-.17*.45-.035*.5-.17-.02;
export const RECEIVER_INNER_BOUND = (RE - .17 * .45 - .035 * .5 - .17 - .6 - .02)*.98;
export const PROMINENT_RETURN_IDS = Object.freeze([1, 10, 19, 28, 37, 46]);
// Fracture fan: delay, radius, tangent offset, radial speed, tangent speed, depth speed.
// Mass hierarchy from a bounded deterministic sweep (polish-20261009/scratch/sweep.mjs):
// one heavy late slab, two medium, three light chips with their own diverging arcs.
const RETURN_LAUNCH = [
  [.60, .20, -.41, .76, .46, -.25],
  [.34, .07, -.17, 1.13, .46, .11],
  [.36, .12, .40, .88, 1.09, .20],
  [.58, .06, .25, 1.26, .65, -.29],
  [.11, .10, -.15, 1.21, .90, .12],
  [.72, .05, -.06, .85, .92, -.14],
];
export const isCapture = i => i % 3 === 0;
export const fragmentScaleFactor = i => PROMINENT_RETURN_IDS.includes(i) ? 1.8 : isCapture(i) && i % 9 === 0 ? 1.6 : .55;
export function fragmentProfile(i, size) {
  const rank = PROMINENT_RETURN_IDS.indexOf(i), k = rank < 0 ? i % 6 : rank;
  // Prominent returns get their own slab/shard/wedge silhouettes; the capture table is unchanged.
  const axes = rank < 0 ? [[1,.62,.76],[.64,1,.80],[.78,.54,1],[1,.84,.56],[.86,1,.72],[.58,.80,1]][k] : [[1,.46,.78],[1,.44,.40],[.66,1,.52],[.92,.74,1],[1,.62,.36],[.70,.56,1]][rank];
  const radius = size * fragmentScaleFactor(i), speed = .07 / (.15 + radius * radius);
  return { axes, spin: [speed * (k % 2 ? -.8 : .6), speed * (.3 + k * .1), speed * (k % 3 - 1) * .4] };
}

export const PHASES = [[0, 'approach'], [TC, 'contact'], [3.2, 'merge + ejecta'], [5.5, 'moon assembly (author-driven capture)'], [8.2, 'settle (art time compression)']];
export const phase = t => PHASES.filter(p => t >= p[0]).pop()[1];

export function theia(t) {
  const duration = 3.65 - TC, u = clamp((t - TC) / duration), end = add(PLANET, N, .6);
  const incoming = sub(HIT, START).map(v => 2 * v / TC);
  const fixed = HIT.map((v, i) => (2*u**3-3*u*u+1)*v + (u**3-2*u*u+u)*duration*incoming[i] + (-2*u**3+3*u*u)*end[i]);
  const baseCenter=t<TC?add(START,sub(HIT,START),(t/TC)**2):add(fixed,sub(earthFrame(t).center,PLANET));
  const flat=1-.20*ss(TC,TC+.12,t)-.06*ss(TC+.12,TC+.25,t)+.08*ss(TC+.45,3.3,t),s=1/Math.sqrt(flat);
  const shear=.16*ss(TC,TC+.25,t)*(1-ss(3.4,3.65,t));
  const trace=s*s+flat*flat*(1+shear*shear),disc=Math.sqrt((s*s-flat*flat*(1+shear*shear))**2+4*s*s*shear*shear*flat*flat);
  const sigmaMax=Math.max(s,Math.sqrt((trace+disc)/2)),sigmaMin=Math.min(s,Math.sqrt((trace-disc)/2));
  const p=add(baseCenter,IMPACT_TANGENT,shear*flat*RT);
  const buried=Math.hypot(...sub(p,earthFrame(t).center))+IMPACTOR_BOUND*sigmaMax<RECEIVER_INNER_BOUND;
  return {p,baseCenter,flat,s,shear,sigmaMax,sigmaMin,vis:buried?0:1};
}
export function theiaMatrix(t){
  const f=theia(t),matrix=new Array(16).fill(0);
  for(let row=0;row<3;row++)for(let col=0;col<3;col++)matrix[col*4+row]=(row===col?f.s:0)+(f.flat-f.s)*N[row]*N[col]+f.shear*f.flat*IMPACT_TANGENT[row]*N[col];
  matrix[12]=f.p[0];matrix[13]=f.p[1];matrix[14]=f.p[2];matrix[15]=1;return matrix;
}
export const deform = t => 0.6 * ss(TC, 2.8, t) * (1 - ss(3.8, 6, t));
export function impactDisplacement(c, t) {
  if (c <= .55 || t <= TC || t >= 6) return 0;
  const angle = Math.acos(clamp(c, -1, 1)), a = deform(t), edge = ss(.55, .60, c);
  const basin = .24 + .20 * ss(TC, 3.8, t), front = .48 + .38 * ss(TC, 4.1, t);
  return a * edge * (-Math.exp(-((angle / basin) ** 4)) + .26 * Math.exp(-(((angle - front) / .085) ** 2)));
}
export function surfaceRadius(direction, t) {
  const local=worldToBody(add(earthFrame(t).center,direction),t),length=Math.hypot(...local),body=local.map(v=>v/length),c=body.reduce((sum,value,i)=>sum+value*N_BODY[i],0);
  return (RE+crustAt(...body.map(v=>v*RE)).height*earthRelief(t)+impactDisplacement(c,t))/length;
}
export const heat = t => ss(TC, 2.5, t) * (1 - ss(5, 7.5, t));
export const wave = t => Math.max(0, t - TC) * 2.2;
export const earthModern = t => ss(6.5, 9, t);
export const earthRelief=t=>1-ss(5.9,7,t);
const orbitIntegral=t=>.19*t-.145*smoothIntegral(5.5,DUR,t);
export const moonAngle=t=>2.3325+orbitIntegral(DUR)-orbitIntegral(t);
function introMoon(t){
  const a=moonAngle(t),lift=.45+.15*(1-ss(6.5,DUR,t));
  return [RO*Math.cos(a),RO*Math.sin(a)*.60+lift,RO*Math.sin(a)*.80];
}
// Settled display loop: continue the measured incoming heading rate, speed, speed change and
// depth acceleration, then ease the turn rate into a bounded circle over SETTLE seconds.
const SETTLE=2,LOOP_RATE=.65;
const SETTLED=(()=>{
  // Second-order one-sided differences of the incoming path at DUR.
  const h=1e-3,p=[0,1,2,3].map(k=>introMoon(DUR-k*h));
  const v=p[0].map((x,k)=>(3*x-4*p[1][k]+p[2][k])/(2*h)),acc=p[0].map((x,k)=>(2*x-5*p[1][k]+4*p[2][k]-p[3][k])/(h*h)),speed=Math.hypot(v[0],v[1]);
  return {p:p[0],speed,heading:Math.atan2(v[1],v[0]),rate:(v[0]*acc[1]-v[1]*acc[0])/speed**2,speedRate:(v[0]*acc[0]+v[1]*acc[1])/speed,vz:v[2],az:acc[2]};
})();
const settledHeading=t=>SETTLED.heading+SETTLED.rate*(t-DUR)+(LOOP_RATE-SETTLED.rate)*smoothIntegral(DUR,DUR+SETTLE,t);
function settledVelocity(t){
  const phi=settledHeading(t),fade=(t-DUR)*(1-ss(DUR,DUR+SETTLE,t)),speed=SETTLED.speed+SETTLED.speedRate*fade;
  return [speed*Math.cos(phi),speed*Math.sin(phi),SETTLED.vz*Math.cos(phi-SETTLED.heading)+SETTLED.az*fade];
}
function blendOffset(t){
  // ponytail: fixed 64-step Simpson over the 2 s blend, cheap enough per call.
  const n=64,step=(t-DUR)/n,sum=[0,0,0];
  for(let i=0;i<=n;i++){const weight=i===0||i===n?1:i%2?4:2,v=settledVelocity(DUR+i*step);for(let j=0;j<3;j++)sum[j]+=weight*v[j]*step/3;}
  return sum;
}
const BLEND_END=blendOffset(DUR+SETTLE);
function settledOffset(t){
  if(t<=DUR+SETTLE)return blendOffset(t);
  const s=SETTLED.speed/LOOP_RATE,a=settledHeading(DUR+SETTLE),b=settledHeading(t),z=SETTLED.vz/LOOP_RATE;
  return [BLEND_END[0]+s*(Math.sin(b)-Math.sin(a)),BLEND_END[1]-s*(Math.cos(b)-Math.cos(a)),BLEND_END[2]+z*(Math.sin(b-SETTLED.heading)-Math.sin(a-SETTLED.heading))];
}
export function moonPos(t){
  const center=earthFrame(t).center;
  return add(center,t<=DUR?introMoon(t):add(SETTLED.p,settledOffset(t)));
}
export const moonSpin=t=>.75*(t-4)-.705*smoothIntegral(5.5,DUR,t);
let shapeTime,shapeCache;
export function moonShape(t,events=CAPTURES){
  if(events===CAPTURES&&t===shapeTime)return shapeCache;
  let volume=0,minimum=0;const deposits=[];
  for(const e of events){
    const v=e.volume*ss(e.contact+.04,e.sinkEnd,t);if(!v)continue;
    const local=e.local*(1-ss(e.sinkEnd,e.settle,t)),norm=2*e.k/(1-Math.exp(-2*e.k));
    volume+=v;minimum+=v*(1-local+local*norm*Math.exp(-2*e.k));
    if(local>0)deposits.push({id:e.id,dir:e.dir,volume:v,local,k:e.k,norm});
  }
  const lump=.10*(1-ss(6.7,7.75,t));
  const shape={birth:volume>0?1:0,radius:Math.cbrt(volume),volume,minimum,elongation:1,lump,cool:ss(7.6,DUR,t),deposits};
  if(events===CAPTURES){shapeTime=t;shapeCache=shape;}return shape;
}
export const moonScale=t=>moonShape(t).birth;
export function moonGeology(dir){
  return {lump:1.1*fbm(dir[0]*1.6+4,dir[1]*1.6-2,dir[2]*1.6+7)+.9*fbm(dir[0]*6+8,dir[1]*6+3,dir[2]*6-1)-1,cut:0};
}
export function moonIdentityStart(dir){
  let start=7.6;
  for(const e of CAPTURES){const dot=dir.reduce((sum,v,j)=>sum+v*e.dir[j],0);start=Math.max(start,e.settle+.4+.4*e.radius-.55*(1-dot));}
  return start+.04*fbm(dir[0]*4,dir[1]*4,dir[2]*4);
}
export function moonIdentity(dir,t){
  const shape=moonShape(t);
  return shape.deposits.length||shape.lump>=.01||shape.volume<RM**3-1e-8?0:ss(moonIdentityStart(dir),DUR,t);
}
export function moonLocalPoint(dir,t,geology=moonGeology(dir),shape=moonShape(t)){
  let volume=shape.volume;
  for(const d of shape.deposits){const dot=dir.reduce((sum,v,j)=>sum+v*d.dir[j],0);volume+=d.volume*d.local*(d.norm*Math.exp(d.k*(dot-1))-1);}
  const r=Math.cbrt(Math.max(0,volume))*(1+shape.lump*geology.lump);
  return dir.map(v=>v*r);
}
function moonRotate(p,t,inverse=false){const a=moonSpin(t)*(inverse?-1:1),c=Math.cos(a),s=Math.sin(a);return [p[0]*c-p[1]*s,p[0]*s+p[1]*c,p[2]];}
export const moonToWorld=(p,t)=>add(moonPos(t),moonRotate(p,t));
export const worldToMoon=(p,t)=>moonRotate(sub(p,moonPos(t)),t,true);
export const moonInteriorRadius=t=>{const s=moonShape(t);return Math.max(0,Math.cbrt(s.minimum)*(1-s.lump)*.97-.005);};
export const captureArrival=i=>5.7+1.1*((i*3571+211)%991)/991;
function freeCaptureRotation(sim,i,t){
  const {spin}=fragmentProfile(i,sim.size[i]),age=Math.max(0,t-sim.t0[i]);
  return new Quaternion().setFromEuler(new Euler(i+age*spin[0],i*.7+age*spin[1],i*.3+age*spin[2]));
}
const moonQuaternion=t=>new Quaternion().setFromAxisAngle(new Vector3(0,0,1),moonSpin(t));
export function captureRotation(sim,i,t){
  const e=CAPTURES.find(e=>e.id===i);
  return t<e.contact?freeCaptureRotation(sim,i,t).toArray():moonQuaternion(t).multiply(new Quaternion(...e.rotation)).toArray();
}
function captureFlight(sim,i,t){
  const arrival=captureArrival(i),k0=Math.round(4/DT),b0=(i*sim.K+k0)*3,duration=arrival-4,u=clamp((t-4)/duration),epsilon=.0001;
  const target=moonPos(arrival),before=moonPos(arrival-epsilon),after=moonPos(arrival+epsilon);
  const p=target.map((end,j)=>{
    const start=sim.pos[b0+j],v0=(start-sim.pos[b0+j-3])/DT,v1=(after[j]-before[j])/(2*epsilon);
    return (2*u**3-3*u*u+1)*start+(u**3-2*u*u+u)*duration*v0+(-2*u**3+3*u*u)*end+(u**3-u*u)*duration*v1;
  });
  const arc=16*u*u*(1-u)*(1-u),z=2*((i*7919+103)%997)/997-1,angle=i*2.399963,ring=Math.sqrt(1-z*z);
  const lane=moonRotate([Math.cos(angle)*ring,Math.sin(angle)*ring,z],t);
  p[0]-=.4*arc;p[1]+=.85*arc;p[2]+=.6*arc;
  for(let j=0;j<3;j++)p[j]+=lane[j]*2*arc;return p;
}
function capturePoint(e,t){
  const f=clamp((t-e.contact)/.005,0,e.depth.length-1),i=Math.min(e.depth.length-2,Math.floor(f)),u=f-i;
  const radius=e.depth[i]*(1-u)+e.depth[i+1]*u;
  return moonToWorld(e.dir.map(v=>v*radius),t);
}

export function gravityStep(p, v, dt, time = 0) {
  const center=earthFrame(time).center,r = sub(p, center), d = Math.hypot(...r), a = -GM / (d * d * d);
  v = add(v, r, a * dt); p = add(p, v, dt);
  const q = sub(p, center), dq = Math.hypot(...q);
  return { p, v, absorbed: dq < surfaceRadius(q.map(x => x / dq), time) };
}

export function simulateFragments(n = 300) {
  let s = 7; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const K = Math.ceil(DUR / DT) + 2, pos = new Float32Array(n * K * 3), t0 = new Float32Array(n), size = new Float32Array(n), landing = new Float32Array(n).fill(Infinity),absorbedAt=new Float32Array(n).fill(Infinity),anchors=new Float32Array(n*3);
  const records=[],groups=new Map(),launch=[];
  for (let i = 0; i < n; i++) {
    const delay=R();size[i]=.05+R()*.13;
    const scatter=[R()-.5,R()-.5,R()-.5],variation=R(),bias=R(),jitter=[R()-.5,R()-.5,R()-.5],radius=size[i]*fragmentScaleFactor(i),packet=radius>=.18?0:radius>=.08?1:2;
    records.push({i,delay,scatter,variation,bias,jitter,radius,packet});
    if(!PROMINENT_RETURN_IDS.includes(i)){const key=`${packet}/${isCapture(i)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(records.at(-1));}
  }
  for(const values of groups.values()){
    values.sort((a,b)=>b.radius-a.radius);
    values.forEach((e,rank)=>{e.order=rank/Math.max(1,values.length-1);t0[e.i]=TC+[.15,.28,.43][e.packet]+[.16,.25,.52][e.packet]*e.order;});
  }
  for(const e of records){
    const {i,radius,packet,scatter,bias,jitter}=e;
    const normal=rotate(N_BODY,earthFrame(t0[i]).angle),tangent=rotate(T_BODY,earthFrame(t0[i]).angle),binormal=[normal[1]*tangent[2]-normal[2]*tangent[1],normal[2]*tangent[0]-normal[0]*tangent[2],normal[0]*tangent[1]-normal[1]*tangent[0]];
    const angle=([32,22,12][packet]-(isCapture(i)?0:7))*Math.PI/180,heading=normal.map((x,j)=>x*Math.cos(angle)+tangent[j]*Math.sin(angle));
    const direction=add(heading,binormal,jitter[0]*.08),length=Math.hypot(...direction),meanSpeed=(isCapture(i)?[1.95,1.85,1.70][packet]:[1.56,1.48,1.36][packet]*.74),speed=meanSpeed*(1.12-.24*(e.order??0));
    let v=direction.map(x=>x*speed/length),p=add(add(contactPoint(t0[i]),tangent,RT*(.65+.12*bias)),binormal,scatter[0]*.12),source='theia';
    const th=theia(t0[i]),inner=IMPACTOR_INNER_BOUND*th.sigmaMin-radius-.025,delta=sub(p,th.p),distance=Math.hypot(...delta);
    if(distance>inner)p=add(th.p,delta,inner/distance);
    if (PROMINENT_RETURN_IDS.includes(i)) {
      const rank = PROMINENT_RETURN_IDS.indexOf(i);
      const [delay, radius, offset, radial, side, depth] = RETURN_LAUNCH[rank];
      t0[i] = TC + delay; size[i] = radius;
      const launchNormal=rotate(N_BODY,earthFrame(t0[i]).angle),launchTangent=rotate(T_BODY,earthFrame(t0[i]).angle);
      p = add(add(contactPoint(t0[i]),launchNormal,.18),launchTangent,offset);
      v = add(add(launchNormal.map(x=>x*radial),launchTangent,side),[0,0,depth]).map(x=>x*.74);source='surface-return';
    }
    launch[i]={position:p.slice(),velocity:v.slice(),packet:PROMINENT_RETURN_IDS.includes(i)?-1:packet,heading,meanSpeed,source};
    // Keep the full rigid piece while the surface occludes it; never delete an exposed silhouette.
    for(let k=0;k<K;k++){
      const time=k*DT;
      if(time>t0[i]){
        if(Number.isFinite(absorbedAt[i])){
          const anchor=Array.from(anchors.slice(i*3,i*3+3)),radius=Math.hypot(...anchor),piece=size[i]*fragmentScaleFactor(i);
          const target=Math.min(radius-.02,RECEIVER_INNER_BOUND-piece-.06),depth=radius+(target-radius)*ss(absorbedAt[i],absorbedAt[i]+.45+piece,time);
          p=bodyToWorld(anchor.map(x=>x*depth/radius),time);
        }else{
          const next=gravityStep(p,v,DT,time);p=next.p;v=next.v;
          const radial=sub(p,earthFrame(time).center).reduce((sum,x,j)=>sum+x*v[j],0);
          if(!isCapture(i)&&next.absorbed&&radial<0){absorbedAt[i]=time;anchors.set(worldToBody(p,time),i*3);}
        }
        if(!isCapture(i)&&!Number.isFinite(landing[i])&&time>absorbedAt[i]+DT*.5&&Math.hypot(...sub(p,earthFrame(time).center))+size[i]*fragmentScaleFactor(i)<RECEIVER_INNER_BOUND)landing[i]=time;
      }
      pos.set(p,(i*K+k)*3);
    }
  }
  return { n, K, pos, t0, size, landing,absorbedAt,launch };
}

export function fragAt(sim, i, t, out) {
  const f = Math.min(sim.K - 1.001, Math.max(0, t / DT)), k = f | 0, u = f - k, b = (i * sim.K + k) * 3;
  for (let j = 0; j < 3; j++) out[j] = sim.pos[b + j] * (1 - u) + sim.pos[b + 3 + j] * u;
  let s = t >= sim.t0[i] ? sim.size[i] : 0;
  if (!isCapture(i) && t >= sim.landing[i]) s = 0;
  if(isCapture(i)&&t>=4){
    const event=CAPTURES.find(e=>e.id===i),target=t<event.contact?captureFlight(sim,i,t):capturePoint(event,t);
    for(let j=0;j<3;j++)out[j]=target[j];
    if(t>=event.contact&&Math.hypot(...worldToMoon(out,t))+sim.size[i]*fragmentScaleFactor(i)<moonInteriorRadius(t))s=0;
  }

  return s;
}

// ponytail: fixed 300-piece authored history; rebuild this table if the scene's seed/count changes.
const captureSim=simulateFragments(),captureMeshes=[fragmentGeometry(2),fragmentGeometry(4)];
const capturePieces=Array.from({length:captureSim.n},(_,id)=>id).filter(isCapture).map(id=>{
  const radius=captureSim.size[id]*fragmentScaleFactor(id),geometry=captureMeshes[fragmentScaleFactor(id)>=1.5?1:0],q=geometry.attributes.position,axes=fragmentProfile(id,captureSim.size[id]).axes;
  return {id,radius,points:Array.from({length:q.count},(_,j)=>[q.getX(j)*radius*axes[0],q.getY(j)*radius*axes[1],q.getZ(j)*radius*axes[2]])};
});
const totalCaptureVolume=capturePieces.reduce((sum,p)=>sum+p.radius**3,0);
export const CAPTURES=[];
const contactGap=(piece,t,events)=>{
  const center=worldToMoon(captureFlight(captureSim,piece.id,t),t),distance=Math.hypot(...center),shape=moonShape(t,events);
  if(distance-piece.radius>shape.radius*1.8)return distance-piece.radius-shape.radius*1.8;
  const rotation=moonQuaternion(t).invert().multiply(freeCaptureRotation(captureSim,piece.id,t));
  // The fragment has an inscribed stone core, used only to bootstrap the zero-radius nucleus.
  let gap=distance-piece.radius*.25;
  for(const p of piece.points){const v=new Vector3(...p).applyQuaternion(rotation).add(new Vector3(...center)),r=v.length(),dir=v.toArray().map(x=>x/(r||1));gap=Math.min(gap,r-Math.hypot(...moonLocalPoint(dir,t,undefined,shape)));}
  return gap;
};
for(let t=4.01;t<=6.81;t+=.01){
  const existing=CAPTURES.slice();
  for(const piece of capturePieces)if(!CAPTURES.some(e=>e.id===piece.id)&&contactGap(piece,t,existing)<=0){
    let lo=t-.01,hi=t;for(let j=0;j<12;j++){const mid=(lo+hi)/2;if(contactGap(piece,mid,existing)<=0)hi=mid;else lo=mid;}
    const contact=hi,center=worldToMoon(captureFlight(captureSim,piece.id,contact),contact),radius=Math.hypot(...center),dir=center.map(v=>v/(radius||1));
    const rotation=moonQuaternion(contact).invert().multiply(freeCaptureRotation(captureSim,piece.id,contact));
    const body=moonShape(contact,existing).radius,k=Math.min(3,Math.max(1.8,.35*(body/piece.radius)**2));
    CAPTURES.push({...piece,contact,dir,distance:radius,rotation:rotation.toArray(),volume:RM**3*piece.radius**3/totalCaptureVolume,local:piece.radius>=.08?.38:0,k,sinkEnd:contact+.35+.6*piece.radius,settle:contact+.75+.9*piece.radius});
  }
}
if(CAPTURES.length!==capturePieces.length)throw new Error('Capture failed to reach the receiving mass');
for(const e of CAPTURES){
  e.depth=Array.from({length:Math.ceil((e.sinkEnd-e.contact)/.005)+2},(_,step)=>e.distance*(1-ss(e.contact,e.sinkEnd,e.contact+step*.005)));
}
captureMeshes.forEach(g=>g.dispose());shapeTime=undefined;
