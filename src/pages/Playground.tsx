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
          <p className="eyebrow">Playground / Spatial System</p>
          <h1 id="relay-title">SYSTEM FIELD</h1>
          <p className="relay-instruction">
            Move across the field to send a wave. Scroll to fold the system; reverse
            to restore it.
          </p>
          <p
            ref={statusRef}
            className="relay-status"
            data-relay-status="true"
          >
            Current beat: FLAT
          </p>
        </section>

        <div
          ref={stageRef}
          className="relay-stage"
          aria-hidden="true"
          data-relay-stage="true"
        >
          <svg
            className="system-field-fallback"
            data-system-field-fallback="true"
            viewBox="0 0 960 720"
            preserveAspectRatio="xMidYMid meet"
            role="presentation"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="system-field-grid"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <circle className="system-field-node" cx="10" cy="10" r="2.5" />
              </pattern>
            </defs>
            <rect
              className="system-field-grid"
              x="160"
              y="40"
              width="640"
              height="640"
              fill="url(#system-field-grid)"
            />
            <circle
              className="system-field-origin"
              cx="480"
              cy="360"
              r="8"
            />
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
            <p className="relay-beat-index">01 / Rest state</p>
            <h2 id="relay-input-title">FLAT</h2>
            <p>A 32 by 32 field waits in a quiet, legible plane.</p>
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
            <p className="relay-beat-index">02 / Curvature</p>
            <h2 id="relay-fold-title">FOLD</h2>
            <p>
              Native scroll bends the outer columns away from the flat plane.
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
            <p className="relay-beat-index">03 / Passage</p>
            <h2 id="relay-feedback-title">TUNNEL</h2>
            <p>
              The folded field closes around a reversible spatial corridor.
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
            <p className="relay-beat-index">04 / Bright return</p>
            <h2 id="relay-closed-title">FEEDBACK</h2>
            <p>
              One bright return travels from the tunnel edge back to origin.
            </p>
            <nav aria-label="Beat navigation">
              <BeatLink
                action="previous"
                href="#relay-feedback"
              >Previous beat</BeatLink>
              <BeatLink
                action="replay"
                href="#relay-input"
              >Replay field</BeatLink>
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
