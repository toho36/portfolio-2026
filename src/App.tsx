import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import {
  ROUTES,
  getRouteNavigationUrl,
  normalizePathname,
  pushRouteNavigation,
  resolveRoute,
  routeMetadata,
  subscribeToRouteChanges,
  type Route,
  type RoutePath,
} from './content/routes'
import { flushSync } from 'react-dom'
import { CONTACT } from './content/systems'
import { LightTable } from './home/lightTable/LightTable.jsx'
import { LandingPage } from './home/landing/LandingPage'
import { PlaygroundPage } from './pages/Playground'

interface AppProps {
  readonly initialPath?: string
}

interface RouteLinkProps {
  readonly children: ReactNode
  readonly className?: string
  readonly currentPath?: RoutePath
  readonly href: RoutePath
  readonly onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void
}

function RouteLink({
  children,
  className = '',
  currentPath,
  href,
  onNavigate,
}: RouteLinkProps) {
  return (
    <a
      className={`target-link ${className}`.trim()}
      href={href}
      aria-current={currentPath === href ? 'page' : undefined}
      onClick={onNavigate}
    >
      {children}
    </a>
  )
}

export function installRevealMotion(
  root: HTMLElement,
  elements: readonly HTMLElement[],
  Observer: typeof IntersectionObserver | undefined,
): () => void {
  root.classList.remove('motion-ready')
  elements.forEach((element) => element.classList.remove('is-settled'))

  if (!Observer || elements.length === 0) {
    return () => root.classList.remove('motion-ready')
  }

  let observer: IntersectionObserver | undefined

  const cleanup = () => {
    observer?.disconnect()
    root.classList.remove('motion-ready')
    elements.forEach((element) => element.classList.remove('is-settled'))
  }

  try {
    observer = new Observer((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-settled')
        observer?.unobserve(entry.target)
      })
    }, { threshold: 0.12 })
    elements.forEach((element) => observer?.observe(element))
    root.classList.add('motion-ready')
  } catch {
    cleanup()
  }

  return cleanup
}

export function applyRouteMetadata(doc: Document, route: Route) {
  const metadata = routeMetadata(route)

  doc.title = metadata.title
  doc
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', metadata.description)
  doc
    .querySelector('link[rel="canonical"]')
    ?.setAttribute('href', metadata.canonical)
  doc
    .querySelector('meta[property="og:url"]')
    ?.setAttribute('content', metadata.canonical)
}

export function selectHomeTransition(hasVisual: boolean, reducedMotion: boolean, visible: boolean, hasViewTransitions: boolean) {
  if (!hasVisual || reducedMotion || !visible) return 'plain'
  return hasViewTransitions ? 'shared' : 'curtain'
}

export function isLightTablePair(from: string, to: string) {
  const source = normalizePathname(from), destination = normalizePathname(to)
  return source !== destination && ['/gameonvb', '/goal-loop'].includes(source) && ['/gameonvb', '/goal-loop'].includes(destination)
}

export function restoreLandingHash(doc: Document, hash: string) {
  if (!hash) return
  try {
    doc.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: 'instant' })
  } catch { /* An invalid fragment has no target. */ }
}

