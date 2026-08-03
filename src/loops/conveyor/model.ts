import { clamp } from '../../motion'

export const CARTRIDGES = [
  'GameOnVB',
  'Suburbs',
  'Screen Switch',
  'VoleyEvents',
] as const

export interface ConveyorState {
  progress: number
}

export function scrubConveyor(
  state: ConveyorState,
  progress: number,
): ConveyorState {
  return { ...state, progress: clamp(progress) }
}

export function conveyorIndex(progress: number): number {
  return Math.round(clamp(progress) * (CARTRIDGES.length - 1))
}

export function conveyorStop(index: number): number {
  return clamp(index, 0, CARTRIDGES.length - 1) / (CARTRIDGES.length - 1)
}
