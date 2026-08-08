import { describe, expect, it } from 'vitest'
import {
  initialAssemblyState,
  moveModule,
  releaseModule,
} from '../loops/assembly/model'
import {
  assemblyPointAfterGestureTermination,
  assemblyPointForIdleReconciliation,
  beginCartridgeGesture,
  moveCartridgeGesture,
  terminateCartridgeGesture,
  type CartridgeGesture,
} from './cartridgeGesture'

function begin(pointerType: 'mouse' | 'touch' = 'mouse'): CartridgeGesture {
  return beginCartridgeGesture({
    pointerId: 17,
    pointerType,
    startClient: { x: 100, y: 200 },
    committedPoint: { x: 0.12, y: 0.5 },
    downPlaneHit: { x: -0.9, y: 0.05, z: 1.06 },
    grabOffset: { x: 0.08, y: -0.03, z: 0 },
  })
}

describe('cartridge gesture state', () => {
  it('freezes pointer identity, start state, plane hit, and grab offset', () => {
    const gesture = begin()
    expect(gesture).toMatchObject({
      pointerId: 17,
      startClient: { x: 100, y: 200 },
      committedPoint: { x: 0.12, y: 0.5 },
      downPlaneHit: { x: -0.9, y: 0.05, z: 1.06 },
      grabOffset: { x: 0.08, y: -0.03, z: 0 },
      visiblePoint: { x: 0.12, y: 0.5 },
      intent: 'undecided',
    })
  })

  it('does not capture, prevent, or move before the frozen 8px intent threshold', () => {
    const result = moveCartridgeGesture(
      begin(),
      17,
      { x: 107.99, y: 200 },
      { x: 0.5, y: 0.5 },
    )
    expect(result).toMatchObject({
      capture: false,
      preventDefault: false,
      updateVisual: false,
      yielded: false,
    })
    expect(result.gesture.visiblePoint).toEqual({ x: 0.12, y: 0.5 })
  })

  it('accepts horizontal touch only at the 8px/1.25-axis boundary', () => {
    const gesture = {
      ...begin('touch'),
      startClient: { x: 0, y: 0 },
    }
    const result = moveCartridgeGesture(
      gesture,
      17,
      { x: 8, y: 6.4 },
      { x: 0.42, y: 0.58 },
    )
    expect(result).toMatchObject({
      capture: true,
      preventDefault: true,
      updateVisual: true,
      yielded: false,
    })
    expect(result.gesture.visiblePoint).toEqual({ x: 0.42, y: 0.58 })
  })

  it('permanently yields vertical touch to ordinary document scrolling', () => {
    const yielded = moveCartridgeGesture(
      begin('touch'),
      17,
      { x: 106.4, y: 208 },
      { x: 0.4, y: 0.4 },
    )
    expect(yielded).toMatchObject({
      capture: false,
      preventDefault: false,
      updateVisual: false,
      yielded: true,
    })

    const later = moveCartridgeGesture(
      yielded.gesture,
      17,
      { x: 150, y: 209 },
      { x: 0.8, y: 0.5 },
    )
    expect(later).toMatchObject({
      capture: false,
      preventDefault: false,
      updateVisual: false,
      yielded: true,
    })
    expect(terminateCartridgeGesture(later.gesture, 17, 'up').outcome).toBeNull()
    expect(
      terminateCartridgeGesture(later.gesture, 17, 'cancel').outcome,
    ).toBeNull()
  })

  it('ignores secondary pointer movement and termination', () => {
    const gesture = begin()
    expect(
      moveCartridgeGesture(
        gesture,
        23,
        { x: 140, y: 200 },
        { x: 0.9, y: 0.5 },
      ),
    ).toMatchObject({ gesture, handled: false })
    expect(terminateCartridgeGesture(gesture, 23, 'up')).toMatchObject({
      handled: false,
      outcome: null,
    })
  })

  it('clamps visual drag bounds and emits exactly its final normalized point', () => {
    const moved = moveCartridgeGesture(
      begin(),
      17,
      { x: 108, y: 200 },
      { x: 1.8, y: -0.4 },
    )
    expect(moved.gesture.visiblePoint).toEqual({ x: 1, y: 0 })
    expect(terminateCartridgeGesture(moved.gesture, 17, 'up')).toMatchObject({
      outcome: { type: 'drag', point: { x: 1, y: 0 } },
    })
  })

  it('restores the pre-gesture point and emits cancel for cancel or capture loss', () => {
    for (const reason of ['cancel', 'lost-capture'] as const) {
      const moved = moveCartridgeGesture(
        begin(),
        17,
        { x: 110, y: 200 },
        { x: 0.6, y: 0.2 },
      )
      expect(terminateCartridgeGesture(moved.gesture, 17, reason)).toMatchObject(
        {
          gesture: null,
          outcome: { type: 'cancel' },
          restorePoint: { x: 0.12, y: 0.5 },
        },
      )
    }
  })

  it('proves canonical snap hit and miss from terminal drag points', () => {
    const hit = moveCartridgeGesture(
      begin(),
      17,
      { x: 110, y: 200 },
      { x: 0.68, y: 0.65 },
    )
    const hitOutcome = terminateCartridgeGesture(hit.gesture, 17, 'up').outcome
    expect(hitOutcome?.type).toBe('drag')
    if (hitOutcome?.type === 'drag') {
      expect(
        releaseModule(moveModule(initialAssemblyState, hitOutcome.point)),
      ).toMatchObject({
        x: 0.78,
        y: 0.5,
        seated: true,
      })
    }

    const miss = moveCartridgeGesture(
      begin(),
      17,
      { x: 110, y: 200 },
      { x: 0.679, y: 0.5 },
    )
    const missOutcome = terminateCartridgeGesture(
      miss.gesture,
      17,
      'up',
    ).outcome
    expect(missOutcome?.type).toBe('drag')
    if (missOutcome?.type === 'drag') {
      expect(
        releaseModule(moveModule(initialAssemblyState, missOutcome.point)),
      ).toMatchObject({ x: 0.679, y: 0.5, seated: false })
    }
  })

  it('suppresses tap after drag/cancel and makes terminal permutations idempotent', () => {
    const moved = moveCartridgeGesture(
      begin(),
      17,
      { x: 108, y: 200 },
      { x: 0.5, y: 0.5 },
    )
    const drag = terminateCartridgeGesture(moved.gesture, 17, 'up')
    expect(drag.outcome?.type).toBe('drag')
    expect(
      terminateCartridgeGesture(drag.gesture, 17, 'lost-capture'),
    ).toMatchObject({
      handled: false,
      outcome: null,
    })

    const cancelled = terminateCartridgeGesture(begin(), 17, 'cancel')
    expect(cancelled.outcome?.type).toBe('cancel')
    expect(terminateCartridgeGesture(cancelled.gesture, 17, 'up').outcome).toBeNull()
  })

  it('emits tap only for an undecided active pointer release', () => {
    expect(terminateCartridgeGesture(begin(), 17, 'up').outcome).toEqual({
      type: 'tap',
    })
  })

  it('reconciles assembly changes while idle without disturbing an active drag', () => {
    const keyboardPoint = { x: 0.35, y: 0.25 }
    expect(assemblyPointForIdleReconciliation(null, keyboardPoint)).toEqual(
      keyboardPoint,
    )

    const moved = moveCartridgeGesture(
      begin(),
      17,
      { x: 110, y: 200 },
      { x: 0.6, y: 0.2 },
    ).gesture
    expect(assemblyPointForIdleReconciliation(moved, keyboardPoint)).toBeNull()
    expect(moved).toMatchObject({
      committedPoint: { x: 0.12, y: 0.5 },
      visiblePoint: { x: 0.6, y: 0.2 },
    })

    const drag = terminateCartridgeGesture(moved, 17, 'up')
    expect(
      assemblyPointAfterGestureTermination(drag, keyboardPoint, false),
    ).toBeNull()
    expect(
      assemblyPointAfterGestureTermination(drag, keyboardPoint, true),
    ).toEqual(keyboardPoint)
  })

  it('restores the frozen pre-gesture point when props change before cancellation', () => {
    const moved = moveCartridgeGesture(
      begin(),
      17,
      { x: 110, y: 200 },
      { x: 0.6, y: 0.2 },
    ).gesture
    const latestCommittedPoint = { x: 0.42, y: 0.74 }
    expect(
      assemblyPointForIdleReconciliation(moved, latestCommittedPoint),
    ).toBeNull()

    for (const reason of ['cancel', 'lost-capture'] as const) {
      const cancelled = terminateCartridgeGesture(moved, 17, reason)
      expect(cancelled.restorePoint).toEqual({ x: 0.12, y: 0.5 })
      expect(
        assemblyPointAfterGestureTermination(
          cancelled,
          latestCommittedPoint,
          false,
        ),
      ).toEqual({ x: 0.12, y: 0.5 })
    }
  })
})
