import {
  exposeProjectedBounds,
  projectBounds,
  type ProjectedBounds,
} from './projectArtifact'
import { IDLE_POSE, type LoopScenePose } from './staticPoses'

interface Disposable {
  dispose(): void
}

interface TransformNode {
  visible: boolean
  position: { set(x: number, y: number, z: number): void }
  rotation: { set(x: number, y: number, z: number): void }
  scale: { set(x: number, y: number, z: number): void }
  add(...children: unknown[]): void
  updateMatrixWorld(force?: boolean): void
}

interface MaterialLike extends Disposable {
  opacity: number
}

interface RendererLike {
  readonly domElement: HTMLCanvasElement
  setPixelRatio(value: number): void
  setSize(width: number, height: number, updateStyle?: boolean): void
  render(scene: unknown, camera: unknown): void
  dispose(): void
  forceContextLoss(): void
}

interface CameraLike {
  aspect: number
  position: { set(x: number, y: number, z: number): void }
  lookAt(x: number, y: number, z: number): void
  updateProjectionMatrix(): void
}

interface BoxLike {
  min: { x: number; y: number; z: number }
  max: { x: number; y: number; z: number }
  setFromObject(object: unknown): BoxLike
}

interface VectorLike {
  x: number
  y: number
  z: number
  project(camera: unknown): VectorLike
}

interface LightLike {
  position: { set(x: number, y: number, z: number): void }
}

export interface LoopSceneThree {
  readonly Scene: new () => { add(...objects: unknown[]): void }
  readonly Group: new () => TransformNode
  readonly Mesh: new (geometry: unknown, material: unknown) => TransformNode
  readonly BoxGeometry: new (width: number, height: number, depth: number) => Disposable
  readonly Shape: new () => {
    moveTo(x: number, y: number): void
    lineTo(x: number, y: number): void
    closePath(): void
  }
  readonly ExtrudeGeometry: new (shape: unknown, options: object) => Disposable
  readonly MeshPhysicalMaterial: new (options: object) => MaterialLike
  readonly MeshStandardMaterial: new (options: object) => MaterialLike
  readonly PerspectiveCamera: new (
    fieldOfView: number,
    aspect: number,
    near: number,
    far: number,
  ) => CameraLike
  readonly WebGLRenderer: new (options: object) => RendererLike
  readonly HemisphereLight: new (sky: number, ground: number, intensity: number) => unknown
  readonly DirectionalLight: new (color: number, intensity: number) => LightLike
  readonly PointLight: new (color: number, intensity: number, distance: number, decay: number) => LightLike
  readonly Box3: new () => BoxLike
  readonly Vector3: new (x: number, y: number, z: number) => VectorLike
}

export interface LoopSceneRuntime {
  setPose(pose: LoopScenePose, publishMeasurements?: boolean): void
  resize(): void
  destroy(): void
}

interface LoopSceneOptions {
  readonly three: LoopSceneThree
  readonly stage: HTMLElement
  readonly wrapper: HTMLElement
  readonly window: Window
  readonly onContextLoss: () => void
}

const CAMERA_FOV = 38

