import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CONTACT } from '../../content/systems'
import { LandingPage } from './LandingPage'

const render = () => renderToStaticMarkup(createElement(LandingPage))

describe('integrated landing composition', () => {
  it('has four semantic sections, approved headline and direct hero contact', () => {
    const html = render()
    expect(html.match(/<section /g)).toHaveLength(4)
    expect(html).toContain('<h1>I build web platforms and the systems behind them.</h1>')
    const hero = html.slice(html.indexOf('id="introduction"'), html.indexOf('id="work"'))
    expect(hero).toContain('<p class="landing-kicker">Software Developer</p>')
    expect(hero).toContain('href="#contact"')
    expect(hero).toContain('At SolidPixels, I work across CMS, frontend, backend and third-party integrations; GameOnVB is my own full-stack product.')
    expect(html).not.toMatch(/<header|<main|<footer/)
  })

  it('starts the approved P1 panel idle on its complete first step, with four selectable steps', () => {
    const html = render()
    expect(html).toContain('Reconstruction with demo data')
    for (const step of ['Event opens', 'Player registers', 'Payment matched', 'Attendance resolved']) expect(html).toContain(step)
    expect(html).toContain('data-p1-step="1" data-p1-status="idle" data-p1-transitioning="false"')
    expect(html.match(/role="tab"/g)).toHaveLength(4)
    expect(html).toContain('alt="Otevřeno"')
    expect(html).toContain('>Play</button>')
    expect(html).not.toMatch(/<canvas|<video/)
  })

  it('gives SolidPixels the first expanded text detail and keeps all contributions visible', () => {
    const html = render()
    const work = html.slice(html.indexOf('id="work"'), html.indexOf('id="approach"'))
    expect(work.match(/data-work-select/g)).toHaveLength(4)
    expect(work).toContain('Selected: SolidPixels.')
    expect(work).toMatch(/<details[^>]*open=""/)
    expect(work.match(/href="\/playground"/g)).toHaveLength(1)
    for (const name of ['SolidPixels', 'GameOnVB', 'Screen Switch', 'Goal Loop', 'Playground']) expect(work).toContain(name)
    expect(work).toContain('the platform and the client sites are team work; my contribution is the frontend, backend and integration work within them.')
    expect(work).not.toMatch(/<img|CHYBÍ|placeholder/i)
    expect(work).toContain('A native menu-bar macOS utility that exchanges eligible windows between displays.')
  })

  it('retains contact copy, accessible fields and existing destinations with an enabled real form', () => {
    const html = render()
    const contact = html.slice(html.indexOf('id="contact"'))
    for (const link of CONTACT) expect(contact).toContain(`href="${link.href}"`)
    expect(contact).toContain('Roles, collaborations or a difficult software problem. I usually reply within a few days.')
    for (const label of ['Name', 'Email', 'Topic', 'Message']) expect(contact).toContain(label)
    expect(contact).toContain('type="email"')
    expect(contact).toContain('noValidate=""')
    expect(contact).not.toContain('Static preview')
    expect(contact).not.toMatch(/<button[^>]*disabled=""/)
  })

  it('passes the same page-owned coordinator to every motion module and disposes it on unmount', () => {
    const source = readFileSync(new URL('./LandingPage.tsx', import.meta.url), 'utf8')
    for (const component of ['Hero', 'WorkIndex', 'ScreenSwitch', 'PracticeSection']) expect(source).toContain(`<${component} coordinator={coordinator}`)
    expect(source).toContain('useState(createDominantMotion)')
    expect(source).toContain('useEffect(() => () => coordinator.dispose(), [coordinator])')
    expect(source).toContain('screenSwitchDemo={<ScreenSwitch')
    expect(source).toContain('illustrationLabel="Illustration of the feature"')
  })
})
