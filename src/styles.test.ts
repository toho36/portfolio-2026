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

  it('uses the live GameOnVB purple and yellow palette', () => {
    const gameOnTheme = worlds.slice(
      worlds.indexOf('.route-voleyevents {'),
      worlds.indexOf('}', worlds.indexOf('.route-voleyevents {')) + 1,
    )

    expect(styles).toMatch(
      /\.route-voleyevents a:focus-visible,[\s\S]*outline-color:\s*oklch\(87\.7% \.176 92\.7\)/,
    )
    expect(worlds).toContain('--ink: oklch(16.4% .045 295.7)')
    expect(worlds).toContain('--signal: oklch(87.7% .176 92.7)')
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
  const mobileBreakpoint = styles.indexOf('@media (max-width: 760px)')
  const desktop = styles.slice(0, mobileBreakpoint)
  const mobile = styles.slice(mobileBreakpoint)

  it('retires the rally presentation without masking route overflow', () => {
    const route = styles.match(/\.voleyevents\s*\{([^}]+)\}/)?.[1]

    expect(route).toBeDefined()
    expect(route).not.toMatch(/overflow:\s*(?:hidden|clip)/)
    expect(styles).not.toMatch(/\.court-hero|\.rally-|data-rally-/)
    expect(styles).not.toContain('100vw')
  })

  it('alternates bounded desktop lifecycle reading zones', () => {
    expect(desktop).toMatch(
      /\.lifecycle-track\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    )
    expect(desktop).toMatch(
      /\.lifecycle-stage:nth-child\(odd\)\s*\{[^}]*width:\s*min\(72%,\s*52rem\)[^}]*justify-self:\s*start/,
    )
    expect(desktop).toMatch(
      /\.lifecycle-stage:nth-child\(even\)\s*\{[^}]*width:\s*min\(72%,\s*52rem\)[^}]*justify-self:\s*end/,
    )
  })

  it('uses one visible content column on mobile', () => {
    expect(mobile).toMatch(
      /\.lifecycle-track\s*\{[^}]*grid-template-columns:\s*1fr/,
    )
    expect(mobile).toMatch(
      /\.lifecycle-stage,[\s\S]*\.lifecycle-stage:nth-child\(odd\),[\s\S]*\.lifecycle-stage:nth-child\(even\)\s*\{[^}]*width:\s*100%[^}]*grid-template-columns:\s*1fr[^}]*justify-self:\s*stretch/,
    )
    expect(mobile).not.toMatch(
      /\.lifecycle-stage[^{]*\{[^}]*(?:display:\s*none|visibility:\s*hidden|opacity:\s*0(?:[;\s]))/,
    )
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

describe('poster home styles', () => {
  it('keeps poster content inset at desktop and mobile widths', () => {
    const desktop = styles.match(/\.poster\s*\{([^}]+)\}/)?.[1]
    const mobile = styles.slice(styles.lastIndexOf('@media (max-width: 760px)')).match(/\.poster\s*\{([^}]+)\}/)?.[1]
    const copy = [...styles.matchAll(/\.poster-copy\s*\{([^}]+)\}/g)].find((match) => match[1].includes('padding-inline: var(--poster-gutter)'))?.[1]
    expect(desktop).toMatch(/--poster-gutter:\s*clamp\(1\.25rem,\s*4vw,\s*4rem\)/)
    expect(mobile).toMatch(/--poster-gutter:\s*1\.25rem/)
    expect(copy).toMatch(/padding-inline:\s*var\(--poster-gutter\)/)
    expect(styles).toMatch(/\.poster-top\s*\{[^}]*margin-inline:\s*var\(--poster-gutter\)/)
  })
  it('gives every masked heading room for descenders without changing copy spacing', () => {
    const mask = [...styles.matchAll(/\.poster-title-mask\s*\{([^}]+)\}/g)].at(-1)?.[1]
    expect(mask).toMatch(/overflow:\s*hidden/)
    expect(mask).toMatch(/padding-bottom:\s*var\(--title-descent\)/)
    expect(mask).toMatch(/margin-bottom:\s*calc\(-1 \* var\(--title-descent\)\)/)
  })
  it('puts mobile poster copy before a growing visual slot', () => {
    const mobile = styles.slice(styles.lastIndexOf('@media (max-width: 760px)'), styles.lastIndexOf('@media (pointer: coarse)'))
    expect(mobile).toMatch(/\.poster-copy\s*\{[^}]*order:\s*2[^}]*margin-top:\s*0/)
    expect(mobile).toMatch(/\.poster-visual\s*\{[^}]*order:\s*3[^}]*min-height:\s*38svh/)
  })
  it('keeps a native snap track, static grain, selection, and focus', () => {
    expect(styles).toMatch(/\.poster-track\s*\{[^}]*scroll-snap-type:\s*x mandatory/)
    expect(styles).toMatch(/\.poster-track\.is-controlled\s*\{[^}]*scroll-snap-type:\s*none/)
    expect(styles).toMatch(/\.poster-track\.is-dragging\s*\{[^}]*user-select:\s*none/)
    expect(styles).toMatch(/\.home-slider::after\s*\{[^}]*pointer-events:\s*none/)
    expect(styles).toMatch(/\.route-home ::selection\s*\{[^}]*background:\s*#d9ff43/)
    expect(styles).toMatch(/\.route-home :is\(a, button, input, textarea, \[tabindex\]\):focus-visible\s*\{[^}]*outline:\s*2px solid/)
  })
  it('settles poster motion for reduced preference', () => {
    const reduced = styles.slice(styles.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduced).toContain('.poster-track')
    expect(reduced).toContain('animation: none')
    expect(reduced).toContain('transform: none')
  })
})

