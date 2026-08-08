import {
  CARTRIDGE_SLUGS,
  type CartridgeSlug,
} from './cartridges'

export const CIRCUIT_COMPLETE_LABEL = 'Circuit complete' as const

export interface ProjectDiscoveryVisit {
  readonly slug: CartridgeSlug
  readonly kind: 'discovery' | 'replay'
}

export interface ProjectDiscoveryState {
  readonly visited: readonly CartridgeSlug[]
  readonly latest: ProjectDiscoveryVisit | null
  readonly completion: typeof CIRCUIT_COMPLETE_LABEL | null
}

export function createProjectDiscovery(): ProjectDiscoveryState {
  return {
    visited: [],
    latest: null,
    completion: null,
  }
}

export function visitProject(
  state: ProjectDiscoveryState,
  slug: CartridgeSlug,
): ProjectDiscoveryState {
  const isReplay = state.visited.includes(slug)
  const visited = CARTRIDGE_SLUGS.filter(
    (candidate) => candidate === slug || state.visited.includes(candidate),
  )

  return {
    visited,
    latest: { slug, kind: isReplay ? 'replay' : 'discovery' },
    completion:
      visited.length === CARTRIDGE_SLUGS.length
        ? CIRCUIT_COMPLETE_LABEL
        : null,
  }
}
