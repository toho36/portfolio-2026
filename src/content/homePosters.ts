export interface Poster {
  index: string
  id: 'hero' | 'gameonvb' | 'solidpixels' | 'goal-loop' | 'playground' | 'tools' | 'contact'
  label: string
  heading: string
  body: string
  accent: string
  href?: string
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
  { index: '01', id: 'gameonvb', label: 'GameOnVB', heading: 'Less organising. More time on court.', body: 'Registration and organisation for recurring recreational volleyball events, handled by one focused product.', accent: '#ff5a24', href: '/gameonvb' },
  { index: '02', id: 'solidpixels', label: 'SolidPixels', heading: 'Shared codebases, shared standards.', body: 'At SolidPixels I work with other developers on a CMS platform and client sites: frontend, backend and third-party integrations.', accent: '#1557ff' },
  { index: '03', id: 'goal-loop', label: 'Goal Loop', heading: 'Speed with hard checks.', body: 'Several models build, critique and review. Every result passes explicit verification gates or is blocked.', accent: '#d9ff43', href: '/goal-loop' },
  { index: '04', id: 'playground', label: 'Playground', heading: 'Interaction, studied closely.', body: 'A real-time 3D skill game. An exercise in input, feedback and rendering on every device.', accent: '#d9ff43', href: '/playground' },
  { index: '05', id: 'tools', label: 'Small tools', heading: 'Small tools, finished properly.', body: 'Screen Switch, a native macOS menu-bar utility that exchanges windows between displays.', accent: '#63e6ff' },
  { index: '06', id: 'contact', label: 'Contact', heading: "Let's talk about your project.", body: 'Roles, collaborations or a difficult software problem. I usually reply within a few days.', accent: '#f2efe6' },
] as const
