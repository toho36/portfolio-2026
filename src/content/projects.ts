export const PROJECT_SLUGS = [
  'gameonvb',
  'screen-switch',
  'voleyevents',
] as const

export type ProjectSlug = (typeof PROJECT_SLUGS)[number]

export type VerifiedProjectUrl = 'https://gameonvb.cz/'

export interface ProjectStory {
  readonly preview: string
  readonly role: string
  readonly constraint: string
  readonly decision: string
  readonly evidence: string
  readonly verifiedUrl?: VerifiedProjectUrl
}

export const PROJECT_STORIES: Readonly<Record<ProjectSlug, ProjectStory>> = {
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
  },
}
