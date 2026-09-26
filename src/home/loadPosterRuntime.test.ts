import { describe, expect, it } from 'vitest'
import { loadPosterRuntime } from './loadPosterRuntime'

describe('loadPosterRuntime', () => {
  it('loads both dependencies before creating and reports real progress', async () => {
    const progress: number[] = []
    const result = await loadPosterRuntime({
      isCanceled: () => false, onProgress: (p) => progress.push(p),
      importThree: async () => 'three', importGsap: async () => 'gsap',
      createRuntime: (three, gsap) => `${three}/${gsap}`,
    })
    expect(result).toEqual({ status: 'created', runtime: 'three/gsap' })
    expect(progress).toEqual([0, 50, 80, 100])
  })

  it('cancels between imports without creating', async () => {
    let canceled = false
    const progress: number[] = []
    const result = await loadPosterRuntime({
      isCanceled: () => canceled, onProgress: (p) => progress.push(p),
      importThree: async () => 'three',
      importGsap: async () => { canceled = true; return 'gsap' },
      createRuntime: () => { throw new Error('created after cancellation') },
    })
    expect(result).toEqual({ status: 'canceled' })
    expect(progress).toEqual([0, 50])
  })

  it('destroys a runtime created while a route changes', async () => {
    let canceled = false, destroyed = 0
    const result = await loadPosterRuntime({
      isCanceled: () => canceled, onProgress: () => {},
      importThree: async () => ({}), importGsap: async () => ({}),
      createRuntime: async () => { canceled = true; return { destroy: () => { destroyed++ } } },
    })
    expect(result).toEqual({ status: 'canceled' })
    expect(destroyed).toBe(1)
  })

  it('returns import and creation failures without throwing', async () => {
    for (const failedAt of ['three', 'gsap', 'runtime']) {
      const result = await loadPosterRuntime({
        isCanceled: () => false, onProgress: () => {},
        importThree: async () => { if (failedAt === 'three') throw Error('three'); return {} },
        importGsap: async () => { if (failedAt === 'gsap') throw Error('gsap'); return {} },
        createRuntime: () => { throw Error('runtime') },
      })
      expect(result.status).toBe('failed')
    }
  })
})
