export interface Vec2 { x: number; y: number }
export interface WirePath {
  points: readonly Vec2[]
  cumulative: readonly number[]
  length: number
  hazards: readonly (readonly [Vec2, Vec2])[]
  start: Vec2
  finish: Vec2
}

export const LOOP = { innerRadius: 0.22, outerRadius: 0.3, wireRadius: 0.05 } as const

// One routed ligature: V bridges into I, I joins the T stem at the baseline,
// then a squared E winds into K and finishes at its lower arm.
const controls: Vec2[] = [
  { x: 0.3, y: 4.6 }, { x: 1.4, y: 0.4 }, { x: 2.5, y: 4.6 },
  { x: 3.5, y: 4.6 }, { x: 3.5, y: 0.4 }, { x: 5.3, y: 0.4 },
  { x: 5.3, y: 4.6 }, { x: 4.25, y: 4.6 }, { x: 4.25, y: 5.4 },
  { x: 7.2, y: 5.4 }, { x: 7.2, y: 4.6 }, { x: 6.05, y: 4.6 },
  { x: 6.05, y: 0.4 }, { x: 8.35, y: 0.4 },
  { x: 10.3, y: 0.4 }, { x: 10.3, y: 1.15 }, { x: 8.35, y: 1.15 },
  { x: 8.35, y: 2.3 }, { x: 9.9, y: 2.3 },
  { x: 9.9, y: 3.05 }, { x: 8.35, y: 3.05 },
  { x: 8.35, y: 4.6 }, { x: 10.3, y: 4.6 },
  { x: 11.65, y: 4.6 }, { x: 11.65, y: 0.4 },
  { x: 12.4, y: 0.4 }, { x: 12.4, y: 2.7 },
  { x: 14, y: 4.6 }, { x: 14.55, y: 4.15 },
  { x: 13.35, y: 2.25 }, { x: 15.2, y: 0.4 },
]

const hazards: readonly (readonly [Vec2, Vec2])[] = [
  [{ x: 3.5, y: 6 }, { x: 3.5, y: 6.2 }], // I dot
]

function mix(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

export function buildVitekPath(): WirePath {
  const points: Vec2[] = [controls[0]]
  const addLine = (to: Vec2) => {
    const from = points[points.length - 1]
    const n = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 0.045)
    for (let i = 1; i <= n; i++) points.push(mix(from, to, i / n))
  }
  for (let i = 1; i < controls.length - 1; i++) {
    const prev = controls[i - 1], corner = controls[i], next = controls[i + 1]
    const inLength = Math.hypot(corner.x - prev.x, corner.y - prev.y)
    const outLength = Math.hypot(next.x - corner.x, next.y - corner.y)
    const incoming = { x: (corner.x - prev.x) / inLength, y: (corner.y - prev.y) / inLength }
    const outgoing = { x: (next.x - corner.x) / outLength, y: (next.y - corner.y) / outLength }
    const turn = Math.acos(Math.max(-1, Math.min(1, incoming.x * outgoing.x + incoming.y * outgoing.y)))
    const radius = Math.min(i === 1 ? 0.4 : 0.65, Math.min(inLength, outLength) * 0.4 / Math.tan(turn / 2))
    const offset = radius * Math.tan(turn / 2)
    const entry = { x: corner.x - incoming.x * offset, y: corner.y - incoming.y * offset }
    const exit = { x: corner.x + outgoing.x * offset, y: corner.y + outgoing.y * offset }
    addLine(entry)
    const sign = Math.sign(incoming.x * outgoing.y - incoming.y * outgoing.x)
    const center = { x: entry.x - incoming.y * radius * sign, y: entry.y + incoming.x * radius * sign }
    const startAngle = Math.atan2(entry.y - center.y, entry.x - center.x)
    const segments = Math.ceil(radius * turn / 0.045)
    for (let j = 1; j <= segments; j++) {
      const angle = startAngle + sign * turn * j / segments
      points.push({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius })
    }
  }
  addLine(controls[controls.length - 1])
  const cumulative = [0]
  for (let i = 1; i < points.length; i++)
    cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  return { points, cumulative, length: cumulative[cumulative.length - 1], hazards,
    start: points[0], finish: points[points.length - 1] }
}

export function pointAt(path: WirePath, s: number): { p: Vec2; tangent: Vec2 } {
  const target = Math.max(0, Math.min(path.length, s))
  let lo = 1, hi = path.cumulative.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (path.cumulative[mid] < target) lo = mid + 1
    else hi = mid
  }
  const a = path.points[lo - 1], b = path.points[lo]
  const length = path.cumulative[lo] - path.cumulative[lo - 1]
  return { p: mix(a, b, (target - path.cumulative[lo - 1]) / length),
    tangent: { x: (b.x - a.x) / length, y: (b.y - a.y) / length } }
}

export function nearestInWindow(path: WirePath, q: Vec2, sCenter: number, window: number) {
  const minS = Math.max(0, sCenter - window), maxS = Math.min(path.length, sCenter + window)
  let best = { s: minS, p: pointAt(path, minS).p, tangent: pointAt(path, minS).tangent,
    distance: Infinity, signed: 0 }
  let lo = 1, hi = path.cumulative.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (path.cumulative[mid] < minS) lo = mid + 1
    else hi = mid
  }
  for (let i = lo; i < path.points.length && path.cumulative[i - 1] <= maxS; i++) {
    const aS = path.cumulative[i - 1], bS = path.cumulative[i]
    if (bS < minS || aS > maxS) continue
    const a = path.points[i - 1], b = path.points[i]
    const dx = b.x - a.x, dy = b.y - a.y, length = bS - aS
    const t = Math.max((minS - aS) / length, Math.min((maxS - aS) / length,
      Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (length * length)))))
    const p = { x: a.x + t * dx, y: a.y + t * dy }
    const tangent = { x: dx / length, y: dy / length }
    const signed = tangent.x * (q.y - p.y) - tangent.y * (q.x - p.x)
    const distance = Math.hypot(q.x - p.x, q.y - p.y)
    if (distance < best.distance) best = { s: aS + t * length, p, tangent, distance, signed }
  }
  return best
}
