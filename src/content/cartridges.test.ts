import { describe, expect, it } from 'vitest'
import { CARTRIDGES } from './cartridges'

describe('cartridge identities', () => {
  it('contains exactly the four approved unique cartridges', () => {
    expect(CARTRIDGES).toEqual([
      'GameOnVB',
      'Suburbs',
      'Screen Switch',
      'VoleyEvents',
    ])
    expect(new Set(CARTRIDGES).size).toBe(4)
  })
})
