import { LOOP, nearestInWindow, type Vec2, type WirePath } from './wirePath'

export const MISALIGN_K = 1.0
export type StepResult = { ok: true; s: number; maxS: number; finished: boolean }
  | { ok: false; reason: 'wire' | 'hazard' | 'jump' }

const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))
const axisDelta = (from: number, to: number) => wrap(2 * (to - from)) / 2

export function clearance(d: number, alpha: number, innerRadius: number = LOOP.innerRadius): number {
  return innerRadius - LOOP.wireRadius - innerRadius * Math.abs(Math.sin(alpha)) * MISALIGN_K - Math.abs(d)
}

export function easeAngle(current: number, target: number, dtMs: number, tauMs = 80): number {
  return current + axisDelta(current, target) * (1 - Math.exp(-Math.max(0, dtMs) / tauMs))
}

export function canRegrab(grip: Vec2, pointer: Vec2, radiusPx = 40): boolean {
  return Math.hypot(grip.x - pointer.x, grip.y - pointer.y) <= radiusPx
}

export function nextLoopTarget(pose: Vec2, previous: Vec2, next: Vec2): Vec2 {
  return { x: pose.x + next.x - previous.x, y: pose.y + next.y - previous.y }
}

export function wandTiltFor(theta: number): number {
  return 0.25 * Math.sin(theta)
}

export function wandAt(pose: Vec2, tilt: number, radius: number) {
  const collar = { x: pose.x, y: pose.y, z: radius }
  return { collar, grip: { x: collar.x + tilt, y: collar.y - 0.38, z: collar.z + 0.82 } }
}

function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}

export function checkStep(path: WirePath, from: Vec2, to: Vec2,
  thetaFrom: number, thetaTo: number, s: number, maxS: number, innerRadius: number = LOOP.innerRadius): StepResult {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const steps = Math.max(1, Math.ceil(distance / LOOP.wireRadius))
  let currentS = s, currentMax = maxS
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const q = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
    const n = nearestInWindow(path, q, currentS, 3 * LOOP.outerRadius)
    if (n.distance > innerRadius - LOOP.wireRadius + 1e-6) {
      // The window is part of the rule: a distant wire cannot become the next stroke.
      return { ok: false, reason: 'jump' }
    }
    const theta = thetaFrom + axisDelta(thetaFrom, thetaTo) * t
    const tangent = Math.atan2(n.tangent.y, n.tangent.x)
    if (clearance(n.signed, axisDelta(tangent, theta), innerRadius) < -1e-6)
      return { ok: false, reason: 'wire' }
    for (const [a, b] of path.hazards)
      if (segmentDistance(q, a, b) < innerRadius + LOOP.wireRadius)
        return { ok: false, reason: 'hazard' }
    for (let j = 1; j < path.points.length; j++) {
      if (Math.max(path.cumulative[j - 1] - n.s, n.s - path.cumulative[j], 0) <= 3 * LOOP.outerRadius) continue
      const a = path.points[j - 1], b = path.points[j]
      const radius = innerRadius + LOOP.wireRadius
      if (q.x < Math.min(a.x, b.x) - radius || q.x > Math.max(a.x, b.x) + radius ||
        q.y < Math.min(a.y, b.y) - radius || q.y > Math.max(a.y, b.y) + radius) continue
      if (segmentDistance(q, a, b) < radius)
        return { ok: false, reason: 'hazard' }
    }
    currentS = n.s
    currentMax = Math.max(currentMax, currentS)
  }
  return { ok: true, s: currentS, maxS: currentMax, finished: currentS >= path.length - LOOP.wireRadius }
}
