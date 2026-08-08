import { describe, expect, it } from 'vitest'
import {
  areCartridgeSettlePointsEqual,
  cartridgeSettlePolicy,
} from './cartridgeSettle'

describe('cartridge settle policy', () => {
  it('uses the exact seat and return motion policies', () => {
    expect(cartridgeSettlePolicy('seat', false)).toEqual({
      duration: 0.22,
      ease: 'back.out(1.35)',
    })
    expect(cartridgeSettlePolicy('return', false)).toEqual({
      duration: 0.18,
      ease: 'power2.out',
    })
  })

  it('keeps each ease but reduces its duration to zero', () => {
    expect(cartridgeSettlePolicy('seat', true)).toEqual({
      duration: 0,
      ease: 'back.out(1.35)',
    })
    expect(cartridgeSettlePolicy('return', true)).toEqual({
      duration: 0,
      ease: 'power2.out',
    })
  })

  it('uses an inclusive per-axis tolerance without mutating its inputs', () => {
    const from = Object.freeze({ x: 0, y: 0 })
    const atTolerance = Object.freeze({
      x: 1e-6,
      y: -1e-6,
    })
    const outsideTolerance = Object.freeze({
      x: 1e-6 + Number.EPSILON,
      y: 0,
    })

    expect(areCartridgeSettlePointsEqual(from, atTolerance)).toBe(true)
    expect(areCartridgeSettlePointsEqual(from, outsideTolerance)).toBe(false)
    expect(from).toEqual({ x: 0, y: 0 })
    expect(atTolerance).toEqual({ x: 1e-6, y: -1e-6 })
    expect(outsideTolerance).toEqual({
      x: 1e-6 + Number.EPSILON,
      y: 0,
    })
  })
})
