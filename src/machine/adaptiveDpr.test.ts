import { describe, expect, it, vi } from 'vitest'
import {
  controlledDprAfterManagerReport,
  createAdaptiveDprController,
  createResumeActivityGate,
  mapPerformanceToDpr,
  type AdaptiveDprTimer,
  type ResumeFrameScheduler,
} from './adaptiveDpr'

const healthyPerformance = {
  current: 1,
  min: 0.5,
  max: 1,
  debounce: 200,
}

function createClock() {
  let now = 0
  let nextHandle = 1
  const callbacks = new Map<
    number,
    { readonly dueAt: number; readonly callback: () => void }
  >()
  const timer: AdaptiveDprTimer = {
    set(callback, delayMs) {
      const handle = nextHandle
      nextHandle += 1
      callbacks.set(handle, { dueAt: now + delayMs, callback })
      return handle
    },
    clear(handle) {
      if (typeof handle === 'number') callbacks.delete(handle)
    },
  }

  return {
    now: () => now,
    timer,
    advanceBy(milliseconds: number) {
      const target = now + milliseconds
      while (true) {
        const next = [...callbacks.entries()]
          .filter(([, scheduled]) => scheduled.dueAt <= target)
          .sort((left, right) => left[1].dueAt - right[1].dueAt)[0]
        if (!next) break
        const [handle, scheduled] = next
        callbacks.delete(handle)
        now = scheduled.dueAt
        scheduled.callback()
      }
      now = target
    },
    pendingTimers: () => callbacks.size,
  }
}

function createFrameScheduler() {
  let nextHandle = 1
  const callbacks = new Map<number, () => void>()
  const scheduler: ResumeFrameScheduler = {
    request(callback) {
      const handle = nextHandle
      nextHandle += 1
      callbacks.set(handle, callback)
      return handle
    },
    cancel(handle) {
      if (typeof handle === 'number') callbacks.delete(handle)
    },
  }
  return {
    scheduler,
    flushOne() {
      const next = callbacks.entries().next().value as
        | [number, () => void]
        | undefined
      if (!next) return
      callbacks.delete(next[0])
      next[1]()
    },
  }
}

describe('adaptive DPR mapping and pressure', () => {
  it('maps renderer performance into the bounded 1..1.5 DPR range', () => {
    expect(mapPerformanceToDpr(-1, 0.5, 1)).toBe(1)
    expect(mapPerformanceToDpr(0.5, 0.5, 1)).toBe(1)
    expect(mapPerformanceToDpr(0.75, 0.5, 1)).toBe(1.25)
    expect(mapPerformanceToDpr(1, 0.5, 1)).toBe(1.5)
    expect(mapPerformanceToDpr(2, 0.5, 1)).toBe(1.5)
  })

  it('ignores idle, first-post-idle, and paused samples and regresses once per sustained burst', () => {
    const clock = createClock()
    const gate = createResumeActivityGate(createFrameScheduler().scheduler)
    const regress = vi.fn()
    const invalidate = vi.fn()
    const reports: number[] = []
    const controller = createAdaptiveDprController({
      initialDpr: 1.5,
      initiallyPaused: false,
      gate,
      now: clock.now,
      timer: clock.timer,
      regress,
      invalidate,
      reportDpr: (dpr) => reports.push(dpr),
      sustainedFrameCount: 2,
    })

    controller.sample(0.1, healthyPerformance)
    controller.recordActivity()
    controller.sample(0.1, healthyPerformance)
    controller.sample(0.1, healthyPerformance)
    expect(regress).not.toHaveBeenCalled()

    controller.sample(0.1, healthyPerformance)
    expect(regress).toHaveBeenCalledTimes(1)
    expect(reports).toEqual([1])

    controller.sample(0.1, healthyPerformance)
    expect(regress).toHaveBeenCalledTimes(1)
    expect(reports).toEqual([1, 1.5])

    controller.setPaused(true)
    controller.sample(0.1, { ...healthyPerformance, current: 0.5 })
    expect(regress).toHaveBeenCalledTimes(1)
    expect(reports).toEqual([1, 1.5])
  })
})

describe('adaptive DPR recovery scheduling', () => {
  it('preserves an overdue recovery deadline across pause and resume settlement', () => {
    const clock = createClock()
    const frames = createFrameScheduler()
    const gate = createResumeActivityGate(frames.scheduler)
    const invalidate = vi.fn()
    const reports: number[] = []
    const controller = createAdaptiveDprController({
      initialDpr: 1.5,
      initiallyPaused: false,
      gate,
      now: clock.now,
      timer: clock.timer,
      regress: vi.fn(),
      invalidate,
      reportDpr: (dpr) => reports.push(dpr),
      sustainedFrameCount: 1,
    })

    controller.recordActivity()
    controller.sample(0.1, healthyPerformance)
    controller.sample(0.1, healthyPerformance)
    expect(reports).toEqual([1])
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(clock.pendingTimers()).toBe(1)

    clock.advanceBy(50)
    controller.setPaused(true)
    expect(clock.pendingTimers()).toBe(0)
    clock.advanceBy(300)
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(reports).toEqual([1])

    gate.arm()
    controller.setPaused(false)
    gate.beginSettlement()
    frames.flushOne()
    expect(invalidate).toHaveBeenCalledTimes(1)
    frames.flushOne()
    expect(invalidate).toHaveBeenCalledTimes(2)

    controller.setPaused(true)
    gate.arm()
    controller.setPaused(false)
    gate.beginSettlement()
    frames.flushOne()
    frames.flushOne()
    expect(invalidate).toHaveBeenCalledTimes(3)
    expect(reports).toEqual([1])
    expect(clock.pendingTimers()).toBe(0)

    controller.sample(0.01, healthyPerformance)
    expect(reports).toEqual([1, 1.5])
    expect(clock.pendingTimers()).toBe(0)
  })

  it('supersedes a pending low report with recovery and ignores its stale acknowledgment', () => {
    const clock = createClock()
    const gate = createResumeActivityGate(createFrameScheduler().scheduler)
    const reports: number[] = []
    let controlledDpr = 1.5
    const controller = createAdaptiveDprController({
      initialDpr: 1.5,
      initiallyPaused: false,
      gate,
      now: clock.now,
      timer: clock.timer,
      regress: vi.fn(),
      invalidate: vi.fn(),
      reportDpr: (dpr) => {
        reports.push(dpr)
        controlledDpr = controlledDprAfterManagerReport(controlledDpr, dpr)
      },
      sustainedFrameCount: 1,
    })

    controller.recordActivity()
    controller.sample(0.1, healthyPerformance)
    controller.sample(0.1, healthyPerformance)
    expect(reports).toEqual([1])
    expect(clock.pendingTimers()).toBe(1)

    controller.sample(0.01, healthyPerformance)
    expect(reports).toEqual([1, 1.5])
    expect(clock.pendingTimers()).toBe(0)

    controller.acknowledgeDpr(1)
    controller.sample(0.01, healthyPerformance)
    expect(reports).toEqual([1, 1.5])

    controller.acknowledgeDpr(1.5)
    controller.sample(0.01, healthyPerformance)
    expect(reports).toEqual([1, 1.5])
    expect(controlledDpr).toBe(1.5)
    expect(clock.pendingTimers()).toBe(0)
  })
})
