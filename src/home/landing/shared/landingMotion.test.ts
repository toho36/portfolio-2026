import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDominantMotion, disposeDominantMotion, duration, MOTION_MS, prefersReducedMotion, scrubReveal, whenVisible } from './landingMotion'

const mock = vi.hoisted(() => ({
  create: vi.fn(), registerPlugin: vi.fn(), getAll: vi.fn(() => [] as unknown[]),
  getById: vi.fn(), disable: vi.fn(), enable: vi.fn(), sleep: vi.fn(), wake: vi.fn(),
  children: [] as { paused: () => boolean; totalProgress: () => number }[],
}))
vi.mock('../../../playground/loadRelayRuntime', () => ({
  importRelayMotion: async () => ({ gsap: { registerPlugin: mock.registerPlugin, ticker: { sleep: mock.sleep, wake: mock.wake },
    globalTimeline: { getChildren: () => mock.children } },
    ScrollTrigger: { create: mock.create, getAll: mock.getAll, getById: mock.getById, disable: mock.disable, enable: mock.enable } }),
}))

let doc: EventTarget & { hidden: boolean }
let media: EventTarget & { matches: boolean }
let observe: ReturnType<typeof vi.fn>
let disconnect: ReturnType<typeof vi.fn>
let notify: IntersectionObserverCallback
const el = {} as HTMLElement
const timeline = () => ({ pause: vi.fn(), progress: vi.fn().mockReturnThis() })

beforeEach(() => {
  vi.clearAllMocks()
  mock.getAll.mockReturnValue([])
  mock.getById.mockReturnValue(undefined)
  mock.children = []
  doc = Object.assign(new EventTarget(), { hidden: false })
  media = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('document', doc)
  vi.stubGlobal('window', { matchMedia: () => media })
  observe = vi.fn(); disconnect = vi.fn()
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: IntersectionObserverCallback) { notify = cb }
    observe = observe
    disconnect = disconnect
  })
})
afterEach(() => { disposeDominantMotion(); vi.unstubAllGlobals() })

