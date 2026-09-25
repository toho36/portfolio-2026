import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../App'

const render = () => renderToStaticMarkup(createElement(App, { initialPath: '/playground' }))

describe('Wire Playground', () => {
  it('renders loader, mode HUD, hint and hidden fallback', () => {
    const markup = render()
    expect(markup).toContain('data-wire-state="loading"')
    expect(markup).toContain('data-wire-stage')
    expect(markup).toContain('data-wire-loader')
    expect(markup).toContain('Easy')
    expect(markup).toContain('Hard')
    expect(markup).toMatch(/click the handle|grab the handle/)
    expect(markup).toMatch(/data-wire-fallback[^>]*hidden/)
    expect(markup).toContain('The playground needs WebGL.')
    expect(markup).toContain('Sound on')
  })
  it('retires the old game copy', () => {
    const markup = render()
    for (const gone of ['DISTURB IT.', 'Send a pulse', 'data-pile', 'system-field'])
      expect(markup).not.toContain(gone)
  })
})
