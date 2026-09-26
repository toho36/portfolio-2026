import { describe, expect, it } from 'vitest'
import { PROJECT_STORIES } from './projects'
import {
  ROUTES,
  getRouteNavigationUrl,
  pushRouteNavigation,
  resolveRoute,
  routeMetadata,
  subscribeToRouteChanges,
} from './routes'
import { CONTACT, FLAGSHIPS, SIDE_QUESTS } from './systems'

const ordinaryClick = {
  currentUrl: 'https://example.com/',
  button: 0,
  defaultPrevented: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  target: '',
  download: false,
}

describe('route records', () => {
  it('admits only the four ordinary routes and resolves safely', () => {
    expect(ROUTES.map(({ path }) => path)).toEqual([
      '/',
      '/gameonvb',
      '/goal-loop',
      '/playground',
    ])
    expect(resolveRoute('/gameonvb/').path).toBe('/gameonvb')
    expect(resolveRoute('/voleyevents/').path).toBe('/gameonvb')
    expect(resolveRoute('/goal-loop///').path).toBe('/goal-loop')
    expect(resolveRoute('/playground/').path).toBe('/playground')
    expect(resolveRoute('/unknown').path).toBe('/')
  })

  it('derives canonical metadata for every ordinary route', () => {
    expect(ROUTES.map(routeMetadata)).toEqual([
      {
        title: 'Hoang Viet To — Software Developer',
        description:
          "I adopt new tools early and hold their output to the same standard as my own, whether I'm shipping alone or with a team.",
        canonical: 'https://portfolio-pied-eight-38.vercel.app/',
      },
      {
        title: 'GameOnVB Match Operations — Hoang Viet To',
        description:
          'An operational product for recurring recreational volleyball events.',
        canonical: 'https://portfolio-pied-eight-38.vercel.app/gameonvb',
      },
      {
        title: 'Goal Loop Run Anatomy — Hoang Viet To',
        description:
          'A bounded, evidence-driven software delivery run with independent critique, deterministic checks, review and fail-closed outcomes.',
        canonical: 'https://portfolio-pied-eight-38.vercel.app/goal-loop',
      },
      {
        title: 'System Field Playground — Hoang Viet To',
        description:
          'An interactive field: send a pulse, fold its surface and rewind it with native scroll.',
        canonical: 'https://portfolio-pied-eight-38.vercel.app/playground',
      },
    ])
  })

  it('keeps truthful content and the unlinked side quest', () => {
    expect(FLAGSHIPS.map(({ name }) => name)).toEqual([
      'GameOnVB',
      'Goal Loop',
    ])
    expect(JSON.stringify([FLAGSHIPS, SIDE_QUESTS])).not.toMatch(
      /\b(?:TBD|TODO|placeholder|\d+%)\b/i,
    )
    expect(SIDE_QUESTS).toEqual([{
      name: 'Screen Switch',
      summary: PROJECT_STORIES['screen-switch'].preview,
    }])
  })
})

describe('route-link eligibility', () => {
  it('normalizes admitted trailing-slash routes while preserving queries', () => {
    expect(
      getRouteNavigationUrl({
        ...ordinaryClick,
        href: '/goal-loop/?source=index',
      }),
    ).toBe('/goal-loop?source=index')
    expect(
      getRouteNavigationUrl({
        ...ordinaryClick,
        href: '/playground/?beat=fold',
      }),
    ).toBe('/playground?beat=fold')
  })

  it('pushes only changed locations and subscribes cleanly to popstate', () => {
    const pushed: string[] = []
    const history = {
      pushState: (_data: unknown, _unused: string, url?: string | URL | null) =>
        pushed.push(String(url)),
    } as unknown as History

    expect(
      pushRouteNavigation(
        '/goal-loop?source=index',
        'https://example.com/',
        history,
      ).path,
    ).toBe('/goal-loop')
    pushRouteNavigation(
      '/goal-loop?source=index',
      'https://example.com/goal-loop/?source=index',
      history,
    )
    expect(pushed).toEqual(['/goal-loop?source=index'])

    let listener = () => {}
    let listening = false
    const windowTarget = {
      location: { pathname: '/gameonvb/' },
      addEventListener: (_type: string, next: () => void) => {
        listener = next
        listening = true
      },
      removeEventListener: (_type: string, next: () => void) => {
        if (listener === next) listening = false
      },
    } as unknown as Window
    let selected = '/'
    const unsubscribe = subscribeToRouteChanges(windowTarget, (route) => {
      selected = route.path
    })

    listener()
    expect(selected).toBe('/gameonvb')
    unsubscribe()
    expect(listening).toBe(false)
  })

  it('leaves downloads, fragments, external links, targets, and modified clicks native', () => {
    for (const href of CONTACT.filter(({ download }) => download).map(
      ({ href }) => href,
    )) {
      expect(
        getRouteNavigationUrl({
          ...ordinaryClick,
          href,
          download: true,
        }),
      ).toBeNull()
    }

    expect(
      getRouteNavigationUrl({ ...ordinaryClick, href: '/#flagships' }),
    ).toBeNull()
    expect(
      getRouteNavigationUrl({
        ...ordinaryClick,
        href: 'https://elsewhere.example/goal-loop',
      }),
    ).toBeNull()
    expect(
      getRouteNavigationUrl({
        ...ordinaryClick,
        href: '/goal-loop',
        target: '_blank',
      }),
    ).toBeNull()
    expect(
      getRouteNavigationUrl({
        ...ordinaryClick,
        href: '/goal-loop',
        metaKey: true,
      }),
    ).toBeNull()
    expect(
      getRouteNavigationUrl({ ...ordinaryClick, href: '/not-admitted' }),
    ).toBeNull()
  })
})