describe('landing motion', () => {
  it('cancels the previous owner exactly once; stale stop cannot clear the new owner', () => {
    const coordinator = createDominantMotion()
    const first = vi.fn(); const second = vi.fn()
    coordinator.start('p1', first)
    coordinator.start('index', second)
    coordinator.start('index', second)
    coordinator.stop('p1')
    coordinator.start('switch', vi.fn())
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    coordinator.dispose()
  })
  it('pauses on hidden and refuses starts until visible, without autoplay', () => {
    const coordinator = createDominantMotion()
    const cancel = vi.fn(); const pause = vi.fn()
    coordinator.start('p1', cancel, pause)
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'))
    expect(pause).toHaveBeenCalledOnce()
    expect(coordinator.start('index', vi.fn())).toBe(false)
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'))
    expect(pause).toHaveBeenCalledOnce()
    coordinator.dispose()
  })
  it('settles cancel-only owners on hidden exactly once', () => {
    const coordinator = createDominantMotion()
    const cancel = vi.fn()
    coordinator.start('p1', cancel)
    doc.hidden = true
    doc.dispatchEvent(new Event('visibilitychange'))
    doc.dispatchEvent(new Event('visibilitychange'))
    coordinator.dispose()
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('registers no render-time listener and restores hidden cancellation after StrictMode cleanup', () => {
    const add = vi.spyOn(doc, 'addEventListener')
    const coordinator = createDominantMotion()
    expect(add).not.toHaveBeenCalled()
    coordinator.start('first', vi.fn())
    coordinator.dispose()
    const cancel = vi.fn()
    coordinator.start('second', cancel)
    doc.hidden = true
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(cancel).toHaveBeenCalledOnce()
    expect(add).toHaveBeenCalledTimes(2)
    coordinator.dispose()
  })
  it('tracks preference changes and returns zero durations', () => {
    const changed = vi.fn()
    const unlisten = prefersReducedMotion(changed)
    expect(duration('P1_STEP')).toBe(240)
    media.matches = true; media.dispatchEvent(new Event('change'))
    expect(changed).toHaveBeenCalledWith(true)
    for (const key of Object.keys(MOTION_MS) as (keyof typeof MOTION_MS)[]) expect(duration(key)).toBe(0)
    unlisten()
    media.matches = false; media.dispatchEvent(new Event('change'))
    expect(changed).toHaveBeenCalledOnce()
  })
  it('reveals once and disconnects before calling the callback', () => {
    const cb = vi.fn(() => expect(disconnect).toHaveBeenCalledOnce())
    const dispose = whenVisible(el, cb)
    notify([{ isIntersecting: false, target: el }] as unknown as IntersectionObserverEntry[], {} as IntersectionObserver)
    notify([{ isIntersecting: true, target: el }] as unknown as IntersectionObserverEntry[], {} as IntersectionObserver)
    notify([{ isIntersecting: true, target: el }] as unknown as IntersectionObserverEntry[], {} as IntersectionObserver)
    expect(observe).toHaveBeenCalledWith(el)
    expect(cb).toHaveBeenCalledOnce()
    dispose()
    expect(disconnect).toHaveBeenCalledOnce()
  })
  it('reduced motion settles final state without a trigger', async () => {
    media.matches = true
    const tl = timeline()
    const dispose = scrubReveal(el, tl)
    await dispose.ready
    expect(tl.progress).toHaveBeenCalledWith(1)
    expect(mock.create).not.toHaveBeenCalled()
    dispose()
  })
  it('scrubs in both directions, freezes hidden, and kills its trigger on dispose', async () => {
    const kill = vi.fn()
    mock.create.mockReturnValue({ kill })
    const coordinator = createDominantMotion()
    const tl = timeline()
    const dispose = scrubReveal(el, tl, coordinator)
    await dispose.ready
    const config = mock.create.mock.calls[0][0]
    expect(config.scrub).toBe(true)
    config.onUpdate({ progress: .8, isActive: true })
    config.onUpdate({ progress: .2, isActive: true })
    expect(tl.progress).toHaveBeenLastCalledWith(.2)
    config.onUpdate({ progress: 1, isActive: false })
    expect(tl.progress).toHaveBeenLastCalledWith(1)
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'))
    config.onUpdate({ progress: .9, isActive: true })
    expect(tl.progress).toHaveBeenLastCalledWith(1)
    dispose(); dispose()
    expect(kill).toHaveBeenCalledOnce()
    coordinator.dispose()
  })
  it('registers scrub with the same coordinator as user actions', async () => {
    mock.create.mockReturnValue({ kill: vi.fn() })
    const coordinator = createDominantMotion()
    const cancel = vi.fn()
    coordinator.start('p1', cancel)
    const tl = timeline()
    const dispose = scrubReveal(el, tl, coordinator)
    await dispose.ready
    mock.create.mock.calls[0][0].onUpdate({ progress: .5, isActive: true })
    mock.create.mock.calls[0][0].onToggle({ progress: .5, isActive: true })
    expect(cancel).toHaveBeenCalledOnce()
    tl.pause.mockClear()
    const nextCancel = vi.fn()
    coordinator.start('index', nextCancel)
    expect(tl.pause).toHaveBeenCalledOnce()
    dispose()
    coordinator.start('switch', vi.fn())
    expect(nextCancel).toHaveBeenCalledOnce()
    coordinator.dispose()
  })
  it('only updates the current reveal when two sections overlap', async () => {
    mock.create.mockReturnValue({ kill: vi.fn() })
    const coordinator = createDominantMotion()
    const first = timeline(); const second = timeline()
    const disposeFirst = scrubReveal(el, first, coordinator)
    const disposeSecond = scrubReveal(el, second, coordinator)
    await Promise.all([disposeFirst.ready, disposeSecond.ready])
    const a = mock.create.mock.calls[0][0]; const b = mock.create.mock.calls[1][0]
    a.onUpdate({ progress: .2, isActive: true })
    b.onUpdate({ progress: .4, isActive: true })
    expect(second.progress).not.toHaveBeenCalled()
    b.onToggle({ progress: .4, isActive: true })
    first.progress.mockClear()
    a.onUpdate({ progress: .5, isActive: true })
    b.onUpdate({ progress: .7, isActive: true })
    expect(first.progress).not.toHaveBeenCalled()
    expect(second.progress).toHaveBeenLastCalledWith(.7)
    b.onUpdate({ progress: 1, isActive: false })
    b.onToggle({ progress: 1, isActive: false })
    a.onUpdate({ progress: .3, isActive: true })
    expect(first.progress).toHaveBeenLastCalledWith(.3)
    disposeFirst(); disposeSecond(); coordinator.dispose()
  })
  it('applies both boundaries with onUpdate before onToggle, including fast jumps and clamping', async () => {
    mock.create.mockReturnValue({ kill: vi.fn() })
    const coordinator = createDominantMotion()
    const tl = timeline()
    const dispose = scrubReveal(el, tl, coordinator)
    await dispose.ready
    const config = mock.create.mock.calls[0][0]
    for (const progress of [.8, 1, .2, 0]) {
      const self = { progress, isActive: progress > 0 && progress < 1 }
      config.onUpdate(self)
      config.onToggle(self)
    }
    expect(tl.progress.mock.calls.map(([value]) => value)).toEqual([.8, 1, .2, 0])
    expect(coordinator.currentId()).toBeUndefined()
    config.onUpdate({ progress: 2, isActive: false })
    config.onUpdate({ progress: -1, isActive: false })
    expect(tl.progress.mock.calls.slice(-2).map(([value]) => value)).toEqual([1, 0])
    dispose(); coordinator.dispose()
  })
  it('sleeps and disables globals only after the last owned reveal, then wakes and enables on remount', async () => {
    mock.create.mockImplementation(() => ({ kill: vi.fn() }))
    const first = scrubReveal(el, timeline())
    const second = scrubReveal(el, timeline())
    await Promise.all([first.ready, second.ready])
    mock.wake.mockClear()
    first(); first()
    expect(mock.sleep).not.toHaveBeenCalled()
    expect(mock.disable).not.toHaveBeenCalled()
    second(); second()
    expect(mock.sleep).toHaveBeenCalledOnce()
    expect(mock.disable).toHaveBeenCalledOnce()
    mock.enable.mockClear()
    const remount = scrubReveal(el, timeline())
    await remount.ready
    expect(mock.wake).toHaveBeenCalledOnce()
    expect(mock.enable).toHaveBeenCalledOnce()
    remount()
    expect(mock.sleep).toHaveBeenCalledTimes(2)
  })
  it('never sleeps the ticker while a foreign animation is active, and never wakes a ticker it did not sleep', async () => {
    mock.create.mockImplementation(() => ({ kill: vi.fn() }))
    const settle = scrubReveal(el, timeline())
    await settle.ready
    settle()
    mock.sleep.mockClear(); mock.wake.mockClear(); mock.disable.mockClear()
    mock.children = [{ paused: () => false, totalProgress: () => 0.4 }]
    const reveal = scrubReveal(el, timeline())
    await reveal.ready
    expect(mock.wake).toHaveBeenCalledOnce()
    reveal()
    expect(mock.disable).toHaveBeenCalledOnce()
    expect(mock.sleep).not.toHaveBeenCalled()
    mock.wake.mockClear()
    const again = scrubReveal(el, timeline())
    await again.ready
    expect(mock.wake).not.toHaveBeenCalled()
    again()
  })
  it('keeps the ticker awake for a scheduled foreign tween and sleeps once only finished or paused ones remain', async () => {
    mock.create.mockImplementation(() => ({ kill: vi.fn() }))
    mock.children = [{ paused: () => false, totalProgress: () => 0 }]
    const reveal = scrubReveal(el, timeline())
    await reveal.ready
    mock.sleep.mockClear()
    reveal()
    expect(mock.sleep).not.toHaveBeenCalled()
    mock.children = [{ paused: () => false, totalProgress: () => 1 }, { paused: () => true, totalProgress: () => 0.3 }]
    const next = scrubReveal(el, timeline())
    await next.ready
    next()
    expect(mock.sleep).toHaveBeenCalledOnce()
  })
  it.each(['trigger', 'ScrollSmoother'])('leaves foreign %s owners and global ticking intact', async (owner) => {
    const foreign = { kill: vi.fn() }
    if (owner === 'trigger') mock.getAll.mockReturnValue([foreign])
    else mock.getById.mockReturnValue(foreign)
    const kill = vi.fn()
    mock.create.mockReturnValue({ kill })
    const dispose = scrubReveal(el, timeline())
    await dispose.ready
    dispose()
    expect(kill).toHaveBeenCalledOnce()
    expect(foreign.kill).not.toHaveBeenCalled()
    expect(mock.disable).not.toHaveBeenCalled()
    expect(mock.sleep).not.toHaveBeenCalled()
  })
  it.each(['window', 'IntersectionObserver'])('reveals immediately without %s', (missing) => {
    vi.stubGlobal(missing, undefined)
    const cb = vi.fn()
    const dispose = whenVisible(el, cb)
    expect(cb).toHaveBeenCalledOnce()
    expect(observe).not.toHaveBeenCalled()
    dispose(); dispose()
    expect(cb).toHaveBeenCalledOnce()
  })
  it('settles scrub without browser globals or a trigger', async () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    const tl = timeline()
    const dispose = scrubReveal(el, tl)
    await dispose.ready
    expect(tl.pause).toHaveBeenCalledOnce()
    expect(tl.progress).toHaveBeenCalledExactlyOnceWith(1)
    expect(mock.create).not.toHaveBeenCalled()
    expect(mock.wake).not.toHaveBeenCalled()
    dispose(); dispose()
    expect(tl.pause).toHaveBeenCalledOnce()
  })
  it('disposal during loading prevents a late trigger', async () => {
    const coordinator = createDominantMotion()
    const dispose = scrubReveal(el, timeline(), coordinator)
    dispose()
    await dispose.ready
    expect(mock.create).not.toHaveBeenCalled()
    coordinator.dispose()
  })
  it('a preference change settles an existing reveal and kills its trigger', async () => {
    const kill = vi.fn(); mock.create.mockReturnValue({ kill })
    const tl = timeline()
    const coordinator = createDominantMotion()
    const dispose = scrubReveal(el, tl, coordinator)
    await dispose.ready
    media.matches = true; media.dispatchEvent(new Event('change'))
    expect(tl.progress).toHaveBeenLastCalledWith(1)
    expect(kill).toHaveBeenCalledOnce()
    expect(mock.sleep).toHaveBeenCalledOnce()
    expect(tl.progress.mock.invocationCallOrder.at(-1)).toBeLessThan(mock.sleep.mock.invocationCallOrder[0])
    media.matches = false; media.dispatchEvent(new Event('change'))
    media.matches = true; media.dispatchEvent(new Event('change'))
    expect(tl.progress).toHaveBeenCalledOnce()
    dispose(); coordinator.dispose()
    expect(kill).toHaveBeenCalledOnce()
  })
})
