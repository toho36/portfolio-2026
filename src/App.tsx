import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
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
import { Arrow } from './components/Arrow'
import { beginNavigation, crossFadeProjects, focusHomeFragment, isHomeFragment } from './navigation'
export { beginNavigation, crossFadeProjects } from './navigation'

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

export function isLightTablePair(from: string, to: string) {
  const source = normalizePathname(from), destination = normalizePathname(to)
  return source !== destination && ['/', '/gameonvb', '/goal-loop'].includes(source) && ['/', '/gameonvb', '/goal-loop'].includes(destination)
}

export function isProjectSwitch(from: string, to: string) {
  const source = normalizePathname(from), destination = normalizePathname(to), projects = ['/gameonvb', '/goal-loop']
  return source !== destination && projects.includes(source) && projects.includes(destination)
}


export function focusHomeContact(doc: Document) {
  focusHomeFragment(doc, '#contact')
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
  const [introOpen, setIntroOpen] = useState(() => route.path === '/' && !unknownPath && (typeof window === 'undefined' || !isHomeFragment(window.location.hash)))
  const showIntro = introOpen && route.path === '/' && !unknownPath
  const shownPath = useRef(route.path)
  const shownAnimatedEntry = useRef(typeof window !== 'undefined' && window.history?.state?.lightTableFromHome === true)
  const pendingPageFocus = useRef<false | 'top' | 'preserve'>(false)
  useEffect(() => { shownPath.current = route.path; shownAnimatedEntry.current = window.history.state?.lightTableFromHome === true }, [route])
  const closeIntro = useCallback((focusMain = true) => {
    // Commit first so the main landmark is no longer inert when it takes focus.
    flushSync(() => setIntroOpen(false))
    if (focusMain) document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [])

  const onNavigate = useCallback((event: MouseEvent<HTMLElement>, navigationAnchor?: HTMLAnchorElement) => {
    const anchor = navigationAnchor ?? event.currentTarget as HTMLAnchorElement
    const routeDestination = getRouteNavigationUrl({
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

    if (!routeDestination) return
    const destination = routeDestination

    event.preventDefault()
    const current = beginNavigation()
    const livePair = isLightTablePair(window.location.pathname, new URL(destination, window.location.href).pathname)
    const authored = livePair && !anchor.closest('.site-header') && !new URL(destination, window.location.href).hash && !isProjectSwitch(window.location.pathname, destination) && (normalizePathname(window.location.pathname) === '/' ? !!anchor.closest('.sheet-cta, .table-footer') : window.history.state?.lightTableFromHome === true)
    const navigate = () => {
      setUnknownPath(false)
      setIntroOpen(false)
      if (isHomeFragment(new URL(destination, window.location.href).hash)) document.dispatchEvent(new Event('homefragmentnavigate'))
      const sourcePath = normalizePathname(window.location.pathname)
      const nextRoute = pushRouteNavigation(destination, window.location.href, window.history)
      if (authored && sourcePath === '/' && (nextRoute.path === '/goal-loop' || nextRoute.path === '/gameonvb')) {
        window.history.replaceState({ ...window.history.state, lightTableFromHome: true }, '', window.location.href)
      }
      pendingPageFocus.current = authored ? false : 'top'
      setRoute({ ...nextRoute })
    }
    if (authored) navigate()
    else crossFadeProjects(() => { if (current()) navigate() }, document)
  }, [])

  useLayoutEffect(() => {
    const header = document.querySelector<HTMLElement>('.site-header')
    const shell = header?.closest<HTMLElement>('.site-shell')
    if (!header || !shell) return
    const measure = () => shell.style.setProperty('--site-header-height', `${header.getBoundingClientRect().height}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (!pendingPageFocus.current) return
    const scrollToTop = pendingPageFocus.current === 'top'
    pendingPageFocus.current = false
    if (route.path === '/' && isHomeFragment(window.location.hash)) {
      focusHomeFragment(document, window.location.hash)
    } else if (['/goal-loop', '/gameonvb'].includes(route.path)) {
      if (window.location.hash) {
        try {
          const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
          if (target?.closest('dialog[open]')) { target.tabIndex = -1; target.focus({ preventScroll: true }); target.scrollIntoView({ behavior: 'instant', block: 'start' }) }
        } catch { /* Invalid fragments leave the presentation usable. */ }
      }
    } else {
      document.getElementById('main-content')?.focus({ preventScroll: true })
      if (scrollToTop) window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [route])

  useEffect(() => {
    let frame = 0
    const contact = () => {
      if (window.location.pathname !== '/' || !isHomeFragment(window.location.hash)) return
      if (document.getElementById('main-content')?.inert) closeIntro(false)
      focusHomeFragment(document, window.location.hash)
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
      const path = normalizePathname(window.location.pathname), current = beginNavigation()
      const authored = isLightTablePair(shownPath.current, path) && !isProjectSwitch(shownPath.current, path) && !window.location.hash && (shownAnimatedEntry.current || window.history.state?.lightTableFromHome === true)
      const update = () => {
        if (!current()) return
        setUnknownPath(path !== '/voleyevents' && !ROUTES.some((route) => route.path === path))
        pendingPageFocus.current = authored ? false : 'preserve'
        setIntroOpen(false)
        setRoute({ ...next })
      }
      if (authored) update(); else crossFadeProjects(update, document)
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
  if (unknownPath) routeContent = <section className="not-found"><p className="poster-kicker">404 / Not found</p><h1>This page doesn't exist.</h1><a className="target-link" href="/" onClick={onNavigate}><Arrow direction="left"/><span className="link-label">Back home</span></a></section>
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

      <header className="site-header" inert={showIntro || undefined}>
        <RouteLink
          className="brand"
          currentPath={unknownPath ? undefined : route.path}
          href="/"
          onNavigate={onNavigate}
        >
          <span>Hoang Viet To</span>
        </RouteLink>
        <a className="target-link header-contact" href="/#contact" onClick={onNavigate}>Contact</a>
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

      <footer inert={showIntro || route.path === '/gameonvb' || route.path === '/goal-loop' || undefined}>
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
        <a className="target-link text-link arrow-link" href="#top" onClick={onNavigate}>
          <span className="link-label">Return to top</span><Arrow direction="up"/>
        </a>
      </footer>

      {/* Fixed overlay; last in source order so the skip link stays the first stop. */}
      {showIntro ? <ArenaIntro onClose={closeIntro} onNavigate={onNavigate} /> : null}
    </div>
  )
}
