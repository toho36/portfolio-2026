import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomePage } from './Home'

describe('Goal Loop poster', () => {
  it('renders the ticket run: five stations, the failed check, PASS and the audited benchmark', () => {
    const markup = renderToStaticMarkup(createElement(HomePage, { onNavigate: () => {} }))
    const goal = markup.slice(markup.indexOf('data-poster="goal-loop"'), markup.indexOf('data-poster="playground"'))
    expect(goal).toContain('class="ticket-run"')
    for (const role of ['Plan', 'Critic', 'Build', 'Check', 'Review']) expect(goal).toContain(`<span class="ticket-station-role">${role}</span>`)
    expect(goal).toContain('aria-label="A task ticket moves through Plan, Critic, Build, Check and Review. One test fails at Check, it goes back to Build, then passes."')
    // Without motion the end state renders: every station passed and the ticket stamped.
    expect(goal.match(/data-stamp="ok"/g)).toHaveLength(5)
    expect(goal).toMatch(/class="ticket" data-passed="true"/)
    expect(goal).toContain('39.4 → 4.8<span>min</span>')
    expect(goal).toContain('one audited change set · 395 → 403 tests, all passing')
    expect(goal).not.toContain('Run it again') // replay control only exists once motion is armed
  })
})
