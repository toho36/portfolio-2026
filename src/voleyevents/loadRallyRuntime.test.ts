import { describe, expect, it, vi } from 'vitest'
import {
  createRallyRuntimeGate,
  createRallyRuntimeOwner,
  type RallyRuntimeHandle,
  type RallyRuntimeParts,
  type RallyWindow,
} from './loadRallyRuntime'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((next, fail) => {
    resolve = next
    reject = fail
  })
  return { promise, reject, resolve }
}

function harness(initiallyReduced = false, previous?: string) {
  let reduced = initiallyReduced
  const listeners = new Set<() => void>()
  const root = {
    dataset: previous === undefined ? {} : { rallyRuntime: previous },
  } as unknown as HTMLElement
  const stage = {} as HTMLElement
  const media = {
    get matches() {
      return reduced
    },
    addEventListener(_type: string, listener: () => void) {
      listeners.add(listener)
    },
    removeEventListener(_type: string, listener: () => void) {
      listeners.delete(listener)
    },
  } as MediaQueryList

  return {
    elements: { root, stage },
    listeners,
    media,
    root,
    setReduced(value: boolean) {
      reduced = value
      listeners.forEach((listener) => listener())
    },
  }
}

async function settle() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

const motion = {
  gsap: { registerPlugin: vi.fn() },
  ScrollTrigger: { name: 'ScrollTrigger' },
}

const three = {
  WebGLRenderer: class WebGLRenderer {},
  Scene: class Scene {},
  PerspectiveCamera: class PerspectiveCamera {},
  Group: class Group {},
  Mesh: class Mesh {},
  LineSegments: class LineSegments {},
  BufferGeometry: class BufferGeometry {},
  Float32BufferAttribute: class Float32BufferAttribute {},
  SphereGeometry: class SphereGeometry {},
  PlaneGeometry: class PlaneGeometry {},
  MeshStandardMaterial: class MeshStandardMaterial {},
  MeshBasicMaterial: class MeshBasicMaterial {},
  LineBasicMaterial: class LineBasicMaterial {},
  AmbientLight: class AmbientLight {},
  DirectionalLight: class DirectionalLight {},
  Color: class Color {},
  Vector2: class Vector2 {},
  Vector3: class Vector3 {},
}

