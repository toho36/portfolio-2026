import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Staircase } from '../components/Staircase'

const render = () => renderToStaticMarkup(createElement(Staircase, { landing: 0, onLanding: () => {} }))

describe('progressive staircase markup', () => {
  it('renders one accessible stage and native controls without creating canvas on the server', () => {
    const html = render()
    expect(html.match(/data-stair-root="true"/g)).toHaveLength(1)
    expect(html).toContain('data-stair-fallback="true"')
    expect(html).toContain('Interactive volleyball staircase')
    expect(html).toContain('Release the ball')
    expect(html).toContain('Reset')
    expect(html).toContain('role="status"')
    expect(html).toContain('Escape to cancel')
    expect(html).not.toContain('<canvas')
  })
  it('uses normal links to the four-stage story and states the toy boundary', () => {
    const html = render()
    for (const id of ['event-opens', 'payment-matches', 'attendance-resolves']) expect(html).toContain(`href="#${id}"`)
    expect(html).toContain('Event &amp; registration')
    expect(html).toContain('not a live event')
    expect(html).toContain('without playing')
    expect(html).toContain('aria-current="step"')
  })
})
