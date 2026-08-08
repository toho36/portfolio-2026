import { describe, expect, it } from 'vitest'
import sourceTruth from '../../docs/direction/source-truth.md?raw'
import {
  CARTRIDGE_IDENTITIES,
  CARTRIDGE_STORIES,
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

describe('cartridge stories', () => {
  it('provides the exact sourced records in cartridge identity order', () => {
    expect(
      CARTRIDGE_IDENTITIES.map(({ slug }) => [slug, CARTRIDGE_STORIES[slug]]),
    ).toEqual([
      [
        'gameonvb',
        {
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
      ],
      [
        'suburbs',
        {
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
      ],
      [
        'screen-switch',
        {
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
      ],
      [
        'voleyevents',
        {
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
      ],
    ])
    expect(Object.keys(CARTRIDGE_STORIES)).toEqual(
      CARTRIDGE_IDENTITIES.map(({ slug }) => slug),
    )
  })

  it('locks the mechanical discoveries and verified URL allowlist', () => {
    expect(
      CARTRIDGE_IDENTITIES.map(({ slug }) => CARTRIDGE_STORIES[slug].discovery),
    ).toEqual([
      {
        label: 'event dial',
        immediateReward: 'reveals the registration route',
        largerPayoff: 'reveals the sourced story',
      },
      {
        label: 'deck flip',
        immediateReward: 'turns the module surface',
        largerPayoff: 'reveals the sourced story',
      },
      {
        label: 'display swap',
        immediateReward: 'exchanges two viewport plates',
        largerPayoff: 'reveals the sourced story',
      },
      {
        label: 'ledger gate',
        immediateReward: 'clears a registration token through the mechanism',
        largerPayoff: 'reveals the sourced story',
      },
    ])

    expect(
      CARTRIDGE_IDENTITIES.flatMap(({ slug }) => {
        const { verifiedUrl } = CARTRIDGE_STORIES[slug]
        return verifiedUrl === undefined ? [] : [verifiedUrl]
      }),
    ).toEqual(['https://gameonvb.cz/', 'https://suburbs.vercel.app/'])
    expect(Object.hasOwn(CARTRIDGE_STORIES['screen-switch'], 'verifiedUrl')).toBe(
      false,
    )
    expect(Object.hasOwn(CARTRIDGE_STORIES.voleyevents, 'verifiedUrl')).toBe(
      false,
    )
  })

  it('contains no placeholders in the admitted story records', () => {
    for (const story of Object.values(CARTRIDGE_STORIES)) {
      expect(JSON.stringify(story)).not.toMatch(/\b(?:TBD|TODO|placeholder)\b/i)
    }
  })
})

describe('cartridge source truth', () => {
  const cartridgeSection = sourceTruth
    .match(/## Cartridge register\n[\s\S]*?(?=\n## )/)?.[0]
    .trim()

  it('records the exact cartridge register and admitted provenance', () => {
    expect(cartridgeSection).toBe(`## Cartridge register

There are exactly four cartridges; no additional or substitute projects belong in this direction.

| Cartridge | Preview | Role | Constraint | Decision | Evidence | Mechanical discovery | Verified URL |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GameOnVB | A live event-registration front door for recurring recreational volleyball sessions. | Full-stack developer. | Keep registration and organizer workflows understandable around recurring events. | Put upcoming sessions and registration status first; administration supports the event instead of becoming the public narrative. | The current public site exposes upcoming events and community highlights. | \`event dial\` — reveals the registration route; reveals the sourced story. | https://gameonvb.cz/ |
| Suburbs | A motion-led skateboard storefront concept built around product drops and brand story. | Frontend developer. | Make the concept feel kinetic without hiding products or narrative behind motion. | Use scroll-led transitions and responsive layout to move from the latest drop into product story, reel, and team. | The current public demo exposes those sections and remains directly readable. | \`deck flip\` — turns the module surface; reveals the sourced story. | https://suburbs.vercel.app/ |
| Screen Switch | A native menu-bar macOS utility that exchanges eligible windows between displays. | Independent macOS developer. | Preserve useful window geometry and fail visibly when Accessibility permission or destination displays are unavailable. | Keep the utility menu-bar-only; preserve normalized position and size where possible, then clamp to the destination's visible area. | The owner-maintained screen-switch README documents permissions, display selection, geometry and partial-failure behavior. | \`display swap\` — exchanges two viewport plates; reveals the sourced story. | Omitted — no verified URL admitted. |
| VoleyEvents | A registration and operations system for recurring recreational volleyball events. | Full-stack developer. | Bring registration, payment matching, cancellation credit and organizer administration into one coherent flow. | Model money, capacity and audit as part of the registration lifecycle rather than bolted-on admin tasks. | The owner-maintained voleyevents README documents registration, QR-bank payment matching, cancellation credit and admin tooling. | \`ledger gate\` — clears a registration token through the mechanism; reveals the sourced story. | Omitted — no verified URL admitted. |

- Reviewed local sibling sources: \`portfolio/lib/data.ts\`, \`screen-switch/README.md\`, \`voleyevents/README.md\`.
- Independently fetched on \`2026-08-08\`: \`https://gameonvb.cz/\`, \`https://suburbs.vercel.app/\`.
- Correction: the stale old Suburbs \`real estate development\` claim is rejected; the current verified source is the skateboard concept.
- These facts and only these facts are admitted. No metrics, additional dates, clients, employers, stacks, images, screenshots, or inferred URLs.

Only the admitted public-safe preview and sourced story fields may be published for each cartridge. Do not show source code, repository views, code snippets, fake terminals, invented metrics, claims of repository access, or unverified live URLs. Imagery, attribution, and rights remain **TBD** until supported by evidence; anything else outside the admitted cartridge records must not be inferred.`)
  })

  it('preserves unrelated TBD direction guardrails', () => {
    expect(sourceTruth).toContain(
      '**Audience:** **TBD — requires sourced audience definition.**',
    )
    expect(sourceTruth).toContain(
      'Surface finish, wear, lighting, and fabrication details are **TBD**.',
    )
    expect(sourceTruth).toContain(
      '**Type:** typography family, scale, weights, and licensing are **TBD**.',
    )
    expect(sourceTruth).toContain(
      'Imagery, attribution, and rights remain **TBD** until supported by evidence',
    )
    expect(sourceTruth).toContain('## Explicit non-goals')
    expect(sourceTruth).toContain(
      '- No project facts or evidence beyond sourced, public-safe material.',
    )
    expect(sourceTruth).toContain('## Exit gate for `t_86ba9207`')
    expect(sourceTruth).toContain(
      'Before publishing project content, resolve each **TBD** with a named source and rights/public-safety check; otherwise omit it.',
    )
  })
})
