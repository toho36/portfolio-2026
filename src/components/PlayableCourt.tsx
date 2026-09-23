import { useEffect, useId, useRef, useState } from 'react'
import { createCourtBall, launchCourtBall, stepCourtBall } from '../voleyevents/courtBall'
import { Volleyball } from './Volleyball'
import './PlayableCourt.css'

type Motion = 'idle' | 'playing' | 'dragging'
type Drag = {
  id: number; offsetX: number; offsetY: number
  startX: number; startY: number
  time: number; vx: number; vy: number; moved: boolean
}
const clamp = (value: number) => Math.max(0, Math.min(1, value))

export function PlayableCourt() {
  const rootRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLDivElement>(null)
  const ballRef = useRef<HTMLButtonElement>(null)
  const energyRef = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)
  const serveRef = useRef<HTMLButtonElement>(null)
  const resetRef = useRef<HTMLButtonElement>(null)
  const hintId = useId()
  const [ui, setUi] = useState({ motion: 'idle' as Motion, contacts: 0, status: 'Your court. Make a move.' })

  useEffect(() => {
    const root = rootRef.current!
    const field = fieldRef.current!
    const ball = ballRef.current!
    const energy = energyRef.current!
    const shadow = shadowRef.current!
    const serveButton = serveRef.current!
    const resetButton = resetRef.current!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let state = createCourtBall()
    let raf = 0
    let previous = 0
    let drag: Drag | null = null
    let suppressClick = false
    let width = 0
    let height = 0
    let size = 0
    const rect = field.getBoundingClientRect()
    let inView = rect.bottom > 0 && rect.top < window.innerHeight

    function show(motion: Motion, status: string) {
      root.dataset.motion = motion
      root.dataset.contacts = String(state.contacts)
      setUi({ motion, status, contacts: state.contacts })
    }

    function paint() {
      const x = state.x * Math.max(0, width - size)
      const y = state.y * Math.max(0, height - size)
      ball.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${state.angle}deg)`
      energy.style.transform = `translate3d(${x}px, ${y}px, 0)`
      shadow.style.transform = `translate3d(${x}px, ${height - size * 0.16}px, 0) scale(${0.55 + state.y * 0.45})`
      shadow.style.opacity = String(0.12 + state.y * 0.28)
    }

    function stop() {
      cancelAnimationFrame(raf)
      raf = 0
      previous = 0
      const held = drag
      drag = null
      if (held && ball.hasPointerCapture(held.id)) ball.releasePointerCapture(held.id)
      state = { ...state, vx: 0, vy: 0, resting: true }
    }

    function cancel(status = 'Paused. Serve again whenever you like.') {
      suppressClick = drag !== null
      stop()
      paint()
      show('idle', status)
    }

    function measure() {
      const nextWidth = field.clientWidth
      const nextHeight = field.clientHeight
      const nextSize = ball.offsetWidth
      if (width === nextWidth && height === nextHeight && size === nextSize) return
      width = nextWidth
      height = nextHeight
      size = nextSize
      cancel('Court ready. Grab the ball or serve.')
    }

    function tick(now: number) {
      raf = 0
      if (document.hidden || !inView || reduced.matches) {
        cancel()
        return
      }
      const before = state.contacts
      state = stepCourtBall(state, previous ? (now - previous) / 1000 : 1 / 60)
      previous = now
      paint()
      if (state.resting) {
        previous = 0
        show('idle', 'At rest. One more serve?')
      } else {
        if (state.contacts !== before) show('playing', `Contact ${state.contacts}. Keep it in play.`)
        raf = requestAnimationFrame(tick)
      }
    }

    function start(vx?: number, vy?: number) {
      stop()
      if (document.hidden || !inView) {
        show('idle', 'Court paused. Come back and serve.')
        return
      }
      if (reduced.matches) {
        // Placement is not a simulated collision: never manufacture contacts.
        state = { ...state, x: 0.62, y: 1, angle: 35 }
        paint()
        show('idle', 'Ball placed. Reduced motion is on.')
        return
      }
      state = launchCourtBall(state, vx, vy)
      show('playing', 'Ball in play. Catch it or let it bounce.')
      raf = requestAnimationFrame(tick)
    }

    function serve() { start() }
    function reset() {
      stop()
      state = { ...createCourtBall(), contacts: state.contacts }
      paint()
      show('idle', 'Court reset. Session contacts kept.')
    }

    function pointerDown(event: PointerEvent) {
      if (event.button !== 0 || !event.isPrimary || drag) return
      stop()
      suppressClick = false
      const bounds = field.getBoundingClientRect()
      const x = state.x * Math.max(0, width - size)
      const y = state.y * Math.max(0, height - size)
      drag = {
        id: event.pointerId,
        offsetX: event.clientX - bounds.left - field.clientLeft - x,
        offsetY: event.clientY - bounds.top - field.clientTop - y,
        startX: event.clientX, startY: event.clientY,
        time: performance.now(), vx: 0, vy: 0, moved: false,
      }
      ball.setPointerCapture(event.pointerId)
      show('dragging', reduced.matches ? 'Move the ball. Release to place it.' : 'Got it. Release to throw; Escape to cancel.')
    }

    function pointerMove(event: PointerEvent) {
      if (!drag || drag.id !== event.pointerId) return
      const now = performance.now()
      const dt = Math.max((now - drag.time) / 1000, 0.008)
      const bounds = field.getBoundingClientRect()
      const travelX = Math.max(1, width - size)
      const travelY = Math.max(1, height - size)
      const x = clamp((event.clientX - bounds.left - field.clientLeft - drag.offsetX) / travelX)
      const y = clamp((event.clientY - bounds.top - field.clientTop - drag.offsetY) / travelY)
      drag.vx = (x - state.x) / dt
      drag.vy = (y - state.y) / dt
      drag.moved ||= Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5
      state = { ...state, x, y, angle: reduced.matches ? state.angle : state.angle + (x - state.x) * 160 }
      drag.time = now
      paint()
    }

    function pointerUp(event: PointerEvent) {
      if (!drag || drag.id !== event.pointerId) return
      const released = drag
      suppressClick = released.moved
      stop()
      if (!released.moved) {
        show('idle', 'Ready to serve.')
      } else if (reduced.matches) {
        show('idle', 'Ball placed. Reduced motion is on.')
      } else {
        const fresh = performance.now() - released.time < 120
        start(fresh ? released.vx : 0, fresh ? released.vy : 0)
      }
    }

    function pointerCancel(event: PointerEvent) {
      if (drag?.id === event.pointerId) cancel('Throw cancelled. Ready again.')
    }
    function ballClick(event: MouseEvent) {
      if (event.detail > 0 && suppressClick) {
        suppressClick = false
        return
      }
      suppressClick = false
      serve()
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape' && (drag || raf)) cancel('Throw cancelled. Ready again.')
    }
    function visibility() { if (document.hidden) cancel() }
    function motionChange() { cancel(reduced.matches ? 'Reduced motion is on. Serve to place the ball.' : 'Motion is on. Ready to serve.') }
    function parallax(event: PointerEvent) {
      if (event.pointerType === 'touch' || reduced.matches) return
      const bounds = root.getBoundingClientRect()
      root.style.setProperty('--court-shift-x', `${((event.clientX - bounds.left) / bounds.width - 0.5) * 24}px`)
      root.style.setProperty('--court-shift-y', `${((event.clientY - bounds.top) / bounds.height - 0.5) * 16}px`)
    }
    function resetParallax() {
      root.style.removeProperty('--court-shift-x')
      root.style.removeProperty('--court-shift-y')
    }

    ball.addEventListener('pointerdown', pointerDown)
    ball.addEventListener('pointermove', pointerMove)
    ball.addEventListener('pointerup', pointerUp)
    ball.addEventListener('pointercancel', pointerCancel)
    ball.addEventListener('lostpointercapture', pointerCancel)
    ball.addEventListener('click', ballClick)
    serveButton.addEventListener('click', serve)
    resetButton.addEventListener('click', reset)
    document.addEventListener('keydown', escape)
    document.addEventListener('visibilitychange', visibility)
    reduced.addEventListener('change', motionChange)
    window.addEventListener('resize', measure)
    root.addEventListener('pointermove', parallax)
    root.addEventListener('pointerleave', resetParallax)
    const resize = new ResizeObserver(measure)
    resize.observe(field)
    const intersection = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      if (!inView) cancel()
    })
    intersection.observe(field)
    measure()

    return () => {
      stop()
      resize.disconnect()
      intersection.disconnect()
      window.removeEventListener('resize', measure)
      root.removeEventListener('pointerleave', resetParallax)
      root.removeEventListener('pointermove', parallax)
      reduced.removeEventListener('change', motionChange)
      document.removeEventListener('visibilitychange', visibility)
      document.removeEventListener('keydown', escape)
      resetButton.removeEventListener('click', reset)
      serveButton.removeEventListener('click', serve)
      ball.removeEventListener('click', ballClick)
      ball.removeEventListener('lostpointercapture', pointerCancel)
      ball.removeEventListener('pointercancel', pointerCancel)
      ball.removeEventListener('pointerup', pointerUp)
      ball.removeEventListener('pointermove', pointerMove)
      ball.removeEventListener('pointerdown', pointerDown)
    }
  }, [])

  return (
    <div ref={rootRef} className="playable-court" data-motion={ui.motion} data-contacts={ui.contacts}>
      <div ref={fieldRef} className="playable-court__field" role="group" aria-label="Interactive volleyball court">
        <span className="playable-court__label" aria-hidden="true">Your court / Make a move</span>
        <div className="playable-court__streaks" aria-hidden="true" />
        <svg className="playable-court__floor" viewBox="0 0 600 640" preserveAspectRatio="none" aria-hidden="true">
          <path className="playable-court__floor-surface" d="M-100 330 440 180 760 575 95 760Z" />
          <g className="playable-court__floor-lines" fill="none" strokeWidth="3">
            <path d="M-100 330 440 180 760 575 95 760Z" />
            <path d="M-20 351 420 227 657 556 129 689Z" />
            <path d="m197 290 187 337M118 313l167 339M285 264l207 336" />
          </g>
        </svg>
        <span className="playable-court__mark" aria-hidden="true">GAME<br />ON<br />VB</span>
        <div ref={shadowRef} className="playable-court__shadow" aria-hidden="true" />
        <div ref={energyRef} className="playable-court__energy" aria-hidden="true">
          <i className="playable-court__energy-ring" />
          <i className="playable-court__energy-ring" />
          <i className="playable-court__energy-ring" />
        </div>
        <button ref={ballRef} className="playable-court__ball" type="button" aria-label="Volleyball: drag to throw, or press Enter or Space to serve" aria-describedby={hintId}>
          <Volleyball />
        </button>
        <span className="playable-court__coordinate" aria-hidden="true">01 — THROW / IMPACT / REPEAT</span>
      </div>
      <div className="playable-court__controls">
        <button ref={serveRef} type="button" className="playable-court__serve">Serve the ball <span aria-hidden="true">↗</span></button>
        <button ref={resetRef} type="button" className="playable-court__reset">Reset <span aria-hidden="true">↺</span></button>
      </div>
      <p className="playable-court__hint" id={hintId}>Grab, drag, let go. Or serve with a click. Nothing to unlock.</p>
      <div className="playable-court__feedback">
        <p className="playable-court__contacts"><strong>{String(ui.contacts).padStart(2, '0')}</strong><span>Court contacts<br />This session · toy only</span></p>
        <p className="playable-court__status" role="status" aria-live="polite" aria-atomic="true">{ui.status}</p>
      </div>
    </div>
  )
}
