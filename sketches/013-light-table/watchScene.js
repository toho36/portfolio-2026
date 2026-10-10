import { gearOutline } from '../../src/goal-loop/calibre/model.ts'
import { leatherMaps } from './leatherMaps.js'
import { strapGeometry, strapPoint, faceProximity } from './watchModel.js'

export function createWatch(T,host,surface=host) {
  const owned=new Set(),own=r=>{owned.add(r);return r};let renderer,disposed=false
  function destroy(){if(disposed)return;disposed=true;for(const r of owned)r.dispose();renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove()}
  try {
    renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setClearColor(0,0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.domElement.setAttribute('aria-hidden','true');surface.append(renderer.domElement)
    const scene=new T.Scene(),watch=new T.Group();scene.add(watch)
    const camera=new T.OrthographicCamera(-3,3,3,-3,.1,30);camera.position.set(0,-1.2,9);camera.lookAt(0,0,0)
    scene.add(new T.HemisphereLight('#fff7e6','#7e8684',2))
    const key=new T.DirectionalLight('#fff1d9',4);key.position.set(-4,6,6);scene.add(key)
    const fill=new T.DirectionalLight('#d7e5ef',2);fill.position.set(5,-2,4);scene.add(fill)
    const silver=own(new T.MeshPhysicalMaterial({color:'#bcc3c2',roughness:.24,metalness:.55,clearcoat:.5})),steel=own(new T.MeshStandardMaterial({color:'#424c50',roughness:.4,metalness:.4})),gold=own(new T.MeshStandardMaterial({color:'#c5a75e',roughness:.35,metalness:.45})),ivory=own(new T.MeshStandardMaterial({color:'#eee8d9',roughness:.75})),ruby=own(new T.MeshPhysicalMaterial({color:'#852d44',roughness:.2,clearcoat:1}))
    const leather=leatherMaps(T,host.ownerDocument,own),strap=own(new T.MeshStandardMaterial({color:'#493025',map:leather.color,bumpMap:leather.bump,bumpScale:.012,roughness:.9}))
    for(const texture of [leather.color,leather.bump]){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(2,2)}
    const thread=own(new T.MeshStandardMaterial({color:'#b59b72',roughness:1}))
    function mesh(g,m,parent=watch){const object=new T.Mesh(own(g),m);parent.add(object);return object}
    function disc(radius,depth,material,parent=watch,hole=0){const s=new T.Shape();s.absarc(0,0,radius,0,Math.PI*2,false);if(hole){const h=new T.Path();h.absarc(0,0,hole,0,Math.PI*2,true);s.holes.push(h)}return mesh(new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:2,curveSegments:48}),material,parent)}
    const band=mesh(strapGeometry(T),strap)
    for(const sign of [-1,1]){
      for(const x of [-.62,.62]){const lug=mesh(new T.CapsuleGeometry(.095,.34,4,12),silver);lug.position.set(x,sign*1.43,-.12);lug.rotation.x=-sign*.6}
      const pin=mesh(new T.CylinderGeometry(.055,.055,1.24,16),silver);pin.rotation.z=Math.PI/2;pin.position.set(0,sign*1.53,-.26)
    }
    for(const x of [-.46,.46])for(let a=0;a<Math.PI*2;a+=.055){
      const points=[a,a+.012,a+.024].map(t=>{const p=strapPoint(t,x);return new T.Vector3(p.x,p.y,p.z)})
      mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),3,.009,5,false),thread)
    }
    const buckle=mesh(new T.TorusGeometry(.25,.035,8,32),silver);buckle.scale.set(1.65,.7,1);buckle.position.set(0,-.35,-2.34)
    disc(1.46,.2,silver).position.z=-.13
    disc(1.52,.2,silver,watch,1.3).position.z=.07
    const lid=new T.Group();watch.add(lid)
    const bezel=mesh(new T.TorusGeometry(1.43,.072,12,96),silver,lid);bezel.position.z=.32
    const inner=mesh(new T.TorusGeometry(1.29,.021,8,96),gold,lid);inner.position.z=.34
    const glassMaterial=own(new T.MeshPhysicalMaterial({color:'#eff8f7',transparent:true,opacity:.1,roughness:.06,metalness:0,clearcoat:1,depthWrite:false}))
    const glass=disc(1.31,.018,glassMaterial,lid);glass.position.z=.49;glass.renderOrder=2
    disc(1.26,.035,steel).position.z=.12
    disc(1.27,.05,ivory,watch,.96).position.z=.26
    const crown=new T.Group();watch.add(crown);crown.position.set(1.62,0,.08);crown.rotation.y=Math.PI/2
    disc(.16,.2,silver,crown)
    for(let i=0;i<16;i++){const a=i/16*Math.PI*2,g=mesh(new T.BoxGeometry(.025,.025,.16),steel,crown);g.position.set(Math.cos(a)*.16,Math.sin(a)*.16,.03)}
    for(let i=0;i<60;i++){
      const angle=i/60*Math.PI*2,major=i%5===0
      const tick=mesh(new T.BoxGeometry(major?.065:.018,major?.19:.065,.028),major?steel:gold);tick.position.set(Math.sin(angle)*1.15,Math.cos(angle)*1.15,.34);tick.rotation.z=-angle
    }
    const gears=[]
    for(const [x,y,r,teeth,speed] of [[-.44,.36,.42,34,-.16],[.22,.52,.34,28,.2],[.57,-.1,.35,30,-.18],[-.26,-.4,.4,32,.17]]){
      const outline=new T.Shape();gearOutline(r,teeth).forEach(([px,py],i)=>i?outline.lineTo(px,py):outline.moveTo(px,py));outline.closePath()
      const centre=new T.Path();centre.absarc(0,0,r*.34,0,Math.PI*2,true);outline.holes.push(centre)
      const wheel=mesh(new T.ExtrudeGeometry(outline,{depth:.05,bevelEnabled:true,bevelThickness:.007,bevelSize:.007,bevelSegments:1}),gold);wheel.position.set(x,y,.2);gears.push({wheel,speed})
      disc(.055,.045,ruby).position.set(x,y,.3)
    }
    const balance=new T.Group();watch.add(balance);balance.position.set(.43,-.54,.3)
    mesh(new T.TorusGeometry(.27,.024,8,60),gold,balance)
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3,spoke=mesh(new T.BoxGeometry(.24,.022,.025),gold,balance);spoke.position.set(Math.cos(a)*.12,Math.sin(a)*.12,0);spoke.rotation.z=a}
    const weight=mesh(new T.BoxGeometry(.085,.06,.035),silver,balance);weight.position.set(.23,0,.01)
    disc(.035,.045,ruby).position.set(.43,-.54,.33)
    const bridge=mesh(new T.BoxGeometry(.83,.12,.06),silver);bridge.position.set(-.2,-.05,.33);bridge.rotation.z=.45
    for(const [x,y] of [[-.57,-.24],[.18,.13]])disc(.045,.025,steel).position.set(x,y,.4)
    function hand(length,width,material){const group=new T.Group();watch.add(group);const blade=mesh(new T.BoxGeometry(width,length,.035),material,group);blade.position.y=length*.38;group.position.z=.43;return group}
    const hour=hand(.72,.085,steel),minute=hand(1.04,.055,steel),second=hand(1.14,.022,ruby)
    disc(.105,.065,gold).position.z=.44
    let pose={time:0,open:0},width=0,height=0
    function resize(){const w=Math.max(1,surface.clientWidth),h=Math.max(1,surface.clientHeight);if(w===width&&h===height)return false;width=w;height=h;const aspect=w/h,vertical=Math.max(6.2,4.2/aspect);camera.left=-vertical*aspect/2;camera.right=-camera.left;camera.top=vertical/2;camera.bottom=-camera.top;camera.updateProjectionMatrix();renderer.setSize(w,h,false);return true}
    function paint(time=0,open=0){if(disposed)return;pose={time,open};watch.rotation.set(.22,-.48,-.1);lid.position.z=.38*Math.max(0,Math.min(1,open));glass.position.z=.49+.08*Math.max(0,Math.min(1,open));hour.rotation.z=-Math.PI/3;minute.rotation.z=Math.PI/3;second.rotation.z=-time*Math.PI/30;gears.forEach(({wheel,speed})=>wheel.rotation.z=time*speed);balance.rotation.z=Math.sin(time*5)*.45;renderer.render(scene,camera);host.dataset.time=time.toFixed(3);host.dataset.openAmount=open.toFixed(4);host.dataset.identity='wristwatch';host.dataset.triangles=String(renderer.info.render.triangles);host.dataset.hands='3';host.dataset.markers='12';host.dataset.gears='4'}
    const raycaster=new T.Raycaster(),face=new T.Plane(new T.Vector3(0,0,1),-.49)
    function proximity(x,y){
      raycaster.setFromCamera(new T.Vector2(x/surface.clientWidth*2-1,1-y/surface.clientHeight*2),camera)
      const ray=raycaster.ray.clone().applyMatrix4(watch.matrixWorld.clone().invert()),point=new T.Vector3()
      return ray.intersectPlane(face,point)?faceProximity(point.x,point.y):0
    }
    function faceProjection(){const p=watch.localToWorld(new T.Vector3(0,0,.49)).project(camera);return {x:(p.x+1)*surface.clientWidth/2,y:(1-p.y)*surface.clientHeight/2}}
    resize();paint()
    return {resize,paint,proximity,faceProjection,destroy,get pose(){return {...pose}},
      snapshotPose(){paint(pose.time,pose.open);return renderer.domElement.toDataURL('image/png')},
      geometry(){
        band.geometry.computeBoundingBox()
        const bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity},v=new T.Vector3()
        watch.updateMatrixWorld(true)
        watch.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).project(camera);bounds.minX=Math.min(bounds.minX,v.x);bounds.maxX=Math.max(bounds.maxX,v.x);bounds.minY=Math.min(bounds.minY,v.y);bounds.maxY=Math.max(bounds.maxY,v.y)}})
        return {balanceSpokes:3,balanceAngle:balance.rotation.z,strap:band.geometry.boundingBox,bezelLift:lid.position.z,glassZ:glass.position.z+lid.position.z,rotation:watch.rotation.toArray(),projectedBounds:bounds}
      },
      snapshot(open=0){const saved=pose;paint(0,open);const png=renderer.domElement.toDataURL('image/png');paint(saved.time,saved.open);return png}}
  } catch(error){destroy();throw error}
}
