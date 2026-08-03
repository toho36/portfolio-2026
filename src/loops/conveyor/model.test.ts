import { describe, expect, it } from 'vitest'
import { conveyorIndex, conveyorStop, scrubConveyor } from './model'

describe('conveyor model', () => {
  it('clamps progress and maps ordered stops', () => {
    expect(scrubConveyor({ progress: 0 }, -1).progress).toBe(0)
    expect(scrubConveyor({ progress: 0 }, 2).progress).toBe(1)
    expect(conveyorIndex(conveyorStop(2))).toBe(2)
  })

  it('reverses through the same state instead of replaying forward', () => {
    const forward = scrubConveyor({ progress: 0 }, 0.8)
    const reverse = scrubConveyor(forward, 0.25)
    expect(reverse.progress).toBe(0.25)
    expect(conveyorIndex(reverse.progress)).toBe(1)
  })
})
