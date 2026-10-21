export interface Poster {
  index: string
  id: 'hero' | 'gameonvb' | 'solidpixels' | 'goal-loop' | 'playground' | 'tools' | 'contact'
  label: string
  heading: string
  body: string
  accent: string
  href?: string
  cta?: string
  facts?: readonly { readonly label: string; readonly text: string }[]
}

export const HOME_COPY = {
  role: 'Software Developer',
  positioning: "I adopt new tools early and hold their output to the same standard as my own, whether I'm shipping alone or with a team.",
  hintDesktop: 'Scroll to browse',
  hintTouch: 'Swipe to browse',
  cta: 'View project',
  contactCta: 'Send message',
  loader: 'Loading',
} as const

export const POSTERS: readonly Poster[] = [
  { index: '00', id: 'hero', label: 'Introduction', heading: 'New tools. Old standards.', body: 'I move quickly with new technology and keep the engineering discipline that teams rely on.', accent: '#f2efe6' },
  { index: '01', id: 'gameonvb', label: 'GameOnVB', heading: 'Less organising. More time on court.', body: 'Sign-ups, payments and check-in for regular recreational volleyball sessions.', accent: '#ff5a24', href: '/gameonvb', cta: 'Read the GameOnVB case study', facts: [
    { label: 'What I own', text: 'I own GameOnVB end to end: product, code, releases and hosting, since the first commit in April 2026.' },
    { label: 'What shipped', text: 'Live at gameonvb.cz: sign-up, QR bank payments matched automatically, waitlist offers, login by email link or Google.' },
    { label: 'Result', text: 'Public pages are now static files with no server work per visit. Before: 28–62 ms CPU per page and 73 limit errors in one week.' },
  ] },
  { index: '02', id: 'solidpixels', label: 'SolidPixels', heading: 'Shared codebases, shared standards.', body: 'At SolidPixels I work with other developers on a CMS platform and client sites: frontend, backend and third-party integrations.', accent: '#1557ff' },
  { index: '03', id: 'goal-loop', label: 'Goal Loop', heading: 'Speed with hard checks.', body: 'How I deliver software. Quality first, speed follows.', accent: '#d9ff43', href: '/goal-loop', cta: 'Read the Goal Loop case study', facts: [
    { label: 'What I own', text: 'I set the goal, the rules and the checks.' },
    { label: 'What shipped', text: 'A delivery loop with five checked steps: plan, critique, build, check, review. A change passes only when every check agrees.' },
    { label: 'Result', text: 'Full test run 39.4 → 4.8 min on one audited change set, 395 → 403 tests, all passing.' },
  ] },
  { index: '04', id: 'playground', label: 'Playground', heading: 'Interaction, studied closely.', body: 'A real-time 3D skill game. An exercise in input, feedback and rendering on every device.', accent: '#ff4fd8', href: '/playground' },
  { index: '05', id: 'tools', label: 'Small tools', heading: 'Small tools, finished properly.', body: 'Screen Switch, a native macOS menu-bar utility that exchanges windows between displays.', accent: '#63e6ff' },
  { index: '06', id: 'contact', label: 'Contact', heading: "Let's talk about your project.", body: 'Roles, collaborations or a difficult software problem. I usually reply within a few days.', accent: '#f2efe6' },
] as const
