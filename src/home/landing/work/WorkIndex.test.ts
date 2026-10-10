import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createDominantMotion } from '../shared/landingMotion'
import { WorkIndex, WORK_ITEMS } from './WorkIndex'

function render(items = WORK_ITEMS, screenSwitchDemo?: ReturnType<typeof createElement>) {
  const coordinator = createDominantMotion()
  const html = renderToStaticMarkup(createElement(WorkIndex, { items, coordinator, screenSwitchDemo }))
  coordinator.dispose()
  return html
}

describe('selected work content', () => {
  it('keeps every contribution visible and exposes native keyboard controls and live selection', () => {
    const html = render()
    for (const item of WORK_ITEMS) expect(html).toContain(item.contribution)
    expect(html.match(/data-work-select/g)).toHaveLength(4)
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Selected: SolidPixels.')
    expect(html.match(/href="\/playground"/g)).toHaveLength(1)
  })
  it('renders SolidPixels only as text, with separate team result and personal contribution', () => {
    const html = render()
    expect(html).not.toContain('<img')
    expect(html).toContain('Team result vs. my part')
    expect(html).toContain('the platform and the client sites are team work; my contribution is the frontend, backend and integration work within them.')
    expect(html).not.toMatch(/CHYBÍ|placeholder|href="\/solidpixels"/)
  })
  it('uses real GameOnVB proof crops and only verified project destinations', () => {
    const game = WORK_ITEMS[1]
    const html = render([game])
    expect(html.match(/<img /g)).toHaveLength(3)
    expect(html).toContain('Reconstruction with demo data')
    expect(html).toContain('alt="Demo Player"')
    expect(html).toContain('href="/gameonvb"')
    expect(html).toContain('href="https://gameonvb.cz/"')
    expect(render([WORK_ITEMS[3]])).toContain('href="/goal-loop"')
  })
  it('mounts the Screen Switch slot exactly once outside the attachment frame', () => {
    const demo = createElement('button', null, 'Swap displays')
    const html = render([WORK_ITEMS[2]], demo)
    expect(html.match(/Swap displays/g)).toHaveLength(1)
    expect(html.indexOf('work-demo-slot')).toBeGreaterThan(html.indexOf('work-preview-text'))
    expect(html).not.toMatch(/<img|href="\/screen-switch"/)
    expect(render(WORK_ITEMS, demo)).not.toContain('Swap displays')
  })
})
