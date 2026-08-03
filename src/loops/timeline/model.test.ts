import { describe, expect, it } from 'vitest'
import {
  initialTimelineState,
  scrubTimeline,
  timelineIndex,
  toggleLaterStage,
} from './model'

describe('timeline model', () => {
  it('scrubs ordered stages in either direction', () => {
    const forward = scrubTimeline(initialTimelineState, 1)
    expect(timelineIndex(forward.progress)).toBe(3)
    const reverse = scrubTimeline(forward, 1 / 3)
    expect(timelineIndex(reverse.progress)).toBe(1)
  })

  it('keeps a later-stage mutation across repeated traversal', () => {
    const mutated = toggleLaterStage(initialTimelineState)
    const forward = scrubTimeline(mutated, 1)
    const backward = scrubTimeline(forward, 0)
    const forwardAgain = scrubTimeline(backward, 2 / 3)
    expect(forwardAgain.laterStageMutated).toBe(true)
    expect(timelineIndex(forwardAgain.progress)).toBe(2)
  })
})
