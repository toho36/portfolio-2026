import { describe, expect, it } from 'vitest'
import { resolveRelayBeats } from './relayBeats'

describe('relay beat resolver', () => {
  it('preserves exact fractional CSS-pixel coordinates', () => {
    const exact = 350.00000000000006
    const resolver = resolveRelayBeats(
      [
        { id: 'input', top: 0 },
        { id: 'fold', top: exact },
      ],
      1000,
    )

    expect(Object.is(resolver.beats[1].start, exact)).toBe(true)
    expect(Object.is(resolver.beats[1].seekTarget, exact)).toBe(true)
    expect(resolver.classify(exact).id).toBe('fold')
  })

  it('round-trips 350.4 without snapping to a nearby boundary', () => {
    const resolver = resolveRelayBeats(
      [
        { id: 'input', top: 0 },
        { id: 'fold', top: 350.4 },
      ],
      1000,
    )

    expect(resolver.seekTargetFor('fold')).toBe(350.4)
    expect(resolver.classify(350.4).id).toBe('fold')
    expect(resolver.classify(350.39999999999992).id).toBe('input')
  })

  it('keeps adjacent sub-pixel boundaries distinct with zero drift', () => {
    const resolver = resolveRelayBeats(
      [
        { id: 'origin', top: 0 },
        { id: 'input', top: 350 },
        { id: 'fold', top: 350.4 },
        { id: 'feedback', top: 350.75 },
      ],
      1000,
    )

    for (const beat of resolver.beats) {
      expect(resolver.seekTargetFor(beat.id)).toBe(beat.start)
      expect(resolver.classify(beat.seekTarget)).toBe(beat)
    }
  })

  it('classifies an exact integer boundary as the new beat', () => {
    const resolver = resolveRelayBeats(
      [
        { id: 'input', top: 0 },
        { id: 'fold', top: 400 },
      ],
      1000,
    )

    expect(resolver.classify(399.99999999999994).id).toBe('input')
    expect(resolver.classify(400).id).toBe('fold')
  })

  it('resolves duplicate and zero-height ties to the later authored beat', () => {
    const resolver = resolveRelayBeats(
      [
        { id: 'input', top: 0 },
        { id: 'fold', top: 400 },
        { id: 'feedback', top: 400 },
      ],
      1000,
    )

    expect(resolver.classify(400)).toBe(resolver.beats[2])
    expect(resolver.classify(resolver.seekTargetFor('fold')).id).toBe(
      'feedback',
    )
  })

  it('normalizes negative and non-finite coordinates to positive zero', () => {
    const resolver = resolveRelayBeats(
      [
        { id: 'negative', top: -120 },
        { id: 'nan', top: Number.NaN },
        { id: 'positive-infinity', top: Number.POSITIVE_INFINITY },
        { id: 'negative-infinity', top: Number.NEGATIVE_INFINITY },
        { id: 'negative-zero', top: -0 },
      ],
      500,
    )

    expect(resolver.beats.map(({ start }) => start)).toEqual([0, 0, 0, 0, 0])
    expect(resolver.beats.every(({ start }) => Object.is(start, 0))).toBe(true)
    expect(resolver.classify(-1).id).toBe('negative-zero')
    expect(resolver.classify(Number.NaN).id).toBe('negative-zero')
    expect(resolver.classify(Number.POSITIVE_INFINITY).id).toBe(
      'negative-zero',
    )
  })

  it('normalizes an invalid maximum and classification input to zero', () => {
    for (const maxScroll of [
      -1,
      -0,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      const resolver = resolveRelayBeats([{ id: 'only', top: 20 }], maxScroll)

      expect(Object.is(resolver.maxScroll, 0)).toBe(true)
      expect(Object.is(resolver.beats[0].seekTarget, 0)).toBe(true)
      expect(resolver.classify(Number.NEGATIVE_INFINITY).id).toBe('only')
    }
  })

  it('saturates unreachable starts and resolves the final clamp to the latest tie', () => {
    const resolver = resolveRelayBeats(
      [
        { id: 'input', top: 0 },
        { id: 'fold', top: 800 },
        { id: 'feedback', top: 900 },
      ],
      700,
    )

    expect(resolver.seekTargetFor('fold')).toBe(700)
    expect(resolver.seekTargetFor('feedback')).toBe(700)
    expect(resolver.classify(700).id).toBe('feedback')
    expect(resolver.classify(5700).id).toBe('feedback')
  })

  it('exposes the exact normalized start and seek-target truth table', () => {
    const resolver = resolveRelayBeats(
      [
        { id: 'input', top: -20 },
        { id: 'fold', top: 350.4 },
        { id: 'feedback', top: 400 },
        { id: 'closed', top: 900 },
      ],
      640.25,
    )

    expect(resolver.beats).toEqual([
      { id: 'input', index: 0, start: 0, seekTarget: 0 },
      { id: 'fold', index: 1, start: 350.4, seekTarget: 350.4 },
      { id: 'feedback', index: 2, start: 400, seekTarget: 400 },
      { id: 'closed', index: 3, start: 900, seekTarget: 640.25 },
    ])
  })

  it('always round-trips classified coordinates', () => {
    const resolver = resolveRelayBeats(
      [
        { id: 'input', top: 0 },
        { id: 'fold', top: 350.4 },
        { id: 'feedback', top: 350.75 },
        { id: 'closed', top: 900 },
      ],
      640.25,
    )

    for (const y of [
      -20,
      0,
      349.9,
      350.4,
      350.6,
      400,
      640.25,
      5000,
      Number.NaN,
    ]) {
      const classified = resolver.classify(y)
      const normalizedY = Number.isFinite(y) && y > 0 ? y : 0
      const clampedY = Math.min(normalizedY, resolver.maxScroll)

      expect(classified.seekTarget).toBeLessThanOrEqual(clampedY)
      expect(resolver.classify(classified.seekTarget)).toBe(classified)
    }
  })

  it('rejects measurements without a zero seek target', () => {
    expect(() =>
      resolveRelayBeats(
        [
          { id: 'input', top: 100 },
          { id: 'fold', top: 100 },
          { id: 'feedback', top: 200 },
        ],
        500,
      ),
    ).toThrow(
      new Error('The first relay beat must have a zero seek target.'),
    )
  })

  it('round-trips ids only at unique reachable starts', () => {
    const resolver = resolveRelayBeats(
      [
        { id: 'input', top: 0 },
        { id: 'fold', top: 350.4 },
        { id: 'feedback', top: 500 },
      ],
      800,
    )

    for (const beat of resolver.beats) {
      expect(resolver.classify(resolver.seekTargetFor(beat.id))).toBe(beat)
    }
  })

  it('throws stable errors for an empty resolver and an unknown id', () => {
    expect(() => resolveRelayBeats([], 1000)).toThrow(
      new Error('Relay beats require at least one measurement.'),
    )

    const resolver = resolveRelayBeats([{ id: 'input', top: 0 }], 1000)
    expect(() => resolver.seekTargetFor('missing')).toThrow(
      new Error('Unknown relay beat id: missing'),
    )
  })
})
