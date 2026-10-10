import { expect, it, vi } from 'vitest'
import { BALL_DURATION, createBallFlow, stepBallFlow, type BallFlowState } from './ballFlow.js'

it.each([30, 60, 120, 240])('returns from rest smoothly in about two seconds at %iHz', hz => {
  const dt = 1 / hz
  let state = { time: BALL_DURATION, velocity: 0 }, frames = 0, slowFrames = 0
  while (state.time > 0 && frames < hz * 3) {
    const previous = state
    state = stepBallFlow(state, 0, dt)
    frames++
    expect(Math.abs(state.velocity)).toBeLessThanOrEqual(2)
    expect(state.time).toBeLessThan(previous.time)
    if (state.time > 0) {
      expect(Math.abs(state.velocity - previous.velocity)).toBeLessThanOrEqual(8 * dt + 1e-12)
      if (state.time < .02) expect(Math.abs(state.velocity)).toBeLessThan(.65)
      if (Math.abs(state.velocity) < .1) slowFrames++
    } else {
      // Exact endpoint settling is the sole exception to the acceleration bound.
      expect(previous.time).toBeLessThan(.02)
      expect(Math.abs(previous.velocity)).toBeLessThan(.55)
    }
  }
  expect(frames / hz).toBeGreaterThanOrEqual(1.96)
  expect(frames / hz).toBeLessThanOrEqual(2.04)
  expect(state).toEqual({ time: 0, velocity: 0 })
  expect(slowFrames / hz).toBeLessThan(.05)
})

it('dt zero preserves the full state during either direction', () => {
  const state = { time: 1.4, velocity: -.8, marker: 'preserved' }
  for (const target of [0, 1]) {
    expect(stepBallFlow(state, target, 0)).toEqual(state)
    expect(state).toEqual({ time: 1.4, velocity: -.8, marker: 'preserved' })
  }
})

// Frozen forward speed-1/acceleration-6 integration, including endpoint settling.
function forwardReference(state: BallFlowState, dt: number): BallFlowState {
  if (!(dt > 0)) return { ...state }
  let { time, velocity } = state
  const count = Math.ceil(Math.min(.05, dt) * 240), h = Math.min(.05, dt) / count
  for (let i = 0; i < count; i++) {
    const distance = 3.55 - time
    velocity += Math.max(-6 * h, Math.min(6 * h, 1 - velocity)); time += velocity * h
    if (time >= 3.55) return { time: 3.55, velocity: 0 }
    if (Math.abs(distance) < .0005 && Math.abs(velocity) < .08) return { time: 3.55, velocity: 0 }
  }
  return { time: Math.max(0, Math.min(3.55, time)), velocity }
}

it('keeps every forward clock sample exactly equal to the existing reference', () => {
  expect(BALL_DURATION).toBe(3.55)
  for (const hz of [30, 60, 120, 240]) {
    for (const initial of [{ time: 0, velocity: 0 }, { time: 1.4, velocity: -2 }]) {
      let state = initial, reference = initial
      for (let i = 0; i < hz * 5; i++) {
        state = stepBallFlow(state, 1, 1 / hz)
        reference = forwardReference(reference, 1 / hz)
        expect(state).toEqual(reference)
      }
      expect(state).toEqual({ time: 3.55, velocity: 0 })
    }
  }
})

it('retains the current clock and velocity when interrupting and reopening the actual flow', () => {
  const queue = new Map<number, FrameRequestCallback>()
  let id = 0, now = 0
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { queue.set(++id, fn); return id })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id))
  const paint = vi.fn(() => false), land = vi.fn()
  const flow = createBallFlow(paint, land, { time: 1.4, velocity: 1 })
  const tick = () => { const batch = [...queue.values()]; queue.clear(); batch.forEach(fn => fn(now)); now += 1000 / 120 }
  try {
    const outgoing = flow.state
    flow.set(0)
    expect(flow.state).toEqual(outgoing)
    expect(paint).toHaveBeenLastCalledWith(outgoing, 0)
    tick(); expect(flow.state).toEqual(outgoing)
    tick()
    expect(flow.state.time).toBeGreaterThan(outgoing.time)
    expect(flow.state.velocity).toBeGreaterThan(0)
    for (let i = 0; i < 30; i++) tick()
    const returning = flow.state
    expect(returning.velocity).toBeLessThan(0)
    flow.set(1)
    expect(flow.state).toEqual(returning)
    expect(paint).toHaveBeenLastCalledWith(returning, 0)
    tick()
    expect(flow.state.time).toBeLessThan(returning.time)
    expect(flow.state.velocity).toBeLessThan(0)
    for (let i = 0; i < 60 && flow.state.velocity <= 0; i++) {
      const previous = flow.state
      tick()
      expect(Math.abs(flow.state.velocity - previous.velocity)).toBeLessThanOrEqual(6 / 120 + 1e-12)
      expect(Math.abs(flow.state.time - previous.time)).toBeLessThan(.02)
    }
    expect(flow.state.velocity).toBeGreaterThan(0)
    expect(land).not.toHaveBeenCalled()
  } finally { flow.destroy(); vi.unstubAllGlobals() }
})
