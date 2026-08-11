import type { MouseEvent, ReactNode } from 'react'
import {
  GOAL_LOOP,
  GOAL_LOOP_OUTCOMES,
  GOAL_LOOP_REVISIONS,
  GOAL_LOOP_STAGES,
} from '../content/goalLoop'

interface GoalLoopPageProps {
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
  readonly href: '/' | '/voleyevents'
  readonly onNavigate: GoalLoopPageProps['onNavigate']
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

export function GoalLoopPage({ onNavigate }: GoalLoopPageProps) {
  return (
    <article className="goal-loop">
      <section
        className="run-hero"
        aria-labelledby="goal-loop-title"
        data-reveal
      >
        <p className="eyebrow">{GOAL_LOOP.hero.eyebrow}</p>
        <h1 id="goal-loop-title">{GOAL_LOOP.hero.title}</h1>
        <p className="run-hero-lede">{GOAL_LOOP.hero.lede}</p>
        <a className="target-link hero-jump" href="#run-tape">
          Read the run trace <span aria-hidden="true">↓</span>
        </a>
      </section>

      <section
        className="run-section run-problem"
        aria-labelledby="run-problem-title"
        data-reveal
      >
        <div>
          <p className="eyebrow">{GOAL_LOOP.problem.eyebrow}</p>
          <h2 id="run-problem-title">{GOAL_LOOP.problem.title}</h2>
        </div>
        <p>{GOAL_LOOP.problem.body}</p>
      </section>

      <section
        className="run-section run-bounds"
        aria-labelledby="run-bounds-title"
        data-reveal
      >
        <div>
          <p className="eyebrow">{GOAL_LOOP.bounds.eyebrow}</p>
          <h2 id="run-bounds-title">{GOAL_LOOP.bounds.title}</h2>
        </div>
        <p>{GOAL_LOOP.bounds.body}</p>
      </section>

      <section id="run-tape" className="run-tape" aria-labelledby="run-title">
        <div className="run-tape-heading" data-reveal>
          <p className="eyebrow">{GOAL_LOOP.tape.eyebrow}</p>
          <h2 id="run-title">{GOAL_LOOP.tape.title}</h2>
          <p>{GOAL_LOOP.tape.body}</p>
        </div>

        <div className="run-tape-layout">
          <div className="run-trace" aria-hidden="true">
            <svg
              viewBox="0 0 48 1120"
              preserveAspectRatio="xMidYMid slice"
              role="presentation"
            >
              <path className="run-trace-line" d="M24 80V1040" />
              <path
                className="run-trace-branch"
                d="M24 1040C28 1040 28 1010 32 1010"
              />
              <circle className="run-trace-stop" cx="24" cy="80" r="3" />
              <circle className="run-trace-stop" cx="24" cy="272" r="3" />
              <circle className="run-trace-stop" cx="24" cy="464" r="3" />
              <circle className="run-trace-stop" cx="24" cy="656" r="3" />
              <circle className="run-trace-stop" cx="24" cy="848" r="3" />
              <circle className="run-trace-stop" cx="24" cy="1040" r="3" />
              <path className="run-block-mark" d="M29 1007l6 6m0-6-6 6" />
              <g className="run-marker">
                <circle cx="24" cy="80" r="7" />
                <path d="M21 80l2 2 4-5" />
              </g>
            </svg>
          </div>

          <ol className="run-track">
            {GOAL_LOOP_STAGES.map((stage) => {
              const revisions = GOAL_LOOP_REVISIONS.filter(
                ({ afterStage }) => afterStage === stage.id,
              )

              return (
                <li
                  className="run-stage"
                  id={stage.id}
                  key={stage.id}
                  data-reveal
                >
                  <div className="run-stage-heading">
                    <div>
                      <p className="run-role">{stage.role}</p>
                      <h3>{stage.label}</h3>
                    </div>
                    <span className="run-state">{stage.marker}</span>
                  </div>
                  <dl>
                    <dt>Input</dt>
                    <dd>{stage.input}</dd>
                    <dt>Decision</dt>
                    <dd>{stage.decision}</dd>
                    <dt>Evidence</dt>
                    <dd>{stage.evidence}</dd>
                    <dt>Stop condition</dt>
                    <dd>{stage.stop}</dd>
                  </dl>

                  {revisions.length > 0 ? (
                    <aside className="run-revision-note" aria-label="Revision path">
                      <p>Revision path</p>
                      <ul>
                        {revisions.map((revision) => (
                          <li className="run-revision" key={revision.body}>
                            <strong>{revision.label}</strong>
                            <span>{revision.body}</span>
                          </li>
                        ))}
                      </ul>
                    </aside>
                  ) : null}

                  {stage.id === 'outcome' ? (
                    <div className="run-outcomes">
                      <section
                        className="run-outcome run-outcome-pass"
                        aria-labelledby="pass-title"
                      >
                        <span>{GOAL_LOOP_OUTCOMES.pass.label}</span>
                        <h4 id="pass-title">{GOAL_LOOP_OUTCOMES.pass.title}</h4>
                        <p>{GOAL_LOOP_OUTCOMES.pass.body}</p>
                      </section>
                      <section
                        id="blocked-path"
                        className="run-outcome run-outcome-blocked"
                        aria-labelledby="blocked-title"
                      >
                        <span>{GOAL_LOOP_OUTCOMES.blocked.label}</span>
                        <h4 id="blocked-title">
                          {GOAL_LOOP_OUTCOMES.blocked.title}
                        </h4>
                        <p>{GOAL_LOOP_OUTCOMES.blocked.body}</p>
                      </section>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <section
        className="run-section run-optimization"
        aria-labelledby="optimization-title"
        data-reveal
      >
        <div>
          <p className="eyebrow">{GOAL_LOOP.optimization.eyebrow}</p>
          <h2 id="optimization-title">{GOAL_LOOP.optimization.title}</h2>
        </div>
        <p>{GOAL_LOOP.optimization.body}</p>
      </section>

      <div className="run-pair">
        <section
          className="run-section run-boundary"
          aria-labelledby="run-boundary-title"
          data-reveal
        >
          <div>
            <p className="eyebrow">{GOAL_LOOP.boundary.eyebrow}</p>
            <h2 id="run-boundary-title">{GOAL_LOOP.boundary.title}</h2>
          </div>
          <p>{GOAL_LOOP.boundary.body}</p>
        </section>
        <section
          className="run-section run-status"
          aria-labelledby="run-status-title"
          data-reveal
        >
          <div>
            <p className="eyebrow">{GOAL_LOOP.status.eyebrow}</p>
            <h2 id="run-status-title">{GOAL_LOOP.status.title}</h2>
          </div>
          <p>{GOAL_LOOP.status.body}</p>
        </section>
      </div>

      <nav className="run-navigation" aria-label="Case study navigation">
        <RouteAnchor
          className="back-link"
          href="/voleyevents"
          onNavigate={onNavigate}
        >
          <span aria-hidden="true">←</span> Back: VoleyEvents
        </RouteAnchor>
        <RouteAnchor className="next-link" href="/" onNavigate={onNavigate}>
          Next: Homepage <span aria-hidden="true">→</span>
        </RouteAnchor>
      </nav>
    </article>
  )
}
