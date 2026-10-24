import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { VOLEYEVENTS } from '../../content/voleyevents'
import { GOAL_LOOP_KITCHEN } from '../../content/goalLoop'
import ball from '../lightTable/assets/ball-preview.png'
import './living.css'

// One focused motion per homepage section (owner-approved study 036). Every visual
// renders its final, readable state first; motion is armed only on the client
// when reduced motion is off, so no-JS, tests and reduced motion see the end state.
const reduced = () => typeof window === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches
const clamp = (v: number) => Math.min(1, Math.max(0, v))

/** True once the element is well inside the viewport (immediately under reduced motion). */
function useLive<T extends HTMLElement>(threshold = .45) {
  const ref = useRef<T>(null), [live, setLive] = useState(false)
  useEffect(() => {
    if (reduced() || typeof IntersectionObserver === 'undefined') { setLive(true); return }
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setLive(true); io.disconnect() } }, { threshold })
    io.observe(ref.current!); return () => io.disconnect()
  }, [threshold])
  return [ref, live] as const
}

/** Motion styles apply only when this is true (client, motion allowed). Turning
    reduced motion on later disarms every visual, which settles it at its end state. */
function useArmed() {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'), sync = () => setArmed(!media.matches && typeof IntersectionObserver !== 'undefined')
    sync(); media.addEventListener('change', sync); return () => media.removeEventListener('change', sync)
  }, [])
  return armed
}

function Count({ from, to, live, armed }: { from: number; to: number; live: boolean; armed: boolean }) {
  const [value, setValue] = useState(to)
  useEffect(() => {
    if (!armed) { setValue(to); return } // disarmed (incl. reduced motion turned on mid-count): end value
    if (!live) { setValue(from); return }
    let frame = 0; const start = performance.now()
    const step = (now: number) => { const t = clamp((now - start) / 1200); setValue(from + (to - from) * (1 - (1 - t) ** 3)); if (t < 1) frame = requestAnimationFrame(step) }
    frame = requestAnimationFrame(step); return () => cancelAnimationFrame(frame)
  }, [armed, live, from, to])
  return <span aria-hidden="true">{Math.round(value)}</span>
}

/* Introduction: "New tools." resolves out of code glyphs; "Old standards." only settles. */
const GLYPHS = '<>/{}[]=+*#01'
export function IntroHeading({ heading }: { heading: string }) {
  const [ref, live] = useLive<HTMLHeadingElement>(.6), armed = useArmed()
  const [first, second] = heading.split(/(?<=\.)\s+/)
  const [out, setOut] = useState(first)
  useEffect(() => {
    if (!live || !armed) { setOut(first); return }
    let frame = 0; const start = performance.now()
    const step = (now: number) => {
      const t = clamp((now - start) / 900), fixed = Math.floor(t * first.length)
      setOut([...first].map((ch, i) => i < fixed || ch === ' ' ? ch : GLYPHS[(i * 7 + Math.floor(now / 45)) % GLYPHS.length]).join(''))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step); return () => cancelAnimationFrame(frame)
  }, [live, armed, first])
  return <h2 className="intro-heading" ref={ref} data-armed={armed || undefined} data-live={live || undefined} aria-label={heading}>
    <span className="intro-new" aria-hidden="true">{out}</span>
    <span className="intro-old" aria-hidden="true">{second}</span>
  </h2>
}

