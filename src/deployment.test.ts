import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const vercelSource = readFileSync(
  new URL('../vercel.json', import.meta.url),
  'utf8',
)
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

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
  })
})
