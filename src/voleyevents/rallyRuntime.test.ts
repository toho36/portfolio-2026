import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  RALLY_DIAGNOSTICS_REQUEST,
  RALLY_THREE_MEMBERS,
  createRallyStaircaseRuntime,
  rallyStaircaseFrame,
  type RallyStaircaseThree,
} from './rallyRuntime'
import type {
  RallyQualityController,
  RallyQualityTier,
} from './rallyQuality'

class Transform {
  x = 0
  y = 0
  z = 0
  set(x: number, y: number, z: number) {
    this.x = x
    this.y = y
    this.z = z
  }
  setScalar(value: number) {
    this.set(value, value, value)
  }
}

class Object3D {
  readonly children: unknown[] = []
  readonly position = new Transform()
  readonly rotation = new Transform()
  readonly scale = new Transform()
  visible = true
  add(...objects: unknown[]) {
    this.children.push(...objects)
  }
}

class Attribute {
  needsUpdate = false
  readonly array: number[]
  constructor(array: readonly number[], readonly itemSize: number) {
    this.array = [...array]
  }
  setXYZ(index: number, x: number, y: number, z: number) {
    this.array.splice(index * 3, 3, x, y, z)
    return this
  }
}

type ConstructionFailure = 'setAttribute' | 'mesh' | 'lineSegments' | 'sceneAdd'

function harness(failAt?: ConstructionFailure) {
  const canvasListeners = new Map<string, Set<EventListener>>()
  const stageListeners = new Map<string, Set<EventListener>>()
  const canvas = {
    className: '',
    dataset: {},
    parentElement: null as unknown,
    addEventListener(type: string, listener: EventListener) {
      const listeners = canvasListeners.get(type) ?? new Set<EventListener>()
      listeners.add(listener)
      canvasListeners.set(type, listeners)
    },
    removeEventListener(type: string, listener: EventListener) {
      canvasListeners.get(type)?.delete(listener)
    },
    setAttribute: vi.fn(),
    remove: vi.fn(),
    getBoundingClientRect: () => ({ width: 900, height: 600 }),
  } as unknown as HTMLCanvasElement
  const stage = {
    append: vi.fn((node: unknown) => {
      ;(node as { parentElement: unknown }).parentElement = stage
    }),
    addEventListener(type: string, listener: EventListener) {
      const listeners = stageListeners.get(type) ?? new Set<EventListener>()
      listeners.add(listener)
      stageListeners.set(type, listeners)
    },
    removeEventListener(type: string, listener: EventListener) {
      stageListeners.get(type)?.delete(listener)
    },
  } as unknown as HTMLElement
  const disposables: Array<{ dispose: ReturnType<typeof vi.fn> }> = []
  const groups: Object3D[] = []
  const meshes: Object3D[] = []
  const lines: Object3D[] = []
  const lights: Object3D[] = []
  const cameras: Camera[] = []
  const rendererInfo = { render: { calls: 0, triangles: 1_000 } }
  const rendererControl = { forcedCalls: null as number | null }
  const renderer = {
    capabilities: { isWebGL2: true },
    domElement: canvas,
    dispose: vi.fn(),
    forceContextLoss: vi.fn(),
    control: rendererControl,
    render: vi.fn(() => {
      rendererInfo.render.calls = rendererControl.forcedCalls ?? [
        ...meshes,
        ...lines,
      ].filter(({ visible }) => visible).length
    }),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    info: rendererInfo,
  }
  const disposable = <T extends object>(value: T) => {
    const resource = Object.assign(value, { dispose: vi.fn() })
    disposables.push(resource)
    return resource
  }
  class Camera extends Object3D {
    aspect = 1
    lookAt = vi.fn()
    updateProjectionMatrix = vi.fn()
    constructor() {
      super()
      cameras.push(this)
    }
  }
  class Material {
    opacity = 1
    transparent = false
    constructor(options: Record<string, unknown> = {}) {
      Object.assign(this, options)
      disposable(this)
    }
    dispose = vi.fn()
  }
  class Geometry {
    readonly attributes = new Map<string, unknown>()
    setAttribute = vi.fn((name: string, attribute: unknown) => {
      if (failAt === 'setAttribute') throw new Error(failAt)
      this.attributes.set(name, attribute)
    })
    constructor() {
      disposable(this)
    }
    dispose = vi.fn()
  }
  class Mesh extends Object3D {
    constructor(
      readonly geometry: unknown,
      readonly material: unknown,
    ) {
      super()
      if (failAt === 'mesh') throw new Error(failAt)
      meshes.push(this)
    }
  }
  class LineSegments extends Object3D {
    constructor(
      readonly geometry: unknown,
      readonly material: unknown,
    ) {
      super()
      if (failAt === 'lineSegments') throw new Error(failAt)
      lines.push(this)
    }
  }
  class Light extends Object3D {
    constructor() {
      super()
      lights.push(this)
    }
  }
  class Group extends Object3D {
    constructor() {
      super()
      groups.push(this)
    }
  }
  class Scene extends Object3D {
    override add(...objects: unknown[]) {
      if (failAt === 'sceneAdd') throw new Error(failAt)
      super.add(...objects)
    }
  }
  const three = {
    WebGLRenderer: class { constructor() { return renderer } },
    Scene,
    PerspectiveCamera: Camera,
    Group,
    Mesh,
    LineSegments,
    BufferGeometry: Geometry,
    Float32BufferAttribute: Attribute,
    SphereGeometry: Geometry,
    PlaneGeometry: Geometry,
    MeshStandardMaterial: Material,
    MeshBasicMaterial: Material,
    LineBasicMaterial: Material,
    AmbientLight: Light,
    DirectionalLight: Light,
    Color: class {},
    Vector2: class {},
    Vector3: class {},
  }

  return {
    canvas,
    canvasListeners,
    cameras,
    disposables,
    groups,
    lights,
    lines,
    meshes,
    renderer,
    stage,
    stageListeners,
    three,
  }
}

