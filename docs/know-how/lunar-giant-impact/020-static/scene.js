import * as T from 'three'
import {PLANET,MOON,PLANET_RADIUS,MOON_RADIUS} from './geometry.js'
import {createVolumeGeometry} from './volume.js'
import {createVolumeGeometry as createBaselineVolumeGeometry} from './baseline-volume.js'
import {createGeologyMaterial} from './geology.js'
import {createGeologyMaterial as createColdGeologyMaterial} from './cold-geology.js'
import {HEAT_SIZE} from './crust.js'
import heatUrl from './assets/crust-heat.bin?url'
import rockUrl from './assets/cliff-diffuse.jpg'
import normalUrl from './assets/cliff-normal-512.jpg'
import roughnessUrl from './assets/cliff-roughness.jpg'
import earthUrl from './assets/earth.jpg'
import cloudUrl from './assets/clouds.jpg'
import moonUrl from './assets/moon.jpg'

export async function createScene(host,{current,onLost}) {
  const resources=[]
  let renderer=null,disposed=false
  const own=(value)=>{resources.push(value);return value}
  function dispose() {
    if(disposed)return
    disposed=true
    renderer?.domElement.removeEventListener('webglcontextlost',lost)
    resources.forEach(value=>value.dispose())
    renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove()
  }
  function lost(event){event.preventDefault();dispose();onLost()}
  try {
    const loader=new T.TextureLoader()
    const load=(url)=>new Promise((resolve,reject)=>{
      const texture=own(loader.load(url,()=>resolve(texture),undefined,reject))
    })
    const [rock,normal,roughness,earth,cloud,moon]=await Promise.all([load(rockUrl),load(normalUrl),load(roughnessUrl),load(earthUrl),load(cloudUrl),load(moonUrl)])
    const response=await fetch(heatUrl)
    if(!response.ok)throw new Error('Heat asset unavailable')
    const data=new Uint8Array(await response.arrayBuffer())
    if(data.length!==HEAT_SIZE[0]*HEAT_SIZE[1]*HEAT_SIZE[2])throw new Error('Invalid heat asset')
    const heatField=own(new T.Data3DTexture(data,...HEAT_SIZE))
    heatField.format=T.RedFormat;heatField.type=T.UnsignedByteType;heatField.minFilter=heatField.magFilter=T.LinearFilter;heatField.needsUpdate=true
    if(!current()){dispose();return null}
    for(const texture of [rock,earth,moon])texture.colorSpace=T.SRGBColorSpace
    normal.colorSpace=roughness.colorSpace=T.NoColorSpace
    for(const texture of [rock,normal,roughness]){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(2,1)}
    cloud.colorSpace=T.NoColorSpace
    function pixels(texture,width=1024) {
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=Math.round(width*texture.image.height/texture.image.width)
      const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(texture.image,0,0,canvas.width,canvas.height)
      return {canvas,context,data:context.getImageData(0,0,canvas.width,canvas.height),width:canvas.width,height:canvas.height}
    }
    const moonPixels=pixels(moon),earthPixels=pixels(earth)
    function mapFrom(source,fn) {
      const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height
      const context=canvas.getContext('2d'),image=context.createImageData(source.width,source.height),data=source.data.data
      for(let i=0;i<data.length;i+=4) {
        const rgb=fn(data[i],data[i+1],data[i+2]);image.data.set([rgb[0],rgb[1],rgb[2],255],i)
      }
      context.putImageData(image,0,0)
      const texture=own(new T.CanvasTexture(canvas));texture.colorSpace=T.NoColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping
      return texture
    }

    const ocean=mapFrom(earthPixels,(r,g,b)=>{const water=b>r*1.25&&b>g*1.05;const value=water?140:220;return [value,value,value]})
    renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'})
    renderer.setClearColor(0x080a09,1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap
    renderer.domElement.addEventListener('webglcontextlost',lost);host.append(renderer.domElement)
    const scene=new T.Scene(),group=new T.Group();scene.add(group)
    const camera=new T.OrthographicCamera(-5,5,3,-3,.1,60);camera.position.set(0,0,14);camera.lookAt(0,0,0)
    const key=new T.DirectionalLight(0xffead1,3.1);key.position.set(-7,6,3);key.castShadow=true
    key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-8;key.shadow.camera.right=8;key.shadow.camera.top=8;key.shadow.camera.bottom=-8;key.shadow.camera.near=.1;key.shadow.camera.far=35;key.shadow.bias=-.00015;key.shadow.normalBias=.03
    scene.add(key);own(key.shadow)
    const ambient=new T.AmbientLight(0x9b9a91,.055);scene.add(ambient)
    const moonFill=new T.SpotLight(0xffeddb,0,3.5,.85,.30,2)
    moonFill.position.set(MOON[0]-.5,MOON[1]+.7,MOON[2]+1.2)
    moonFill.target.position.set(MOON[0]-.1,MOON[1]+.1,MOON[2]+.2)
    group.add(moonFill,moonFill.target)
    const moltenLights=[[[2.16,-.69,3.02],1.2,1.6,0xff752b],[[2.52,-1.39,3.04],.65,1.25,0xff752b],[[3.30,-.82,3.68],.8,1.1,0xffcca0],[[-.64,2.03,1.62],.18,.85,0xff752b]].map(([position,intensity,distance,color])=>{
      const light=new T.PointLight(color,intensity,distance,2);light.position.set(...position);group.add(light)
      return {light,intensity}
    })
    const hot=own(createGeologyMaterial({origin:PLANET,heat:1,albedo:rock,roughness,heatField}))
    const cold=own(createColdGeologyMaterial({origin:PLANET,heat:.14,albedo:rock,normal,roughness}))
    const modern=own(new T.MeshStandardMaterial({map:earth,roughnessMap:ocean,roughness:1,metalness:0}))

    const moonCold=own(new T.MeshStandardMaterial({map:moon,bumpMap:moon,bumpScale:.021,roughness:.96}))
    function sphere(radius,width,height,source,amount,repeat) {
      const geometry=own(new T.SphereGeometry(radius,width,height)),positions=geometry.attributes.position,uv=geometry.attributes.uv,original=positions.array.slice()
      for(let i=0;i<positions.count;i++) {
        const u=((uv.getX(i)*repeat[0])%1+1)%1,v=((uv.getY(i)*repeat[1])%1+1)%1
        const x=Math.min(source.width-1,Math.floor(u*source.width)),y=Math.min(source.height-1,Math.floor((1-v)*source.height)),pixel=(y*source.width+x)*4,data=source.data.data
        const h=(data[pixel]*.25+data[pixel+1]*.5+data[pixel+2]*.25)/255
        const scale=1+(h-.4)*amount
        positions.setXYZ(i,original[i*3]*scale,original[i*3+1]*scale,original[i*3+2]*scale)
      }
      positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere()
      return {geometry,original,rock:positions.array.slice()}
    }
    const modernGeometry=own(new T.SphereGeometry(PLANET_RADIUS,192,96))
    const joinedGeometry=own(createVolumeGeometry({joined:true})),detachedGeometry=own(createBaselineVolumeGeometry({joined:false}))
    const planet=new T.Mesh(joinedGeometry,hot);planet.position.set(...PLANET);planet.castShadow=planet.receiveShadow=true;group.add(planet)
    const satelliteData=sphere(MOON_RADIUS,96,48,moonPixels,.026,[1,1])
    const satellite=new T.Mesh(satelliteData.geometry,moonCold);satellite.position.set(...MOON);satellite.rotation.set(.25,.4,-.08);satellite.castShadow=satellite.receiveShadow=true;group.add(satellite)

    const cloudMaterial=own(new T.MeshStandardMaterial({color:0xf3f6fa,alphaMap:cloud,transparent:true,opacity:.88,roughness:1,depthWrite:false}))
    const clouds=new T.Mesh(own(new T.SphereGeometry(PLANET_RADIUS*1.006,128,64)),cloudMaterial);clouds.position.copy(planet.position);group.add(clouds)
    const airMaterial=own(new T.ShaderMaterial({transparent:true,side:T.BackSide,depthWrite:false,uniforms:{light:{value:key.position.clone().normalize()}},vertexShader:'varying vec3 n;varying vec3 eye;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);eye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 n;varying vec3 eye;void main(){float rim=pow(max(0.0,1.0-abs(dot(normalize(n),normalize(eye)))),4.0);gl_FragColor=vec4(.22,.48,.72,rim*.33);}'}))
    const air=new T.Mesh(own(new T.SphereGeometry(PLANET_RADIUS*1.017,128,64)),airMaterial);air.position.copy(planet.position);group.add(air)
    let pose='formation',renders=0
    function projected(mesh,radius,width,height) {
      const center=mesh.getWorldPosition(new T.Vector3()).project(camera)
      const edge=mesh.getWorldPosition(new T.Vector3()).add(new T.Vector3(radius,0,0)).project(camera)
      return {x:(center.x+1)*width/2,y:(1-center.y)*height/2,diameter:Math.abs(edge.x-center.x)*width}
    }
    function render() {
      if(disposed || !current())return
      const {width,height}=host.getBoundingClientRect();if(width<1||height<1)return
      const mobile=width<760,span=mobile?8.2:6
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5,Math.sqrt(2_000_000/(width*height))))
      renderer.setSize(Math.round(width),Math.round(height),false)
      camera.left=-span*width/height/2;camera.right=-camera.left;camera.top=span/2;camera.bottom=-camera.top;camera.updateProjectionMatrix()
      group.position.set(mobile?-.6:0,mobile?-.35:0,0)
      scene.updateMatrixWorld(true);renderer.render(scene,camera)
      const planetProjection=projected(planet,PLANET_RADIUS,width,height),moonProjection=projected(satellite,MOON_RADIUS,width,height)
      host.dataset.runtime='webgl';host.dataset.pose=pose
      host.dataset.metrics=JSON.stringify({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,buffer:renderer.domElement.width*renderer.domElement.height,canvas:1,planet:planetProjection,moon:moonProjection,ids:[planet.uuid,satellite.uuid],maps:7,thermalLights:moltenLights.map(({light})=>light.intensity),moonFillIntensity:moonFill.intensity,pose,renders:++renders})
    }
    function setPose(next) {
      if(!['formation','detached','earth'].includes(next))throw new RangeError('Unknown pose')
      pose=next
      const final=pose==='earth',open=pose!=='formation'
      moonFill.intensity=open?0:12
      moltenLights.forEach(({light,intensity})=>{light.intensity=open?0:intensity})
      planet.material=final?modern:pose==='detached'?cold:hot
      planet.geometry=final?modernGeometry:open?detachedGeometry:joinedGeometry
      planet.rotation.y=final?.24:0;clouds.rotation.y=planet.rotation.y
      satellite.visible=open;satellite.position.set(MOON[0]+(open?-.3:0),MOON[1]+(open?.2:0),MOON[2])
      clouds.visible=air.visible=final
      render()
    }
    setPose('formation')
    return {setPose,render,dispose,canvas:renderer.domElement,get pose(){return pose},snapshot(){return renderer.domElement.toDataURL('image/png')}}
  }catch(error){dispose();throw error}
}