/* GameOnVB: once the track is fully in view the ball hops 1 -> 4, then the bar drains. */
export function BallRun() {
  const ref = useRef<HTMLDivElement>(null), [p, setP] = useState(1), armed = useArmed()
  const steps = VOLEYEVENTS.steps
  useEffect(() => {
    if (!armed) { setP(1); return } // also settles a run cut short by reduced motion
    setP(0); let frame = 0
    const run = () => {
      const start = performance.now()
      const step = (now: number) => { const t = clamp((now - start) / 2600); setP(t); if (t < 1) frame = requestAnimationFrame(step) }
      frame = requestAnimationFrame(step)
    }
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { io.disconnect(); run() } }, { threshold: 1, rootMargin: '0px 0px -15% 0px' })
    io.observe(ref.current!)
    return () => { io.disconnect(); cancelAnimationFrame(frame) }
  }, [armed])
  const last = steps.length - 1, x = p * last, frac = x - Math.floor(x), hop = p >= 1 ? 0 : Math.sin(Math.PI * frac), done = p >= 1
  return <>
    <div className="ball-steps" ref={ref} role="img" aria-label={`How it works: ${steps.map(s => s.label).join(', then ')}.`}>
      <div className="ball-steps-track">
        <span className="ball-steps-fill" style={{ transform: `scaleX(${p})` }} />
        <img className="ball-steps-ball" src={ball} alt="" style={{ left: `${p * 100}%`, transform: `translate(-50%, ${-hop * 72}px) rotate(${p * 540}deg)` }} />
        <span className="ball-steps-shadow" style={{ left: `${p * 100}%`, transform: `translateX(-50%) scale(${1 - hop * .55})`, opacity: .55 - hop * .3 }} />
        {steps.map((step, i) => <div className="ball-step" data-on={x >= i - .02 || undefined} style={{ left: `${(i / last) * 100}%` }} key={step.id}>
          <span className="ball-step-dot" /><span className="ball-step-number">0{i + 1}</span>
          <span className="ball-step-label"><span className="ball-step-long">{step.label}</span><span className="ball-step-short">{step.short}</span></span>
        </div>)}
      </div>
    </div>
    <div className="drain" data-armed={armed || undefined} data-live={done || undefined}>
      <p className="drain-value"><Count from={62} to={0} live={done} armed={armed} /><span aria-hidden="true">ms</span></p>
      <div className="drain-bar" aria-hidden="true"><span /></div>
      <p className="drain-caption">62 → 0 ms · server CPU time per public page request</p>
    </div>
  </>
}

/* SolidPixels: three handoffs, one role at a time, into one shared page. */
const ROLES = ['Frontend', 'Backend', 'Integrations'] as const
const BLOCKS = [
  { id: 'header', label: 'Header', role: 0, lead: true, from: [-40, -60] },
  { id: 'hero', label: 'Hero', role: 0, lead: false, from: [-40, -60] },
  { id: 'content', label: 'Content API', role: 1, lead: true, from: [60, -40] },
  { id: 'form', label: 'Form', role: 1, lead: false, from: [60, -40] },
  { id: 'integrations', label: 'Integrations', role: 2, lead: true, from: [70, 60] },
] as const
export function SharedPage() {
  const [ref, live] = useLive<HTMLDivElement>(.5), armed = useArmed()
  return <div className="shared" ref={ref} data-armed={armed || undefined} data-live={live || undefined} role="img" aria-label="Frontend, backend and integrations work come together on one shared page.">
    <div className="shared-frame">
      <div className="shared-bar" aria-hidden="true"><i /><i /><i /><span>client-site.cz</span></div>
      <div className="shared-grid" aria-hidden="true">
        {BLOCKS.map(b => <div className={`shared-block shared-${b.id}`} data-role={ROLES[b.role]} key={b.id}
          style={{ '--fx': `${b.from[0]}%`, '--fy': `${b.from[1]}%`, '--delay': `${b.role * .9}s` } as CSSProperties}>
          <span className="shared-label">{b.label}</span>
          {b.lead && <span className="shared-cursor"><svg viewBox="0 0 12 16" width="12" height="16"><path d="M0 0 L12 9 L6.5 9.8 L9.5 16 L7 16 L4.3 10.6 L0 14 Z" /></svg><b>{ROLES[b.role]}</b></span>}
        </div>)}
      </div>
    </div>
    <ul className="shared-legend" aria-hidden="true">{ROLES.map((role, i) => <li data-role={role} style={{ '--delay': `${i * .9 + .6}s` } as CSSProperties} key={role}>{role}</li>)}</ul>
  </div>
}

