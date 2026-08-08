import { describe, expect, it } from 'vitest'
import { CARTRIDGE_SLUGS, type CartridgeSlug } from './cartridges'
import {
  CIRCUIT_COMPLETE_LABEL,
  createProjectDiscovery,
  visitProject,
  type ProjectDiscoveryState,
} from './projectDiscovery'

function visitAll(order: readonly CartridgeSlug[]): ProjectDiscoveryState {
  return order.reduce(visitProject, createProjectDiscovery())
}

function permutations(
  slugs: readonly CartridgeSlug[],
): readonly (readonly CartridgeSlug[])[] {
  if (slugs.length === 0) return [[]]
  return slugs.flatMap((slug, index) =>
    permutations([...slugs.slice(0, index), ...slugs.slice(index + 1)]).map(
      (remaining) => [slug, ...remaining],
    ),
  )
}

describe('project discovery', () => {
  it('starts with an exact empty deterministic state', () => {
    expect(createProjectDiscovery()).toEqual({
      visited: [],
      latest: null,
      completion: null,
    })
  })

  it('marks the first visit as discovery without mutating the prior state', () => {
    const initial = createProjectDiscovery()

    expect(visitProject(initial, 'screen-switch')).toEqual({
      visited: ['screen-switch'],
      latest: { slug: 'screen-switch', kind: 'discovery' },
      completion: null,
    })
    expect(initial).toEqual({ visited: [], latest: null, completion: null })
  })

  it('marks a later visit as replay and keeps one canonical visit', () => {
    const discovered = visitProject(createProjectDiscovery(), 'suburbs')

    expect(visitProject(discovered, 'suburbs')).toEqual({
      visited: ['suburbs'],
      latest: { slug: 'suburbs', kind: 'replay' },
      completion: null,
    })
  })

  it('reveals the exact completion reward at all four unique visits', () => {
    expect(visitAll(CARTRIDGE_SLUGS)).toEqual({
      visited: [...CARTRIDGE_SLUGS],
      latest: { slug: 'voleyevents', kind: 'discovery' },
      completion: CIRCUIT_COMPLETE_LABEL,
    })
  })

  it('completes in every order while retaining canonical visited order', () => {
    for (const order of permutations(CARTRIDGE_SLUGS)) {
      const completed = visitAll(order)
      expect(completed).toEqual({
        visited: [...CARTRIDGE_SLUGS],
        latest: { slug: order.at(-1), kind: 'discovery' },
        completion: CIRCUIT_COMPLETE_LABEL,
      })
      expect(visitProject(completed, order[0])).toEqual({
        visited: [...CARTRIDGE_SLUGS],
        latest: { slug: order[0], kind: 'replay' },
        completion: CIRCUIT_COMPLETE_LABEL,
      })
    }
  })
})
