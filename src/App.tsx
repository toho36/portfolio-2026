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
import { ArenaIntro } from './home/arena/ArenaIntro'
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
  return source !== destination && ['/', '/gameonvb', '/goal-loop'].includes(source) && ['/', '/gameonvb', '/goal-loop'].includes(destination)
}

export function focusHomeContact(doc: Document) {
  const contact = doc.getElementById('contact')
  if (!contact || contact.closest('[inert]') || doc.querySelector('.ball-entry[open], .goal-entry[open]')) return
  const header = doc.querySelector('.site-header')
  contact.style.scrollMarginTop = `${Math.ceil(header?.getBoundingClientRect().height ?? 0) + 16}px`
  contact.tabIndex = -1
  contact.focus({ preventScroll: true })
  contact.scrollIntoView({ behavior: 'instant', block: 'start' })
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
  // The arena intro opens only on a fresh homepage load, never after in-app navigation.
  const [introOpen, setIntroOpen] = useState(() => route.path === '/' && !unknownPath && (typeof window === 'undefined' || window.location.hash !== '#contact'))
  const showIntro = introOpen && route.path === '/' && !unknownPath
  const closeIntro = useCallback((focusMain = true) => {
    // Commit first so the main landmark is no longer inert when it takes focus.
    flushSync(() => setIntroOpen(false))
    if (focusMain) document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [])

  const onNavigate = useCallback((event: MouseEvent<HTMLElement>, navigationAnchor?: HTMLAnchorElement) => {
    const anchor = navigationAnchor ?? event.currentTarget as HTMLAnchorElement
    const contactExit = anchor.getAttribute('href') === '/#contact' && ['/gameonvb', '/goal-loop'].includes(normalizePathname(window.location.pathname))
    const routeDestination = getRouteNavigationUrl({
      href: contactExit ? '/' : anchor.getAttribute('href') ?? '',
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

    if (!routeDestination) return
    const destination = contactExit ? '/#contact' : routeDestination

    if (anchor.closest('.site-header') && ['/gameonvb', '/goal-loop'].includes(new URL(destination, window.location.href).pathname)) return

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
    let frame = 0
    const contact = () => {
      if (window.location.pathname !== '/' || window.location.hash !== '#contact') return
      if (document.getElementById('main-content')?.inert) closeIntro(false)
      focusHomeContact(document)
    }
    const restore = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(contact) })
    }
    document.addEventListener('homecontactready', contact)
    window.addEventListener('hashchange', contact)
    window.addEventListener('load', restore)
    window.addEventListener('pageshow', restore)
    if (document.readyState === 'complete') restore()
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('homecontactready', contact)
      window.removeEventListener('hashchange', contact)
      window.removeEventListener('load', restore)
      window.removeEventListener('pageshow', restore)
    }
  }, [closeIntro])

  useEffect(() => {
    return subscribeToRouteChanges(window, (next) => {
      const path = normalizePathname(window.location.pathname)
      setUnknownPath(path !== '/voleyevents' && !ROUTES.some((route) => route.path === path))
      setRoute(next)
    })
  }, [])

  useEffect(() => {
    if (unknownPath) {
      document.title = 'Page not found — Hoang Viet To'
      document.querySelector('meta[name="description"]')?.setAttribute('content', "This page doesn't exist.")
    } else applyRouteMetadata(document, route)
  }, [route, unknownPath])

  useEffect(() => {
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

  return (
    <div id="top" className={`site-shell route-${route.id}`}>
      <a className="skip-link target-link" href="#main-content" inert={showIntro || undefined}>
        Skip to content
      </a>

      <header className="site-header" inert={showIntro || undefined} hidden={!unknownPath && (route.path === '/gameonvb' || route.path === '/goal-loop')}>
        <RouteLink
          className="brand"
          currentPath={unknownPath ? undefined : route.path}
          href="/"
          onNavigate={onNavigate}
        >
          <span>Hoang Viet To</span>
        </RouteLink>
        <a className="target-link header-contact" href="/#contact" onClick={onNavigate}>Contact</a>
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
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} inert={showIntro || undefined}>{routeContent}</main>

      <footer inert={showIntro || undefined}>
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

      {/* Fixed overlay; last in source order so the skip link stays the first stop. */}
      {showIntro ? <ArenaIntro onClose={closeIntro} onNavigate={onNavigate} /> : null}
    </div>
  )
}
