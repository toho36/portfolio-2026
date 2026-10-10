import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDominantMotion } from '../shared/landingMotion'
import { createScreenSwitchController } from './screenSwitchController'

let doc: EventTarget & { hidden: boolean; timeline: { currentTime: number } }
let media: EventTarget & { matches: boolean }
let intersect: IntersectionObserverCallback
let disconnect: ReturnType<typeof vi.fn>

beforeEach(() => {
  doc = Object.assign(new EventTarget(), { hidden: false, timeline: { currentTime: 100 } })
  media = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('document', doc)
  vi.stubGlobal('window', Object.assign(new EventTarget(), { matchMedia: () => media }))
  disconnect = vi.fn()
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: IntersectionObserverCallback) { intersect = cb }
    observe = vi.fn()
    disconnect = disconnect
  })
})
afterEach(() => vi.unstubAllGlobals())

function setup() {
  const animations: { cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null; startTime: number | null }[] = []
  const root = { dataset: { swapped: 'false' }, querySelectorAll: () => windows } as unknown as HTMLElement
  const windows = [0, 1].map((index) => ({
    getBoundingClientRect: () => ({ left: (index === 0) !== (root.dataset.swapped === 'true') ? 10 : 110, top: 0 }),
    animate: vi.fn((_frames: Keyframe[], _options: KeyframeAnimationOptions) => {
      const animation: (typeof animations)[number] = { cancel: vi.fn(), onfinish: null, startTime: null }
      animations.push(animation)
      return animation
    }),
  }))
  const coordinator = createDominantMotion()
  const changed = vi.fn()
  const controller = createScreenSwitchController(root, coordinator, changed)
  intersect([{ target: root, isIntersecting: true }] as unknown as IntersectionObserverEntry[], {} as IntersectionObserver)
  return { root, windows, animations, coordinator, changed, controller }
}

describe('landing Screen Switch', () => {
  it('swaps both windows in the same 280 ms timeline and announces only the complete state', () => {
    const { root, windows, animations, coordinator, changed, controller } = setup()
    controller.swap()
    expect(root.dataset.swapped).toBe('true')
    expect(coordinator.currentId()).toBe('switch')
    expect(windows[0].animate).toHaveBeenCalledWith([
      { transform: 'translate(-100px, 0px)' }, { transform: 'translate(0px, 0px)' },
    ], { duration: 280, easing: 'cubic-bezier(.16,1,.3,1)' })
    expect(windows[1].animate.mock.calls[0][0][0]).toEqual({ transform: 'translate(100px, 0px)' })
    expect(animations.map((animation) => animation.startTime)).toEqual([100, 100])
    expect(changed).toHaveBeenLastCalledWith(true, false)
    animations[0].onfinish?.()
    expect(coordinator.currentId()).toBe('switch')
    animations[1].onfinish?.()
    expect(changed).toHaveBeenLastCalledWith(true, true)
    expect(coordinator.currentId()).toBeUndefined()
    controller.dispose(); coordinator.dispose()
  })

  it('rapid clicks replace the current swap and stale completions never queue another swap', () => {
    const { root, animations, controller, changed, coordinator } = setup()
    controller.swap()
    const staleFinish = animations[0].onfinish!
    controller.swap()
    expect(root.dataset.swapped).toBe('false')
    expect(animations).toHaveLength(4)
    expect(animations[0].cancel).toHaveBeenCalledOnce()
    expect(animations[1].cancel).toHaveBeenCalledOnce()
    staleFinish()
    expect(changed).toHaveBeenLastCalledWith(false, false)
    animations[2].onfinish?.(); animations[3].onfinish?.()
    expect(changed).toHaveBeenLastCalledWith(false, true)
    expect(animations).toHaveLength(4)
    controller.dispose(); coordinator.dispose()
  })

  it('reduced motion swaps instantly and changing the preference settles an active swap', () => {
    const { root, animations, controller, changed, coordinator } = setup()
    controller.swap()
    media.matches = true; media.dispatchEvent(new Event('change'))
    expect(animations.every((animation) => animation.cancel.mock.calls.length === 1)).toBe(true)
    controller.swap()
    expect(root.dataset.swapped).toBe('false')
    expect(animations).toHaveLength(2)
    expect(changed).toHaveBeenLastCalledWith(false, true)
    controller.dispose(); coordinator.dispose()
  })

  it('an initially reduced preference creates no animation and can toggle repeatedly', () => {
    media.matches = true
    const { root, animations, controller, changed, coordinator } = setup()
    controller.swap()
    expect(root.dataset.swapped).toBe('true')
    expect(changed).toHaveBeenLastCalledWith(true, true)
    controller.swap()
    expect(root.dataset.swapped).toBe('false')
    expect(changed).toHaveBeenLastCalledWith(false, true)
    expect(animations).toHaveLength(0)
    expect(coordinator.currentId()).toBeUndefined()
    controller.dispose(); coordinator.dispose()
  })

  it('unmount cancels both windows, disconnects listeners and ignores stale finish/click events', () => {
    const { animations, controller, changed, coordinator } = setup()
    controller.swap()
    const staleFinish = animations[0].onfinish!
    controller.dispose()
    changed.mockClear()
    staleFinish(); controller.swap()
    media.matches = true; media.dispatchEvent(new Event('change'))
    window.dispatchEvent(new Event('resize'))
    expect(changed).not.toHaveBeenCalled()
    expect(animations).toHaveLength(2)
    expect(animations.every((animation) => animation.cancel.mock.calls.length === 1)).toBe(true)
    expect(coordinator.currentId()).toBeUndefined()
    expect(disconnect).toHaveBeenCalledOnce()
    coordinator.dispose()
  })

  it('settles on hidden, offscreen, resize and a new dominant owner without auto-resuming', () => {
    const { root, animations, controller, changed, coordinator } = setup()
    controller.swap()
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'))
    expect(changed).toHaveBeenLastCalledWith(true, true)
    controller.swap()
    expect(animations).toHaveLength(2)
    doc.hidden = false
    intersect([{ target: root, isIntersecting: false }] as unknown as IntersectionObserverEntry[], {} as IntersectionObserver)
    controller.swap()
    expect(animations).toHaveLength(2)
    intersect([{ target: root, isIntersecting: true }] as unknown as IntersectionObserverEntry[], {} as IntersectionObserver)
    expect(animations).toHaveLength(2)
    controller.swap()
    window.dispatchEvent(new Event('resize'))
    expect(coordinator.currentId()).toBeUndefined()
    controller.swap()
    coordinator.start('index', vi.fn())
    expect(coordinator.currentId()).toBe('index')
    expect(animations.every((animation) => animation.cancel.mock.calls.length === 1)).toBe(true)
    controller.dispose(); coordinator.dispose()
    expect(disconnect).toHaveBeenCalledOnce()
  })
})
