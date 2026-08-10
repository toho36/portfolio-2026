export const ROUTES = [
  {
    id: 'home',
    path: '/',
    label: 'Index',
    title: 'Hoang Viet To — independent software systems builder',
    description:
      'An independent software systems builder turning messy operations into reliable products and improving the loops that ship them.',
  },
  {
    id: 'voleyevents',
    path: '/voleyevents',
    label: 'VoleyEvents',
    title: 'VoleyEvents Match Operations — Hoang Viet To',
    description:
      'An operational product for recurring recreational volleyball events.',
  },
  {
    id: 'goal-loop',
    path: '/goal-loop',
    label: 'Goal Loop',
    title: 'Goal Loop — Hoang Viet To',
    description:
      'A bounded multi-model software delivery and optimization system.',
  },
] as const

export type Route = (typeof ROUTES)[number]
export type RoutePath = Route['path']

const ROUTE_PATHS = new Set<string>(ROUTES.map(({ path }) => path))

export function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/'
}

export function resolveRoute(pathname: string): Route {
  const normalized = normalizePathname(pathname)
  return ROUTES.find(({ path }) => path === normalized) ?? ROUTES[0]
}

interface RouteNavigationInput {
  readonly href: string
  readonly currentUrl: string
  readonly button: number
  readonly defaultPrevented: boolean
  readonly altKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
  readonly target: string
  readonly download: boolean
}

export function getRouteNavigationUrl(
  input: RouteNavigationInput,
): string | null {
  if (
    input.defaultPrevented ||
    input.button !== 0 ||
    input.altKey ||
    input.ctrlKey ||
    input.metaKey ||
    input.shiftKey ||
    input.download ||
    (input.target !== '' && input.target !== '_self')
  ) {
    return null
  }

  let current: URL
  let destination: URL

  try {
    current = new URL(input.currentUrl)
    destination = new URL(input.href, current)
  } catch {
    return null
  }

  const pathname = normalizePathname(destination.pathname)
  if (
    destination.origin !== current.origin ||
    destination.hash !== '' ||
    !ROUTE_PATHS.has(pathname)
  ) {
    return null
  }

  return `${pathname}${destination.search}`
}

export function pushRouteNavigation(
  destination: string,
  currentUrl: string,
  history: History,
): Route {
  const current = new URL(currentUrl)
  const target = new URL(destination, current)
  const currentRelative = `${normalizePathname(current.pathname)}${current.search}`

  if (destination !== currentRelative) {
    history.pushState(null, '', destination)
  }

  return resolveRoute(target.pathname)
}

export function subscribeToRouteChanges(
  target: Window,
  onRoute: (route: Route) => void,
): () => void {
  const onPopState = () => onRoute(resolveRoute(target.location.pathname))
  target.addEventListener('popstate', onPopState)
  return () => target.removeEventListener('popstate', onPopState)
}
