import { describe, expect, it } from 'vitest'
import { buildVitekPath, pointAt, LOOP } from './wirePath'
import { checkStep, clearance, easeAngle, canRegrab, nextLoopTarget, wandTiltFor, wandAt } from './wireRules'

const path = buildVitekPath()
const angleOf = (t: { x: number; y: number }) => Math.atan2(t.y, t.x)

describe('clearance', () => {
  it('aligned and centred has full clearance', () => expect(clearance(0, 0)).toBeCloseTo(LOOP.innerRadius - LOOP.wireRadius))
  it('lateral offset touches', () => expect(clearance(LOOP.innerRadius, 0)).toBeLessThan(0))
  it('misalignment touches', () => expect(clearance(0, Math.PI / 3)).toBeLessThan(0))
  it('hard has seventy percent of easy clearance radius', () =>
    expect(clearance(0, 0, LOOP.innerRadius * 0.7) + LOOP.wireRadius).toBeCloseTo(LOOP.innerRadius * 0.7))
})
describe('checkStep', () => {
  it('moving along the wire aligned is ok and advances', () => {
    const a = pointAt(path, 1), b = pointAt(path, 1.1)
    const r = checkStep(path, a.p, b.p, angleOf(a.tangent), angleOf(b.tangent), 1, 1)
    expect(r.ok).toBe(true); if (r.ok) expect(r.s).toBeGreaterThan(1)
  })
  it('flick across to a far part fails', () => {
    const a = pointAt(path, 1), b = pointAt(path, path.length * 0.6)
    expect(checkStep(path, a.p, b.p, angleOf(a.tangent), angleOf(b.tangent), 1, 1).ok).toBe(false)
  })
  it('stepping sideways fails', () => {
    const a = pointAt(path, 1)
    const side = { x: a.p.x - a.tangent.y * LOOP.innerRadius * 1.2, y: a.p.y + a.tangent.x * LOOP.innerRadius * 1.2 }
    expect(checkStep(path, a.p, side, angleOf(a.tangent), angleOf(a.tangent), 1, 1).ok).toBe(false)
  })
  it('subsamples a move that crosses a hazard between clear endpoints', () => {
    const straight = { points: [{ x: 0, y: 0 }, { x: 2, y: 0 }], cumulative: [0, 2], length: 2,
      hazards: [[{ x: 1, y: -0.5 }, { x: 1, y: 0.5 }]] as const,
      start: { x: 0, y: 0 }, finish: { x: 2, y: 0 } }
    expect(checkStep(straight, { x: 0.5, y: 0 }, { x: 1.5, y: 0 }, 0, 0, 0.5, 0.5))
      .toEqual({ ok: false, reason: 'hazard' })
  })
  it('touches when the loop rotates across the wire without moving', () => {
    const a = pointAt(path, 1), angle = angleOf(a.tangent)
    expect(checkStep(path, a.p, a.p, angle, angle + Math.PI / 2, 1, 1))
      .toEqual({ ok: false, reason: 'wire' })
  })
  it('reaching the end reports finished', () => {
    const a = pointAt(path, path.length - 0.05), b = pointAt(path, path.length)
    const r = checkStep(path, a.p, b.p, angleOf(a.tangent), angleOf(b.tangent), path.length - 0.05, path.length - 0.05)
    expect(r.ok && r.finished).toBe(true)
  })
})
describe('rotation and grab', () => {
  it('treats theta and theta plus pi as the same loop orientation', () => expect(Math.abs(easeAngle(0, Math.PI, 1000))).toBeLessThan(1e-3))
  it('allows only a near regrab', () => {
    expect(canRegrab({ x: 0, y: 0 }, { x: 30, y: 0 })).toBe(true)
    expect(canRegrab({ x: 0, y: 0 }, { x: 60, y: 0 })).toBe(false)
  })
})
describe('camera-independent grip and pointer', () => {
  it('moves the loop only by the pointer world delta', () => {
    const target = nextLoopTarget({ x: 4, y: 2 }, { x: 10, y: 8 }, { x: 10.3, y: 7.8 })
    expect(target.x).toBeCloseTo(4.3)
    expect(target.y).toBeCloseTo(1.8)
    expect(nextLoopTarget({ x: 4, y: 2 }, { x: 10, y: 8 }, { x: 10, y: 8 }))
      .toEqual({ x: 4, y: 2 })
  })
})

it('keeps the collar on the front rim and the grip in front through a full turn', () => {
  const pose = { x: 4, y: 2 }
  let previous = wandAt(pose, wandTiltFor(0), 0.26).grip
  for (let i = 0; i <= 720; i++) {
    const theta = i * Math.PI / 360
    const { collar, grip } = wandAt(pose, wandTiltFor(theta), 0.26)
    expect(collar).toEqual({ ...pose, z: 0.26 })
    expect(grip.z).toBeGreaterThan(collar.z)
    expect(grip.z).toBeGreaterThan(LOOP.wireRadius)
    expect(Math.hypot(grip.x - previous.x, grip.y - previous.y, grip.z - previous.z)).toBeLessThan(0.003)
    previous = grip
  }
})
