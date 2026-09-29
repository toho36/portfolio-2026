import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent } from 'react'
import { CONTACT } from '../content/systems'
import { HOME_COPY, POSTERS } from '../content/homePosters'
import { createLoader } from '../home/loader'
import { loadPosterBridge, type PosterRuntime } from '../home/posterBridge'
import { bendFromVelocity, isClick } from '../home/sliderMath'
import { createSliderController } from '../home/sliderController'
import { createCursorFollow } from '../home/cursorFollow'
import { sendContact, validateContact, type ContactErrors, type ContactTopic, type ContactValues } from '../home/contactForm'

const email = CONTACT[0].href.slice('mailto:'.length)

function ContactPoster() {
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
  const trackRef = useRef<HTMLOListElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const followRef = useRef<ReturnType<typeof createCursorFollow> | null>(null)
  const runtimeRef = useRef<PosterRuntime | null>(null)
  const smoothRef = useRef<MediaQueryList | null>(null)
  const [state, setState] = useState<'static' | 'loading' | 'ready'>('static')
  const [progress, setProgress] = useState(0)
  const [active, setActive] = useState(0)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const track = trackRef.current
    const host = hostRef.current
    if (!track || !host) return
    let canceled = false
    let runtime: PosterRuntime | undefined
    let runtimeReady = false
    let firstFrameReady = false
    const showRuntime = () => { if (!canceled && runtimeReady && firstFrameReady) setState('ready') }
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    const controller = createSliderController(track, { reducedMotion, announce: setAnnouncement })
    const removeChange = controller.onChange((index, velocity) => {
      setActive(index)
      runtime?.setActive(index)
      runtime?.setBend(reducedMotion ? 0 : bendFromVelocity(velocity))
    })
    const loader = createLoader({
      steps: ['fonts', 'three', 'firstFrame'],
      onProgress: setProgress,
      onDone: () => { if (!canceled) setState(runtimeReady && firstFrameReady ? 'ready' : 'static') },
    })
    if (!reducedMotion) setState('loading')
    void (document.fonts?.ready ?? Promise.resolve()).then(() => loader.mark('fonts'))
    void loadPosterBridge({
      host,
      slots: Array.from(track.querySelectorAll<HTMLElement>('.poster-visual')),
      accents: POSTERS.map((poster) => poster.accent),
      reducedMotion,
      isCanceled: () => canceled,
      onFirstFrame: () => { firstFrameReady = true; loader.mark('firstFrame'); showRuntime() },
    }).then((result) => {
      if (canceled) { if (result.status === 'created') result.runtime.destroy(); return }
      if (result.status === 'created') {
        runtime = result.runtime
        runtimeRef.current = runtime
        runtimeReady = true
        runtime.setActive(controller.index)
        showRuntime()
      } else {
        loader.mark('firstFrame')
      }
      loader.mark('three')
    })
    return () => {
      canceled = true
      removeChange()
      controller.destroy()
      loader.destroy()
      runtime?.destroy()
      runtimeRef.current = null
    }
  }, [])

  useEffect(() => {
    const cursor = cursorRef.current
    if (!cursor) return
    const smooth = matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)')
    smoothRef.current = smooth
    const follow = createCursorFollow(cursor, () => smooth.matches)
    followRef.current = follow
    return () => { follow.stop(); followRef.current = null }
  }, [])

  function setPointer(main: HTMLElement, x: number, y: number) {
    main.style.setProperty('--px', x.toFixed(3))
    main.style.setProperty('--py', y.toFixed(3))
    runtimeRef.current?.setPointer(x, y)
  }

  function moveCursor(event: MouseEvent<HTMLElement>) {
    const cursor = cursorRef.current
    if (!cursor) return
    followRef.current?.move(event.clientX, event.clientY)
    if (smoothRef.current?.matches) setPointer(event.currentTarget, event.clientX / innerWidth * 2 - 1, event.clientY / innerHeight * 2 - 1)
    cursor.dataset.label = (event.target as Element).closest('input, textarea, label') ? '' : (event.target as Element).closest('.screen-switch-hit') ? 'Switch' : (event.target as Element).closest('button') ? 'Send' : (event.target as Element).closest('a') ? 'Open' : 'Drag'
  }

  return (
    <main id="main-content" tabIndex={-1} className="home-slider" data-home-state={state} data-active={POSTERS[active].id} onMouseMove={moveCursor} onMouseLeave={(event) => { followRef.current?.stop(); setPointer(event.currentTarget, 0, 0); if (cursorRef.current) cursorRef.current.dataset.label = '' }}>
      <div className="poster-canvas-host" ref={hostRef} aria-hidden="true" />
      <div className="home-loader" role="status" aria-label={HOME_COPY.loader}><span>{HOME_COPY.loader}</span><strong>{String(progress).padStart(3, '0')} %</strong></div>
      <div className="home-counter" aria-hidden="true">{POSTERS[active].index} / 06</div>
      <ol className="poster-track" ref={trackRef} aria-label="Selected work">
        {POSTERS.map((poster, index) => <li key={poster.id}>
          <article className="poster" data-poster={poster.id} data-index={poster.index} data-label={poster.label} style={{ '--accent': poster.accent } as CSSProperties}>
            <div className="poster-top"><span>{poster.label}</span></div>
            <div className="poster-visual" aria-hidden={poster.id === 'tools' || poster.id === 'goal-loop' ? undefined : true}>{poster.id === 'tools' ? <ScreenSwitch /> : poster.id === 'goal-loop' ? <GoalLoopVisual /> : <div className="poster-static-mark" />}</div>
            <div className="poster-copy">
              <div className="poster-title-mask">
                {index === 0 ? <h1 tabIndex={-1}><span>New tools.</span>{' '}<span>Old standards.</span></h1> : <h2 tabIndex={-1}>{poster.heading}</h2>}
              </div>
              <p className="poster-body">{poster.body}</p>
              {index === 0 ? <p className="poster-positioning">{HOME_COPY.positioning}</p> : null}
              {poster.href ? <a className="target-link poster-cta" href={poster.href} onClick={onNavigate}>{HOME_COPY.cta}<span aria-hidden="true">↗</span></a> : null}
              {poster.id === 'contact' ? <ContactPoster /> : null}
            </div>
          </article>
        </li>)}
      </ol>
      <p className="poster-hint"><span>{HOME_COPY.hintDesktop}</span><span>{HOME_COPY.hintTouch}</span><span aria-hidden="true"> ↓</span></p>
      <div className="home-cursor" ref={cursorRef} aria-hidden="true" style={{ '--cursor-accent': POSTERS[active].accent } as CSSProperties} />
      <p className="visually-hidden" aria-live="polite">{announcement}</p>
    </main>
  )
}
