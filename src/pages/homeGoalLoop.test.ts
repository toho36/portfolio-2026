import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomePage } from './Home'

describe('Goal Loop poster', () => {
  it('renders a readable five-stage flow, repair return, verdict and caption in the visual slot', () => {
    const markup = renderToStaticMarkup(createElement(HomePage, { onNavigate: () => {} }))
    const goal = markup.slice(markup.indexOf('data-poster="goal-loop"'), markup.indexOf('data-poster="playground"'))
    expect(goal).toContain('class="goal-pipeline"')
    expect(goal.match(/class="goal-stage(?: goal-verdict)?"/g)).toHaveLength(6)
    for (const label of ['Plan', 'Critique', 'Build', 'Check', 'Review', 'Verdict', '✕ Check failed', 'Repair', 'PASS']) expect(goal).toContain(label)
    for (const index of ['01', '02', '03', '04', '05']) expect(goal).toContain(`>${index}</span>`)
    expect(goal).toContain('Every change passes each check, or it goes back for repair.')
    expect(goal).toContain('<dl class="poster-facts"><div><dt>What I own</dt><dd>I set the goal, the rules and the checks.</dd></div>')
    expect(goal).toContain('href="/goal-loop">Read the Goal Loop case study<span aria-hidden="true">↗</span></a>')
  })
})
