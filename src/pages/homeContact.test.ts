import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomePage } from './Home'

describe('contact poster', () => {
  it('renders an inline labelled form with a hidden honeypot and contact links', () => {
    const markup = renderToStaticMarkup(createElement(HomePage, { onNavigate: () => {} }))
    const contact = markup.slice(markup.indexOf('data-poster="contact"'))
    expect(contact).toContain('Let&#x27;s talk about roles and collaborations.')
    // The sheet header keeps the visible Contact label; the name and + are decoration.
    expect(contact).toContain('<p class="eyebrow contact-card-top"><span aria-hidden="true">Hoang Viet To</span><span>Contact</span><i aria-hidden="true">+</i></p>')
    expect(contact).not.toContain('reply within a few days')
    expect(contact).not.toMatch(/<p\b[^>]*>\s*<\/p>/)
    expect(contact).toContain('<form')
    for (const field of ['Name', 'Email', 'Topic', 'Message']) expect(contact).toContain(field)
    expect(contact).toContain('type="email"')
    expect(contact).toContain('type="radio"')
    expect(contact).toContain('Topic (optional)')
    expect(contact).not.toMatch(/<input(?=[^>]*type="radio")(?=[^>]*checked)[^>]*>/)
    expect(contact).toContain('name="_honey"')
    expect(contact).toContain('autoComplete="off"')
    expect(contact).toContain('Send message')
    expect(contact).not.toContain('poster-email-row')
    expect(contact).not.toContain('>Copy</button>')
    expect(contact).toContain('<nav aria-label="Contact and CV">')
    for (const label of ['GitHub', 'LinkedIn', 'CV EN', 'CV CZ']) expect(contact).toContain(label)
  })
})

describe('Screen Switch poster', () => {
  it('renders a native switch button, two windows and a polite announcement', () => {
    const markup = renderToStaticMarkup(createElement(HomePage, { onNavigate: () => {} }))
    const tools = markup.slice(markup.indexOf('data-poster="tools"'), markup.indexOf('data-poster="contact"'))
    expect(tools).toContain('aria-label="Swap windows between displays" aria-pressed="false"')
    expect(tools).toContain('WINDOW A')
    expect(tools).toContain('WINDOW B')
    expect(tools).toContain('Click')
    expect(tools).toContain('Tap')
    expect(tools).toContain('aria-live="polite"')
  })
})
