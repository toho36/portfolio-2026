import { describe, expect, it } from 'vitest'
import { buildVitekPath, nearestInWindow, pointAt, LOOP, type Vec2 } from './wirePath'

const path = buildVitekPath()
const segDist = (p: Vec2, a: Vec2, b: Vec2) => {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}

describe('buildVitekPath', () => {
  it('starts at V and finishes at the end of the K lower arm', () => {
    expect(path.start).toEqual({ x: 0.3, y: 4.6 })
    expect(path.finish.x).toBeCloseTo(15.2)
    expect(path.finish.y).toBeCloseTo(0.4)
    expect(path.hazards).toHaveLength(1)
  })
  it('routes VITEK through the full V, baseline T-to-E bridge, bottom-up E, and open K arms', () => {
    const near = (x: number, y: number) => path.points.some(p => Math.hypot(p.x - x, p.y - y) < 0.06)
    expect(near(2.9, 4.6)).toBe(true) // V reaches cap height, then bridges into I
    expect(near(3.5, 2)).toBe(true) // I downstroke
    expect(near(5.3, 2)).toBe(true) // T stem up
    expect(near(4.7, 4.6)).toBe(true) // T bar left half
    expect(near(5.8, 5.4)).toBe(true) // T bar returns right
    expect(near(6.05, 2)).toBe(true) // T stem back down
    expect(near(7.3, 0.4)).toBe(true) // baseline bridge into E
    expect(near(9, 0.4)).toBe(true) // E bottom bar
    expect(near(9, 1.15)).toBe(true) // E bottom return
    expect(near(9, 2.3)).toBe(true) // E middle bar
    expect(near(9, 3.05)).toBe(true) // E middle return
    expect(near(9, 4.6)).toBe(true) // E top bar
    expect(near(11, 4.6)).toBe(true) // cap-height bridge into K
    expect(near(11.65, 2)).toBe(true) // K stem down
    expect(near(12.4, 1.5)).toBe(true) // K stem back up
    expect(near(13.2, 3.65)).toBe(true) // K upper diagonal
    expect(near(13.9, 3.12)).toBe(true) // K upper return
    expect(near(14, 1.6)).toBe(true) // K lower diagonal
  })
  it('is continuous with monotonic arc length', () => {
    for (let i = 1; i < path.points.length; i++) {
      expect(path.cumulative[i]).toBeGreaterThan(path.cumulative[i - 1])
      expect(Math.hypot(path.points[i].x - path.points[i - 1].x, path.points[i].y - path.points[i - 1].y)).toBeLessThan(LOOP.wireRadius * 2)
    }
  })
  it('keeps non-adjacent parts 3 loop radii apart except parallel hairpin arms', () => {
    const min = 3 * LOOP.outerRadius, hairpinMin = 2 * LOOP.outerRadius + 2 * LOOP.wireRadius, step = 3
    const zones = [
      [4.1, 7.3, 4.4, 5.5, 'y', 5], // T bar arms
      [5.1, 6.2, 0.3, 4.7, 'x', 5.675], // T stem arms
      [8.2, 10.4, 0.3, 1.25, 'y', 0.775], // E bottom arms
      [8.2, 10, 2.2, 3.15, 'y', 2.675], // E middle arms
      [11.5, 12.5, 0.3, 4.7, 'x', 12.025], // K stem arms
    ] as const
    const upperOut = path.points.findIndex(p => p.x > 12.4 && p.y > 2.7)
    const upperTurn = path.points.findIndex(p => p.x > 14.2 && p.y > 4.1)
    const upperReturnEnd = path.points.findIndex((p, i) => i > upperTurn && p.x < 13.85 && p.y < 2.9)
    expect(upperOut).toBeGreaterThan(0)
    expect(upperTurn).toBeGreaterThan(upperOut)
    expect(upperReturnEnd).toBeGreaterThan(upperTurn)
    let hairpinPairs = 0
    for (let i = 0; i < path.points.length; i += step)
      for (let j = i + step; j < path.points.length; j += step)
        if (path.cumulative[j] - path.cumulative[i] > 4 * min) {
          const a = path.points[i], b = path.points[j]
          const distance = Math.hypot(a.x - b.x, a.y - b.y)
          const hairpin = zones.some(([left, right, bottom, top, axis, split]) =>
            a.x >= left && a.x <= right && b.x >= left && b.x <= right &&
            a.y >= bottom && a.y <= top && b.y >= bottom && b.y <= top &&
            ((axis === 'x' ? a.x : a.y) - split) * ((axis === 'x' ? b.x : b.y) - split) < 0) ||
            (i >= upperOut && i < upperTurn && j > upperTurn && j <= upperReturnEnd) // K upper arm tracks
          if (hairpin && distance < min) hairpinPairs++
          expect(distance, `points ${i}, ${j}: (${a.x.toFixed(2)}, ${a.y.toFixed(2)}) / (${b.x.toFixed(2)}, ${b.y.toFixed(2)})`).toBeGreaterThanOrEqual(hairpin ? hairpinMin : min)
        }
    expect(hairpinPairs).toBeGreaterThan(0)
  })
  it('keeps hazard rods clear of the path', () => {
    for (const [a, b] of path.hazards)
      for (let i = 0; i < path.points.length; i += 3)
        expect(segDist(path.points[i], a, b)).toBeGreaterThanOrEqual(3 * LOOP.outerRadius)
  })
})

describe('nearestInWindow', () => {
  it('finds the point under a query on the wire', () => {
    const { p } = pointAt(path, path.length / 3)
    const n = nearestInWindow(path, p, path.length / 3, 1)
    expect(n.distance).toBeLessThan(1e-3)
    expect(Math.abs(n.s - path.length / 3)).toBeLessThan(0.05)
  })
  it('ignores parts of the path outside the window', () => {
    const far = pointAt(path, path.length * 0.9).p
    expect(nearestInWindow(path, far, 0, 1).s).toBeLessThanOrEqual(1 + 1e-6)
  })
})
