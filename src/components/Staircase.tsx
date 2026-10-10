import { useEffect, useId, useRef } from 'react'
import { STORY_CHAPTERS } from '../gameonvb/stairStory'
import type { LandingIndex } from '../gameonvb/stairBall'
import './Staircase.css'

interface StaircaseProps {
  readonly landing: LandingIndex
  readonly onLanding: (index: LandingIndex) => void
}

export function Staircase({ landing, onLanding }: StaircaseProps) {
  const root = useRef<HTMLDivElement>(null)
  const id = useId()
  const chapter = STORY_CHAPTERS[landing]
  useEffect(() => {
    const element = root.current
    if (!element) return
    let canceled = false
    let destroy: (() => void) | undefined
    void import('../gameonvb/staircaseController').then(({ mountStaircase }) => {
      if (!canceled) destroy = mountStaircase(element, onLanding).destroy
    }).catch(() => {
      if (canceled) return
      const status = element.querySelector<HTMLElement>('[data-stair-status]')
      if (status) status.textContent = 'Interaction unavailable. The complete story remains below.'
    })
    return () => { canceled = true; destroy?.() }
  }, [onLanding])

  return (
    <div className="staircase" data-stair-root="true" data-mode="idle" data-contacts="0" data-chapter={landing} ref={root}>
      <div className="staircase-stage" id="gameonvb-staircase" data-stair-stage="true" role="group" aria-label="Interactive volleyball staircase" tabIndex={-1}>
        <svg className="staircase-fallback" data-stair-fallback="true" viewBox="0 0 900 650" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}-stone`} x2="0.7" y2="1"><stop stopColor="#39342a" /><stop offset="1" stopColor="#0e1113" /></linearGradient>
            <radialGradient id={`${id}-ball`} cx=".3" cy=".2"><stop stopColor="#fffae5" /><stop offset="1" stopColor="#837863" /></radialGradient>
          </defs>
          <path fill={`url(#${id}-stone)`} d="M-100 230 250 150 410 285 45 380Z M45 380 410 285 410 680 45 680Z M410 285 570 430 190 520 45 380Z M190 520 570 430 570 680 190 680Z M570 430 810 610 425 720 190 520Z" />
          <path d="M-100 230 250 150 410 285 45 380 M45 380 190 520 570 430 M190 520 425 720 810 610" fill="none" stroke="#a0824c" strokeWidth="2" />
          <g data-stair-fallback-ball="true" transform="translate(260 235)">
            <circle r="90" fill={`url(#${id}-ball)`} />
            <path d="M-80-40Q-5-80 60 55M-65 60Q-30-15 20-85M-30 85Q20 20 88 5" fill="none" stroke="#24282b" strokeWidth="23" />
            <path d="M-8 75Q40 45 85 30" fill="none" stroke="#d6aa28" strokeWidth="20" />
          </g>
        </svg>
        <button className="staircase-ball" data-stair-ball="true" aria-label="Volleyball. Drag and release to throw, Enter or Space to release, Escape to cancel." aria-describedby={`${id}-instructions`} disabled>
          <span className="visually-hidden">Catch the ball</span>
        </button>
        <nav className="staircase-links" aria-label="Read the story behind each landing">
          {STORY_CHAPTERS.map((item, index) => (
            <a className="target-link" href={`#${item.stages[0].id}`} key={item.id} aria-current={landing === index ? 'step' : undefined} aria-label={`Read chapter ${index + 1}: ${item.title}`}>
              <span>{String(index + 1).padStart(2, '0')}</span><i aria-hidden="true" />
            </a>
          ))}
        </nav>
        <p className="staircase-capability" data-stair-capability="true" hidden />
      </div>
      <div className="staircase-controls">
        <div className="staircase-actions">
          <button data-stair-release="true" disabled>Release the ball <span aria-hidden="true">↘</span></button>
          <button data-stair-reset="true" disabled>Reset <span aria-hidden="true">↺</span></button>
        </div>
        <div className="staircase-current">
          <p>Highlighted by the landing</p>
          <a className="target-link" href={`#${chapter.stages[0].id}`}><span>{String(landing + 1).padStart(2, '0')}</span>{chapter.title}<span aria-hidden="true">↓</span></a>
        </div>
        <div className="staircase-feedback">
          <p data-stair-status="true" role="status" aria-live="polite">Preparing interaction.</p>
          <p id={`${id}-instructions`}>Drag the ball, or press Release. Escape cancels a catch. Scroll stays yours.</p>
        </div>
      </div>
      <p className="staircase-note">A playable illustration, not a live event. Read the complete story without playing. No registrations or payments are executed.</p>
    </div>
  )
}
