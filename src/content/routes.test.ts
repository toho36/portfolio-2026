import { describe, expect, it } from 'vitest'
import { PROJECT_STORIES } from './projects'
import {
  ROUTES,
  getRouteNavigationUrl,
  pushRouteNavigation,
  resolveRoute,
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
  it('admits only the three ordinary routes and resolves safely', () => {
    expect(ROUTES.map(({ path }) => path)).toEqual([
      '/',
      '/voleyevents',
      '/goal-loop',
    ])
    expect(resolveRoute('/voleyevents/').path).toBe('/voleyevents')
    expect(resolveRoute('/goal-loop///').path).toBe('/goal-loop')
    expect(resolveRoute('/unknown').path).toBe('/')
  })

  it('keeps truthful content and only the verified side-quest URLs', () => {
    expect(FLAGSHIPS.map(({ name }) => name)).toEqual([
      'VoleyEvents',
      'Goal Loop',
    ])
    expect(JSON.stringify([FLAGSHIPS, SIDE_QUESTS])).not.toMatch(
      /\b(?:TBD|TODO|placeholder|\d+%)\b/i,
    )
    expect(SIDE_QUESTS.map(({ url }) => url)).toEqual([
      PROJECT_STORIES.gameonvb.verifiedUrl,
      PROJECT_STORIES['screen-switch'].verifiedUrl,
      PROJECT_STORIES.suburbs.verifiedUrl,
    ])
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
      location: { pathname: '/voleyevents/' },
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
    expect(selected).toBe('/voleyevents')
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
