import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { VOLEYEVENTS } from '../content/voleyevents'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

interface VoleyEventsRuntimeOwner {
  destroy(): void
}

interface VoleyEventsRuntimeModule {
  createRallyRuntimeOwner(options: {
    readonly elements: {
      readonly root: HTMLElement
      readonly stage: HTMLElement
    }
    readonly window?: Window
    readonly media: MediaQueryList
    readonly onSurrender?: () => void
  }): VoleyEventsRuntimeOwner
}

interface VoleyEventsRuntimeBoundaryOptions {
  readonly elements: {
    readonly root: HTMLElement
    readonly stage: HTMLElement
  }
  readonly window?: Window
  readonly media: MediaQueryList
  readonly importRuntime: () => Promise<VoleyEventsRuntimeModule>
}

/** Page-local eligibility gate; it owns no motion or scene implementation. */
export function createVoleyEventsRuntimeBoundary(
  options: VoleyEventsRuntimeBoundaryOptions,
): VoleyEventsRuntimeOwner {
  const { elements, media } = options
  const previousState = elements.root.dataset.rallyRuntime
  let generation = 0
  let reduced = media.matches
  let pending: { canceled: boolean } | null = null
  let owner: VoleyEventsRuntimeOwner | null = null
  let surrendered = false
  let destroyed = false

  function invalidateCurrent() {
    generation += 1
    if (pending) pending.canceled = true
    pending = null
    owner?.destroy()
    owner = null
  }

  function requestOwner() {
    if (destroyed || surrendered || media.matches || pending || owner) return

    const requestGeneration = ++generation
    const load = { canceled: false }
    pending = load
    const isActive = () =>
      !destroyed &&
      pending === load &&
      !load.canceled &&
      !media.matches &&
      requestGeneration === generation

    let modulePromise: Promise<VoleyEventsRuntimeModule>
    try {
      modulePromise = options.importRuntime()
    } catch {
      pending = null
      elements.root.dataset.rallyRuntime = 'static'
      return
    }

    void modulePromise.then(
      (module) => {
        if (!isActive()) return
        pending = null
        try {
          owner = module.createRallyRuntimeOwner({
            elements,
            window: options.window,
            media,
            onSurrender: surrenderForVisit,
          })
        } catch {
          if (
            !destroyed &&
            !load.canceled &&
            !media.matches &&
            requestGeneration === generation
          ) {
            elements.root.dataset.rallyRuntime = 'static'
          }
        }
      },
      () => {
        if (!isActive()) return
        pending = null
        elements.root.dataset.rallyRuntime = 'static'
      },
    )
  }

  function surrenderForVisit() {
    if (destroyed || surrendered) return
    surrendered = true
    invalidateCurrent()
    elements.root.dataset.rallyRuntime = 'static'
  }

  function applyMotionPreference() {
    if (destroyed || reduced === media.matches) return
    reduced = media.matches
    if (reduced) {
      invalidateCurrent()
      elements.root.dataset.rallyRuntime = 'static'
    } else {
      requestOwner()
    }
  }

  media.addEventListener('change', applyMotionPreference)
  if (reduced) elements.root.dataset.rallyRuntime = 'static'
  else requestOwner()

  return Object.freeze({
    destroy() {
      if (destroyed) return
      destroyed = true
      invalidateCurrent()
      media.removeEventListener('change', applyMotionPreference)
      if (previousState === undefined) {
        delete elements.root.dataset.rallyRuntime
      } else {
        elements.root.dataset.rallyRuntime = previousState
      }
    },
  })
}

interface VoleyEventsPageProps {
  readonly onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void
}

function RouteAnchor({
  children,
  className,
  href,
  onNavigate,
}: {
  readonly children: ReactNode
  readonly className: string
  readonly href: '/' | '/goal-loop'
  readonly onNavigate: VoleyEventsPageProps['onNavigate']
}) {
  return (
    <a
      className={`target-link ${className}`}
      href={href}
      onClick={onNavigate}
    >
      {children}
    </a>
  )
}

