import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../App'

function render(path = '/playground') {
  return renderToStaticMarkup(createElement(App, { initialPath: path }))
}

describe('System Field Playground', () => {
  it('renders the approved instruction and four labelled beats in order', () => {
    const markup = render()
    const expected = [
      {
        id: 'relay-input',
        title: 'FLAT',
        body: 'Move across it. Tap it. Even a quiet surface can have a little attitude.',
      },
      {
        id: 'relay-fold',
        title: 'FOLD',
        body: 'Keep scrolling. The edges lift and the surface starts to wrap around you.',
      },
      {
        id: 'relay-feedback',
        title: 'TUNNEL',
        body: 'A flat surface becomes a place. Reverse your scroll to pull it apart.',
      },
      {
        id: 'relay-closed',
        title: 'FEEDBACK',
        body: 'Everything comes back around. Go again, or rewind it your own way.',
      },
    ]

    expect(markup).toContain('GO ON.')
    expect(markup).toContain('DISTURB IT.')
    expect(markup).toContain('Send a pulse')
    expect(markup).toContain(
      'Move across the field to send a wave. Scroll to fold the system; reverse to restore it.',
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

  it('renders the static 32 by 32 SVG fallback before runtime media', () => {
    const markup = render()
    const svg = markup.slice(markup.indexOf('<svg'), markup.indexOf('</svg>'))

    expect(svg).toMatch(
      /<svg[^>]*viewBox="0 0 960 720"[^>]*preserveAspectRatio="xMidYMid meet"[^>]*role="presentation"/,
    )
    expect(svg).toContain('aria-hidden="true"')
    expect(svg).toContain('data-system-field-fallback="true"')
    expect(svg).toContain('id="system-field-grid"')
    expect(svg).toContain('width="20" height="20"')
    expect(svg).toContain('class="system-field-node"')
    expect(svg).toContain('width="640" height="640"')
    expect(svg).toContain('fill="url(#system-field-grid)"')
    expect(svg).not.toMatch(/relay-(?:rail|ring|return|signal)/)
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
      expect(markup).toContain('>Replay field</a>')
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

  it('exposes one route lifecycle seam without shell reveal ownership', () => {
    const markup = render()

    expect(markup).toContain('data-relay-root="true"')
    expect(markup).toContain('data-relay-stage="true"')
    expect(markup).toContain('data-relay-beats="true"')
    expect(markup).toContain('data-relay-status="true"')
    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain('aria-atomic="true"')
    expect(markup).not.toContain('role="alert"')
    expect(markup).not.toContain('data-reveal')
  })

  it('labels every real fragment anchor with its discrete action', () => {
    const markup = render()

    expect(markup.match(/data-relay-action="previous"/g)).toHaveLength(3)
    expect(markup.match(/data-relay-action="next"/g)).toHaveLength(6)
    expect(markup.match(/data-relay-action="replay"/g)).toHaveLength(2)
    expect(markup.match(/class="target-link relay-beat-link"/g)).toHaveLength(
      11,
    )
  })
})
