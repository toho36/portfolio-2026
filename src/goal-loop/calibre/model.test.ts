import { describe, expect, it } from 'vitest'
import { approachOpen, layers, gearOutline, PARTS } from './model'

describe('goal-free calibre presentation', () => {
  it('reverses opening from its current pose and settles reduced motion instantly', () => {
    const mid = approachOpen(0, 1, .1, false)
    expect(mid).toBeGreaterThan(0); expect(mid).toBeLessThan(1)
    expect(approachOpen(mid, 0, .01, false)).toBeLessThan(mid)
    expect(approachOpen(mid, 0, .1, true)).toBe(0)
    expect(approachOpen(mid, 1, NaN, false)).toBe(mid)
  })
  it('keeps the base anchored and separates assemblies unequally without a task', () => {
    const a = layers(0), b = layers(1)
    expect(a.plate).toBe(b.plate)
    expect(b.barrel).toBeLessThan(b.train); expect(b.train).toBeLessThan(b.balance); expect(b.balance).toBeLessThan(b.bridges)
    expect(b.train - b.barrel).not.toBe(b.balance - b.train)
    expect(PARTS.some(p => /pass|repair|score|test/i.test(p.name))).toBe(false)
  })
  it('authors real toothed outlines rather than smooth decorative rings', () => {
    const points = gearOutline(.7, 24), radii = points.map(([x, y]) => Math.hypot(x, y))
    expect(points).toHaveLength(96)
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(.07)
  })
})
