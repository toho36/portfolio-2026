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

  it('offers Skip to work and native Contact alongside the controls from the first chapter', () => {
    const markup = render('/')
    const intro = markup.slice(markup.indexOf('class="arena arena-intro"'))
    const controls = intro.match(/<nav aria-label="Six chapters">([\s\S]*?)<\/nav>/)?.[1]
    expect(controls).toBeDefined()
    expect(controls).toMatch(/<button id="skip" type="button">Skip to work<\/button>/)
    expect(controls).toMatch(/<a\b[^>]*href="\/#contact">Contact<\/a>/)
    expect(controls).not.toMatch(/\s(hidden|inert)="/)
    expect(intro.match(/id="skip"/g)).toHaveLength(1)
    expect(intro.match(/href="\/#contact"/g)).toHaveLength(1)
    expect(intro).not.toContain('<form')
    expect(markup.match(/<form /g)).toHaveLength(1)
  })

  it('never opens on other routes', () => {
    for (const path of ['/gameonvb', '/goal-loop', '/playground', '/missing']) {
      const markup = render(path)
      expect(markup).not.toContain('arena-intro')
      expect(markup).not.toMatch(/<main[^>]*inert/)
    }
  })

  it('stacks status messages and navigation in one height-aware control group', () => {
    const group = render('/').match(/<div class="intro-controls">([\s\S]*?)<\/nav><\/div>/)?.[1]
    expect(group).toContain('id="finding"')
    expect(group).toContain('id="error"')
    const css = readFileSync(new URL('./arena.css', import.meta.url), 'utf8')
    expect(css).toContain('.arena .intro-controls nav{position:static}')
    expect(css).toContain('.arena .intro-controls .finding,.arena .intro-controls .error{position:static;')
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
