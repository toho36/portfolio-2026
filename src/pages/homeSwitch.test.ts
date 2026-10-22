import { beforeEach, describe, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({ states: [] as unknown[], refs: [] as { current: unknown }[], effects: [] as (() => void | (() => void))[], stateIndex: 0, refIndex: 0 }))
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState(initial: unknown) {
    const index = hooks.stateIndex++
    if (!(index in hooks.states)) hooks.states[index] = initial
    return [hooks.states[index], (next: unknown) => { hooks.states[index] = typeof next === 'function' ? (next as (value: unknown) => unknown)(hooks.states[index]) : next }]
  },
  useEffect(effect: () => void | (() => void)) { hooks.effects.push(effect) },
  useRef(initial: unknown) {
    const index = hooks.refIndex++
    return hooks.refs[index] ??= { current: initial }
  },
}))

import { ScreenSwitch } from './Home'

type Element = { type: string; props: Record<string, any> }
function renderSwitch(props: { autoSwap?: boolean } = {}) {
  hooks.stateIndex = 0
  hooks.refIndex = 0
  hooks.effects = []
  const root = ScreenSwitch(props) as Element, children = root.props.children as Element[]
  return { root, button: children[1], announcement: children[2] }
}

beforeEach(() => { hooks.states = []; hooks.refs = []; hooks.effects = [] })

describe('Screen Switch interaction', () => {
  it('toggles window placement and announcement on repeated clicks', () => {
    let { button } = renderSwitch()
    expect(button.props['aria-pressed']).toBe(false)
    button.props.onClick({ detail: 1, preventDefault: vi.fn() })
    let result = renderSwitch()
    expect(result.button.props['aria-pressed']).toBe(true)
    expect(result.announcement.props.children).toContain('Window A on the right display')
    result.button.props.onClick({ detail: 1, preventDefault: vi.fn() })
    result = renderSwitch()
    expect(result.button.props['aria-pressed']).toBe(false)
    expect(result.announcement.props.children).toContain('Window A on the left display')
  })

  it('uses native Enter/Space button activation and ignores a pointer drag', () => {
    let { button } = renderSwitch()
    expect(button.type).toBe('button')
    expect(button.props.type).toBe('button')
    expect(button.props.onKeyDown).toBeUndefined()
    button.props.onClick({ detail: 0, preventDefault: vi.fn() }) // Native buttons emit detail 0 for keyboard activation.
    button = renderSwitch().button
    expect(button.props['aria-pressed']).toBe(true)
    button.props.onPointerDown({ clientX: 100 })
    button.props.onPointerMove({ clientX: 50, buttons: 1 })
    button.props.onPointerUp({ clientX: 50 })
    const preventDefault = vi.fn()
    button.props.onClick({ detail: 1, preventDefault })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(renderSwitch().button.props['aria-pressed']).toBe(true)
  })

  it.each([false, true])('on the homepage it demonstrates itself once in view (reduced motion: %s)', (reducedMotion) => {
    vi.useFakeTimers()
    let seen: (entries: { isIntersecting: boolean }[]) => void = () => {}
    vi.stubGlobal('IntersectionObserver', class { constructor(cb: typeof seen) { seen = cb } observe() {} disconnect() {} })
    vi.stubGlobal('matchMedia', () => ({ matches: reducedMotion }))
    try {
      renderSwitch({ autoSwap: true })
      hooks.refs[2].current = {} // the mounted root element
      hooks.effects.forEach(effect => effect())
      seen([{ isIntersecting: true }])
      vi.advanceTimersByTime(400)
      const { root, button } = renderSwitch({ autoSwap: true })
      expect(button.props['aria-pressed']).toBe(true)
      // Motion: data-touched turns the swap animation on. Reduced motion: settled, no animation.
      expect(root.props['data-touched']).toBe(!reducedMotion)
    } finally { vi.useRealTimers(); vi.unstubAllGlobals() }
  })
})
