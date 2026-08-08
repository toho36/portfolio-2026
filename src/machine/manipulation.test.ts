import { describe, expect, it, vi } from 'vitest'
import {
  decideManipulationIntent,
  dispatchManipulationOutcome,
  type ManipulationIntent,
} from './manipulation'
import type { MachineAction } from './runtime'

describe('manipulation intent arbitration', () => {
  it('accepts mouse and pen drag at eight CSS pixels of Euclidean movement', () => {
    for (const pointerType of ['mouse', 'pen'] as const) {
      expect(
        decideManipulationIntent(pointerType, { x: 4.8, y: 6.39 }),
      ).toBe('undecided')
      expect(decideManipulationIntent(pointerType, { x: 4.8, y: 6.4 })).toBe(
        'drag',
      )
    }
  })

  it('keeps touch undecided below the inclusive distance and axis thresholds', () => {
    expect(decideManipulationIntent('touch', { x: 7.99, y: 0 })).toBe(
      'undecided',
    )
    expect(decideManipulationIntent('touch', { x: 8, y: 6.41 })).toBe(
      'undecided',
    )
    expect(decideManipulationIntent('touch', { x: 7.99, y: 7.99 })).toBe(
      'undecided',
    )
  })

  it('accepts horizontal touch drag at the inclusive 8px and 1.25 axis boundary', () => {
    expect(decideManipulationIntent('touch', { x: 8, y: 6.4 })).toBe('drag')
    expect(decideManipulationIntent('touch', { x: -10, y: 8 })).toBe('drag')
  })

  it('yields permanently when vertical touch movement wins at eight pixels', () => {
    const yielded = decideManipulationIntent('touch', { x: 6.4, y: 8 })
    expect(yielded).toBe('document-scroll')
    expect(
      decideManipulationIntent('touch', { x: 40, y: 8 }, yielded),
    ).toBe('document-scroll')
  })

  it('keeps accepted drag intent permanently', () => {
    const accepted: ManipulationIntent = decideManipulationIntent(
      'touch',
      { x: 8, y: 0 },
    )
    expect(decideManipulationIntent('touch', { x: 0, y: 40 }, accepted)).toBe(
      'drag',
    )
  })
})

describe('terminal manipulation dispatch', () => {
  it('dispatches the final point before releasing a drag', () => {
    const dispatch = vi.fn<(action: MachineAction) => void>()

    dispatchManipulationOutcome(dispatch, {
      type: 'drag',
      point: { x: 0.72, y: 0.48 },
    })

    expect(dispatch.mock.calls).toEqual([
      [{ type: 'move-module', point: { x: 0.72, y: 0.48 } }],
      [{ type: 'pointer-release', gesture: 'drag' }],
    ])
  })

  it('dispatches only one release action for tap and cancel', () => {
    for (const type of ['tap', 'cancel'] as const) {
      const dispatch = vi.fn<(action: MachineAction) => void>()

      dispatchManipulationOutcome(dispatch, { type })

      expect(dispatch.mock.calls).toEqual([
        [{ type: 'pointer-release', gesture: type }],
      ])
    }
  })
})
