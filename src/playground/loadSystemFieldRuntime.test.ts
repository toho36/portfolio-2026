import { describe, expect, it, vi } from 'vitest'
import { loadSystemFieldRuntime } from './loadSystemFieldRuntime'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

describe('System Field lazy loader', () => {
  it('does not construct canceled or stale generations', async () => {
    const pending = deferred<{ id: string }>()
    const createRuntime = vi.fn(() => ({ destroy: vi.fn() }))
    let generation = 1
    let canceled = false
    const load = loadSystemFieldRuntime({
      generation,
      isCurrent: (value) => value === generation,
      isCanceled: () => canceled,
      importThree: () => pending.promise,
      createRuntime,
    })

    generation = 2
    pending.resolve({ id: 'three' })
    await expect(load).resolves.toEqual({ status: 'stale' })
    expect(createRuntime).not.toHaveBeenCalled()

    const canceledLoad = loadSystemFieldRuntime({
      generation,
      isCurrent: (value) => value === generation,
      isCanceled: () => canceled,
      importThree: async () => ({ id: 'three' }),
      createRuntime,
    })
    canceled = true
    await expect(canceledLoad).resolves.toEqual({ status: 'canceled' })
    expect(createRuntime).not.toHaveBeenCalled()
  })

  it('constructs only the current accepted generation', async () => {
    const createRuntime = vi.fn(() => ({ id: 'field' }))

    await expect(loadSystemFieldRuntime({
      generation: 4,
      isCurrent: (value) => value === 4,
      isCanceled: () => false,
      importThree: async () => ({ id: 'three' }),
      createRuntime,
    })).resolves.toEqual({
      status: 'created',
      runtime: { id: 'field' },
    })
    expect(createRuntime).toHaveBeenCalledOnce()
  })
})
