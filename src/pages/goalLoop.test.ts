import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../App'
import {
  GOAL_LOOP,
  GOAL_LOOP_OUTCOMES,
  GOAL_LOOP_REVISIONS,
  GOAL_LOOP_STAGES,
} from '../content/goalLoop'
import { ROUTES } from '../content/routes'

const SIMULATED_ARTIFACT_PATTERN =
  /(?:^|\n)\s*(?:\$|>|#)\s+\w|(?:^|\n)\s*[A-Z_]+=[^\n]+|command output|terminal output/i

function stringValues(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringValues)
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(stringValues)
  }
  return []
}

function containsSimulatedArtifact(values: readonly string[]) {
  return values.some((value) => SIMULATED_ARTIFACT_PATTERN.test(value))
}

function render(path = '/goal-loop') {
  return renderToStaticMarkup(createElement(App, { initialPath: path }))
}

describe('Goal Loop Run Anatomy case study', () => {
  it('opens with a plain-language delivery purpose and a descriptive title', () => {
    const markup = render()
    const route = ROUTES.find(({ path }) => path === '/goal-loop')
    const hero = markup.slice(
      markup.indexOf('class="run-hero"'),
      markup.indexOf('class="run-section run-problem"'),
    )

    expect(hero).toContain('Software delivery, run as a bounded system.')
    expect(hero).toContain(
      'Goal Loop turns a software goal into a bounded delivery run with separated roles, explicit evidence and a stop condition.',
    )
    expect(hero).not.toMatch(/provider|model|OpenAI|Anthropic|Gemini/i)
    expect(route?.title).toBe('Goal Loop Run Anatomy — Hoang Viet To')
  })

  it('renders the six run stages in exact semantic order', () => {
    const markup = render()
    const tape = markup.slice(
      markup.indexOf('<section id="run-tape"'),
      markup.indexOf('class="run-section run-optimization"'),
    )
    const labels = [
      'Plan',
      'Independent critique',
      'Implementation',
      'Deterministic checks',
      'Independent review',
      'Pass or block',
    ]

    expect(GOAL_LOOP_STAGES.map(({ label }) => label)).toEqual(labels)
    expect(tape).toContain('<ol class="run-track">')
    expect(tape.match(/<li class="run-stage"/g)).toHaveLength(6)
    labels.forEach((label) => expect(tape).toContain(`<h3>${label}</h3>`))
    labels.slice(1).forEach((label, index) => {
      expect(tape.indexOf(label)).toBeGreaterThan(tape.indexOf(labels[index]))
    })

    for (const stage of GOAL_LOOP_STAGES) {
      expect(tape).toContain(`id="${stage.id}"`)
      expect(tape).toContain(stage.input)
      expect(tape).toContain(stage.decision)
      expect(tape).toContain(stage.evidence)
      expect(tape).toContain(stage.stop)
    }
    expect(tape.match(/<dt>Input<\/dt>/g)).toHaveLength(6)
    expect(tape.match(/<dt>Decision<\/dt>/g)).toHaveLength(6)
    expect(tape.match(/<dt>Evidence<\/dt>/g)).toHaveLength(6)
    expect(tape.match(/<dt>Stop condition<\/dt>/g)).toHaveLength(6)
  })

  it('separates roles, shows bounded revisions, and pairs pass with blocked', () => {
    const markup = render()
    const tape = markup.slice(
      markup.indexOf('<section id="run-tape"'),
      markup.indexOf('class="run-section run-optimization"'),
    )
    const roles = GOAL_LOOP_STAGES.map(({ role }) => role)

    expect(new Set(roles).size).toBe(roles.length)
    expect(roles).toEqual([
      'Planner',
      'Independent critic',
      'Implementer',
      'Deterministic check suite',
      'Independent reviewer',
      'Stop gate',
    ])
    expect(tape.match(/class="run-revision"/g)).toHaveLength(3)
    expect(tape).toMatch(/Loops back to plan/i)
    expect(tape).toMatch(/Loops back to implementation/i)
    expect(tape.indexOf('run-revision')).toBeLessThan(
      tape.indexOf('id="outcome"'),
    )
    expect(tape).toMatch(
      /<div class="run-outcomes"[\s\S]*class="run-outcome run-outcome-pass"[\s\S]*>PASS<[\s\S]*class="run-outcome run-outcome-blocked"[\s\S]*>BLOCKED</,
    )
    expect(tape).toContain('id="blocked-path"')
    expect(tape).toMatch(/checkout stayed clean/i)
    expect(tape).toMatch(/stopped before checks/i)
  })

  it('frames optimization as measured latency, cost and reliability work', () => {
    const markup = render()
    const content = JSON.stringify(GOAL_LOOP)
    const optimization = markup.slice(
      markup.indexOf('class="run-section run-optimization"'),
      markup.indexOf('class="run-section run-boundary"'),
    )

    expect(optimization).toMatch(/latency/i)
    expect(optimization).toMatch(/cost per run/i)
    expect(optimization).toMatch(/reliability/i)
    expect(optimization).toMatch(/wall-clock duration|review iterations|block rate/i)
    expect(content).not.toMatch(/\d|%|€|\$|£|\bms\b|p95|tokens|req\/s/i)
    expect(content).not.toMatch(/AI magic|fully autonomous|self-improving/i)
  })

  it('keeps the full explanation semantic and free of simulated artifacts', () => {
    const markup = render()
    const content = stringValues([
      GOAL_LOOP,
      GOAL_LOOP_STAGES,
      GOAL_LOOP_REVISIONS,
      GOAL_LOOP_OUTCOMES,
    ])

    expect(markup.match(/class="run-marker"/g)).toHaveLength(1)
    expect(markup).toMatch(/<div class="run-trace" aria-hidden="true">/)
    expect(markup).toMatch(/<svg[^>]*role="presentation"/)
    expect(markup).toContain('class="run-trace-line" d="M24 0V1120"')
    expect(markup).not.toMatch(/<h[1-6][^>]*aria-hidden|<p[^>]*aria-hidden/)
    expect(markup).not.toMatch(/<canvas|<video|<img|data:image/i)
    expect(containsSimulatedArtifact(content)).toBe(false)
    expect(containsSimulatedArtifact(['$ npm test'])).toBe(true)
    expect(containsSimulatedArtifact(['Context\n> fake output'])).toBe(true)
  })

  it('preserves shell and exact case navigation on direct and trailing-slash routes', () => {
    for (const path of ['/goal-loop', '/goal-loop/']) {
      const markup = render(path)

      expect(markup).toContain('<nav aria-label="Primary"')
      expect(markup).toMatch(
        /<a(?=[^>]*href="\/goal-loop")(?=[^>]*aria-current="page")[^>]*>/,
      )
      expect(markup).toContain('<nav aria-label="Contact and CV"')
      expect(markup).toContain('href="mailto:tohoangviet1998@gmail.com"')
      expect(markup).toContain('href="/hoang-viet-to-cv-en.docx"')
      expect(markup).toContain('href="/hoang-viet-to-cv-cz.docx"')
      expect(markup).toContain('href="/voleyevents"')
      expect(markup).toContain('href="/"')
      expect(markup).toContain('Back: VoleyEvents')
      expect(markup).toContain('Next: Homepage')
    }
  })
})
