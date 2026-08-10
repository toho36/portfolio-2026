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

  it('does not use the Vitest-incompatible CSS raw import', () => {
    const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
    const main = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8')
    const test = readFileSync(new URL('./styles.test.ts', import.meta.url), 'utf8')

    expect(`${app}\n${main}\n${test}`).not.toMatch(/styles\.css\?raw/)
  })
})
