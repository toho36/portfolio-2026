import { describe, expect, it } from 'vitest'
import { isClick } from './sliderMath'

describe('slider math', () => {
  it('rejects dragged clicks', () => {
    expect(isClick(4)).toBe(true)
    expect(isClick(12)).toBe(false)
  })
})
