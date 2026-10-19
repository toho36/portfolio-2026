import { IcosahedronGeometry, BufferAttribute } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const mix=(a,b,t)=>a+(b-a)*t;
const fract=x=>x-Math.floor(x);
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const PLATE_SPACING=1.3,PLATE_BLEND=40,PLATE_REACH=.5; // seam profiles end by border .23, i.e. f-f1<.46
// Broken crust plates: warped 3D Voronoi in body space, each cell a tilted plane at its own level.
// Continuity: plate level is a soft-min blend over the nearest cells; seam depth is the max over neighbour
// pairs of a pair-symmetric strength times a profile of the pair's border distance, so no term jumps.
export function plateAt(x,y,z){
  const w=[noise(x*.8+3,y*.8,z*.8)-.5,noise(x*.8,y*.8+5,z*.8)-.5,noise(x*.8,y*.8,z*.8+9)-.5];
  const q=[x/PLATE_SPACING+.8*w[0],y/PLATE_SPACING+.8*w[1],z/PLATE_SPACING+.8*w[2]],c=q.map(Math.floor);
  // Every cell with f<f1+PLATE_REACH can contribute. Search 3x3x3, widen to 5x5x5 when the window edge is closer than that.
  const scan=n=>{const out=[];for(let i=-n;i<=n;i++)for(let j=-n;j<=n;j++)for(let k=-n;k<=n;k++){
    const a=c[0]+i,b=c[1]+j,d=c[2]+k,seed=[a+.05+.9*hash(a,b,d),b+.05+.9*hash(b,d,a),d+.05+.9*hash(d,a,b)];
    out.push({id:[a,b,d],seed,f:Math.hypot(q[0]-seed[0],q[1]-seed[1],q[2]-seed[2])*PLATE_SPACING});
  }return out.sort((u,v)=>u.f-v.f);};
  let cells=scan(1);const windowEdge=Math.min(...q.map((v,i)=>Math.min(v-c[i]+1,c[i]+2-v)))*PLATE_SPACING;
  if(cells[0].f+PLATE_REACH>=windowEdge)cells=scan(2);
  const f1=cells[0].f,near=cells.filter(e=>e.f<f1+PLATE_REACH);let sum=0,weight=0;
  for(const e of near){
    const [a,b,d]=e.id,h=(u,v,o)=>hash(a*1.7+u,b*1.3+v,d*1.9+o),tilt=[h(1,0,0)-.5,h(0,2,0)-.5,h(0,0,3)-.5].map(v=>v*.28);
    const level=Math.min(1,Math.max(0,.15+.7*h(4,4,4)+tilt.reduce((s,t,i)=>s+t*(q[i]-e.seed[i])*PLATE_SPACING,0))),wt=Math.exp(-PLATE_BLEND*(e.f-f1))*(1-smooth(.3,PLATE_REACH,e.f-f1));
    sum+=level*wt;weight+=wt;
  }
  // Asymmetric walls: shoulder width from a continuous field, so the two sides of a seam differ smoothly.
  const shoulder=.025+.045*noise(x*1.7+11,y*1.7,z*1.7-4);let recess=0;
  // Every neighbour pair contributes with border distance (f_i+f_j)/2-f1: on the seam between cells 1 and j this
  // is the usual (f_j-f1)/2, and the term set is identical on both sides of any border, so depth never jumps.
  for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++){
    const border=(near[i].f+near[j].f)/2-f1;if(border>.3)continue;
    const lo=[near[i].id,near[j].id].sort((u,v)=>u[0]-v[0]||u[1]-v[1]||u[2]-v[2]),ph=hash(lo[0][0]+.37*lo[1][0],lo[0][1]+.53*lo[1][1],lo[0][2]+.71*lo[1][2]);
    if(ph<.45)continue; // fused border: plates join through the soft level blend only
    const floor=ph>.8?.06+.25*(ph-.8):.016,edge=floor+.02+shoulder;
    recess=Math.max(recess,1-.45*smooth(floor,floor+.02,border)-.55*smooth(edge,edge+.025,border));
  }
  // Seams fade in and out along their length (continuous field), so plates are not closed rings.
  recess*=smooth(.32,.55,noise(x*1.1-6,y*1.1+2,z*1.1+8));
  const [a,b,d]=near[0].id;
  return {plate:sum/weight,recess,tone:hash(a*1.7+7,b*1.3+1,d*1.9+5),border:(cells[1].f-f1)/2};
}
const MOON_PLATE_SPACING=1.3;
// v1 cells (geometry-20261009) keep the Moon and fragment plate features unchanged.
export function moonPlateAt(x,y,z){
  // Domain warp breaks the regular cell look into irregular fracture lines; still continuous.
  const w=[noise(x*.8+3,y*.8,z*.8)-.5,noise(x*.8,y*.8+5,z*.8)-.5,noise(x*.8,y*.8,z*.8+9)-.5];
  const q=[x/MOON_PLATE_SPACING+.55*w[0],y/MOON_PLATE_SPACING+.55*w[1],z/MOON_PLATE_SPACING+.55*w[2]],c=q.map(Math.floor);let f1=Infinity,f2=Infinity,best;
  for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){
    const a=c[0]+i,b=c[1]+j,d=c[2]+k,seed=[a+.15+.7*hash(a,b,d),b+.15+.7*hash(b,d,a),d+.15+.7*hash(d,a,b)];
    const dist=Math.hypot(q[0]-seed[0],q[1]-seed[1],q[2]-seed[2])*MOON_PLATE_SPACING;
    if(dist<f1){f2=f1;f1=dist;best=[a,b,d,seed];}else if(dist<f2)f2=dist;
  }
  const [a,b,d,seed]=best,h=(u,v,w)=>hash(a*1.7+u,b*1.3+v,d*1.9+w),tilt=[h(1,0,0)-.5,h(0,2,0)-.5,h(0,0,3)-.5].map(v=>v*.28);
  const level=.15+.7*h(4,4,4),plate=Math.min(1,Math.max(0,level+tilt.reduce((sum,t,i)=>sum+t*(q[i]-seed[i])*MOON_PLATE_SPACING,0))),border=(f2-f1)/2;
  // Seam profile: flat recessed floor, a ledge, then the plate wall top.
  const recess=1-.45*smooth(.018,.038,border)-.55*smooth(.055,.08,border);
  // Neighbouring plates share one floor level where the seam is fully recessed, so height stays continuous.
  return {plate:plate+(.45-plate)*smooth(.9,1,recess),recess,tone:h(7,1,5),border};
}
const hash=(x,y,z)=>fract(Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453123);
export function noise(x,y,z){
  const i=[Math.floor(x),Math.floor(y),Math.floor(z)],f=[fract(x),fract(y),fract(z)].map(v=>v*v*(3-2*v));
  const h=(a,b,c)=>hash(i[0]+a,i[1]+b,i[2]+c);
  return mix(mix(mix(h(0,0,0),h(1,0,0),f[0]),mix(h(0,1,0),h(1,1,0),f[0]),f[1]),mix(mix(h(0,0,1),h(1,0,1),f[0]),mix(h(0,1,1),h(1,1,1),f[0]),f[1]),f[2]);
}
export const fbm=(x,y,z)=>.55*noise(x,y,z)+.28*noise(x*2.03+7,y*2.03+2,z*2.03+5)+.17*noise(x*4.17-3,y*4.17-5,z*4.17-1);
export function crustAt(x,y,z){
  const w=[x+1.2*(noise(x*.7,y*.7,z*.7)-.5),y+1.2*(noise(x*.7+9,y*.7+2,z*.7+4)-.5),z+1.2*(noise(x*.7-3,y*.7+7,z*.7+2)-.5)];
  const field=fbm(w[0]*1.2,w[1]*1.2,w[2]*1.2),distance=Math.abs(field-.49),width=.020+.022*noise(x*2.4,y*2.4,z*2.4);
  const cut=Math.max(0,1-distance/width),plate=fbm(x*.65+7,y*.65-2,z*.65+3),grain=fbm(x*5.7,y*5.7,z*5.7);
  // fissure (old fbm cut) only shapes fragments; Earth/Theia relief comes from plateAt with the same envelope.
  const p=plateAt(x,y,z);
  return {height:.17*(p.plate-.45)+.035*(grain-.5)-.17*p.recess,fissure:cut*cut,recess:p.recess,tone:p.tone,shade:.35+.5*plate+.15*grain};
}
export function refineFractures(geometry,radius){
  const p=Array.from(geometry.attributes.position.array),uv=Array.from(geometry.attributes.uv.array),indices=geometry.index.array;
  const point=i=>p.slice(i*3,i*3+3),key=i=>point(i).map(v=>Math.round(v*1e5)).join(',');
  const edgeKey=(a,b)=>[key(a),key(b)].sort().join('|'),decisions=new Map(),midpoints=new Map(),faces=[];
  const midpoint=(a,b,t=.5)=>{const q=point(a).map((v,j)=>v*(1-t)+p[b*3+j]*t),k=radius/Math.hypot(...q);return q.map(v=>v*k);};
  for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){
    let a=indices[i+j],b=indices[i+(j+1)%3];const k=edgeKey(a,b);
    if(!decisions.has(k)){
      if(key(a)>key(b))[a,b]=[b,a];
      const A=point(a),B=point(b),Q=midpoint(a,b);
      let t=0;
      if(Math.hypot(...A.map((v,j)=>v-B[j]))>.025&&Math.max(crustAt(...A).recess,crustAt(...B).recess,crustAt(...Q).recess,crustAt(...midpoint(a,b,.25)).recess,crustAt(...midpoint(a,b,.75)).recess)>.25){
        t=.5;let best=crustAt(...Q).recess;
        for(const sample of [.25,.375,.625,.75]){const score=crustAt(...midpoint(a,b,sample)).recess;if(score>best){best=score;t=sample;}}
      }
      decisions.set(k,t);
    }
  }
  const split=(a,b)=>{
    const canonical=decisions.get(edgeKey(a,b));if(!canonical)return undefined;
    const t=key(a)<key(b)?canonical:1-canonical;
    const k=a<b?`${a}|${b}`:`${b}|${a}`;
    if(!midpoints.has(k)){const index=p.length/3;p.push(...midpoint(a,b,t));uv.push(uv[a*2]*(1-t)+uv[b*2]*t,uv[a*2+1]*(1-t)+uv[b*2+1]*t);midpoints.set(k,index);}
    return midpoints.get(k);
  };
  for(let i=0;i<indices.length;i+=3){
    let [a,b,c]=indices.slice(i,i+3),[ab,bc,ca]=[split(a,b),split(b,c),split(c,a)];
    const count=[ab,bc,ca].filter(v=>v!==undefined).length;
    if(count===3)faces.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
    else if(count===0)faces.push(a,b,c);
    else{
      while(ab===undefined||(count===2&&bc===undefined)){[a,b,c]=[b,c,a];[ab,bc,ca]=[bc,ca,ab];}
      if(count===1)faces.push(a,ab,c,ab,b,c);else faces.push(b,bc,ab,a,ab,c,ab,bc,c);
    }
  }
  geometry.setAttribute('position',new BufferAttribute(new Float32Array(p),3));
  geometry.setAttribute('uv',new BufferAttribute(new Float32Array(uv),2));geometry.setIndex(faces);geometry.deleteAttribute('normal');
  const seams=new Map();for(let i=0;i<p.length/3;i++){const k=key(i);if(!seams.has(k))seams.set(k,[]);seams.get(k).push(i);}
  geometry.userData.crustSeams=[...seams.values()].filter(group=>group.length>1);
  return geometry;
}
export function crustNormals(geometry){
  if(!geometry.userData.crustSeams&&geometry.attributes.stonePoint){
    const p=geometry.attributes.stonePoint,groups=new Map();
    for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
    geometry.userData.crustSeams=[...groups.values()].filter(group=>group.length>1);
  }
  geometry.computeVertexNormals();const n=geometry.attributes.normal;
  for(const group of geometry.userData.crustSeams??[]){
    const sum=[0,0,0];for(const i of group){sum[0]+=n.getX(i);sum[1]+=n.getY(i);sum[2]+=n.getZ(i);}
    const length=Math.hypot(...sum);for(const i of group)n.setXYZ(i,...sum.map(v=>v/length));
  }
  n.needsUpdate=true;
}
export function sculpt(geometry,radius){
  const p=geometry.attributes.position.array,base=p.slice(),features=new Float32Array(p.length/3*2);
  for(let i=0;i<p.length;i+=3){const q=crustAt(p[i],p[i+1],p[i+2]),scale=1+q.height/radius;p[i]*=scale;p[i+1]*=scale;p[i+2]*=scale;features[i/3*2]=q.recess;features[i/3*2+1]=q.tone;}
  geometry.setAttribute('stonePoint',new BufferAttribute(base.slice(),3));
  geometry.attributes.position.needsUpdate=true;crustNormals(geometry);geometry.computeBoundingSphere();
  return {base,rock:p.slice(),features};
}
export function fragmentGeometry(detail=2){
  const seed=new IcosahedronGeometry(1,detail);
  seed.deleteAttribute('normal');seed.deleteAttribute('uv');
  const geometry=mergeVertices(seed);seed.dispose();
  const p=geometry.attributes.position,features=new Float32Array(p.count*2),points=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),q=crustAt(x*.35,y*.35,z*.35),r=.74+.26*noise(x*2.3+3,y*2.3-1,z*2.3+7)-.22*q.fissure;
    p.setXYZ(i,x*r,y*r,z*r);features[i*2]=q.fissure;features[i*2+1]=moonPlateAt(x*1.6,y*1.6,z*1.6).tone;
    points.set([x*.35,y*.35,z*.35],i*3);
  }
  geometry.setAttribute('uv',new BufferAttribute(new Float32Array(p.count*2),2));
  geometry.setAttribute('crustFeatures',new BufferAttribute(features,2));
  geometry.setAttribute('stonePoint',new BufferAttribute(points,3));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}
