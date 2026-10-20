import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
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

describe('Playground experiments', () => {
  it('shows Hot Wire under an h1 and keeps the slow Giant Impact hidden', () => {
    vi.stubGlobal('window', { location: { hash: '#giant-impact' } })
    try {
      const markup = render()
      expect(markup).toContain('<h1 id="playground-title">Playground</h1>')
      expect(markup).toContain('<h2>Hot Wire</h2>')
      expect(markup).not.toMatch(/Giant Impact|giant-impact/)
    } finally { vi.unstubAllGlobals() }
  })
})

describe('Playground studies', () => {
  it('lists the Villa study with idea, tools and a full-page link', () => {
    const markup = render()
    expect(markup).toContain('<h3>Villa</h3>')
    expect(markup).toContain('3D scroll animation')
    expect(markup).not.toContain('Lego')
    expect(markup).toContain('Built with')
    expect(markup).toContain('Blender')
    expect(markup).toContain('href="/playground/lego-villa/index.html"')
    expect(markup).toContain('src="/playground/lego-villa-poster.jpg"')
  })
})