function liveChainHarness() {
  let reduced = false
  let scrollY = 100
  let frameId = 0
  const mediaListeners = new Set<() => void>()
  const windowListeners = new Map<string, Set<EventListener>>()
  const documentListeners = new Map<string, Set<EventListener>>()
  const canvasListeners = new Map<string, Set<EventListener>>()
  const frames = new Map<number, FrameRequestCallback>()
  const resources: Array<{ dispose: ReturnType<typeof vi.fn> }> = []

  const addListener = (
    listeners: Map<string, Set<EventListener>>,
    type: string,
    listener: EventListener,
  ) => {
    const owned = listeners.get(type) ?? new Set<EventListener>()
    owned.add(listener)
    listeners.set(type, owned)
  }
  const removeListener = (
    listeners: Map<string, Set<EventListener>>,
    type: string,
    listener: EventListener,
  ) => listeners.get(type)?.delete(listener)

  class Transform {
    x = 0
    y = 0
    z = 0
    set(x: number, y: number, z: number) {
      this.x = x
      this.y = y
      this.z = z
    }
  }
  class Object3D {
    readonly position = new Transform()
    readonly rotation = new Transform()
    readonly scale = new Transform()
    visible = true
    add(..._objects: unknown[]) {}
  }
  class Camera extends Object3D {
    aspect = 1
    lookAt() {}
    updateProjectionMatrix() {}
  }
  class Geometry {
    readonly dispose = vi.fn()
    setAttribute() {}
    constructor() {
      resources.push(this)
    }
  }
  class Material {
    opacity = 1
    transparent = false
    readonly dispose = vi.fn()
    constructor(options: Record<string, unknown> = {}) {
      Object.assign(this, options)
      resources.push(this)
    }
  }
  class Mesh extends Object3D {
    constructor(
      readonly geometry: unknown,
      readonly material: unknown,
    ) {
      super()
    }
  }

  const canvas = {
    className: '',
    addEventListener(type: string, listener: EventListener) {
      addListener(canvasListeners, type, listener)
    },
    removeEventListener(type: string, listener: EventListener) {
      removeListener(canvasListeners, type, listener)
    },
    setAttribute: vi.fn(),
    remove: vi.fn(),
    getBoundingClientRect: () => ({ width: 900, height: 600 }),
  } as unknown as HTMLCanvasElement
  const renderer = {
    domElement: canvas,
    dispose: vi.fn(),
    forceContextLoss: vi.fn(),
    render: vi.fn(),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
  }
  const liveThree = {
    WebGLRenderer: class { constructor() { return renderer } },
    Scene: Object3D,
    PerspectiveCamera: Camera,
    Group: Object3D,
    Mesh,
    LineSegments: Mesh,
    BufferGeometry: Geometry,
    Float32BufferAttribute: class {},
    SphereGeometry: Geometry,
    PlaneGeometry: Geometry,
    MeshStandardMaterial: Material,
    MeshBasicMaterial: Material,
    LineBasicMaterial: Material,
    AmbientLight: Object3D,
    DirectionalLight: Object3D,
    Color: class {},
    Vector2: class {},
    Vector3: class {},
  }

  const trigger = { kill: vi.fn() }
  const context = { revert: vi.fn(() => trigger.kill()) }
  const liveMotion = {
    gsap: {
      registerPlugin: vi.fn(),
      context: vi.fn((callback: () => void) => {
        callback()
        return context
      }),
    },
    ScrollTrigger: {
      create: vi.fn(() => trigger),
      refresh: vi.fn(),
    },
  }
  const observer = { observe: vi.fn(), disconnect: vi.fn() }
  const scheduler = {
    now: () => 100,
    request(callback: FrameRequestCallback) {
      const id = ++frameId
      frames.set(id, callback)
      return id
    },
    cancel(id: number) {
      frames.delete(id)
    },
  }
  const landings = [700, 1100, 1500, 1900].map((top, index) => ({
    id: ['event-opens', 'player-registers', 'payment-matches', 'attendance-resolves'][index],
    getBoundingClientRect: () => ({ top: top - scrollY }),
  }))
  const root = {
    dataset: {},
    getBoundingClientRect: () => ({ top: 500 - scrollY }),
    querySelectorAll: () => landings,
  } as unknown as HTMLElement
  const stage = { append: vi.fn() } as unknown as HTMLElement
  const document = {
    visibilityState: 'visible' as DocumentVisibilityState,
    documentElement: { scrollHeight: 2600 },
    body: { scrollHeight: 2600 },
    addEventListener(type: string, listener: EventListener) {
      addListener(documentListeners, type, listener)
    },
    removeEventListener(type: string, listener: EventListener) {
      removeListener(documentListeners, type, listener)
    },
  }
  const media = {
    get matches() { return reduced },
    addEventListener(_type: string, listener: () => void) {
      mediaListeners.add(listener)
    },
    removeEventListener(_type: string, listener: () => void) {
      mediaListeners.delete(listener)
    },
  } as MediaQueryList
  const win = {
    get scrollY() { return scrollY },
    innerWidth: 1200,
    innerHeight: 800,
    devicePixelRatio: 1,
    document,
    performance: { now: () => 100 },
    requestAnimationFrame: scheduler.request,
    cancelAnimationFrame: scheduler.cancel,
    addEventListener(type: string, listener: EventListener) {
      addListener(windowListeners, type, listener)
    },
    removeEventListener(type: string, listener: EventListener) {
      removeListener(windowListeners, type, listener)
    },
    matchMedia: () => media,
    setTimeout: (() => 1) as unknown as RallyWindow['setTimeout'],
    clearTimeout: vi.fn(),
  } as unknown as RallyWindow

  return {
    canvas,
    canvasListeners,
    context,
    documentListeners,
    elements: { root, stage },
    frames,
    liveMotion,
    liveThree,
    media,
    mediaListeners,
    observer,
    renderer,
    resources,
    root,
    scheduler,
    trigger,
    win,
    windowListeners,
    dispatchContextLoss() {
      const event = { preventDefault: vi.fn() } as unknown as Event
      canvasListeners.get('webglcontextlost')?.forEach((listener) => listener(event))
      return event
    },
    scrollTo(value: number) {
      scrollY = value
      windowListeners.get('scroll')?.forEach((listener) => listener(new Event('scroll')))
    },
    setReduced(value: boolean) {
      reduced = value
      mediaListeners.forEach((listener) => listener())
    },
  }
}

