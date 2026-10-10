import { describe, expect, it, vi, afterEach } from 'vitest'
import { createDominantMotion } from '../shared/landingMotion'
import { createAttachmentSwap, handleWorkKey, isStickyPreview } from './workInteraction'

afterEach(() => vi.unstubAllGlobals())
describe('work index interaction', () => {
  it('arrows move focus without selecting; Enter activates the focused row', () => {
    let selected = 0
    const buttons = Array.from({ length: 4 }, (_, index) => ({ focus: vi.fn(), click: vi.fn(() => { selected = index }) }))
    const preventDefault = vi.fn()
    handleWorkKey('ArrowDown', 0, buttons, preventDefault)
    expect(buttons[1].focus).toHaveBeenCalledOnce()
    expect(selected).toBe(0)
    expect(buttons.every(b => b.click.mock.calls.length === 0)).toBe(true)
    handleWorkKey('ArrowUp', 0, buttons, preventDefault)
    expect(buttons[3].focus).toHaveBeenCalledOnce()
    handleWorkKey('Enter', 3, buttons, preventDefault)
    expect(buttons[3].click).toHaveBeenCalledOnce()
    expect(selected).toBe(3)
    expect(handleWorkKey('Tab', 0, buttons, preventDefault)).toBe(false)
  })
  it('enables sticky only above tablet width and at least 760 px high', () => {
    expect(isStickyPreview(1440, 900)).toBe(true)
    expect(isStickyPreview(1280, 760)).toBe(true)
    expect(isStickyPreview(1280, 759)).toBe(false)
    expect(isStickyPreview(1000, 1024)).toBe(false)
    expect(isStickyPreview(390, 844)).toBe(false)
  })
  it('cancels rapid swaps and ignores completion of the stale animation', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    const animations = Array.from({ length: 2 }, () => ({ cancel: vi.fn(), onfinish: null as (() => void) | null }))
    const animate = vi.fn().mockReturnValueOnce(animations[0]).mockReturnValueOnce(animations[1])
    const coordinator = createDominantMotion()
    const swap = createAttachmentSwap(coordinator, 'test-index')
    swap.play({ animate } as unknown as HTMLElement, true)
    const oldFinish = animations[0].onfinish!
    swap.play({ animate } as unknown as HTMLElement, true)
    expect(animations[0].cancel).toHaveBeenCalledOnce()
    oldFinish()
    expect(coordinator.currentId()).toBe('test-index')
    expect(animate.mock.calls[1][1]).toMatchObject({ duration: 220 })
    animations[1].onfinish!()
    expect(coordinator.currentId()).toBeUndefined()
    swap.dispose(); coordinator.dispose()
  })
  it('settles on competing motion and never plays hidden, offscreen or reduced states', () => {
    const doc = Object.assign(new EventTarget(), { hidden: false })
    vi.stubGlobal('document', doc)
    const media = { matches: false }
    vi.stubGlobal('window', { matchMedia: () => media })
    const animation = { cancel: vi.fn(), onfinish: null }
    const animate = vi.fn(() => animation)
    const coordinator = createDominantMotion()
    const swap = createAttachmentSwap(coordinator, 'test-index')
    const el = { animate } as unknown as HTMLElement
    swap.play(el, true)
    coordinator.start('demo', vi.fn())
    expect(animation.cancel).toHaveBeenCalledOnce()
    swap.play(el, false)
    media.matches = true; swap.play(el, true)
    media.matches = false; doc.hidden = true; swap.play(el, true)
    expect(animate).toHaveBeenCalledOnce()
    doc.hidden = false; swap.play(el, true)
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'))
    expect(animation.cancel).toHaveBeenCalledTimes(2)
    expect(coordinator.currentId()).toBeUndefined()
    swap.dispose(); coordinator.dispose()
  })
})
