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
    <article className="voleyevents">
      <section
        className="court-hero"
        aria-labelledby="voleyevents-title"
        data-reveal
      >
        <img
          alt=""
          aria-hidden="true"
          className="court-hero-graphic"
          src="/assets/voleyevents-operations.svg"
        />
        <p className="eyebrow">{VOLEYEVENTS.hero.eyebrow}</p>
        <h1 id="voleyevents-title">{VOLEYEVENTS.hero.title}</h1>
        <p className="court-hero-lede">{VOLEYEVENTS.hero.lede}</p>
        <a className="target-link hero-jump" href="#lifecycle">
          Follow one registration <span aria-hidden="true">↓</span>
        </a>
      </section>

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

        <div className="lifecycle-layout">
          <div className="lifecycle-court" aria-hidden="true">
            <svg
              viewBox="0 0 160 760"
              preserveAspectRatio="xMidYMid slice"
              role="presentation"
            >
              <path className="court-lane" d="M80 52V708" />
              <path className="court-net" d="M28 380H132" />
              <circle className="court-stop" cx="80" cy="52" r="12" />
              <circle className="court-stop" cx="80" cy="270" r="12" />
              <circle className="court-stop" cx="80" cy="490" r="12" />
              <circle className="court-stop" cx="80" cy="708" r="12" />
              <g className="participant-token">
                <circle cx="80" cy="52" r="24" />
                <path d="M72 52h16M80 44v16" />
              </g>
            </svg>
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
        </div>
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
