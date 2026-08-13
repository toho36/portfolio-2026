import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  createRallyPlayhead,
  type RallyPlayheadMotion,
  type RallyPlayheadWindow,
} from './rallyPlayhead'

function harness() {
  let scrollY = 100
  let visible = true
  let observerCallback: ((entries: readonly { isIntersecting: boolean }[]) => void) | null = null
  const listeners = new Map<string, Set<EventListener>>()
  const frames = new Map<number, FrameRequestCallback>()
  let frameId = 0
  const landings = [700, 1100, 1500, 1900].map((top, index) => ({
    id: ['event-opens', 'player-registers', 'payment-matches', 'attendance-resolves'][index],
    getBoundingClientRect: () => ({ top: top - scrollY }),
  }))
  const root = {
    dataset: {},
    getBoundingClientRect: () => ({ top: 500 - scrollY }),
    querySelectorAll: () => landings,
  } as unknown as HTMLElement
  const stage = {} as HTMLElement
  const doc = {
    get visibilityState() { return visible ? 'visible' : 'hidden' },
    documentElement: { scrollHeight: 2600 },
    body: { scrollHeight: 2600 },
    addEventListener(type: string, listener: EventListener) {
      const owned = listeners.get(type) ?? new Set<EventListener>()
      owned.add(listener)
      listeners.set(type, owned)
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener)
    },
  }
  const win = {
    get scrollY() { return scrollY },
    innerWidth: 1200,
    innerHeight: 800,
    devicePixelRatio: 1,
    document: doc,
    performance: { now: () => 10 },
    requestAnimationFrame(callback: FrameRequestCallback) {
      const id = ++frameId
      frames.set(id, callback)
      return id
    },
    cancelAnimationFrame(id: number) { frames.delete(id) },
    setTimeout: (() => 1) as unknown as typeof window.setTimeout,
    clearTimeout: vi.fn(),
    addEventListener(type: string, listener: EventListener) {
      const owned = listeners.get(type) ?? new Set<EventListener>()
      owned.add(listener)
      listeners.set(type, owned)
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener)
    },
  }
  const trigger = { kill: vi.fn() }
  const context = { revert: vi.fn(() => trigger.kill()) }
  const motion = {
    gsap: { context: vi.fn((callback: () => void) => { callback(); return context }) },
    ScrollTrigger: { create: vi.fn(() => trigger), refresh: vi.fn() },
  }
  const runtime = {
    setProgress: vi.fn(),
    impact: vi.fn(),
    render: vi.fn(() => false),
    resize: vi.fn(),
    destroy: vi.fn(),
  }
  const observer = {
    disconnect: vi.fn(),
    observe: vi.fn(),
  }
  const playhead = createRallyPlayhead({
    elements: { root, stage },
    motion: motion as unknown as RallyPlayheadMotion,
    runtime,
    window: win as unknown as RallyPlayheadWindow,
    createObserver(callback) {
      observerCallback = callback
      return observer
    },
  })

  return {
    context, doc, frames, listeners, motion, observer, playhead, root, runtime,
    setIntersecting(value: boolean) { observerCallback?.([{ isIntersecting: value }]) },
    setScroll(value: number) { scrollY = value; listeners.get('scroll')?.forEach((listener) => listener(new Event('scroll'))) },
    setVisible(value: boolean) { visible = value; listeners.get('visibilitychange')?.forEach((listener) => listener(new Event('visibilitychange'))) },
    trigger,
  }
}

