import { describe, expect, it } from 'vitest'
import {
  HOME,
  SLOT,
  initialAssemblyState,
  moveModule,
  nudgeModule,
  releaseModule,
  seatModule,
} from './model'

describe('assembly model', () => {
  it('moves with arrows and clamps positions to the bench', () => {
    expect(nudgeModule(initialAssemblyState, 0.1, -0.1)).toMatchObject({
      x: 0.22,
      y: 0.4,
    })
    expect(moveModule(initialAssemblyState, { x: 2, y: -1 })).toMatchObject({
      x: 1,
      y: 0,
    })
  })

  it('snaps on the inclusive boundary and leaves a miss where released', () => {
    const boundary = moveModule(initialAssemblyState, {
      x: SLOT.left,
      y: SLOT.top,
    })
    expect(releaseModule(boundary)).toEqual({ ...SLOT.center, seated: true })

    const miss = moveModule(initialAssemblyState, {
      x: SLOT.left - 0.01,
      y: SLOT.top,
    })
    expect(releaseModule(miss)).toEqual(miss)
  })

  it('uses one action to seat and eject to a deterministic home', () => {
    const seated = seatModule(initialAssemblyState)
    expect(seated).toEqual({ ...SLOT.center, seated: true })
    expect(seatModule(seated)).toEqual({ ...HOME, seated: false })
  })
})
