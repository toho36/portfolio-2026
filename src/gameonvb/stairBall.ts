export type LandingIndex = 0 | 1 | 2
export interface StairBall {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  contacts: number
  floorContacts: number
  landing: LandingIndex
  resting: boolean
}

export const RADIUS = 0.92
export const TREADS = [
  { left: -4.8, right: -1.6, y: 1.7 },
  { left: -1.6, right: 1.6, y: 0 },
  { left: 1.6, right: 4.8, y: -1.7 },
] as const
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
export function surfaceAt(x: number) {
  const index: LandingIndex = x < -1.6 ? 0 : x < 1.6 ? 1 : 2
  return { ...TREADS[index], index }
}
export function createBall(): StairBall {
  return { x: -3.45, y: 1.7 + RADIUS, vx: 0, vy: 0, angle: 0.3, contacts: 0, floorContacts: 0, landing: 0, resting: true }
}
export function constrainPosition(ball: Readonly<{ x: number; y: number }>, x: number, y: number) {
  x = clamp(x, TREADS[0].left + RADIUS, TREADS[2].right - RADIUS)
  y = clamp(y, TREADS[2].y + RADIUS, 4.8)
  for (const tread of TREADS.slice(0, -1)) {
    if (y >= tread.y + RADIUS) continue
    const clearance = Math.sqrt(Math.max(0, RADIUS ** 2 - Math.max(0, y - tread.y) ** 2))
    const entering = ball.x > tread.right && x <= tread.right
    if (entering || (x > tread.right && x < tread.right + clearance)) x = tread.right + clearance
  }
  return { x, y: Math.max(y, surfaceAt(x).y + RADIUS) }
}
export function launchBall(ball: Readonly<StairBall>, vx = 3.8, vy = 1.2): StairBall {
  const loft = Math.sqrt(24 * Math.max(0, 4.8 - ball.y))
  return { ...ball, vx: clamp(Number.isFinite(vx) ? vx : 0, -6, 6), vy: clamp(Number.isFinite(vy) ? vy : 0, -8, Math.min(8, loft)), resting: false }
}
export function stepBall(ball: Readonly<StairBall>, elapsed: number): StairBall {
  if (ball.resting || !Number.isFinite(elapsed) || elapsed <= 0) return { ...ball }
  const next = { ...ball }
  // ponytail: a single x/y lane, not a general 3D physics engine.
  const count = Math.ceil(Math.min(elapsed, 0.05) * 120)
  const dt = Math.min(elapsed, 0.05) / count
  for (let n = 0; n < count; n++) {
    const oldX = next.x
    const oldY = next.y
    const surface = surfaceAt(oldX)
    const grounded = Math.abs(next.y - surface.y - RADIUS) < 1e-6 && next.vy === 0
    if (!grounded) next.vy -= 12 * dt
    next.x += next.vx * dt
    next.y += next.vy * dt
    const minX = TREADS[0].left + RADIUS
    const maxX = TREADS[2].right - RADIUS
    if ((next.x < minX && next.vx < 0) || (next.x > maxX && next.vx > 0)) {
      next.x = clamp(next.x, minX, maxX)
      next.vx *= -0.4
    }
    const position = constrainPosition({ x: oldX, y: oldY }, next.x, next.y)
    if (position.x > next.x + 1e-9 && next.vx < 0) { next.vx *= -0.45; next.contacts++ }
    next.x = position.x
    next.y = position.y
    const floor = surfaceAt(next.x)
    if (next.y <= floor.y + RADIUS && next.vy <= 0) {
      next.y = floor.y + RADIUS
      if (next.vy < -0.3) {
        next.contacts++
        next.floorContacts++
        next.landing = floor.index
        next.vy = -next.vy * 0.42
        next.vx *= 0.87
      } else next.vy = 0
    }
    if (next.y === floor.y + RADIUS && next.vy === 0) {
      next.vx *= Math.exp(-0.7 * dt)
      if (Math.abs(next.vx) < 0.045) { next.vx = 0; next.resting = true }
    }
    next.angle -= (next.x - oldX) / RADIUS
  }
  return next
}