export function VoleyEventsPage({ onNavigate }: VoleyEventsPageProps) {
  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const stage = stageRef.current
    if (!root || !stage) return

    const media = window.matchMedia(REDUCED_MOTION_QUERY)
    const boundary = createVoleyEventsRuntimeBoundary({
      elements: { root, stage },
      window,
      media,
      importRuntime: () => import('../voleyevents/loadRallyRuntime'),
    })

    return () => boundary.destroy()
  }, [])

  return (
    <article
      className="voleyevents"
      data-rally-root="true"
      ref={rootRef}
    >
      <section
        className="court-hero"
        aria-labelledby="voleyevents-title"
        data-reveal
      >
        <p className="eyebrow">{VOLEYEVENTS.hero.eyebrow}</p>
        <h1 id="voleyevents-title">{VOLEYEVENTS.hero.title}</h1>
        <p className="court-hero-lede">{VOLEYEVENTS.hero.lede}</p>
        <a className="target-link hero-jump" href="#lifecycle">
          Follow one registration <span aria-hidden="true">↓</span>
        </a>
      </section>

      <div
        className="rally-stage"
        data-rally-stage="true"
        aria-hidden="true"
        ref={stageRef}
      >
        <svg
          className="rally-fallback"
          data-rally-fallback="true"
          viewBox="0 0 1200 760"
          preserveAspectRatio="xMidYMid meet"
          role="presentation"
          aria-hidden="true"
        >
          <g
            className="rally-plane rally-plane-serve"
            transform="translate(78 74)"
          >
            <path
              className="rally-plane-surface"
              d="M0 78 276 0 438 86 158 166Z"
            />
            <path
              className="rally-plane-lines"
              d="M79 55 354 137M138 39 295 126M219 16 219 143"
            />
            <path
              className="rally-net"
              d="M219 20V143M197 27 241 14M197 47 241 34M197 67 241 54M197 87 241 74M197 107 241 94M197 127 241 114"
            />
            <circle className="rally-ball" cx="78" cy="72" r="20" />
            <path
              className="rally-ball-seam"
              d="M63 68C73 64 82 69 88 84M77 53C81 63 91 69 98 68"
            />
          </g>

          {VOLEYEVENTS.lifecycle.map((stage, index) => (
            <g
              className={`rally-plane rally-landing rally-landing--${index % 2 === 0 ? 'right' : 'left'}`}
              data-rally-landing={stage.id}
              key={stage.id}
              transform={[
                'translate(506 170)',
                'translate(164 302)',
                'translate(572 424)',
                'translate(252 556)',
              ][index]}
            >
              <path
                className="rally-plane-surface"
                d="M0 66 246 0 390 73 140 142Z"
              />
              <path
                className="rally-plane-lines"
                d="M69 47 315 116M123 33 267 103M195 14 195 121"
              />
              <path
                className="rally-net"
                d="M195 18V121M176 24 214 13M176 42 214 31M176 60 214 49M176 78 214 67M176 96 214 85M176 114 214 103"
              />
              <circle className="rally-landing-mark" cx="70" cy="58" r="12" />
            </g>
          ))}
        </svg>
      </div>

      <section
        className="case-section case-problem"
        aria-labelledby="problem-title"
        data-reveal
      >
        <div>
          <p className="eyebrow">{VOLEYEVENTS.problem.eyebrow}</p>
          <h2 id="problem-title">{VOLEYEVENTS.problem.title}</h2>
        </div>
        <p>{VOLEYEVENTS.problem.body}</p>
      </section>

      <div className="case-pair">
        <section aria-labelledby="constraints-title" data-reveal>
          <p className="eyebrow">{VOLEYEVENTS.constraints.eyebrow}</p>
          <h2 id="constraints-title">{VOLEYEVENTS.constraints.title}</h2>
          <p>{VOLEYEVENTS.constraints.body}</p>
        </section>
        <section aria-labelledby="decisions-title" data-reveal>
          <p className="eyebrow">{VOLEYEVENTS.decisions.eyebrow}</p>
          <h2 id="decisions-title">{VOLEYEVENTS.decisions.title}</h2>
          <p>{VOLEYEVENTS.decisions.body}</p>
        </section>
      </div>

      <section
        id="lifecycle"
        className="lifecycle"
        aria-labelledby="lifecycle-title"
      >
        <div className="lifecycle-heading" data-reveal>
          <p className="eyebrow">One registration / one operational record</p>
          <h2 id="lifecycle-title">
            The match operations lifecycle stays connected.
          </h2>
          <p>
            Scroll follows one participant through the same four states. The
            ordered stages remain the complete explanation without motion.
          </p>
        </div>

        <ol className="lifecycle-track">
          {VOLEYEVENTS.lifecycle.map((stage) => (
            <li
              className="lifecycle-stage"
              id={stage.id}
              key={stage.id}
              data-reveal
            >
              <div className="stage-heading">
                <h3>{stage.label}</h3>
                <span className="stage-state">{stage.state}</span>
              </div>
              <p>{stage.body}</p>
              <ul aria-label={`${stage.label} handles`}>
                {stage.handles.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <div className="case-pair case-closing">
        <section aria-labelledby="evidence-title" data-reveal>
          <p className="eyebrow">{VOLEYEVENTS.evidence.eyebrow}</p>
          <h2 id="evidence-title">{VOLEYEVENTS.evidence.title}</h2>
          <p>{VOLEYEVENTS.evidence.body}</p>
        </section>
        <section aria-labelledby="status-title" data-reveal>
          <p className="eyebrow">{VOLEYEVENTS.status.eyebrow}</p>
          <h2 id="status-title">{VOLEYEVENTS.status.title}</h2>
          <p>{VOLEYEVENTS.status.body}</p>
        </section>
      </div>

      <nav className="case-navigation" aria-label="Case study navigation">
        <RouteAnchor className="back-link" href="/" onNavigate={onNavigate}>
          <span aria-hidden="true">←</span> Back to homepage
        </RouteAnchor>
        <RouteAnchor
          className="next-link"
          href="/goal-loop"
          onNavigate={onNavigate}
        >
          Next: Goal Loop <span aria-hidden="true">→</span>
        </RouteAnchor>
      </nav>
    </article>
  )
}