/* Goal Loop: a task ticket fails Check once, goes back to Build, then passes. */
const ROUTE = [0, 1, 2, 3, 2, 3, 4]
export function TicketRun() {
  const [ref, live] = useLive<HTMLDivElement>(.55), armed = useArmed()
  const [stop, setStop] = useState(ROUTE.length), [run, setRun] = useState(0), stations = GOAL_LOOP_KITCHEN.stations
  useEffect(() => { setStop(armed ? 0 : ROUTE.length) }, [armed]) // armed: wait at Plan until seen; disarmed: end state
  useEffect(() => {
    if (!armed || !live) return
    const timers = ROUTE.map((_, i) => setTimeout(() => setStop(i + 1), 750 * (i + 1)))
    return () => timers.forEach(clearTimeout)
  }, [armed, live, run])
  const at = ROUTE[Math.min(stop, ROUTE.length - 1)], passed = stop >= ROUTE.length, left = (i: number) => `${(i / (stations.length - 1)) * 100}%`
  // stop n = moves made. Check (3) fails on the 4th move and passes on the 6th.
  const stamp = (i: number) => i < 3 ? (stop > i ? 'ok' : undefined) : i === 3 ? (stop >= 6 ? 'ok' : stop === 4 ? 'fail' : undefined) : (passed ? 'ok' : undefined)
  return <div className="ticket-run" ref={ref} data-armed={armed || undefined}>
    <div className="ticket-rail" role="img" aria-label="A task ticket moves through Plan, Critic, Build, Check and Review. One test fails at Check, it goes back to Build, then passes.">
      {stations.map((s, i) => <div className="ticket-station" data-stamp={stamp(i)} style={{ left: left(i) }} key={s.role} aria-hidden="true">
        <span className="ticket-station-mark">{stamp(i) === 'fail' ? '✕' : '✓'}</span><span className="ticket-station-role">{s.role}</span><span className="ticket-station-name">{s.name}</span>
      </div>)}
      <div className="ticket" data-passed={passed || undefined} data-back={stop === 4 || undefined} style={{ left: left(at) }} aria-hidden="true">
        <span>#12 · TASK</span><span>Signup form</span><span>+ email check</span>
        <span className="ticket-stamp">PASS ✓</span>
      </div>
      {(stop === 4 || stop === 5) && <span className="ticket-note" style={{ left: left(at) }} aria-hidden="true">Check: 1 test failed · back to Build</span>}
    </div>
    {/* Evidence, not a stopwatch: it holds its space and rises in after PASS. */}
    <div className="ticket-timer" data-passed={passed || undefined}>
      <p className="ticket-timer-label">Full test run</p>
      <p className="ticket-timer-value">39.4 → 4.8<span>min</span></p>
      <p className="ticket-timer-caption">one audited change set · 395 → 403 tests, all passing</p>
      {armed && <button type="button" style={{ visibility: passed ? 'visible' : 'hidden' }} tabIndex={passed ? 0 : -1} aria-hidden={!passed || undefined} onClick={() => { setStop(0); setRun(n => n + 1) }}>Run it again</button>}
    </div>
  </div>
}

