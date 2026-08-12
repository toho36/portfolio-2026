import { describe, expect, it } from 'vitest'
import { measureRallyStaircase } from './rallyProgress'

const LANDINGS = [
  { id: 'event-opens', top: 700 },
  { id: 'player-registers', top: 1100 },
  { id: 'payment-matches', top: 1500 },
  { id: 'attendance-resolves', top: 1900 },
] as const

function measure(
  overrides: Partial<Parameters<typeof measureRallyStaircase>[0]> = {},
) {
  return measureRallyStaircase({
    rootTop: 200,
    viewportHeight: 800,
    documentMaximumScroll: 2100,
    scrollY: 300,
    landings: LANDINGS,
    ...overrides,
  })
}

describe('rally staircase measured progress', () => {
  it('maps the hero and four native landing positions monotonically', () => {
    const geometry = measure()

    expect(geometry.origin).toBe(500)
    expect(geometry.end).toBe(2100)
    expect(geometry.landings).toEqual([
      { id: 'event-opens', index: 1, start: 600, progress: 0.0625 },
      { id: 'player-registers', index: 2, start: 1000, progress: 0.3125 },
      { id: 'payment-matches', index: 3, start: 1400, progress: 0.5625 },
      { id: 'attendance-resolves', index: 4, start: 1800, progress: 0.8125 },
    ])
    expect([
      geometry.stateFor(500).id,
      geometry.stateFor(600).id,
      geometry.stateFor(1000).id,
      geometry.stateFor(1400).id,
      geometry.stateFor(1800).id,
    ]).toEqual([
      'serve',
      'event-opens',
      'player-registers',
      'payment-matches',
      'attendance-resolves',
    ])
  })

  it('returns identical states at identical positions forward and reverse', () => {
    const geometry = measure()
    const positions = [400, 500, 599, 600, 999, 1000, 1400, 1800, 2100, 2400]
    const forward = positions.map((position) => geometry.stateFor(position))
    const reverse = [...positions]
      .reverse()
      .map((position) => geometry.stateFor(position))

    expect(reverse).toEqual([...forward].reverse())
  })

  it('clamps both endpoints and latches the final landing', () => {
    const geometry = measure()

    expect(geometry.progressFor(-1000)).toBe(0)
    expect(geometry.stateFor(-1000)).toEqual({
      id: 'serve',
      index: 0,
      progress: 0,
    })
    expect(geometry.progressFor(9000)).toBe(1)
    expect(geometry.stateFor(9000)).toEqual({
      id: 'attendance-resolves',
      index: 4,
      progress: 1,
    })
  })

  it('uses exact global progress at landing thresholds with later ties winning', () => {
    const geometry = measure({
      landings: [
        { id: 'event-opens', top: 700 },
        { id: 'player-registers', top: 1100 },
        { id: 'payment-matches', top: 900 },
        { id: 'attendance-resolves', top: 9000 },
      ],
    })

    for (const landing of geometry.landings) {
      expect(geometry.progressFor(landing.start)).toBe(landing.progress)
    }
    expect(geometry.landings.map(({ start }) => start)).toEqual([
      600, 1000, 1000, 2100,
    ])
    expect(geometry.stateFor(1000).id).toBe('payment-matches')
    expect(geometry.stateFor(2100).id).toBe('attendance-resolves')
  })

  it('keeps the origin and landing states stable when remeasured after scrolling', () => {
    const geometry = measure({
      rootTop: -500,
      scrollY: 1000,
      landings: [
        { id: 'event-opens', top: -300 },
        { id: 'player-registers', top: 100 },
        { id: 'payment-matches', top: 500 },
        { id: 'attendance-resolves', top: 900 },
      ],
    })

    expect(geometry.origin).toBe(500)
    expect(geometry.landings.map(({ start }) => start)).toEqual([
      500, 700, 1100, 1500,
    ])
    expect(geometry.stateFor(499).id).toBe('serve')
    expect(geometry.stateFor(500).id).toBe('event-opens')

    const laterMeasurement = measure({
      rootTop: -900,
      scrollY: 1400,
      landings: [
        { id: 'event-opens', top: -700 },
        { id: 'player-registers', top: -300 },
        { id: 'payment-matches', top: 100 },
        { id: 'attendance-resolves', top: 500 },
      ],
    })

    expect(laterMeasurement.origin).toBe(geometry.origin)
    expect(laterMeasurement.landings).toEqual(geometry.landings)
    expect(laterMeasurement.stateFor(1100)).toEqual(geometry.stateFor(1100))
  })

  it('normalizes descending, unreachable and non-finite thresholds', () => {
    const geometry = measure({
      viewportHeight: Number.NaN,
      documentMaximumScroll: Number.POSITIVE_INFINITY,
      landings: [
        { id: 'event-opens', top: 900 },
        { id: 'player-registers', top: 800 },
        { id: 'payment-matches', top: Number.NaN },
        { id: 'attendance-resolves', top: 1200 },
      ],
    })

    expect(geometry.end).toBe(500)
    expect(geometry.landings.map(({ start }) => start)).toEqual([
      500, 500, 500, 500,
    ])
    expect(geometry.progressFor(5000)).toBe(0)
    expect(geometry.stateFor(499).id).toBe('serve')
    expect(geometry.stateFor(500).id).toBe('attendance-resolves')
  })

  it('deep-freezes geometry, landing records and returned states', () => {
    const geometry = measure()
    const state = geometry.stateFor(1400)

    expect(Object.isFrozen(geometry)).toBe(true)
    expect(Object.isFrozen(geometry.landings)).toBe(true)
    expect(geometry.landings.every(Object.isFrozen)).toBe(true)
    expect(Object.isFrozen(state)).toBe(true)
  })

  it('requires exactly four landing measurements', () => {
    expect(() => measure({ landings: LANDINGS.slice(0, 3) })).toThrow(
      'Rally staircase requires exactly four landings.',
    )
    expect(() => measure({ landings: [...LANDINGS, LANDINGS[0]] })).toThrow(
      'Rally staircase requires exactly four landings.',
    )
  })
})
