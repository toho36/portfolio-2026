import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { ShapeAndHole } from '../components/ShapeAndHole'
import {
  GOAL_LOOP,
  GOAL_LOOP_HISTORY,
  GOAL_LOOP_HISTORY_PRESENTATION,
  GOAL_LOOP_OUTCOMES,
  GOAL_LOOP_REVISIONS,
  GOAL_LOOP_STAGES,
  historyAfterText,
  historyBeforeText,
  historyReductionText,
  historyTrackPercent,
} from '../content/goalLoop'

type HistoryRowStyle = CSSProperties & {
  '--after-scale': number
}

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
  readonly href: '/' | '/gameonvb'
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
      <ShapeAndHole />
      <section className="shape-meaning" aria-labelledby="shape-meaning-title">
        <h2 id="shape-meaning-title">The same brief.<br />Three different questions.</h2>
        <div>
          <p>Critique compares the light plan with the opening. Build makes a solid object. Check drops a weight on it at the table. Review compares the solid object with the opening.</p>
          <p>A failed plan returns before Build. A cracked object and a wrong shape each return to Build and use one repair piece.</p>
          <p>{GOAL_LOOP.hero.lede}</p>
          <a className="target-link" href="#run-tape">Read the full run trace ↓</a>
        </div>
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
                >
                  <details className="run-reference">
                  <summary className="run-stage-heading">
                    <div>
                      <p className="run-role">{stage.role}</p>
                      <h3>{stage.label}</h3>
                    </div>
                    <span className="run-state">{stage.marker}</span>
                  </summary>
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
                  </details>
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
        <div className="run-history">
          <div className="run-history-heading">
            <p className="eyebrow">{GOAL_LOOP_HISTORY_PRESENTATION.eyebrow}</p>
            <h3>{GOAL_LOOP_HISTORY.title}</h3>
            <p>{GOAL_LOOP_HISTORY_PRESENTATION.lede}</p>
          </div>
          <ol className="run-history-rows">
            {GOAL_LOOP_HISTORY.metrics.map((metric) => {
              const style: HistoryRowStyle = {
                '--after-scale': historyTrackPercent(metric),
              }

              return (
                <li className="run-history-row" key={metric.id} style={style}>
                  <h3>{metric.label}</h3>
                  <p className="run-history-values">
                    <span>
                      Before <strong>{historyBeforeText(metric)}</strong>
                    </span>
                    <span>
                      After <strong>{historyAfterText(metric)}</strong>
                    </span>
                  </p>
                  <p className="run-history-delta">
                    {historyReductionText(metric)}
                  </p>
                  <div className="run-history-track" aria-hidden="true">
                    <span className="run-history-fill" />
                    <span className="run-history-mark" />
                  </div>
                  <p className="run-history-proof">{metric.proof}</p>
                </li>
              )
            })}
          </ol>
          <p className="run-history-source">
            {GOAL_LOOP_HISTORY.scope} · {GOAL_LOOP_HISTORY.source.label} ·{' '}
            {GOAL_LOOP_HISTORY.source.path}
          </p>
        </div>
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
          href="/gameonvb"
          onNavigate={onNavigate}
        >
          <span aria-hidden="true">←</span> Back: GameOnVB
        </RouteAnchor>
        <RouteAnchor className="next-link" href="/" onNavigate={onNavigate}>
          Next: Homepage <span aria-hidden="true">→</span>
        </RouteAnchor>
      </nav>
    </article>
  )
}
