import {
  GOAL_LOOP_HISTORY,
  type GoalLoopHistoryMetric,
} from './goalLoopHistory.generated'

export type GoalLoopStageId =
  | 'plan'
  | 'critique'
  | 'implementation'
  | 'checks'
  | 'review'
  | 'outcome'

export interface GoalLoopStage {
  readonly id: GoalLoopStageId
  readonly label: string
  readonly role: string
  readonly marker: string
  readonly input: string
  readonly decision: string
  readonly evidence: string
  readonly stop: string
}

export interface GoalLoopRevision {
  readonly afterStage: GoalLoopStageId
  readonly label: string
  readonly body: string
}

export const GOAL_LOOP_STAGES: readonly GoalLoopStage[] = [
  {
    id: 'plan',
    label: 'Plan',
    role: 'Planner',
    marker: 'Bounded',
    input:
      'A scoped software goal, explicit constraints, authorized files and named checks.',
    decision:
      'Turn the requested outcome into a finite implementation path with acceptance evidence.',
    evidence:
      'A reviewable plan connects each acceptance claim to a source change or a later check.',
    stop:
      'Do not begin implementation while scope, dependencies or proof remain ambiguous.',
  },
  {
    id: 'critique',
    label: 'Independent critique',
    role: 'Independent critic',
    marker: 'Independent',
    input:
      'The plan, repository constraints and acceptance evidence map.',
    decision:
      'Challenge missing cases, weak proof and unsafe shortcuts before product code changes.',
    evidence:
      'Concrete corrections name the affected seam and the evidence needed to close it.',
    stop:
      'Return the plan for revision when a material gap is found; block if the gap cannot be bounded.',
  },
  {
    id: 'implementation',
    label: 'Implementation',
    role: 'Implementer',
    marker: 'Isolated',
    input:
      'An admitted plan, the current checkout and a literal repair surface.',
    decision:
      'Make the smallest cohesive change that satisfies the goal and inherited invariants.',
    evidence:
      'The candidate diff, focused assertions and unchanged sibling contracts show what moved.',
    stop:
      'Stop on out-of-scope work, protected state, missing authority or an unrecoverable conflict.',
  },
  {
    id: 'checks',
    label: 'Deterministic checks',
    role: 'Deterministic check suite',
    marker: 'Repeatable',
    input:
      'The isolated candidate and the project checks declared before implementation.',
    decision:
      'Accept only reproducible evidence from tests, type analysis, build integrity and diff hygiene.',
    evidence:
      'Recorded check exits establish whether the candidate meets the declared mechanical gates.',
    stop:
      'Any failing check rejects the candidate and returns the defect to implementation within the revision bound.',
  },
  {
    id: 'review',
    label: 'Independent review',
    role: 'Independent reviewer',
    marker: 'Evidence-led',
    input:
      'The candidate diff, check evidence, goal and preserved invariants.',
    decision:
      'Judge correctness, scope, accessibility and proof without inheriting the implementer conclusion.',
    evidence:
      'A pass or a specific finding ties the verdict back to the code and acceptance contract.',
    stop:
      'A material finding returns to implementation; repeated unchanged evidence blocks the run.',
  },
  {
    id: 'outcome',
    label: 'Pass or block',
    role: 'Stop gate',
    marker: 'Fail closed',
    input:
      'Check exits, review verdict, revision history and the original delivery boundary.',
    decision:
      'Pass only when every gate agrees; otherwise preserve the work as evidence and block delivery.',
    evidence:
      'The final state records why the candidate is eligible for handoff or why no candidate was applied.',
    stop:
      'The run ends at a verified pass, an exhausted revision bound or a blocker requiring new authority.',
  },
] as const

export const GOAL_LOOP_REVISIONS: readonly GoalLoopRevision[] = [
  {
    afterStage: 'critique',
    label: 'Loops back to plan',
    body:
      'A material critique revises the plan. The loop is capped, and repeating the same evidence stops the run.',
  },
  {
    afterStage: 'checks',
    label: 'Loops back to implementation',
    body:
      'A failing deterministic gate returns the defect to implementation without weakening the check.',
  },
  {
    afterStage: 'review',
    label: 'Loops back to implementation',
    body:
      'A material review finding gets a focused repair and another check; unchanged evidence blocks further cycling.',
  },
] as const

