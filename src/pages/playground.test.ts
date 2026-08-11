import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../App'

function render(path = '/playground') {
  return renderToStaticMarkup(createElement(App, { initialPath: path }))
}

describe('Signal Relay Playground baseline', () => {
  it('renders the approved instruction and four labelled beats in order', () => {
    const markup = render()
    const expected = [
      {
        id: 'relay-input',
        title: 'INPUT',
        body: 'The signal enters along a straight warm-metal rail.',
      },
      {
        id: 'relay-fold',
        title: 'FOLD',
        body: 'The rail folds through three nested rings, crossing behind and in front to establish depth.',
      },
      {
        id: 'relay-feedback',
        title: 'FEEDBACK',
        body: 'A returning branch passes behind the assembly and bends back toward the input path.',
      },
      {
        id: 'relay-closed',
        title: 'CLOSED',
        body: 'The return aligns with its origin, closing the circuit for one complete signal path.',
      },
    ]

    expect(markup).toContain('<h1 id="relay-title">SIGNAL RELAY</h1>')
    expect(markup).toContain(
      'Scroll to route the signal. Reverse to rewind.',
    )
    expect(markup).toContain('class="relay-choreography"')

    expected.forEach((beat, index) => {
      expect(markup).toContain(
        `id="${beat.id}" class="relay-beat" aria-labelledby="${beat.id}-title"`,
      )
      expect(markup).toContain(`<h2 id="${beat.id}-title">${beat.title}</h2>`)
      expect(markup).toContain(beat.body)
      if (index > 0) {
        expect(markup.indexOf(beat.id)).toBeGreaterThan(
          markup.indexOf(expected[index - 1].id),
        )
      }
    })
  })

  it('keeps the authored SVG topology complete without runtime media', () => {
    const markup = render()
    const svg = markup.slice(markup.indexOf('<svg'), markup.indexOf('</svg>'))

    expect(svg).toMatch(
      /<svg[^>]*viewBox="0 0 960 720"[^>]*preserveAspectRatio="xMidYMid meet"[^>]*role="presentation"/,
    )
    expect(svg).toContain('aria-hidden="true"')
    expect(svg).toContain('class="relay-rail"')
    expect(svg.match(/class="relay-ring relay-ring-/g)).toHaveLength(3)
    expect(svg.indexOf('relay-return-back')).toBeLessThan(
      svg.indexOf('relay-ring relay-ring-outer'),
    )
    expect(svg.indexOf('relay-return-front')).toBeGreaterThan(
      svg.indexOf('relay-ring relay-ring-inner'),
    )
    expect(svg.match(/class="relay-signal relay-signal-/g)).toHaveLength(4)
    expect(svg).not.toMatch(/<(?:image|text|foreignObject|rect|ellipse|polygon)/i)
    expect(markup).not.toMatch(
      /<(?:canvas|video|picture)|data:image|\bGSAP\b|\bThree\.js\b|\bWebGL\b/,
    )
  })

  it('uses native controls with matching fragments and ordinary route links', () => {
    for (const path of ['/playground', '/playground/']) {
      const markup = render(path)

      expect(markup.match(/<nav aria-label="Beat navigation">/g)).toHaveLength(
        4,
      )
      expect(markup).toContain('>Previous beat</a>')
      expect(markup).toContain('>Next beat</a>')
      expect(markup).toContain('>Replay relay</a>')
      for (const fragment of markup.matchAll(/href="#([^"]+)"/g)) {
        expect(markup).toContain(`id="${fragment[1]}"`)
      }
      expect(markup).toContain('aria-label="Route navigation"')
      expect(markup).toContain('href="/goal-loop"')
      expect(markup).toContain('Back: Goal Loop')
      expect(markup).toContain('href="/"')
      expect(markup).toContain('Next: Homepage')
    }
  })
})
