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
      markup.indexOf('class="court-entry"'),
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
    expect(lifecycle.match(/<li class="lifecycle-stage"/g)).toHaveLength(4)
    for (const stage of VOLEYEVENTS_LIFECYCLE) {
      expect(lifecycle).toContain(`id="${stage.id}"`)
      expect(lifecycle).toContain(`<h3>${stage.label}</h3>`)
      expect(lifecycle).toContain(stage.body)
      expect(stage.handles).not.toHaveLength(0)
    }
    expect(lifecycle).not.toMatch(/<h3[^>]*aria-hidden|<p[^>]*aria-hidden/)
  })

  it('offers the playable court before the complete story without gating it', () => {
    const markup = render()
    const hero = markup.slice(
      markup.indexOf('class="court-entry"'),
      markup.indexOf('class="case-section'),
    )

    expect(hero).toContain('class="court-entry-grid"')
    expect(hero).toContain('class="court-entry-copy"')
    expect(hero).toContain('class="gameonvb-kinetic-wordmark"')
    expect(hero).toContain('GAME<span>ON</span>VB')
    expect(hero).toMatch(/<h1 id="voleyevents-title">LESS\s*<br\/>\s*ADMIN\.\s*<br\/>\s*<span class="lime">MORE\s*<br\/>\s*PLAY\.<\/span><\/h1>/)
    expect(hero.match(/class="playable-court"/g)).toHaveLength(1)
    expect(hero.match(/class="playable-court__energy-ring"/g)).toHaveLength(3)
    expect(hero).toContain('class="playable-court__streaks"')
    expect(hero).toMatch(/<img(?=[^>]*src="\/assets\/gameonvb-ball\.png")(?=[^>]*aria-hidden="true")[^>]*>/)
    expect(hero).toContain('aria-label="Interactive volleyball court"')
    expect(hero).toContain('aria-label="Volleyball: drag to throw, or press Enter or Space to serve"')
    expect(hero).toMatch(/<button[^>]*>Serve the ball /)
    expect(hero).toMatch(/<button[^>]*>Reset /)
    expect(hero).toContain('data-contacts="0"')
    expect(hero).toContain('Court contacts')
    expect(hero).toContain('This session · toy only')
    expect(hero).toContain('href="#lifecycle"')
    expect(hero).toContain('Follow one registration')
    expect(markup).not.toContain('Scroll follows one participant')
  })

  it('reuses the court without canvas or retired rally imports', () => {
    const markup = render()
    const source = readFileSync(
      new URL('./VoleyEvents.tsx', import.meta.url),
      'utf8',
    )

    expect(markup).not.toMatch(/<canvas|data-rally-|class="rally-/)
    expect(source).toContain("import { PlayableCourt } from '../components/PlayableCourt'")
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
    expect(markup).not.toMatch(/<canvas|<video|data:image|dashboard screenshot/i)
    expect(markup.match(/<img/g)).toHaveLength(1)
  })
})
