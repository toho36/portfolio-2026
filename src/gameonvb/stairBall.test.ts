import { describe, expect, it } from 'vitest'
import { createBall, launchBall, stepBall, constrainPosition, RADIUS, surfaceAt } from './stairBall'

describe('promoted staircase ball', () => {
  it('descends three treads and settles without penetrating them', () => {
    const initial = Object.freeze(createBall())
    let ball = launchBall(initial, 3.8, 1.2)
    const landings = new Set<number>()
    for (let i = 0; i < 2400; i++) {
      ball = stepBall(Object.freeze(ball), 1 / 120)
      expect(Number.isFinite(ball.x + ball.y + ball.angle)).toBe(true)
      expect(ball.y).toBeGreaterThanOrEqual(surfaceAt(ball.x).y + RADIUS - 1e-6)
      if (ball.floorContacts) landings.add(ball.landing)
    }
    expect([...landings].sort()).toEqual([0, 1, 2])
    expect(ball.resting).toBe(true)
    expect(ball.y).toBe(surfaceAt(ball.x).y + RADIUS)
    expect(initial).toEqual(createBall())
  })
  it('keeps a hard upward throw inside the authored lane', () => {
    let ball = launchBall({ ...createBall(), y: 4.6 }, 0, 8)
    for (let i = 0; i < 120; i++) {
      ball = stepBall(ball, 1 / 120)
      expect(ball.y).toBeLessThanOrEqual(4.8 + 1e-6)
    }
  })
  it('shares riser and corner clearance with dragging', () => {
    const lower = { ...createBall(), x: -1.5, y: RADIUS }
    const drag = constrainPosition(lower, -2, RADIUS)
    expect(drag.x).toBeGreaterThanOrEqual(-1.6 + RADIUS)
    expect(drag.y).toBe(RADIUS)
    let flight = launchBall(lower, -6, 0)
    for (let i = 0; i < 3; i++) flight = stepBall(flight, 1 / 120)
    expect(flight.x).toBeGreaterThanOrEqual(-1.6 + RADIUS)
    expect(flight.y).toBe(RADIUS)
    const corner = constrainPosition(createBall(), -1.5, 2.2)
    expect(Math.hypot(corner.x + 1.6, corner.y - 1.7)).toBeGreaterThanOrEqual(RADIUS - 1e-6)
  })
  it('ignores invalid time and bounds stalled frames', () => {
    const ball = launchBall(createBall())
    for (const dt of [NaN, Infinity, 0, -1]) expect(stepBall(ball, dt)).toEqual(ball)
    expect(stepBall(ball, 100)).toEqual(stepBall(ball, .05))
    expect(stepBall(createBall(), 1)).toEqual(createBall())
  })
  it('distinguishes real landings from wall contacts for story highlighting', () => {
    const lower = { ...createBall(), x: -.4, y: RADIUS, landing: 1 as const }
    const wall = stepBall(launchBall(lower, -6, 0), .05)
    expect(wall.contacts).toBeGreaterThan(0)
    expect(wall.floorContacts).toBe(0)
    let falling = launchBall({ ...lower, x: 0, y: 2.5 }, 0, -3)
    for (let i = 0; i < 60; i++) falling = stepBall(falling, 1 / 120)
    expect(falling.floorContacts).toBeGreaterThan(0)
    expect(falling.landing).toBe(1)
  })
})
