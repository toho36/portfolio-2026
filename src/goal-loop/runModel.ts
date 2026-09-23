export type RunScenario =
  | 'clean'
  | 'plan-gap'
  | 'check-defect'
  | 'review-finding'
  | 'full-story'

export type RunFault = 'none' | 'check' | 'review'
export type RunReturnSource = null | 'critique' | 'checks' | 'review'

export interface RunModel {
  readonly stage: number
  readonly repairs: number
  readonly planRevisions: number
  readonly fault: RunFault
  readonly nextFault: RunFault
  readonly planFault: boolean
  readonly returnFrom: RunReturnSource
  readonly verdict: 'active' | 'passed' | 'blocked'
}

export type RunAction =
  | { readonly type: 'next' | 'repair' | 'revise' }
  | { readonly type: 'reset'; readonly scenario: RunScenario }

// These bounds belong to the illustration, not an operational runner.
export const MODEL_REPAIR_LIMIT = 2
export const MODEL_PLAN_REVISION_LIMIT = 1

export function createInitialRun(scenario: RunScenario): RunModel {
  return {
    stage: 0,
    repairs: 0,
    planRevisions: 0,
    fault:
      scenario === 'check-defect' || scenario === 'full-story'
        ? 'check'
        : scenario === 'review-finding'
          ? 'review'
          : 'none',
    nextFault: scenario === 'full-story' ? 'review' : 'none',
    planFault: scenario === 'plan-gap' || scenario === 'full-story',
    returnFrom: null,
    verdict: 'active',
  }
}

export const INITIAL_RUN: RunModel = Object.freeze(
  createInitialRun('check-defect'),
)

function block(state: RunModel): RunModel {
  return { ...state, stage: 5, returnFrom: null, verdict: 'blocked' }
}

function forward(state: RunModel, stage: number): RunModel {
  return { ...state, stage, returnFrom: null }
}

export function stepRun(state: RunModel, action: RunAction): RunModel {
  if (action.type === 'reset') return createInitialRun(action.scenario)
  if (state.verdict !== 'active') return state

  if (action.type === 'revise') {
    if (state.stage !== 0 || !state.planFault) return state
    return { ...state, planFault: false, returnFrom: null }
  }

  if (action.type === 'repair') {
    if (state.stage !== 2 || state.fault === 'none') return state
    return { ...state, fault: state.nextFault, nextFault: 'none', returnFrom: null }
  }

  if (action.type !== 'next') return state
  if (!Number.isInteger(state.stage) || state.stage < 0 || state.stage > 4) {
    return block(state)
  }

  if (state.stage === 0) return forward(state, 1)

  if (state.stage === 1) {
    if (!state.planFault) return forward(state, 2)
    if (state.planRevisions >= MODEL_PLAN_REVISION_LIMIT) return block(state)
    return {
      ...state,
      stage: 0,
      planRevisions: state.planRevisions + 1,
      returnFrom: 'critique',
    }
  }

  if (state.stage === 2) return forward(state, 3)

  if (state.stage === 3) {
    if (state.planFault) return block(state)
    if (state.fault !== 'check') return forward(state, 4)
    if (state.repairs >= MODEL_REPAIR_LIMIT) return block(state)
    return {
      ...state,
      stage: 2,
      repairs: state.repairs + 1,
      returnFrom: 'checks',
    }
  }

  if (state.planFault || state.fault === 'check') return block(state)
  if (state.fault === 'review') {
    if (state.repairs >= MODEL_REPAIR_LIMIT) return block(state)
    return {
      ...state,
      stage: 2,
      repairs: state.repairs + 1,
      returnFrom: 'review',
    }
  }

  return { ...state, stage: 5, returnFrom: null, verdict: 'passed' }
}
