import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const css = readFileSync(new URL('./Calibre.css', import.meta.url), 'utf8')
const luminance = (hex: string) => {
  const rgb = hex.match(/\w\w/g)!.map(c => parseInt(c, 16) / 255)
  return rgb.reduce((sum, value, i) => sum + [0.2126, 0.7152, 0.0722][i] * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4), 0)
}

it('keeps every small calibre text color at WCAG AA against its gallery background', () => {
  const bg = css.match(/background:\s*#([a-f0-9]{6})/)![1]
  const muted = css.match(/--calibre-muted:\s*#([a-f0-9]{6})/)?.[1]
  for (const selector of ['.calibre-eyebrow', '.calibre-lede', '[data-calibre="motion"]', '.calibre-view-strip', '.calibre-part-card p', '.calibre-access', '.calibre-disclaimer', '.calibre-capability']) {
    const rule = css.slice(css.indexOf(selector), css.indexOf('}', css.indexOf(selector)))
    const color = rule.match(/(?:^|[;{])\s*color:\s*(#[a-f0-9]{6}|var\(--calibre-muted\))/)![1]
    const fg = color.startsWith('#') ? color.slice(1) : muted
    expect(fg, selector).toBeDefined()
    expect((luminance(bg) + .05) / (luminance(fg!) + .05), selector).toBeGreaterThanOrEqual(4.5)
  }
})
