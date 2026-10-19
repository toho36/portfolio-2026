import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { experimentFromHash } from './Playground'

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

describe('Playground experiment selection', () => {
  it.each([
    ['', 'hot-wire'], ['#hot-wire', 'hot-wire'], ['#giant-impact', 'giant-impact'],
    ['#unknown', 'hot-wire'], ['#main-content', 'hot-wire'], ['#giant-impact-extra', 'hot-wire'],
  ])('resolves %s to %s', (hash, experiment) => {
    expect(experimentFromHash(hash)).toBe(experiment)
  })

  it('offers native selection links, an h1 and a readable default title', () => {
    const markup = render()
    expect(markup).toContain('<h1 id="playground-title">Playground</h1>')
    expect(markup).toContain('<h2>Hot Wire</h2>')
    expect(markup).toContain('aria-label="Experiments"')
    expect(markup).toContain('href="/playground#hot-wire" aria-current="true"')
    expect(markup).toContain('href="/playground#giant-impact"')
    expect(markup).not.toContain('class="giant-impact-stage"')
  })

  it('direct giant-impact entry renders only its experiment and labelled fallback', () => {
    vi.stubGlobal('window', { location: { hash: '#giant-impact' } })
    try {
      const markup = render()
      expect(markup).toContain('<h2>Giant Impact</h2>')
      expect(markup).toContain('href="/playground#giant-impact" aria-current="true"')
      expect(markup).toContain('Static final state: blue Earth and a separate Moon in orbit')
      expect(markup).not.toContain('data-wire-stage')
      expect(markup).not.toContain('<iframe')
      expect(markup).toContain('not validated scientific physics')
      for (const credit of ['Solar System Scope / INOVE', 'https://creativecommons.org/licenses/by/4.0/', 'https://polyhaven.com/a/rock_face', 'https://polyhaven.com/license', 'resized to 1024', 'stylized derivative']) expect(markup).toContain(credit)
    } finally { vi.unstubAllGlobals() }
  })

  it('syncs native hash and history changes and removes both subscriptions', () => {
    const source = readFileSync(new URL('./Playground.tsx', import.meta.url), 'utf8')
    const effect = source.slice(source.indexOf('  useEffect(() => {') + '  useEffect(() => {'.length, source.indexOf('  }, [])'))
    const listeners = new Map<string, () => void>()
    const target = {
      location: { hash: '#giant-impact' },
      addEventListener: (key: string, callback: () => void) => listeners.set(key, callback),
      removeEventListener: (key: string) => listeners.delete(key),
    }
    const select = vi.fn()
    const cleanup = new Function('window', 'setExperiment', 'experimentFromHash', effect)(target, select, experimentFromHash)
    expect(select).toHaveBeenLastCalledWith('giant-impact')
    target.location.hash = '#hot-wire'; listeners.get('hashchange')!()
    expect(select).toHaveBeenLastCalledWith('hot-wire')
    target.location.hash = '#giant-impact'; listeners.get('popstate')!()
    expect(select).toHaveBeenLastCalledWith('giant-impact')
    cleanup()
    expect(listeners.size).toBe(0)
  })
})

describe('Playground studies', () => {
  it('lists the Lego Villa study with idea, tools and a full-page link', () => {
    const markup = render()
    expect(markup).toContain('Lego Villa')
    expect(markup).toContain('Built with')
    expect(markup).toContain('Blender')
    expect(markup).toContain('href="/playground/lego-villa/index.html"')
    expect(markup).toContain('src="/playground/lego-villa-poster.jpg"')
  })
})
