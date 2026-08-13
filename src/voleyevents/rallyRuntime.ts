export const RALLY_THREE_MEMBERS = [
  'WebGLRenderer',
  'Scene',
  'PerspectiveCamera',
  'Group',
  'Mesh',
  'LineSegments',
  'BufferGeometry',
  'Float32BufferAttribute',
  'SphereGeometry',
  'PlaneGeometry',
  'MeshStandardMaterial',
  'MeshBasicMaterial',
  'LineBasicMaterial',
  'AmbientLight',
  'DirectionalLight',
  'Color',
  'Vector2',
  'Vector3',
] as const

const COURT_WIDTH = 5.4
const COURT_HEIGHT = 2.8
const CAMERA_FOV = 42
const WAVE_CAP = 2
const WAVE_LIFETIME = 720

interface Disposable {
  dispose(): void
}

interface TransformLike {
  set(x: number, y: number, z: number): void
  setScalar?(value: number): void
  x?: number
  y?: number
  z?: number
}

interface ObjectLike {
  readonly position: TransformLike
  readonly rotation: TransformLike
  readonly scale: TransformLike
  visible: boolean
  add(...objects: unknown[]): void
}

interface MaterialLike extends Disposable {
  opacity: number
  transparent: boolean
}

interface GeometryLike extends Disposable {
  setAttribute?(name: string, attribute: unknown): void
}

interface CameraLike extends ObjectLike {
  aspect: number
  lookAt(x: number, y: number, z: number): void
  updateProjectionMatrix(): void
}

interface RendererLike {
  readonly domElement: HTMLCanvasElement
  setPixelRatio(value: number): void
  setSize(width: number, height: number, updateStyle?: boolean): void
  render(scene: unknown, camera: unknown): void
  dispose(): void
  forceContextLoss(): void
}

type Constructor<T, TArguments extends readonly unknown[] = readonly unknown[]> =
  new (...arguments_: TArguments) => T

/** Precise structural view over the already validated loader facade. */
export interface RallyStaircaseThree {
  readonly WebGLRenderer: Constructor<RendererLike, [options: object]>
  readonly Scene: Constructor<ObjectLike, []>
  readonly PerspectiveCamera: Constructor<
    CameraLike,
    [fieldOfView: number, aspect: number, near: number, far: number]
  >
  readonly Group: Constructor<ObjectLike, []>
  readonly Mesh: Constructor<ObjectLike, [geometry: unknown, material: unknown]>
  readonly LineSegments: Constructor<ObjectLike, [geometry: unknown, material: unknown]>
  readonly BufferGeometry: Constructor<GeometryLike, []>
  readonly Float32BufferAttribute: Constructor<unknown, [array: readonly number[], itemSize: number]>
  readonly SphereGeometry: Constructor<GeometryLike, [radius: number, widthSegments: number, heightSegments: number]>
  readonly PlaneGeometry: Constructor<GeometryLike, [width: number, height: number]>
  readonly MeshStandardMaterial: Constructor<MaterialLike, [options: object]>
  readonly MeshBasicMaterial: Constructor<MaterialLike, [options: object]>
  readonly LineBasicMaterial: Constructor<MaterialLike, [options: object]>
  readonly AmbientLight: Constructor<ObjectLike, [color: number, intensity: number]>
  readonly DirectionalLight: Constructor<ObjectLike, [color: number, intensity: number]>
  readonly Color: Constructor<unknown, [color?: number]>
  readonly Vector2: Constructor<unknown, [x?: number, y?: number]>
  readonly Vector3: Constructor<unknown, [x?: number, y?: number, z?: number]>
}

export interface RallyRendererWindow {
  readonly devicePixelRatio: number
}

export interface RallyCourtFrame {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly rotationX: number
  readonly scale: number
  readonly opacity: number
}

export interface RallyStaircaseFrame {
  readonly courts: readonly RallyCourtFrame[]
  readonly ball: {
    readonly x: number
    readonly y: number
    readonly z: number
    readonly spin: number
  }
  readonly camera: {
    readonly x: number
    readonly y: number
    readonly z: number
    readonly targetX: number
    readonly targetY: number
    readonly targetZ: number
  }
}

