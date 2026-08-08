import type { Point } from '../loops/assembly/model'
import {
  decideManipulationIntent,
  type ManipulationIntent,
  type ManipulationOutcome,
  type ManipulationPointerType,
} from './manipulation'
import { clampAssemblyPoint, type ClientPoint } from './cartridgeProjection'

export interface PlanePoint {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface CartridgeGesture {
  readonly pointerId: number
  readonly pointerType: ManipulationPointerType
  readonly startClient: ClientPoint
  readonly committedPoint: Point
  readonly downPlaneHit: PlanePoint
  readonly grabOffset: PlanePoint
  readonly visiblePoint: Point
  readonly intent: ManipulationIntent
}

export interface BeginCartridgeGestureInput {
  readonly pointerId: number
  readonly pointerType: ManipulationPointerType
  readonly startClient: ClientPoint
  readonly committedPoint: Point
  readonly downPlaneHit: PlanePoint
  readonly grabOffset: PlanePoint
}

export interface MoveCartridgeGestureResult {
  readonly gesture: CartridgeGesture
  readonly handled: boolean
  readonly capture: boolean
  readonly preventDefault: boolean
  readonly updateVisual: boolean
  readonly yielded: boolean
}

export interface TerminateCartridgeGestureResult {
  readonly gesture: null
  readonly handled: boolean
  readonly outcome: ManipulationOutcome | null
  readonly restorePoint: Point | null
}

export function assemblyPointForIdleReconciliation(
  gesture: CartridgeGesture | null,
  assemblyPoint: Point,
): Point | null {
  return gesture ? null : { ...assemblyPoint }
}

export function assemblyPointAfterGestureTermination(
  result: TerminateCartridgeGestureResult,
  committedPoint: Point,
  seated: boolean,
): Point | null {
  if (!result.handled) return null
  if (result.restorePoint) return { ...result.restorePoint }
  if (result.outcome?.type === 'drag' && !seated) return null
  return { ...committedPoint }
}

export function beginCartridgeGesture({
  pointerId,
  pointerType,
  startClient,
  committedPoint,
  downPlaneHit,
  grabOffset,
}: BeginCartridgeGestureInput): CartridgeGesture {
  return {
    pointerId,
    pointerType,
    startClient: { ...startClient },
    committedPoint: { ...committedPoint },
    downPlaneHit: { ...downPlaneHit },
    grabOffset: { ...grabOffset },
    visiblePoint: { ...committedPoint },
    intent: 'undecided',
  }
}

export function moveCartridgeGesture(
  gesture: CartridgeGesture,
  pointerId: number,
  client: ClientPoint,
  projectedPoint: Point | null,
): MoveCartridgeGestureResult {
  if (pointerId !== gesture.pointerId) {
    return {
      gesture,
      handled: false,
      capture: false,
      preventDefault: false,
      updateVisual: false,
      yielded: false,
    }
  }

  const nextIntent = decideManipulationIntent(
    gesture.pointerType,
    {
      x: client.x - gesture.startClient.x,
      y: client.y - gesture.startClient.y,
    },
    gesture.intent,
  )
  const acceptedNow =
    gesture.intent === 'undecided' && nextIntent === 'drag'
  const nextPoint =
    nextIntent === 'drag' && projectedPoint
      ? clampAssemblyPoint(projectedPoint)
      : gesture.visiblePoint
  const nextGesture = {
    ...gesture,
    intent: nextIntent,
    visiblePoint: nextPoint,
  }

  return {
    gesture: nextGesture,
    handled: true,
    capture: acceptedNow,
    preventDefault: nextIntent === 'drag',
    updateVisual: nextIntent === 'drag' && projectedPoint !== null,
    yielded: nextIntent === 'document-scroll',
  }
}

export function terminateCartridgeGesture(
  gesture: CartridgeGesture | null,
  pointerId: number,
  reason: 'up' | 'cancel' | 'lost-capture',
): TerminateCartridgeGestureResult {
  if (!gesture || pointerId !== gesture.pointerId) {
    return {
      gesture: null,
      handled: false,
      outcome: null,
      restorePoint: null,
    }
  }

  if (gesture.intent === 'document-scroll') {
    return {
      gesture: null,
      handled: true,
      outcome: null,
      restorePoint: null,
    }
  }

  if (reason !== 'up') {
    return {
      gesture: null,
      handled: true,
      outcome: { type: 'cancel' },
      restorePoint: gesture.committedPoint,
    }
  }

  return gesture.intent === 'drag'
    ? {
        gesture: null,
        handled: true,
        outcome: { type: 'drag', point: gesture.visiblePoint },
        restorePoint: null,
      }
    : {
        gesture: null,
        handled: true,
        outcome: { type: 'tap' },
        restorePoint: null,
      }
}
