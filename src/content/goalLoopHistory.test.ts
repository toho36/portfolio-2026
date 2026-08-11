import { describe, expect, it } from 'vitest'
import { GOAL_LOOP_HISTORY } from './goalLoopHistory.generated'

function reduction(before: number, after: number): number {
  return Math.round(((before - after) / before) * 1_000) / 10
}

describe('Goal Loop public history evidence', () => {
  it('keeps every percentage bound to visible absolute values', () => {
    expect(GOAL_LOOP_HISTORY.metrics).toHaveLength(3)

    for (const metric of GOAL_LOOP_HISTORY.metrics) {
      expect(metric.reductionPercent).toBe(reduction(metric.before, metric.after))
      expect(metric.before).toBeGreaterThan(metric.after)
      expect(['seconds', 'calls']).toContain(metric.unit)
      expect(metric.proof).not.toBe('')
    }
  })

  it('uses the conservative edge of the full-suite range', () => {
    const metric = GOAL_LOOP_HISTORY.metrics[0]

    expect(metric.id).toBe('full-suite-wall')
    expect(metric.before).toBe(2365)
    expect(metric.beforeMax).toBe(2432)
    expect(metric.beforeMax).toBeGreaterThan(metric.before)
    expect(metric.after).toBe(290.7)
    expect(metric.reductionPercent).toBe(87.7)
    expect(metric.lowerBound).toBe(true)
  })

  it('contains only the reviewed public schema', () => {
    const serialized = JSON.stringify(GOAL_LOOP_HISTORY)

    expect(serialized).not.toMatch(
      /(?:\/Users\/|\.hermes|prompt|goal_sha|task_id|provider|model|credential|secret|token)/i,
    )
    expect(GOAL_LOOP_HISTORY.source.path).toBe(
      'docs/goal-loop-history-methodology.md',
    )
  })
})