export interface RallyStaircaseRuntime {
  setProgress(progress: number): void
  impact(index: number, now?: number): void
  /** Renders one bounded settle frame and reports whether another is needed. */
  render(now?: number): boolean
  resize(): void
  destroy(): void
}

export interface RallyStaircaseRuntimeOptions {
  readonly three: RallyStaircaseThree
  readonly stage: HTMLElement
  readonly window: RallyRendererWindow
  readonly now: () => number
  readonly onSurrender: () => void
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function smoothstep(value: number) {
  const normalized = clamp(value)
  return normalized * normalized * (3 - 2 * normalized)
}

function interpolate(from: number, to: number, progress: number) {
  return from + (to - from) * progress
}

const COURT_STOPS = Object.freeze([
  { x: 0, y: 0, z: 0 },
  { x: 3.05, y: -1.25, z: -3.1 },
  { x: -3.05, y: -2.5, z: -6.2 },
  { x: 3.05, y: -3.75, z: -9.3 },
  { x: -3.05, y: -5, z: -12.4 },
])

/** History-free authored state; effects never feed back into this frame. */
export function rallyStaircaseFrame(progress: number): RallyStaircaseFrame {
  const normalized = clamp(progress)
  const scaled = normalized * 4
  const segment = Math.min(3, Math.floor(scaled))
  const local = normalized === 1 ? 1 : scaled - segment
  const easedLocal = smoothstep(local)
  const from = COURT_STOPS[segment]
  const to = COURT_STOPS[Math.min(4, segment + 1)]

  const courts = COURT_STOPS.map((stop, index) => {
    const unfold = index === 0
      ? 1
      : smoothstep((normalized - (index - 1) / 4) * 4)
    return Object.freeze({
      ...stop,
      rotationX: -1.02 + (1 - unfold) * 0.58,
      scale: 0.96 + unfold * 0.24,
      opacity: 0.28 + unfold * 0.72,
    })
  })

  return Object.freeze({
    courts: Object.freeze(courts),
    ball: Object.freeze({
      x: interpolate(from.x, to.x, easedLocal),
      y: interpolate(from.y, to.y, easedLocal) + Math.sin(local * Math.PI) * 1.55,
      z: interpolate(from.z, to.z, easedLocal) + 0.42,
      spin: normalized * Math.PI * 10,
    }),
    camera: Object.freeze({
      x: Math.sin(normalized * Math.PI * 1.5) * 1.15,
      y: 2.7 - normalized * 2.35,
      z: 9.2 - normalized * 3.1,
      targetX: 0,
      targetY: -1.2 - normalized * 3.3,
      targetZ: -2.6 - normalized * 8.1,
    }),
  })
}

function disposeAll(resources: readonly Disposable[]) {
  for (const resource of resources) resource.dispose()
}

function courtLinePositions() {
  const halfWidth = COURT_WIDTH / 2
  const halfHeight = COURT_HEIGHT / 2
  return [
    -halfWidth, -halfHeight, 0.012, halfWidth, -halfHeight, 0.012,
    halfWidth, -halfHeight, 0.012, halfWidth, halfHeight, 0.012,
    halfWidth, halfHeight, 0.012, -halfWidth, halfHeight, 0.012,
    -halfWidth, halfHeight, 0.012, -halfWidth, -halfHeight, 0.012,
    0, -halfHeight, 0.012, 0, halfHeight, 0.012,
    -halfWidth, -0.92, 0.012, halfWidth, -0.92, 0.012,
    -halfWidth, 0.92, 0.012, halfWidth, 0.92, 0.012,
  ]
}

function seamPositions() {
  const segments = 18
  const positions: number[] = []
  for (let index = 0; index < segments; index += 1) {
    const from = index / segments * Math.PI * 2
    const to = (index + 1) / segments * Math.PI * 2
    positions.push(
      Math.cos(from) * 0.445, Math.sin(from) * 0.445, 0.125,
      Math.cos(to) * 0.445, Math.sin(to) * 0.445, 0.125,
      0.125, Math.cos(from) * 0.445, Math.sin(from) * 0.445,
      0.125, Math.cos(to) * 0.445, Math.sin(to) * 0.445,
    )
  }
  return positions
}

export function createRallyStaircaseRuntime(
  options: RallyStaircaseRuntimeOptions,
): RallyStaircaseRuntime {
  const { three, stage } = options
  for (const member of RALLY_THREE_MEMBERS) {
    if (typeof three[member] !== 'function') {
      throw new TypeError(`Rally Three facade does not expose ${member}`)
    }
  }

  const geometries: GeometryLike[] = []
  const materials: MaterialLike[] = []
  const courtGroups: ObjectLike[] = []
  const courtMaterials: MaterialLike[] = []
  const waves: Array<{
    readonly mesh: ObjectLike
    readonly material: MaterialLike
    index: number
    startedAt: number
  }> = []
  let renderer: RendererLike | null = null
  let canvas: HTMLCanvasElement | null = null
  let scene: ObjectLike
  let camera: CameraLike
  let ball: ObjectLike
  let destroyed = false
  let surrendered = false
  let progress = 0
  let liveWaveCap = WAVE_CAP

  const ownGeometry = <T extends GeometryLike>(resource: T) => {
    geometries.push(resource)
    return resource
  }
  const ownMaterial = <T extends MaterialLike>(resource: T) => {
    materials.push(resource)
    return resource
  }

  const surrender = () => {
    if (destroyed || surrendered) return
    surrendered = true
    try {
      options.onSurrender()
    } finally {
      cleanup()
    }
  }
  const handleContextLoss = (event: Event) => {
    event.preventDefault()
    surrender()
  }

  function cleanup() {
    if (destroyed) return
    destroyed = true
    const ownedRenderer = renderer
    const ownedCanvas = canvas
    renderer = null
    canvas = null
    ownedCanvas?.removeEventListener('webglcontextlost', handleContextLoss)
    disposeAll(geometries)
    disposeAll(materials)
    ownedRenderer?.dispose()
    ownedRenderer?.forceContextLoss()
    ownedCanvas?.remove()
    waves.length = 0
  }

  function applyFrame(frame: RallyStaircaseFrame) {
    frame.courts.forEach((state, index) => {
      const group = courtGroups[index]
      group.position.set(state.x, state.y, state.z)
      group.rotation.set(state.rotationX, 0, 0)
      group.scale.set(state.scale, state.scale, state.scale)
      courtMaterials[index].opacity = state.opacity
    })
    ball.position.set(frame.ball.x, frame.ball.y, frame.ball.z)
    ball.rotation.set(frame.ball.spin * 0.42, frame.ball.spin, frame.ball.spin * 0.16)
    camera.position.set(frame.camera.x, frame.camera.y, frame.camera.z)
    camera.lookAt(frame.camera.targetX, frame.camera.targetY, frame.camera.targetZ)
  }

  function applyWaves(now: number) {
    let active = false
    const frame = rallyStaircaseFrame(progress)
    for (const [slotIndex, wave] of waves.entries()) {
      if (slotIndex >= liveWaveCap) {
        wave.mesh.visible = false
        continue
      }
      const age = now - wave.startedAt
      const energy = clamp(1 - age / WAVE_LIFETIME)
      const court = frame.courts[wave.index]
      wave.mesh.visible = energy > 0 && age >= 0
      if (!wave.mesh.visible) continue
      active = true
      const spread = 0.32 + (1 - energy) * 1.25
      wave.mesh.position.set(court.x, court.y + 0.025, court.z)
      wave.mesh.rotation.set(court.rotationX, 0, 0)
      wave.mesh.scale.set(spread, spread, spread)
      wave.material.opacity = energy * 0.34
    }
    return active
  }

  function draw(now: number) {
    if (destroyed || surrendered || !renderer) return false
    applyFrame(rallyStaircaseFrame(progress))
    const active = applyWaves(now)
    try {
      renderer.render(scene, camera)
    } catch {
      surrender()
      return false
    }
    return active
  }

  function resizeRenderer(renderAfter = true) {
    if (destroyed || surrendered || !renderer || !canvas) return
    const bounds = canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(bounds.width))
    const height = Math.max(1, Math.round(bounds.height))
    const dprCap = width < 768 ? 1 : width < 1280 ? 1.25 : 1.5
    liveWaveCap = width < 768 ? 1 : WAVE_CAP
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(Math.max(options.window.devicePixelRatio || 1, 1), dprCap))
    renderer.setSize(width, height, false)
    if (renderAfter) draw(options.now())
  }

  try {
    scene = new three.Scene()
    camera = new three.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 80)

    const courtGeometry = ownGeometry(
      new three.PlaneGeometry(COURT_WIDTH, COURT_HEIGHT),
    )
    const lineGeometry = ownGeometry(new three.BufferGeometry())
    lineGeometry.setAttribute?.(
      'position',
      new three.Float32BufferAttribute(courtLinePositions(), 3),
    )
    const lineMaterial = ownMaterial(
      new three.LineBasicMaterial({
        color: 0x1557ff,
        opacity: 0.92,
        transparent: true,
      }),
    )

    for (let index = 0; index < COURT_STOPS.length; index += 1) {
      const group = new three.Group()
      const material = ownMaterial(
        new three.MeshStandardMaterial({
          color: index % 2 === 0 ? 0xdde8ff : 0xffddce,
          metalness: 0.06,
          opacity: 1,
          roughness: 0.78,
          transparent: true,
        }),
      )
      const plane = new three.Mesh(courtGeometry, material)
      const lines = new three.LineSegments(lineGeometry, lineMaterial)
      group.add(plane, lines)
      scene.add(group)
      courtGroups.push(group)
      courtMaterials.push(material)
    }

    const ballGeometry = ownGeometry(new three.SphereGeometry(0.58, 24, 16))
    const ballMaterial = ownMaterial(
      new three.MeshStandardMaterial({
        color: 0xc9ff36,
        metalness: 0.04,
        roughness: 0.52,
      }),
    )
    const seamGeometry = ownGeometry(new three.BufferGeometry())
    seamGeometry.setAttribute?.(
      'position',
      new three.Float32BufferAttribute(seamPositions(), 3),
    )
    const seamMaterial = ownMaterial(
      new three.LineBasicMaterial({ color: 0x102044 }),
    )
    ball = new three.Group()
    ball.add(
      new three.Mesh(ballGeometry, ballMaterial),
      new three.LineSegments(seamGeometry, seamMaterial),
    )
    scene.add(ball)

    const waveGeometry = ownGeometry(
      new three.PlaneGeometry(COURT_WIDTH, COURT_HEIGHT),
    )
    for (let index = 0; index < WAVE_CAP; index += 1) {
      const material = ownMaterial(
        new three.MeshBasicMaterial({
          color: 0xff5a36,
          opacity: 0,
          transparent: true,
        }),
      )
      const mesh = new three.Mesh(waveGeometry, material)
      mesh.visible = false
      scene.add(mesh)
      waves.push({ index: 0, material, mesh, startedAt: -Infinity })
    }

    const fill = new three.AmbientLight(0xf7f3e8, 1.25)
    const key = new three.DirectionalLight(0xffffff, 2.15)
    key.position.set(-4.5, 7, 9)
    scene.add(fill, key)

    renderer = new three.WebGLRenderer({ alpha: true, antialias: true })
    canvas = renderer.domElement
    canvas.className = 'rally-canvas'
    canvas.setAttribute('aria-hidden', 'true')
    canvas.setAttribute('tabindex', '-1')
    canvas.addEventListener('webglcontextlost', handleContextLoss)
    stage.append(canvas)
    applyFrame(rallyStaircaseFrame(0))
    resizeRenderer(false)
    renderer.render(scene, camera)
  } catch (error) {
    cleanup()
    throw error
  }

  return Object.freeze({
    setProgress(nextProgress: number) {
      if (destroyed || surrendered) return
      progress = clamp(nextProgress)
      draw(options.now())
    },
    impact(index: number, now = options.now()) {
      if (destroyed || surrendered) return
      const normalizedIndex = Math.min(4, Math.max(0, Math.trunc(index)))
      const slot = waves.slice(0, liveWaveCap).reduce((oldest, wave) =>
        wave.startedAt < oldest.startedAt ? wave : oldest,
      )
      slot.index = normalizedIndex
      slot.startedAt = now
      draw(now)
    },
    render(now = options.now()) {
      return draw(now)
    },
    resize() {
      try {
        resizeRenderer()
      } catch {
        surrender()
      }
    },
    destroy: cleanup,
  })
}
