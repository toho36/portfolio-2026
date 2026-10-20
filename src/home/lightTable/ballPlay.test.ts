import { expect, it } from 'vitest'
import { screenToWorld } from './ballPlay.js'
import { createBall, launchBall, stepBall, RADIUS, TREADS } from '../../gameonvb/stairBall'

it('maps a screen point back onto the ball plane through the orthographic hero projection', () => {
  // Any affine world->screen map, like the hero's orthographic camera on z=0.
  const project = ([x, y]: number[]) => ({ x: 400 + 50 * x - 20 * y, y: 300 + 10 * x - 45 * y })
  for (const [x, y] of [[-3.45, 2.62], [0, 0], [2.1, -1.3]]) {
    const s = project([x, y, 0]), w = screenToWorld(project, s.x, s.y)
    expect(w.x).toBeCloseTo(x, 9); expect(w.y).toBeCloseTo(y, 9)
  }
})

it('a pushed hero ball leaves the landing tread and comes to rest on a lower tread', () => {
  let ball = launchBall(createBall())
  for (let i = 0; i < 600 && !ball.resting; i++) ball = stepBall(ball, 1 / 60)
  expect(ball.resting).toBe(true)
  expect(ball.landing).toBeGreaterThan(0)
  expect(ball.y).toBeCloseTo(TREADS[ball.landing].y + RADIUS, 6)
})
