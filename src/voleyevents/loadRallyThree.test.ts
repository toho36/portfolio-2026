import { describe, expect, it, vi } from 'vitest'
import { importRallyThree, loadRallyThree } from './loadRallyThree'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

const validThree = {
  WebGLRenderer: class WebGLRenderer {},
  Scene: class Scene {},
  PerspectiveCamera: class PerspectiveCamera {},
}

describe('VoleyEvents rally Three loader', () => {
  it.each([
    ['named exports', validThree],
    ['nested default', { default: validThree }],
  ])('normalizes %s', async (_label, module) => {
    await expect(importRallyThree(async () => module)).resolves.toEqual(
      validThree,
    )
  })

  it.each([
    {},
    { WebGLRenderer: class {}, Scene: class {} },
    { ...validThree, PerspectiveCamera: {} },
  ])('rejects incomplete module shapes', async (module) => {
    await expect(importRallyThree(async () => module)).rejects.toBeInstanceOf(
      TypeError,
    )
  })

  it('constructs only the current accepted generation', async () => {
    const createRuntime = vi.fn(() => ({ id: 'three-part' }))

    await expect(
      loadRallyThree({
        generation: 4,
        isCurrent: (value) => value === 4,
        isCanceled: () => false,
        importThree: async () => validThree,
        createRuntime,
      }),
    ).resolves.toEqual({
      status: 'created',
      runtime: { id: 'three-part' },
    })
    expect(createRuntime).toHaveBeenCalledWith(validThree)
  })

  it('rejects stale and canceled fulfillment before construction', async () => {
    const pending = deferred<unknown>()
    const createRuntime = vi.fn()
    let generation = 1
    let canceled = false
    const staleLoad = loadRallyThree({
      generation,
      isCurrent: (value) => value === generation,
      isCanceled: () => canceled,
      importThree: () => pending.promise,
      createRuntime,
    })

    generation = 2
    pending.resolve(validThree)
    await expect(staleLoad).resolves.toEqual({ status: 'stale' })

    canceled = true
    await expect(
      loadRallyThree({
        generation: 1,
        isCurrent: (value) => value === generation,
        isCanceled: () => canceled,
        importThree: async () => validThree,
        createRuntime,
      }),
    ).resolves.toEqual({ status: 'canceled' })
    expect(createRuntime).not.toHaveBeenCalled()
  })

  it('swallows obsolete rejection but propagates current rejection', async () => {
    const failure = new Error('three unavailable')
    const createRuntime = vi.fn()
    const rejectedImport = async () => {
      throw failure
    }

    await expect(
      loadRallyThree({
        generation: 1,
        isCurrent: () => false,
        isCanceled: () => true,
        importThree: rejectedImport,
        createRuntime,
      }),
    ).resolves.toEqual({ status: 'canceled' })
    await expect(
      loadRallyThree({
        generation: 1,
        isCurrent: () => false,
        isCanceled: () => false,
        importThree: rejectedImport,
        createRuntime,
      }),
    ).resolves.toEqual({ status: 'stale' })
    await expect(
      loadRallyThree({
        generation: 1,
        isCurrent: () => true,
        isCanceled: () => false,
        importThree: rejectedImport,
        createRuntime,
      }),
    ).rejects.toBe(failure)
    expect(createRuntime).not.toHaveBeenCalled()
  })
})
