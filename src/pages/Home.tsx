import { useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { CONTACT } from '../content/systems'
import { HOME_COPY, POSTERS } from '../content/homePosters'
import { isClick } from '../home/sliderMath'
import { type ContactTopic } from '../home/contactForm'
import { useContactForm } from '../home/useContactForm'

const email = CONTACT[0].href.slice('mailto:'.length)

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
        <button className="magnetic-cta" type="submit" disabled={sending}>{sending ? 'Sending…' : HOME_COPY.contactCta} <span aria-hidden="true">↗</span></button>
        {submitError === 'send' && <p className="poster-form-error" role="alert">Couldn't send. Email me directly at <a className="target-link" href={CONTACT[0].href}>{email}</a></p>}
        {submitError === 'rate' && <p className="poster-form-error" role="alert">Please wait a minute before sending another message.</p>}
      </form>}
    <div className="poster-contact-links"><nav aria-label="Contact and CV">{CONTACT.slice(1).map((link) => <a className="target-link" key={link.label} href={link.href} download={link.download}>{link.label}</a>)}</nav></div>
  </div>
}

export function ScreenSwitch() {
  const [swapped, setSwapped] = useState(false)
  const [touched, setTouched] = useState(false)
  const pointerStart = useRef(0)
  const pointerDistance = useRef(0)
  const trackPointer = (x: number) => { pointerDistance.current = Math.max(pointerDistance.current, Math.abs(x - pointerStart.current)) }

  return <div className="screen-switch" data-swapped={swapped} data-touched={touched}>
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

function GoalLoopVisual() {
  return <div className="goal-pipeline" data-returned="true" data-verdict="true" role="img" aria-label="Plan, Critique, Build, Check, Review, then PASS. Failed checks return to Build for repair.">
    <div className="goal-rail" />
    {['Plan', 'Critique', 'Build', 'Check', 'Review', 'Verdict'].map((name, index) =>
      <div className={`goal-stage${index === 5 ? ' goal-verdict' : ''}`} data-state="passed" style={{ '--stage-x': `${10 + index * 16}%`, '--stage-y': `${12 + index * 12}%` } as CSSProperties} key={name}>
        <span className="goal-index">{index < 5 ? String(index + 1).padStart(2, '0') : '→'}</span>
        <span className="goal-node">{index < 5 ? '✓' : <span className="goal-stamp">PASS</span>}</span>
        <span className="goal-label"><span>{name}</span>{index === 3 && <span className="goal-failure">✕ Check failed</span>}</span>
      </div>)}
    <div className="goal-return"><span>Repair</span></div>
    <span className="goal-token"><span className="goal-token-jagged" /><span className="goal-token-clean" /></span>
    <p className="goal-caption">Every change passes each check, or it goes back for repair.</p>
  </div>
}

export function HomePage({ onNavigate }: { readonly onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  return <div className="home-supporting">
    {POSTERS.map((poster, index) => <section id={poster.id === 'hero' ? 'introduction' : poster.id === 'contact' ? 'contact' : undefined} data-poster={poster.id} key={poster.id}>
      {poster.id === 'contact'
        ? <p className="eyebrow contact-card-top"><span aria-hidden="true">Hoang Viet To</span><span>{poster.label}</span><i aria-hidden="true">+</i></p>
        : <p className="eyebrow">{poster.label}</p>}
      <h2>{poster.heading}</h2>
      <p>{poster.body}</p>
      {poster.facts ? <dl className="poster-facts">{poster.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.text}</dd></div>)}</dl> : null}
      {index === 0 ? <p>{HOME_COPY.positioning}</p> : null}
      {poster.id === 'goal-loop' ? <GoalLoopVisual /> : poster.id === 'tools' ? <ScreenSwitch /> : null}
      {poster.href ? <a className="target-link" href={poster.href} onClick={onNavigate}>{poster.cta ?? HOME_COPY.cta}<span aria-hidden="true">↗</span></a> : null}
      {poster.id === 'contact' ? <ContactPoster /> : null}
    </section>)}
  </div>
}
