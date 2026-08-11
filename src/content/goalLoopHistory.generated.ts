export interface GoalLoopHistoryMetric {
  readonly id: 'full-suite-wall' | 'pipeline-wall' | 'git-helper-calls'
  readonly label: string
  readonly unit: 'seconds' | 'calls'
  readonly before: number
  readonly beforeMax?: number
  readonly after: number
  readonly reductionPercent: number
  readonly lowerBound?: true
  readonly proof: string
}

export const GOAL_LOOP_HISTORY = {
  methodologyVersion: 'goal-loop-fast-feedback-descriptive-v1',
  title: 'Measured fast-feedback improvements',
  scope:
    'Three measurements from one verified Goal Loop fast-feedback change set. They describe this machine and revision, not every Goal Loop run.',
  source: {
    label: 'Goal Loop fast-feedback audit, 9 August 2026',
    path: 'docs/goal-loop-history-methodology.md',
  },
  metrics: [
    {
      id: 'full-suite-wall',
      label: 'Full verification wait',
      unit: 'seconds',
      before: 2365,
      beforeMax: 2432,
      after: 290.7,
      reductionPercent: 87.7,
      lowerBound: true,
      proof: '395 tests before; 403 tests after, all passing.',
    },
    {
      id: 'pipeline-wall',
      label: 'Representative pipeline fixture',
      unit: 'seconds',
      before: 11.35,
      after: 8.52,
      reductionPercent: 24.9,
      proof: 'Same representative fixture measurement recorded in the audit.',
    },
    {
      id: 'git-helper-calls',
      label: 'Git helper process launches',
      unit: 'calls',
      before: 209,
      after: 119,
      reductionPercent: 43.1,
      proof: 'Representative pipeline profile before and after the change.',
    },
  ] satisfies readonly GoalLoopHistoryMetric[],
} as const
