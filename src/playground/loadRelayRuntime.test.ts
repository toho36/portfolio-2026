import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  createRelayRuntimeGate,
  loadRelayRuntime,
  type RelayMotionFacade,
} from './loadRelayRuntime'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

describe('route-local relay runtime loader', () => {
  it('normalizes the facade, registers once, then creates the runtime', async () => {
    const gate = createRelayRuntimeGate()
    const generation = gate.issueGeneration()
    const order: string[] = []
    const ScrollTrigger = { id: 'scroll-trigger' }
    const gsap = {
      registerPlugin: vi.fn((plugin: unknown) => {
        expect(plugin).toBe(ScrollTrigger)
        order.push('registerPlugin')
      }),
    }
    const createRuntime = vi.fn((motion: RelayMotionFacade) => {
      expect(motion).toEqual({ gsap, ScrollTrigger })
      order.push('createRuntime')
      return { generation }
    })

    await expect(
      loadRelayRuntime({
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
    expect(gsap.registerPlugin).toHaveBeenCalledTimes(1)
    expect(createRuntime).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['registerPlugin', 'createRuntime'])
  })

  it.each([
    {
      label: 'named exports',
      coreModule: (gsap: unknown) => ({ gsap }),
      pluginModule: (ScrollTrigger: unknown) => ({ ScrollTrigger }),
    },
    {
      label: 'nested default exports',
      coreModule: (gsap: unknown) => ({ default: { gsap } }),
      pluginModule: (ScrollTrigger: unknown) => ({
        default: { ScrollTrigger },
      }),
    },
    {
      label: 'direct default exports',
      coreModule: (gsap: unknown) => ({ default: gsap }),
      pluginModule: (ScrollTrigger: unknown) => ({ default: ScrollTrigger }),
    },
  ])('normalizes $label', async ({ coreModule, pluginModule }) => {
    const gate = createRelayRuntimeGate()
    const generation = gate.issueGeneration()
    const ScrollTrigger = { id: 'scroll-trigger' }
    const gsap = { registerPlugin: vi.fn() }
    const createRuntime = vi.fn(() => ({ generation }))

    await expect(
      loadRelayRuntime({
        generation,
        isCurrent: gate.isCurrent,
        isCanceled: () => false,
        motionLoaders: {
          loadMotionCore: async () => coreModule(gsap),
          loadScrollTrigger: async () => pluginModule(ScrollTrigger),
        },
        createRuntime,
      }),
    ).resolves.toEqual({
      status: 'created',
      runtime: { generation },
    })
    expect(gsap.registerPlugin).toHaveBeenCalledOnce()
    expect(gsap.registerPlugin).toHaveBeenCalledWith(ScrollTrigger)
    expect(createRuntime).toHaveBeenCalledWith({ gsap, ScrollTrigger })
  })

  it('waits for both motion imports before registering or creating', async () => {
    const gate = createRelayRuntimeGate()
    const generation = gate.issueGeneration()
    const pendingPlugin = deferred<unknown>()
    const ScrollTrigger = { id: 'scroll-trigger' }
    const gsap = { registerPlugin: vi.fn() }
    const createRuntime = vi.fn(() => ({ generation }))
    const load = loadRelayRuntime({
      generation,
      isCurrent: gate.isCurrent,
      isCanceled: () => false,
      motionLoaders: {
        loadMotionCore: async () => ({ gsap }),
        loadScrollTrigger: () => pendingPlugin.promise,
      },
      createRuntime,
    })

    await Promise.resolve()
    expect(gsap.registerPlugin).not.toHaveBeenCalled()
    expect(createRuntime).not.toHaveBeenCalled()

    pendingPlugin.resolve({ ScrollTrigger })

    await expect(load).resolves.toEqual({
      status: 'created',
      runtime: { generation },
    })
    expect(gsap.registerPlugin).toHaveBeenCalledOnce()
    expect(createRuntime).toHaveBeenCalledOnce()
  })

  it('registers and creates only generation 3 in the default race', async () => {
    const gate = createRelayRuntimeGate()
    const pendingCore = deferred<unknown>()
    const pendingPlugin = deferred<unknown>()
    const ScrollTrigger = { id: 'scroll-trigger' }
    const staleGsap = { registerPlugin: vi.fn() }
    const currentGsap = { registerPlugin: vi.fn() }
    const firstGeneration = gate.issueGeneration()
    let coreLoadCount = 0
    const motionLoaders = {
      loadMotionCore: vi.fn(() => {
        const gsap = coreLoadCount === 0 ? staleGsap : currentGsap
        coreLoadCount += 1
        return pendingCore.promise.then(() => ({ gsap }))
      }),
      loadScrollTrigger: vi.fn(() => pendingPlugin.promise),
    }
    const firstCreateRuntime = vi.fn(() => ({
      generation: firstGeneration,
    }))
    const firstLoad = loadRelayRuntime({
      generation: firstGeneration,
      isCurrent: gate.isCurrent,
      isCanceled: () => false,
      motionLoaders,
      createRuntime: firstCreateRuntime,
    })

    const canceledReducedMotionGeneration = gate.issueGeneration()
    const thirdGeneration = gate.issueGeneration()
    const thirdCreateRuntime = vi.fn(() => ({
      generation: thirdGeneration,
    }))
    const thirdLoad = loadRelayRuntime({
      generation: thirdGeneration,
      isCurrent: gate.isCurrent,
      isCanceled: () => false,
      motionLoaders,
      createRuntime: thirdCreateRuntime,
    })

    expect(canceledReducedMotionGeneration).toBe(2)
    pendingCore.resolve({})
    pendingPlugin.resolve({ ScrollTrigger })

    await expect(firstLoad).resolves.toEqual({ status: 'stale' })
    await expect(thirdLoad).resolves.toEqual({
      status: 'created',
      runtime: { generation: thirdGeneration },
    })
    expect(motionLoaders.loadMotionCore).toHaveBeenCalledTimes(2)
    expect(motionLoaders.loadScrollTrigger).toHaveBeenCalledTimes(2)
    expect(staleGsap.registerPlugin).not.toHaveBeenCalled()
    expect(firstCreateRuntime).not.toHaveBeenCalled()
    expect(currentGsap.registerPlugin).toHaveBeenCalledOnce()
    expect(currentGsap.registerPlugin).toHaveBeenCalledWith(ScrollTrigger)
    expect(thirdCreateRuntime).toHaveBeenCalledOnce()
  })

  it('does not register or create when the default load is canceled', async () => {
    const gate = createRelayRuntimeGate()
    const generation = gate.issueGeneration()
    const pendingCore = deferred<unknown>()
    const pendingPlugin = deferred<unknown>()
    const ScrollTrigger = { id: 'scroll-trigger' }
    const gsap = { registerPlugin: vi.fn() }
    const createRuntime = vi.fn()
    let canceled = false
    const load = loadRelayRuntime({
      generation,
      isCurrent: gate.isCurrent,
      isCanceled: () => canceled,
      motionLoaders: {
        loadMotionCore: () => pendingCore.promise,
        loadScrollTrigger: () => pendingPlugin.promise,
      },
      createRuntime,
    })

    canceled = true
    pendingCore.resolve({ gsap })
    pendingPlugin.resolve({ ScrollTrigger })

    await expect(load).resolves.toEqual({ status: 'canceled' })
    expect(gsap.registerPlugin).not.toHaveBeenCalled()
    expect(createRuntime).not.toHaveBeenCalled()
  })

  it('preserves rejection precedence without default-path side effects', async () => {
    const failure = new Error('motion import failure')

    function rejectedLoad(options: {
      canceled: boolean
      stale: boolean
    }) {
      const gate = createRelayRuntimeGate()
      const generation = gate.issueGeneration()
      const gsap = { registerPlugin: vi.fn() }
      const createRuntime = vi.fn()
      const load = loadRelayRuntime({
        generation,
        isCurrent: gate.isCurrent,
        isCanceled: () => options.canceled,
        motionLoaders: {
          loadMotionCore: async () => ({ gsap }),
          loadScrollTrigger: () => Promise.reject(failure),
        },
        createRuntime,
      })

      if (options.stale) gate.issueGeneration()
      return { createRuntime, gsap, load }
    }

    const stale = rejectedLoad({ canceled: false, stale: true })
    await expect(stale.load).resolves.toEqual({ status: 'stale' })
    expect(stale.gsap.registerPlugin).not.toHaveBeenCalled()
    expect(stale.createRuntime).not.toHaveBeenCalled()

    const canceled = rejectedLoad({ canceled: true, stale: true })
    await expect(canceled.load).resolves.toEqual({ status: 'canceled' })
    expect(canceled.gsap.registerPlugin).not.toHaveBeenCalled()
    expect(canceled.createRuntime).not.toHaveBeenCalled()

    const current = rejectedLoad({ canceled: false, stale: false })
    await expect(current.load).rejects.toBe(failure)
    expect(current.gsap.registerPlugin).not.toHaveBeenCalled()
    expect(current.createRuntime).not.toHaveBeenCalled()
  })

  it.each([
    { label: 'null core', member: 'core', module: null },
    {
      label: 'undefined named core',
      member: 'core',
      module: { gsap: undefined },
    },
    {
      label: 'undefined default core',
      member: 'core',
      module: { default: undefined },
    },
    {
      label: 'undefined nested core',
      member: 'core',
      module: { default: { gsap: undefined } },
    },
    { label: 'null plugin', member: 'plugin', module: null },
    {
      label: 'undefined named plugin',
      member: 'plugin',
      module: { ScrollTrigger: undefined },
    },
    {
      label: 'undefined default plugin',
      member: 'plugin',
      module: { default: undefined },
    },
    {
      label: 'undefined nested plugin',
      member: 'plugin',
      module: { default: { ScrollTrigger: undefined } },
    },
  ])(
    'rejects a malformed $label module before registration or creation',
    async ({ member, module }) => {
      const gate = createRelayRuntimeGate()
      const generation = gate.issueGeneration()
      const gsap = { registerPlugin: vi.fn() }
      const ScrollTrigger = { id: 'scroll-trigger' }
      const createRuntime = vi.fn()

      await expect(
        loadRelayRuntime({
          generation,
          isCurrent: gate.isCurrent,
          isCanceled: () => false,
          motionLoaders: {
            loadMotionCore: async () =>
              member === 'core' ? module : { gsap },
            loadScrollTrigger: async () =>
              member === 'plugin' ? module : { ScrollTrigger },
          },
          createRuntime,
        }),
      ).rejects.toBeInstanceOf(TypeError)
      expect(gsap.registerPlugin).not.toHaveBeenCalled()
      expect(createRuntime).not.toHaveBeenCalled()
    },
  )

  it('creates only generation 3 across a pending false-true-false race', async () => {
    const gate = createRelayRuntimeGate()
    const pendingImport = deferred<{ id: string }>()
    const importMotion = vi.fn(() => pendingImport.promise)
    const creations: number[] = []
    const firstGeneration = gate.issueGeneration()
    const firstLoad = loadRelayRuntime({
      generation: firstGeneration,
      isCurrent: gate.isCurrent,
      isCanceled: () => false,
      importMotion,
      createRuntime: () => {
        creations.push(firstGeneration)
        return { generation: firstGeneration }
      },
    })

    const canceledReducedMotionGeneration = gate.issueGeneration()
    const thirdGeneration = gate.issueGeneration()
    const thirdLoad = loadRelayRuntime({
      generation: thirdGeneration,
      isCurrent: gate.isCurrent,
      isCanceled: () => false,
      importMotion,
      createRuntime: () => {
        creations.push(thirdGeneration)
        return { generation: thirdGeneration }
      },
    })

    expect(canceledReducedMotionGeneration).toBe(2)
    pendingImport.resolve({ id: 'fake-motion' })

    await expect(firstLoad).resolves.toEqual({ status: 'stale' })
    await expect(thirdLoad).resolves.toEqual({
      status: 'created',
      runtime: { generation: 3 },
    })
    expect(importMotion).toHaveBeenCalledTimes(2)
    expect(creations).toEqual([thirdGeneration])
  })

  it('creates no runtime when canceled before the import resolves', async () => {
    const gate = createRelayRuntimeGate()
    const generation = gate.issueGeneration()
    const pendingImport = deferred<{ id: string }>()
    const createRuntime = vi.fn()
    let canceled = false
    const load = loadRelayRuntime({
      generation,
      isCurrent: gate.isCurrent,
      isCanceled: () => canceled,
      importMotion: () => pendingImport.promise,
      createRuntime,
    })

    canceled = true
    pendingImport.resolve({ id: 'fake-motion' })

    await expect(load).resolves.toEqual({ status: 'canceled' })
    expect(createRuntime).not.toHaveBeenCalled()
  })

  it('settles a rejected stale import without creating or destroying', async () => {
    const gate = createRelayRuntimeGate()
    const generation = gate.issueGeneration()
    const pendingImport = deferred<{ id: string }>()
    const destroy = vi.fn()
    const createRuntime = vi.fn(() => ({ destroy }))
    const load = loadRelayRuntime({
      generation,
      isCurrent: gate.isCurrent,
      isCanceled: () => false,
      importMotion: () => pendingImport.promise,
      createRuntime,
    })

    gate.issueGeneration()
    pendingImport.reject(new Error('late import failure'))

    await expect(load).resolves.toEqual({ status: 'stale' })
    expect(createRuntime).not.toHaveBeenCalled()
    expect(destroy).not.toHaveBeenCalled()
  })

  it('gives cancellation precedence when a rejected request is also stale', async () => {
    const gate = createRelayRuntimeGate()
    const generation = gate.issueGeneration()
    const pendingImport = deferred<{ id: string }>()
    const load = loadRelayRuntime({
      generation,
      isCurrent: gate.isCurrent,
      isCanceled: () => true,
      importMotion: () => pendingImport.promise,
      createRuntime: vi.fn(),
    })

    gate.issueGeneration()
    pendingImport.reject(new Error('late import failure'))

    await expect(load).resolves.toEqual({ status: 'canceled' })
  })

  it('preserves current-generation import failures', async () => {
    const gate = createRelayRuntimeGate()
    const generation = gate.issueGeneration()
    const failure = new Error('current import failure')

    await expect(
      loadRelayRuntime({
        generation,
        isCurrent: gate.isCurrent,
        isCanceled: () => false,
        importMotion: () => Promise.reject(failure),
        createRuntime: vi.fn(),
      }),
    ).rejects.toBe(failure)
  })

  it('does not invoke an importer until an explicit load starts', async () => {
    const gate = createRelayRuntimeGate()
    const importMotion = vi.fn(async () => ({ id: 'fake-motion' }))
    const generation = gate.issueGeneration()

    expect(importMotion).not.toHaveBeenCalled()

    await expect(
      loadRelayRuntime({
        generation,
        isCurrent: gate.isCurrent,
        isCanceled: () => false,
        importMotion,
        createRuntime: () => ({ generation }),
      }),
    ).resolves.toEqual({
      status: 'created',
      runtime: { generation },
    })
    expect(importMotion).toHaveBeenCalledTimes(1)
  })

  it('contains exactly two literal dynamic gsap imports and no eager form', () => {
    const source = readFileSync(
      new URL('./loadRelayRuntime.ts', import.meta.url),
      'utf8',
    )

    expect(
      source.match(/\bimport\s*\(\s*['"]gsap(?:\/[^'"]*)?['"]\s*\)/g),
    ).toEqual(["import('gsap')", "import('gsap/ScrollTrigger')"])
    expect(source.match(/\bimport\s*\(/g)).toHaveLength(2)
    expect(source).not.toMatch(/\bfrom\s*['"]gsap(?:\/[^'"]*)?['"]/)
    expect(source).not.toMatch(/\bimport\s*['"]gsap(?:\/[^'"]*)?['"]/)
    expect(source).not.toMatch(/\brequire\s*\(\s*['"]gsap(?:\/[^'"]*)?['"]\s*\)/)
  })
})
