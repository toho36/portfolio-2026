import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDominantMotion, disposeDominantMotion, duration, MOTION_MS, prefersReducedMotion, scrubReveal, whenVisible } from './landingMotion'

let doc: EventTarget & { hidden: boolean }
let media: EventTarget & { matches: boolean }
let observe: ReturnType<typeof vi.fn>
let disconnect: ReturnType<typeof vi.fn>
let notify: IntersectionObserverCallback
let win: EventTarget & { innerHeight: number; matchMedia: () => typeof media }
let top: number
let frames: Map<number, FrameRequestCallback>
let raf: ReturnType<typeof vi.fn>
let cancelRaf: ReturnType<typeof vi.fn>
const el = { getBoundingClientRect: () => ({ top, height: 200 }) } as HTMLElement
const flush = () => {
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach(cb => cb(0))
}
const scrollTo = (value: number) => { top = value; win.dispatchEvent(new Event('scroll')); flush() }
const timeline = () => ({ pause: vi.fn(), progress: vi.fn().mockReturnThis() })

beforeEach(() => {
  vi.clearAllMocks()
  doc = Object.assign(new EventTarget(), { hidden: false })
  media = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('document', doc)
  top = 800
  win = Object.assign(new EventTarget(), { innerHeight: 800, matchMedia: () => media })
  vi.stubGlobal('window', win)
  frames = new Map()
  let nextFrame = 0
  raf = vi.fn((cb: FrameRequestCallback) => { frames.set(++nextFrame, cb); return nextFrame })
  cancelRaf = vi.fn((id: number) => frames.delete(id))
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', cancelRaf)
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
  it('applies initial progress immediately and maps boundaries, reverse travel and fast jumps', async () => {
    const tl = timeline()
    const dispose = scrubReveal(el, tl)
    expect(tl.progress).toHaveBeenCalledExactlyOnceWith(0)
    await dispose.ready
    for (const value of [0, -200, 600, 800, -1200, 1800]) scrollTo(value)
    expect(tl.progress.mock.calls.map(([value]) => value)).toEqual([0, .8, 1, .2, 0, 1, 0])
    dispose()
  })
  it('applies mount progress even with a foreign owner without taking ownership', () => {
    top = 300
    const coordinator = createDominantMotion()
    const cancel = vi.fn()
    coordinator.start('other', cancel)
    const tl = timeline()
    const dispose = scrubReveal(el, tl, coordinator)
    expect(tl.progress).toHaveBeenCalledExactlyOnceWith(.5)
    expect(coordinator.currentId()).toBe('other')
    expect(cancel).not.toHaveBeenCalled()
    dispose(); coordinator.dispose()
  })
  it('checks hidden state again when a queued frame runs before visibilitychange', () => {
    const tl = timeline()
    const dispose = scrubReveal(el, tl)
    top = 0; win.dispatchEvent(new Event('scroll'))
    doc.hidden = true
    flush()
    expect(tl.progress).toHaveBeenCalledExactlyOnceWith(0)
    expect(frames.size).toBe(0)
    dispose()
  })
  it('coalesces scroll bursts into one frame using the latest position and schedules nothing while idle', () => {
    const tl = timeline()
    const dispose = scrubReveal(el, tl)
    expect(raf).not.toHaveBeenCalled()
    top = 600
    for (let i = 0; i < 10; i++) win.dispatchEvent(new Event('scroll'))
    top = 0
    expect(raf).toHaveBeenCalledOnce()
    expect(tl.progress).toHaveBeenCalledOnce()
    flush()
    expect(tl.progress).toHaveBeenLastCalledWith(.8)
    for (let i = 0; i < 10; i++) flush()
    expect(raf).toHaveBeenCalledOnce()
    expect(frames.size).toBe(0)
    scrollTo(-200)
    expect(raf).toHaveBeenCalledTimes(2)
    dispose()
  })
  it('updates viewport mapping on resize without starting a scrolling owner', () => {
    top = 300
    const coordinator = createDominantMotion()
    const tl = timeline()
    const dispose = scrubReveal(el, tl, coordinator)
    expect(tl.progress).toHaveBeenLastCalledWith(.5)
    expect(coordinator.currentId()).toBeUndefined()
    win.innerHeight = 400
    win.dispatchEvent(new Event('resize')); flush()
    expect(tl.progress).toHaveBeenLastCalledWith(1 / 6)
    expect(coordinator.currentId()).toBeUndefined()
    dispose(); coordinator.dispose()
  })
  it('owns only interior scrolling progress, preserves foreign owners and releases at either boundary', () => {
    const coordinator = createDominantMotion()
    const tl = timeline()
    const dispose = scrubReveal(el, tl, coordinator)
    scrollTo(600)
    expect(coordinator.currentId()).toMatch(/^landing-reveal-/)
    coordinator.start('other', vi.fn())
    scrollTo(0)
    expect(tl.progress).toHaveBeenLastCalledWith(.2)
    expect(coordinator.currentId()).toBe('other')
    coordinator.stop('other')
    scrollTo(0)
    expect(tl.progress).toHaveBeenLastCalledWith(.8)
    scrollTo(-200)
    expect(coordinator.currentId()).toBeUndefined()
    scrollTo(600); scrollTo(800)
    expect(coordinator.currentId()).toBeUndefined()
    dispose(); coordinator.dispose()
  })
  it('uses passive listeners and removes them, cancels pending work and stops its owner on dispose', () => {
    const add = vi.spyOn(win, 'addEventListener')
    const remove = vi.spyOn(win, 'removeEventListener')
    const mediaRemove = vi.spyOn(media, 'removeEventListener')
    const docRemove = vi.spyOn(doc, 'removeEventListener')
    const coordinator = createDominantMotion()
    const tl = timeline()
    const dispose = scrubReveal(el, tl, coordinator)
    expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })
    expect(add).toHaveBeenCalledWith('resize', expect.any(Function), { passive: true })
    scrollTo(600)
    win.dispatchEvent(new Event('scroll'))
    dispose(); dispose()
    expect(coordinator.currentId()).toBeUndefined()
    expect(cancelRaf).toHaveBeenCalledOnce()
    for (const event of ['scroll', 'resize']) {
      expect(remove).toHaveBeenCalledWith(event, add.mock.calls.find(([name]) => name === event)?.[1])
      win.dispatchEvent(new Event(event))
    }
    expect(mediaRemove).toHaveBeenCalledWith('change', expect.any(Function))
    expect(docRemove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    flush()
    expect(tl.progress).toHaveBeenCalledTimes(2)
    expect(raf).toHaveBeenCalledTimes(2)
    coordinator.dispose()
  })
  it('reduced motion applies final state with no listeners or frames', async () => {
    media.matches = true
    const add = vi.spyOn(win, 'addEventListener')
    const mediaAdd = vi.spyOn(media, 'addEventListener')
    const docAdd = vi.spyOn(doc, 'addEventListener')
    const tl = timeline()
    const dispose = scrubReveal(el, tl)
    await dispose.ready
    expect(tl.progress).toHaveBeenCalledExactlyOnceWith(1)
    expect(add).not.toHaveBeenCalled()
    expect(mediaAdd).not.toHaveBeenCalled()
    expect(docAdd).not.toHaveBeenCalled()
    expect(raf).not.toHaveBeenCalled()
    dispose()
  })
  it('does not update or schedule while hidden, including mount and a queued frame', () => {
    doc.hidden = true
    const tl = timeline()
    const dispose = scrubReveal(el, tl)
    scrollTo(600)
    expect(tl.progress).not.toHaveBeenCalled()
    expect(raf).not.toHaveBeenCalled()
    doc.hidden = false
    scrollTo(600)
    expect(tl.progress).toHaveBeenLastCalledWith(.2)
    top = 0; win.dispatchEvent(new Event('scroll'))
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'))
    flush()
    expect(tl.progress).toHaveBeenCalledOnce()
    dispose()
  })
  it('settles and removes listeners when reduced motion is enabled at runtime', () => {
    const tl = timeline()
    const coordinator = createDominantMotion()
    const dispose = scrubReveal(el, tl, coordinator)
    scrollTo(600)
    win.dispatchEvent(new Event('scroll'))
    media.matches = true; media.dispatchEvent(new Event('change'))
    expect(tl.progress).toHaveBeenLastCalledWith(1)
    expect(coordinator.currentId()).toBeUndefined()
    const count = raf.mock.calls.length
    scrollTo(0)
    expect(raf).toHaveBeenCalledTimes(count)
    expect(tl.progress).toHaveBeenCalledTimes(3)
    dispose(); coordinator.dispose()
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
  it('settles scrub without browser globals', async () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    const tl = timeline()
    const dispose = scrubReveal(el, tl)
    await dispose.ready
    expect(tl.pause).toHaveBeenCalledOnce()
    expect(tl.progress).toHaveBeenCalledExactlyOnceWith(1)
    dispose(); dispose()
    expect(tl.pause).toHaveBeenCalledOnce()
  })
})
