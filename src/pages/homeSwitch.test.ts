import { beforeEach, describe, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({ states: [] as unknown[], refs: [] as { current: number }[], stateIndex: 0, refIndex: 0 }))
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState(initial: unknown) {
    const index = hooks.stateIndex++
    if (!(index in hooks.states)) hooks.states[index] = initial
    return [hooks.states[index], (next: unknown) => { hooks.states[index] = typeof next === 'function' ? (next as (value: unknown) => unknown)(hooks.states[index]) : next }]
  },
  useRef(initial: number) {
    const index = hooks.refIndex++
    return hooks.refs[index] ??= { current: initial }
  },
}))

import { ScreenSwitch } from './Home'

type Element = { type: string; props: Record<string, any> }
function renderSwitch() {
  hooks.stateIndex = 0
  hooks.refIndex = 0
  const children = (ScreenSwitch() as Element).props.children as Element[]
  return { button: children[1], announcement: children[2] }
}

beforeEach(() => { hooks.states = []; hooks.refs = [] })

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
})
