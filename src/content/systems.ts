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
