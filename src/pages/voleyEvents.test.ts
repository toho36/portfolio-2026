import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { ROUTES } from '../content/routes'
import {
  VOLEYEVENTS,
  VOLEYEVENTS_LIFECYCLE,
} from '../content/voleyevents'

function render(path = '/voleyevents') {
  return renderToStaticMarkup(createElement(App, { initialPath: path }))
}

const operationsAsset = readFileSync(
  new URL('../../public/assets/voleyevents-operations.svg', import.meta.url),
  'utf8',
)

describe('VoleyEvents Match Operations case study', () => {
  it('opens with the sourced product identity and a descriptive route title', () => {
    const markup = render()
    const route = ROUTES.find(({ path }) => path === '/voleyevents')
    const hero = markup.slice(
      markup.indexOf('class="court-hero"'),
      markup.indexOf('class="case-section'),
    )

    expect(hero).toContain('VoleyEvents / Match operations')
    expect(hero).toContain(
      'Registration and operations software for recurring recreational volleyball events.',
    )
    expect(hero).toContain(
      'A registration and operations system for recurring recreational volleyball events.',
    )
    expect(route?.title).toBe(
      'VoleyEvents Match Operations — Hoang Viet To',
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
    expect(lifecycle.match(/class="participant-token"/g)).toHaveLength(1)
  })

  it('retains complete semantic stage content without relying on the illustration', () => {
    const markup = render()
    const lifecycle = markup.slice(
      markup.indexOf('<section id="lifecycle"'),
      markup.indexOf('class="case-pair case-closing"'),
    )

    expect(lifecycle).toContain('<ol class="lifecycle-track">')
    expect(lifecycle.match(/<li class="lifecycle-stage"/g)).toHaveLength(4)
    for (const stage of VOLEYEVENTS_LIFECYCLE) {
      expect(lifecycle).toContain(`id="${stage.id}"`)
      expect(lifecycle).toContain(`<h3>${stage.label}</h3>`)
      expect(lifecycle).toContain(stage.body)
      expect(stage.handles).not.toHaveLength(0)
    }
    expect(lifecycle).toMatch(/<div class="lifecycle-court" aria-hidden="true">/)
    expect(lifecycle).toContain('preserveAspectRatio="xMidYMid slice"')
    expect(lifecycle).not.toMatch(/<h3[^>]*aria-hidden|<p[^>]*aria-hidden/)
    expect(markup).toContain('src="/assets/voleyevents-operations.svg"')
  })

  it('keeps translation on the court lane separate from ball rotation', () => {
    const rally = operationsAsset.match(/@keyframes rally\s*\{([^@]+)\}/)?.[1]
    const spin = operationsAsset.match(/@keyframes spin\s*\{([^@]+)\}/)?.[1]

    expect(operationsAsset).toContain('class="ball-position"')
    expect(operationsAsset).toContain('class="lane" d="M150 490L490 150"')
    expect(rally).toBeDefined()
    expect(spin).toBeDefined()
    expect(rally).not.toContain('rotate(')
    expect(spin).not.toContain('translate(')
    expect(rally).toContain('translate(-55px, 55px)')
    expect(rally).toContain('translate(55px, -55px)')
    expect(operationsAsset).toContain(
      '.ball-position { transform: translate(170px, -170px) }',
    )
  })

  it('preserves shared shell navigation on direct and trailing-slash routes', () => {
    for (const path of ['/voleyevents', '/voleyevents/']) {
      const markup = render(path)

      expect(markup).toContain('<nav aria-label="Primary"')
      expect(markup).toMatch(
        /<a(?=[^>]*href="\/voleyevents")(?=[^>]*aria-current="page")[^>]*>/,
      )
      expect(markup).toContain('<nav aria-label="Contact and CV"')
      expect(markup).toContain('href="mailto:tohoangviet1998@gmail.com"')
      expect(markup).toContain('href="/hoang-viet-to-cv-en.docx"')
      expect(markup).toContain('href="/hoang-viet-to-cv-cz.docx"')
      expect(markup).toContain('href="/">')
      expect(markup).toContain('href="/goal-loop"')
      expect(markup).toContain('Back to homepage')
      expect(markup).toContain('Next: Goal Loop')
    }
  })

  it('keeps claims free of invented metrics, testimonials and media fixtures', () => {
    const content = JSON.stringify(VOLEYEVENTS)
    const markup = render()

    expect(content).not.toMatch(/\d|%|€|\$|£/)
    expect(content).not.toMatch(
      /customer quote|testimonial|players|payments total/i,
    )
    expect(markup).not.toMatch(/<canvas|<video|data:image|dashboard screenshot/i)
    expect(markup.match(/<img/g)).toHaveLength(1)
  })
})
