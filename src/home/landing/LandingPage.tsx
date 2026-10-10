import { CONTACT } from '../../content/systems'
import { HOME_COPY, POSTERS } from '../../content/homePosters'
import { PROJECT_STORIES } from '../../content/projects'
import attendancePlayer from './assets/attendance-player.png'
import attendancePayment from './assets/attendance-payment.png'
import attendanceArrived from './assets/attendance-arrived.png'
import './shared/tokens.css'
import './landing.css'

const contact = POSTERS.find((poster) => poster.id === 'contact')!
const goalLoop = POSTERS.find((poster) => poster.id === 'goal-loop')!
const steps = ['Event opens', 'Player registers', 'Payment matched', 'Attendance resolved']

export function LandingPage() {
  return <div className="landing-page" id="landing-top">
    <a className="landing-skip" href="#landing-main">Skip to content</a>
    <header className="landing-header">
      <a className="landing-brand" href="#landing-top">Hoang Viet To</a>
      <span className="landing-header-role">{HOME_COPY.role}</span>
      <nav aria-label="Primary"><a href="#work">Work</a><a href="#contact">Contact <span aria-hidden="true">↗</span></a></nav>
    </header>
    <main id="landing-main" tabIndex={-1}>
      <section className="landing-hero" id="introduction" aria-labelledby="landing-headline">
        <div className="landing-hero-copy">
          <p className="landing-kicker">{HOME_COPY.role}</p>
          <div id="landing-headline"><h1>I build web platforms and the systems behind them.</h1></div>
          <p className="landing-intro">At SolidPixels, I work across CMS, frontend, backend and third-party integrations; GameOnVB is my own full-stack product.</p>
          <div className="landing-hero-links"><a className="landing-button" href="#work">Work <span aria-hidden="true">↓</span></a><a className="landing-text-link" href="#contact">Contact <span aria-hidden="true">↗</span></a></div>
        </div>
        <figure className="landing-proof" aria-labelledby="landing-proof-title">
          <figcaption className="landing-proof-heading"><p id="landing-proof-title">GameOnVB — from event to attendance</p><span className="landing-proof-label">Reconstruction with demo data</span></figcaption>
          <ol className="landing-proof-steps" aria-label="Registration lifecycle">
            {steps.map((step, index) => <li key={step} aria-current={index === 3 ? 'step' : undefined}><span className="landing-step-number">0{index + 1}</span><span>{step}{index === 2 && <small>Simulated bank input</small>}</span></li>)}
          </ol>
          <div className="landing-proof-image" role="group" aria-label="Same registration: Demo Player, payment matched, attendance recorded">
            <img className="landing-proof-player" src={attendancePlayer} width={460} height={170} alt="Demo Player" />
            <div className="landing-proof-results"><img src={attendancePayment} width={240} height={100} alt="Spárováno" /><img src={attendanceArrived} width={210} height={100} alt="Dorazil" /></div>
          </div>
          <div className="landing-proof-end"><span className="landing-kicker">04 / Attendance resolved</span><p>The organizer records attendance against the same registration, with an audit entry.</p></div>
          <a className="landing-proof-link" href="/gameonvb">View project <span aria-hidden="true">↗</span></a>
        </figure>
      </section>

      <section className="landing-work landing-section" id="work" aria-labelledby="landing-work-title">
        <div className="landing-section-heading"><h2 id="landing-work-title"><span className="landing-section-number">01</span>Selected work</h2></div>
        <div className="landing-project-index">
          <details className="landing-project landing-solidpixels" open>
            <summary><span className="landing-project-number">01</span><span className="landing-project-name">SolidPixels</span><span className="landing-project-role">CMS, frontend, backend, integrations</span><span className="landing-project-kind">Team</span><span className="landing-disclosure" aria-hidden="true" /></summary>
            <div className="landing-project-detail landing-solidpixels-detail">
              <p className="landing-solidpixels-contribution">I work with other developers on a CMS platform and client sites: frontend, backend and third-party integrations.</p>
              <dl><div><dt>Context</dt><dd>Team work on a CMS platform and client sites.</dd></div><div><dt>My part</dt><dd>frontend, backend and third-party integrations.</dd></div><div><dt>Team result vs. my part</dt><dd>the platform and the client sites are team work; my contribution is the frontend, backend and integration work within them.</dd></div></dl>
            </div>
          </details>
          <details className="landing-project">
            <summary><span className="landing-project-number">02</span><span className="landing-project-name">GameOnVB</span><span className="landing-project-role">Full-stack developer</span><span className="landing-project-kind">Solo</span><span className="landing-disclosure" aria-hidden="true" /></summary>
            <div className="landing-project-detail"><p>{PROJECT_STORIES.voleyevents.preview}</p><dl><div><dt>Constraint</dt><dd>{PROJECT_STORIES.voleyevents.constraint}</dd></div><div><dt>Decision</dt><dd>{PROJECT_STORIES.voleyevents.decision}</dd></div></dl><div className="landing-detail-links"><a href="/gameonvb">View project ↗</a><a href={PROJECT_STORIES.gameonvb.verifiedUrl}>gameonvb.cz ↗</a></div></div>
          </details>
          <details className="landing-project">
            <summary><span className="landing-project-number">03</span><span className="landing-project-name">Screen Switch</span><span className="landing-project-role">Independent macOS developer</span><span className="landing-project-kind">Solo</span><span className="landing-disclosure" aria-hidden="true" /></summary>
            <div className="landing-project-detail"><p>{PROJECT_STORIES['screen-switch'].preview}</p><dl><div><dt>Constraint</dt><dd>{PROJECT_STORIES['screen-switch'].constraint}</dd></div><div><dt>Decision</dt><dd>{PROJECT_STORIES['screen-switch'].decision}</dd></div></dl></div>
          </details>
          <details className="landing-project">
            <summary><span className="landing-project-number">04</span><span className="landing-project-name">Goal Loop</span><span className="landing-project-kind">Solo</span><span className="landing-disclosure" aria-hidden="true" /></summary>
            <div className="landing-project-detail"><p>{goalLoop.body}</p><a href="/goal-loop">View project ↗</a></div>
          </details>
        </div>
        <div className="landing-work-footnote"><span>A real-time 3D skill game.</span><a href="/playground">Playground <span aria-hidden="true">↗</span></a></div>
      </section>

      <section className="landing-approach landing-section" id="approach" aria-labelledby="landing-approach-title">
        <div className="landing-section-heading"><h2 id="landing-approach-title"><span className="landing-section-number">02</span>How I work</h2><a href="/goal-loop">Goal Loop <span aria-hidden="true">↗</span></a></div>
        <p>I work alone on my own products and with other developers at SolidPixels. I adopt new tools early and hold their output to the same standard as my own: every change is checked before it ships. Goal Loop is how I run that process.</p>
      </section>

      <section className="landing-contact landing-section" id="contact" aria-labelledby="landing-contact-title">
        <div className="landing-section-heading"><h2 id="landing-contact-title"><span className="landing-section-number">03</span>{contact.heading}</h2><a href={CONTACT[0].href}>Email <span aria-hidden="true">↗</span></a></div>
        <div className="landing-contact-grid"><div><p className="landing-contact-intro">{contact.body}</p><a className="landing-email" href={CONTACT[0].href}>{CONTACT[0].href.slice('mailto:'.length)}</a><nav className="landing-contact-links" aria-label="Contact and CV">{CONTACT.slice(1).map((link) => <a key={link.label} href={link.href} download={link.download}>{link.label} ↗</a>)}</nav></div>
          <form className="landing-contact-form" aria-describedby="landing-form-note" onSubmit={(event) => event.preventDefault()}>
            <p className="landing-form-note" id="landing-form-note">Static preview — use Email to get in touch.</p>
            <div className="landing-form-row"><label htmlFor="landing-name">Name<input id="landing-name" name="name" autoComplete="name" /></label><label htmlFor="landing-email">Email<input id="landing-email" name="email" type="email" autoComplete="email" /></label></div>
            <fieldset><legend>Topic</legend><div className="landing-topic-options">{(['Role', 'Project', 'Other'] as const).map((topic) => <label key={topic}><input type="radio" name="topic" value={topic} defaultChecked={topic === 'Project'} /><span>{topic}</span></label>)}</div></fieldset>
            <label htmlFor="landing-message">Message<textarea id="landing-message" name="message" rows={3} minLength={20} maxLength={4000} /></label>
            <button className="landing-button" type="submit" disabled>{HOME_COPY.contactCta} <span aria-hidden="true">↗</span></button>
          </form>
        </div>
      </section>
    </main>
    <footer className="landing-footer"><span>Hoang Viet To <span aria-hidden="true">/</span> {HOME_COPY.role}</span><a href="#landing-top">Return to top ↑</a></footer>
  </div>
}
