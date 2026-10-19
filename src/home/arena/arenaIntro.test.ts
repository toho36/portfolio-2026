import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../../App'

const render = (path: string) => renderToStaticMarkup(createElement(App, { initialPath: path }))
const stopText = (markup: string) =>
  [...markup.matchAll(/data-stop="(\d)"[^>]*>([\s\S]*?)<\/div>/g)].map(([, stop, body]) => [stop, body.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()])

describe('arena intro', () => {
  it('opens over a fresh homepage and keeps the page behind it inert', () => {
    const markup = render('/')
    expect(markup).toContain('class="arena arena-intro"')
    for (const landmark of ['<header', '<main', '<footer']) expect(markup).toMatch(new RegExp(`${landmark}[^>]*inert=""`))
    expect(markup.indexOf('arena-intro')).toBeGreaterThan(markup.indexOf('</footer>'))
  })

  it('never opens on other routes', () => {
    for (const path of ['/gameonvb', '/goal-loop', '/playground', '/missing']) {
      const markup = render(path)
      expect(markup).not.toContain('arena-intro')
      expect(markup).not.toMatch(/<main[^>]*inert/)
    }
  })

  it('shows the same stop copy as the 033 study', () => {
    const study = readFileSync(new URL('../../../sketches/033-arena/index.html', import.meta.url), 'utf8')
    expect(stopText(render('/'))).toEqual(stopText(study))
    expect(stopText(study)).toHaveLength(6)
  })
})

describe('arena intro loading', () => {
  it('releases the page when the player cannot load or mount', async () => {
    const { mountArenaIntro } = await import('./ArenaIntro')
    const hero = {} as HTMLElement
    for (const load of [() => Promise.reject(new Error('chunk')), () => Promise.resolve({ mountArena: () => { throw new Error('mount') } })]) {
      let exits = 0
      mountArenaIntro(hero, () => exits++, load)
      await new Promise((resolve) => setTimeout(resolve))
      expect(exits).toBe(1)
    }
    let exits = 0
    mountArenaIntro(hero, () => exits++, () => Promise.reject(new Error('late')))()
    await new Promise((resolve) => setTimeout(resolve))
    expect(exits).toBe(0)
  })
})
