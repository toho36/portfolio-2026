import type { MouseEvent, ReactNode } from 'react'
import { VOLEYEVENTS } from '../content/voleyevents'

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
  return (
    <article className="voleyevents" data-rally-root="true">
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
