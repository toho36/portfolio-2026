import { describe, expect, it } from 'vitest'
import { loadWireRuntime } from './loadWireRuntime'

describe('loadWireRuntime', () => {
  it('reports monotonic progress and creates runtime', async () => {
    const seen: number[] = []
    const result = await loadWireRuntime({
      importThree: async () => ({}), isCanceled: () => false,
      onProgress: (p) => seen.push(p), createRuntime: () => 'rt',
    })
    expect(result).toEqual({ status: 'created', runtime: 'rt' })
    expect(seen).toEqual([0, 60, 100])
  })
  it('cancels after an await without creating', async () => {
    let canceled = false
    const result = await loadWireRuntime({
      importThree: async () => { canceled = true; return {} },
      isCanceled: () => canceled, onProgress: () => {},
      createRuntime: () => { throw new Error('created after cancel') },
    })
    expect(result).toEqual({ status: 'canceled' })
  })
  it('destroys a runtime created during cancellation', async () => {
    let canceled = false, destroyed = false
    const result = await loadWireRuntime({
      importThree: async () => ({}), isCanceled: () => canceled, onProgress: () => {},
      createRuntime: async () => { canceled = true; return { destroy: () => { destroyed = true } } },
    })
    expect(result.status).toBe('canceled')
    expect(destroyed).toBe(true)
  })
  it('returns failed on import rejection', async () => {
    const result = await loadWireRuntime({
      importThree: async () => { throw new Error('webgl unavailable') },
      isCanceled: () => false, onProgress: () => {}, createRuntime: () => 'rt',
    })
    expect(result.status).toBe('failed')
  })
})
