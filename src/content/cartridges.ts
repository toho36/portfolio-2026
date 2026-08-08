export const CARTRIDGES = [
  'GameOnVB',
  'Suburbs',
  'Screen Switch',
  'VoleyEvents',
] as const

export type Cartridge = (typeof CARTRIDGES)[number]

export const CARTRIDGE_SLUGS = [
  'gameonvb',
  'suburbs',
  'screen-switch',
  'voleyevents',
] as const

export type CartridgeSlug = (typeof CARTRIDGE_SLUGS)[number]
export type CartridgeHash = `#project-${CartridgeSlug}`
export type CartridgeIndex = 0 | 1 | 2 | 3

export interface CartridgeIdentity {
  readonly index: CartridgeIndex
  readonly name: Cartridge
  readonly slug: CartridgeSlug
  readonly hash: CartridgeHash
}

export const CARTRIDGE_IDENTITIES = CARTRIDGES.map((name, index) => {
  const cartridgeIndex = index as CartridgeIndex
  const slug = CARTRIDGE_SLUGS[cartridgeIndex]
  return {
    index: cartridgeIndex,
    name,
    slug,
    hash: `#project-${slug}` as CartridgeHash,
  }
}) as readonly CartridgeIdentity[]

const CARTRIDGE_BY_HASH = new Map(
  CARTRIDGE_IDENTITIES.map((identity) => [identity.hash, identity]),
)

export function cartridgeByHash(hash: string): CartridgeIdentity | undefined {
  return CARTRIDGE_BY_HASH.get(hash as CartridgeHash)
}
