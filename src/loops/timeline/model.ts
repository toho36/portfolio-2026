import { clamp } from '../../motion'

export const MACHINE_STAGES = [
  'Intake',
  'Align',
  'Process',
  'Output',
] as const

export interface TimelineState {
  progress: number
  laterStageMutated: boolean
}

export const initialTimelineState: TimelineState = {
  progress: 0,
  laterStageMutated: false,
}

export function scrubTimeline(
  state: TimelineState,
  progress: number,
): TimelineState {
  return { ...state, progress: clamp(progress) }
}

export function toggleLaterStage(state: TimelineState): TimelineState {
  return { ...state, laterStageMutated: !state.laterStageMutated }
}

export function timelineIndex(progress: number): number {
  return Math.round(clamp(progress) * (MACHINE_STAGES.length - 1))
}

export function timelineStop(index: number): number {
  return clamp(index, 0, MACHINE_STAGES.length - 1) / (MACHINE_STAGES.length - 1)
}
