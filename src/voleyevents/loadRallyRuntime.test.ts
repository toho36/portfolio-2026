import { describe, expect, it, vi } from 'vitest'
import {
  createRallyRuntimeGate,
  createRallyRuntimeOwner,
  type RallyRuntimeHandle,
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
