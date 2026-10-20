import { PROJECT_STORIES } from './projects'

interface GameOnVbSet {
  readonly label: string
  readonly value: string
  readonly unit: string
  readonly before?: { readonly prefix: string; readonly struck?: string; readonly suffix?: string }
  readonly body: string
  readonly tech?: string
  readonly win?: boolean
}

interface GameOnVbStep {
  readonly id: string
  readonly label: string
  readonly short: string
  readonly title: string
  readonly body: string
}

const STEPS: readonly GameOnVbStep[] = [
  { id: 'event-opens', label: 'Pick a session', short: 'Session', title: 'Pick a session.', body: 'Players see what is on this week and how many spots are left.' },
  { id: 'player-registers', label: 'Scan to pay', short: 'Pay', title: 'Scan to pay.', body: 'A QR code for Czech banking apps. No card details needed.' },
  { id: 'payment-matches', label: 'Payment matched', short: 'Matched', title: 'Matched automatically.', body: 'GameOnVB reads the bank account and confirms the spot. Nobody checks a spreadsheet.' },
  { id: 'attendance-resolves', label: 'Check in', short: 'Check-in', title: 'Check in at the door.', body: 'The organizer sees who paid and who came, and records cash for walk-ins.' },
]

const SETS: readonly GameOnVbSet[] = [
  {
    label: 'Set 1 · computer time', value: '<10', unit: 'ms per visit',
    before: { prefix: 'Before: ', struck: '62 ms', suffix: 'Limit: 10 ms' },
    body: 'On the free plan, the server may spend 10 ms of computer time on each visit. Mine needed up to 62 ms, so some visitors got an error.',
    tech: 'Next.js on Cloudflare Workers',
  },
  {
    label: 'Set 2 · the rebuild', value: '81', unit: 'ready-made pages',
    before: { prefix: 'Before: every page was built on each visit' },
    body: 'I rebuilt the website so pages are prepared in advance and sent as ready files. A visit now costs almost no server time.',
    tech: 'Next.js → Astro, static pages',
  },
  {
    label: 'Set 3 · scheduled jobs', value: '1', unit: 'scheduled job',
    before: { prefix: 'Before: ', struck: '9', suffix: 'Limit: 5' },
    body: 'The free plan allows five scheduled jobs. I had nine, so I combined them into one that starts the others.',
    tech: 'Cron triggers: 9 → 1 hub',
  },
  {
    label: 'Set 4 · background work', value: '4', unit: 'services fixed',
    before: { prefix: 'Bank checks, emails, login, scheduler' },
    body: 'Each of these background services used too much time. I reorganised them so every request does less work.',
    tech: 'Durable Objects, per-isolate caching',
  },
  {
    label: 'Final score', value: '0 Kč', unit: 'a month', win: true,
    body: 'GameOnVB now runs entirely on the free plan.',
  },
]

interface PhoneRow {
  readonly label: string
  readonly pill: string
  readonly ok?: boolean
}

interface PhoneScreen {
  readonly title: string
  readonly rows: readonly PhoneRow[]
  readonly button?: string
  readonly amount?: string
  readonly qrCaption?: string
  readonly stamp?: string
}

const SCREENS: readonly PhoneScreen[] = [
  {
    title: 'Upcoming', rows: [
      { label: 'Tue 19:00 · Hall A', pill: '3 left' },
      { label: 'Thu 18:30 · Hall B', pill: 'Full' },
      { label: 'Sun 10:00 · Beach', pill: '8 left' },
    ], button: 'Sign up',
  },
  { title: 'Pay · Tue 19:00', rows: [], amount: '150 Kč', qrCaption: 'Scan in any Czech bank app' },
  {
    title: 'Your spot', rows: [
      { label: 'Bank transfer', pill: 'Received', ok: true },
      { label: 'Tue 19:00 · Hall A', pill: 'Yours', ok: true },
    ], stamp: 'Confirmed',
  },
  {
    title: 'Door list · Tue', rows: [
      { label: 'Anna K.', pill: 'Here', ok: true },
      { label: 'Tomáš P.', pill: 'Here', ok: true },
      { label: 'Walk-in', pill: 'Cash' },
      { label: 'Eva M.', pill: 'Not yet' },
    ],
  },
]

/** Owner-approved GameOnVB mockup copy; the phone and ticker are illustrations. */
export const VOLEYEVENTS = {
  hero: {
    eyebrow: 'GameOnVB / Match operations',
    title: 'Sign-ups, payments and check-in for regular recreational volleyball sessions.',
    lede: PROJECT_STORIES.voleyevents.preview,
    play: 'Grab the ball and throw it down the stairs.',
  },
  ticker: ['Tue 19:00 Hall A', '3 spots left', 'Thu 18:30 Hall B', 'Full, waitlist open', 'Sun 10:00 Beach', '8 spots left'],
  rule: {
    eyebrow: 'The rule I set myself',
    title: 'Run a real product for free.',
    body: "Nobody required it. I chose to run GameOnVB on Cloudflare's free plan, and the free plan pushed back four times.",
    spiker: { zero: '0', currency: 'Kč', label: '0 Kč a month' },
  },
  sections: [
    { id: 'overview', label: 'Overview' },
    { id: 'free-plan', label: 'Free plan' },
    { id: 'limits', label: 'Limits' },
    { id: 'how-it-works', label: 'How it works' },
    { id: 'plans-change', label: 'Plans change' },
  ],
  band: { title: ['Four sets', 'against the limits.'], score: 'Limits beaten', scoreSet: 'Set', total: '/ 4', swipe: 'Swipe the cards ↔', trackLabel: 'Four sets against the limits, scroll sideways' },
  sets: SETS,
  screens: SCREENS,
  steps: STEPS,
  // The unchanged fallback staircase consumes this name for its chapter links.
  lifecycle: STEPS,
  closing: {
    eyebrow: 'When plans change',
    title: ['Cancel early.', 'Keep your credit.'],
    chips: ['Waitlist with timed offers', 'Group payments', 'Give your spot to a friend', 'Login by email link or Google'],
    cta: 'Visit gameonvb.cz',
    href: 'https://gameonvb.cz',
  },
} as const
