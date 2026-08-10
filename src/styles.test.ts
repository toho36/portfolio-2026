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

  it('contains all three primary links inside the mobile header', () => {
    const mobile = styles.slice(styles.indexOf('@media (max-width: 760px)'))

    expect(mobile).toMatch(
      /\.site-nav\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
    )
    expect(mobile).toMatch(/\.site-nav a\s*\{[^}]*min-width:\s*0/)
  })

  it('does not use the Vitest-incompatible CSS raw import', () => {
    const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
    const main = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8')
    const test = readFileSync(new URL('./styles.test.ts', import.meta.url), 'utf8')

    expect(`${app}\n${main}\n${test}`).not.toMatch(/styles\.css\?raw/)
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

  it('grows the trace and advances its marker on a reversible view timeline', () => {
    const keyframes = styles.slice(
      styles.indexOf('@keyframes run-marker-advance'),
      styles.indexOf(
        '@media (prefers-reduced-motion: no-preference)',
        styles.indexOf('@keyframes run-marker-advance'),
      ),
    )

    expect(styles).toContain('view-timeline-name: --run-progress')
    expect(styles).toMatch(
      /\.run-trace-line\s*\{[^}]*stroke-dasharray:\s*960[^}]*stroke-dashoffset:\s*0/,
    )
    expect(styles).toMatch(
      /\.run-trace-line\s*\{[^}]*animation:\s*run-trace-grow linear both[^}]*animation-duration:\s*auto[^}]*animation-timeline:\s*--run-progress/,
    )
    expect(styles).toMatch(
      /\.run-marker\s*\{[^}]*animation:\s*run-marker-advance linear both[^}]*animation-duration:\s*auto[^}]*animation-timeline:\s*--run-progress/,
    )
    expect(styles).toMatch(
      /\.run-marker\s*\{[^}]*transform:\s*translateY\(960px\)/,
    )
    expect(keyframes).toMatch(/from\s*\{[^}]*transform:/)
    expect(keyframes).toMatch(/to\s*\{[^}]*transform:/)
    expect(keyframes).not.toMatch(/(?:left|top|width|height):/)
    expect(keyframes).toMatch(
      /@keyframes run-trace-grow\s*\{[\s\S]*from\s*\{[^}]*stroke-dashoffset:\s*960[\s\S]*to\s*\{[^}]*stroke-dashoffset:\s*0/,
    )
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
    expect(reduced).toMatch(
      /\.run-trace-line\s*\{[^}]*animation:\s*none\s*!important[^}]*stroke-dashoffset:\s*0/,
    )
  })
})
