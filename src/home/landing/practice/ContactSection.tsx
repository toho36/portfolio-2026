import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CONTACT } from '../../../content/systems'
import { HOME_COPY, POSTERS } from '../../../content/homePosters'
import { sendContact, validateContact, type ContactErrors, type ContactTopic, type ContactValues } from '../../contactForm'
import './practice.css'

const contact = POSTERS.find((poster) => poster.id === 'contact')!
const email = CONTACT[0].href.slice('mailto:'.length)

export function ContactSection() {
  const [values, setValues] = useState<ContactValues>({ name: '', email: '', topic: 'Project', message: '', _honey: '' })
  const [errors, setErrors] = useState<ContactErrors>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [submitError, setSubmitError] = useState<'send' | 'rate' | null>(null)
  const sendingRef = useRef(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const successRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => { if (sent) successRef.current?.focus() }, [sent])

  function update<K extends keyof ContactValues>(field: K, value: ContactValues[K]) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitError(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sendingRef.current) return
    if (values._honey.trim()) { setSent(true); return }
    const found = validateContact(values)
    setErrors(found)
    if (found.name || found.email || found.message) {
      if (found.name) nameRef.current?.focus()
      else if (found.email) emailRef.current?.focus()
      else messageRef.current?.focus()
      return
    }
    try {
      if (Date.now() - Number(localStorage.getItem('portfolioContactSentAt')) < 60_000) {
        setSubmitError('rate')
        return
      }
    } catch { /* Storage is optional. */ }
    sendingRef.current = true
    setSending(true)
    setSubmitError(null)
    const success = await sendContact(values)
    if (success) {
      try { localStorage.setItem('portfolioContactSentAt', String(Date.now())) } catch { /* Storage is optional. */ }
      setSent(true)
    } else setSubmitError('send')
    setSending(false)
    sendingRef.current = false
  }

  return <section className="landing-contact landing-section landing-practice-contact" id="contact" aria-labelledby="landing-contact-title">
    <div className="landing-section-heading"><h2 id="landing-contact-title"><span className="landing-section-number">03</span>{contact.heading}</h2><a href={CONTACT[0].href}>Email <span aria-hidden="true">↗</span></a></div>
    <div className="landing-contact-grid">
      <div><p className="landing-contact-intro">{contact.body}</p><a className="landing-email" href={CONTACT[0].href}>{email}</a><nav className="landing-contact-links" aria-label="Contact and CV">{CONTACT.slice(1).map((link) => <a key={link.label} href={link.href} download={link.download}>{link.label} ↗</a>)}</nav></div>
      {sent ? <p className="landing-contact-success" ref={successRef} tabIndex={-1} aria-live="polite">Thanks — message sent. I'll reply within a few days.</p> :
        <form className="landing-contact-form" noValidate onSubmit={submit} aria-busy={sending}>
          <div className="landing-form-row">
            <label htmlFor="landing-name">Name<input id="landing-name" name="name" ref={nameRef} required autoComplete="name" value={values.name} onChange={(event) => update('name', event.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'landing-name-error' : undefined} />{errors.name && <span id="landing-name-error" className="landing-contact-error">{errors.name}</span>}</label>
            <label htmlFor="landing-email">Email<input id="landing-email" name="email" ref={emailRef} type="email" required autoComplete="email" value={values.email} onChange={(event) => update('email', event.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'landing-email-error' : undefined} />{errors.email && <span id="landing-email-error" className="landing-contact-error">{errors.email}</span>}</label>
          </div>
          <fieldset><legend>Topic</legend><div className="landing-topic-options">{(['Role', 'Project', 'Other'] as const).map((topic: ContactTopic) => <label key={topic}><input type="radio" name="topic" value={topic} checked={values.topic === topic} onChange={() => update('topic', topic)} /><span>{topic}</span></label>)}</div></fieldset>
          <label htmlFor="landing-message">Message<textarea id="landing-message" name="message" ref={messageRef} required minLength={20} maxLength={4000} rows={3} value={values.message} onChange={(event) => update('message', event.target.value)} aria-invalid={!!errors.message} aria-describedby={errors.message ? 'landing-message-error' : undefined} />{errors.message && <span id="landing-message-error" className="landing-contact-error">{errors.message}</span>}</label>
          <div className="landing-contact-honey" aria-hidden="true"><label htmlFor="landing-honey">Leave this field empty</label><input id="landing-honey" name="_honey" tabIndex={-1} autoComplete="off" value={values._honey} onChange={(event) => update('_honey', event.target.value)} /></div>
          <button className="landing-button" type="submit" disabled={sending}>{sending ? 'Sending…' : HOME_COPY.contactCta} <span aria-hidden="true">↗</span></button>
          <span className="landing-contact-status" aria-live="polite">{sending ? 'Sending your message…' : ''}</span>
          {submitError === 'send' && <p className="landing-contact-error" role="alert">Couldn't send. Email me directly at <a href={CONTACT[0].href}>{email}</a></p>}
          {submitError === 'rate' && <p className="landing-contact-error" role="alert">Please wait a minute before sending another message.</p>}
        </form>}
    </div>
  </section>
}
