import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GoalLoopPage } from './pages/GoalLoop'

describe('independent Goal Loop delivery contract', () => {
  it('keeps the kitchen story semantic and native in initial HTML', () => {
    const markup = renderToStaticMarkup(createElement(GoalLoopPage, { onNavigate: () => {} }))
    expect(markup).toContain('<h1 id="goal-loop-title">Quality first.<br/><em>Speed follows.</em></h1>')
    expect(markup).toMatch(/<a[^>]*href="\/"[^>]*><svg class="link-arrow arrow-left"[\s\S]*?<\/svg> <span class="link-label">Back to homepage<\/span><\/a>/)
    expect(markup).toContain('The pass · where plates are checked')
    expect(markup).toContain('If it cannot be fixed, it is not served, and everyone knows why.')
    expect(markup).toContain('with a set limit on rounds')
    expect(markup).not.toMatch(/<iframe\b|<canvas\b|<video\b|instrument-stepper|instrument-stage-panel|Simulate failed check|data-calibre|run-reference/)
    expect(markup.match(/class="k-pane(?: on)?"/g)).toHaveLength(5)
    expect(markup).toContain('href="/gameonvb"')
    expect(markup).toContain('href="/"')
  })
})