describe('VoleyEvents rally runtime owner', () => {
  it('issues monotonic generations', () => {
    const gate = createRallyRuntimeGate()

    expect(gate.issueGeneration()).toBe(1)
    expect(gate.issueGeneration()).toBe(2)
    expect(gate.isCurrent(1)).toBe(false)
    expect(gate.isCurrent(2)).toBe(true)
  })

  it('requests neither loader while reduced motion is active', () => {
    const route = harness(true)
    const importMotion = vi.fn(async () => motion)
    const importThree = vi.fn(async () => three)
    const owner = createRallyRuntimeOwner({
      ...route,
      importMotion,
      importThree,
    })

    expect(importMotion).not.toHaveBeenCalled()
    expect(importThree).not.toHaveBeenCalled()
    expect(route.root.dataset.rallyRuntime).toBe('static')
    owner.destroy()
    expect(route.listeners.size).toBe(0)
    expect(route.root.dataset.rallyRuntime).toBeUndefined()
  })

  it('accepts only the fresh false→true→false generation', async () => {
    const route = harness()
    const motionLoads = [deferred<unknown>(), deferred<unknown>()]
    const threeLoads = [deferred<unknown>(), deferred<unknown>()]
    let motionIndex = 0
    let threeIndex = 0
    const createRuntime = vi.fn((): RallyRuntimeHandle => ({
      destroy: vi.fn(),
    }))
    const owner = createRallyRuntimeOwner({
      ...route,
      importMotion: () => motionLoads[motionIndex++].promise,
      importThree: () => threeLoads[threeIndex++].promise,
      createRuntime,
    })

    expect(route.root.dataset.rallyRuntime).toBe('loading')
    route.setReduced(true)
    expect(route.root.dataset.rallyRuntime).toBe('static')
    route.setReduced(false)
    expect(route.root.dataset.rallyRuntime).toBe('loading')

    motionLoads[1].resolve(motion)
    threeLoads[1].resolve(three)
    await settle()
    expect(route.root.dataset.rallyRuntime).toBe('ready')
    expect(createRuntime).toHaveBeenCalledOnce()

    motionLoads[0].resolve(motion)
    threeLoads[0].reject(new Error('old Three failed'))
    await settle()
    expect(route.root.dataset.rallyRuntime).toBe('ready')
    expect(createRuntime).toHaveBeenCalledOnce()
    owner.destroy()
  })

  it('waits for both independent loaders and falls back on either failure', async () => {
    const route = harness()
    const pendingThree = deferred<unknown>()
    const createRuntime = vi.fn()
    const owner = createRallyRuntimeOwner({
      ...route,
      importMotion: async () => {
        throw new Error('motion failed')
      },
      importThree: () => pendingThree.promise,
      createRuntime,
    })

    await settle()
    expect(route.root.dataset.rallyRuntime).toBe('loading')
    pendingThree.resolve(three)
    await settle()
    expect(route.root.dataset.rallyRuntime).toBe('static')
    expect(createRuntime).not.toHaveBeenCalled()
    owner.destroy()
  })

  it('contains current final-construction failure as static fallback', async () => {
    const route = harness()
    const owner = createRallyRuntimeOwner({
      ...route,
      importMotion: async () => motion,
      importThree: async () => three,
      createRuntime() {
        throw new Error('runtime construction failed')
      },
    })

    await settle()
    expect(route.root.dataset.rallyRuntime).toBe('static')
    owner.destroy()
  })

  it('destroys a live runtime exactly once on reduced motion', async () => {
    const route = harness()
    const firstRuntime = { destroy: vi.fn() }
    const secondRuntime = { destroy: vi.fn() }
    const createRuntime = vi
      .fn<() => RallyRuntimeHandle>()
      .mockReturnValueOnce(firstRuntime)
      .mockReturnValueOnce(secondRuntime)
    const owner = createRallyRuntimeOwner({
      ...route,
      importMotion: async () => motion,
      importThree: async () => three,
      createRuntime,
    })

    await settle()
    expect(route.root.dataset.rallyRuntime).toBe('ready')
    route.setReduced(true)
    route.setReduced(true)
    expect(firstRuntime.destroy).toHaveBeenCalledOnce()
    expect(route.root.dataset.rallyRuntime).toBe('static')

    route.setReduced(false)
    await settle()
    expect(createRuntime).toHaveBeenCalledTimes(2)
    expect(route.root.dataset.rallyRuntime).toBe('ready')
    owner.destroy()
    owner.destroy()
    expect(firstRuntime.destroy).toHaveBeenCalledOnce()
    expect(secondRuntime.destroy).toHaveBeenCalledOnce()
  })

  it('latches context-loss surrender for the visit across preference changes', async () => {
    const route = harness()
    const runtime = { destroy: vi.fn() }
    let surrender!: () => void
    const createRuntime = vi.fn((parts: RallyRuntimeParts): RallyRuntimeHandle => {
      surrender = parts.onSurrender
      return runtime
    })
    const owner = createRallyRuntimeOwner({
      ...route,
      importMotion: async () => motion,
      importThree: async () => three,
      createRuntime,
    })

    await settle()
    expect(route.root.dataset.rallyRuntime).toBe('ready')
    surrender()
    surrender()
    expect(runtime.destroy).toHaveBeenCalledOnce()
    expect(route.root.dataset.rallyRuntime).toBe('static')

    route.setReduced(true)
    route.setReduced(false)
    await settle()
    expect(createRuntime).toHaveBeenCalledOnce()
    expect(route.root.dataset.rallyRuntime).toBe('static')
    owner.destroy()
  })

  it('propagates WebGL loss through the real runtime and playhead, then permanently surrenders', async () => {
    const route = liveChainHarness()
    const importMotion = vi.fn(async () => route.liveMotion)
    const importThree = vi.fn(async () => route.liveThree)
    const owner = createRallyRuntimeOwner({
      elements: route.elements,
      window: route.win,
      media: route.media,
      importMotion,
      importThree,
      scheduler: route.scheduler,
      createObserver: () => route.observer,
    })

    await settle()
    expect(route.root.dataset.rallyRuntime).toBe('ready')
    expect(route.canvasListeners.get('webglcontextlost')?.size).toBe(1)
    route.scrollTo(1800)
    expect(route.frames.size).toBe(1)
    const lateFrame = [...route.frames.values()][0]

    const loss = route.dispatchContextLoss()
    expect(loss.preventDefault).toHaveBeenCalledOnce()
    expect(route.root.dataset.rallyRuntime).toBe('static')
    expect(route.frames.size).toBe(0)
    expect(route.trigger.kill).toHaveBeenCalledOnce()
    expect(route.context.revert).toHaveBeenCalledOnce()
    expect(route.observer.disconnect).toHaveBeenCalledOnce()
    expect([...route.windowListeners.values()].every((set) => set.size === 0)).toBe(true)
    expect([...route.documentListeners.values()].every((set) => set.size === 0)).toBe(true)
    expect(route.renderer.dispose).toHaveBeenCalledOnce()
    expect(route.renderer.forceContextLoss).toHaveBeenCalledOnce()
    expect(route.canvas.remove).toHaveBeenCalledOnce()
    expect(route.canvasListeners.get('webglcontextlost')?.size).toBe(0)
    expect(route.root.dataset.rallyActive).toBeUndefined()
    expect(route.resources.every(({ dispose }) => dispose.mock.calls.length === 1)).toBe(true)
    const rendersAfterLoss = route.renderer.render.mock.calls.length
    lateFrame?.(200)
    expect(route.renderer.render).toHaveBeenCalledTimes(rendersAfterLoss)
    expect(route.dispatchContextLoss().preventDefault).not.toHaveBeenCalled()

    route.setReduced(true)
    route.setReduced(false)
    await settle()
    expect(importMotion).toHaveBeenCalledOnce()
    expect(importThree).toHaveBeenCalledOnce()
    expect(route.root.dataset.rallyRuntime).toBe('static')

    owner.destroy()
    owner.destroy()
    expect(route.mediaListeners.size).toBe(0)
    expect(route.trigger.kill).toHaveBeenCalledOnce()
    expect(route.renderer.dispose).toHaveBeenCalledOnce()
  })

  it('cancels pending work, removes its listener, and restores prior state', async () => {
    const route = harness(false, 'prior')
    const pendingMotion = deferred<unknown>()
    const pendingThree = deferred<unknown>()
    const createRuntime = vi.fn()
    const owner = createRallyRuntimeOwner({
      ...route,
      importMotion: () => pendingMotion.promise,
      importThree: () => pendingThree.promise,
      createRuntime,
    })

    owner.destroy()
    expect(route.listeners.size).toBe(0)
    expect(route.root.dataset.rallyRuntime).toBe('prior')
    pendingMotion.resolve(motion)
    pendingThree.resolve(three)
    await settle()
    expect(createRuntime).not.toHaveBeenCalled()
    expect(route.root.dataset.rallyRuntime).toBe('prior')
  })
})
