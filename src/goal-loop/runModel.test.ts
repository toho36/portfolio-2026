import { describe, expect, it, vi } from 'vitest'
import { retryUnchangedToDecision, runToDecision } from './runChoreography'
import {
  createLoopSceneController,
  createSceneEpoch,
} from './loopSceneController'
import { describeRun, primaryIntent } from './runPresentation'
import { projectBounds } from './projectArtifact'
import { createLoopScene, type LoopSceneThree } from './loopScene'
import { IDLE_POSE, staticPoseForRun } from './staticPoses'
import {
  INITIAL_RUN,
  MODEL_REPAIR_LIMIT,
  createInitialRun,
  stepRun,
  type RunAction,
  type RunModel,
  type RunScenario,
} from './runModel'

function next(state: RunModel, count = 1) {
  for (let index = 0; index < count; index += 1) {
    state = stepRun(state, { type: 'next' })
  }
  return state
}

describe('Goal Loop illustration model', () => {
  it('takes one illustrated artifact through plan, Check and Review returns before Pass', () => {
    let state = createInitialRun('full-story')
    state = next(state, 2)
    expect(state).toMatchObject({ returnFrom: 'critique', planRevisions: 1, repairs: 0 })
    state = stepRun(state, { type: 'revise' })
    state = next(state, 4)
    expect(state).toMatchObject({ returnFrom: 'checks', repairs: 1 })
    state = stepRun(state, { type: 'repair' })
    expect(state).toMatchObject({ fault: 'review', nextFault: 'none' })
    state = next(state, 3)
    expect(state).toMatchObject({ returnFrom: 'review', repairs: 2 })
    state = stepRun(state, { type: 'repair' })
    expect(next(state, 3)).toMatchObject({ verdict: 'passed', repairs: 2 })
  })

  it('declines unavailable WebGL before the renderer can log an error or allocate resources', () => {
    const renderer = vi.fn()
    const stage = {
      ownerDocument: { createElement: () => ({ getContext: () => null }) },
    } as unknown as HTMLElement
    expect(() => createLoopScene({
      stage,
      wrapper: {} as HTMLElement,
      window: {} as Window,
      onContextLoss: vi.fn(),
      three: {
        Scene: class {},
        PerspectiveCamera: class {},
        WebGLRenderer: renderer,
      } as unknown as LoopSceneThree,
    })).toThrow(/WebGL is unavailable/)
    expect(renderer).not.toHaveBeenCalled()
  })

  it('starts with the Check defect scenario and resets every scenario', () => {
    expect(INITIAL_RUN).toEqual(createInitialRun('check-defect'))
    expect(MODEL_REPAIR_LIMIT).toBe(2)

    const scenarios: readonly RunScenario[] = [
      'clean',
      'plan-gap',
      'check-defect',
      'review-finding',
    ]
    expect(scenarios.map((scenario) => stepRun(INITIAL_RUN, { type: 'reset', scenario }))).toEqual([
      createInitialRun('clean'),
      createInitialRun('plan-gap'),
      createInitialRun('check-defect'),
      createInitialRun('review-finding'),
    ])
  })

  it('returns a plan gap once without spending the candidate budget', () => {
    const returned = next(createInitialRun('plan-gap'), 2)
    expect(returned).toMatchObject({
      stage: 0,
      repairs: 0,
      planRevisions: 1,
      planFault: true,
      returnFrom: 'critique',
    })

    const revised = stepRun(returned, { type: 'revise' })
    expect(revised).toMatchObject({ planFault: false, returnFrom: null })
    expect(next(revised, 5)).toMatchObject({ stage: 5, verdict: 'passed' })
  })

  it.each([
    ['check-defect', 4, 'checks'],
    ['review-finding', 5, 'review'],
  ] as const)('returns and repairs %s through the same Build budget', (scenario, steps, source) => {
    const first = next(createInitialRun(scenario), steps)
    expect(first).toMatchObject({ stage: 2, repairs: 1, returnFrom: source })

    const unchanged = next(first, source === 'checks' ? 2 : 3)
    expect(unchanged).toMatchObject({ stage: 2, repairs: 2, returnFrom: source })

    const repaired = stepRun(unchanged, { type: 'repair' })
    expect(repaired).toMatchObject({ stage: 2, repairs: 2, fault: 'none', returnFrom: null })
    expect(next(repaired, 3)).toMatchObject({ stage: 5, verdict: 'passed', repairs: 2 })
  })

  it('blocks only when the next unchanged candidate evaluation exceeds the bound', () => {
    let state = createInitialRun('check-defect')
    for (let index = 0; index < 8; index += 1) state = stepRun(state, { type: 'next' })
    expect(state).toMatchObject({
      stage: 5,
      repairs: 2,
      fault: 'check',
      verdict: 'blocked',
      returnFrom: null,
    })
  })

  it('shares returns across Check and Review fixtures', () => {
    const checkReturn = next(createInitialRun('check-defect'), 4)
    const reviewFixture: RunModel = {
      ...checkReturn,
      fault: 'review',
      returnFrom: null,
    }
    expect(next(reviewFixture, 3)).toMatchObject({
      stage: 2,
      repairs: 2,
      returnFrom: 'review',
    })
  })

  it('fails closed for inconsistent states and keeps terminal verdicts absorbing', () => {
    const invalid = next({ ...createInitialRun('check-defect'), stage: 4 })
    expect(invalid).toMatchObject({ stage: 5, verdict: 'blocked' })

    for (const action of [
      { type: 'next' },
      { type: 'repair' },
      { type: 'revise' },
      { type: 'unknown' },
    ] as const) {
      expect(stepRun(invalid, action as RunAction)).toBe(invalid)
    }
  })

  it('returns the identical state for unsupported or misplaced actions', () => {
    const plan = createInitialRun('clean')
    expect(stepRun(plan, { type: 'repair' })).toBe(plan)
    expect(stepRun(plan, { type: 'revise' })).toBe(plan)
    expect(stepRun(plan, { type: 'back' } as unknown as RunAction)).toBe(plan)
    expect(stepRun(plan, { type: 'unknown' } as unknown as RunAction)).toBe(plan)
  })

  it('traverses reducer transitions only until a decision or verdict', () => {
    const path = runToDecision(createInitialRun('review-finding'))
    expect(path.map(({ stage }) => stage)).toEqual([1, 2, 3, 4, 2])
    expect(path.at(-1)).toMatchObject({ returnFrom: 'review', repairs: 1 })

    const clean = runToDecision(createInitialRun('clean'))
    expect(clean.at(-1)).toMatchObject({ stage: 5, verdict: 'passed' })
  })

  it.each([
    ['plan-gap', 2, 'blocked', 'critique'],
    ['check-defect', 4, 'active', 'checks'],
    ['review-finding', 5, 'active', 'review'],
  ] as const)('retries an unchanged %s return through the next decision', (scenario, steps, verdict, source) => {
    const returned = next(createInitialRun(scenario), steps)
    const path = retryUnchangedToDecision(returned)

    expect(path.length).toBeGreaterThan(0)
    expect(path.at(-1)).toMatchObject({ verdict })
    if (verdict === 'active') {
      expect(path.at(-1)).toMatchObject({ returnFrom: source, repairs: 2 })
    }
  })

  it('presents distinct return and terminal reasons without changing state', () => {
    const checkReturn = next(createInitialRun('check-defect'), 4)
    const reviewReturn = next(createInitialRun('review-finding'), 5)
    expect(describeRun(checkReturn).title).toBe('Check returned the candidate')
    expect(describeRun(reviewReturn).title).toBe('Review returned the candidate')
    expect(describeRun(next(checkReturn, 5)).detail).toMatch(/Check still rejects/)
    expect(checkReturn.returnFrom).toBe('checks')
  })

  it('keeps the candidate absent until Build and opens the local affected layer', () => {
    const plan = staticPoseForRun(createInitialRun('clean'))
    const build = staticPoseForRun(next(createInitialRun('clean'), 2))
    const returned = staticPoseForRun(next(createInitialRun('check-defect'), 4))
    expect(plan.artifact).toBe('plan')
    expect(plan.candidateVisible).toBe(false)
    expect(build.artifact).toBe('candidate')
    expect(build.candidateVisible).toBe(true)
    expect(returned.localOpening).toBe('check')
  })

  it('keeps a terminal plan blocker as an unbuilt plan', () => {
    const returned = next(createInitialRun('plan-gap'), 2)
    const blocked = next(returned, 2)
    const pose = staticPoseForRun(blocked)

    expect(blocked).toMatchObject({ verdict: 'blocked', planFault: true })
    expect(pose.artifact).toBe('plan')
    expect(pose.candidateVisible).toBe(false)
  })

  it('opens only the defective candidate part at its rejecting gate', () => {
    const checkGate = staticPoseForRun(next(createInitialRun('check-defect'), 3))
    const reviewGate = staticPoseForRun(next(createInitialRun('review-finding'), 4))

    expect(checkGate.localOpening).toBe('check')
    expect(reviewGate.localOpening).toBe('review')
  })

  it('gives active playback controls priority over committed decisions', () => {
    const returned = next(createInitialRun('check-defect'), 4)
    const passed = next(createInitialRun('clean'), 5)

    expect(primaryIntent(returned, true, false, 'playing')).toBe('pause')
    expect(primaryIntent(passed, true, false, 'replay')).toBe('pause')
    expect(primaryIntent(returned, true, false, 'paused')).toBe('resume')
    expect(primaryIntent(returned, true, false, 'settled')).toBe('correct')
    expect(primaryIntent(passed, true, false, 'settled')).toBe('restart')
  })

  it('projects actual normalized corners into CSS-pixel bounds', () => {
    expect(projectBounds([
      { x: -0.5, y: -0.25 },
      { x: 0.5, y: 0.25 },
    ], 800, 400)).toEqual({
      bottom: 250,
      height: 100,
      left: 200,
      right: 600,
      size: 400,
      top: 150,
      width: 400,
    })
  })

  it('invalidates stale scene callbacks on reset and teardown', () => {
    const epoch = createSceneEpoch()
    const first = epoch.issue()
    const second = epoch.issue()
    expect(epoch.isCurrent(first)).toBe(false)
    expect(epoch.isCurrent(second)).toBe(true)
    epoch.cancel()
    expect(epoch.isCurrent(second)).toBe(false)
  })

  it('rejects a late renderer load after route teardown', async () => {
    let resolveThree: ((value: unknown) => void) | undefined
    const three = new Promise((resolve) => { resolveThree = resolve })
    const createScene = vi.fn()
    const removed: string[] = []
    const eventTarget = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn((type: string) => removed.push(type)),
    }
    const media = {
      ...eventTarget,
      matches: false,
    } as unknown as MediaQueryList
    const wrapper = { dataset: {} } as HTMLElement
    const controller = createLoopSceneController({
      wrapper,
      stage: {} as HTMLElement,
      media,
      window: eventTarget as unknown as Window,
      document: { ...eventTarget, hidden: false } as unknown as Document,
      importThree: () => three,
      importMotion: async () => ({
        gsap: {} as never,
        ScrollTrigger: {} as never,
      }),
      createScene,
      onReady: vi.fn(),
      onFallback: vi.fn(),
      onPause: vi.fn(),
    })

    controller.destroy()
    resolveThree?.({})
    await Promise.resolve()
    await Promise.resolve()

    expect(createScene).not.toHaveBeenCalled()
    expect(removed).toEqual(expect.arrayContaining(['visibilitychange', 'keydown', 'resize', 'change']))
    expect(wrapper.dataset.scene).toBeUndefined()
  })

  it('restores passed and blocked canonical poses after replay and ignores canceled completion', async () => {
    const setPose = vi.fn()
    const timelines: Array<Record<string, () => void>> = []
    const timeline = () => {
      const callbacks: Record<string, () => void> = {}
      const value = {
        kill: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(() => true),
        play: vi.fn(() => value),
        to: vi.fn((_target: object, vars: Record<string, () => void>) => {
          Object.assign(callbacks, vars)
          timelines.push(callbacks)
          return value
        }),
      }
      return value
    }
    const eventTarget = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    const wrapper = { dataset: {} } as HTMLElement
    const onReady = vi.fn()
    const controller = createLoopSceneController({
      wrapper,
      stage: {} as HTMLElement,
      media: { ...eventTarget, matches: false } as unknown as MediaQueryList,
      window: eventTarget as unknown as Window,
      document: { ...eventTarget, hidden: false } as unknown as Document,
      importThree: async () => ({}),
      importMotion: async () => ({
        gsap: { timeline } as never,
        ScrollTrigger: {} as never,
      }),
      createScene: () => ({ setPose, resize: vi.fn(), destroy: vi.fn() }),
      onReady,
      onFallback: vi.fn(),
      onPause: vi.fn(),
    })
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce())

    const returned = staticPoseForRun(next(createInitialRun('check-defect'), 4))
    const passed = staticPoseForRun(next(createInitialRun('clean'), 5))
    const blocked = staticPoseForRun(next(next(createInitialRun('check-defect'), 4), 4))
    const complete = vi.fn()
    expect(controller.replay(returned, returned, passed, complete)).toBe(true)
    timelines.at(-1)?.onComplete()
    expect(setPose).toHaveBeenLastCalledWith(passed, true)
    expect(complete).toHaveBeenCalledOnce()

    expect(controller.replay(returned, returned, blocked, complete)).toBe(true)
    timelines.at(-1)?.onComplete()
    expect(setPose).toHaveBeenLastCalledWith(blocked, true)
    expect(complete).toHaveBeenCalledTimes(2)

    expect(controller.replay(returned, returned, passed, complete)).toBe(true)
    const staleCompletion = timelines.at(-1)?.onComplete
    controller.setPose(IDLE_POSE)
    staleCompletion?.()
    expect(setPose).toHaveBeenLastCalledWith(IDLE_POSE, true)
    controller.destroy()
  })

  it('does not start animation while the document is hidden', async () => {
    const eventTarget = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    const onReady = vi.fn()
    const controller = createLoopSceneController({
      wrapper: { dataset: {} } as HTMLElement,
      stage: {} as HTMLElement,
      media: { ...eventTarget, matches: false } as unknown as MediaQueryList,
      window: eventTarget as unknown as Window,
      document: { ...eventTarget, hidden: true } as unknown as Document,
      importThree: async () => ({}),
      importMotion: async () => ({
        gsap: { timeline: vi.fn() } as never,
        ScrollTrigger: {} as never,
      }),
      createScene: () => ({ setPose: vi.fn(), resize: vi.fn(), destroy: vi.fn() }),
      onReady,
      onFallback: vi.fn(),
      onPause: vi.fn(),
    })
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce())

    expect(controller.animate(IDLE_POSE, staticPoseForRun(createInitialRun('clean')), 500, vi.fn())).toBe(false)
    controller.destroy()
  })
})
