import {
  appendSystemFieldWave,
  liveSystemFieldWaves,
  normalizeSystemFieldProgress,
  SYSTEM_FIELD_NODE_COUNT,
  type SystemFieldWave,
  systemFieldNodeState,
} from './systemFieldState'

const SYSTEM_FIELD_CAMERA_FOV = 42
const SYSTEM_FIELD_CAMERA_MIN_DISTANCE = 12.5
const SYSTEM_FIELD_HALF_WIDTH_WITH_MARGIN = 7.1
const POINTER_WAVE_INTERVAL = 180
const POINTER_WAVE_MIN_DISTANCE = 0.1

interface Disposable {
  dispose(): void
}

interface Object3DLike {
  position: { set(x: number, y: number, z: number): void }
  scale: { setScalar(value: number): void }
  updateMatrix(): void
  matrix: unknown
}

interface RendererLike {
  domElement: HTMLCanvasElement
  setPixelRatio(value: number): void
  setSize(width: number, height: number, updateStyle?: boolean): void
  render(scene: unknown, camera: unknown): void
  dispose(): void
  forceContextLoss(): void
}

interface InstancedMeshLike {
  instanceMatrix: { needsUpdate: boolean }
  setMatrixAt(index: number, matrix: unknown): void
  setColorAt(index: number, color: unknown): void
  instanceColor?: { needsUpdate: boolean } | null
}

interface CameraLike {
  aspect: number
  position: { set(x: number, y: number, z: number): void }
  lookAt(x: number, y: number, z: number): void
  updateProjectionMatrix(): void
}

interface LightLike {
  position: { set(x: number, y: number, z: number): void }
  intensity: number
}

interface ColorLike {
  copy(color: unknown): ColorLike
  lerp(color: unknown, alpha: number): ColorLike
}

export interface SystemFieldThree {
  readonly WebGLRenderer: new (options: object) => RendererLike
  readonly Scene: new () => { add(...objects: unknown[]): void }
  readonly PerspectiveCamera: new (
    fieldOfView: number,
    aspect: number,
    near: number,
    far: number,
  ) => CameraLike
  readonly BoxGeometry: new (
    width: number,
    height: number,
    depth: number,
  ) => Disposable
  readonly MeshStandardMaterial: new (options: object) => Disposable
  readonly InstancedMesh: new (
    geometry: unknown,
    material: unknown,
    count: number,
  ) => InstancedMeshLike
  readonly HemisphereLight: new (
    skyColor: number,
    groundColor: number,
    intensity: number,
  ) => unknown
  readonly DirectionalLight: new (
    color: number,
    intensity: number,
  ) => LightLike
  readonly PointLight: new (
    color: number,
    intensity: number,
    distance: number,
    decay: number,
  ) => LightLike
  readonly Object3D: new () => Object3DLike
  readonly Color: new (color: number) => ColorLike
}

export interface SystemFieldRuntimeOptions {
  readonly three: SystemFieldThree
  readonly route: HTMLElement
  readonly stage: HTMLElement
  readonly window: Window
  readonly onContextLoss: () => void
}

export interface SystemFieldRuntime {
  setProgress(progress: number, settling: boolean): void
  addWave(x: number, y: number): void
  resize(): void
  destroy(): void
}

