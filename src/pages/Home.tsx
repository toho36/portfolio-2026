import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { CONTACT } from '../content/systems'
import { HOME_COPY, POSTERS, type Poster } from '../content/homePosters'
import { BallRun, ContactEnvelope, IntroHeading, SharedPage, TicketRun, WireTeaser } from '../home/living/LivingVisuals'
import { isClick } from '../home/sliderMath'
import { type ContactTopic } from '../home/contactForm'
import { useContactForm } from '../home/useContactForm'

const email = CONTACT[0].href.slice('mailto:'.length)

/** Short, heavy "opens elsewhere" arrow; the font's ↗ is long and hairline next to bold labels. */
export function ArrowUpRight() {
  return <svg className="arrow-up-right" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <path d="M3.5 12.5 12.5 3.5M5.5 3.5h7v7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

function ContactPoster() {
  const { values, errors, sending, sent, submitError, nameRef, emailRef, messageRef, successRef, update, submit } = useContactForm()

  return <div className="poster-contact">
    {sent ? <p className="poster-contact-success" ref={successRef} tabIndex={-1} aria-live="polite">Thanks — message sent. I'll reply within a few days.</p> :
      <form className="poster-contact-form" noValidate onSubmit={submit}>
        <div className="poster-form-field"><label htmlFor="contact-name">Name</label><input id="contact-name" name="name" ref={nameRef} required autoComplete="name" value={values.name} onChange={(event) => update('name', event.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'contact-name-error' : undefined} />{errors.name && <span id="contact-name-error" className="poster-form-error">{errors.name}</span>}</div>
        <div className="poster-form-field"><label htmlFor="contact-email">Email</label><input id="contact-email" name="email" ref={emailRef} type="email" required autoComplete="email" value={values.email} onChange={(event) => update('email', event.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'contact-email-error' : undefined} />{errors.email && <span id="contact-email-error" className="poster-form-error">{errors.email}</span>}</div>
        <fieldset className="poster-form-topic"><legend>Topic</legend><div>{(['Role', 'Project', 'Other'] as const).map((topic: ContactTopic) => <label key={topic}><input type="radio" name="topic" value={topic} checked={values.topic === topic} onChange={() => update('topic', topic)} /><span>{topic}</span></label>)}</div></fieldset>
        <div className="poster-form-field"><label htmlFor="contact-message">Message</label><textarea id="contact-message" name="message" ref={messageRef} required minLength={20} maxLength={4000} rows={4} value={values.message} onChange={(event) => update('message', event.target.value)} aria-invalid={!!errors.message} aria-describedby={errors.message ? 'contact-message-error' : undefined} />{errors.message && <span id="contact-message-error" className="poster-form-error">{errors.message}</span>}</div>
        <div className="poster-honey"><label htmlFor="contact-honey">Leave this field empty</label><input id="contact-honey" name="_honey" tabIndex={-1} autoComplete="off" value={values._honey} onChange={(event) => update('_honey', event.target.value)} /></div>
        <button className="magnetic-cta" type="submit" disabled={sending}>{sending ? 'Sending…' : HOME_COPY.contactCta} <ArrowUpRight /></button>
        {submitError === 'send' && <p className="poster-form-error" role="alert">Couldn't send. Email me directly at <a className="target-link" href={CONTACT[0].href}>{email}</a></p>}
        {submitError === 'rate' && <p className="poster-form-error" role="alert">Please wait a minute before sending another message.</p>}
      </form>}
    <div className="poster-contact-links"><nav aria-label="Contact and CV">{CONTACT.slice(1).map((link) => <a className="target-link" key={link.label} href={link.href} download={link.download}>{link.label}</a>)}</nav></div>
  </div>
}

export function ScreenSwitch({ autoSwap = false }: { autoSwap?: boolean } = {}) {
  const [swapped, setSwapped] = useState(false)
  const [touched, setTouched] = useState(false)
  const pointerStart = useRef(0)
  const pointerDistance = useRef(0)
  const root = useRef<HTMLDivElement>(null)
  // On the homepage it demonstrates itself once when it comes into view; clicks still own it after that.
  useEffect(() => {
    const el = root.current
    if (!autoSwap || !el || typeof IntersectionObserver === 'undefined') return
    let timer: ReturnType<typeof setTimeout> | undefined
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      io.disconnect()
      // Reduced motion: show the swapped arrangement at once (no data-touched, so no animation).
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setSwapped(true); return }
      timer = setTimeout(() => { setTouched(true); setSwapped(true) }, 400)
    }, { threshold: .6 })
    io.observe(el); return () => { io.disconnect(); clearTimeout(timer) }
  }, [autoSwap])
  const trackPointer = (x: number) => { pointerDistance.current = Math.max(pointerDistance.current, Math.abs(x - pointerStart.current)) }

  return <div className="screen-switch" ref={root} data-swapped={swapped} data-touched={touched}>
    <div className="switch-displays" aria-hidden="true">
      {['left', 'right'].map((side) => <div className="switch-monitor" key={side}>
        <div className="switch-bezel"><div className="switch-menu"><span className="switch-menu-icon" /><span className="switch-menu-lines" /></div></div>
        <span className="switch-neck" /><span className="switch-foot" />
      </div>)}
      {['a', 'b'].map((windowName) => <div className={`switch-window switch-window-${windowName}`} key={windowName}>
        <div className="switch-titlebar"><span className="switch-dots"><i /><i /><i /></span><span>WINDOW {windowName.toUpperCase()}</span></div>
        <div className="switch-window-content"><span /><span /><span /></div>
      </div>)}
    </div>
    <button className="screen-switch-hit" type="button" aria-label="Swap windows between displays" aria-pressed={swapped}
      onPointerDown={(event) => { pointerStart.current = event.clientX; pointerDistance.current = 0 }}
      onPointerMove={(event) => { if (event.buttons) trackPointer(event.clientX) }}
      onPointerUp={(event) => trackPointer(event.clientX)}
      onPointerCancel={() => { pointerDistance.current = Infinity }}
      onClick={(event) => { if (event.detail && !isClick(pointerDistance.current)) { event.preventDefault(); return } setTouched(true); setSwapped((current) => !current) }}>
      <span className="switch-hint"><span className="switch-hint-fine">Click</span><span className="switch-hint-touch">Tap</span> to switch <span className="switch-keycap" aria-hidden="true">↔</span></span>
    </button>
    <span className="visually-hidden" aria-live="polite">{touched ? `Window A on the ${swapped ? 'right' : 'left'} display; Window B on the ${swapped ? 'left' : 'right'} display.` : ''}</span>
  </div>
}

export function HomePage({ onNavigate }: { readonly onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  return <div className="home-supporting">
    {POSTERS.map((poster, index) => {
      const section = <section id={poster.id === 'hero' ? 'introduction' : poster.id === 'contact' ? 'contact' : undefined} data-poster={poster.id} key={poster.id}>
        {poster.id === 'contact'
          ? <p className="eyebrow contact-card-top"><span aria-hidden="true">Hoang Viet To</span><span>{poster.label}</span><i aria-hidden="true">+</i></p>
          : <p className="eyebrow">{poster.label}</p>}
        {poster.id === 'hero' ? <IntroHeading heading={poster.heading} /> : <h2>{poster.heading}</h2>}
        <p>{poster.body}</p>
        {index === 0 ? <p>{HOME_COPY.positioning}</p> : null}
        {LIVING[poster.id]}
        {poster.facts ? <dl className="poster-facts">{poster.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.text}</dd></div>)}</dl> : null}
        {poster.href ? <a className="target-link" href={poster.href} onClick={onNavigate}>{poster.cta ?? HOME_COPY.cta}<ArrowUpRight /></a> : null}
        {poster.id === 'contact' ? <ContactPoster /> : null}
      </section>
      return poster.id === 'contact' ? <ContactEnvelope key={poster.id}>{section}</ContactEnvelope> : section
    })}
  </div>
}

// Each section's one motion (study 036); contact's envelope wraps the real form above.
const LIVING: Partial<Record<Poster['id'], ReactNode>> = {
  gameonvb: <BallRun />, solidpixels: <SharedPage />, 'goal-loop': <TicketRun />, playground: <WireTeaser />, tools: <ScreenSwitch autoSwap />,
}
