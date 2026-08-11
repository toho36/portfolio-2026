import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  createRelayRuntimeGate,
  loadRelayRuntime,
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

  it('contains one dynamic gsap import and no eager import form', () => {
    const source = readFileSync(
      new URL('./loadRelayRuntime.ts', import.meta.url),
      'utf8',
    )

    expect(
      source.match(/\bimport\s*\(\s*['"]gsap(?:\/[^'"]*)?['"]\s*\)/g),
    ).toEqual(["import('gsap')"])
    expect(source).not.toMatch(/\bfrom\s*['"]gsap(?:\/[^'"]*)?['"]/)
    expect(source).not.toMatch(/\bimport\s*['"]gsap(?:\/[^'"]*)?['"]/)
    expect(source).not.toMatch(/\brequire\s*\(\s*['"]gsap(?:\/[^'"]*)?['"]\s*\)/)
  })
})
