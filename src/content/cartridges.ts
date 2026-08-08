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

export interface MechanicalDiscovery {
  readonly label: string
  readonly immediateReward: string
  readonly largerPayoff: string
}

export type VerifiedCartridgeUrl =
  | 'https://gameonvb.cz/'
  | 'https://suburbs.vercel.app/'

export interface CartridgeStory {
  readonly preview: string
  readonly role: string
  readonly constraint: string
  readonly decision: string
  readonly evidence: string
  readonly discovery: MechanicalDiscovery
  readonly verifiedUrl?: VerifiedCartridgeUrl
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

export const CARTRIDGE_STORIES: Readonly<
  Record<CartridgeSlug, CartridgeStory>
> = {
  gameonvb: {
    preview:
      'A live event-registration front door for recurring recreational volleyball sessions.',
    role: 'Full-stack developer.',
    constraint:
      'Keep registration and organizer workflows understandable around recurring events.',
    decision:
      'Put upcoming sessions and registration status first; administration supports the event instead of becoming the public narrative.',
    evidence:
      'The current public site exposes upcoming events and community highlights.',
    verifiedUrl: 'https://gameonvb.cz/',
    discovery: {
      label: 'event dial',
      immediateReward: 'reveals the registration route',
      largerPayoff: 'reveals the sourced story',
    },
  },
  suburbs: {
    preview:
      'A motion-led skateboard storefront concept built around product drops and brand story.',
    role: 'Frontend developer.',
    constraint:
      'Make the concept feel kinetic without hiding products or narrative behind motion.',
    decision:
      'Use scroll-led transitions and responsive layout to move from the latest drop into product story, reel, and team.',
    evidence:
      'The current public demo exposes those sections and remains directly readable.',
    verifiedUrl: 'https://suburbs.vercel.app/',
    discovery: {
      label: 'deck flip',
      immediateReward: 'turns the module surface',
      largerPayoff: 'reveals the sourced story',
    },
  },
  'screen-switch': {
    preview:
      'A native menu-bar macOS utility that exchanges eligible windows between displays.',
    role: 'Independent macOS developer.',
    constraint:
      'Preserve useful window geometry and fail visibly when Accessibility permission or destination displays are unavailable.',
    decision:
      "Keep the utility menu-bar-only; preserve normalized position and size where possible, then clamp to the destination's visible area.",
    evidence:
      'The owner-maintained screen-switch README documents permissions, display selection, geometry and partial-failure behavior.',
    discovery: {
      label: 'display swap',
      immediateReward: 'exchanges two viewport plates',
      largerPayoff: 'reveals the sourced story',
    },
  },
  voleyevents: {
    preview:
      'A registration and operations system for recurring recreational volleyball events.',
    role: 'Full-stack developer.',
    constraint:
      'Bring registration, payment matching, cancellation credit and organizer administration into one coherent flow.',
    decision:
      'Model money, capacity and audit as part of the registration lifecycle rather than bolted-on admin tasks.',
    evidence:
      'The owner-maintained voleyevents README documents registration, QR-bank payment matching, cancellation credit and admin tooling.',
    discovery: {
      label: 'ledger gate',
      immediateReward:
        'clears a registration token through the mechanism',
      largerPayoff: 'reveals the sourced story',
    },
  },
}

const CARTRIDGE_BY_HASH = new Map(
  CARTRIDGE_IDENTITIES.map((identity) => [identity.hash, identity]),
)

export function cartridgeByHash(hash: string): CartridgeIdentity | undefined {
  return CARTRIDGE_BY_HASH.get(hash as CartridgeHash)
}
