import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createDominantMotion } from '../shared/landingMotion'
import { Hero } from './Hero'
import { HERO_HEADLINE, HERO_INTRODUCTION, P1_CONTENT } from './content'

describe('Hero markup', () => {
  it('renders the approved copy and a static first step with four selectable tabs', () => {
    const coordinator = createDominantMotion()
    const html = renderToStaticMarkup(createElement(Hero, {
      coordinator, headline: HERO_HEADLINE, introduction: HERO_INTRODUCTION, lifecycle: P1_CONTENT,
    }))
    expect(html).toContain(HERO_HEADLINE)
    expect(html).toContain(HERO_INTRODUCTION)
    expect(html).toContain('<p class="landing-kicker">Software Developer</p>')
    expect(html).toContain('data-p1-step="1" data-p1-status="idle" data-p1-transitioning="false"')
    expect(html.match(/role="tab"/g)).toHaveLength(4)
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1)
    expect(html.match(/tabindex="-1"/g)).toHaveLength(3)
    expect(html).toContain('role="tabpanel"')
    expect(html).toContain('aria-live="polite" aria-atomic="true"')
    expect(html).toContain('Step 1 of 4: Event opens.')
    expect(html).toContain('Reconstruction with demo data')
    expect(html).toContain('>Play</button>')
    expect(html).toContain('href="#work"')
    expect(html).toContain('href="#contact"')
    expect(html).toContain('Before')
    expect(html).toContain('After')
    coordinator.dispose()
  })
})
