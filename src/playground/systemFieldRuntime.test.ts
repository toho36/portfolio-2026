import { describe, expect, it, vi } from 'vitest'
import {
  createSystemFieldRuntime,
  type SystemFieldThree,
} from './systemFieldRuntime'
import {
  SYSTEM_FIELD_NODE_COUNT,
  SYSTEM_FIELD_SIZE,
} from './systemFieldState'

function runtimeHarness(rendererThrows = false) {
  const canvasListeners = new Map<string, Set<() => void>>()
  const stageListeners = new Map<string, Set<(event: PointerEvent) => void>>()
  const frames = new Map<number, FrameRequestCallback>()
  const geometryDisposals: Array<ReturnType<typeof vi.fn>> = []
  const geometryArguments: unknown[][] = []
  const materialDisposals: Array<ReturnType<typeof vi.fn>> = []
  const cameras: Array<{
    aspect: number
    position: { set: ReturnType<typeof vi.fn> }
    updateProjectionMatrix: ReturnType<typeof vi.fn>
  }> = []
  const objectPositions: Array<ReturnType<typeof vi.fn>> = []
  const renderers: Array<{
    dispose: ReturnType<typeof vi.fn>
    forceContextLoss: ReturnType<typeof vi.fn>
    render: ReturnType<typeof vi.fn>
    setSize: ReturnType<typeof vi.fn>
  }> = []
  const construction = {
    cameras: 0,
    directionalLights: 0,
    hemisphereLights: 0,
    meshes: [] as number[],
    pointLights: 0,
    renderers: 0,
  }
  let now = 0
  let nextFrame = 1
  const canvasBounds = {
    bottom: 500,
    height: 400,
    left: 10,
    right: 810,
    top: 100,
    width: 800,
  }

  const canvas = {
    className: '',
    addEventListener(type: string, listener: () => void) {
      const listeners = canvasListeners.get(type) ?? new Set()
      listeners.add(listener)
      canvasListeners.set(type, listeners)
    },
    removeEventListener(type: string, listener: () => void) {
      canvasListeners.get(type)?.delete(listener)
    },
    getBoundingClientRect: () => canvasBounds,
    remove: vi.fn(),
    setAttribute: vi.fn(),
  } as unknown as HTMLCanvasElement

  const stage = {
    addEventListener(
      type: string,
      listener: (event: PointerEvent) => void,
    ) {
      const listeners = stageListeners.get(type) ?? new Set()
      listeners.add(listener)
      stageListeners.set(type, listeners)
    },
    append: vi.fn(),
    getBoundingClientRect: () => ({
      bottom: 500,
      height: 400,
      left: 10,
      right: 810,
      top: 100,
      width: 800,
    }),
    removeEventListener(
      type: string,
      listener: (event: PointerEvent) => void,
    ) {
      stageListeners.get(type)?.delete(listener)
    },
  } as unknown as HTMLElement

  class Scene {
    add = vi.fn()
  }
  class Camera {
    aspect = 1
    position = { set: vi.fn() }
    lookAt = vi.fn()
    updateProjectionMatrix = vi.fn()
    constructor() {
      construction.cameras += 1
      cameras.push(this)
    }
  }
  class Geometry {
    dispose = vi.fn()
    constructor(...args: unknown[]) {
      geometryDisposals.push(this.dispose)
      geometryArguments.push(args)
    }
  }
  class Material {
    dispose = vi.fn()
    constructor() {
      materialDisposals.push(this.dispose)
    }
  }
  class Mesh {
    instanceMatrix = { needsUpdate: false }
    instanceColor = { needsUpdate: false }
    setColorAt = vi.fn()
    setMatrixAt = vi.fn()
    constructor(_geometry: unknown, _material: unknown, count: number) {
      construction.meshes.push(count)
    }
  }
  class HemisphereLight {
    constructor() {
      construction.hemisphereLights += 1
    }
  }
  class PositionedLight {
    intensity = 0
    position = { set: vi.fn() }
  }
  class DirectionalLight extends PositionedLight {
    constructor() {
      super()
      construction.directionalLights += 1
    }
  }
  class PointLight extends PositionedLight {
    constructor() {
      super()
      construction.pointLights += 1
    }
  }
  class Object3D {
    matrix = {}
    position = { set: vi.fn() }
    scale = { setScalar: vi.fn() }
    updateMatrix = vi.fn()
    constructor() {
      objectPositions.push(this.position.set)
    }
  }
  class Color {
    copy() {
      return this
    }
    lerp() {
      return this
    }
  }
  class Renderer {
    domElement = canvas
    dispose = vi.fn()
    forceContextLoss = vi.fn()
    render = vi.fn()
    setPixelRatio = vi.fn()
    setSize = vi.fn()
    constructor() {
      construction.renderers += 1
      if (rendererThrows) throw new Error('WebGL unavailable')
      renderers.push(this)
    }
  }

  const three = {
    BoxGeometry: Geometry,
    Color,
    DirectionalLight,
    HemisphereLight,
    InstancedMesh: Mesh,
    MeshStandardMaterial: Material,
    Object3D,
    PerspectiveCamera: Camera,
    PointLight,
    Scene,
    WebGLRenderer: Renderer,
  } as unknown as SystemFieldThree
  const win = {
    devicePixelRatio: 3,
    performance: { now: () => now },
    requestAnimationFrame(callback: FrameRequestCallback) {
      const id = nextFrame++
      frames.set(id, callback)
      return id
    },
    cancelAnimationFrame(id: number) {
      frames.delete(id)
    },
  } as unknown as Window

  return {
    canvas,
    canvasBounds,
    canvasListeners,
    cameras,
    construction,
    frames,
    geometryDisposals,
    geometryArguments,
    materialDisposals,
    objectPositions,
    renderers,
    stage,
    stageListeners,
    three,
    window: win,
    runFrame(time: number) {
      now = time
      const entry = frames.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined
      if (!entry) return false
      frames.delete(entry[0])
      entry[1](time)
      return true
    },
  }
}

