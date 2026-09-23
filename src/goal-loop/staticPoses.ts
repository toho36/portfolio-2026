import type { RunModel } from './runModel'

export type ArtifactKind = 'goal' | 'plan' | 'candidate'
export type LocalOpening = 'none' | 'plan' | 'check' | 'review'

export interface LoopScenePose {
  readonly id: string
  readonly artifact: ArtifactKind
  readonly artifactX: number
  readonly artifactY: number
  readonly artifactZ: number
  readonly candidateScale: number
  readonly candidateVisible: boolean
  readonly checkOpening: number
  readonly checkTool: number
  readonly criticTool: number
  readonly exitOpen: number
  readonly implementerTool: number
  readonly localOpening: LocalOpening
  readonly planOpening: number
  readonly planOpacity: number
  readonly plannerTool: number
  readonly reviewTool: number
  readonly reviewOpening: number
  readonly shellOpen: number
  readonly tabsRemaining: number
}

export const IDLE_POSE: LoopScenePose = Object.freeze({
  id: 'idle-goal',
  artifact: 'goal',
  artifactX: -2.4,
  artifactY: -0.15,
  artifactZ: 0.55,
  candidateScale: 0,
  candidateVisible: false,
  checkOpening: 0,
  checkTool: 0,
  criticTool: 0,
  exitOpen: 0,
  implementerTool: 0,
  localOpening: 'none',
  planOpening: 0,
  planOpacity: 0.42,
  plannerTool: 0,
  reviewTool: 0,
  reviewOpening: 0,
  shellOpen: 0.08,
  tabsRemaining: 2,
})

export function staticPoseForRun(run: RunModel): LoopScenePose {
  const isPlan = run.stage < 2 || (run.verdict === 'blocked' && run.planFault)
  const passed = run.verdict === 'passed'
  const blocked = run.verdict === 'blocked'
  const localOpening: LocalOpening = run.returnFrom === 'critique'
    ? 'plan'
    : run.returnFrom === 'checks'
      ? 'check'
      : run.returnFrom === 'review'
        ? 'review'
        : run.stage === 3 && run.fault === 'check'
          ? 'check'
          : run.stage === 4 && run.fault === 'review'
            ? 'review'
            : 'none'

  return {
    id: `${run.verdict}-${run.stage}-${run.returnFrom ?? 'forward'}-${run.fault}`,
    artifact: isPlan ? 'plan' : 'candidate',
    artifactX: passed ? 2.45 : isPlan ? -0.85 : 0.25,
    artifactY: passed ? -0.05 : isPlan ? 0.2 : -0.15,
    artifactZ: passed ? 1.25 : 0.55,
    candidateScale: run.stage === 2 && run.returnFrom === null ? 0.9 : 1,
    candidateVisible: !isPlan,
    checkOpening: localOpening === 'check' ? 1 : 0,
    checkTool: run.stage === 3 || run.returnFrom === 'checks' ? 1 : 0,
    criticTool: run.stage === 1 || run.returnFrom === 'critique' ? 1 : 0,
    exitOpen: passed ? 1 : blocked ? 0 : 0.18,
    implementerTool: run.stage === 2 ? 1 : 0,
    localOpening,
    planOpening: localOpening === 'plan' ? 1 : 0,
    planOpacity: isPlan ? 0.72 : 0.3,
    plannerTool: run.stage === 0 ? 1 : 0,
    reviewTool: run.stage === 4 || run.returnFrom === 'review' ? 1 : 0,
    reviewOpening: localOpening === 'review' ? 1 : 0,
    shellOpen: passed ? 1 : run.stage >= 2 ? 0.58 : 0.28,
    tabsRemaining: Math.max(0, 2 - run.repairs),
  }
}

export function interpolatePose(
  from: LoopScenePose,
  to: LoopScenePose,
  progress: number,
): LoopScenePose {
  const amount = Math.min(1, Math.max(0, progress))
  const mix = (start: number, end: number) => start + (end - start) * amount
  return {
    ...to,
    artifact: amount < 0.5 ? from.artifact : to.artifact,
    artifactX: mix(from.artifactX, to.artifactX),
    artifactY: mix(from.artifactY, to.artifactY),
    artifactZ: mix(from.artifactZ, to.artifactZ),
    candidateScale: mix(from.candidateScale, to.candidateScale),
    candidateVisible: from.candidateVisible || to.candidateVisible,
    checkOpening: mix(from.checkOpening, to.checkOpening),
    checkTool: mix(from.checkTool, to.checkTool),
    criticTool: mix(from.criticTool, to.criticTool),
    exitOpen: mix(from.exitOpen, to.exitOpen),
    implementerTool: mix(from.implementerTool, to.implementerTool),
    localOpening: amount < 0.5 ? from.localOpening : to.localOpening,
    planOpening: mix(from.planOpening, to.planOpening),
    planOpacity: mix(from.planOpacity, to.planOpacity),
    plannerTool: mix(from.plannerTool, to.plannerTool),
    reviewTool: mix(from.reviewTool, to.reviewTool),
    reviewOpening: mix(from.reviewOpening, to.reviewOpening),
    shellOpen: mix(from.shellOpen, to.shellOpen),
    tabsRemaining: mix(from.tabsRemaining, to.tabsRemaining),
  }
}