describe('Goal Loop reference and history styles', () => {
  it('keeps the graphite vocabulary scoped to Goal Loop', () => {
    const goalLoopRule = styles.match(/\.goal-loop\s*\{([^}]+)\}/)?.[1]

    expect(goalLoopRule).toBeDefined()
    expect(goalLoopRule).toMatch(/--run-field:/)
    expect(goalLoopRule).toMatch(/--run-ink:/)
    expect(goalLoopRule).toMatch(/--run-decision:/)
    expect(goalLoopRule).toMatch(/--run-evidence:/)
    for (const property of [
      '--run-field:',
      '--run-ink:',
      '--run-decision:',
      '--run-evidence:',
    ]) {
      expect(styles.split(property)).toHaveLength(2)
    }
    expect(goalLoopRule).not.toMatch(/--court-/)
  })

  it('retires the decorative trace, marker, and progress timeline', () => {
    expect(styles).not.toMatch(
      /run-trace|run-marker|run-block-mark|--run-progress/,
    )
  })

  it('renders status labels as text, not fake buttons', () => {
    const stageState = styles.match(/\.stage-state\s*\{([^}]+)\}/)?.[1]
    const runState = styles.match(/\.goal-loop \.run-state\s*\{([^}]+)\}/)?.[1]

    expect(stageState).toBeDefined()
    expect(runState).toBeDefined()
    expect(stageState).not.toMatch(/border:|background:/)
    expect(runState).not.toMatch(/border:|background:/)
  })

  it('contains definition copy on mobile', () => {
    const mobile = styles.slice(styles.indexOf('@media (max-width: 760px)'))

    expect(mobile).toMatch(
      /\.run-stage dl\s*\{[^}]*grid-template-columns:\s*1fr/,
    )
    expect(styles).toMatch(/\.run-stage\s*\{[^}]*min-width:\s*0/)
    expect(styles).toMatch(/\.run-stage dd\s*\{[^}]*overflow-wrap:\s*anywhere/)
    expect(styles).not.toContain('100vw')
  })

  it('keeps audited history geometry static and animates only its marker', () => {
    const keyframes = styles.slice(
      styles.indexOf('@keyframes run-history-mark-settle'),
      styles.indexOf(
        '@media (prefers-reduced-motion: no-preference)',
        styles.indexOf('@keyframes run-history-mark-settle'),
      ),
    )
    const beforeReducedMotion = styles.slice(
      0,
      styles.indexOf('@media (prefers-reduced-motion: reduce)'),
    )

    expect(keyframes).toMatch(/from\s*\{[^}]*opacity:[^}]*transform:/)
    expect(keyframes).toMatch(/to\s*\{[^}]*opacity:[^}]*transform:/)
    expect(keyframes).not.toMatch(/(?:left|top|width|height|animation):/)
    expect(styles).toMatch(
      /\.run-history-fill\s*\{[^}]*width:\s*calc\(var\(--after-scale\)\s*\*\s*1%\)/,
    )
    expect(styles).toMatch(
      /\.run-history-mark\s*\{[^}]*left:\s*calc\(var\(--after-scale\)\s*\*\s*1%\)/,
    )
    expect(beforeReducedMotion).not.toMatch(
      /\.run-history-(?:track|fill|values)\s*\{[^}]*animation:/,
    )
    expect(styles).toContain('view-timeline-name: --run-history-row')
    expect(styles).toMatch(
      /\.run-history-mark\s*\{[^}]*animation:\s*run-history-mark-settle linear both[^}]*animation-duration:\s*auto[^}]*animation-timeline:\s*--run-history-row/,
    )
  })

  it('settles history motion and stacks its values on mobile', () => {
    const mobile = styles.slice(styles.indexOf('@media (max-width: 760px)'))
    const reduced = styles.slice(
      styles.indexOf('@media (prefers-reduced-motion: reduce)'),
    )

    expect(mobile).toMatch(
      /\.run-history-values\s*\{[^}]*grid-template-columns:\s*1fr/,
    )
    expect(mobile).toMatch(/\.run-history-row\s*\{[^}]*min-width:\s*0/)
    expect(mobile).not.toContain('100vw')
    expect(reduced).toMatch(
      /\.run-history-mark\s*\{[^}]*opacity:\s*1[^}]*transform:\s*none\s*!important/,
    )
  })
})
