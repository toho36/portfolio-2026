import { describe, expect, it } from 'vitest'
import { gearOutline } from './model'

describe('goal-free calibre presentation', () => {
  it('authors real toothed outlines rather than smooth decorative rings', () => {
    const points = gearOutline(.7, 24), radii = points.map(([x, y]) => Math.hypot(x, y))
    expect(points).toHaveLength(96)
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(.07)
  })
})
