import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createDominantMotion } from '../shared/landingMotion'
import { ScreenSwitch } from './ScreenSwitch'

describe('Screen Switch markup', () => {
  it('exposes a native keyboard/tap button, illustration label, and polite status', () => {
    const coordinator = createDominantMotion()
    const html = renderToStaticMarkup(createElement(ScreenSwitch, {
      coordinator, screens: ['Left display', 'Right display'], illustrationLabel: 'Illustration of the feature',
    }))
    expect(html).toContain('Illustration of the feature')
    expect(html).toContain('<button type="button"')
    expect(html).toContain('aria-label="Swap windows between displays"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Left display')
    expect(html).toContain('Right display')
    expect(html).toContain('Window A')
    expect(html).toContain('Window B')
    coordinator.dispose()
  })
})