describe('System Field Three runtime', () => {
  it('constructs the approved scene and renders only while active', () => {
    const harness = runtimeHarness()
    const onContextLoss = vi.fn()
    const runtime = createSystemFieldRuntime({
      three: harness.three,
      route: harness.stage,
      stage: harness.stage,
      window: harness.window,
      onContextLoss,
    })

    expect(harness.construction).toMatchObject({
      cameras: 1,
      directionalLights: 1,
      hemisphereLights: 1,
      meshes: [SYSTEM_FIELD_NODE_COUNT],
      pointLights: 1,
      renderers: 1,
    })
    expect(harness.stage.append).toHaveBeenCalledWith(harness.canvas)
    expect(harness.geometryArguments[0]).toEqual([0.18, 0.18, 0.06])
    expect(harness.renderers[0].render).toHaveBeenCalledOnce()
    expect(harness.frames.size).toBe(0)

    runtime.setProgress(0.6, true)
    runtime.setProgress(0.4, true)
    expect(harness.frames.size).toBe(1)
    expect(harness.runFrame(16)).toBe(true)
    expect(harness.frames.size).toBe(1)
    runtime.setProgress(0.4, false)
    expect(harness.runFrame(32)).toBe(true)
    expect(harness.frames.size).toBe(0)

    runtime.addWave(0, 0)
    expect(harness.runFrame(1100)).toBe(true)
    expect(harness.frames.size).toBe(0)

    harness.canvasListeners.get('webglcontextlost')?.forEach((listener) =>
      listener(),
    )
    expect(onContextLoss).toHaveBeenCalledOnce()

    runtime.destroy()
    runtime.destroy()
    expect(harness.geometryDisposals[0]).toHaveBeenCalledOnce()
    expect(harness.materialDisposals[0]).toHaveBeenCalledOnce()
    expect(harness.renderers[0].dispose).toHaveBeenCalledOnce()
    expect(harness.renderers[0].forceContextLoss).toHaveBeenCalledOnce()
    expect(harness.canvas.remove).toHaveBeenCalledOnce()
    expect(harness.canvasListeners.get('webglcontextlost')?.size).toBe(0)
    expect(harness.stageListeners.get('pointerdown')?.size).toBe(0)
    expect(harness.stageListeners.get('mousemove')?.size).toBe(0)
  })

  it('sizes and hit-tests against the responsive canvas render box', () => {
    const harness = runtimeHarness()
    const runtime = createSystemFieldRuntime({
      three: harness.three,
      route: harness.stage,
      stage: harness.stage,
      window: harness.window,
      onContextLoss: vi.fn(),
    })
    Object.assign(harness.canvasBounds, {
      bottom: 488,
      height: 356,
      left: 50,
      right: 410,
      top: 132,
      width: 360,
    })
    runtime.resize()

    expect(harness.renderers[0].setSize).toHaveBeenLastCalledWith(
      360,
      356,
      false,
    )
    expect(harness.cameras[0].aspect).toBeCloseTo(360 / 356)
    expect(harness.cameras[0].position.set).toHaveBeenLastCalledWith(
      0,
      0.3,
      expect.any(Number),
    )
    expect(
      harness.cameras[0].position.set.mock.lastCall?.[2],
    ).toBeGreaterThan(17)
    expect(harness.frames.size).toBe(1)
    expect(harness.renderers[0].render).toHaveBeenCalledOnce()
    expect(harness.runFrame(0)).toBe(true)
    expect(harness.renderers[0].render).toHaveBeenCalledTimes(2)
    expect(harness.frames.size).toBe(0)

    const pointerDown = [...(harness.stageListeners.get('pointerdown') ?? [])][0]
    const pointerMove = [...(harness.stageListeners.get('mousemove') ?? [])][0]
    pointerMove({
      clientX: 600,
      clientY: 300,
      pointerType: 'mouse',
      type: 'mousemove',
    } as PointerEvent)
    expect(harness.frames.size).toBe(0)

    pointerDown({
      clientX: 230,
      clientY: 310,
      pointerType: 'mouse',
      type: 'pointerdown',
    } as PointerEvent)
    expect(harness.frames.size).toBe(0)

    pointerMove({
      clientX: 230,
      clientY: 310,
      pointerType: 'mouse',
      type: 'mousemove',
    } as PointerEvent)
    expect(harness.frames.size).toBe(1)
    expect(harness.runFrame(0)).toBe(true)

    const centerCoordinate = Math.floor(SYSTEM_FIELD_SIZE / 2)
    const centerNode = centerCoordinate * SYSTEM_FIELD_SIZE + centerCoordinate
    const pointerRenderOffset = SYSTEM_FIELD_NODE_COUNT * 2
    const pointerLift = harness.objectPositions[0].mock.calls[
      pointerRenderOffset + centerNode
    ][1]
    expect(pointerLift).toBeGreaterThan(0.25)
    expect(pointerLift).toBeLessThan(0.5)

    expect(harness.runFrame(1000)).toBe(true)
    expect(harness.frames.size).toBe(0)
    pointerMove({
      clientX: 232,
      clientY: 310,
      pointerType: 'mouse',
      type: 'mousemove',
    } as PointerEvent)
    expect(harness.frames.size).toBe(0)
    pointerMove({
      clientX: 270,
      clientY: 310,
      pointerType: 'mouse',
      type: 'mousemove',
    } as PointerEvent)
    expect(harness.frames.size).toBe(1)

    runtime.destroy()
  })

  it('disposes partially initialized resources when WebGL creation fails', () => {
    const harness = runtimeHarness(true)

    expect(() => createSystemFieldRuntime({
      three: harness.three,
      route: harness.stage,
      stage: harness.stage,
      window: harness.window,
      onContextLoss: vi.fn(),
    })).toThrow('WebGL unavailable')
    expect(harness.geometryDisposals[0]).toHaveBeenCalledOnce()
    expect(harness.materialDisposals[0]).toHaveBeenCalledOnce()
    expect(harness.stage.append).not.toHaveBeenCalled()
    expect(harness.stageListeners.size).toBe(0)
  })
})
