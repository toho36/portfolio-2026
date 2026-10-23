import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ROUTES, routeMetadata } from './content/routes'

const vercelSource = readFileSync(
  new URL('../vercel.json', import.meta.url),
  'utf8',
)
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const sitemapSource = readFileSync(
  new URL('../public/sitemap.xml', import.meta.url),
  'utf8',
)
const robotsSource = readFileSync(
  new URL('../public/robots.txt', import.meta.url),
  'utf8',
)
const notFoundSource = readFileSync(
  new URL('../public/404.html', import.meta.url),
  'utf8',
)

describe('static deployment configuration', () => {
  it('narrowly rewrites all three non-root routes and trailing-slash forms', () => {
    const vercel = JSON.parse(vercelSource) as {
      outputDirectory: string
      redirects: { source: string; destination: string; permanent: boolean }[]
      rewrites: { source: string; destination: string }[]
    }

    expect(vercel.outputDirectory).toBe('dist')
    expect(vercel.redirects).toEqual([
      { source: '/voleyevents', destination: '/gameonvb', permanent: true },
      { source: '/voleyevents/', destination: '/gameonvb', permanent: true },
    ])
    expect(vercel.rewrites).toEqual([
      { source: '/gameonvb', destination: '/index.html' },
      { source: '/gameonvb/', destination: '/index.html' },
      { source: '/goal-loop', destination: '/index.html' },
      { source: '/goal-loop/', destination: '/index.html' },
      { source: '/playground', destination: '/index.html' },
      { source: '/playground/', destination: '/index.html' },
    ])
    expect(vercelSource).not.toMatch(/\/\(\.\*\)|:\w+\*|\/\*|404\.html/)
  })

  it('publishes the same home metadata as the app', () => {
    const home = routeMetadata(ROUTES[0])
    expect(indexSource).toContain(`<title>${home.title}</title>`)
    expect(indexSource).toContain(`name="description" content="${home.description}"`)
    expect(indexSource).toContain(`property="og:title" content="${home.title}"`)
    expect(indexSource).toContain(`property="og:description" content="${home.description}"`)
    expect(indexSource).toContain(`name="twitter:title" content="${home.title}"`)
    expect(indexSource).toContain(`name="twitter:description" content="${home.description}"`)
    const structured = JSON.parse(indexSource.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])
    expect(structured).toMatchObject({
      name: home.title,
      description: home.description,
      url: home.canonical,
      mainEntity: { name: 'Hoang Viet To', jobTitle: 'Software Developer' },
    })
    expect(indexSource).not.toMatch(/Frontend \/ Full-Stack Developer/i)
    expect(indexSource).toContain('name="twitter:card" content="summary"')
    expect(indexSource).not.toMatch(/og:image|og-image\.webp|summary_large_image/)
  })

  it('lists every public route and advertises the sitemap to crawlers', () => {
    const locations = [...sitemapSource.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      ([, location]) => location,
    )

    expect(locations).toEqual([
      'https://portfolio-pied-eight-38.vercel.app/',
      'https://portfolio-pied-eight-38.vercel.app/gameonvb',
      'https://portfolio-pied-eight-38.vercel.app/goal-loop',
      'https://portfolio-pied-eight-38.vercel.app/playground',
    ])
    expect(robotsSource).toContain('User-agent: *\nAllow: /')
    expect(robotsSource).toContain(
      'Sitemap: https://portfolio-pied-eight-38.vercel.app/sitemap.xml',
    )
  })

  it('keeps a branded, accessible hosting-level 404', () => {
    expect(notFoundSource).toContain('<meta name="robots" content="noindex" />')
    const home = routeMetadata(ROUTES[0])
    expect(notFoundSource).toContain(`<title>404 — ${home.title}</title>`)
    expect(notFoundSource).toContain(`name="description" content="${home.description}"`)
    expect(notFoundSource).toContain(`<p>${home.title}</p>`)
    expect(notFoundSource).toContain(`<p>${home.description}</p>`)
    expect(notFoundSource).toContain('<h1>Page not found.</h1>')
    expect(notFoundSource).toContain('<a href="/">Return to the portfolio</a>')
    expect(notFoundSource).toMatch(/a \{[^}]*min-height: 44px/s)
    expect(notFoundSource).not.toMatch(/Vitek Machine|Cartridge|machine/i)
  })
})
