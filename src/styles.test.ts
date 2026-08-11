import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('accessible typography-led styles', () => {
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

  it('keeps VoleyEvents focus and footer hover visible on the light shell', () => {
    expect(styles).toMatch(
      /\.route-voleyevents a:focus-visible,[\s\S]*outline-color:\s*#1557ff/,
    )
    expect(styles).toMatch(
      /\.route-voleyevents \.contact-nav a:hover\s*\{[^}]*color:\s*#1557ff/,
    )
  })

  it('does not use the Vitest-incompatible CSS raw import', () => {
    const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
    const main = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8')
    const test = readFileSync(new URL('./styles.test.ts', import.meta.url), 'utf8')

    expect(`${app}\n${main}\n${test}`).not.toMatch(/styles\.css\?raw/)
  })
})

describe('Signal Relay baseline styles', () => {
  it('owns only route scroll behavior and keeps lifecycle content visible', () => {
    expect(styles).toMatch(
      /html\.relay-scroll-owner\s*\{[^}]*scroll-behavior:\s*auto\s*!important/,
    )
    expect(styles).toMatch(/\.relay-status\s*\{[^}]*min-height:/)
    expect(styles).toMatch(/\.relay-live-region\s*\{[^}]*position:\s*absolute/)
    expect(styles).not.toContain('100vw')
  })

  it('keeps one sticky responsive SVG stage inside the choreography', () => {
    expect(styles).toMatch(
      /\.relay-choreography\s*\{[^}]*position:\s*relative[^}]*min-width:\s*0/,
    )
    expect(styles).toMatch(
      /\.relay-stage\s*\{[^}]*position:\s*sticky[^}]*overflow:\s*hidden/,
    )
    expect(styles).toMatch(
      /\.relay-stage svg\s*\{[^}]*width:\s*100%[^}]*height:\s*auto[^}]*min-height:[^}]*overflow:\s*hidden/,
    )
    expect(styles).not.toContain('100vw')
  })

  it('uses only the approved shell tokens for relay material and signal', () => {
    expect(styles).toMatch(/\.relay-rail\s*\{[^}]*stroke:\s*currentcolor/)
    expect(styles).toMatch(/\.relay-ring\s*\{[^}]*stroke:\s*var\(--line\)/)
    expect(styles).toMatch(/\.relay-return\s*\{[^}]*stroke:\s*var\(--focus\)/)
    expect(styles).toMatch(/\.relay-signal\s*\{[^}]*fill:\s*var\(--signal\)/)
  })

  it('reserves separate mobile zones for the relay copy and complete SVG', () => {
    const mobile = styles.slice(styles.indexOf('@media (max-width: 760px)'))

    expect(mobile).toMatch(/\.relay-stage\s*\{[^}]*place-items:\s*end center/)
    expect(mobile).toMatch(
      /\.relay-stage svg\s*\{[^}]*width:\s*min\(100%,\s*26rem\)[^}]*height:\s*auto[^}]*min-height:\s*0[^}]*max-height:\s*45%/,
    )
    expect(mobile).toMatch(
      /\.relay-beat\s*\{[^}]*width:\s*min\(100%,\s*27rem\)[^}]*min-height:\s*82svh[^}]*align-content:\s*start[^}]*padding-block:\s*3rem[^}]*padding-inline:\s*1\.25rem[^}]*background:\s*none/,
    )
    expect(mobile).not.toMatch(
      /\.relay-stage svg\s*\{[^}]*(?:display:\s*none|visibility:\s*hidden|opacity:\s*0(?:[;\s]))/,
    )
    expect(mobile).not.toMatch(
      /\.relay-beat\s*\{[^}]*(?:display:\s*none|visibility:\s*hidden|opacity:\s*0(?:[;\s]))/,
    )
    expect(mobile).not.toMatch(/\.relay-stage\s*\{[^}]*(?:position:|z-index:)/)
    expect(mobile).not.toMatch(/\.relay-beat\s*\{[^}]*linear-gradient/)
  })

  it('retains the desktop relay gradient and sticky stage contract', () => {
    const mobileBreakpoint = styles.indexOf('@media (max-width: 760px)')
    const desktop = styles.slice(0, mobileBreakpoint)
    const mobile = styles.slice(mobileBreakpoint)

    expect(desktop).toMatch(
      /\.relay-beat\s*\{[^}]*background:\s*linear-gradient\(90deg,\s*transparent,\s*var\(--ink\)\s*18%\)/,
    )
    expect(desktop).toMatch(
      /\.relay-stage\s*\{[^}]*position:\s*sticky[^}]*z-index:\s*0[^}]*top:\s*5\.5rem[^}]*place-items:\s*center/,
    )
    expect(mobile).toMatch(/\.relay-stage\s*\{[^}]*top:\s*10rem/)
  })

  it('keeps the accepted stage and copy zones intact under reduced motion', () => {
    const reduced = styles.slice(
      styles.indexOf('@media (prefers-reduced-motion: reduce)'),
    )

    expect(reduced).toMatch(
      /\.relay-stage,[\s\S]*\.relay-beat\s*\{[^}]*opacity:\s*1[^}]*transform:\s*none/,
    )
    expect(reduced).not.toMatch(
      /\.(?:relay-stage|relay-beat)[^{]*\{[^}]*(?:display:\s*none|visibility:\s*hidden|height:\s*0(?:[;\s]))/,
    )
  })
})

