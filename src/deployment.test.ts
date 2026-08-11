import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

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
  it('narrowly rewrites both flagship routes and trailing-slash forms', () => {
    const vercel = JSON.parse(vercelSource) as {
      outputDirectory: string
      rewrites: { source: string; destination: string }[]
    }

    expect(vercel.outputDirectory).toBe('dist')
    expect(vercel.rewrites).toEqual([
      { source: '/voleyevents', destination: '/index.html' },
      { source: '/voleyevents/', destination: '/index.html' },
      { source: '/goal-loop', destination: '/index.html' },
      { source: '/goal-loop/', destination: '/index.html' },
    ])
    expect(vercelSource).not.toMatch(/\/\(\.\*\)|:\w+\*|\/\*|404\.html/)
  })

  it('publishes systems-builder metadata without the old identity', () => {
    expect(indexSource).toMatch(/<title>[^<]*systems builder[^<]*<\/title>/i)
    expect(indexSource).toMatch(/name="description"[^>]*systems builder/i)
    expect(indexSource).toMatch(/property="og:title"[^>]*systems builder/i)
    expect(indexSource).toContain('"jobTitle": "Independent Software Systems Builder"')
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
      'https://portfolio-pied-eight-38.vercel.app/voleyevents',
      'https://portfolio-pied-eight-38.vercel.app/goal-loop',
    ])
    expect(robotsSource).toContain('User-agent: *\nAllow: /')
    expect(robotsSource).toContain(
      'Sitemap: https://portfolio-pied-eight-38.vercel.app/sitemap.xml',
    )
  })

  it('keeps a branded, accessible hosting-level 404', () => {
    expect(notFoundSource).toContain('<meta name="robots" content="noindex" />')
    expect(notFoundSource).toContain('<title>404 — Hoang Viet To</title>')
    expect(notFoundSource).toContain('<h1>Page not found.</h1>')
    expect(notFoundSource).toContain('<a href="/">Return to the portfolio</a>')
    expect(notFoundSource).toMatch(/a \{[^}]*min-height: 44px/s)
    expect(notFoundSource).not.toMatch(/Vitek Machine|Cartridge|machine/i)
  })
})
