import { describe, expect, it, vi } from 'vitest'
import {
  RALLY_THREE_MEMBERS,
  createRallyStaircaseRuntime,
  rallyStaircaseFrame,
  type RallyStaircaseThree,
} from './rallyRuntime'

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

type ConstructionFailure = 'setAttribute' | 'mesh' | 'lineSegments' | 'sceneAdd'

function harness(failAt?: ConstructionFailure) {
  const canvasListeners = new Map<string, Set<EventListener>>()
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
  } as unknown as HTMLElement
  const disposables: Array<{ dispose: ReturnType<typeof vi.fn> }> = []
  const groups: Object3D[] = []
  const meshes: Object3D[] = []
  const lines: Object3D[] = []
  const lights: Object3D[] = []
  const cameras: Camera[] = []
  const renderer = {
    domElement: canvas,
    dispose: vi.fn(),
    forceContextLoss: vi.fn(),
    render: vi.fn(),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
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
    setAttribute = vi.fn(() => {
      if (failAt === 'setAttribute') throw new Error(failAt)
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
    Float32BufferAttribute: class {},
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
    three,
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

  it('creates five courts, a seam ball, two lights, one canvas, and disposes once', () => {
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
    expect(view.lines).toHaveLength(6)
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

  it('bounds impact waves and surrenders exactly once on context loss', () => {
    const view = harness()
    const surrender = vi.fn()
    let now = 0
    const runtime = createRallyStaircaseRuntime({
      three: view.three as unknown as RallyStaircaseThree,
      stage: view.stage,
      window: { devicePixelRatio: 1 },
      now: () => now,
      onSurrender: surrender,
    })

    runtime.impact(1, now)
    runtime.impact(2, now + 1)
    runtime.impact(3, now + 2)
    expect(runtime.render(now + 20)).toBe(true)
    const visibleWaves = view.meshes.slice(-2).filter(({ visible }) => visible)
    expect(visibleWaves).toHaveLength(2)
    now = 900
    expect(runtime.render(now)).toBe(false)
    expect(view.meshes.slice(-2).every(({ visible }) => !visible)).toBe(true)

    const loss = { preventDefault: vi.fn() } as unknown as Event
    view.canvasListeners.get('webglcontextlost')?.forEach((listener) => listener(loss))
    view.canvasListeners.get('webglcontextlost')?.forEach((listener) => listener(loss))
    expect(loss.preventDefault).toHaveBeenCalled()
    expect(surrender).toHaveBeenCalledOnce()
  })
})
