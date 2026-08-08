import { describe, expect, it } from 'vitest'
import {
  CARTRIDGE_IDENTITIES,
  CARTRIDGES,
  cartridgeByHash,
} from './cartridges'

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

  it('provides stable public-safe slugs and project hashes in the same order', () => {
    expect(CARTRIDGE_IDENTITIES).toEqual([
      { index: 0, name: 'GameOnVB', slug: 'gameonvb', hash: '#project-gameonvb' },
      { index: 1, name: 'Suburbs', slug: 'suburbs', hash: '#project-suburbs' },
      {
        index: 2,
        name: 'Screen Switch',
        slug: 'screen-switch',
        hash: '#project-screen-switch',
      },
      {
        index: 3,
        name: 'VoleyEvents',
        slug: 'voleyevents',
        hash: '#project-voleyevents',
      },
    ])
    expect(new Set(CARTRIDGE_IDENTITIES.map(({ slug }) => slug)).size).toBe(4)
    expect(new Set(CARTRIDGE_IDENTITIES.map(({ hash }) => hash)).size).toBe(4)
  })

  it('looks up each cartridge by hash without accepting unknown fragments', () => {
    for (const identity of CARTRIDGE_IDENTITIES) {
      expect(cartridgeByHash(identity.hash)).toBe(identity)
    }
    expect(cartridgeByHash('#project-unknown')).toBeUndefined()
    expect(cartridgeByHash('project-gameonvb')).toBeUndefined()
  })
})
