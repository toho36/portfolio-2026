import { describe, expect, it } from 'vitest'
import { readBest, recordRun } from './wireScore'

const storage = () => {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v) } }
}

describe('wire score', () => {
  it('defaults for missing, corrupt and throwing storage', () => {
    expect(readBest(null, 'easy')).toEqual({ bestPercent: 0, bestTimeMs: null })
    expect(readBest({ getItem: () => '{bad' }, 'easy')).toEqual({ bestPercent: 0, bestTimeMs: null })
    expect(readBest({ getItem: () => { throw Error() } }, 'easy')).toEqual({ bestPercent: 0, bestTimeMs: null })
  })
  it('retains max progress and fastest finish independently per mode', () => {
    const s = storage()
    recordRun(s, 'easy', 80, null)
    recordRun(s, 'easy', 20, null)
    recordRun(s, 'easy', 100, 5000)
    recordRun(s, 'easy', 100, 7000)
    recordRun(s, 'easy', 100, 4000)
    recordRun(s, 'hard', 40, null)
    expect(readBest(s, 'easy')).toEqual({ bestPercent: 100, bestTimeMs: 4000 })
    expect(readBest(s, 'hard')).toEqual({ bestPercent: 40, bestTimeMs: null })
  })
  it('returns merged best if writing throws', () => {
    const s = { getItem: () => null, setItem: () => { throw Error() } }
    expect(recordRun(s, 'easy', 70, null)).toEqual({ bestPercent: 70, bestTimeMs: null })
  })
})
