import { afterEach, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ContactSection } from './ContactSection'
import { mountGateReveal } from './gateReveal'
import { createDominantMotion } from '../shared/landingMotion'

afterEach(() => vi.unstubAllGlobals())

it('renders the contact form with labelled fields, honeypot and contact links', () => {
  const markup = renderToStaticMarkup(createElement(ContactSection))
  expect(markup).toContain('<form')
  for (const name of ['name', 'email', 'message', '_honey']) expect(markup).toContain(`name="${name}"`)
  for (const id of ['landing-name', 'landing-email', 'landing-message']) expect(markup).toContain(`for="${id}"`)
  expect(markup).toContain('aria-busy="false"')
  expect(markup).toContain('autoComplete="off"')
  expect(markup).toContain('tabindex="-1"')
  expect(markup).toContain('Send message')
  expect(markup).toContain('mailto:tohoangviet1998@gmail.com')
  expect(markup).toContain('/hoang-viet-to-cv-en.docx')
})

it('reduced motion leaves the full gate rail visible without loading animation', async () => {
  const media = Object.assign(new EventTarget(), { matches: true })
  vi.stubGlobal('window', { matchMedia: () => media })
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }))
  const coordinator = createDominantMotion()
  const rail = { style: { transform: '' } } as HTMLElement
  const dispose = mountGateReveal({} as HTMLElement, rail, coordinator)
  await dispose.ready
  expect(rail.style.transform).toBe('scaleX(1)')
  expect(coordinator.currentId()).toBeUndefined()
  dispose(); coordinator.dispose()
})
