import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomePage } from './Home'
import { ContactEnvelope } from '../home/living/LivingVisuals'

const markup = renderToStaticMarkup(createElement(HomePage, { onNavigate: () => {} }))
const section = (id: string, next: string) => markup.slice(markup.indexOf(`data-poster="${id}"`), markup.indexOf(next))

describe('homepage living sections', () => {
  it('render their final, readable state without motion armed', () => {
    expect(markup).not.toContain('data-armed')
    expect(section('hero', 'data-poster="gameonvb"')).toContain('<h2 class="intro-heading" aria-label="New tools. Old standards.">')
    const game = section('gameonvb', 'data-poster="solidpixels"')
    expect(game).toContain('aria-label="How it works: Pick a session, then Scan to pay, then Payment matched, then Check in."')
    expect(game.match(/class="ball-step" data-on="true"/g)).toHaveLength(4)
    expect(game).toContain('62 → 0 ms · server CPU time per public page request')
    expect(section('solidpixels', 'data-poster="goal-loop"')).toMatch(/<ul class="shared-legend"[^>]*><li data-role="Frontend"/)
    expect(section('playground', 'data-poster="tools"')).toContain('Keep your pointer near the wire and follow it.')
  })
  it('uses one positioning paragraph and retains concrete facts', () => {
    const intro = section('hero', 'data-poster="gameonvb"')
    expect(intro.match(/<p>/g)).toHaveLength(1)
    expect(markup).toContain('I own GameOnVB end to end')
    expect(markup).toContain('395 → 403 tests')
  })
  it('wraps the real contact form in the envelope, decoration hidden from assistive tech', () => {
    const contact = markup.slice(markup.indexOf('<div id="contact"'))
    expect(contact).toMatch(/^<div id="contact" class="contact-envelope"><div class="contact-envelope-motion"><div class="contact-envelope-back" aria-hidden="true"><\/div><section data-poster="contact">/)
    expect(contact).toContain('<form class="poster-contact-form"')
    expect(contact).toContain('<div class="contact-envelope-front" aria-hidden="true">')
    expect(contact.match(/id="contact"/g)).toHaveLength(1)
    expect(contact.match(/<form /g)).toHaveLength(1)
  })
  it('keeps the success status and links outside the inert moving letter and preserves the contact anchor', () => {
    const html = renderToStaticMarkup(createElement(ContactEnvelope, {
      sent: true, receiptLinks: createElement('a', { href: '/hoang-viet-to-cv-en.docx', download: true }, 'CV EN'),
      children: createElement('section', { 'data-poster': 'contact' }, createElement('form')),
    }))
    expect(html).toContain('<div id="contact" class="contact-envelope" data-sent="true">')
    expect(html).toContain('<div class="contact-envelope-motion" inert="" aria-hidden="true">')
    const receipt = html.slice(html.indexOf('<div class="contact-envelope-receipt"'))
    expect(receipt).toContain('role="status" aria-live="polite" aria-atomic="true" tabindex="-1">Thanks, message sent.</p>')
    expect(receipt).toContain('>CV EN</a>')
    expect(receipt).not.toMatch(/hidden=|inert=|<form|reply within/)
    expect(html.match(/<form/g)).toHaveLength(1)
  })
})
