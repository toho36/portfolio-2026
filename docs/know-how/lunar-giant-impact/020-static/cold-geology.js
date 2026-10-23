import {MeshStandardMaterial,Vector2,Vector3} from 'three'

const fieldShader=`
varying vec3 vGeologyPoint;
uniform float geologyHeat;
float geologyHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453123);}
float geologyNoise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(geologyHash(i),geologyHash(i+vec3(1,0,0)),f.x),mix(geologyHash(i+vec3(0,1,0)),geologyHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(geologyHash(i+vec3(0,0,1)),geologyHash(i+vec3(1,0,1)),f.x),mix(geologyHash(i+vec3(0,1,1)),geologyHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float geologyFbm(vec3 p){return .55*geologyNoise(p)+.28*geologyNoise(p*2.03+vec3(7,2,5))+.17*geologyNoise(p*4.17-vec3(3,5,1));}
float geologyPlateGap(vec3 p){
  vec3 cell=floor(p),local=fract(p);
  float first=100.0,second=100.0;
  for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec3 offset=vec3(float(x),float(y),float(z)),id=cell+offset;
    vec3 jitter=vec3(geologyHash(id),geologyHash(id+vec3(9,7,3)),geologyHash(id+vec3(3,1,8)));
    vec3 delta=offset+.18+jitter*.64-local;
    float distance=dot(delta,delta);
    if(distance<first){second=first;first=distance;}else if(distance<second){second=distance;}
  }
  return sqrt(second)-sqrt(first);
}
`

export function createGeologyMaterial({origin,heat=1,albedo,normal,roughness}){
  const material=new MeshStandardMaterial({color:0xffffff,map:albedo,normalMap:normal,normalScale:new Vector2(.7,.7),roughnessMap:roughness,roughness:.94,metalness:0})
  material.onBeforeCompile=shader=>{
    shader.uniforms.geologyOrigin={value:new Vector3(...origin)}
    shader.uniforms.geologyHeat={value:heat}
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGeologyPoint;uniform vec3 geologyOrigin;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGeologyPoint=transformed+geologyOrigin;')
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+fieldShader)
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 geoP=vGeologyPoint;
      float geoMacro=geologyFbm(geoP*.53+vec3(7,-2,3));
      vec3 geoWarp=vec3(geologyNoise(geoP*.7),geologyNoise(geoP*.7+vec3(9,2,4)),geologyNoise(geoP*.7-vec3(3,7,2)))-.5;
      float geoFault=geologyPlateGap(geoP*.74+geoWarp*.38);
      float geoFissure=1.0-smoothstep(.004,.035,geoFault);
      float geoGrain=geologyFbm(geoP*5.7+vec3(3,8,2));
      float geoU=clamp((2.05-geoP.x)/2.48,0.0,1.0),geoV=1.0-geoU;
      vec3 geoCenter=geoV*geoV*vec3(2.05,.65,1.30)+2.0*geoV*geoU*vec3(.50,1.58,1.33)+geoU*geoU*vec3(-.43,1.90,1.04);
      vec3 geoScale=vec3(.3,.48*pow(geoV,1.5)+.13,.23*pow(geoV,1.4)+.105);
      vec3 geoDelta=(geoP-geoCenter)/geoScale;
      float geoRoot=exp(-dot(geoDelta,geoDelta)*.6);
      float geoHeat=clamp((geoFissure*.66+geoRoot*(.18+.68*geoGrain))*geologyHeat,0.0,1.0);
      float geoMass=smoothstep(.28,.72,geoMacro);
      float geoAlbedo=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      vec3 geoRock=vec3(geoAlbedo)*mix(vec3(.20,.23,.24),vec3(1.15,1.10,1.02),geoMass)*(.82+.28*geoGrain);
      vec3 geoMelt=mix(vec3(.075,.008,.002),vec3(.48,.095,.008),smoothstep(.18,.85,geoHeat));
      diffuseColor.rgb=mix(geoRock,geoMelt,smoothstep(.25,.78,geoHeat));
    `)
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=max(.5,mix(roughnessFactor,.54,smoothstep(.25,.9,geoHeat)));')
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      vec3 geoGlow=mix(vec3(.13,.004,.001),vec3(1.65,.40,.018),pow(geoHeat,1.4));
      totalEmissiveRadiance+=geoGlow*geoHeat*(.35+1.25*geoGrain);
    `)
  }
  material.customProgramCacheKey=()=>`lunar-geology-volume-v2`
  return material
}
