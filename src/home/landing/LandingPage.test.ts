import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CONTACT } from '../../content/systems'
import { LandingPage } from './LandingPage'

const render = () => renderToStaticMarkup(createElement(LandingPage))

describe('static landing composition', () => {
  it('has four semantic sections, approved headline and direct hero contact', () => {
    const html = render()
    expect(html.match(/<section /g)).toHaveLength(4)
    expect(html).toContain('<h1>I build web platforms and the systems behind them.</h1>')
    const hero = html.slice(html.indexOf('id="introduction"'), html.indexOf('id="work"'))
    expect(hero).not.toContain('Hoang Viet To')
    expect(hero).toContain('Software Developer')
    expect(hero).toContain('href="#contact"')
    expect(hero).toContain('At SolidPixels, I work across CMS, frontend, backend and third-party integrations; GameOnVB is my own full-stack product.')
  })

  it('shows an honest attendance end state with HTML descriptions of every step', () => {
    const html = render()
    expect(html).toContain('Reconstruction with demo data')
    expect(html).toContain('Simulated bank input')
    for (const step of ['Event opens', 'Player registers', 'Payment matched', 'Attendance resolved']) expect(html).toContain(step)
    expect(html).toContain('The organizer records attendance against the same registration, with an audit entry.')
    expect(html).toContain('aria-current="step"')
    for (const description of ['Demo Player', 'Spárováno', 'Dorazil']) expect(html).toContain(`alt="${description}"`)
    expect(html).not.toMatch(/<canvas|<video|>Play<|>Pause</)
  })

  it('gives SolidPixels the first, expanded, text-only detail and all projects native disclosures', () => {
    const html = render()
    const work = html.slice(html.indexOf('id="work"'), html.indexOf('id="approach"'))
    expect(work.match(/<details /g)).toHaveLength(4)
    expect(html.match(/href="\/playground"/g)).toHaveLength(1)
    const goalLoop = work.slice(work.indexOf('>Goal Loop</span>'), work.indexOf('landing-work-footnote'))
    expect(goalLoop).not.toContain('landing-project-role')
    expect(goalLoop).not.toContain('>—</span>')
    expect(work).toMatch(/<details[^>]*open=""[^>]*>[\s\S]*?SolidPixels/)
    for (const name of ['SolidPixels', 'GameOnVB', 'Screen Switch', 'Goal Loop', 'Playground']) expect(work).toContain(name)
    expect(work).toContain('the platform and the client sites are team work; my contribution is the frontend, backend and integration work within them.')
    expect(work).not.toMatch(/<img|CHYBÍ|placeholder/i)
    for (const href of ['/gameonvb', '/goal-loop', '/playground']) expect(work).toContain(`href="${href}"`)
  })

  it('retains approved contact text, accessible static fields and existing contact destinations', () => {
    const html = render()
    const contact = html.slice(html.indexOf('id="contact"'))
    for (const link of CONTACT) expect(contact).toContain(`href="${link.href}"`)
    expect(contact).toContain('Roles, collaborations or a difficult software problem. I usually reply within a few days.')
    for (const label of ['Name', 'Email', 'Topic', 'Message']) expect(contact).toContain(label)
    expect(contact).toContain('type="email"')
    expect(contact).toContain('Static preview')
    expect(contact).toMatch(/<button[^>]*disabled=""/)
  })
})