const HIGH_CAPABILITY = {
  reducedMotion: false,
  webglAvailable: true,
  webgl2Available: true,
  contextLost: false,
  pointerFine: true,
  viewportWidth: 1440,
  deviceMemory: 8,
  hardwareConcurrency: 8,
} as const

function scriptedQuality(...tiers: RallyQualityTier[]): RallyQualityController {
  let tier: RallyQualityTier = 'Medium'
  return {
    sample() {
      tier = tiers.shift() ?? tier
      return { tier, surrender: false, window: null, transition: null }
    },
    resetSampling() {},
    snapshot: () => ({
      tier,
      ceiling: 'High',
      surrendered: false,
      windows: [],
      transitions: [],
    }),
  }
}

function transformSnapshot(transform: Transform) {
  return [transform.x, transform.y, transform.z]
}

function appliedState(view: ReturnType<typeof harness>) {
  const camera = view.cameras[0]
  const ball = view.groups[5]
  return {
    courts: view.groups.slice(0, 5).map((court, index) => ({
      opacity: ((view.meshes[index] as Object3D & {
        material: { opacity: number }
      }).material).opacity,
      position: transformSnapshot(court.position),
      rotation: transformSnapshot(court.rotation),
      scale: transformSnapshot(court.scale),
    })),
    ball: {
      position: transformSnapshot(ball.position),
      rotation: transformSnapshot(ball.rotation),
    },
    camera: {
      position: transformSnapshot(camera.position),
      target: camera.lookAt.mock.calls.at(-1),
    },
  }
}

