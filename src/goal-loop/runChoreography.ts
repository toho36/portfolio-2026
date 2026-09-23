import { stepRun, type RunModel } from './runModel'

export const RUN_STAGE_DURATIONS = [500, 600, 650, 650, 750, 700] as const
export const RUN_RETURN_DURATION = 620

export function runToDecision(initial: RunModel): readonly RunModel[] {
  const path: RunModel[] = []
  let state = initial

  for (let index = 0; index < 16; index += 1) {
    if (state.verdict !== 'active' || state.returnFrom !== null) break
    const next = stepRun(state, { type: 'next' })
    if (next === state) break
    path.push(next)
    state = next
  }

  return path
}

export function retryUnchangedToDecision(initial: RunModel): readonly RunModel[] {
  if (initial.verdict !== 'active' || initial.returnFrom === null) return []
  const first = stepRun(initial, { type: 'next' })
  if (first === initial) return []
  return [first, ...runToDecision(first)]
}

export function transitionDuration(from: RunModel, to: RunModel) {
  if (to.returnFrom !== null) return RUN_RETURN_DURATION
  if (to.verdict === 'blocked') return 300
  return RUN_STAGE_DURATIONS[Math.max(from.stage, to.stage)] ?? 650
}
