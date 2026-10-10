import { useState, type MouseEvent, type ReactNode } from 'react'
import { Staircase } from '../components/Staircase'
import { VOLEYEVENTS } from '../content/voleyevents'
import { STORY_CHAPTERS } from '../gameonvb/stairStory'
import type { LandingIndex } from '../gameonvb/stairBall'

interface VoleyEventsPageProps {
  readonly hero?: ReactNode
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

export function VoleyEventsPage({ onNavigate, hero }: VoleyEventsPageProps) {
  const [landing, setLanding] = useState<LandingIndex>(0)
  const highlighted = STORY_CHAPTERS[landing].stages.map(stage => stage.id)
  return (
    <article className="voleyevents staircase-case">
      {hero ?? <section
        className="staircase-entry"
        aria-labelledby="voleyevents-title"
      >
        <div className="staircase-intro">
          <p className="eyebrow">{VOLEYEVENTS.hero.eyebrow}</p>
          <h1 id="voleyevents-title">Gravity, by hand.</h1>
          <p>Catch. Pull. Let go.</p>
        </div>
        <Staircase landing={landing} onLanding={setLanding} />
        <p className="staircase-summary">{VOLEYEVENTS.hero.title}</p>
      </section>}

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
        data-active={landing}
      >
        <div className="lifecycle-heading" data-reveal>
          <p className="eyebrow">One registration / one operational record</p>
          <h2 id="lifecycle-title">
            The match operations lifecycle stays connected.
          </h2>
          <p>
            Follow one participant through four connected states. The complete
            operational story is here, whether or not you play with the ball.
          </p>
        </div>

        <ol className="lifecycle-track">
          {VOLEYEVENTS.lifecycle.map((stage) => (
            <li
              className="lifecycle-stage"
              id={stage.id}
              key={stage.id}
              data-lifecycle-stage={stage.id}
              data-highlighted={highlighted.includes(stage.id) ? 'true' : undefined}
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
