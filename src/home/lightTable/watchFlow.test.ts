import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'

it('promotes the proved watch progress with reversal, one RAF, hidden preference and cold endpoints', async () => {
  expect(readFileSync(new URL('./watchFlow.js', import.meta.url), 'utf8')).toContain('createWatchFlow')
  const { createWatchFlow, stepWatchFlow } = await import('./watchFlow.js')
  const queue = new Map<number, FrameRequestCallback>(); let id = 0, now = 0
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { queue.set(++id, fn); return id })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id))
  const paints: number[] = [], lands: number[] = []
  const flow = createWatchFlow(p => paints.push(p), p => lands.push(p))
  const tick = () => { now += 16; const pending = [...queue.values()]; queue.clear(); pending.forEach(fn => fn(now)) }
  try {
    for (const target of [0, 1]) {
      let state = { position: 1 - target, velocity: 0 }
      for (let i = 0; i < 100; i++) state = stepWatchFlow(state, target, 1 / 60)
      expect(state).toEqual({ position: target, velocity: 0 })
    }
    flow.set(true); for (let i = 0; i < 12; i++) tick()
    const current = flow.state
    flow.set(false); expect(flow.state).toEqual(current)
    tick(); tick(); expect(flow.state.position).toBeGreaterThan(0)
    const reverse = flow.state; flow.set(true); expect(flow.state).toEqual(reverse)
    expect(queue.size).toBe(1)
    flow.pause(); const hidden = flow.state, count = paints.length
    flow.set(false, true); now += 10000
    expect(flow.state).toEqual(hidden); expect(paints).toHaveLength(count); expect(queue.size).toBe(0)
    flow.resume(); expect(flow.state).toEqual({ position: 0, velocity: 0 }); expect(lands.at(-1)).toBe(0)
    flow.pause(); flow.set(true, true); flow.set(false, false); flow.resume(); tick()
    expect(flow.state).toEqual({ position: 0, velocity: 0 })
    flow.set(true); const late = [...queue.values()]; flow.destroy(); const last = paints.length
    late.forEach(fn => fn(now + 16)); flow.resume(); flow.set(false)
    expect(queue.size).toBe(0); expect(paints).toHaveLength(last)
    const cold = createWatchFlow(p => paints.push(p), p => lands.push(p), { position: 1, velocity: 0 })
    cold.set(true); expect(cold.state).toEqual({ position: 1, velocity: 0 }); tick(); expect(lands.at(-1)).toBe(1)
    cold.set(false); for (let i = 0; i < 100; i++) tick()
    expect(cold.state).toEqual({ position: 0, velocity: 0 }); cold.destroy()
  } finally { flow.destroy(); vi.unstubAllGlobals() }
})
