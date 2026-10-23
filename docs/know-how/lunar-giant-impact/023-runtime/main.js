import * as T from 'three';
import * as M from './motion.js';
import { sculpt, fragmentGeometry, refineFractures, crustNormals, moonPlateAt } from './terrain.js';

const U_ROCK = new URL('../020-lunar-art-finish/assets/cliff-diffuse.jpg', import.meta.url).href;
const U_EARTH = new URL('../020-lunar-art-finish/assets/earth.jpg', import.meta.url).href;
const U_MOON = new URL('../020-lunar-art-finish/assets/moon.jpg', import.meta.url).href;
const U_CLOUD = new URL('../020-lunar-art-finish/assets/clouds.jpg', import.meta.url).href;
const stageEl = document.querySelector('#stage'), fb = document.querySelector('#fallback'), ctl = document.querySelector('#ctl');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const metrics = { calls: 0, triangles: 0, buffer: [0, 0], time: M.DUR, phase: 'static fallback' };
globalThis.stage = { impact: { metrics, view: null } };
try { boot(); } catch (error) { stageEl.querySelectorAll('canvas').forEach(c => c.remove()); fb.removeAttribute('hidden'); ctl.hidden = true; console.warn('WebGL unavailable', error.message); }

function boot() {
  const R = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  R.setClearColor(0x0b0705); R.outputColorSpace = T.SRGBColorSpace; stageEl.appendChild(R.domElement);
  const S = new T.Scene(), C = new T.OrthographicCamera(); C.position.set(0, 0, 20);
  const L = new T.TextureLoader(), texs = [];
  const tex = u => { const t = L.load(u, () => draw()); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; texs.push(t); return t; };
  const rock = tex(U_ROCK), earthT = tex(U_EARTH), moonT = tex(U_MOON), cloudT = tex(U_CLOUD);
  cloudT.colorSpace = T.NoColorSpace;
  rock.wrapS = rock.wrapT = T.RepeatWrapping;
  S.add(new T.AmbientLight(0x4a4542, 0.6));
  const sun = new T.DirectionalLight(0xffead7, 3.0); sun.position.set(-6, 6, 8); S.add(sun);
  const earthBody=new T.Group(),earthStrain=new T.Matrix4();earthBody.matrixAutoUpdate=false;S.add(earthBody);
  const contactLight = new T.PointLight(0xff7b36, 0, 3.2, 2); contactLight.position.set(...M.N_BODY).multiplyScalar(M.RE+.35); earthBody.add(contactLight);
  const U = { uC: { value: new T.Vector3(...M.CONTACT) }, uHeat: { value: 0 }, uW: { value: 0 }, uModern: { value: 0 },uRelief:{value:1}, uModernMap: { value: earthT } };
  // Dependent patches match exact constants above; fail loudly instead of silently dropping relief/cooling logic.
  const expectPatched=(source,marks)=>{for(const mark of marks)if(!source.includes(mark))throw new Error('shader patch missing: '+mark);};
  const heat = m => { m.onBeforeCompile = s => {
    Object.assign(s.uniforms, U);s.uniforms.uPlates={value:0};
    s.vertexShader = 'varying vec3 vW, vStone, vStoneNormal; varying vec2 vCrust; attribute vec3 stonePoint; attribute vec2 crustFeatures;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vStone = stonePoint; vStoneNormal = normal; vCrust = crustFeatures;
vec4 wp = vec4(transformed, 1.);
#ifdef USE_INSTANCING
wp = instanceMatrix * wp;
#endif
vW = (modelMatrix * wp).xyz;`);
    // Emission belongs to the recessed floor, not the fracture wall or an independent mask.
    s.fragmentShader = `varying vec3 vW, vStone, vStoneNormal; varying vec2 vCrust; uniform vec3 uC; uniform float uHeat, uW;
float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453123);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm3(vec3 p){return .55*noise3(p)+.28*noise3(p*2.03+vec3(7,2,5))+.17*noise3(p*4.17-vec3(3,5,1));}
uniform float uPlates;
// Per-pixel body-local plate cells (same construction as terrain.plateAt): x = border distance, y = plate tone.
vec2 plateCell(vec3 q){vec3 c=floor(q);float f1=9.,f2=9.;vec3 best=c;for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)for(int k=-1;k<=1;k++){vec3 id=c+vec3(i,j,k),seed=id+.15+.7*vec3(hash3(id),hash3(id.yzx+3.1),hash3(id.zxy+7.7));float d=length(q-seed);if(d<f1){f2=f1;f1=d;best=id;}else if(d<f2)f2=d;}return vec2((f2-f1)*.5,hash3(best+4.));}
float fractureCut(vec3 p){vec3 w=p+1.2*(vec3(noise3(p*.7),noise3(p*.7+vec3(9,2,4)),noise3(p*.7+vec3(-3,7,2)))-.5);float width=.020+.022*noise3(p*2.4);return max(0.,1.-abs(fbm3(w*1.2)-.49)/width);}
` + s.fragmentShader.replace('#include <map_fragment>', `
vec3 weights=pow(abs(normalize(vStoneNormal)),vec3(4.)); weights/=dot(weights,vec3(1.));
vec3 stone=texture2D(map,vStone.yz*.85).rgb*weights.x+texture2D(map,vStone.xz*.85).rgb*weights.y+texture2D(map,vStone.xy*.85).rgb*weights.z;
float stoneLuma=dot(stone,vec3(.2126,.7152,.0722));
float plate=fbm3(vStone*.65+vec3(7,-2,3)),grain=fbm3(vStone*5.7);
// Plate tone (vCrust.y) gives each Voronoi plate its own broad face value.
float tone=mix(plate,vCrust.y,.75),plateSeam=0.,plateRelief=0.;
if(uPlates>0.){vec3 pq=vStone*uPlates;pq+=.55*(vec3(noise3(pq*.7),noise3(pq*.7+vec3(5,0,0)),noise3(pq*.7+vec3(0,0,9)))-.5);vec2 pc=plateCell(pq);float fw=max(fwidth(pc.x),1e-4);
plateSeam=1.-smoothstep(.025,.09+fw,pc.x+fw*.5);tone=mix(tone,pc.y,.7);plateRelief=.16*smoothstep(0.,.14,pc.x);}
vec3 crustColor=stoneLuma*mix(vec3(.19,.21,.23),vec3(1.02,.98,.92),smoothstep(.15,.85,tone))*(.70+.60*grain);
float recess=sqrt(max(0.,vCrust.x));
crustColor=mix(crustColor,stoneLuma*vec3(.46,.40,.34),.55*smoothstep(.10,.85,recess));
crustColor*=1.-.5*plateSeam;
float stoneRelief=stoneLuma*.35;
stoneRelief+=plateRelief;
diffuseColor.rgb=crustColor;
`).replace('#include <normal_fragment_maps>', 'normal=perturbNormalArb(-vViewPosition,normal,vec2(dFdx(stoneRelief),dFdy(stoneRelief))*bumpScale,faceDirection);').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float hd = distance(vW, uC);
float fissure=smoothstep(.88,1.,vCrust.x)*(.35+.65*smoothstep(.45,.85,fractureCut(vStone)));
float hh=uHeat*(exp(-hd*hd/1.5)+.18*exp(-pow((hd-uW)*2.2,2.)));
totalEmissiveRadiance+=vec3(3.4,.68,.06)*hh*fissure*(.65+.7*grain);`);
  }; return m; };
  const Nv = new T.Vector3(...M.N), bodyNormal=new T.Vector3(...M.N_BODY), eG = refineFractures(refineFractures(new T.SphereGeometry(M.RE, 88, 44), M.RE), M.RE), terrain = sculpt(eG, M.RE), rest = terrain.base, cap = [];
  eG.setAttribute('crustFeatures', new T.BufferAttribute(terrain.features, 2));
  eG.boundingSphere=new T.Sphere(new T.Vector3(),M.RE+.17*.55+.035*.5+.156);
  for (let i = 0; i < rest.length; i += 3) { const c = (rest[i] * bodyNormal.x + rest[i + 1] * bodyNormal.y + rest[i + 2] * bodyNormal.z) / M.RE; if (c > 0.55) cap.push(i, c); }
  const eM = heat(new T.MeshStandardMaterial({ map: rock, bumpMap: rock, bumpScale: .18, roughness: 0.9, metalness: 0 }));
  const compileHot = eM.onBeforeCompile;
  eM.onBeforeCompile = shader => { compileHot(shader); shader.fragmentShader = 'uniform sampler2D uModernMap; uniform float uModern,uRelief;\n' + shader.fragmentShader
    .replace('crustColor=mix(crustColor,stoneLuma*vec3(.46,.40,.34),.55*smoothstep(.10,.85,recess));','crustColor=mix(crustColor,stoneLuma*vec3(.46,.40,.34),.55*smoothstep(.10,.85,recess)*uRelief);')
    .replace('float stoneRelief=stoneLuma*.35;','crustColor=mix(vec3(.12,.115,.11),crustColor,max(uRelief,.55));\nfloat stoneRelief=stoneLuma*.35;')
    .replace('diffuseColor.rgb=crustColor;', 'diffuseColor.rgb=mix(crustColor,texture2D(uModernMap,vMapUv).rgb,uModern);')
    .replace('totalEmissiveRadiance+=vec3(3.4,.68,.06)*hh*fissure','totalEmissiveRadiance+=vec3(3.4,.68,.06)*hh*fissure*uRelief'); expectPatched(shader.fragmentShader,['recess)*uRelief);','crustColor=mix(vec3(.12','uModernMap,vMapUv).rgb,uModern','hh*fissure*uRelief']); };
  const earth = new T.Mesh(eG, eM); earthBody.add(earth);
  const cM = new T.MeshStandardMaterial({ color: 0xffffff, alphaMap: cloudT, transparent: true, depthWrite: false, roughness: 1 });
  const clouds = new T.Mesh(new T.SphereGeometry(M.RE * 1.015, 64, 32), cM); earthBody.add(clouds);
  const tg = new T.Group(); tg.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), Nv); S.add(tg);
  tg.matrixAutoUpdate=false;const theiaRotation=new T.Matrix4().makeRotationFromQuaternion(tg.quaternion);
  const theiaGeometry = refineFractures(new T.SphereGeometry(M.RT, 64, 32), M.RT), theiaTerrain = sculpt(theiaGeometry, M.RT);
  theiaGeometry.setAttribute('crustFeatures', new T.BufferAttribute(theiaTerrain.features, 2));
  const theiaMesh=new T.Mesh(theiaGeometry, heat(new T.MeshStandardMaterial({ map: rock, bumpMap: rock, bumpScale: .16, roughness: 1 }))); tg.add(theiaMesh);
  const moonGeometry=new T.SphereGeometry(1,96,48),moonTerrain=sculpt(moonGeometry,1),moonRest=moonTerrain.base,moonGeology=[];
  const moonFeatures=new Float32Array(moonRest.length/3*2),moonPoints=new Float32Array(moonRest.length),lunarStart=new Float32Array(moonRest.length/3);
  for(let i=0;i<moonRest.length;i+=3){
    const dir=Array.from(moonRest.slice(i,i+3)),length=Math.hypot(...dir);dir.forEach((v,j)=>dir[j]=v/length);
    const q=M.moonGeology(dir);moonGeology.push(q);const plates=moonPlateAt(dir[0]*2.4,dir[1]*2.4,dir[2]*2.4);moonFeatures[i/3*2]=Math.max(q.cut,.7*plates.recess);moonFeatures[i/3*2+1]=plates.tone;
    lunarStart[i/3]=M.moonIdentityStart(dir);
    dir.forEach((v,j)=>moonPoints[i+j]=v*.35);
  }
  moonGeometry.setAttribute('crustFeatures',new T.BufferAttribute(moonFeatures,2));moonGeometry.setAttribute('stonePoint',new T.BufferAttribute(moonPoints,3));
  moonGeometry.setAttribute('lunarStart',new T.BufferAttribute(lunarStart,1));
  const moonM=heat(new T.MeshStandardMaterial({map:rock,bumpMap:rock,bumpScale:.12,roughness:1})),moonU={uFill:{value:0},uMoonTime:{value:0},uLunarReady:{value:0},uLunarMap:{value:moonT}};
  const compileMoon=moonM.onBeforeCompile;
  moonM.onBeforeCompile=shader=>{
    compileMoon(shader);Object.assign(shader.uniforms,moonU);shader.uniforms.uPlates.value=5.27;
    shader.vertexShader='attribute float lunarStart;varying float vLunarStart;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLunarStart=lunarStart;');
    shader.fragmentShader='uniform float uFill,uMoonTime,uLunarReady;uniform sampler2D uLunarMap;varying float vLunarStart;\n'+shader.fragmentShader
      .replace('normalize(vStoneNormal)','normalize(vStone)')
      .replace('diffuseColor.rgb=crustColor;','float cold=uLunarReady*smoothstep(vLunarStart,9.5,uMoonTime);diffuseColor.rgb=crustColor;if(cold>0.)diffuseColor.rgb=mix(crustColor,texture2D(uLunarMap,vMapUv).rgb,cold);')
      .replace('float fissure=smoothstep(.88,1.,vCrust.x)*(.35+.65*smoothstep(.45,.85,fractureCut(vStone)));','float fissure=smoothstep(.60,.87,sqrt(max(0.,vCrust.x)));')
      .replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.18)*uFill;');
    expectPatched(shader.fragmentShader,['normalize(vStone)','float cold=uLunarReady','fissure=smoothstep(.60,.87,sqrt','vec3(.18)*uFill']);
  };
  moonGeometry.boundingSphere=new T.Sphere(new T.Vector3(),1.5);
  const moon=new T.Mesh(moonGeometry,moonM);moon.frustumCulled=false;S.add(moon);
  const fM = heat(new T.MeshStandardMaterial({ map: rock, bumpMap: rock, bumpScale: .12, roughness: 1 }));
  const captureFill={value:0},compileFragments=fM.onBeforeCompile;
  fM.onBeforeCompile=shader=>{
    compileFragments(shader);shader.uniforms.uCaptureFill=captureFill;shader.uniforms.uPlates.value=3.5;
    shader.vertexShader='attribute float captureRole,returnRole;varying float vCaptureRole,vReturnRole;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCaptureRole=captureRole;vReturnRole=returnRole;');
    shader.fragmentShader='uniform float uCaptureFill;varying float vCaptureRole,vReturnRole;\n'+shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.28)*uCaptureFill*vCaptureRole;\n// Albedo-scaled rim light separates returning stone from the same-material crust; not emissive.\nreflectedLight.directDiffuse+=diffuseColor.rgb*vec3(1.1,.96,.82)*pow(1.-abs(dot(normal,normalize(vViewPosition))),3.)*(.9+1.1*vReturnRole)*(1.-vCaptureRole);\nreflectedLight.directDiffuse*=1.+.35*vReturnRole;');
  };
  const sim = M.simulateFragments(300), slots = [];
  const fragmentBatches = [false, true].map(detailed => {
    const ids = Array.from({ length: sim.n }, (_, i) => i).filter(i => (M.fragmentScaleFactor(i) >= 1.5) === detailed);
    const mesh = new T.InstancedMesh(fragmentGeometry(detailed ? 4 : 2), fM, ids.length);
    mesh.geometry.setAttribute('captureRole',new T.InstancedBufferAttribute(new Float32Array(ids.map(id=>M.isCapture(id)?1:0)),1));
    mesh.geometry.setAttribute('returnRole',new T.InstancedBufferAttribute(new Float32Array(ids.map(id=>M.PROMINENT_RETURN_IDS.includes(id)?1:0)),1));
    mesh.userData.ids = ids; ids.forEach((id, slot) => { slots[id] = { mesh, slot }; });
    mesh.frustumCulled = false; S.add(mesh); return mesh;
  });
  const profiles = Array.from({ length: sim.n }, (_, i) => M.fragmentProfile(i, sim.size[i]));
  const dummy = new T.Object3D(), o = [0, 0, 0];
  let lastA = -1, lastSurfaceTime = -1, lastRelief = -1,lastMoonTime=-1, t = reduced.matches ? M.DUR : 0, playing = !reduced.matches, vis = true, raf = 0, last = 0, lost = false, dead = false;
  function apply(t) {
    const frame=M.earthFrame(t),axis=new T.Vector3(...frame.axis);
    earthBody.position.set(...frame.center); earthBody.quaternion.setFromAxisAngle(axis,frame.angle);
    earthBody.updateMatrix();earthStrain.identity();
    for(let row=0;row<3;row++)for(let col=0;col<3;col++)earthStrain.elements[col*4+row]=(row===col?frame.s:0)+(frame.flat-frame.s)*M.N_BODY[row]*M.N_BODY[col];
    earthBody.matrix.multiply(earthStrain);
    theiaMesh.quaternion.setFromAxisAngle(new T.Vector3(.3,.8,.2).normalize(),t*.38);
    const th = M.theia(t); tg.position.set(...th.p); tg.scale.set(th.s, th.flat, th.s); tg.visible = th.vis > 0;
    tg.matrix.fromArray(M.theiaMatrix(t)).multiply(theiaRotation);tg.matrixWorldNeedsUpdate=true;
    const a = M.deform(t);
    if (a !== lastA || (a > 0 && t !== lastSurfaceTime) || lastRelief !== M.earthRelief(t)) {
      const P = eG.attributes.position.array;
      const geology = M.earthRelief(t);
      for (let i = 0; i < P.length; i++) P[i] = rest[i] + (terrain.rock[i] - rest[i]) * geology;
      for (let j = 0; j < cap.length; j += 2) { const i = cap[j], k = M.impactDisplacement(cap[j + 1], t) / M.RE; P[i] += rest[i] * k; P[i + 1] += rest[i + 1] * k; P[i + 2] += rest[i + 2] * k; }
      eG.attributes.position.needsUpdate = true; crustNormals(eG); lastA = a; lastSurfaceTime = t; lastRelief = M.earthRelief(t);
    }
    U.uHeat.value = M.heat(t) * 2.2; U.uW.value = M.wave(t);
    U.uC.value.set(...M.contactPoint(t));
    contactLight.intensity = 8 * M.heat(t) * (1 - M.ss(3, 4, t));
    const e = M.earthModern(t); U.uModern.value = e;U.uRelief.value=M.earthRelief(t);eM.bumpScale = .28 * M.earthRelief(t); // One mesh throughout: relief 0 is the rest sphere, so the modern Earth has no geometry swap.
    cM.opacity = 0.85 * M.ss(7.5, 9.2, t); clouds.visible = cM.opacity > 0; clouds.quaternion.setFromAxisAngle(axis,frame.angle*.2);
    const shape=M.moonShape(t);moon.position.set(...M.moonPos(t));moon.rotation.z=M.moonSpin(t);moon.visible=shape.birth>0;
    moonU.uFill.value=1.55*M.ss(5.3,5.8,t);captureFill.value=M.ss(5.0,5.5,t);moonM.bumpScale=.12*(1-shape.cool);
    moonU.uMoonTime.value=t;moonU.uLunarReady.value=shape.deposits.length===0&&shape.lump<.01&&shape.volume>=M.RM**3-1e-8?1:0;
    if(t!==lastMoonTime&&(t<=M.DUR||lastMoonTime<M.DUR)){
      const positions=moonGeometry.attributes.position;
      for(let i=0;i<positions.count;i++)positions.setXYZ(i,...M.moonLocalPoint(Array.from(moonRest.slice(i*3,i*3+3)),t,moonGeology[i],shape));
      positions.needsUpdate=true;crustNormals(moonGeometry);lastMoonTime=t;
    }
    fragmentBatches.forEach(mesh => { mesh.userData.live=0; });
    for (let i = 0; i < sim.n; i++) {
      const s = (M.fragAt(sim, i, t, o) * M.fragmentScaleFactor(i)) || 1e-4, { axes, spin } = profiles[i], age = Math.max(0, t - sim.t0[i]);
      dummy.position.set(...o); dummy.scale.set(s * axes[0], s * axes[1], s * axes[2]);
      if(s>1e-4)slots[i].mesh.userData.live++;
      dummy.rotation.set(i + age * spin[0], i * .7 + age * spin[1], i * .3 + age * spin[2]);
      if(M.isCapture(i))dummy.quaternion.fromArray(M.captureRotation(sim,i,t));
      dummy.updateMatrix(); slots[i].mesh.setMatrixAt(slots[i].slot, dummy.matrix);
    }
    fragmentBatches.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true;mesh.visible=mesh.userData.live>0; });
  }
  function draw() {
    if (dead || lost) return;
    apply(t); R.render(S, C); fb.setAttribute('hidden','');const i = R.info.render;
    Object.assign(metrics, { calls: i.calls, triangles: i.triangles, buffer: [R.domElement.width, R.domElement.height], time: +t.toFixed(3), phase: M.phase(t), playing, scheduled: Boolean(raf), ids: [earth.uuid, moon.uuid, tg.uuid] });
  }
  function size() {
    const w = stageEl.clientWidth || 1, h = stageEl.clientHeight || 1;
    R.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2e6 / (w * h)))); R.setSize(w, h, false);
    const span = (w < 760 || h > w) ? 8.2 : 6, asp = w / h;
    Object.assign(C, { top: span / 2, bottom: -span / 2, left: -span * asp / 2, right: span * asp / 2 }); C.updateProjectionMatrix(); draw();
  }
  const ok = () => playing && vis && !lost && !dead && !document.hidden && !reduced.matches;
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
  function tick() { if (!raf && ok()) raf = requestAnimationFrame(frame); }
  function frame(now) {
    if (reduced.matches) { onReduced(); return; }
    raf = 0; const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
    t += dt; draw();
    if (ok()) raf = requestAnimationFrame(frame); else last = 0;
  }
  const pauseBtn = document.querySelector('#pause'), replayBtn = document.querySelector('#replay');
  const sync = () => { pauseBtn.textContent = playing ? 'Pause' : 'Play'; pauseBtn.setAttribute('aria-pressed', String(!playing)); pauseBtn.disabled = replayBtn.disabled = reduced.matches; };
  const view = {
    play() { if (dead || reduced.matches) return; playing = true; sync(); tick(); },
    pause() { playing = false; stop(); sync(); },
    reset() { stop(); t = reduced.matches ? M.DUR : 0; draw(); tick(); },
    seek(x) { t = M.clamp(+x || 0, 0, M.DUR); draw(); },
    render: () => draw(),
    get time() { return t; },
    inspect({occlusion=true,silhouette=false}={}) {
      const matrix = new T.Matrix4(), ray = new T.Raycaster(), rect = R.domElement.getBoundingClientRect();
      // Instanced bounding spheres are cached by three.js; refresh so raycasts see the current pose.
      if(silhouette)fragmentBatches.forEach(m=>m.computeBoundingSphere());
      const returns = M.PROMINENT_RETURN_IDS.map(id => {
        const { mesh, slot } = slots[id];
        mesh.getMatrixAt(slot, matrix); const p = new T.Vector3().setFromMatrixPosition(matrix), projected = p.clone().project(C), radius = Math.max(...new T.Vector3().setFromMatrixScale(matrix).toArray());
        ray.set(new T.Vector3(p.x, p.y, C.position.z), new T.Vector3(0, 0, -1));
        const blocker = occlusion&&ray.intersectObjects([earth, ...(moon.visible ? [moon] : []), ...fragmentBatches.filter(mesh => mesh.visible)], false).find(hit => (hit.object !== mesh || hit.instanceId !== slot) && hit.distance < C.position.z - p.z - radius);
        // Silhouette probe: 9 orthographic rays over the projected piece (centre + ring at .6 radius); visible share of rays that hit the piece.
        let visible=null,covered=0;
        if(silhouette&&radius>1e-3){const targets=[...fragmentBatches.filter(m=>m.visible),earth,...(moon.visible?[moon]:[])];visible=0;
          for(let k=0;k<9;k++){const a=k*Math.PI/4,o=k?.6*radius:0;ray.set(new T.Vector3(p.x+o*Math.cos(a),p.y+o*Math.sin(a),C.position.z),new T.Vector3(0,0,-1));
            const hits=ray.intersectObjects(targets,false),own=hits.find(h=>h.object===mesh&&h.instanceId===slot),first=hits[0];
            if(own){covered++;if(first===own)visible++;}}
          visible=covered?visible/covered:0;}
        return { id, position: p.toArray(), radius, screen: [(projected.x + 1) * rect.width / 2, (1 - projected.y) * rect.height / 2], centerOccluded: occlusion?Boolean(blocker):null, landing: sim.landing[id], emitted: sim.t0[id], silhouetteVisible: visible };
      });
      return { time: t, stage: { width: rect.width, height: rect.height }, earth:{position:earthBody.position.toArray(),quaternion:earthBody.quaternion.toArray(),contact:U.uC.value.toArray()},moon:{id:moon.uuid,position:moon.position.toArray(),spin:moon.rotation.z,shape:M.moonShape(t)}, theia: { position: tg.position.toArray(), scale: tg.scale.toArray(), matrix:tg.matrix.toArray(),visible: tg.visible }, batches: fragmentBatches.map(mesh => mesh.userData.ids), returns };
    },
    dispose() {
      if (dead) return; dead = true; stop(); io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      reduced.removeEventListener('change', onReduced);
      pauseBtn.onclick = replayBtn.onclick = null;
      S.traverse(n => { n.geometry?.dispose(); n.material?.dispose(); }); texs.forEach(x => x.dispose());
      eG.dispose();
      R.dispose(); R.domElement.remove();
    },
  };
  globalThis.stage.impact.view = view;
  stageEl.impact = globalThis.stage.impact;
  pauseBtn.onclick = () => (playing ? view.pause() : view.play());
  replayBtn.onclick = () => { view.reset(); view.play(); };
  ctl.hidden = false; sync();
  const onVis = () => (document.hidden ? stop() : tick());
  document.addEventListener('visibilitychange', onVis);
  const onReduced = () => { stop(); if (reduced.matches) { playing = false; t = M.DUR; draw(); } sync(); };
  reduced.addEventListener('change', onReduced);
  const io = new IntersectionObserver(([en]) => { vis = en.isIntersecting; vis ? tick() : stop(); }); io.observe(stageEl);
  const ro = new ResizeObserver(size); ro.observe(stageEl);
  R.domElement.addEventListener('webglcontextlost', ev => { ev.preventDefault(); lost = true; stop(); fb.removeAttribute('hidden'); ctl.hidden = true; view.dispose(); });
  R.domElement.addEventListener('webglcontextrestored', () => { lost = false; lastA = -1; size(); tick(); });
  size(); tick();
}