describe('Impossible Court Staircase renderer', () => {
  it('consumes the exact validated 18-member facade', () => {
    expect(RALLY_THREE_MEMBERS).toEqual([
      'WebGLRenderer', 'Scene', 'PerspectiveCamera', 'Group', 'Mesh',
      'LineSegments', 'BufferGeometry', 'Float32BufferAttribute',
      'SphereGeometry', 'PlaneGeometry', 'MeshStandardMaterial',
      'MeshBasicMaterial', 'LineBasicMaterial', 'AmbientLight',
      'DirectionalLight', 'Color', 'Vector2', 'Vector3',
    ])
  })

  it('applies identical authored transforms, opacity, camera, and ball state for identical progress', () => {
    const direct = rallyStaircaseFrame(0.625)
    rallyStaircaseFrame(0.1)
    rallyStaircaseFrame(0.95)
    expect(rallyStaircaseFrame(0.625)).toEqual(direct)
    expect(direct.courts).toHaveLength(5)
    expect(rallyStaircaseFrame(0).courts[0].scale).toBeGreaterThan(1)
    expect(rallyStaircaseFrame(0).camera.z).toBeLessThan(10)
    expect(direct.ball.spin).toBeCloseTo(0.625 * Math.PI * 10)

    const view = harness()
    const runtime = createRallyStaircaseRuntime({
      three: view.three as unknown as RallyStaircaseThree,
      stage: view.stage,
      window: { devicePixelRatio: 1 },
      now: () => 320,
      onSurrender: vi.fn(),
    })
    runtime.setProgress(0.625)
    const expected = {
      courts: direct.courts.map((court) => ({
        opacity: court.opacity,
        position: [court.x, court.y, court.z],
        rotation: [court.rotationX, 0, 0],
        scale: [court.scale, court.scale, court.scale],
      })),
      ball: {
        position: [direct.ball.x, direct.ball.y, direct.ball.z],
        rotation: [
          direct.ball.spin * 0.42,
          direct.ball.spin,
          direct.ball.spin * 0.16,
        ],
      },
      camera: {
        position: [direct.camera.x, direct.camera.y, direct.camera.z],
        target: [
          direct.camera.targetX,
          direct.camera.targetY,
          direct.camera.targetZ,
        ],
      },
    }
    expect(appliedState(view)).toEqual(expected)

    for (const history of [
      [0.1, 0.4, 0.625],
      [0.98, 0.72, 0.625],
      [0.2, 0.91, 0.33, 0.8, 0.625],
    ]) {
      history.forEach((progress) => runtime.setProgress(progress))
      expect(appliedState(view)).toEqual(expected)
    }
    runtime.destroy()
  })

  it('prebuilds tier resources, creates one scene/canvas, and disposes once', () => {
    const view = harness()
    const runtime = createRallyStaircaseRuntime({
      three: view.three as unknown as RallyStaircaseThree,
      stage: view.stage,
      window: { devicePixelRatio: 2 },
      now: () => 0,
      onSurrender: vi.fn(),
    })

    expect(view.stage.append).toHaveBeenCalledOnce()
    expect(view.canvas.className).toBe('rally-canvas')
    expect(view.canvas.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true')
    expect(view.canvas.setAttribute).toHaveBeenCalledWith('tabindex', '-1')
    expect(view.meshes).toHaveLength(8)
    expect(view.lines).toHaveLength(2)
    const mergedLines = view.lines[0] as Object3D & {
      geometry: { attributes: Map<string, Attribute> }
    }
    expect(mergedLines.geometry.attributes.get('position')?.array).toHaveLength(210)
    expect(view.lights).toHaveLength(2)
    expect(view.renderer.setPixelRatio).toHaveBeenLastCalledWith(1.25)
    expect(view.renderer.setSize).toHaveBeenLastCalledWith(900, 600, false)
    runtime.resize()
    expect(view.renderer.render).toHaveBeenCalledTimes(2)

    runtime.destroy()
    runtime.destroy()
    expect(view.renderer.dispose).toHaveBeenCalledOnce()
    expect(view.renderer.forceContextLoss).toHaveBeenCalledOnce()
    expect(view.canvas.remove).toHaveBeenCalledOnce()
    expect(view.disposables.every(({ dispose }) => dispose.mock.calls.length === 1)).toBe(true)
  })

  it.each([
    'setAttribute',
    'mesh',
    'lineSegments',
    'sceneAdd',
  ] as const)('disposes every allocated resource when %s fails during construction', (failAt) => {
    const view = harness(failAt)

    expect(() => createRallyStaircaseRuntime({
      three: view.three as unknown as RallyStaircaseThree,
      stage: view.stage,
      window: { devicePixelRatio: 1 },
      now: () => 0,
      onSurrender: vi.fn(),
    })).toThrow(failAt)
    expect(view.disposables.length).toBeGreaterThan(0)
    expect(view.disposables.every(
      ({ dispose }) => dispose.mock.calls.length === 1,
    )).toBe(true)
    expect(view.stage.append).not.toHaveBeenCalled()
  })

  it('short-circuits reduced motion before allocating WebGL and keeps inert calls harmless', () => {
    const view = harness()
    const surrender = vi.fn()
    const runtime = createRallyStaircaseRuntime({
      three: view.three as unknown as RallyStaircaseThree,
      stage: view.stage,
      window: { devicePixelRatio: Number.NaN },
      now: () => 0,
      onSurrender: surrender,
      capability: { reducedMotion: true },
    })
    runtime.setProgress(1)
    runtime.impact(4)
    runtime.resize()
    runtime.destroy()
    expect(runtime.render()).toBe(false)
    expect(runtime.diagnostics!()).toBeNull()
    expect(surrender).toHaveBeenCalledOnce()
    expect(view.stage.append).not.toHaveBeenCalled()
    expect(view.disposables).toHaveLength(0)
  })

  it('uses the Medium one-wave cap and High two-wave cap without reallocating', () => {
    const view = harness()
    const surrender = vi.fn()
    let now = 0
    const runtime = createRallyStaircaseRuntime({
      three: view.three as unknown as RallyStaircaseThree,
      stage: view.stage,
      window: { devicePixelRatio: 1 },
      now: () => now,
      onSurrender: surrender,
      quality: scriptedQuality('Medium', 'Medium', 'High'),
      capability: HIGH_CAPABILITY,
    })

    runtime.impact(1, now)
    runtime.impact(2, now + 1)
    runtime.impact(3, now + 2)
    const visibleWaves = view.meshes.slice(-2).filter(({ visible }) => visible)
    expect(visibleWaves).toHaveLength(1)
    const allocations = view.disposables.length
    expect(runtime.render(now + 20)).toBe(true)
    expect(view.meshes.slice(-2).filter(({ visible }) => visible)).toHaveLength(2)
    expect(view.disposables).toHaveLength(allocations)
    expect(view.renderer.setPixelRatio).toHaveBeenLastCalledWith(1)
    now = 900
    expect(runtime.render(now)).toBe(false)
    expect(view.meshes.slice(-2).every(({ visible }) => !visible)).toBe(true)

    const loss = { preventDefault: vi.fn() } as unknown as Event
    view.canvasListeners.get('webglcontextlost')?.forEach((listener) => listener(loss))
    view.canvasListeners.get('webglcontextlost')?.forEach((listener) => listener(loss))
    expect(loss.preventDefault).toHaveBeenCalled()
    expect(surrender).toHaveBeenCalledOnce()
  })

  it('swaps prebuilt tier geometry/DPR and enforces actual renderer caps', () => {
    const view = harness()
    const surrender = vi.fn()
    const runtime = createRallyStaircaseRuntime({
      three: view.three as unknown as RallyStaircaseThree,
      stage: view.stage,
      window: { devicePixelRatio: 4 },
      now: () => 0,
      onSurrender: surrender,
      capability: HIGH_CAPABILITY,
      quality: scriptedQuality('High', 'Low'),
    })
    const allocations = view.disposables.length
    runtime.render(0)
    runtime.render(16)
    expect(view.renderer.setPixelRatio).toHaveBeenLastCalledWith(1.5)
    runtime.render(32)
    expect(view.renderer.setPixelRatio).toHaveBeenLastCalledWith(1)
    expect(view.lines[0].visible).toBe(true)
    expect(view.disposables).toHaveLength(allocations)

    view.renderer.control.forcedCalls = 11
    runtime.render(48)
    expect(surrender).toHaveBeenCalledOnce()
  })

  it('surrenders after two consecutive measured Low windows without render-duration timing', () => {
    const view = harness()
    const surrender = vi.fn()
    const runtime = createRallyStaircaseRuntime({
      three: view.three as unknown as RallyStaircaseThree,
      stage: view.stage,
      window: { devicePixelRatio: 1 },
      now: () => 0,
      onSurrender: surrender,
      capability: { ...HIGH_CAPABILITY, pointerFine: false },
    })
    for (let timestamp = 0; timestamp <= 4_200; timestamp += 100) {
      runtime.render(timestamp)
    }
    expect(surrender).toHaveBeenCalledOnce()
    expect(view.renderer.dispose).toHaveBeenCalledOnce()
  })

  it('serves diagnostics through the stage only on loopback and removes the seam', () => {
    const local = harness()
    const runtime = createRallyStaircaseRuntime({
      three: local.three as unknown as RallyStaircaseThree,
      stage: local.stage,
      window: { devicePixelRatio: 1, location: { hostname: 'localhost' } },
      now: () => 0,
      onSurrender: vi.fn(),
    })
    const respond = vi.fn()
    local.stageListeners.get(RALLY_DIAGNOSTICS_REQUEST)?.forEach((listener) =>
      listener({ detail: { respond } } as unknown as Event),
    )
    expect(respond).toHaveBeenCalledWith(expect.objectContaining({
      tier: 'Medium',
      renderer: { calls: 8, triangles: 1_000 },
    }))
    expect(runtime.diagnostics!()).not.toBeNull()
    runtime.destroy()
    expect(local.stageListeners.get(RALLY_DIAGNOSTICS_REQUEST)?.size).toBe(0)

    const remote = harness()
    const remoteRuntime = createRallyStaircaseRuntime({
      three: remote.three as unknown as RallyStaircaseThree,
      stage: remote.stage,
      window: { devicePixelRatio: 1, location: { hostname: 'example.com' } },
      now: () => 0,
      onSurrender: vi.fn(),
    })
    expect(remoteRuntime.diagnostics!()).toBeNull()
    expect(remote.stageListeners.get(RALLY_DIAGNOSTICS_REQUEST)).toBeUndefined()
    remoteRuntime.destroy()
  })

  it('publishes no HUD or global metrics from any rally runtime module', () => {
    const runtimeSources = [
      'loadRallyMotion.ts',
      'loadRallyRuntime.ts',
      'loadRallyThree.ts',
      'rallyPlayhead.ts',
      'rallyQuality.ts',
      'rallyRuntime.ts',
    ]
      .map((name: string) => readFileSync(new URL(name, import.meta.url), 'utf8'))
      .join('\n')
    expect(runtimeSources).not.toMatch(/globalThis\s*\[/)
    expect(runtimeSources).not.toMatch(/window\s*\.\s*(?:rally|metrics|diagnostics)/i)
    expect(runtimeSources).not.toMatch(/(?:hud|public metrics)/i)
  })
})