export default function App({ initialPath }: AppProps) {
  const [unknownPath, setUnknownPath] = useState(() => {
    const path = normalizePathname(initialPath ?? (typeof window === 'undefined' ? '/' : window.location.pathname))
    return path !== '/voleyevents' && !ROUTES.some((route) => route.path === path)
  })
  const [route, setRoute] = useState(() =>
    resolveRoute(
      initialPath ??
        (typeof window === 'undefined' ? '/' : window.location.pathname),
    ),
  )

  const onNavigate = useCallback((event: MouseEvent<HTMLElement>, navigationAnchor?: HTMLAnchorElement) => {
    const anchor = navigationAnchor ?? event.currentTarget as HTMLAnchorElement
    const destination = getRouteNavigationUrl({
      href: anchor.getAttribute('href') ?? '',
      currentUrl: window.location.href,
      button: event.button,
      defaultPrevented: event.defaultPrevented,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      target: anchor.target,
      download: anchor.hasAttribute('download'),
    })

    if (!destination) return

    event.preventDefault()
    const livePair = isLightTablePair(window.location.pathname, new URL(destination, window.location.href).pathname)
    const navigate = () => {
      setUnknownPath(false)
      const sourcePath = normalizePathname(window.location.pathname)
      const nextRoute = pushRouteNavigation(destination, window.location.href, window.history)
      if (sourcePath === '/' && (nextRoute.path === '/goal-loop' || nextRoute.path === '/gameonvb')) {
        window.history.replaceState({ ...window.history.state, lightTableFromHome: true }, '', window.location.href)
      }
      setRoute(nextRoute)
      if (!livePair) {
        document.getElementById('main-content')?.focus({ preventScroll: true })
        window.scrollTo({ top: 0, behavior: 'instant' })
      }
    }
    if (livePair) { navigate(); return }
    const visual = anchor.closest('.poster')?.querySelector<HTMLElement>('.poster-visual')
    const transition = selectHomeTransition(!!visual, window.matchMedia('(prefers-reduced-motion: reduce)').matches, document.visibilityState === 'visible', !!document.startViewTransition)
    if (transition === 'shared' && visual) {
      visual.dataset.transitioning = 'true'
      visual.style.viewTransitionName = 'poster-visual'
      const clearName = () => { visual.style.viewTransitionName = ''; delete visual.dataset.transitioning }
      void document.startViewTransition(() => flushSync(navigate)).finished.then(clearName, clearName)
    } else if (transition === 'curtain') {
      document.documentElement.dataset.curtain = 'cover'
      window.setTimeout(() => {
        navigate()
        document.documentElement.dataset.curtain = 'reveal'
        window.setTimeout(() => { delete document.documentElement.dataset.curtain }, 200)
      }, 200)
    } else navigate()
  }, [])

  useEffect(() => {
    return subscribeToRouteChanges(window, (next) => {
      const path = normalizePathname(window.location.pathname)
      setUnknownPath(path !== '/voleyevents' && !ROUTES.some((route) => route.path === path))
      setRoute(next)
    })
  }, [])

  useEffect(() => {
    if (route.path === '/' && !unknownPath) restoreLandingHash(document, window.location.hash)
  }, [route.path, unknownPath])

  useEffect(() => {
    if (unknownPath) {
      document.title = 'Page not found — Hoang Viet To'
      document.querySelector('meta[name="description"]')?.setAttribute('content', "This page doesn't exist.")
    } else applyRouteMetadata(document, route)
  }, [route, unknownPath])

  useEffect(() => {
    if (route.path === '/' && !unknownPath) return
    const root = document.documentElement
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let removeMotion = () => root.classList.remove('motion-ready')

    const applyMotionPreference = () => {
      removeMotion()
      const reveals = Array.from(
        document.querySelectorAll<HTMLElement>('[data-reveal]'),
      )

      if (media.matches) {
        reveals.forEach((element) => element.classList.remove('is-settled'))
        return
      }

      removeMotion = installRevealMotion(
        root,
        reveals,
        window.IntersectionObserver,
      )
    }

    applyMotionPreference()
    media.addEventListener('change', applyMotionPreference)

    return () => {
      media.removeEventListener('change', applyMotionPreference)
      removeMotion()
    }
  }, [route.path, unknownPath])

  let routeContent: ReactNode
  if (unknownPath) routeContent = <section className="not-found"><p className="poster-kicker">404 / Not found</p><h1>This page doesn't exist.</h1><a className="target-link" href="/" onClick={onNavigate}>Back home <span aria-hidden="true">↗</span></a></section>
  else switch (route.path) {
    case '/':
      routeContent = <LandingPage />
      break
    case '/gameonvb':
    case '/goal-loop':
      routeContent = <LightTable pathname={route.path} onNavigate={onNavigate} />
      break
    case '/playground':
      routeContent = <PlaygroundPage onNavigate={onNavigate} />
      break
    default: {
      const exhaustiveRoute: never = route
      routeContent = exhaustiveRoute
    }
  }

  const landing = route.path === '/' && !unknownPath

  return (
    <div id="top" className={`site-shell route-${route.id}${landing ? ' landing-page' : ''}`}>
      <a className="skip-link target-link" href="#main-content">
        Skip to content
      </a>

      <header className={`site-header${landing ? ' landing-header' : ''}`}>
        <RouteLink
          className="brand"
          currentPath={unknownPath ? undefined : route.path}
          href="/"
          onNavigate={onNavigate}
        >
          <span>Hoang Viet To</span>
        </RouteLink>
        {route.path === '/' && !unknownPath ? <span className="home-role">Software Developer</span> : null}
        <nav aria-label="Primary" className="site-nav">
          {ROUTES.map((item) => (
            <RouteLink
              currentPath={unknownPath ? undefined : route.path}
              href={item.path}
              key={item.path}
              onNavigate={onNavigate}
            >
              {item.label}
            </RouteLink>
          ))}
          {landing && <><a className="target-link" href="#work">Work</a><a className="target-link" href="#contact">Contact</a></>}
        </nav>
        {landing && <span className="landing-nav-hint" aria-hidden="true">Scroll navigation →</span>}
      </header>

      <main id="main-content" tabIndex={-1} onClick={landing ? event => {
        const anchor = (event.target as Element).closest<HTMLAnchorElement>('a')
        if (anchor && event.currentTarget.contains(anchor)) onNavigate(event, anchor)
      } : undefined}>{routeContent}</main>

      <footer className={landing ? 'landing-footer' : undefined}>
        <p>
          Hoang Viet To <span aria-hidden="true">/</span> Software Developer
        </p>
        <nav aria-label="Contact and CV" className="contact-nav">
          {CONTACT.map((link) => (
            <a
              className="target-link"
              download={link.download}
              href={link.href}
              key={link.label}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <a className="target-link text-link" href="#top">
          Return to top <span aria-hidden="true">↑</span>
        </a>
      </footer>
    </div>
  )
}
