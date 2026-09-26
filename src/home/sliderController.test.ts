import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSliderController } from './sliderController'

const originalWindow = globalThis.window
const originalMatchMedia = globalThis.matchMedia
const originalCancel = globalThis.cancelAnimationFrame
const originalRequest = globalThis.requestAnimationFrame

afterEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('window', originalWindow)
  vi.stubGlobal('matchMedia', originalMatchMedia)
  vi.stubGlobal('cancelAnimationFrame', originalCancel)
  vi.stubGlobal('requestAnimationFrame', originalRequest)
})

describe('slider controller', () => {
  it('allows a switch-button click but suppresses its click after a slider drag', () => {
    const handlers = new Map<string, EventListener>()
    const capture = vi.fn()
    const track = {
      scrollLeft: 0, clientWidth: 800,
      querySelectorAll: () => [{ dataset: { index: '05', label: 'Small tools' }, style: { setProperty: () => {} } }],
      classList: { add: () => {}, remove: () => {} },
      setPointerCapture: capture, hasPointerCapture: () => false,
      addEventListener: (name: string, handler: EventListener) => handlers.set(name, handler), removeEventListener: () => {},
    } as unknown as HTMLElement
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {}, setTimeout: () => 1 })
    const controller = createSliderController(track, { reducedMotion: true, announce: () => {} })
    const target = { closest: (selector: string) => selector.includes('.screen-switch-hit') || selector.includes('button') ? {} : null }
    const pointer = (type: string, x: number) => handlers.get(type)?.({ button: 0, pointerType: 'mouse', detail: 1, clientX: x, pointerId: 1, target, preventDefault: vi.fn() } as unknown as Event)
    const click = () => { const preventDefault = vi.fn(); handlers.get('click')?.({ preventDefault, stopPropagation: vi.fn() } as unknown as Event); return preventDefault }
    pointer('pointerdown', 100)
    pointer('pointerup', 100)
    expect(click()).not.toHaveBeenCalled()
    pointer('pointerdown', 100)
    pointer('pointermove', 50)
    pointer('pointerup', 50)
    expect(capture).toHaveBeenCalled()
    expect(click()).toHaveBeenCalledOnce()
    controller.destroy()
  })
  it('disables selection only during a fine-pointer drag', () => {
    const handlers = new Map<string, EventListener>()
    const classes = new Set<string>()
    const capture = vi.fn()
    const track = {
      scrollLeft: 0, clientWidth: 800,
      querySelectorAll: () => [{ dataset: { index: '00', label: 'Hero' }, style: { setProperty: () => {} } }],
      classList: { add: (name: string) => classes.add(name), remove: (...names: string[]) => names.forEach((name) => classes.delete(name)) },
      setPointerCapture: capture, hasPointerCapture: () => false,
      addEventListener: (name: string, handler: EventListener) => handlers.set(name, handler), removeEventListener: () => {},
    } as unknown as HTMLElement
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {}, setTimeout: () => 1 })
    const controller = createSliderController(track, { reducedMotion: true, announce: () => {} })
    const preventDefault = vi.fn()
    handlers.get('pointerdown')?.({ button: 0, pointerType: 'mouse', detail: 1, clientX: 100, pointerId: 1, target: { closest: () => null }, preventDefault } as unknown as Event)
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(classes.has('is-dragging')).toBe(true)
    expect(capture).toHaveBeenCalledOnce()
    handlers.get('pointerup')?.({ pointerId: 1 } as unknown as Event)
    expect(classes.has('is-dragging')).toBe(false)
    const linkDefault = vi.fn()
    handlers.get('pointerdown')?.({ button: 0, pointerType: 'mouse', detail: 1, clientX: 100, pointerId: 1, target: { closest: (selector: string) => selector.includes('a, button') ? {} : null }, preventDefault: linkDefault } as unknown as Event)
    expect(linkDefault).not.toHaveBeenCalled()
    expect(capture).toHaveBeenCalledOnce()
    expect(classes.has('is-dragging')).toBe(false)
    handlers.get('pointermove')?.({ clientX: 10, pointerId: 1 } as unknown as Event)
    expect(track.scrollLeft).toBe(0)
    handlers.get('pointerdown')?.({ button: 0, pointerType: 'mouse', detail: 3, preventDefault } as unknown as Event)
    expect(classes.has('is-dragging')).toBe(false)
    const preventImageDrag = vi.fn()
    handlers.get('dragstart')?.({ target: { closest: () => ({}) }, preventDefault: preventImageDrag } as unknown as Event)
    expect(preventImageDrag).toHaveBeenCalledOnce()
    controller.destroy()
  })
  it('leaves form arrow keys and textarea wheel events alone', () => {
    const handlers = new Map<string, EventListener>()
    const track = {
      scrollLeft: 400, clientWidth: 400,
      querySelectorAll: () => Array.from({ length: 3 }, (_, i) => ({ dataset: { index: `0${i}`, label: '' }, style: { setProperty: () => {} } })),
      classList: { add: () => {}, remove: () => {} },
      addEventListener: (name: string, handler: EventListener) => handlers.set(name, handler), removeEventListener: () => {},
    } as unknown as HTMLElement
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {}, setTimeout: () => 1 })
    const controller = createSliderController(track, { reducedMotion: true, announce: () => {} })
    const preventDefault = vi.fn()
    handlers.get('keydown')?.({ key: 'ArrowRight', target: { closest: () => ({}) }, preventDefault } as unknown as Event)
    expect(track.scrollLeft).toBe(400)
    expect(preventDefault).not.toHaveBeenCalled()
    handlers.get('wheel')?.({ deltaY: 30, deltaX: 0, target: { closest: () => ({ scrollTop: 10, scrollHeight: 500, clientHeight: 100 }) }, preventDefault } as unknown as Event)
    expect(track.scrollLeft).toBe(400)
    expect(preventDefault).not.toHaveBeenCalled()
    controller.destroy()
  })
  it('moves through intermediate offsets over a 900ms goTo animation', () => {
    let frame: FrameRequestCallback | undefined
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1 })
    vi.stubGlobal('cancelAnimationFrame', () => { frame = undefined })
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {}, setTimeout: () => 1 })
    const posters = Array.from({ length: 2 }, (_, i) => ({ dataset: { index: `0${i}`, label: `Poster ${i}` }, style: { setProperty: () => {} } }))
    const classes = new Set<string>()
    const track = {
      scrollLeft: 0, clientWidth: 800, querySelectorAll: () => posters,
      classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name) },
      addEventListener: () => {}, removeEventListener: () => {},
    } as unknown as HTMLElement
    const controller = createSliderController(track, { reducedMotion: false, announce: () => {} })
    expect(classes.has('is-controlled')).toBe(true)
    controller.goTo(1)
    now = 225; frame?.(now)
    expect(track.scrollLeft).toBeGreaterThan(0)
    expect(track.scrollLeft).toBeLessThan(800)
    now = 450; frame?.(now)
    expect(track.scrollLeft).toBeGreaterThan(0)
    expect(track.scrollLeft).toBeLessThan(800)
    now = 900; frame?.(now)
    expect(track.scrollLeft).toBe(800)
    controller.destroy()
    expect(classes.has('is-controlled')).toBe(false)
  })
  it('tracks the pointer 1:1 and snaps a held drag, flick, or half-width drag forward', () => {
    let now = 0
    let frame: FrameRequestCallback | undefined
    const handlers = new Map<string, EventListener>()
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1 })
    vi.stubGlobal('cancelAnimationFrame', () => { frame = undefined })
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {}, setTimeout: () => 1 })
    const posters = Array.from({ length: 3 }, (_, i) => ({ dataset: { index: `0${i}`, label: `Poster ${i}` }, style: { setProperty: () => {} } }))
    const track = {
      scrollLeft: 1440, clientWidth: 1440, querySelectorAll: () => posters,
      classList: { add: () => {}, remove: () => {} },
      setPointerCapture: () => {}, hasPointerCapture: () => false,
      addEventListener: (name: string, handler: EventListener) => handlers.set(name, handler), removeEventListener: () => {},
    } as unknown as HTMLElement
    const controller = createSliderController(track, { reducedMotion: false, announce: () => {} })
    const pointer = (type: string, x: number) => handlers.get(type)?.({
      button: 0, pointerType: 'mouse', detail: 1, clientX: x, pointerId: 1,
      target: { closest: () => null }, preventDefault: () => {},
    } as unknown as Event)

    pointer('pointerdown', 500)
    now = 200; pointer('pointermove', 300)
    expect(track.scrollLeft).toBe(1640)
    now = 400; pointer('pointerup', 300)
    now = 1300; frame?.(now)
    expect(track.scrollLeft).toBe(2880)

    controller.goTo(1, { instant: true })
    now = 2000; pointer('pointerdown', 500)
    now = 2040; pointer('pointermove', 480)
    now = 2100; pointer('pointermove', 420)
    expect(track.scrollLeft).toBe(1520)
    pointer('pointerup', 420)
    now = 3000; frame?.(now)
    expect(track.scrollLeft).toBe(2880)

    controller.goTo(1, { instant: true })
    now = 3200; pointer('pointerdown', 500)
    now = 3240; pointer('pointermove', 420)
    now = 3400; pointer('pointerup', 420)
    now = 4300; frame?.(now)
    expect(track.scrollLeft).toBe(1440)

    now = 4500; pointer('pointerdown', 1100)
    now = 4600; pointer('pointermove', 200)
    expect(track.scrollLeft).toBe(2340)
    pointer('pointerup', 200)
    now = 5200; frame?.(now)
    expect(track.scrollLeft).toBe(2880)
    controller.destroy()
  })
  it('follows focus and removes listeners on destroy', () => {
    const listeners = new Map<string, number>()
    const handlers = new Map<string, EventListener>()
    const posters = Array.from({ length: 3 }, (_, index) => ({
      dataset: { index: `0${index}`, label: `Poster ${index}` },
      style: { setProperty: () => {} },
    }))
    const track = {
      scrollLeft: 0,
      clientWidth: 400,
      querySelectorAll: () => posters,
      addEventListener: (type: string, handler: EventListener) => { listeners.set(type, (listeners.get(type) ?? 0) + 1); handlers.set(type, handler) },
      removeEventListener: (type: string) => listeners.set(type, (listeners.get(type) ?? 0) - 1),
    } as unknown as HTMLElement
    const globalListeners = new Map<string, number>()
    vi.stubGlobal('window', {
      addEventListener: (type: string) => globalListeners.set(type, (globalListeners.get(type) ?? 0) + 1),
      removeEventListener: (type: string) => globalListeners.set(type, (globalListeners.get(type) ?? 0) - 1),
      setTimeout: () => 1,
    })
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const announce = vi.fn()
    const controller = createSliderController(track, { reducedMotion: true, announce })
    handlers.get('focusin')?.({ target: { closest: () => posters[2] } } as unknown as Event)
    expect(track.scrollLeft).toBe(800)
    expect(controller.index).toBe(2)
    expect(announce).toHaveBeenCalledWith('02 of 06: Poster 2')
    controller.destroy()
    expect([...listeners.values()].every((count) => count === 0)).toBe(true)
    expect(globalListeners.get('resize')).toBe(0)

    track.scrollLeft = 0
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const wheelController = createSliderController(track, { reducedMotion: true, announce })
    for (let i = 0; i < 50; i++) {
      handlers.get('wheel')?.({ deltaY: 12, deltaX: 0, preventDefault: () => {} } as unknown as Event)
    }
    expect(track.scrollLeft).toBe(400)
    expect(wheelController.index).toBe(1)
    wheelController.destroy()
  })
})
