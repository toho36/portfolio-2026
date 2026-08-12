import { describe, expect, it, vi } from 'vitest'
import {
  createRallyMotionGate,
  importRallyMotion,
  loadRallyMotion,
} from './loadRallyMotion'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((next, fail) => {
    resolve = next
    reject = fail
  })
  return { promise, reject, resolve }
}

describe('VoleyEvents rally motion loader', () => {
  it.each([
    {
      label: 'named exports',
      coreModule: (gsap: unknown) => ({ gsap }),
      pluginModule: (ScrollTrigger: unknown) => ({ ScrollTrigger }),
    },
    {
      label: 'nested defaults',
      coreModule: (gsap: unknown) => ({ default: { gsap } }),
      pluginModule: (ScrollTrigger: unknown) => ({
        default: { ScrollTrigger },
      }),
    },
    {
      label: 'direct defaults',
      coreModule: (gsap: unknown) => ({ default: gsap }),
      pluginModule: (ScrollTrigger: unknown) => ({ default: ScrollTrigger }),
    },
  ])('normalizes $label', async ({ coreModule, pluginModule }) => {
    const gsap = { registerPlugin: vi.fn() }
    const ScrollTrigger = { name: 'ScrollTrigger' }

    await expect(
      importRallyMotion({
        loadMotionCore: async () => coreModule(gsap),
        loadScrollTrigger: async () => pluginModule(ScrollTrigger),
      }),
    ).resolves.toEqual({ gsap, ScrollTrigger })
  })

  it.each([
    [{}, { ScrollTrigger: {} }],
    [{ gsap: {} }, { ScrollTrigger: {} }],
    [{ gsap: { registerPlugin: vi.fn() } }, {}],
  ])('rejects incomplete module shapes', async (core, plugin) => {
    await expect(
      importRallyMotion({
        loadMotionCore: async () => core,
        loadScrollTrigger: async () => plugin,
      }),
    ).rejects.toBeInstanceOf(TypeError)
  })

  it('registers and constructs only an accepted generation', async () => {
    const gate = createRallyMotionGate()
    const generation = gate.issueGeneration()
    const gsap = { registerPlugin: vi.fn() }
    const ScrollTrigger = { name: 'ScrollTrigger' }
    const createRuntime = vi.fn(() => ({ generation }))

    await expect(
      loadRallyMotion({
        generation,
        isCurrent: gate.isCurrent,
        isCanceled: () => false,
        motionLoaders: {
          loadMotionCore: async () => ({ gsap }),
          loadScrollTrigger: async () => ({ ScrollTrigger }),
        },
        createRuntime,
      }),
    ).resolves.toEqual({
      status: 'created',
      runtime: { generation },
    })
    expect(gsap.registerPlugin).toHaveBeenCalledOnce()
    expect(gsap.registerPlugin).toHaveBeenCalledWith(ScrollTrigger)
    expect(createRuntime).toHaveBeenCalledOnce()
  })

  it('rejects stale and canceled fulfillment before registration or construction', async () => {
    const gate = createRallyMotionGate()
    const pending = deferred<unknown>()
    const firstGeneration = gate.issueGeneration()
    let canceled = false
    const gsap = { registerPlugin: vi.fn() }
    const createRuntime = vi.fn()
    const staleLoad = loadRallyMotion({
      generation: firstGeneration,
      isCurrent: gate.isCurrent,
      isCanceled: () => canceled,
      importMotion: () => pending.promise,
      createRuntime,
    })

    gate.issueGeneration()
    pending.resolve({ gsap })
    await expect(staleLoad).resolves.toEqual({ status: 'stale' })

    canceled = true
    await expect(
      loadRallyMotion({
        generation: firstGeneration,
        isCurrent: gate.isCurrent,
        isCanceled: () => canceled,
        importMotion: async () => ({ gsap }),
        createRuntime,
      }),
    ).resolves.toEqual({ status: 'canceled' })
    expect(gsap.registerPlugin).not.toHaveBeenCalled()
    expect(createRuntime).not.toHaveBeenCalled()
  })

  it('swallows obsolete rejection but propagates current rejection', async () => {
    const failure = new Error('motion unavailable')
    const createRuntime = vi.fn()

    await expect(
      loadRallyMotion({
        generation: 1,
        isCurrent: () => false,
        isCanceled: () => true,
        importMotion: async () => {
          throw failure
        },
        createRuntime,
      }),
    ).resolves.toEqual({ status: 'canceled' })
    await expect(
      loadRallyMotion({
        generation: 1,
        isCurrent: () => false,
        isCanceled: () => false,
        importMotion: async () => {
          throw failure
        },
        createRuntime,
      }),
    ).resolves.toEqual({ status: 'stale' })
    await expect(
      loadRallyMotion({
        generation: 1,
        isCurrent: () => true,
        isCanceled: () => false,
        importMotion: async () => {
          throw failure
        },
        createRuntime,
      }),
    ).rejects.toBe(failure)
    expect(createRuntime).not.toHaveBeenCalled()
  })
})
