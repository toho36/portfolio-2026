import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { INITIAL_RUN, MODEL_REPAIR_LIMIT, stepRun, type RunAction, type RunModel } from './goal-loop/runModel'
import { GoalLoopPage } from './pages/GoalLoop'

// Controller-authored before implementation; immutable to the Goal Loop writer.
// This grades domain truth and initial HTML, not rendered motion or visual quality.
const reset = (scenario: 'clean' | 'plan-gap' | 'check-defect' | 'review-finding') =>
  stepRun(INITIAL_RUN, { type: 'reset', scenario })

function next(state: RunModel, count = 1) {
  for (let index = 0; index < count; index += 1) state = stepRun(state, { type: 'next' })
  return state
}

function finishUnchanged(state: RunModel) {
  for (let index = 0; index < 24 && state.verdict === 'active'; index += 1) state = next(state)
  expect(state.verdict).not.toBe('active')
  return state
}

function terminalIsAbsorbing(state: RunModel) {
  for (const action of [
    { type: 'next' }, { type: 'repair' }, { type: 'revise' },
    { type: 'back' }, { type: 'fault', value: false },
  ]) {
    expect(stepRun(state, action as RunAction)).toBe(state)
  }
}

describe('independent Goal Loop delivery contract', () => {
  it('initializes each explicit illustration through reset with fresh budgets', () => {
    expect(MODEL_REPAIR_LIMIT).toBe(2)
    for (const [scenario, fault, planFault] of [
      ['clean', 'none', false], ['plan-gap', 'none', true],
      ['check-defect', 'check', false], ['review-finding', 'review', false],
    ] as const) {
      expect(reset(scenario)).toMatchObject({
        stage: 0, repairs: 0, planRevisions: 0, fault, planFault,
        returnFrom: null, verdict: 'active',
      })
    }
  })

  it('admits a clean candidate only after all six ordered stages', () => {
    let state = reset('clean')
    const stages = [state.stage]
    for (let index = 0; index < 5; index += 1) {
      state = next(state)
      stages.push(state.stage)
      expect(state.verdict).toBe(index === 4 ? 'passed' : 'active')
    }
    expect(stages).toEqual([0, 1, 2, 3, 4, 5])
    expect(state).toMatchObject({ repairs: 0, returnFrom: null })
    terminalIsAbsorbing(state)
  })

  it('returns Critique to Plan before Build without spending a candidate repair', () => {
    const returned = next(reset('plan-gap'), 2)
    expect(returned).toMatchObject({
      stage: 0, planFault: true, planRevisions: 1, repairs: 0,
      returnFrom: 'critique', verdict: 'active',
    })
    const revised = stepRun(returned, { type: 'revise' })
    expect(revised).toMatchObject({ stage: 0, planFault: false, planRevisions: 1, returnFrom: null })
    expect(next(revised, 2)).toMatchObject({ stage: 2, repairs: 0, verdict: 'active' })
    expect(finishUnchanged(revised)).toMatchObject({ verdict: 'passed', stage: 5, repairs: 0 })
  })

  it('blocks an unchanged plan after the one allowed planning return', () => {
    const state = finishUnchanged(reset('plan-gap'))
    expect(state).toMatchObject({
      stage: 5, verdict: 'blocked', planFault: true,
      planRevisions: 1, repairs: 0, returnFrom: null,
    })
    terminalIsAbsorbing(state)
  })

  for (const [scenario, source, steps] of [
    ['check-defect', 'checks', 4], ['review-finding', 'review', 5],
  ] as const) {
    it(`returns ${source} to Build and rechecks a repaired candidate`, () => {
      const returned = next(reset(scenario), steps)
      expect(returned).toMatchObject({ stage: 2, repairs: 1, returnFrom: source, verdict: 'active' })
      const repaired = stepRun(returned, { type: 'repair' })
      expect(repaired).toMatchObject({ stage: 2, repairs: 1, fault: 'none', returnFrom: null })
      expect(next(repaired)).toMatchObject({ stage: 3, verdict: 'active', returnFrom: null })
      expect(next(repaired, 2)).toMatchObject({ stage: 4, verdict: 'active' })
      expect(next(repaired, 3)).toMatchObject({ stage: 5, verdict: 'passed', repairs: 1, returnFrom: null })
    })

    it(`allows the second ${source} return to be repaired before passing`, () => {
      const first = next(reset(scenario), steps)
      const second = next(first, source === 'checks' ? 2 : 3)
      expect(second).toMatchObject({ stage: 2, repairs: 2, verdict: 'active', returnFrom: source })
      const repaired = stepRun(second, { type: 'repair' })
      expect(next(repaired, 3)).toMatchObject({ stage: 5, verdict: 'passed', repairs: 2 })
    })

    it(`blocks the next ${source} rejection instead of granting a third return`, () => {
      const state = finishUnchanged(reset(scenario))
      expect(state).toMatchObject({
        stage: 5, repairs: 2, verdict: 'blocked', returnFrom: null,
        fault: source === 'checks' ? 'check' : 'review', planFault: false,
      })
      terminalIsAbsorbing(state)
      expect(stepRun(state, { type: 'reset', scenario: 'clean' })).toMatchObject({
        stage: 0, repairs: 0, planRevisions: 0, verdict: 'active', fault: 'none', returnFrom: null,
      })
    })
  }

  it('shares one repair budget across gates in an explicitly constructed mixed-fault fixture', () => {
    const checkReturn = next(reset('check-defect'), 4)
    expect(checkReturn).toMatchObject({ stage: 2, repairs: 1 })
    // Model invariant fixture, not a claimed interactive scenario-switch path.
    const reviewCandidate: RunModel = { ...checkReturn, fault: 'review', returnFrom: null }
    const reviewReturn = next(reviewCandidate, 3)
    expect(reviewReturn).toMatchObject({ stage: 2, repairs: 2, returnFrom: 'review', verdict: 'active' })
    expect(next(reviewReturn, 3)).toMatchObject({ stage: 5, repairs: 2, verdict: 'blocked' })
  })

  it('does not grant progress for unsupported actions or repairs at the wrong stage', () => {
    const plan = reset('clean')
    expect(stepRun(plan, { type: 'repair' })).toBe(plan)
    expect(stepRun(plan, { type: 'revise' })).toBe(plan)
    expect(stepRun(plan, { type: 'back' } as unknown as RunAction)).toBe(plan)
    expect(stepRun(plan, { type: 'unknown' } as unknown as RunAction)).toBe(plan)
    const check = next(reset('check-defect'), 3)
    expect(stepRun(check, { type: 'repair' })).toBe(check)
    expect(stepRun(check, { type: 'revise' })).toBe(check)
  })

  it('fail-closes the unreachable Review-with-check-fault guard fixture', () => {
    const invalid: RunModel = { ...reset('check-defect'), stage: 4 }
    expect(next(invalid).verdict).not.toBe('passed')
  })

  it('keeps illustrative truth, native entry controls and semantic reference in initial HTML', () => {
    const markup = renderToStaticMarkup(createElement(GoalLoopPage, { onNavigate: () => {} }))
    const hero = markup.slice(0, markup.indexOf('class="run-section run-problem"'))
    expect(hero).toContain('Make it')
    expect(hero).toContain('ONE BRIEF. ONE SHAPE. TWO REPAIRS.')
    expect(hero).toMatch(/Interactive metaphor, not a live run/i)
    expect(hero).toMatch(/No agents, project tests or deployments execute/i)
    expect(hero).toMatch(/<button\b[^>]*>[\s\S]*?Make it fit[\s\S]*?<\/button>/)
    expect(hero).toContain('id="repair"')
    expect(hero).not.toMatch(/<iframe\b/)
    expect(hero).not.toMatch(/instrument-stepper|instrument-step--|instrument-stage-panel|Simulate failed check/)
    expect(markup).not.toMatch(/<canvas\b|<video\b|<img\b|data:image/)
    expect(markup).toContain('id="run-tape"')
    expect(markup.match(/<details class="run-reference"/g)).toHaveLength(6)
    expect(markup).toContain('href="/gameonvb"')
    expect(markup).toContain('href="/"')
  })
})
