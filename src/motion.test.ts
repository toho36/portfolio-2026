import { describe, expect, it } from 'vitest'
import { presentProgress } from './motion'

describe('motion presentation policy', () => {
  it('preserves continuous progress normally', () => {
    expect(presentProgress(0.42, 4, false)).toEqual({
      progress: 0.42,
      mode: 'continuous',
    })
  })

  it('targets the same ordered stops without interpolation when reduced', () => {
    expect(presentProgress(0.42, 4, true)).toEqual({
      progress: 1 / 3,
      mode: 'discrete',
    })
    expect(presentProgress(0.9, 4, true)).toEqual({
      progress: 1,
      mode: 'discrete',
    })
  })
})