export const GOAL_LOOP_BLOCKED = {
  label: 'BLOCKED',
  title: 'A boundary conflict stopped the run.',
  body:
    'One launch declared an immutable oracle boundary that collided with the run-authored tests it authorized. The run stopped before checks, no candidate was applied, and the checkout stayed clean. The launch boundary was corrected before another attempt.',
} as const

export const GOAL_LOOP_OUTCOMES = {
  pass: {
    label: 'PASS',
    title: 'Evidence agrees inside the boundary.',
    body:
      'Declared checks pass, independent review finds no material gap, and the candidate remains inside scope. Only then is it eligible for handoff.',
  },
  blocked: GOAL_LOOP_BLOCKED,
} as const

export { GOAL_LOOP_HISTORY }

export const GOAL_LOOP_HISTORY_PRESENTATION = {
  eyebrow: 'Audited history',
  lede:
    'Each comparison uses its own conservative before value as the baseline. The fixed marker identifies the measured after boundary.',
} as const

function historyUnit(metric: GoalLoopHistoryMetric) {
  return metric.unit === 'seconds' ? 's' : metric.unit
}

function historyValue(value: number) {
  return value.toLocaleString('en-US')
}

export function historyTrackPercent(metric: GoalLoopHistoryMetric) {
  const percent = (metric.after / metric.before) * 100

  return Math.round(percent * 10_000) / 10_000
}

export function historyBeforeText(metric: GoalLoopHistoryMetric) {
  const before = historyValue(metric.before)
  const range = metric.beforeMax
    ? `${before}–${historyValue(metric.beforeMax)}`
    : before

  return `${range} ${historyUnit(metric)}`
}

export function historyAfterText(metric: GoalLoopHistoryMetric) {
  return `${historyValue(metric.after)} ${historyUnit(metric)}`
}

export function historyReductionText(metric: GoalLoopHistoryMetric) {
  const prefix = metric.lowerBound ? 'at least ' : ''
  const comparison = metric.unit === 'calls' ? 'fewer' : 'less wait'

  return `${prefix}${historyValue(metric.reductionPercent)}% ${comparison}`
}

export const GOAL_LOOP = {
  hero: {
    eyebrow: 'Goal Loop / Run anatomy',
    title: 'Software delivery, run as a bounded system.',
    lede:
      'Goal Loop turns a software goal into a bounded delivery run with separated roles, explicit evidence and a stop condition.',
  },
  problem: {
    eyebrow: 'The delivery problem',
    title: 'A plausible change is not the same as a dependable delivery.',
    body:
      'Software work can look complete while missing a constraint, weakening proof or crossing its authority. Goal Loop makes those boundaries inspectable before anything is handed off.',
  },
  bounds: {
    eyebrow: 'How it stays bounded',
    title: 'Roles separate. Evidence accumulates. Stops stay real.',
    body:
      'Planning, critique, implementation and review have different responsibilities. Work happens in isolation, revisions are finite, checks stay deterministic, and unresolved risk fails closed.',
  },
  tape: {
    eyebrow: 'One bounded run',
    title: 'Every stage has an input, a decision, evidence and a stop.',
    body:
      'The trace shows the intended path and its loop-backs. The ordered stages remain the complete account without motion or illustration.',
  },
  optimization: {
    eyebrow: 'Measured optimization',
    title: 'Improve latency, cost and reliability as one system.',
    body:
      'Stage wall-clock duration, retry count, review iterations, cost per run and block rate show where delivery spends time and where confidence breaks. Those measurements guide cheaper routing for simpler stages, shorter idle retries and earlier fail-closed decisions. The aim is dependable throughput, not token-count theater.',
  },
  boundary: {
    eyebrow: 'Evidence boundary',
    title: 'Claims stop where maintained evidence stops.',
    body:
      'This anatomy describes public system behaviour and one sanitized failure class. It exposes no private prompts, credentials, model output, secrets or internal run artifacts.',
  },
  status: {
    eyebrow: 'Current status',
    title: 'A delivery control system, presented as a case study.',
    body:
      'The page explains the operating design and the kinds of evidence it judges. It is not a live control surface and does not present invented telemetry or benchmark results.',
  },
  stages: GOAL_LOOP_STAGES,
  revisions: GOAL_LOOP_REVISIONS,
  outcomes: GOAL_LOOP_OUTCOMES,
} as const
