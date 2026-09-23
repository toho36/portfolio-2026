import { GOAL_LOOP_STAGES } from '../content/goalLoop'
import {
  MODEL_PLAN_REVISION_LIMIT,
  MODEL_REPAIR_LIMIT,
  type RunModel,
  type RunScenario,
} from './runModel'

export const RUN_SCENARIOS: readonly {
  readonly value: RunScenario
  readonly label: string
}[] = [
  { value: 'clean', label: 'Clean pass' },
  { value: 'plan-gap', label: 'Plan gap' },
  { value: 'check-defect', label: 'Check defect' },
  { value: 'review-finding', label: 'Review finding' },
] as const

export interface RunDescription {
  readonly role: string
  readonly title: string
  readonly detail: string
}

export type RunPlaybackPhase = 'idle' | 'playing' | 'paused' | 'settled' | 'replay'
export type RunPrimaryIntent = 'start' | 'pause' | 'resume' | 'correct' | 'restart' | 'advance'

export function primaryIntent(
  run: RunModel,
  started: boolean,
  stepMode: boolean,
  phase: RunPlaybackPhase,
): RunPrimaryIntent {
  if (!started) return 'start'
  if (!stepMode && (phase === 'playing' || phase === 'replay')) return 'pause'
  if (!stepMode && phase === 'paused') return 'resume'
  if (run.returnFrom !== null) return 'correct'
  if (run.verdict !== 'active') return 'restart'
  if (stepMode) return 'advance'
  return 'resume'
}

function blockedDetail(run: RunModel) {
  if (run.planFault) return 'Plan revision limit reached. The plan gap remains.'
  if (run.fault === 'check') {
    return 'Repair return limit reached. Check still rejects the candidate.'
  }
  if (run.fault === 'review') {
    return 'Repair return limit reached. Review still rejects the candidate.'
  }
  return 'Invalid illustration state. The model failed closed.'
}

export function describeRun(run: RunModel): RunDescription {
  if (run.verdict === 'passed') {
    return {
      role: 'Terminal verdict',
      title: 'PASS',
      detail: 'Every illustrated gate agrees. The candidate is eligible for handoff.',
    }
  }
  if (run.verdict === 'blocked') {
    return { role: 'Terminal verdict', title: 'BLOCK', detail: blockedDetail(run) }
  }
  if (run.returnFrom === 'critique') {
    return {
      role: 'Planner',
      title: 'Critique returned the plan',
      detail: 'The same draft is open for one bounded revision before Build.',
    }
  }
  if (run.returnFrom === 'checks') {
    return {
      role: 'Implementer',
      title: 'Check returned the candidate',
      detail: 'The gauge rejected the same candidate. Repair its open defect or retry unchanged.',
    }
  }
  if (run.returnFrom === 'review') {
    return {
      role: 'Implementer',
      title: 'Review returned the candidate',
      detail: 'Independent review found a mismatch. The affected layer is open for repair.',
    }
  }

  const stage = GOAL_LOOP_STAGES[run.stage] ?? GOAL_LOOP_STAGES[5]
  return {
    role: stage.role,
    title: stage.label,
    detail: stage.decision,
  }
}

export function repairBudgetText(run: RunModel) {
  return `Repair returns left: ${Math.max(0, MODEL_REPAIR_LIMIT - run.repairs)}`
}

export const RUN_BOUND_TEXT =
  `Plan revision limit: ${MODEL_PLAN_REVISION_LIMIT}. Repair return limit: ${MODEL_REPAIR_LIMIT}. Illustration only.`
