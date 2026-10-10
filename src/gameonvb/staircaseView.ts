import { RADIUS, TREADS, surfaceAt, type StairBall } from './stairBall'

export interface StaircaseView {
  resize(): void
  point(x: number, y: number): { x: number; y: number }
  paint(state: Readonly<StairBall>, impact: number): { x: number; y: number; diameter: number }
  destroy(): void
  readonly canvas: HTMLCanvasElement
}

export function createStaircaseView(T: any, stage: HTMLElement): StaircaseView {
  const document = stage.ownerDocument
  const stoneCanvas = document.createElement('canvas')
  stoneCanvas.width = stoneCanvas.height = 512
  const ctx = stoneCanvas.getContext('2d')
  if (!ctx) throw new Error('Canvas texture unavailable')
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
  const canvas = renderer.domElement
  const disposables = new Set<{ dispose(): void }>()
  let disposed = false
  function own<R extends { dispose(): void }>(resource: R): R { disposables.add(resource); return resource }
  function destroy() {
    if (disposed) return
    disposed = true
    try { for (const resource of disposables) resource.dispose() }
    finally {
      try { renderer.dispose() }
      finally { try { renderer.forceContextLoss() } finally { canvas.remove() } }
    }
  }
  try {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5))
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T.PCFShadowMap
  canvas.setAttribute('aria-hidden', 'true')
  stage.append(canvas)
  const scene = new T.Scene()
  const camera = new T.OrthographicCamera(-6, 6, 5, -5, 0.1, 80)
  camera.position.set(7, 8, 15)
  camera.lookAt(0, 0.6, 0)
  camera.updateMatrixWorld()
  function mesh(geometry: any, material: any, parent = scene) {
    own(geometry); own(material)
    const object = new T.Mesh(geometry, material)
    parent.add(object)
    return object
  }
  scene.add(new T.HemisphereLight('#f2ecd9', '#171b20', 1.5))
  const key = new T.DirectionalLight('#ffe6b4', 4)
  own(key.shadow)
  key.position.set(-4, 10, 7)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 9, bottom: -9, near: 0.1, far: 40 })
  key.shadow.bias = -0.001
  scene.add(key)
  const rim = new T.DirectionalLight('#c8d8e6', 1.8)
  rim.position.set(8, 4, -6)
  scene.add(rim)
  let seed = 91
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  ctx.fillStyle = '#343630'
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 17000; i++) {
    const value = 40 + Math.floor(random() * 36)
    ctx.fillStyle = `rgba(${value},${value},${value},.24)`
    ctx.fillRect(random() * 512, random() * 512, 2, 2)
  }
  for (let line = 0; line < 15; line++) {
    let x = random() * 512, y = random() * 512
    ctx.beginPath(); ctx.moveTo(x, y)
    for (let i = 0; i < 10; i++) { x += random() * 75 - 20; y += random() * 65 - 24; ctx.lineTo(x, y) }
    ctx.strokeStyle = 'rgba(164,147,110,.16)'; ctx.lineWidth = random() * 1.5 + .3; ctx.stroke()
  }
  const texture = own(new T.CanvasTexture(stoneCanvas))
  texture.colorSpace = T.SRGBColorSpace
  texture.wrapS = texture.wrapT = T.RepeatWrapping
  const stone = own(new T.MeshStandardMaterial({ color: '#a0a394', map: texture, bumpMap: texture, bumpScale: .025, roughness: .72, metalness: .08 }))
  const trims: any[] = []
  TREADS.forEach((tread, i) => {
    const height = tread.y + 5.2
    const block = mesh(new T.BoxGeometry(tread.right - tread.left, height, 11), stone)
    block.position.set((tread.left + tread.right) / 2, tread.y - height / 2, -3.8)
    block.receiveShadow = true
    const material = own(new T.MeshStandardMaterial({ color: '#957846', emissive: '#e59c38', emissiveIntensity: .04, roughness: .42, metalness: .3 }))
    trims.push(material)
    const front = mesh(new T.BoxGeometry(3.2, .018, .018), material)
    front.position.set((tread.left + tread.right) / 2, tread.y + .012, 1.7)
    const edge = mesh(new T.BoxGeometry(.018, .018, 11), material)
    edge.position.set(tread.right - .008, tread.y + .012, -3.8)
  })
  const sphere = new T.Group()
  scene.add(sphere)
  const seam = own(new T.MeshStandardMaterial({ color: '#2b2921', roughness: .85 }))
  const core = mesh(new T.SphereGeometry(RADIUS * .994, 40, 28), seam, sphere)
  core.castShadow = true
  const palette = ['#e8dfc6', '#e8dfc6', '#242a2b', '#e8dfc6', '#d7af32', '#242a2b']
  const materials = palette.map(color => own(new T.MeshStandardMaterial({ color, roughness: .56, metalness: .02 })))
  // Each cube face becomes three curved panels on the same spherical shell.
  for (let face = 0; face < 6; face++) {
    for (let band = 0; band < 3; band++) {
      const positions = [], indices = [], resolution = 18
      for (let row = 0; row <= resolution; row++) {
        for (let col = 0; col <= resolution; col++) {
          const u = -1 + band * 2 / 3 + .009 + (2 / 3 - .018) * col / resolution
          const v = -.991 + 1.982 * row / resolution
          const coordinates = [[1, u, v], [-1, v, u], [v, 1, u], [u, -1, v], [u, v, 1], [v, u, -1]][face]
          const point = new T.Vector3(...coordinates).normalize().multiplyScalar(RADIUS)
          positions.push(point.x, point.y, point.z)
          if (row < resolution && col < resolution) {
            const a = row * (resolution + 1) + col, b = a + resolution + 1
            indices.push(a, b, a + 1, b, b + 1, a + 1)
          }
        }
      }
      const geometry = own(new T.BufferGeometry())
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
      geometry.setIndex(indices)
      geometry.computeVertexNormals()
      const material = materials[(face + band * 2) % materials.length]
      material.side = T.DoubleSide
      material.forceSinglePass = true
      mesh(geometry, material, sphere)
    }
  }
  const ringMaterial = own(new T.MeshBasicMaterial({ color: '#ffa443', transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }))
  const ring = mesh(new T.RingGeometry(.65, .69, 56), ringMaterial)
  ring.rotation.x = -Math.PI / 2
  const glow = new T.PointLight('#ff842b', 0, 5)
  scene.add(glow)
  const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 0, 1), 0)
  let width = 1, height = 1
  function resize() {
    width = Math.max(1, stage.clientWidth); height = Math.max(1, stage.clientHeight)
    const aspect = width / height
    const vertical = Math.max(8.2, 9.4 / aspect)
    camera.left = -vertical * aspect / 2; camera.right = vertical * aspect / 2
    camera.top = vertical / 2; camera.bottom = -vertical / 2
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }
  resize()
  return {
    resize,
    point(x: number, y: number) {
      const rect = canvas.getBoundingClientRect()
      ray.setFromCamera(new T.Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2), camera)
      return ray.ray.intersectPlane(plane, new T.Vector3()) ?? new T.Vector3(sphere.position.x, sphere.position.y, 0)
    },
    paint(state: Readonly<StairBall>, impact: number) {
      sphere.position.set(state.x, state.y, 0)
      sphere.rotation.set(.25, .45, state.angle)
      const floor = surfaceAt(state.x)
      ring.position.set(state.x, floor.y + .024, 0)
      ring.scale.setScalar(1 + (1 - impact) * 1.8)
      ringMaterial.opacity = impact * .45
      ring.visible = impact > 0
      trims.forEach((material, i) => { material.emissiveIntensity = .04 + (i === state.landing ? impact * .8 : 0) })
      glow.position.set(state.x, floor.y + .25, 1.2)
      glow.intensity = impact * 2.2
      renderer.render(scene, camera)
      const position = sphere.position.clone().project(camera)
      const diameter = 2 * RADIUS / (camera.top - camera.bottom) * height
      stage.dataset.draws = String(renderer.info.render.calls)
      stage.dataset.triangles = String(renderer.info.render.triangles)
      return { x: (position.x + 1) * width / 2, y: (1 - position.y) * height / 2, diameter }
    },
    destroy,
    canvas,
  }
  } catch (error) {
    destroy()
    throw error
  }
}