describe('VoleyEvents lifecycle styles', () => {
  it('enhances one settled participant token with a reversible view timeline', () => {
    const keyframes = styles.slice(
      styles.indexOf('@keyframes participant-advance'),
      styles.indexOf(
        '@media (prefers-reduced-motion: no-preference)',
        styles.indexOf('@keyframes participant-advance'),
      ),
    )

    expect(styles).toContain('@supports (animation-timeline: view())')
    expect(styles).toContain('animation-timeline: --lifecycle-progress')
    expect(styles).toContain('animation-range: entry 0% exit 100%')
    expect(styles).toMatch(
      /\.participant-token\s*\{[^}]*animation:\s*participant-advance linear both[^}]*animation-duration:\s*auto[^}]*animation-timeline:\s*--lifecycle-progress/,
    )
    expect(styles).toMatch(
      /\.participant-token\s*\{[^}]*transform:\s*translateY\(656px\)/,
    )
    expect(keyframes).toMatch(/from\s*\{[^}]*transform:/)
    expect(keyframes).toMatch(/to\s*\{[^}]*transform:/)
    expect(keyframes).not.toMatch(/(?:left|top|width|height):/)
  })

  it('keeps the lifecycle stacked and contained on mobile', () => {
    const mobile = styles.slice(styles.indexOf('@media (max-width: 760px)'))

    expect(mobile).toMatch(
      /\.lifecycle-stage\s*\{[^}]*grid-template-columns:\s*1fr/,
    )
    expect(mobile).toMatch(
      /\.lifecycle-layout\s*\{[^}]*grid-template-columns:\s*minmax\(4\.5rem,\s*5\.5rem\)\s+minmax\(0,\s*1fr\)/,
    )
    expect(mobile).toMatch(
      /\.lifecycle-court svg\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/,
    )
    expect(styles).toMatch(
      /\.lifecycle-court svg\s*\{[^}]*min-height:\s*55rem[^}]*overflow:\s*hidden/,
    )
    expect(styles).not.toContain('100vw')
  })

  it('settles the participant token under reduced motion', () => {
    const reduced = styles.slice(
      styles.indexOf('@media (prefers-reduced-motion: reduce)'),
    )

    expect(reduced).toMatch(
      /\.participant-token\s*\{[^}]*opacity:\s*1[^}]*transform:\s*translateY\(656px\)\s*!important/,
    )
  })
})

