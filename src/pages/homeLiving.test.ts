import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomePage } from './Home'

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
  it('wraps the real contact form in the envelope, decoration hidden from assistive tech', () => {
    const contact = markup.slice(markup.indexOf('<div class="contact-envelope"'))
    expect(contact).toMatch(/^<div class="contact-envelope"><div class="contact-envelope-back" aria-hidden="true"><\/div><section id="contact" data-poster="contact">/)
    expect(contact).toContain('<form class="poster-contact-form"')
    expect(contact).toContain('<div class="contact-envelope-front" aria-hidden="true">')
  })
})
