import { describe, expect, it } from 'vitest'
import { deriveMachineGroupChoreography } from './machineChoreography'

const STOPS = [0, 1 / 3, 2 / 3, 1] as const

describe('machine group choreography', () => {
  it('locks representative interior magnetization, ratchet, and transforms', () => {
    const choreography = deriveMachineGroupChoreography({
      conveyorProgress: 1 / 12,
      timelineProgress: 5 / 12,
      reducedMotion: false,
    })

    expect(choreography.magnetizedConveyorProgress).toBeCloseTo(5 / 96, 12)
    expect(choreography.magnetizedTimelineProgress).toBeCloseTo(37 / 96, 12)
    expect(choreography.ratchetOffset).toBeCloseTo(0.012, 12)
    expect(choreography.positionX).toBeCloseTo(-0.14925, 12)
    expect(choreography.positionY).toBeCloseTo(-0.020625, 12)
    expect(choreography.rotationX).toBeCloseTo(-11 / 1200, 12)
    expect(choreography.rotationY).toBeCloseTo(-0.21915833333333334, 12)
    expect(choreography.scale).toBeCloseTo(0.9754166666666667, 12)
  })

  it('clamps both channels independently and remains within safe bounds', () => {
    expect(
      deriveMachineGroupChoreography({
        conveyorProgress: -4,
        timelineProgress: 0.42,
        reducedMotion: false,
      }),
    ).toEqual(
      deriveMachineGroupChoreography({
        conveyorProgress: 0,
        timelineProgress: 0.42,
        reducedMotion: false,
      }),
    )
    expect(
      deriveMachineGroupChoreography({
        conveyorProgress: 0.73,
        timelineProgress: 8,
        reducedMotion: false,
      }),
    ).toEqual(
      deriveMachineGroupChoreography({
        conveyorProgress: 0.73,
        timelineProgress: 1,
        reducedMotion: false,
      }),
    )

    for (let index = 0; index <= 1000; index += 1) {
      const progress = index / 1000
      const choreography = deriveMachineGroupChoreography({
        conveyorProgress: progress,
        timelineProgress: 1 - progress,
        reducedMotion: false,
      })
      expect(choreography.positionX).toBeGreaterThanOrEqual(-0.192)
      expect(choreography.positionX).toBeLessThanOrEqual(0.192)
      expect(choreography.positionY).toBeGreaterThanOrEqual(-0.09)
      expect(choreography.positionY).toBeLessThanOrEqual(0.09)
      expect(choreography.rotationX).toBeGreaterThanOrEqual(-0.04)
      expect(choreography.rotationX).toBeLessThanOrEqual(0.04)
      expect(choreography.rotationY).toBeGreaterThanOrEqual(-0.2548)
      expect(choreography.rotationY).toBeLessThanOrEqual(0.2548)
      expect(choreography.scale).toBeGreaterThanOrEqual(0.96)
      expect(choreography.scale).toBeLessThanOrEqual(1)
    }
  })

  it('preserves every stop endpoint with a literal zero ratchet', () => {
    for (const stop of STOPS) {
      const choreography = deriveMachineGroupChoreography({
        conveyorProgress: stop,
        timelineProgress: stop,
        reducedMotion: false,
      })
      expect(choreography.magnetizedConveyorProgress).toBe(stop)
      expect(choreography.magnetizedTimelineProgress).toBe(stop)
      expect(choreography.ratchetOffset).toBe(0)
      expect(choreography.positionX).toBeCloseTo((stop - 0.5) * 0.36, 12)
      expect(choreography.positionY).toBeCloseTo((stop - 0.5) * 0.18, 12)
      expect(choreography.rotationX).toBeCloseTo((stop - 0.5) * 0.08, 12)
      expect(choreography.rotationY).toBeCloseTo((stop - 0.5) * 0.5, 12)
      expect(choreography.scale).toBeCloseTo(0.96 + stop * 0.04, 12)
    }
  })

  it('is deterministic and retraces the same outputs in reverse', () => {
    const inputs = [
      { conveyorProgress: 0.08, timelineProgress: 0.91 },
      { conveyorProgress: 0.29, timelineProgress: 0.64 },
      { conveyorProgress: 0.52, timelineProgress: 0.37 },
      { conveyorProgress: 0.88, timelineProgress: 0.12 },
    ].map((input) => ({ ...input, reducedMotion: false }))
    const forward = inputs.map(deriveMachineGroupChoreography)

    expect(inputs.map(deriveMachineGroupChoreography)).toEqual(forward)
    expect(
      [...inputs]
        .reverse()
        .map(deriveMachineGroupChoreography)
        .reverse(),
    ).toEqual(forward)
  })

  it('keeps both magnetized progress channels monotonic', () => {
    let previousConveyor = -Infinity
    let previousTimeline = -Infinity

    for (let index = 0; index <= 600; index += 1) {
      const progress = index / 600
      const choreography = deriveMachineGroupChoreography({
        conveyorProgress: progress,
        timelineProgress: progress,
        reducedMotion: false,
      })
      expect(choreography.magnetizedConveyorProgress).toBeGreaterThanOrEqual(
        previousConveyor,
      )
      expect(choreography.magnetizedTimelineProgress).toBeGreaterThanOrEqual(
        previousTimeline,
      )
      previousConveyor = choreography.magnetizedConveyorProgress
      previousTimeline = choreography.magnetizedTimelineProgress
    }
  })

  it('rounds reduced motion to discrete stops with ties upward', () => {
    const tieCases = [
      { progress: 1 / 6, expected: 1 / 3 },
      { progress: 1 / 2, expected: 2 / 3 },
      { progress: 5 / 6, expected: 1 },
    ] as const

    for (const { progress, expected } of tieCases) {
      const choreography = deriveMachineGroupChoreography({
        conveyorProgress: progress,
        timelineProgress: progress,
        reducedMotion: true,
      })
      expect(choreography.magnetizedConveyorProgress).toBe(expected)
      expect(choreography.magnetizedTimelineProgress).toBe(expected)
      expect(choreography.ratchetOffset).toBe(0)
    }

    const first = deriveMachineGroupChoreography({
      conveyorProgress: 0.38,
      timelineProgress: 0.61,
      reducedMotion: true,
    })
    const sameStops = deriveMachineGroupChoreography({
      conveyorProgress: 0.45,
      timelineProgress: 0.55,
      reducedMotion: true,
    })
    expect(first).toEqual(sameStops)
    expect(STOPS).toContain(first.magnetizedConveyorProgress)
    expect(STOPS).toContain(first.magnetizedTimelineProgress)
  })
})
