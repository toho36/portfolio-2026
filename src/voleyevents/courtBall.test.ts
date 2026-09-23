import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createCourtBall, launchCourtBall, stepCourtBall } from './courtBall'

describe('court ball', () => {
  it('renders native court controls, honest contacts and an idle accessible fallback', async () => {
    const { PlayableCourt } = await import('../components/PlayableCourt')
    const html = renderToStaticMarkup(createElement(PlayableCourt))
    expect(html).toContain('data-motion="idle"')
    expect(html).toContain('data-contacts="0"')
    expect(html).toContain('role="status"')
    expect(html).toContain('Serve')
    expect(html).toContain('Reset')
    expect(html).toContain('toy only')
    expect(html).toContain('Enter or Space')
    expect(html.match(/<button /g)).toHaveLength(3)
  })

  it('renders the approved reusable GameOnVB ball asset', async () => {
    const { Volleyball } = await import('../components/Volleyball')
    const html = renderToStaticMarkup(createElement('div', null,
      createElement(Volleyball, { className: 'hero-ball' }), createElement(Volleyball)))
    expect(html.match(/src="\/assets\/gameonvb-ball\.png"/g)).toHaveLength(2)
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2)
    expect(html.match(/width="180"/g)).toHaveLength(2)
    expect(html.match(/height="180"/g)).toHaveLength(2)
    expect(html).not.toContain('<svg')
    expect(html).toContain('hero-ball')
  })

  it.each([1 / 30, 1 / 60, 1 / 144, 0.5])('stays finite and settles completely at dt=%s', (dt) => {
    let ball = launchCourtBall(createCourtBall(), 3, -3)
    for (let frame = 0; frame < 6000 && !ball.resting; frame++) {
      ball = stepCourtBall(Object.freeze(ball), dt)
      expect([ball.x, ball.y, ball.vx, ball.vy, ball.angle].every(Number.isFinite)).toBe(true)
      expect(ball.x >= 0 && ball.x <= 1 && ball.y >= 0 && ball.y <= 1).toBe(true)
    }
    expect(ball.resting).toBe(true)
    expect(ball.y).toBe(1)
    expect([ball.vx, ball.vy]).toEqual([0, 0])
    expect(ball.contacts).toBeGreaterThan(0)
    expect(ball.contacts).toBeLessThan(40)
    expect(stepCourtBall(ball, dt)).toEqual(ball)
  })

  it('counts the final landing once and never counts a resting placement', () => {
    const landing = stepCourtBall({ ...createCourtBall(), x: 0.5, y: 1, vy: 0.1, resting: false }, 1 / 60)
    expect(landing.contacts).toBe(1)
    expect(landing.resting).toBe(true)
    expect(stepCourtBall(landing, 1 / 60).contacts).toBe(1)
    expect(stepCourtBall({ ...createCourtBall(), y: 1 }, 1 / 60).contacts).toBe(0)
  })

  it('bounds long frames and ignores invalid or nonpositive dt', () => {
    const ball = Object.freeze(launchCourtBall(createCourtBall()))
    expect(stepCourtBall(ball, 10)).toEqual(stepCourtBall(ball, 0.032))
    for (const dt of [0, -1, NaN, Infinity]) expect(stepCourtBall(ball, dt)).toEqual(ball)
  })

  it.each([
    { x: 0.001, y: 0.5, vx: -2, vy: 0, axis: 'vx' },
    { x: 0.999, y: 0.5, vx: 2, vy: 0, axis: 'vx' },
    { x: 0.5, y: 0.001, vx: 0, vy: -2, axis: 'vy' },
    { x: 0.5, y: 0.999, vx: 0, vy: 2, axis: 'vy' },
  ] as const)('reflects an incoming ball and counts the $axis boundary contact at $x,$y', (motion) => {
    const initial = Object.freeze({ ...createCourtBall(), ...motion, resting: false })
    const next = stepCourtBall(initial, 1 / 60)
    expect(next[motion.axis] * initial[motion.axis]).toBeLessThan(0)
    expect(Math.abs(next[motion.axis])).toBeLessThan(2)
    expect(next.contacts).toBe(1)
    expect(next.x).toBeGreaterThanOrEqual(0)
    expect(next.x).toBeLessThanOrEqual(1)
    expect(next.y).toBeGreaterThanOrEqual(0)
    expect(next.y).toBeLessThanOrEqual(1)
    expect(initial.contacts).toBe(0)
  })

  it('launches a resting ball upward without changing the frozen input', () => {
    const initial = Object.freeze(createCourtBall())
    const launched = launchCourtBall(initial)
    expect(launched.vy).toBeLessThan(0)
    expect(launched.vx).not.toBe(0)
    expect(launched.resting).toBe(false)
    expect(initial).toEqual(createCourtBall())
  })
})
