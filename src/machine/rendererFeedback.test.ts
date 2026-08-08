import { describe, expect, it } from 'vitest'
import {
  cylinderSegmentsForDpr,
  deriveCartridgeSettleFeedback,
} from './rendererFeedback'

const STATIC_FEEDBACK = {
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
  slotOpacity: 0.3,
}

describe('cartridge settle renderer feedback', () => {
  it('uses exact static endpoints for both settle kinds', () => {
    for (const kind of ['seat', 'return'] as const) {
      expect(deriveCartridgeSettleFeedback(kind, 0, false)).toEqual(
        STATIC_FEEDBACK,
      )
      expect(deriveCartridgeSettleFeedback(kind, 1, false)).toEqual(
        STATIC_FEEDBACK,
      )
    }
  })

  it('clamps progress before deriving feedback', () => {
    expect(deriveCartridgeSettleFeedback('seat', -1, false)).toEqual(
      STATIC_FEEDBACK,
    )
    expect(deriveCartridgeSettleFeedback('return', 2, false)).toEqual(
      STATIC_FEEDBACK,
    )
  })

  it('stays within the declared seat and return bounds', () => {
    const cases = [
      {
        kind: 'seat' as const,
        bounds: {
          scaleX: [1, 1.06],
          scaleY: [0.95, 1],
          scaleZ: [1, 1.06],
          slotOpacity: [0.3, 0.55],
        },
      },
      {
        kind: 'return' as const,
        bounds: {
          scaleX: [1, 1.03],
          scaleY: [0.98, 1],
          scaleZ: [1, 1.03],
          slotOpacity: [0.3, 0.42],
        },
      },
    ]

    for (const { kind, bounds } of cases) {
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        const feedback = deriveCartridgeSettleFeedback(kind, progress, false)
        for (const key of Object.keys(bounds) as Array<keyof typeof bounds>) {
          expect(feedback[key]).toBeGreaterThanOrEqual(bounds[key][0])
          expect(feedback[key]).toBeLessThanOrEqual(bounds[key][1])
        }
      }
    }

    expect(deriveCartridgeSettleFeedback('seat', 0.5, false)).toEqual({
      scaleX: 1.06,
      scaleY: 0.95,
      scaleZ: 1.06,
      slotOpacity: 0.55,
    })
    expect(deriveCartridgeSettleFeedback('return', 0.5, false)).toEqual({
      scaleX: 1.03,
      scaleY: 0.98,
      scaleZ: 1.03,
      slotOpacity: 0.42,
    })
  })

  it('keeps reduced-motion feedback exact and static', () => {
    for (const kind of ['seat', 'return'] as const) {
      for (const progress of [-1, 0, 0.5, 1, 2]) {
        expect(deriveCartridgeSettleFeedback(kind, progress, true)).toEqual(
          STATIC_FEEDBACK,
        )
      }
    }
  })

  it('returns immutable feedback', () => {
    const endpoint = deriveCartridgeSettleFeedback('seat', 0, false)
    const interior = deriveCartridgeSettleFeedback('return', 0.5, false)
    const mutableInterior = interior as { scaleX: number }

    expect(Object.isFrozen(endpoint)).toBe(true)
    expect(Object.isFrozen(interior)).toBe(true)
    expect(() => {
      mutableInterior.scaleX = 99
    }).toThrow(TypeError)
    expect(interior.scaleX).toBe(1.03)
  })
})

describe('cylinder DPR segment tier', () => {
  it('uses 12 segments through DPR 1 and 24 above it', () => {
    expect(cylinderSegmentsForDpr(0.5)).toBe(12)
    expect(cylinderSegmentsForDpr(1)).toBe(12)
    expect(cylinderSegmentsForDpr(1.0001)).toBe(24)
    expect(cylinderSegmentsForDpr(2)).toBe(24)
  })
})
