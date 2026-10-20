import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Staircase } from '../components/Staircase'
import { VOLEYEVENTS } from '../content/voleyevents'
import ballPreview from '../home/lightTable/assets/ball-preview.png'
import { mountGameOnVbMotion } from './gameOnVbMotion'
import './gameOnVb.css'
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
  const story = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (story.current) return mountGameOnVbMotion(story.current)
  }, [])
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

      <div className="gv gameonvb-story" ref={story}>
        <div className="ticker" aria-hidden="true">
          <img className="tick-ball" src={ballPreview} alt="" aria-hidden="true" />
          <div>{[0, 1].map(repeat => VOLEYEVENTS.ticker.map((text, index) => (
            <span key={`${repeat}-${index}`}>{text}<b>●</b></span>
          )))}</div>
        </div>

        <section className="wrap gv-rule" aria-labelledby="gv-rule-title">
          <div className="reveal">
            <p className="tag">{VOLEYEVENTS.rule.eyebrow}</p>
            <h2 id="gv-rule-title">{VOLEYEVENTS.rule.title}</h2>
            <p>{VOLEYEVENTS.rule.body}</p>
          </div>
          <svg className="spiker reveal" viewBox="0 0 640 780" role="img" aria-label={VOLEYEVENTS.rule.spiker.label}>
            <g className="glyphs"><text x="40" y="350" className="g">{VOLEYEVENTS.rule.spiker.zero}</text><text x="40" y="740" className="g">{VOLEYEVENTS.rule.spiker.currency}</text></g>
            <g className="arm back"><path d="M84 440 C 44 478, 22 520, 26 578"/><path d="M26 578 l-16 12 M26 578 l2 20 M26 578 l18 8"/></g>
            <g className="arm hit"><path d="M146 430 C 220 404, 300 336, 383 264"/><path d="M383 264 l-4 -22 M383 264 l16 -12 M383 264 l22 4"/></g>
            <g transform="translate(395 215)"><g className="vb"><image href={ballPreview} aria-hidden="true" x="-44" y="-44" width="88" height="88"/></g></g><g className="burst" transform="translate(395 215)"><path d="M-46 -30 l-14 -10 M-50 0 l-18 0 M-46 30 l-14 10 M0 -48 l0 -16 M30 -44 l10 -12"/></g><g className="whoosh"><path d="M440 260 l70 120 M470 250 l90 140 M418 286 l50 110"/></g>
          </svg>
        </section>

        <section className="band" data-band aria-labelledby="gv-band-title">
          <div className="band-pin">
            <img className="band-ball" data-band-ball src={ballPreview} alt="" aria-hidden="true" />
            <div className="band-head">
              <h2 id="gv-band-title">{VOLEYEVENTS.band.title[0]}<br />{VOLEYEVENTS.band.title[1]}</h2>
              <div className="score" data-score>
                <span>{VOLEYEVENTS.band.score}</span><b data-won>0</b><em>{VOLEYEVENTS.band.total}</em>
                <span className="pips" aria-hidden="true">{[0, 1, 2, 3].map(index => <i key={index} />)}</span>
              </div>
            </div>
            <div className="track" data-track>
              {VOLEYEVENTS.sets.map(set => (
                <article className={`set${set.win ? ' win' : ''}`} key={set.label}>
                  <h3 className="tag">{set.label}</h3>
                  <div className="big"><span>{set.value}</span><small>{set.unit}</small></div>
                  {set.before && <p className="was">{set.before.prefix}{set.before.struck && <s>{set.before.struck}</s>}{set.before.suffix && <span className="limit">{set.before.suffix}</span>}</p>}
                  <p>{set.body}</p>
                  {set.tech && <p className="tech">{set.tech}</p>}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="wrap gv-how" aria-label="Match operations">
          <div className="phone-col"><div className="phone"><div className="phone-in" aria-hidden="true">
            {VOLEYEVENTS.screens.map((screen, index) => (
              <div className={`screen${index === 0 ? ' on' : ''}`} data-screen={index} key={screen.title}>
                <span className="sbar">{screen.title}</span>
                {screen.rows.map(row => <div className="row" key={row.label}>{row.label}<span className={`pill${row.ok ? ' ok' : ''}`}>{row.pill}</span></div>)}
                {screen.button && <div className="btn">{screen.button}</div>}
                {screen.amount && <b className="pay-amount">{screen.amount}</b>}
                {screen.qrCaption && <>
                  <svg className="qr" viewBox="-2 -2 29 29" aria-hidden="true">
                    <rect x="-2" y="-2" width="29" height="29" fill="#fff"/>
                    <g fill="#16130b">
                      <rect x="0" y="0" width="7" height="7"/>
                      <rect x="1" y="1" width="5" height="5" fill="#fff"/>
                      <rect x="2" y="2" width="3" height="3"/>
                      <rect x="18" y="0" width="7" height="7"/>
                      <rect x="19" y="1" width="5" height="5" fill="#fff"/>
                      <rect x="20" y="2" width="3" height="3"/>
                      <rect x="0" y="18" width="7" height="7"/>
                      <rect x="1" y="19" width="5" height="5" fill="#fff"/>
                      <rect x="2" y="20" width="3" height="3"/>
                      <path d="
                        M8 0h1v1h-1ZM9 0h1v1h-1ZM11 0h1v1h-1ZM13 0h1v1h-1ZM14 0h1v1h-1ZM16 0h1v1h-1ZM8 1h1v1h-1ZM9 1h1v1h-1ZM10 1h1v1h-1ZM11 1h1v1h-1ZM13 1h1v1h-1ZM14 1h1v1h-1Z
                        M9 2h1v1h-1ZM11 2h1v1h-1ZM13 2h1v1h-1ZM14 2h1v1h-1ZM15 2h1v1h-1ZM16 2h1v1h-1ZM9 3h1v1h-1ZM12 3h1v1h-1ZM14 3h1v1h-1ZM15 3h1v1h-1ZM16 3h1v1h-1ZM9 4h1v1h-1Z
                        M10 4h1v1h-1ZM12 4h1v1h-1ZM13 4h1v1h-1ZM16 4h1v1h-1ZM12 5h1v1h-1ZM14 5h1v1h-1ZM15 5h1v1h-1ZM8 6h1v1h-1ZM10 6h1v1h-1ZM15 6h1v1h-1ZM10 7h1v1h-1ZM15 7h1v1h-1Z
                        M3 8h1v1h-1ZM4 8h1v1h-1ZM6 8h1v1h-1ZM7 8h1v1h-1ZM8 8h1v1h-1ZM9 8h1v1h-1ZM10 8h1v1h-1ZM12 8h1v1h-1ZM13 8h1v1h-1ZM14 8h1v1h-1ZM16 8h1v1h-1ZM17 8h1v1h-1Z
                        M22 8h1v1h-1ZM23 8h1v1h-1ZM24 8h1v1h-1ZM2 9h1v1h-1ZM3 9h1v1h-1ZM4 9h1v1h-1ZM5 9h1v1h-1ZM8 9h1v1h-1ZM9 9h1v1h-1ZM10 9h1v1h-1ZM11 9h1v1h-1ZM18 9h1v1h-1Z
                        M23 9h1v1h-1ZM24 9h1v1h-1ZM0 10h1v1h-1ZM2 10h1v1h-1ZM3 10h1v1h-1ZM4 10h1v1h-1ZM5 10h1v1h-1ZM6 10h1v1h-1ZM7 10h1v1h-1ZM8 10h1v1h-1ZM9 10h1v1h-1ZM10 10h1v1h-1Z
                        M11 10h1v1h-1ZM12 10h1v1h-1ZM15 10h1v1h-1ZM16 10h1v1h-1ZM17 10h1v1h-1ZM18 10h1v1h-1ZM19 10h1v1h-1ZM22 10h1v1h-1ZM24 10h1v1h-1ZM0 11h1v1h-1ZM1 11h1v1h-1ZM2 11h1v1h-1Z
                        M4 11h1v1h-1ZM5 11h1v1h-1ZM8 11h1v1h-1ZM10 11h1v1h-1ZM15 11h1v1h-1ZM16 11h1v1h-1ZM17 11h1v1h-1ZM21 11h1v1h-1ZM22 11h1v1h-1ZM4 12h1v1h-1ZM6 12h1v1h-1ZM7 12h1v1h-1Z
                        M8 12h1v1h-1ZM9 12h1v1h-1ZM10 12h1v1h-1ZM13 12h1v1h-1ZM17 12h1v1h-1ZM18 12h1v1h-1ZM19 12h1v1h-1ZM20 12h1v1h-1ZM21 12h1v1h-1ZM3 13h1v1h-1ZM9 13h1v1h-1ZM11 13h1v1h-1Z
                        M14 13h1v1h-1ZM15 13h1v1h-1ZM18 13h1v1h-1ZM19 13h1v1h-1ZM20 13h1v1h-1ZM23 13h1v1h-1ZM2 14h1v1h-1ZM4 14h1v1h-1ZM5 14h1v1h-1ZM10 14h1v1h-1ZM13 14h1v1h-1ZM14 14h1v1h-1Z
                        M15 14h1v1h-1ZM16 14h1v1h-1ZM18 14h1v1h-1ZM19 14h1v1h-1ZM20 14h1v1h-1ZM22 14h1v1h-1ZM23 14h1v1h-1ZM1 15h1v1h-1ZM6 15h1v1h-1ZM7 15h1v1h-1ZM8 15h1v1h-1ZM9 15h1v1h-1Z
                        M11 15h1v1h-1ZM15 15h1v1h-1ZM19 15h1v1h-1ZM21 15h1v1h-1ZM22 15h1v1h-1ZM3 16h1v1h-1ZM8 16h1v1h-1ZM15 16h1v1h-1ZM19 16h1v1h-1ZM20 16h1v1h-1ZM21 16h1v1h-1ZM22 16h1v1h-1Z
                        M23 16h1v1h-1ZM24 16h1v1h-1ZM11 17h1v1h-1ZM14 17h1v1h-1ZM17 17h1v1h-1ZM19 17h1v1h-1ZM23 17h1v1h-1ZM24 17h1v1h-1ZM9 18h1v1h-1ZM10 18h1v1h-1ZM11 18h1v1h-1ZM13 18h1v1h-1Z
                        M15 18h1v1h-1ZM16 18h1v1h-1ZM17 18h1v1h-1ZM20 18h1v1h-1ZM24 18h1v1h-1ZM8 19h1v1h-1ZM9 19h1v1h-1ZM11 19h1v1h-1ZM12 19h1v1h-1ZM13 19h1v1h-1ZM16 19h1v1h-1ZM17 19h1v1h-1Z
                        M21 19h1v1h-1ZM22 19h1v1h-1ZM24 19h1v1h-1ZM8 20h1v1h-1ZM12 20h1v1h-1ZM14 20h1v1h-1ZM16 20h1v1h-1ZM17 20h1v1h-1ZM20 20h1v1h-1ZM21 20h1v1h-1ZM23 20h1v1h-1ZM24 20h1v1h-1Z
                        M8 21h1v1h-1ZM9 21h1v1h-1ZM10 21h1v1h-1ZM11 21h1v1h-1ZM12 21h1v1h-1ZM14 21h1v1h-1ZM16 21h1v1h-1ZM17 21h1v1h-1ZM18 21h1v1h-1ZM19 21h1v1h-1ZM20 21h1v1h-1ZM23 21h1v1h-1Z
                        M9 22h1v1h-1ZM11 22h1v1h-1ZM14 22h1v1h-1ZM18 22h1v1h-1ZM22 22h1v1h-1ZM23 22h1v1h-1ZM24 22h1v1h-1ZM8 23h1v1h-1ZM9 23h1v1h-1ZM11 23h1v1h-1ZM12 23h1v1h-1ZM13 23h1v1h-1Z
                        M17 23h1v1h-1ZM18 23h1v1h-1ZM19 23h1v1h-1ZM20 23h1v1h-1ZM21 23h1v1h-1ZM22 23h1v1h-1ZM23 23h1v1h-1ZM10 24h1v1h-1ZM12 24h1v1h-1ZM13 24h1v1h-1ZM14 24h1v1h-1ZM15 24h1v1h-1Z
                        M18 24h1v1h-1ZM20 24h1v1h-1ZM21 24h1v1h-1ZM22 24h1v1h-1ZM23 24h1v1h-1ZM24 24h1v1h-1Z
                      "/>
                    </g>
                  </svg>
                  <p className="qr-caption">{screen.qrCaption}</p>
                </>}
                {screen.stamp && <div className="stamp">{screen.stamp}</div>}
              </div>
            ))}
          </div></div></div>
          <div className="gv-steps">
            <img className="step-ball" data-step-ball src={ballPreview} alt="" aria-hidden="true" />
            {VOLEYEVENTS.steps.map((step, index) => (
              <div className="step" id={step.id} data-step={index} key={step.id}>
                <span className="n" aria-hidden="true">{index + 1}</span>
                <h2>{step.title}</h2><p>{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="gv-end" aria-labelledby="gv-end-title"><div className="wrap reveal">
          <p className="tag">{VOLEYEVENTS.closing.eyebrow}</p>
          <h2 id="gv-end-title">{VOLEYEVENTS.closing.title[0]}<br />{VOLEYEVENTS.closing.title[1]}</h2>
          <div className="chips">{VOLEYEVENTS.closing.chips.map(chip => <span key={chip}>{chip}</span>)}</div>
          <div className="gv-cta-row">
            <img className="end-ball" src={ballPreview} alt="" aria-hidden="true" />
            <a className="target-link gv-cta" href={VOLEYEVENTS.closing.href}>{VOLEYEVENTS.closing.cta} <span aria-hidden="true">→</span></a>
          </div>
        </div></section>
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
