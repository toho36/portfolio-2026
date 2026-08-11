import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { createRelayPlayhead } from '../playground/relayPlayhead'

type RelayControlAction = 'previous' | 'next' | 'replay'

interface PlaygroundPageProps {
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
  readonly onNavigate: PlaygroundPageProps['onNavigate']
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

function BeatLink({
  action,
  children,
  href,
}: {
  readonly action: RelayControlAction
  readonly children: ReactNode
  readonly href: string
}) {
  return (
    <a
      className="target-link relay-beat-link"
      href={href}
      data-relay-action={action}
    >
      {children}
    </a>
  )
}

export function PlaygroundPage({ onNavigate }: PlaygroundPageProps) {
  const routeRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const beatsRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const liveRegionRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const route = routeRef.current
    const stage = stageRef.current
    const beats = beatsRef.current
    const status = statusRef.current
    const liveRegion = liveRegionRef.current
    if (!route || !stage || !beats || !status || !liveRegion) return

    const playhead = createRelayPlayhead({
      elements: { route, stage, beats, status, liveRegion },
    })
    return () => playhead.destroy()
  }, [])

  return (
    <article
      ref={routeRef}
      className="playground"
      data-relay-root="true"
    >
      <div className="relay-choreography">
        <section
          className="relay-hero"
          aria-labelledby="relay-title"
        >
          <p className="eyebrow">Playground / Closed Signal</p>
          <h1 id="relay-title">SIGNAL RELAY</h1>
          <p className="relay-instruction">
            Scroll to route the signal. Reverse to rewind.
          </p>
          <p
            ref={statusRef}
            className="relay-status"
            data-relay-status="true"
          >
            Current beat: INPUT
          </p>
        </section>

        <div
          ref={stageRef}
          className="relay-stage"
          aria-hidden="true"
          data-relay-stage="true"
        >
          <svg
            viewBox="0 0 960 720"
            preserveAspectRatio="xMidYMid meet"
            role="presentation"
            aria-hidden="true"
          >
            <g className="relay-assembly">
              <path
                className="relay-return relay-return-back"
                d="M690 360C850 360 850 610 610 610C370 610 245 555 245 455"
              />
              <path className="relay-rail" d="M40 360H350" />
              <path
                className="relay-ring relay-ring-outer"
                d="M350 360A230 230 0 1 1 810 360A230 230 0 1 1 350 360"
              />
              <path
                className="relay-ring relay-ring-middle"
                d="M410 360A170 170 0 1 1 750 360A170 170 0 1 1 410 360"
              />
              <path
                className="relay-ring relay-ring-inner"
                d="M470 360A110 110 0 1 1 690 360A110 110 0 1 1 470 360"
              />
              <path
                className="relay-return relay-return-front"
                d="M245 455C245 405 285 360 350 360"
              />
              <g className="relay-signals">
                <circle
                  className="relay-signal relay-signal-input"
                  cx="175"
                  cy="360"
                  r="10"
                />
                <circle
                  className="relay-signal relay-signal-fold"
                  cx="580"
                  cy="130"
                  r="10"
                />
                <circle
                  className="relay-signal relay-signal-feedback"
                  cx="785"
                  cy="540"
                  r="10"
                />
                <circle
                  className="relay-signal relay-signal-closed"
                  cx="245"
                  cy="455"
                  r="10"
                />
              </g>
            </g>
          </svg>
        </div>

        <div
          ref={beatsRef}
          className="relay-beats"
          data-relay-beats="true"
        >
          <section
            id="relay-input"
            className="relay-beat"
            aria-labelledby="relay-input-title"
          >
            <p className="relay-beat-index">01 / Input rail</p>
            <h2 id="relay-input-title">INPUT</h2>
            <p>The signal enters along a straight warm-metal rail.</p>
            <nav aria-label="Beat navigation">
              <BeatLink
                action="next"
                href="#relay-fold"
              >Next beat</BeatLink>
            </nav>
          </section>

          <section
            id="relay-fold"
            className="relay-beat"
            aria-labelledby="relay-fold-title"
          >
            <p className="relay-beat-index">02 / Nested gates</p>
            <h2 id="relay-fold-title">FOLD</h2>
            <p>
              The rail folds through three nested rings, crossing behind and
              in front to establish depth.
            </p>
            <nav aria-label="Beat navigation">
              <BeatLink
                action="previous"
                href="#relay-input"
              >Previous beat</BeatLink>
              <BeatLink
                action="next"
                href="#relay-feedback"
              >Next beat</BeatLink>
            </nav>
          </section>

          <section
            id="relay-feedback"
            className="relay-beat"
            aria-labelledby="relay-feedback-title"
          >
            <p className="relay-beat-index">03 / Return branch</p>
            <h2 id="relay-feedback-title">FEEDBACK</h2>
            <p>
              A returning branch passes behind the assembly and bends back
              toward the input path.
            </p>
            <nav aria-label="Beat navigation">
              <BeatLink
                action="previous"
                href="#relay-fold"
              >Previous beat</BeatLink>
              <BeatLink
                action="next"
                href="#relay-closed"
              >Next beat</BeatLink>
            </nav>
          </section>

          <section
            id="relay-closed"
            className="relay-beat"
            aria-labelledby="relay-closed-title"
          >
            <p className="relay-beat-index">04 / Reconnection</p>
            <h2 id="relay-closed-title">CLOSED</h2>
            <p>
              The return aligns with its origin, closing the circuit for one
              complete signal path.
            </p>
            <nav aria-label="Beat navigation">
              <BeatLink
                action="previous"
                href="#relay-feedback"
              >Previous beat</BeatLink>
              <BeatLink
                action="replay"
                href="#relay-input"
              >Replay relay</BeatLink>
            </nav>
          </section>
        </div>
      </div>

      <p
        ref={liveRegionRef}
        className="relay-live-region"
        aria-live="polite"
        aria-atomic="true"
      />

      <nav className="relay-navigation" aria-label="Route navigation">
        <RouteAnchor
          className="back-link"
          href="/goal-loop"
          onNavigate={onNavigate}
        >
          <span aria-hidden="true">←</span> Back: Goal Loop
        </RouteAnchor>
        <RouteAnchor className="next-link" href="/" onNavigate={onNavigate}>
          Next: Homepage <span aria-hidden="true">→</span>
        </RouteAnchor>
      </nav>
    </article>
  )
}
