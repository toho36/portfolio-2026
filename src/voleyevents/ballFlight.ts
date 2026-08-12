export const BALL_FLIGHT = {
  startX: 72,
  startY: 410,
  landingX: 568,
  landingY: 424,
  arcHeight: 300,
  flightMs: 2200,
  holdMs: 700,
  cycleMs: 2900,
  rotations: 1.4,
} as const

export interface BallFlightSample {
  readonly x: number
  readonly y: number
  readonly rotation: number
  readonly progress: number
  readonly impact: number
}

export function sampleBallFlight(elapsedMs: number): BallFlightSample {
  const cycleTime =
    ((elapsedMs % BALL_FLIGHT.cycleMs) + BALL_FLIGHT.cycleMs) %
    BALL_FLIGHT.cycleMs
  const progress = Math.min(cycleTime / BALL_FLIGHT.flightMs, 1)
  const x =
    BALL_FLIGHT.startX +
    (BALL_FLIGHT.landingX - BALL_FLIGHT.startX) * progress
  const baselineY =
    BALL_FLIGHT.startY +
    (BALL_FLIGHT.landingY - BALL_FLIGHT.startY) * progress
  const y =
    baselineY - 4 * BALL_FLIGHT.arcHeight * progress * (1 - progress)
  const impact =
    cycleTime < BALL_FLIGHT.flightMs
      ? 0
      : 1 - (cycleTime - BALL_FLIGHT.flightMs) / BALL_FLIGHT.holdMs

  return {
    x,
    y,
    rotation: progress * BALL_FLIGHT.rotations * 360,
    progress,
    impact,
  }
}
