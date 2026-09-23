// Position and velocity use the available travel on each axis, not pixels.
export type CourtBall = {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  contacts: number
  resting: boolean
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function createCourtBall(): CourtBall {
  return { x: 0.52, y: 0.25, vx: 0, vy: 0, angle: -20, contacts: 0, resting: true }
}

export function stepCourtBall(ball: Readonly<CourtBall>, elapsed: number): CourtBall {
  const next = { ...ball }
  if (ball.resting || !Number.isFinite(elapsed) || elapsed <= 0) return next
  const dt = Math.min(elapsed, 0.032)
  const grounded = next.y === 1 && next.vy === 0
  if (!grounded) next.vy += 3.2 * dt
  next.x += next.vx * dt
  next.y += next.vy * dt
  next.angle = (next.angle + next.vx * dt * 160) % 360
  if ((next.x <= 0 && next.vx < 0) || (next.x >= 1 && next.vx > 0)) {
    next.vx *= -0.72
    next.contacts++
  }
  if (next.y <= 0 && next.vy < 0) {
    next.vy *= -0.64
    next.contacts++
  } else if (next.y >= 1 && next.vy > 0) {
    next.contacts++
    next.vy = next.vy < 0.25 ? 0 : -next.vy * 0.64
    next.vx *= 0.8
  }
  next.x = clamp(next.x, 0, 1)
  next.y = clamp(next.y, 0, 1)
  if (next.y === 1 && next.vy === 0) {
    next.vx *= Math.exp(-7 * dt)
    if (Math.abs(next.vx) < 0.015) {
      next.vx = 0
      next.resting = true
    }
  }
  return next
}

export function launchCourtBall(ball: Readonly<CourtBall>, vx = ball.x > 0.5 ? -1.25 : 1.25, vy = -1.9): CourtBall {
  return { ...ball, vx: clamp(vx, -3, 3), vy: clamp(vy, -3, 3), resting: false }
}
