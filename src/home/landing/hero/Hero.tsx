import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { prefersReducedMotion } from '../shared/landingMotion'
import type { HeroProps, P1Step } from '../shared/types'
import { STEP_DETAILS } from './content'
import { createPlayback, type PlaybackState } from './playback'
import eventName from './assets/event-name.png'
import eventDate from './assets/event-date.png'
import eventCapacity from './assets/event-capacity.png'
import eventOpen from './assets/event-open.png'
import occupancy from './assets/occupancy.png'
import reservation from './assets/reservation.png'
import paymentPlayer from './assets/payment-player.png'
import paymentAmount from './assets/payment-amount.png'
import paymentStatus from './assets/payment-status.png'
import paymentVs from './assets/payment-vs.png'
import attendancePlayer from '../assets/attendance-player.png'
import attendancePayment from '../assets/attendance-payment.png'
import attendanceArrived from '../assets/attendance-arrived.png'
import './hero.css'

function ProofImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  return failed ? <span className="p1-image-fallback">{alt}</span> : <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
}

/** T6 supplies the page's single shared coordinator and approved copy. */
export function Hero({ coordinator, headline, introduction, lifecycle }: HeroProps) {
  const id = useId()
  const panel = useRef<HTMLElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const player = useRef<ReturnType<typeof createPlayback> | null>(null)
  const [state, setState] = useState<PlaybackState>({ step: 0, status: 'idle', transitioning: false })
  useEffect(() => {
    const playback = createPlayback(coordinator, setState)
    player.current = playback
    // Shared whenVisible is one-shot; P1 needs continuous enter/leave observation.
    playback.setVisible(false)
    const observer = new IntersectionObserver((entries) => {
      const entry = entries.find((item) => item.target === panel.current)
      if (entry) playback.setVisible(entry.isIntersecting)
    })
    if (panel.current) observer.observe(panel.current)
    const unlisten = prefersReducedMotion(() => playback.pause())
    return () => { observer.disconnect(); unlisten(); playback.dispose(); player.current = null }
  }, [coordinator])
  const detail = STEP_DETAILS[state.step]
  const select = (step: P1Step) => player.current?.select(step)
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % 4
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + 3) % 4
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = 3
    else return
    event.preventDefault()
    tabs.current[next]?.focus()
    select(next as P1Step)
  }
  return <section className="landing-hero" id="introduction" aria-labelledby={`${id}-headline`}>
    <div className="landing-hero-copy">
      <p className="landing-kicker">Software Developer</p>
      <div id={`${id}-headline`}><h1>{headline}</h1></div>
      <p className="landing-intro">{introduction}</p>
      <div className="landing-hero-links"><a className="target-link landing-button" href="#work">Work <span aria-hidden="true">↓</span></a><a className="target-link landing-text-link" href="#contact">Contact <span aria-hidden="true">↗</span></a></div>
    </div>
    <figure ref={panel} className="landing-proof p1-proof" aria-labelledby={`${id}-title`} data-p1-step={state.step + 1} data-p1-status={state.status} data-p1-transitioning={state.transitioning}>
      <figcaption className="landing-proof-heading"><p id={`${id}-title`}>GameOnVB — from event to attendance</p><span className="landing-proof-label">{lifecycle.reconstructionLabel}</span></figcaption>
      <div className="landing-proof-steps p1-tabs" role="tablist" aria-label="Registration lifecycle">
        {lifecycle.steps.map((step, index) => <button key={step} ref={(el) => { tabs.current[index] = el }} type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel`} aria-selected={state.step === index} tabIndex={state.step === index ? 0 : -1} onKeyDown={(event) => keyDown(event, index)} onClick={() => select(index as P1Step)}><span className="landing-step-number">0{index + 1}</span><span>{step}</span></button>)}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${state.step}`} tabIndex={0}>
        <div key={state.step} className="p1-step-content" data-transitioning={state.transitioning}>
          <div className="landing-proof-image p1-crops" role="group" aria-label={`Step ${state.step + 1}: ${lifecycle.steps[state.step]}`}>
            {state.step === 0 && <><ProofImage src={eventName} alt="Čtvrteční volejbal — demo" className="p1-identity" /><ProofImage src={eventDate} alt="22. 10. 2026 19:00" className="p1-date" /><div className="landing-proof-results"><ProofImage src={eventCapacity} alt="Kapacita 12" className="p1-capacity" /><ProofImage src={eventOpen} alt="Otevřeno" /></div></>}
            {state.step === 1 && <><ProofImage src={occupancy} alt="Kapacita 1 / 12" className="p1-occupancy" /><ProofImage src={reservation} alt="Rezervovaní — čeká na platbu (1): Demo Player" className="p1-reservation" /></>}
            {state.step === 2 && <><ProofImage src={paymentPlayer} alt="DEMO PLAYER" className="p1-identity" /><div className="landing-proof-results"><ProofImage src={paymentAmount} alt="150 Kč" /><ProofImage src={paymentStatus} alt="Spárovaná" /></div><ProofImage src={paymentVs} alt="VS 1000000002" className="p1-vs" /></>}
            {state.step === 3 && <><ProofImage src={attendancePlayer} alt="Demo Player" className="landing-proof-player" /><div className="landing-proof-results"><ProofImage src={attendancePayment} alt="Spárováno" /><ProofImage src={attendanceArrived} alt="Dorazil" /></div></>}
          </div>
          <div className="landing-proof-end"><span className="landing-kicker">0{state.step + 1} / {lifecycle.steps[state.step]}</span>{state.step === 2 && <span className="landing-proof-label">{lifecycle.bankInputLabel}</span>}<p>{detail.description}</p><dl className="p1-change"><div><dt>Before</dt><dd>{detail.before}</dd></div><div><dt>After</dt><dd>{detail.after}</dd></div></dl></div>
        </div>
      </div>
      <div className="p1-controls"><button type="button" onClick={() => state.status === 'playing' ? player.current?.pause() : player.current?.play()}>{state.status === 'playing' ? 'Pause' : state.status === 'paused' ? 'Resume' : state.status === 'done' ? 'Replay' : 'Play'}</button><span>{state.status === 'done' ? 'Complete' : state.status === 'paused' ? 'Paused' : state.status === 'playing' ? 'Playing' : 'Explore each step'}</span></div>
      <p className="p1-live" aria-live="polite" aria-atomic="true">Step {state.step + 1} of 4: {lifecycle.steps[state.step]}. {state.status === 'done' ? 'Complete.' : state.status === 'paused' ? 'Paused.' : ''}</p>
      {state.status === 'done' && <ol className="p1-summary" aria-label="Lifecycle summary">{lifecycle.steps.map((step, index) => <li key={step}><strong>{step}</strong><span>{STEP_DETAILS[index].after}</span>{index === 2 && <span>{lifecycle.bankInputLabel}</span>}</li>)}</ol>}
      <a className="target-link landing-proof-link" href="/gameonvb">View project <span aria-hidden="true">↗</span></a>
    </figure>
  </section>
}
