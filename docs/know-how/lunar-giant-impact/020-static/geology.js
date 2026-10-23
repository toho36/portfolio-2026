import {MeshStandardMaterial,Vector3,ShaderChunk} from 'three'
import {HEAT_MIN,HEAT_SPAN} from './crust.js'
import {MOON,MOON_RADIUS} from './geometry.js'

const fieldShader=`
varying vec3 vGeologyPoint;
uniform float geologyHeat;
uniform highp sampler3D geologyField;
uniform vec3 geologyFieldMin;
uniform vec3 geologyFieldSpan;
uniform vec3 geologyMoonCenter;
uniform float geologyMoonRadius;
float geologyHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453123);}
float geologyNoise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(geologyHash(i),geologyHash(i+vec3(1,0,0)),f.x),mix(geologyHash(i+vec3(0,1,0)),geologyHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(geologyHash(i+vec3(0,0,1)),geologyHash(i+vec3(1,0,1)),f.x),mix(geologyHash(i+vec3(0,1,1)),geologyHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float geologyFbm(vec3 p){return .55*geologyNoise(p)+.28*geologyNoise(p*2.03+vec3(7,2,5))+.17*geologyNoise(p*4.17-vec3(3,5,1));}
`

export function createGeologyMaterial({origin,heat=1,albedo,roughness,heatField=null}){
  const material=new MeshStandardMaterial({color:0xffffff,map:albedo,bumpMap:albedo,bumpScale:.60,roughnessMap:roughness,roughness:.94,metalness:0})
  material.onBeforeCompile=shader=>{
    shader.uniforms.geologyOrigin={value:new Vector3(...origin)}
    shader.uniforms.geologyHeat={value:heat}
    shader.uniforms.geologyField={value:heatField}
    shader.uniforms.geologyFieldMin={value:new Vector3(...HEAT_MIN)}
    shader.uniforms.geologyFieldSpan={value:new Vector3(...HEAT_SPAN)}
    shader.uniforms.geologyMoonCenter={value:new Vector3(...MOON)}
    shader.uniforms.geologyMoonRadius={value:MOON_RADIUS}
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGeologyPoint;uniform vec3 geologyOrigin;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGeologyPoint=mat3(modelMatrix)*transformed+geologyOrigin;')
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+fieldShader)
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',ShaderChunk.lights_fragment_begin.replace('getSpotLightInfo( spotLight, geometryPosition, directLight );',`getSpotLightInfo( spotLight, geometryPosition, directLight );
      directLight.color*=1.0-smoothstep(geologyMoonRadius-.10,geologyMoonRadius,length(vGeologyPoint.xy-geologyMoonCenter.xy));`))
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 geoP=vGeologyPoint;
      vec3 geoWarp=vec3(geologyNoise(geoP*.7),geologyNoise(geoP*.7+vec3(9,2,4)),geologyNoise(geoP*.7-vec3(3,7,2)))-.5;
      vec3 geoFold=geoP+geoWarp*1.7;
      float geoGrain=geologyFbm(geoP*5.7+vec3(3,8,2));
      vec3 geoUV=clamp((geoP-geologyFieldMin)/geologyFieldSpan,0.0,1.0);
      float geoHeat=clamp(texture(geologyField,geoUV).r*geologyHeat,0.0,1.0);
      float geoWall=1.0-smoothstep(.30,.82,normalize(vNormal).z);
      float geoNearby=max(max(texture(geologyField,geoUV+vec3(.013,0,0)).r,texture(geologyField,geoUV-vec3(.013,0,0)).r),max(texture(geologyField,geoUV+vec3(0,.016,0)).r,texture(geologyField,geoUV-vec3(0,.016,0)).r));
      geoHeat*=mix(1.0,.16,geoWall);
      geoHeat*=smoothstep(.08,.20,geoHeat);
      float geoMass=smoothstep(.51,.62,geologyFbm(geoFold*.67+vec3(7,-2,3)));
      vec3 geoWeights=pow(abs(normalize(vNormal)),vec3(4.0));geoWeights/=dot(geoWeights,vec3(1.0));
      vec3 geoTex=texture(map,geoP.yz*.85).rgb*geoWeights.x+texture(map,geoP.xz*.85).rgb*geoWeights.y+texture(map,geoP.xy*.85).rgb*geoWeights.z;
      float geoAlbedo=dot(geoTex,vec3(.2126,.7152,.0722));
      vec3 geoRock=vec3(geoAlbedo)*mix(vec3(.10,.105,.11),vec3(.56,.53,.48),geoMass)*(.65+.65*geoGrain);
      float geoSideRegion=smoothstep(2.65,2.85,geoP.x)*(1.0-smoothstep(3.40,3.60,geoP.x))*smoothstep(-1.95,-1.65,geoP.y)*(1.0-smoothstep(-.35,-.15,geoP.y));
      vec3 geoWallRock=vec3(.60,.52,.43)*(.12+.38*geoAlbedo)*(.70+.60*geoGrain);
      geoRock=mix(geoRock,geoWallRock,geoWall*geoSideRegion);
      vec3 geoMelt=mix(vec3(.075,.008,.002),vec3(.48,.095,.008),smoothstep(.18,.85,geoHeat));
      diffuseColor.rgb=mix(geoRock,geoMelt,smoothstep(.25,.78,geoHeat));
    `)
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','normal=perturbNormalArb(-vViewPosition,normal,vec2(dFdx(geoAlbedo),dFdy(geoAlbedo))*bumpScale,faceDirection);')
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=max(.5,mix(roughnessFactor,.54,smoothstep(.25,.9,geoHeat)));')
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      vec3 geoGlow=mix(vec3(.07,.001,.0002),vec3(2.8,.46,.012),pow(geoHeat,1.6));
      totalEmissiveRadiance+=geoGlow*geoHeat*(.4+1.4*geoGrain);
      totalEmissiveRadiance+=vec3(.24,.080,.022)*geoAlbedo*geoNearby*geoWall;
    `)
  }
  material.customProgramCacheKey=()=>`lunar-sculpted-crust-baked-v4-moon-fill`
  return material
}
