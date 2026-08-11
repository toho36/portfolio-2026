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
  pushRouteNavigation,
  resolveRoute,
  routeMetadata,
  subscribeToRouteChanges,
  type Route,
  type RoutePath,
} from './content/routes'
import { CONTACT, FLAGSHIPS, HERO, SIDE_QUESTS } from './content/systems'
import { GoalLoopPage } from './pages/GoalLoop'
import { PlaygroundPage } from './pages/Playground'
import { VoleyEventsPage } from './pages/VoleyEvents'

interface AppProps {
  readonly initialPath?: string
}

interface RouteLinkProps {
  readonly children: ReactNode
  readonly className?: string
  readonly currentPath: RoutePath
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

function HomePage({
  currentPath,
  onNavigate,
}: Pick<RouteLinkProps, 'currentPath' | 'onNavigate'>) {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title" data-reveal>
        <img
          alt=""
          aria-hidden="true"
          className="hero-graphic"
          src="/assets/systems-field.svg"
        />
        <p className="eyebrow">{HERO.eyebrow}</p>
        <h1 id="hero-title">{HERO.title}</h1>
        <p className="hero-introduction">{HERO.introduction}</p>
        <a className="target-link hero-jump" href="#flagships">
          Selected systems <span aria-hidden="true">↓</span>
        </a>
      </section>

      <section id="flagships" aria-labelledby="flagships-title" data-reveal>
        <div className="section-heading">
          <p className="eyebrow">Flagship systems</p>
          <h2 id="flagships-title">Products and the loops behind them.</h2>
        </div>
        <div className="flagship-list">
          {FLAGSHIPS.map((flagship) => (
            <article className="flagship" key={flagship.path}>
              <span className="system-index" aria-hidden="true">
                {flagship.index}
              </span>
              <div className="system-copy">
                <h3>{flagship.name}</h3>
                <p>{flagship.summary}</p>
              </div>
              <RouteLink
                className="system-link"
                currentPath={currentPath}
                href={flagship.path}
                onNavigate={onNavigate}
              >
                Open entry <span aria-hidden="true">↗</span>
              </RouteLink>
            </article>
          ))}
        </div>
      </section>

      <section id="side-quests" aria-labelledby="side-quests-title" data-reveal>
        <div className="section-heading compact-heading">
          <p className="eyebrow">Side quests</p>
          <h2 id="side-quests-title">Smaller, differently shaped work.</h2>
        </div>
        <div className="side-quest-list">
          {SIDE_QUESTS.map((project) => (
            <article className="side-quest" key={project.name}>
              <h3>{project.name}</h3>
              <p>{project.summary}</p>
              {project.url ? (
                <a className="target-link text-link" href={project.url}>
                  Visit project <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <span className="unlinked-note">No public link listed</span>
              )}
            </article>
          ))}
        </div>
      </section>
    </>
  )
}

export default function App({ initialPath }: AppProps) {
  const [route, setRoute] = useState(() =>
    resolveRoute(
      initialPath ??
        (typeof window === 'undefined' ? '/' : window.location.pathname),
    ),
  )

  const onNavigate = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    const anchor = event.currentTarget
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
    setRoute(
      pushRouteNavigation(destination, window.location.href, window.history),
    )
    document.getElementById('main-content')?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    return subscribeToRouteChanges(window, setRoute)
  }, [])

  useEffect(() => {
    applyRouteMetadata(document, route)
  }, [route])

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
  }, [route.path])

  let routeContent: ReactNode
  switch (route.path) {
    case '/':
      routeContent = (
        <HomePage currentPath={route.path} onNavigate={onNavigate} />
      )
      break
    case '/voleyevents':
      routeContent = <VoleyEventsPage onNavigate={onNavigate} />
      break
    case '/goal-loop':
      routeContent = <GoalLoopPage onNavigate={onNavigate} />
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
      <a className="skip-link target-link" href="#main-content">
        Skip to content
      </a>

      <header className="site-header">
        <RouteLink
          className="brand"
          currentPath={route.path}
          href="/"
          onNavigate={onNavigate}
        >
          <span>Hoang Viet To</span>
          <small>Systems builder</small>
        </RouteLink>
        <nav aria-label="Primary" className="site-nav">
          {ROUTES.map((item) => (
            <RouteLink
              currentPath={route.path}
              href={item.path}
              key={item.path}
              onNavigate={onNavigate}
            >
              {item.label}
            </RouteLink>
          ))}
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        {routeContent}
      </main>

      <footer>
        <p>
          Hoang Viet To <span aria-hidden="true">/</span> independent software
          systems builder
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
