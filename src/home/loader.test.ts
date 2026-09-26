import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLoader } from './loader'

afterEach(() => vi.useRealTimers())
describe('home loader', () => {
  it('reports monotonic readiness and finishes once', () => {
    vi.useFakeTimers()
    const progress: number[] = []
    const done = vi.fn()
    const loader = createLoader({ steps: ['fonts', 'three', 'firstFrame'], onProgress: (p) => progress.push(p), onDone: done })
    loader.mark('three'); loader.mark('three'); loader.mark('fonts'); loader.mark('firstFrame')
    vi.runAllTimers()
    expect(progress).toEqual([0, 33, 67, 100])
    expect(done).toHaveBeenCalledTimes(1)
  })
  it('fails open after the timeout', () => {
    vi.useFakeTimers()
    const done = vi.fn()
    createLoader({ steps: ['fonts', 'three'], onProgress: () => {}, onDone: done, timeoutMs: 50 })
    vi.advanceTimersByTime(50)
    expect(done).toHaveBeenCalledOnce()
  })
})
