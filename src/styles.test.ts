import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const worlds = readFileSync(new URL('./worlds.css', import.meta.url), 'utf8')

describe('accessible typography-led styles', () => {
  it('lets the body fit a narrow viewport after scrollbar allocation', () => {
    expect(styles).toMatch(/body\s*\{[^}]*min-width:\s*0\s*;/)
  })

  it('gives every link target both 44px dimensions and inline padding', () => {
    const targetRule = styles.match(/\.target-link\s*\{([^}]+)\}/)?.[1]

    expect(targetRule).toBeDefined()
    expect(targetRule).toMatch(/min-width:\s*44px/)
    expect(targetRule).toMatch(/min-height:\s*44px/)
    expect(targetRule).toMatch(/padding-inline:\s*(?!0(?:[;\s]))/)
  })

  it('retains a visible focus outline for anchors and focusable targets', () => {
    expect(styles).toMatch(
      /a:focus-visible,[\s\S]*\[tabindex\]:focus-visible\s*\{[^}]*outline:\s*3px\s+solid/,
    )
  })

  it('settles the complete hierarchy under reduced motion', () => {
    const reduced = styles.slice(
      styles.indexOf('@media (prefers-reduced-motion: reduce)'),
      styles.indexOf('/* Homepage poster slider */'),
    )

    expect(reduced).toContain('opacity: 1')
    expect(reduced).toContain('transform: none')
    expect(reduced).toContain('animation: none')
    expect(reduced).not.toMatch(
      /display:\s*none|visibility:\s*hidden|height:\s*0(?:[;\s])/,
    )
  })

  it('uses the brand as mobile home beside three evenly spaced routes', () => {
    const mobile = styles.slice(styles.indexOf('@media (max-width: 760px)'))

    expect(mobile).toMatch(
      /\.site-header\s*\{[^}]*gap:\s*0\.5rem/,
    )
    expect(mobile).toMatch(
      /\.site-nav\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)[^}]*gap:\s*0\.5rem/,
    )
    expect(mobile).toMatch(
      /\.site-nav a\[href=["']\/["']\]\s*\{[^}]*display:\s*none/,
    )
    expect(mobile).toMatch(/\.site-nav a\s*\{[^}]*min-width:\s*0/)
    expect(mobile).not.toMatch(/\.brand\s*\{[^}]*display:\s*none/)
    expect(mobile).not.toMatch(
      /\.site-nav a\[href=["']\/(?:voleyevents|goal-loop|playground)["']\]\s*\{[^}]*display:\s*none/,
    )
  })

  it('uses the approved GameOnVB stone and warm-edge palette without changing other worlds', () => {
    const gameOnTheme = worlds.slice(
      worlds.indexOf('.route-voleyevents {'),
      worlds.indexOf('}', worlds.indexOf('.route-voleyevents {')) + 1,
    )

    expect(styles).toMatch(
      /\.route-voleyevents a:focus-visible,[\s\S]*outline-color:\s*oklch\(87\.7% \.176 92\.7\)/,
    )
    expect(gameOnTheme).toContain('--ink: #111211')
    expect(gameOnTheme).toContain('--signal: #d6b652')
    expect(gameOnTheme).not.toMatch(/#1246d3|#0c32a7|#d5f73b/)
  })

  it('does not use the Vitest-incompatible CSS raw import', () => {
    const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
    const main = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8')
    const test = readFileSync(new URL('./styles.test.ts', import.meta.url), 'utf8')

    expect(`${app}\n${main}\n${test}`).not.toMatch(/styles\.css\?raw/)
  })
})

describe('Wire Playground styles', () => {
  it('keeps touch gestures on the canvas and the hint visible on mobile', () => {
    const mobile = styles.slice(styles.indexOf('@media (max-width: 760px)'))
    expect(styles).toMatch(/\.wire-stage canvas\s*\{[^}]*touch-action:\s*none/)
    expect(mobile).toMatch(/\.wire-hint\s*\{[^}]*font-size:/)
    expect(styles).not.toMatch(/\.relay-|\.system-field/)
  })
})

describe('VoleyEvents lifecycle styles', () => {
  it('retires the rally presentation without masking route overflow', () => {
    const route = styles.match(/\.voleyevents\s*\{([^}]+)\}/)?.[1]

    expect(route).toBeDefined()
    expect(route).not.toMatch(/overflow:\s*(?:hidden|clip)/)
    expect(styles).not.toMatch(/\.court-hero|\.rally-|data-rally-/)
    expect(styles).not.toContain('100vw')
  })

  it('retires both independent decorative motion owners', () => {
    expect(styles).not.toMatch(
      /--lifecycle-progress|participant-advance|\.participant-token|\.lifecycle-court|\.volleyball-/,
    )
  })
})

describe('retired Home presentation', () => {
  it('removes the old hero and project-card selectors', () => {
    expect(styles).not.toMatch(
      /\.hero(?:\s|[>{.:#])|\.hero-(?:graphic|introduction)|\.flagship|\.side-quest|\.system-(?:copy|index|link)|\.(?:section-heading|compact-heading|unlinked-note)/,
    )
  })
})

describe('retired poster slider styles', () => {
  it('drops the old slider, pipeline, landing, and world selectors that nothing renders', () => {
    expect(styles + worlds).not.toMatch(
      /\.(?:poster|poster-(?:track|copy|top|title-mask|static-mark|visual|hint|cta|body|positioning|canvas-host)|home-(?:slider|cursor|loader|counter)|goal-(?:pipeline|stage|token|rail)|landing-page|stage-(?:state|heading)|world-(?:hero|section|portal))(?![\w-])/,
    )
  })
  it('keeps the home selection colour and focus ring', () => {
    expect(styles).toMatch(/\.route-home ::selection\s*\{[^}]*background:\s*#d9ff43/)
    expect(styles).toMatch(/\.route-home :is\(a, button, input, textarea, \[tabindex\]\):focus-visible\s*\{[^}]*outline:\s*2px solid/)
  })
})

describe('Goal Loop reference and history styles', () => {
  it('retires the decorative trace, marker, and progress timeline', () => {
    expect(styles).not.toMatch(
      /run-trace|run-marker|run-block-mark|--run-progress/,
    )
  })
})