describe('mobile-first case-study hero composition', () => {
  const mobileBreakpoint = styles.indexOf('@media (max-width: 760px)')
  const desktop = styles.slice(0, mobileBreakpoint)
  const mobile = styles.slice(mobileBreakpoint)

  it('starts both case-study heroes promptly and places the court graphic after the CTA', () => {
    expect(mobile).toMatch(
      /\.court-hero,\s*\.goal-loop \.run-hero\s*\{[^}]*min-height:\s*auto[^}]*align-content:\s*start/,
    )
    expect(mobile).toMatch(
      /\.court-hero-graphic\s*\{[^}]*position:\s*static[^}]*grid-row:\s*5[^}]*grid-column:\s*1[^}]*justify-self:\s*end[^}]*width:\s*min\(48vw,\s*11rem\)[^}]*margin-top:\s*1rem[^}]*opacity:\s*0\.76/,
    )
    expect(mobile).not.toMatch(
      /\.court-hero-graphic\s*\{[^}]*display:\s*none/,
    )
  })

  it('retains the desktop hero clamps and absolute court graphic', () => {
    expect(desktop).toMatch(
      /\.court-hero\s*\{[^}]*min-height:\s*clamp\(36rem,\s*78svh,\s*51rem\)[^}]*align-content:\s*end/,
    )
    expect(desktop).toMatch(
      /\.goal-loop \.run-hero\s*\{[^}]*min-height:\s*clamp\(36rem,\s*78svh,\s*52rem\)[^}]*align-content:\s*end/,
    )
    expect(desktop).toMatch(
      /\.court-hero-graphic\s*\{[^}]*position:\s*absolute[^}]*width:\s*min\(42vw,\s*38rem\)/,
    )
  })
})

describe('Goal Loop run-trace styles', () => {
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

  it('keeps the trace stable and advances only its marker on a reversible view timeline', () => {
    const keyframes = styles.slice(
      styles.indexOf('@keyframes run-marker-advance'),
      styles.indexOf(
        '@media (prefers-reduced-motion: no-preference)',
        styles.indexOf('@keyframes run-marker-advance'),
      ),
    )

    expect(styles).toContain('view-timeline-name: --run-progress')
    const traceLine = styles.match(/\.goal-loop \.run-trace-line\s*\{([^}]+)\}/)?.[1]

    expect(traceLine).toBeDefined()
    expect(traceLine).not.toMatch(/stroke-dasharray|stroke-dashoffset/)
    expect(styles).not.toContain('@keyframes run-trace-grow')
    expect(
      styles.slice(0, styles.indexOf('@media (prefers-reduced-motion: reduce)')),
    ).not.toMatch(/\.run-trace-line\s*\{[^}]*animation:/)
    expect(styles).toMatch(
      /\.run-marker\s*\{[^}]*animation:\s*run-marker-advance linear both[^}]*animation-duration:\s*auto[^}]*animation-timeline:\s*--run-progress/,
    )
    expect(styles).toContain('animation-range: entry 0% exit 100%')
    expect(styles).toMatch(
      /\.run-marker\s*\{[^}]*transform:\s*translateY\(960px\)/,
    )
    expect(keyframes).toMatch(/from\s*\{[^}]*transform:/)
    expect(keyframes).toMatch(/to\s*\{[^}]*transform:/)
    expect(keyframes).not.toMatch(/(?:left|top|width|height):/)
  })

  it('renders status labels as text, not fake buttons', () => {
    const stageState = styles.match(/\.stage-state\s*\{([^}]+)\}/)?.[1]
    const runState = styles.match(/\.goal-loop \.run-state\s*\{([^}]+)\}/)?.[1]

    expect(stageState).toBeDefined()
    expect(runState).toBeDefined()
    expect(stageState).not.toMatch(/border:|background:/)
    expect(runState).not.toMatch(/border:|background:/)
  })

  it('contains the trace and definition copy on mobile', () => {
    const mobile = styles.slice(styles.indexOf('@media (max-width: 760px)'))

    expect(mobile).toMatch(
      /\.run-tape-layout\s*\{[^}]*grid-template-columns:\s*minmax\(3\.5rem,\s*4\.5rem\)\s+minmax\(0,\s*1fr\)/,
    )
    expect(mobile).toMatch(
      /\.run-stage dl\s*\{[^}]*grid-template-columns:\s*1fr/,
    )
    expect(styles).toMatch(/\.run-stage\s*\{[^}]*min-width:\s*0/)
    expect(styles).toMatch(/\.run-stage dd\s*\{[^}]*overflow-wrap:\s*anywhere/)
    expect(styles).not.toContain('100vw')
  })

  it('settles the final marker under reduced motion', () => {
    const reduced = styles.slice(
      styles.indexOf('@media (prefers-reduced-motion: reduce)'),
    )

    expect(reduced).toMatch(
      /\.run-marker\s*\{[^}]*opacity:\s*1[^}]*transform:\s*translateY\(960px\)\s*!important/,
    )
    expect(reduced).not.toMatch(/\.run-trace-line\s*\{/)
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
