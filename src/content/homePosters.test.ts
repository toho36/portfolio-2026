import { describe, expect, it } from 'vitest'
import { HOME_COPY, POSTERS } from './homePosters'

describe('home posters', () => {
  it('keeps seven approved posters in order', () => {
    expect(POSTERS.map((p) => p.index)).toEqual(['00', '01', '02', '03', '04', '05', '06'])
    expect(POSTERS.map((p) => p.heading)).toEqual([
      'New tools. Old standards.', 'Less organising. More time on court.', 'Shared codebases, shared standards.',
      'Speed with hard checks.', 'Interaction, studied closely.', 'Small tools, finished properly.', "Let's talk about your project.",
    ])
  })
  it('keeps the approved links and language', () => {
    expect(POSTERS.find((p) => p.id === 'solidpixels')?.href).toBeUndefined()
    expect(POSTERS.find((p) => p.id === 'tools')).toMatchObject({
      heading: 'Small tools, finished properly.',
      body: 'Screen Switch, a native macOS menu-bar utility that exchanges windows between displays.',
    })
    expect(POSTERS.find((p) => p.id === 'tools')?.href).toBeUndefined()
    expect(POSTERS.filter((p) => p.href?.startsWith('/')).map((p) => p.href)).toEqual(['/gameonvb', '/goal-loop', '/playground'])
    expect(POSTERS.map((p) => p.heading).join(' ')).not.toMatch(/\bAI\b/)
    expect(JSON.stringify({ POSTERS, HOME_COPY }).toLowerCase()).not.toMatch(/independent software systems builder|in use|czech/)
  })
})
