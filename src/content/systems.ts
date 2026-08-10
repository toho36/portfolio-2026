import { CARTRIDGE_STORIES } from './cartridges'
import type { RoutePath } from './routes'

export const HERO = {
  eyebrow: 'Independent software systems builder',
  title:
    'I turn messy operations into software — and software delivery into a system.',
  introduction:
    'I’m Hoang Viet To. I build reliable products around real-world operations, then improve the development loops that ship them.',
} as const

interface Flagship {
  readonly index: string
  readonly name: string
  readonly path: RoutePath
  readonly summary: string
}

export const FLAGSHIPS: readonly Flagship[] = [
  {
    index: '01',
    name: 'VoleyEvents',
    path: '/voleyevents',
    summary:
      'An operational product for recurring recreational volleyball events.',
  },
  {
    index: '02',
    name: 'Goal Loop',
    path: '/goal-loop',
    summary: 'A bounded multi-model software delivery and optimization system.',
  },
]

interface SideQuest {
  readonly name: string
  readonly summary: string
  readonly url?: string
}

export const SIDE_QUESTS: readonly SideQuest[] = [
  {
    name: 'GameOnVB',
    summary: CARTRIDGE_STORIES.gameonvb.preview,
    url: CARTRIDGE_STORIES.gameonvb.verifiedUrl,
  },
  {
    name: 'Screen Switch',
    summary: CARTRIDGE_STORIES['screen-switch'].preview,
  },
  {
    name: 'Suburbs',
    summary: CARTRIDGE_STORIES.suburbs.preview,
    url: CARTRIDGE_STORIES.suburbs.verifiedUrl,
  },
]

interface ContactLink {
  readonly label: string
  readonly href: string
  readonly download?: true
}

export const CONTACT: readonly ContactLink[] = [
  { label: 'Email', href: 'mailto:tohoangviet1998@gmail.com' },
  { label: 'GitHub', href: 'https://github.com/toho36' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/hoangvietto/' },
  {
    label: 'CV EN',
    href: '/hoang-viet-to-cv-en.docx',
    download: true,
  },
  {
    label: 'CV CZ',
    href: '/hoang-viet-to-cv-cz.docx',
    download: true,
  },
]