/* Playground: a small hot-wire. The ring rides the wire; straying from it makes it buzz. */
const WIRE = 'M 0 90 C 70 20, 130 20, 200 90 S 330 160, 400 90 S 530 20, 600 90 S 730 160, 800 90'
export function WireTeaser() {
  const svg = useRef<SVGSVGElement>(null), path = useRef<SVGPathElement>(null)
  const [pos, setPos] = useState({ x: 400, y: 90, buzz: false }), [touch, setTouch] = useState(false), armed = useArmed()
  const pointAt = useCallback((x: number) => {
    const el = path.current!, total = el.getTotalLength(); let lo = 0, hi = total
    for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (el.getPointAtLength(mid).x < x) lo = mid; else hi = mid }
    return el.getPointAtLength(lo)
  }, [])
  useEffect(() => { setTouch(matchMedia('(pointer: coarse)').matches) }, [])
  useEffect(() => {
    if (!touch || !armed) { setPos(p => ({ ...p, buzz: false })); return } // disarmed: the ring rests where it is
    // Phones: the ring follows the scroll along the wire.
    let frame = 0
    const update = () => { frame = 0; const r = svg.current!.getBoundingClientRect(), t = clamp((innerHeight * .85 - r.top) / (innerHeight * .6)), pt = pointAt(40 + t * 720); setPos({ x: pt.x, y: pt.y, buzz: false }) }
    const queue = () => { if (!frame) frame = requestAnimationFrame(update) }
    update(); addEventListener('scroll', queue, { passive: true }); return () => { cancelAnimationFrame(frame); removeEventListener('scroll', queue) }
  }, [touch, armed, pointAt])
  const move = (e: React.PointerEvent) => {
    if (touch || reduced() || e.pointerType === 'touch') return
    // Measured against the SVG; the tolerance is in screen pixels.
    const r = svg.current!.getBoundingClientRect(), pt = pointAt(Math.min(780, Math.max(20, ((e.clientX - r.left) / r.width) * 800)))
    setPos({ x: pt.x, y: pt.y, buzz: Math.abs(e.clientY - (r.top + (pt.y / 180) * r.height)) > 34 })
  }
  return <div className="wire" onPointerMove={move} onPointerLeave={() => setPos(p => ({ ...p, buzz: false }))} data-buzz={pos.buzz || undefined}>
    <svg ref={svg} viewBox="0 0 800 180" aria-hidden="true"><path ref={path} className="wire-path" d={WIRE} /><circle className="wire-ring" cx={pos.x} cy={pos.y} r="16" /></svg>
    <p className="wire-hint">{touch ? (armed ? 'Scroll to slide the ring along the wire.' : 'The full game is in the playground.') : pos.buzz ? 'Too far from the wire, it buzzes.' : 'Keep your pointer near the wire and follow it.'}</p>
  </div>
}

/* Contact: the real form's paper sheet slides out of an envelope once. Decoration
   layers never take pointer events, so the live form is always usable. */
export function ContactEnvelope({ children }: { children: ReactNode }) {
  const [ref, live] = useLive<HTMLDivElement>(.25), motion = useArmed(), [skip, setSkip] = useState(false)
  // A jump to #contact (Get in touch, header Contact) must land on the settled sheet:
  // drop the starting pose synchronously, before App's handler measures and scrolls.
  useEffect(() => {
    const settle = () => { if (location.hash !== '#contact') return; ref.current?.removeAttribute('data-armed'); setSkip(true) }
    if (location.hash === '#contact') setSkip(true)
    document.addEventListener('homecontactready', settle); document.addEventListener('homefragmentfocus', settle); addEventListener('hashchange', settle)
    return () => { document.removeEventListener('homecontactready', settle); document.removeEventListener('homefragmentfocus', settle); removeEventListener('hashchange', settle) }
  }, [ref])
  const armed = motion && !skip, [done, setDone] = useState(false)
  // Once the slide and fade end (1.8 s), drop the envelope so it adds no scroll space.
  useEffect(() => { if (!armed || !live) return; const t = setTimeout(() => setDone(true), 1900); return () => clearTimeout(t) }, [armed, live])
  return <div className="contact-envelope" ref={ref} data-armed={armed || undefined} data-live={live || undefined} data-done={done || undefined}>
    <div className="contact-envelope-back" aria-hidden="true" />
    {children}
    <div className="contact-envelope-front" aria-hidden="true"><span /></div>
  </div>
}
