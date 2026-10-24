import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Arrow } from '../../components/Arrow'
import type { ArenaOptions } from './player.js'
import './arena.css'

type PlayerModule = { mountArena: (hero: HTMLElement, options: ArenaOptions) => () => void }

// Own one player per effect, including StrictMode's canceled first mount.
export function mountArenaIntro(hero: HTMLElement, onExit: () => void, load: () => Promise<PlayerModule> = () => import('./player.js')) {
  let canceled = false
  let dispose: (() => void) | undefined
  // Without a player the controls are dead, so a failed load must release the page.
  void load().then((module) => {
    if (!canceled) dispose = module.mountArena(hero, { media: '/arena', onExit })
  }).catch(() => { if (!canceled) onExit() })
  return () => {
    canceled = true
    dispose?.()
  }
}

interface ArenaIntroProps {
  readonly onClose: (focusMain?: boolean) => void
  readonly onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void
}

// Full-screen intro over the homepage. Skip, or Next at the last stop, reveals the cards below.
export function ArenaIntro({ onClose, onNavigate }: ArenaIntroProps) {
  const hero = useRef<HTMLElement>(null)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!hero.current) return
    const root = document.documentElement, overflow = root.style.overflow
    root.style.overflow = 'hidden'
    const dispose = mountArenaIntro(hero.current, () => setLeaving(true))
    return () => {
      dispose()
      root.style.overflow = overflow
    }
  }, [])

  useEffect(() => {
    if (!leaving) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => onClose(), reduced ? 0 : 450)
    return () => window.clearTimeout(timer)
  }, [leaving, onClose])

  const project = (event: MouseEvent<HTMLAnchorElement>) => {
    onNavigate(event)
    // The opened project owns focus; do not pull it back to the page behind.
    if (event.defaultPrevented) onClose(false)
  }

  return (
    <div className="arena arena-intro" data-leaving={leaving || undefined}>
      <section ref={hero} className="hero" aria-label="Portfolio introduction" tabIndex={-1}>
        <picture id="still"><source media="(orientation: portrait)" srcSet="/arena/mobile/poster.webp" /><img src="/arena/desktop/poster.webp" alt="Modern arena at blue hour" fetchPriority="high" /></picture>
        <div id="gameon-hold" hidden aria-hidden="true"><video id="ambient" muted playsInline loop preload="none" aria-hidden="true" /><img id="gameon-peek" alt="" aria-hidden="true" hidden /></div>
        <video id="film" muted playsInline preload="none" aria-hidden="true" /><div className="shade" />
        <div className="copy" data-stop="0"><p className="eyebrow">Hoang Viet To</p><p className="role">Software Developer</p><h1>I build web platforms and the systems behind them.</h1><p>I work alone on my own products and with a team at SolidPixels. I use new tools early and hold their output to the same standard as my own.</p></div>
        <div className="copy" data-stop="1" hidden><h2>GameOnVB</h2><p className="tagline">Less organising. More time on court.</p><p>My own product, built end to end: registration, payments and attendance for recurring volleyball sessions.</p><a className="target-link more" href="/gameonvb" onClick={project}><span className="link-label">Read the GameOnVB case study</span><Arrow direction="right"/></a></div>
        <div className="copy" data-stop="2" hidden><h2>Goal Loop</h2><p className="tagline">Speed with hard checks.</p><p>How I deliver software. Every change is planned, critiqued, built, checked and reviewed. It passes only when every check agrees.</p><a className="target-link more" href="/goal-loop" onClick={project}><span className="link-label">Read the Goal Loop case study</span><Arrow direction="right"/></a></div>
        <div className="copy" data-stop="3" hidden><h2>Goal Loop</h2><p className="tagline">One run, start to finish.</p><p>Check found a crack. Build used one of the two repair pieces, the same Check passed, and Review confirmed the fit.</p><a className="target-link more" href="/goal-loop" onClick={project}><span className="link-label">Read the Goal Loop case study</span><Arrow direction="right"/></a></div>
        <div className="copy" data-stop="4" hidden><h2 className="screen-switch-title"><img src="/arena/screen-switch-icon.png" alt="" aria-hidden="true" width="32" height="32" /><span>Screen Switch</span></h2><p className="tagline">Small tools, finished properly.</p><p>A native macOS menu-bar utility that swaps eligible windows between displays.</p></div>
        <div className="copy" data-stop="5" hidden><h2>Playground</h2><p className="tagline">Interaction, studied closely.</p><p>Hot Wire, a 3D skill game, and Villa, a 3D scroll animation.</p><a className="target-link more" href="/playground" onClick={project}><span className="link-label">Open playground</span><Arrow direction="right"/></a></div>
        <div className="intro-controls">
          <p id="finding" className="finding" role="status" hidden />
          <p id="error" className="error" hidden>Media unavailable or stalled. The last valid still is shown. You can continue or skip.</p>
          <nav aria-label="Six chapters"><button id="prev" type="button" disabled>Prev</button><span id="count" aria-hidden="true">01 / 06</span><button id="next" type="button">Next <span aria-hidden="true">↓</span></button><div className="intro-exits"><button id="skip" type="button">Skip to work</button><a className="target-link" href="/#contact" onClick={project}>Contact</a></div></nav>
        </div>
        <p id="announcement" className="sr-only" aria-live="polite" aria-atomic="true" />
      </section>
    </div>
  )
}
