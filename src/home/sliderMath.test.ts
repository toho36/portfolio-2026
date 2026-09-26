import { describe, expect, it } from 'vitest'
import { bendFromVelocity, createWheelIntent, indexFromOffset, isClick, overlapState, snapTarget } from './sliderMath'

describe('slider math', () => {
  it('preserves index after resize and clamps limits', () => {
    expect(indexFromOffset(2880, 1440, 7)).toBe(2)
    expect(indexFromOffset(780, 390, 7)).toBe(2)
    expect(indexFromOffset(-20, 390, 7)).toBe(0)
    expect(indexFromOffset(99999, 390, 7)).toBe(6)
  })
  it('snaps a flick one poster and bounds the bend', () => {
    expect(snapTarget(1440 * 1.2, 1.2, 1440, 7)).toBe(2)
    expect(snapTarget(1440 * 1.2, -1.2, 1440, 7)).toBe(1)
    expect(snapTarget(1440 * 1.2, 0, 1440, 7)).toBe(1)
    expect(Math.abs(bendFromVelocity(100))).toBeLessThanOrEqual(.35)
    expect(bendFromVelocity(-.3)).toBeCloseTo(-bendFromVelocity(.3))
  })
  it('snaps a drag by signed distance or recent velocity, at most one poster', () => {
    expect(snapTarget(1640, 0, 1440, 7, 200)).toBe(2)
    expect(snapTarget(1240, 0, 1440, 7, -200)).toBe(0)
    expect(snapTarget(1500, 0, 1440, 7, 60)).toBe(1)
    expect(snapTarget(1520, .8, 1440, 7, 80)).toBe(2)
    expect(snapTarget(1640, 0, 1440, 7, 200)).toBe(2)
    expect(snapTarget(4500, 0, 1440, 7, 3060)).toBe(2)
  })
  it('maps overlap and rejects dragged clicks', () => {
    expect(overlapState(0)).toEqual({ outScale: 1, outDim: 1, inX: 1 })
    expect(overlapState(1).outScale).toBeCloseTo(.92)
    expect(overlapState(1).outDim).toBeCloseTo(.6)
    expect(overlapState(1).inX).toBe(0)
    expect(isClick(4)).toBe(true)
    expect(isClick(12)).toBe(false)
  })
  it('treats a trackpad burst as one gesture', () => {
    const intent = createWheelIntent()
    let moves = 0
    for (let t = 0; t < 400; t += 8) moves += Math.abs(intent(12, 0, t))
    expect(moves).toBe(1)
    expect(intent(80, 0, 1200)).toBe(1)
  })
})