export function createSystemFieldRuntime(
  options: SystemFieldRuntimeOptions,
): SystemFieldRuntime {
  const { route, stage, three, window: win } = options
  let renderer: RendererLike | null = null
  let geometry: Disposable | null = null
  let material: Disposable | null = null
  let frame: number | null = null
  let settling = false
  let progress = 0
  let waves: readonly SystemFieldWave[] = []
  let destroyed = false
  let lastPointerWave = -Infinity
  let lastPointerX: number | null = null
  let lastPointerY: number | null = null

  let scene: { add(...objects: unknown[]): void }
  let camera: CameraLike
  let mesh: InstancedMeshLike
  let signal: LightLike
  let dummy: Object3DLike
  let baseColor: ColorLike
  let signalColor: ColorLike
  let nodeColor: ColorLike

  const handleContextLost = () => options.onContextLoss()

  try {
    scene = new three.Scene()
    camera = new three.PerspectiveCamera(
      SYSTEM_FIELD_CAMERA_FOV,
      1,
      0.1,
      60,
    )
    camera.position.set(
      0,
      0.3,
      SYSTEM_FIELD_CAMERA_MIN_DISTANCE,
    )
    camera.lookAt(0, -0.2, -1.5)

    geometry = new three.BoxGeometry(0.18, 0.18, 0.06)
    material = new three.MeshStandardMaterial({
      color: 0xd8d6cf,
      metalness: 0.24,
      roughness: 0.42,
    })
    mesh = new three.InstancedMesh(
      geometry,
      material,
      SYSTEM_FIELD_NODE_COUNT,
    )
    const hemisphere = new three.HemisphereLight(
      0xf5f1e8,
      0x171717,
      1.15,
    )
    const directional = new three.DirectionalLight(0xd8d6cf, 2.1)
    directional.position.set(-4, 5, 8)
    signal = new three.PointLight(0xff5d2e, 0, 16, 2)
    signal.position.set(0, 0, 3)
    scene.add(mesh, hemisphere, directional, signal)

    dummy = new three.Object3D()
    baseColor = new three.Color(0xd8d6cf)
    signalColor = new three.Color(0xff5d2e)
    nodeColor = new three.Color(0xd8d6cf)
    renderer = new three.WebGLRenderer({ alpha: true, antialias: true })
    const canvas = renderer.domElement
    canvas.className = 'system-field-canvas'
    canvas.setAttribute('aria-hidden', 'true')
    canvas.setAttribute('tabindex', '-1')
    canvas.addEventListener('webglcontextlost', handleContextLost)
    stage.append(canvas)
  } catch (error) {
    renderer?.domElement.removeEventListener(
      'webglcontextlost',
      handleContextLost,
    )
    renderer?.domElement.remove()
    geometry?.dispose()
    material?.dispose()
    renderer?.dispose()
    renderer?.forceContextLoss()
    renderer = null
    geometry = null
    material = null
    throw error
  }

  function resize(scheduleRender = true) {
    if (destroyed || !renderer) return
    const bounds = renderer.domElement.getBoundingClientRect()
    const width = Math.max(1, Math.round(bounds.width))
    const height = Math.max(1, Math.round(bounds.height))
    camera.aspect = width / height
    const halfVerticalFov = SYSTEM_FIELD_CAMERA_FOV * Math.PI / 360
    const horizontalFitDistance = SYSTEM_FIELD_HALF_WIDTH_WITH_MARGIN /
      (Math.tan(halfVerticalFov) * camera.aspect)
    camera.position.set(
      0,
      0.3,
      Math.max(SYSTEM_FIELD_CAMERA_MIN_DISTANCE, horizontalFitDistance),
    )
    camera.lookAt(0, -0.2, -1.5)
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 2))
    renderer.setSize(width, height, false)
    if (scheduleRender) scheduleFrame()
  }

  function render(_frameTime: number) {
    if (destroyed || !renderer) return
    frame = null
    const now = win.performance.now()
    waves = liveSystemFieldWaves(waves, now)
    let peakEnergy = 0

    for (let index = 0; index < SYSTEM_FIELD_NODE_COUNT; index += 1) {
      const node = systemFieldNodeState(index, progress, waves, now)
      dummy.position.set(node.x, node.y, node.z)
      dummy.scale.setScalar(node.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      mesh.setColorAt(
        index,
        nodeColor.copy(baseColor).lerp(signalColor, node.energy),
      )
      peakEnergy = Math.max(peakEnergy, node.energy)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    signal.intensity = 3.8 * peakEnergy
    renderer.render(scene, camera)

    if (settling || waves.length > 0) scheduleFrame()
  }

  function scheduleFrame() {
    if (destroyed || frame !== null) return
    frame = win.requestAnimationFrame(render)
  }

  const handlePointer = (event: MouseEvent | PointerEvent) => {
    if (destroyed) return
    if (
      event.type === 'pointerdown' &&
      'pointerType' in event &&
      event.pointerType === 'mouse'
    ) return
    const now = win.performance.now()
    const bounds = renderer?.domElement.getBoundingClientRect()
    if (!bounds) return
    if (
      event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom
    ) return
    const x = (event.clientX - bounds.left) / Math.max(bounds.width, 1) * 2 - 1
    const y = -((event.clientY - bounds.top) / Math.max(bounds.height, 1) * 2 - 1)
    if (
      event.type === 'mousemove' &&
      (now - lastPointerWave < POINTER_WAVE_INTERVAL ||
        lastPointerX !== null && lastPointerY !== null &&
        Math.hypot(x - lastPointerX, y - lastPointerY) <
          POINTER_WAVE_MIN_DISTANCE)
    ) return
    lastPointerWave = now
    lastPointerX = x
    lastPointerY = y
    waves = appendSystemFieldWave(waves, { x, y, startedAt: now })
    scheduleFrame()
  }

  try {
    // Route-level bubbling keeps pointer/touch input available when semantic
    // beat copy sits above the decorative sticky stage.
    route.addEventListener('pointerdown', handlePointer, { passive: true })
    route.addEventListener('mousemove', handlePointer, { passive: true })
    resize(false)
    render(win.performance.now())
  } catch (error) {
    route.removeEventListener('pointerdown', handlePointer)
    route.removeEventListener('mousemove', handlePointer)
    const ownedRenderer = renderer
    ownedRenderer?.domElement.removeEventListener(
      'webglcontextlost',
      handleContextLost,
    )
    ownedRenderer?.domElement.remove()
    geometry?.dispose()
    material?.dispose()
    ownedRenderer?.dispose()
    ownedRenderer?.forceContextLoss()
    renderer = null
    geometry = null
    material = null
    throw error
  }

  return Object.freeze({
    setProgress(nextProgress: number, nextSettling: boolean) {
      if (destroyed) return
      progress = normalizeSystemFieldProgress(nextProgress)
      settling = nextSettling
      scheduleFrame()
    },
    addWave(x: number, y: number) {
      if (destroyed) return
      waves = appendSystemFieldWave(waves, {
        x,
        y,
        startedAt: win.performance.now(),
      })
      scheduleFrame()
    },
    resize,
    destroy() {
      if (destroyed) return
      destroyed = true
      if (frame !== null) win.cancelAnimationFrame(frame)
      frame = null
      route.removeEventListener('pointerdown', handlePointer)
      route.removeEventListener('mousemove', handlePointer)
      const ownedRenderer = renderer
      renderer = null
      ownedRenderer?.domElement.removeEventListener(
        'webglcontextlost',
        handleContextLost,
      )
      geometry?.dispose()
      geometry = null
      material?.dispose()
      material = null
      ownedRenderer?.dispose()
      ownedRenderer?.forceContextLoss()
      ownedRenderer?.domElement.remove()
      waves = []
    },
  })
}
