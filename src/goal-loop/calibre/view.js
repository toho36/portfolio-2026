import { GEARS, gearOutline, layers } from './model'

export function createCalibre(T, OrbitControls, stage, changed) {
  const document = stage.ownerDocument
  const devicePixelRatio = document.defaultView?.devicePixelRatio || 1
  let renderer, controls, environment, pmrem, disposed = false, cameraActive = true
  const resources = new Set(), scene = new T.Scene(), root = new T.Group(), clickable = []
  const keep = value => { resources.add(value); return value }
  scene.add(root)
  function destroy() {
    if (disposed) return
    disposed = true
    controls?.dispose()
    scene.traverse(object => object.shadow?.dispose())
    for (const resource of resources) resource.dispose()
    environment?.dispose(); pmrem?.dispose()
    renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove()
  }
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5))
    renderer.outputColorSpace = T.SRGBColorSpace
    renderer.toneMapping = T.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = T.PCFSoftShadowMap
    renderer.domElement.setAttribute('aria-hidden', 'true')
    stage.append(renderer.domElement)
    const camera = new T.OrthographicCamera(-4.6, 4.6, 3.4, -3.4, .1, 60)
    camera.up.set(0, 0, 1)
    camera.position.set(4, -7, 7.2)
    controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0, .85)
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = .14
    controls.rotateSpeed = .7
    controls.zoomSpeed = .8
    controls.minZoom = .65; controls.maxZoom = 2.4
    controls.minPolarAngle = .12; controls.maxPolarAngle = Math.PI * .48
    renderer.domElement.style.touchAction = 'pan-y'
    controls.update(); controls.saveState()
    const cameraChanged = () => { cameraActive = true; changed() }
    controls.addEventListener('change', cameraChanged)
    controls.addEventListener('start', cameraChanged)
    controls.addEventListener('end', cameraChanged)
    const silver = keep(new T.MeshStandardMaterial({ color: '#b9c0c0', metalness: .94, roughness: .26 }))
    const edge = keep(new T.MeshStandardMaterial({ color: '#d7dcda', metalness: .86, roughness: .24 }))
    const brass = keep(new T.MeshStandardMaterial({ color: '#bba266', metalness: .85, roughness: .31 }))
    const brightBrass = keep(new T.MeshStandardMaterial({ color: '#dac28b', metalness: .82, roughness: .25 }))
    const steel = keep(new T.MeshStandardMaterial({ color: '#545f65', metalness: .9, roughness: .24 }))
    const dark = keep(new T.MeshStandardMaterial({ color: '#2e393e', metalness: .72, roughness: .38 }))
    const ruby = keep(new T.MeshPhysicalMaterial({ color: '#832c49', metalness: .08, roughness: .16, clearcoat: 1 }))
    const floorMaterial = keep(new T.ShadowMaterial({ color: '#596458', opacity: .18 }))
    const envCanvas = document.createElement('canvas')
    envCanvas.width = 512; envCanvas.height = 256
    const ctx = envCanvas.getContext('2d')
    const gradient = ctx.createLinearGradient(0, 0, 0, 256)
    gradient.addColorStop(0, '#f2eee4'); gradient.addColorStop(.55, '#bab7ad'); gradient.addColorStop(1, '#606762')
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 512, 256)
    ctx.fillStyle = '#fffef7'; ctx.fillRect(15, 15, 135, 170); ctx.fillRect(290, 30, 155, 105)
    const envTexture = keep(new T.CanvasTexture(envCanvas))
    envTexture.mapping = T.EquirectangularReflectionMapping; envTexture.colorSpace = T.SRGBColorSpace
    pmrem = new T.PMREMGenerator(renderer); environment = pmrem.fromEquirectangular(envTexture)
    scene.environment = environment.texture; scene.environmentIntensity = 1.2
    const grainCanvas = document.createElement('canvas')
    grainCanvas.width = 512; grainCanvas.height = 128
    const grain = grainCanvas.getContext('2d')
    grain.fillStyle = '#aaa'; grain.fillRect(0, 0, 512, 128)
    let seed = 112
    for (let i = 0; i < 1300; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      const value = 90 + seed % 90
      grain.strokeStyle = `rgb(${value},${value},${value})`; grain.lineWidth = .35
      grain.beginPath(); grain.moveTo(0, seed % 128); grain.lineTo(512, seed % 128); grain.stroke()
    }
    const grainTexture = keep(new T.CanvasTexture(grainCanvas))
    grainTexture.wrapS = grainTexture.wrapT = T.RepeatWrapping; grainTexture.repeat.set(.7, .7)
    silver.roughnessMap = grainTexture; silver.bumpMap = grainTexture; silver.bumpScale = .003
    scene.add(new T.HemisphereLight('#fff9ed', '#88918a', .7))
    const keyLight = new T.DirectionalLight('#fff5e1', 2.2)
    keyLight.position.set(-4, -3, 10); keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    Object.assign(keyLight.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: .1, far: 25 })
    keyLight.shadow.bias = -.0005
    scene.add(keyLight)
    const fill = new T.DirectionalLight('#e4edf1', .8); fill.position.set(5, 4, 6); scene.add(fill)
    const units = {}
    for (const id of ['plate', 'barrel', 'train', 'balance', 'bridges']) {
      const group = new T.Group(); group.userData.part = id; units[id] = group; root.add(group)
    }
    const partMaterials = new Map()
    function mesh(geometry, material, parent) {
      let owner = parent
      while (owner && !owner.userData.part) owner = owner.parent
      if (owner?.userData.part) {
        const id = owner.userData.part
        if (!partMaterials.has(id)) partMaterials.set(id, new Map())
        const set = partMaterials.get(id)
        if (!set.has(material)) set.set(material, keep(material.clone()))
        material = set.get(material)
      }
      const object = new T.Mesh(keep(geometry), material)
      object.castShadow = true; object.receiveShadow = true
      parent.add(object); clickable.push(object)
      return object
    }
    function shape(points) {
      const s = new T.Shape(); points.forEach(([x,y],i) => i ? s.lineTo(x,y) : s.moveTo(x,y)); s.closePath(); return s
    }
    function extrude(profile, depth, material, parent, bevel = .02) {
      return mesh(new T.ExtrudeGeometry(profile, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 20, steps: 1 }), material, parent)
    }
    function disc(radius, depth, material, parent, hole = 0) {
      const s = new T.Shape(); s.absarc(0, 0, radius, 0, Math.PI * 2, false)
      if (hole) { const h = new T.Path(); h.absarc(0, 0, hole, 0, Math.PI * 2, true); s.holes.push(h) }
      return extrude(s, depth, material, parent)
    }
    function screw(x,y,z,parent,size=.09) {
      const collar = disc(size * 1.4, .025, edge, parent); collar.position.set(x,y,z)
      const head = disc(size, .065, steel, parent); head.position.set(x,y,z+.03)
      const slot = mesh(new T.BoxGeometry(size * 1.35, .025, .012), dark, parent); slot.position.set(x,y,z+.10); slot.rotation.z=.35
    }
    function bearing(x,y,z,parent,size=.11) {
      const setting=disc(size*1.45,.055,brightBrass,parent,size*.5);setting.position.set(x,y,z)
      const stone=disc(size,.055,ruby,parent,size*.32);stone.position.set(x,y,z+.055)
      const axle=disc(size*.3,.07,steel,parent);axle.position.set(x,y,z+.09)
    }
    const plateShape = new T.Shape(); plateShape.absarc(0,0,3.04,0,Math.PI*2,false)
    for (const [x,y,r] of [[-1.35,.8,.6],[.6,1.6,.35],[1.25,-1.1,.73],[-.8,-1.4,.26],[.2,-.3,.24]]) {
      const h=new T.Path();h.absarc(x,y,r,0,Math.PI*2,true);plateShape.holes.push(h)
    }
    extrude(plateShape,.16,silver,units.plate)
    const rim=disc(3.09,.13,edge,units.plate,2.91);rim.position.z=-.05
    const bottom=disc(2.88,.045,dark,units.plate);bottom.position.z=-.075
    for(let i=0;i<14;i++) {
      const angle=i/14*Math.PI*2, x=Math.cos(angle)*2.84, y=Math.sin(angle)*2.84
      if(i%2===0) screw(x,y,.16,units.plate,.075)
      else {const well=disc(.10,.025,dark,units.plate);well.position.set(x,y,.17)}
    }
    for(const [x,y] of [[-.12,.62],[.55,1.6],[1.6,.75],[-.75,-.73],[1.25,-1.15]]) {
      const post=disc(.065,.50,steel,units.plate);post.position.set(x,y,.15)
      bearing(x,y,.17,units.plate,.08)
    }
    const barrelRoot=new T.Group();units.barrel.add(barrelRoot);barrelRoot.position.set(-1.32,.72,0)
    const barrelWall=disc(.98,.20,brass,barrelRoot,.84)
    const barrelBottom=disc(.94,.055,brightBrass,barrelRoot);barrelBottom.position.z=.015
    const coilPoints=[]
    for(let i=0;i<=360;i++) {const a=i/360*Math.PI*2*7,r=.1+i/360*.66;coilPoints.push(new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,.13))}
    mesh(new T.TubeGeometry(new T.CatmullRomCurve3(coilPoints),360,.017,5,false),steel,barrelRoot)
    const barrelTop=disc(.98,.055,brass,barrelRoot,.53);barrelTop.position.z=.20

    // Open circular window preserves the visible coiled energy store.
    const windowCut=new T.Path();windowCut.absarc(0,0,.50,0,Math.PI*2,true)
    const barrelGearShape=shape(gearOutline(.98,54));barrelGearShape.holes.push(windowCut)

    const gearedRim=extrude(barrelGearShape,.055,brightBrass,barrelRoot,.01);gearedRim.position.z=.22
    bearing(0,0,.23,barrelRoot,.10)
    function wheel(radius, teeth, parent) {
      const group=new T.Group();parent.add(group)
      const outline=shape(gearOutline(radius,teeth))
      const centre=new T.Path();centre.absarc(0,0,.055,0,Math.PI*2,true);outline.holes.push(centre)
      for(let i=0;i<5;i++) {
        const a=i/5*Math.PI*2, h=new T.Path(), r=radius*.50
        h.absellipse(Math.cos(a)*r,Math.sin(a)*r,radius*.15,radius*.25,0,Math.PI*2,true,a)
        outline.holes.push(h)
      }
      extrude(outline,.075,brass,group,.01)
      const hub=disc(radius*.18,.10,brightBrass,group,.045);hub.position.z=.045
      return group
    }
    const wheels=GEARS.map((g,i)=>{const group=wheel(g.radius,g.teeth,units.train);group.position.set(g.x,g.y,i%2*.055);bearing(g.x,g.y,.13+i%2*.055,units.train,.08);return group})
    const balanceRoot=new T.Group();units.balance.add(balanceRoot);balanceRoot.position.set(1.25,-1.15,0)
    const balanceWheel=new T.Group();balanceRoot.add(balanceWheel)
    disc(1.03,.08,brightBrass,balanceWheel,.91)
    for(let i=0;i<3;i++) {
      const arm=extrude(shape([[-.06,.12],[.06,.12],[.13,.82],[.04,.94],[-.04,.94],[-.13,.82]]),.065,brass,balanceWheel,.01)
      arm.rotation.z=i/3*Math.PI*2;arm.position.z=.015
    }
    const springPoints=[]
    for(let i=0;i<=480;i++) {const a=i/480*Math.PI*2*9,r=.055+i/480*.67;springPoints.push(new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,.13))}
    const spring=mesh(new T.TubeGeometry(new T.CatmullRomCurve3(springPoints),480,.012,5,false),steel,balanceRoot)
    bearing(0,0,.18,balanceRoot,.105)
    const balanceBridge=extrude(shape([[-.17,-.13],[.18,-.14],[.92,.37],[.99,.57],[.80,.69],[.08,.26],[-.22,.14]]),.10,silver,balanceRoot,.025)
    balanceBridge.position.z=.26;bearing(0,0,.36,balanceRoot,.085);screw(.88,.51,.36,balanceRoot,.075)
    const escape=wheel(.38,18,units.balance);escape.position.set(.3,-.28,-.025)
    const fork=extrude(shape([[-.1,-.08],[.1,-.08],[.23,.23],[.38,.29],[.4,.39],[.17,.39],[0,.12],[-.17,.39],[-.32,.38],[-.30,.27],[-.18,.2]]),.04,steel,units.balance,.008)
    fork.position.set(.48,-.62,.12)
    bearing(.48,-.62,.16,units.balance,.065)
    const bridgeShape=new T.Shape()
    bridgeShape.moveTo(-2.53,-1.10);bridgeShape.bezierCurveTo(-2.9,.1,-2.4,2.1,-1.6,2.48)
    bridgeShape.bezierCurveTo(-.95,2.75,-.15,2.63,.05,2.20)
    bridgeShape.bezierCurveTo(.19,1.6,-.40,1.2,-.13,.76)
    bridgeShape.bezierCurveTo(.23,.19,-.13,-.22,-.59,-.52)
    bridgeShape.bezierCurveTo(-1.13,-.86,-.84,-1.7,-1.5,-1.86)
    bridgeShape.bezierCurveTo(-1.95,-1.95,-2.4,-1.62,-2.53,-1.10)
    for(const [x,y,rx,ry,angle] of [[-1.7,1.15,.32,.74,-.3],[-1.33,-.5,.29,.65,-.9],[-.69,1.9,.19,.34,.5]]) {
      const hole=new T.Path();hole.absellipse(x,y,rx,ry,0,Math.PI*2,true,angle);bridgeShape.holes.push(hole)
    }
    extrude(bridgeShape,.16,silver,units.bridges,.035)
    for(const [x,y] of [[-2.35,-1.18],[-1.52,-1.62],[-1.25,2.34],[-.34,2.1]]) screw(x,y,.16,units.bridges)
    bearing(-.12,.62,.16,units.bridges,.11)
    const upperBridge=extrude(shape([[.47,2.29],[1.28,2.42],[2.38,1.54],[2.55,.51],[2.18,.26],[1.82,.54],[1.75,1.2],[1.17,1.72],[.64,1.89]]),.14,silver,units.bridges,.035)
    screw(.71,2.06,.14,units.bridges);screw(2.27,.52,.14,units.bridges);bearing(1.6,.75,.14,units.bridges,.1)
    const floor=mesh(new T.PlaneGeometry(100,100),floorMaterial,scene);floor.position.z=-.13;floor.castShadow=false
    clickable.splice(clickable.indexOf(floor),1)
    let width=1,height=1
    function resize() {
      width=stage.clientWidth;height=stage.clientHeight
      const span=width<620?8.4:Math.max(8.8,6.0*width/height)
      camera.left=-span/2;camera.right=span/2;camera.top=span/(width/height)/2;camera.bottom=-camera.top
      camera.updateProjectionMatrix();renderer.setSize(width,height,false)
    }
    const raycaster=new T.Raycaster()
    function pick(x,y) {
      const b=renderer.domElement.getBoundingClientRect()
      raycaster.setFromCamera(new T.Vector2((x-b.x)/b.width*2-1,1-(y-b.y)/b.height*2),camera)
      const hits=raycaster.intersectObjects(clickable,false)
      for(const hit of hits) {let node=hit.object;while(node&&!node.userData.part)node=node.parent;if(node?.userData.part)return node.userData.part}
      return null
    }
    function bounds() {
      const box=new T.Box3().setFromObject(root), points=[]
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]) {
        const p=new T.Vector3(x,y,z).project(camera);points.push([(p.x+1)*width/2,(1-p.y)*height/2])
      }
      const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)}
    }
    resize()
    return {
      destroy, resize, pick,
      cameraState:()=>({position:camera.position.toArray(),zoom:camera.zoom,polar:controls.getPolarAngle(),azimuth:controls.getAzimuthalAngle()}),
      restoreCamera(snapshot){camera.position.fromArray(snapshot.position);camera.zoom=snapshot.zoom;camera.updateProjectionMatrix();controls.update();cameraActive=true},
      zoomBy(amount){camera.zoom=Math.max(controls.minZoom,Math.min(controls.maxZoom,camera.zoom*amount));camera.updateProjectionMatrix();controls.update();changed()},
      orbitBy(angle){camera.position.sub(controls.target).applyAxisAngle(camera.up,angle).add(controls.target);controls.update();changed()},
      reset(){controls.reset();changed()},
      atZoomLimit(delta){return delta<0?camera.zoom>=controls.maxZoom-.001:camera.zoom<=controls.minZoom+.001},
      render(time,open,selected,trainTime){
        if(disposed)return null
        const pose=layers(open)

        for(const [id,group] of Object.entries(units))group.position.z=pose[id]

        wheels.forEach((wheel,i)=>{wheel.rotation.z=trainTime*GEARS[i].speed})
        balanceWheel.rotation.z=Math.sin(time*4.2)*.55
        spring.scale.setScalar(1+Math.sin(time*4.2)*.025)
        fork.rotation.z=Math.sin(time*4.2)*.12
        escape.rotation.z=Math.floor(time*4.2/Math.PI)*(-Math.PI*2/18)
        for(const mesh of clickable){if(mesh.material.emissive){let node=mesh;while(node&&!node.userData.part)node=node.parent;mesh.material.emissive.set(node?.userData.part===selected?'#171109':'#000000')}}
        const moving=cameraActive ? controls.update() : false
        cameraActive=moving
        scene.updateMatrixWorld(true);renderer.render(scene,camera)
        return {bounds:bounds(),moving,triangles:renderer.info.render.triangles,balanceAngle:balanceWheel.rotation.z,trainAngles:wheels.map(w=>w.rotation.z)}
      },
    }
  } catch(error){destroy();throw error}
}
