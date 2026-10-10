import { describe, expect, it, vi } from 'vitest'
import { loadCalibreView } from './loadView'

describe('calibre route-local loading', () => {
  it('does not start either GPU import after cancellation', async () => {
    const three = vi.fn(), orbit = vi.fn(), create = vi.fn()
    expect(await loadCalibreView({ isCanceled: () => true, importThree: three, importOrbit: orbit, createView: create })).toEqual({ status: 'canceled' })
    expect(three).not.toHaveBeenCalled(); expect(orbit).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled()
  })
  it('checks cancellation after imports before creating a renderer', async () => {
    let canceled = false
    const create = vi.fn()
    const result = await loadCalibreView({ isCanceled: () => canceled, importThree: async () => { canceled = true; return {} }, importOrbit: async () => ({}), createView: create })
    expect(result.status).toBe('canceled'); expect(create).not.toHaveBeenCalled()
  })
  it('disposes a view created after its route was canceled', async () => {
    let canceled = false
    const destroy = vi.fn()
    const result = await loadCalibreView({ isCanceled: () => canceled, importThree: async () => ({}), importOrbit: async () => ({}), createView: () => { canceled = true; return { destroy } } })
    expect(result.status).toBe('canceled'); expect(destroy).toHaveBeenCalledTimes(1)
  })
  it('reports failed imports instead of inventing a ready renderer', async () => {
    const error = new Error('unavailable')
    const result = await loadCalibreView({ isCanceled: () => false, importThree: async () => { throw error }, importOrbit: async () => ({}), createView: () => ({ destroy() {} }) })
    expect(result).toEqual({ status: 'failed', error })
  })
  it('returns the one created view with both imported dependencies', async () => {
    const three = {}, orbit = {}, view = { destroy: vi.fn() }, create = vi.fn(() => view)
    const result = await loadCalibreView({ isCanceled: () => false, importThree: async () => three, importOrbit: async () => orbit, createView: create })
    expect(result).toEqual({ status: 'created', view }); expect(create).toHaveBeenCalledWith(three, orbit)
  })
})
