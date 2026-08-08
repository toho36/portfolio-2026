import type { Point } from '../loops/assembly/model'
import type { MachineAction } from './runtime'

export type ManipulationPointerType = 'mouse' | 'pen' | 'touch'
export type ManipulationIntent = 'undecided' | 'drag' | 'document-scroll'

export type ManipulationOutcome =
  | { readonly type: 'tap' }
  | { readonly type: 'drag'; readonly point: Point }
  | { readonly type: 'cancel' }

export type ManipulationTerminalCallback = (
  outcome: ManipulationOutcome,
) => void

type MachineDispatch = (action: MachineAction) => void

const DRAG_THRESHOLD = 8
const DRAG_THRESHOLD_SQUARED = DRAG_THRESHOLD * DRAG_THRESHOLD
const TOUCH_AXIS_RATIO = 1.25

export function decideManipulationIntent(
  pointerType: ManipulationPointerType,
  delta: Point,
  currentIntent: ManipulationIntent = 'undecided',
): ManipulationIntent {
  if (currentIntent !== 'undecided') return currentIntent

  const absX = Math.abs(delta.x)
  const absY = Math.abs(delta.y)

  if (pointerType === 'touch') {
    if (absX >= DRAG_THRESHOLD && absX >= TOUCH_AXIS_RATIO * absY) {
      return 'drag'
    }
    if (absY >= DRAG_THRESHOLD) return 'document-scroll'
    return 'undecided'
  }

  return delta.x * delta.x + delta.y * delta.y >= DRAG_THRESHOLD_SQUARED
    ? 'drag'
    : 'undecided'
}

export function dispatchManipulationOutcome(
  dispatch: MachineDispatch,
  outcome: ManipulationOutcome,
): void {
  if (outcome.type === 'drag') {
    dispatch({ type: 'move-module', point: outcome.point })
    dispatch({ type: 'pointer-release', gesture: 'drag' })
    return
  }

  dispatch({ type: 'pointer-release', gesture: outcome.type })
}