describe('native-scroll rally playhead', () => {
  it('reverts a partially created GSAP context when setup throws', () => {
    const landings = [500, 700, 900, 1100].map((top, index) => ({
      id: ['event-opens', 'player-registers', 'payment-matches', 'attendance-resolves'][index],
      getBoundingClientRect: () => ({ top }),
    }))
    const root = {
      dataset: { rallyActive: 'before' },
      getBoundingClientRect: () => ({ top: 0 }),
      querySelectorAll: () => landings,
    } as unknown as HTMLElement
    const listeners = new Map<string, Set<EventListener>>()
    const addListener = (type: string, listener: EventListener) => {
      const owned = listeners.get(type) ?? new Set<EventListener>()
      owned.add(listener)
      listeners.set(type, owned)
    }
    const removeListener = (type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener)
    }
    const trigger = { kill: vi.fn() }
    const context = { revert: vi.fn(() => trigger.kill()) }
    const failure = new Error('context setup failed')
    const runtime = {
      setProgress: vi.fn(),
      impact: vi.fn(),
      render: vi.fn(() => false),
      resize: vi.fn(),
      destroy: vi.fn(),
    }
    const motion = {
      gsap: {
        context: vi.fn((callback: (value: typeof context) => void) => {
          callback(context)
          throw failure
        }),
      },
      ScrollTrigger: { create: vi.fn(() => trigger), refresh: vi.fn() },
    }
    const doc = {
      visibilityState: 'visible' as const,
      documentElement: { scrollHeight: 1200 },
      body: { scrollHeight: 1200 },
      addEventListener: addListener,
      removeEventListener: removeListener,
    }
    const win = {
      scrollY: 0,
      innerWidth: 1200,
      innerHeight: 800,
      devicePixelRatio: 1,
      document: doc,
      performance: { now: () => 0 },
      requestAnimationFrame: vi.fn(() => 1),
      cancelAnimationFrame: vi.fn(),
      addEventListener: addListener,
      removeEventListener: removeListener,
    }

    expect(() => createRallyPlayhead({
      elements: { root, stage: {} as HTMLElement },
      motion: motion as unknown as RallyPlayheadMotion,
      runtime,
      window: win as unknown as RallyPlayheadWindow,
    })).toThrow(failure)
    expect(motion.ScrollTrigger.create).toHaveBeenCalledOnce()
    expect(context.revert).toHaveBeenCalledOnce()
    expect(trigger.kill).toHaveBeenCalledOnce()
    expect(runtime.destroy).toHaveBeenCalledOnce()
    expect(root.dataset.rallyActive).toBe('before')
    expect([...listeners.values()].every((owned) => owned.size === 0)).toBe(true)
  })

  it('lets rapid human reversal interrupt authored settling without snap-back', () => {
    const histories = [
      [600, 1000],
      [1800, 1000],
      [600, 1400, 700, 1800, 1000],
    ]
    const views = histories.map((history) => {
      const view = harness()
      history.forEach((scrollY) => view.setScroll(scrollY))
      return view
    })
    const snapshots = views.map((view) => ({
      active: view.root.dataset.rallyActive,
      progress: view.runtime.setProgress.mock.calls.at(-1)?.[0],
    }))

    expect(snapshots[1]).toEqual(snapshots[0])
    expect(snapshots[2]).toEqual(snapshots[0])
    expect(snapshots[0].active).toBe('player-registers')
    expect(views[2].runtime.impact).toHaveBeenCalled()
    ;[...views[2].frames.values()].forEach((callback) => callback(120))
    expect(views[2].runtime.setProgress.mock.calls.at(-1)?.[0]).toBe(
      snapshots[2].progress,
    )
    views.forEach((view) => view.playhead.destroy())
  })

  it('emits every crossed landing in exact forward and reverse order', () => {
    const view = harness()
    view.runtime.impact.mockClear()

    view.setScroll(2000)
    expect(view.runtime.impact.mock.calls.map(([index]) => index)).toEqual([
      1, 2, 3, 4,
    ])

    view.setScroll(100)
    expect(view.runtime.impact.mock.calls.map(([index]) => index)).toEqual([
      1, 2, 3, 4, 4, 3, 2, 1,
    ])

    view.setScroll(1500)
    expect(view.runtime.impact.mock.calls.map(([index]) => index)).toEqual([
      1, 2, 3, 4, 4, 3, 2, 1, 1, 2, 3, 4,
    ])
    view.playhead.destroy()
  })

  it('pauses offscreen and hidden, then reapplies current truth without historical impacts', () => {
    const view = harness()
    view.runtime.setProgress.mockClear()
    view.runtime.impact.mockClear()
    view.setIntersecting(false)
    view.setScroll(1800)
    expect(view.runtime.setProgress).not.toHaveBeenCalled()
    expect(view.frames.size).toBe(0)
    view.listeners.get('resize')?.forEach((listener) => listener(new Event('resize')))

    view.setIntersecting(true)
    expect(view.runtime.setProgress).toHaveBeenCalledOnce()
    expect(view.runtime.impact).not.toHaveBeenCalled()
    expect(view.runtime.resize).toHaveBeenCalledOnce()
    view.setVisible(false)
    view.setScroll(600)
    expect(view.runtime.setProgress).toHaveBeenCalledOnce()
    view.setVisible(true)
    expect(view.runtime.setProgress).toHaveBeenCalledTimes(2)
    view.playhead.destroy()
  })

  it('refreshes after resize and tears every owned resource down once', () => {
    const view = harness()
    view.listeners.get('resize')?.forEach((listener) => listener(new Event('resize')))
    const callback = [...view.frames.values()][0]
    callback?.(16)
    expect(view.runtime.resize).toHaveBeenCalledOnce()
    expect(view.motion.ScrollTrigger.refresh).toHaveBeenCalledOnce()

    view.playhead.destroy()
    view.playhead.destroy()
    expect(view.trigger.kill).toHaveBeenCalledOnce()
    expect(view.context.revert).toHaveBeenCalledOnce()
    expect(view.observer.disconnect).toHaveBeenCalledOnce()
    expect(view.runtime.destroy).toHaveBeenCalledOnce()
    expect(view.root.dataset.rallyActive).toBeUndefined()
  })

  it('contains no pinning, smoothing, direct seeking, or scroll writes', () => {
    const source = readFileSync(new URL('./rallyPlayhead.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/pinSpacing|ScrollSmoother|scrollTo|scrollBy|\.seek\(|\.progress\(/)
    expect(source).not.toMatch(/\b(?:pin|scrub|smooth)\s*:/)
  })
})