export function createLoopScene(options: LoopSceneOptions): LoopSceneRuntime {
  const { three, stage, wrapper, window: win } = options
  const geometries: Disposable[] = []
  const materials: MaterialLike[] = []
  let destroyed = false
  let currentPose = IDLE_POSE

  const scene = new three.Scene()
  const camera = new three.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 80)
  const canvas = stage.ownerDocument.createElement('canvas')
  const context = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  })
  if (!context) throw new Error('WebGL is unavailable; use the static illustration.')
  const renderer = new three.WebGLRenderer({
    canvas,
    context,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  })
  canvas.className = 'loop-scene-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.setAttribute('tabindex', '-1')

  const material = (
    kind: 'physical' | 'standard',
    values: object,
  ) => {
    const value = kind === 'physical'
      ? new three.MeshPhysicalMaterial(values)
      : new three.MeshStandardMaterial(values)
    materials.push(value)
    return value
  }

  const ceramic = material('physical', {
    color: 0xd8d0c0,
    roughness: 0.62,
    metalness: 0.03,
    clearcoat: 0.18,
    clearcoatRoughness: 0.8,
  })
  const graphite = material('standard', {
    color: 0x242321,
    roughness: 0.38,
    metalness: 0.58,
  })
  const graphiteSoft = material('standard', {
    color: 0x47413a,
    roughness: 0.72,
    metalness: 0.22,
  })
  const amberValues = {
    color: 0xb66a16,
    emissive: 0x301303,
    emissiveIntensity: 0.28,
    roughness: 0.18,
    metalness: 0.08,
    transparent: true,
    opacity: 0.64,
    transmission: 0.18,
    thickness: 0.35,
  }
  const planAmber = material('physical', amberValues)
  const candidateAmber = material('physical', { ...amberValues, opacity: 0.78 })
  const reviewerAmber = material('physical', { ...amberValues, opacity: 0.5 })
  const vermilion = material('standard', {
    color: 0xe04b25,
    emissive: 0x401006,
    emissiveIntensity: 0.18,
    roughness: 0.48,
    metalness: 0.18,
  })
  const pale = material('physical', {
    color: 0xf0e8da,
    roughness: 0.5,
    metalness: 0.02,
    clearcoat: 0.32,
  })

  const machine = new three.Group()
  const structure = new three.Group()
  const shellLeft = new three.Group()
  const shellRight = new three.Group()
  const exitGate = new three.Group()
  const plan = new three.Group()
  const planRevision = new three.Group()
  const candidate = new three.Group()
  const candidateCheckPart = new three.Group()
  const candidateReviewPart = new three.Group()
  const planner = new three.Group()
  const critic = new three.Group()
  const implementer = new three.Group()
  const check = new three.Group()
  const reviewer = new three.Group()
  const tabs = [new three.Group(), new three.Group()]

  const box = (
    parent: TransformNode,
    size: readonly [number, number, number],
    position: readonly [number, number, number],
    rotation: readonly [number, number, number],
    surface: MaterialLike,
  ) => {
    const geometry = new three.BoxGeometry(...size)
    const mesh = new three.Mesh(geometry, surface)
    geometries.push(geometry)
    mesh.position.set(...position)
    mesh.rotation.set(...rotation)
    parent.add(mesh)
    return mesh
  }

  const panel = (
    parent: TransformNode,
    points: readonly (readonly [number, number])[],
    depth: number,
    position: readonly [number, number, number],
    rotation: readonly [number, number, number],
    surface: MaterialLike,
  ) => {
    const shape = new three.Shape()
    points.forEach(([x, y], index) => {
      if (index === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    })
    shape.closePath()
    const geometry = new three.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.1,
      bevelThickness: 0.08,
      curveSegments: 1,
      steps: 1,
    })
    const mesh = new three.Mesh(geometry, surface)
    geometries.push(geometry)
    mesh.position.set(...position)
    mesh.rotation.set(...rotation)
    parent.add(mesh)
    return mesh
  }

  // One asymmetric machine: broad ceramic shell around a graphite working throat.
  box(structure, [7.6, 0.42, 3.4], [0, -2.05, 0], [-0.05, 0, 0.02], graphiteSoft)
  box(structure, [0.44, 4.9, 0.7], [-3.82, 0.02, -0.65], [0, 0, -0.18], graphite)
  box(structure, [0.38, 5.6, 0.7], [3.65, 0.32, -0.9], [0, 0, 0.11], graphite)
  box(structure, [6.7, 0.28, 0.55], [0.05, 2.45, -0.75], [0, 0, -0.05], graphite)
  panel(shellLeft, [[-3.7, -1.72], [-3.43, 2.18], [-1.72, 2.03], [-2.38, 1.3], [-2.56, -1.55]], 0.28, [0, 0, 0.3], [0.03, -0.12, 0], ceramic)
  panel(shellLeft, [[-3.18, -1.42], [-2.9, 1.62], [-2.05, 1.52], [-2.42, 0.92], [-2.53, -1.32]], 0.18, [0, 0, 0.62], [0.02, -0.16, 0], pale)
  panel(shellRight, [[2.5, -1.58], [2.22, 1.75], [3.48, 2.3], [3.72, -1.72]], 0.3, [0, 0, 0.28], [-0.02, 0.13, 0], ceramic)
  panel(shellRight, [[2.62, -1.27], [2.48, 1.35], [3.12, 1.62], [3.38, -1.42]], 0.18, [0, 0, 0.6], [0, 0.17, 0], pale)
  box(structure, [0.34, 4.5, 0.42], [0.72, 0.2, -0.05], [0, 0.2, -0.56], graphiteSoft)
  box(exitGate, [0.34, 3.35, 2.7], [3.3, -0.25, 0.75], [0, 0, 0.04], ceramic)
  structure.add(shellLeft, shellRight, exitGate)
  machine.add(structure, planner, critic, implementer, check, reviewer, ...tabs)

  box(plan, [3.8, 2.0, 0.12], [0, 0, 0], [-0.03, -0.08, 0.02], planAmber)
  box(planRevision, [3.42, 0.08, 0.08], [0, 0.56, 0.1], [0, 0, 0], vermilion)
  box(planRevision, [0.08, 1.48, 0.08], [-1.2, 0, 0.1], [0, 0, 0], vermilion)
  plan.add(planRevision)

  box(candidate, [3.45, 1.76, 0.34], [0, 0, 0], [0, 0, 0], graphite)
  box(candidateCheckPart, [1.42, 1.48, 0.42], [0, 0, 0], [0, -0.08, -0.04], ceramic)
  box(candidateReviewPart, [1.42, 1.48, 0.42], [0, 0, 0], [0, 0.08, 0.04], pale)
  candidateCheckPart.position.set(-0.88, 0.02, 0.18)
  candidateReviewPart.position.set(0.88, -0.02, 0.18)
  candidate.add(candidateCheckPart, candidateReviewPart)
  box(candidate, [0.34, 1.32, 0.62], [0, 0, 0.24], [0, 0, 0], candidateAmber)
  box(candidate, [2.7, 0.12, 0.12], [0, -0.5, 0.48], [0, 0, 0], vermilion)

  // Anchored role tools enter from different axes; they are parts of the one bench.
  box(planner, [0.16, 2.7, 0.16], [-1.8, 0.1, 1.65], [0, 0, 0], vermilion)
  box(planner, [3.7, 0.12, 0.16], [-0.05, 1.35, 1.65], [0, 0, 0], graphite)
  box(critic, [2.8, 0.18, 0.32], [2.35, 1.3, 1.7], [0, 0, -0.42], graphite)
  box(critic, [0.48, 0.48, 0.5], [1.2, 0.82, 1.68], [0, 0, -0.42], vermilion)
  box(implementer, [4.05, 0.34, 2.15], [0, 1.5, 0.38], [0, 0, 0], ceramic)
  box(implementer, [4.05, 0.28, 2.15], [0, -1.28, 0.24], [0, 0, 0], graphiteSoft)
  box(check, [0.42, 2.9, 1.7], [-2.25, 0, 0.55], [0, 0, 0], graphite)
  box(check, [0.42, 2.9, 1.7], [2.25, 0, 0.55], [0, 0, 0], graphite)
  box(check, [4.9, 0.16, 0.18], [0, 1.55, 1.42], [0, 0, 0], vermilion)
  box(reviewer, [4.5, 2.5, 0.12], [0.45, 0.35, 2.15], [-0.22, 0.12, 0.05], reviewerAmber)
  box(reviewer, [4.7, 0.12, 0.18], [0.45, 1.62, 2.15], [-0.22, 0.12, 0.05], graphite)
  box(reviewer, [0.12, 2.5, 0.18], [-1.84, 0.35, 2.15], [-0.22, 0.12, 0.05], graphite)
  tabs.forEach((tab, index) => {
    box(tab, [0.42, 0.76, 0.22], [-0.45 + index * 0.9, -1.7, 1.7], [0.1, 0, 0], vermilion)
  })

  scene.add(machine, plan, candidate)
  const hemisphere = new three.HemisphereLight(0xfff6e6, 0x151311, 1.45)
  const key = new three.DirectionalLight(0xffe6c0, 3.5)
  key.position.set(-5, 7, 9)
  const rim = new three.DirectionalLight(0x9dc8cf, 2.1)
  rim.position.set(6, 2, -5)
  const glow = new three.PointLight(0xd56a1c, 9, 13, 2)
  glow.position.set(0, -0.1, 3)
  scene.add(hemisphere, key, rim, glow)

  const handleContextLoss = (event: Event) => {
    event.preventDefault()
    options.onContextLoss()
  }
  canvas.addEventListener('webglcontextlost', handleContextLoss)
  stage.append(canvas)

  function objectBounds(object: TransformNode): ProjectedBounds | null {
    object.updateMatrixWorld(true)
    const bounds = new three.Box3().setFromObject(object)
    const points = []
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const point = new three.Vector3(x, y, z).project(camera)
          points.push({ x: point.x, y: point.y })
        }
      }
    }
    const rect = canvas.getBoundingClientRect()
    return projectBounds(points, rect.width, rect.height)
  }

  function publishMeasurements(activeArtifact: TransformNode) {
    const artifactBounds = objectBounds(activeArtifact)
    const machineBounds = objectBounds(structure)
    if (artifactBounds && machineBounds) {
      exposeProjectedBounds(wrapper, artifactBounds, machineBounds)
    }
  }

  function render(pose: LoopScenePose, publish = true) {
    if (destroyed) return
    currentPose = pose
    shellLeft.rotation.set(0, -0.13 - pose.shellOpen * 0.22, -0.02)
    shellRight.rotation.set(0, 0.11 + pose.shellOpen * 0.3, 0.02)
    exitGate.position.set(pose.exitOpen * 1.85, -pose.exitOpen * 0.5, 0)
    exitGate.rotation.set(0, -pose.exitOpen * 0.72, 0)

    plan.visible = !pose.candidateVisible || pose.planOpacity > 0
    plan.position.set(
      pose.candidateVisible ? -0.45 : pose.artifactX,
      pose.candidateVisible ? 0.42 : pose.artifactY,
      pose.candidateVisible ? -0.62 : pose.artifactZ - 0.25,
    )
    plan.scale.set(pose.candidateVisible ? 0.78 : 1, pose.candidateVisible ? 0.78 : 1, 1)
    planRevision.position.set(-pose.planOpening * 0.28, pose.planOpening * 0.18, pose.planOpening * 0.26)
    planRevision.rotation.set(0.08 * pose.planOpening, -0.12 * pose.planOpening, -0.05 * pose.planOpening)
    planAmber.opacity = pose.planOpacity

    candidate.visible = pose.candidateVisible
    candidate.position.set(pose.artifactX, pose.artifactY, pose.artifactZ)
    candidate.scale.set(pose.candidateScale, pose.candidateScale, pose.candidateScale)

    planner.visible = pose.plannerTool > 0.001
    critic.visible = pose.criticTool > 0.001
    implementer.visible = pose.implementerTool > 0.001
    check.visible = pose.checkTool > 0.001
    reviewer.visible = pose.reviewTool > 0.001
    planner.position.set(0, -0.38 + pose.plannerTool * 0.38, 0)
    critic.position.set(0.45 - pose.criticTool * 0.45, 0, 0)
    implementer.position.set(0, pose.implementerTool * -0.45, 0)
    implementer.scale.set(1, 0.25 + pose.implementerTool * 0.75, 1)
    check.position.set(0, 0.5 - pose.checkTool * 0.5, 0)
    reviewer.position.set(0, 0.42 - pose.reviewTool * 0.42, 0)

    candidate.rotation.set(0, 0, 0)
    candidateCheckPart.position.set(
      -0.88 - pose.checkOpening * 0.32,
      0.02 + pose.checkOpening * 0.14,
      0.18 + pose.checkOpening * 0.3,
    )
    candidateCheckPart.rotation.set(0, -0.08 - pose.checkOpening * 0.2, -0.04 - pose.checkOpening * 0.08)
    candidateReviewPart.position.set(
      0.88 + pose.reviewOpening * 0.24,
      -0.02 + pose.reviewOpening * 0.22,
      0.18 + pose.reviewOpening * 0.36,
    )
    candidateReviewPart.rotation.set(pose.reviewOpening * 0.14, 0.08 + pose.reviewOpening * 0.2, 0.04 + pose.reviewOpening * 0.09)
    tabs[0].visible = pose.tabsRemaining > 0.5
    tabs[1].visible = pose.tabsRemaining > 1.5

    renderer.render(scene, camera)
    if (publish) publishMeasurements(pose.candidateVisible ? candidate : plan)
  }

  function resize() {
    if (destroyed) return
    const rect = stage.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width))
    const height = Math.max(1, Math.round(rect.height))
    camera.aspect = width / height
    const vertical = CAMERA_FOV * Math.PI / 360
    const distance = Math.max(9.8, 5.2 / (Math.tan(vertical) * camera.aspect))
    camera.position.set(0.15, 0.25, distance)
    camera.lookAt(0, 0.05, 0)
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, width < 600 ? 1.5 : 2))
    renderer.setSize(width, height, false)
    render(currentPose, true)
  }

  try {
    resize()
  } catch (error) {
    canvas.removeEventListener('webglcontextlost', handleContextLoss)
    canvas.remove()
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((entry) => entry.dispose())
    renderer.dispose()
    renderer.forceContextLoss()
    throw error
  }

  return Object.freeze({
    setPose: render,
    resize,
    destroy() {
      if (destroyed) return
      destroyed = true
      canvas.removeEventListener('webglcontextlost', handleContextLoss)
      canvas.remove()
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((entry) => entry.dispose())
      renderer.dispose()
      renderer.forceContextLoss()
      delete wrapper.dataset.artifactPx
      delete wrapper.dataset.machineHeightPx
      delete wrapper.dataset.artifactLeft
      delete wrapper.dataset.artifactTop
      delete wrapper.dataset.artifactRight
      delete wrapper.dataset.artifactBottom
    },
  })
}
