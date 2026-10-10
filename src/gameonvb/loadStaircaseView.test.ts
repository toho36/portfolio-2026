import { describe, expect, it, vi } from 'vitest'
import { loadStaircaseView } from './loadStaircaseView'

describe('route-local staircase loading', () => {
  it('never constructs a view after import was cancelled', async () => {
    let cancelled = false
    let resolve!: (value: unknown) => void
    const pending = new Promise<unknown>(done => { resolve = done })
    const createView = vi.fn(() => ({ destroy: vi.fn() }))
    const result = loadStaircaseView({ isCanceled: () => cancelled, importThree: () => pending, createView })
    cancelled = true
    resolve({})
    expect(await result).toEqual({ status: 'canceled' })
    expect(createView).not.toHaveBeenCalled()
  })
  it('disposes a view completed after cancellation exactly once', async () => {
    let cancelled = false
    const view = { destroy: vi.fn() }
    const result = await loadStaircaseView({
      isCanceled: () => cancelled,
      importThree: async () => ({}),
      createView: () => { cancelled = true; return view },
    })
    expect(result).toEqual({ status: 'canceled' })
    expect(view.destroy).toHaveBeenCalledTimes(1)
  })
  it('returns the created view and reports genuine import failure', async () => {
    const view = { destroy: vi.fn() }
    expect(await loadStaircaseView({ isCanceled: () => false, importThree: async () => ({}), createView: () => view })).toEqual({ status: 'created', view })
    const error = new Error('Unavailable')
    expect(await loadStaircaseView({ isCanceled: () => false, importThree: async () => { throw error }, createView: () => view })).toEqual({ status: 'failed', error })
  })
})
