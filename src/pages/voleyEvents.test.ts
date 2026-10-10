import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { ROUTES } from '../content/routes'
import {
  VOLEYEVENTS,
  VOLEYEVENTS_LIFECYCLE,
} from '../content/voleyevents'

function render(path = '/gameonvb') {
  return renderToStaticMarkup(createElement(App, { initialPath: path }))
}

describe('GameOnVB Match Operations case study', () => {
  it('opens with the sourced product identity and a descriptive route title', () => {
    const markup = render()
    const route = ROUTES.find(({ path }) => path === '/gameonvb')
    const hero = markup.slice(
      markup.indexOf('class="staircase-entry light-table-hero"'),
      markup.indexOf('class="case-section'),
    )

    expect(hero).toContain('GameOnVB / Match operations')
    expect(hero).toContain(
      'Registration and operations software for recurring recreational volleyball events.',
    )
    expect(hero).not.toContain(
      'A registration and operations system for recurring recreational volleyball events.',
    )
    expect(route?.title).toBe(
      'GameOnVB Match Operations — Hoang Viet To',
    )
  })

  it('keeps problem, constraints, decisions, lifecycle, evidence and status in reading order', () => {
    const markup = render()
    const landmarks = [
      'The operational problem',
      'Constraint',
      'System decision',
      'One registration / one operational record',
      'Evidence boundary',
      'Current status',
    ]

    landmarks.forEach((landmark) => expect(markup).toContain(landmark))
    landmarks.slice(1).forEach((landmark, index) => {
      expect(markup.indexOf(landmark)).toBeGreaterThan(
        markup.indexOf(landmarks[index]),
      )
    })
  })

  it('explains one complete registration lifecycle in the required order', () => {
    const markup = render()
    const lifecycle = markup.slice(
      markup.indexOf('<section id="lifecycle"'),
      markup.indexOf('class="case-pair case-closing"'),
    )
    const labels = [
      'Event opens',
      'Player registers',
      'Payment matches',
      'Attendance resolves',
    ]

    expect(VOLEYEVENTS_LIFECYCLE.map(({ label }) => label)).toEqual(labels)
    labels.forEach((label) => expect(lifecycle).toContain(label))
    labels.slice(1).forEach((label, index) => {
      expect(lifecycle.indexOf(label)).toBeGreaterThan(
        lifecycle.indexOf(labels[index]),
      )
    })
    expect(lifecycle).toMatch(/registration/i)
    expect(lifecycle).toMatch(/QR-bank payment matching/i)
    expect(lifecycle).toMatch(/cancellation credit/i)
    expect(lifecycle).toMatch(/attendance/i)
    expect(lifecycle).toMatch(/admin operations/i)
    expect(lifecycle).toMatch(/audit/i)
  })

  it('retains complete semantic stage content without relying on the illustration', () => {
    const markup = render()
    const lifecycle = markup.slice(
      markup.indexOf('<section id="lifecycle"'),
      markup.indexOf('class="case-pair case-closing"'),
    )

    expect(lifecycle).toContain('<ol class="lifecycle-track">')
    expect(lifecycle.match(/<li class="lifecycle-stage(?:\s[^"]*)?"/g)).toHaveLength(4)
    for (const stage of VOLEYEVENTS_LIFECYCLE) {
      expect(lifecycle).toContain(`id="${stage.id}"`)
      expect(lifecycle).toContain(`<h3>${stage.label}</h3>`)
      expect(lifecycle).toContain(stage.body)
      expect(stage.handles).not.toHaveLength(0)
    }
    expect(lifecycle).not.toMatch(/<h3[^>]*aria-hidden|<p[^>]*aria-hidden/)
  })

  it('offers the transferred upper-tread hero before the complete ungated story', () => {
    const markup = render()
    const hero = markup.slice(markup.indexOf('class="staircase-entry light-table-hero"'), markup.indexOf('class="case-section'))
    expect(hero).toContain('More time on court.')
    expect(hero.match(/data-ball-hero="true"/g)).toHaveLength(1)
    expect(hero).toContain('data-cold-ball-fallback="true"')
    expect(hero).toContain('The same volleyball landing on the upper stone tread')
    expect(hero).toContain('assets/ball-preview.png')
    expect(hero).not.toMatch(/data-stair-root|Release the ball|Catch\. Pull\.|Reset /)
    for (const stage of VOLEYEVENTS_LIFECYCLE) expect(hero).toContain(`href="#${stage.id}"`)
    expect(markup).not.toMatch(/playable-court|Scroll follows one participant|Separate full case|landing prototype/)
  })

  it('keeps the page free of eager graphics imports and retired rally code', () => {
    const markup = render()
    const source = readFileSync(
      new URL('./VoleyEvents.tsx', import.meta.url),
      'utf8',
    )

    expect(markup).not.toMatch(/<canvas|data-rally-|class="rally-/)
    expect(source).toContain("import { Staircase } from '../components/Staircase'")
    expect(source).not.toMatch(
      /\b(?:gsap|three|canvas|requestAnimationFrame)\b|rally|RuntimeBoundary/i,
    )
    expect(source).not.toMatch(/src\/playground|\.\.\/playground/)
  })

  it('preserves shared shell navigation on direct and trailing-slash routes', () => {
    for (const path of ['/gameonvb', '/gameonvb/']) {
      const markup = render(path)

      expect(markup).toContain('<nav aria-label="Primary"')
      expect(markup).toMatch(
        /<a(?=[^>]*href="\/gameonvb")(?=[^>]*aria-current="page")[^>]*>/,
      )
      expect(markup).toContain('<nav aria-label="Contact and CV"')
      expect(markup).toContain('href="mailto:tohoangviet1998@gmail.com"')
      expect(markup).toContain('href="/hoang-viet-to-cv-en.docx"')
      expect(markup).toContain('href="/hoang-viet-to-cv-cz.docx"')
      expect(markup).toContain('href="/">')
      expect(markup).toContain('href="/goal-loop"')
      expect(markup).toContain('Back to homepage')
      expect(markup).toContain('Next: Goal Loop')
      expect(markup).not.toMatch(/<canvas|data-rally-runtime/)
    }
  })

  it('keeps claims free of invented metrics, testimonials and unapproved media', () => {
    const content = JSON.stringify(VOLEYEVENTS)
    const markup = render()

    expect(content).not.toMatch(/\d|%|€|\$|£/)
    expect(content).not.toMatch(
      /customer quote|testimonial|players|payments total/i,
    )
    const story = markup.slice(markup.indexOf('class="case-section'))
    expect(story).not.toMatch(/<canvas|<video|data:image|dashboard screenshot|<img/i)
    expect(markup).not.toMatch(/<canvas|<video|dashboard screenshot/i)
    const images = [...markup.matchAll(/<img[^>]*src="([^"]+)"/g)].map(m => m[1])
    expect(images).toHaveLength(2)
    expect(images[0]).toMatch(/^data:image\/svg\+xml,/)
    expect(images[1]).toMatch(/\/assets\/ball-preview\.png$/)
  })
})
