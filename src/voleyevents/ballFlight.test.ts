import { describe, expect, it } from 'vitest'
import { BALL_FLIGHT, sampleBallFlight } from './ballFlight'

describe('volleyball flight', () => {
  it('follows one deterministic arc and settles at the landing point', () => {
    const start = sampleBallFlight(0)
    const apex = sampleBallFlight(BALL_FLIGHT.flightMs / 2)
    const landing = sampleBallFlight(BALL_FLIGHT.flightMs)
    const resting = sampleBallFlight(BALL_FLIGHT.flightMs + 200)

    expect(start).toMatchObject({ x: 72, y: 410, progress: 0, impact: 0 })
    expect(apex.x).toBeCloseTo(320)
    expect(apex.y).toBeLessThan(start.y)
    expect(landing).toMatchObject({ x: 568, y: 424, progress: 1 })
    expect(landing.impact).toBe(1)
    expect(resting.x).toBe(landing.x)
    expect(resting.y).toBe(landing.y)
    expect(resting.impact).toBeLessThan(landing.impact)
  })

  it('restarts after the landing hold without accumulating drift', () => {
    const first = sampleBallFlight(123)
    const nextCycle = sampleBallFlight(123 + BALL_FLIGHT.cycleMs)

    expect(nextCycle).toEqual(first)
  })
})
